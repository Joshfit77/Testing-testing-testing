import { macroSplitForDiet, type DietType } from "@/lib/domain/diets";
import { mifflinStJeor, type Sex } from "@/lib/domain/nutrition";
import type { PrimaryGoal } from "@/lib/domain/types";

/**
 * Calorie budget in the style of MyFitnessPal / MyNetDiary: resting energy (Mifflin-St Jeor) times a
 * daily-life activity level gives maintenance WITHOUT workouts; the weekly weight goal sets a daily
 * deficit or surplus; logged exercise is added back on the day. An estimate, not dietary advice.
 */

export const ACTIVITY_LEVELS = ["sedentary", "light", "active", "very_active"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const ACTIVITY_INFO: Record<ActivityLevel, { label: string; description: string; factor: number }> = {
  sedentary: { label: "Not very active", description: "Mostly sitting: desk job, little walking.", factor: 1.2 },
  light: { label: "Lightly active", description: "On your feet part of the day: teacher, retail.", factor: 1.375 },
  active: { label: "Active", description: "On your feet most of the day: server, nurse.", factor: 1.55 },
  very_active: { label: "Very active", description: "Physical work most of the day: construction, farm work.", factor: 1.725 },
};

/** Weekly weight change options in kg (negative = lose). */
export const WEEKLY_RATES_KG = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5] as const;
export type WeeklyRateKg = (typeof WEEKLY_RATES_KG)[number];

/** Energy in 1 kg of body weight change (≈3,500 kcal per lb). */
export const KCAL_PER_KG = 7700;

/** Lowest daily budget we will suggest without medical supervision. */
export function calorieFloor(sex: Sex | null | undefined): number {
  return sex === "male" ? 1500 : sex === "female" ? 1200 : 1350;
}

export function isActivityLevel(v: unknown): v is ActivityLevel {
  return typeof v === "string" && (ACTIVITY_LEVELS as readonly string[]).includes(v);
}

export function isWeeklyRate(v: unknown): v is WeeklyRateKg {
  return typeof v === "number" && (WEEKLY_RATES_KG as readonly number[]).includes(v);
}

/** A sensible default pace for a goal. */
export function defaultWeeklyRate(goal: PrimaryGoal): WeeklyRateKg {
  if (goal === "lose_fat") return -0.5;
  if (goal === "build_muscle") return 0.25;
  return 0;
}

/** Points the weekly rate in the direction of the goal weight (or 0 when already there). */
export function rateTowardGoal(currentKg: number, goalKg: number | null | undefined, rate: WeeklyRateKg): WeeklyRateKg {
  if (!goalKg || rate === 0) return rate;
  if (Math.abs(goalKg - currentKg) < 0.5) return 0;
  const wantLose = goalKg < currentKg;
  if (wantLose && rate > 0) return -rate as WeeklyRateKg;
  if (!wantLose && rate < 0) return Math.min(0.5, -rate) as WeeklyRateKg;
  return rate;
}

export interface BudgetInput {
  sex: Sex | null;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  weeklyChangeKg: number;
  goal: PrimaryGoal;
  diet?: DietType | null;
}

export interface CalorieBudget {
  /** Maintenance calories before any logged exercise. */
  maintenance: number;
  /** Daily calorie goal. */
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** The daily deficit (negative) or surplus actually applied. */
  dailyAdjustment: number;
  /** True when the budget was raised to the safe minimum. */
  floored: boolean;
  /** Weekly change the budget actually supports, in kg. */
  effectiveWeeklyChangeKg: number;
}

export function calorieBudget(input: BudgetInput): CalorieBudget {
  const factor = ACTIVITY_INFO[input.activity].factor;
  const maintenance = Math.round(mifflinStJeor(input.weightKg, input.heightCm, input.age, input.sex ?? "unspecified") * factor);
  // Cap the daily change at 1,000 kcal and never cut more than 25% of maintenance.
  let adjust = (input.weeklyChangeKg * KCAL_PER_KG) / 7;
  adjust = Math.max(-1000, Math.min(1000, adjust));
  if (adjust < 0) adjust = Math.max(adjust, -0.25 * maintenance);
  let calories = Math.round((maintenance + adjust) / 10) * 10;
  const floor = calorieFloor(input.sex);
  const floored = calories < floor;
  if (floored) calories = floor;
  const dailyAdjustment = calories - maintenance;
  const proteinPerKg = input.goal === "lose_fat" || input.goal === "build_muscle" || input.goal === "build_strength" ? 1.8 : 1.4;
  const split = macroSplitForDiet(calories, input.weightKg, input.diet ?? "balanced", proteinPerKg);
  return {
    maintenance,
    calories,
    ...split,
    dailyAdjustment,
    floored,
    effectiveWeeklyChangeKg: Math.round(((dailyAdjustment * 7) / KCAL_PER_KG) * 100) / 100,
  };
}

/**
 * Calories burned by a workout, from MET minutes (MET × 3.5 × kg / 200 per minute).
 * Strength training ≈ 5 MET, conditioning ≈ 7.
 */
export function exerciseCalories(minutes: number, weightKg: number, met = 5): number {
  if (!(minutes > 0) || !(weightKg > 0)) return 0;
  return Math.round(((met * 3.5 * weightKg) / 200) * minutes);
}

/** "Goal − Food + Exercise = Remaining." */
export function remainingCalories(goal: number, food: number, exercise: number): number {
  return Math.round(goal - food + exercise);
}

/**
 * "If every day were like today…": projected weight after `weeks` if every day matched today's
 * food and exercise. Returns null when nothing has been logged.
 */
export function projectWeightKg(currentKg: number, maintenance: number, foodKcal: number, exerciseKcal: number, weeks = 5): number | null {
  if (!(foodKcal > 0)) return null;
  const dailyNet = foodKcal - exerciseKcal - maintenance;
  return Math.round((currentKg + (dailyNet * 7 * weeks) / KCAL_PER_KG) * 10) / 10;
}

/** Weeks to reach the goal weight at the given weekly change, or null if it never gets there. */
export function weeksToGoal(currentKg: number, goalKg: number | null | undefined, weeklyChangeKg: number): number | null {
  if (!goalKg) return null;
  const diff = goalKg - currentKg;
  if (Math.abs(diff) < 0.5) return 0;
  if (weeklyChangeKg === 0 || Math.sign(diff) !== Math.sign(weeklyChangeKg)) return null;
  return Math.ceil(diff / weeklyChangeKg);
}
