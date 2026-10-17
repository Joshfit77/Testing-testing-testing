import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calorieBudget,
  isActivityLevel,
  isWeeklyRate,
  rateTowardGoal,
  type ActivityLevel,
  type CalorieBudget,
  type WeeklyRateKg,
} from "@/lib/domain/calorie-budget";
import { isDietType, type DietType } from "@/lib/domain/diets";
import { estimateNutritionTargets, type Sex } from "@/lib/domain/nutrition";
import type { PrimaryGoal } from "@/lib/domain/types";

/** Everything needed to compute (and explain) a user's calorie budget. */
export interface BudgetContext {
  weightKg: number;
  /** Earliest logged bodyweight (the "start" of the weight goal). */
  startWeightKg: number;
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  goal: PrimaryGoal;
  diet: DietType;
  daysPerWeek: number;
  activity: ActivityLevel | null;
  /** The pace the user chose. */
  weeklyChangeKg: WeeklyRateKg | null;
  /** The chosen pace pointed toward the goal weight (what the budget uses). */
  effectiveRateKg: WeeklyRateKg | null;
  goalWeightKg: number | null;
  /** Null when the budget fields (activity, pace, age, height) are missing — older accounts. */
  budget: CalorieBudget | null;
}

export async function loadBudgetContext(supabase: SupabaseClient, userId: string): Promise<BudgetContext | null> {
  const [{ data: latest }, { data: first }, { data: a }, { data: p }] = await Promise.all([
    supabase.from("weight_entries").select("weight_kg").eq("user_id", userId).order("recorded_on", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("weight_entries").select("weight_kg").eq("user_id", userId).order("recorded_on", { ascending: true }).limit(1).maybeSingle(),
    supabase
      .from("onboarding_answers")
      .select("primary_goal, days_per_week, diet_type, activity_level, weekly_change_kg, goal_weight_kg")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("profiles").select("sex, birth_year, height_cm").eq("id", userId).maybeSingle(),
  ]);
  if (!latest || !a) return null;
  const weightKg = Number(latest.weight_kg);
  const age = p?.birth_year ? new Date().getUTCFullYear() - (p.birth_year as number) : null;
  const heightCm = p?.height_cm ? Number(p.height_cm) : null;
  const sex = (p?.sex as Sex | null) ?? null;
  const activity = isActivityLevel(a.activity_level) ? a.activity_level : null;
  const rawRate = a.weekly_change_kg == null ? null : Number(a.weekly_change_kg);
  const weeklyChangeKg = isWeeklyRate(rawRate) ? rawRate : null;
  const goalWeightKg = a.goal_weight_kg == null ? null : Number(a.goal_weight_kg);
  const goal = a.primary_goal as PrimaryGoal;
  const diet = isDietType(a.diet_type) ? a.diet_type : "balanced";
  const effectiveRateKg = weeklyChangeKg == null ? null : rateTowardGoal(weightKg, goalWeightKg, weeklyChangeKg);
  const budget =
    activity && effectiveRateKg != null && age && heightCm
      ? calorieBudget({ sex, age, heightCm, weightKg, activity, weeklyChangeKg: effectiveRateKg, goal, diet })
      : null;
  return {
    weightKg,
    startWeightKg: first ? Number(first.weight_kg) : weightKg,
    sex,
    age,
    heightCm,
    goal,
    diet,
    daysPerWeek: a.days_per_week as number,
    activity,
    weeklyChangeKg,
    effectiveRateKg,
    goalWeightKg,
    budget,
  };
}

/** Water target from the existing bodyweight rule. */
export function waterTargetMl(weightKg: number, ctx: Pick<BudgetContext, "daysPerWeek" | "goal">): number {
  return estimateNutritionTargets({ weightKg, trainingDaysPerWeek: ctx.daysPerWeek, goal: ctx.goal }).water_ml;
}

/**
 * Re-estimate and save the user's targets: the calorie budget when its fields are set, otherwise the older
 * training-days estimate. Always saved as an estimate. Returns false when there isn't enough data yet.
 */
export async function estimateAndSaveTargets(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const ctx = await loadBudgetContext(supabase, userId);
  if (!ctx) return false;
  const t = ctx.budget
    ? { ...ctx.budget, water_ml: waterTargetMl(ctx.weightKg, ctx) }
    : estimateNutritionTargets({
        weightKg: ctx.weightKg,
        trainingDaysPerWeek: ctx.daysPerWeek,
        goal: ctx.goal,
        sex: ctx.sex,
        age: ctx.age,
        heightCm: ctx.heightCm,
        diet: ctx.diet,
      });
  const { error } = await supabase
    .from("nutrition_goals")
    .upsert({ user_id: userId, calories: t.calories, protein_g: t.protein_g, carbs_g: t.carbs_g, fat_g: t.fat_g, water_ml: t.water_ml, is_estimate: true });
  if (error) throw error;
  return true;
}
