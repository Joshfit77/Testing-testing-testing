import { describe, expect, it } from "vitest";
import { billingLine } from "@/components/profile/membership-plans";
import { yearlySavingsCents, yearlySavingsPercent } from "@/lib/domain/plans";

const prices = { month: "$17.99", year: "$119.99", yearPerMonth: "$10.00", savingsPercent: 44, yearSaving: "$95.89" };

describe("the billing line on the membership screen", () => {
  it("states the yearly price as one charge a year, with the monthly figure only as an equivalent", () => {
    const line = billingLine("year", prices);
    expect(line).toBe("Billed $119.99 once a year (about $10.00 a month). Save approximately 44% compared with monthly billing.");
    expect(line).not.toMatch(/billed (\$10|monthly)|\$10\.00 (per|a) month,? billed/i);
  });

  it("states the monthly price as a monthly charge", () => {
    expect(billingLine("month", prices)).toBe("Billed $17.99 every month. Or $119.99 a year.");
  });

  it("says nothing it can't back up when prices are missing", () => {
    expect(billingLine("year", { ...prices, year: null })).toBe("");
    expect(billingLine("month", { month: null, year: null, yearPerMonth: null, savingsPercent: null })).toBe("");
    expect(billingLine("year", { ...prices, savingsPercent: null, yearPerMonth: null })).toBe("Billed $119.99 once a year.");
  });

  it("the approved figures: 12 × $17.99 = $215.88; $215.88 − $119.99 = $95.89; 44.4% shown as 44%; $119.99 / 12 ≈ $10.00", () => {
    expect(1799 * 12).toBe(21588);
    expect(yearlySavingsCents(1799, 11999)).toBe(9589);
    expect((9589 / 21588) * 100).toBeCloseTo(44.42, 2);
    expect(yearlySavingsPercent(1799, 11999)).toBe(44);
    // The web screen formats with Intl currency formatting, which keeps the cents.
    expect(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.round(11999 / 12) / 100)).toBe("$10.00");
  });
});
