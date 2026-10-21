import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scaleMacros, type Macros } from "@/lib/domain/nutrition";
import { computeAmount, sanitizeBasis, unitIdForLabel, type FoodBasis } from "@/lib/domain/food-basis";

/** Shared diary writes: finding a day's meal, and the stored columns for an amount of a food. */

export async function findOrCreateMeal(supabase: SupabaseClient, userId: string, date: string, mealType: string, status: "logged" | "planned") {
  const { data } = await supabase
    .from("meals")
    .select("id")
    .eq("user_id", userId)
    .eq("eaten_on", date)
    .eq("meal_type", mealType)
    .eq("status", status)
    .eq("is_template", false)
    .limit(1)
    .maybeSingle();
  if (data) return data.id as string;
  const { data: created, error } = await supabase.from("meals").insert({ user_id: userId, eaten_on: date, meal_type: mealType, status }).select("id").single();
  if (error || !created) throw error ?? new Error("Meal insert failed");
  return created.id as string;
}

/** Columns written for an item measured against a nutrition basis (USDA, Open Food Facts, saved foods). */
export type AmountColumns = Pick<
  MealItemRow,
  "servings" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "sugar_g" | "sodium_mg" | "grams" | "quantity" | "unit_label" | "amount_label" | "basis"
>;

export interface MealItemRow extends Macros {
  food_id: string | null;
  name: string;
  servings: number;
  is_estimate: boolean;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  grams: number | null;
  quantity: number | null;
  unit_label: string | null;
  amount_label: string | null;
  source: string | null;
  basis: FoodBasis | null;
}

export const LIMITS_ERROR = "That amount is too large to log — check the quantity and unit.";

/** Turns a basis + amount into the stored columns; null when the unit doesn't exist for this food. */
export function amountColumns(basis: FoodBasis, quantity: number, unitId: string): AmountColumns | null {
  const r = computeAmount(basis, quantity, unitId);
  if (!r) return null;
  const n = r.nutrition;
  return {
    servings: Math.max(0.01, Math.round(quantity * 100) / 100),
    calories: n.calories,
    protein_g: n.protein_g,
    carbs_g: n.carbs_g,
    fat_g: n.fat_g,
    fiber_g: n.fiber_g,
    sugar_g: n.sugar_g,
    sodium_mg: n.sodium_mg,
    grams: r.grams,
    quantity: Math.round(quantity * 1000) / 1000,
    unit_label: r.unit.label.slice(0, 100),
    amount_label: r.amountLabel.slice(0, 160),
    basis,
  };
}

export function withinLimits(c: AmountColumns): boolean {
  return c.calories <= 99_999 && c.protein_g <= 9_999 && c.carbs_g <= 9_999 && c.fat_g <= 9_999 && (c.grams == null || c.grams <= 20_000) && c.servings <= 99_999;
}

export const ITEM_COLUMNS = "food_id, name, servings, calories, protein_g, carbs_g, fat_g, is_estimate, fiber_g, sugar_g, sodium_mg, grams, quantity, unit_label, amount_label, source, basis";

/**
 * Scales a stored item by `factor` (recipes logged as a different number of servings). Items with a basis
 * are recomputed so the amount text stays right; older items scale their numbers.
 */
export function scaleItem(i: Record<string, unknown>, factor: number): Record<string, unknown> {
  if (factor === 1) return i;
  const basis = sanitizeBasis(i.basis);
  const unitId = basis ? unitIdForLabel(basis, i.unit_label as string | null) : null;
  const cols = basis && unitId && Number(i.quantity) > 0 ? amountColumns(basis, Number(i.quantity) * factor, unitId) : null;
  if (cols) return { ...i, ...cols };
  const opt = (v: unknown, d = 1) => (v == null ? null : Math.round(Number(v) * factor * 10 ** d) / 10 ** d);
  return {
    ...i,
    servings: Math.round(Number(i.servings) * factor * 100) / 100 || 0.01,
    ...scaleMacros({ calories: Number(i.calories), protein_g: Number(i.protein_g), carbs_g: Number(i.carbs_g), fat_g: Number(i.fat_g) }, factor),
    fiber_g: opt(i.fiber_g),
    sugar_g: opt(i.sugar_g),
    sodium_mg: opt(i.sodium_mg),
    grams: opt(i.grams),
    quantity: opt(i.quantity, 3),
    amount_label: null,
  };
}

