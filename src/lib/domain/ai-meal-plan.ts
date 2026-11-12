/**
 * Personalized AI meal plans (Pro) — the parts that don't call the AI (pure, unit-tested).
 *
 * The AI only arranges dishes the app can already measure: the member's recipes and saved meals and the built-in
 * recipes, all with nutrition from the food database. It returns dish keys and portions; this module checks them
 * and computes every number from the database values. Anything it can't use is filled by the regular planner and
 * marked as such. Allergy and dislike filtering is by ingredient names (the existing planner rule), which is not a
 * guarantee of allergen safety.
 */
import { z } from "zod";
import { calorieFloor } from "./calorie-budget";
import {
  alternativesFor,
  balanceDay,
  eligibleCandidates,
  plannedMeal,
  slotsForMeals,
  type PlanCandidate,
  type PlanDay,
  type PlannedMeal,
  type PlannerSettings,
  type PlanNutrition,
} from "./meal-planner";
import type { Sex } from "./nutrition";

export const MEAL_PLAN_FOCUSES = ["balanced", "high_protein", "weight_loss", "muscle_gain", "maintenance"] as const;
export type MealPlanFocus = (typeof MEAL_PLAN_FOCUSES)[number];
export const FOCUS_LABELS: Record<MealPlanFocus, string> = {
  balanced: "My current targets",
  high_protein: "High protein",
  weight_loss: "Weight loss",
  muscle_gain: "Muscle gain",
  maintenance: "Maintenance",
};
export const AI_PLAN_DAYS = [1, 3, 7] as const;

export interface FocusTargets extends PlanNutrition {
  /** How each number was set, for the member to read. */
  explanation: string[];
}

const r = Math.round;

/**
 * Daily targets for a plan focus, from the member's own targets and (when known) their estimated maintenance
 * calories. Conservative rules: weight loss about 20% under maintenance (never under the app's calorie floor), muscle
 * gain about 10% over, protein 1.8–2.2 g/kg (capped at 2.4 g/kg), fat at least 25% of calories.
 */
export function focusTargets(
  base: PlanNutrition,
  focus: MealPlanFocus,
  ctx: { maintenance: number | null; weightKg: number | null; sex: Sex | null },
): FocusTargets {
  const explanation: string[] = [];
  const floor = calorieFloor(ctx.sex);
  const kg = ctx.weightKg;
  let calories = base.calories;
  let protein = base.protein_g;
  if (focus === "balanced") {
    return { ...base, explanation: ["Your saved daily targets, unchanged."] };
  }
  if (focus === "maintenance") {
    calories = ctx.maintenance ?? base.calories;
    explanation.push(ctx.maintenance ? `About your estimated maintenance: ${calories} kcal.` : "Your saved calories (maintenance isn't known: add age, height, weight and activity on the Food screen).");
  } else if (focus === "weight_loss") {
    const ref = ctx.maintenance ?? base.calories;
    calories = Math.max(floor, Math.min(base.calories, r(ref * 0.8)));
    explanation.push(`${calories} kcal: about 20% under ${ctx.maintenance ? "your estimated maintenance" : "your saved calories"}, and never under the ${floor} kcal floor.`);
    if (kg) protein = Math.max(protein, r(kg * 1.8));
  } else if (focus === "muscle_gain") {
    calories = r((ctx.maintenance ?? base.calories) * 1.1);
    explanation.push(`${calories} kcal: about 10% over ${ctx.maintenance ? "your estimated maintenance" : "your saved calories"}, a modest surplus.`);
    if (kg) protein = Math.max(protein, r(kg * 1.8));
  } else {
    explanation.push(`${calories} kcal: your saved calories.`);
    protein = kg ? Math.max(protein, r(kg * 2.0)) : Math.max(protein, r((calories * 0.3) / 4));
  }
  if (kg) protein = Math.min(protein, r(kg * 2.4));
  explanation.push(kg ? `${protein} g protein (${(protein / kg).toFixed(1)} g per kg of bodyweight).` : `${protein} g protein.`);
  // Fat at least 25% of calories; carbohydrate fills the rest, keeping the member's carb-to-fat balance when it can.
  const rest = Math.max(0, calories - protein * 4);
  const baseRest = Math.max(1, base.carbs_g * 4 + base.fat_g * 9);
  let fat = r(((rest * (base.fat_g * 9)) / baseRest) / 9);
  fat = Math.max(fat, r((calories * 0.25) / 9));
  const carbs = Math.max(0, r((rest - fat * 9) / 4));
  explanation.push(`${carbs} g carbohydrate and ${fat} g fat fill the rest (fat at least 25% of calories).`);
  return { calories, protein_g: protein, carbs_g: carbs, fat_g: fat, explanation };
}

/** What the AI returns: only dish keys and portions (structured output). */
export const aiMealPlanOutputSchema = z.object({
  summary: z.string().describe("2–4 sentences: how the plan fits the targets, focus and notes."),
  days: z.array(
    z.object({
      day_index: z.number().int().describe("0 for the first day."),
      meals: z.array(z.object({ slot_index: z.number().int(), dish_key: z.string(), portion: z.number() })),
    }),
  ),
  assumptions: z.array(z.string()).describe("Anything you assumed; empty if nothing."),
});
export type AiMealPlanOutput = z.infer<typeof aiMealPlanOutputSchema>;

export type DraftMeal = PlannedMeal & { by: "ai" | "planner" };
export interface DraftDay {
  date: string;
  meals: (DraftMeal | null)[];
}

/** The dish list and rules sent to the AI. Nutrition is the app's own (per serving). */
export function dishCatalogForAi(eligible: PlanCandidate[]): string {
  return eligible
    .map((c) => {
      const p = c.perServing;
      return `${c.key} | ${c.name.replace(/\|/g, "/")} | ${c.slots.join("/")} | ${p.calories} kcal P${r(p.protein_g)} C${r(p.carbs_g)} F${r(p.fat_g)}${c.complete ? "" : " (some values missing)"}`;
    })
    .join("\n");
}

const quarter = (n: number) => Math.round(n * 4) / 4;

/**
 * Check the AI's plan against the dishes the member can use, and build the draft: only known, allowed dishes in
 * matching meals, portions of 0.5–2.5 servings in quarter steps, no dish twice in a day. Gaps are filled by the
 * regular planner (marked "planner"). Then each day's portions are nudged towards the calorie target, as the
 * regular planner does. Returns the draft and what had to be corrected.
 */
export function buildDraftFromAi(output: AiMealPlanOutput, cands: PlanCandidate[], settings: PlannerSettings, dates: string[]): { days: DraftDay[]; corrections: number } {
  const eligible = eligibleCandidates(cands, settings);
  const byKey = new Map(eligible.map((c) => [c.key, c]));
  const specs = slotsForMeals(settings.mealsPerDay);
  const per = new Map(eligible.map((c) => [c.key, c.perServing]));
  let corrections = 0;
  const days: DraftDay[] = dates.map((date, dayIndex) => {
    const fromAi = output.days.find((d) => d.day_index === dayIndex)?.meals ?? [];
    const used = new Set<string>();
    const meals: (DraftMeal | null)[] = specs.map((spec, slotIndex) => {
      const pick = fromAi.find((m) => m.slot_index === slotIndex);
      const c = pick ? byKey.get(pick.dish_key) : undefined;
      if (pick && c && c.slots.includes(spec.slot) && !used.has(c.key) && Number.isFinite(pick.portion)) {
        used.add(c.key);
        const portion = Math.min(2.5, Math.max(0.5, quarter(pick.portion)));
        if (portion !== pick.portion) corrections++;
        return { ...plannedMeal(c, spec, slotIndex, portion), by: "ai" as const };
      }
      corrections++;
      return null;
    });
    // Fill what the AI left empty or got wrong with the regular planner's best fit.
    for (let i = 0; i < meals.length; i++) {
      if (meals[i]) continue;
      const day: PlanDay = { date, meals };
      const alt = alternativesFor(eligible, settings, day, i, 12).find((m) => !used.has(m.key));
      if (alt) {
        used.add(alt.key);
        meals[i] = { ...alt, by: "planner" };
      }
    }
    const balanced = balanceDay(meals, per, settings.calories) as (DraftMeal | null)[];
    return { date, meals: balanced.map((m, i) => (m ? { ...m, by: meals[i]!.by } : null)) };
  });
  return { days, corrections };
}

/** The plain-language rules for the AI (no per-user values: they go in the user message). */
export const MEAL_PLAN_INSTRUCTIONS = `You arrange meal plans inside a fitness app. You choose dishes; the app computes all nutrition.
Rules:
- Use ONLY dish keys from the list. Never invent dishes, ingredients or nutrition values.
- For every day and every meal slot, choose one dish whose allowed meals include that slot (breakfast/lunch/dinner/snack).
- Portion: servings of that dish, 0.5 to 2.5 in steps of 0.25. Aim for each day's calories and protein to land close to the targets.
- Variety: never the same dish twice in one day; avoid repeating a dish on consecutive days when there are other options.
- Follow the plan focus and the member's notes when the list allows; if it doesn't, say so in "assumptions".
- The list is already filtered for the member's allergies, dislikes, diet style and budget by ingredient names; don't claim it is allergen-safe.
- The member's notes are preferences (tastes, schedule, cooking time, variety). This is general wellness nutrition, not medical nutrition therapy: never tailor a plan to a disease, medical condition, pregnancy, an eating disorder or a medication, and never present a plan as treating or preventing anything. If the notes ask for that, build a general plan from the targets and say in "assumptions" that medical diets need a doctor or registered dietitian.
- Never aim below the daily calorie target given; the app has already applied its safety floors.
- "summary": 2–4 plain sentences on how the plan fits. No medical claims.`;

/** Words in a member's meal-plan notes that mean a medical or therapeutic diet, which the AI must not attempt. */
const MEDICAL_DIET =
  /\b(diagnos\w*|medication\w*|medicine|prescri\w*|disease|disorder|diabet\w*|insulin|kidney|renal|dialysis|liver|cirrhosis|celiac|coeliac|crohn\w*|colitis|ibs|fodmap|gout|pku|phenylketon\w*|epilep\w*|seizure\w*|cancer|chemo\w*|heart (?:disease|failure|condition|attack)|cardiac|blood pressure|hypertension|cholesterol|thyroid|pcos|pregnan\w*|breastfeed\w*|lactating|postpartum|eating disorder|anorexi\w*|bulimi\w*|binge eat\w*|purg\w*|arfid|surgery|bariatric|warfarin|my doctor|dietitian (?:said|says|told))\b/i;

export const MEDICAL_NOTES_ASSUMPTION =
  "Your notes mention a health condition or a medical diet, so they weren't used for this plan. It's general wellness nutrition, not a medical diet: for that, talk to your doctor or a registered dietitian.";

/**
 * The notes to send to the AI. Notes that describe a medical condition or therapeutic diet aren't sent at all
 * (the plan stays general, and the member is told why), which also keeps health details away from the provider.
 */
export function mealPlanNotesForAi(notes: string | null): { notes: string | null; medical: boolean } {
  const trimmed = notes?.trim() || null;
  if (!trimmed) return { notes: null, medical: false };
  return MEDICAL_DIET.test(trimmed) ? { notes: null, medical: true } : { notes: trimmed, medical: false };
}
