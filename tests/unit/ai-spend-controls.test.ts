import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceSupabase: () => ({}) }));
vi.mock("@/server/log", () => ({ logInfo: () => {}, logError: () => {} }));

const { aiBudgetConfig, budgetAlertText, defaultDailyBudgetMicros } = await import("@/server/services/ai-budget");
const { addUsage, costMicros, noCacheCostMicros, REQUEST_CEILING_MICROS, roundOutputBudget, totalInputTokens, ZERO_USAGE } = await import("@/lib/domain/ai-economics");
const { downgradeNotice } = await import("@/lib/domain/ai-allowance");
const { summarizeCostReport, usdPrecise } = await import("@/lib/domain/ai-cost-report");

afterEach(() => vi.unstubAllEnvs());

describe("daily global limit configuration", () => {
  it("defaults to twice the month's average day", () => {
    expect(defaultDailyBudgetMicros(100_000_000, new Date("2026-11-19T12:00:00Z"))).toBe(Math.ceil((100_000_000 * 2) / 30));
    expect(defaultDailyBudgetMicros(100_000_000, new Date("2026-02-10T00:00:00Z"))).toBe(Math.ceil((100_000_000 * 2) / 28));
    expect(aiBudgetConfig(new Date("2026-11-19T00:00:00Z")).globalDailyMicros).toBe(6_666_667);
  });
  it("can be set by environment variable, and is never more than the monthly budget", () => {
    vi.stubEnv("AI_GLOBAL_DAILY_BUDGET_USD", "12.5");
    expect(aiBudgetConfig().globalDailyMicros).toBe(12_500_000);
    vi.stubEnv("AI_GLOBAL_MONTHLY_BUDGET_USD", "10");
    expect(aiBudgetConfig().globalDailyMicros).toBe(10_000_000);
  });
  it("an invalid value falls back to the safe default rather than no limit", () => {
    vi.stubEnv("AI_GLOBAL_DAILY_BUDGET_USD", "lots");
    expect(aiBudgetConfig(new Date("2026-11-19T00:00:00Z")).globalDailyMicros).toBe(6_666_667);
    vi.stubEnv("AI_GLOBAL_DAILY_BUDGET_USD", "-5");
    expect(aiBudgetConfig(new Date("2026-11-19T00:00:00Z")).globalDailyMicros).toBe(6_666_667);
  });
  it("daily alerts say 'today' and when AI resumes; monthly alerts are unchanged", () => {
    expect(budgetAlertText({ period: "day", threshold: 80, spent_micros: 5_400_000, budget_micros: 6_666_667 })).toBe(
      "Narrow Gate Fitness: today's AI budget has reached 80% ($5.40 of $6.67). Non-AI features are unaffected.",
    );
    expect(budgetAlertText({ period: "day", threshold: 100, spent_micros: 6_700_000, budget_micros: 6_666_667 })).toMatch(/today's AI budget is used up: .*midnight UTC/);
    expect(budgetAlertText({ threshold: 50, spent_micros: 50_000_000, budget_micros: 100_000_000 })).toMatch(/^Narrow Gate Fitness: this month's AI budget has reached 50%/);
  });
  it("a request moved to the standard model by the daily limit says so", () => {
    expect(downgradeNotice("global_daily_budget", new Date("2026-11-19T00:00:00Z"))).toMatch(/limited for the rest of today/);
  });
});

describe("cost records: cache split and savings", () => {
  const u = { input: 2_100, cacheRead: 12_000, cacheWrite: 0, output: 180 };
  it("prices the same tokens as if nothing were cached", () => {
    expect(costMicros("claude-haiku-5-5", u)).toBe(Math.ceil(2_100 * 0.1 + 12_000 * 0.01 + 180 * 0.5));
    expect(noCacheCostMicros("claude-haiku-5-5", u)).toBe(Math.ceil(14_100 * 0.1 + 180 * 0.5));
    expect(totalInputTokens(u)).toBe(14_100);
  });
  it("a cold request that writes the cache costs more than uncached (a negative saving is reported, not hidden)", () => {
    const cold = { input: 500, cacheRead: 0, cacheWrite: 10_000, output: 200 };
    expect(costMicros("claude-sonnet-5-5", cold) - noCacheCostMicros("claude-sonnet-5-5", cold)).toBeGreaterThan(0);
  });
  it("adds up rounds", () => {
    expect(addUsage(addUsage(ZERO_USAGE, u), u)).toEqual({ input: 4_200, cacheRead: 24_000, cacheWrite: 0, output: 360 });
  });
});

describe("per-round output budget keeps a request within its ceiling", () => {
  const base = { model: "claude-haiku-5-5", ceilingMicros: REQUEST_CEILING_MICROS.fast, maxTokens: 12_000, minTokens: 2_000 };
  it("a fresh request gets the normal maximum", () => {
    expect(roundOutputBudget({ ...base, spentMicros: 0, expectedInputMicros: 0 })).toEqual({ maxTokens: 12_000, finalRound: false });
  });
  it("later rounds get what is left after the expected input, at the output price", () => {
    // 15,000 − 6,000 spent − 3,000 expected input = 6,000 micro-USD → 12,000 tokens at $0.50/M: capped at 12,000.
    expect(roundOutputBudget({ ...base, spentMicros: 6_000, expectedInputMicros: 3_000 })).toEqual({ maxTokens: 12_000, finalRound: false });
    // 15,000 − 9,000 − 3,000 = 3,000 → 6,000 tokens.
    expect(roundOutputBudget({ ...base, spentMicros: 9_000, expectedInputMicros: 3_000 })).toEqual({ maxTokens: 6_000, finalRound: false });
  });
  it("near or past the ceiling: one short final answer, no more tools", () => {
    expect(roundOutputBudget({ ...base, spentMicros: 9_000, expectedInputMicros: 6_000 })).toEqual({ maxTokens: 2_000, finalRound: true });
    expect(roundOutputBudget({ ...base, spentMicros: 20_000, expectedInputMicros: 6_000 })).toEqual({ maxTokens: 2_000, finalRound: true });
  });
  it("the advanced model's higher output price shrinks its rounds sooner", () => {
    const smart = { ...base, model: "claude-sonnet-5-5", ceilingMicros: REQUEST_CEILING_MICROS.smart };
    // 400,000 − 300,000 − 40,000 = 60,000 → 6,000 tokens at $10/M.
    expect(roundOutputBudget({ ...smart, spentMicros: 300_000, expectedInputMicros: 40_000 })).toEqual({ maxTokens: 6_000, finalRound: false });
  });
});

describe("cost report summary", () => {
  const report = {
    from: "2026-11-01T00:00:00Z",
    to: "2026-12-01T00:00:00Z",
    totals: { requests: 100, cost_micros: 1_000_000, input_tokens: 1_000_000, output_tokens: 50_000, cache_read_tokens: 800_000, cache_write_tokens: 20_000, requests_with_cache_data: 80, no_cache_cost_micros: 1_200_000, cost_micros_with_cache_data: 900_000 },
    by_model: [
      { model: "claude-haiku-5-5", tier: "fast" as const, requests: 93, cost_micros: 300_000, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, avg_cost_micros: 3_226, max_cost_micros: 9_000 },
      { model: "claude-sonnet-5-5", tier: "smart" as const, requests: 7, cost_micros: 700_000, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, avg_cost_micros: 100_000, max_cost_micros: 200_000 },
    ],
    by_kind: [],
    by_route_reason: [],
    by_day: [],
    members: { members_using_ai: 10, avg_cost_micros: 100_000, median_cost_micros: 60_000, p90_cost_micros: 250_000, max_cost_micros: 300_000, avg_requests: 10 },
    pro_members_now: 40,
    budget_months: [],
    budget_month_alerts: [],
    budget_day_alerts: [],
  };
  it("reports the measured mix, the cache saving and what members actually cost", () => {
    const s = summarizeCostReport(report);
    expect(s).toMatchObject({ requests: 100, costMicros: 1_000_000, avgCostPerRequestMicros: 10_000, fastSharePct: 93, smartSharePct: 7, fastCostMicros: 300_000, smartCostMicros: 700_000 });
    expect(s.cache).toEqual({ requestsMeasured: 80, savedMicros: 300_000, savedPctOfNoCache: 25, readTokens: 800_000, writeTokens: 20_000, hitRatePct: 80 });
    // Spend over every current Pro member, including those who used no AI: $1.00 / 40 = $0.025.
    expect(s.avgPerProMemberMicros).toBe(25_000);
  });
  it("handles an empty period", () => {
    const empty = summarizeCostReport({ ...report, totals: { ...report.totals, requests: 0, cost_micros: 0, input_tokens: 0, no_cache_cost_micros: 0, cost_micros_with_cache_data: 0, requests_with_cache_data: 0, cache_read_tokens: 0 }, by_model: [], pro_members_now: 0 });
    expect(empty).toMatchObject({ requests: 0, avgCostPerRequestMicros: 0, fastSharePct: 0, smartSharePct: 0, avgPerProMemberMicros: null });
  });
  it("formats sub-cent costs readably", () => {
    expect(usdPrecise(3_400)).toBe("$0.0034");
    expect(usdPrecise(25_000)).toBe("$0.025");
    expect(usdPrecise(1_400_000)).toBe("$1.40");
    expect(usdPrecise(-1_500)).toBe("−$0.0015");
  });
});
