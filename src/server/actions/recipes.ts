"use server";

import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { computeAmount, sanitizeBasis, type FoodBasis } from "@/lib/domain/food-basis";
import { servingBasis } from "@/lib/domain/recipes";
import { mealTypeSchema } from "@/lib/validation/schemas";
import { assertFeature, EntitlementError, requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { getServerSupabase } from "@/lib/supabase/server";
import { amountColumns, findOrCreateMeal, LIMITS_ERROR, withinLimits } from "@/server/services/diary-write";
import { amountFields, pickedFoodSchema, resolvePickedFood } from "@/server/services/food-resolve";
import { loadRecipe } from "@/server/services/recipes";
import { OffUnavailableError } from "@/server/services/open-food-facts";

/**
 * Recipes (SPEC §8): build from foods in the food search, set the servings, log a serving or part of one.
 * Ingredient nutrition is read on the server from the food's source when it's added and stored as a
 * snapshot (recipe_ingredients.basis). Mutations don't call revalidatePath; the client refreshes.
 */

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function ctx() {
  const user = await requireUser();
  await assertFeature(user.id, "nutrition_tracking");
  return { user, supabase: await getServerSupabase() };
}

function guard(err: unknown, scope: string): ActionState {
  if (err instanceof EntitlementError) return actionError("Recipes are included with Plus and Pro.");
  if (err instanceof OffUnavailableError) return actionError("Open Food Facts isn't responding right now. Try again in a moment.");
  logError(scope, err);
  return actionError("Something went wrong. Please try again.");
}

const ingredientInput = z.union([
  // An ingredient already in the recipe: keep its nutrition snapshot, maybe with a new amount.
  z.object({ id: uuid, ...amountFields }),
  // A newly picked food.
  z.object({ pick: pickedFoodSchema }),
]);

const saveSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "Give the recipe a name.").max(120),
  servings: z.number().positive("Servings must be more than 0.").max(100),
  notes: z.string().trim().max(2000).optional(),
  ingredients: z.array(ingredientInput).min(1, "Add at least one ingredient.").max(60, "A recipe can have up to 60 ingredients."),
});

export type SaveRecipeResult = ActionState & { id?: string };

export async function saveRecipeAction(input: unknown): Promise<SaveRecipeResult> {
  try {
    const { user, supabase } = await ctx();
    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Check the recipe and try again.");
    const v = parsed.data;

    let existing = new Map<string, { name: string; source: string; basis: FoodBasis; is_estimate: boolean }>();
    if (v.id) {
      const { data: recipe } = await supabase.from("recipes").select("id").eq("id", v.id).eq("user_id", user.id).maybeSingle();
      if (!recipe) return actionError("That recipe couldn't be found. It may have been deleted.");
      const { data: rows, error } = await supabase.from("recipe_ingredients").select("id, name, source, basis, is_estimate").eq("recipe_id", v.id).eq("user_id", user.id);
      if (error) throw error;
      existing = new Map(
        (rows ?? []).flatMap((r) => {
          const basis = sanitizeBasis(r.basis);
          return basis ? [[r.id as string, { name: r.name as string, source: r.source as string, basis, is_estimate: Boolean(r.is_estimate) }] as const] : [];
        }),
      );
    }

    const rows: Record<string, unknown>[] = [];
    for (const [position, ing] of v.ingredients.entries()) {
      let food: { name: string; source: string; basis: FoodBasis; is_estimate: boolean };
      let quantity: number;
      let unitId: string;
      if ("id" in ing) {
        const found = existing.get(ing.id);
        if (!found) return actionError("An ingredient changed while you were editing. Reload the recipe and try again.");
        food = found;
        quantity = ing.quantity;
        unitId = ing.unitId;
      } else {
        const r = await resolvePickedFood(supabase, user.id, ing.pick);
        if (!r.ok) return actionError(r.error);
        food = { name: r.food.name, source: r.food.source, basis: r.food.basis, is_estimate: r.food.is_estimate };
        quantity = r.food.quantity;
        unitId = r.food.unitId;
      }
      const amount = computeAmount(food.basis, quantity, unitId);
      if (!amount) return actionError(`Choose one of the units listed for ${food.name}.`);
      if (amount.grams != null && amount.grams > 20_000) return actionError(LIMITS_ERROR);
      rows.push({
        user_id: user.id,
        position,
        name: food.name.slice(0, 160),
        source: food.source,
        quantity: Math.round(quantity * 1000) / 1000,
        unit_label: amount.unit.label.slice(0, 100),
        grams: amount.grams,
        amount_label: amount.amountLabel.slice(0, 160),
        basis: food.basis,
        is_estimate: food.is_estimate,
      });
    }

    let recipeId = v.id;
    if (recipeId) {
      const { error } = await supabase.from("recipes").update({ name: v.name, servings: v.servings, notes: v.notes || null }).eq("id", recipeId).eq("user_id", user.id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("recipes").insert({ user_id: user.id, name: v.name, servings: v.servings, notes: v.notes || null }).select("id").single();
      if (error || !data) throw error ?? new Error("Recipe insert failed");
      recipeId = data.id as string;
    }
    // Insert the new ingredient list first, then remove the old rows, so a failure never leaves it empty.
    const { data: inserted, error: insErr } = await supabase
      .from("recipe_ingredients")
      .insert(rows.map((r) => ({ ...r, recipe_id: recipeId })))
      .select("id");
    if (insErr) throw insErr;
    const keep = (inserted ?? []).map((r) => r.id as string);
    const { error: delErr } = await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId).eq("user_id", user.id).not("id", "in", `(${keep.join(",")})`);
    if (delErr) throw delErr;
    return { ...actionOk(v.id ? `Saved changes to “${v.name}”.` : `Created “${v.name}”.`), id: recipeId };
  } catch (err) {
    return guard(err, "recipes.save");
  }
}

export async function deleteRecipeAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("recipes").delete().eq("id", id.data).eq("user_id", user.id);
  if (error) logError("recipes.delete", error);
}

const logSchema = z.object({
  recipeId: uuid,
  date: isoDate,
  mealType: mealTypeSchema,
  servings: z.number().min(0.05, "Enter at least 0.05 servings.").max(20, "That's more than 20 servings."),
});

/**
 * Log a serving (or part of one) to the diary as one entry. Its nutrition is a snapshot of one serving at
 * the time of logging, so editing the recipe later never changes what's in the diary.
 */
export async function logRecipeAction(input: unknown): Promise<ActionState> {
  try {
    const { user, supabase } = await ctx();
    const parsed = logSchema.safeParse(input);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Enter how many servings you ate.");
    const { recipeId, date, mealType, servings } = parsed.data;
    const recipe = await loadRecipe(supabase, user.id, recipeId);
    if (!recipe) return actionError("That recipe couldn't be found. It may have been deleted.");
    if (!recipe.ingredients.length) return actionError("Add ingredients to this recipe before logging it.");
    const basis = servingBasis(recipe.totals, recipe.servings, `recipe makes ${recipe.servings}`);
    const cols = amountColumns(basis, servings, "serving");
    if (!cols) return actionError("Enter how many servings you ate.");
    if (!withinLimits(cols)) return actionError(LIMITS_ERROR);
    const mealId = await findOrCreateMeal(supabase, user.id, date, mealType, "logged");
    const { error } = await supabase.from("meal_items").insert({
      meal_id: mealId,
      user_id: user.id,
      food_id: null,
      name: recipe.name.slice(0, 160),
      is_estimate: recipe.anyEstimate,
      source: `recipe:${recipe.id}`,
      ...cols,
    });
    if (error) throw error;
    return actionOk(`Logged ${cols.amount_label} of ${recipe.name}.`);
  } catch (err) {
    return guard(err, "recipes.log");
  }
}
