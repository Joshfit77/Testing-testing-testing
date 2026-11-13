import { describe, expect, it } from "vitest";
import { computeAmount, type FoodBasis } from "@/lib/domain/food-basis";
import { ingredientNutrition, parseScaledServings, recipeTotals, scaleIngredient, scaleTotals } from "@/lib/domain/recipes";

const rice: FoodBasis = { per100: { calories: 130, protein_g: 2.7, carbs_g: 28.2, fat_g: 0.3, fiber_g: 0.4, sugar_g: 0.1, sodium_mg: 1 }, portions: [{ label: "1 cup", grams: 158 }] };
const chicken: FoodBasis = { per100: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, sugar_g: 0, sodium_mg: 74 } };
const withLabel = (basis: FoodBasis, quantity: number, unitId: string) => ({ basis, quantity, unitId, amountLabel: computeAmount(basis, quantity, unitId)!.amountLabel });

describe("scaling a recipe to more or fewer servings (display only)", () => {
  it("accepts whole numbers from 1 to 50 only", () => {
    expect(parseScaledServings("6")).toBe(6);
    for (const bad of ["0", "51", "2.5", "x", undefined, "-3"]) expect(parseScaledServings(bad)).toBeNull();
  });

  it("scales each amount in its own unit and re-describes it", () => {
    const cups = scaleIngredient(withLabel(rice, 2, "p0"), 1.5);
    expect(cups.quantity).toBe(3);
    expect(cups.amountLabel).toBe(computeAmount(rice, 3, "p0")!.amountLabel);
    const grams = scaleIngredient(withLabel(chicken, 300, "g"), 0.5);
    expect(grams.quantity).toBe(150);
  });

  it("scaled ingredient nutrition adds up to the scaled totals", () => {
    const ings = [withLabel(rice, 2, "p0"), withLabel(chicken, 300, "g")];
    const scaled = ings.map((i) => scaleIngredient(i, 1.5));
    const fromIngredients = recipeTotals(scaled);
    const fromTotals = scaleTotals(recipeTotals(ings), 1.5);
    // Each ingredient's calories are rounded to whole kcal before adding up, so allow up to 1 kcal.
    expect(Math.abs(fromIngredients.calories.value - fromTotals.calories.value)).toBeLessThanOrEqual(1);
    expect(Math.abs(fromIngredients.protein_g.value - fromTotals.protein_g.value)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(ingredientNutrition(scaled[1]!)!.calories! - ingredientNutrition(ings[1]!)!.calories! * 1.5)).toBeLessThanOrEqual(1);
  });

  it("a factor of 1 returns the ingredient unchanged", () => {
    const i = withLabel(rice, 2, "p0");
    expect(scaleIngredient(i, 1)).toBe(i);
  });
});
