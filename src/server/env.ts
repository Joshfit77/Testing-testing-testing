import "server-only";

function listEnv(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((v) => v.trim()).filter(Boolean);
}

/** Server-only secrets. Never import this module from client components. */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
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
};

export const isAiConfigured = () => Boolean(serverEnv.anthropicApiKey);
export const isStripeConfigured = () => Boolean(serverEnv.stripeSecretKey && serverEnv.stripePricePlus && serverEnv.stripePricePro);
/** A yearly Stripe price exists for the plan. The yearly option is shown only when yearly billing is also switched on. */
export const isYearlyBillingConfigured = (plan: "plus" | "pro") =>
  Boolean(isStripeConfigured() && (plan === "pro" ? serverEnv.stripePriceProYearly : serverEnv.stripePricePlusYearly));
export const isStripeWebhookConfigured = () => Boolean(serverEnv.stripeSecretKey && serverEnv.stripeWebhookSecret);
export const isServiceRoleConfigured = () => Boolean(serverEnv.supabaseServiceRoleKey);
export const isFoodSearchConfigured = () => Boolean(serverEnv.usdaApiKey);
