"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { estimateNutritionTargets, scaleMacros, type Macros } from "@/lib/domain/nutrition";
import type { PrimaryGoal } from "@/lib/domain/types";
import { customFoodSchema, mealTypeSchema, nutritionGoalsSchema, savedMealSchema, waterSchema } from "@/lib/validation/schemas";
import { assertFeature, EntitlementError, requireUser } from "@/server/auth";
import { isFoodSearchConfigured } from "@/server/env";
import { getFood } from "@/server/services/food-database";
import { lookupBarcode, OffUnavailableError } from "@/server/services/open-food-facts";
import { barcodeLookupCandidates } from "@/lib/barcode";
import { nutritionForAmount } from "@/lib/open-food-facts";
import { logError } from "@/server/log";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();

async function nutritionCtx() {
  const user = await requireUser();
  await assertFeature(user.id, "nutrition_tracking");
  return { user, supabase: await getServerSupabase() };
}

function guard(err: unknown, scope: string): ActionState {
  if (err instanceof EntitlementError) return actionError("Nutrition tracking is included with Plus and Pro.");
  if (err instanceof OffUnavailableError) return actionError("Open Food Facts isn't responding right now. Try again in a moment.");
  logError(scope, err);
  return actionError("Something went wrong. Please try again.");
}

async function findOrCreateMeal(supabase: SupabaseClient, userId: string, date: string, mealType: string, status: "logged" | "planned") {
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

const logFoodInput = z.discriminatedUnion("source", [
  z.object({ source: z.literal("food"), foodId: uuid, servings: z.number().positive().max(100) }),
  z.object({ source: z.literal("usda"), fdcId: z.string().regex(/^\d{1,10}$/), grams: z.number().positive().max(5000) }),
  z.object({
    source: z.literal("barcode"),
    code: z.string().regex(/^\d{8,14}$/),
    format: z.enum(["ean13", "upca", "upce", "ean8"]).optional(),
    unit: z.enum(["serving", "g"]),
    quantity: z.number().positive().max(5000),
  }),
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

    let row: { food_id: string | null; name: string; servings: number; is_estimate: boolean } & Macros;
    if (item.source === "food") {
      const { data: food } = await supabase.from("foods").select("*").eq("id", item.foodId).maybeSingle();
      if (!food) return actionError("Food not found.");
      const m = scaleMacros({ calories: Number(food.calories), protein_g: Number(food.protein_g), carbs_g: Number(food.carbs_g), fat_g: Number(food.fat_g) }, item.servings);
      row = { food_id: food.id as string, name: food.name as string, servings: item.servings, is_estimate: Boolean(food.is_estimate), ...m };
    } else if (item.source === "usda") {
      if (!isFoodSearchConfigured()) return actionError("Food search isn't configured.");
      // Always re-read nutrition values from the database server-side — never trust client-supplied label data.
      const ext = await getFood(item.fdcId);
      if (!ext) return actionError("That food couldn't be loaded from the food database.");
      const { data: cached, error: cErr } = await supabase
        .from("foods")
        .upsert(
          {
            owner_id: user.id,
            name: ext.name.slice(0, 160),
            brand: ext.brand?.slice(0, 120) ?? null,
            serving_size: 100,
            serving_unit: "g",
            calories: ext.calories,
            protein_g: ext.protein_g,
            carbs_g: ext.carbs_g,
            fat_g: ext.fat_g,
            fiber_g: ext.fiber_g,
            source: "usda",
            source_ref: ext.fdcId,
            is_estimate: false,
          },
          { onConflict: "owner_id,source,source_ref" },
        )
        .select("id")
        .single();
      if (cErr) throw cErr;
      const servings = Math.round((item.grams / 100) * 100) / 100;
      row = { food_id: cached.id as string, name: `${ext.name} (${item.grams} g)`.slice(0, 160), servings, is_estimate: false, ...scaleMacros(ext, servings) };
    } else if (item.source === "barcode") {
      if (item.unit === "serving" && item.quantity > 100) return actionError("That's a lot of servings — check the amount.");
      const candidates = barcodeLookupCandidates(item.code, item.format);
      if (!candidates) return actionError("That barcode isn't valid.");
      // Re-fetch from Open Food Facts server-side — never trust client-supplied nutrition numbers.
      const found = await lookupBarcode(candidates);
      if (found.status !== "found") return actionError("That product has no nutrition info in Open Food Facts. Enter it manually.");
      const p = found.product;
      const amount = item.unit === "g" ? { grams: item.quantity } : { servings: item.quantity };
      const values = nutritionForAmount(p, amount);
      if (!values) return actionError(item.unit === "g" ? "This product only lists nutrition per serving — log it in servings." : "This product doesn't list a serving size — log it in grams.");
      // Cache per 100 g/ml when available (like USDA foods), otherwise per label serving.
      const base = p.per100 ? { size: 100, unit: p.unit as string, v: p.per100 } : { size: 1, unit: "serving", v: p.perServing! };
      const { data: cached, error: cErr } = await supabase
        .from("foods")
        .upsert(
          {
            owner_id: user.id,
            name: p.name.slice(0, 160),
            brand: p.brand?.slice(0, 120) ?? null,
            serving_size: base.size,
            serving_unit: base.unit,
            calories: base.v.calories,
            protein_g: base.v.protein_g,
            carbs_g: base.v.carbs_g,
            fat_g: base.v.fat_g,
            fiber_g: base.v.fiber_g,
            source: "openfoodfacts",
            source_ref: p.code,
            // Crowd-sourced label data, not a guess; the UI labels it "Open Food Facts (community data) — check the label".
            is_estimate: false,
          },
          { onConflict: "owner_id,source,source_ref" },
        )
        .select("id")
        .single();
      if (cErr) throw cErr;
      const grams = item.unit === "g" ? item.quantity : p.servingQuantity ? Math.round(p.servingQuantity * item.quantity * 10) / 10 : null;
      // meal_items.servings is a multiplier of the cached food row (per 100 g/ml, or per label serving).
      const servings =
        base.size === 1
          ? item.quantity
          : grams != null
            ? Math.round((grams / 100) * 100) / 100
            : Math.round((values.calories / Math.max(base.v.calories, 0.1)) * 100) / 100;
      const amountLabel =
        item.unit === "g" ? `${item.quantity} ${p.unit}` : `${item.quantity} serving${item.quantity === 1 ? "" : "s"}${grams != null ? `, ${grams} ${p.unit}` : ""}`;
      row = {
        food_id: cached.id as string,
        name: `${p.name} (${amountLabel})`.slice(0, 160),
        servings,
        is_estimate: false,
        calories: values.calories,
        protein_g: values.protein_g,
        carbs_g: values.carbs_g,
        fat_g: values.fat_g,
      };
    } else {
      row = {
        food_id: null,
        name: item.name,
        servings: 1,
        is_estimate: item.isEstimate,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
      };
    }
    const mealId = await findOrCreateMeal(supabase, user.id, date, mealType, status);
    const { error } = await supabase.from("meal_items").insert({ meal_id: mealId, user_id: user.id, ...row });
    if (error) throw error;
    revalidatePath("/nutrition");
    revalidatePath("/home");
    return actionOk(`${status === "planned" ? "Planned" : "Logged"} ${row.name}.`);
  } catch (err) {
    return guard(err, "nutrition.log");
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
  revalidatePath("/nutrition");
}

/** Save a day's meal as a reusable template (saved meal or recipe with yield servings). */
export async function saveMealTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user, supabase } = await nutritionCtx();
    const parsed = savedMealSchema.safeParse(Object.fromEntries(formData));
    const mealId = uuid.safeParse(formData.get("mealId"));
    if (!parsed.success) return actionInvalid(parsed.error);
    if (!mealId.success) return actionError("Choose a meal to save.");
    const { data: items } = await supabase.from("meal_items").select("food_id, name, servings, calories, protein_g, carbs_g, fat_g, is_estimate").eq("meal_id", mealId.data).eq("user_id", user.id);
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
    const { data: items } = await supabase.from("meal_items").select("food_id, name, servings, calories, protein_g, carbs_g, fat_g, is_estimate").eq("meal_id", tpl.id);
    const factor = servings / Number(tpl.yield_servings);
    const mealId = await findOrCreateMeal(supabase, user.id, date, mealType, status);
    const { error } = await supabase.from("meal_items").insert(
      (items ?? []).map((i) => ({
        meal_id: mealId,
        user_id: user.id,
        food_id: i.food_id,
        name: i.name,
        servings: Math.round(Number(i.servings) * factor * 100) / 100 || 0.01,
        ...scaleMacros({ calories: Number(i.calories), protein_g: Number(i.protein_g), carbs_g: Number(i.carbs_g), fat_g: Number(i.fat_g) }, factor),
        is_estimate: i.is_estimate,
      })),
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

export async function updateGoalsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user, supabase } = await nutritionCtx();
    if (formData.get("intent") === "estimate") {
      const [{ data: w }, { data: a }] = await Promise.all([
        supabase.from("weight_entries").select("weight_kg").eq("user_id", user.id).order("recorded_on", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("onboarding_answers").select("primary_goal, days_per_week").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!w || !a) return actionError("Log your bodyweight first so we can estimate targets.");
      const t = estimateNutritionTargets({ weightKg: Number(w.weight_kg), trainingDaysPerWeek: a.days_per_week as number, goal: a.primary_goal as PrimaryGoal });
      const { error } = await supabase.from("nutrition_goals").upsert({ user_id: user.id, calories: t.calories, protein_g: t.protein_g, carbs_g: t.carbs_g, fat_g: t.fat_g, water_ml: t.water_ml, is_estimate: true });
      if (error) throw error;
      revalidatePath("/nutrition");
      return actionOk("Targets re-estimated from your latest bodyweight and goal.");
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
