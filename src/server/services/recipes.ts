import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_RECIPES, appRecipe, type AppRecipe } from "@/data/app-recipes";
import { basisUnits, computeAmount, sanitizeBasis, unitIdForLabel, type FoodBasis } from "@/lib/domain/food-basis";
import { ANIMAL_TAGS, costTierForDish, tagsForDish, tagsForFood } from "@/lib/domain/food-tags";
import type { PlanCandidate, PlanSlot } from "@/lib/domain/meal-planner";
import { isComplete, perServing, recipeTotals, sumNutrients, type IngredientAmount, type NutrientTotals } from "@/lib/domain/recipes";
import { getLocalFood } from "@/server/services/usda-local";

/** Reading recipes, saved meals and the built-in planner recipes, and turning them into planner dishes. */

export interface IngredientRow {
  id: string;
  name: string;
  source: string;
  quantity: number;
  unit_label: string;
  grams: number | null;
  amount_label: string | null;
  basis: unknown;
  is_estimate: boolean;
  position: number;
}

export interface RecipeRow {
  id: string;
  name: string;
  servings: number;
  notes: string | null;
  updated_at: string;
  recipe_ingredients: IngredientRow[];
}

/** One ingredient ready for maths and display. */
export interface RecipeIngredient extends IngredientAmount {
  id: string;
  name: string;
  source: string;
  unitLabel: string;
  amountLabel: string;
  isEstimate: boolean;
}

export interface RecipeView {
  id: string;
  name: string;
  servings: number;
  notes: string | null;
  ingredients: RecipeIngredient[];
  totals: NutrientTotals;
  perServing: NutrientTotals;
  anyEstimate: boolean;
}

export const RECIPE_SELECT = "id, name, servings, notes, updated_at, recipe_ingredients(id, name, source, quantity, unit_label, grams, amount_label, basis, is_estimate, position)";

/** Unit id for a stored ingredient: by its label, else grams when the weight is known. */
function unitFor(basis: FoodBasis, label: string, grams: number | null, quantity: number): { unitId: string; quantity: number } {
  const id = unitIdForLabel(basis, label);
  if (id) return { unitId: id, quantity };
  if (grams && !basis.servingOnly) return { unitId: basis.liquid ? "ml" : "g", quantity: grams };
  return { unitId: basisUnits(basis)[0]!.id, quantity };
}

export function ingredientFromRow(r: IngredientRow): RecipeIngredient | null {
  const basis = sanitizeBasis(r.basis);
  if (!basis) return null;
  const { unitId, quantity } = unitFor(basis, r.unit_label, r.grams == null ? null : Number(r.grams), Number(r.quantity));
  return {
    id: r.id,
    name: r.name,
    source: r.source,
    basis,
    quantity,
    unitId,
    unitLabel: r.unit_label,
    amountLabel: r.amount_label ?? computeAmount(basis, quantity, unitId)?.amountLabel ?? `${quantity} ${r.unit_label}`,
    isEstimate: r.is_estimate,
  };
}

export function recipeView(r: RecipeRow): RecipeView {
  const ingredients = [...(r.recipe_ingredients ?? [])]
    .sort((a, b) => a.position - b.position)
    .map(ingredientFromRow)
    .filter((i): i is RecipeIngredient => i != null);
  const totals = recipeTotals(ingredients);
  const servings = Number(r.servings);
  return {
    id: r.id,
    name: r.name,
    servings,
    notes: r.notes,
    ingredients,
    totals,
    perServing: perServing(totals, servings),
    anyEstimate: ingredients.some((i) => i.isEstimate),
  };
}

export async function loadRecipes(supabase: SupabaseClient, userId: string): Promise<RecipeView[]> {
  const { data, error } = await supabase.from("recipes").select(RECIPE_SELECT).eq("user_id", userId).order("name");
  if (error) throw error;
  return ((data ?? []) as unknown as RecipeRow[]).map(recipeView);
}

export async function loadRecipe(supabase: SupabaseClient, userId: string, id: string): Promise<RecipeView | null> {
  const { data, error } = await supabase.from("recipes").select(RECIPE_SELECT).eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? recipeView(data as unknown as RecipeRow) : null;
}

// --------------------------------------------------------------------------- Built-in planner recipes

export interface AppRecipeView {
  slug: string;
  name: string;
  servings: number;
  slots: PlanSlot[];
  steps: string[];
  ingredients: (IngredientAmount & { name: string; source: string; unitLabel: string; amountLabel: string })[];
  totals: NutrientTotals;
  perServing: NutrientTotals;
}

async function appRecipeViewFor(r: AppRecipe): Promise<AppRecipeView | null> {
  const ingredients: AppRecipeView["ingredients"] = [];
  for (const i of r.ingredients) {
    const food = await getLocalFood(i.fdcId);
    if (!food) return null;
    const unit = basisUnits(food.basis).find((u) => u.id === i.unit || u.label === i.unit);
    if (!unit) return null;
    const amount = computeAmount(food.basis, i.quantity, unit.id);
    if (!amount) return null;
    ingredients.push({ name: food.name, source: `usda:${food.fdcId}`, basis: food.basis, quantity: i.quantity, unitId: unit.id, unitLabel: unit.label, amountLabel: amount.amountLabel });
  }
  const totals = recipeTotals(ingredients);
  return { slug: r.slug, name: r.name, servings: r.servings, slots: r.slots, steps: r.steps, ingredients, totals, perServing: perServing(totals, r.servings) };
}

let appCache: Promise<AppRecipeView[]> | null = null;

/** The built-in recipes with nutrition computed from the bundled USDA data (cached per server). */
export function appRecipeViews(): Promise<AppRecipeView[]> {
  appCache ??= Promise.all(APP_RECIPES.map(appRecipeViewFor)).then((all) => all.filter((r): r is AppRecipeView => r != null));
  return appCache;
}

export async function appRecipeView(slug: string): Promise<AppRecipeView | null> {
  const r = appRecipe(slug);
  return r ? (await appRecipeViews()).find((v) => v.slug === slug) ?? null : null;
}

// --------------------------------------------------------------------------- Planner dishes

/** An ingredient amount for ONE serving, for the grocery list. */
export interface GroceryIngredient {
  key: string;
  name: string;
  quantity: number;
  unitLabel: string;
}

export interface PlannerDish extends PlanCandidate {
  /** Ingredients for one serving. */
  ingredients: GroceryIngredient[];
  sodium_mg: number | null;
}

const groceryKey = (source: string | null, name: string) => (source && /^(usda|off|food):/.test(source) ? source : `name:${name.trim().toLowerCase().slice(0, 70)}`);

function dishFrom(opts: {
  key: string;
  name: string;
  origin: PlanCandidate["origin"];
  slots: PlanSlot[];
  per: NutrientTotals;
  ingredientNames: string[];
  ingredients: GroceryIngredient[];
}): PlannerDish {
  const tags = tagsForDish(opts.ingredientNames.length ? opts.ingredientNames : [opts.name]);
  const animalOnly = opts.ingredientNames.length > 0 && opts.ingredientNames.every((n) => tagsForFood(n).some((t) => ANIMAL_TAGS.includes(t)));
  const p = opts.per;
  return {
    key: opts.key,
    name: opts.name,
    origin: opts.origin,
    slots: opts.slots,
    perServing: { calories: Math.round(p.calories.value), protein_g: p.protein_g.value, carbs_g: p.carbs_g.value, fat_g: p.fat_g.value },
    sodium_mg: isComplete(p.sodium_mg) ? p.sodium_mg.value : null,
    complete: (["calories", "protein_g", "carbs_g", "fat_g"] as const).every((k) => isComplete(p[k])),
    ingredientNames: opts.ingredientNames,
    tags,
    animalOnly,
    cost: costTierForDish(opts.ingredientNames.length ? opts.ingredientNames : [opts.name]),
    ingredients: opts.ingredients,
  };
}

const BREAKFAST_WORDS = /\b(breakfast|oat|oats|oatmeal|porridge|egg|eggs|omelet|omelette|pancakes?|waffles?|toast|yogurt|yoghurt|granola|cereal|smoothie|muffin|bagel)\b/i;

/**
 * Meals a user's dish can fill: lunch and dinner; breakfast when its name sounds like breakfast ("oats",
 * "eggs", "smoothie"…), so a chili isn't planned for breakfast; and a snack when a serving is small.
 */
export function userSlots(kcal: number, name: string): PlanSlot[] {
  const slots: PlanSlot[] = BREAKFAST_WORDS.test(name) ? ["breakfast", "lunch", "dinner"] : ["lunch", "dinner"];
  if (kcal <= 350) slots.push("snack");
  return slots;
}

export function recipeDish(r: RecipeView): PlannerDish {
  return dishFrom({
    key: `recipe:${r.id}`,
    name: r.name,
    origin: "recipe",
    slots: userSlots(r.perServing.calories.value, r.name),
    per: r.perServing,
    ingredientNames: r.ingredients.map((i) => i.name),
    ingredients: r.ingredients.map((i) => ({ key: groceryKey(i.source, i.name), name: i.name, quantity: i.quantity / r.servings, unitLabel: i.unitLabel })),
  });
}

export function appDish(r: AppRecipeView): PlannerDish {
  return dishFrom({
    key: `app:${r.slug}`,
    name: r.name,
    origin: "app",
    slots: r.slots,
    per: r.perServing,
    ingredientNames: r.ingredients.map((i) => i.name),
    ingredients: r.ingredients.map((i) => ({ key: groceryKey(i.source, i.name), name: i.name, quantity: i.quantity / r.servings, unitLabel: i.unitLabel })),
  });
}

interface TemplateRow {
  id: string;
  name: string;
  yield_servings: number;
  meal_items: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number | null; sugar_g: number | null; sodium_mg: number | null; quantity: number | null; unit_label: string | null; servings: number; source: string | null; basis: unknown }[];
}

export function savedMealDish(t: TemplateRow): PlannerDish {
  const yieldServings = Number(t.yield_servings) || 1;
  const values = t.meal_items.map((i) => {
    const missing = new Set(sanitizeBasis(i.basis)?.missing ?? []);
    return {
      calories: Number(i.calories),
      protein_g: missing.has("protein_g") ? null : Number(i.protein_g),
      carbs_g: missing.has("carbs_g") ? null : Number(i.carbs_g),
      fat_g: missing.has("fat_g") ? null : Number(i.fat_g),
      fiber_g: i.fiber_g == null ? null : Number(i.fiber_g),
      sugar_g: i.sugar_g == null ? null : Number(i.sugar_g),
      sodium_mg: i.sodium_mg == null ? null : Number(i.sodium_mg),
    };
  });
  const per = perServing(sumNutrients(values), yieldServings);
  return dishFrom({
    key: `meal:${t.id}`,
    name: t.name,
    origin: "saved_meal",
    slots: userSlots(per.calories.value, t.name),
    per,
    ingredientNames: t.meal_items.map((i) => i.name),
    ingredients: t.meal_items.map((i) => {
      const hasAmount = i.quantity != null && i.unit_label;
      return {
        key: groceryKey(i.source, i.name),
        name: i.name,
        quantity: (hasAmount ? Number(i.quantity) : Number(i.servings)) / yieldServings,
        unitLabel: hasAmount ? i.unit_label! : "serving",
      };
    }),
  });
}

export const TEMPLATE_SELECT = "id, name, yield_servings, meal_items(name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, quantity, unit_label, servings, source, basis)";

/** Every dish the planner can use: the user's recipes and saved meals, plus the built-in recipes when wanted. */
export async function plannerDishes(supabase: SupabaseClient, userId: string, includeApp: boolean): Promise<PlannerDish[]> {
  const [recipes, templatesRes, app] = await Promise.all([
    loadRecipes(supabase, userId),
    supabase.from("meals").select(TEMPLATE_SELECT).eq("user_id", userId).eq("is_template", true),
    includeApp ? appRecipeViews() : Promise.resolve([] as AppRecipeView[]),
  ]);
  if (templatesRes.error) throw templatesRes.error;
  return [
    ...recipes.filter((r) => r.ingredients.length).map(recipeDish),
    ...((templatesRes.data ?? []) as unknown as TemplateRow[]).filter((t) => t.meal_items.length).map(savedMealDish),
    ...app.map(appDish),
  ];
}
