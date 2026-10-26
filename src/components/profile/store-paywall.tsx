"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/common/states";
import { MembershipPlans, type BillingInterval } from "@/components/profile/membership-plans";
import { Button } from "@/components/ui/button";
import {
  paywallAction,
  paywallOptions,
  purchaseErrorMessage,
  renewalTerms,
  storePrices,
  type BillingSource,
  type Interval,
  type PaywallOptions,
  type StoreProductIds,
} from "@/lib/billing/paywall";
import { connectStore, type StoreClient } from "@/lib/billing/store-purchases";
import type { ComparisonSection } from "@/lib/domain/membership";
import type { Plan } from "@/lib/domain/types";
import { syncStorePurchasesAction } from "@/server/actions/store-billing";

export interface StorePaywallProps {
  userId: string;
  platform: "ios" | "android";
  apiKey: string;
  currentPlan: Plan;
  source: BillingSource;
  /** The store product the member currently subscribes to here, if any (Google Play changes must name it). */
  currentProductId: string | null;
  /** Monthly or yearly, for the member's current subscription here. */
  currentInterval: Interval | null;
  productIds: StoreProductIds;
  comparison: ComparisonSection[];
  legal: { termsUrl: string; privacyUrl: string; final: boolean };
}

const MANAGE_FALLBACK = {
  ios: "https://apps.apple.com/account/subscriptions",
  android: "https://play.google.com/store/account/subscriptions",
};

/**
 * In-app membership screen for the iOS and Android apps (App Store / Google Play through RevenueCat). Shows Free
 * and Pro All Access with the store's localized monthly and yearly prices, the renewal terms, Terms and Privacy
 * links, Restore purchases and Manage subscription (App Store guidelines 3.1.1 and 3.1.2). After a purchase or
 * restore the server re-reads the member's purchases from RevenueCat; the plan never changes on the app's word.
 */
export function StorePaywall(props: StorePaywallProps) {
  const { userId, platform, apiKey, currentPlan, source, currentProductId, currentInterval, productIds, comparison, legal } = props;
  const router = useRouter();
  const client = useRef<StoreClient | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [options, setOptions] = useState<PaywallOptions>({});
  const [interval, setInterval] = useState<BillingInterval>(currentInterval ?? "month");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);
  const storeName = platform === "ios" ? "App Store" : "Google Play";
  // Compared by value: the page passes new objects on every refresh, which mustn't reload the store.
  const configKey = JSON.stringify(productIds);

  useEffect(() => {
    const ids = JSON.parse(configKey) as StoreProductIds;
    let cancelled = false;
    (async () => {
      const c = await connectStore(apiKey, userId);
      if (cancelled) return;
      if (!c) return setState("unavailable");
      client.current = c;
      try {
        const packages = await c.packages();
        if (cancelled) return;
        setOptions(paywallOptions(packages, ids));
        setState("ready");
      } catch {
        if (!cancelled) setState("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey, userId, configKey]);

  async function buy(chosen: Interval) {
    const pkg = options[chosen];
    if (!client.current || !pkg) return;
    setBusy(pkg.product.identifier);
    setMessage(null);
    try {
      await client.current.purchase(pkg, { oldProductId: currentProductId ?? undefined });
      const res = await syncStorePurchasesAction();
      if (!res.ok) setMessage({ tone: "error", text: res.error });
      else if (res.plan === "pro") setMessage({ tone: "success", text: "Welcome to Pro All Access. Thank you!" });
      else setMessage({ tone: "info", text: "Purchase received. Your membership will update in a moment. Pull down to refresh if it hasn't." });
      router.refresh();
    } catch (err) {
      const text = purchaseErrorMessage(err);
      setMessage(text ? { tone: "error", text } : { tone: "info", text: "Purchase cancelled. You haven't been charged." });
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    if (!client.current) return;
    setBusy("restore");
    setMessage(null);
    try {
      await client.current.restore();
      const res = await syncStorePurchasesAction();
      if (!res.ok) setMessage({ tone: "error", text: res.error });
      else if (res.plan === "free") setMessage({ tone: "info", text: `No active memberships were found for your ${storeName} account.` });
      else setMessage({ tone: "success", text: `Purchases restored. You're on ${res.plan === "pro" ? "Pro All Access" : "your Plus membership"}.` });
      router.refresh();
    } catch (err) {
      setMessage({ tone: "error", text: purchaseErrorMessage(err) ?? "Restore was cancelled." });
    } finally {
      setBusy(null);
    }
  }

  async function manage() {
    const url = (await client.current?.managementUrl().catch(() => null)) ?? MANAGE_FALLBACK[platform];
    window.open(url, "_blank", "noopener");
  }

  if (state === "unavailable") {
    return (
      <Notice tone="info">
        In-app purchases aren&apos;t available right now. Please update the app or try again later. Your current membership works everywhere you sign in.
      </Notice>
    );
  }

  const prices = storePrices(options);
  const shown: Interval = interval === "year" && options.year ? "year" : "month";
  const action = paywallAction(currentPlan, source, platform, shown, currentInterval);
  const pkg = options[shown];
  const managedHere = currentPlan !== "free" && source === (platform === "ios" ? "app_store" : "play_store");

  let proAction: React.ReactNode;
  if (state === "loading") proAction = <p className="text-sm text-muted-foreground">Loading {storeName} prices…</p>;
  else if (action === "elsewhere")
    proAction = <p className="text-sm text-muted-foreground">Your membership was purchased outside the {storeName}. Manage it where you subscribed; it works here too.</p>;
  else if (action === "current") proAction = <p className="text-sm text-muted-foreground">This is your current membership.</p>;
  else if (!pkg) proAction = <p className="text-sm text-muted-foreground">Not available in the {storeName} yet.</p>;
  else
    proAction = (
      <div className="space-y-2">
        <Button className="w-full" size="lg" disabled={busy !== null} onClick={() => buy(shown)} data-testid="store-buy">
          {busy === pkg.product.identifier
            ? `Opening the ${storeName}…`
            : action === "switch"
              ? `Switch to ${shown === "year" ? "yearly" : "monthly"} · ${pkg.product.priceString}`
              : `${action === "upgrade" ? "Upgrade to" : "Start"} Pro All Access · ${pkg.product.priceString} / ${shown}`}
        </Button>
        <p className="text-xs text-muted-foreground">
          {action === "switch"
            ? `The ${storeName} moves your membership to ${shown === "year" ? "yearly" : "monthly"} billing; it confirms when the change takes effect.`
            : `Pro All Access, billed ${shown === "month" ? "monthly" : "yearly"}. Renews automatically until cancelled.`}
        </p>
      </div>
    );

  return (
    <div className="space-y-4" aria-busy={state === "loading"}>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <MembershipPlans
        currentPlan={currentPlan}
        interval={interval}
        onIntervalChange={setInterval}
        prices={prices}
        comparison={comparison}
        proAction={proAction}
        footer={
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" disabled={busy !== null || state !== "ready"} onClick={restore}>
                {busy === "restore" ? "Restoring…" : "Restore purchases"}
              </Button>
              {managedHere && (
                <Button variant="secondary" onClick={manage}>
                  Manage subscription
                </Button>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {renewalTerms(platform)}{" "}
              <a href={legal.termsUrl} className="text-gold-highlight underline" target="_blank" rel="noopener">
                Terms of Service
              </a>{" "}
              ·{" "}
              <a href={legal.privacyUrl} className="text-gold-highlight underline" target="_blank" rel="noopener">
                Privacy Policy
              </a>
              {!legal.final && " (drafts awaiting legal review)"}
            </p>
          </div>
        }
      />
    </div>
  );
}
