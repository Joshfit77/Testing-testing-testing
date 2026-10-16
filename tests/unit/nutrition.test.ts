import { caloriesFromMacros, estimateNutritionTargets, progressPct, scaleMacros, sumMacros } from "@/lib/domain/nutrition";
import { readinessBand, readinessScore } from "@/lib/domain/readiness";

describe("nutrition", () => {
  it("sums and scales macros", () => {
    expect(sumMacros([{ calories: 100, protein_g: 10 }, { calories: 50.25, fat_g: 2 }])).toEqual({
      calories: 150.3,
      protein_g: 10,
      carbs_g: 0,
      fat_g: 2,
    });
    expect(scaleMacros({ calories: 120, protein_g: 25, carbs_g: 0, fat_g: 1.5 }, 1.5)).toEqual({
      calories: 180,
      protein_g: 37.5,
      carbs_g: 0,
      fat_g: 2.3,
    });
    expect(caloriesFromMacros({ protein_g: 10, carbs_g: 10, fat_g: 10 })).toBe(170);
  });
  it("produces conservative, internally consistent estimates", () => {
    const t = estimateNutritionTargets({ weightKg: 80, trainingDaysPerWeek: 4, goal: "lose_fat" });
    expect(t.is_estimate).toBe(true);
    expect(t.calories).toBeGreaterThanOrEqual(1200);
    expect(t.calories).toBeLessThan(80 * 33); // a deficit vs. maintenance
    expect(t.protein_g).toBe(144);
    // Macros should account for roughly the calorie target.
    expect(Math.abs(caloriesFromMacros(t) - t.calories)).toBeLessThan(15);
  });
  it("never goes below the safety floor", () => {
    const t = estimateNutritionTargets({ weightKg: 30, trainingDaysPerWeek: 0, goal: "lose_fat" });
    expect(t.calories).toBe(1200);
  });
  it("clamps progress percentages", () => {
    expect(progressPct(50, 200)).toBe(25);
    expect(progressPct(300, 200)).toBe(100);
    expect(progressPct(10, 0)).toBe(0);
  });
});

describe("readiness", () => {
  it("scores and bands check-ins", () => {
    expect(readinessScore({ sleepQuality: 5, energy: 5, soreness: 1, stress: 1 })).toBe(100);
    expect(readinessScore({ sleepQuality: 1, energy: 1, soreness: 5, stress: 5 })).toBe(0);
    expect(readinessBand(readinessScore({ sleepQuality: 3, energy: 3, soreness: 3, stress: 3 }))).toBe("moderate");
  });
});
