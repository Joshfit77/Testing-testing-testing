"use server";

import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { BUDGETS, alternativesFor, cleanTerms, generatePlan, slotsForMeals, type PlannedMeal, type PlannerSettings } from "@/lib/domain/meal-planner";
import { servingBasis } from "@/lib/domain/recipes";
import { getServerSupabase } from "@/lib/supabase/server";
import { assertFeature, EntitlementError, requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { amountColumns, findOrCreateMeal, ITEM_COLUMNS, scaleItem } from "@/server/services/diary-write";
import { addDaysIso, entryMeal, loadPlannerPrefs, loadPlannerTargets, PLAN_SELECT, plannerSettings, type PlanEntryRow, type PlanRow } from "@/server/services/meal-plan";
import { appRecipeView, loadRecipe, plannerDishes, type PlannerDish } from "@/server/services/recipes";

/**
 * Meal planner actions. Plans are built by the deterministic planner in src/lib/domain/meal-planner.ts
 * from the user's recipes and saved meals (plus the built-in recipes when wanted). Planned meals stay in
 * meal_plan_entries until "Log this meal" copies one into the diary. No revalidatePath: the client
 * refreshes after a change.
 */

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function ctx() {
  const user = await requireUser();
  await assertFeature(user.id, "meal_planning");
  return { user, supabase: await getServerSupabase() };
}

function guard(err: unknown, scope: string): ActionState {
  if (err instanceof EntitlementError) return actionError("The meal planner is included with Plus and Pro.");
  logError(scope, err);
  return actionError("Something went wrong. Please try again.");
}

const settingsSchema = z.object({
  mealsPerDay: z.number().int().min(2).max(5),
  budget: z.enum(BUDGETS as [string, ...string[]]),
  allergies: z.string().max(1000),
  dislikes: z.string().max(1000),
  includeApp: z.boolean(),
});

export async function savePlannerSettingsAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await ctx();
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) return actionError("Check the planner settings and try again.");
    const v = parsed.data;
    const { error } = await supabase.from("meal_plan_settings").upsert({
      user_id: user.id,
      meals_per_day: v.mealsPerDay,
      budget: v.budget,
      allergies: cleanTerms(v.allergies),
      dislikes: cleanTerms(v.dislikes),
      include_app_recipes: v.includeApp,
    });
    if (error) throw error;
    return actionOk("Planner settings saved. Generate a new plan to use them.");
  } catch (err) {
    return guard(err, "planner.settings");
  }
}

function entryRow(planId: string, userId: string, date: string, m: PlannedMeal, dish: PlannerDish) {
  return {
    plan_id: planId,
    user_id: userId,
    plan_date: date,
    slot: m.slotIndex,
    meal_type: m.slot,
    label: m.label,
    source_key: m.key,
    name: m.name.slice(0, 160),
    portion: m.portion,
    per_serving: { ...dish.perServing, complete: dish.complete },
    ingredients: dish.ingredients.map((i) => ({ ...i, quantity: Math.round(i.quantity * 1000) / 1000 })),
  };
}

export async function generatePlanAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await ctx();
    const parsed = z.object({ startDate: isoDate, days: z.number().int().min(1).max(14).default(7) }).safeParse(input);
    if (!parsed.success) return actionError("Choose a start date.");
    const { startDate, days } = parsed.data;
    const [targets, prefs] = await Promise.all([loadPlannerTargets(supabase, user.id), loadPlannerPrefs(supabase, user.id)]);
    if (!targets) return actionError("Set your daily calorie and macro targets on the Food screen first.");
    const settings = plannerSettings(targets, prefs);
    const dishes = await plannerDishes(supabase, user.id, prefs.includeApp);
    if (!dishes.length) return actionError("There's nothing to plan with yet. Create a recipe or save a meal, or turn on the app's simple recipes.");
    const dates = Array.from({ length: days }, (_, i) => addDaysIso(startDate, i));
    const plan = generatePlan(dishes, settings, dates);
    const filled = plan.reduce((s, d) => s + d.meals.filter(Boolean).length, 0);
    if (!filled) return actionError("No recipe fits these settings. Loosen the exclusions or budget, or add recipes that fit your diet.");

    // One plan per start date: generating again replaces it.
    const { error: delErr } = await supabase.from("meal_plans").delete().eq("user_id", user.id).eq("start_date", startDate);
    if (delErr) throw delErr;
    const { data: created, error } = await supabase
      .from("meal_plans")
      .insert({
        user_id: user.id,
        start_date: startDate,
        days,
        targets: { calories: settings.calories, protein_g: settings.protein_g, carbs_g: settings.carbs_g, fat_g: settings.fat_g },
        settings: { mealsPerDay: settings.mealsPerDay, diet: settings.diet, budget: settings.budget, allergies: settings.allergies, dislikes: settings.dislikes },
      })
      .select("id")
      .single();
    if (error || !created) throw error ?? new Error("Plan insert failed");
    const byKey = new Map(dishes.map((d) => [d.key, d]));
    const rows = plan.flatMap((d) => d.meals.flatMap((m) => (m ? [entryRow(created.id as string, user.id, d.date, m, byKey.get(m.key)!)] : [])));
    const { error: eErr } = await supabase.from("meal_plan_entries").insert(rows);
    if (eErr) throw eErr;
    const empty = plan.reduce((s, d) => s + d.meals.filter((m) => !m).length, 0);
    return actionOk(empty ? `Plan ready. ${empty} meal${empty === 1 ? "" : "s"} had nothing that fits your settings.` : `Plan ready for ${days} days.`);
  } catch (err) {
    return guard(err, "planner.generate");
  }
}

async function loadEntry(supabase: Awaited<ReturnType<typeof getServerSupabase>>, userId: string, entryId: string) {
  const { data: entry } = await supabase.from("meal_plan_entries").select("id, plan_id").eq("id", entryId).eq("user_id", userId).maybeSingle();
  if (!entry) return null;
  const { data: plan } = await supabase.from("meal_plans").select(PLAN_SELECT).eq("id", entry.plan_id).eq("user_id", userId).maybeSingle();
  if (!plan) return null;
  const p = plan as unknown as PlanRow;
  const e = p.meal_plan_entries.find((x) => x.id === entryId)!;
  return { plan: p, entry: e };
}

async function alternativesForEntry(supabase: Awaited<ReturnType<typeof getServerSupabase>>, userId: string, plan: PlanRow, entry: PlanEntryRow) {
  const prefs = await loadPlannerPrefs(supabase, userId);
  // Swaps follow the plan's own targets and settings (what it was built for), with today's exclusions.
  const settings: PlannerSettings = {
    ...plan.targets,
    diet: plan.settings.diet,
    mealsPerDay: plan.settings.mealsPerDay,
    budget: plan.settings.budget,
    allergies: prefs.saved ? prefs.allergies : plan.settings.allergies,
    dislikes: prefs.saved ? prefs.dislikes : plan.settings.dislikes,
  };
  const dishes = await plannerDishes(supabase, userId, prefs.includeApp);
  const slots = slotsForMeals(settings.mealsPerDay).length;
  const dayEntries = Array.from({ length: slots }, (_, s) => plan.meal_plan_entries.find((x) => x.plan_date === entry.plan_date && x.slot === s) ?? null);
  const day = { date: entry.plan_date, meals: dayEntries.map((x) => (x ? entryMeal(x) : null)) };
  return { alternatives: alternativesFor(dishes, settings, day, entry.slot, 6), dishes };
}

export interface SwapOption {
  key: string;
  name: string;
  portion: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  complete: boolean;
  origin: PlannerDish["origin"];
}

/** Dishes that fit this meal instead, best first. */
export async function planAlternativesAction(input: unknown): Promise<{ ok: boolean; message?: string; options?: SwapOption[] }> {
  try {
    const { user, supabase } = await ctx();
    const id = uuid.safeParse((input as { entryId?: unknown })?.entryId);
    if (!id.success) return { ok: false, message: "That meal couldn't be found." };
    const found = await loadEntry(supabase, user.id, id.data);
    if (!found) return { ok: false, message: "That meal couldn't be found. It may have been replaced by a new plan." };
    const { alternatives, dishes } = await alternativesForEntry(supabase, user.id, found.plan, found.entry);
    const origin = new Map(dishes.map((d) => [d.key, d.origin]));
    return {
      ok: true,
      options: alternatives.map((a) => ({ key: a.key, name: a.name, portion: a.portion, ...a.nutrition, complete: a.complete, origin: origin.get(a.key) ?? "app" })),
    };
  } catch (err) {
    logError("planner.alternatives", err);
    return { ok: false, message: err instanceof EntitlementError ? "The meal planner is included with Plus and Pro." : "Couldn't load other options. Try again." };
  }
}

export async function swapPlanMealAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await ctx();
    const parsed = z.object({ entryId: uuid, key: z.string().max(100) }).safeParse(input);
    if (!parsed.success) return actionError("Choose a meal to swap in.");
    const found = await loadEntry(supabase, user.id, parsed.data.entryId);
    if (!found) return actionError("That meal couldn't be found. It may have been replaced by a new plan.");
    if (found.entry.logged_at) return actionError("This meal is already logged in your diary, so it can't be swapped.");
    const { alternatives, dishes } = await alternativesForEntry(supabase, user.id, found.plan, found.entry);
    const pick = alternatives.find((a) => a.key === parsed.data.key);
    const dish = dishes.find((d) => d.key === parsed.data.key);
    if (!pick || !dish) return actionError("That option no longer fits this meal. Open Swap again for the current options.");
    const row = entryRow(found.plan.id, user.id, found.entry.plan_date, pick, dish);
    const { error } = await supabase
      .from("meal_plan_entries")
      .update({ source_key: row.source_key, name: row.name, portion: row.portion, per_serving: row.per_serving, ingredients: row.ingredients })
      .eq("id", found.entry.id)
      .eq("user_id", user.id);
    if (error) throw error;
    return actionOk(`Swapped in ${pick.name}.`);
  } catch (err) {
    return guard(err, "planner.swap");
  }
}

export async function setPlanPortionAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await ctx();
    const parsed = z
      .object({ entryId: uuid, portion: z.number().min(0.25).max(4) })
      .refine((v) => Math.abs(v.portion * 4 - Math.round(v.portion * 4)) < 1e-9, "Portions go in quarter servings.")
      .safeParse(input);
    if (!parsed.success) return actionError("Portions go from 0.25 to 4 servings, in quarter steps.");
    const { data, error } = await supabase
      .from("meal_plan_entries")
      .update({ portion: parsed.data.portion })
      .eq("id", parsed.data.entryId)
      .eq("user_id", user.id)
      .is("logged_at", null)
      .select("name");
    if (error) throw error;
    if (!data?.length) return actionError("That meal couldn't be changed. It may already be logged.");
    return actionOk(`${data[0]!.name as string}: ${parsed.data.portion} serving${parsed.data.portion === 1 ? "" : "s"}.`);
  } catch (err) {
    return guard(err, "planner.portion");
  }
}

/**
 * "Log this meal": copies the planned meal into the diary for its date and meal. The diary entry is a
 * snapshot of the dish now (a recipe's current ingredients, a saved meal's items scaled to the portion).
 */
export async function logPlanMealAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await ctx();
    const id = uuid.safeParse((input as { entryId?: unknown })?.entryId);
    if (!id.success) return actionError("That meal couldn't be found.");
    const { data: e } = await supabase
      .from("meal_plan_entries")
      .select("id, plan_date, meal_type, source_key, name, portion, logged_at")
      .eq("id", id.data)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!e) return actionError("That meal couldn't be found. It may have been replaced by a new plan.");
    if (e.logged_at) return actionError("This meal is already in your diary.");
    const portion = Number(e.portion);
    const key = e.source_key as string;
    const mealId = await findOrCreateMeal(supabase, user.id, e.plan_date as string, e.meal_type as string, "logged");
    let rows: Record<string, unknown>[];
    if (key.startsWith("meal:")) {
      const { data: tpl } = await supabase.from("meals").select("id, yield_servings").eq("id", key.slice(5)).eq("user_id", user.id).eq("is_template", true).maybeSingle();
      if (!tpl) return actionError("That saved meal was deleted. Swap this meal for another one.");
      const { data: items } = await supabase.from("meal_items").select(ITEM_COLUMNS).eq("meal_id", tpl.id);
      const factor = portion / Number(tpl.yield_servings);
      rows = ((items ?? []) as Record<string, unknown>[]).map((i) => scaleItem(i, factor));
    } else {
      let view: { name: string; servings: number; totals: Parameters<typeof servingBasis>[0]; anyEstimate: boolean } | null = null;
      if (key.startsWith("recipe:")) {
        const r = await loadRecipe(supabase, user.id, key.slice(7));
        view = r && r.ingredients.length ? r : null;
        if (!view) return actionError("That recipe was deleted or has no ingredients. Swap this meal for another one.");
      } else {
        const a = await appRecipeView(key.slice(4));
        if (!a) return actionError("That recipe isn't available any more. Swap this meal for another one.");
        view = { ...a, anyEstimate: false };
      }
      const cols = amountColumns(servingBasis(view.totals, view.servings, `recipe makes ${view.servings}`), portion, "serving");
      if (!cols) return actionError("That portion can't be logged.");
      rows = [{ food_id: null, name: view.name.slice(0, 160), is_estimate: view.anyEstimate, source: key, ...cols }];
    }
    if (!rows.length) return actionError("That saved meal has no items.");
    const { error } = await supabase.from("meal_items").insert(rows.map((r) => ({ ...r, meal_id: mealId, user_id: user.id })));
    if (error) throw error;
    await supabase.from("meal_plan_entries").update({ logged_at: new Date().toISOString() }).eq("id", e.id).eq("user_id", user.id);
    return actionOk(`Logged ${e.name as string} to your diary for ${e.plan_date as string}.`);
  } catch (err) {
    return guard(err, "planner.log");
  }
}

export async function deletePlanAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("meal_plans").delete().eq("id", id.data).eq("user_id", user.id);
  if (error) logError("planner.delete", error);
}
