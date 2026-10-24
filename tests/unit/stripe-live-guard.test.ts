/** Live Stripe keys are ignored until the owner approves real charges (src/server/env.ts). */
async function loadEnv() {
  vi.resetModules();
  return import("@/server/env");
}

describe("Stripe live-key guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses test keys as they are", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_PRICE_PLUS", "price_plus");
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
    const env = await loadEnv();
    expect(env.serverEnv.stripeSecretKey).toBe("sk_test_123");
    expect(env.isStripeConfigured()).toBe(true);
  });

  it.each(["sk_live_123", "rk_live_123"])("switches checkout off for a live key (%s) without approval", async (key) => {
    vi.stubEnv("STRIPE_SECRET_KEY", key);
    vi.stubEnv("STRIPE_PRICE_PLUS", "price_plus");
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
    vi.stubEnv("STRIPE_LIVE_APPROVED", "");
    const env = await loadEnv();
    expect(env.serverEnv.stripeSecretKey).toBe("");
    expect(env.isStripeConfigured()).toBe(false);
    expect(env.isStripeWebhookConfigured()).toBe(false);
  });

  it("uses a live key once STRIPE_LIVE_APPROVED=true", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_123");
    vi.stubEnv("STRIPE_LIVE_APPROVED", "true");
    expect((await loadEnv()).serverEnv.stripeSecretKey).toBe("sk_live_123");
  });
});
