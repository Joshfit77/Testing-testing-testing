import { computeAmount, type FoodBasis } from "./food-basis";

/**
 * Recipe nutrition. Every ingredient carries a snapshot of its food's nutrition basis (the same format the
 * diary stores on meal_items.basis) plus the amount picked, so the numbers here always come from the one
 * calculation path the diary uses (`computeAmount` → `nutritionForGrams`).
 *
 * Missing data is never counted as zero (SPEC §8): each nutrient total remembers how many ingredients had
 * a value for it. A total with gaps is shown as "at least X", and one with no data at all as "—".
 */

export const NUTRIENT_KEYS = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export const NUTRIENT_INFO: Record<NutrientKey, { label: string; unit: string; digits: number }> = {
  calories: { label: "Calories", unit: "kcal", digits: 0 },
  protein_g: { label: "Protein", unit: "g", digits: 1 },
  carbs_g: { label: "Carbs", unit: "g", digits: 1 },
  fat_g: { label: "Fat", unit: "g", digits: 1 },
  fiber_g: { label: "Fiber", unit: "g", digits: 1 },
  sugar_g: { label: "Sugar", unit: "g", digits: 1 },
  sodium_mg: { label: "Sodium", unit: "mg", digits: 0 },
};

/** One nutrient's values for a single food: null when the source has no value for it. */
export type NutrientValues = Record<NutrientKey, number | null>;

export interface NutrientTotal {
  /** Sum of the known values. */
  value: number;
  /** Items that had a value. */
  known: number;
  /** Items counted. */
  total: number;
}
export type NutrientTotals = Record<NutrientKey, NutrientTotal>;

export interface IngredientAmount {
  basis: FoodBasis;
  quantity: number;
  unitId: string;
}

/** Nutrition for one ingredient amount, with nulls for nutrients the source doesn't list; null for a bad amount. */
export function ingredientNutrition(i: IngredientAmount): NutrientValues | null {
  const r = computeAmount(i.basis, i.quantity, i.unitId);
  if (!r) return null;
  const missing = new Set(i.basis.missing ?? []);
  const n = r.nutrition;
  return {
    calories: n.calories,
    protein_g: missing.has("protein_g") ? null : n.protein_g,
    carbs_g: missing.has("carbs_g") ? null : n.carbs_g,
    fat_g: missing.has("fat_g") ? null : n.fat_g,
    fiber_g: n.fiber_g,
    sugar_g: n.sugar_g,
    sodium_mg: n.sodium_mg,
  };
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Adds up nutrient values, keeping track of which items had data. */
export function sumNutrients(items: NutrientValues[]): NutrientTotals {
  const out = {} as NutrientTotals;
  for (const k of NUTRIENT_KEYS) {
    let value = 0;
    let known = 0;
    for (const i of items) {
      const v = i[k];
      if (v != null && Number.isFinite(v)) {
        value += v;
        known++;
      }
    }
    out[k] = { value: round(value, NUTRIENT_INFO[k].digits === 0 ? 0 : 1), known, total: items.length };
  }
  return out;
}

/** Totals for a recipe's ingredients (ingredients with an unusable amount count as "no data"). */
export function recipeTotals(ingredients: IngredientAmount[]): NutrientTotals {
  return sumNutrients(
    ingredients.map(
      (i) => ingredientNutrition(i) ?? { calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, sugar_g: null, sodium_mg: null },
    ),
  );
}

/** Multiplies every total by `factor` (e.g. 1 / servings for per-serving values); data coverage is unchanged. */
export function scaleTotals(t: NutrientTotals, factor: number): NutrientTotals {
  const out = {} as NutrientTotals;
  for (const k of NUTRIENT_KEYS) {
    const d = NUTRIENT_INFO[k].digits === 0 ? 0 : 1;
    out[k] = { ...t[k], value: round(t[k].value * factor, d) };
  }
  return out;
}

export function perServing(t: NutrientTotals, servings: number): NutrientTotals {
  return scaleTotals(t, servings > 0 ? 1 / servings : 0);
}

export const isComplete = (t: NutrientTotal) => t.total > 0 && t.known === t.total;

/** "412 kcal", "at least 12.5 g" (some ingredients have no value), or "—" (none do). */
export function formatNutrient(t: NutrientTotal, key: NutrientKey): string {
  const { unit } = NUTRIENT_INFO[key];
  if (t.total === 0 || t.known === 0) return "—";
  const v = NUTRIENT_INFO[key].digits === 0 ? Math.round(t.value).toLocaleString("en-US") : String(round(t.value, 1));
  return t.known === t.total ? `${v} ${unit}` : `at least ${v} ${unit}`;
}

/**
 * Basis stored on a diary entry when a recipe serving is logged: one serving's values (serving-only, so
 * the diary can scale it by servings). A nutrient with gaps is stored as unknown (null) for fiber, sugar
 * and sodium, and listed under `missing` for macros, so the diary never shows a partial sum as complete.
 */
export function servingBasis(totals: NutrientTotals, servings: number, label: string): FoodBasis {
  const s = perServing(totals, servings);
  const val = (k: NutrientKey) => (isComplete(s[k]) ? s[k].value : null);
  const macro = (k: "protein_g" | "carbs_g" | "fat_g") => s[k].value;
  const missing = (["protein_g", "carbs_g", "fat_g"] as const).filter((k) => !isComplete(s[k]));
  return {
    per100: {
      calories: s.calories.value,
      protein_g: macro("protein_g"),
      carbs_g: macro("carbs_g"),
      fat_g: macro("fat_g"),
      fiber_g: val("fiber_g"),
      sugar_g: val("sugar_g"),
      sodium_mg: val("sodium_mg"),
    },
    servingOnly: true,
    servingLabel: label.slice(0, 80),
    ...(missing.length ? { missing } : {}),
  };
}
