import { canAccessTier, effectivePlanFromSubscription, formatPrice, getPlans, hasFeature, sellablePlans, yearlySavingsPercent } from "@/lib/domain/plans";

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
    expect(plans.pro.priceCents).toBe(1999);
    expect(plans.pro.yearlyPriceCents).toBe(14999);
    expect(plans.pro.aiMonthlyLimit).toBeGreaterThan(plans.plus.aiMonthlyLimit);
    expect(plans.free.aiMonthlyLimit).toBe(0);
  });
  it("formats prices and yearly savings", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(999)).toBe("$9.99");
    expect(formatPrice(1999)).toBe("$19.99");
    expect(formatPrice(14999)).toBe("$149.99");
    expect(formatPrice(20000)).toBe("$200");
    expect(yearlySavingsPercent(1999, 14999)).toBe(37);
    expect(yearlySavingsPercent(0, 20000)).toBe(0);
  });
  it("offers only Free and Pro to new members; Plus is legacy", () => {
    expect(sellablePlans()).toEqual(["free", "pro"]);
    expect(getPlans().plus.sellable).toBe(false);
    // Legacy Plus subscribers keep their features.
    expect(hasFeature("plus", "nutrition_tracking")).toBe(true);
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
