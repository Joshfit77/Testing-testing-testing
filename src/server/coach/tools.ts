import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { isActivityLevel } from "@/lib/domain/calorie-budget";
import { isDietType } from "@/lib/domain/diets";
import type { Sex } from "@/lib/domain/nutrition";
import { PRIMARY_GOALS, type PrimaryGoal } from "@/lib/domain/types";
import { displayWeight, KG_PER_LB, weightUnit } from "@/lib/domain/units";
import { describeSet, liftTrends, topSet, type AthleteSnapshot } from "@/lib/coach/context";
import {
  checkNutritionTargets,
  isToolName,
  runCalculation,
  validateToolInput,
  type CoachProposal,
  type ToolInput,
  type ToolName,
} from "@/lib/coach/tools";
import { checkProposedMemory, memoryInputSchema, memoryRef } from "@/lib/coach/memory";
import { analyzeTraining, describeReviewForCoach, type TrainingChange } from "@/lib/domain/adaptive-training";
import { loadReviewInput, upcomingWeek } from "@/server/services/adaptive-training";
import { getActiveProgramRef, loadProgramWeek, mapWorkouts, WORKOUT_SELECT } from "./snapshot";

/**
 * Server-side handlers for the AI coach tools. All reads use the signed-in user's Supabase session
 * (RLS) plus an explicit user_id filter. No handler writes data: proposal tools only validate and
 * return a suggested change, which the user applies (or not) with an explicit confirm in the UI.
 */

export interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
  timeZone: string;
  snapshot: AthleteSnapshot;
  /** Set once a proposal has been made this turn (one proposal per reply). */
  proposal: CoachProposal | null;
  /** The athlete asked not to remember anything from this conversation. */
  chatMemoryOff?: boolean;
}

export interface ToolOutcome {
  content: string;
  isError: boolean;
  proposal?: CoachProposal;
}

const ok = (data: unknown): ToolOutcome => ({ content: JSON.stringify(data), isError: false });
const fail = (message: string): ToolOutcome => ({ content: JSON.stringify({ error: message }), isError: true });

function units(ctx: ToolContext) {
  const u = ctx.snapshot.units;
  return { u, unit: weightUnit(u), w: (kg: number) => displayWeight(kg, u) };
}

/** Escape LIKE wildcards in user/model-provided search text. */
const likeSafe = (s: string) => s.replace(/[%_\\,()]/g, " ").trim();

async function getRecentWorkouts(ctx: ToolContext, input: ToolInput<"get_recent_workouts">): Promise<ToolOutcome> {
  const since = addDays(ctx.snapshot.today, -input.days);
  const { data, error } = await ctx.supabase
    .from("workout_sessions")
    .select(WORKOUT_SELECT)
    .eq("user_id", ctx.userId)
    .eq("status", "completed")
    .gte("started_at", `${since}T00:00:00Z`)
    .order("started_at", { ascending: false })
    .limit(input.limit);
  if (error) return fail("Couldn't load workouts.");
  const { u, unit, w } = units(ctx);
  const workouts = mapWorkouts(data ?? [], ctx.timeZone);
  return ok({
    unit,
    days: input.days,
    count: workouts.length,
    workouts: workouts.map((wo) => ({
      date: wo.date,
      name: wo.name,
      volume: w(wo.volumeKg),
      exercises: wo.exercises.map((e) => {
        if (e.skipped) return { exercise: e.name, slug: e.slug, skipped: e.skipReason ?? true };
        const top = topSet(e.sets);
        return { exercise: e.name, slug: e.slug, sets: e.sets.map((s) => describeSet(s, u)), e1rm: top?.e1rmKg ? w(top.e1rmKg) : null };
      }),
    })),
  });
}

async function resolveExercise(ctx: ToolContext, query: string): Promise<{ id: string; slug: string; name: string } | null> {
  const q = query.trim().toLowerCase();
  if (/^[a-z0-9-]+$/.test(q)) {
    const { data } = await ctx.supabase.from("exercises").select("id, slug, name").eq("slug", q).maybeSingle();
    if (data) return data as { id: string; slug: string; name: string };
  }
  const words = likeSafe(q.replace(/-/g, " "));
  if (!words) return null;
  const { data } = await ctx.supabase.from("exercises").select("id, slug, name").ilike("name", `%${words}%`).eq("is_published", true).limit(10);
  const list = (data ?? []) as { id: string; slug: string; name: string }[];
  if (!list.length) return null;
  // Prefer an exercise the athlete has actually trained recently.
  const trained = new Set(ctx.snapshot.workouts.flatMap((wo) => wo.exercises.map((e) => e.slug)));
  return list.find((e) => trained.has(e.slug)) ?? list.sort((a, b) => a.name.length - b.name.length)[0]!;
}

async function getExerciseHistory(ctx: ToolContext, input: ToolInput<"get_exercise_history">): Promise<ToolOutcome> {
  const ex = await resolveExercise(ctx, input.exercise);
  if (!ex) return fail(`No exercise matches "${input.exercise}". Try search_exercises to find the slug.`);
  const [{ data, error }, { data: prs }] = await Promise.all([
    ctx.supabase
      .from("workout_exercises")
      .select("skipped, skip_reason, session:workout_sessions!inner(started_at, status, name), sets:workout_sets(set_number, reps, weight_kg, duration_seconds, rpe, completed, is_warmup)")
      .eq("user_id", ctx.userId)
      .eq("exercise_id", ex.id)
      .eq("session.status", "completed")
      .limit(300),
    ctx.supabase.from("personal_records").select("record_type, value, weight_kg, reps, achieved_at").eq("user_id", ctx.userId).eq("exercise_id", ex.id),
  ]);
  if (error) return fail("Couldn't load the exercise history.");
  const rows = ((data ?? []) as unknown as { skipped: boolean; skip_reason: string | null; session: { started_at: string; name: string }; sets: RawSet[] }[])
    .sort((a, b) => b.session.started_at.localeCompare(a.session.started_at))
    .slice(0, input.sessions);
  const { u, unit, w } = units(ctx);
  const sessions = rows.map((r) => {
    const sets = r.sets
      .filter((s) => s.completed && !s.is_warmup)
      .sort((a, b) => a.set_number - b.set_number)
      .map((s) => ({ reps: s.reps, weightKg: s.weight_kg == null ? null : Number(s.weight_kg), seconds: s.duration_seconds, rpe: s.rpe == null ? null : Number(s.rpe) }));
    return { date: isoDateInTz(new Date(r.session.started_at), ctx.timeZone), workout: r.session.name, skipped: r.skipped ? (r.skip_reason ?? "yes") : false, sets };
  });
  const trend = liftTrends(sessions.filter((s) => !s.skipped).map((s) => ({ date: s.date, name: "", volumeKg: 0, exercises: [{ slug: ex.slug, name: ex.name, skipped: false, skipReason: null, sets: s.sets }] })))[0];
  return ok({
    exercise: ex.name,
    slug: ex.slug,
    unit,
    sessions_found: sessions.length,
    sessions: sessions.map((s) => {
      const top = topSet(s.sets);
      return {
        date: s.date,
        workout: s.workout,
        ...(s.skipped ? { skipped: s.skipped } : {}),
        sets: s.sets.map((x) => describeSet(x, u)),
        top_set: top ? describeSet(top, u) : null,
        e1rm: top?.e1rmKg ? w(top.e1rmKg) : null,
        working_sets: s.sets.length,
      };
    }),
    trend: trend
      ? { first_e1rm: w(trend.firstE1rmKg), last_e1rm: w(trend.lastE1rmKg), best_e1rm: w(trend.bestE1rmKg), change_pct: trend.changePct, sessions_since_best: trend.sessionsSinceBest }
      : null,
    records: (prs ?? []).map((p) => ({
      type: p.record_type,
      value: p.record_type === "max_reps" || p.record_type === "max_duration" ? Number(p.value) : w(Number(p.value)),
      ...(p.weight_kg ? { weight: w(Number(p.weight_kg)) } : {}),
      ...(p.reps ? { reps: p.reps } : {}),
      date: (p.achieved_at as string).slice(0, 10),
    })),
  });
}

interface RawSet {
  set_number: number;
  reps: number | null;
  weight_kg: number | string | null;
  duration_seconds: number | null;
  rpe: number | string | null;
  completed: boolean;
  is_warmup: boolean;
}

async function getNutritionSummary(ctx: ToolContext, input: ToolInput<"get_nutrition_summary">): Promise<ToolOutcome> {
  const start = addDays(ctx.snapshot.today, -(input.days - 1));
  const { data, error } = await ctx.supabase
    .from("meal_items")
    .select("name, calories, protein_g, carbs_g, fat_g, amount_label, meal:meals!inner(eaten_on, meal_type, status, is_template)")
    .eq("user_id", ctx.userId)
    .eq("meal.is_template", false)
    .eq("meal.status", "logged")
    .gte("meal.eaten_on", start)
    .lte("meal.eaten_on", ctx.snapshot.today);
  if (error) return fail("Couldn't load the food log.");
  const items = (data ?? []) as unknown as { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; amount_label: string | null; meal: { eaten_on: string; meal_type: string } }[];
  const days = new Map<string, { calories: number; protein: number; carbs: number; fat: number; items: number }>();
  for (const i of items) {
    const d = days.get(i.meal.eaten_on) ?? { calories: 0, protein: 0, carbs: 0, fat: 0, items: 0 };
    d.calories += Number(i.calories);
    d.protein += Number(i.protein_g);
    d.carbs += Number(i.carbs_g);
    d.fat += Number(i.fat_g);
    d.items += 1;
    days.set(i.meal.eaten_on, d);
  }
  const perDay = [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, d]) => ({ date, calories: Math.round(d.calories), protein_g: Math.round(d.protein), carbs_g: Math.round(d.carbs), fat_g: Math.round(d.fat), items: d.items }));
  const logged = perDay.length;
  const avg = (k: "calories" | "protein_g") => (logged ? Math.round(perDay.reduce((s, d) => s + d[k], 0) / logged) : null);
  const today = items
    .filter((i) => i.meal.eaten_on === ctx.snapshot.today)
    .slice(0, 40)
    .map((i) => ({ meal: i.meal.meal_type, food: i.name.slice(0, 80), amount: i.amount_label, kcal: Math.round(Number(i.calories)), protein_g: Math.round(Number(i.protein_g)) }));
  return ok({
    range: { start, end: ctx.snapshot.today, days: input.days, days_logged: logged },
    averages_on_logged_days: { calories: avg("calories"), protein_g: avg("protein_g") },
    per_day: perDay,
    today_items: today,
    targets: ctx.snapshot.targets,
    calorie_budget: ctx.snapshot.budget,
    diet_type: ctx.snapshot.dietType,
  });
}

async function getProgramWeek(ctx: ToolContext, input: ToolInput<"get_program_week">): Promise<ToolOutcome> {
  const ref = await getActiveProgramRef(ctx.supabase, ctx.userId);
  if (!ref) return ok({ active_program: null, note: "The athlete has no active program." });
  const weekNumber = input.week ?? ref.currentWeek;
  if (weekNumber > ref.durationWeeks) return fail(`The program has ${ref.durationWeeks} weeks.`);
  const week = await loadProgramWeek(ctx.supabase, ref.programId, weekNumber);
  if (!week) return fail(`Week ${weekNumber} wasn't found.`);
  return ok({
    program: ref.name,
    editable: ref.editable,
    week: weekNumber,
    of_weeks: ref.durationWeeks,
    current_position: { week: ref.currentWeek, next_day: ref.currentDay },
    focus: week.focus || null,
    deload: week.isDeload,
    days: week.days.map((d) => ({
      day: d.dayNumber,
      name: d.name,
      focus: d.focus || null,
      ...(weekNumber === ref.currentWeek && d.dayNumber === ref.currentDay ? { next: true } : {}),
      exercises: d.exercises.map((e, i) => ({
        slug: e.slug,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        seconds: e.seconds,
        rpe: e.rpe,
        intensity: e.intensity,
        rest_seconds: d.exerciseRows[i]?.rest ?? null,
      })),
    })),
  });
}

interface CatalogRow {
  id: string;
  slug: string;
  name: string;
  equipment: string[];
  primary_muscles: string[];
  secondary_muscles: string[];
  movement_pattern: string;
  category: string;
  difficulty: string;
  form_cues: string[];
  common_mistakes: string[];
}

async function searchExercises(ctx: ToolContext, input: ToolInput<"search_exercises">): Promise<ToolOutcome> {
  const { data, error } = await ctx.supabase
    .from("exercises")
    .select("id, slug, name, equipment, primary_muscles, secondary_muscles, movement_pattern, category, difficulty, form_cues, common_mistakes")
    .eq("is_published", true);
  if (error) return fail("Couldn't search the exercise catalog.");
  const all = (data ?? []) as CatalogRow[];
  const allowed = new Set<string>([...input.equipment, "bodyweight", "mat"]);
  const words = input.query.toLowerCase().replace(/-/g, " ").split(/\s+/).filter((x) => x.length > 1);
  const scored = all
    .filter((e) => !input.equipment.length || e.equipment.every((q) => allowed.has(q)))
    .map((e) => {
      const name = e.name.toLowerCase();
      const hay = `${name} ${e.slug.replace(/-/g, " ")} ${e.primary_muscles.join(" ")} ${e.secondary_muscles.join(" ")} ${e.movement_pattern.replace(/_/g, " ")} ${e.category}`.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (name.includes(w)) score += 3;
        else if (hay.includes(w)) score += 1;
        else score -= 2;
      }
      return { e, score };
    })
    .filter((x) => !words.length || x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
    .slice(0, input.limit);
  const ids = scored.map((x) => x.e.id);
  const bySlug = new Map(all.map((e) => [e.id, e]));
  const alts = new Map<string, string[]>();
  if (ids.length) {
    const { data: altRows } = await ctx.supabase.from("exercise_alternatives").select("exercise_id, alternative_id").in("exercise_id", ids);
    for (const a of altRows ?? []) {
      const alt = bySlug.get(a.alternative_id as string);
      if (alt) alts.set(a.exercise_id as string, [...(alts.get(a.exercise_id as string) ?? []), alt.slug]);
    }
  }
  return ok({
    count: scored.length,
    results: scored.map(({ e }) => ({
      slug: e.slug,
      name: e.name,
      equipment: e.equipment,
      muscles: e.primary_muscles,
      pattern: e.movement_pattern,
      difficulty: e.difficulty,
      cues: e.form_cues.slice(0, 4),
      common_mistakes: e.common_mistakes.slice(0, 3),
      alternatives: alts.get(e.id) ?? [],
    })),
  });
}

async function getFoodNutrition(_ctx: ToolContext, input: ToolInput<"get_food_nutrition">): Promise<ToolOutcome> {
  const { searchUsda } = await import("@/server/services/usda-local");
  const foods = await searchUsda(input.query, 5);
  if (!foods.length) return ok({ results: [], note: `No USDA foods match "${input.query}".` });
  const r1 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10);
  return ok({
    source: "USDA FoodData Central SR Legacy (public domain)",
    results: foods.slice(0, 5).map((f) => {
      const p = f.basis.per100;
      const g = input.grams;
      return {
        food: f.name,
        category: f.category,
        per_100g: { kcal: Math.round(p.calories), protein_g: r1(p.protein_g), carbs_g: r1(p.carbs_g), fat_g: r1(p.fat_g), fiber_g: r1(p.fiber_g) },
        ...(g
          ? { [`per_${g}g`]: { kcal: Math.round((p.calories * g) / 100), protein_g: r1((p.protein_g * g) / 100), carbs_g: r1((p.carbs_g * g) / 100), fat_g: r1((p.fat_g * g) / 100) } }
          : {}),
        portions: (f.basis.portions ?? []).slice(0, 4).map((x) => `${x.label} = ${x.grams} g`),
      };
    }),
  });
}

function calcProfile(ctx: ToolContext) {
  const s = ctx.snapshot;
  return {
    units: s.units,
    sex: (s.sex as Sex | null) ?? null,
    age: s.age,
    heightCm: s.heightCm,
    weightKg: s.weights.at(-1)?.kg ?? null,
    goal: s.goal && (PRIMARY_GOALS as readonly string[]).includes(s.goal) ? (s.goal as PrimaryGoal) : null,
    diet: isDietType(s.dietType) ? s.dietType : null,
    activity: isActivityLevel(s.activity) ? s.activity : null,
    weeklyChangeKg: s.weeklyChangeKg,
  };
}

async function proposeExerciseSwap(ctx: ToolContext, input: ToolInput<"propose_exercise_swap">): Promise<ToolOutcome> {
  if (input.from_exercise_slug === input.to_exercise_slug) return fail("The replacement must be a different exercise.");
  const ref = await getActiveProgramRef(ctx.supabase, ctx.userId);
  if (!ref) return fail("The athlete has no active program to change.");
  const week = await loadProgramWeek(ctx.supabase, ref.programId, ref.currentWeek);
  const from = week?.days.flatMap((d) => d.exercises).find((e) => e.slug === input.from_exercise_slug);
  if (!from) return fail(`"${input.from_exercise_slug}" isn't in the current week of ${ref.name}. Call get_program_week for valid slugs.`);
  const { data: to } = await ctx.supabase.from("exercises").select("slug, name").eq("slug", input.to_exercise_slug).eq("is_published", true).maybeSingle();
  if (!to) return fail(`"${input.to_exercise_slug}" isn't in the exercise catalog. Call search_exercises for valid slugs.`);
  const proposal: CoachProposal = {
    kind: "exercise_swap",
    from: { slug: from.slug, name: from.name },
    to: { slug: to.slug as string, name: to.name as string },
    scope: input.scope,
    reason: input.reason,
    programName: ref.name,
    editable: ref.editable,
  };
  return {
    content: JSON.stringify({
      status: "shown_to_athlete_for_confirmation",
      applied: false,
      note: ref.editable
        ? "A card with a Confirm button is shown under your reply. Nothing changes unless the athlete confirms."
        : "This is a library program, which can't be edited. The card tells the athlete to use the Swap button in the workout logger when they reach this exercise. Explain that in your reply.",
    }),
    isError: false,
    proposal,
  };
}

function proposeNutritionTargets(ctx: ToolContext, input: ToolInput<"propose_nutrition_targets">): ToolOutcome {
  const errors = checkNutritionTargets(input, { sex: (ctx.snapshot.sex as Sex | null) ?? null, weightKg: ctx.snapshot.weights.at(-1)?.kg ?? null });
  if (errors.length) return fail(`Targets rejected: ${errors.join(" ")} Adjust and try again, or explain to the athlete.`);
  const t = ctx.snapshot.targets;
  const proposal: CoachProposal = {
    kind: "nutrition_targets",
    calories: input.calories,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
    reason: input.reason,
    previous: t ? { calories: t.calories, protein_g: t.protein_g, carbs_g: t.carbs_g, fat_g: t.fat_g } : null,
  };
  return { content: JSON.stringify({ status: "shown_to_athlete_for_confirmation", applied: false }), isError: false, proposal };
}

function proposeBodyweightLog(ctx: ToolContext, input: ToolInput<"propose_bodyweight_log">): ToolOutcome {
  const kg = Math.round((input.unit === "kg" ? input.weight : input.weight * KG_PER_LB) * 100) / 100;
  if (kg < 25 || kg > 400) return fail("That bodyweight is outside the app's range (25–400 kg).");
  const date = input.date ?? ctx.snapshot.today;
  if (date > ctx.snapshot.today) return fail("The date can't be in the future.");
  if (date < addDays(ctx.snapshot.today, -365)) return fail("The date is more than a year ago.");
  const display = `${displayWeight(kg, ctx.snapshot.units)} ${weightUnit(ctx.snapshot.units)}`;
  const proposal: CoachProposal = { kind: "bodyweight_log", weightKg: kg, date, display, reason: input.reason };
  return { content: JSON.stringify({ status: "shown_to_athlete_for_confirmation", applied: false, weight: display, date }), isError: false, proposal };
}

async function getTrainingReviewTool(ctx: ToolContext): Promise<ToolOutcome> {
  const { input } = await loadReviewInput(ctx.supabase, ctx.userId);
  return ok({ unit: weightUnit(input.units), ...describeReviewForCoach(analyzeTraining(input), input.units) });
}

const proposed = (proposal: CoachProposal, extra: Record<string, unknown> = {}): ToolOutcome => ({
  content: JSON.stringify({ status: "shown_to_athlete_for_approval", applied: false, note: "The card lets the athlete accept, adjust or decline it; it can be undone later. Explain the evidence briefly.", ...extra }),
  isError: false,
  proposal,
});

async function proposeTargetLoad(ctx: ToolContext, input: ToolInput<"propose_target_load">): Promise<ToolOutcome> {
  const { data: ex } = await ctx.supabase.from("exercises").select("slug, name").eq("slug", input.exercise_slug).eq("is_published", true).maybeSingle();
  if (!ex) return fail(`"${input.exercise_slug}" isn't in the exercise catalog. Use a slug from search_exercises or the context.`);
  const kg = Math.round((input.unit === "kg" ? input.weight : input.weight * KG_PER_LB) * 100) / 100;
  // Stay close to what the athlete has actually lifted, when there's a recent record.
  const { input: review } = await loadReviewInput(ctx.supabase, ctx.userId);
  const tops = review.workouts.flatMap((w) => w.exercises.filter((e) => e.slug === ex.slug).flatMap((e) => e.sets.map((x) => x.weightKg ?? 0)));
  const best = tops.length ? Math.max(...tops) : 0;
  if (best > 0 && (kg > best * 1.15 || kg < best * 0.5)) {
    return fail(`That's far from their recent top set of ${displayWeight(best, review.units)} ${weightUnit(review.units)}. Suggest a load within one step of what they've logged, or explain instead.`);
  }
  const change: TrainingChange = { kind: "exercise_target", exerciseSlug: ex.slug as string, exerciseName: ex.name as string, weightKg: kg, reps: input.reps };
  const display = `${displayWeight(kg, ctx.snapshot.units)} ${weightUnit(ctx.snapshot.units)}${input.reps ? ` × ${input.reps}` : ""}`;
  return proposed({ kind: "training_change", change, summary: `Target for ${ex.name as string}: ${display}`, reason: input.reason, units: ctx.snapshot.units }, { based_on_recent_top_set: best ? displayWeight(best, review.units) : null });
}

async function proposeDeloadWeek(ctx: ToolContext, input: ToolInput<"propose_deload_week">): Promise<ToolOutcome> {
  const ref = await getActiveProgramRef(ctx.supabase, ctx.userId);
  if (!ref) return fail("The athlete has no active program.");
  if (!ref.editable) return fail("This is a library program, which can't be edited. Describe the recovery week in text instead (about 60% of the sets at RPE 7 or less).");
  const week = upcomingWeek(ref);
  const { data: w } = await ctx.supabase.from("program_weeks").select("is_deload").eq("program_id", ref.programId).eq("week_number", week).maybeSingle();
  if (!w) return fail(`Week ${week} wasn't found in the program.`);
  if (w.is_deload) return fail(`Week ${week} is already a lighter week.`);
  const change: TrainingChange = { kind: "deload_week", programId: ref.programId, weekNumber: week, setsFactor: input.keep_percent_of_sets / 100, rpeCap: input.rpe_cap };
  return proposed({ kind: "training_change", change, summary: `Week ${week} of ${ref.name} as a recovery week: ${input.keep_percent_of_sets}% of the sets, up to RPE ${input.rpe_cap}`, reason: input.reason, units: ctx.snapshot.units });
}

async function proposeVolumeChange(ctx: ToolContext, input: ToolInput<"propose_volume_change">): Promise<ToolOutcome> {
  if (input.delta_sets === 0) return fail("delta_sets must be -2, -1, 1 or 2.");
  const ref = await getActiveProgramRef(ctx.supabase, ctx.userId);
  if (!ref) return fail("The athlete has no active program.");
  if (!ref.editable) return fail("This is a library program, which can't be edited. Suggest the change in text instead.");
  const week = upcomingWeek(ref);
  const program = await loadProgramWeek(ctx.supabase, ref.programId, week);
  const ex = program?.days.flatMap((d) => d.exercises).find((e) => e.slug === input.exercise_slug);
  if (!ex) return fail(`"${input.exercise_slug}" isn't in week ${week} of ${ref.name}. Call get_program_week for valid slugs.`);
  const change: TrainingChange = { kind: "volume_change", programId: ref.programId, exerciseSlug: ex.slug, exerciseName: ex.name, fromWeek: week, deltaSets: input.delta_sets };
  const n = Math.abs(input.delta_sets);
  return proposed({ kind: "training_change", change, summary: `${input.delta_sets > 0 ? "Add" : "Remove"} ${n} set${n === 1 ? "" : "s"} ${input.delta_sets > 0 ? "to" : "from"} ${ex.name} from week ${week} on`, reason: input.reason, units: ctx.snapshot.units });
}

function proposeMemory(ctx: ToolContext, input: ToolInput<"propose_memory">): ToolOutcome {
  const memory = ctx.snapshot.memory ?? { enabled: false, wellnessConsent: false, items: [] };
  const parsed = memoryInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid memory.");
  const problem = checkProposedMemory(parsed.data, {
    enabled: memory.enabled,
    chatMemoryOff: Boolean(ctx.chatMemoryOff),
    existing: memory.items,
    journalExcerpts: (ctx.snapshot.sharedJournal ?? []).map((j) => [j.title, j.excerpt].filter(Boolean).join(" ")),
  });
  if (problem) return fail(problem);
  const proposal: CoachProposal = { kind: "memory", category: parsed.data.category, content: parsed.data.content };
  return { content: JSON.stringify({ status: "shown_to_athlete_for_approval", saved: false, note: "A card lets the athlete save, edit or decline this. Say so briefly; don't claim it's saved." }), isError: false, proposal };
}

function proposeForgetMemory(ctx: ToolContext, input: ToolInput<"propose_forget_memory">): ToolOutcome {
  const memory = ctx.snapshot.memory;
  if (!memory?.enabled) return fail("Memory is switched off; there is nothing to forget here. The athlete can review saved memories in AI Coach → Memory.");
  const target = memory.items.find((m) => memoryRef(m.id) === input.memory_ref);
  if (!target) return fail(`No memory has the reference ${input.memory_ref}. Use a reference from the Coaching memory list.`);
  const proposal: CoachProposal = { kind: "memory_forget", memoryId: target.id, category: target.category, content: target.content };
  return { content: JSON.stringify({ status: "shown_to_athlete_for_confirmation", deleted: false }), isError: false, proposal };
}

/** Validate and run one tool call. Never throws for bad input: errors go back to the model. */
export async function executeCoachTool(ctx: ToolContext, name: string, rawInput: unknown): Promise<ToolOutcome> {
  if (!isToolName(name)) return fail(`Unknown tool "${name}".`);
  const v = validateToolInput(name as ToolName, rawInput);
  if (!v.ok) return { content: JSON.stringify({ INVALID_INPUT: v.error }), isError: true };
  const input = v.data;
  if (name.startsWith("propose_") && ctx.proposal) return fail("Only one change can be proposed per reply. Mention any other suggestion in text.");
  try {
    switch (name as ToolName) {
      case "get_recent_workouts":
        return await getRecentWorkouts(ctx, input as ToolInput<"get_recent_workouts">);
      case "get_exercise_history":
        return await getExerciseHistory(ctx, input as ToolInput<"get_exercise_history">);
      case "get_nutrition_summary":
        return await getNutritionSummary(ctx, input as ToolInput<"get_nutrition_summary">);
      case "get_program_week":
        return await getProgramWeek(ctx, input as ToolInput<"get_program_week">);
      case "search_exercises":
        return await searchExercises(ctx, input as ToolInput<"search_exercises">);
      case "get_food_nutrition":
        return await getFoodNutrition(ctx, input as ToolInput<"get_food_nutrition">);
      case "calculate":
        return ok(runCalculation(input as ToolInput<"calculate">, calcProfile(ctx)));
      case "propose_exercise_swap":
        return await proposeExerciseSwap(ctx, input as ToolInput<"propose_exercise_swap">);
      case "propose_nutrition_targets":
        return proposeNutritionTargets(ctx, input as ToolInput<"propose_nutrition_targets">);
      case "propose_bodyweight_log":
        return proposeBodyweightLog(ctx, input as ToolInput<"propose_bodyweight_log">);
      case "get_training_review":
        return await getTrainingReviewTool(ctx);
      case "propose_target_load":
        return await proposeTargetLoad(ctx, input as ToolInput<"propose_target_load">);
      case "propose_deload_week":
        return await proposeDeloadWeek(ctx, input as ToolInput<"propose_deload_week">);
      case "propose_volume_change":
        return await proposeVolumeChange(ctx, input as ToolInput<"propose_volume_change">);
      case "propose_memory":
        return proposeMemory(ctx, input as ToolInput<"propose_memory">);
      case "propose_forget_memory":
        return proposeForgetMemory(ctx, input as ToolInput<"propose_forget_memory">);
    }
  } catch (err) {
    if (err instanceof Error && / is required for /.test(err.message)) return fail(err.message);
    return fail("The tool failed. Answer from the context instead.");
  }
}
