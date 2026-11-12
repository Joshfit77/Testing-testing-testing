import { z } from "zod";
import type { Plan } from "@/lib/domain/types";
import type { SubscriptionStatus } from "@/lib/domain/plans";

/**
 * RevenueCat (App Store / Google Play) data shapes and the pure mapping from a RevenueCat customer to stored
 * subscription rows. Server code fetches the customer (`GET /v1/subscribers/{id}`) after every webhook rather than
 * trusting the webhook payload, as RevenueCat recommends, so out-of-order or retried events can't leave stale state.
 */

export type PaidPlan = Exclude<Plan, "free">;
export type StoreName = "app_store" | "play_store" | "test_store" | "other";

const isoDate = z.string().datetime({ offset: true }).nullable().optional();

/** Webhook body: `{ api_version, event: { id, type, app_user_id, ... } }`. Unknown fields are ignored. */
export const revenueCatWebhookSchema = z.object({
  api_version: z.string().optional(),
  event: z.object({
    id: z.string().min(1).max(200),
    type: z.string().min(1).max(60),
    app_user_id: z.string().max(200).nullable().optional(),
    original_app_user_id: z.string().max(200).nullable().optional(),
    aliases: z.array(z.string().max(200)).max(100).nullable().optional(),
    transferred_from: z.array(z.string().max(200)).max(100).nullable().optional(),
    transferred_to: z.array(z.string().max(200)).max(100).nullable().optional(),
    environment: z.string().max(20).nullable().optional(),
  }),
});
export type RevenueCatWebhook = z.infer<typeof revenueCatWebhookSchema>;

const subscriptionSchema = z.object({
  expires_date: isoDate,
  purchase_date: isoDate,
  original_purchase_date: isoDate,
  period_type: z.string().nullable().optional(),
  store: z.string().nullable().optional(),
  is_sandbox: z.boolean().nullable().optional(),
  unsubscribe_detected_at: isoDate,
  billing_issues_detected_at: isoDate,
  grace_period_expires_date: isoDate,
  refunded_at: isoDate,
  ownership_type: z.string().nullable().optional(),
  store_transaction_id: z.string().nullable().optional(),
});

const entitlementSchema = z.object({
  expires_date: isoDate,
  grace_period_expires_date: isoDate,
  product_identifier: z.string(),
  purchase_date: isoDate,
});

/** `GET /v1/subscribers/{app_user_id}` response (the parts we use). */
export const revenueCatSubscriberSchema = z.object({
  subscriber: z.object({
    entitlements: z.record(z.string(), entitlementSchema).default({}),
    subscriptions: z.record(z.string(), subscriptionSchema).default({}),
    management_url: z.string().nullable().optional(),
  }),
});
export type RevenueCatSubscriber = z.infer<typeof revenueCatSubscriberSchema>;

/** RevenueCat entitlement identifiers that grant each plan (configured in the RevenueCat dashboard). */
export interface EntitlementIds {
  plus: string;
  pro: string;
}

export interface StoreSubscriptionRow {
  store: StoreName;
  product_id: string;
  plan: PaidPlan | null;
  period_type: string | null;
  purchased_at: string | null;
  original_purchased_at: string | null;
  expires_at: string | null;
  grace_period_expires_at: string | null;
  unsubscribe_detected_at: string | null;
  billing_issue_detected_at: string | null;
  refunded_at: string | null;
  is_sandbox: boolean;
  ownership_type: string | null;
  store_transaction_id: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The app users a webhook concerns. The app always identifies people by their account id (a UUID), so anonymous
 * RevenueCat ids are skipped — looking those up would also make RevenueCat create empty customers.
 */
export function affectedAppUserIds(event: RevenueCatWebhook["event"]): string[] {
  const ids = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? []), ...(event.transferred_from ?? []), ...(event.transferred_to ?? [])];
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && UUID.test(id)).map((id) => id.toLowerCase()))];
}

export function normalizeStore(store: string | null | undefined): StoreName {
  const s = (store ?? "").toLowerCase();
  if (s === "app_store" || s === "mac_app_store") return "app_store";
  if (s === "play_store") return "play_store";
  if (s === "test_store") return "test_store";
  return "other";
}

/**
 * Rows for every store subscription in a RevenueCat customer. A product's plan comes from the entitlement it
 * currently unlocks (Pro wins); a product no longer attached to an entitlement keeps the plan stored for it before.
 */
export function storeRowsFromSubscriber(
  data: RevenueCatSubscriber,
  ids: EntitlementIds,
  previousPlans: Map<string, PaidPlan> = new Map(),
  options: { allowTestStore?: boolean; allowSandbox?: boolean } = {},
): StoreSubscriptionRow[] {
  const { entitlements, subscriptions } = data.subscriber;
  const planFor = (productId: string): PaidPlan | null => {
    if (entitlements[ids.pro]?.product_identifier === productId) return "pro";
    if (entitlements[ids.plus]?.product_identifier === productId) return "plus";
    return previousPlans.get(productId) ?? null;
  };
  const rows: StoreSubscriptionRow[] = [];
  for (const [productId, s] of Object.entries(subscriptions)) {
    const store = normalizeStore(s.store);
    // Purchases made with RevenueCat's Test Store (development builds) only count where explicitly allowed.
    if (store === "test_store" && !options.allowTestStore) continue;
    // Apple/Google sandbox purchases (TestFlight, internal testing) cost nothing and only count where explicitly allowed.
    if (s.is_sandbox && !options.allowSandbox) continue;
    // Stripe or other web purchases synced into RevenueCat are already handled by the Stripe integration.
    if (store === "other") continue;
    rows.push({
      store,
      product_id: productId.slice(0, 200),
      plan: planFor(productId),
      period_type: s.period_type?.toLowerCase().slice(0, 20) ?? null,
      purchased_at: s.purchase_date ?? null,
      original_purchased_at: s.original_purchase_date ?? null,
      expires_at: s.expires_date ?? null,
      grace_period_expires_at: s.grace_period_expires_date ?? null,
      unsubscribe_detected_at: s.unsubscribe_detected_at ?? null,
      billing_issue_detected_at: s.billing_issues_detected_at ?? null,
      refunded_at: s.refunded_at ?? null,
      is_sandbox: Boolean(s.is_sandbox),
      ownership_type: s.ownership_type?.slice(0, 30) ?? null,
      store_transaction_id: s.store_transaction_id?.slice(0, 200) ?? null,
    });
  }
  return rows;
}

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

/**
 * A stored store row as a subscription for `entitlementFromSubscriptions`:
 *   - a refund of the current purchase ends access at the refund time;
 *   - otherwise access lasts until the later of the expiry and any billing grace period (null = no expiry);
 *   - a billing problem inside that window reads as `past_due` (access continues while the store retries);
 *   - a cancellation (auto-renew off) keeps access until the period ends.
 */
export function storeRowAsSubscription(
  row: Pick<StoreSubscriptionRow, "plan" | "purchased_at" | "expires_at" | "grace_period_expires_at" | "unsubscribe_detected_at" | "billing_issue_detected_at" | "refunded_at">,
  now: Date = new Date(),
): { plan: PaidPlan; status: SubscriptionStatus; current_period_end: string | null; cancel_at_period_end: boolean } | null {
  if (!row.plan) return null;
  const refunded = ms(row.refunded_at);
  const purchased = ms(row.purchased_at);
  const refundedCurrent = refunded !== null && (purchased === null || refunded >= purchased);
  let end: number | null;
  if (refundedCurrent) {
    end = Math.min(refunded, ms(row.expires_at) ?? refunded);
  } else {
    const expires = ms(row.expires_at);
    const grace = ms(row.grace_period_expires_at);
    end = expires === null ? null : Math.max(expires, grace ?? expires);
  }
  const active = end === null || end > now.getTime();
  const status: SubscriptionStatus = !active || refundedCurrent ? "canceled" : row.billing_issue_detected_at ? "past_due" : "active";
  return {
    plan: row.plan,
    status,
    current_period_end: end === null ? null : new Date(end).toISOString(),
    cancel_at_period_end: Boolean(row.unsubscribe_detected_at),
  };
}
