import { describe, expect, it } from "vitest";
import { getPlans } from "@/lib/domain/plans";
import { classifyCoachMessage, coachModelIds, DEFAULT_COACH_MODELS, PLAN_RESERVE, routeCoachRequest } from "@/lib/coach/routing";
import { fallbackParams } from "@/lib/coach/prompt";

const route = (message: string, smartUsed = 0, mode: "chat" | "plan" = "chat", env: Record<string, string> = {}) =>
  routeCoachRequest({ mode, message, smartUsed, smartLimit: getPlans().pro.aiSmartMonthlyLimit, env });

describe("coach model routing", () => {
  it("uses the current Haiku and Sonnet models by default, overridable by env", () => {
    expect(DEFAULT_COACH_MODELS).toEqual({ fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5" });
    expect(coachModelIds({ COACH_MODEL_FAST: "a", COACH_MODEL_SMART: "b" })).toEqual({ fast: "a", smart: "b" });
  });

  it("sends everyday questions to the fast model", () => {
    for (const m of [
      "What did I bench last week?",
      "Can I swap barbell rows for something with dumbbells?",
      "How much protein should I eat?",
      "Explain RPE to me",
      "thanks!",
    ]) {
      expect(classifyCoachMessage(m), m).toBe("quick");
      expect(route(m)).toMatchObject({ tier: "fast", model: "claude-haiku-5-5", reason: "quick" });
    }
  });

  it("sends program design, reviews and anything about pain or health to the larger model", () => {
    for (const m of [
      "Can you build me a 4-day upper/lower program?",
      "Please adjust my plan so I can train Saturdays",
      "Review my last month of training",
      "Why has my squat stalled?",
      "My knee hurts when I squat",
      "I have type 2 diabetes, what should I watch for?",
      "I keep bingeing at night",
    ]) {
      expect(classifyCoachMessage(m), m).toBe("complex");
      expect(route(m)).toMatchObject({ tier: "smart", model: "claude-sonnet-5-5", reason: "complex" });
    }
    expect(classifyCoachMessage("x".repeat(701))).toBe("complex");
  });

  it("plan generation always uses the larger model", () => {
    expect(route("anything", 0, "plan")).toMatchObject({ tier: "smart", reason: "plan" });
  });

  it("caps the larger model at about 10% of Pro's monthly allowance and keeps some for plan generation", () => {
    const pro = getPlans().pro;
    expect(pro.aiMonthlyLimit).toBe(150);
    expect(pro.aiSmartMonthlyLimit).toBe(15);
    expect(pro.aiSmartMonthlyLimit / pro.aiMonthlyLimit).toBeCloseTo(0.1);
    const complex = "Review my last month of training";
    const lastForChat = pro.aiSmartMonthlyLimit - PLAN_RESERVE - 1;
    expect(route(complex, lastForChat).tier).toBe("smart");
    expect(route(complex, lastForChat + 1)).toMatchObject({ tier: "fast", reason: "smart_budget_used" });
    // Over a month of only-complex chat, the larger model serves at most limit − reserve requests.
    let smart = 0;
    for (let i = 0; i < pro.aiMonthlyLimit; i++) if (route(complex, smart).tier === "smart") smart++;
    expect(smart).toBe(pro.aiSmartMonthlyLimit - PLAN_RESERVE);
  });

  it("server-side refusal fallbacks are used only where the model supports them", () => {
    expect(fallbackParams(DEFAULT_COACH_MODELS.smart)).toEqual({ betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    expect(fallbackParams(DEFAULT_COACH_MODELS.fast)).toEqual({});
  });
});
