import { aiAllowance, APPROVED_YEARLY_PRICE_CENTS, planFromEntitlement, canAccessTier, effectivePlanFromSubscription, formatPrice, getPlans, hasFeature, legacyTermsApply, yearlySavingsPercent } from "@/lib/domain/plans";

describe("plans & entitlements", () => {
  it("gates features by plan: food logging free, Plus a complete non-AI toolkit, AI only on Pro", () => {
    // Free: food & calorie logging with barcode scanning and macros (all `nutrition_tracking`), basic training.
    for (const f of ["workout_logging", "starter_programs", "basic_progress", "nutrition_tracking"] as const) expect(hasFeature("free", f), f).toBe(true);
    for (const f of ["full_program_library", "custom_program_builder", "unlimited_templates", "meal_planning", "advanced_analytics", "advanced_calendar", "food_comparisons"] as const) {
      expect(hasFeature("free", f), f).toBe(false);
      expect(hasFeature("plus", f), f).toBe(true);
      expect(hasFeature("pro", f), f).toBe(true);
    }
    for (const f of ["ai_coach", "ai_plan_generation", "advanced_recommendations"] as const) {
      expect(hasFeature("plus", f), f).toBe(false);
      expect(hasFeature("pro", f), f).toBe(true);
    }
  });
  it("orders tiers", () => {
    expect(canAccessTier("free", "plus")).toBe(false);
    expect(canAccessTier("pro", "plus")).toBe(true);
    expect(canAccessTier("plus", "free")).toBe(true);
  });
  it("uses the final membership prices and limits", () => {
    const plans = getPlans();
    expect(plans.free.priceCents).toBe(0);
    expect(plans.plus.priceCents).toBe(1199);
    expect(plans.pro.priceCents).toBe(2499);
    // Yearly plans stay hidden until yearly billing is switched on.
    expect(plans.plus.yearlyPriceCents).toBeUndefined();
    expect(plans.pro.yearlyPriceCents).toBeUndefined();
    expect(plans.free.aiMonthlyLimit).toBe(0);
    expect(plans.plus.aiMonthlyLimit).toBe(0);
    expect(plans.pro.aiMonthlyLimit).toBe(150);
    expect(plans.pro.aiSmartMonthlyLimit).toBe(15);
    expect(plans.pro.aiPlanMonthlyLimit).toBeLessThanOrEqual(plans.pro.aiSmartMonthlyLimit);
    expect(plans.free.templateLimit).toBe(5);
    expect(plans.plus.templateLimit).toBeNull();
    expect(plans.pro.templateLimit).toBeNull();
  });
  it("offers the approved yearly prices only once yearly billing is switched on", () => {
    process.env.BILLING_YEARLY_ENABLED = "true";
    try {
      const plans = getPlans();
      expect(plans.plus.yearlyPriceCents).toBe(9999);
      expect(plans.pro.yearlyPriceCents).toBe(24999);
      expect(plans.free.yearlyPriceCents).toBeUndefined();
      expect(APPROVED_YEARLY_PRICE_CENTS).toEqual({ plus: 9999, pro: 24999 });
      expect(yearlySavingsPercent(plans.plus.priceCents, 9999)).toBe(30);
      expect(yearlySavingsPercent(plans.pro.priceCents, 24999)).toBe(16);
    } finally {
      delete process.env.BILLING_YEARLY_ENABLED;
    }
  });
  it("keeps legacy AI terms only while their subscription stays on the same plan", () => {
    const now = new Date("2026-10-22T00:00:00Z");
    const future = "2026-11-22T00:00:00Z";
    const terms = { plan: "plus" as const, ends_at: null };
    expect(legacyTermsApply(terms, { plan: "plus", status: "active", current_period_end: future }, now)).toBe(true);
    // Set to cancel at the period end: Stripe keeps it active until then.
    expect(legacyTermsApply(terms, { plan: "plus", status: "active", current_period_end: future }, now)).toBe(true);
    // Cancelled outright: the terms end with it.
    expect(legacyTermsApply(terms, { plan: "plus", status: "canceled", current_period_end: future }, now)).toBe(false);
    expect(legacyTermsApply(terms, { plan: "plus", status: "canceled", current_period_end: "2026-10-01T00:00:00Z" }, now)).toBe(false);
    expect(legacyTermsApply(terms, { plan: "pro", status: "active", current_period_end: future }, now)).toBe(false);
    expect(legacyTermsApply({ plan: "plus", ends_at: "2026-10-21T00:00:00Z" }, { plan: "plus", status: "active", current_period_end: future }, now)).toBe(false);
  });
  it("computes the AI allowance: none on Plus, 150 on Pro, legacy terms raise it", () => {
    expect(aiAllowance("free")).toEqual({ chatLimit: 0, planLimit: 0, smartLimit: 0, legacy: false });
    expect(aiAllowance("plus")).toEqual({ chatLimit: 0, planLimit: 0, smartLimit: 0, legacy: false });
    expect(aiAllowance("pro")).toEqual({ chatLimit: 150, planLimit: 15, smartLimit: 15, legacy: false });
    const legacyPlus = { plan: "plus" as const, aiMonthlyLimit: 60, aiPlanMonthlyLimit: 0, aiSmartMonthlyLimit: 6 };
    expect(aiAllowance("plus", [legacyPlus])).toEqual({ chatLimit: 60, planLimit: 0, smartLimit: 6, legacy: true });
    const legacyPro = { plan: "pro" as const, aiMonthlyLimit: 400, aiPlanMonthlyLimit: 20, aiSmartMonthlyLimit: 40 };
    expect(aiAllowance("pro", [legacyPro])).toEqual({ chatLimit: 400, planLimit: 20, smartLimit: 40, legacy: true });
  });
  it("formats prices and yearly savings", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(999)).toBe("$9.99");
    expect(formatPrice(3000)).toBe("$30");
    expect(formatPrice(20000)).toBe("$200");
    expect(yearlySavingsPercent(3000, 20000)).toBe(44);
    expect(yearlySavingsPercent(1499, 11999)).toBe(33);
    expect(formatPrice(1499)).toBe("$14.99");
    expect(formatPrice(11999)).toBe("$119.99");
    expect(yearlySavingsPercent(0, 20000)).toBe(0);
  });
  it("respects env overrides", () => {
    process.env.PLAN_PRO_AI_MONTHLY_LIMIT = "200";
    process.env.PLAN_PRO_YEARLY_PRICE_CENTS = "19999";
    process.env.BILLING_YEARLY_ENABLED = "true";
    process.env.PLAN_FREE_TEMPLATE_LIMIT = "8";
    try {
      expect(getPlans().pro.aiMonthlyLimit).toBe(200);
      expect(getPlans().pro.aiSmartMonthlyLimit).toBe(20);
      expect(getPlans().pro.yearlyPriceCents).toBe(19999);
      expect(getPlans().free.templateLimit).toBe(8);
    } finally {
      delete process.env.PLAN_PRO_AI_MONTHLY_LIMIT;
      delete process.env.PLAN_PRO_YEARLY_PRICE_CENTS;
      delete process.env.BILLING_YEARLY_ENABLED;
      delete process.env.PLAN_FREE_TEMPLATE_LIMIT;
    }
  });
  it("derives effective plans from subscription state", () => {
    const now = new Date("2026-10-16T00:00:00Z");
    const future = "2026-11-16T00:00:00Z";
    const past = "2026-10-01T00:00:00Z";
    expect(effectivePlanFromSubscription(null, now)).toBe("free");
    expect(effectivePlanFromSubscription({ plan: "pro", status: "active", current_period_end: future }, now)).toBe("pro");
    expect(effectivePlanFromSubscription({ plan: "plus", status: "past_due", current_period_end: future }, now)).toBe("plus");
    // A cancelled subscription has ended, even if its period end lies ahead (immediate or dunning cancellation).
    expect(effectivePlanFromSubscription({ plan: "plus", status: "canceled", current_period_end: future }, now)).toBe("free");
    expect(effectivePlanFromSubscription({ plan: "plus", status: "canceled", current_period_end: past }, now)).toBe("free");
    expect(effectivePlanFromSubscription({ plan: "pro", status: "unpaid", current_period_end: future }, now)).toBe("free");
    expect(effectivePlanFromSubscription({ plan: "pro", status: "active", current_period_end: past }, now)).toBe("free");
  });
});

describe("database plan checks match the app", () => {
  it("the Free saved-workout limit in the database equals the app's default", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/20261023000024_plan_enforcement.sql", "utf8");
    const m = sql.match(/from public\.workout_templates where user_id = new\.user_id\) >= (\d+)/);
    expect(Number(m?.[1])).toBe(getPlans().free.templateLimit);
  });
});

describe("planFromEntitlement", () => {
  const now = new Date("2026-10-22T00:00:00Z");
  it("grants the plan until valid_until passes, then Free", () => {
    expect(planFromEntitlement(null, now)).toBe("free");
    expect(planFromEntitlement({ plan: "pro", valid_until: null }, now)).toBe("pro");
    expect(planFromEntitlement({ plan: "plus", valid_until: "2026-11-01T00:00:00Z" }, now)).toBe("plus");
    expect(planFromEntitlement({ plan: "plus", valid_until: "2026-10-01T00:00:00Z" }, now)).toBe("free");
    expect(planFromEntitlement({ plan: "gold", valid_until: null }, now)).toBe("free");
  });
});
