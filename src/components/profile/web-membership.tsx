"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckoutButton, PortalButton } from "@/components/profile/billing-buttons";
import { MembershipPlans, type BillingInterval, type MembershipPrices } from "@/components/profile/membership-plans";
import { renewalTerms } from "@/lib/billing/paywall";
import type { ComparisonSection } from "@/lib/domain/membership";
import type { Plan } from "@/lib/domain/types";
import { syncStorePurchasesAction } from "@/server/actions/store-billing";

/** Where Apple and Google let a member manage or cancel a store subscription (their own public pages). */
const STORE_MANAGE_URL: Record<string, string> = {
  "Google Play": "https://play.google.com/store/account/subscriptions",
  "the App Store": "https://apps.apple.com/account/subscriptions",
};

/**
 * Restore purchases on the website: asks the server to re-check the member's App Store / Google Play purchases
 * (RevenueCat, server to server). The answer comes from the store records, never from this page.
 */
export function RestorePurchasesButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 px-2"
        disabled={pending}
        data-testid="web-restore"
        onClick={() =>
          start(async () => {
            const res = await syncStorePurchasesAction().catch(() => ({ ok: false as const, error: "Couldn't reach Narrow Gate. Please try again." }));
            if (!res.ok) return setMsg(res.error);
            setMsg(res.plan === "free" ? "No App Store or Google Play membership was found for this account." : "Membership restored.");
            router.refresh();
          })
        }
      >
        <RefreshCw className={pending ? "animate-spin" : undefined} aria-hidden /> {pending ? "Checking…" : "Restore purchases"}
      </Button>
      {msg && (
        <p className="text-xs text-muted-foreground" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

/**
 * The membership screen on the website: Pro All Access through Stripe Checkout, changes and cancellation through
 * the Stripe customer portal. Prices are the amounts of the configured Stripe prices, so what's shown is what's
 * charged.
 */
export function WebMembership({
  currentPlan,
  currentInterval,
  comparison,
  prices,
  checkout,
  stripeManaged,
  storeManaged,
  legal,
}: {
  currentPlan: Plan;
  currentInterval: BillingInterval | null;
  comparison: ComparisonSection[];
  prices: MembershipPrices;
  /** Which intervals can be bought here right now (Stripe configured, price matches the approved price). */
  checkout: Record<BillingInterval, boolean>;
  /** The member has a Stripe subscription to manage. */
  stripeManaged: boolean;
  /** "the App Store" / "Google Play" when the membership is billed through a store. */
  storeManaged: string | null;
  legal: { termsUrl: string; privacyUrl: string; final: boolean };
}) {
  const [interval, setInterval] = useState<BillingInterval>(currentInterval ?? "month");
  const shown: BillingInterval = interval === "year" && prices.year ? "year" : "month";
  const price = shown === "year" ? prices.year : prices.month;

  let proAction: React.ReactNode;
  if (storeManaged) {
    proAction = (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Your membership is billed through {storeManaged}. Manage or cancel it in your {storeManaged === "Google Play" ? "Google Play" : "Apple Account"} subscription
          settings; it works here too.
        </p>
        {STORE_MANAGE_URL[storeManaged] && (
          <Button asChild variant="secondary" className="w-full" data-testid="store-manage-link">
            <a href={STORE_MANAGE_URL[storeManaged]} target="_blank" rel="noopener">
              Manage in {storeManaged === "Google Play" ? "Google Play" : "Apple Account"}
            </a>
          </Button>
        )}
      </div>
    );
  } else if (currentPlan === "pro" && stripeManaged) {
    proAction = (
      <div className="space-y-2">
        <PortalButton label="Manage billing" />
        <p className="text-xs text-muted-foreground">Switch between monthly and yearly, update your card or cancel in Manage billing.</p>
      </div>
    );
  } else if (currentPlan === "pro") {
    proAction = <p className="text-sm text-muted-foreground">Pro All Access is active on your account.</p>;
  } else if (currentPlan === "plus" && stripeManaged) {
    proAction = (
      <div className="space-y-2">
        <PortalButton label="Upgrade in Manage billing" />
        <p className="text-xs text-muted-foreground">You keep your current membership until you choose to change it.</p>
      </div>
    );
  } else if (currentPlan === "free" && checkout[shown] && price) {
    proAction = <CheckoutButton key={shown} plan="pro" interval={shown} price={price} featured label={`Start Pro All Access · ${price} / ${shown === "year" ? "year" : "month"}`} />;
  } else {
    proAction = <p className="text-sm text-muted-foreground">Online checkout isn&apos;t available right now. You haven&apos;t been charged.</p>;
  }

  return (
    <MembershipPlans
      currentPlan={currentPlan}
      interval={interval}
      onIntervalChange={setInterval}
      prices={prices}
      comparison={comparison}
      proAction={proAction}
      footer={
        <>
        {/* Bought Pro in the iPhone or Android app? Restore brings it here too (checked against the store records). */}
        {!stripeManaged && <RestorePurchasesButton />}
        <p className="text-xs leading-relaxed text-muted-foreground">
          {renewalTerms("web")} Prices in US dollars; sales tax may apply where required.{" "}
          <a href={legal.termsUrl} className="inline-flex min-h-11 items-center text-gold-highlight underline" target="_blank" rel="noopener">
            Terms of Service
          </a>{" "}
          ·{" "}
          <a href={legal.privacyUrl} className="inline-flex min-h-11 items-center text-gold-highlight underline" target="_blank" rel="noopener">
            Privacy Policy
          </a>
          {!legal.final && " (drafts awaiting legal review)"}
        </p>
        </>
      }
    />
  );
}
