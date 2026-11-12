import type { DietType } from "./diets";
import { ANIMAL_TAGS, matchesExclusion, tierFits, type CostTier, type FoodTag } from "./food-tags";

/**
 * Week meal planner. Deterministic and explainable: the same recipes and settings always give the same
 * plan. No AI is involved.
 *
 * 1. Filter the dishes: diet style (by ingredient tags and per-serving carbs/sodium), allergy and dislike
 *    exclusions, the budget tier, and which meals of the day a dish suits.
 * 2. Split the day's calorie target across the meals (meals per day 2–5).
 * 3. For each meal, pick the dish whose portion (0.5–2.5 servings, in quarter steps) lands closest to that
 *    meal's calories while getting near its protein share, preferring variety (no repeats in a day,
 *    fewer repeats across nearby days). Ties break on the dish key, so results are stable.
 * 4. Nudge the day's portions together so the day lands near the calorie target.
 *
 * Every number is an estimate; the UI says so.
 */

export type PlanSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type Budget = "low" | "medium" | "any";
export const BUDGETS: Budget[] = ["low", "medium", "any"];
export const MEALS_PER_DAY = [2, 3, 4, 5] as const;

export interface PlanNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface PlanCandidate {
  /** "app:<slug>" (built-in), "recipe:<uuid>" (the user's recipe) or "meal:<uuid>" (a saved meal). */
  key: string;
  name: string;
  origin: "app" | "recipe" | "saved_meal";
  slots: PlanSlot[];
  /** Nutrition for one serving. */
  perServing: PlanNutrition;
  /** Sodium for one serving when every ingredient lists it. */
  sodium_mg?: number | null;
  /** False when some ingredient has no value for a nutrient (totals are then "at least"). */
  complete: boolean;
  ingredientNames: string[];
  tags: FoodTag[];
  /** True when every ingredient is an animal food (for the carnivore style). */
  animalOnly: boolean;
  cost: CostTier;
}

export interface PlannerSettings {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  diet: DietType;
  allergies: string[];
  dislikes: string[];
  mealsPerDay: number;
  budget: Budget;
}

export interface SlotSpec {
  slot: PlanSlot;
  label: string;
  /** Share of the day's calories. */
  share: number;
}

/** Meals of the day and their calorie shares. Two meals suit time-restricted eating (lunch and dinner). */
export function slotsForMeals(n: number): SlotSpec[] {
  switch (Math.max(2, Math.min(5, Math.round(n)))) {
    case 2:
      return [
        { slot: "lunch", label: "Lunch", share: 0.45 },
        { slot: "dinner", label: "Dinner", share: 0.55 },
      ];
    case 3:
      return [
        { slot: "breakfast", label: "Breakfast", share: 0.3 },
        { slot: "lunch", label: "Lunch", share: 0.35 },
        { slot: "dinner", label: "Dinner", share: 0.35 },
      ];
    case 4:
      return [
        { slot: "breakfast", label: "Breakfast", share: 0.25 },
        { slot: "lunch", label: "Lunch", share: 0.3 },
        { slot: "snack", label: "Snack", share: 0.1 },
        { slot: "dinner", label: "Dinner", share: 0.35 },
      ];
    default:
      return [
        { slot: "breakfast", label: "Breakfast", share: 0.25 },
        { slot: "snack", label: "Morning snack", share: 0.075 },
        { slot: "lunch", label: "Lunch", share: 0.3 },
        { slot: "snack", label: "Afternoon snack", share: 0.075 },
        { slot: "dinner", label: "Dinner", share: 0.3 },
      ];
  }
}

const has = (c: PlanCandidate, ...tags: FoodTag[]) => tags.some((t) => c.tags.includes(t));

/** Does a dish fit a diet style? Based on ingredient names and per-serving carbs/sodium. */
export function dietAllows(c: PlanCandidate, diet: DietType): boolean {
  const carbs = c.perServing.carbs_g;
  switch (diet) {
    case "vegetarian":
      return !has(c, "red_meat", "poultry", "fish", "shellfish");
    case "vegan":
      return !has(c, ...ANIMAL_TAGS, "honey");
    case "pescatarian":
      return !has(c, "red_meat", "poultry");
    case "keto":
      return carbs <= 10 && !has(c, "grain", "legume", "sweetener", "honey");
    case "low_carb":
      return carbs <= 30 && !has(c, "sweetener", "honey");
    case "paleo":
      // Honey is allowed on paleo; refined sugar and syrups aren't.
      return !has(c, "grain", "dairy", "legume", "processed", "sweetener");
    case "carnivore":
      return c.animalOnly;
    case "daniel_fast":
      return !has(c, ...ANIMAL_TAGS, "sweetener", "honey", "processed", "bread");
    case "mediterranean":
      return !has(c, "red_meat", "processed");
    case "dash":
      return !has(c, "processed") && (c.sodium_mg == null || c.sodium_mg <= 700);
    default:
      return true;
  }
}

export type ExclusionReason = "diet" | "allergy" | "dislike" | "budget";

/** Why a dish isn't used, or null when it's allowed. */
export function exclusionReason(c: PlanCandidate, s: Pick<PlannerSettings, "diet" | "allergies" | "dislikes" | "budget">): { reason: ExclusionReason; detail: string } | null {
  for (const a of s.allergies) if (matchesExclusion(c, a)) return { reason: "allergy", detail: a };
  for (const d of s.dislikes) if (matchesExclusion(c, d)) return { reason: "dislike", detail: d };
  if (!dietAllows(c, s.diet)) return { reason: "diet", detail: s.diet };
  if (!tierFits(c.cost, s.budget)) return { reason: "budget", detail: c.cost };
  return null;
}

export function eligibleCandidates(cands: PlanCandidate[], s: PlannerSettings): PlanCandidate[] {
  return cands.filter((c) => c.perServing.calories > 0 && !exclusionReason(c, s));
}

export const MIN_PORTION = 0.5;
export const MAX_PORTION = 2.5;

const quarter = (n: number) => Math.round(n * 4) / 4;
const clampPortion = (p: number) => Math.min(MAX_PORTION, Math.max(MIN_PORTION, quarter(p)));

/** Servings of a dish that come closest to `targetKcal` (0.5–2.5, in quarter steps). */
export function portionFor(c: PlanCandidate, targetKcal: number): number {
  if (!(c.perServing.calories > 0) || !(targetKcal > 0)) return 1;
  return clampPortion(targetKcal / c.perServing.calories);
}

export function scaleNutrition(n: PlanNutrition, portion: number): PlanNutrition {
  return {
    calories: Math.round(n.calories * portion),
    protein_g: Math.round(n.protein_g * portion * 10) / 10,
    carbs_g: Math.round(n.carbs_g * portion * 10) / 10,
    fat_g: Math.round(n.fat_g * portion * 10) / 10,
  };
}

export interface PlannedMeal {
  slotIndex: number;
  slot: PlanSlot;
  label: string;
  key: string;
  name: string;
  portion: number;
  /** Nutrition for this portion. */
  nutrition: PlanNutrition;
  complete: boolean;
}

export interface PlanDay {
  date: string;
  /** One entry per slot; null when no dish fits that meal with the current settings. */
  meals: (PlannedMeal | null)[];
}

export function plannedMeal(c: PlanCandidate, spec: SlotSpec, slotIndex: number, portion: number): PlannedMeal {
  return { slotIndex, slot: spec.slot, label: spec.label, key: c.key, name: c.name, portion, nutrition: scaleNutrition(c.perServing, portion), complete: c.complete };
}

interface ScoreContext {
  usedToday: Set<string>;
  /** Uses of each dish in the previous two days. */
  recent: Map<string, number>;
  /** Uses of each dish so far this plan. */
  week: Map<string, number>;
}

/** Lower is better. */
function score(c: PlanCandidate, spec: SlotSpec, s: PlannerSettings, ctx: ScoreContext): { score: number; portion: number } {
  const target = s.calories * spec.share;
  const portion = portionFor(c, target);
  const kcal = c.perServing.calories * portion;
  let sc = Math.abs(kcal - target) / target;
  const proteinTarget = s.protein_g * spec.share;
  if (proteinTarget > 0) sc += Math.max(0, (proteinTarget - c.perServing.protein_g * portion) / proteinTarget) * 0.5;
  if (ctx.usedToday.has(c.key)) sc += 10;
  sc += (ctx.recent.get(c.key) ?? 0) * 0.6;
  sc += (ctx.week.get(c.key) ?? 0) * 0.15;
  // A dish that needs an unusual portion is a little less natural.
  if (portion !== 1) sc += Math.abs(portion - 1) * 0.05;
  return { score: sc, portion };
}

function pickBest(cands: PlanCandidate[], spec: SlotSpec, s: PlannerSettings, ctx: ScoreContext): { c: PlanCandidate; portion: number } | null {
  let best: { c: PlanCandidate; portion: number; score: number } | null = null;
  for (const c of cands) {
    if (!c.slots.includes(spec.slot)) continue;
    const r = score(c, spec, s, ctx);
    if (!best || r.score < best.score - 1e-9 || (Math.abs(r.score - best.score) <= 1e-9 && c.key < best.c.key)) best = { c, portion: r.portion, score: r.score };
  }
  return best;
}

/** Sums a day's planned meals. */
export function dayTotals(meals: (Pick<PlannedMeal, "nutrition"> | null)[]): PlanNutrition {
  const t = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const m of meals) {
    if (!m) continue;
    t.calories += m.nutrition.calories;
    t.protein_g += m.nutrition.protein_g;
    t.carbs_g += m.nutrition.carbs_g;
    t.fat_g += m.nutrition.fat_g;
  }
  return { calories: Math.round(t.calories), protein_g: Math.round(t.protein_g), carbs_g: Math.round(t.carbs_g), fat_g: Math.round(t.fat_g) };
}

/**
 * Scales the day's portions toward the calorie target when the day is more than 5% off. Portions stay in
 * quarter steps within 0.5–2.5, so a day can still land a little off; the UI shows by how much.
 */
export function balanceDay(meals: (PlannedMeal | null)[], perServingByKey: Map<string, PlanNutrition>, targetKcal: number): (PlannedMeal | null)[] {
  const total = dayTotals(meals).calories;
  if (!(total > 0) || Math.abs(total - targetKcal) / targetKcal <= 0.05) return meals;
  const factor = targetKcal / total;
  return meals.map((m) => {
    if (!m) return m;
    const per = perServingByKey.get(m.key);
    if (!per) return m;
    const portion = clampPortion(m.portion * factor);
    return { ...m, portion, nutrition: scaleNutrition(per, portion) };
  });
}

/** Builds a plan for the given dates. */
export function generatePlan(cands: PlanCandidate[], s: PlannerSettings, dates: string[]): PlanDay[] {
  const eligible = eligibleCandidates(cands, s).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const specs = slotsForMeals(s.mealsPerDay);
  const per = new Map(eligible.map((c) => [c.key, c.perServing]));
  const week = new Map<string, number>();
  const history: string[][] = [];
  const days: PlanDay[] = [];
  for (const date of dates) {
    const recent = new Map<string, number>();
    for (const day of history.slice(-2)) for (const k of day) recent.set(k, (recent.get(k) ?? 0) + 1);
    const usedToday = new Set<string>();
    const meals: (PlannedMeal | null)[] = specs.map((spec, i) => {
      const best = pickBest(eligible, spec, s, { usedToday, recent, week });
      if (!best) return null;
      usedToday.add(best.c.key);
      return plannedMeal(best.c, spec, i, best.portion);
    });
    const balanced = balanceDay(meals, per, s.calories);
    const keys = balanced.flatMap((m) => (m ? [m.key] : []));
    for (const k of keys) week.set(k, (week.get(k) ?? 0) + 1);
    history.push(keys);
    days.push({ date, meals: balanced });
  }
  return days;
}

/**
 * Other dishes for one meal of a day, best fit first: each with the portion that fits that meal's share of
 * the calories. Dishes already in that day (other meals) come last.
 */
export function alternativesFor(cands: PlanCandidate[], s: PlannerSettings, day: PlanDay, slotIndex: number, limit = 6): PlannedMeal[] {
  const specs = slotsForMeals(s.mealsPerDay);
  const spec = specs[slotIndex];
  if (!spec) return [];
  const current = day.meals[slotIndex]?.key;
  const usedToday = new Set(day.meals.flatMap((m, i) => (m && i !== slotIndex ? [m.key] : [])));
  return eligibleCandidates(cands, s)
    .filter((c) => c.key !== current && c.slots.includes(spec.slot))
    .map((c) => ({ c, ...score(c, spec, s, { usedToday, recent: new Map(), week: new Map() }) }))
    .sort((a, b) => a.score - b.score || (a.c.key < b.c.key ? -1 : 1))
    .slice(0, limit)
    .map(({ c, portion }) => plannedMeal(c, spec, slotIndex, portion));
}

export interface DayFit {
  totals: PlanNutrition;
  /** Planned minus target calories. */
  calorieDiff: number;
  /** |diff| / target, rounded to a whole percent. */
  percentOff: number;
  status: "close" | "under" | "over";
}

/** How close a day is to the calorie target: within 10% counts as close. */
export function dayFit(meals: (Pick<PlannedMeal, "nutrition"> | null)[], targetKcal: number): DayFit {
  const totals = dayTotals(meals);
  const calorieDiff = totals.calories - targetKcal;
  const percentOff = targetKcal > 0 ? Math.round((Math.abs(calorieDiff) / targetKcal) * 100) : 0;
  return { totals, calorieDiff, percentOff, status: percentOff <= 10 ? "close" : calorieDiff < 0 ? "under" : "over" };
}

/** Cleans a typed list of allergies or dislikes: trimmed, de-duplicated, at most 20 of up to 40 characters. */
export function cleanTerms(raw: string | string[]): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(/[,;\n]/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of list) {
    const v = t.trim().replace(/\s+/g, " ").slice(0, 40);
    const k = v.toLowerCase();
    if (!v || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
    if (out.length >= 20) break;
  }
  return out;
}
