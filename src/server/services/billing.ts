import "server-only";
import Stripe from "stripe";
import { getServiceSupabase } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { entitlementFromSubscriptions, getPlans, legacyTermsApply, periodStartFromEnd, type BillingInterval, type LegacyAiTerms, type SubscriptionStatus } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";
import { storeRowAsSubscription } from "@/lib/billing/revenuecat";
import { isServiceRoleConfigured, serverEnv } from "@/server/env";
import { logError, logInfo } from "@/server/log";
import { claimWebhookEvent, processClaimedEvent, type WebhookOutcome } from "@/server/services/webhook-events";
import { sandboxPurchasesAllowed } from "@/server/services/sandbox-testers";
import { localStandIn } from "@/server/test-overrides";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!serverEnv.stripeSecretKey) throw new Error("Stripe is not configured");
  if (!stripeClient) {
    // STRIPE_API_BASE_URL points the client at a local stand-in in tests; any other host is ignored (test-overrides.ts).
    const standIn = localStandIn(process.env.STRIPE_API_BASE_URL);
    const base = standIn ? new URL(standIn) : null;
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

/**
 * Whether a Stripe price renews monthly or yearly, where this server's configuration says so: the current monthly
 * and yearly prices. A legacy price (STRIPE_PRICE_*_LEGACY) is only a list of ids, monthly and yearly alike, so its
 * interval isn't known here: null, rather than a guess (see resolvePriceInterval).
 */
export function intervalForPriceId(priceId: string | null | undefined): BillingInterval | null {
  if (!priceId) return null;
  if ([serverEnv.stripePriceProYearly, serverEnv.stripePricePlusYearly].some((p) => p && p === priceId)) return "year";
  if ([serverEnv.stripePricePro, serverEnv.stripePricePlus].some((p) => p && p === priceId)) return "month";
  return null;
}

const priceIntervalCache = new Map<string, BillingInterval>();

/**
 * The interval of any Stripe price: from the configuration when it says, otherwise (a legacy price) as Stripe holds
 * it, remembered for the life of the server (a price's interval never changes). Null when Stripe isn't configured or
 * can't be read, so nothing is labelled with a guess.
 */
export async function resolvePriceInterval(priceId: string | null | undefined): Promise<BillingInterval | null> {
  const known = intervalForPriceId(priceId);
  if (known || !priceId || !serverEnv.stripeSecretKey) return known;
  const cached = priceIntervalCache.get(priceId);
  if (cached) return cached;
  try {
    const recurring = (await getStripe().prices.retrieve(priceId)).recurring?.interval;
    const interval: BillingInterval | null = recurring === "year" ? "year" : recurring === "month" ? "month" : null;
    if (!interval) return null;
    priceIntervalCache.set(priceId, interval);
    return interval;
  } catch (err) {
    logError("billing.price", err, { price: priceId });
    return null;
  }
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A Stripe object that names a different member than the one its customer belongs to here. Needs a human. */
export class OwnershipConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnershipConflictError";
  }
}

/**
 * The member a Stripe subscription belongs to. The customer → member link this server recorded when it created
 * the customer (`billing_customers`) is authoritative; metadata is only a hint. Metadata naming someone else is
 * refused rather than followed, so a subscription can never be moved to another member by editing metadata. A
 * customer this server didn't create (e.g. made by hand in the Stripe Dashboard) is accepted for the member its
 * metadata names only if that member exists and has no other Stripe customer; the link is then recorded.
 */
export async function userIdForSubscription(sub: Pick<Stripe.Subscription, "id" | "customer" | "metadata">): Promise<string | null> {
  const admin = getServiceSupabase();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data: mapped, error } = await admin.from("billing_customers").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  if (error) throw error;
  const meta = sub.metadata?.user_id;
  const fromMeta = typeof meta === "string" && UUID.test(meta) ? meta.toLowerCase() : null;
  if (mapped?.user_id) {
    if (fromMeta && fromMeta !== mapped.user_id) throw new OwnershipConflictError(`Subscription ${sub.id}: metadata names a different member than its customer`);
    return mapped.user_id as string;
  }
  if (!fromMeta) return null;
  const { data: profile, error: profErr } = await admin.from("profiles").select("id").eq("id", fromMeta).maybeSingle();
  if (profErr) throw profErr;
  if (!profile) return null;
  const { data: other, error: otherErr } = await admin.from("billing_customers").select("stripe_customer_id").eq("user_id", fromMeta).maybeSingle();
  if (otherErr) throw otherErr;
  if (other?.stripe_customer_id && other.stripe_customer_id !== customerId)
    throw new OwnershipConflictError(`Subscription ${sub.id}: the member already has a different Stripe customer`);
  const { error: linkErr } = await admin.from("billing_customers").insert({ user_id: fromMeta, stripe_customer_id: customerId });
  if (linkErr && linkErr.code !== "23505") throw linkErr;
  return fromMeta;
}

type EntitlementSource = "stripe" | "app_store" | "play_store";

/**
 * Recompute the user's entitlement from all of their stored subscriptions: Stripe (`subscriptions`) and the app
 * stores (`store_subscriptions`, kept in sync from RevenueCat). The highest plan wins. The write is a
 * compare-and-set on the member's billing version (`apply_entitlement`): if another change to their subscription
 * rows landed while this one was reading, the result is discarded and recomputed, so concurrent webhooks can't
 * leave an entitlement computed from an older picture. A live admin grant of an equal or higher plan stays.
 */
export async function recomputeEntitlement(userId: string): Promise<Plan> {
  const admin = getServiceSupabase();
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: ver, error: verErr } = await admin.from("billing_state_versions").select("version").eq("user_id", userId).maybeSingle();
    if (verErr) throw verErr;
    const version = Number(ver?.version ?? 0);
    const [stripeRes, storeRes] = await Promise.all([
      admin.from("subscriptions").select("plan, status, current_period_end, access_revoked_at, stripe_price_id").eq("user_id", userId),
      admin
        .from("store_subscriptions")
        .select("store, plan, purchased_at, expires_at, grace_period_expires_at, unsubscribe_detected_at, billing_issue_detected_at, refunded_at, is_sandbox")
        .eq("user_id", userId),
    ]);
    if (stripeRes.error) throw stripeRes.error;
    if (storeRes.error) throw storeRes.error;
    const candidates: {
      plan: PaidPlan;
      status: SubscriptionStatus;
      current_period_end: string | null;
      access_revoked_at?: string | null;
      period_started_at?: string | null;
      source: EntitlementSource;
    }[] = [];
    for (const { stripe_price_id, ...s } of (stripeRes.data ?? []) as {
      plan: PaidPlan;
      status: SubscriptionStatus;
      current_period_end: string | null;
      access_revoked_at: string | null;
      stripe_price_id: string | null;
    }[]) {
      // A failed renewal: Stripe has already moved the period end on, so access is capped at a grace period counted
      // from the start of that unpaid period (see SubscriptionAccess.period_started_at in plans.ts). If the price's
      // interval can't be read, a month is assumed: the shortest interval sold, so the member is never cut off
      // before a real grace period has run.
      const period_started_at = s.status === "past_due" ? periodStartFromEnd(s.current_period_end, (await resolvePriceInterval(stripe_price_id)) ?? "month") : null;
      candidates.push({ ...s, period_started_at, source: "stripe" });
    }
    const storeRows = (storeRes.data ?? []) as (Parameters<typeof storeRowAsSubscription>[0] & { store: string; is_sandbox: boolean })[];
    // A stored sandbox purchase grants only while the member is still allowed sandbox purchases: removing a tester
    // from the allow-list (or the entry expiring) ends it at the next recompute, without waiting for RevenueCat.
    const sandboxOk = storeRows.some((r) => r.is_sandbox) ? await sandboxPurchasesAllowed(userId) : false;
    for (const row of storeRows) {
      if (row.is_sandbox && !sandboxOk) continue;
      const sub = storeRowAsSubscription(row);
      if (sub) candidates.push({ ...sub, source: row.store === "play_store" ? "play_store" : "app_store" });
    }
    const { plan, validUntil, from } = entitlementFromSubscriptions(candidates);
    const { data: result, error: applyErr } = await admin.rpc("apply_entitlement", {
      p_user_id: userId,
      p_version: version,
      p_plan: plan,
      p_source: plan === "free" || !from ? "default" : from.source,
      p_valid_until: plan === "free" ? null : validUntil,
    });
    if (applyErr) throw applyErr;
    if (result === "applied") return plan;
    if (result === "kept_admin") {
      const { data: current, error: curErr } = await admin.from("user_entitlements").select("plan").eq("user_id", userId).maybeSingle();
      if (curErr) throw curErr;
      return (current?.plan as Plan) ?? plan;
    }
    // "stale": the member's subscription rows changed while we were reading; read them again.
  }
  throw new Error("Entitlement recompute kept racing with concurrent changes");
}

/**
 * Store a Stripe subscription as read from Stripe at `fetchedAt` and refresh the member's entitlement. An older
 * read never overwrites a newer one, and a subscription is never moved to another member
 * (`upsert_stripe_subscription`).
 */
export async function syncSubscription(sub: Stripe.Subscription, fetchedAt: Date = new Date()): Promise<void> {
  const userId = await userIdForSubscription(sub);
  if (!userId) {
    logError("billing.sync", new Error("Subscription without a known member"), { subscription: sub.id });
    return;
  }
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const admin = getServiceSupabase();
  let plan = planForPriceId(priceId);
  if (!plan) {
    // A price this server doesn't know (e.g. the old price after new prices were configured without listing it in
    // STRIPE_PRICE_*_LEGACY). Keep the plan already stored for this subscription so a paying subscriber is never
    // downgraded by a configuration change; only a brand-new unknown subscription is skipped.
    const { data: existing } = await admin.from("subscriptions").select("plan").eq("stripe_subscription_id", sub.id).eq("user_id", userId).maybeSingle();
    logError("billing.sync", new Error("Unknown price"), { subscription: sub.id, keptStoredPlan: Boolean(existing) });
    if (!existing) return;
    plan = existing.plan as PaidPlan;
  }
  const status = (KNOWN_STATUSES as string[]).includes(sub.status) ? (sub.status as SubscriptionStatus) : "incomplete";
  const { data: result, error } = await admin.rpc("upsert_stripe_subscription", {
    p_user_id: userId,
    p_subscription_id: sub.id,
    p_price_id: priceId,
    p_plan: plan,
    p_status: status,
    p_current_period_end: periodEnd(sub),
    p_cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    p_synced_at: fetchedAt.toISOString(),
  });
  if (error) throw error;
  if (result === "owner_conflict") throw new OwnershipConflictError(`Subscription ${sub.id} is stored for a different member`);
  if (result === "stale") logInfo("billing.sync_stale", { subscription: sub.id });
  await recomputeEntitlement(userId);
}

/** A subscription as Stripe holds it now, with the time it was read (orders concurrent writes). */
async function fetchSubscription(stripe: Stripe, id: string): Promise<{ sub: Stripe.Subscription; fetchedAt: Date }> {
  const fetchedAt = new Date();
  return { sub: await stripe.subscriptions.retrieve(id), fetchedAt };
}

/**
 * Process a verified webhook event once (see webhook-events.ts): "duplicate" when it was already processed, "busy"
 * when another delivery of it is being processed right now (the route asks Stripe to retry later). A failure is
 * recorded on the event and rethrown, so Stripe retries it; nothing is acknowledged unless its changes were saved.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<WebhookOutcome> {
  const claim = await claimWebhookEvent("stripe", event.id, event.type);
  if (claim !== "claimed") return claim;
  await processClaimedEvent("stripe", event.id, () => applyStripeEvent(event));
  return "processed";
}

async function applyStripeEvent(event: Stripe.Event): Promise<void> {
  const stripe = getStripe();
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const { sub, fetchedAt } = await fetchSubscription(stripe, subId);
        if (!sub.metadata?.user_id && session.client_reference_id) {
          sub.metadata = { ...sub.metadata, user_id: session.client_reference_id };
        }
        await syncSubscription(sub, fetchedAt);
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
      const { sub, fetchedAt } = await currentSubscription(stripe, snapshot, event.created);
      await syncSubscription(sub, fetchedAt);
      break;
    }
    case "invoice.payment_failed":
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = subscriptionOfInvoice(invoice);
      if (subId) {
        // A newer period paid for after a refund or dispute restores access; the revoked period stays revoked.
        if (event.type === "invoice.paid" && invoice.id) await clearRevocation(subId, (row) => row.revoked_invoice_id !== invoice.id);
        const { sub, fetchedAt } = await fetchSubscription(stripe, subId);
        await syncSubscription(sub, fetchedAt);
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
  const { sub, fetchedAt } = await fetchSubscription(stripe, link.subscriptionId);
  await syncSubscription(sub, fetchedAt);
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

/**
 * The subscription as Stripe holds it now, or the event's snapshot if Stripe no longer has it. A snapshot counts as
 * read when the event was created, so it can't overwrite anything read from Stripe later.
 */
async function currentSubscription(stripe: Stripe, snapshot: Stripe.Subscription, eventCreated: number): Promise<{ sub: Stripe.Subscription; fetchedAt: Date }> {
  try {
    const { sub: current, fetchedAt } = await fetchSubscription(stripe, snapshot.id);
    if (!current.metadata?.user_id && snapshot.metadata?.user_id) current.metadata = { ...current.metadata, user_id: snapshot.metadata.user_id };
    return { sub: current, fetchedAt };
  } catch (err) {
    if (isStripeMissing(err)) return { sub: snapshot, fetchedAt: new Date(eventCreated * 1000) };
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
