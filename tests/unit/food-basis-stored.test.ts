import { describe, expect, it } from "vitest";
import { basisFromFoodRow, computeAmount, incompleteMacros, sanitizeBasis, storedFoodBasis } from "@/lib/domain/food-basis";
import { basisFromOffProduct, type BarcodeProduct } from "@/lib/open-food-facts";

/**
 * N5: a barcode / USDA food cached in `foods` keeps the basis it was looked up with (foods.basis), so a re-log from
 * My foods keeps `missing`, sugar, sodium and the label serving. Rows without a valid stored basis are rebuilt from
 * the columns exactly as before.
 */
const product: BarcodeProduct = {
  code: "3017620422003",
  name: "Hazelnut spread",
  brand: "Test",
  quantity: "400 g",
  servingLabel: "1 tbsp (15 g)",
  servingQuantity: 15,
  unit: "g",
  // Protein not on the label: OFF normalisation stores 0 and lists it as missing.
  per100: { calories: 539, protein_g: 0, carbs_g: 57.5, fat_g: 30.9, fiber_g: null, sugar_g: 56.3, sodium_mg: 41 },
  perServing: null,
  missing: ["protein"],
};
const lookedUp = basisFromOffProduct(product);
// What the cache upsert writes (food-resolve): the columns plus the sanitized basis.
const cachedRow = { serving_size: 100, serving_unit: "g", calories: 539, protein_g: 0, carbs_g: 57.5, fat_g: 30.9, fiber_g: null };

describe("storedFoodBasis", () => {
  it("accepts a well-formed basis", () => {
    expect(storedFoodBasis(sanitizeBasis(lookedUp))).toEqual(sanitizeBasis(lookedUp));
  });

  it("rejects missing, non-object and malformed values", () => {
    for (const bad of [null, undefined, "x", 42, [], [lookedUp], {}, { per100: null }, { per100: [] }, { per100: { calories: "539", protein_g: 0, carbs_g: 0, fat_g: 0 } }, { per100: { calories: 539, protein_g: 0, carbs_g: 0 } }, { per100: { calories: 539, protein_g: null, carbs_g: 0, fat_g: 0 } }, { per100: { calories: Number.NaN, protein_g: 0, carbs_g: 0, fat_g: 0 } }, { per100: { calories: -1, protein_g: 0, carbs_g: 0, fat_g: 0 } }]) {
      expect(storedFoodBasis(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("basisFromFoodRow with a stored basis", () => {
  it("a cached barcode food keeps missing, sugar, sodium and the label serving", () => {
    const b = basisFromFoodRow({ ...cachedRow, basis: JSON.parse(JSON.stringify(sanitizeBasis(lookedUp))) });
    expect(b.missing).toEqual(["protein_g"]);
    expect(b.per100.sugar_g).toBe(56.3);
    expect(b.per100.sodium_mg).toBe(41);
    expect(b.servingGrams).toBe(15);
    expect(b.servingLabel).toBe("1 tbsp (15 g)");
    expect(incompleteMacros([{ basis: b }])).toEqual(["protein_g"]);
    // Logging one label serving gives the same numbers as logging it straight from the barcode lookup.
    const serving = computeAmount(b, 1, "serving")!;
    expect(serving).toEqual(computeAmount(lookedUp, 1, "serving"));
    expect(serving.nutrition.calories).toBe(81);
  });

  it("the column rebuild (the old behaviour) loses all of that — which is the defect", () => {
    const b = basisFromFoodRow(cachedRow);
    expect(b.missing).toBeUndefined();
    expect(b.per100.sugar_g).toBeUndefined();
    expect(b.servingLabel).toBeNull();
  });

  it("rows without a valid basis are rebuilt from the columns exactly as before", () => {
    const sandwich = { serving_size: 1, serving_unit: "sandwich", calories: 450, protein_g: 20, carbs_g: 40, fat_g: 22 };
    const chicken = { serving_size: 4, serving_unit: "oz (113 g)", calories: 187, protein_g: 35, carbs_g: 0, fat_g: 4, fiber_g: null };
    for (const row of [cachedRow, sandwich, chicken]) {
      const before = basisFromFoodRow(row);
      expect(basisFromFoodRow({ ...row, basis: null })).toEqual(before);
      expect(basisFromFoodRow({ ...row, basis: undefined })).toEqual(before);
      expect(basisFromFoodRow({ ...row, basis: { per100: { calories: "lots" } } })).toEqual(before);
      expect(basisFromFoodRow({ ...row, basis: "not json" })).toEqual(before);
    }
    expect(basisFromFoodRow(chicken).per100.calories).toBeCloseTo(165.49, 2);
  });
});
