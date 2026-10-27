import { checkStripePrice, displayedPriceCents } from "@/server/services/billing";

const price = (over: Partial<Parameters<typeof checkStripePrice>[0]> = {}) => ({
  active: true,
  currency: "usd",
  unit_amount: 1999,
  recurring: { interval: "month", interval_count: 1 } as never,
  ...over,
});

describe("checkout refuses a Stripe price that differs from the displayed one", () => {
  it("shows the approved Pro prices by default", () => {
    expect(displayedPriceCents("pro", "month")).toBe(1999);
    expect(displayedPriceCents("pro", "year")).toBe(14999);
  });
  it("accepts a matching monthly price", () => {
    expect(checkStripePrice(price(), 1999, "month")).toBeNull();
  });
  it("accepts a matching yearly price", () => {
    expect(checkStripePrice(price({ unit_amount: 14999, recurring: { interval: "year", interval_count: 1 } as never }), 14999, "year")).toBeNull();
  });
  it("rejects a different amount, currency, interval or an inactive price", () => {
    expect(checkStripePrice(price({ unit_amount: 3000 }), 1999, "month")).toMatch(/amount/);
    expect(checkStripePrice(price({ currency: "eur" }), 1999, "month")).toMatch(/currency/);
    expect(checkStripePrice(price(), 1999, "year")).toMatch(/interval/);
    expect(checkStripePrice(price({ recurring: { interval: "month", interval_count: 3 } as never }), 1999, "month")).toMatch(/interval/);
    expect(checkStripePrice(price({ active: false }), 1999, "month")).toMatch(/not active/);
    expect(checkStripePrice(price({ recurring: null }), 1999, "month")).toMatch(/interval/);
  });
});
