import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { PortalButton } from "@/components/profile/billing-buttons";
import { StorePaywall } from "@/components/profile/store-paywall";
import { WebMembership } from "@/components/profile/web-membership";
import { intervalForProduct, type BillingSource } from "@/lib/billing/paywall";
import { storeRowAsSubscription } from "@/lib/billing/revenuecat";
import { membershipComparison } from "@/lib/domain/membership";
import { getPlans, yearlySavingsPercent, type BillingInterval } from "@/lib/domain/plans";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { isServiceRoleConfigured, isStripeConfigured } from "@/server/env";
import { getNativePlatform } from "@/server/native";
import { isDemoMode } from "@/server/demo";
import { getAiAllowance } from "@/server/services/ai-coach";
import { intervalForPriceId, stripePriceProblems, stripeProPrices } from "@/server/services/billing";
import { legalLinks, storeProductIds, storePublicKey } from "@/server/services/store-billing";

export const metadata = { title: "Membership" };

function money(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "long" });

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [plan, subsRes, storeRes, entRes, native] = await Promise.all([
    getUserPlan(user.id),
    supabase
      .from("subscriptions")
      .select("plan, status, stripe_price_id, current_period_end, cancel_at_period_end, access_revoked_at, access_revoked_reason")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("store_subscriptions")
      .select("store, product_id, plan, purchased_at, expires_at, grace_period_expires_at, unsubscribe_detected_at, billing_issue_detected_at, refunded_at")
      .eq("user_id", user.id),
    supabase.from("user_entitlements").select("source, valid_until").eq("user_id", user.id).maybeSingle(),
    getNativePlatform(),
  ]);
  const plans = getPlans();
  const sub = subsRes.data;
  const ai = await getAiAllowance(user.id, plan);
  const source = (entRes.data?.source as BillingSource | undefined) ?? "default";
  const ids = storeProductIds();
  const comparison = membershipComparison();

  // The App Store / Google Play subscription that grants the current plan, if that's how the member pays.
  const storeSub =
    (storeRes.data ?? [])
      .map((row) => ({ row, sub: storeRowAsSubscription(row as Parameters<typeof storeRowAsSubscription>[0]) }))
      .filter((x) => x.sub && x.sub.plan === plan && x.sub.status !== "canceled")
      .map((x) => ({ store: x.row.store as string, productId: x.row.product_id as string, ...x.sub! }))[0] ?? null;
  const storeLabel = storeSub?.store === "play_store" ? "Google Play" : "App Store";
  const storeKey = native ? storePublicKey(native) : "";
  const stripeActive = Boolean(sub && source === "stripe");

  // Current membership summary.
  const interval: BillingInterval | null = storeSub ? intervalForProduct(storeSub.productId, ids) : stripeActive ? intervalForPriceId(sub?.stripe_price_id as string | null) : null;
  const periodEnd = storeSub?.current_period_end ?? (stripeActive ? (sub?.current_period_end as string | null) : null) ?? (source === "admin" ? (entRes.data?.valid_until as string | null) : null);
  const cancelling = storeSub ? storeSub.cancel_at_period_end : stripeActive ? Boolean(sub?.cancel_at_period_end) : false;
  const storeName = storeSub?.store === "play_store" ? "Google Play" : "the App Store";
  const channel = storeSub ? `Billed through ${storeName}` : stripeActive ? "Billed through Stripe on our website" : source === "admin" ? (isDemoMode() ? "Demo test membership, no payment" : "Granted by Narrow Gate Fitness") : null;

  // Web prices: the amounts Stripe will actually charge. Checkout is offered only for a price that matches the
  // approved price shown on this page.
  const stripe = !native && isStripeConfigured() && isServiceRoleConfigured() ? await stripeProPrices() : {};
  const approved = { month: plans.pro.priceCents, year: plans.pro.yearlyPriceCents ?? 0 };
  const okFor = (i: BillingInterval) => Boolean(stripe[i]) && stripePriceProblems(stripe[i], i, approved[i]).length === 0;
  const checkoutOk = { month: okFor("month"), year: approved.year > 0 && okFor("year") };
  const webPrices = {
    month: money(okFor("month") ? stripe.month!.unitAmount! : approved.month),
    year: approved.year > 0 ? money(okFor("year") ? stripe.year!.unitAmount! : approved.year) : null,
    yearPerMonth: approved.year > 0 ? money(Math.floor(approved.year / 12)) : null,
    savingsPercent: approved.year > 0 ? yearlySavingsPercent(approved.month, approved.year) : null,
  };

  return (
    <div className="space-y-6">
      <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Profile
      </Link>
      <PageHeader eyebrow="Membership" title="Plans & billing" description="Free, or Pro All Access monthly or yearly. Change or cancel any time." />

      {isDemoMode() && (
        <Notice tone="warning">
          <span data-testid="demo-purchases-off">
            <strong>Demo:</strong> purchases are turned off and nothing is charged. The prices below are the real Free and Pro All Access prices; to see
            Pro features, use the Free / Pro switch at the top of the screen.
          </span>
        </Notice>
      )}
      {checkout === "success" && (
        <Notice tone="success">
          Thank you! Stripe has your payment details. Pro All Access unlocks as soon as Stripe confirms the subscription, usually within seconds. Refresh
          this page if it hasn&apos;t updated yet.
        </Notice>
      )}
      {checkout === "canceled" && <Notice tone="info">Checkout was cancelled. You haven&apos;t been charged.</Notice>}
      {sub?.access_revoked_at && (
        <Notice tone="error">
          {sub.access_revoked_reason === "dispute"
            ? "A payment for your membership was disputed with your bank, so its premium access is paused while the dispute is open."
            : "Your latest membership payment was refunded, so the premium access it paid for has ended."}{" "}
          Manage billing shows the subscription itself.
        </Notice>
      )}
      {stripeActive && sub?.status === "past_due" && (
        <Notice tone="error">Your last payment failed. Stripe will retry automatically. Update your payment method in Manage billing to keep Pro All Access.</Notice>
      )}
      {stripeActive && sub?.status === "unpaid" && <Notice tone="error">Your membership is unpaid and premium features are paused. Update your payment method to restore access.</Notice>}
      {storeSub?.status === "past_due" && (
        <Notice tone="error">
          {storeLabel} couldn&apos;t renew your membership. Update your payment method in your {storeLabel} account to keep {plans[plan].name}.
        </Notice>
      )}
      {native && !storeKey && (
        <Notice tone="info">
          In-app purchases aren&apos;t available in the {native === "ios" ? "iOS" : "Android"} app yet. Your current membership works everywhere you sign in.
        </Notice>
      )}
      {ai.legacy && (
        <Notice tone="info">
          You subscribed before our memberships changed, so your subscription keeps its AI coach allowance ({ai.chatLimit} requests a month) for as long as
          it stays on {plans[plan].name}.
        </Notice>
      )}
      {plan === "plus" && (
        <Notice tone="info">
          You&apos;re on our earlier Plus membership. It keeps everything you subscribed to, at the price you subscribed at, until you change or cancel it.
          Plus is no longer offered to new members; Pro All Access includes everything in Plus and more.
        </Notice>
      )}

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="current-title">
        <h2 id="current-title" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Current membership
        </h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-3xl font-bold uppercase text-gold-highlight" data-testid="current-plan">
              {plans[plan].name}
              {plan === "plus" && <span className="ml-2 align-middle text-sm font-semibold normal-case text-muted-foreground">(earlier membership)</span>}
            </p>
            {plan !== "free" && (
              <p className="text-sm text-muted-foreground" data-testid="current-plan-detail">
                {[channel, interval ? (interval === "year" ? "Yearly" : "Monthly") : null, periodEnd ? `${cancelling ? "Ends" : source === "admin" ? "Until" : "Renews"} ${dateFmt(periodEnd)}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {plan === "free" && <p className="text-sm text-muted-foreground">Everything you need to build your foundation, free for as long as you like.</p>}
          </div>
          {stripeActive && isStripeConfigured() && !native && <PortalButton />}
        </div>
        {cancelling && periodEnd && (
          <p className="mt-3 text-sm text-[#e2c477]">Your membership is set to cancel. You keep {plans[plan].name} until {dateFmt(periodEnd)} and won&apos;t be charged again.</p>
        )}
      </section>

      {native && storeKey ? (
        <StorePaywall
          userId={user.id}
          platform={native}
          apiKey={storeKey}
          currentPlan={plan}
          source={source}
          currentProductId={storeSub && storeSub.store === (native === "ios" ? "app_store" : "play_store") ? storeSub.productId : null}
          currentInterval={storeSub ? intervalForProduct(storeSub.productId, ids) : null}
          productIds={ids}
          comparison={comparison}
          legal={legalLinks()}
        />
      ) : native ? null : (
        <WebMembership
          currentPlan={plan}
          currentInterval={interval}
          comparison={comparison}
          prices={webPrices}
          checkout={checkoutOk}
          stripeManaged={stripeActive}
          storeManaged={storeSub ? storeName : null}
          legal={legalLinks()}
        />
      )}

      <section className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground" aria-labelledby="cancel-title">
        <h2 id="cancel-title" className="font-display text-sm font-semibold uppercase tracking-widest text-foreground">
          How to cancel
        </h2>
        <p>
          <span className="text-foreground">Website (Stripe):</span> Manage billing › Cancel subscription. You keep access until the end of the period
          you&apos;ve paid for.
        </p>
        <p>
          <span className="text-foreground">iPhone or iPad (App Store):</span> Settings › your name › Subscriptions › Narrow Gate Fitness › Cancel
          Subscription.
        </p>
        <p>
          <span className="text-foreground">Android (Google Play):</span> Google Play › your profile › Payments &amp; subscriptions › Subscriptions ›
          Narrow Gate Fitness › Cancel.
        </p>
        <p>Deleting the app or your Narrow Gate account cancels a website subscription for you, but not one billed by Apple or Google: cancel those in your store account.</p>
      </section>
    </div>
  );
}
