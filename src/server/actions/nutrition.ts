"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { DIET_TYPES, DIETS } from "@/lib/domain/diets";
import { rateTowardGoal, type WeeklyRateKg } from "@/lib/domain/calorie-budget";
import { budgetSettingsSchema, customFoodSchema, mealTypeSchema, nutritionGoalsSchema, savedMealSchema, waterSchema } from "@/lib/validation/schemas";
import { assertFeature, EntitlementError, requireUser } from "@/server/auth";
import { OffUnavailableError } from "@/server/services/open-food-facts";
import { basisFromLegacyItem, sanitizeBasis } from "@/lib/domain/food-basis";
import { amountFields, pickedFoodSchema, resolvePickedFood } from "@/server/services/food-resolve";
import { amountColumns, findOrCreateMeal, ITEM_COLUMNS, LIMITS_ERROR, scaleItem, withinLimits, type MealItemRow } from "@/server/services/diary-write";
import { logError } from "@/server/log";
import { estimateAndSaveTargets } from "@/server/services/nutrition-targets";
import { FAVORITE_KEY_PATTERN } from "@/lib/domain/food-favorites";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();

async function nutritionCtx() {
  const user = await requireUser();
  await assertFeature(user.id, "nutrition_tracking");
  return { user, supabase: await getServerSupabase() };
}

function guard(err: unknown, scope: string): ActionState {
  if (err instanceof EntitlementError) return actionError("Food logging isn't available on your account right now.");
  if (err instanceof OffUnavailableError) return actionError("Open Food Facts isn't responding right now. Try again in a moment.");
  logError(scope, err);
  return actionError("Something went wrong. Please try again.");
}

const amount = amountFields;

const logFoodInput = z.union([
  pickedFoodSchema,
  z.object({
    source: z.literal("manual"),
    name: z.string().trim().min(1).max(160),
    calories: z.number().min(0).max(10000),
    protein_g: z.number().min(0).max(1000),
    carbs_g: z.number().min(0).max(2000),
    fat_g: z.number().min(0).max(1000),
    isEstimate: z.boolean(),
  }),
]);

const logFoodSchema = z.object({
  date: isoDate,
  mealType: mealTypeSchema,
  status: z.enum(["logged", "planned"]),
  item: logFoodInput,
});

export async function logFoodAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await nutritionCtx();
    const parsed = logFoodSchema.safeParse(input);
    if (!parsed.success) return actionInvalid(parsed.error);
    const { date, mealType, status, item } = parsed.data;

    let row: MealItemRow;
    if (item.source === "manual") {
      row = {
        food_id: null,
        name: item.name,
        servings: 1,
        is_estimate: item.isEstimate,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        fiber_g: null,
        sugar_g: null,
        sodium_mg: null,
        grams: null,
        quantity: null,
        unit_label: null,
        amount_label: null,
        source: "custom",
        basis: null,
      };
    } else {
      // Nutrition values are always re-read server-side — never trusted from the client.
      const resolved = await resolvePickedFood(supabase, user.id, item);
      if (!resolved.ok) return actionError(resolved.error);
      const { basis, quantity, unitId, ...rest } = resolved.food;
      const meta = { food_id: rest.food_id, name: rest.name, is_estimate: rest.is_estimate, source: rest.source };
      const cols = amountColumns(basis, quantity, unitId);
      if (!cols) return actionError("Choose one of the units listed for this food.");
      if (!withinLimits(cols)) return actionError(LIMITS_ERROR);
      row = { ...meta, name: meta.name.slice(0, 160), ...cols };
    }
    const mealId = await findOrCreateMeal(supabase, user.id, date, mealType, status);
    const { error } = await supabase.from("meal_items").insert({ meal_id: mealId, user_id: user.id, ...row });
    if (error) throw error;
    revalidatePath("/nutrition");
    revalidatePath("/home");
    const amountText = row.amount_label ? ` (${row.amount_label})` : "";
    return actionOk(`${status === "planned" ? "Planned" : "Logged"} ${row.name}${amountText}.`);
  } catch (err) {
    return guard(err, "nutrition.log");
  }
}

/**
 * Edit a logged item MyFitnessPal-style: change the amount, unit or meal. Nutrition is recomputed on the
 * server from the item's stored basis (entries from before amounts were stored scale by servings).
 */
export async function updateMealItemAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await nutritionCtx();
    const parsed = z.object({ id: uuid, mealType: mealTypeSchema, ...amount }).safeParse(input);
    if (!parsed.success) return actionError("Enter an amount greater than zero.");
    const { id, mealType, quantity, unitId } = parsed.data;
    const { data: item } = await supabase
      .from("meal_items")
      .select("id, meal_id, name, servings, calories, protein_g, carbs_g, fat_g, basis, meal:meals!inner(id, eaten_on, meal_type, status, is_template)")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!item) return actionError("That entry couldn't be found. It may have been deleted.");
    const meal = item.meal as unknown as { id: string; eaten_on: string; meal_type: string; status: "logged" | "planned"; is_template: boolean };
    if (meal.is_template) return actionError("Saved meals can't be edited here.");
    const basis = sanitizeBasis(item.basis) ?? basisFromLegacyItem(item as unknown as Parameters<typeof basisFromLegacyItem>[0]);
    const cols = amountColumns(basis, quantity, unitId);
    if (!cols) return actionError("Choose one of the units listed for this food.");
    if (!withinLimits(cols)) return actionError(LIMITS_ERROR);
    const mealId = mealType === meal.meal_type ? meal.id : await findOrCreateMeal(supabase, user.id, meal.eaten_on, mealType, meal.status);
    const { error } = await supabase.from("meal_items").update({ ...cols, meal_id: mealId }).eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    if (mealId !== meal.id) {
      const { count } = await supabase.from("meal_items").select("id", { count: "exact", head: true }).eq("meal_id", meal.id);
      if (!count) await supabase.from("meals").delete().eq("id", meal.id).eq("user_id", user.id).eq("is_template", false);
    }
    revalidatePath("/nutrition");
    revalidatePath("/home");
    return actionOk(`Updated ${item.name as string} (${cols.amount_label}).`);
  } catch (err) {
    return guard(err, "nutrition.update_item");
  }
}

export async function deleteMealItemAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  const { data: item } = await supabase.from("meal_items").select("meal_id").eq("id", id.data).eq("user_id", user.id).maybeSingle();
  await supabase.from("meal_items").delete().eq("id", id.data).eq("user_id", user.id);
  if (item) {
    const { count } = await supabase.from("meal_items").select("id", { count: "exact", head: true }).eq("meal_id", item.meal_id);
    if (!count) await supabase.from("meals").delete().eq("id", item.meal_id).eq("user_id", user.id).eq("is_template", false);
  }
  revalidatePath("/nutrition");
  revalidatePath("/home");
}

export async function markPlannedEatenAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("mealId"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("meals").update({ status: "logged" }).eq("id", id.data).eq("user_id", user.id).eq("status", "planned");
  revalidatePath("/nutrition");
}

export async function createCustomFoodAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user, supabase } = await nutritionCtx();
    const parsed = customFoodSchema.safeParse({ ...Object.fromEntries(formData), isEstimate: formData.get("isEstimate") === "on" });
    if (!parsed.success) return actionInvalid(parsed.error);
    const v = parsed.data;
    const { error } = await supabase.from("foods").insert({
      owner_id: user.id,
      name: v.name,
      brand: v.brand || null,
      serving_size: v.servingSize,
      serving_unit: v.servingUnit,
      calories: v.calories,
      protein_g: v.protein_g,
      carbs_g: v.carbs_g,
      fat_g: v.fat_g,
      source: "custom",
      is_estimate: v.isEstimate,
    });
    if (error) throw error;
    revalidatePath("/nutrition");
    return actionOk(`Saved ${v.name} to My foods.`);
  } catch (err) {
    return guard(err, "nutrition.custom_food");
  }
}

export async function deleteCustomFoodAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("foods").delete().eq("id", id.data).eq("owner_id", user.id);
  // A favorite of a deleted saved food can no longer be logged.
  await supabase.from("food_favorites").delete().eq("user_id", user.id).eq("food_key", `food:${id.data}`);
  revalidatePath("/nutrition");
}

const favoriteSchema = z.object({
  key: z.string().regex(FAVORITE_KEY_PATTERN),
  favorite: z.boolean(),
  name: z.string().trim().min(1).max(160).optional(),
  detail: z.string().max(200).optional(),
  basis: z.unknown().optional(),
  isEstimate: z.boolean().optional(),
});

/**
 * Star or un-star a food. The name/detail/basis are kept only as a display snapshot for the Favorites
 * tab; logging a favorite re-reads nutrition from the source on the server (logFoodAction).
 */
export async function setFoodFavoriteAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await nutritionCtx();
    const parsed = favoriteSchema.safeParse(input);
    if (!parsed.success) return actionError("That food can't be added to favorites.");
    const { key, favorite, name, detail, isEstimate } = parsed.data;
    if (!favorite) {
      const { error } = await supabase.from("food_favorites").delete().eq("user_id", user.id).eq("food_key", key);
      if (error) throw error;
      revalidatePath("/nutrition");
      return actionOk(`Removed ${name ?? "food"} from favorites.`);
    }
    const basis = sanitizeBasis(parsed.data.basis);
    if (!basis || !name) return actionError("That food can't be added to favorites.");
    if (key.startsWith("food:")) {
      // Saved foods must be visible to this user (built-in, or their own).
      const { data: food } = await supabase.from("foods").select("id").eq("id", key.slice(5)).maybeSingle();
      if (!food) return actionError("Food not found.");
    }
    const { error } = await supabase
      .from("food_favorites")
      .upsert(
        { user_id: user.id, food_key: key, name: name.slice(0, 160), detail: detail?.slice(0, 200) || null, basis, is_estimate: Boolean(isEstimate) },
        { onConflict: "user_id,food_key" },
      );
    if (error) throw error;
    revalidatePath("/nutrition");
    return actionOk(`Added ${name} to favorites.`);
  } catch (err) {
    return guard(err, "nutrition.favorite");
  }
}

/** Save a day's meal as a reusable template (saved meal or recipe with yield servings). */
export async function saveMealTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user, supabase } = await nutritionCtx();
    const parsed = savedMealSchema.safeParse(Object.fromEntries(formData));
    const mealId = uuid.safeParse(formData.get("mealId"));
    if (!parsed.success) return actionInvalid(parsed.error);
    if (!mealId.success) return actionError("Choose a meal to save.");
    const { data: items } = await supabase.from("meal_items").select(ITEM_COLUMNS).eq("meal_id", mealId.data).eq("user_id", user.id);
    if (!items?.length) return actionError("That meal has no items.");
    const { data: tpl, error } = await supabase
      .from("meals")
      .insert({ user_id: user.id, is_template: true, name: parsed.data.name, yield_servings: parsed.data.yieldServings, notes: parsed.data.notes || null, meal_type: "snack" })
      .select("id")
      .single();
    if (error || !tpl) throw error;
    const { error: iErr } = await supabase.from("meal_items").insert(items.map((i) => ({ ...i, meal_id: tpl.id, user_id: user.id })));
    if (iErr) throw iErr;
    revalidatePath("/nutrition");
    return actionOk(`Saved “${parsed.data.name}”.`);
  } catch (err) {
    return guard(err, "nutrition.save_template");
  }
}

export async function logTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user, supabase } = await nutritionCtx();
    const parsed = z
      .object({ templateId: uuid, date: isoDate, mealType: mealTypeSchema, servings: z.coerce.number().positive().max(50), status: z.enum(["logged", "planned"]) })
      .safeParse(Object.fromEntries(formData));
    if (!parsed.success) return actionInvalid(parsed.error);
    const { templateId, date, mealType, servings, status } = parsed.data;
    const { data: tpl } = await supabase.from("meals").select("id, name, yield_servings").eq("id", templateId).eq("user_id", user.id).eq("is_template", true).maybeSingle();
    if (!tpl) return actionError("Saved meal not found.");
    const { data: items } = await supabase.from("meal_items").select(ITEM_COLUMNS).eq("meal_id", tpl.id);
    const factor = servings / Number(tpl.yield_servings);
    const mealId = await findOrCreateMeal(supabase, user.id, date, mealType, status);
    const { error } = await supabase.from("meal_items").insert(
      ((items ?? []) as Record<string, unknown>[]).map((i) => ({ ...scaleItem(i, factor), meal_id: mealId, user_id: user.id })),
    );
    if (error) throw error;
    revalidatePath("/nutrition");
    revalidatePath("/home");
    return actionOk(`${status === "planned" ? "Planned" : "Logged"} ${servings} serving(s) of ${tpl.name as string}.`);
  } catch (err) {
    return guard(err, "nutrition.log_template");
  }
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("meals").delete().eq("id", id.data).eq("user_id", user.id).eq("is_template", true);
  revalidatePath("/nutrition");
}

export async function addWaterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user, supabase } = await nutritionCtx();
    const parsed = waterSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return actionInvalid(parsed.error);
    const { error } = await supabase.from("water_entries").insert({ user_id: user.id, recorded_on: parsed.data.date, amount_ml: parsed.data.amountMl });
    if (error) throw error;
    revalidatePath("/nutrition");
    return actionOk(`Added ${parsed.data.amountMl} ml.`);
  } catch (err) {
    return guard(err, "nutrition.water");
  }
}

export async function undoWaterAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const date = isoDate.safeParse(formData.get("date"));
  if (!date.success) return;
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("water_entries").select("id").eq("user_id", user.id).eq("recorded_on", date.data).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (data) await supabase.from("water_entries").delete().eq("id", data.id).eq("user_id", user.id);
  revalidatePath("/nutrition");
}

/** Change the user's diet style. Estimated targets follow the new diet; custom targets are kept. */
export async function updateDietAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const supabase = await getServerSupabase();
    const diet = z.enum(DIET_TYPES).safeParse(formData.get("diet"));
    if (!diet.success) return actionError("Choose a diet.");
    const { data: updated, error } = await supabase.from("onboarding_answers").update({ diet_type: diet.data }).eq("user_id", user.id).select("user_id");
    if (error) throw error;
    if (!updated?.length) return actionError("Finish setting up your profile first.");
    const { data: goals } = await supabase.from("nutrition_goals").select("is_estimate").eq("user_id", user.id).maybeSingle();
    let message = `Your diet is now ${DIETS[diet.data].name}.`;
    if (!goals || goals.is_estimate) {
      if (await estimateAndSaveTargets(supabase, user.id)) message += " Your targets were updated to match.";
    } else {
      message += " Your custom targets were kept; use Re-estimate to switch to this diet's split.";
    }
    revalidatePath("/nutrition");
    revalidatePath("/nutrition/diets");
    revalidatePath("/home");
    return actionOk(message);
  } catch (err) {
    return guard(err, "nutrition.diet");
  }
}

export async function updateGoalsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user, supabase } = await nutritionCtx();
    if (formData.get("intent") === "estimate") {
      if (!(await estimateAndSaveTargets(supabase, user.id))) return actionError("Log your bodyweight first so we can estimate targets.");
      revalidatePath("/nutrition");
      return actionOk("Targets re-estimated from your latest bodyweight, goal and diet.");
    }
    const parsed = nutritionGoalsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return actionInvalid(parsed.error);
    const { error } = await supabase.from("nutrition_goals").upsert({ user_id: user.id, ...parsed.data, is_estimate: false });
    if (error) throw error;
    revalidatePath("/nutrition");
    revalidatePath("/home");
    return actionOk("Targets saved.");
  } catch (err) {
    return guard(err, "nutrition.goals");
  }
}

/**
 * Copy logged food from one day to another (MyFitnessPal's "copy from yesterday"): one meal, or the whole
 * day when no meal type is given. Items are added to the target day's meals; nothing is removed.
 */
export async function copyMealsAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await nutritionCtx();
    const parsed = z.object({ fromDate: isoDate, toDate: isoDate, mealType: mealTypeSchema.optional() }).safeParse(input);
    if (!parsed.success) return actionError("Choose a day to copy from.");
    const { fromDate, toDate, mealType } = parsed.data;
    if (fromDate === toDate) return actionError("Choose a different day to copy from.");
    let q = supabase
      .from("meals")
      .select(`meal_type, meal_items(${ITEM_COLUMNS})`)
      .eq("user_id", user.id)
      .eq("eaten_on", fromDate)
      .eq("status", "logged")
      .eq("is_template", false);
    if (mealType) q = q.eq("meal_type", mealType);
    const { data: meals, error: mErr } = await q;
    if (mErr) throw mErr;
    const source = ((meals ?? []) as unknown as { meal_type: string; meal_items: Record<string, unknown>[] }[]).filter((m) => m.meal_items.length);
    if (!source.length) return actionError(mealType ? "There's nothing logged for that meal on the day before." : "There's nothing logged on the day before.");
    let copied = 0;
    for (const type of [...new Set(source.map((m) => m.meal_type))]) {
      const items = source.filter((m) => m.meal_type === type).flatMap((m) => m.meal_items);
      const mealId = await findOrCreateMeal(supabase, user.id, toDate, type, "logged");
      const { error } = await supabase.from("meal_items").insert(items.map((i) => ({ ...i, meal_id: mealId, user_id: user.id })));
      if (error) throw error;
      copied += items.length;
    }
    revalidatePath("/nutrition");
    revalidatePath("/home");
    return actionOk(`Copied ${copied} ${copied === 1 ? "item" : "items"}.`);
  } catch (err) {
    return guard(err, "nutrition.copy");
  }
}

/** One-tap re-log of a food the user logged before (recent / frequent foods). */
export async function relogItemAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await nutritionCtx();
    const parsed = z.object({ itemId: uuid, date: isoDate, mealType: mealTypeSchema, status: z.enum(["logged", "planned"]).default("logged") }).safeParse(input);
    if (!parsed.success) return actionError("Choose a food to add.");
    const { itemId, date, mealType, status } = parsed.data;
    const { data: item } = await supabase.from("meal_items").select(ITEM_COLUMNS).eq("id", itemId).eq("user_id", user.id).maybeSingle();
    if (!item) return actionError("That food couldn't be found. It may have been deleted.");
    const mealId = await findOrCreateMeal(supabase, user.id, date, mealType, status);
    const { error } = await supabase.from("meal_items").insert({ ...item, meal_id: mealId, user_id: user.id });
    if (error) throw error;
    revalidatePath("/nutrition");
    revalidatePath("/home");
    return actionOk(`${status === "planned" ? "Planned" : "Logged"} ${item.name as string}.`);
  } catch (err) {
    return guard(err, "nutrition.relog");
  }
}

/**
 * Change goal weight, weekly pace and activity level, then recalculate the calorie budget (saved as an
 * estimate). People who want their own numbers use "Save targets" instead.
 */
export async function updateBudgetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user, supabase } = await nutritionCtx();
    const parsed = budgetSettingsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return actionInvalid(parsed.error);
    const v = parsed.data;
    const [{ data: w }, { data: p }] = await Promise.all([
      supabase.from("weight_entries").select("weight_kg").eq("user_id", user.id).order("recorded_on", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("profiles").select("birth_year, height_cm").eq("id", user.id).maybeSingle(),
    ]);
    if (!w) return actionError("Log your bodyweight first so we can calculate your budget.");
    if (!p?.birth_year || !p.height_cm) return actionError("Add your age and height in Training preferences first.");
    const weeklyChangeKg = rateTowardGoal(Number(w.weight_kg), v.goalWeightKg, v.weeklyChangeKg as WeeklyRateKg);
    const { data: updated, error } = await supabase
      .from("onboarding_answers")
      .update({ goal_weight_kg: v.goalWeightKg, weekly_change_kg: weeklyChangeKg, activity_level: v.activityLevel })
      .eq("user_id", user.id)
      .select("user_id");
    if (error) throw error;
    if (!updated?.length) return actionError("Finish setting up your profile first.");
    if (!(await estimateAndSaveTargets(supabase, user.id))) return actionError("Log your bodyweight first so we can calculate your budget.");
    revalidatePath("/nutrition");
    revalidatePath("/home");
    revalidatePath("/plan");
    return actionOk(
      weeklyChangeKg !== v.weeklyChangeKg ? "Budget recalculated. We pointed your pace toward your goal weight." : "Budget recalculated from your goal, pace and activity.",
    );
  } catch (err) {
    return guard(err, "nutrition.budget");
  }
}
