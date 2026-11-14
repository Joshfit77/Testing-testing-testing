// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Starting a web checkout or opening the billing portal makes several calls to Stripe with the account's secret key
 * (and a checkout also records an auto-renewal consent). Stripe limits requests per account, and the webhooks need
 * the same allowance to read subscriptions, so one signed-in member repeating these actions must be stopped by the
 * server long before that: each is limited per member, and a refused attempt reaches neither Stripe nor the consent
 * record.
 */
const state = { rateOk: true };
const rateLimit = vi.fn(async (_key: string, _limit: number, _windowMs: number) => ({ ok: state.rateOk, retryAfterSeconds: state.rateOk ? 0 : 60 }));
const createCheckoutSession = vi.fn(async () => "https://checkout.stripe.com/c/pay/cs_test");
const createPortalSession = vi.fn(async () => "https://billing.stripe.com/p/session/test");
const stripeProPrices = vi.fn(async () => ({ month: { id: "price_m", unitAmount: 1799, currency: "usd", interval: "month", active: true } }));
const recordAcceptances = vi.fn(async () => undefined);
class Redirect extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock("@/server/auth", () => ({ requireUser: vi.fn(async () => ({ id: "member-1", email: "member@example.test" })), getUserPlan: vi.fn(async () => "free") }));
vi.mock("@/server/env", () => ({ isStripeConfigured: () => true, isServiceRoleConfigured: () => true, isYearlyBillingConfigured: () => true }));
vi.mock("@/server/native", () => ({ getNativePlatform: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: vi.fn(async () => ({})) }));
vi.mock("@/server/legal", () => ({ recordAcceptances: (...a: unknown[]) => recordAcceptances(...(a as [])) }));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));
vi.mock("@/server/rate-limit", () => ({ rateLimit: (key: string, limit: number, windowMs: number) => rateLimit(key, limit, windowMs) }));
vi.mock("@/server/services/billing", () => ({
  createCheckoutSession: (...a: unknown[]) => createCheckoutSession(...(a as [])),
  createPortalSession: (...a: unknown[]) => createPortalSession(...(a as [])),
  stripeProPrices: () => stripeProPrices(),
  AlreadySubscribedError: class extends Error {},
  PriceMismatchError: class extends Error {},
}));

const { startCheckoutAction, openBillingPortalAction } = await import("@/server/actions/billing");
const idle = { ok: false };

function checkoutForm() {
  const form = new FormData();
  form.set("plan", "pro");
  form.set("interval", "month");
  form.set("renewalConsent", "on");
  return form;
}

beforeEach(() => {
  state.rateOk = true;
  vi.clearAllMocks();
});

describe("web checkout and billing portal are rate-limited per member", () => {
  it("a checkout within the limit goes to Stripe, counted against the signed-in member", async () => {
    await expect(startCheckoutAction(idle, checkoutForm())).rejects.toMatchObject({ url: "https://checkout.stripe.com/c/pay/cs_test" });
    expect(rateLimit).toHaveBeenCalledTimes(1);
    expect(rateLimit.mock.calls[0]![0]).toBe("checkout:member-1");
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("a checkout over the limit is refused before the price is read, a consent recorded or a session created", async () => {
    state.rateOk = false;
    const result = await startCheckoutAction(idle, checkoutForm());
    expect(result).toMatchObject({ ok: false });
    expect(stripeProPrices).not.toHaveBeenCalled();
    expect(recordAcceptances).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("an invalid submission doesn't use up the member's attempts", async () => {
    const form = checkoutForm();
    form.delete("renewalConsent");
    expect(await startCheckoutAction(idle, form)).toMatchObject({ ok: false });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("the billing portal is limited the same way", async () => {
    await expect(openBillingPortalAction(idle)).rejects.toMatchObject({ url: "https://billing.stripe.com/p/session/test" });
    expect(rateLimit.mock.calls[0]![0]).toBe("billing-portal:member-1");
    state.rateOk = false;
    createPortalSession.mockClear();
    expect(await openBillingPortalAction(idle)).toMatchObject({ ok: false });
    expect(createPortalSession).not.toHaveBeenCalled();
  });
});
