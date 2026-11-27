import { describe, expect, it } from "vitest";
import { billingLine } from "@/components/profile/membership-plans";
import { yearlySavingsCents, yearlySavingsPercent } from "@/lib/domain/plans";

const prices = { month: "$24.99", year: "$149.99", yearPerMonth: "$12.50", savingsPercent: 49, yearSaving: "$149.89" };

describe("the billing line on the membership screen", () => {
  it("states the yearly price as one charge a year, with the monthly figure only as an equivalent", () => {
    const line = billingLine("year", prices);
    expect(line).toBe("Billed $149.99 once a year (about $12.50 a month). Save approximately 49% compared with monthly billing.");
    expect(line).not.toMatch(/billed (\$12|monthly)|\$12\.50 (per|a) month,? billed/i);
  });

  it("states the monthly price as a monthly charge", () => {
    expect(billingLine("month", prices)).toBe("Billed $24.99 every month. Or $149.99 a year.");
  });

  it("says nothing it can't back up when prices are missing", () => {
    expect(billingLine("year", { ...prices, year: null })).toBe("");
    expect(billingLine("month", { month: null, year: null, yearPerMonth: null, savingsPercent: null })).toBe("");
    expect(billingLine("year", { ...prices, savingsPercent: null, yearPerMonth: null })).toBe("Billed $149.99 once a year.");
  });

  it("the approved figures: 12 × $24.99 = $299.88; $299.88 − $149.99 = $149.89; 49.98% shown as 49%; $149.99 / 12 ≈ $12.50", () => {
    expect(2499 * 12).toBe(29988);
    expect(yearlySavingsCents(2499, 14999)).toBe(14989);
    expect((14989 / 29988) * 100).toBeCloseTo(49.98, 2);
    // Rounded down so the saving is never overstated: "about 50%" in words, 49% on screen.
    expect(yearlySavingsPercent(2499, 14999)).toBe(49);
    // The web screen formats with Intl currency formatting, which keeps the cents.
    expect(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.round(14999 / 12) / 100)).toBe("$12.50");
  });
});
