import type { PrimaryGoal } from "./types";
import { macroSplitForDiet, type DietType } from "./diets";

export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export const ZERO_MACROS: Macros = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

export function sumMacros(items: Partial<Macros>[]): Macros {
  return items.reduce<Macros>(
    (acc, i) => ({
      calories: round1(acc.calories + (i.calories ?? 0)),
      protein_g: round1(acc.protein_g + (i.protein_g ?? 0)),
      carbs_g: round1(acc.carbs_g + (i.carbs_g ?? 0)),
      fat_g: round1(acc.fat_g + (i.fat_g ?? 0)),
    }),
    { ...ZERO_MACROS },
  );
}

/** Scale a food's per-serving macros by the number of servings eaten. */
export function scaleMacros(perServing: Macros, servings: number): Macros {
  return {
    calories: round1(perServing.calories * servings),
    protein_g: round1(perServing.protein_g * servings),
    carbs_g: round1(perServing.carbs_g * servings),
    fat_g: round1(perServing.fat_g * servings),
  };
}

/** Calories implied by macros (4/4/9 kcal per gram). Useful for sanity-checking manual entries. */
export function caloriesFromMacros(m: Pick<Macros, "protein_g" | "carbs_g" | "fat_g">): number {
  return Math.round(m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9);
}

export type Sex = "male" | "female" | "unspecified";

/** Resting energy (kcal/day) by the Mifflin-St Jeor equation. "unspecified" uses the midpoint. */
export function mifflinStJeor(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return base + (sex === "male" ? 5 : sex === "female" ? -161 : -78);
}

/** Activity multiplier from weekly training days. */
export function activityFactor(trainingDaysPerWeek: number): number {
  const d = Math.min(Math.max(trainingDaysPerWeek, 0), 7);
  if (d <= 1) return 1.3;
  if (d <= 3) return 1.45;
  if (d <= 5) return 1.6;
  return 1.75;
}

/**
 * A clearly-labelled ESTIMATE of daily targets. With sex, age and height it uses the
 * Mifflin-St Jeor equation times an activity factor; otherwise a simple bodyweight rule.
 * Macros follow the chosen diet style. It does not account for body composition, medical
 * conditions, pregnancy or medications, and is not dietary advice.
 */
export function estimateNutritionTargets(input: {
  weightKg: number;
  trainingDaysPerWeek: number;
  goal: PrimaryGoal;
  sex?: Sex | null;
  age?: number | null;
  heightCm?: number | null;
  diet?: DietType | null;
}): Macros & { water_ml: number; is_estimate: true } {
  const { weightKg, trainingDaysPerWeek, goal } = input;
  let calories: number;
  if (input.sex && input.age && input.heightCm) {
    calories = mifflinStJeor(weightKg, input.heightCm, input.age, input.sex) * activityFactor(trainingDaysPerWeek);
  } else {
    // Rough maintenance: ~29–35 kcal/kg depending on activity.
    calories = weightKg * (29 + Math.min(Math.max(trainingDaysPerWeek, 0), 6));
  }
  if (goal === "lose_fat") calories *= 0.85; // modest ~15% deficit — never aggressive
  if (goal === "build_muscle") calories *= 1.08; // small surplus
  calories = clamp(Math.round(calories / 10) * 10, 1200, 5000);

  const proteinPerKg = goal === "lose_fat" || goal === "build_muscle" || goal === "build_strength" ? 1.8 : 1.4;
  const { protein_g, carbs_g, fat_g } = macroSplitForDiet(calories, weightKg, input.diet ?? "balanced", proteinPerKg);
  const water_ml = clamp(Math.round((weightKg * 33) / 50) * 50, 1500, 5000);
  return { calories, protein_g, carbs_g, fat_g, water_ml, is_estimate: true };
}

export function progressPct(value: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
