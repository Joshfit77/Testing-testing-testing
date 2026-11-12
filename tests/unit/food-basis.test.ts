import { describe, expect, it } from "vitest";
import { basisFromFoodRow, basisFromLegacyItem, basisUnits, computeAmount, defaultUnit, parseServingWeight, sanitizeBasis, unitIdForLabel, type FoodBasis } from "@/lib/domain/food-basis";
import { nutrientTotals } from "@/lib/domain/nutrition";
import { basisFromOffProduct, normalizeOffProduct, type OffProductResponse } from "@/lib/open-food-facts";

const chicken: FoodBasis = {
  per100: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, sugar_g: 0, sodium_mg: 74 },
  portions: [
    { label: "1 cup, chopped or diced", grams: 140 },
    { label: "0.5 breast, bone and skin removed", grams: 86 },
  ],
};

describe("food basis amounts", () => {
  it("logs 6 oz of roasted chicken breast like MyFitnessPal", () => {
    const r = computeAmount(chicken, 6, "oz")!;
    expect(r.grams).toBeCloseTo(170.1, 1);
    expect(r.amountLabel).toBe("6 oz (170 g)");
    expect(r.nutrition.calories).toBe(281);
    expect(r.nutrition.protein_g).toBeCloseTo(52.7, 1);
    expect(r.nutrition.sodium_mg).toBe(126);
  });
  it("uses USDA household portions and grams", () => {
    expect(computeAmount(chicken, 1.5, "p0")?.amountLabel).toBe("1.5 cup, chopped or diced (210 g)");
    expect(computeAmount(chicken, 200, "g")?.nutrition.calories).toBe(330);
    expect(computeAmount(chicken, 0, "g")).toBeNull();
    expect(computeAmount(chicken, 1, "serving")).toBeNull();
    expect(defaultUnit(chicken)).toEqual({ unitId: "p0", quantity: 1 });
    expect(defaultUnit({ per100: chicken.per100 })).toEqual({ unitId: "g", quantity: 100 });
  });
  it("finds a saved unit again by its label", () => {
    expect(unitIdForLabel(chicken, "oz")).toBe("oz");
    expect(unitIdForLabel(chicken, "0.5 breast, bone and skin removed")).toBe("p1");
    expect(unitIdForLabel(chicken, "slice")).toBeNull();
  });
  it("handles serving-only foods without inventing a weight", () => {
    const b: FoodBasis = { per100: { calories: 450, protein_g: 20, carbs_g: 40, fat_g: 22 }, servingOnly: true, servingLabel: "1 sandwich" };
    expect(basisUnits(b).map((u) => u.id)).toEqual(["serving"]);
    const r = computeAmount(b, 2, "serving")!;
    expect(r.grams).toBeNull();
    expect(r.nutrition.calories).toBe(900);
    expect(r.amountLabel).toBe("2 servings (1 sandwich)");
  });
});

describe("bases from stored foods", () => {
  it("parses serving weights from built-in serving units", () => {
    expect(parseServingWeight(4, "oz (113 g)")).toEqual({ grams: 113, liquid: false });
    expect(parseServingWeight(1, "cup (248 ml)")).toEqual({ grams: 248, liquid: true });
    expect(parseServingWeight(100, "g")).toEqual({ grams: 100, liquid: false });
    expect(parseServingWeight(1, "sandwich")).toBeNull();
  });
  it("turns a per-serving food into per-100 g with the serving as a unit", () => {
    const b = basisFromFoodRow({ serving_size: 4, serving_unit: "oz (113 g)", calories: 187, protein_g: 35, carbs_g: 0, fat_g: 4 });
    expect(b.servingGrams).toBe(113);
    expect(b.servingLabel).toBe("4 oz (113 g)");
    expect(computeAmount(b, 1, "serving")?.nutrition.calories).toBe(187);
    expect(basisUnits(b).map((u) => u.id)).toEqual(["serving", "g", "oz", "lb"]);
  });
  it("keeps per-100 g cached foods in grams and unknown units as servings", () => {
    const cached = basisFromFoodRow({ serving_size: 100, serving_unit: "g", calories: 539, protein_g: 6.3, carbs_g: 57.5, fat_g: 30.9 });
    expect(basisUnits(cached).map((u) => u.id)).toEqual(["g", "oz", "lb"]);
    const sandwich = basisFromFoodRow({ serving_size: 1, serving_unit: "sandwich", calories: 450, protein_g: 20, carbs_g: 40, fat_g: 22 });
    expect(sandwich.servingOnly).toBe(true);
    expect(sandwich.servingLabel).toBe("1 sandwich");
  });
  it("rebuilds a basis for entries logged before amounts were stored", () => {
    const b = basisFromLegacyItem({ servings: 2, calories: 420, protein_g: 4, carbs_g: 108, fat_g: 1 });
    expect(computeAmount(b, 2, "serving")?.nutrition.calories).toBe(420);
    expect(computeAmount(b, 1, "serving")?.nutrition.calories).toBe(210);
  });
  it("sanitizes stored bases", () => {
    expect(sanitizeBasis(null)).toBeNull();
    expect(sanitizeBasis({ per100: { calories: -1 } })).toBeNull();
    const s = sanitizeBasis({ per100: { calories: 100, protein_g: "x" }, portions: [{ label: "1 cup", grams: 50 }, { label: 3, grams: 2 }], evil: true });
    expect(s).toEqual({ per100: { calories: 100, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: null, sugar_g: null, sodium_mg: null }, portions: [{ label: "1 cup", grams: 50 }] });
  });
});

describe("Open Food Facts products", () => {
  it("defaults to the label serving with grams and ounces", () => {
    const json: OffProductResponse = {
      status: 1,
      product: {
        product_name: "Protein bar",
        brands: "Example",
        serving_size: "1 bar (60 g)",
        serving_quantity: 60,
        nutriments: { "energy-kcal_100g": 350, proteins_100g: 33.3, carbohydrates_100g: 40, fat_100g: 11.7, sugars_100g: 5, sodium_100g: 0.4 },
      },
    };
    const r = normalizeOffProduct(json, "0000000000017");
    if (r.status !== "found") throw new Error("expected found");
    const b = basisFromOffProduct(r.product);
    expect(basisUnits(b).map((u) => u.label)).toEqual(["serving (1 bar (60 g))", "g", "oz", "lb"]);
    expect(defaultUnit(b)).toEqual({ unitId: "serving", quantity: 1 });
    const one = computeAmount(b, 1, "serving")!;
    expect(one.nutrition.calories).toBe(210);
    expect(one.nutrition.sodium_mg).toBe(240);
    expect(one.amountLabel).toBe("1 bar (60 g)");
  });
  it("offers ml and fl oz for drinks", () => {
    const r = normalizeOffProduct(
      { status: 1, product: { product_name: "Cola", serving_size: "1 can (355 ml)", serving_quantity: 355, serving_quantity_unit: "ml", nutriments: { "energy-kcal_100g": 42, carbohydrates_100g: 10.6 } } },
      "5449000000996",
    );
    if (r.status !== "found") throw new Error("expected found");
    expect(basisUnits(basisFromOffProduct(r.product)).map((u) => u.id)).toEqual(["serving", "ml", "floz"]);
  });
});

describe("nutrient totals", () => {
  it("counts only foods that report each nutrient", () => {
    const t = nutrientTotals([
      { fiber_g: 2, sugar_g: 1, sodium_mg: 100 },
      { fiber_g: null, sugar_g: "3.5", sodium_mg: null },
      {},
    ]);
    expect(t.items).toBe(3);
    expect(t.fiber).toEqual({ total: 2, count: 1 });
    expect(t.sugar).toEqual({ total: 4.5, count: 2 });
    expect(t.sodium).toEqual({ total: 100, count: 1 });
  });
});
