import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** What Stripe currently holds for each subscription (a local stand-in for GET /v1/subscriptions/:id). */
const stripeSubs = new Map<string, Stripe.Subscription>();
const stripeCharges = new Map<string, unknown>();
const stripeInvoices = new Map<string, unknown>();
const stripeDisputes = new Map<string, unknown>();
const stripeInvoiceByIntent = new Map<string, string>();

/** A paid invoice for a subscription, its PaymentIntent and charge, as Stripe would hold them. */
function fakePayment(subscriptionId: string, over: { refunded?: boolean; amount_refunded?: number } = {}) {
  const key = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const invoice = { id: `in_${key}`, object: "invoice", status: "paid", parent: { type: "subscription_details", subscription_details: { subscription: subscriptionId } } };
  const charge = { id: `ch_${key}`, object: "charge", amount: 1999, amount_refunded: over.amount_refunded ?? 0, refunded: over.refunded ?? false, payment_intent: `pi_${key}` };
  stripeInvoices.set(invoice.id, invoice);
  stripeCharges.set(charge.id, charge);
  stripeInvoiceByIntent.set(charge.payment_intent, invoice.id);
  return { invoice, charge };
}
let stripeServer: Server;

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
    stripeServer = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://stripe.local");
      const json = (status: number, body: unknown) => void res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
      const missing = () => json(404, { error: { type: "invalid_request_error", code: "resource_missing", message: "No such object" } });
      // Invoice payments of a PaymentIntent (how Stripe links a charge to its invoice since API 2025-03-31).
      if (url.pathname === "/v1/invoice_payments") {
        const pi = url.searchParams.get("payment[payment_intent]");
        const invoice = pi ? stripeInvoiceByIntent.get(pi) : undefined;
        return json(200, { object: "list", has_more: false, data: invoice ? [{ id: `inpay_${pi}`, object: "invoice_payment", invoice }] : [] });
      }
      const m = url.pathname.match(/^\/v1\/(subscriptions|charges|invoices|disputes)\/([^/?]+)/);
      const store = m ? { subscriptions: stripeSubs, charges: stripeCharges, invoices: stripeInvoices, disputes: stripeDisputes }[m[1] as "subscriptions"] : undefined;
      const obj = m && store ? (store as Map<string, unknown>).get(decodeURIComponent(m[2]!)) : undefined;
      return obj ? json(200, obj) : missing();
    });
    await new Promise<void>((resolve) => stripeServer.listen(4613, "127.0.0.1", resolve));
    user = await createTestUser("subscriber");
  });
  afterAll(async () => {
    await deleteTestUser(user);
    await new Promise((resolve) => stripeServer.close(resolve));
  });

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
    stripeSubs.set(sub.id, sub);
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

    // Set to cancel at the period end: Stripe keeps it active, and access continues until then.
    await syncSubscription({ ...sub, status: "active", cancel_at_period_end: true } as Stripe.Subscription);
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

  it("an immediately cancelled subscription ends access at once, and an admin grant isn't lowered by a subscription", async () => {
    const u = await createTestUser("cancel-now");
    const ent = async () => (await serviceClient().from("user_entitlements").select("plan, source").eq("user_id", u.id).single()).data;
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id } });
      await syncSubscription(sub);
      expect(await ent()).toMatchObject({ plan: "plus" });
      // Cancelled now (or after failed renewals): the period end may still lie ahead, but nothing more is owed.
      await syncSubscription({ ...sub, status: "canceled" } as Stripe.Subscription);
      expect(await ent()).toMatchObject({ plan: "free" });

      await serviceClient().from("user_entitlements").upsert({ user_id: u.id, plan: "pro", source: "admin" }, { onConflict: "user_id" });
      await syncSubscription({ ...sub, id: `${sub.id}b` } as Stripe.Subscription);
      expect(await ent()).toMatchObject({ plan: "pro", source: "admin" });
    } finally {
      await deleteTestUser(u);
    }
  });

  it("a full refund of the current period ends its access; a partial refund doesn't; the next paid period restores it", async () => {
    const u = await createTestUser("refund");
    const ent = async () => (await serviceClient().from("user_entitlements").select("plan").eq("user_id", u.id).single()).data?.plan;
    const send = (type: string, object: unknown) => handleStripeEvent({ id: `evt_${crypto.randomUUID()}`, object: "event", type, data: { object } } as unknown as Stripe.Event);
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } });
      const first = fakePayment(sub.id);
      stripeSubs.set(sub.id, { ...sub, latest_invoice: first.invoice.id } as Stripe.Subscription);
      await syncSubscription(stripeSubs.get(sub.id)!);
      expect(await ent()).toBe("pro");

      // A partial (goodwill) refund leaves the paid period alone.
      stripeCharges.set(first.charge.id, { ...first.charge, amount_refunded: 500, refunded: false });
      await send("charge.refunded", stripeCharges.get(first.charge.id));
      expect(await ent()).toBe("pro");

      // A full refund of the current period's payment ends that period's access, whatever Stripe's status says.
      stripeCharges.set(first.charge.id, { ...first.charge, amount_refunded: 1999, refunded: true });
      await send("charge.refunded", stripeCharges.get(first.charge.id));
      expect(await ent()).toBe("free");
      const row = (await serviceClient().from("subscriptions").select("status, access_revoked_reason, revoked_invoice_id").eq("stripe_subscription_id", sub.id).single()).data;
      expect(row).toMatchObject({ status: "active", access_revoked_reason: "refund", revoked_invoice_id: first.invoice.id });

      // A later event about the same subscription can't quietly restore the refunded period.
      await syncSubscription(stripeSubs.get(sub.id)!);
      expect(await ent()).toBe("free");

      // The next period is paid: access returns.
      const second = fakePayment(sub.id);
      stripeSubs.set(sub.id, { ...sub, latest_invoice: second.invoice.id } as Stripe.Subscription);
      await send("invoice.paid", second.invoice);
      expect(await ent()).toBe("pro");
    } finally {
      await deleteTestUser(u);
    }
  });

  it("a dispute pauses access until it's won; a refund of an earlier period leaves the current one", async () => {
    const u = await createTestUser("dispute");
    const ent = async () => (await serviceClient().from("user_entitlements").select("plan").eq("user_id", u.id).single()).data?.plan;
    const send = (type: string, object: unknown) => handleStripeEvent({ id: `evt_${crypto.randomUUID()}`, object: "event", type, data: { object } } as unknown as Stripe.Event);
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro_yearly" }, current_period_end: Math.floor(Date.now() / 1000) + 300 * 86400 }] } });
      const old = fakePayment(sub.id);
      const current = fakePayment(sub.id);
      stripeSubs.set(sub.id, { ...sub, latest_invoice: current.invoice.id } as Stripe.Subscription);
      await syncSubscription(stripeSubs.get(sub.id)!);
      expect(await ent()).toBe("pro");

      // Refunding last year's payment doesn't touch the year the member has paid for now.
      stripeCharges.set(old.charge.id, { ...old.charge, amount_refunded: 1999, refunded: true });
      await send("charge.refunded", stripeCharges.get(old.charge.id));
      expect(await ent()).toBe("pro");

      const dispute = { id: `dp_${crypto.randomUUID().slice(0, 8)}`, object: "dispute", charge: current.charge.id, status: "needs_response" };
      stripeDisputes.set(dispute.id, dispute);
      await send("charge.dispute.created", dispute);
      expect(await ent()).toBe("free");

      stripeDisputes.set(dispute.id, { ...dispute, status: "won" });
      await send("charge.dispute.closed", stripeDisputes.get(dispute.id));
      expect(await ent()).toBe("pro");

      // A lost dispute keeps the access ended.
      stripeDisputes.set(dispute.id, { ...dispute, status: "needs_response" });
      await send("charge.dispute.created", dispute);
      stripeDisputes.set(dispute.id, { ...dispute, status: "lost" });
      await send("charge.dispute.closed", stripeDisputes.get(dispute.id));
      expect(await ent()).toBe("free");
    } finally {
      await deleteTestUser(u);
    }
  });

  it("a late, out-of-date subscription event can't undo the current state", async () => {
    const u = await createTestUser("out-of-order");
    const ent = async () => (await serviceClient().from("user_entitlements").select("plan").eq("user_id", u.id).single()).data?.plan;
    try {
      const current = fakeSubscription({ metadata: { user_id: u.id }, status: "active" });
      stripeSubs.set(current.id, current);
      await syncSubscription(current);
      expect(await ent()).toBe("plus");
      // The subscription's first event (still "incomplete") arrives late, after a retry.
      const stale = { ...current, status: "incomplete" };
      const payload = JSON.stringify({ id: `evt_${crypto.randomUUID()}`, object: "event", type: "customer.subscription.created", data: { object: stale } });
      const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
      const res = await webhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
      expect(res.status).toBe(200);
      expect(await ent()).toBe("plus");
    } finally {
      await deleteTestUser(u);
    }
  });
});
