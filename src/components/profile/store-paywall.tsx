"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Notice } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  paywallAction,
  paywallOptions,
  purchaseErrorMessage,
  renewalTerms,
  type BillingSource,
  type Interval,
  type PaidPlan,
  type PaywallOptions,
  type PaywallPackage,
  type StoreProductIds,
} from "@/lib/billing/paywall";
import { connectStore, type StoreClient } from "@/lib/billing/store-purchases";
import type { Plan } from "@/lib/domain/types";
import { syncStorePurchasesAction } from "@/server/actions/store-billing";

export interface StorePaywallProps {
  userId: string;
  platform: "ios" | "android";
  apiKey: string;
  currentPlan: Plan;
  source: BillingSource;
  /** The store product the member currently subscribes to here, if any (Google Play upgrades must name it). */
  currentProductId: string | null;
  productIds: StoreProductIds;
  yearly: Record<PaidPlan, boolean>;
  plans: Record<PaidPlan, { name: string; tagline: string; highlights: string[] }>;
  legal: { termsUrl: string; privacyUrl: string; final: boolean };
}

/** Plans sold in the app. Plus is a legacy web plan; it still shows as "current" for members who have it on the web. */
const OFFERED = ["pro"] as const;

const MANAGE_FALLBACK = {
  ios: "https://apps.apple.com/account/subscriptions",
  android: "https://play.google.com/store/account/subscriptions",
};

/**
 * In-app subscription screen for the iOS and Android apps (App Store / Google Play through RevenueCat). Shows
 * each plan with the store's localized renewal price, the renewal terms, Terms and Privacy links, and Restore
 * purchases (App Store guidelines 3.1.1 and 3.1.2). After a purchase or restore the server re-reads the member's
 * purchases from RevenueCat; the plan never changes on the app's word alone.
 */
export function StorePaywall(props: StorePaywallProps) {
  const { userId, platform, apiKey, currentPlan, source, currentProductId, productIds, yearly, plans, legal } = props;
  const router = useRouter();
  const client = useRef<StoreClient | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [options, setOptions] = useState<PaywallOptions>({ plus: {}, pro: {} });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);
  const storeName = platform === "ios" ? "App Store" : "Google Play";
  // Compared by value: the page passes new objects on every refresh, which mustn't reload the store.
  const configKey = JSON.stringify({ productIds, yearly });

  useEffect(() => {
    const config = JSON.parse(configKey) as Pick<StorePaywallProps, "productIds" | "yearly">;
    let cancelled = false;
    (async () => {
      const c = await connectStore(apiKey, userId);
      if (cancelled) return;
      if (!c) return setState("unavailable");
      client.current = c;
      try {
        const packages = await c.packages();
        if (cancelled) return;
        setOptions(paywallOptions(packages, config.productIds, config.yearly));
        setState("ready");
      } catch {
        if (!cancelled) setState("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey, userId, configKey]);

  async function refreshFromServer(successText: (plan: Plan) => string | null) {
    const res = await syncStorePurchasesAction();
    if (!res.ok) {
      setMessage({ tone: "error", text: res.error });
      return;
    }
    const text = successText(res.plan);
    setMessage(text ? { tone: "success", text } : { tone: "info", text: "Purchase received. Your plan will update in a moment — pull down to refresh if it hasn't." });
    router.refresh();
  }

  async function buy(plan: PaidPlan, pkg: PaywallPackage) {
    if (!client.current) return;
    setBusy(pkg.product.identifier);
    setMessage(null);
    try {
      await client.current.purchase(pkg, { oldProductId: currentProductId ?? undefined });
      await refreshFromServer((p) => (p === plan || (plan === "plus" && p === "pro") ? `You're on ${plans[plan].name}. Thank you!` : null));
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
      else if (res.plan === "free") setMessage({ tone: "info", text: `No active subscriptions were found for your ${storeName} account.` });
      else setMessage({ tone: "success", text: `Purchases restored. You're on ${res.plan === "pro" ? plans.pro.name : plans.plus.name}.` });
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
        In-app purchases aren&apos;t available right now. Please update the app or try again later. Your current plan works everywhere you sign in.
      </Notice>
    );
  }

  const elsewhere = paywallAction(currentPlan, source, platform, "pro") === "elsewhere";
  const managedHere = currentPlan !== "free" && source === (platform === "ios" ? "app_store" : "play_store");

  return (
    <section className="space-y-4" aria-labelledby="store-plans-title" aria-busy={state === "loading"}>
      <h2 id="store-plans-title" className="sr-only">
        Subscribe in the app
      </h2>
      {elsewhere && (
        <Notice tone="info">Your subscription was purchased outside the {storeName}. Manage it where you subscribed; it works here too.</Notice>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {state === "loading" && <p className="text-sm text-muted-foreground">Loading {storeName} prices…</p>}
      {state === "ready" && !elsewhere && (
        <ul className="grid gap-4">
          {OFFERED.map((plan) => {
            const action = paywallAction(currentPlan, source, platform, plan);
            const intervals = (["month", "year"] as Interval[]).filter((i) => options[plan][i]);
            return (
              <li key={plan} className={action === "current" ? "rounded-2xl border border-gold bg-card-gradient p-5" : "rounded-2xl border border-border bg-card p-5"}>
                <div className="flex items-center justify-between">
                  <p className="font-display text-xl font-semibold uppercase tracking-wider">{plans[plan].name}</p>
                  {action === "current" && <Badge>Current</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{plans[plan].tagline}</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {plans[plan].highlights.map((h) => (
                    <li key={h} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden /> {h}
                    </li>
                  ))}
                </ul>
                {intervals.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Not available in the {storeName} yet.</p>}
                {(action === "buy" || action === "upgrade") && (
                  <div className="mt-4 space-y-3">
                    {intervals.map((interval) => {
                      const pkg = options[plan][interval]!;
                      return (
                        <div key={interval}>
                          <p className="text-2xl font-bold">
                            {pkg.product.priceString}
                            <span className="text-sm font-normal text-muted-foreground"> / {interval}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {plans[plan].name}, billed {interval === "month" ? "monthly" : "yearly"}. Renews automatically until cancelled.
                          </p>
                          <Button className="mt-2 w-full" variant={interval === "month" ? "default" : "secondary"} disabled={busy !== null} onClick={() => buy(plan, pkg)}>
                            {busy === pkg.product.identifier
                              ? "Opening the " + storeName + "…"
                              : `${action === "upgrade" ? "Upgrade to" : "Subscribe to"} ${plans[plan].name} ${interval === "month" ? "monthly" : "yearly"}`}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {action === "included" && <p className="mt-4 text-xs text-muted-foreground">Included in your current plan.</p>}
              </li>
            );
          })}
        </ul>
      )}
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
      <p className="text-xs text-muted-foreground">
        {renewalTerms(platform)}{" "}
        <a href={legal.termsUrl} className="text-gold-highlight underline" target="_blank" rel="noopener">
          Terms of Use
        </a>{" "}
        ·{" "}
        <a href={legal.privacyUrl} className="text-gold-highlight underline" target="_blank" rel="noopener">
          Privacy Policy
        </a>
        {!legal.final && " (drafts awaiting legal review)"}
      </p>
    </section>
  );
}
