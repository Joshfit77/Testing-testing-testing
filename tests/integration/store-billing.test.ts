import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * A stand-in for RevenueCat's REST API (`GET/DELETE /v1/subscribers/{id}`), holding each customer's state the way
 * RevenueCat would report it after App Store sandbox purchases, renewals, cancellations, refunds and transfers.
 */
const customers = new Map<string, { entitlements: Record<string, unknown>; subscriptions: Record<string, unknown> }>();
const requests: { method: string; id: string; auth: string | undefined }[] = [];
let failNext = 0;
let server: Server;

const day = 86_400_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

function setCustomer(id: string, subs: Record<string, Record<string, unknown>>, entitlements: Record<string, string> = {}) {
  const ents: Record<string, unknown> = {};
  for (const [ent, product] of Object.entries(entitlements)) {
    const s = subs[product]!;
    ents[ent] = { product_identifier: product, expires_date: s.expires_date ?? null, grace_period_expires_date: null, purchase_date: s.purchase_date ?? null };
  }
  customers.set(id, { entitlements: ents, subscriptions: subs });
}

// A production purchase. Sandbox purchases (TestFlight / internal testing) are covered by their own case below.
const sub = (over: Record<string, unknown> = {}) => ({
  store: "app_store",
  is_sandbox: false,
  period_type: "normal",
  purchase_date: iso(-day),
  original_purchase_date: iso(-day),
  expires_date: iso(30 * day),
  unsubscribe_detected_at: null,
  billing_issues_detected_at: null,
  grace_period_expires_date: null,
  refunded_at: null,
  ownership_type: "PURCHASED",
  store_transaction_id: "2000000123",
  ...over,
});

describe.skipIf(!available)("App Store / Google Play subscriptions via RevenueCat", async () => {
  const { POST: webhook } = await import("@/app/api/revenuecat/webhook/route");
  const { syncStoreSubscriber, deleteRevenueCatCustomer } = await import("@/server/services/store-billing");
  const { syncSubscription } = await import("@/server/services/billing");
  const { assertAiAllowed } = await import("@/server/services/ai-coach");
  const { NextRequest } = await import("next/server");

  let user: TestUser;
  let other: TestUser;
  const ent = async (u: TestUser = user) => (await serviceClient().from("user_entitlements").select("plan, source").eq("user_id", u.id).single()).data;
  const send = (event: Record<string, unknown>, auth = "Bearer rc-webhook-integration") =>
    webhook(
      new NextRequest("http://localhost/api/revenuecat/webhook", {
        method: "POST",
        body: JSON.stringify({ api_version: "1.0", event: { id: crypto.randomUUID(), environment: "SANDBOX", ...event } }),
        headers: auth ? { authorization: auth } : {},
      }),
    );

  beforeAll(async () => {
    server = createServer((req, res) => {
      const m = req.url?.match(/^\/v1\/subscribers\/([^/?]+)$/);
      const id = m ? decodeURIComponent(m[1]!) : "";
      requests.push({ method: req.method ?? "", id, auth: req.headers.authorization });
      if (failNext > 0) {
        failNext--;
        res.writeHead(500).end("{}");
        return;
      }
      if (!m) return void res.writeHead(404).end("{}");
      if (req.method === "DELETE") {
        customers.delete(id);
        return void res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ app_user_id: id }));
      }
      // Like RevenueCat, an unknown id is created empty.
      const c = customers.get(id) ?? { entitlements: {}, subscriptions: {} };
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ request_date: new Date().toISOString(), subscriber: { ...c, management_url: null } }));
    });
    await new Promise<void>((resolve) => server.listen(4611, "127.0.0.1", resolve));
    user = await createTestUser("iap");
    other = await createTestUser("iap-other");
  });
  afterAll(async () => {
    await deleteTestUser(user);
    await deleteTestUser(other);
    await new Promise((resolve) => server.close(resolve));
  });

  it("rejects webhooks without the configured Authorization header, and bad bodies", async () => {
    expect((await send({ type: "INITIAL_PURCHASE", app_user_id: user.id }, "")).status).toBe(401);
    expect((await send({ type: "INITIAL_PURCHASE", app_user_id: user.id }, "Bearer wrong")).status).toBe(401);
    const bad = await webhook(new NextRequest("http://localhost/api/revenuecat/webhook", { method: "POST", body: "{nope", headers: { authorization: "Bearer rc-webhook-integration" } }));
    expect(bad.status).toBe(400);
    expect((await send({ type: undefined })).status).toBe(400);
    expect(await ent()).toMatchObject({ plan: "free" });
  });

  it("accepts RevenueCat's test event without looking anyone up", async () => {
    const before = requests.length;
    const res = await send({ type: "TEST", app_user_id: "$RCAnonymousID:test" });
    expect(res.status).toBe(200);
    expect(requests.length).toBe(before);
  });

  it("a sandbox purchase grants nothing unless REVENUECAT_ALLOW_SANDBOX is set (it isn't here)", async () => {
    setCustomer(user.id, { ngf_pro_monthly: sub({ is_sandbox: true }) }, { pro: "ngf_pro_monthly" });
    const res = await send({ id: `rc-${crypto.randomUUID()}`, type: "INITIAL_PURCHASE", app_user_id: user.id });
    expect(res.status).toBe(200);
    expect(await ent()).toMatchObject({ plan: "free" });
    expect((await serviceClient().from("store_subscriptions").select("product_id").eq("user_id", user.id)).data).toEqual([]);
  });

  it("purchase → Plus from the App Store; the same event twice is processed once", async () => {
    setCustomer(user.id, { ngf_plus_monthly: sub() }, { plus: "ngf_plus_monthly" });
    const event = { id: `rc-${crypto.randomUUID()}`, type: "INITIAL_PURCHASE", app_user_id: user.id };
    const res = await send(event);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, duplicate: false });
    expect(await ent()).toMatchObject({ plan: "plus", source: "app_store" });
    expect(requests.at(-1)).toMatchObject({ method: "GET", id: user.id, auth: "Bearer sk_rc_integration_dummy" });
    const again = await send(event);
    expect(await again.json()).toMatchObject({ duplicate: true });

    const { data: rows } = await serviceClient().from("store_subscriptions").select("store, product_id, plan, is_sandbox").eq("user_id", user.id);
    expect(rows).toEqual([{ store: "app_store", product_id: "ngf_plus_monthly", plan: "plus", is_sandbox: false }]);
    // Members can read their own store subscription; nobody else can.
    expect((await user.client.from("store_subscriptions").select("product_id")).data).toEqual([{ product_id: "ngf_plus_monthly" }]);
    expect((await other.client.from("store_subscriptions").select("product_id")).data).toEqual([]);
    // Plus has no AI.
    await expect(assertAiAllowed(user.id, "plus", "chat")).rejects.toMatchObject({ code: "not_entitled" });
  });

  it("upgrade to Pro, cancel (access to the period end), billing issue in grace, then expiry", async () => {
    setCustomer(user.id, { ngf_plus_monthly: sub({ expires_date: iso(-60_000) }), ngf_pro_monthly: sub() }, { pro: "ngf_pro_monthly", plus: "ngf_pro_monthly" });
    await send({ type: "PRODUCT_CHANGE", app_user_id: user.id });
    expect(await ent()).toMatchObject({ plan: "pro", source: "app_store" });
    await expect(assertAiAllowed(user.id, "pro", "chat")).resolves.toMatchObject({ chatLimit: 150 });

    setCustomer(user.id, { ngf_plus_monthly: sub({ expires_date: iso(-60_000) }), ngf_pro_monthly: sub({ unsubscribe_detected_at: iso(-1000) }) }, { pro: "ngf_pro_monthly" });
    await send({ type: "CANCELLATION", app_user_id: user.id });
    expect(await ent()).toMatchObject({ plan: "pro" });
    const { data: pro } = await serviceClient().from("store_subscriptions").select("unsubscribe_detected_at").eq("user_id", user.id).eq("product_id", "ngf_pro_monthly").single();
    expect(pro?.unsubscribe_detected_at).not.toBeNull();

    setCustomer(user.id, { ngf_pro_monthly: sub({ expires_date: iso(-60_000), grace_period_expires_date: iso(3 * day), billing_issues_detected_at: iso(-1000) }) }, { pro: "ngf_pro_monthly" });
    await send({ type: "BILLING_ISSUE", app_user_id: user.id });
    expect(await ent()).toMatchObject({ plan: "pro" });

    setCustomer(user.id, { ngf_pro_monthly: sub({ expires_date: iso(-60_000) }) }, { pro: "ngf_pro_monthly" });
    await send({ type: "EXPIRATION", app_user_id: user.id });
    expect(await ent()).toMatchObject({ plan: "free", source: "default" });
    // The expired Plus product (no longer in the customer) was removed; the Pro row stays as history.
    const { data: rows } = await serviceClient().from("store_subscriptions").select("product_id").eq("user_id", user.id);
    expect(rows).toEqual([{ product_id: "ngf_pro_monthly" }]);
  });

  it("downgrade Pro → Plus takes effect when the store applies it, at renewal", async () => {
    // Downgrade chosen: the store keeps Pro until the paid period ends.
    setCustomer(user.id, { ngf_pro_monthly: sub({ unsubscribe_detected_at: null }) }, { pro: "ngf_pro_monthly", plus: "ngf_pro_monthly" });
    await send({ type: "PRODUCT_CHANGE", app_user_id: user.id });
    expect(await ent()).toMatchObject({ plan: "pro" });
    // At renewal the Plus product takes over and Pro lapses.
    setCustomer(user.id, { ngf_pro_monthly: sub({ expires_date: iso(-60_000) }), ngf_plus_monthly: sub({ purchase_date: iso(-30_000) }) }, { plus: "ngf_plus_monthly" });
    await send({ type: "RENEWAL", app_user_id: user.id });
    expect(await ent()).toMatchObject({ plan: "plus", source: "app_store" });
    await expect(assertAiAllowed(user.id, "plus", "chat")).rejects.toMatchObject({ code: "not_entitled" });
  });

  it("a refund ends access straight away", async () => {
    setCustomer(user.id, { ngf_pro_monthly: sub({ purchase_date: iso(-day) }) }, { pro: "ngf_pro_monthly" });
    await send({ type: "RENEWAL", app_user_id: user.id });
    expect(await ent()).toMatchObject({ plan: "pro" });
    // Apple refunded the current period (RevenueCat: CANCELLATION with cancel_reason CUSTOMER_SUPPORT).
    setCustomer(user.id, { ngf_pro_monthly: sub({ purchase_date: iso(-day), refunded_at: iso(-60_000) }) }, { pro: "ngf_pro_monthly" });
    await send({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", app_user_id: user.id });
    expect(await ent()).toMatchObject({ plan: "free" });
  });

  it("restore on another account moves the subscription (TRANSFER updates both members)", async () => {
    setCustomer(user.id, { ngf_plus_monthly: sub() }, { plus: "ngf_plus_monthly" });
    await syncStoreSubscriber(user.id); // what "Restore purchases" triggers on the server
    expect(await ent()).toMatchObject({ plan: "plus" });

    // The same Apple Account restores on `other`: RevenueCat moves the purchase there.
    setCustomer(other.id, { ngf_plus_monthly: sub() }, { plus: "ngf_plus_monthly" });
    setCustomer(user.id, {});
    await send({ type: "TRANSFER", transferred_from: [user.id], transferred_to: [other.id] });
    expect(await ent(other)).toMatchObject({ plan: "plus", source: "app_store" });
    expect(await ent()).toMatchObject({ plan: "free" });
  });

  it("a member paying on the web and in the app gets the higher plan", async () => {
    setCustomer(user.id, { ngf_plus_monthly: sub() }, { plus: "ngf_plus_monthly" });
    await syncStoreSubscriber(user.id);
    const web = {
      id: `sub_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`,
      customer: "cus_test",
      status: "active",
      cancel_at_period_end: false,
      metadata: { user_id: user.id },
      items: { data: [{ price: { id: "price_test_pro" }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
    } as unknown as Stripe.Subscription;
    await syncSubscription(web);
    expect(await ent()).toMatchObject({ plan: "pro", source: "stripe" });
    await syncSubscription({ ...web, status: "canceled", items: { data: [{ price: { id: "price_test_pro" }, current_period_end: Math.floor(Date.now() / 1000) - 60 }] } } as unknown as Stripe.Subscription);
    expect(await ent()).toMatchObject({ plan: "plus", source: "app_store" });
  });

  it("ignores anonymous ids and Test Store purchases; a RevenueCat outage returns 500 so the event is retried", async () => {
    const before = requests.length;
    await send({ type: "INITIAL_PURCHASE", app_user_id: "$RCAnonymousID:abc" });
    expect(requests.length).toBe(before);

    setCustomer(other.id, { test_pro: sub({ store: "test_store" }) }, { pro: "test_pro" });
    await syncStoreSubscriber(other.id);
    expect(await ent(other)).toMatchObject({ plan: "free" });

    setCustomer(other.id, { ngf_pro_monthly: sub() }, { pro: "ngf_pro_monthly" });
    failNext = 1;
    const id = `rc-${crypto.randomUUID()}`;
    const failed = await send({ id, type: "INITIAL_PURCHASE", app_user_id: other.id });
    expect(failed.status).toBe(500);
    const retried = await send({ id, type: "INITIAL_PURCHASE", app_user_id: other.id });
    expect(await retried.json()).toMatchObject({ duplicate: false });
    expect(await ent(other)).toMatchObject({ plan: "pro" });
  });

  it("removes the RevenueCat customer on account deletion", async () => {
    setCustomer("3f1c6a52-1b2c-4d3e-8f90-123456789abc", {});
    await deleteRevenueCatCustomer("3f1c6a52-1b2c-4d3e-8f90-123456789abc");
    expect(requests.at(-1)).toMatchObject({ method: "DELETE", id: "3f1c6a52-1b2c-4d3e-8f90-123456789abc" });
    expect(customers.has("3f1c6a52-1b2c-4d3e-8f90-123456789abc")).toBe(false);
  });
});
