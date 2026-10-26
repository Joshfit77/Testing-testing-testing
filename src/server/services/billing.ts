import "server-only";
import Stripe from "stripe";
import { getServiceSupabase } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { entitlementFromSubscriptions, getPlans, legacyTermsApply, planRank, type BillingInterval, type LegacyAiTerms, type SubscriptionStatus } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";
import { storeRowAsSubscription } from "@/lib/billing/revenuecat";
import { isServiceRoleConfigured, serverEnv } from "@/server/env";
import { logError, logInfo } from "@/server/log";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!serverEnv.stripeSecretKey) throw new Error("Stripe is not configured");
  if (!stripeClient) {
    // STRIPE_API_BASE_URL points the client at a local stand-in in tests; production always uses Stripe.
    const base = process.env.STRIPE_API_BASE_URL ? new URL(process.env.STRIPE_API_BASE_URL) : null;
    stripeClient = new Stripe(serverEnv.stripeSecretKey, {
      appInfo: { name: "Narrow Gate Fitness" },
      ...(base ? { host: base.hostname, port: Number(base.port), protocol: base.protocol.replace(":", "") as "http" | "https" } : {}),
    });
  }
  return stripeClient;
}

export type PaidPlan = Exclude<Plan, "free">;

/**
 * Stripe price for new checkouts. Only Pro All Access is sold; Plus prices are kept solely so existing Plus
 * subscriptions keep mapping to their plan (`planForPriceId`).
 */
export function priceIdForPlan(plan: PaidPlan, interval: BillingInterval = "month"): string {
  if (plan !== "pro") return "";
  return interval === "year" ? serverEnv.stripePriceProYearly : serverEnv.stripePricePro;
}

export interface StripePriceInfo {
  id: string;
  unitAmount: number | null;
  currency: string;
  interval: BillingInterval | null;
  active: boolean;
}

let priceCache: { at: number; prices: Partial<Record<BillingInterval, StripePriceInfo | null>> } | null = null;

/**
 * The configured Pro prices as Stripe holds them (amount, currency, interval), so the web screen shows what Stripe
 * will actually charge rather than a number typed into the code. Cached for ten minutes; null when Stripe isn't
 * configured or the price can't be read.
 */
export async function stripeProPrices(): Promise<Partial<Record<BillingInterval, StripePriceInfo | null>>> {
  if (!serverEnv.stripeSecretKey) return {};
  if (priceCache && Date.now() - priceCache.at < 10 * 60_000) return priceCache.prices;
  const read = async (id: string): Promise<StripePriceInfo | null> => {
    if (!id) return null;
    try {
      const p = await getStripe().prices.retrieve(id);
      const interval = p.recurring?.interval === "year" ? "year" : p.recurring?.interval === "month" ? "month" : null;
      return { id: p.id, unitAmount: p.unit_amount ?? null, currency: p.currency, interval, active: p.active };
    } catch (err) {
      logError("billing.price", err, { price: id });
      return null;
    }
  };
  const [month, year] = await Promise.all([read(serverEnv.stripePricePro), read(serverEnv.stripePriceProYearly)]);
  priceCache = { at: Date.now(), prices: { month, year } };
  return priceCache.prices;
}

/** Problems with a configured Stripe price, compared with the approved price (for the admin page and checkout). */
export function stripePriceProblems(info: StripePriceInfo | null | undefined, interval: BillingInterval, approvedCents: number): string[] {
  if (!info) return [`The ${interval === "month" ? "monthly" : "yearly"} Stripe price isn't configured or couldn't be read.`];
  const out: string[] = [];
  if (!info.active) out.push(`Stripe price ${info.id} is archived.`);
  if (info.interval !== interval) out.push(`Stripe price ${info.id} renews every ${info.interval ?? "one-off"}, not every ${interval}.`);
  if (info.currency !== "usd") out.push(`Stripe price ${info.id} is in ${info.currency.toUpperCase()}, not USD.`);
  if (info.unitAmount !== approvedCents) out.push(`Stripe price ${info.id} charges ${info.unitAmount ?? "?"} cents; the approved price is ${approvedCents} cents.`);
  return out;
}

/** The plan a Stripe price grants: current monthly and yearly prices, plus earlier prices kept for existing subscribers. */
export function planForPriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  const pro = [serverEnv.stripePricePro, serverEnv.stripePriceProYearly, ...serverEnv.stripeLegacyPricesPro];
  const plus = [serverEnv.stripePricePlus, serverEnv.stripePricePlusYearly, ...serverEnv.stripeLegacyPricesPlus];
  if (pro.some((p) => p && p === priceId)) return "pro";
  if (plus.some((p) => p && p === priceId)) return "plus";
  return null;
}

/** Whether a Stripe price renews monthly or yearly (current and legacy prices). */
export function intervalForPriceId(priceId: string | null | undefined): BillingInterval | null {
  if (!priceId) return null;
  if ([serverEnv.stripePriceProYearly, serverEnv.stripePricePlusYearly].some((p) => p && p === priceId)) return "year";
  if (planForPriceId(priceId)) return "month";
  return null;
}

async function getOrCreateCustomer(userId: string, email: string | undefined): Promise<string> {
  const admin = getServiceSupabase();
  const { data } = await admin.from("billing_customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id as string;
  const customer = await getStripe().customers.create({ email, metadata: { user_id: userId } }, { idempotencyKey: `customer-${userId}` });
  const { error } = await admin.from("billing_customers").upsert({ user_id: userId, stripe_customer_id: customer.id }, { onConflict: "user_id" });
  if (error) throw error;
  return customer.id;
}

/** Thrown when the configured Stripe price doesn't match the approved price shown to members. */
export class PriceMismatchError extends Error {
  constructor(public problems: string[]) {
    super(problems.join(" "));
    this.name = "PriceMismatchError";
  }
}

function approvedCents(interval: BillingInterval): number {
  const pro = getPlans().pro;
  return interval === "year" ? (pro.yearlyPriceCents ?? 0) : pro.priceCents;
}

/** Thrown when a checkout would create a second subscription for the same customer. */
export class AlreadySubscribedError extends Error {
  constructor() {
    super("already_subscribed");
    this.name = "AlreadySubscribedError";
  }
}

const OPEN_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]);

/** Subscriptions Stripe still considers open for a customer (the local table can lag behind the webhook). */
async function openStripeSubscriptions(customer: string): Promise<string[]> {
  const list = await getStripe().subscriptions.list({ customer, status: "all", limit: 20 });
  return list.data.filter((s) => OPEN_STATUSES.has(s.status)).map((s) => s.id);
}

export async function createCheckoutSession(userId: string, email: string | undefined, plan: PaidPlan, interval: BillingInterval = "month"): Promise<string> {
  const price = priceIdForPlan(plan, interval);
  if (!price) throw new Error(`No Stripe price configured for ${plan}/${interval}`);
  // Never send someone to a checkout whose price differs from the one approved and shown.
  const info = (await stripeProPrices())[interval];
  const problems = stripePriceProblems(info, interval, approvedCents(interval));
  if (problems.length) throw new PriceMismatchError(problems);
  const customer = await getOrCreateCustomer(userId, email);
  // Two tabs, or a retry before the webhook lands, must not create a second subscription.
  if ((await openStripeSubscriptions(customer)).length) throw new AlreadySubscribedError();
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: userId,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { user_id: userId } },
    allow_promotion_codes: true,
    success_url: `${publicEnv.siteUrl}/profile/billing?checkout=success`,
    cancel_url: `${publicEnv.siteUrl}/profile/billing?checkout=canceled`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalSession(userId: string): Promise<string> {
  const admin = getServiceSupabase();
  const { data } = await admin.from("billing_customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  if (!data?.stripe_customer_id) throw new Error("No billing account");
  const portal = await getStripe().billingPortal.sessions.create({
    customer: data.stripe_customer_id as string,
    return_url: `${publicEnv.siteUrl}/profile/billing`,
  });
  return portal.url;
}

/** Current period end, supporting both legacy (subscription-level) and current (item-level) Stripe API shapes. */
function periodEnd(sub: Stripe.Subscription): string | null {
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const ts = item?.current_period_end ?? legacy;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

const KNOWN_STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"];

async function userIdForSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = sub.metadata?.user_id;
  if (fromMeta) return fromMeta;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data } = await getServiceSupabase().from("billing_customers").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  return (data?.user_id as string) ?? null;
}

type EntitlementSource = "stripe" | "app_store" | "play_store";

/**
 * Recompute the user's entitlement from all of their stored subscriptions: Stripe (`subscriptions`) and the app
 * stores (`store_subscriptions`, kept in sync from RevenueCat). The highest plan wins.
 */
export async function recomputeEntitlement(userId: string): Promise<Plan> {
  const admin = getServiceSupabase();
  const [stripeRes, storeRes] = await Promise.all([
    admin.from("subscriptions").select("plan, status, current_period_end, access_revoked_at").eq("user_id", userId),
    admin
      .from("store_subscriptions")
      .select("store, plan, purchased_at, expires_at, grace_period_expires_at, unsubscribe_detected_at, billing_issue_detected_at, refunded_at")
      .eq("user_id", userId),
  ]);
  if (stripeRes.error) throw stripeRes.error;
  if (storeRes.error) throw storeRes.error;
  const candidates: { plan: PaidPlan; status: SubscriptionStatus; current_period_end: string | null; access_revoked_at?: string | null; source: EntitlementSource }[] = [
    ...((stripeRes.data ?? []) as { plan: PaidPlan; status: SubscriptionStatus; current_period_end: string | null; access_revoked_at: string | null }[]).map((s) => ({
      ...s,
      source: "stripe" as const,
    })),
  ];
  for (const row of (storeRes.data ?? []) as (Parameters<typeof storeRowAsSubscription>[0] & { store: string })[]) {
    const sub = storeRowAsSubscription(row);
    if (sub) candidates.push({ ...sub, source: row.store === "play_store" ? "play_store" : "app_store" });
  }
  const { plan, validUntil, from } = entitlementFromSubscriptions(candidates);
  const { data: current } = await admin.from("user_entitlements").select("plan, source, valid_until").eq("user_id", userId).maybeSingle();
  // A manual admin grant stays while it is in date, unless a subscription now provides a higher plan.
  const adminGrantLive = current?.source === "admin" && (!current.valid_until || Date.parse(current.valid_until as string) > Date.now());
  if (adminGrantLive && planRank(current!.plan as Plan) >= planRank(plan)) return current!.plan as Plan;
  const { error: upErr } = await admin
    .from("user_entitlements")
    .upsert({ user_id: userId, plan, source: plan === "free" || !from ? "default" : from.source, valid_until: plan === "free" ? null : validUntil }, { onConflict: "user_id" });
  if (upErr) throw upErr;
  return plan;
}

/** Upsert a Stripe subscription and refresh entitlements. */
export async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const userId = await userIdForSubscription(sub);
  if (!userId) {
    logError("billing.sync", new Error("Subscription without a known user"), { subscription: sub.id });
    return;
  }
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const admin = getServiceSupabase();
  let plan = planForPriceId(priceId);
  if (!plan) {
    // A price this server doesn't know (e.g. the old price after new prices were configured without listing it in
    // STRIPE_PRICE_*_LEGACY). Keep the plan already stored for this subscription so a paying subscriber is never
    // downgraded by a configuration change; only a brand-new unknown subscription is skipped.
    const { data: existing } = await admin.from("subscriptions").select("plan").eq("stripe_subscription_id", sub.id).maybeSingle();
    logError("billing.sync", new Error("Unknown price"), { subscription: sub.id, keptStoredPlan: Boolean(existing) });
    if (!existing) return;
    plan = existing.plan as PaidPlan;
  }
  const status = (KNOWN_STATUSES as string[]).includes(sub.status) ? (sub.status as SubscriptionStatus) : "incomplete";
  const { error } = await admin
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId,
        plan,
        status,
        current_period_end: periodEnd(sub),
        cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      },
      { onConflict: "stripe_subscription_id" },
    );
  if (error) throw error;
  await recomputeEntitlement(userId);
}

/** Process a verified webhook event once. Returns false when the event was already processed. */
export async function handleStripeEvent(event: Stripe.Event): Promise<boolean> {
  const admin = getServiceSupabase();
  const { error: dupErr } = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dupErr) {
    if (dupErr.code === "23505") return false; // already handled
    throw dupErr;
  }
  try {
    const stripe = getStripe();
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          if (!sub.metadata?.user_id && session.client_reference_id) {
            sub.metadata = { ...sub.metadata, user_id: session.client_reference_id };
          }
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        // Stripe doesn't deliver events in order and retries failures hours later, so the event's snapshot may be
        // older than what is already stored. Always sync the subscription's current state.
        const snapshot = event.data.object as Stripe.Subscription;
        await syncSubscription(await currentSubscription(stripe, snapshot));
        break;
      }
      case "invoice.payment_failed":
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = subscriptionOfInvoice(invoice);
        if (subId) {
          // A newer period paid for after a refund or dispute restores access; the revoked period stays revoked.
          if (event.type === "invoice.paid" && invoice.id) await clearRevocation(subId, (row) => row.revoked_invoice_id !== invoice.id);
          await syncSubscription(await stripe.subscriptions.retrieve(subId));
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        // Only a full refund ends access. A partial (goodwill) refund leaves the paid period as it is.
        const current = await stripe.charges.retrieve(charge.id);
        if (current.refunded) await revokeForCharge(stripe, current, "refund");
        else logInfo("billing.partial_refund", { charge: charge.id });
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
        await revokeForCharge(stripe, await stripe.charges.retrieve(chargeId), "dispute");
        break;
      }
      case "charge.dispute.closed": {
        const dispute = await stripe.disputes.retrieve((event.data.object as Stripe.Dispute).id);
        // Won (or an inquiry closed without a chargeback): the payment stands, so its access returns. Lost: it stays ended.
        if (dispute.status === "won" || dispute.status === "warning_closed") {
          const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
          const link = await subscriptionForCharge(stripe, await stripe.charges.retrieve(chargeId));
          if (link) await clearRevocation(link.subscriptionId, (row) => row.access_revoked_reason === "dispute" && row.revoked_invoice_id === link.invoiceId);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // Allow Stripe to retry: forget that we saw this event.
    await admin.from("stripe_events").delete().eq("id", event.id);
    throw err;
  }
  return true;
}

function subscriptionOfInvoice(invoice: Stripe.Invoice): string | null {
  const subRef =
    (invoice as unknown as { subscription?: string | { id: string } | null }).subscription ??
    (invoice as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } } } }).parent?.subscription_details?.subscription;
  return (typeof subRef === "string" ? subRef : subRef?.id) ?? null;
}

/**
 * The subscription and invoice a charge paid for. Since Stripe API 2025-03-31 a charge no longer names its invoice;
 * the link goes through the invoice payment of the charge's PaymentIntent. Null for a payment that wasn't for a
 * subscription invoice.
 */
async function subscriptionForCharge(stripe: Stripe, charge: Stripe.Charge): Promise<{ subscriptionId: string; invoiceId: string } | null> {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return null;
  const payments = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: pi }, limit: 1 });
  const invRef = payments.data[0]?.invoice;
  const invoiceId = typeof invRef === "string" ? invRef : invRef?.id;
  if (!invoiceId) return null;
  const subscriptionId = subscriptionOfInvoice(await stripe.invoices.retrieve(invoiceId));
  return subscriptionId ? { subscriptionId, invoiceId } : null;
}

/**
 * A full refund or a dispute of the payment for a subscription's current period ends that period's access. A refund
 * or dispute of an earlier period's payment doesn't touch the period the member has paid for now. The Stripe
 * subscription itself is left as it is: cancelling it is the owner's decision in the Stripe Dashboard.
 */
async function revokeForCharge(stripe: Stripe, charge: Stripe.Charge, reason: "refund" | "dispute"): Promise<void> {
  const link = await subscriptionForCharge(stripe, charge);
  if (!link) return;
  const sub = await stripe.subscriptions.retrieve(link.subscriptionId);
  await syncSubscription(sub);
  const latest = typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice?.id;
  if (latest && latest !== link.invoiceId) {
    logInfo("billing.revoke_skipped_earlier_period", { subscription: sub.id, reason });
    return;
  }
  const admin = getServiceSupabase();
  const { data, error } = await admin
    .from("subscriptions")
    .update({ access_revoked_at: new Date().toISOString(), access_revoked_reason: reason, revoked_invoice_id: link.invoiceId })
    .eq("stripe_subscription_id", sub.id)
    .select("user_id")
    .maybeSingle();
  if (error) throw error;
  if (data?.user_id) await recomputeEntitlement(data.user_id as string);
}

/** Restore access ended by a refund or dispute, when `when` says the stored revocation no longer applies. */
async function clearRevocation(subscriptionId: string, when: (row: { revoked_invoice_id: string | null; access_revoked_reason: string | null }) => boolean): Promise<void> {
  const admin = getServiceSupabase();
  const { data, error } = await admin
    .from("subscriptions")
    .select("user_id, revoked_invoice_id, access_revoked_reason, access_revoked_at")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.access_revoked_at || !when(data as { revoked_invoice_id: string | null; access_revoked_reason: string | null })) return;
  const { error: upErr } = await admin
    .from("subscriptions")
    .update({ access_revoked_at: null, access_revoked_reason: null, revoked_invoice_id: null })
    .eq("stripe_subscription_id", subscriptionId);
  if (upErr) throw upErr;
  await recomputeEntitlement(data.user_id as string);
}

/** The subscription as Stripe holds it now, or the event's snapshot if Stripe no longer has it. */
async function currentSubscription(stripe: Stripe, snapshot: Stripe.Subscription): Promise<Stripe.Subscription> {
  try {
    const current = await stripe.subscriptions.retrieve(snapshot.id);
    if (!current.metadata?.user_id && snapshot.metadata?.user_id) current.metadata = { ...current.metadata, user_id: snapshot.metadata.user_id };
    return current;
  } catch (err) {
    if (isStripeMissing(err)) return snapshot;
    throw err;
  }
}

export async function cancelStripeSubscriptionsForUser(userId: string): Promise<void> {
  if (!serverEnv.stripeSecretKey || !isServiceRoleConfigured()) return;
  const { data, error } = await getServiceSupabase()
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]);
  // Not knowing which subscriptions exist must stop the deletion, or the person could keep being billed.
  if (error) throw error;
  const ids = new Set((data ?? []).map((s) => s.stripe_subscription_id as string));
  // Stripe's own list too, in case a subscription never reached the local table.
  const { data: customerRow } = await getServiceSupabase().from("billing_customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  if (customerRow?.stripe_customer_id) for (const id of await openStripeSubscriptions(customerRow.stripe_customer_id as string)) ids.add(id);
  for (const id of ids) {
    try {
      await getStripe().subscriptions.cancel(id);
    } catch (err) {
      // Already cancelled or removed in Stripe: nothing left to bill.
      if (isStripeMissing(err)) continue;
      throw err;
    }
  }
}

/** Removes the Stripe customer (name, email, saved payment methods) after the account is deleted. */
export async function deleteStripeCustomer(customerId: string): Promise<void> {
  try {
    await getStripe().customers.del(customerId);
  } catch (err) {
    if (isStripeMissing(err)) return;
    throw err;
  }
}

/**
 * Legacy AI terms (see `legacy_plan_terms`) that apply to the user right now: the subscription they belong to still
 * gives access, is still on the same plan, and the terms haven't been ended.
 */
export async function getLegacyAiTerms(userId: string, now: Date = new Date()): Promise<LegacyAiTerms[]> {
  if (!isServiceRoleConfigured()) return [];
  const { data, error } = await getServiceSupabase()
    .from("legacy_plan_terms")
    .select("plan, ai_monthly_limit, ai_plan_monthly_limit, ai_smart_monthly_limit, ends_at, subscriptions(plan, status, current_period_end, access_revoked_at)")
    .eq("user_id", userId);
  if (error) {
    logError("billing.legacy_terms", error);
    return [];
  }
  type Row = {
    plan: PaidPlan;
    ai_monthly_limit: number;
    ai_plan_monthly_limit: number;
    ai_smart_monthly_limit: number;
    ends_at: string | null;
    subscriptions: { plan: PaidPlan; status: SubscriptionStatus; current_period_end: string | null; access_revoked_at: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.subscriptions && legacyTermsApply(r, r.subscriptions, now))
    .map((r) => ({ plan: r.plan, aiMonthlyLimit: r.ai_monthly_limit, aiPlanMonthlyLimit: r.ai_plan_monthly_limit, aiSmartMonthlyLimit: r.ai_smart_monthly_limit }));
}

export function isStripeConfigured(): boolean {
  return Boolean(serverEnv.stripeSecretKey);
}

function isStripeMissing(err: unknown): boolean {
  const e = err as { code?: string; statusCode?: number } | null;
  return e?.code === "resource_missing" || e?.statusCode === 404;
}
