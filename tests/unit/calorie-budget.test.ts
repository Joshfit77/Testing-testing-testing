import { describe, expect, it } from "vitest";
import {
  calorieBudget,
  calorieFloor,
  exerciseCalories,
  projectWeightKg,
  rateTowardGoal,
  remainingCalories,
  weeksToGoal,
} from "@/lib/domain/calorie-budget";

const base = { sex: "male" as const, age: 30, heightCm: 180, weightKg: 90, activity: "light" as const, goal: "lose_fat" as const };

describe("calorieBudget", () => {
  it("uses Mifflin-St Jeor times the activity factor for maintenance", () => {
    // BMR = 10*90 + 6.25*180 - 5*30 + 5 = 1880; × 1.375 = 2585
    expect(calorieBudget({ ...base, weeklyChangeKg: 0 }).maintenance).toBe(2585);
  });
  it("subtracts 7700 kcal per kg per week", () => {
    const b = calorieBudget({ ...base, weeklyChangeKg: -0.5 });
    expect(b.calories).toBe(2040); // 2585 - 550 → rounded to 10
    expect(b.floored).toBe(false);
    expect(b.effectiveWeeklyChangeKg).toBeCloseTo(-0.5, 1);
  });
  it("never cuts more than 25% of maintenance", () => {
    const b = calorieBudget({ ...base, weeklyChangeKg: -1 });
    expect(b.calories).toBeGreaterThanOrEqual(Math.round(2585 * 0.75 / 10) * 10 - 10);
  });
  it("raises very low budgets to the safe floor", () => {
    const b = calorieBudget({ sex: "female", age: 60, heightCm: 150, weightKg: 50, activity: "sedentary", goal: "lose_fat", weeklyChangeKg: -1 });
    expect(b.calories).toBe(calorieFloor("female"));
    expect(b.floored).toBe(true);
  });
  it("adds a surplus for gaining and splits macros by diet", () => {
    const b = calorieBudget({ ...base, goal: "build_muscle", weeklyChangeKg: 0.25, diet: "keto" });
    expect(b.calories).toBeGreaterThan(b.maintenance);
    expect(b.carbs_g).toBeLessThanOrEqual(25);
    expect(b.protein_g).toBe(Math.round(90 * 1.6));
  });
});

describe("diary helpers", () => {
  it("computes goal − food + exercise", () => {
    expect(remainingCalories(2000, 1450, 300)).toBe(850);
  });
  it("estimates exercise calories from MET minutes", () => {
    expect(exerciseCalories(60, 80, 5)).toBe(420);
    expect(exerciseCalories(0, 80)).toBe(0);
  });
  it("projects weight in five weeks", () => {
    expect(projectWeightKg(90, 2500, 2000, 0)).toBeCloseTo(90 - (500 * 35) / 7700, 1);
    expect(projectWeightKg(90, 2500, 0, 0)).toBeNull();
  });
  it("counts weeks to the goal weight only when moving toward it", () => {
    expect(weeksToGoal(90, 80, -0.5)).toBe(20);
    expect(weeksToGoal(90, 80, 0.25)).toBeNull();
    expect(weeksToGoal(90, null, -0.5)).toBeNull();
  });
  it("points the rate toward the goal weight", () => {
    expect(rateTowardGoal(90, 80, 0.25)).toBe(-0.25);
    expect(rateTowardGoal(70, 80, -0.5)).toBe(0.5);
    expect(rateTowardGoal(80, 80.2, -0.5)).toBe(0);
  });
});
