// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A subscription's "Monthly" / "Yearly" label comes from what is actually known about its price: the configured
 * current prices, or Stripe itself for a legacy price. A legacy yearly price is never called monthly.
 */
const retrieve = vi.fn();
vi.mock("stripe", () => ({
  default: class {
    prices = { retrieve: (...args: unknown[]) => retrieve(...args) };
  },
}));
vi.mock("@/server/env", () => ({
  isServiceRoleConfigured: () => true,
  serverEnv: {
    stripeSecretKey: "sk_test_x",
    stripePricePro: "price_pro_month",
    stripePriceProYearly: "price_pro_year",
    stripePricePlus: "price_plus_month",
    stripePricePlusYearly: "",
    stripeLegacyPricesPro: ["price_old_pro_month", "price_old_pro_year", "price_old_unreadable"],
    stripeLegacyPricesPlus: ["price_old_plus"],
  },
}));
vi.mock("@/lib/supabase/server", () => ({ getServiceSupabase: () => ({}) }));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));
vi.mock("@/server/services/webhook-events", () => ({ claimWebhookEvent: vi.fn(), processClaimedEvent: vi.fn() }));
vi.mock("@/server/services/sandbox-testers", () => ({ sandboxPurchasesAllowed: vi.fn(async () => false) }));

const { intervalForPriceId, planForPriceId, resolvePriceInterval } = await import("@/server/services/billing");

beforeEach(() => {
  retrieve.mockReset().mockImplementation(async (id: string) => {
    if (id === "price_old_unreadable") throw new Error("No such price");
    return { id, recurring: { interval: id.endsWith("year") ? "year" : "month" } };
  });
});

describe("the billing interval of a Stripe price", () => {
  it("is known for the configured current prices", () => {
    expect(intervalForPriceId("price_pro_month")).toBe("month");
    expect(intervalForPriceId("price_plus_month")).toBe("month");
    expect(intervalForPriceId("price_pro_year")).toBe("year");
  });

  it("is not guessed for a legacy price, a missing one or an unknown one", () => {
    expect(planForPriceId("price_old_pro_year")).toBe("pro");
    expect(intervalForPriceId("price_old_pro_year")).toBeNull();
    expect(intervalForPriceId("price_old_plus")).toBeNull();
    expect(intervalForPriceId("")).toBeNull();
    expect(intervalForPriceId(null)).toBeNull();
    expect(intervalForPriceId("price_someone_elses")).toBeNull();
  });

  it("is read from Stripe for a legacy price (once), and stays unknown when Stripe can't be read", async () => {
    expect(await resolvePriceInterval("price_pro_year")).toBe("year");
    expect(retrieve).not.toHaveBeenCalled();
    expect(await resolvePriceInterval("price_old_pro_year")).toBe("year");
    expect(await resolvePriceInterval("price_old_pro_year")).toBe("year");
    expect(await resolvePriceInterval("price_old_pro_month")).toBe("month");
    expect(retrieve).toHaveBeenCalledTimes(2);
    expect(await resolvePriceInterval("price_old_unreadable")).toBeNull();
    expect(await resolvePriceInterval(null)).toBeNull();
  });
});
