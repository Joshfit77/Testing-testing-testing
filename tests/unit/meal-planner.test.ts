import { describe, expect, it } from "vitest";
import { costTierForDish, matchesExclusion, tagsForDish, tagsForFood, tierFits } from "@/lib/domain/food-tags";
import {
  alternativesFor,
  cleanTerms,
  dayFit,
  dayTotals,
  dietAllows,
  eligibleCandidates,
  exclusionReason,
  generatePlan,
  portionFor,
  slotsForMeals,
  type PlanCandidate,
  type PlannerSettings,
  type PlanSlot,
} from "@/lib/domain/meal-planner";
import { ANIMAL_TAGS } from "@/lib/domain/food-tags";

function dish(key: string, name: string, slots: PlanSlot[], kcal: number, protein: number, ingredients: string[], carbs = 40, fat = 15): PlanCandidate {
  const tags = tagsForDish(ingredients);
  return {
    key,
    name,
    origin: "app",
    slots,
    perServing: { calories: kcal, protein_g: protein, carbs_g: carbs, fat_g: fat },
    complete: true,
    ingredientNames: ingredients,
    tags,
    animalOnly: ingredients.every((n) => tagsForFood(n).some((t) => ANIMAL_TAGS.includes(t))),
    cost: costTierForDish(ingredients),
  };
}

const DISHES: PlanCandidate[] = [
  dish("app:oats", "Oatmeal with peanut butter", ["breakfast"], 450, 18, ["Oats, dry", "Milk, skim", "Banana", "Peanut butter, smooth"], 65, 12),
  dish("app:eggs", "Eggs and toast", ["breakfast"], 400, 22, ["Egg, whole, raw", "Bread, whole-wheat", "Spinach, raw"], 30, 18),
  dish("app:yogurt", "Yogurt and berries", ["breakfast", "snack"], 250, 20, ["Yogurt, Greek, plain", "Blueberries", "Honey"], 30, 3),
  dish("app:tofu", "Tofu scramble", ["breakfast", "lunch"], 380, 24, ["Tofu, firm", "Spinach", "Tortilla, corn"], 30, 16),
  dish("app:chicken", "Chicken and rice", ["lunch", "dinner"], 550, 45, ["Chicken breast, cooked", "Brown rice", "Broccoli"], 50, 10),
  dish("app:lentils", "Lentil bowl", ["lunch", "dinner"], 500, 22, ["Lentils, cooked", "Brown rice", "Carrots"], 85, 6),
  dish("app:salmon", "Salmon and potato", ["dinner"], 600, 35, ["Salmon, Atlantic, cooked", "Sweet potato", "Green beans"], 45, 20),
  dish("app:shrimp", "Shrimp pasta", ["lunch", "dinner"], 560, 38, ["Shrimp, cooked", "Pasta, cooked", "Tomato"], 70, 8),
  dish("app:steak", "Steak and eggs", ["breakfast", "lunch", "dinner"], 520, 48, ["Beef, top sirloin, cooked", "Egg, whole", "Butter, salted"], 1, 34),
  dish("app:apple", "Apple and peanut butter", ["snack"], 190, 4, ["Apple", "Peanut butter"], 25, 8),
  dish("app:hummus", "Hummus and carrots", ["snack"], 150, 4, ["Hummus", "Carrots"], 18, 8),
];

const BASE: PlannerSettings = { calories: 2000, protein_g: 140, carbs_g: 200, fat_g: 70, diet: "balanced", allergies: [], dislikes: [], mealsPerDay: 3, budget: "any" };
const WEEK = ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"];

describe("food tags", () => {
  it("reads ingredient names without common false positives", () => {
    expect(tagsForFood("Peanut butter, smooth")).toEqual(expect.arrayContaining(["peanut", "legume"]));
    expect(tagsForFood("Peanut butter, smooth")).not.toContain("dairy");
    expect(tagsForFood("Beverages, almond milk, unsweetened")).not.toContain("dairy");
    expect(tagsForFood("Beverages, almond milk, unsweetened")).toContain("tree_nut");
    expect(tagsForFood("Eggplant, raw")).not.toContain("egg");
    expect(tagsForFood("Butter, salted")).toContain("dairy");
    expect(tagsForFood("Crustaceans, shrimp, cooked")).toContain("shellfish");
    expect(tagsForFood("Tortillas, ready-to-bake or -fry, corn")).not.toContain("gluten");
    expect(tagsForFood("Tortillas, ready-to-bake or -fry, flour, shelf stable")).toContain("gluten");
    expect(tagsForFood("Peaches, raw")).not.toContain("legume");
  });

  it("matches allergies by group and dislikes by word", () => {
    const oats = DISHES[0]!;
    expect(matchesExclusion(oats, "peanuts")).toBe(true);
    expect(matchesExclusion(oats, "Nuts")).toBe(true); // "nuts" covers peanuts and tree nuts
    expect(matchesExclusion(oats, "dairy")).toBe(true); // skim milk
    expect(matchesExclusion(oats, "bananas")).toBe(true);
    expect(matchesExclusion(oats, "shellfish")).toBe(false);
    expect(matchesExclusion(DISHES[7]!, "shellfish")).toBe(true);
    expect(matchesExclusion(DISHES[7]!, "seafood")).toBe(true);
    expect(matchesExclusion(DISHES[1]!, "gluten")).toBe(true);
    expect(matchesExclusion(DISHES[3]!, "gluten")).toBe(false);
    expect(matchesExclusion(DISHES[1]!, "mushrooms")).toBe(false);
  });

  it("puts dishes in rough budget tiers by ingredient type", () => {
    expect(costTierForDish(["Lentils, cooked", "Brown rice"])).toBe("low");
    expect(costTierForDish(["Chicken breast", "Rice"])).toBe("medium");
    expect(costTierForDish(["Salmon, Atlantic", "Rice"])).toBe("high");
    expect(costTierForDish(["Tuna, light, canned in water"])).toBe("medium");
    expect(tierFits("medium", "low")).toBe(false);
    expect(tierFits("low", "medium")).toBe(true);
    expect(tierFits("high", "any")).toBe(true);
  });
});

describe("meal planner", () => {
  it("splits the day into 2–5 meals whose shares add up to the whole day", () => {
    for (const n of [2, 3, 4, 5]) {
      const s = slotsForMeals(n);
      expect(s).toHaveLength(n);
      expect(s.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 5);
    }
    expect(slotsForMeals(2).map((s) => s.slot)).toEqual(["lunch", "dinner"]);
    expect(slotsForMeals(5).filter((s) => s.slot === "snack")).toHaveLength(2);
  });

  it("is deterministic", () => {
    expect(generatePlan(DISHES, BASE, WEEK)).toEqual(generatePlan([...DISHES].reverse(), BASE, WEEK));
  });

  it("fills every meal and keeps each day close to the calorie target", () => {
    const plan = generatePlan(DISHES, BASE, WEEK);
    for (const day of plan) {
      expect(day.meals.every(Boolean)).toBe(true);
      const fit = dayFit(day.meals, BASE.calories);
      expect(fit.percentOff).toBeLessThanOrEqual(10);
      expect(fit.status).toBe("close");
      for (const m of day.meals) expect(m!.portion * 4).toBe(Math.round(m!.portion * 4));
    }
  });

  it("never repeats a dish within a day and varies across days", () => {
    const plan = generatePlan(DISHES, BASE, WEEK);
    for (const day of plan) {
      const keys = day.meals.map((m) => m!.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
    const dinners = new Set(plan.map((d) => d.meals[2]!.key));
    expect(dinners.size).toBeGreaterThan(2);
  });

  it("respects meals per day, including snacks", () => {
    const plan = generatePlan(DISHES, { ...BASE, mealsPerDay: 5 }, WEEK.slice(0, 2));
    expect(plan[0]!.meals).toHaveLength(5);
    expect(plan[0]!.meals[1]!.slot).toBe("snack");
    expect(["app:yogurt", "app:apple", "app:hummus"]).toContain(plan[0]!.meals[1]!.key);
  });

  it("follows the diet style", () => {
    const vegan = eligibleCandidates(DISHES, { ...BASE, diet: "vegan" }).map((d) => d.key);
    expect(vegan).toEqual(expect.arrayContaining(["app:tofu", "app:lentils", "app:hummus", "app:apple"]));
    for (const k of ["app:oats", "app:eggs", "app:yogurt", "app:chicken", "app:salmon", "app:steak"]) expect(vegan).not.toContain(k);
    const pesc = eligibleCandidates(DISHES, { ...BASE, diet: "pescatarian" }).map((d) => d.key);
    expect(pesc).toContain("app:salmon");
    expect(pesc).not.toContain("app:chicken");
    const keto = eligibleCandidates(DISHES, { ...BASE, diet: "keto" }).map((d) => d.key);
    expect(keto).toEqual(["app:steak"]);
    expect(dietAllows(DISHES[8]!, "carnivore")).toBe(true);
    expect(dietAllows(DISHES[4]!, "carnivore")).toBe(false);
    expect(dietAllows(DISHES[2]!, "paleo")).toBe(false); // yogurt is dairy
    expect(dietAllows(DISHES[1]!, "daniel_fast")).toBe(false);
  });

  it("leaves out allergies, dislikes and dishes over budget, and says why", () => {
    const s = { ...BASE, allergies: ["peanuts"], dislikes: ["salmon"], budget: "medium" as const };
    const keys = eligibleCandidates(DISHES, s).map((d) => d.key);
    expect(keys).not.toContain("app:oats");
    expect(keys).not.toContain("app:apple");
    expect(keys).not.toContain("app:salmon");
    expect(keys).not.toContain("app:shrimp"); // high tier
    expect(keys).not.toContain("app:steak"); // high tier
    expect(exclusionReason(DISHES[0]!, s)).toEqual({ reason: "allergy", detail: "peanuts" });
    expect(exclusionReason(DISHES[6]!, s)?.reason).toBe("dislike");
    expect(exclusionReason(DISHES[7]!, s)?.reason).toBe("budget");
    for (const day of generatePlan(DISHES, s, WEEK)) for (const m of day.meals) if (m) expect(keys).toContain(m.key);
  });

  it("leaves a meal empty rather than breaking a rule", () => {
    const plan = generatePlan(DISHES, { ...BASE, diet: "keto", mealsPerDay: 4 }, WEEK.slice(0, 1));
    expect(plan[0]!.meals.filter(Boolean).length).toBe(3);
    expect(plan[0]!.meals[2]).toBeNull(); // no keto snack
  });

  it("sizes portions in quarter steps between 0.5 and 2.5", () => {
    expect(portionFor(DISHES[9]!, 1000)).toBe(2.5);
    expect(portionFor(DISHES[6]!, 100)).toBe(0.5);
    expect(portionFor(DISHES[4]!, 700)).toBe(1.25);
  });

  it("offers swaps that fit the meal, best first, without the current dish", () => {
    const [day] = generatePlan(DISHES, BASE, WEEK.slice(0, 1));
    const alts = alternativesFor(DISHES, BASE, day!, 2);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.map((a) => a.key)).not.toContain(day!.meals[2]!.key);
    for (const a of alts) expect(DISHES.find((d) => d.key === a.key)!.slots).toContain("dinner");
    const target = BASE.calories * slotsForMeals(3)[2]!.share;
    expect(Math.abs(alts[0]!.nutrition.calories - target) / target).toBeLessThan(0.15);
    const vegan = alternativesFor(DISHES, { ...BASE, diet: "vegan" }, day!, 2);
    expect(vegan.map((a) => a.key)).toEqual(["app:lentils"]);
  });

  it("reports how close a day is", () => {
    const meals = [{ nutrition: { calories: 900, protein_g: 50, carbs_g: 90, fat_g: 30 } }, { nutrition: { calories: 700, protein_g: 40, carbs_g: 60, fat_g: 20 } }];
    expect(dayTotals(meals)).toEqual({ calories: 1600, protein_g: 90, carbs_g: 150, fat_g: 50 });
    expect(dayFit(meals, 2000)).toMatchObject({ calorieDiff: -400, percentOff: 20, status: "under" });
    expect(dayFit(meals, 1650).status).toBe("close");
    expect(dayFit(meals, 1300).status).toBe("over");
  });

  it("cleans typed exclusion lists", () => {
    expect(cleanTerms(" peanuts, Shellfish ;peanuts\n, ,mushrooms ")).toEqual(["peanuts", "Shellfish", "mushrooms"]);
    expect(cleanTerms(Array.from({ length: 30 }, (_, i) => `x${i}`))).toHaveLength(20);
  });
});
