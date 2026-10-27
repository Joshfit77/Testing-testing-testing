import "server-only";

/** Server-only secrets. Never import this module from client components. */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  aiModel: process.env.AI_MODEL || "claude-opus-5-5",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePricePlus: process.env.STRIPE_PRICE_PLUS ?? "",
  stripePricePro: process.env.STRIPE_PRICE_PRO ?? "",
  stripePriceProYearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",
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
  /** Public SDK keys for the native apps (safe to expose; they can't read or change other customers). */
  revenueCatPublicKeyIos: process.env.REVENUECAT_PUBLIC_KEY_IOS ?? "",
  revenueCatPublicKeyAndroid: process.env.REVENUECAT_PUBLIC_KEY_ANDROID ?? "",
};

export const isAiConfigured = () => Boolean(serverEnv.anthropicApiKey);
/** Checkout needs the secret key and the Pro monthly price. STRIPE_PRICE_PLUS is only needed to recognise legacy Plus subscriptions. */
export const isStripeConfigured = () => Boolean(serverEnv.stripeSecretKey && serverEnv.stripePricePro);
export const isYearlyBillingConfigured = () => Boolean(isStripeConfigured() && serverEnv.stripePriceProYearly);
export const isStripeWebhookConfigured = () => Boolean(serverEnv.stripeSecretKey && serverEnv.stripeWebhookSecret);
export const isServiceRoleConfigured = () => Boolean(serverEnv.supabaseServiceRoleKey);
export const isFoodSearchConfigured = () => Boolean(serverEnv.usdaApiKey);
export const isRevenueCatConfigured = () => Boolean(serverEnv.revenueCatSecretKey);
export const isRevenueCatWebhookConfigured = () => Boolean(serverEnv.revenueCatSecretKey && serverEnv.revenueCatWebhookAuth);
