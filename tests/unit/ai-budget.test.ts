import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceSupabase: () => ({}) }));
const logged: unknown[] = [];
vi.mock("@/server/log", () => ({ logInfo: (...a: unknown[]) => logged.push(["info", ...a]), logError: (...a: unknown[]) => logged.push(["error", ...a]) }));

const { aiBudgetConfig, budgetAlertText, notifyBudgetAlerts } = await import("@/server/services/ai-budget");
const { sustainableAiBudget } = await import("@/lib/domain/ai-economics");

afterEach(() => {
  vi.unstubAllEnvs();
  logged.length = 0;
});

describe("AI budget configuration", () => {
  it("defaults to the sustainable member budget, a $100 global cap and 20 concurrent requests", () => {
    const c = aiBudgetConfig();
    expect(c.memberMonthlyMicros).toBe(sustainableAiBudget().perMemberMonthlyMicros);
    expect(c.globalMonthlyMicros).toBe(100_000_000);
    expect(c.maxInflightGlobal).toBe(20);
    expect(c.maxInflightPerMember).toBeGreaterThanOrEqual(1);
    expect(c.inflightSeconds).toBeGreaterThan(165); // longer than the coach's own deadline
  });

  it("takes overrides in dollars and ignores nonsense", () => {
    vi.stubEnv("AI_GLOBAL_MONTHLY_BUDGET_USD", "250.5");
    vi.stubEnv("AI_MEMBER_MONTHLY_BUDGET_USD", "-3");
    vi.stubEnv("AI_MAX_CONCURRENT", "abc");
    const c = aiBudgetConfig();
    expect(c.globalMonthlyMicros).toBe(250_500_000);
    expect(c.memberMonthlyMicros).toBe(sustainableAiBudget().perMemberMonthlyMicros);
    expect(c.maxInflightGlobal).toBe(20);
    vi.stubEnv("AI_GLOBAL_MONTHLY_BUDGET_USD", "0");
    expect(aiBudgetConfig().globalMonthlyMicros).toBe(0); // an owner can switch AI off for the month
  });
});

describe("budget alerts", () => {
  const alert = { threshold: 75, spent_micros: 75_000_000, budget_micros: 100_000_000 };

  it("says how far the budget has gone, with totals only", () => {
    expect(budgetAlertText(alert)).toBe("Narrow Gate Fitness: this month's AI budget has reached 75% ($75.00 of $100.00). Non-AI features are unaffected.");
    expect(budgetAlertText({ ...alert, threshold: 100 })).toContain("is used up");
  });

  it("logs every alert and posts it to the webhook when one is set", async () => {
    vi.stubEnv("AI_BUDGET_ALERT_WEBHOOK_URL", "https://hooks.example.test/x");
    const fetchImpl = vi.fn(async () => new Response("ok"));
    await notifyBudgetAlerts([alert, { ...alert, threshold: 90 }], fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hooks.example.test/x");
    expect(JSON.parse(String(init.body))).toEqual({ text: budgetAlertText(alert) });
    expect(logged.filter((l) => (l as unknown[])[1] === "ai.budget_alert")).toHaveLength(2);
  });

  it("never throws when the webhook is down or missing", async () => {
    await expect(notifyBudgetAlerts([alert], (async () => new Response("", { status: 500 })) as unknown as typeof fetch)).resolves.toBeUndefined();
    vi.stubEnv("AI_BUDGET_ALERT_WEBHOOK_URL", "https://hooks.example.test/x");
    await expect(notifyBudgetAlerts([alert], (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).resolves.toBeUndefined();
    expect(logged.some((l) => (l as unknown[])[0] === "error")).toBe(true);
  });
});
