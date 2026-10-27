import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/server";
import {
  affectedAppUserIds,
  revenueCatSubscriberSchema,
  storeRowsFromSubscriber,
  type PaidPlan,
  type RevenueCatSubscriber,
  type RevenueCatWebhook,
} from "@/lib/billing/revenuecat";
import type { StoreProductIds } from "@/lib/billing/paywall";
import type { Plan } from "@/lib/domain/types";
import { isPrivacyPolicyReady } from "@/app/legal/privacy/policy-config";
import { isTermsReady } from "@/app/legal/terms/terms-config";
import { serverEnv } from "@/server/env";
import { logError } from "@/server/log";
import { recomputeEntitlement } from "@/server/services/billing";

/**
 * App Store / Google Play subscriptions through RevenueCat. Purchases happen in the native app; this server never
 * trusts the app or the webhook body about what someone owns. It always asks RevenueCat's REST API for the
 * customer's current state and stores that, then recomputes the plan with the same code as Stripe.
 */

export class RevenueCatError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "RevenueCatError";
  }
}

/** Constant-time check of the webhook's Authorization header against the configured value. */
export function webhookAuthorized(header: string | null): boolean {
  const expected = serverEnv.revenueCatWebhookAuth;
  if (!expected || !header) return false;
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** The customer as RevenueCat sees them now. RevenueCat creates customers on lookup, so only pass real user ids. */
export async function fetchRevenueCatSubscriber(appUserId: string): Promise<RevenueCatSubscriber> {
  if (!serverEnv.revenueCatSecretKey) throw new RevenueCatError("RevenueCat is not configured");
  const res = await fetch(`${serverEnv.revenueCatApiBaseUrl}/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${serverEnv.revenueCatSecretKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new RevenueCatError(`RevenueCat responded ${res.status}`, res.status);
  const parsed = revenueCatSubscriberSchema.safeParse(await res.json());
  if (!parsed.success) throw new RevenueCatError("Unexpected RevenueCat response");
  return parsed.data;
}

/** Remove the customer's record from RevenueCat after account deletion. It doesn't cancel a store subscription. */
export async function deleteRevenueCatCustomer(appUserId: string): Promise<void> {
  if (!serverEnv.revenueCatSecretKey) return;
  const res = await fetch(`${serverEnv.revenueCatApiBaseUrl}/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${serverEnv.revenueCatSecretKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok && res.status !== 404) throw new RevenueCatError(`RevenueCat responded ${res.status}`, res.status);
}

/**
 * Refresh one member's store subscriptions from RevenueCat and recompute their plan. Products no longer on the
 * customer (e.g. moved to another account by a restore) are removed, so they stop granting access here.
 * Returns null when the id isn't one of our members.
 */
export async function syncStoreSubscriber(userId: string): Promise<Plan | null> {
  const admin = getServiceSupabase();
  const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!profile) return null;
  const subscriber = await fetchRevenueCatSubscriber(userId);
  const { data: existing, error: readErr } = await admin.from("store_subscriptions").select("id, store, product_id, plan").eq("user_id", userId);
  if (readErr) throw readErr;
  const previousPlans = new Map((existing ?? []).filter((r) => r.plan).map((r) => [r.product_id as string, r.plan as PaidPlan]));
  const rows = storeRowsFromSubscriber(
    subscriber,
    { plus: serverEnv.revenueCatEntitlementPlus, pro: serverEnv.revenueCatEntitlementPro },
    previousPlans,
    { allowTestStore: serverEnv.revenueCatAllowTestStore },
  );
  if (rows.length) {
    const { error } = await admin.from("store_subscriptions").upsert(
      rows.map((r) => ({ ...r, user_id: userId })),
      { onConflict: "user_id,store,product_id" },
    );
    if (error) throw error;
  }
  const keep = new Set(rows.map((r) => `${r.store}:${r.product_id}`));
  const stale = (existing ?? []).filter((r) => !keep.has(`${r.store}:${r.product_id}`)).map((r) => r.id as string);
  if (stale.length) {
    const { error } = await admin.from("store_subscriptions").delete().in("id", stale);
    if (error) throw error;
  }
  return recomputeEntitlement(userId);
}

/**
 * Process a verified RevenueCat webhook once. Every event type (purchase, renewal, product change, cancellation,
 * uncancellation, billing issue, expiration, refund, transfer, …) is handled the same way: re-read the affected
 * members from RevenueCat. Returns false for a duplicate delivery.
 */
export async function handleRevenueCatEvent(body: RevenueCatWebhook): Promise<boolean> {
  const { event } = body;
  const admin = getServiceSupabase();
  const { error: dupErr } = await admin.from("revenuecat_events").insert({ id: event.id, type: event.type, environment: event.environment ?? null });
  if (dupErr) {
    if (dupErr.code === "23505") return false;
    throw dupErr;
  }
  try {
    if (event.type !== "TEST") {
      for (const userId of affectedAppUserIds(event)) await syncStoreSubscriber(userId);
    }
  } catch (err) {
    // Let RevenueCat retry: forget that we saw this event.
    await admin.from("revenuecat_events").delete().eq("id", event.id);
    logError("revenuecat.event", err, { type: event.type });
    throw err;
  }
  return true;
}

function ids(name: string, fallback: string): string[] {
  const raw = process.env[name];
  return (raw && raw.trim() ? raw : fallback).split(",").map((v) => v.trim()).filter(Boolean);
}

/**
 * Store product identifiers per plan and interval (set them to match App Store Connect / Play Console). Plus is a
 * legacy web plan that was never sold in the stores, so it has no store products unless configured.
 */
export function storeProductIds(): StoreProductIds {
  return {
    plus: { month: ids("REVENUECAT_PRODUCTS_PLUS_MONTHLY", ""), year: ids("REVENUECAT_PRODUCTS_PLUS_YEARLY", "") },
    pro: { month: ids("REVENUECAT_PRODUCTS_PRO_MONTHLY", "ngf_pro_monthly"), year: ids("REVENUECAT_PRODUCTS_PRO_YEARLY", "ngf_pro_yearly") },
  };
}

/** The public RevenueCat SDK key for a native platform, or "" when in-app purchases aren't set up for it. */
export function storePublicKey(platform: "ios" | "android"): string {
  if (!serverEnv.revenueCatSecretKey) return "";
  return platform === "ios" ? serverEnv.revenueCatPublicKeyIos : serverEnv.revenueCatPublicKeyAndroid;
}

/** Terms and Privacy links for the paywall; `final` once both documents are complete and reviewed (see their configs). */
export function legalLinks(): { termsUrl: string; privacyUrl: string; final: boolean } {
  return { termsUrl: "/legal/terms", privacyUrl: "/legal/privacy", final: isTermsReady() && isPrivacyPolicyReady() };
}
