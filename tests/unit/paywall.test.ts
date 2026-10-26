import {
  intervalForProduct,
  paywallAction,
  paywallOptions,
  planForProduct,
  purchaseErrorMessage,
  renewalTerms,
  storePrices,
  type PaywallPackage,
  type StoreProductIds,
} from "@/lib/billing/paywall";

const ids: StoreProductIds = {
  plus: { month: ["ngf_plus_monthly", "ngf_plus"], year: ["ngf_plus_yearly"] },
  pro: { month: ["ngf_pro_monthly"], year: ["ngf_pro_yearly"] },
};
const pkg = (id: string, price: string, extra: Partial<PaywallPackage["product"]> = {}): PaywallPackage => ({
  identifier: `$rc_${id}`,
  packageType: "CUSTOM",
  product: { identifier: id, priceString: price, ...extra },
});

describe("in-app paywall: Free and Pro All Access only", () => {
  const packages = [pkg("ngf_plus_monthly", "$11.99"), pkg("ngf_plus_yearly", "$99.99"), pkg("ngf_pro_monthly", "$19.99"), pkg("ngf_pro_yearly", "$149.99")];

  it("offers Pro All Access monthly and yearly, and never a Plus product", () => {
    const opts = paywallOptions(packages, ids);
    expect(opts.month?.product.priceString).toBe("$19.99");
    expect(opts.year?.product.priceString).toBe("$149.99");
    expect(JSON.stringify(opts)).not.toContain("ngf_plus");
  });

  it("shows the store's own localized prices, per-month equivalent and saving", () => {
    const opts = paywallOptions(
      [pkg("ngf_pro_monthly", "19,99 €", { price: 19.99, currencyCode: "EUR" }), pkg("ngf_pro_yearly", "149,99 €", { price: 149.99, currencyCode: "EUR", pricePerMonthString: "12,49 €" })],
      ids,
    );
    expect(storePrices(opts)).toEqual({ month: "19,99 €", year: "149,99 €", yearPerMonth: "12,49 €", savingsPercent: 37 });
    // Yearly not offered by the store yet: no yearly price and no made-up saving.
    expect(storePrices(paywallOptions([pkg("ngf_pro_monthly", "$19.99", { price: 19.99 })], ids))).toEqual({ month: "$19.99", year: null, yearPerMonth: null, savingsPercent: null });
  });

  it("understands Google Play's subscription:base-plan ids and legacy Plus products", () => {
    const opts = paywallOptions([pkg("ngf_pro_monthly:monthly", "$19.99")], ids);
    expect(opts.month?.product.identifier).toBe("ngf_pro_monthly:monthly");
    expect(planForProduct("ngf_plus:monthly", ids)).toBe("plus");
    expect(planForProduct("ngf_pro_yearly", ids)).toBe("pro");
    expect(planForProduct("something_else", ids)).toBeNull();
    expect(intervalForProduct("ngf_pro_yearly", ids)).toBe("year");
    expect(intervalForProduct("ngf_plus:monthly", ids)).toBe("month");
    expect(intervalForProduct("something_else", ids)).toBeNull();
  });

  it("never offers a second subscription to someone billed elsewhere; offers buy, upgrade and interval switches", () => {
    expect(paywallAction("free", "default", "ios", "month", null)).toBe("buy");
    expect(paywallAction("plus", "app_store", "ios", "month", "month")).toBe("upgrade");
    expect(paywallAction("pro", "app_store", "ios", "month", "month")).toBe("current");
    expect(paywallAction("pro", "app_store", "ios", "year", "month")).toBe("switch");
    expect(paywallAction("pro", "play_store", "android", "month", "year")).toBe("switch");
    expect(paywallAction("pro", "stripe", "ios", "year", null)).toBe("elsewhere");
    expect(paywallAction("plus", "play_store", "ios", "month", "month")).toBe("elsewhere");
    expect(paywallAction("pro", "app_store", "android", "month", "month")).toBe("elsewhere");
    // An admin grant isn't a store subscription: Plus may buy Pro; Pro has nothing to buy.
    expect(paywallAction("plus", "admin", "ios", "month", null)).toBe("upgrade");
    expect(paywallAction("pro", "admin", "ios", "month", null)).toBe("current");
  });

  it("explains purchase errors and treats a cancel as no error", () => {
    expect(purchaseErrorMessage({ code: "1", userCancelled: true })).toBeNull();
    expect(purchaseErrorMessage({ code: "1" })).toBeNull();
    expect(purchaseErrorMessage({ code: "20" })).toMatch(/waiting for approval/);
    expect(purchaseErrorMessage({ code: "6" })).toMatch(/Restore purchases/);
    expect(purchaseErrorMessage({ code: "7" })).toMatch(/another Narrow Gate account/);
    expect(purchaseErrorMessage(new Error("boom"))).toMatch(/haven't been charged/);
    expect(purchaseErrorMessage(undefined)).toMatch(/haven't been charged/);
  });

  it("states renewal, cancellation and refund terms per channel, including that deleting the app doesn't cancel", () => {
    expect(renewalTerms("ios")).toMatch(/renews automatically.*24 hours/);
    expect(renewalTerms("ios")).toMatch(/does not cancel/);
    expect(renewalTerms("android")).toMatch(/Google Play.*does not cancel/);
    expect(renewalTerms("web")).toMatch(/Manage billing.*won't be charged again/);
  });
});

describe("default store product ids", () => {
  it("match the App Store products and Google Play's ngf_pro base plans, each to its own interval", async () => {
    const { storeProductIds } = await import("@/server/services/store-billing");
    const defaults = storeProductIds();
    const store = [pkg("ngf_pro:monthly", "$19.99"), pkg("ngf_pro:yearly", "$149.99")];
    expect(paywallOptions(store, defaults)).toMatchObject({ month: { product: { identifier: "ngf_pro:monthly" } }, year: { product: { identifier: "ngf_pro:yearly" } } });
    const apple = [pkg("ngf_pro_monthly", "$19.99"), pkg("ngf_pro_yearly", "$149.99")];
    expect(paywallOptions(apple, defaults)).toMatchObject({ month: { product: { identifier: "ngf_pro_monthly" } }, year: { product: { identifier: "ngf_pro_yearly" } } });
    for (const id of ["ngf_pro:monthly", "ngf_pro_monthly"]) expect(intervalForProduct(id, defaults)).toBe("month");
    for (const id of ["ngf_pro:yearly", "ngf_pro_yearly"]) expect(intervalForProduct(id, defaults)).toBe("year");
    expect(planForProduct("ngf_pro:yearly", defaults)).toBe("pro");
  });
});
