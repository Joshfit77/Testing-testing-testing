import { paywallAction, paywallOptions, planForProduct, purchaseErrorMessage, renewalTerms, type PaywallPackage, type StoreProductIds } from "@/lib/billing/paywall";

const ids: StoreProductIds = {
  plus: { month: ["ngf_plus_monthly", "ngf_plus"], year: ["ngf_plus_yearly"] },
  pro: { month: ["ngf_pro_monthly"], year: ["ngf_pro_yearly"] },
};
const pkg = (id: string, price: string): PaywallPackage => ({ identifier: `$rc_${id}`, packageType: "CUSTOM", product: { identifier: id, priceString: price } });

describe("in-app paywall", () => {
  const packages = [pkg("ngf_plus_monthly", "$11.99"), pkg("ngf_plus_yearly", "$99.99"), pkg("ngf_pro_monthly", "$24.99"), pkg("ngf_pro_yearly", "$249.99")];

  it("matches store products to plans and hides yearly until it's switched on", () => {
    const hidden = paywallOptions(packages, ids, { plus: false, pro: false });
    expect(hidden.plus.month?.product.priceString).toBe("$11.99");
    expect(hidden.pro.month?.product.priceString).toBe("$24.99");
    expect(hidden.plus.year).toBeUndefined();
    expect(hidden.pro.year).toBeUndefined();
    const shown = paywallOptions(packages, ids, { plus: true, pro: true });
    expect(shown.plus.year?.product.priceString).toBe("$99.99");
    expect(shown.pro.year?.product.priceString).toBe("$249.99");
  });

  it("understands Google Play's subscription:base-plan product ids", () => {
    const opts = paywallOptions([pkg("ngf_plus:monthly", "$11.99")], ids, { plus: false, pro: false });
    expect(opts.plus.month?.product.identifier).toBe("ngf_plus:monthly");
    expect(planForProduct("ngf_plus:monthly", ids)).toBe("plus");
    expect(planForProduct("ngf_pro_yearly", ids)).toBe("pro");
    expect(planForProduct("something_else", ids)).toBeNull();
  });

  it("never offers a second subscription to someone billed elsewhere, and offers upgrades", () => {
    expect(paywallAction("free", "default", "ios", "plus")).toBe("buy");
    expect(paywallAction("plus", "app_store", "ios", "pro")).toBe("upgrade");
    expect(paywallAction("plus", "app_store", "ios", "plus")).toBe("current");
    expect(paywallAction("pro", "app_store", "ios", "plus")).toBe("included");
    expect(paywallAction("plus", "stripe", "ios", "pro")).toBe("elsewhere");
    expect(paywallAction("plus", "play_store", "ios", "pro")).toBe("elsewhere");
    expect(paywallAction("plus", "app_store", "android", "pro")).toBe("elsewhere");
    // An admin grant isn't a store subscription; buying is allowed.
    expect(paywallAction("plus", "admin", "ios", "pro")).toBe("upgrade");
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

  it("states the renewal terms for each store", () => {
    expect(renewalTerms("ios")).toMatch(/renew automatically.*24 hours/);
    expect(renewalTerms("android")).toMatch(/Google Play/);
  });
});
