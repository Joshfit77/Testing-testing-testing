"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { scaleMacros, type Macros } from "@/lib/domain/nutrition";
import { DIET_TYPES, DIETS } from "@/lib/domain/diets";
import { rateTowardGoal, type WeeklyRateKg } from "@/lib/domain/calorie-budget";
import { budgetSettingsSchema, customFoodSchema, mealTypeSchema, nutritionGoalsSchema, savedMealSchema, waterSchema } from "@/lib/validation/schemas";
import { assertFeature, EntitlementError, requireUser } from "@/server/auth";
import { isFoodSearchConfigured } from "@/server/env";
import { getFood } from "@/server/services/food-database";
import { lookupBarcode, OffUnavailableError } from "@/server/services/open-food-facts";
import { barcodeLookupCandidates } from "@/lib/barcode";
import { basisFromOffProduct } from "@/lib/open-food-facts";
import { basisFromFoodRow, basisFromLegacyItem, basisUnits, computeAmount, sanitizeBasis, unitIdForLabel, type FoodBasis } from "@/lib/domain/food-basis";
import { getLocalFood } from "@/server/services/usda-local";
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

const amount = { quantity: z.number().positive().max(100_000), unitId: z.string().regex(/^(g|oz|lb|ml|floz|serving|p\d{1,2})$/) };

const logFoodInput = z.discriminatedUnion("source", [
  // Saved / built-in foods. `servings` is the older shape (a multiple of the food's serving).
  z.object({ source: z.literal("food"), foodId: uuid, quantity: amount.quantity.optional(), unitId: amount.unitId.optional(), servings: z.number().positive().max(100).optional() }),
  z.object({ source: z.literal("usda"), fdcId: z.string().regex(/^\d{1,10}$/), ...amount }),
  z.object({
    source: z.literal("barcode"),
    code: z.string().regex(/^\d{8,14}$/),
    format: z.enum(["ean13", "upca", "upce", "ean8"]).optional(),
    ...amount,
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

/** Columns written for an item measured against a nutrition basis (USDA, Open Food Facts, saved foods). */
type AmountColumns = Pick<
  MealItemRow,
  "servings" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "sugar_g" | "sodium_mg" | "grams" | "quantity" | "unit_label" | "amount_label" | "basis"
>;

interface MealItemRow extends Macros {
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

const LIMITS_ERROR = "That amount is too large to log — check the quantity and unit.";

/** Turns a basis + amount into the stored columns; null when the unit doesn't exist for this food. */
function amountColumns(basis: FoodBasis, quantity: number, unitId: string): AmountColumns | null {
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

function withinLimits(c: AmountColumns): boolean {
  return c.calories <= 99_999 && c.protein_g <= 9_999 && c.carbs_g <= 9_999 && c.fat_g <= 9_999 && (c.grams == null || c.grams <= 20_000) && c.servings <= 99_999;
}

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
      let basis: FoodBasis;
      let meta: { food_id: string | null; name: string; is_estimate: boolean; source: string };
      let quantity: number;
      let unitId: string;
      if (item.source === "food") {
        const { data: food } = await supabase.from("foods").select("*").eq("id", item.foodId).maybeSingle();
        if (!food) return actionError("Food not found.");
        basis = basisFromFoodRow(food as Parameters<typeof basisFromFoodRow>[0]);
        meta = { food_id: food.id as string, name: food.name as string, is_estimate: Boolean(food.is_estimate), source: `food:${food.id as string}` };
        if (item.quantity != null && item.unitId) {
          quantity = item.quantity;
          unitId = item.unitId;
        } else {
          // Older clients: N servings of the food.
          quantity = item.servings ?? 1;
          unitId = basisUnits(basis).some((u) => u.id === "serving") ? "serving" : "g";
          if (unitId === "g") quantity *= Number(food.serving_size);
        }
      } else if (item.source === "usda") {
        const local = await getLocalFood(Number(item.fdcId));
        if (local) {
          basis = local.basis;
          meta = { food_id: null, name: local.name, is_estimate: false, source: `usda:${local.fdcId}` };
        } else {
          if (!isFoodSearchConfigured()) return actionError("That food isn't in the food database.");
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
          basis = { per100: { calories: ext.calories, protein_g: ext.protein_g, carbs_g: ext.carbs_g, fat_g: ext.fat_g, fiber_g: ext.fiber_g } };
          meta = { food_id: cached.id as string, name: ext.name, is_estimate: false, source: `usda:${ext.fdcId}` };
        }
        quantity = item.quantity;
        unitId = item.unitId;
      } else {
        const candidates = barcodeLookupCandidates(item.code, item.format);
        if (!candidates) return actionError("That barcode isn't valid.");
        // Re-fetch from Open Food Facts server-side — never trust client-supplied nutrition numbers.
        const found = await lookupBarcode(candidates);
        if (found.status !== "found") return actionError("That product has no nutrition info in Open Food Facts. Enter it manually.");
        const p = found.product;
        basis = basisFromOffProduct(p);
        // Cache per 100 g/ml when available, otherwise per label serving, so it shows up in My foods.
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
        meta = { food_id: cached.id as string, name: p.brand ? `${p.name} (${p.brand})` : p.name, is_estimate: false, source: `off:${p.code}` };
        quantity = item.quantity;
        unitId = item.unitId;
      }
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

const ITEM_COLUMNS = "food_id, name, servings, calories, protein_g, carbs_g, fat_g, is_estimate, fiber_g, sugar_g, sodium_mg, grams, quantity, unit_label, amount_label, source, basis";

/**
 * Scales a stored item by `factor` (recipes logged as a different number of servings). Items with a basis
 * are recomputed so the amount text stays right; older items scale their numbers.
 */
function scaleItem(i: Record<string, unknown>, factor: number): Record<string, unknown> {
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
