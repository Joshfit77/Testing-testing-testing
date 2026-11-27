import { describe, expect, it, vi } from "vitest";
import { incompleteMacros, sanitizeBasis } from "@/lib/domain/food-basis";

/**
 * A FoodData Central food that doesn't list a macro: the value is unknown, not zero. The basis built from it carries
 * the macro under `missing` (as Open Food Facts products do), so the diary's totals read "at least".
 */
vi.mock("server-only", () => ({}));
vi.mock("@/server/env", () => ({ serverEnv: { usdaApiKey: "test" } }));

const { externalFoodBasis, normalizeFdcFood } = await import("@/server/services/food-database");

const n = (number: string, value: number | null | undefined) => ({ nutrientNumber: number, ...(value == null ? {} : { value }) });

describe("USDA foods with macros that aren't listed", () => {
  it("records an absent or valueless macro as missing, never as a known zero", () => {
    // Energy and protein listed; carbohydrate absent; fat present with no value.
    const food = normalizeFdcFood({ fdcId: 123, description: "Mystery bar", foodNutrients: [n("208", 410), n("203", 12.34), n("204", null)] })!;
    expect(food.missing).toEqual(["carbs_g", "fat_g"]);
    expect(food.protein_g).toBe(12.3);
    const basis = externalFoodBasis(food);
    expect(basis.missing).toEqual(["carbs_g", "fat_g"]);
    expect(basis.per100).toMatchObject({ calories: 410, protein_g: 12.3 });
    // The stored basis survives the sanitiser, and a day that includes this food is marked incomplete for those macros.
    expect(sanitizeBasis(basis)?.missing).toEqual(["carbs_g", "fat_g"]);
    expect(incompleteMacros([{ basis }])).toEqual(["carbs_g", "fat_g"]);
  });

  it("keeps a real zero as a zero", () => {
    const food = normalizeFdcFood({ fdcId: 1, description: "Olive oil", foodNutrients: [n("208", 884), n("203", 0), n("205", 0), n("204", 100)] })!;
    expect(food.missing).toEqual([]);
    const basis = externalFoodBasis(food);
    expect(basis).not.toHaveProperty("missing");
    expect(basis.per100).toMatchObject({ protein_g: 0, carbs_g: 0, fat_g: 100 });
    expect(incompleteMacros([{ basis }])).toEqual([]);
  });

  it("still drops a food with no energy value at all", () => {
    expect(normalizeFdcFood({ fdcId: 2, description: "No data", foodNutrients: [n("203", 5)] })).toBeNull();
  });
});
