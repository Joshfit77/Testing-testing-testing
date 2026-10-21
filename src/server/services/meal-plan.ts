import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDietType, type DietType } from "@/lib/domain/diets";
import { BUDGETS, slotsForMeals, type Budget, type PlanDay, type PlannedMeal, type PlannerSettings, type PlanNutrition } from "@/lib/domain/meal-planner";
import { loadBudgetContext } from "@/server/services/nutrition-targets";
import type { GroceryIngredient } from "@/server/services/recipes";

export interface PlannerPrefs {
  mealsPerDay: number;
  budget: Budget;
  allergies: string[];
  dislikes: string[];
  includeApp: boolean;
  /** False when nothing has been saved yet (defaults shown). */
  saved: boolean;
}

export const DEFAULT_PREFS: PlannerPrefs = { mealsPerDay: 3, budget: "any", allergies: [], dislikes: [], includeApp: true, saved: false };

export async function loadPlannerPrefs(supabase: SupabaseClient, userId: string): Promise<PlannerPrefs> {
  const { data, error } = await supabase.from("meal_plan_settings").select("meals_per_day, budget, allergies, dislikes, include_app_recipes").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_PREFS;
  return {
    mealsPerDay: Number(data.meals_per_day),
    budget: (BUDGETS as string[]).includes(data.budget as string) ? (data.budget as Budget) : "any",
    allergies: (data.allergies as string[]) ?? [],
    dislikes: (data.dislikes as string[]) ?? [],
    includeApp: Boolean(data.include_app_recipes),
    saved: true,
  };
}

export interface PlannerTargets extends PlanNutrition {
  /** Where the numbers came from. */
  origin: "custom" | "estimate";
  diet: DietType;
}

/**
 * The planner's daily targets: the saved daily targets (which are the calorie budget from
 * calorie-budget.ts unless the person entered their own), or the budget itself when nothing is saved.
 */
export async function loadPlannerTargets(supabase: SupabaseClient, userId: string): Promise<PlannerTargets | null> {
  const [{ data: goals }, { data: answers }] = await Promise.all([
    supabase.from("nutrition_goals").select("calories, protein_g, carbs_g, fat_g, is_estimate").eq("user_id", userId).maybeSingle(),
    supabase.from("onboarding_answers").select("diet_type").eq("user_id", userId).maybeSingle(),
  ]);
  const diet: DietType = isDietType(answers?.diet_type) ? answers.diet_type : "balanced";
  if (goals) {
    return { calories: Number(goals.calories), protein_g: Number(goals.protein_g), carbs_g: Number(goals.carbs_g), fat_g: Number(goals.fat_g), origin: goals.is_estimate ? "estimate" : "custom", diet };
  }
  const ctx = await loadBudgetContext(supabase, userId);
  if (!ctx?.budget) return null;
  const b = ctx.budget;
  return { calories: b.calories, protein_g: b.protein_g, carbs_g: b.carbs_g, fat_g: b.fat_g, origin: "estimate", diet };
}

export function plannerSettings(t: PlannerTargets, p: PlannerPrefs): PlannerSettings {
  return { calories: t.calories, protein_g: t.protein_g, carbs_g: t.carbs_g, fat_g: t.fat_g, diet: t.diet, allergies: p.allergies, dislikes: p.dislikes, mealsPerDay: p.mealsPerDay, budget: p.budget };
}

export interface PlanEntryRow {
  id: string;
  plan_id: string;
  plan_date: string;
  slot: number;
  meal_type: string;
  label: string;
  source_key: string;
  name: string;
  portion: number;
  per_serving: { calories: number; protein_g: number; carbs_g: number; fat_g: number; complete?: boolean };
  ingredients: GroceryIngredient[];
  logged_at: string | null;
}

export interface PlanRow {
  id: string;
  start_date: string;
  days: number;
  targets: PlanNutrition;
  settings: { mealsPerDay: number; diet: DietType; budget: Budget; allergies: string[]; dislikes: string[] };
  created_at: string;
  meal_plan_entries: PlanEntryRow[];
}

export const PLAN_SELECT = "id, start_date, days, targets, settings, created_at, meal_plan_entries(id, plan_id, plan_date, slot, meal_type, label, source_key, name, portion, per_serving, ingredients, logged_at)";

/** The plan covering `date`, else the next upcoming one, else the most recent. */
export async function loadCurrentPlan(supabase: SupabaseClient, userId: string, date: string): Promise<PlanRow | null> {
  const { data, error } = await supabase.from("meal_plans").select(PLAN_SELECT).eq("user_id", userId).order("start_date", { ascending: false }).limit(12);
  if (error) throw error;
  const plans = (data ?? []) as unknown as PlanRow[];
  const covering = plans.find((p) => p.start_date <= date && date < addDaysIso(p.start_date, p.days));
  const upcoming = [...plans].reverse().find((p) => p.start_date > date);
  return covering ?? upcoming ?? plans[0] ?? null;
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function entryMeal(e: PlanEntryRow): PlannedMeal {
  const per = e.per_serving;
  const portion = Number(e.portion);
  return {
    slotIndex: e.slot,
    slot: e.meal_type as PlannedMeal["slot"],
    label: e.label,
    key: e.source_key,
    name: e.name,
    portion,
    nutrition: {
      calories: Math.round(per.calories * portion),
      protein_g: Math.round(per.protein_g * portion * 10) / 10,
      carbs_g: Math.round(per.carbs_g * portion * 10) / 10,
      fat_g: Math.round(per.fat_g * portion * 10) / 10,
    },
    complete: per.complete !== false,
  };
}

/** The plan's days in date order, with each slot's entry (or null). */
export function planDays(plan: PlanRow): (PlanDay & { entries: (PlanEntryRow | null)[] })[] {
  const slots = slotsForMeals(plan.settings.mealsPerDay).length;
  const out: (PlanDay & { entries: (PlanEntryRow | null)[] })[] = [];
  for (let i = 0; i < plan.days; i++) {
    const date = addDaysIso(plan.start_date, i);
    const entries = Array.from({ length: slots }, (_, s) => plan.meal_plan_entries.find((e) => e.plan_date === date && e.slot === s) ?? null);
    out.push({ date, meals: entries.map((e) => (e ? entryMeal(e) : null)), entries });
  }
  return out;
}

export { addDaysIso };
