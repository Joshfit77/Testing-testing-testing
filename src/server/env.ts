import "server-only";

/** Server-only secrets. Never import this module from client components. */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePricePlus: process.env.STRIPE_PRICE_PLUS ?? "",
  stripePricePro: process.env.STRIPE_PRICE_PRO ?? "",
  stripePriceProYearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",
  usdaApiKey: process.env.USDA_FDC_API_KEY ?? "",
};

export const isAiConfigured = () => Boolean(serverEnv.anthropicApiKey);
export const isStripeConfigured = () => Boolean(serverEnv.stripeSecretKey && serverEnv.stripePricePlus && serverEnv.stripePricePro);
export const isYearlyBillingConfigured = () => Boolean(isStripeConfigured() && serverEnv.stripePriceProYearly);
export const isStripeWebhookConfigured = () => Boolean(serverEnv.stripeSecretKey && serverEnv.stripeWebhookSecret);
export const isServiceRoleConfigured = () => Boolean(serverEnv.supabaseServiceRoleKey);
export const isFoodSearchConfigured = () => Boolean(serverEnv.usdaApiKey);
