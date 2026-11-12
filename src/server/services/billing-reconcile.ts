import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/server";
import { isRevenueCatConfigured, isStripeConfigured, serverEnv } from "@/server/env";
import { logError, logInfo } from "@/server/log";
import { getStripe, syncSubscription } from "@/server/services/billing";
import { syncStoreSubscriber } from "@/server/services/store-billing";

/**
 * Periodic reconciliation: re-read from the providers the subscriptions most likely to be out of date (open Stripe
 * subscriptions read longest ago; store subscriptions expiring, just expired or with a billing problem) and store
 * what the providers say now. It corrects anything a lost or permanently failed webhook left behind, through the
 * same ordered, compare-and-set writes as the webhooks. It also reports webhook events that failed or were left
 * mid-processing. Run it on a schedule (e.g. every 30 minutes) with `Authorization: Bearer $CRON_SECRET`.
 */
export interface ReconcileReport {
  stripe: { checked: number; failed: number; skipped: boolean };
  store: { checked: number; failed: number; skipped: boolean };
  webhookEvents: { stripeFailed: number; stripeStuck: number; revenueCatFailed: number; revenueCatStuck: number };
}

const OPEN = ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"];

/** Constant-time check of a scheduled job's `Authorization` header. False when CRON_SECRET isn't set. */
export function cronAuthorized(header: string | null): boolean {
  const secret = serverEnv.cronSecret;
  if (!secret || secret.length < 16 || !header) return false;
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

export async function reconcileBilling(options: { limit?: number; now?: Date } = {}): Promise<ReconcileReport> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  const now = options.now ?? new Date();
  const admin = getServiceSupabase();
  const report: ReconcileReport = {
    stripe: { checked: 0, failed: 0, skipped: !isStripeConfigured() },
    store: { checked: 0, failed: 0, skipped: !isRevenueCatConfigured() },
    webhookEvents: { stripeFailed: 0, stripeStuck: 0, revenueCatFailed: 0, revenueCatStuck: 0 },
  };

  if (!report.stripe.skipped) {
    const { data, error } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id")
      .in("status", OPEN)
      .order("synced_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (error) throw error;
    const stripe = getStripe();
    for (const row of data ?? []) {
      report.stripe.checked++;
      try {
        const fetchedAt = new Date();
        const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id as string);
        await syncSubscription(sub, fetchedAt);
      } catch (err) {
        report.stripe.failed++;
        logError("billing.reconcile.stripe", err);
      }
    }
  }

  if (!report.store.skipped) {
    const soon = new Date(now.getTime() + 24 * 3600_000).toISOString();
    const recent = new Date(now.getTime() - 3 * 24 * 3600_000).toISOString();
    const { data, error } = await admin
      .from("store_subscriptions")
      .select("user_id, updated_at")
      .or(`and(expires_at.gte.${recent},expires_at.lte.${soon}),billing_issue_detected_at.not.is.null`)
      .order("updated_at", { ascending: true })
      .limit(limit * 3);
    if (error) throw error;
    const users = [...new Set((data ?? []).map((r) => r.user_id as string))].slice(0, limit);
    for (const userId of users) {
      report.store.checked++;
      try {
        await syncStoreSubscriber(userId);
      } catch (err) {
        report.store.failed++;
        logError("billing.reconcile.store", err);
      }
    }
  }

  const iso = now.toISOString();
  const count = async (table: "stripe_events" | "revenuecat_events", filter: "failed" | "stuck") => {
    let q = admin.from(table).select("id", { count: "exact", head: true });
    q = filter === "failed" ? q.eq("status", "failed") : q.eq("status", "processing").lt("locked_until", iso);
    const { count: n, error } = await q;
    if (error) throw error;
    return n ?? 0;
  };
  report.webhookEvents = {
    stripeFailed: await count("stripe_events", "failed"),
    stripeStuck: await count("stripe_events", "stuck"),
    revenueCatFailed: await count("revenuecat_events", "failed"),
    revenueCatStuck: await count("revenuecat_events", "stuck"),
  };
  const ev = report.webhookEvents;
  if (ev.stripeFailed + ev.stripeStuck + ev.revenueCatFailed + ev.revenueCatStuck > 0) logError("billing.reconcile.events", new Error("Webhook events need attention"), { ...ev });
  logInfo("billing.reconcile", { stripeChecked: report.stripe.checked, stripeFailed: report.stripe.failed, storeChecked: report.store.checked, storeFailed: report.store.failed });
  return report;
}
