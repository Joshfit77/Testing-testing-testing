"use client";

import type { PaywallPackage } from "@/lib/billing/paywall";
import { isNativeApp } from "@/lib/native";

/**
 * Thin client over the RevenueCat Capacitor plugin (App Store / Google Play purchases). Only used inside the native
 * app; in a browser `connectStore` returns null. The plugin only carries out purchases: what someone owns is
 * always read back on the server from RevenueCat.
 */
export interface StoreClient {
  packages(): Promise<PaywallPackage[]>;
  /** `oldProductId` lets Google Play replace the current subscription when upgrading (ignored on iOS). */
  purchase(pkg: PaywallPackage, options?: { oldProductId?: string }): Promise<void>;
  restore(): Promise<void>;
  managementUrl(): Promise<string | null>;
}

export async function connectStore(apiKey: string, appUserID: string): Promise<StoreClient | null> {
  if (!apiKey || !isNativeApp()) return null;
  let Purchases: typeof import("@revenuecat/purchases-capacitor").Purchases;
  try {
    ({ Purchases } = await import("@revenuecat/purchases-capacitor"));
    const { isConfigured } = await Purchases.isConfigured();
    if (!isConfigured) {
      await Purchases.configure({ apiKey, appUserID });
    } else {
      const { appUserID: current } = await Purchases.getAppUserID();
      if (current !== appUserID) await Purchases.logIn({ appUserID });
    }
  } catch {
    // An app build without the purchases plugin, or the store is unreachable.
    return null;
  }
  const isAndroid = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === "android";
  return {
    async packages() {
      const offerings = await Purchases.getOfferings();
      const all = [offerings.current, ...Object.values(offerings.all ?? {})].flatMap((o) => o?.availablePackages ?? []);
      const seen = new Set<string>();
      return all.filter((p) => !seen.has(p.product.identifier) && seen.add(p.product.identifier));
    },
    async purchase(pkg, options = {}) {
      await Purchases.purchasePackage({
        aPackage: pkg as Parameters<typeof Purchases.purchasePackage>[0]["aPackage"],
        googleProductChangeInfo: isAndroid && options.oldProductId ? { oldProductIdentifier: options.oldProductId } : null,
      });
    },
    async restore() {
      await Purchases.restorePurchases();
    },
    async managementUrl() {
      const { customerInfo } = await Purchases.getCustomerInfo();
      return customerInfo.managementURL ?? null;
    },
  };
}
