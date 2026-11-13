import { addDays, daysBetween } from "./dates";
import { computeAmount, type FoodBasis, type MacroKey } from "./food-basis";
import { ingredientNutrition, perServing, scaleIngredient, scaleTotals, sumNutrients, type NutrientTotals, type NutrientValues } from "./recipes";

/**
 * Meal-prep batching. Turns a week of planned meals into a prep plan:
 *
 * 1. Planned meals that use the same recipe (the member's own recipe or a built-in one) become one batch, with
 *    the total servings and the days and meals it covers. Saved meals aren't recipes, so they aren't batched.
 * 2. Each batch is cooked in one or more prep sessions so that no cooked portion is planned to be eaten more than
 *    FRIDGE_MAX_DAYS days after it was cooked. The prep days are shared by every batch (a "Sunday prep" and a
 *    "Wednesday prep"), not one per recipe. A batch can instead be cooked once with the later portions frozen.
 * 3. Ingredient amounts for each cook are the recipe's own amounts scaled with `scaleIngredient` (the recipe
 *    screen's "Make N servings" path), and nutrition comes from the recipe's own data via `computeAmount`. Nothing
 *    is estimated: an ingredient without nutrition data is flagged, and totals that include it read "at least".
 *
 * Food-safety basis (general guidance, not medical advice): FoodSafety.gov "Cold Food Storage Chart"
 * (https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts) lists cooked leftovers at 3–4 days in
 * the refrigerator (40 °F / 4 °C or below) and the freezer for longer storage. The plan therefore never schedules
 * a refrigerated portion more than 4 days after its prep day.
 *
 * Pure: no database or clock access; the caller passes the planned meals, the recipes and today's date.
 */

/** Most days after cooking that a refrigerated portion is planned to be eaten (FoodSafety.gov: leftovers 3–4 days). */
export const FRIDGE_MAX_DAYS = 4;
export const PREP_WEEK_DAYS = 7;

/** A planned meal, as stored in meal_plan_entries. */
export interface PrepEntry {
  id: string;
  date: string;
  /** Position of the meal in the day (0 = first meal). */
  slot: number;
  /** "Breakfast", "Lunch"… */
  label: string;
  /** "recipe:<uuid>", "app:<slug>" or "meal:<uuid>". */
  key: string;
  name: string;
  /** Servings planned for this meal. */
  portion: number;
  logged: boolean;
}

/** One ingredient of a recipe as written. `basis` is null when the stored ingredient has no usable nutrition data. */
export interface PrepIngredient {
  name: string;
  basis: FoodBasis | null;
  quantity: number;
  /** The unit within `basis` (null when there is no basis). */
  unitId: string | null;
  /** The unit as written, e.g. "g" or "1 cup". */
  unitLabel: string;
  /** The amount as written, e.g. "200 g". */
  amountLabel: string;
}

export interface PrepRecipe {
  /** Same key as the planned meals: "recipe:<uuid>" or "app:<slug>". */
  key: string;
  name: string;
  /** Servings the recipe makes as written. */
  servings: number;
  ingredients: PrepIngredient[];
}

export interface PrepOptions {
  /** First day of the prep week (YYYY-MM-DD). */
  weekStart: string;
  days?: number;
  /** Meals before today are left out (already past), and no prep day is suggested before today. */
  today?: string;
  /** Batch keys the member chose to cook once and freeze the later portions of. */
  freeze?: readonly string[];
}

export type Storage = "fridge" | "freezer";

export interface PrepMeal {
  entryId: string;
  date: string;
  slot: number;
  label: string;
  portion: number;
  /** Days between the prep day and this meal (0 = eaten the day it's cooked). */
  daysAfterCooking: number;
  storage: Storage;
}

export type IngredientData = "complete" | "partial" | "none";

export interface ScaledPrepIngredient {
  name: string;
  quantity: number;
  amountLabel: string;
  /** "none": no nutrition data for this ingredient; "partial": some macros aren't listed by its source. */
  data: IngredientData;
  missing: MacroKey[];
}

/** One cook of a batch: what to make in one prep session. */
export interface PrepCook {
  sessionIndex: number;
  prepDate: string;
  servings: number;
  /** Servings ÷ the servings the recipe makes. */
  factor: number;
  meals: PrepMeal[];
  ingredients: ScaledPrepIngredient[];
  /** Nutrition for the whole cook, from the recipe's own data (null when the recipe is missing). */
  totals: NutrientTotals | null;
  /** Servings to freeze on the prep day (frozen batches only). */
  freezerServings: number;
}

export interface PrepBatch {
  key: string;
  name: string;
  origin: "recipe" | "app";
  /** Servings the recipe makes as written; null when the recipe can't be found any more. */
  recipeServings: number | null;
  totalServings: number;
  meals: PrepMeal[];
  /** Cooked once, with the portions eaten more than FRIDGE_MAX_DAYS days later frozen. */
  frozen: boolean;
  /** True when cooking fresh needs more than one session, so freezing is an alternative. */
  canFreeze: boolean;
  cooks: PrepCook[];
  /** One serving's nutrition from the recipe's data (null when the recipe is missing). */
  perServing: NutrientTotals | null;
  missingRecipe: boolean;
}

export interface PrepSession {
  index: number;
  prepDate: string;
  /** First and last day of the meals this session cooks for. */
  from: string;
  to: string;
  cooks: { key: string; name: string; servings: number; freezerServings: number }[];
}

/** Planned saved meals (made from foods, not a recipe): nothing to batch; their items are on the grocery list. */
export interface NotBatchedItem {
  key: string;
  name: string;
  servings: number;
  meals: { date: string; label: string; portion: number }[];
}

export interface PrepPlan {
  weekStart: string;
  weekEnd: string;
  batches: PrepBatch[];
  sessions: PrepSession[];
  notBatched: NotBatchedItem[];
  /** Meals in the week that aren't in the plan: already logged, or on a day before today. */
  skipped: { logged: number; past: number };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtQty = (q: number) => (Number.isInteger(q) ? String(q) : String(round2(q)));
const NO_DATA: NutrientValues = { calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, sugar_g: null, sodium_mg: null };

export const isBatchable = (key: string) => key.startsWith("recipe:") || key.startsWith("app:");

/** Nutrition for one ingredient as written, or all-null when it has no data (never counted as zero). */
function ingredientValues(i: PrepIngredient): NutrientValues {
  if (!i.basis || !i.unitId) return NO_DATA;
  return ingredientNutrition({ basis: i.basis, quantity: i.quantity, unitId: i.unitId }) ?? NO_DATA;
}

/** The recipe's whole-batch nutrition, from its own ingredient data. */
export function recipeNutrition(r: PrepRecipe): NutrientTotals {
  return sumNutrients(r.ingredients.map(ingredientValues));
}

/**
 * One ingredient scaled by `factor` in its own unit, through the recipe screen's `scaleIngredient`. An ingredient
 * without usable data is scaled from the amount as written and flagged rather than guessed at.
 */
export function scalePrepIngredient(i: PrepIngredient, factor: number): ScaledPrepIngredient {
  if (i.basis && i.unitId) {
    const scaled = scaleIngredient({ basis: i.basis, quantity: i.quantity, unitId: i.unitId, amountLabel: i.amountLabel }, factor);
    const amount = computeAmount(i.basis, scaled.quantity, i.unitId);
    if (amount) {
      const missing = [...(i.basis.missing ?? [])];
      return { name: i.name, quantity: scaled.quantity, amountLabel: scaled.amountLabel, data: missing.length ? "partial" : "complete", missing };
    }
  }
  const quantity = round2(i.quantity * factor);
  return { name: i.name, quantity, amountLabel: factor === 1 ? i.amountLabel : `${fmtQty(quantity)} ${i.unitLabel.replace(/^1 /, "")}`.trim(), data: "none", missing: [] };
}

/** Splits the days first..last into the fewest runs of at most FRIDGE_MAX_DAYS days, as even as possible (shorter runs first). */
export function splitDays(first: string, last: string): { from: string; to: string }[] {
  const span = daysBetween(first, last) + 1;
  if (span <= 0) return [];
  const n = Math.ceil(span / FRIDGE_MAX_DAYS);
  const base = Math.floor(span / n);
  const extra = span % n;
  const out: { from: string; to: string }[] = [];
  let start = first;
  for (let i = 0; i < n; i++) {
    const size = base + (i >= n - extra ? 1 : 0);
    out.push({ from: start, to: addDays(start, size - 1) });
    start = addDays(start, size);
  }
  return out;
}

const byDateSlot = (a: { date: string; slot: number }, b: { date: string; slot: number }) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.slot - b.slot);

interface Candidate {
  id: number;
  prepDate: string;
  from: string;
  to: string;
}

export function buildPrepPlan(entries: PrepEntry[], recipes: ReadonlyMap<string, PrepRecipe>, opts: PrepOptions): PrepPlan {
  const days = opts.days ?? PREP_WEEK_DAYS;
  const weekStart = opts.weekStart;
  const weekEnd = addDays(weekStart, days - 1);
  const freeze = new Set(opts.freeze ?? []);
  const skipped = { logged: 0, past: 0 };

  const active: PrepEntry[] = [];
  for (const e of entries) {
    if (e.date < weekStart || e.date > weekEnd || !(e.portion > 0)) continue;
    if (e.logged) skipped.logged++;
    else if (opts.today && e.date < opts.today) skipped.past++;
    else active.push(e);
  }
  active.sort(byDateSlot);

  // Saved meals: listed, not batched.
  const loose = new Map<string, NotBatchedItem>();
  for (const e of active.filter((x) => !isBatchable(x.key))) {
    const item = loose.get(e.key) ?? { key: e.key, name: e.name, servings: 0, meals: [] };
    item.servings = round2(item.servings + e.portion);
    item.meals.push({ date: e.date, label: e.label, portion: e.portion });
    loose.set(e.key, item);
  }

  const cooking = active.filter((x) => isBatchable(x.key));
  if (!cooking.length) return { weekStart, weekEnd, batches: [], sessions: [], notBatched: [...loose.values()], skipped };

  // Shared prep days: split the cooking days into runs of at most FRIDGE_MAX_DAYS days and prep the day before each
  // run's first meal (or today, when that day has passed).
  const candidates: Candidate[] = [];
  for (const run of splitDays(cooking[0]!.date, cooking[cooking.length - 1]!.date)) {
    const inRun = cooking.filter((e) => e.date >= run.from && e.date <= run.to);
    if (!inRun.length) continue;
    const dayBefore = addDays(inRun[0]!.date, -1);
    const prepDate = opts.today && dayBefore < opts.today ? opts.today : dayBefore;
    candidates.push({ id: candidates.length, prepDate, from: run.from, to: run.to });
  }
  const candidateFor = (date: string) => candidates.find((c) => date >= c.from && date <= c.to)!;

  interface Draft {
    key: string;
    name: string;
    recipe: PrepRecipe | null;
    entries: PrepEntry[];
  }
  const drafts = new Map<string, Draft>();
  for (const e of cooking) {
    const d = drafts.get(e.key) ?? { key: e.key, name: recipes.get(e.key)?.name ?? e.name, recipe: recipes.get(e.key) ?? null, entries: [] };
    d.entries.push(e);
    drafts.set(e.key, d);
  }

  // 1. Which prep day cooks each meal.
  const assigned = [...drafts.values()].map((d) => {
    const first = candidateFor(d.entries[0]!.date);
    // One cook covers the whole batch when every meal is within the fridge window of the first prep day; otherwise
    // each meal is cooked in the session for its run of days (or, when the member chose to freeze, all at once).
    const oneCook = d.entries.every((e) => daysBetween(first.prepDate, e.date) <= FRIDGE_MAX_DAYS);
    const canFreeze = !oneCook;
    const frozen = canFreeze && freeze.has(d.key);
    const groups = new Map<number, PrepEntry[]>();
    for (const e of d.entries) {
      const c = oneCook || frozen ? first : candidateFor(e.date);
      groups.set(c.id, [...(groups.get(c.id) ?? []), e]);
    }
    return { d, canFreeze, frozen, groups };
  });

  // 2. Only the prep days something is cooked on, each the day before its earliest meal (or today). A batch moved
  //    into an earlier session can leave a later one empty, or let it move later; later is never less safe.
  const kept = candidates.filter((c) => assigned.some((a) => a.groups.has(c.id)));
  const prepDateOf = new Map<number, string>();
  const indexOf = new Map<number, number>();
  kept.forEach((c, i) => {
    const earliest = assigned.flatMap((a) => (a.groups.get(c.id) ?? []).map((e) => e.date)).sort()[0]!;
    const dayBefore = addDays(earliest, -1);
    prepDateOf.set(c.id, opts.today && dayBefore < opts.today ? opts.today : dayBefore);
    indexOf.set(c.id, i);
  });

  // 3. The cooks: servings, scaled ingredients and nutrition, and where each portion is kept.
  const batches: PrepBatch[] = assigned.map(({ d, canFreeze, frozen, groups }) => {
    const totals = d.recipe ? recipeNutrition(d.recipe) : null;
    const cooks: PrepCook[] = [...groups.entries()]
      .map(([cid, es]) => {
        const prepDate = prepDateOf.get(cid)!;
        const meals: PrepMeal[] = es.map((e) => {
          const daysAfterCooking = daysBetween(prepDate, e.date);
          return { entryId: e.id, date: e.date, slot: e.slot, label: e.label, portion: e.portion, daysAfterCooking, storage: daysAfterCooking > FRIDGE_MAX_DAYS ? "freezer" : "fridge" };
        });
        const servings = round2(es.reduce((s, e) => s + e.portion, 0));
        const factor = d.recipe && d.recipe.servings > 0 ? servings / d.recipe.servings : 0;
        return {
          sessionIndex: indexOf.get(cid)!,
          prepDate,
          servings,
          factor: Math.round(factor * 10000) / 10000,
          meals,
          ingredients: d.recipe && factor > 0 ? d.recipe.ingredients.map((i) => scalePrepIngredient(i, factor)) : [],
          totals: totals && factor > 0 ? scaleTotals(totals, factor) : null,
          freezerServings: round2(meals.filter((m) => m.storage === "freezer").reduce((s, m) => s + m.portion, 0)),
        };
      })
      .sort((x, y) => x.sessionIndex - y.sessionIndex);
    return {
      key: d.key,
      name: d.name,
      origin: d.key.startsWith("app:") ? "app" : "recipe",
      recipeServings: d.recipe?.servings ?? null,
      totalServings: round2(d.entries.reduce((s, e) => s + e.portion, 0)),
      meals: cooks.flatMap((c) => c.meals).sort(byDateSlot),
      frozen,
      canFreeze,
      cooks,
      perServing: totals && d.recipe && d.recipe.servings > 0 ? perServing(totals, d.recipe.servings) : null,
      missingRecipe: !d.recipe,
    };
  });

  const sessions: PrepSession[] = kept.map((c, index) => {
    const cooks = batches.flatMap((b) => b.cooks.filter((k) => k.sessionIndex === index).map((k) => ({ batch: b, cook: k })));
    const dates = cooks.flatMap((x) => x.cook.meals.map((m) => m.date)).sort();
    return {
      index,
      prepDate: prepDateOf.get(c.id)!,
      from: dates[0]!,
      to: dates[dates.length - 1]!,
      cooks: cooks.map(({ batch, cook }) => ({ key: batch.key, name: batch.name, servings: cook.servings, freezerServings: cook.freezerServings })),
    };
  });
  return { weekStart, weekEnd, batches, sessions, notBatched: [...loose.values()], skipped };
}

/**
 * The planned meals for each day of the week, taken from the plan that covers that day. When two plans overlap,
 * the one with the later start date wins (as on the planner screen), so a day's meals are never counted twice.
 */
export function entriesForWeek<E extends { date: string }>(plans: { start_date: string; days: number; entries: E[] }[], weekStart: string, days = PREP_WEEK_DAYS): E[] {
  const sorted = [...plans].sort((a, b) => (a.start_date < b.start_date ? 1 : a.start_date > b.start_date ? -1 : 0));
  const out: E[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(weekStart, i);
    const plan = sorted.find((p) => p.start_date <= date && date < addDays(p.start_date, p.days));
    if (plan) out.push(...plan.entries.filter((e) => e.date === date));
  }
  return out;
}

/** Reads the `freeze` search parameter: comma-separated batch keys. */
export function parseFreezeParam(raw: string | string[] | undefined): string[] {
  const s = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const out: string[] = [];
  for (const k of s.split(",")) {
    const v = k.trim();
    if (/^(recipe|app):[A-Za-z0-9_-]{1,80}$/.test(v) && !out.includes(v)) out.push(v);
    if (out.length >= 30) break;
  }
  return out;
}

/** The freeze list with `key` switched on or off. */
export function toggleFreeze(freeze: readonly string[], key: string): string[] {
  return freeze.includes(key) ? freeze.filter((k) => k !== key) : [...freeze, key];
}

/** "Sun, Nov 15" */
export function prepDayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export const servingsText = (n: number) => `${fmtQty(n)} ${n === 1 ? "serving" : "servings"}`;

/** Plain text of the prep plan for sharing or printing: the sessions, then each cook's ingredients. */
export function prepPlanText(plan: PrepPlan): string {
  const lines: string[] = [`Prep plan · ${prepDayLabel(plan.weekStart)} – ${prepDayLabel(plan.weekEnd)}`];
  if (!plan.sessions.length) lines.push("", "No recipes to prep this week.");
  for (const s of plan.sessions) {
    lines.push("", `${prepDayLabel(s.prepDate)} prep · for ${s.from === s.to ? prepDayLabel(s.from) : `${prepDayLabel(s.from)} – ${prepDayLabel(s.to)}`}`);
    for (const b of plan.batches) {
      const cook = b.cooks.find((c) => c.sessionIndex === s.index);
      if (!cook) continue;
      lines.push(`• ${b.name}: ${servingsText(cook.servings)}${cook.freezerServings ? ` (freeze ${servingsText(cook.freezerServings)})` : ""}`);
      for (const i of cook.ingredients) lines.push(`   - ${i.name}: ${i.amountLabel}`);
    }
  }
  if (plan.notBatched.length) {
    lines.push("", "Not batched (saved meals):");
    for (const n of plan.notBatched) lines.push(`• ${n.name}: ${servingsText(n.servings)}`);
  }
  lines.push("", `Cooked food: refrigerate and eat within ${FRIDGE_MAX_DAYS} days, or freeze (FoodSafety.gov Cold Food Storage Chart).`);
  return lines.join("\n");
}
