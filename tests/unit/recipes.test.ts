import { describe, expect, it } from "vitest";
import { computeAmount, sanitizeBasis, type FoodBasis } from "@/lib/domain/food-basis";
import { formatNutrient, ingredientNutrition, isComplete, perServing, recipeTotals, scaleTotals, servingBasis } from "@/lib/domain/recipes";

const rice: FoodBasis = { per100: { calories: 130, protein_g: 2.7, carbs_g: 28.2, fat_g: 0.3, fiber_g: 0.4, sugar_g: 0.1, sodium_mg: 1 }, portions: [{ label: "1 cup", grams: 158 }] };
const chicken: FoodBasis = { per100: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, sugar_g: 0, sodium_mg: 74 } };
// A label-scanned sauce with no fiber, sugar or protein listed.
const sauce: FoodBasis = { per100: { calories: 80, protein_g: 0, carbs_g: 12, fat_g: 3, fiber_g: null, sugar_g: null, sodium_mg: 600 }, missing: ["protein_g"] };

describe("recipe nutrition", () => {
  const ingredients = [
    { basis: rice, quantity: 2, unitId: "p0" }, // 316 g
    { basis: chicken, quantity: 300, unitId: "g" },
  ];

  it("adds ingredients through the diary's own amount maths", () => {
    const t = recipeTotals(ingredients);
    const expected = ingredients.map((i) => computeAmount(i.basis, i.quantity, i.unitId)!.nutrition);
    expect(t.calories.value).toBe(expected[0]!.calories + expected[1]!.calories);
    expect(t.protein_g.value).toBeCloseTo(expected[0]!.protein_g + expected[1]!.protein_g, 1);
    expect(isComplete(t.calories)).toBe(true);
    expect(formatNutrient(t.calories, "calories")).toBe(`${t.calories.value.toLocaleString("en-US")} kcal`);
  });

  it("divides by servings for per-serving values", () => {
    const t = recipeTotals(ingredients);
    const p = perServing(t, 4);
    expect(p.calories.value).toBe(Math.round(t.calories.value / 4));
    expect(p.protein_g.value).toBeCloseTo(t.protein_g.value / 4, 1);
    expect(p.protein_g.known).toBe(2);
    expect(scaleTotals(p, 0.5).calories.value).toBe(Math.round(p.calories.value / 2));
  });

  it("never counts a missing nutrient as zero: totals with gaps are 'at least', none at all is '—'", () => {
    const t = recipeTotals([...ingredients, { basis: sauce, quantity: 100, unitId: "g" }]);
    expect(t.fiber_g.known).toBe(2);
    expect(t.fiber_g.total).toBe(3);
    expect(isComplete(t.fiber_g)).toBe(false);
    expect(formatNutrient(t.fiber_g, "fiber_g")).toMatch(/^at least /);
    expect(formatNutrient(t.protein_g, "protein_g")).toMatch(/^at least /);
    // Sodium is known for all three.
    expect(formatNutrient(t.sodium_mg, "sodium_mg")).not.toMatch(/at least/);
    const onlySauce = recipeTotals([{ basis: sauce, quantity: 50, unitId: "g" }]);
    expect(formatNutrient(onlySauce.sugar_g, "sugar_g")).toBe("—");
    expect(ingredientNutrition({ basis: sauce, quantity: 100, unitId: "g" })!.protein_g).toBeNull();
    expect(formatNutrient(recipeTotals([]).calories, "calories")).toBe("—");
  });

  it("treats an unusable amount as no data, not zero", () => {
    const t = recipeTotals([...ingredients, { basis: rice, quantity: 1, unitId: "nope" }]);
    expect(t.calories.known).toBe(2);
    expect(formatNutrient(t.calories, "calories")).toMatch(/^at least/);
  });

  it("stores one serving for the diary, keeping gaps as unknown", () => {
    const t = recipeTotals([...ingredients, { basis: sauce, quantity: 100, unitId: "g" }]);
    const b = servingBasis(t, 4, "recipe makes 4");
    expect(b.servingOnly).toBe(true);
    expect(b.per100.calories).toBe(perServing(t, 4).calories.value);
    expect(b.per100.fiber_g).toBeNull();
    expect(b.per100.sodium_mg).toBe(perServing(t, 4).sodium_mg.value);
    expect(b.missing).toEqual(["protein_g"]);
    // The stored basis survives sanitizing (what the diary does when reading it back).
    expect(sanitizeBasis(JSON.parse(JSON.stringify(b)))?.missing).toEqual(["protein_g"]);
    // Logging half a serving through the diary path halves it.
    const half = computeAmount(b, 0.5, "serving")!;
    expect(half.nutrition.calories).toBe(Math.round(b.per100.calories * 0.5));
    expect(half.amountLabel).toBe("0.5 servings (recipe makes 4)");
  });
});
