import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonKey, createTestUser, deleteTestUser, exerciseIds, grantPlan, serviceClient, stackAvailable, url, type TestUser } from "./helpers";

/**
 * Subscription security closure (2026-11-17). Fills the gaps left by entitlements, billing-integrity, store-billing,
 * subscription-lifecycle, account-deletion*, plan-enforcement, pro-bypass and free-user-direct-actions:
 *
 *   A. account deletion against the Stripe and RevenueCat stand-ins (Stripe configured): subscriptions are cancelled
 *      while the account still exists, a cancellation failure stops everything, and webhooks that arrive for the
 *      deleted member recreate nothing (and never look the member up at RevenueCat, which would recreate them there);
 *   B. webhook ordering, replay, grace, refund and alias cases through the real route handlers, each tied to its
 *      effect on the database's own plan checks;
 *   C. a Free member writing Pro rows straight through PostgREST with their own JWT, each with a Pro control so the
 *      refusal is shown to be the plan check;
 *   D. Pro server actions not covered elsewhere, called directly by a Free member.
 *
 * Nothing reaches Stripe, RevenueCat or an AI provider: both billing services are local stand-ins on ports chosen
 * here, and AI calls point at a closed port.
 */

let current: SupabaseClient;
vi.mock("@/lib/supabase/server", async (original) => ({ ...(await original<typeof import("@/lib/supabase/server")>()), getServerSupabase: async () => current }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {}, delete: () => {} }), headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";

const available = await stackAvailable();
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const RC_AUTH = process.env.REVENUECAT_WEBHOOK_AUTH!;
const day = 86_400_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const unix = (offsetMs: number) => Math.floor((Date.now() + offsetMs) / 1000);
const admin = serviceClient();

// ---- Stripe stand-in ---------------------------------------------------------------------------------------------
type StripeCall = { method: string; path: string; userExisted?: boolean };
const stripeSubs = new Map<string, Record<string, unknown>>();
const subOwner = new Map<string, string>();
const failCancel = new Set<string>();
const stripeCalls: StripeCall[] = [];
/** Open Checkout pages by customer (a tab left open on the payment page). */
const openCheckouts = new Map<string, { id: string; customer: string; status: string }>();
const stripeServer = createServer(async (req, res) => {
  const u = new URL(req.url ?? "/", "http://stripe.local");
  const json = (status: number, body: unknown) => void res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
  const call: StripeCall = { method: req.method ?? "", path: u.pathname };
  stripeCalls.push(call);
  if (req.method === "GET" && u.pathname === "/v1/subscriptions") {
    const customer = u.searchParams.get("customer");
    return json(200, { object: "list", url: "/v1/subscriptions", has_more: false, data: [...stripeSubs.values()].filter((s) => s.customer === customer) });
  }
  const sub = u.pathname.match(/^\/v1\/subscriptions\/([^/?]+)$/);
  if (sub) {
    const id = decodeURIComponent(sub[1]!);
    const obj = stripeSubs.get(id);
    if (!obj) return json(404, { error: { type: "invalid_request_error", code: "resource_missing", message: "No such subscription" } });
    if (req.method === "DELETE") {
      // Was the member's account still there when Stripe was asked to cancel? (Deletion must cancel first.)
      const owner = subOwner.get(id);
      call.userExisted = owner ? Boolean((await admin.auth.admin.getUserById(owner)).data.user) : undefined;
      if (failCancel.has(id)) return json(500, { error: { type: "api_error", message: "Stand-in failure" } });
      const cancelled = { ...obj, status: "canceled" };
      stripeSubs.set(id, cancelled);
      return json(200, cancelled);
    }
    return json(200, obj);
  }
  if (req.method === "GET" && u.pathname === "/v1/checkout/sessions") {
    const customer = u.searchParams.get("customer");
    const data = [...openCheckouts.values()].filter((c) => c.customer === customer && c.status === "open");
    return json(200, { object: "list", url: "/v1/checkout/sessions", has_more: false, data: data.map((c) => ({ object: "checkout.session", ...c })) });
  }
  const expire = u.pathname.match(/^\/v1\/checkout\/sessions\/([^/?]+)\/expire$/);
  if (expire && req.method === "POST") {
    const c = openCheckouts.get(decodeURIComponent(expire[1]!));
    if (!c) return json(404, { error: { type: "invalid_request_error", code: "resource_missing", message: "No such checkout session" } });
    c.status = "expired";
    return json(200, { object: "checkout.session", ...c });
  }
  const cust = u.pathname.match(/^\/v1\/customers\/([^/?]+)$/);
  if (cust && req.method === "DELETE") return json(200, { id: decodeURIComponent(cust[1]!), object: "customer", deleted: true });
  return json(404, { error: { type: "invalid_request_error", code: "resource_missing", message: "Not in the stand-in" } });
});

// ---- RevenueCat stand-in -----------------------------------------------------------------------------------------
const rcCustomers = new Map<string, { entitlements: Record<string, unknown>; subscriptions: Record<string, unknown> }>();
const rcCalls: { method: string; id: string }[] = [];
const rcServer = createServer((req, res) => {
  const m = req.url?.match(/^\/v1\/subscribers\/([^/?]+)$/);
  const id = m ? decodeURIComponent(m[1]!) : "";
  rcCalls.push({ method: req.method ?? "", id });
  if (!m) return void res.writeHead(404).end("{}");
  if (req.method === "DELETE") {
    rcCustomers.delete(id);
    return void res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ app_user_id: id }));
  }
  // Like RevenueCat, looking up an unknown id creates an empty customer.
  if (!rcCustomers.has(id)) rcCustomers.set(id, { entitlements: {}, subscriptions: {} });
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ request_date: new Date().toISOString(), subscriber: { ...rcCustomers.get(id), management_url: null } }));
});

const listen = (s: Server) => new Promise<number>((resolve) => s.listen(0, "127.0.0.1", () => resolve((s.address() as AddressInfo).port)));
if (available) {
  // Own ports, so this file never collides with another file's stand-ins; set before any app module is imported.
  process.env.STRIPE_API_BASE_URL = `http://127.0.0.1:${await listen(stripeServer)}`;
  process.env.REVENUECAT_API_BASE_URL = `http://127.0.0.1:${await listen(rcServer)}`;
}

/** An App Store Pro subscription as RevenueCat reports it. */
function rcPro(over: Record<string, unknown> = {}) {
  const s = {
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
    store_transaction_id: "2000000777",
    ...over,
  };
  return {
    entitlements: { pro: { product_identifier: "ngf_pro_monthly", expires_date: s.expires_date, grace_period_expires_date: s.grace_period_expires_date, purchase_date: s.purchase_date } },
    subscriptions: { ngf_pro_monthly: s },
  };
}

const customerOf = (u: TestUser) => `cus_${u.id.replace(/-/g, "").slice(0, 16)}`;
function stripeSub(u: TestUser, over: Record<string, unknown> = {}): Record<string, unknown> {
  const s = {
    id: `sub_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`,
    object: "subscription",
    customer: customerOf(u),
    status: "active",
    cancel_at_period_end: false,
    metadata: { user_id: u.id },
    latest_invoice: null,
    items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: unix(30 * day) }] },
    ...over,
  };
  stripeSubs.set(s.id, s);
  subOwner.set(s.id, u.id);
  return s;
}

describe.skipIf(!available)("subscription security closure", async () => {
  const { POST: stripeWebhook } = await import("@/app/api/stripe/webhook/route");
  const { POST: rcWebhook } = await import("@/app/api/revenuecat/webhook/route");
  const { syncSubscription, cancelStripeSubscriptionsForUser, deleteStripeCustomer, isStripeConfigured } = await import("@/server/services/billing");
  const { syncStoreSubscriber, deleteRevenueCatCustomer } = await import("@/server/services/store-billing");
  const { deleteUserAccount } = await import("@/server/services/account-deletion");
  const { isRevenueCatConfigured } = await import("@/server/env");
  const { NextRequest } = await import("next/server");

  const users: TestUser[] = [];
  const newUser = async (label: string) => {
    const u = await createTestUser(label);
    users.push(u);
    return u;
  };
  const linkCustomer = (u: TestUser) => admin.from("billing_customers").upsert({ user_id: u.id, stripe_customer_id: customerOf(u) }, { onConflict: "user_id" });
  const ent = async (u: TestUser) => (await admin.from("user_entitlements").select("plan, source, valid_until").eq("user_id", u.id).maybeSingle()).data;
  const planOf = async (u: TestUser) => (await ent(u))?.plan ?? "free";

  /** A Stripe delivery signed with the webhook secret, the way Stripe signs it. */
  const deliverStripe = async (type: string, object: unknown, over: { id?: string; created?: number } = {}) => {
    const payload = JSON.stringify({ id: over.id ?? `evt_${crypto.randomUUID()}`, object: "event", api_version: "2025-03-31.basil", created: over.created ?? unix(0), type, data: { object } });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    const res = await stripeWebhook(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const deliverRc = async (event: Record<string, unknown>, auth: string | null = RC_AUTH) => {
    const res = await rcWebhook(
      new NextRequest("http://localhost/api/revenuecat/webhook", {
        method: "POST",
        body: JSON.stringify({ api_version: "1.0", event: { id: crypto.randomUUID(), environment: "PRODUCTION", ...event } }),
        headers: auth === null ? {} : { authorization: auth },
      }),
    );
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  /** A PostgREST call with the member's own access token, as any script holding their session could make. */
  const rest = async (u: TestUser, method: "POST" | "PATCH" | "GET", path: string, body?: unknown) => {
    const token = (await u.client.auth.getSession()).data.session!.access_token;
    const res = await fetch(`${url()}/rest/v1/${path}`, {
      method,
      headers: { apikey: anonKey(), authorization: `Bearer ${token}`, "content-type": "application/json", prefer: "return=representation" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, json: (text ? JSON.parse(text) : null) as { code?: string } & unknown[] };
  };

  afterAll(async () => {
    for (const u of users) await deleteTestUser(u).catch(() => null);
    await new Promise((r) => stripeServer.close(r));
    await new Promise((r) => rcServer.close(r));
  });

  // ---- A. Account deletion and late webhooks -------------------------------------------------------------------

  describe("account deletion vs billing", () => {
    /** The same dependencies deleteAccountAction (src/server/actions/profile.ts) passes. */
    const deps = () => ({
      admin,
      cancelSubscriptions: cancelStripeSubscriptionsForUser,
      deleteStripeCustomer: isStripeConfigured() ? deleteStripeCustomer : null,
      deleteStoreCustomer: isRevenueCatConfigured() ? deleteRevenueCatCustomer : null,
      log: () => undefined,
    });
    const billingRows = async (userId: string) => {
      const tables = ["subscriptions", "billing_customers", "store_subscriptions", "user_entitlements", "billing_state_versions", "store_sync_state", "legacy_plan_terms"];
      const counts: Record<string, number> = {};
      for (const t of tables) counts[t] = (await admin.from(t).select("user_id", { count: "exact", head: true }).eq("user_id", userId)).count ?? -1;
      return counts;
    };
    const none = { subscriptions: 0, billing_customers: 0, store_subscriptions: 0, user_entitlements: 0, billing_state_versions: 0, store_sync_state: 0, legacy_plan_terms: 0 };

    let gone: TestUser;
    let webSub: Record<string, unknown>;
    let raceSub: Record<string, unknown>;

    it("a Stripe cancellation that fails stops the deletion: account, subscription and plan stay exactly as they were", async () => {
      const u = await newUser("close-del-fail");
      await linkCustomer(u);
      const sub = stripeSub(u);
      await syncSubscription(sub as unknown as Stripe.Subscription);
      rcCustomers.set(u.id, rcPro());
      await syncStoreSubscriber(u.id);
      expect(await planOf(u)).toBe("pro");
      failCancel.add(sub.id as string);
      const rcBefore = rcCalls.length;
      const r = await deleteUserAccount(u.id, deps());
      failCancel.delete(sub.id as string);
      expect(r).toEqual({ ok: false, stage: "billing", subscriptionsCancelled: false, filesRemoved: false });
      expect((await admin.auth.admin.getUserById(u.id)).data.user?.id).toBe(u.id);
      expect((await admin.from("subscriptions").select("status").eq("stripe_subscription_id", sub.id).single()).data?.status).toBe("active");
      expect(await planOf(u)).toBe("pro");
      // Nothing after the failed step ran: no Stripe customer or RevenueCat customer removal.
      expect(stripeCalls.some((c) => c.method === "DELETE" && c.path === `/v1/customers/${customerOf(u)}`)).toBe(false);
      expect(rcCalls.slice(rcBefore).some((c) => c.method === "DELETE")).toBe(false);
    });

    it("cancels every open Stripe subscription (stored, and known only to Stripe) while the account still exists, then removes both customers and every billing row", async () => {
      gone = await newUser("close-del");
      await linkCustomer(gone);
      webSub = stripeSub(gone);
      await syncSubscription(webSub as unknown as Stripe.Subscription);
      // Created in Stripe a moment ago (another tab's checkout); its webhook hasn't arrived, so there's no local row.
      raceSub = stripeSub(gone, { status: "trialing" });
      // A checkout page left open in another tab (billing review F2): it must be expired, so it can't be paid later.
      openCheckouts.set("cs_open_tab", { id: "cs_open_tab", customer: customerOf(gone), status: "open" });
      rcCustomers.set(gone.id, rcPro());
      await syncStoreSubscriber(gone.id);
      expect(await planOf(gone)).toBe("pro");
      expect((await billingRows(gone.id)).store_subscriptions).toBe(1);

      const r = await deleteUserAccount(gone.id, deps());
      expect(r).toEqual({ ok: true, stripeCustomerDeleted: true });
      for (const s of [webSub, raceSub]) {
        const cancel = stripeCalls.find((c) => c.method === "DELETE" && c.path === `/v1/subscriptions/${s.id as string}`);
        expect(cancel, `cancel ${s.id as string}`).toBeTruthy();
        expect(cancel?.userExisted, "cancelled before the account was deleted").toBe(true);
        expect(stripeSubs.get(s.id as string)?.status).toBe("canceled");
      }
      expect(stripeCalls.some((c) => c.method === "DELETE" && c.path === `/v1/customers/${customerOf(gone)}`)).toBe(true);
      const expireAt = stripeCalls.findIndex((c) => c.method === "POST" && c.path === "/v1/checkout/sessions/cs_open_tab/expire");
      expect(expireAt, "the open checkout page was expired").toBeGreaterThanOrEqual(0);
      expect(expireAt).toBeLessThan(stripeCalls.findIndex((c) => c.method === "DELETE" && c.path === `/v1/customers/${customerOf(gone)}`));
      expect(openCheckouts.get("cs_open_tab")?.status).toBe("expired");
      // The store subscription can't be cancelled by the app: only RevenueCat's customer record is removed.
      expect(rcCalls.at(-1)).toEqual({ method: "DELETE", id: gone.id });
      expect((await admin.auth.admin.getUserById(gone.id)).data.user).toBeNull();
      expect(await billingRows(gone.id)).toEqual(none);
    });

    it("Stripe webhooks that arrive after the deletion are acknowledged and recreate nothing", async () => {
      const cancelledSnapshot = stripeSubs.get(webSub.id as string);
      // A subscription Stripe still shows as active (say, one the deletion could not see) and names the deleted member.
      const orphan = stripeSub(gone, { customer: "cus_orphan_after_delete" });
      const deliveries = [
        await deliverStripe("customer.subscription.deleted", cancelledSnapshot),
        await deliverStripe("customer.subscription.updated", orphan),
        await deliverStripe("checkout.session.completed", { id: "cs_test_late", object: "checkout.session", mode: "subscription", subscription: orphan.id, client_reference_id: gone.id }),
        await deliverStripe("invoice.paid", { id: "in_late", object: "invoice", created: unix(0), parent: { subscription_details: { subscription: orphan.id } } }),
      ];
      for (const d of deliveries) expect(d).toMatchObject({ status: 200, body: { received: true, duplicate: false } });
      expect(await billingRows(gone.id)).toEqual(none);
      for (const id of [webSub.id, raceSub.id, orphan.id]) expect((await admin.from("subscriptions").select("id").eq("stripe_subscription_id", id)).data).toEqual([]);
      expect((await admin.from("billing_customers").select("user_id").in("stripe_customer_id", [customerOf(gone), "cus_orphan_after_delete"])).data).toEqual([]);
    });

    it("RevenueCat webhooks for the deleted member are acknowledged without a RevenueCat lookup (which would recreate the customer) and recreate nothing", async () => {
      const before = rcCalls.length;
      for (const event of [
        { type: "RENEWAL", app_user_id: gone.id },
        { type: "EXPIRATION", app_user_id: gone.id, original_app_user_id: gone.id },
        { type: "TRANSFER", transferred_from: ["$RCAnonymousID:x"], transferred_to: [gone.id] },
      ]) {
        const id = crypto.randomUUID();
        expect(await deliverRc({ ...event, id })).toMatchObject({ status: 200, body: { received: true, duplicate: false } });
        expect((await admin.from("revenuecat_events").select("status").eq("id", id).single()).data?.status).toBe("processed");
      }
      expect(rcCalls.slice(before)).toEqual([]);
      expect(rcCustomers.has(gone.id)).toBe(false);
      expect(await billingRows(gone.id)).toEqual(none);
      // And a direct sync (restore purchases from a stale session) does the same: nothing looked up, nothing written.
      expect(await syncStoreSubscriber(gone.id)).toBeNull();
      expect(rcCalls.slice(before)).toEqual([]);
    });
  });

  // ---- B. Webhooks: authenticity, replay, ordering, grace, refund, alias --------------------------------------

  describe("webhooks", () => {
    it("RevenueCat: only the exact configured Authorization value is accepted; near misses are refused before anything is read", async () => {
      const u = await newUser("close-rc-auth");
      rcCustomers.set(u.id, rcPro());
      const before = rcCalls.length;
      // (Leading and trailing spaces are not a near miss: HTTP strips them from header values before the app sees them.)
      for (const auth of [null, "", RC_AUTH.toLowerCase(), RC_AUTH.replace(/^Bearer /, ""), `Bearer  ${RC_AUTH.replace(/^Bearer /, "")}`, RC_AUTH.slice(0, -1), `${RC_AUTH}x`]) {
        expect((await deliverRc({ type: "INITIAL_PURCHASE", app_user_id: u.id }, auth)).status, JSON.stringify(auth)).toBe(401);
      }
      expect(rcCalls.length).toBe(before);
      expect(await planOf(u)).toBe("free");
    });

    it("Stripe: a late event can neither downgrade a paying member nor revive an ended subscription; a replay is applied once", async () => {
      const u = await newUser("close-stripe-order");
      await linkCustomer(u);
      const sub = stripeSub(u);
      const createdId = `evt_${crypto.randomUUID()}`;
      const created = await deliverStripe("customer.subscription.created", sub, { id: createdId, created: unix(-3600_000) });
      expect(created.status).toBe(200);
      expect(await planOf(u)).toBe("pro");
      // An old "unpaid" snapshot (an earlier failed renewal, delivered late): Stripe now says active, so Pro stays.
      expect((await deliverStripe("customer.subscription.updated", { ...sub, status: "unpaid" }, { created: unix(-7200_000) })).status).toBe(200);
      expect(await planOf(u)).toBe("pro");
      // Cancelled immediately in Stripe.
      stripeSubs.set(sub.id as string, { ...sub, status: "canceled" });
      await deliverStripe("customer.subscription.deleted", stripeSubs.get(sub.id as string));
      expect(await planOf(u)).toBe("free");
      // A late "active" snapshot can't bring it back...
      expect((await deliverStripe("customer.subscription.updated", sub, { created: unix(-1800_000) })).status).toBe(200);
      expect(await planOf(u)).toBe("free");
      // ...and neither can a replay of the original creation event (same id): it is a recorded duplicate.
      const replay = await deliverStripe("customer.subscription.created", sub, { id: createdId });
      expect(replay).toMatchObject({ status: 200, body: { duplicate: true } });
      expect(await planOf(u)).toBe("free");
    });

    it("Stripe: cancel at period end keeps Pro until the stored end date; the ended subscription closes the database's own gates", async () => {
      const u = await newUser("close-stripe-cape");
      await linkCustomer(u);
      const end = unix(5 * day);
      const sub = stripeSub(u, { cancel_at_period_end: true, items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: end }] } });
      await deliverStripe("customer.subscription.updated", sub);
      const e = await ent(u);
      expect(e).toMatchObject({ plan: "pro", source: "stripe" });
      expect(new Date(e!.valid_until as string).getTime()).toBe(end * 1000);
      expect((await admin.from("subscriptions").select("cancel_at_period_end").eq("stripe_subscription_id", sub.id).single()).data?.cancel_at_period_end).toBe(true);
      // While Pro, the database lets the member write Pro rows directly.
      expect((await rest(u, "POST", "recipes", { user_id: u.id, name: "While Pro" })).status).toBe(201);
      // The period ends: Stripe ends the subscription.
      stripeSubs.set(sub.id as string, { ...sub, status: "canceled", items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: unix(-60_000) }] } });
      await deliverStripe("customer.subscription.deleted", stripeSubs.get(sub.id as string));
      expect(await planOf(u)).toBe("free");
      const refused = await rest(u, "POST", "recipes", { user_id: u.id, name: "After the period" });
      expect(refused.status).toBe(403);
      expect(refused.json.code).toBe("42501");
    });

    it("Stripe: a failed renewal (past_due) keeps Pro for 14 days from the unpaid period's start, then not", async () => {
      const inGrace = await newUser("close-pd-in");
      const beyond = await newUser("close-pd-out");
      for (const u of [inGrace, beyond]) await linkCustomer(u);
      // Monthly price: the unpaid period started ~5 days ago (ends in 25 days) / ~20 days ago (ends in 10 days).
      const a = stripeSub(inGrace, { status: "past_due", items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: unix(25 * day) }] } });
      const b = stripeSub(beyond, { status: "past_due", items: { object: "list", data: [{ id: "si_1", price: { id: "price_test_pro" }, current_period_end: unix(10 * day) }] } });
      await deliverStripe("invoice.payment_failed", { id: `in_${crypto.randomUUID().slice(0, 8)}`, object: "invoice", parent: { subscription_details: { subscription: a.id } } });
      await deliverStripe("invoice.payment_failed", { id: `in_${crypto.randomUUID().slice(0, 8)}`, object: "invoice", parent: { subscription_details: { subscription: b.id } } });
      const ea = await ent(inGrace);
      expect(ea?.plan).toBe("pro");
      // Access ends with the grace period (about 9 days from now), well before the period end Stripe moved on to.
      const until = new Date(ea!.valid_until as string).getTime();
      expect(until).toBeLessThan(Date.now() + 12 * day);
      expect(until).toBeGreaterThan(Date.now() + 6 * day);
      expect(await planOf(beyond)).toBe("free");
    });

    it("RevenueCat: order of delivery doesn't matter (the server re-reads RevenueCat); a replay is applied once", async () => {
      const u = await newUser("close-rc-order");
      rcCustomers.set(u.id, rcPro());
      const purchase = crypto.randomUUID();
      expect((await deliverRc({ id: purchase, type: "INITIAL_PURCHASE", app_user_id: u.id })).status).toBe(200);
      expect(await ent(u)).toMatchObject({ plan: "pro", source: "app_store" });
      rcCustomers.set(u.id, rcPro({ expires_date: iso(-60_000) }));
      await deliverRc({ type: "EXPIRATION", app_user_id: u.id });
      expect(await planOf(u)).toBe("free");
      // An older RENEWAL delivered late, and a replay of the purchase: neither revives it.
      expect((await deliverRc({ type: "RENEWAL", app_user_id: u.id })).status).toBe(200);
      expect(await planOf(u)).toBe("free");
      expect(await deliverRc({ id: purchase, type: "INITIAL_PURCHASE", app_user_id: u.id })).toMatchObject({ status: 200, body: { duplicate: true } });
      expect(await planOf(u)).toBe("free");
      // Resubscribed; then a stale EXPIRATION arrives late: no wrongful downgrade.
      rcCustomers.set(u.id, rcPro({ purchase_date: iso(-60_000), expires_date: iso(30 * day) }));
      await deliverRc({ type: "RENEWAL", app_user_id: u.id });
      expect(await planOf(u)).toBe("pro");
      await deliverRc({ type: "EXPIRATION", app_user_id: u.id });
      expect(await planOf(u)).toBe("pro");
    });

    it("RevenueCat: a billing issue whose store grace period has run out ends access", async () => {
      const u = await newUser("close-rc-grace");
      rcCustomers.set(u.id, rcPro({ expires_date: iso(-5 * day), grace_period_expires_date: iso(2 * day), billing_issues_detected_at: iso(-5 * day) }));
      await deliverRc({ type: "BILLING_ISSUE", app_user_id: u.id });
      expect(await planOf(u)).toBe("pro");
      rcCustomers.set(u.id, rcPro({ expires_date: iso(-5 * day), grace_period_expires_date: iso(-60_000), billing_issues_detected_at: iso(-5 * day) }));
      await deliverRc({ type: "EXPIRATION", app_user_id: u.id });
      expect(await planOf(u)).toBe("free");
    });

    it("RevenueCat: a refund ends access at once and the database's own gates close with it", async () => {
      const u = await newUser("close-rc-refund");
      rcCustomers.set(u.id, rcPro());
      await deliverRc({ type: "INITIAL_PURCHASE", app_user_id: u.id });
      expect((await rest(u, "POST", "meal_plan_settings", { user_id: u.id, meals_per_day: 3 })).status).toBe(201);
      rcCustomers.set(u.id, rcPro({ refunded_at: iso(-60_000) }));
      await deliverRc({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", app_user_id: u.id });
      expect(await planOf(u)).toBe("free");
      const refused = await rest(u, "POST", "recipes", { user_id: u.id, name: "After refund" });
      expect(refused.status).toBe(403);
      expect(refused.json.code).toBe("42501");
    });

    it("RevenueCat: an event naming the member only as an alias of an anonymous id (purchase before sign-in, then log in) syncs that member", async () => {
      const u = await newUser("close-rc-alias");
      rcCustomers.set(u.id, rcPro());
      const anon = `$RCAnonymousID:${crypto.randomUUID().replace(/-/g, "")}`;
      const before = rcCalls.length;
      expect((await deliverRc({ type: "SUBSCRIBER_ALIAS", app_user_id: anon, original_app_user_id: anon, aliases: [anon, u.id] })).status).toBe(200);
      expect(await ent(u)).toMatchObject({ plan: "pro", source: "app_store" });
      // Only our member was looked up; the anonymous id never was.
      expect(rcCalls.slice(before)).toEqual([{ method: "GET", id: u.id }]);
    });
  });

  // ---- C. Free member, straight to the database with their own JWT ---------------------------------------------

  describe("a Free member writing Pro rows through the REST API", () => {
    let free: TestUser;
    let pro: TestUser;
    let proProgram: { id: string; dayId: string };

    beforeAll(async () => {
      [free, pro] = await Promise.all([newUser("close-rest-free"), newUser("close-rest-pro")]);
      await grantPlan(pro, "pro");
      const { data: p } = await admin.from("training_programs").select("id").eq("is_published", true).eq("tier", "pro").limit(1).single();
      const { data: d } = await admin.from("program_days").select("id, program_weeks!inner(program_id)").eq("program_weeks.program_id", p!.id).limit(1).single();
      proProgram = { id: p!.id as string, dayId: d!.id as string };
    });

    it("each Pro-only table refuses the Free member's insert with 42501 and accepts the same row from a Pro member", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [squat] = Object.values(await exerciseIds(["barbell-back-squat", "back-squat", "goblet-squat"]));
      // Rows a member who used to be Pro would already have (written here by the service role): only new Pro writes are refused.
      const seed = async (u: TestUser) => {
        const recipe = (await admin.from("recipes").insert({ user_id: u.id, name: "Earlier recipe" }).select("id").single()).data!.id as string;
        const plan = (await admin.from("meal_plans").insert({ user_id: u.id, start_date: today, days: 7, targets: {}, settings: {} }).select("id").single()).data!.id as string;
        const enrol = (await admin.from("user_programs").insert({ user_id: u.id, program_id: proProgram.id, status: "active" }).select("id").single()).data!.id as string;
        const habit = (await admin.from("habit_program_enrollments").insert({ user_id: u.id, program_slug: "nutrition-foundations", started_on: today, goals: {} }).select("id").single()).data!.id as string;
        return { recipe, plan, enrol, habit };
      };
      const [fs, ps] = await Promise.all([seed(free), seed(pro)]);
      const perServing = { calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15, complete: true };
      const basis = { per100: { calories: 130, protein_g: 2.7, carbs_g: 28.2, fat_g: 0.3 } };
      const rows = (u: TestUser, s: typeof fs): [string, Record<string, unknown>][] => [
        ["meal_plan_settings", { user_id: u.id, meals_per_day: 3 }],
        ["grocery_items", { user_id: u.id, name: "Oats", origin: "manual" }],
        ["meal_plan_entries", { plan_id: s.plan, user_id: u.id, plan_date: today, slot: 0, meal_type: "breakfast", label: "Breakfast", source_key: `recipe:${s.recipe}`, name: "Oats", portion: 1, per_serving: perServing }],
        ["recipe_ingredients", { recipe_id: s.recipe, user_id: u.id, name: "Rice", source: "usda:168878", quantity: 1, unit_label: "1 cup", grams: 158, basis }],
        ["planned_session_overrides", { user_id: u.id, user_program_id: s.enrol, program_day_id: proProgram.dayId, planned_date: today }],
        ["habit_program_checkins", { enrollment_id: s.habit, user_id: u.id, day_number: 1, activity_key: "closure-check", checked_on: today }],
        ["training_recommendation_decisions", { user_id: u.id, recommendation_key: "closure:check", decision: "rejected" }],
        ["training_adjustments", { user_id: u.id, kind: "exercise_target", summary: "closure", source: "review" }],
        ...(squat ? ([["exercise_targets", { user_id: u.id, exercise_id: squat, weight_kg: 60, source: "review" }]] as [string, Record<string, unknown>][]) : []),
      ];
      for (const [table, row] of rows(free, fs)) {
        const r = await rest(free, "POST", table, row);
        expect(r.status, `${table} (Free)`).toBe(403);
        expect(r.json.code, `${table} (Free)`).toBe("42501");
      }
      for (const [table, row] of rows(pro, ps)) {
        const r = await rest(pro, "POST", table, row);
        expect(r.status, `${table} (Pro): ${JSON.stringify(r.json)}`).toBe(201);
      }
    });

    it("a Free member can't move an existing scheduled session, can't create weekly reports or AI replies, and can't read a Pro program's prescriptions", async () => {
      const { data: enrol } = await admin.from("user_programs").select("id").eq("user_id", free.id).limit(1).single();
      const { data: o } = await admin.from("planned_session_overrides").insert({ user_id: free.id, user_program_id: enrol!.id, program_day_id: proProgram.dayId, planned_date: "2026-11-20" }).select("id").single();
      const moved = await rest(free, "PATCH", `planned_session_overrides?id=eq.${o!.id as string}`, { planned_date: "2026-11-25" });
      expect(moved.json).toEqual([]);
      expect((await admin.from("planned_session_overrides").select("planned_date").eq("id", o!.id).single()).data?.planned_date).toBe("2026-11-20");
      const monday = "2026-11-16";
      for (const u of [free, pro]) {
        const report = await rest(u, "POST", "weekly_reports", { user_id: u.id, week_start: monday, time_zone: "UTC", metrics: {}, analysis: {}, analysis_source: "ai" });
        expect(report.status, "members never create reports").toBe(403);
      }
      const conv = (await rest(free, "POST", "ai_conversations", { user_id: free.id, title: "x" })).json as unknown as { id: string }[];
      const planted = await rest(free, "POST", "ai_messages", { conversation_id: conv[0]!.id, user_id: free.id, role: "assistant", content: "Here is your plan", proposal: { name: "Forged" } });
      expect(planted.status).toBe(403);
      // An enrolment granted by the server (earlier Pro) keeps reading its own program; another Pro program stays closed.
      const { data: other } = await admin.from("training_programs").select("id").eq("is_published", true).eq("tier", "pro").neq("id", proProgram.id).limit(1).single();
      const { data: otherDay } = await admin.from("program_days").select("id, program_weeks!inner(program_id)").eq("program_weeks.program_id", other!.id).limit(1).single();
      expect((await rest(free, "GET", `program_exercises?select=id&day_id=eq.${otherDay!.id as string}`)).json).toEqual([]);
    });

    it("consent set directly on the profile (an allowed column) does not open Body Scan: no scan row, no upload", async () => {
      const set = await rest(free, "PATCH", `profiles?id=eq.${free.id}`, { body_scan_consent_at: new Date().toISOString() });
      expect(set.status).toBe(200);
      const scanId = crypto.randomUUID();
      const scan = await rest(free, "POST", "body_scans", { id: scanId, user_id: free.id, taken_on: "2026-11-17" });
      expect(scan.status).toBe(403);
      const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9])], { type: "image/jpeg" });
      const up = await free.client.storage.from("body-scans").upload(`${free.id}/${scanId}/front-${crypto.randomUUID()}.jpg`, jpeg, { contentType: "image/jpeg" });
      expect(up.error).not.toBeNull();
      // Control: a Pro member with the same consent stores a scan.
      await rest(pro, "PATCH", `profiles?id=eq.${pro.id}`, { body_scan_consent_at: new Date().toISOString() });
      expect((await rest(pro, "POST", "body_scans", { id: crypto.randomUUID(), user_id: pro.id, taken_on: "2026-11-17" })).status).toBe(201);
    });
  });

  // ---- D. Pro server actions not covered elsewhere ---------------------------------------------------------------

  describe("a Free member calling Pro server actions directly", () => {
    let free: TestUser;
    let pro: TestUser;

    beforeAll(async () => {
      [free, pro] = await Promise.all([newUser("close-act-free"), newUser("close-act-pro")]);
      await grantPlan(pro, "pro");
      const now = new Date().toISOString();
      await admin.from("profiles").update({ onboarding_completed_at: now, ai_data_consent_at: now, body_scan_consent_at: now, timezone: "UTC" }).in("id", [free.id, pro.id]);
      current = free.client;
    });

    it("habit programs, planner alternatives, skipping missed sessions, Body Scan and the Bible helper are refused with the plan message", async () => {
      current = free.client;
      const habits = await import("@/server/actions/habit-programs");
      const { getHabitProgram } = await import("@/data/habit-programs");
      const { activitiesForDay } = await import("@/lib/domain/habit-programs");
      const { planAlternativesAction } = await import("@/server/actions/meal-plan");
      const { skipMissedSessionsAction } = await import("@/server/actions/calendar");
      const { saveBodyScanAction } = await import("@/server/actions/body-scan");
      const { askBibleAction } = await import("@/server/actions/bible-ai");
      const today = new Date().toISOString().slice(0, 10);

      const start = await habits.startHabitProgramAction("nutrition-foundations");
      expect(start).toEqual({ ok: false, error: "Structured programs are included with Pro." });
      expect((await admin.from("habit_program_enrollments").select("id").eq("user_id", free.id)).data).toEqual([]);

      // An enrolment from when they were Pro: ticking an activity relies on the database, which refuses it.
      const { data: enr } = await admin.from("habit_program_enrollments").insert({ user_id: free.id, program_slug: "nutrition-foundations", started_on: today, goals: {} }).select("id").single();
      const key = activitiesForDay(getHabitProgram("nutrition-foundations")!, 1).daily[0]!.key;
      expect(await habits.setHabitActivityAction({ enrollmentId: enr!.id as string, day: 1, key, done: true })).toEqual({ ok: false, error: "Ticking off activities is included with Pro." });
      expect((await admin.from("habit_program_checkins").select("id").eq("user_id", free.id)).data).toEqual([]);

      expect(await planAlternativesAction({ entryId: crypto.randomUUID() })).toEqual({ ok: false, message: "The meal planner is included with Pro All Access." });
      expect((await skipMissedSessionsAction({ firstMissedDayId: crypto.randomUUID() })).message).toBe("Rescheduling sessions is included with Pro All Access.");

      const scanId = crypto.randomUUID();
      const photos = (["front", "side"] as const).map((pose) => ({ pose, path: `${free.id}/${scanId}/${pose}-${crypto.randomUUID()}.jpg` }));
      expect(await saveBodyScanAction({ id: scanId, photos })).toEqual({ ok: false, error: "Body Scan is included with Pro." });
      expect((await admin.from("body_scans").select("id").eq("user_id", free.id)).data).toEqual([]);

      expect(await askBibleAction("What does John 3:16 mean?", crypto.randomUUID())).toMatchObject({ ok: false, code: "not_entitled" });
      expect((await admin.from("ai_usage_events").select("id").eq("user_id", free.id)).data).toEqual([]);
      expect((await admin.from("bible_ai_usage").select("id").eq("user_id", free.id)).data ?? []).toEqual([]);

      // Control: the same call opens for a Pro member.
      current = pro.client;
      expect(await habits.startHabitProgramAction("nutrition-foundations")).toEqual({ ok: true });
      current = free.client;
    });

    it("'Restore purchases' can't claim a purchase: the plan comes from RevenueCat's record of this member only", async () => {
      current = free.client;
      const { syncStorePurchasesAction } = await import("@/server/actions/store-billing");
      rcCustomers.delete(free.id);
      expect(await syncStorePurchasesAction()).toEqual({ ok: true, plan: "free" });
      expect(await planOf(free)).toBe("free");
      expect((await admin.from("store_subscriptions").select("id").eq("user_id", free.id)).data).toEqual([]);
      // Someone else's purchase is never consulted: the action takes no member id, and only this member is read.
      rcCustomers.set(pro.id, rcPro());
      const before = rcCalls.length;
      await syncStorePurchasesAction();
      expect(rcCalls.slice(before)).toEqual([{ method: "GET", id: free.id }]);
      // A real purchase on this member's store account (RevenueCat says so) does unlock Pro.
      rcCustomers.set(free.id, rcPro());
      expect(await syncStorePurchasesAction()).toEqual({ ok: true, plan: "pro" });
      expect(await ent(free)).toMatchObject({ plan: "pro", source: "app_store" });
    });
  });
});
