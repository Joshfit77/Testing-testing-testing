import { describe, expect, it } from "vitest";
import { stripePriceProblems, type StripePriceInfo } from "@/server/services/billing";

/** Checkout starts only for a Stripe price that matches the approved price exactly (billing review F6). */
describe("Stripe price guard", () => {
  const ok: StripePriceInfo = { id: "price_m", unitAmount: 2499, currency: "usd", interval: "month", active: true, intervalCount: 1, usageType: "licensed", extraCurrencies: [] };

  it("accepts exactly $24.99 a month and $149.99 a year", () => {
    expect(stripePriceProblems(ok, "month", 2499)).toEqual([]);
    expect(stripePriceProblems({ ...ok, id: "price_y", unitAmount: 14999, interval: "year" }, "year", 14999)).toEqual([]);
  });

  it("refuses a wrong amount, currency, interval or an archived price", () => {
    expect(stripePriceProblems({ ...ok, unitAmount: 1799 }, "month", 2499)).toHaveLength(1);
    expect(stripePriceProblems({ ...ok, currency: "eur" }, "month", 2499)).toHaveLength(1);
    expect(stripePriceProblems({ ...ok, interval: "year" }, "month", 2499)).toHaveLength(1);
    expect(stripePriceProblems({ ...ok, active: false }, "month", 2499)).toHaveLength(1);
    expect(stripePriceProblems(null, "month", 2499)).toHaveLength(1);
  });

  it("refuses the right amount billed every 3 months, metered, or with other currencies", () => {
    expect(stripePriceProblems({ ...ok, intervalCount: 3 }, "month", 2499).join(" ")).toMatch(/every 3 months/);
    expect(stripePriceProblems({ ...ok, usageType: "metered" }, "month", 2499).join(" ")).toMatch(/metered/);
    expect(stripePriceProblems({ ...ok, extraCurrencies: ["eur"] }, "month", 2499).join(" ")).toMatch(/EUR/);
  });
});
