import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/domain/dates";
import { buildPrepPlan, entriesForWeek, isBatchable, PREP_WEEK_DAYS, type PrepEntry, type PrepPlan, type PrepRecipe } from "@/lib/domain/meal-prep";
import { appRecipeView, ingredientFromRow, RECIPE_SELECT, type RecipeRow } from "@/server/services/recipes";

/**
 * Loads a week of planned meals and the recipes they use, and builds the prep plan (src/lib/domain/meal-prep.ts).
 * Read-only: nothing is stored; the freeze choices travel in the page URL.
 */

interface EntryRow {
  id: string;
  plan_date: string;
  slot: number;
  label: string;
  source_key: string;
  name: string;
  portion: number | string;
  logged_at: string | null;
}

/** A user's recipe in the prep shape; ingredients without usable nutrition data are kept and flagged, not dropped. */
export function prepRecipeFromRow(r: RecipeRow): PrepRecipe {
  const ingredients = [...(r.recipe_ingredients ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((row) => {
      const i = ingredientFromRow(row);
      if (i) return { name: i.name, basis: i.basis, quantity: i.quantity, unitId: i.unitId, unitLabel: i.unitLabel, amountLabel: i.amountLabel };
      const quantity = Number(row.quantity);
      return { name: row.name, basis: null, quantity, unitId: null, unitLabel: row.unit_label, amountLabel: row.amount_label ?? `${quantity} ${row.unit_label}` };
    });
  return { key: `recipe:${r.id}`, name: r.name, servings: Number(r.servings), ingredients };
}

async function loadPrepRecipes(supabase: SupabaseClient, userId: string, keys: string[]): Promise<Map<string, PrepRecipe>> {
  const out = new Map<string, PrepRecipe>();
  const ids = keys.filter((k) => k.startsWith("recipe:")).map((k) => k.slice(7));
  const slugs = keys.filter((k) => k.startsWith("app:")).map((k) => k.slice(4));
  const [recipesRes, apps] = await Promise.all([
    ids.length ? supabase.from("recipes").select(RECIPE_SELECT).eq("user_id", userId).in("id", ids) : Promise.resolve({ data: [], error: null }),
    Promise.all(slugs.map((s) => appRecipeView(s))),
  ]);
  if (recipesRes.error) throw recipesRes.error;
  for (const row of (recipesRes.data ?? []) as unknown as RecipeRow[]) {
    const r = prepRecipeFromRow(row);
    out.set(r.key, r);
  }
  for (const a of apps) {
    if (!a) continue;
    out.set(`app:${a.slug}`, {
      key: `app:${a.slug}`,
      name: a.name,
      servings: a.servings,
      ingredients: a.ingredients.map((i) => ({ name: i.name, basis: i.basis, quantity: i.quantity, unitId: i.unitId, unitLabel: i.unitLabel, amountLabel: i.amountLabel })),
    });
  }
  return out;
}

export async function loadPrepPlan(supabase: SupabaseClient, userId: string, opts: { weekStart: string; today: string; freeze: string[] }): Promise<PrepPlan> {
  const weekEnd = addDays(opts.weekStart, PREP_WEEK_DAYS - 1);
  // Plans run 1–14 days, so any plan that reaches into the week started at most 13 days before it.
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, start_date, days, meal_plan_entries(id, plan_date, slot, label, source_key, name, portion, logged_at)")
    .eq("user_id", userId)
    .gte("start_date", addDays(opts.weekStart, -13))
    .lte("start_date", weekEnd);
  if (error) throw error;
  const plans = ((data ?? []) as unknown as { start_date: string; days: number; meal_plan_entries: EntryRow[] }[]).map((p) => ({
    start_date: p.start_date,
    days: Number(p.days),
    entries: (p.meal_plan_entries ?? []).map(
      (e): PrepEntry => ({ id: e.id, date: e.plan_date, slot: Number(e.slot), label: e.label, key: e.source_key, name: e.name, portion: Number(e.portion), logged: Boolean(e.logged_at) }),
    ),
  }));
  const entries = entriesForWeek(plans, opts.weekStart);
  const keys = [...new Set(entries.filter((e) => isBatchable(e.key)).map((e) => e.key))];
  const recipes = await loadPrepRecipes(supabase, userId, keys);
  return buildPrepPlan(entries, recipes, { weekStart: opts.weekStart, today: opts.today, freeze: opts.freeze });
}
