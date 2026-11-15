/**
 * Audit 2026-11-14 (nutrition / GPS / health). Nutrition maths checked against figures worked out by hand.
 * No food database is contacted: every food below is written out in the test.
 */
import { describe, expect, it } from "vitest";
import { ACTIVITY_LEVELS, calorieBudget, MAX_CALORIE_TARGET, WEEKLY_RATES_KG } from "@/lib/domain/calorie-budget";
import { DIET_TYPES, MACRO_TARGET_MAX, macroSplitForDiet } from "@/lib/domain/diets";
import { basisFromFoodRow, basisUnits, computeAmount, type FoodBasis } from "@/lib/domain/food-basis";
import { GRAMS_PER_OZ, parseQuantity } from "@/lib/domain/food-units";
import { dayTotals, scaleNutrition as planPortion } from "@/lib/domain/meal-planner";
import { activityFactor, caloriesFromMacros, estimateNutritionTargets, mifflinStJeor, nutrientTotals, sumMacros } from "@/lib/domain/nutrition";
import { summarizeDay, weeklyInsights } from "@/lib/domain/nutrition-insights";
import { formatNutrient, perServing, recipeTotals, scaleIngredient, servingBasis } from "@/lib/domain/recipes";
import { stepAverage } from "@/lib/domain/steps";
import { waterLitres } from "@/lib/domain/diary";
import { basisFromOffProduct, normalizeOffProduct } from "@/lib/open-food-facts";
import { amountColumns } from "@/server/services/diary-write";

/** USDA SR Legacy 173944 "Bananas, raw": per 100 g, with USDA's household portions. */
const banana: FoodBasis = {
  per100: { calories: 89, protein_g: 1.09, carbs_g: 22.84, fat_g: 0.33, fiber_g: 2.6, sugar_g: 12.23, sodium_mg: 1 },
  portions: [
    { label: '1 medium (7" to 7-7/8" long)', grams: 118 },
    { label: "1 cup, sliced", grams: 150 },
  ],
};
/** Olive oil: 884 kcal and 100 g fat per 100 g; 1 tbsp = 13.5 g. */
const oliveOil: FoodBasis = { per100: { calories: 884, protein_g: 0, carbs_g: 0, fat_g: 100 }, portions: [{ label: "1 tbsp", grams: 13.5 }] };

describe("serving-size multiplication and unit conversion", () => {
  it("grams: 150 g of banana is 1.5 × the per-100 g values", () => {
    const r = computeAmount(banana, 150, "g")!;
    // 89 × 1.5 = 133.5 → 134; 1.09 × 1.5 = 1.635 → 1.6; 22.84 × 1.5 = 34.26 → 34.3; 0.33 × 1.5 = 0.495 → 0.5.
    expect(r.nutrition).toMatchObject({ calories: 134, protein_g: 1.6, carbs_g: 34.3, fat_g: 0.5, fiber_g: 3.9, sugar_g: 18.3, sodium_mg: 2 });
    expect(r.grams).toBe(150);
  });

  it("ounces and pounds: 4 oz = 113.4 g, 0.5 lb = 226.8 g", () => {
    const oz = computeAmount(banana, 4, "oz")!;
    expect(oz.grams).toBe(113.4);
    // 89 × 1.13398 = 100.9 → 101.
    expect(oz.nutrition.calories).toBe(101);
    const lb = computeAmount(banana, 0.5, "lb")!;
    expect(lb.grams).toBe(226.8);
    // 8 oz and half a pound are the same food.
    expect(computeAmount(banana, 8, "oz")!.nutrition).toEqual(lb.nutrition);
    expect(GRAMS_PER_OZ * 16).toBeCloseTo(453.59237, 6);
  });

  it("household units: 1 medium = 118 g, 2 cups sliced = 300 g, 1.5 tbsp oil = 20.25 g", () => {
    const medium = computeAmount(banana, 1, "p0")!;
    // 89 × 1.18 = 105.02 → 105; 22.84 × 1.18 = 26.95 → 27.0.
    expect(medium.grams).toBe(118);
    expect(medium.nutrition).toMatchObject({ calories: 105, carbs_g: 27, protein_g: 1.3 });
    expect(computeAmount(banana, 2, "p1")!.nutrition.calories).toBe(267); // 89 × 3
    const oil = computeAmount(oliveOil, 1.5, "p0")!;
    // 884 × 0.2025 = 179.01 → 179 kcal; fat 20.25 → 20.3 g.
    expect(oil.nutrition).toMatchObject({ calories: 179, fat_g: 20.3, protein_g: 0 });
    expect(oil.amountLabel).toBe("1.5 tbsp (20 g)");
  });

  it("typed fractions: 1 1/2 and 3/4 are read as numbers, junk is refused", () => {
    expect(parseQuantity("1 1/2")).toBe(1.5);
    expect(parseQuantity("3/4")).toBe(0.75);
    expect(parseQuantity("1,5")).toBe(1.5);
    expect(Number.isNaN(parseQuantity("two"))).toBe(true);
    expect(computeAmount(banana, 0, "g")).toBeNull();
    expect(computeAmount(banana, 1, "cup")).toBeNull();
  });

  it("liquids are measured in ml and fl oz: 12 fl oz of a 42 kcal/100 ml drink is 149 kcal", () => {
    const cola: FoodBasis = { per100: { calories: 42, protein_g: 0, carbs_g: 10.6, fat_g: 0 }, liquid: true };
    expect(basisUnits(cola).map((u) => u.id)).toEqual(["ml", "floz"]);
    const r = computeAmount(cola, 12, "floz")!;
    // 12 × 29.5735 = 354.88 ml; 42 × 3.5488 = 149.05 → 149; carbs 37.6.
    expect(r.grams).toBe(354.9);
    expect(r.nutrition).toMatchObject({ calories: 149, carbs_g: 37.6 });
  });
});

describe("a food with only per-100 g data, and one with only per-serving data", () => {
  it("per-100 g only (no serving on the label): logs by weight, and no serving unit is invented", () => {
    const lookup = normalizeOffProduct({ status: 1, product: { code: "5000000000029", product_name: "Rolled oats", nutriments: { "energy-kcal_100g": 379, proteins_100g: 13.2, carbohydrates_100g: 67.7, fat_g: 6.5, fat_100g: 6.5 } } }, "5000000000029");
    expect(lookup.status).toBe("found");
    if (lookup.status !== "found") return;
    expect(lookup.product.perServing).toBeNull();
    const basis = basisFromOffProduct(lookup.product);
    expect(basisUnits(basis).map((u) => u.id)).toEqual(["g", "oz", "lb"]);
    // 40 g: 379 × 0.4 = 151.6 → 152; protein 5.28 → 5.3; carbs 27.08 → 27.1; fat 2.6.
    expect(computeAmount(basis, 40, "g")!.nutrition).toMatchObject({ calories: 152, protein_g: 5.3, carbs_g: 27.1, fat_g: 2.6 });
    expect(computeAmount(basis, 1, "serving")).toBeNull();
  });

  it("per-serving only (no weight on the label): logs by servings, and no gram weight is invented", () => {
    const lookup = normalizeOffProduct({ status: 1, product: { code: "5000000000036", product_name: "Protein bar", serving_size: "1 bar", nutriments: { "energy-kcal_serving": 210, proteins_serving: 20, carbohydrates_serving: 22, fat_serving: 7 } } }, "5000000000036");
    expect(lookup.status).toBe("found");
    if (lookup.status !== "found") return;
    expect(lookup.product.per100).toBeNull();
    const basis = basisFromOffProduct(lookup.product);
    expect(basis.servingOnly).toBe(true);
    expect(basisUnits(basis).map((u) => u.id)).toEqual(["serving"]);
    const r = computeAmount(basis, 1.5, "serving")!;
    expect(r.grams).toBeNull();
    expect(r.nutrition).toMatchObject({ calories: 315, protein_g: 30, carbs_g: 33, fat_g: 10.5 });
    expect(computeAmount(basis, 100, "g")).toBeNull();
    // Stored with the amount in servings and no weight.
    expect(amountColumns(basis, 1.5, "serving")).toMatchObject({ grams: null, quantity: 1.5, calories: 315 });
  });

  it("a saved food entered per serving with a weight converts both ways: 1 serving = 30 g = 1.06 oz", () => {
    const basis = basisFromFoodRow({ serving_size: 1, serving_unit: "scoop (30 g)", calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5 });
    expect(basis.per100).toMatchObject({ calories: 400, protein_g: 80, carbs_g: 10, fat_g: 5 });
    expect(computeAmount(basis, 2, "serving")!.nutrition).toMatchObject({ calories: 240, protein_g: 48 });
    expect(computeAmount(basis, 60, "g")!.nutrition).toEqual(computeAmount(basis, 2, "serving")!.nutrition);
    // 1 oz = 28.35 g → 113.4 kcal → 113.
    expect(computeAmount(basis, 1, "oz")!.nutrition.calories).toBe(113);
  });
});

describe("energy: kcal and kJ sources", () => {
  const product = (nutriments: Record<string, number>) => normalizeOffProduct({ status: 1, product: { code: "5000000000043", product_name: "X", nutriments } }, "5000000000043");
  const kcal = (r: ReturnType<typeof product>) => (r.status === "found" ? r.product.per100?.calories : null);

  it("kJ only: 1,590 kJ per 100 g is 380 kcal", () => {
    // 1590 ÷ 4.184 = 380.02.
    expect(kcal(product({ "energy-kj_100g": 1590, proteins_100g: 13 }))).toBe(380);
    expect(kcal(product({ energy_100g: 1590, proteins_100g: 13 }))).toBe(380);
  });

  it("both listed: the kcal figure is used as given, not re-derived from kJ", () => {
    expect(kcal(product({ "energy-kcal_100g": 372, "energy-kj_100g": 1590 }))).toBe(372);
  });

  it("a kJ number typed into the kcal field (over 1,000 per 100 g) is not accepted as kcal", () => {
    // 2,100 "kcal" per 100 g is impossible (pure fat is about 900); the kJ field is used instead.
    expect(kcal(product({ "energy-kcal_100g": 2100, "energy-kj_100g": 2100 }))).toBe(501.9);
  });

  it("no energy at all: the product has no nutrition, never 0 kcal", () => {
    expect(product({ proteins_100g: 10 }).status).toBe("no_nutrition");
  });

  it("calories that disagree with the macros are kept as the source gave them (4/4/9 is a check, never a replacement)", () => {
    const r = product({ "energy-kcal_100g": 50, proteins_100g: 20, carbohydrates_100g: 50, fat_100g: 20 });
    expect(kcal(r)).toBe(50);
    // 20×4 + 50×4 + 20×9 = 460: the label is internally inconsistent by 410 kcal.
    expect(caloriesFromMacros({ protein_g: 20, carbs_g: 50, fat_g: 20 })).toBe(460);
  });
});

describe("rounding: totals are summed, then rounded", () => {
  it("three foods of 0.4 g protein total 1.2 g, not 0 (each rounds to 0 on its own)", () => {
    const day = summarizeDay("2026-11-10", [1, 2, 3].map(() => ({ date: "2026-11-10", name: "x", source: null, calories: 33.4, protein_g: 0.4, carbs_g: 0.4, fat_g: 0.4 })), null);
    // 33.4 × 3 = 100.2 → 100; 0.4 × 3 = 1.2 → 1.
    expect(day.totals).toEqual({ calories: 100, protein_g: 1, carbs_g: 1, fat_g: 1 });
  });

  it("the diary's running total of stored values (one decimal) has no drift over 50 entries", () => {
    const items = Array.from({ length: 50 }, () => ({ calories: 100, protein_g: 0.1, carbs_g: 33.3, fat_g: 0.7 }));
    expect(sumMacros(items)).toEqual({ calories: 5000, protein_g: 5, carbs_g: 1665, fat_g: 35 });
  });

  it("the weekly average divides by logged days only: 2 logged days of 2,000 and 1,000 average 1,500, not 429", () => {
    const dates = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];
    const w = weeklyInsights(
      dates,
      [
        { date: "2026-11-03", name: "a", source: null, calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 },
        { date: "2026-11-06", name: "b", source: null, calories: 1000, protein_g: 50, carbs_g: 100, fat_g: 40 },
      ],
      {},
    );
    expect(w.loggedDays).toBe(2);
    expect(w.notLoggedDays).toBe(5);
    expect(w.average).toEqual({ calories: 1500, protein_g: 100, carbs_g: 150, fat_g: 50 });
  });

  it("fiber, sugar and sodium totals say how many foods had a value instead of counting the others as 0", () => {
    const t = nutrientTotals([{ fiber_g: 3, sugar_g: null, sodium_mg: 200 }, { fiber_g: null, sugar_g: null, sodium_mg: "150" }, { fiber_g: 0, sugar_g: undefined, sodium_mg: null }]);
    expect(t.fiber).toEqual({ total: 3, count: 2 });
    expect(t.sugar).toEqual({ total: 0, count: 0 });
    expect(t.sodium).toEqual({ total: 350, count: 2 });
  });
});

describe("recipes: per serving, scaling, and unknown values", () => {
  const ingredients = [
    { basis: banana, quantity: 2, unitId: "p0", amountLabel: "2 medium (236 g)" }, // 236 g: 210 kcal, 2.6 P, 53.9 C, 0.8 F
    { basis: oliveOil, quantity: 1, unitId: "p0", amountLabel: "1 tbsp (14 g)" }, // 13.5 g: 119 kcal, 13.5 F
    { basis: { per100: { calories: 379, protein_g: 13.2, carbs_g: 67.7, fat_g: 6.5 } } as FoodBasis, quantity: 80, unitId: "g", amountLabel: "80 g" }, // 303 kcal, 10.6 P, 54.2 C, 5.2 F
  ];

  it("whole recipe: 632 kcal, 13.2 g protein, 108.1 g carbs, 19.5 g fat", () => {
    const t = recipeTotals(ingredients);
    expect(t.calories.value).toBe(632);
    expect(t.protein_g.value).toBe(13.2);
    expect(t.carbs_g.value).toBe(108.1);
    expect(t.fat_g.value).toBe(19.5);
  });

  it("per serving for 4 servings: 158 kcal, 3.3 g protein, 27 g carbs, 4.9 g fat", () => {
    const s = perServing(recipeTotals(ingredients), 4);
    expect([s.calories.value, s.protein_g.value, s.carbs_g.value, s.fat_g.value]).toEqual([158, 3.3, 27, 4.9]);
  });

  it("scaling 4 servings to 6 multiplies each ingredient by 1.5 and re-describes its amount", () => {
    const scaled = ingredients.map((i) => scaleIngredient(i, 6 / 4));
    expect(scaled.map((i) => i.quantity)).toEqual([3, 1.5, 120]);
    expect(scaled[1]!.amountLabel).toBe("1.5 tbsp (20 g)");
    // 1.5 × the whole recipe, to the rounding of each ingredient: 632 × 1.5 = 948.
    expect(Math.abs(recipeTotals(scaled).calories.value - 948)).toBeLessThanOrEqual(2);
  });

  it("an ingredient without sugar data makes the recipe's sugar a minimum, and fiber with no data at all is unknown", () => {
    const t = recipeTotals(ingredients);
    // Only the banana lists sugar (12.23 × 2.36 = 28.9) and fiber (2.6 × 2.36 = 6.1).
    expect(formatNutrient(t.sugar_g, "sugar_g")).toBe("at least 28.9 g");
    expect(formatNutrient(t.fiber_g, "fiber_g")).toBe("at least 6.1 g");
    expect(formatNutrient(recipeTotals([ingredients[1]!]).fiber_g, "fiber_g")).toBe("—");
    // Logged to the diary, the incomplete values are stored as unknown, never as a number.
    const basis = servingBasis(t, 4, "1 serving");
    expect(basis.per100.sugar_g).toBeNull();
    expect(basis.per100.fiber_g).toBeNull();
    expect(basis.missing).toBeUndefined();
  });

  it("an ingredient whose source lists no protein makes the recipe's protein 'at least', and the diary entry says so", () => {
    const noProtein: FoodBasis = { per100: { calories: 304, protein_g: 0, carbs_g: 82, fat_g: 0 }, missing: ["protein_g", "fat_g"] };
    const t = recipeTotals([...ingredients, { basis: noProtein, quantity: 20, unitId: "g" }]);
    expect(formatNutrient(t.protein_g, "protein_g")).toBe("at least 13.2 g");
    expect(servingBasis(t, 4, "1 serving").missing).toEqual(["protein_g", "fat_g"]);
  });
});

describe("meal-plan day totals", () => {
  it("portions scale one serving, and the day is the sum of its meals", () => {
    const oats = { calories: 310, protein_g: 12.4, carbs_g: 48.2, fat_g: 7.3 };
    const bowl = { calories: 540, protein_g: 41.5, carbs_g: 55.1, fat_g: 16.2 };
    const a = planPortion(oats, 1.25); // 387.5 → 388, 15.5, 60.25 → 60.3, 9.125 → 9.1
    const b = planPortion(bowl, 0.75); // 405, 31.125 → 31.1, 41.325 → 41.3, 12.15 → 12.2 (floating 12.149… → 12.1)
    expect(a).toEqual({ calories: 388, protein_g: 15.5, carbs_g: 60.3, fat_g: 9.1 });
    expect(b.calories).toBe(405);
    const day = dayTotals([{ nutrition: a }, null, { nutrition: b }]);
    expect(day.calories).toBe(793);
    expect(day.protein_g).toBe(Math.round(15.5 + b.protein_g));
  });
});

describe("daily targets (estimates)", () => {
  it("Mifflin-St Jeor by hand: man 80 kg, 180 cm, 30 y = 1,780; woman 65 kg, 165 cm, 40 y = 1,320.25", () => {
    // 10×80 + 6.25×180 − 5×30 + 5 = 800 + 1125 − 150 + 5.
    expect(mifflinStJeor(80, 180, 30, "male")).toBe(1780);
    // 650 + 1031.25 − 200 − 161.
    expect(mifflinStJeor(65, 165, 40, "female")).toBe(1320.25);
    // Not stated: midway between the two constants (+5 and −161 → −78).
    expect(mifflinStJeor(80, 180, 30, "unspecified")).toBe(1697);
  });

  it("budget: maintenance = resting energy × activity; 0.5 kg a week is 550 kcal a day", () => {
    const b = calorieBudget({ sex: "male", age: 30, heightCm: 180, weightKg: 80, activity: "light", weeklyChangeKg: -0.5, goal: "lose_fat", diet: "balanced" });
    // 1780 × 1.375 = 2447.5 → 2448. Deficit 0.5 × 7700 ÷ 7 = 550. 2448 − 550 = 1898 → 1,900 (nearest 10).
    expect(b.maintenance).toBe(2448);
    expect(b.calories).toBe(1900);
    expect(b.dailyAdjustment).toBe(-548);
    // Protein 1.8 g/kg = 144 g (576 kcal); fat 30% = 570 ÷ 9 = 63 g; carbs (1900 − 576 − 567) ÷ 4 = 189 g.
    expect([b.protein_g, b.fat_g, b.carbs_g]).toEqual([144, 63, 189]);
    expect(caloriesFromMacros(b)).toBe(1899);
  });

  it("never suggests less than the floor (1,200 women, 1,500 men, 1,350 not stated) and says when it was raised", () => {
    const small = calorieBudget({ sex: "female", age: 60, heightCm: 150, weightKg: 45, activity: "sedentary", weeklyChangeKg: -1, goal: "lose_fat" });
    // Resting 450 + 937.5 − 300 − 161 = 926.5; × 1.2 = 1112 → already under the floor.
    expect(small.maintenance).toBe(1112);
    expect(small.calories).toBe(1200);
    expect(small.floored).toBe(true);
    expect(calorieBudget({ sex: "male", age: 60, heightCm: 150, weightKg: 45, activity: "sedentary", weeklyChangeKg: -1, goal: "lose_fat" }).calories).toBe(1500);
    expect(calorieBudget({ sex: null, age: 60, heightCm: 150, weightKg: 45, activity: "sedentary", weeklyChangeKg: -1, goal: "lose_fat" }).calories).toBe(1350);
  });

  it("the deficit is capped at a quarter of maintenance and at 1,000 kcal a day", () => {
    const b = calorieBudget({ sex: "female", age: 40, heightCm: 165, weightKg: 65, activity: "sedentary", weeklyChangeKg: -1, goal: "lose_fat" });
    // Maintenance 1320.25 × 1.2 = 1584; a quarter is 396; 1584 − 396 = 1188 → 1,190 → floor 1,200.
    expect(b.calories).toBe(1200);
    const big = calorieBudget({ sex: "male", age: 25, heightCm: 195, weightKg: 140, activity: "very_active", weeklyChangeKg: -1, goal: "lose_fat" });
    // Resting 1400 + 1218.75 − 125 + 5 = 2498.75; × 1.725 = 4310; 1 kg a week would be 1,100: capped at 1,000.
    expect(big.maintenance).toBe(4310);
    expect(big.calories).toBe(3310);
  });

  it("the older training-days estimate is clamped to 1,200–5,000 kcal and 1.5–5 L of water", () => {
    expect(activityFactor(0)).toBe(1.3);
    expect(activityFactor(4)).toBe(1.6);
    const light = estimateNutritionTargets({ weightKg: 30, trainingDaysPerWeek: 0, goal: "lose_fat" });
    expect(light.calories).toBe(1200);
    expect(light.water_ml).toBe(1500);
    const heavy = estimateNutritionTargets({ weightKg: 400, trainingDaysPerWeek: 7, goal: "build_muscle" });
    expect(heavy.calories).toBe(5000);
    expect(heavy.water_ml).toBe(5000);
    expect(heavy.is_estimate).toBe(true);
    // 80 kg: 33 ml per kg = 2,640 → 2,650 (nearest 50).
    expect(estimateNutritionTargets({ weightKg: 80, trainingDaysPerWeek: 3, goal: "general_health" }).water_ml).toBe(2650);
  });

  it("the macros never ask for more energy than the calorie target (a 100 kg woman on 1,280 kcal, high protein)", () => {
    // Before: 220 g protein + 60 g fat = 1,420 kcal of macros on a 1,280 kcal budget.
    const b = calorieBudget({ sex: "female", age: 70, heightCm: 150, weightKg: 100, activity: "sedentary", weeklyChangeKg: -1, goal: "lose_fat", diet: "high_protein" });
    expect(b.calories).toBe(1280);
    // Fat minimum 0.6 g/kg = 60 g (540 kcal); protein takes what is left: (1280 − 540) ÷ 4 = 185 g.
    expect([b.protein_g, b.fat_g, b.carbs_g]).toEqual([185, 60, 0]);
    expect(caloriesFromMacros(b)).toBe(1280);
  });

  it("every profile the sign-up form accepts gets macros that fit its calories and can be saved", () => {
    const failures: string[] = [];
    for (const diet of DIET_TYPES)
      for (const weightKg of [25, 40, 60, 80, 100, 120, 150, 180, 230, 280, 400])
        for (const sex of ["male", "female", null] as const)
          for (const activity of ACTIVITY_LEVELS)
            for (const weeklyChangeKg of WEEKLY_RATES_KG)
              for (const goal of ["lose_fat", "general_health"] as const)
                for (const [age, heightCm] of [
                  [18, 200],
                  [35, 170],
                  [80, 140],
                ] as const) {
                  const b = calorieBudget({ sex, age, heightCm, weightKg, activity, weeklyChangeKg, goal, diet });
                  const kcal = b.protein_g * 4 + b.carbs_g * 4 + b.fat_g * 9;
                  const savable = b.calories >= 800 && b.calories <= MAX_CALORIE_TARGET && b.protein_g >= 0 && b.protein_g <= MACRO_TARGET_MAX.protein_g && b.carbs_g >= 0 && b.carbs_g <= MACRO_TARGET_MAX.carbs_g && b.fat_g >= 0 && b.fat_g <= MACRO_TARGET_MAX.fat_g;
                  // Whole grams: fat rounds by up to 4.5 kcal and carbs by up to 2.
                  if (kcal > b.calories + 7 || !savable) failures.push(`${diet} ${weightKg} kg ${sex} ${activity} ${weeklyChangeKg} ${goal} ${age} y ${heightCm} cm: ${b.calories} kcal, macros ${kcal} kcal (P${b.protein_g} C${b.carbs_g} F${b.fat_g})`);
                }
    expect(failures.slice(0, 5)).toEqual([]);
    expect(failures).toHaveLength(0);
  });

  it("ordinary profiles are unchanged by the fit: 80 kg on 2,000 kcal for each diet style adds up to 2,000", () => {
    for (const diet of DIET_TYPES) {
      const m = macroSplitForDiet(2000, 80, diet, 1.8);
      expect(Math.abs(caloriesFromMacros(m) - 2000), diet).toBeLessThanOrEqual(7);
    }
    expect(macroSplitForDiet(2000, 80, "balanced", 1.8)).toEqual({ protein_g: 144, fat_g: 67, carbs_g: 205 });
    expect(macroSplitForDiet(2000, 80, "keto", 1.8)).toEqual({ protein_g: 128, carbs_g: 25, fat_g: 154 });
  });
});

describe("water", () => {
  it("is kept in millilitres and shown in litres: 1,250 of 2,650 ml reads 1.25 of 2.7 L", () => {
    expect(waterLitres(1250, 2650)).toEqual({ total: "1.25", goal: "2.7" });
    expect(waterLitres(0, 2500)).toEqual({ total: "0", goal: "2.5" });
  });
});

describe("steps: a day with nothing recorded is unknown, not zero", () => {
  const week = [0, 0, 0, 0, 9000, 0, 9000].map((steps, i) => ({ day: `2026-11-0${i + 1}`, steps }));

  it("two synced days of 9,000 average 9,000 over 2 days, not 2,571 over 7", () => {
    expect(stepAverage(week, 2)).toEqual({ average: 9000, days: 2 });
    expect(stepAverage(week)).toEqual({ average: 9000, days: 2 });
  });

  it("a day stored as 0 steps counts as a day when the caller knows it was recorded", () => {
    // Three stored days (one of them a real 0): 18,000 ÷ 3.
    expect(stepAverage(week, 3)).toEqual({ average: 6000, days: 3 });
  });

  it("no count at all has no average", () => {
    expect(stepAverage(week.map((d) => ({ ...d, steps: 0 })), 0)).toEqual({ average: null, days: 0 });
    expect(stepAverage([])).toEqual({ average: null, days: 0 });
  });
});
