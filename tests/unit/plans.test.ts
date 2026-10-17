import { canAccessTier, effectivePlanFromSubscription, formatPrice, getPlans, hasFeature, yearlySavingsPercent } from "@/lib/domain/plans";

describe("plans & entitlements", () => {
  it("gates features by plan", () => {
    expect(hasFeature("free", "workout_logging")).toBe(true);
    expect(hasFeature("free", "nutrition_tracking")).toBe(false);
    expect(hasFeature("plus", "nutrition_tracking")).toBe(true);
    expect(hasFeature("plus", "ai_plan_generation")).toBe(false);
    expect(hasFeature("pro", "ai_plan_generation")).toBe(true);
  });
  it("orders tiers", () => {
    expect(canAccessTier("free", "plus")).toBe(false);
    expect(canAccessTier("pro", "plus")).toBe(true);
    expect(canAccessTier("plus", "free")).toBe(true);
  });
  it("uses default prices and AI limits", () => {
    const plans = getPlans();
    expect(plans.plus.priceCents).toBe(999);
    expect(plans.pro.priceCents).toBe(3000);
    expect(plans.pro.yearlyPriceCents).toBe(20000);
    expect(plans.pro.aiMonthlyLimit).toBeGreaterThan(plans.plus.aiMonthlyLimit);
    expect(plans.free.aiMonthlyLimit).toBe(0);
  });
  it("formats prices and yearly savings", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(999)).toBe("$9.99");
    expect(formatPrice(3000)).toBe("$30");
    expect(formatPrice(20000)).toBe("$200");
    expect(yearlySavingsPercent(3000, 20000)).toBe(44);
    expect(yearlySavingsPercent(0, 20000)).toBe(0);
  });
  it("respects env overrides", () => {
    process.env.PLAN_PLUS_AI_MONTHLY_LIMIT = "5";
    expect(getPlans().plus.aiMonthlyLimit).toBe(5);
    delete process.env.PLAN_PLUS_AI_MONTHLY_LIMIT;
  });
  it("derives effective plans from subscription state", () => {
    const now = new Date("2026-10-16T00:00:00Z");
    const future = "2026-11-16T00:00:00Z";
    const past = "2026-10-01T00:00:00Z";
    expect(effectivePlanFromSubscription(null, now)).toBe("free");
    expect(effectivePlanFromSubscription({ plan: "pro", status: "active", current_period_end: future }, now)).toBe("pro");
    expect(effectivePlanFromSubscription({ plan: "plus", status: "past_due", current_period_end: future }, now)).toBe("plus");
    expect(effectivePlanFromSubscription({ plan: "plus", status: "canceled", current_period_end: future }, now)).toBe("plus");
    expect(effectivePlanFromSubscription({ plan: "plus", status: "canceled", current_period_end: past }, now)).toBe("free");
    expect(effectivePlanFromSubscription({ plan: "pro", status: "unpaid", current_period_end: future }, now)).toBe("free");
    expect(effectivePlanFromSubscription({ plan: "pro", status: "active", current_period_end: past }, now)).toBe("free");
  });
});
