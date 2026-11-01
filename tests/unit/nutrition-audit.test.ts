import { describe, expect, it } from "vitest";
import { basisFromFoodRow, computeAmount, incompleteMacros, type FoodBasis } from "@/lib/domain/food-basis";
import { GRAMS_PER_LB, nutritionForGrams, toGrams, unitOptions } from "@/lib/domain/food-units";
import { basisFromOffProduct, normalizeOffProduct, nutritionForAmount } from "@/lib/open-food-facts";
import { addDays, isValidIsoDate } from "@/lib/domain/dates";

/** Regression tests from the workouts / nutrition / progress / faith audit (docs/audit/3-workouts-nutrition-progress-faith.md). */

const chicken: FoodBasis = { per100: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0 } };

describe("diary totals never present a missing macro as a real zero", () => {
  it("lists the macros some logged item's source didn't report, in canonical order, once each", () => {
    const offNoProtein: FoodBasis = { per100: { calories: 250, protein_g: 0, carbs_g: 30, fat_g: 12 }, missing: ["protein_g"] };
    const offNoFat: FoodBasis = { per100: { calories: 100, protein_g: 5, carbs_g: 10, fat_g: 0 }, missing: ["fat_g", "protein_g"] };
    expect(incompleteMacros([{ basis: chicken }, { basis: offNoFat }, { basis: offNoProtein }])).toEqual(["protein_g", "fat_g"]);
  });

  it("is empty when every entry lists every macro, or has no stored basis (manual and legacy entries)", () => {
    expect(incompleteMacros([{ basis: chicken }, { basis: null }, { basis: undefined }, {}])).toEqual([]);
  });

  it("ignores junk in a stored basis instead of throwing", () => {
    expect(incompleteMacros([{ basis: "nope" }, { basis: { per100: { calories: 1 }, missing: ["bogus", 3] } }])).toEqual([]);
  });

  it("carries an Open Food Facts product's unlisted macros into the basis the diary stores", () => {
    const lookup = normalizeOffProduct(
      { status: 1, product: { code: "5000000000012", product_name: "Honey", nutriments: { "energy-kcal_100g": 304, carbohydrates_100g: 82 } } },
      "5000000000012",
    );
    expect(lookup.status).toBe("found");
    if (lookup.status !== "found") return;
    const basis = basisFromOffProduct(lookup.product);
    expect(basis.missing).toEqual(["protein_g", "fat_g"]);
    expect(incompleteMacros([{ basis }])).toEqual(["protein_g", "fat_g"]);
  });
});

describe("the diary's ?date= parameter", () => {
  it("accepts only real calendar dates, so a malformed link can't crash the page", () => {
    // The page used to accept anything shaped like a date, and then addDays threw while rendering.
    expect(() => addDays("2026-13-45", -1)).toThrow(RangeError);
    for (const bad of ["2026-13-45", "2026-00-10", "2026-02-30", "2026-04-31", "2026-1-05", "", null, undefined, "2026-10-31T00:00"]) expect(isValidIsoDate(bad), String(bad)).toBe(false);
    for (const good of ["2026-10-31", "2028-02-29", "2026-01-01", "2026-12-31"]) expect(isValidIsoDate(good), good).toBe(true);
    expect(isValidIsoDate("2027-02-29")).toBe(false);
  });
});

describe("unit conversions the diary relies on", () => {
  it("converts pounds and fluid ounces, not only ounces", () => {
    const solid = unitOptions({});
    const lb = solid.find((u) => u.id === "lb")!;
    expect(toGrams(1, lb)).toBeCloseTo(GRAMS_PER_LB, 5);
    expect(toGrams(0.5, lb)).toBeCloseTo(226.796, 2);
    const liquid = unitOptions({ liquid: true });
    expect(liquid.map((u) => u.id)).toEqual(["ml", "floz"]);
    expect(toGrams(12, liquid.find((u) => u.id === "floz")!)).toBeCloseTo(354.88, 1);
  });

  it("scales per-100 g values by the grams eaten and keeps missing nutrients missing", () => {
    const n = nutritionForGrams({ calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: null, sodium_mg: 74 }, 170);
    expect(n).toEqual({ calories: 281, protein_g: 52.7, carbs_g: 0, fat_g: 6.1, fiber_g: null, sugar_g: null, sodium_mg: 126 });
  });

  it("logs 1 lb of a per-100 g food as the sum of its grams", () => {
    const r = computeAmount(chicken, 1, "lb")!;
    expect(r.grams).toBe(453.6);
    expect(r.nutrition.calories).toBe(748);
    expect(r.amountLabel).toBe("1 lb (454 g)");
  });

  it("per-serving and per-100 g Open Food Facts values agree with each other", () => {
    const lookup = normalizeOffProduct(
      {
        status: 1,
        product: {
          code: "0012345678905",
          product_name: "Protein bar",
          serving_size: "1 bar (60 g)",
          serving_quantity: 60,
          nutriments: { "energy-kj_100g": 1674, proteins_100g: 33.3, carbohydrates_100g: 40, fat_100g: 10, salt_100g: 0.5 },
        },
      },
      "0012345678905",
    );
    expect(lookup.status).toBe("found");
    if (lookup.status !== "found") return;
    const p = lookup.product;
    // kJ → kcal, salt → sodium (salt ÷ 2.5, in mg).
    expect(p.per100?.calories).toBeCloseTo(400.1, 1);
    expect(p.per100?.sodium_mg).toBe(200);
    expect(p.perServing?.protein_g).toBeCloseTo(20, 1);
    // The two routes round at different steps (per-serving values are rounded to 0.1 before scaling), so they can
    // differ by a tenth of a calorie, never more.
    expect(Math.abs(nutritionForAmount(p, { servings: 2 })!.calories - nutritionForAmount(p, { grams: 120 })!.calories)).toBeLessThanOrEqual(0.1);
    expect(nutritionForAmount(p, { grams: 120 })?.calories).toBeCloseTo(480.1, 1);
    expect(p.missing).toEqual([]);
  });

  it("keeps a custom food saved as '1 oz' usable, as servings of the entered values (no invented weight)", () => {
    const b = basisFromFoodRow({ serving_size: 1, serving_unit: "oz", calories: 50, protein_g: 4, carbs_g: 1, fat_g: 3 });
    expect(b.servingOnly).toBe(true);
    expect(b.servingLabel).toBe("1 oz");
    const r = computeAmount(b, 2, "serving")!;
    expect(r.grams).toBeNull();
    expect(r.nutrition.calories).toBe(100);
  });
});
