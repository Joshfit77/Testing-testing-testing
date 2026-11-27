import { describe, expect, it } from "vitest";
import { storeRowAsSubscription } from "@/lib/billing/revenuecat";
import { effectivePlanFromSubscription, entitlementFromSubscriptions, periodStartFromEnd, type SubscriptionStatus } from "@/lib/domain/plans";

/**
 * The whole entitlement matrix in one place (release evidence): every subscription state the app stores, from Stripe
 * and from the app stores (RevenueCat), and how it resolves to a plan over time. The per-feature tests
 * (plans.test.ts, revenuecat.test.ts) cover pieces; this file pins each state and each lifecycle step explicitly.
 */
const now = new Date("2026-11-12T12:00:00Z");
const day = 86_400_000;
const at = (offsetDays: number) => new Date(now.getTime() + offsetDays * day).toISOString();
const sub = (status: SubscriptionStatus, current_period_end: string | null, over: Record<string, unknown> = {}) => ({ plan: "pro" as const, status, current_period_end, ...over });

describe("entitlement resolution: every Stripe status", () => {
  it("no subscription at all is Free", () => {
    expect(effectivePlanFromSubscription(null, now)).toBe("free");
    expect(entitlementFromSubscriptions([], now)).toEqual({ plan: "free", validUntil: null, from: null });
  });

  it("active monthly and active annual both grant Pro until their own period end", () => {
    const monthly = sub("active", at(20));
    const annual = sub("active", at(300));
    expect(entitlementFromSubscriptions([monthly], now)).toMatchObject({ plan: "pro", validUntil: at(20) });
    expect(entitlementFromSubscriptions([annual], now)).toMatchObject({ plan: "pro", validUntil: at(300) });
  });

  it("trialing grants Pro until the trial's period end, then Free", () => {
    expect(effectivePlanFromSubscription(sub("trialing", at(5)), now)).toBe("pro");
    expect(effectivePlanFromSubscription(sub("trialing", at(-1)), now)).toBe("free");
  });

  it("canceled-but-paid-through (cancel at period end; Stripe keeps it active) keeps Pro until the period end, then Free", () => {
    const cancelling = sub("active", at(10), { cancel_at_period_end: true });
    expect(effectivePlanFromSubscription(cancelling, now)).toBe("pro");
    expect(entitlementFromSubscriptions([cancelling], now).validUntil).toBe(at(10));
    expect(effectivePlanFromSubscription(cancelling, new Date(now.getTime() + 10 * day - 1000))).toBe("pro");
    expect(effectivePlanFromSubscription(cancelling, new Date(now.getTime() + 10 * day + 1000))).toBe("free");
  });

  it("expired (period end passed) is Free, whatever the stored status", () => {
    for (const status of ["active", "trialing", "past_due"] as const) expect(effectivePlanFromSubscription(sub(status, at(-1)), now), status).toBe("free");
    expect(effectivePlanFromSubscription(sub("canceled", at(-1)), now)).toBe("free");
  });

  it("past_due: Pro within the 14-day grace from the unpaid period's start, Free beyond it", () => {
    // The renewal was due 3 days ago; Stripe already moved the period end a month on.
    const periodEnd = new Date(now.getTime() - 3 * day);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    const pastDue = sub("past_due", periodEnd.toISOString(), { period_started_at: periodStartFromEnd(periodEnd.toISOString(), "month") });
    expect(effectivePlanFromSubscription(pastDue, now)).toBe("pro");
    expect(effectivePlanFromSubscription(pastDue, new Date(now.getTime() + 10 * day))).toBe("pro"); // day 13 of grace
    expect(effectivePlanFromSubscription(pastDue, new Date(now.getTime() + 12 * day))).toBe("free"); // day 15
  });

  it("refunded / disputed (access revoked) is Free immediately, even while Stripe still says active", () => {
    expect(effectivePlanFromSubscription(sub("active", at(20), { access_revoked_at: at(-0.01) }), now)).toBe("free");
    expect(entitlementFromSubscriptions([sub("active", at(20), { access_revoked_at: at(-0.01) })], now).plan).toBe("free");
  });

  it("paused, unpaid, incomplete, incomplete_expired and canceled grant nothing, even with a period end ahead", () => {
    for (const status of ["paused", "unpaid", "incomplete", "incomplete_expired", "canceled"] as const) {
      expect(effectivePlanFromSubscription(sub(status, at(20)), now), status).toBe("free");
    }
  });
});

describe("subscription lifecycle over time", () => {
  it("a renewal moves the entitlement's end to the new period end", () => {
    const before = sub("active", at(1));
    const renewed = sub("active", at(31));
    expect(entitlementFromSubscriptions([before], now).validUntil).toBe(at(1));
    expect(entitlementFromSubscriptions([renewed], now).validUntil).toBe(at(31));
    // Without the renewal Pro would have ended; with it Pro continues past the old end.
    const afterOldEnd = new Date(now.getTime() + 2 * day);
    expect(effectivePlanFromSubscription(before, afterOldEnd)).toBe("free");
    expect(effectivePlanFromSubscription(renewed, afterOldEnd)).toBe("pro");
  });

  it("an App Store / Google Play renewal (new expiry) moves the period end too", () => {
    const row = { plan: "pro" as const, purchased_at: at(-29), expires_at: at(1), grace_period_expires_at: null, unsubscribe_detected_at: null, billing_issue_detected_at: null, refunded_at: null };
    expect(storeRowAsSubscription(row, now)).toMatchObject({ status: "active", current_period_end: at(1) });
    const renewed = storeRowAsSubscription({ ...row, purchased_at: at(1), expires_at: at(31) }, now)!;
    expect(renewed).toMatchObject({ status: "active", current_period_end: at(31) });
    expect(entitlementFromSubscriptions([renewed], now).validUntil).toBe(at(31));
  });

  it("store: auto-renew off keeps Pro to the period end; expiry ends it; billing issue past the store's grace ends it", () => {
    const base = { plan: "pro" as const, purchased_at: at(-20), expires_at: at(10), grace_period_expires_at: null, unsubscribe_detected_at: at(-1), billing_issue_detected_at: null, refunded_at: null };
    const cancelled = storeRowAsSubscription(base, now)!;
    expect(cancelled).toMatchObject({ status: "active", cancel_at_period_end: true });
    expect(entitlementFromSubscriptions([cancelled], now).plan).toBe("pro");
    expect(entitlementFromSubscriptions([storeRowAsSubscription(base, new Date(now.getTime() + 11 * day))!], new Date(now.getTime() + 11 * day)).plan).toBe("free");
    const graceOver = storeRowAsSubscription({ ...base, expires_at: at(-5), grace_period_expires_at: at(-1), billing_issue_detected_at: at(-5) }, now)!;
    expect(graceOver.status).toBe("canceled");
    expect(entitlementFromSubscriptions([graceOver], now).plan).toBe("free");
  });

  it("store: a refund of the current purchase revokes at once, even with the period end ahead", () => {
    const refunded = storeRowAsSubscription(
      { plan: "pro", purchased_at: at(-2), expires_at: at(28), grace_period_expires_at: null, unsubscribe_detected_at: null, billing_issue_detected_at: null, refunded_at: at(-0.5) },
      now,
    )!;
    expect(refunded.status).toBe("canceled");
    expect(entitlementFromSubscriptions([refunded], now).plan).toBe("free");
  });
});
