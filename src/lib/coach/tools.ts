/**
 * AI coach tool definitions: strict JSON schemas sent to the model, matching Zod schemas used to
 * validate every tool input on the server before anything runs, plus the pure calculator.
 *
 * Read tools only ever query the signed-in user's own data (or the public catalog). Tools that would
 * change data are *proposals*: they return a suggested change that the user must confirm in the UI.
 */
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { ACTIVITY_LEVELS, calorieBudget, calorieFloor, isWeeklyRate, type ActivityLevel, type WeeklyRateKg } from "@/lib/domain/calorie-budget";
import type { DietType } from "@/lib/domain/diets";
import type { Sex } from "@/lib/domain/nutrition";
import { estimateOneRepMax } from "@/lib/domain/strength";
import { EQUIPMENT, type PrimaryGoal } from "@/lib/domain/types";
import { KG_PER_LB } from "@/lib/domain/units";
import { MEMORY_CATEGORIES, MEMORY_MAX_CHARS, type MemoryCategory } from "./memory";

const slug = z.string().trim().regex(/^[a-z0-9-]{2,80}$/, "Use an exercise slug like 'bench-press'.");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

export const TOOL_INPUT_SCHEMAS = {
  get_recent_workouts: z.strictObject({
    days: z.number().int().min(1).max(365),
    limit: z.number().int().min(1).max(30),
  }),
  get_exercise_history: z.strictObject({
    exercise: z.string().trim().min(2).max(80),
    sessions: z.number().int().min(1).max(30),
  }),
  get_nutrition_summary: z.strictObject({
    days: z.number().int().min(1).max(30),
  }),
  get_program_week: z.strictObject({
    week: z.number().int().min(1).max(52).nullable(),
  }),
  search_exercises: z.strictObject({
    query: z.string().trim().max(80),
    equipment: z.array(z.enum(EQUIPMENT)).max(10),
    limit: z.number().int().min(1).max(15),
  }),
  get_food_nutrition: z.strictObject({
    query: z.string().trim().min(2).max(80),
    grams: z.number().positive().max(5000).nullable(),
  }),
  calculate: z.strictObject({
    operation: z.enum(["e1rm", "percent_of_1rm", "plates", "convert_weight", "calorie_budget"]),
    weight: z.number().min(0).max(2000).nullable(),
    reps: z.number().int().min(1).max(30).nullable(),
    percent: z.number().min(1).max(110).nullable(),
    unit: z.enum(["kg", "lb"]).nullable(),
    bar_weight: z.number().min(0).max(100).nullable(),
    weekly_change_kg: z.number().min(-1).max(0.5).nullable(),
    activity: z.enum(ACTIVITY_LEVELS).nullable(),
  }),
  propose_exercise_swap: z.strictObject({
    from_exercise_slug: slug,
    to_exercise_slug: slug,
    scope: z.enum(["next_workout", "rest_of_program"]),
    reason: z.string().trim().min(3).max(300),
  }),
  propose_nutrition_targets: z.strictObject({
    calories: z.number().int().min(800).max(8000),
    protein_g: z.number().int().min(0).max(500),
    carbs_g: z.number().int().min(0).max(1000),
    fat_g: z.number().int().min(0).max(400),
    reason: z.string().trim().min(3).max(300),
  }),
  propose_bodyweight_log: z.strictObject({
    weight: z.number().positive().max(900),
    unit: z.enum(["kg", "lb"]),
    date: isoDate.nullable(),
    reason: z.string().trim().min(3).max(300),
  }),
  propose_memory: z.strictObject({
    category: z.enum(MEMORY_CATEGORIES),
    content: z.string().trim().min(3).max(MEMORY_MAX_CHARS),
  }),
  propose_forget_memory: z.strictObject({
    memory_ref: z.string().trim().regex(/^m-[0-9a-f]{8}$/, "Use the memory's reference, like m-1a2b3c4d."),
  }),
} as const;

export type ToolName = keyof typeof TOOL_INPUT_SCHEMAS;
export type ToolInput<N extends ToolName> = z.infer<(typeof TOOL_INPUT_SCHEMAS)[N]>;
export const TOOL_NAMES = Object.keys(TOOL_INPUT_SCHEMAS) as ToolName[];
export const PROPOSAL_TOOLS = ["propose_exercise_swap", "propose_nutrition_targets", "propose_bodyweight_log", "propose_memory", "propose_forget_memory"] as const satisfies readonly ToolName[];
export const isToolName = (v: string): v is ToolName => v in TOOL_INPUT_SCHEMAS;

type JsonSchema = Anthropic.Beta.BetaTool.InputSchema;
const int = (description: string) => ({ type: "integer", description });
const num = (description: string) => ({ type: "number", description });
const str = (description: string) => ({ type: "string", description });
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const obj = (properties: Record<string, unknown>): JsonSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

/**
 * Model-facing definitions. Strict mode doesn't accept numeric/string length constraints, so ranges are
 * stated in descriptions and enforced by the Zod schemas above. Order is fixed (it is part of the
 * cached prompt prefix).
 */
const DEFINITIONS: { name: ToolName; description: string; input_schema: JsonSchema }[] = [
  {
    name: "get_recent_workouts",
    description:
      "Get the athlete's completed workouts in the last N days (newest first): every exercise with all working sets (load, reps, RPE), skips and session volume. Call this when the athlete asks about their recent training, consistency, fatigue or a week/month review and the context summary isn't detailed enough.",
    input_schema: obj({ days: int("Look-back window in days, 1–365 (e.g. 14 or 28)."), limit: int("Max workouts to return, 1–30.") }),
  },
  {
    name: "get_exercise_history",
    description:
      "Get the athlete's history for one exercise across sessions: every working set, the top set and estimated 1RM per session, the trend and their records. Call this for questions about a specific lift — stalls, progress, what weight to use next, plateaus.",
    input_schema: obj({
      exercise: str("Exercise slug (preferred, e.g. 'bench-press') or a name like 'bench'."),
      sessions: int("How many recent sessions with this exercise to return, 1–30."),
    }),
  },
  {
    name: "get_nutrition_summary",
    description:
      "Get the athlete's logged food per day for the last N days (calories, protein, carbs, fat), today's meals, their saved targets and the app's calorie budget. Call this for questions about what they've eaten, what's left today, protein intake or whether their intake matches the goal.",
    input_schema: obj({ days: int("Days to summarize including today, 1–30.") }),
  },
  {
    name: "get_program_week",
    description:
      "Get one week of the athlete's active program: each day's exercises (slugs, sets, reps, RPE, rest), whether it's a deload week and which day is next. Call this for questions about upcoming sessions, planning a deload, or before proposing an exercise swap.",
    input_schema: obj({ week: nullable(int("Week number, 1–52; null for the current week.")) }),
  },
  {
    name: "search_exercises",
    description:
      "Search the app's exercise catalog by name/muscle/pattern and filter by equipment. Returns slugs, equipment, muscles, form cues, common mistakes and listed alternatives. Call this to find substitutes, to check technique cues, or to get a valid slug before proposing a swap.",
    input_schema: obj({
      query: str("Words to match, e.g. 'row', 'hamstrings', 'squat'. Empty string lists by equipment only."),
      equipment: { type: "array", items: { type: "string", enum: [...EQUIPMENT] }, description: "Only exercises doable with these items (bodyweight is always allowed). Empty array = no filter." },
      limit: int("Max results, 1–15."),
    }),
  },
  {
    name: "get_food_nutrition",
    description:
      "Look up a food in the app's USDA FoodData Central database (SR Legacy). Returns calories and macros per 100 g, for the requested grams, and common household portions. Call this when the athlete asks about a food's nutrition or for meal ideas that need real numbers.",
    input_schema: obj({
      query: str("Food to search, e.g. 'greek yogurt', 'chicken breast', 'oats'."),
      grams: nullable(num("Amount in grams to calculate for, up to 5000; null for per-100 g only.")),
    }),
  },
  {
    name: "calculate",
    description:
      "Exact calculator. operations: e1rm (weight, reps → estimated 1RM, Epley); percent_of_1rm (weight = 1RM, percent → load rounded to loadable plates); plates (weight = target total, bar_weight optional → plates per side); convert_weight (weight + unit → other unit); calorie_budget (uses the athlete's saved profile; weekly_change_kg and activity override the saved values). Use it whenever you show numbers to the athlete.",
    input_schema: obj({
      operation: { type: "string", enum: ["e1rm", "percent_of_1rm", "plates", "convert_weight", "calorie_budget"] },
      weight: nullable(num("Load or bodyweight, in `unit`.")),
      reps: nullable(int("Reps performed, 1–30 (e1rm only).")),
      percent: nullable(num("Percent of 1RM, 1–110 (percent_of_1rm only).")),
      unit: nullable({ type: "string", enum: ["kg", "lb"], description: "Unit of `weight` and `bar_weight`; null = athlete's preferred unit." }),
      bar_weight: nullable(num("Bar weight in `unit`; null = 20 kg / 45 lb.")),
      weekly_change_kg: nullable({ type: "number", enum: [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5], description: "Weekly weight change in kg (calorie_budget only)." }),
      activity: nullable({ type: "string", enum: [...ACTIVITY_LEVELS], description: "Daily-life activity level (calorie_budget only)." }),
    }),
  },
  {
    name: "propose_exercise_swap",
    description:
      "Suggest replacing one exercise in the athlete's active program with another. Nothing changes until the athlete taps Confirm on the card. Only call this when the athlete asked for a swap or agreed to one, with slugs from get_program_week/search_exercises. scope: next_workout (only the next session that has it) or rest_of_program (every remaining week).",
    input_schema: obj({
      from_exercise_slug: str("Slug of the exercise currently in the program."),
      to_exercise_slug: str("Slug of the replacement from the catalog."),
      scope: { type: "string", enum: ["next_workout", "rest_of_program"] },
      reason: str("One sentence the athlete will see on the card."),
    }),
  },
  {
    name: "propose_nutrition_targets",
    description:
      "Suggest new daily nutrition targets (calories and macros). Nothing changes until the athlete taps Confirm. Only call this when the athlete asked for new targets or agreed to a change. Calories must be at or above the safe floor and macros must add up to roughly the calories (4/4/9 kcal per g).",
    input_schema: obj({
      calories: int("Daily calories, 800–8000 (never below the athlete's safe floor)."),
      protein_g: int("Grams of protein per day."),
      carbs_g: int("Grams of carbohydrate per day."),
      fat_g: int("Grams of fat per day."),
      reason: str("One sentence the athlete will see on the card."),
    }),
  },
  {
    name: "propose_bodyweight_log",
    description:
      "Suggest logging a bodyweight entry the athlete told you about (e.g. 'I weighed 82.4 kg this morning'). Nothing is saved until they tap Confirm.",
    input_schema: obj({
      weight: num("Bodyweight in `unit`."),
      unit: { type: "string", enum: ["kg", "lb"] },
      date: nullable(str("Date YYYY-MM-DD; null for today.")),
      reason: str("One short sentence for the card."),
    }),
  },
  {
    name: "propose_memory",
    description:
      "Offer to remember something lasting the athlete told you, for future conversations: a secondary goal, an exercise they like or avoid, when or where they train, a food preference, a recovery preference, a milestone, or how they like to be coached. Nothing is saved unless the athlete taps Save (they can edit it first). Only use the athlete's own words and facts they stated; never guess or infer. Don't save what the app already stores (primary goal, experience level, equipment list, days per week, program, logs, targets, bodyweight), health or medical details, or anything from their prayer journal. Don't use it when memory is off. At most one per reply.",
    input_schema: obj({
      category: { type: "string", enum: [...MEMORY_CATEGORIES] },
      content: str(`The note in the third person, one or two short sentences, under ${MEMORY_MAX_CHARS} characters, e.g. "Prefers dumbbell pressing; barbell bench bothers the left shoulder."`),
    }),
  },
  {
    name: "propose_forget_memory",
    description:
      "Offer to delete one saved memory when the athlete asks you to forget it or says it's no longer true. Nothing is deleted unless they tap Forget. Use the reference shown in the Coaching memory list.",
    input_schema: obj({ memory_ref: str("The memory's reference, like m-1a2b3c4d.") }),
  },
];

/** Tool list for the Messages API (strict schemas, eager input streaming for streamed requests). */
export function coachToolDefinitions(): Anthropic.Beta.BetaTool[] {
  return DEFINITIONS.map((d) => ({ ...d, strict: true, eager_input_streaming: true }));
}

export function validateToolInput<N extends ToolName>(name: N, input: unknown): { ok: true; data: ToolInput<N> } | { ok: false; error: string } {
  const parsed = TOOL_INPUT_SCHEMAS[name].safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data as ToolInput<N> };
  return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") };
}

/** Short status line shown in the chat while a tool runs ("Checking your last 6 bench sessions…"). */
export function toolActivityLabel(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case "get_recent_workouts":
      return `Checking your workouts from the last ${Number(i.days) || 14} days…`;
    case "get_exercise_history": {
      const ex = String(i.exercise ?? "lift").replace(/-/g, " ");
      return `Checking your last ${Number(i.sessions) || 6} ${ex} sessions…`;
    }
    case "get_nutrition_summary":
      return Number(i.days) === 1 ? "Checking today's food log…" : `Checking your food log for the last ${Number(i.days) || 7} days…`;
    case "get_program_week":
      return i.week ? `Looking at week ${Number(i.week)} of your program…` : "Looking at this week of your program…";
    case "search_exercises":
      return `Searching exercises${i.query ? ` for "${String(i.query).slice(0, 40)}"` : ""}…`;
    case "get_food_nutrition":
      return `Looking up ${String(i.query ?? "that food").slice(0, 40)} in the USDA database…`;
    case "calculate":
      return "Crunching the numbers…";
    case "propose_exercise_swap":
      return "Preparing a suggested exercise swap…";
    case "propose_nutrition_targets":
      return "Preparing suggested nutrition targets…";
    case "propose_bodyweight_log":
      return "Preparing a bodyweight entry for you to confirm…";
    case "propose_memory":
      return "Preparing a note to remember, for you to approve…";
    case "propose_forget_memory":
      return "Finding that memory…";
    default:
      return "Working…";
  }
}

// --------------------------------------------------------------------------- Proposals

export type CoachProposal =
  | { kind: "exercise_swap"; from: { slug: string; name: string }; to: { slug: string; name: string }; scope: "next_workout" | "rest_of_program"; reason: string; programName: string; editable: boolean }
  | { kind: "nutrition_targets"; calories: number; protein_g: number; carbs_g: number; fat_g: number; reason: string; previous: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null }
  | { kind: "bodyweight_log"; weightKg: number; date: string; display: string; reason: string }
  | { kind: "memory"; category: MemoryCategory; content: string }
  | { kind: "memory_forget"; memoryId: string; category: MemoryCategory; content: string };

export const coachProposalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("exercise_swap"),
    from: z.object({ slug, name: z.string().max(120) }),
    to: z.object({ slug, name: z.string().max(120) }),
    scope: z.enum(["next_workout", "rest_of_program"]),
    reason: z.string().max(300),
    programName: z.string().max(120),
    editable: z.boolean(),
  }),
  z.object({
    kind: z.literal("nutrition_targets"),
    calories: z.number().int().min(800).max(8000),
    protein_g: z.number().int().min(0).max(500),
    carbs_g: z.number().int().min(0).max(1000),
    fat_g: z.number().int().min(0).max(400),
    reason: z.string().max(300),
    previous: z.object({ calories: z.number(), protein_g: z.number(), carbs_g: z.number(), fat_g: z.number() }).nullable(),
  }),
  z.object({ kind: z.literal("bodyweight_log"), weightKg: z.number().min(25).max(400), date: isoDate, display: z.string().max(40), reason: z.string().max(300) }),
  z.object({ kind: z.literal("memory"), category: z.enum(MEMORY_CATEGORIES), content: z.string().min(3).max(MEMORY_MAX_CHARS) }),
  z.object({ kind: z.literal("memory_forget"), memoryId: z.string().uuid(), category: z.enum(MEMORY_CATEGORIES), content: z.string().max(MEMORY_MAX_CHARS) }),
]);

export function isCoachProposal(v: unknown): v is CoachProposal {
  return coachProposalSchema.safeParse(v).success;
}

/**
 * Nutrition target sanity checks: at or above the safe floor, macros within ~10% (min 100 kcal) of the
 * calories, protein within 0.8–3.3 g/kg when bodyweight is known, fat ≥ 0.4 g/kg.
 */
export function checkNutritionTargets(t: { calories: number; protein_g: number; carbs_g: number; fat_g: number }, ctx: { sex: Sex | null; weightKg: number | null }): string[] {
  const errors: string[] = [];
  const floor = calorieFloor(ctx.sex);
  if (t.calories < floor) errors.push(`Calories must be at least ${floor} kcal (the app's safe floor without medical supervision).`);
  const macroKcal = t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9;
  if (Math.abs(macroKcal - t.calories) > Math.max(100, t.calories * 0.1)) errors.push(`Macros add up to ${macroKcal} kcal, which doesn't match ${t.calories} kcal.`);
  if (ctx.weightKg) {
    const pPerKg = t.protein_g / ctx.weightKg;
    if (pPerKg < 0.8 || pPerKg > 3.3) errors.push(`Protein of ${t.protein_g} g is ${pPerKg.toFixed(1)} g/kg; keep it between 0.8 and 3.3 g/kg.`);
    if (t.fat_g / ctx.weightKg < 0.4) errors.push(`Fat of ${t.fat_g} g is below 0.4 g/kg; keep fat at a healthy minimum.`);
  }
  return errors;
}

// --------------------------------------------------------------------------- Calculator

export interface CalcProfile {
  units: "metric" | "imperial";
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  goal: PrimaryGoal | null;
  diet: DietType | null;
  activity: ActivityLevel | null;
  weeklyChangeKg: number | null;
}

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5];
const r2 = (n: number) => Math.round(n * 100) / 100;

export function platesPerSide(total: number, bar: number, unit: "kg" | "lb"): { perSide: number[]; loaded: number; remainder: number } {
  const plates = unit === "kg" ? KG_PLATES : LB_PLATES;
  let side = Math.max(0, (total - bar) / 2);
  const perSide: number[] = [];
  for (const p of plates) {
    while (side >= p - 1e-9) {
      perSide.push(p);
      side = r2(side - p);
    }
  }
  const loaded = r2(bar + perSide.reduce((a, b) => a + b, 0) * 2);
  return { perSide, loaded, remainder: r2(total - loaded) };
}

/** Round to the nearest loadable barbell weight (2.5 kg / 5 lb steps). */
export function roundLoadable(weight: number, unit: "kg" | "lb"): number {
  const step = unit === "kg" ? 2.5 : 5;
  return Math.round(weight / step) * step;
}

export function runCalculation(input: ToolInput<"calculate">, profile: CalcProfile): Record<string, unknown> {
  const unit = input.unit ?? (profile.units === "imperial" ? "lb" : "kg");
  const need = (v: number | null, field: string): number => {
    if (v == null) throw new Error(`${field} is required for ${input.operation}.`);
    return v;
  };
  switch (input.operation) {
    case "e1rm": {
      const weight = need(input.weight, "weight");
      const reps = need(input.reps, "reps");
      const e1rm = estimateOneRepMax(weight, reps);
      if (e1rm == null) return { unit, note: "An e1RM isn't reliable above 12 reps; use a heavier set." };
      return { unit, e1rm: r2(e1rm), formula: "Epley: weight × (1 + reps/30)", rounded_loadable: roundLoadable(e1rm, unit) };
    }
    case "percent_of_1rm": {
      const oneRm = need(input.weight, "weight");
      const pct = need(input.percent, "percent");
      const load = (oneRm * pct) / 100;
      return { unit, exact: r2(load), loadable: roundLoadable(load, unit) };
    }
    case "plates": {
      const total = need(input.weight, "weight");
      const bar = input.bar_weight ?? (unit === "kg" ? 20 : 45);
      if (total < bar) return { unit, note: `Target is lighter than the ${bar} ${unit} bar.` };
      return { unit, bar, ...platesPerSide(total, bar, unit) };
    }
    case "convert_weight": {
      const w = need(input.weight, "weight");
      return unit === "kg" ? { kg: w, lb: r2(w / KG_PER_LB) } : { lb: w, kg: r2(w * KG_PER_LB) };
    }
    case "calorie_budget": {
      const weightKg = input.weight != null ? (unit === "kg" ? input.weight : input.weight * KG_PER_LB) : profile.weightKg;
      const activity = input.activity ?? profile.activity;
      const rate = input.weekly_change_kg ?? profile.weeklyChangeKg ?? 0;
      if (!weightKg || !profile.age || !profile.heightCm || !activity) {
        return { note: "Missing age, height, bodyweight or activity level in the profile; the budget can't be calculated." };
      }
      const weeklyChangeKg = isWeeklyRate(rate) ? (rate as WeeklyRateKg) : 0;
      const b = calorieBudget({ sex: profile.sex, age: profile.age, heightCm: profile.heightCm, weightKg, activity, weeklyChangeKg, goal: profile.goal ?? "general_health", diet: profile.diet });
      return { ...b, inputs: { weightKg: r2(weightKg), activity, weeklyChangeKg }, note: "Estimate (Mifflin–St Jeor × activity); logged exercise is added back on the day." };
    }
  }
}
