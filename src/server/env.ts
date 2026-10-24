import "server-only";

function listEnv(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((v) => v.trim()).filter(Boolean);
}

/**
 * Live Stripe keys stay switched off until the owner approves real charges with STRIPE_LIVE_APPROVED=true; until
 * then checkout and the webhook behave as unconfigured, so a test or TestFlight deployment can't take real money.
 * Test keys (sk_test_) always work.
 */
function stripeSecretKey(raw: string | undefined): string {
  const key = raw ?? "";
  return /^(sk|rk)_live_/.test(key) && process.env.STRIPE_LIVE_APPROVED !== "true" ? "" : key;
}

/** Server-only secrets. Never import this module from client components. */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  stripeSecretKey: stripeSecretKey(process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePricePlus: process.env.STRIPE_PRICE_PLUS ?? "",
  stripePricePro: process.env.STRIPE_PRICE_PRO ?? "",
  stripePricePlusYearly: process.env.STRIPE_PRICE_PLUS_YEARLY ?? "",
  stripePriceProYearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",
  /**
   * Earlier Stripe prices that existing subscriptions may still be on (comma-separated). When new prices are
   * created, move the old IDs here so renewals of existing subscriptions keep mapping to the right plan.
   */
  stripeLegacyPricesPlus: listEnv(process.env.STRIPE_PRICE_PLUS_LEGACY),
  stripeLegacyPricesPro: listEnv(process.env.STRIPE_PRICE_PRO_LEGACY),
  usdaApiKey: process.env.USDA_FDC_API_KEY ?? "",
  /** RevenueCat (App Store / Google Play). The secret key reads customers server-side; never send it to the app. */
  revenueCatSecretKey: process.env.REVENUECAT_SECRET_API_KEY ?? "",
  /** The exact Authorization header value set for the webhook in the RevenueCat dashboard. */
  revenueCatWebhookAuth: process.env.REVENUECAT_WEBHOOK_AUTH ?? "",
  revenueCatApiBaseUrl: (process.env.REVENUECAT_API_BASE_URL ?? "https://api.revenuecat.com").replace(/\/$/, ""),
  revenueCatEntitlementPlus: process.env.REVENUECAT_ENTITLEMENT_PLUS || "plus",
  revenueCatEntitlementPro: process.env.REVENUECAT_ENTITLEMENT_PRO || "pro",
  /** Count purchases made with RevenueCat's Test Store (development builds only). Never enable in production. */
  revenueCatAllowTestStore: process.env.REVENUECAT_ALLOW_TEST_STORE === "true",
  /** Count App Store / Play sandbox purchases (TestFlight and internal-testing builds). Never enable in production. */
  revenueCatAllowSandbox: process.env.REVENUECAT_ALLOW_SANDBOX === "true",
  /** Public SDK keys for the native apps (safe to expose; they can't read or change other customers). */
  revenueCatPublicKeyIos: process.env.REVENUECAT_PUBLIC_KEY_IOS ?? "",
  revenueCatPublicKeyAndroid: process.env.REVENUECAT_PUBLIC_KEY_ANDROID ?? "",
};

export const isAiConfigured = () => Boolean(serverEnv.anthropicApiKey);
export const isStripeConfigured = () => Boolean(serverEnv.stripeSecretKey && serverEnv.stripePricePlus && serverEnv.stripePricePro);
/** A yearly Stripe price exists for the plan. The yearly option is shown only when yearly billing is also switched on. */
export const isYearlyBillingConfigured = (plan: "plus" | "pro") =>
  Boolean(isStripeConfigured() && (plan === "pro" ? serverEnv.stripePriceProYearly : serverEnv.stripePricePlusYearly));
export const isStripeWebhookConfigured = () => Boolean(serverEnv.stripeSecretKey && serverEnv.stripeWebhookSecret);
export const isServiceRoleConfigured = () => Boolean(serverEnv.supabaseServiceRoleKey);
export const isRevenueCatConfigured = () => Boolean(serverEnv.revenueCatSecretKey);
export const isRevenueCatWebhookConfigured = () => Boolean(serverEnv.revenueCatSecretKey && serverEnv.revenueCatWebhookAuth);
export const isFoodSearchConfigured = () => Boolean(serverEnv.usdaApiKey);
