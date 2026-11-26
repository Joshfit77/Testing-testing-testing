import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/server";
import { isRevenueCatConfigured, isStripeConfigured, serverEnv } from "@/server/env";
import { logError, logInfo } from "@/server/log";
import { getStripe, handleStripeEvent, recomputeEntitlement, syncSubscription } from "@/server/services/billing";
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
  /** Recent Stripe events re-run through the webhook handler: lost or failed ones are applied, processed ones skip. */
  stripeEvents: { listed: number; applied: number; failed: number; skipped: boolean };
  store: { checked: number; failed: number; skipped: boolean };
  /** Admin grants that ended recently: the member's own subscriptions take over again (O-08). */
  endedGrants: { checked: number; failed: number };
  webhookEvents: { stripeFailed: number; stripeStuck: number; revenueCatFailed: number; revenueCatStuck: number };
}

const OPEN = ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"];
/** The Stripe event types the webhook acts on, re-read by reconciliation. */
const REPLAYED_STRIPE_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
] as const;
/** How far back reconciliation re-reads Stripe events (it runs every ~30 minutes; three days covers long outages). */
const STRIPE_EVENT_LOOKBACK_MS = 3 * 24 * 3600_000;

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
    stripeEvents: { listed: 0, applied: 0, failed: 0, skipped: !isStripeConfigured() },
    store: { checked: 0, failed: 0, skipped: !isRevenueCatConfigured() },
    endedGrants: { checked: 0, failed: 0 },
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

  // Lost or failed Stripe events (O-09): a refund, dispute or subscription change whose webhook never arrived, or failed
  // for good, is repaired from Stripe's own event log (kept 30 days). Each event goes through the same claim as the
  // webhook, so one already processed is a no-op and nothing is applied twice.
  if (!report.stripeEvents.skipped) {
    try {
      const stripe = getStripe();
      const since = Math.floor((now.getTime() - STRIPE_EVENT_LOOKBACK_MS) / 1000);
      for await (const event of stripe.events.list({ created: { gte: since }, types: [...REPLAYED_STRIPE_EVENTS], limit: 100 })) {
        if (report.stripeEvents.listed >= limit * 4) break;
        report.stripeEvents.listed++;
        try {
          if ((await handleStripeEvent(event)) === "processed") report.stripeEvents.applied++;
        } catch (err) {
          report.stripeEvents.failed++;
          logError("billing.reconcile.stripe_event", err, { type: event.type });
        }
      }
    } catch (err) {
      report.stripeEvents.failed++;
      logError("billing.reconcile.stripe_events", err);
    }
  }

  // Admin grants that ended in the last week (O-08): while a grant was live, the member's own paid subscription didn't
  // write their entitlement ("kept_admin"); once it ends nothing else recomputes it until the next billing event.
  {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();
    const { data, error } = await admin
      .from("user_entitlements")
      .select("user_id")
      .eq("source", "admin")
      .not("valid_until", "is", null)
      .lte("valid_until", now.toISOString())
      .gte("valid_until", weekAgo)
      .limit(limit);
    if (error) throw error;
    for (const row of data ?? []) {
      report.endedGrants.checked++;
      try {
        await recomputeEntitlement(row.user_id as string);
      } catch (err) {
        report.endedGrants.failed++;
        logError("billing.reconcile.ended_grant", err);
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
    // Plus a rotation through every other member with a current store subscription, least recently read first (O-09):
    // a refund or transfer whose RevenueCat webhook was lost is picked up within a few days at most.
    const { data: oldest, error: oldestErr } = await admin.from("store_sync_state").select("user_id").order("fetched_at", { ascending: true }).limit(limit * 4);
    if (oldestErr) throw oldestErr;
    const oldestIds = (oldest ?? []).map((r) => r.user_id as string);
    let rotation: string[] = [];
    if (oldestIds.length) {
      const { data: current, error: currentErr } = await admin.from("store_subscriptions").select("user_id").in("user_id", oldestIds).gte("expires_at", recent);
      if (currentErr) throw currentErr;
      const withCurrent = new Set((current ?? []).map((r) => r.user_id as string));
      rotation = oldestIds.filter((id) => withCurrent.has(id)).slice(0, Math.ceil(limit / 2));
    }
    const users = [...new Set([...(data ?? []).map((r) => r.user_id as string).slice(0, limit), ...rotation])];
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
  logInfo("billing.reconcile", {
    stripeChecked: report.stripe.checked,
    stripeFailed: report.stripe.failed,
    stripeEventsApplied: report.stripeEvents.applied,
    stripeEventsFailed: report.stripeEvents.failed,
    storeChecked: report.store.checked,
    storeFailed: report.store.failed,
    endedGrants: report.endedGrants.checked,
  });
  return report;
}
