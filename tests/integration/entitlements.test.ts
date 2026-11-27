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
/** Stripe's event log (GET /v1/events), newest first, for reconciliation to re-read. */
const stripeEventLog: Record<string, unknown>[] = [];
/** How many pages of the event log were requested (pagination is exercised, not assumed). */
let stripeEventPages = 0;

/** A paid invoice for a subscription, its PaymentIntent and charge, as Stripe would hold them. */
function fakePayment(subscriptionId: string, over: { refunded?: boolean; amount_refunded?: number; created?: number } = {}) {
  const key = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const invoice = {
    id: `in_${key}`,
    object: "invoice",
    status: "paid",
    // When Stripe created the invoice (seconds), where a test is about the order of invoices.
    ...(over.created === undefined ? {} : { created: over.created }),
    parent: { type: "subscription_details", subscription_details: { subscription: subscriptionId } },
  };
  const charge = { id: `ch_${key}`, object: "charge", amount: 1799, amount_refunded: over.amount_refunded ?? 0, refunded: over.refunded ?? false, payment_intent: `pi_${key}` };
  stripeInvoices.set(invoice.id, invoice);
  stripeCharges.set(charge.id, charge);
  stripeInvoiceByIntent.set(charge.payment_intent, invoice.id);
  return { invoice, charge };
}
let stripeServer: Server;

function fakeSubscription(overrides: Record<string, unknown>): Stripe.Subscription {
  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
  // One Stripe customer per member, as checkout creates them (the server refuses a customer shared by two members).
  const member = (overrides.metadata as { user_id?: string } | undefined)?.user_id;
  return {
    id: `sub_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`,
    object: "subscription",
    customer: member ? `cus_${member.replace(/-/g, "").slice(0, 16)}` : "cus_test",
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
      if (url.pathname === "/v1/events") {
        const gte = Number(url.searchParams.get("created[gte]") ?? 0);
        const lt = Number(url.searchParams.get("created[lt]") ?? Number.MAX_SAFE_INTEGER);
        const types = url.searchParams.getAll("types[]");
        // Newest first, in pages of `limit` (at most 100) continued with starting_after, like Stripe.
        const all = stripeEventLog
          .filter((e) => (e.created as number) >= gte && (e.created as number) < lt && (!types.length || types.includes(e.type as string)))
          .sort((x, y) => (y.created as number) - (x.created as number) || String(y.id).localeCompare(String(x.id)));
        const pageSize = Math.min(100, Number(url.searchParams.get("limit") ?? 10));
        const after = url.searchParams.get("starting_after");
        const from = after ? all.findIndex((e) => e.id === after) + 1 : 0;
        const data = all.slice(from, from + pageSize);
        stripeEventPages++;
        return json(200, { object: "list", has_more: from + pageSize < all.length, url: "/v1/events", data });
      }
      if (url.pathname === "/v1/subscriptions" && req.method === "GET") {
        // Listing (reconciliation's sweep for subscriptions never stored): only those the test marks as listed.
        const data = [...stripeSubs.values()].filter((sub) => (sub as unknown as { listed?: boolean }).listed);
        return json(200, { object: "list", has_more: false, url: "/v1/subscriptions", data });
      }
      if (url.pathname === "/v1/invoice_payments") {
        const pi = url.searchParams.get("payment[payment_intent]");
        const invoice = pi ? stripeInvoiceByIntent.get(pi) : undefined;
        return json(200, { object: "list", has_more: false, data: invoice ? [{ id: `inpay_${pi}`, object: "invoice_payment", invoice }] : [] });
      }
      // A charge Stripe can't serve right now (a failure that repeats on every retry).
      if (url.pathname.startsWith("/v1/charges/ch_unavailable")) return json(500, { error: { type: "api_error", message: "unavailable" } });
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

  it("ignores a correctly signed event from the other Stripe mode (live event, test key): nothing changes", async () => {
    const sub = fakeSubscription({ metadata: { user_id: user.id } });
    stripeSubs.set(sub.id, sub);
    const event = { id: `evt_${crypto.randomUUID()}`, object: "event", livemode: true, type: "customer.subscription.created", data: { object: sub } };
    const payload = JSON.stringify(event);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
    const res = await webhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, ignored: "mode" });
    expect(await plan()).toMatchObject({ plan: "free" });
    stripeSubs.delete(sub.id);
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
    await expect(handleStripeEvent({ id: `evt_${crypto.randomUUID()}`, type: "ping", data: { object: {} } } as unknown as Stripe.Event)).resolves.toBe("processed");
  });

  it("enforces AI entitlements and monthly quotas server-side: the coach is Pro-only", async () => {
    await expect(assertAiAllowed(user.id, "free", "chat")).rejects.toMatchObject({ code: "not_entitled" });
    await expect(assertAiAllowed(user.id, "plus", "chat")).rejects.toMatchObject({ code: "not_entitled" });
    await expect(assertAiAllowed(user.id, "plus", "plan")).rejects.toMatchObject({ code: "not_entitled" });
    await expect(assertAiAllowed(user.id, "pro", "chat")).resolves.toMatchObject({ chatUsed: 0, smartUsed: 0, chatLimit: 150, smartLimit: 10 });

    // The larger model's monthly share is metered from the usage table: once it's used up, plan generation stops,
    // while ordinary chat (on the fast model) keeps working.
    // Earlier this month, but not in the last minute (that would trip the separate per-minute burst limit).
    const now = new Date();
    const earlier = new Date(Math.max(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) + 1000, now.getTime() - 5 * 60_000)).toISOString();
    await serviceClient()
      .from("ai_usage_events")
      .insert(Array.from({ length: 10 }, () => ({ user_id: user.id, kind: "chat", model: "claude-sonnet-5-5", model_tier: "smart", created_at: earlier })));
    await expect(assertAiAllowed(user.id, "pro", "plan")).rejects.toMatchObject({ code: "quota" });
    await expect(assertAiAllowed(user.id, "pro", "chat")).resolves.toMatchObject({ chatUsed: 10, smartUsed: 10 });

    process.env.PLAN_PRO_AI_MONTHLY_LIMIT = "10";
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

  it("a legacy Plus subscriber whose renewal failed loses the AI allowance when the 14-day grace ends, not a month later (F-17)", async () => {
    const u = await createTestUser("legacy-pastdue");
    const entitled = async () => (await serviceClient().from("user_entitlements").select("plan").eq("user_id", u.id).single()).data?.plan;
    try {
      const day = 86_400;
      const nowS = Math.floor(Date.now() / 1000);
      // A legacy monthly Plus price (Stripe can't say its interval here, so a month is assumed, as in production).
      const sub = fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si", price: { id: "price_old_plus_b" }, current_period_end: nowS + 10 * day }] } });
      const withEnd = (status: string, periodEndS: number) =>
        ({ ...sub, status, items: { ...sub.items, data: [{ ...sub.items.data[0]!, current_period_end: periodEndS }] } }) as unknown as Stripe.Subscription;
      await syncSubscription(withEnd("active", nowS + 10 * day));
      const { error } = await serviceClient()
        .from("legacy_plan_terms")
        .insert({ stripe_subscription_id: sub.id, user_id: u.id, plan: "plus", ai_monthly_limit: 60, ai_plan_monthly_limit: 0, ai_smart_monthly_limit: 6 });
      expect(error).toBeNull();
      await expect(assertAiAllowed(u.id, "plus", "chat")).resolves.toMatchObject({ chatLimit: 60, legacy: true });

      // The renewal failed 20 days ago: Stripe has moved the period end to about 10 days from now, nothing was paid.
      await syncSubscription(withEnd("past_due", nowS + 10 * day));
      // The plan itself has lapsed to Free (14-day grace over)...
      expect(await entitled()).toBe("free");
      // ...and so has the raised AI allowance, asked as Free or (a stale plan in the request) as Plus.
      await expect(assertAiAllowed(u.id, "free", "chat")).rejects.toMatchObject({ code: "not_entitled" });
      await expect(assertAiAllowed(u.id, "plus", "chat")).rejects.toMatchObject({ code: "not_entitled" });

      // Failed 5 days ago instead: inside the grace period, both continue.
      await syncSubscription(withEnd("past_due", nowS + 25 * day));
      expect(await entitled()).toBe("plus");
      await expect(assertAiAllowed(u.id, "plus", "chat")).resolves.toMatchObject({ chatLimit: 60 });
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
      stripeCharges.set(first.charge.id, { ...first.charge, amount_refunded: 1799, refunded: true });
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

  it("reconciliation repairs a refund whose webhook never arrived, from Stripe's event log, exactly once (O-09)", async () => {
    const { reconcileBilling } = await import("@/server/services/billing-reconcile");
    const u = await createTestUser("refund-lost");
    const ent = async () => (await serviceClient().from("user_entitlements").select("plan").eq("user_id", u.id).single()).data?.plan;
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } });
      const pay = fakePayment(sub.id);
      stripeSubs.set(sub.id, { ...sub, latest_invoice: pay.invoice.id } as Stripe.Subscription);
      await syncSubscription(stripeSubs.get(sub.id)!);
      expect(await ent()).toBe("pro");
      // Stripe refunded the payment in full; the subscription is still "active" there, and the webhook was lost.
      stripeCharges.set(pay.charge.id, { ...pay.charge, amount_refunded: 1799, refunded: true });
      const lost = { id: `evt_${crypto.randomUUID()}`, object: "event", type: "charge.refunded", created: Math.floor(Date.now() / 1000), data: { object: stripeCharges.get(pay.charge.id) } };
      stripeEventLog.unshift(lost);
      expect(await ent()).toBe("pro");
      const first = await reconcileBilling();
      expect(first.stripeEvents.applied).toBeGreaterThanOrEqual(1);
      expect(await ent()).toBe("free");
      const stored = (await serviceClient().from("stripe_events").select("status").eq("id", lost.id).single()).data;
      expect(stored).toEqual({ status: "processed" });
      // Running again re-reads the same event, which is already processed: nothing is applied twice.
      const second = await reconcileBilling();
      expect(second.stripeEvents.failed).toBe(0);
      const again = (await serviceClient().from("stripe_events").select("attempts").eq("id", lost.id).single()).data as { attempts: number };
      expect(again.attempts).toBe(1);
    } finally {
      stripeEventLog.length = 0;
      await deleteTestUser(u);
    }
  });

  it("when an admin grant ends, the member's own paid subscription takes over at the next reconciliation (O-08)", async () => {
    const { reconcileBilling } = await import("@/server/services/billing-reconcile");
    const u = await createTestUser("grant-ends");
    const svc = serviceClient();
    const ent = async () => (await svc.from("user_entitlements").select("plan, source").eq("user_id", u.id).single()).data;
    try {
      // An admin grant of Pro, live; the member also has an App Store Plus subscription, renewing in a month (so no
      // other reconciliation step looks at it): the grant (higher) stays.
      await svc.from("user_entitlements").upsert({ user_id: u.id, plan: "pro", source: "admin", valid_until: new Date(Date.now() + 3600_000).toISOString() }, { onConflict: "user_id" });
      const { recomputeEntitlement } = await import("@/server/services/billing");
      await svc.from("store_subscriptions").insert({
        user_id: u.id, store: "app_store", product_id: "ngf_plus_monthly", plan: "plus", period_type: "normal", is_sandbox: false,
        purchased_at: new Date(Date.now() - 86400_000).toISOString(), expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      });
      await recomputeEntitlement(u.id);
      expect(await ent()).toMatchObject({ plan: "pro", source: "admin" });
      // The grant ends. Without a billing event, nothing recomputed the entitlement, so the member read as Free.
      await svc.from("user_entitlements").update({ valid_until: new Date(Date.now() - 60_000).toISOString() }).eq("user_id", u.id);
      const report = await reconcileBilling();
      expect(report.endedGrants.checked).toBeGreaterThanOrEqual(1);
      expect(await ent()).toMatchObject({ plan: "plus", source: "app_store" });
    } finally {
      await deleteTestUser(u);
    }
  });

  it("a lost dispute.created replayed after the dispute was won doesn't take access away (payments review 1)", async () => {
    const { reconcileBilling } = await import("@/server/services/billing-reconcile");
    const u = await createTestUser("dispute-won-replay");
    const ent = async () => (await serviceClient().from("user_entitlements").select("plan").eq("user_id", u.id).single()).data?.plan;
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } });
      const pay = fakePayment(sub.id);
      stripeSubs.set(sub.id, { ...sub, latest_invoice: pay.invoice.id } as Stripe.Subscription);
      await syncSubscription(stripeSubs.get(sub.id)!);
      expect(await ent()).toBe("pro");
      // The member disputed the charge and the dispute was won; both webhooks were lost.
      const dispute = { id: `dp_${crypto.randomUUID().slice(0, 8)}`, object: "dispute", charge: pay.charge.id, status: "won" };
      stripeDisputes.set(dispute.id, dispute);
      const t = Math.floor(Date.now() / 1000);
      stripeEventLog.unshift(
        { id: `evt_${crypto.randomUUID()}`, object: "event", type: "charge.dispute.closed", created: t, data: { object: dispute } },
        { id: `evt_${crypto.randomUUID()}`, object: "event", type: "charge.dispute.created", created: t - 60, data: { object: { ...dispute, status: "needs_response" } } },
      );
      const report = await reconcileBilling();
      expect(report.stripeEvents.applied).toBeGreaterThanOrEqual(2);
      expect(await ent()).toBe("pro");
    } finally {
      stripeEventLog.length = 0;
      await deleteTestUser(u);
    }
  });

  it("a webhook outage longer than 3 days is still repaired: replay starts where the last complete run got to (payments review 2)", async () => {
    const { reconcileBilling, replaySince } = await import("@/server/services/billing-reconcile");
    const now = new Date();
    // Unit check of the window: at least 3 days back, at most 30, otherwise from the last complete run.
    expect(replaySince(now, null).getTime()).toBe(now.getTime() - 3 * 86400_000);
    expect(replaySince(now, new Date(now.getTime() - 10 * 86400_000)).getTime()).toBe(now.getTime() - 10 * 86400_000);
    expect(replaySince(now, new Date(now.getTime() - 90 * 86400_000)).getTime()).toBe(now.getTime() - 30 * 86400_000);
    const u = await createTestUser("refund-outage");
    const svc = serviceClient();
    const ent = async () => (await svc.from("user_entitlements").select("plan").eq("user_id", u.id).single()).data?.plan;
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } });
      const pay = fakePayment(sub.id);
      stripeSubs.set(sub.id, { ...sub, latest_invoice: pay.invoice.id } as Stripe.Subscription);
      await syncSubscription(stripeSubs.get(sub.id)!);
      // Reconciliation last completed 10 days ago; a full refund 8 days ago was never delivered.
      await svc.from("billing_reconcile_state").upsert({ id: 1, stripe_events_through: new Date(Date.now() - 10 * 86400_000).toISOString() });
      stripeCharges.set(pay.charge.id, { ...pay.charge, amount_refunded: 1799, refunded: true });
      stripeEventLog.unshift({ id: `evt_${crypto.randomUUID()}`, object: "event", type: "charge.refunded", created: Math.floor(Date.now() / 1000) - 8 * 86400, data: { object: stripeCharges.get(pay.charge.id) } });
      const report = await reconcileBilling();
      expect(report.stripeEvents.complete).toBe(true);
      expect(await ent()).toBe("free");
      // A complete pass moves the starting point to (about) now.
      const state = (await svc.from("billing_reconcile_state").select("stripe_events_through").eq("id", 1).single()).data!;
      expect(Date.now() - Date.parse(state.stripe_events_through as string)).toBeLessThan(60_000);
    } finally {
      stripeEventLog.length = 0;
      await deleteTestUser(u);
    }
  });

  it("an event that keeps failing doesn't stop the repair of later events; the starting point stays before it (correctness review 1)", async () => {
    const { reconcileBilling } = await import("@/server/services/billing-reconcile");
    const u = await createTestUser("replay-stuck-event");
    const svc = serviceClient();
    const ent = async () => (await svc.from("user_entitlements").select("plan").eq("user_id", u.id).single()).data?.plan;
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } });
      const pay = fakePayment(sub.id);
      stripeSubs.set(sub.id, { ...sub, latest_invoice: pay.invoice.id } as Stripe.Subscription);
      await syncSubscription(stripeSubs.get(sub.id)!);
      expect(await ent()).toBe("pro");
      const tenDaysAgo = Date.now() - 10 * 86400_000;
      await svc.from("billing_reconcile_state").upsert({ id: 1, stripe_events_through: new Date(tenDaysAgo).toISOString() });
      const nowS = Math.floor(Date.now() / 1000);
      // 8 days ago: an event whose charge Stripe can't serve (fails on every attempt). 5 days ago: a lost full refund.
      stripeCharges.set(pay.charge.id, { ...pay.charge, amount_refunded: 1799, refunded: true });
      stripeEventLog.push(
        { id: `evt_${crypto.randomUUID()}`, object: "event", type: "charge.refunded", created: nowS - 8 * 86400, data: { object: { id: "ch_unavailable_1", object: "charge" } } },
        { id: `evt_${crypto.randomUUID()}`, object: "event", type: "charge.refunded", created: nowS - 5 * 86400, data: { object: stripeCharges.get(pay.charge.id) } },
      );
      const report = await reconcileBilling();
      expect(report.stripeEvents.failed).toBeGreaterThanOrEqual(1);
      expect(report.stripeEvents.complete).toBe(false);
      // The refund after the failing event was still applied...
      expect(await ent()).toBe("free");
      // ...and the starting point didn't move past the failing event, so the next run tries it again.
      const state = (await svc.from("billing_reconcile_state").select("stripe_events_through").eq("id", 1).single()).data!;
      expect(Date.parse(state.stripe_events_through as string)).toBeLessThanOrEqual((nowS - 8 * 86400) * 1000);
    } finally {
      stripeEventLog.length = 0;
      await svc.from("billing_reconcile_state").upsert({ id: 1, stripe_events_through: new Date().toISOString() });
      await deleteTestUser(u);
    }
  });

  it("a subscription naming a different member (needs a person) is reported but doesn't hold the starting point back", async () => {
    const { reconcileBilling } = await import("@/server/services/billing-reconcile");
    const u = await createTestUser("replay-owner-conflict");
    const svc = serviceClient();
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id } });
      stripeSubs.set(sub.id, sub);
      await syncSubscription(sub); // records u's customer
      // Someone edited the subscription's metadata in Stripe to name another member.
      const edited = { ...sub, metadata: { user_id: crypto.randomUUID() } } as Stripe.Subscription;
      stripeSubs.set(sub.id, edited);
      await svc.from("billing_reconcile_state").upsert({ id: 1, stripe_events_through: new Date(Date.now() - 6 * 86400_000).toISOString() });
      const eventId = `evt_${crypto.randomUUID()}`;
      stripeEventLog.push({ id: eventId, object: "event", type: "customer.subscription.updated", created: Math.floor(Date.now() / 1000) - 5 * 86400, data: { object: edited } });
      const report = await reconcileBilling();
      expect(report.stripeEvents.failed).toBeGreaterThanOrEqual(1);
      expect((await svc.from("stripe_events").select("last_error").eq("id", eventId).single()).data?.last_error).toContain("OwnershipConflictError");
      const state = (await svc.from("billing_reconcile_state").select("stripe_events_through").eq("id", 1).single()).data!;
      expect(Date.now() - Date.parse(state.stripe_events_through as string)).toBeLessThan(60_000);
    } finally {
      stripeEventLog.length = 0;
      await deleteTestUser(u);
    }
  });

  it("a window with more events than one listing takes is split, so its oldest events are handled too (correctness review 2)", async () => {
    const { reconcileBilling } = await import("@/server/services/billing-reconcile");
    const u = await createTestUser("replay-busy-window");
    const svc = serviceClient();
    const ent = async () => (await svc.from("user_entitlements").select("plan").eq("user_id", u.id).single()).data?.plan;
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } });
      const pay = fakePayment(sub.id);
      stripeSubs.set(sub.id, { ...sub, latest_invoice: pay.invoice.id } as Stripe.Subscription);
      await syncSubscription(stripeSubs.get(sub.id)!);
      expect(await ent()).toBe("pro");
      await svc.from("billing_reconcile_state").upsert({ id: 1, stripe_events_through: new Date(Date.now() - 4 * 86400_000).toISOString() });
      // One 6-hour window with 7 events and a listing cap of 3: the oldest is the lost refund that matters (Stripe
      // lists newest first, so a cut-off listing never reached it).
      stripeCharges.set(pay.charge.id, { ...pay.charge, amount_refunded: 1799, refunded: true });
      const base = Math.floor((Date.now() - 3.5 * 86400_000) / 1000);
      const ids = Array.from({ length: 7 }, () => `evt_${crypto.randomUUID()}`);
      ids.forEach((id, i) => stripeEventLog.push({ id, object: "event", type: "charge.refunded", created: base + i * 600, data: { object: stripeCharges.get(pay.charge.id) } }));
      const report = await reconcileBilling({ maxEventsPerWindow: 3 });
      expect(report.stripeEvents.complete).toBe(true);
      expect(await ent()).toBe("free");
      const { data: stored } = await svc.from("stripe_events").select("id, status").in("id", ids);
      expect(stored?.filter((r) => r.status === "processed").map((r) => r.id).sort()).toEqual([...ids].sort());
      const state = (await svc.from("billing_reconcile_state").select("stripe_events_through").eq("id", 1).single()).data!;
      expect(Date.now() - Date.parse(state.stripe_events_through as string)).toBeLessThan(60_000);
    } finally {
      stripeEventLog.length = 0;
      await deleteTestUser(u);
    }
  });

  it("at scale: 250 lost events over 20 days are read across pages and windows, each applied exactly once", async () => {
    const { reconcileBilling } = await import("@/server/services/billing-reconcile");
    const u = await createTestUser("replay-scale");
    const svc = serviceClient();
    const ent = async () => (await svc.from("user_entitlements").select("plan").eq("user_id", u.id).single()).data?.plan;
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } });
      const pay = fakePayment(sub.id);
      stripeSubs.set(sub.id, { ...sub, latest_invoice: pay.invoice.id } as Stripe.Subscription);
      await syncSubscription(stripeSubs.get(sub.id)!);
      await svc.from("billing_reconcile_state").upsert({ id: 1, stripe_events_through: new Date(Date.now() - 21 * 86400_000).toISOString() });
      stripeCharges.set(pay.charge.id, { ...pay.charge, amount_refunded: 1799, refunded: true });
      const nowS = Math.floor(Date.now() / 1000);
      // 150 in one busy hour 10 days ago (two pages of 100 in one window), 100 more spread over 20 days.
      const ids: string[] = [];
      for (let i = 0; i < 150; i++) ids.push(`evt_busy_${i}_${crypto.randomUUID().slice(0, 8)}`);
      ids.forEach((id, i) => stripeEventLog.push({ id, object: "event", type: "charge.refunded", created: nowS - 10 * 86400 + i * 20, data: { object: stripeCharges.get(pay.charge.id) } }));
      for (let i = 0; i < 100; i++) {
        const id = `evt_spread_${i}_${crypto.randomUUID().slice(0, 8)}`;
        ids.push(id);
        stripeEventLog.push({ id, object: "event", type: "charge.refunded", created: nowS - 20 * 86400 + i * 17_000, data: { object: stripeCharges.get(pay.charge.id) } });
      }
      stripeEventPages = 0;
      const report = await reconcileBilling();
      expect(report.stripeEvents.complete).toBe(true);
      expect(report.stripeEvents.failed).toBe(0);
      expect(report.stripeEvents.listed).toBe(250);
      expect(stripeEventPages).toBeGreaterThan(80); // 6-hour windows over 21 days, plus the second page of the busy hour
      expect(await ent()).toBe("free");
      const { data: stored } = await svc.from("stripe_events").select("id, status, attempts").in("id", ids);
      expect(stored).toHaveLength(250);
      expect(stored!.every((r) => r.status === "processed" && r.attempts === 1)).toBe(true);
      // A second run re-reads the last 3 days only and applies nothing again.
      const again = await reconcileBilling();
      expect(again.stripeEvents.applied).toBe(0);
      expect((await svc.from("stripe_events").select("attempts").in("id", ids)).data!.every((r) => r.attempts === 1)).toBe(true);
    } finally {
      stripeEventLog.length = 0;
      await deleteTestUser(u);
    }
  });

  it("a run that runs out of time keeps its place and the next runs finish the backlog in order (processing limits)", async () => {
    const { reconcileBilling } = await import("@/server/services/billing-reconcile");
    const svc = serviceClient();
    const u = await createTestUser("replay-budget");
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id } });
      stripeSubs.set(sub.id, sub);
      await syncSubscription(sub);
      const start = Date.now() - 12 * 86400_000;
      await svc.from("billing_reconcile_state").upsert({ id: 1, stripe_events_through: new Date(start).toISOString() });
      const nowS = Math.floor(Date.now() / 1000);
      const ids = Array.from({ length: 40 }, (_, i) => `evt_budget_${i}_${crypto.randomUUID().slice(0, 8)}`);
      ids.forEach((id, i) => stripeEventLog.push({ id, object: "event", type: "customer.subscription.updated", created: nowS - 11 * 86400 + i * 6 * 3600, data: { object: sub } }));
      // A budget too small for everything: the run stops part-way, reports itself incomplete, and the starting point
      // never moves past an unfinished window.
      const first = await reconcileBilling({ budgetMs: 150 });
      expect(first.stripeEvents.complete).toBe(false);
      const through = Date.parse((await svc.from("billing_reconcile_state").select("stripe_events_through").eq("id", 1).single()).data!.stripe_events_through as string);
      const done = (await svc.from("stripe_events").select("id").in("id", ids).eq("status", "processed")).data!.map((r) => r.id as string);
      // Everything before the saved starting point was handled (nothing skipped).
      const before = ids.filter((_, i) => (nowS - 11 * 86400 + i * 6 * 3600) * 1000 < through);
      expect(before.every((id) => done.includes(id))).toBe(true);
      // Later runs with a normal budget finish the rest, each event exactly once.
      for (let i = 0; i < 3; i++) {
        const r = await reconcileBilling();
        if (r.stripeEvents.complete) break;
      }
      const { data: stored } = await svc.from("stripe_events").select("status, attempts").in("id", ids);
      expect(stored).toHaveLength(40);
      expect(stored!.every((r) => r.status === "processed" && r.attempts === 1)).toBe(true);
    } finally {
      stripeEventLog.length = 0;
      await deleteTestUser(u);
    }
  });

  it("an outage longer than 30 days: replay starts 30 days back (Stripe keeps 30 days of events) and repairs what it can", async () => {
    const { reconcileBilling } = await import("@/server/services/billing-reconcile");
    const svc = serviceClient();
    const u = await createTestUser("replay-45-days");
    const ent = async () => (await svc.from("user_entitlements").select("plan").eq("user_id", u.id).single()).data?.plan;
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } });
      const pay = fakePayment(sub.id);
      stripeSubs.set(sub.id, { ...sub, latest_invoice: pay.invoice.id } as Stripe.Subscription);
      await syncSubscription(stripeSubs.get(sub.id)!);
      await svc.from("billing_reconcile_state").upsert({ id: 1, stripe_events_through: new Date(Date.now() - 45 * 86400_000).toISOString() });
      stripeCharges.set(pay.charge.id, { ...pay.charge, amount_refunded: 1799, refunded: true });
      const nowS = Math.floor(Date.now() / 1000);
      const old = `evt_${crypto.randomUUID()}`;
      const recent = `evt_${crypto.randomUUID()}`;
      stripeEventLog.push(
        { id: old, object: "event", type: "charge.refunded", created: nowS - 40 * 86400, data: { object: stripeCharges.get(pay.charge.id) } },
        { id: recent, object: "event", type: "charge.refunded", created: nowS - 29 * 86400, data: { object: stripeCharges.get(pay.charge.id) } },
      );
      const report = await reconcileBilling();
      expect(Date.now() - Date.parse(report.stripeEvents.since!)).toBeLessThanOrEqual(30 * 86400_000 + 60_000);
      expect(report.stripeEvents.complete).toBe(true);
      expect(await ent()).toBe("free");
      expect((await svc.from("stripe_events").select("id").eq("id", old)).data).toEqual([]); // beyond Stripe's 30 days: not read
      expect((await svc.from("stripe_events").select("status").eq("id", recent).single()).data).toEqual({ status: "processed" });
    } finally {
      stripeEventLog.length = 0;
      await deleteTestUser(u);
    }
  });

  it("a subscription whose creation webhooks were all lost is found and stored (payments review 2)", async () => {
    const { reconcileBilling } = await import("@/server/services/billing-reconcile");
    const u = await createTestUser("sub-never-stored");
    const ent = async () => (await serviceClient().from("user_entitlements").select("plan, source").eq("user_id", u.id).maybeSingle()).data;
    try {
      const sub = { ...fakeSubscription({ metadata: { user_id: u.id } }), listed: true } as unknown as Stripe.Subscription;
      stripeSubs.set(sub.id, sub);
      expect((await ent())?.plan ?? "free").toBe("free");
      const report = await reconcileBilling();
      expect(report.missingSubscriptions.stored).toBeGreaterThanOrEqual(1);
      expect(await ent()).toMatchObject({ plan: "plus", source: "stripe" });
    } finally {
      await deleteTestUser(u);
    }
  });

  it("an admin grant that ended weeks ago (reconciliation wasn't running) is caught too (payments review 7)", async () => {
    const { reconcileBilling } = await import("@/server/services/billing-reconcile");
    const { recomputeEntitlement } = await import("@/server/services/billing");
    const u = await createTestUser("grant-ended-long-ago");
    const svc = serviceClient();
    try {
      await svc.from("user_entitlements").upsert({ user_id: u.id, plan: "pro", source: "admin", valid_until: new Date(Date.now() + 3600_000).toISOString() }, { onConflict: "user_id" });
      await svc.from("store_subscriptions").insert({ user_id: u.id, store: "app_store", product_id: "ngf_plus_monthly", plan: "plus", period_type: "normal", is_sandbox: false, purchased_at: new Date(Date.now() - 86400_000).toISOString(), expires_at: new Date(Date.now() + 30 * 86400_000).toISOString() });
      await recomputeEntitlement(u.id);
      await svc.from("user_entitlements").update({ valid_until: new Date(Date.now() - 20 * 86400_000).toISOString() }).eq("user_id", u.id);
      await reconcileBilling();
      expect((await svc.from("user_entitlements").select("plan, source").eq("user_id", u.id).single()).data).toMatchObject({ plan: "plus", source: "app_store" });
    } finally {
      await deleteTestUser(u);
    }
  });

  it("a late invoice.paid for an earlier invoice can't restore a refunded period; a newer paid invoice does", async () => {
    // Stripe delivers events in any order and retries failed deliveries for days, so "invoice.paid" for an earlier
    // invoice can arrive after the latest invoice was refunded. It is not a newer period that was paid for.
    const u = await createTestUser("refund-late-paid");
    const ent = async () => (await serviceClient().from("user_entitlements").select("plan").eq("user_id", u.id).single()).data?.plan;
    const send = (type: string, object: unknown) => handleStripeEvent({ id: `evt_${crypto.randomUUID()}`, object: "event", type, data: { object } } as unknown as Stripe.Event);
    const nowS = Math.floor(Date.now() / 1000);
    try {
      const sub = fakeSubscription({ metadata: { user_id: u.id }, items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro_yearly" }, current_period_end: nowS + 300 * 86400 }] } });
      // The member subscribed monthly, then switched to yearly an hour later: two paid invoices, the yearly one latest.
      const first = fakePayment(sub.id, { created: nowS - 7200 });
      const upgrade = fakePayment(sub.id, { created: nowS - 3600 });
      stripeSubs.set(sub.id, { ...sub, latest_invoice: upgrade.invoice.id } as Stripe.Subscription);
      await syncSubscription(stripeSubs.get(sub.id)!);
      expect(await ent()).toBe("pro");

      // The yearly payment is refunded in full: that period's access ends.
      stripeCharges.set(upgrade.charge.id, { ...upgrade.charge, amount_refunded: 1799, refunded: true });
      await send("charge.refunded", stripeCharges.get(upgrade.charge.id));
      expect(await ent()).toBe("free");

      // The first invoice's "paid" event, delivered late (its first delivery failed and Stripe retried it).
      await send("invoice.paid", first.invoice);
      expect(await ent()).toBe("free");
      const row = (await serviceClient().from("subscriptions").select("access_revoked_reason, revoked_invoice_id").eq("stripe_subscription_id", sub.id).single()).data;
      expect(row).toEqual({ access_revoked_reason: "refund", revoked_invoice_id: upgrade.invoice.id });

      // A newer invoice paid afterwards is a new period: access returns.
      const renewal = fakePayment(sub.id, { created: nowS + 60 });
      stripeSubs.set(sub.id, { ...sub, latest_invoice: renewal.invoice.id } as Stripe.Subscription);
      await send("invoice.paid", renewal.invoice);
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
      stripeCharges.set(old.charge.id, { ...old.charge, amount_refunded: 1799, refunded: true });
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
