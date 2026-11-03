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
import { serverEnv } from "@/server/env";
import { logInfo } from "@/server/log";
import { recomputeEntitlement } from "@/server/services/billing";
import { sandboxPurchasesAllowed } from "@/server/services/sandbox-testers";
import { claimWebhookEvent, processClaimedEvent, type WebhookOutcome } from "@/server/services/webhook-events";

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
 * Refresh one member's store subscriptions from RevenueCat and recompute their plan. The whole snapshot replaces
 * the member's store rows in one transaction (`apply_store_snapshot`), ordered by when RevenueCat was read, so
 * products no longer on the customer (e.g. moved to another account by a restore) stop granting access here and two
 * overlapping syncs can't leave an older picture behind. Returns null when the id isn't one of our members.
 */
export async function syncStoreSubscriber(userId: string): Promise<Plan | null> {
  const admin = getServiceSupabase();
  const { data: profile, error: profErr } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (profErr) throw profErr;
  if (!profile) return null;
  const fetchedAt = new Date();
  const subscriber = await fetchRevenueCatSubscriber(userId);
  const { data: existing, error: readErr } = await admin.from("store_subscriptions").select("product_id, plan").eq("user_id", userId);
  if (readErr) throw readErr;
  const previousPlans = new Map((existing ?? []).filter((r) => r.plan).map((r) => [r.product_id as string, r.plan as PaidPlan]));
  const rows = storeRowsFromSubscriber(
    subscriber,
    { plus: serverEnv.revenueCatEntitlementPlus, pro: serverEnv.revenueCatEntitlementPro },
    previousPlans,
    // Sandbox (free) purchases count only for allow-listed testers, by user id (or everywhere on a test deployment).
    { allowTestStore: serverEnv.revenueCatAllowTestStore, allowSandbox: await sandboxPurchasesAllowed(userId) },
  );
  const { data: result, error } = await admin.rpc("apply_store_snapshot", { p_user_id: userId, p_fetched_at: fetchedAt.toISOString(), p_rows: rows });
  if (error) throw error;
  if (result === "stale") logInfo("revenuecat.sync_stale", {});
  return recomputeEntitlement(userId);
}

/**
 * Process a verified RevenueCat webhook once. Every event type (purchase, renewal, product change, cancellation,
 * uncancellation, billing issue, expiration, refund, transfer, …) is handled the same way: re-read the affected
 * members from RevenueCat, never trusting the event body about what anyone owns. "duplicate" for an event already
 * processed, "busy" while another delivery of it is being processed; a failure is recorded and rethrown.
 */
export async function handleRevenueCatEvent(body: RevenueCatWebhook): Promise<WebhookOutcome> {
  const { event } = body;
  const claim = await claimWebhookEvent("revenuecat", event.id, event.type, event.environment ?? null);
  if (claim !== "claimed") return claim;
  await processClaimedEvent("revenuecat", event.id, async () => {
    if (event.type === "TEST") return;
    for (const userId of affectedAppUserIds(event)) await syncStoreSubscriber(userId);
  });
  return "processed";
}

function ids(name: string, fallback: string): string[] {
  const raw = process.env[name];
  return (raw && raw.trim() ? raw : fallback).split(",").map((v) => v.trim()).filter(Boolean);
}

/** Store product identifiers per plan and interval (set them to match App Store Connect / Play Console). */
export function storeProductIds(): StoreProductIds {
  return {
    plus: { month: ids("REVENUECAT_PRODUCTS_PLUS_MONTHLY", "ngf_plus_monthly"), year: ids("REVENUECAT_PRODUCTS_PLUS_YEARLY", "ngf_plus_yearly") },
    // App Store product ids, and Google Play's subscription:base-plan ids for the subscription `ngf_pro`.
    pro: { month: ids("REVENUECAT_PRODUCTS_PRO_MONTHLY", "ngf_pro_monthly,ngf_pro:monthly"), year: ids("REVENUECAT_PRODUCTS_PRO_YEARLY", "ngf_pro_yearly,ngf_pro:yearly") },
  };
}

/** The public RevenueCat SDK key for a native platform, or "" when in-app purchases aren't set up for it. */
export function storePublicKey(platform: "ios" | "android"): string {
  if (!serverEnv.revenueCatSecretKey) return "";
  return platform === "ios" ? serverEnv.revenueCatPublicKeyIos : serverEnv.revenueCatPublicKeyAndroid;
}

/**
 * Terms and Privacy links. Final documents are linked once their URLs are configured (LEGAL_TERMS_URL /
 * LEGAL_PRIVACY_URL, after legal review); until then the in-app drafts, which say they are drafts.
 */
export function legalLinks(): { termsUrl: string; privacyUrl: string; final: boolean } {
  const terms = process.env.LEGAL_TERMS_URL ?? "";
  const privacy = process.env.LEGAL_PRIVACY_URL ?? "";
  if (terms && privacy) return { termsUrl: terms, privacyUrl: privacy, final: true };
  return { termsUrl: "/legal/terms", privacyUrl: "/legal/privacy", final: false };
}
