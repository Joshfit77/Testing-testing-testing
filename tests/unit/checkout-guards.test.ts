// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Checkout guards from the 2026-11-12 independent billing review:
 * - the price check uses the owner-approved price fixed in code ($17.99), so an environment override of the display
 *   price can't make an unapproved Stripe price chargeable;
 * - a checkout left open in another tab is expired before a new one is created, so a member can't pay twice.
 */
const state = { unitAmount: 1799, open: [{ id: "cs_old_1" }, { id: "cs_old_2" }] as { id: string }[] };
const expire = vi.fn(async (id: string) => ({ id }));
const create = vi.fn(async () => ({ url: "https://checkout.stripe.com/c/pay/cs_new" }));
vi.mock("stripe", () => ({
  default: class {
    prices = { retrieve: async (id: string) => ({ id, unit_amount: state.unitAmount, currency: "usd", recurring: { interval: "month" }, active: true }) };
    subscriptions = { list: async () => ({ data: [] }) };
    checkout = { sessions: { list: async () => ({ data: state.open }), expire: (id: string) => expire(id), create: () => create() } };
  },
}));
vi.mock("@/server/env", () => ({
  isServiceRoleConfigured: () => true,
  serverEnv: { stripeSecretKey: "sk_test_x", stripePricePro: "price_pro_month", stripePriceProYearly: "", stripePricePlus: "", stripePricePlusYearly: "", stripeLegacyPricesPro: [], stripeLegacyPricesPlus: [] },
  publicEnv: { siteUrl: "http://localhost:3000" },
}));
vi.mock("@/lib/env", () => ({ publicEnv: { siteUrl: "http://localhost:3000" } }));
vi.mock("@/lib/supabase/server", () => ({
  getServiceSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { stripe_customer_id: "cus_1" }, error: null }) }) }) }) }),
}));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));
vi.mock("@/server/services/webhook-events", () => ({ claimWebhookEvent: vi.fn(), processClaimedEvent: vi.fn() }));
vi.mock("@/server/services/sandbox-testers", () => ({ sandboxPurchasesAllowed: vi.fn(async () => false) }));

beforeEach(() => {
  vi.resetModules();
  expire.mockClear();
  create.mockClear();
  delete process.env.PLAN_PRO_PRICE_CENTS;
});

describe("checkout guards", () => {
  it("expires every open checkout of the customer before creating the new one", async () => {
    state.unitAmount = 1799;
    const { createCheckoutSession } = await import("@/server/services/billing");
    await expect(createCheckoutSession("u1", "a@example.test", "pro", "month")).resolves.toContain("checkout.stripe.com");
    expect(expire.mock.calls.map((c) => c[0])).toEqual(["cs_old_1", "cs_old_2"]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(expire.mock.invocationCallOrder.at(-1)!).toBeLessThan(create.mock.invocationCallOrder[0]!);
  });

  it("refuses a Stripe price other than $17.99 even when the display price is overridden to match it", async () => {
    state.unitAmount = 2499;
    process.env.PLAN_PRO_PRICE_CENTS = "2499";
    const { createCheckoutSession, PriceMismatchError } = await import("@/server/services/billing");
    await expect(createCheckoutSession("u1", "a@example.test", "pro", "month")).rejects.toBeInstanceOf(PriceMismatchError);
    expect(create).not.toHaveBeenCalled();
  });
});
