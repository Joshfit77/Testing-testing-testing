import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aiMealPlanOutputSchema,
  buildDraftFromAi,
  dishCatalogForAi,
  focusTargets,
  FOCUS_LABELS,
  MEAL_PLAN_INSTRUCTIONS,
  type DraftDay,
  type MealPlanFocus,
  mealPlanNotesForAi,
  MEDICAL_NOTES_ASSUMPTION,
} from "@/lib/domain/ai-meal-plan";
import { eligibleCandidates, plannedMeal, slotsForMeals, type PlannerSettings, type PlanNutrition } from "@/lib/domain/meal-planner";
import type { Sex } from "@/lib/domain/nutrition";
import type { Plan } from "@/lib/domain/types";
import { getServiceSupabase } from "@/lib/supabase/server";
import { AiError, withAiRequest } from "@/server/services/ai-coach";
import { addDaysIso, loadPlannerPrefs, loadPlannerTargets, planEntryRow, plannerSettings } from "@/server/services/meal-plan";
import { loadBudgetContext } from "@/server/services/nutrition-targets";
import { plannerDishes, type PlannerDish } from "@/server/services/recipes";

export interface StoredDraft {
  start_date: string;
  days: number;
  focus: MealPlanFocus;
  notes: string | null;
  targets: PlanNutrition & { explanation: string[] };
  settings: Pick<PlannerSettings, "mealsPerDay" | "diet" | "budget" | "allergies" | "dislikes">;
  days_plan: { date: string; meals: ({ slotIndex: number; key: string; portion: number; by: "ai" | "planner" } | null)[] }[];
  summary: string | null;
  model: string | null;
  created_at: string;
}

export class MealPlanError extends Error {}

/** Draft an AI meal plan (one AI request) and store it for the member to review. Nothing is saved as a plan yet. */
export async function draftAiMealPlan(
  supabase: SupabaseClient,
  userId: string,
  plan: Plan,
  input: { startDate: string; days: number; focus: MealPlanFocus; notes: string | null },
): Promise<{ corrections: number }> {
  const [targets, prefs, budgetCtx, { data: profile }, { data: weight }] = await Promise.all([
    loadPlannerTargets(supabase, userId),
    loadPlannerPrefs(supabase, userId),
    loadBudgetContext(supabase, userId).catch(() => null),
    supabase.from("profiles").select("sex, coach_memory_enabled").eq("id", userId).maybeSingle(),
    supabase.from("weight_entries").select("weight_kg").eq("user_id", userId).order("recorded_on", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!targets) throw new MealPlanError("Set your daily calorie and macro targets on the Food screen first.");
  const focus = focusTargets(targets, input.focus, {
    maintenance: budgetCtx?.budget?.maintenance ?? null,
    weightKg: weight?.weight_kg ? Number(weight.weight_kg) : null,
    sex: (profile?.sex as Sex | null) ?? null,
  });
  const settings = plannerSettings({ ...targets, calories: focus.calories, protein_g: focus.protein_g, carbs_g: focus.carbs_g, fat_g: focus.fat_g }, prefs);
  const dishes = await plannerDishes(supabase, userId, prefs.includeApp);
  const eligible = eligibleCandidates(dishes, settings);
  if (!eligible.length) throw new MealPlanError("No recipe fits your planner settings. Loosen the exclusions or budget, or add recipes that fit your diet.");
  const specs = slotsForMeals(settings.mealsPerDay);
  const dates = Array.from({ length: input.days }, (_, i) => addDaysIso(input.startDate, i));

  // Food preferences the member chose to keep in coaching memory (only that category).
  let memoryNotes: string[] = [];
  if (profile?.coach_memory_enabled) {
    const { data } = await supabase.from("coach_memories").select("content").eq("user_id", userId).eq("category", "nutrition").limit(20);
    memoryNotes = (data ?? []).map((m) => m.content as string);
  }

  const notes = mealPlanNotesForAi(input.notes);
  const userText = [
    `Plan ${input.days} day${input.days === 1 ? "" : "s"} starting ${input.startDate} (day_index 0 = ${input.startDate}).`,
    `Focus: ${FOCUS_LABELS[input.focus]}.`,
    `Daily targets: ${settings.calories} kcal, protein ${settings.protein_g} g, carbs ${settings.carbs_g} g, fat ${settings.fat_g} g.`,
    `Meal slots each day (slot_index: meal, share of calories): ${specs.map((s, i) => `${i}: ${s.label} (${s.slot}, ${Math.round(s.share * 100)}%)`).join("; ")}.`,
    `Diet style: ${settings.diet}. Budget: ${settings.budget}.`,
    notes.notes ? `Member's notes: ${notes.notes}` : null,
    memoryNotes.length ? `Food preferences the member saved:\n${memoryNotes.map((m) => `- ${m}`).join("\n")}` : null,
    `Dishes (key | name | meals | per serving):\n${dishCatalogForAi(eligible)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await withAiRequest({ supabase, userId, plan, kind: "meal_plan", tier: "fast" }, async ({ client, model }) => {
    const res = await client.beta.messages.parse({
      model,
      max_tokens: 8_000,
      system: [{ type: "text", text: MEAL_PLAN_INSTRUCTIONS }],
      messages: [{ role: "user", content: userText }],
      output_config: { format: betaZodOutputFormat(aiMealPlanOutputSchema) },
    });
    const inputTokens = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new AiError("provider", "The AI couldn't draft a plan that time. Please try again.");
    return { value: { output: res.parsed_output, model }, inputTokens, outputTokens: res.usage.output_tokens };
  });

  const draft = buildDraftFromAi(result.output, dishes, settings, dates);
  const row = {
    user_id: userId,
    start_date: input.startDate,
    days: input.days,
    focus: input.focus,
    notes: input.notes,
    targets: { calories: settings.calories, protein_g: settings.protein_g, carbs_g: settings.carbs_g, fat_g: settings.fat_g, explanation: focus.explanation },
    settings: { mealsPerDay: settings.mealsPerDay, diet: settings.diet, budget: settings.budget, allergies: settings.allergies, dislikes: settings.dislikes },
    days_plan: draft.days.map((d) => ({ date: d.date, meals: d.meals.map((m) => (m ? { slotIndex: m.slotIndex, key: m.key, portion: m.portion, by: m.by } : null)) })),
    summary: [result.output.summary.trim(), ...(notes.medical ? [MEDICAL_NOTES_ASSUMPTION] : []), ...result.output.assumptions.map((a) => `Assumed: ${a}`)].join("\n").slice(0, 1500),
    model: result.model,
  };
  // Drafts are written by the server only.
  const { error } = await getServiceSupabase().from("meal_plan_drafts").upsert(row);
  if (error) throw error;
  return { corrections: draft.corrections };
}

export async function loadDraft(supabase: SupabaseClient, userId: string): Promise<StoredDraft | null> {
  const { data, error } = await supabase.from("meal_plan_drafts").select("start_date, days, focus, notes, targets, settings, days_plan, summary, model, created_at").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as StoredDraft | null) ?? null;
}

/** The draft with every number computed now from the member's current dishes (a dish no longer available shows as a gap). */
export function draftView(draft: StoredDraft, dishes: PlannerDish[]): DraftDay[] {
  const byKey = new Map(dishes.map((d) => [d.key, d]));
  const specs = slotsForMeals(draft.settings.mealsPerDay);
  return draft.days_plan.map((d) => ({
    date: d.date,
    meals: specs.map((spec, i) => {
      const m = d.meals[i];
      const dish = m ? byKey.get(m.key) : undefined;
      return m && dish ? { ...plannedMeal(dish, spec, i, m.portion), by: m.by } : null;
    }),
  }));
}

/**
 * Approve the draft: it becomes the plan for its dates (replacing any plan that starts that day). Every dish is
 * checked again against the member's current recipes and exclusions, and all nutrition is taken from the database.
 * Returns null when there's no draft.
 */
export async function approveMealPlanDraft(supabase: SupabaseClient, userId: string): Promise<{ dropped: number } | null> {
  const draft = await loadDraft(supabase, userId);
  if (!draft) return null;
  const prefs = await loadPlannerPrefs(supabase, userId);
  const { calories, protein_g, carbs_g, fat_g } = draft.targets;
  const settings: PlannerSettings = { calories, protein_g, carbs_g, fat_g, ...draft.settings, allergies: prefs.saved ? prefs.allergies : draft.settings.allergies, dislikes: prefs.saved ? prefs.dislikes : draft.settings.dislikes };
  const dishes = await plannerDishes(supabase, userId, prefs.includeApp);
  const allowed = new Map(eligibleCandidates(dishes, settings).map((d) => [d.key, d]));
  const byKey = new Map(dishes.map((d) => [d.key, d]));
  const specs = slotsForMeals(settings.mealsPerDay);

  const { error: delErr } = await supabase.from("meal_plans").delete().eq("user_id", userId).eq("start_date", draft.start_date);
  if (delErr) throw delErr;
  const { data: created, error } = await supabase
    .from("meal_plans")
    .insert({
      user_id: userId,
      start_date: draft.start_date,
      days: draft.days,
      targets: { calories: settings.calories, protein_g: settings.protein_g, carbs_g: settings.carbs_g, fat_g: settings.fat_g },
      settings: { mealsPerDay: settings.mealsPerDay, diet: settings.diet, budget: settings.budget, allergies: settings.allergies, dislikes: settings.dislikes },
    })
    .select("id")
    .single();
  if (error || !created) throw error ?? new Error("Plan insert failed");
  let dropped = 0;
  const rows = draft.days_plan.flatMap((d) =>
    d.meals.flatMap((m, i) => {
      const spec = specs[i];
      const dish = m && allowed.has(m.key) ? (byKey.get(m.key) ?? null) : null;
      if (!m || !spec || !dish) {
        if (m) dropped++;
        return [];
      }
      return [planEntryRow(created.id as string, userId, d.date, plannedMeal(dish, spec, i, m.portion), dish)];
    }),
  );
  if (rows.length) {
    const { error: eErr } = await supabase.from("meal_plan_entries").insert(rows);
    if (eErr) throw eErr;
  }
  await supabase.from("meal_plan_drafts").delete().eq("user_id", userId);
  return { dropped };
}
