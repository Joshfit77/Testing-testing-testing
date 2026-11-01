import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * Billing integrity under the conditions real webhooks arrive in: concurrent and duplicate deliveries, failures
 * followed by retries, events older than the stored state, forged or conflicting ownership, and concurrent changes
 * to one member's subscriptions. Also the shared rate limiter and the scheduled reconciliation.
 * Stripe and RevenueCat are local stand-ins; nothing reaches either service.
 */

const WEBHOOK_SECRET = "whsec_integration_dummy";

// ---- Stripe stand-in: what Stripe holds for each subscription now, with optional delays and failures. -------------
const stripeSubs = new Map<string, Stripe.Subscription>();
const delayMs = new Map<string, number>();
let stripeFailNext = 0;
let stripeServer: Server;

// ---- RevenueCat stand-in. --------------------------------------------------------------------------------------
const rcCustomers = new Map<string, { entitlements: Record<string, unknown>; subscriptions: Record<string, unknown> }>();
let rcServer: Server;

const day = 86_400_000;
const unix = (offsetMs: number) => Math.floor((Date.now() + offsetMs) / 1000);
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

function stripeSub(member: TestUser, over: Partial<Record<string, unknown>> = {}): Stripe.Subscription {
  return {
    id: `sub_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`,
    object: "subscription",
    customer: `cus_${member.id.replace(/-/g, "").slice(0, 16)}`,
    status: "active",
    cancel_at_period_end: false,
    metadata: { user_id: member.id },
    items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: unix(30 * day) }] },
    ...over,
  } as unknown as Stripe.Subscription;
}

function rcAppStorePro(expiresInMs: number, over: Record<string, unknown> = {}) {
  const s = {
    store: "app_store",
    is_sandbox: false,
    period_type: "normal",
    purchase_date: iso(-day),
    original_purchase_date: iso(-day),
    expires_date: iso(expiresInMs),
    unsubscribe_detected_at: null,
    billing_issues_detected_at: null,
    grace_period_expires_date: null,
    refunded_at: null,
    ownership_type: "PURCHASED",
    store_transaction_id: "2000000999",
    ...over,
  };
  return {
    entitlements: { pro: { product_identifier: "ngf_pro_monthly", expires_date: s.expires_date, grace_period_expires_date: null, purchase_date: s.purchase_date } },
    subscriptions: { ngf_pro_monthly: s },
  };
}

describe.skipIf(!available)("billing integrity: concurrency, retries, ordering, ownership", async () => {
  const { POST: stripeWebhook } = await import("@/app/api/stripe/webhook/route");
  const { POST: rcWebhook } = await import("@/app/api/revenuecat/webhook/route");
  const { GET: reconcileRoute } = await import("@/app/api/billing/reconcile/route");
  const { syncSubscription, recomputeEntitlement } = await import("@/server/services/billing");
  const { syncStoreSubscriber } = await import("@/server/services/store-billing");
  const { rateLimit } = await import("@/server/rate-limit");
  const { NextRequest } = await import("next/server");
  const stripe = new Stripe("sk_test_integration_dummy");

  const admin = serviceClient();
  const users: TestUser[] = [];
  const newUser = async (label: string) => {
    const u = await createTestUser(label);
    users.push(u);
    return u;
  };
  const ent = async (u: TestUser) => (await admin.from("user_entitlements").select("plan, source, valid_until").eq("user_id", u.id).maybeSingle()).data;

  /** A Stripe webhook delivery, signed the way Stripe signs it. */
  const deliverStripe = (event: Record<string, unknown>, secret = WEBHOOK_SECRET) => {
    const payload = JSON.stringify({ object: "event", api_version: "2025-03-31.basil", created: Math.floor(Date.now() / 1000), ...event });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    return stripeWebhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
  };
  const deliverRc = (event: Record<string, unknown>) =>
    rcWebhook(
      new NextRequest("http://localhost/api/revenuecat/webhook", {
        method: "POST",
        body: JSON.stringify({ api_version: "1.0", event: { environment: "PRODUCTION", ...event } }),
        headers: { authorization: "Bearer rc-webhook-integration" },
      }),
    );
  const eventRow = async (table: "stripe_events" | "revenuecat_events", id: string) =>
    (await admin.from(table).select("status, attempts, last_error, processed_at").eq("id", id).maybeSingle()).data;
  /** Link a member to their Stripe customer, as checkout does before the first payment. */
  const linkCustomer = async (u: TestUser) =>
    admin.from("billing_customers").upsert({ user_id: u.id, stripe_customer_id: `cus_${u.id.replace(/-/g, "").slice(0, 16)}` }, { onConflict: "user_id" });

  beforeAll(async () => {
    stripeServer = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://stripe.local");
      const json = (status: number, body: unknown) => void res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
      if (stripeFailNext > 0) {
        stripeFailNext--;
        return json(500, { error: { type: "api_error", message: "Stand-in failure" } });
      }
      const m = url.pathname.match(/^\/v1\/subscriptions\/([^/?]+)/);
      const id = m ? decodeURIComponent(m[1]!) : "";
      const obj = stripeSubs.get(id);
      const reply = () => (obj ? json(200, obj) : json(404, { error: { type: "invalid_request_error", code: "resource_missing", message: "No such subscription" } }));
      const wait = delayMs.get(id) ?? 0;
      if (wait) setTimeout(reply, wait);
      else reply();
    });
    rcServer = createServer((req, res) => {
      const m = req.url?.match(/^\/v1\/subscribers\/([^/?]+)$/);
      const id = m ? decodeURIComponent(m[1]!) : "";
      const c = rcCustomers.get(id) ?? { entitlements: {}, subscriptions: {} };
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ request_date: new Date().toISOString(), subscriber: { ...c, management_url: null } }));
    });
    await new Promise<void>((resolve) => stripeServer.listen(4613, "127.0.0.1", resolve));
    await new Promise<void>((resolve) => rcServer.listen(4611, "127.0.0.1", resolve));
  });
  afterAll(async () => {
    for (const u of users) await deleteTestUser(u);
    await new Promise((resolve) => stripeServer.close(resolve));
    await new Promise((resolve) => rcServer.close(resolve));
  });

  // ---- Webhook delivery semantics ------------------------------------------------------------------------------

  it("forged, unsigned, wrongly signed, oversized and malformed Stripe webhooks change nothing", async () => {
    const u = await newUser("forged");
    await linkCustomer(u);
    const sub = stripeSub(u);
    stripeSubs.set(sub.id, sub);
    const event = { id: `evt_${crypto.randomUUID()}`, type: "customer.subscription.updated", data: { object: sub } };
    // Signed with an attacker's secret.
    expect((await deliverStripe(event, "whsec_attacker")).status).toBe(400);
    // No signature at all.
    const unsigned = await stripeWebhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: JSON.stringify(event) }));
    expect(unsigned.status).toBe(400);
    // A replayed signature header on a modified body.
    const original = JSON.stringify({ object: "event", ...event });
    const sig = stripe.webhooks.generateTestHeaderString({ payload: original, secret: WEBHOOK_SECRET });
    const tampered = original.replace("customer.subscription.updated", "customer.subscription.created");
    expect((await stripeWebhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: tampered, headers: { "stripe-signature": sig } }))).status).toBe(400);
    // An expired signature (older than Stripe's 5-minute tolerance), as a replay of an old delivery would carry.
    const oldSig = stripe.webhooks.generateTestHeaderString({ payload: original, secret: WEBHOOK_SECRET, timestamp: Math.floor(Date.now() / 1000) - 3600 });
    expect((await stripeWebhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: original, headers: { "stripe-signature": oldSig } }))).status).toBe(400);
    // Oversized.
    const big = JSON.stringify({ ...event, pad: "x".repeat(600 * 1024) });
    const bigSig = stripe.webhooks.generateTestHeaderString({ payload: big, secret: WEBHOOK_SECRET });
    expect((await stripeWebhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: big, headers: { "stripe-signature": bigSig } }))).status).toBe(413);
    // Validly signed but not JSON.
    const junkSig = stripe.webhooks.generateTestHeaderString({ payload: "{not json", secret: WEBHOOK_SECRET });
    expect((await stripeWebhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: "{not json", headers: { "stripe-signature": junkSig } }))).status).toBe(400);
    expect((await ent(u))?.plan ?? "free").toBe("free");
    expect(await eventRow("stripe_events", event.id)).toBeNull();
  });

  it("a second delivery that arrives while the first is still processing is told to retry, not 'already done'", async () => {
    const u = await newUser("busy");
    await linkCustomer(u);
    const sub = stripeSub(u);
    stripeSubs.set(sub.id, sub);
    delayMs.set(sub.id, 1500);
    const event = { id: `evt_${crypto.randomUUID()}`, type: "customer.subscription.created", data: { object: sub } };
    const first = deliverStripe(event);
    await new Promise((r) => setTimeout(r, 400));
    expect(await eventRow("stripe_events", event.id)).toMatchObject({ status: "processing" });
    const second = await deliverStripe(event);
    expect(second.status).toBe(409);
    expect(second.headers.get("retry-after")).toBe("60");
    expect((await first).status).toBe(200);
    delayMs.delete(sub.id);
    expect(await eventRow("stripe_events", event.id)).toMatchObject({ status: "processed", attempts: 1 });
    // The provider's retry now finds it done.
    const third = await deliverStripe(event);
    expect(third.status).toBe(200);
    expect(await third.json()).toMatchObject({ duplicate: true });
    expect(await ent(u)).toMatchObject({ plan: "pro", source: "stripe" });
  });

  it("a failed delivery is recorded (not forgotten) and the provider's retry processes it", async () => {
    const u = await newUser("retry");
    await linkCustomer(u);
    const sub = stripeSub(u);
    stripeSubs.set(sub.id, sub);
    const event = { id: `evt_${crypto.randomUUID()}`, type: "customer.subscription.created", data: { object: sub } };
    stripeFailNext = 3; // the Stripe client retries; make every attempt of this delivery fail
    const failed = await deliverStripe(event);
    stripeFailNext = 0;
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "Processing failed" });
    const row = await eventRow("stripe_events", event.id);
    expect(row).toMatchObject({ status: "failed", processed_at: null });
    expect(row?.last_error).toContain("StripeAPIError");
    expect((await ent(u))?.plan ?? "free").toBe("free");
    const retried = await deliverStripe(event);
    expect(retried.status).toBe(200);
    expect(await eventRow("stripe_events", event.id)).toMatchObject({ status: "processed", attempts: 2, last_error: null });
    expect(await ent(u)).toMatchObject({ plan: "pro" });
  });

  it("a delivery whose worker died mid-way is taken over once its lease expires", async () => {
    const u = await newUser("lease");
    await linkCustomer(u);
    const sub = stripeSub(u);
    stripeSubs.set(sub.id, sub);
    const id = `evt_${crypto.randomUUID()}`;
    await admin.from("stripe_events").insert({ id, type: "customer.subscription.created", status: "processing", attempts: 1, locked_until: new Date(Date.now() - 1000).toISOString(), processed_at: null });
    const res = await deliverStripe({ id, type: "customer.subscription.created", data: { object: sub } });
    expect(res.status).toBe(200);
    expect(await eventRow("stripe_events", id)).toMatchObject({ status: "processed", attempts: 2 });
    expect(await ent(u)).toMatchObject({ plan: "pro" });
  });

  it("many simultaneous deliveries of one event are processed exactly once", async () => {
    const u = await newUser("dupes");
    await linkCustomer(u);
    const sub = stripeSub(u);
    stripeSubs.set(sub.id, sub);
    delayMs.set(sub.id, 300);
    const event = { id: `evt_${crypto.randomUUID()}`, type: "customer.subscription.created", data: { object: sub } };
    const responses = await Promise.all(Array.from({ length: 8 }, () => deliverStripe(event)));
    delayMs.delete(sub.id);
    const bodies = await Promise.all(responses.map(async (r) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> })));
    const processedNow = bodies.filter((b) => b.status === 200 && b.body.duplicate === false);
    expect(processedNow).toHaveLength(1);
    expect(bodies.every((b) => (b.status === 200 && b.body.duplicate === true) || b.status === 409 || b === processedNow[0])).toBe(true);
    expect(await eventRow("stripe_events", event.id)).toMatchObject({ status: "processed", attempts: 1 });
    const { count } = await admin.from("subscriptions").select("id", { count: "exact", head: true }).eq("user_id", u.id);
    expect(count).toBe(1);
  });

  // ---- Ordering and ownership ----------------------------------------------------------------------------------

  it("an older read of Stripe never overwrites a newer one (stale renewal after a cancellation)", async () => {
    const u = await newUser("stale");
    await linkCustomer(u);
    const active = stripeSub(u);
    const canceled = { ...active, status: "canceled" } as Stripe.Subscription;
    const t1 = new Date(Date.now() - 60_000);
    const t2 = new Date();
    // The cancellation was read last; a delayed sync of an older "active" read arrives afterwards.
    await syncSubscription(canceled, t2);
    expect(await ent(u)).toMatchObject({ plan: "free" });
    await syncSubscription(active, t1);
    expect(await ent(u)).toMatchObject({ plan: "free" });
    expect((await admin.from("subscriptions").select("status").eq("stripe_subscription_id", active.id).single()).data).toMatchObject({ status: "canceled" });
    // And the other way round: a reactivation read later wins over a delayed old cancellation.
    await syncSubscription(active, new Date(Date.now() + 1000));
    await syncSubscription(canceled, t2);
    expect(await ent(u)).toMatchObject({ plan: "pro" });
  });

  it("metadata can't move a subscription, or grant access, to another member", async () => {
    const owner = await newUser("owner");
    const thief = await newUser("thief");
    await linkCustomer(owner);
    // The owner's customer, with metadata edited to name someone else.
    const sub = stripeSub(owner, { metadata: { user_id: thief.id } });
    stripeSubs.set(sub.id, sub);
    const event = { id: `evt_${crypto.randomUUID()}`, type: "customer.subscription.created", data: { object: sub } };
    const res = await deliverStripe(event);
    expect(res.status).toBe(500);
    expect((await eventRow("stripe_events", event.id))?.last_error).toContain("OwnershipConflictError");
    expect((await ent(thief))?.plan ?? "free").toBe("free");
    // A subscription already stored for one member can't be re-pointed at another.
    const real = stripeSub(owner);
    await syncSubscription(real, new Date());
    const { data: result } = await admin.rpc("upsert_stripe_subscription", {
      p_user_id: thief.id,
      p_subscription_id: real.id,
      p_price_id: "price_test_pro",
      p_plan: "pro",
      p_status: "active",
      p_current_period_end: iso(30 * day),
      p_cancel_at_period_end: false,
      p_synced_at: iso(60_000),
    });
    expect(result).toBe("owner_conflict");
    expect((await admin.from("subscriptions").select("user_id").eq("stripe_subscription_id", real.id).single()).data?.user_id).toBe(owner.id);
    expect((await ent(thief))?.plan ?? "free").toBe("free");
  });

  it("a member can't attach someone else's subscription by claiming a different Stripe customer", async () => {
    const a = await newUser("cust-a");
    await linkCustomer(a);
    // A subscription on a customer this server never created, whose metadata names a member who already has one.
    const foreign = stripeSub(a, { customer: "cus_someone_else_entirely", metadata: { user_id: a.id } });
    await expect(syncSubscription(foreign, new Date())).rejects.toThrow(/different Stripe customer/);
  });

  // ---- Concurrent entitlement changes --------------------------------------------------------------------------

  it("an entitlement computed from rows that changed meanwhile is refused (compare-and-set)", async () => {
    const u = await newUser("cas");
    await linkCustomer(u);
    await syncSubscription(stripeSub(u), new Date());
    const { data: v } = await admin.from("billing_state_versions").select("version").eq("user_id", u.id).single();
    const version = Number(v!.version);
    // Another change lands after `version` was read...
    await syncSubscription(stripeSub(u, { status: "canceled" }), new Date());
    // ...so a write based on the old picture is refused.
    const { data: result } = await admin.rpc("apply_entitlement", { p_user_id: u.id, p_version: version, p_plan: "free", p_source: "default", p_valid_until: null });
    expect(result).toBe("stale");
    expect(await ent(u)).toMatchObject({ plan: "pro" });
  });

  it("concurrent webhooks for one member converge on the entitlement their final rows give", async () => {
    const u = await newUser("converge");
    await linkCustomer(u);
    const pro = stripeSub(u);
    const plusOld = stripeSub(u, { status: "canceled", items: { object: "list", data: [{ id: "si", price: { id: "price_test_plus" }, current_period_end: unix(-day) }] } });
    const storeExpired = rcAppStorePro(-day);
    rcCustomers.set(u.id, storeExpired);
    // Round 1: Pro is active → Pro, whatever order 30 concurrent syncs land in.
    const ops1 = [
      ...Array.from({ length: 10 }, () => () => syncSubscription(pro, new Date())),
      ...Array.from({ length: 10 }, () => () => syncSubscription(plusOld, new Date())),
      ...Array.from({ length: 10 }, () => () => syncStoreSubscriber(u.id)),
    ].sort(() => Math.random() - 0.5);
    await Promise.all(ops1.map((op) => op()));
    expect(await ent(u)).toMatchObject({ plan: "pro", source: "stripe" });
    // Round 2: the web subscription is cancelled at the same moment an App Store purchase lands → Pro from the App Store.
    rcCustomers.set(u.id, rcAppStorePro(30 * day));
    const proCanceled = { ...pro, status: "canceled" } as Stripe.Subscription;
    const ops2 = [
      ...Array.from({ length: 10 }, () => () => syncSubscription(proCanceled, new Date())),
      ...Array.from({ length: 10 }, () => () => syncStoreSubscriber(u.id)),
      ...Array.from({ length: 10 }, () => () => recomputeEntitlement(u.id)),
    ].sort(() => Math.random() - 0.5);
    await Promise.all(ops2.map((op) => op()));
    expect(await ent(u)).toMatchObject({ plan: "pro", source: "app_store" });
    // Round 3: the App Store subscription is refunded → Free.
    rcCustomers.set(u.id, rcAppStorePro(30 * day, { refunded_at: iso(-60_000), purchase_date: iso(-2 * day) }));
    await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? syncStoreSubscriber(u.id) : recomputeEntitlement(u.id))));
    expect((await ent(u))?.plan).toBe("free");
  });

  // ---- RevenueCat --------------------------------------------------------------------------------------------

  it("an older RevenueCat snapshot can't replace a newer one, and duplicate RevenueCat events are processed once", async () => {
    const u = await newUser("rc-order");
    rcCustomers.set(u.id, rcAppStorePro(30 * day));
    await syncStoreSubscriber(u.id);
    expect(await ent(u)).toMatchObject({ plan: "pro", source: "app_store" });
    // A snapshot read an hour ago (say, a slow request) arrives now with nothing in it.
    const { data: stale } = await admin.rpc("apply_store_snapshot", { p_user_id: u.id, p_fetched_at: iso(-3600_000), p_rows: [] });
    expect(stale).toBe("stale");
    const { count } = await admin.from("store_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", u.id);
    expect(count).toBe(1);
    // Duplicate and concurrent deliveries of one RevenueCat event.
    const id = crypto.randomUUID();
    const responses = await Promise.all(Array.from({ length: 6 }, () => deliverRc({ id, type: "RENEWAL", app_user_id: u.id })));
    const bodies = await Promise.all(responses.map(async (r) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> })));
    expect(bodies.filter((b) => b.status === 200 && b.body.duplicate === false)).toHaveLength(1);
    expect(bodies.every((b) => b.status === 200 || b.status === 409)).toBe(true);
    expect(await eventRow("revenuecat_events", id)).toMatchObject({ status: "processed" });
  });

  it("a replayed RevenueCat event can't grant anything: the server asks RevenueCat what the member owns", async () => {
    const u = await newUser("rc-replay");
    // The event claims a purchase; RevenueCat (the authority) says this member owns nothing.
    rcCustomers.delete(u.id);
    const res = await deliverRc({ id: crypto.randomUUID(), type: "INITIAL_PURCHASE", app_user_id: u.id, product_id: "ngf_pro_yearly" });
    expect(res.status).toBe(200);
    expect((await ent(u))?.plan ?? "free").toBe("free");
  });

  // ---- Members can't touch any of it --------------------------------------------------------------------------

  it("members can't call the billing functions or write billing state with their own session", async () => {
    const u = await newUser("member-rpc");
    const c = u.client;
    const calls = [
      c.rpc("apply_entitlement", { p_user_id: u.id, p_version: 0, p_plan: "pro", p_source: "admin", p_valid_until: null }),
      c.rpc("upsert_stripe_subscription", { p_user_id: u.id, p_subscription_id: "sub_x", p_price_id: "price_test_pro", p_plan: "pro", p_status: "active", p_current_period_end: null, p_cancel_at_period_end: false, p_synced_at: iso(0) }),
      c.rpc("apply_store_snapshot", { p_user_id: u.id, p_fetched_at: iso(0), p_rows: [] }),
      c.rpc("claim_webhook_event", { p_provider: "stripe", p_event_id: "evt_x", p_type: "x" }),
      c.rpc("finish_webhook_event", { p_provider: "stripe", p_event_id: "evt_x", p_ok: true }),
      c.rpc("rate_limit_hit", { p_key: "x", p_limit: 1000, p_window_seconds: 60 }),
    ];
    for (const r of await Promise.all(calls)) expect(r.error, "a member called a service-role function").not.toBeNull();
    const writes = [
      c.from("user_entitlements").upsert({ user_id: u.id, plan: "pro", source: "admin" }),
      c.from("subscriptions").insert({ user_id: u.id, stripe_subscription_id: "sub_forged", plan: "pro", status: "active" }),
      c.from("store_subscriptions").insert({ user_id: u.id, store: "app_store", product_id: "ngf_pro_monthly", plan: "pro", expires_at: iso(day) }),
      c.from("billing_state_versions").upsert({ user_id: u.id, version: 999 }),
      c.from("stripe_events").insert({ id: "evt_forged", type: "x" }),
      c.from("billing_customers").insert({ user_id: u.id, stripe_customer_id: "cus_forged" }),
    ];
    for (const r of await Promise.all(writes)) expect(r.error, "a member wrote billing state").not.toBeNull();
    expect((await ent(u))?.plan ?? "free").toBe("free");
  });

  // ---- Shared rate limits ---------------------------------------------------------------------------------------

  it("the rate limiter is atomic and shared: 40 simultaneous requests against a limit of 5 let exactly 5 through", async () => {
    const key = `it-burst:${crypto.randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 40 }, () => rateLimit(key, 5, 60_000)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    const refused = results.filter((r) => !r.ok);
    expect(refused.every((r) => r.retryAfterSeconds >= 1 && r.retryAfterSeconds <= 60)).toBe(true);
    // Another "server instance" (a separate database client) sees the same count.
    const { data } = await serviceClient().rpc("rate_limit_hit", { p_key: key, p_limit: 5, p_window_seconds: 60 });
    expect((data as { allowed: boolean }[])[0]!.allowed).toBe(false);
    // Other keys are independent.
    expect((await rateLimit(`it-burst:${crypto.randomUUID()}`, 5, 60_000)).ok).toBe(true);
  });

  it("a burst straddling a window boundary can't get twice the limit", async () => {
    const key = `it-edge:${crypto.randomUUID()}`;
    const windowSeconds = 60;
    const now = Date.now() / 1000;
    const current = Math.floor(now / windowSeconds) * windowSeconds;
    // The previous window was used to the full limit just before the boundary.
    await admin.from("rate_limit_counters").insert({ key, window_start: new Date((current - windowSeconds) * 1000).toISOString(), hits: 10 });
    const results = await Promise.all(Array.from({ length: 10 }, () => rateLimit(key, 10, windowSeconds * 1000)));
    const elapsed = (now - current) / windowSeconds;
    // Only the share of the previous window that has slid out is available again.
    expect(results.filter((r) => r.ok).length).toBeLessThanOrEqual(Math.ceil(10 * elapsed) + 1);
  });

  // ---- Reconciliation ----------------------------------------------------------------------------------------

  it("scheduled reconciliation needs the cron secret and corrects a missed webhook", async () => {
    const call = (auth?: string) => reconcileRoute(new NextRequest("http://localhost/api/billing/reconcile", { headers: auth ? { authorization: auth } : {} }));
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong-secret-wrong-secret")).status).toBe(401);
    const u = await newUser("reconcile");
    await linkCustomer(u);
    // Stored as past_due (open) and read long ago; Stripe has since renewed it, but the webhook never arrived.
    const sub = stripeSub(u, { status: "past_due", items: { object: "list", data: [{ id: "si", price: { id: "price_test_pro" }, current_period_end: unix(-60_000) }] } });
    await syncSubscription(sub, new Date(0));
    await admin.from("subscriptions").update({ synced_at: null }).eq("stripe_subscription_id", sub.id);
    expect((await ent(u))?.plan ?? "free").toBe("free");
    stripeSubs.set(sub.id, stripeSub(u, { id: sub.id, status: "active" }));
    const res = await call("Bearer cron-integration-secret-0123456789");
    expect(res.status).toBe(200);
    const report = await res.json();
    expect(report.stripe.checked).toBeGreaterThan(0);
    expect(report.webhookEvents).toEqual(expect.objectContaining({ stripeFailed: expect.any(Number) }));
    expect(JSON.stringify(report)).not.toContain(u.id);
    expect(await ent(u)).toMatchObject({ plan: "pro", source: "stripe" });
  });
});
