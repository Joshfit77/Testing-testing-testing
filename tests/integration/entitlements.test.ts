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

  it("enforces AI entitlements and monthly quotas server-side: the coach is Pro-only", async () => {
    await expect(assertAiAllowed(user.id, "free", "chat")).rejects.toMatchObject({ code: "not_entitled" });
    await expect(assertAiAllowed(user.id, "plus", "chat")).rejects.toMatchObject({ code: "not_entitled" });
    await expect(assertAiAllowed(user.id, "plus", "plan")).rejects.toMatchObject({ code: "not_entitled" });
    await expect(assertAiAllowed(user.id, "pro", "chat")).resolves.toMatchObject({ chatUsed: 0, smartUsed: 0, chatLimit: 150, smartLimit: 15 });

    // The larger model's monthly share is metered from the usage table: once it's used up, plan generation stops,
    // while ordinary chat (on the fast model) keeps working.
    // Earlier this month, but not in the last minute (that would trip the separate per-minute burst limit).
    const now = new Date();
    const earlier = new Date(Math.max(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) + 1000, now.getTime() - 5 * 60_000)).toISOString();
    await serviceClient()
      .from("ai_usage_events")
      .insert(Array.from({ length: 15 }, () => ({ user_id: user.id, kind: "chat", model: "claude-sonnet-5-5", model_tier: "smart", created_at: earlier })));
    await expect(assertAiAllowed(user.id, "pro", "plan")).rejects.toMatchObject({ code: "quota" });
    await expect(assertAiAllowed(user.id, "pro", "chat")).resolves.toMatchObject({ chatUsed: 15, smartUsed: 15 });

    process.env.PLAN_PRO_AI_MONTHLY_LIMIT = "15";
    try {
      const err = await assertAiAllowed(user.id, "pro", "chat").catch((e) => e);
      expect(err).toBeInstanceOf(AiError);
      expect(err.code).toBe("quota");
    } finally {
      delete process.env.PLAN_PRO_AI_MONTHLY_LIMIT;
    }
  });

  it("maps earlier Stripe prices to their plan, and never downgrades a known subscription over an unknown price", async () => {
    const u = await createTestUser("legacy-price");
    const ent = async () => (await serviceClient().from("user_entitlements").select("plan").eq("user_id", u.id).single()).data?.plan;
    try {
      await syncSubscription(fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si", price: { id: "price_test_plus_yearly" }, current_period_end: Math.floor(Date.now() / 1000) + 86400 }] } }));
      expect(await ent()).toBe("plus");
      const old = fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si", price: { id: "price_old_pro" }, current_period_end: Math.floor(Date.now() / 1000) + 86400 }] } });
      await syncSubscription(old);
      expect(await ent()).toBe("pro");
      // A renewal arrives on a price this server no longer lists: the stored plan is kept and the period extended.
      const renewedEnd = Math.floor(Date.now() / 1000) + 40 * 86400;
      await syncSubscription({ ...old, items: { ...old.items, data: [{ ...old.items.data[0]!, price: { id: "price_removed_from_config" }, current_period_end: renewedEnd }] } } as unknown as Stripe.Subscription);
      const { data: row } = await serviceClient().from("subscriptions").select("plan, stripe_price_id, current_period_end").eq("stripe_subscription_id", old.id).single();
      expect(row).toMatchObject({ plan: "pro", stripe_price_id: "price_removed_from_config" });
      expect(new Date(row!.current_period_end as string).getTime()).toBe(renewedEnd * 1000);
      expect(await ent()).toBe("pro");
    } finally {
      await deleteTestUser(u);
    }
  });

  it("keeps an existing Plus subscriber's AI allowance while that subscription stays on Plus", async () => {
    const u = await createTestUser("legacy-ai");
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si", price: { id: "price_old_plus_b" }, current_period_end: Math.floor(Date.now() / 1000) + 86400 }] } });
      await syncSubscription(sub);
      await expect(assertAiAllowed(u.id, "plus", "chat")).rejects.toMatchObject({ code: "not_entitled" });

      // What the migration records for subscriptions that existed before the plan change.
      const { error } = await serviceClient()
        .from("legacy_plan_terms")
        .insert({ stripe_subscription_id: sub.id, user_id: u.id, plan: "plus", ai_monthly_limit: 60, ai_plan_monthly_limit: 0, ai_smart_monthly_limit: 6 });
      expect(error).toBeNull();
      await expect(assertAiAllowed(u.id, "plus", "chat")).resolves.toMatchObject({ chatLimit: 60, planLimit: 0, smartLimit: 6, legacy: true });
      // Old Plus never included plan generation.
      await expect(assertAiAllowed(u.id, "plus", "plan")).rejects.toMatchObject({ code: "plan_not_entitled" });

      // Members can read their own terms, not anyone else's, and can't write them.
      const own = await u.client.from("legacy_plan_terms").select("plan");
      expect(own.data).toEqual([{ plan: "plus" }]);
      const write = await u.client.from("legacy_plan_terms").update({ ai_monthly_limit: 9999 }).eq("user_id", u.id).select();
      expect(write.data ?? []).toEqual([]);

      // Upgrading the same subscription to Pro uses Pro's allowance.
      await syncSubscription({ ...sub, items: { ...sub.items, data: [{ ...sub.items.data[0]!, price: { id: "price_test_pro" } }] } } as unknown as Stripe.Subscription);
      await expect(assertAiAllowed(u.id, "pro", "chat")).resolves.toMatchObject({ chatLimit: 150, legacy: false });

      // Back on Plus, then the subscription ends: the terms end with it.
      await syncSubscription(sub);
      await expect(assertAiAllowed(u.id, "plus", "chat")).resolves.toMatchObject({ chatLimit: 60 });
      await syncSubscription({ ...sub, status: "canceled", items: { ...sub.items, data: [{ ...sub.items.data[0]!, current_period_end: Math.floor(Date.now() / 1000) - 60 }] } } as unknown as Stripe.Subscription);
      await expect(assertAiAllowed(u.id, "free", "chat")).rejects.toMatchObject({ code: "not_entitled" });
    } finally {
      await deleteTestUser(u);
    }
  });
});
