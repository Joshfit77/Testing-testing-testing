import { affectedAppUserIds, normalizeStore, revenueCatSubscriberSchema, revenueCatWebhookSchema, storeRowAsSubscription, storeRowsFromSubscriber } from "@/lib/billing/revenuecat";
import { entitlementFromSubscriptions } from "@/lib/domain/plans";

const U1 = "3f1c6a52-1b2c-4d3e-8f90-123456789abc";
const U2 = "9a8b7c6d-5e4f-4a3b-9c2d-0123456789ab";
const ids = { plus: "plus", pro: "pro" };
const now = new Date("2026-10-22T12:00:00Z");
const future = "2026-11-22T12:00:00Z";
const past = "2026-10-01T12:00:00Z";

function customer(subscriptions: Record<string, Record<string, unknown>>, entitlements: Record<string, Record<string, unknown>> = {}) {
  return revenueCatSubscriberSchema.parse({ request_date: now.toISOString(), subscriber: { entitlements, subscriptions, management_url: null } });
}

describe("RevenueCat webhook parsing", () => {
  it("accepts RevenueCat's event envelope and ignores unknown fields", () => {
    const body = revenueCatWebhookSchema.parse({
      api_version: "1.0",
      event: { id: "evt-1", type: "INITIAL_PURCHASE", app_user_id: U1, product_id: "ngf_plus_monthly", price: 11.99, environment: "SANDBOX", store: "APP_STORE" },
    });
    expect(body.event).toMatchObject({ id: "evt-1", type: "INITIAL_PURCHASE", app_user_id: U1, environment: "SANDBOX" });
    expect(revenueCatWebhookSchema.safeParse({ event: { type: "RENEWAL" } }).success).toBe(false);
    expect(revenueCatWebhookSchema.safeParse({ nope: true }).success).toBe(false);
  });

  it("finds the members an event concerns, skipping anonymous ids, including both sides of a transfer", () => {
    expect(affectedAppUserIds({ id: "e", type: "RENEWAL", app_user_id: U1, original_app_user_id: U1, aliases: [U1, "$RCAnonymousID:abc"] })).toEqual([U1]);
    expect(affectedAppUserIds({ id: "e", type: "TRANSFER", transferred_from: [U1, "$RCAnonymousID:x"], transferred_to: [U2.toUpperCase()] })).toEqual([U1, U2]);
    expect(affectedAppUserIds({ id: "e", type: "TEST", app_user_id: "not-a-member" })).toEqual([]);
  });

  it("normalizes store names", () => {
    expect(normalizeStore("APP_STORE")).toBe("app_store");
    expect(normalizeStore("app_store")).toBe("app_store");
    expect(normalizeStore("MAC_APP_STORE")).toBe("app_store");
    expect(normalizeStore("PLAY_STORE")).toBe("play_store");
    expect(normalizeStore("TEST_STORE")).toBe("test_store");
    expect(normalizeStore("STRIPE")).toBe("other");
    expect(normalizeStore(null)).toBe("other");
  });
});

describe("RevenueCat customer → stored subscriptions", () => {
  it("takes each product's plan from the entitlement it unlocks, Pro first", () => {
    const rows = storeRowsFromSubscriber(
      customer(
        {
          ngf_plus_monthly: { store: "app_store", purchase_date: past, expires_date: past, is_sandbox: true, period_type: "normal" },
          ngf_pro_monthly: { store: "app_store", purchase_date: past, expires_date: future, is_sandbox: true, period_type: "normal", store_transaction_id: "2000001" },
        },
        { pro: { product_identifier: "ngf_pro_monthly", expires_date: future }, plus: { product_identifier: "ngf_pro_monthly", expires_date: future } },
      ),
      ids,
      new Map([["ngf_plus_monthly", "plus"]]),
    );
    expect(rows.find((r) => r.product_id === "ngf_pro_monthly")).toMatchObject({ plan: "pro", store: "app_store", is_sandbox: true, expires_at: future, store_transaction_id: "2000001" });
    // Not attached to an entitlement any more (expired): keeps the plan stored for it before.
    expect(rows.find((r) => r.product_id === "ngf_plus_monthly")).toMatchObject({ plan: "plus" });
  });

  it("skips web/Stripe purchases, and Test Store purchases unless allowed", () => {
    const c = customer({
      web: { store: "stripe", expires_date: future },
      test_plus: { store: "test_store", expires_date: future },
      play: { store: "play_store", expires_date: future },
    });
    expect(storeRowsFromSubscriber(c, ids).map((r) => r.product_id)).toEqual(["play"]);
    expect(storeRowsFromSubscriber(c, ids, new Map(), { allowTestStore: true }).map((r) => r.product_id)).toEqual(["test_plus", "play"]);
  });

  const row = (over: Partial<Parameters<typeof storeRowAsSubscription>[0]>) => ({
    plan: "plus" as const,
    purchased_at: past,
    expires_at: future,
    grace_period_expires_at: null,
    unsubscribe_detected_at: null,
    billing_issue_detected_at: null,
    refunded_at: null,
    ...over,
  });

  it("active, cancelled-but-paid-up, billing-issue grace, expired, lifetime", () => {
    expect(storeRowAsSubscription(row({}), now)).toEqual({ plan: "plus", status: "active", current_period_end: new Date(future).toISOString(), cancel_at_period_end: false });
    // Auto-renew turned off: access continues to the end of the paid period.
    expect(storeRowAsSubscription(row({ unsubscribe_detected_at: past }), now)).toMatchObject({ status: "active", cancel_at_period_end: true });
    // Billing problem, but inside Apple's grace period: still has access, flagged as past due.
    const grace = "2026-10-28T00:00:00Z";
    expect(storeRowAsSubscription(row({ expires_at: past, grace_period_expires_at: grace, billing_issue_detected_at: past }), now)).toMatchObject({
      status: "past_due",
      current_period_end: new Date(grace).toISOString(),
    });
    expect(storeRowAsSubscription(row({ expires_at: past }), now)).toMatchObject({ status: "canceled" });
    expect(storeRowAsSubscription(row({ expires_at: null }), now)).toMatchObject({ status: "active", current_period_end: null });
    expect(storeRowAsSubscription(row({ plan: null }), now)).toBeNull();
  });

  it("a refund of the current purchase ends access at once; a refund of an earlier period doesn't", () => {
    const refunded = storeRowAsSubscription(row({ purchased_at: "2026-10-20T00:00:00Z", refunded_at: "2026-10-21T00:00:00Z" }), now)!;
    expect(refunded).toMatchObject({ status: "canceled", current_period_end: "2026-10-21T00:00:00.000Z" });
    expect(entitlementFromSubscriptions([refunded], now).plan).toBe("free");
    const older = storeRowAsSubscription(row({ purchased_at: "2026-10-20T00:00:00Z", refunded_at: "2026-09-01T00:00:00Z" }), now)!;
    expect(older.status).toBe("active");
  });

  it("the higher plan wins across Stripe and the stores, and says where it comes from", () => {
    const store = { ...storeRowAsSubscription(row({ plan: "pro" }), now)!, source: "app_store" };
    const web = { plan: "plus" as const, status: "active" as const, current_period_end: future, source: "stripe" };
    expect(entitlementFromSubscriptions([web, store], now)).toMatchObject({ plan: "pro", from: { source: "app_store" } });
  });
});
