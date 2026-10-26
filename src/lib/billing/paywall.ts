import { planRank } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";

/** Pure helpers for the in-app (App Store / Google Play) paywall. No plugin imports, so they're unit-testable. */

export type PaidPlan = Exclude<Plan, "free">;
export type Interval = "month" | "year";

/**
 * Store product identifiers for each plan and interval (iOS and Android ids can both be listed). Only Pro All
 * Access is sold; the Plus ids are kept so an existing Plus store subscription is still recognised.
 */
export type StoreProductIds = Record<PaidPlan, Record<Interval, string[]>>;

/** The parts of a RevenueCat package the paywall reads. */
export interface PaywallPackage {
  identifier: string;
  packageType?: string;
  product: { identifier: string; priceString: string; price?: number; title?: string; pricePerMonthString?: string | null; currencyCode?: string };
}

/** The Pro All Access packages the store offers, by billing interval. */
export type PaywallOptions = Partial<Record<Interval, PaywallPackage>>;

/** Google Play product ids look like `subscription:base-plan`; match either the full id or the subscription part. */
function matches(productId: string, ids: string[]): boolean {
  return ids.some((id) => id === productId || productId.startsWith(`${id}:`));
}

/** Pick the Pro All Access package for each interval. Plus packages are never offered to new customers. */
export function paywallOptions(packages: PaywallPackage[], ids: StoreProductIds): PaywallOptions {
  const out: PaywallOptions = {};
  for (const interval of ["month", "year"] as const) {
    const pkg = packages.find((p) => matches(p.product.identifier, ids.pro[interval]));
    if (pkg) out[interval] = pkg;
  }
  return out;
}

/** Which plan a stored store product id grants (Pro, or a legacy Plus product). */
export function planForProduct(productId: string, ids: StoreProductIds): PaidPlan | null {
  for (const plan of ["pro", "plus"] as const) if (matches(productId, [...ids[plan].month, ...ids[plan].year])) return plan;
  return null;
}

/** Whether a stored store product id renews monthly or yearly. */
export function intervalForProduct(productId: string, ids: StoreProductIds): Interval | null {
  for (const interval of ["month", "year"] as const) if (matches(productId, [...ids.pro[interval], ...ids.plus[interval]])) return interval;
  return null;
}

export type BillingSource = "default" | "admin" | "stripe" | "app_store" | "play_store";

export type PaywallAction = "elsewhere" | "current" | "switch" | "upgrade" | "buy";

/**
 * What the in-app paywall can offer for Pro All Access at `interval`:
 *   - `elsewhere`: the member pays through another channel (the website or the other store), so buying here would
 *     bill them twice; they manage it where they subscribed;
 *   - `current`: they already have Pro on this interval;
 *   - `switch`: they have Pro here on the other interval (monthly ↔ yearly; the store moves the same subscription);
 *   - `upgrade`: they have a legacy Plus subscription here;
 *   - `buy`: they're on Free.
 */
export function paywallAction(current: Plan, source: BillingSource, platform: "ios" | "android", interval: Interval, currentInterval: Interval | null): PaywallAction {
  const here = platform === "ios" ? "app_store" : "play_store";
  if (current !== "free" && (source === "stripe" || ((source === "app_store" || source === "play_store") && source !== here))) return "elsewhere";
  if (current === "free" || source === "default" || source === "admin") return planRank(current) >= planRank("pro") ? "current" : current === "free" ? "buy" : "upgrade";
  if (current === "pro") return currentInterval && currentInterval !== interval ? "switch" : "current";
  return "upgrade";
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
export function renewalTerms(platform: "ios" | "android" | "web"): string {
  if (platform === "ios")
    return "Payment is charged to your Apple Account when you confirm. Pro All Access renews automatically at the price shown, monthly or yearly as chosen, unless cancelled at least 24 hours before the end of the current period. Manage or cancel any time in your Apple Account settings (Settings › your name › Subscriptions). Deleting the app or your Narrow Gate account does not cancel it. Refunds are handled by Apple.";
  if (platform === "android")
    return "Payment is charged to your Google Play account when you confirm. Pro All Access renews automatically at the price shown, monthly or yearly as chosen, until cancelled. Manage or cancel any time in Google Play › Payments & subscriptions › Subscriptions. Deleting the app or your Narrow Gate account does not cancel it. Refunds are handled under Google Play's refund policy.";
  return "Your card is charged when you subscribe. Pro All Access renews automatically at the price shown, monthly or yearly as chosen, until you cancel. Cancel any time in Manage billing; you keep access until the end of the period you've paid for, and you won't be charged again. Payments are processed by Stripe.";
}

/** The store's own prices for the membership screen (localized strings from the App Store / Google Play). */
export function storePrices(options: PaywallOptions): { month: string | null; year: string | null; yearPerMonth: string | null; savingsPercent: number | null } {
  const m = options.month?.product;
  const y = options.year?.product;
  let savingsPercent: number | null = null;
  if (m?.price && y?.price && (!m.currencyCode || m.currencyCode === y.currencyCode)) {
    savingsPercent = Math.max(0, Math.floor((1 - y.price / (m.price * 12)) * 100)) || null;
  }
  return { month: m?.priceString ?? null, year: y?.priceString ?? null, yearPerMonth: y?.pricePerMonthString ?? null, savingsPercent };
}
