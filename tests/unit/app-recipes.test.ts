import { describe, expect, it } from "vitest";
import { APP_RECIPES } from "@/data/app-recipes";
import { DIET_TYPES } from "@/lib/domain/diets";
import { eligibleCandidates, generatePlan, type PlannerSettings } from "@/lib/domain/meal-planner";
import { appDish, appRecipeViews, userSlots } from "@/server/services/recipes";

/** The built-in planner recipes resolve against the bundled USDA data and give the planner enough to work with. */
describe("built-in planner recipes", () => {
  it("have unique slugs, steps and at least one meal slot", () => {
    expect(new Set(APP_RECIPES.map((r) => r.slug)).size).toBe(APP_RECIPES.length);
    for (const r of APP_RECIPES) {
      expect(r.slug).toMatch(/^[a-z0-9-]{1,60}$/);
      expect(r.steps.length, r.slug).toBeGreaterThan(0);
      expect(r.slots.length, r.slug).toBeGreaterThan(0);
      expect(r.servings).toBeGreaterThan(0);
    }
  });

  it("every ingredient is a real USDA record and every unit exists for it", async () => {
    const views = await appRecipeViews();
    expect(views.map((v) => v.slug)).toEqual(APP_RECIPES.map((r) => r.slug));
    for (const v of views) {
      expect(v.ingredients.length, v.slug).toBe(APP_RECIPES.find((r) => r.slug === v.slug)!.ingredients.length);
      // Calories and macros are complete (USDA SR Legacy lists them for every food).
      for (const k of ["calories", "protein_g", "carbs_g", "fat_g"] as const) expect(v.totals[k].known, `${v.slug} ${k}`).toBe(v.totals[k].total);
      expect(v.perServing.calories.value, v.slug).toBeGreaterThan(80);
      expect(v.perServing.calories.value, v.slug).toBeLessThan(900);
    }
  });

  it("cover three meals a day for every diet style, at a low budget for balanced eating", async () => {
    const dishes = (await appRecipeViews()).map(appDish);
    const base: PlannerSettings = { calories: 2000, protein_g: 130, carbs_g: 220, fat_g: 70, diet: "balanced", allergies: [], dislikes: [], mealsPerDay: 3, budget: "any" };
    for (const diet of DIET_TYPES) {
      const plan = generatePlan(dishes, { ...base, diet }, ["2026-10-21", "2026-10-22"]);
      for (const day of plan) expect(day.meals.every(Boolean), `${diet} ${day.date}`).toBe(true);
    }
    const low = generatePlan(dishes, { ...base, budget: "low", mealsPerDay: 4 }, ["2026-10-21"]);
    expect(low[0]!.meals.every(Boolean)).toBe(true);
    expect(eligibleCandidates(dishes, { ...base, allergies: ["dairy", "gluten", "nuts", "eggs", "shellfish"] }).length).toBeGreaterThan(5);
  });

  it("plans the user's own dishes for breakfast only when they sound like breakfast", () => {
    expect(userSlots(600, "Turkey chili")).toEqual(["lunch", "dinner"]);
    expect(userSlots(400, "Overnight oats")).toEqual(["breakfast", "lunch", "dinner"]);
    expect(userSlots(250, "Protein smoothie")).toEqual(["breakfast", "lunch", "dinner", "snack"]);
  });
});
