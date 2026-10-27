import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { CheckoutButton, PortalButton } from "@/components/profile/billing-buttons";
import { Badge } from "@/components/ui/badge";
import { formatPrice, getPlans, sellablePlans, yearlySavingsPercent } from "@/lib/domain/plans";
import { titleCase } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { isStripeConfigured, isYearlyBillingConfigured } from "@/server/env";
import { getNativePlatform } from "@/server/native";
import { legalLinks, storeProductIds, storePublicKey } from "@/server/services/store-billing";
import { StorePaywall } from "@/components/profile/store-paywall";
import { storeRowAsSubscription } from "@/lib/billing/revenuecat";
import type { BillingSource } from "@/lib/billing/paywall";

export const metadata = { title: "Plans & billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [plan, subsRes, storeRes, entRes, native] = await Promise.all([
    getUserPlan(user.id),
    supabase.from("subscriptions").select("plan, status, current_period_end, cancel_at_period_end").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("store_subscriptions")
      .select("store, product_id, plan, purchased_at, expires_at, grace_period_expires_at, unsubscribe_detected_at, billing_issue_detected_at, refunded_at")
      .eq("user_id", user.id),
    supabase.from("user_entitlements").select("source").eq("user_id", user.id).maybeSingle(),
    getNativePlatform(),
  ]);
  const plans = getPlans();
  const sub = subsRes.data;
  const stripeReady = isStripeConfigured();
  const yearlyReady = isYearlyBillingConfigured();
  const yearlyCents = plans.pro.yearlyPriceCents ?? 0;
  // Plans on offer, plus a legacy plan the member still has.
  const cards = [...sellablePlans(), ...(plans[plan].sellable ? [] : [plan])];
  const source = (entRes.data?.source as BillingSource | undefined) ?? "default";
  // The App Store / Google Play subscription that grants the current plan, if that's how the member pays.
  const storeSub =
    (storeRes.data ?? [])
      .map((row) => ({ row, sub: storeRowAsSubscription(row as Parameters<typeof storeRowAsSubscription>[0]) }))
      .filter((x) => x.sub && x.sub.plan === plan && x.sub.status !== "canceled")
      .map((x) => ({ store: x.row.store as string, productId: x.row.product_id as string, ...x.sub! }))[0] ?? null;
  const storeLabel = storeSub?.store === "play_store" ? "Google Play" : "App Store";
  const storeEnd = storeSub?.current_period_end ? new Date(storeSub.current_period_end).toLocaleDateString("en-US", { dateStyle: "long" }) : null;
  const storeKey = native ? storePublicKey(native) : "";
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end as string).toLocaleDateString("en-US", { dateStyle: "long" }) : null;

  return (
    <div className="space-y-6">
      <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Profile
      </Link>
      <PageHeader eyebrow="Billing" title="Plans & billing" description="Upgrade, change or cancel at any time. Prices shown in USD." />

      {checkout === "success" && (
        <Notice tone="success">
          Thanks! Stripe has your payment details. Your plan upgrades as soon as Stripe confirms the subscription — usually within seconds. Refresh this page if
          it hasn&apos;t updated yet.
        </Notice>
      )}
      {checkout === "canceled" && <Notice tone="info">Checkout was canceled. You haven&apos;t been charged.</Notice>}
      {sub?.status === "past_due" && (
        <Notice tone="error">
          Your last payment failed. Stripe will retry automatically — please update your payment method in Manage billing to keep your plan.
        </Notice>
      )}
      {sub?.status === "unpaid" && <Notice tone="error">Your subscription is unpaid and premium features are paused. Update your payment method to restore access.</Notice>}
      {sub?.cancel_at_period_end && periodEnd && <Notice tone="warning">Your subscription is set to cancel. You keep {titleCase(sub.plan as string)} access until {periodEnd}.</Notice>}
      {storeSub?.status === "past_due" && (
        <Notice tone="error">
          The {storeLabel} couldn&apos;t renew your subscription. Update your payment method in your {storeLabel} account to keep {plans[plan].name}.
        </Notice>
      )}
      {storeSub?.cancel_at_period_end && storeEnd && (
        <Notice tone="warning">
          Your {storeLabel} subscription is set to cancel. You keep {plans[plan].name} access until {storeEnd}.
        </Notice>
      )}
      {storeSub && !native && (
        <Notice tone="info">Your subscription is billed through the {storeLabel}. Manage or cancel it in your {storeLabel} account settings on your phone.</Notice>
      )}
      {native && !storeKey && (
        <Notice tone="info">
          In-app purchases aren&apos;t available in the {native === "ios" ? "iOS" : "Android"} app yet. Your current plan works everywhere you sign in.
        </Notice>
      )}
      {!stripeReady && !native && <Notice tone="warning">Payments aren&apos;t configured on this server (Stripe keys missing). Checkout is disabled.</Notice>}

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="current-title">
        <h2 id="current-title" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Current plan
        </h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-3xl font-bold uppercase text-gold-highlight">{plans[plan].name}</p>
            {storeSub ? (
              <p className="text-sm text-muted-foreground">
                Billed through the {storeLabel}
                {storeEnd && !storeSub.cancel_at_period_end && ` · renews ${storeEnd}`}
              </p>
            ) : sub ? (
              <p className="text-sm text-muted-foreground">
                Status: {titleCase(sub.status as string)}
                {periodEnd && !sub.cancel_at_period_end && ` · renews ${periodEnd}`}
              </p>
            ) : null}
          </div>
          {sub && stripeReady && !native && <PortalButton />}
        </div>
      </section>

      {native && storeKey ? (
        <StorePaywall
          userId={user.id}
          platform={native}
          apiKey={storeKey}
          currentPlan={plan}
          source={source}
          currentProductId={storeSub && storeSub.store === (native === "ios" ? "app_store" : "play_store") ? storeSub.productId : null}
          productIds={storeProductIds()}
          yearly={{ plus: false, pro: Boolean(plans.pro.yearlyPriceCents) }}
          plans={{
            plus: { name: plans.plus.name, tagline: plans.plus.tagline, highlights: plans.plus.highlights },
            pro: { name: plans.pro.name, tagline: plans.pro.tagline, highlights: plans.pro.highlights },
          }}
          legal={legalLinks()}
        />
      ) : null}
      {/* Inside the store apps, website prices and checkout are never shown (App Store guideline 3.1.1). */}
      {!native && (
        <>
          <ul className="grid gap-4 md:grid-cols-3">
            {cards.map((id) => {
              const p = plans[id];
              const isCurrent = id === plan;
              return (
                <li key={id} className={isCurrent ? "rounded-2xl border border-gold bg-card-gradient p-5" : "rounded-2xl border border-border bg-card p-5"}>
                  <div className="flex items-center justify-between">
                    <p className="font-display text-xl font-semibold uppercase tracking-wider">{p.name}</p>
                    {isCurrent && <Badge>Current</Badge>}
                    {!p.sellable && <Badge variant="secondary">Legacy</Badge>}
                  </div>
                  <p className="mt-2 text-3xl font-bold">
                    {formatPrice(p.priceCents)}
                    {p.priceCents > 0 && <span className="text-sm font-normal text-muted-foreground"> / month</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{p.sellable ? p.tagline : "No longer offered to new members. Your subscription keeps its features and price."}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {p.highlights.map((h) => (
                      <li key={h} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden /> {h}
                      </li>
                    ))}
                    {p.aiMonthlyLimit > 0 && (
                      <li className="flex gap-2 text-muted-foreground">
                        <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden /> {p.aiMonthlyLimit} AI coach messages / month
                      </li>
                    )}
                  </ul>
                  {id === "pro" && plan === "free" && stripeReady && !native && (
                    <div className="mt-5">
                      <CheckoutButton plan="pro" label="Choose Pro monthly" featured />
                    </div>
                  )}
                  {id === "pro" && plan === "plus" && stripeReady && !native && <p className="mt-5 text-xs text-muted-foreground">Upgrade via Manage billing.</p>}
                </li>
              );
            })}
            {yearlyCents > 0 && (
              <li className="rounded-2xl border border-gold-muted bg-card-gradient p-5">
                <div className="flex items-center justify-between">
                  <p className="font-display text-xl font-semibold uppercase tracking-wider">Pro yearly</p>
                  <Badge>Save {yearlySavingsPercent(plans.pro.priceCents, yearlyCents)}%</Badge>
                </div>
                <p className="mt-2 text-3xl font-bold">
                  {formatPrice(yearlyCents)}
                  <span className="text-sm font-normal text-muted-foreground"> / year</span>
                </p>
                <p className="text-sm text-muted-foreground">Everything in Pro, billed once a year.</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {["Everything in Pro", `About ${formatPrice(Math.round(yearlyCents / 12))} a month`].map((h) => (
                    <li key={h} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden /> {h}
                    </li>
                  ))}
                </ul>
                {plan === "free" && stripeReady && yearlyReady && !native && (
                  <div className="mt-5">
                    <CheckoutButton plan="pro" interval="year" label="Choose Pro yearly" />
                  </div>
                )}
                {plan === "free" && stripeReady && !yearlyReady && !native && <p className="mt-5 text-xs text-muted-foreground">Yearly billing isn&apos;t configured on this server yet.</p>}
                {plan !== "free" && stripeReady && !native && <p className="mt-5 text-xs text-muted-foreground">Switch via Manage billing.</p>}
              </li>
            )}
          </ul>
          <p className="text-xs text-muted-foreground">
            Pro is {formatPrice(plans.pro.priceCents)} per month{yearlyCents > 0 ? ` or ${formatPrice(yearlyCents)} per year` : ""} (USD). Subscriptions renew
            automatically at the end of each billing period at the then-current price until you cancel. Cancel any time in Manage billing; you keep
            access until the end of the period you paid for. See our{" "}
            <Link href="/legal/terms#subscriptions" className="text-gold-highlight underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-gold-highlight underline">
              Privacy Policy
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
