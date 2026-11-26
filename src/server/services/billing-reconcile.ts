import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type Stripe from "stripe";
import { getServiceSupabase } from "@/lib/supabase/server";
import { isRevenueCatConfigured, isStripeConfigured, serverEnv } from "@/server/env";
import { logError, logInfo } from "@/server/log";
import { getStripe, handleStripeEvent, recomputeEntitlement, syncSubscription } from "@/server/services/billing";
import { syncStoreSubscriber } from "@/server/services/store-billing";

/**
 * Periodic reconciliation (every ~30 minutes, `Authorization: Bearer $CRON_SECRET`). It repairs whatever a lost or
 * permanently failed webhook left behind, through the same claims and compare-and-set writes as the webhooks:
 *
 *   1. Stripe's event log, from where the last complete run got to (up to Stripe's 30-day retention), oldest first:
 *      lost refunds, disputes, subscription changes. Events already processed are skipped in one query.
 *   2. Admin grants that have ended: the member's own subscriptions take over again (O-08).
 *   3. App Store / Google Play members: expiring or just expired, plus a rotation through every current subscriber,
 *      least recently read from RevenueCat first (chosen in SQL).
 *   4. Open Stripe subscriptions read longest ago.
 *   5. Stripe subscriptions created since then that were never stored (a lost checkout and creation webhook).
 *   6. Members paying twice (Stripe and a store at once) are counted for the owner to review.
 *
 * Each section has a time budget and its own error handling: a slow or failing section doesn't stop the others, and
 * the report says which sections didn't finish.
 */
export interface ReconcileReport {
  stripe: { checked: number; failed: number; skipped: boolean };
  /** Stripe events re-run through the webhook handler: lost or failed ones are applied, processed ones skipped. */
  stripeEvents: { listed: number; alreadyProcessed: number; applied: number; failed: number; skipped: boolean; complete: boolean; since: string | null };
  /** Stripe subscriptions that never reached the database (lost creation webhooks), stored now. */
  missingSubscriptions: { checked: number; stored: number; failed: number };
  store: { checked: number; failed: number; skipped: boolean };
  /** Admin grants that ended: the member's own subscriptions take over again (O-08). */
  endedGrants: { checked: number; failed: number };
  /** Members with an open Stripe subscription and a current store subscription at once (billed twice). */
  duplicatePaidSources: number;
  webhookEvents: { stripeFailed: number; stripeStuck: number; revenueCatFailed: number; revenueCatStuck: number };
  /** Sections that ran out of time or failed; the next run carries on. */
  incomplete: string[];
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
const DAY = 24 * 3600_000;
/** Always look at least this far back (events processed late or retried), and never further than Stripe keeps them. */
const MIN_LOOKBACK_MS = 3 * DAY;
const MAX_LOOKBACK_MS = 30 * DAY;
/** Replay works through the log in windows of this length, oldest first. */
const WINDOW_MS = 6 * 3600_000;
/** Most events handled from one window (a window busier than this is reported for the owner). */
const MAX_EVENTS_PER_WINDOW = 5000;
/** Default time budget for one run (the route allows 300 s). */
const DEFAULT_BUDGET_MS = 240_000;

/** Constant-time check of a scheduled job's `Authorization` header. False when CRON_SECRET isn't set. */
export function cronAuthorized(header: string | null): boolean {
  const secret = serverEnv.cronSecret;
  if (!secret || secret.length < 16 || !header) return false;
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

/** Where Stripe's event replay starts: the last complete run, but at least 3 and at most 30 days back. */
export function replaySince(now: Date, through: Date | null): Date {
  const minStart = now.getTime() - MAX_LOOKBACK_MS;
  const latestStart = now.getTime() - MIN_LOOKBACK_MS;
  const from = through ? Math.min(through.getTime(), latestStart) : latestStart;
  return new Date(Math.max(minStart, from));
}

export async function reconcileBilling(options: { limit?: number; now?: Date; budgetMs?: number } = {}): Promise<ReconcileReport> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  const now = options.now ?? new Date();
  const deadline = Date.now() + (options.budgetMs ?? DEFAULT_BUDGET_MS);
  const timeLeft = () => Date.now() < deadline;
  const admin = getServiceSupabase();
  const report: ReconcileReport = {
    stripe: { checked: 0, failed: 0, skipped: !isStripeConfigured() },
    stripeEvents: { listed: 0, alreadyProcessed: 0, applied: 0, failed: 0, skipped: !isStripeConfigured(), complete: false, since: null },
    missingSubscriptions: { checked: 0, stored: 0, failed: 0 },
    store: { checked: 0, failed: 0, skipped: !isRevenueCatConfigured() },
    endedGrants: { checked: 0, failed: 0 },
    duplicatePaidSources: 0,
    webhookEvents: { stripeFailed: 0, stripeStuck: 0, revenueCatFailed: 0, revenueCatStuck: 0 },
    incomplete: [],
  };
  const section = async (name: string, work: () => Promise<void>) => {
    if (!timeLeft()) {
      report.incomplete.push(`${name}:time`);
      return;
    }
    try {
      await work();
    } catch (err) {
      report.incomplete.push(`${name}:error`);
      logError(`billing.reconcile.${name}`, err);
    }
  };

  // 1. Stripe's event log.
  let since: Date | null = null;
  if (!report.stripeEvents.skipped) {
    await section("stripe_events", async () => {
      const stripe = getStripe();
      const { data: state, error: stateErr } = await admin.from("billing_reconcile_state").select("stripe_events_through").eq("id", 1).maybeSingle();
      if (stateErr) throw stateErr;
      since = replaySince(now, state?.stripe_events_through ? new Date(state.stripe_events_through as string) : null);
      report.stripeEvents.since = since.toISOString();
      const savedThrough = state?.stripe_events_through ? new Date(state.stripe_events_through as string).getTime() : 0;
      // Windows of 6 hours, oldest first: a backlog bigger than one run is worked through over several runs in date
      // order, and the starting point only moves past a window once every event in it has been handled.
      let complete = true;
      for (let a = since.getTime(); a < now.getTime(); a += WINDOW_MS) {
        const b = Math.min(a + WINDOW_MS, now.getTime());
        if (!timeLeft()) {
          complete = false;
          break;
        }
        const collected: Stripe.Event[] = [];
        let truncated = false;
        for await (const event of stripe.events.list({ created: { gte: Math.floor(a / 1000), lt: Math.ceil(b / 1000) }, types: [...REPLAYED_STRIPE_EVENTS], limit: 100 })) {
          if (collected.length >= MAX_EVENTS_PER_WINDOW) {
            truncated = true;
            break;
          }
          collected.push(event);
        }
        report.stripeEvents.listed += collected.length;
        const events = collected.reverse(); // Stripe lists newest first; handle them in the order they happened
        const processed = new Set<string>();
        for (let i = 0; i < events.length; i += 200) {
          const { data, error } = await admin.from("stripe_events").select("id").in("id", events.slice(i, i + 200).map((e) => e.id)).eq("status", "processed");
          if (error) throw error;
          for (const r of data ?? []) processed.add(r.id as string);
        }
        let windowDone = !truncated;
        for (const event of events) {
          if (processed.has(event.id)) {
            report.stripeEvents.alreadyProcessed++;
            continue;
          }
          if (!timeLeft()) {
            windowDone = false;
            break;
          }
          try {
            if ((await handleStripeEvent(event)) === "processed") report.stripeEvents.applied++;
          } catch (err) {
            windowDone = false;
            report.stripeEvents.failed++;
            logError("billing.reconcile.stripe_event", err, { type: event.type });
          }
        }
        if (truncated) logError("billing.reconcile.backlog", new Error("More Stripe events in one window than a run handles"), { listed: collected.length });
        if (!windowDone) {
          complete = false;
          break;
        }
        if (b > savedThrough) {
          const { error } = await admin.from("billing_reconcile_state").upsert({ id: 1, stripe_events_through: new Date(b).toISOString(), updated_at: new Date().toISOString() });
          if (error) throw error;
        }
      }
      report.stripeEvents.complete = complete;
    });
  }

  // 2. Admin grants that have ended, oldest first (no lower bound: grants that ended while reconciliation wasn't
  //    running are caught too; an ended grant row is always overwritten, so the set drains).
  await section("ended_grants", async () => {
    const { data, error } = await admin
      .from("user_entitlements")
      .select("user_id")
      .eq("source", "admin")
      .not("valid_until", "is", null)
      .lte("valid_until", now.toISOString())
      .order("valid_until", { ascending: true })
      .limit(limit);
    if (error) throw error;
    for (const row of data ?? []) {
      if (!timeLeft()) throw new Error("time");
      report.endedGrants.checked++;
      try {
        await recomputeEntitlement(row.user_id as string);
      } catch (err) {
        report.endedGrants.failed++;
        logError("billing.reconcile.ended_grant", err);
      }
    }
  });

  // 3. App Store / Google Play.
  if (!report.store.skipped) {
    await section("store", async () => {
      const soon = new Date(now.getTime() + DAY).toISOString();
      const recent = new Date(now.getTime() - 3 * DAY).toISOString();
      const issueWindow = new Date(now.getTime() - 30 * DAY).toISOString();
      const { data, error } = await admin
        .from("store_subscriptions")
        .select("user_id, updated_at")
        .or(`and(expires_at.gte.${recent},expires_at.lte.${soon}),and(billing_issue_detected_at.not.is.null,expires_at.gte.${issueWindow})`)
        .order("updated_at", { ascending: true })
        .limit(limit * 3);
      if (error) throw error;
      const { data: rotation, error: rotErr } = await admin.rpc("store_reconcile_candidates", { p_limit: Math.ceil(limit / 2), p_now: now.toISOString() });
      if (rotErr) throw rotErr;
      const users = [
        ...new Set([...(data ?? []).map((r) => r.user_id as string).slice(0, limit), ...((rotation ?? []) as { user_id: string }[]).map((r) => r.user_id)]),
      ];
      for (const userId of users) {
        if (!timeLeft()) throw new Error("time");
        report.store.checked++;
        try {
          await syncStoreSubscriber(userId);
        } catch (err) {
          report.store.failed++;
          logError("billing.reconcile.store", err);
        }
      }
    });
  }

  // 4. Open Stripe subscriptions read longest ago.
  if (!report.stripe.skipped) {
    await section("stripe", async () => {
      const { data, error } = await admin.from("subscriptions").select("stripe_subscription_id").in("status", OPEN).order("synced_at", { ascending: true, nullsFirst: true }).limit(limit);
      if (error) throw error;
      const stripe = getStripe();
      for (const row of data ?? []) {
        if (!timeLeft()) throw new Error("time");
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
    });

    // 5. Subscriptions Stripe created in the window that the database never heard of.
    await section("missing_subscriptions", async () => {
      const from = since ?? replaySince(now, null);
      const stripe = getStripe();
      const found: Stripe.Subscription[] = [];
      for await (const sub of stripe.subscriptions.list({ created: { gte: Math.floor(from.getTime() / 1000) }, status: "all", limit: 100 })) {
        if (found.length >= limit * 10 || !timeLeft()) break;
        found.push(sub);
      }
      report.missingSubscriptions.checked = found.length;
      for (let i = 0; i < found.length; i += 200) {
        const chunk = found.slice(i, i + 200);
        const { data, error } = await admin.from("subscriptions").select("stripe_subscription_id").in("stripe_subscription_id", chunk.map((s) => s.id));
        if (error) throw error;
        const known = new Set((data ?? []).map((r) => r.stripe_subscription_id as string));
        for (const sub of chunk) {
          if (known.has(sub.id)) continue;
          if (!timeLeft()) throw new Error("time");
          try {
            await syncSubscription(sub, new Date());
            report.missingSubscriptions.stored++;
          } catch (err) {
            report.missingSubscriptions.failed++;
            logError("billing.reconcile.missing_subscription", err);
          }
        }
      }
    });
  }

  // 6. Members billed twice (an open Stripe subscription and a current store subscription): counted, not changed.
  await section("duplicates", async () => {
    const { data: web, error: webErr } = await admin.from("subscriptions").select("user_id").in("status", ["active", "trialing", "past_due"]).limit(5000);
    if (webErr) throw webErr;
    const webUsers = [...new Set((web ?? []).map((r) => r.user_id as string))];
    let count = 0;
    for (let i = 0; i < webUsers.length; i += 200) {
      const { data, error } = await admin
        .from("store_subscriptions")
        .select("user_id")
        .in("user_id", webUsers.slice(i, i + 200))
        .is("refunded_at", null)
        .gte("expires_at", now.toISOString());
      if (error) throw error;
      count += new Set((data ?? []).map((r) => r.user_id as string)).size;
    }
    report.duplicatePaidSources = count;
    if (count > 0) logError("billing.reconcile.duplicate_paid_sources", new Error("Members paying through Stripe and a store at once"), { count });
  });

  await section("webhook_events", async () => {
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
  });

  logInfo("billing.reconcile", {
    stripeChecked: report.stripe.checked,
    stripeFailed: report.stripe.failed,
    stripeEventsApplied: report.stripeEvents.applied,
    stripeEventsFailed: report.stripeEvents.failed,
    stripeEventsComplete: report.stripeEvents.complete,
    missingSubscriptionsStored: report.missingSubscriptions.stored,
    storeChecked: report.store.checked,
    storeFailed: report.store.failed,
    endedGrants: report.endedGrants.checked,
    duplicatePaidSources: report.duplicatePaidSources,
    incomplete: report.incomplete.join(","),
  });
  return report;
}
