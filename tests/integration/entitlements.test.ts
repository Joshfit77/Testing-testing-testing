import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

function fakeSubscription(overrides: Record<string, unknown>): Stripe.Subscription {
  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
  return {
    id: `sub_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`,
    object: "subscription",
    customer: "cus_test",
    status: "active",
    cancel_at_period_end: false,
    metadata: {},
    items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_plus" }, current_period_end: periodEnd }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe.skipIf(!available)("subscriptions, webhooks & entitlements", async () => {
  const { handleStripeEvent, syncSubscription } = await import("@/server/services/billing");
  const { assertAiAllowed, AiError } = await import("@/server/services/ai-coach");
  const { POST: webhook } = await import("@/app/api/stripe/webhook/route");
  const { NextRequest } = await import("next/server");

  let user: TestUser;
  const plan = async () => (await serviceClient().from("user_entitlements").select("plan, source").eq("user_id", user.id).single()).data;

  beforeAll(async () => {
    user = await createTestUser("subscriber");
  });
  afterAll(async () => deleteTestUser(user));

  it("rejects webhooks without a valid Stripe signature", async () => {
    const body = JSON.stringify({ id: "evt_unsigned", type: "customer.subscription.updated", data: { object: {} } });
    const missing = await webhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body }));
    expect(missing.status).toBe(400);
    const bad = await webhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body, headers: { "stripe-signature": "t=1,v1=deadbeef" } }));
    expect(bad.status).toBe(400);
    expect(await plan()).toMatchObject({ plan: "free" });
  });

  it("upgrades the entitlement from a verified subscription webhook, once per event", async () => {
    const sub = fakeSubscription({ metadata: { user_id: user.id } });
    const event = { id: `evt_${crypto.randomUUID()}`, object: "event", type: "customer.subscription.created", data: { object: sub } };
    const payload = JSON.stringify(event);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
    const res = await webhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, duplicate: false });
    expect(await plan()).toMatchObject({ plan: "plus", source: "stripe" });

    const again = await webhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
    expect(await again.json()).toMatchObject({ duplicate: true });
  });

  it("keeps access while past due, upgrades on plan change, and downgrades after cancellation ends", async () => {
    const sub = fakeSubscription({ metadata: { user_id: user.id } });
    await syncSubscription(sub);
    await syncSubscription({ ...sub, status: "past_due" } as Stripe.Subscription);
    expect(await plan()).toMatchObject({ plan: "plus" });

    await syncSubscription({ ...sub, items: { ...sub.items, data: [{ ...sub.items.data[0]!, price: { id: "price_test_pro" } }] } } as unknown as Stripe.Subscription);
    expect(await plan()).toMatchObject({ plan: "pro" });

    // Canceled at period end: access continues until the period ends.
    await syncSubscription({ ...sub, status: "canceled", cancel_at_period_end: true } as Stripe.Subscription);
    expect((await plan())?.plan).not.toBe("free");

    const ended = { ...sub, status: "canceled", items: { ...sub.items, data: [{ ...sub.items.data[0]!, current_period_end: Math.floor(Date.now() / 1000) - 60 }] } };
    // Both subscription rows (the first created via webhook and this one) must be ended for a downgrade.
    const { data: rows } = await serviceClient().from("subscriptions").select("stripe_subscription_id").eq("user_id", user.id);
    for (const r of rows ?? []) await syncSubscription({ ...ended, id: r.stripe_subscription_id } as unknown as Stripe.Subscription);
    expect(await plan()).toMatchObject({ plan: "free" });
  });

  it("grants Pro for the yearly all-access price", async () => {
    const yearly = await createTestUser("yearly");
    try {
      await syncSubscription(fakeSubscription({ metadata: { user_id: yearly.id }, items: { object: "list", data: [{ id: "si_y", price: { id: "price_test_pro_yearly" }, current_period_end: Math.floor(Date.now() / 1000) + 365 * 86400 }] } }));
      const { data } = await serviceClient().from("user_entitlements").select("plan").eq("user_id", yearly.id).single();
      expect(data).toMatchObject({ plan: "pro" });
    } finally {
      await deleteTestUser(yearly);
    }
  });

  it("ignores subscriptions with unknown prices or users", async () => {
    await syncSubscription(fakeSubscription({ metadata: { user_id: user.id }, items: { object: "list", data: [{ id: "si", price: { id: "price_unknown" } }] } }));
    expect(await plan()).toMatchObject({ plan: "free" });
    await expect(handleStripeEvent({ id: `evt_${crypto.randomUUID()}`, type: "ping", data: { object: {} } } as unknown as Stripe.Event)).resolves.toBe(true);
  });

  it("enforces AI entitlements and monthly quotas server-side", async () => {
    await expect(assertAiAllowed(user.id, "free", "chat")).rejects.toMatchObject({ code: "not_entitled" });
    await expect(assertAiAllowed(user.id, "plus", "plan")).rejects.toMatchObject({ code: "plan_not_entitled" });
    // Nothing is sent to the AI provider until the member explicitly agrees.
    await expect(assertAiAllowed(user.id, "plus", "chat")).rejects.toMatchObject({ code: "consent_required" });
    const { error: consentErr } = await user.client.from("profiles").update({ ai_consent_at: new Date().toISOString() }).eq("id", user.id);
    expect(consentErr).toBeNull();
    await expect(assertAiAllowed(user.id, "plus", "chat")).resolves.toMatchObject({ chatUsed: 0 });

    process.env.PLAN_PLUS_AI_MONTHLY_LIMIT = "2";
    try {
      await serviceClient().from("ai_usage_events").insert([{ user_id: user.id, kind: "chat" }, { user_id: user.id, kind: "chat" }]);
      const err = await assertAiAllowed(user.id, "plus", "chat").catch((e) => e);
      expect(err).toBeInstanceOf(AiError);
      expect(err.code).toBe("quota");
    } finally {
      delete process.env.PLAN_PLUS_AI_MONTHLY_LIMIT;
    }
  });
});
