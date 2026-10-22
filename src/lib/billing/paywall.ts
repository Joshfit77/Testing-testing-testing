import { planRank } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";

/** Pure helpers for the in-app (App Store / Google Play) paywall. No plugin imports, so they're unit-testable. */

export type PaidPlan = Exclude<Plan, "free">;
export type Interval = "month" | "year";

/** Store product identifiers for each plan and interval (iOS and Android ids can both be listed). */
export type StoreProductIds = Record<PaidPlan, Record<Interval, string[]>>;

/** The parts of a RevenueCat package the paywall reads. */
export interface PaywallPackage {
  identifier: string;
  packageType?: string;
  product: { identifier: string; priceString: string; title?: string };
}

export type PaywallOptions = Record<PaidPlan, Partial<Record<Interval, PaywallPackage>>>;

/** Google Play product ids look like `subscription:base-plan`; match either the full id or the subscription part. */
function matches(productId: string, ids: string[]): boolean {
  return ids.some((id) => id === productId || productId.startsWith(`${id}:`));
}

/** Pick the package for each plan and interval. Yearly packages are dropped unless yearly billing is switched on. */
export function paywallOptions(packages: PaywallPackage[], ids: StoreProductIds, yearly: Record<PaidPlan, boolean>): PaywallOptions {
  const out: PaywallOptions = { plus: {}, pro: {} };
  for (const plan of ["plus", "pro"] as const) {
    for (const interval of ["month", "year"] as const) {
      if (interval === "year" && !yearly[plan]) continue;
      const pkg = packages.find((p) => matches(p.product.identifier, ids[plan][interval]));
      if (pkg) out[plan][interval] = pkg;
    }
  }
  return out;
}

/** Which store product a stored product id is (for Android upgrades, which must name the old product). */
export function planForProduct(productId: string, ids: StoreProductIds): PaidPlan | null {
  for (const plan of ["pro", "plus"] as const) if (matches(productId, [...ids[plan].month, ...ids[plan].year])) return plan;
  return null;
}

export type BillingSource = "default" | "admin" | "stripe" | "app_store" | "play_store";

/**
 * What the paywall can offer for `target`:
 *   - `elsewhere`: the member pays through another channel (the website or the other store), so buying here would
 *     double-bill them; they manage it where they subscribed;
 *   - `current` / `included`: they already have this plan or a higher one;
 *   - `upgrade` / `buy`: offer the purchase.
 */
export function paywallAction(
  current: Plan,
  source: BillingSource,
  platform: "ios" | "android",
  target: PaidPlan,
): "elsewhere" | "current" | "included" | "upgrade" | "buy" {
  const here = platform === "ios" ? "app_store" : "play_store";
  if (current !== "free" && (source === "stripe" || ((source === "app_store" || source === "play_store") && source !== here))) return "elsewhere";
  if (current === target) return "current";
  if (planRank(current) > planRank(target)) return "included";
  return current === "free" ? "buy" : "upgrade";
}

/** RevenueCat error codes (PURCHASES_ERROR_CODE) the paywall explains. */
const CANCELLED = "1";
const MESSAGES: Record<string, string> = {
  "2": "The App Store had a problem completing the purchase. You haven't been charged. Please try again.",
  "3": "Purchases aren't allowed on this device (check Screen Time or Family Sharing settings).",
  "6": "You already own this subscription. Tap “Restore purchases” to unlock it.",
  "7": "This purchase belongs to another Narrow Gate account. Sign in to that account and tap “Restore purchases”.",
  "10": "No connection. Check your internet and try again.",
  "20": "Your purchase is waiting for approval (for example, Ask to Buy). Your plan updates once it's approved.",
};

/** A friendly message for a failed purchase, or null when the person simply cancelled. */
export function purchaseErrorMessage(err: unknown): string | null {
  const e = (err ?? {}) as { code?: string | number; userCancelled?: boolean | null };
  const code = e.code === undefined ? "" : String(e.code);
  if (code === CANCELLED || e.userCancelled) return null;
  return MESSAGES[code] ?? "The purchase didn't go through. You haven't been charged. Please try again.";
}

/** The renewal and cancellation terms Apple and Google expect next to a subscription offer. */
export function renewalTerms(platform: "ios" | "android"): string {
  return platform === "ios"
    ? "Payment is charged to your Apple Account when you confirm. Subscriptions renew automatically at the price shown unless cancelled at least 24 hours before the end of the current period. Manage or cancel any time in your Apple Account settings."
    : "Payment is charged to your Google Play account when you confirm. Subscriptions renew automatically at the price shown until cancelled. Manage or cancel any time in Google Play › Subscriptions.";
}
