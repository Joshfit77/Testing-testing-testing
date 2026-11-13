import { describe, expect, it } from "vitest";
import {
  costMicros,
  crossedThresholds,
  ECONOMICS_DEFAULTS,
  EXPECTED_COST_MICROS,
  expectedCostMicros,
  priceFor,
  REQUEST_CEILING_MICROS,
  revenueChannels,
  channelEconomics,
  sustainableAiBudget,
  sustainableAllowance,
  tokenUsage,
  usd,
} from "@/lib/domain/ai-economics";
import { aiAllowance, APPROVED_PRO_PRICE_CENTS } from "@/lib/domain/plans";

describe("AI cost of a request", () => {
  it("prices each token class at the published per-million rate", () => {
    // 1M input on Haiku = $0.10; 1M output = $0.50.
    expect(costMicros("claude-haiku-5-5", { input: 1_000_000, cacheWrite: 0, cacheRead: 0, output: 0 })).toBe(100_000);
    expect(costMicros("claude-haiku-5-5", { input: 0, cacheWrite: 0, cacheRead: 0, output: 1_000_000 })).toBe(500_000);
    expect(costMicros("claude-sonnet-5-5", { input: 1000, cacheWrite: 1000, cacheRead: 10_000, output: 500 })).toBe(2000 + 2500 + 1000 + 5000);
  });

  it("rounds up and never prices an unknown model as free", () => {
    expect(costMicros("claude-haiku-5-5", { input: 1, cacheWrite: 0, cacheRead: 0, output: 0 })).toBe(1);
    expect(priceFor("claude-sonnet-5-6")).toEqual(priceFor("claude-sonnet-5-5"));
    expect(priceFor("some-new-model")).toEqual(priceFor("claude-opus-5-5"));
  });

  it("reads the SDK usage block, treating missing fields as zero", () => {
    expect(tokenUsage({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: null })).toEqual({ input: 10, cacheWrite: 0, cacheRead: 100, output: 5 });
    expect(tokenUsage(undefined)).toEqual({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0 });
  });

  it("holds the larger model's expected cost for smart requests", () => {
    expect(expectedCostMicros("chat", "fast")).toBe(EXPECTED_COST_MICROS.chat_fast);
    expect(expectedCostMicros("chat", "smart")).toBe(EXPECTED_COST_MICROS.chat_smart);
    expect(expectedCostMicros("plan", "smart")).toBe(EXPECTED_COST_MICROS.plan);
    expect(expectedCostMicros("meal_plan", "smart")).toBe(EXPECTED_COST_MICROS.meal_plan * 20);
    expect(expectedCostMicros("something_new", "fast")).toBeGreaterThan(0);
    expect(REQUEST_CEILING_MICROS.fast).toBeGreaterThan(EXPECTED_COST_MICROS.chat_fast * 4);
    expect(REQUEST_CEILING_MICROS.smart).toBeGreaterThan(EXPECTED_COST_MICROS.chat_smart * 4);
  });
});

describe("what a Pro member pays us", () => {
  const channels = revenueChannels();

  it("uses the approved prices and spreads the yearly price over 12 months", () => {
    const web = channels.find((c) => c.key === "web_month")!;
    expect(web.grossMonthlyCents).toBe(APPROVED_PRO_PRICE_CENTS.month);
    expect(APPROVED_PRO_PRICE_CENTS).toEqual({ month: 1799, year: 11999 });
    const year = channels.find((c) => c.key === "web_year")!;
    expect(year.grossMonthlyCents).toBeCloseTo(APPROVED_PRO_PRICE_CENTS.year / 12, 2);
    // Stripe: 2.9% + 30¢ on the charge plus Stripe Billing's 0.7%, once a year for yearly.
    expect(web.netMonthlyCents).toBeCloseTo(1799 - (1799 * 0.036 + 30), 2);
    expect(year.netMonthlyCents).toBeCloseTo((11999 - (11999 * 0.036 + 30)) / 12, 2);
  });

  it("charges each store its own fee: Google 15% from day one, Apple 30% or 15%, plus RevenueCat's 1%", () => {
    const net = (k: string) => channels.find((c) => c.key === k)!.netMonthlyCents;
    expect(net("google_month")).toBeCloseTo(1799 * 0.84, 1);
    expect(net("google_year")).toBeCloseTo((11999 * 0.84) / 12, 1);
    expect(net("apple_month_30")).toBeCloseTo(1799 * 0.69, 1);
    expect(net("apple_month_15")).toBeCloseTo(1799 * 0.84, 1);
    expect(net("apple_year_30")).toBeCloseTo((11999 * 0.69) / 12, 1);
  });

  it("keeps the owner's $1.40 AI target, and shows what the lowest-net channel would sustain", () => {
    const b = sustainableAiBudget();
    expect(b.worstChannel.key).toBe("apple_year_30");
    expect(b.worstChannel.netMonthlyCents).toBeCloseTo((11999 * 0.69) / 12, 1); // $6.90
    expect(b.perMemberMonthlyMicros).toBe(ECONOMICS_DEFAULTS.aiTargetMicros);
    // 20% of $6.90 = $1.38: the target is slightly above the guideline on that one channel.
    expect(b.derivedMicros).toBe(Math.floor(b.worstChannel.netMonthlyCents * 0.2 * 10_000));
    expect(b.derivedMicros).toBeLessThan(b.perMemberMonthlyMicros);
  });

  it("flags only the channel where AI at the full target passes 20% of net, and every channel stays profitable", () => {
    const rows = channelEconomics(1_400_000);
    expect(rows.filter((r) => r.flagged).map((r) => r.key)).toEqual(["apple_year_30"]);
    expect(Math.min(...rows.map((r) => r.marginCents))).toBeGreaterThan(400);
    expect(channelEconomics(700_000).some((r) => r.flagged)).toBe(false);
  });

  it("never budgets more AI than a channel can pay for after its other costs", () => {
    expect(sustainableAiBudget({ prices: { monthCents: 50, yearCents: 100 } }).perMemberMonthlyMicros).toBe(0);
    expect(sustainableAiBudget({ prices: { monthCents: 999, yearCents: 5999 } }).derivedMicros).toBeLessThan(sustainableAiBudget().derivedMicros);
  });

  it("the Pro allowance fits inside the budget at expected costs", () => {
    const budget = sustainableAiBudget().perMemberMonthlyMicros;
    const pro = aiAllowance("pro");
    const fit = sustainableAllowance(budget, { smartRequests: pro.smartLimit });
    expect(fit.expectedMaxMicros).toBeLessThanOrEqual(budget);
    expect(pro.chatLimit).toBeLessThanOrEqual(fit.total);
  });
});

describe("budget thresholds", () => {
  it("reports each threshold crossed, once", () => {
    expect(crossedThresholds(0, 499_999, 1_000_000)).toEqual([]);
    expect(crossedThresholds(0, 500_000, 1_000_000)).toEqual([50]);
    expect(crossedThresholds(400_000, 950_000, 1_000_000)).toEqual([50, 75, 90]);
    expect(crossedThresholds(950_000, 1_200_000, 1_000_000)).toEqual([100]);
    expect(crossedThresholds(1_200_000, 1_300_000, 1_000_000)).toEqual([]);
  });

  it("formats dollars", () => {
    expect(usd(1_399_880)).toBe("$1.40");
    expect(usd(50, 4)).toBe("$0.0001");
  });
});
