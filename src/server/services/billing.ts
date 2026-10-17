import "server-only";
import Stripe from "stripe";
import { getServiceSupabase } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { entitlementFromSubscriptions, type BillingInterval, type SubscriptionStatus } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";
import { isServiceRoleConfigured, serverEnv } from "@/server/env";
import { logError } from "@/server/log";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!serverEnv.stripeSecretKey) throw new Error("Stripe is not configured");
  if (!stripeClient) stripeClient = new Stripe(serverEnv.stripeSecretKey, { appInfo: { name: "Narrow Gate Fitness" } });
  return stripeClient;
}

export type PaidPlan = Exclude<Plan, "free">;

/** Stripe price for a plan and interval. Only Pro has a yearly option ("everything, billed yearly"). */
export function priceIdForPlan(plan: PaidPlan, interval: BillingInterval = "month"): string {
  if (interval === "year") return plan === "pro" ? serverEnv.stripePriceProYearly : "";
  return plan === "pro" ? serverEnv.stripePricePro : serverEnv.stripePricePlus;
}

export function planForPriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  if (priceId === serverEnv.stripePricePro) return "pro";
  if (serverEnv.stripePriceProYearly && priceId === serverEnv.stripePriceProYearly) return "pro";
  if (priceId === serverEnv.stripePricePlus) return "plus";
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

export async function createCheckoutSession(userId: string, email: string | undefined, plan: PaidPlan, interval: BillingInterval = "month"): Promise<string> {
  const price = priceIdForPlan(plan, interval);
  if (!price) throw new Error(`No Stripe price configured for ${plan}/${interval}`);
  const customer = await getOrCreateCustomer(userId, email);
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

/** Recompute the user's entitlement from all of their stored subscriptions. */
export async function recomputeEntitlement(userId: string): Promise<Plan> {
  const admin = getServiceSupabase();
  const { data, error } = await admin.from("subscriptions").select("plan, status, current_period_end").eq("user_id", userId);
  if (error) throw error;
  const { plan, validUntil } = entitlementFromSubscriptions(
    (data ?? []) as { plan: PaidPlan; status: SubscriptionStatus; current_period_end: string | null }[],
  );
  const { data: current } = await admin.from("user_entitlements").select("source").eq("user_id", userId).maybeSingle();
  // Manual admin grants are left alone unless Stripe now provides a paid plan.
  if (current?.source === "admin" && plan === "free") return plan;
  const { error: upErr } = await admin
    .from("user_entitlements")
    .upsert({ user_id: userId, plan, source: plan === "free" ? "default" : "stripe", valid_until: plan === "free" ? null : validUntil }, { onConflict: "user_id" });
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
  const plan = planForPriceId(priceId);
  if (!plan) {
    logError("billing.sync", new Error("Unknown price"), { subscription: sub.id });
    return;
  }
  const status = (KNOWN_STATUSES as string[]).includes(sub.status) ? (sub.status as SubscriptionStatus) : "incomplete";
  const { error } = await getServiceSupabase()
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
      case "customer.subscription.resumed":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef =
          (invoice as unknown as { subscription?: string | { id: string } | null }).subscription ??
          (invoice as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (subId) await syncSubscription(await stripe.subscriptions.retrieve(subId));
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

export async function cancelStripeSubscriptionsForUser(userId: string): Promise<void> {
  if (!serverEnv.stripeSecretKey || !isServiceRoleConfigured()) return;
  const { data } = await getServiceSupabase()
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]);
  for (const s of data ?? []) {
    await getStripe().subscriptions.cancel(s.stripe_subscription_id as string);
  }
}
