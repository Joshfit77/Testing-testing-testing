"use client";

import { useState } from "react";
import { CheckoutButton, PortalButton } from "@/components/profile/billing-buttons";
import { MembershipPlans, type BillingInterval, type MembershipPrices } from "@/components/profile/membership-plans";
import { renewalTerms } from "@/lib/billing/paywall";
import type { ComparisonSection } from "@/lib/domain/membership";
import type { Plan } from "@/lib/domain/types";

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
      <p className="text-sm text-muted-foreground">
        Your membership is billed through {storeManaged}. Manage or cancel it on your phone in your {storeManaged === "Google Play" ? "Google Play" : "Apple Account"}{" "}
        subscription settings; it works here too.
      </p>
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
        <p className="text-xs leading-relaxed text-muted-foreground">
          {renewalTerms("web")} Prices in US dollars; sales tax may apply where required.{" "}
          <a href={legal.termsUrl} className="text-gold-highlight underline" target="_blank" rel="noopener">
            Terms of Service
          </a>{" "}
          ·{" "}
          <a href={legal.privacyUrl} className="text-gold-highlight underline" target="_blank" rel="noopener">
            Privacy Policy
          </a>
          {!legal.final && " (drafts awaiting legal review)"}
        </p>
      }
    />
  );
}
