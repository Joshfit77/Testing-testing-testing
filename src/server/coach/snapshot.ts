import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHALLENGE_DAYS, CHALLENGE_NAME, CHALLENGE_SLUG } from "@/data/devotionals";
import { getSupplement } from "@/data/supplements";
import { challengeDayNumber } from "@/lib/domain/challenge";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import type { UnitSystem } from "@/lib/domain/types";
import type { AthleteSnapshot, SnapshotProgram, SnapshotProgramDay, SnapshotWorkout } from "@/lib/coach/context";
import { loadBudgetContext } from "@/server/services/nutrition-targets";

/**
 * Load the athlete snapshot for the AI coach. Every query uses the caller's own Supabase session (RLS)
 * AND an explicit `user_id` filter, so only this user's rows are ever read.
 */

export const WORKOUT_SELECT =
  "id, name, started_at, total_volume_kg, workout_exercises(position, skipped, skip_reason, exercise:exercises!workout_exercises_exercise_id_fkey(slug, name), sets:workout_sets(set_number, reps, weight_kg, duration_seconds, rpe, completed, is_warmup))";

interface RawWorkout {
  name: string;
  started_at: string;
  total_volume_kg: number | string;
  workout_exercises: {
    position: number;
    skipped: boolean;
    skip_reason: string | null;
    exercise: { slug: string; name: string } | null;
    sets: { set_number: number; reps: number | null; weight_kg: number | string | null; duration_seconds: number | null; rpe: number | string | null; completed: boolean; is_warmup: boolean }[];
  }[];
}

/** Map raw workout rows to snapshot workouts (completed working sets only, in order). */
export function mapWorkouts(rows: unknown[], timeZone: string): SnapshotWorkout[] {
  return (rows as RawWorkout[]).map((w) => ({
    date: isoDateInTz(new Date(w.started_at), timeZone),
    name: w.name,
    volumeKg: Math.round(Number(w.total_volume_kg) || 0),
    exercises: [...(w.workout_exercises ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((e) => ({
        slug: e.exercise?.slug ?? "unknown",
        name: e.exercise?.name ?? "Exercise",
        skipped: e.skipped,
        skipReason: e.skip_reason,
        sets: [...(e.sets ?? [])]
          .filter((s) => s.completed && !s.is_warmup)
          .sort((a, b) => a.set_number - b.set_number)
          .map((s) => ({
            reps: s.reps,
            weightKg: s.weight_kg == null ? null : Number(s.weight_kg),
            seconds: s.duration_seconds,
            rpe: s.rpe == null ? null : Number(s.rpe),
          })),
      })),
  }));
}

export interface ActiveProgramRef {
  userProgramId: string;
  programId: string;
  name: string;
  source: string;
  editable: boolean;
  currentWeek: number;
  currentDay: number;
  durationWeeks: number;
  daysPerWeek: number;
}

export async function getActiveProgramRef(supabase: SupabaseClient, userId: string): Promise<ActiveProgramRef | null> {
  const { data: up } = await supabase
    .from("user_programs")
    .select("id, current_week, current_day, program:training_programs(id, name, source, owner_id, duration_weeks, days_per_week)")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const p = up?.program as unknown as { id: string; name: string; source: string; owner_id: string | null; duration_weeks: number; days_per_week: number } | null;
  if (!up || !p) return null;
  return {
    userProgramId: up.id as string,
    programId: p.id,
    name: p.name,
    source: p.source,
    editable: p.owner_id === userId && p.source !== "curated",
    currentWeek: up.current_week as number,
    currentDay: up.current_day as number,
    durationWeeks: p.duration_weeks,
    daysPerWeek: p.days_per_week,
  };
}

/** One week of a program with its days and exercises. */
export async function loadProgramWeek(supabase: SupabaseClient, programId: string, weekNumber: number): Promise<{ id: string; focus: string; isDeload: boolean; days: (SnapshotProgramDay & { id: string; exerciseRows: { id: string; slug: string; position: number; rest: number }[] })[] } | null> {
  const { data: week } = await supabase
    .from("program_weeks")
    .select("id, focus, is_deload, program_days(id, day_number, name, focus, program_exercises(id, position, sets, reps, duration_seconds, rest_seconds, rpe, intensity, exercise:exercises(slug, name)))")
    .eq("program_id", programId)
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (!week) return null;
  const days = ((week.program_days ?? []) as unknown as {
    id: string;
    day_number: number;
    name: string;
    focus: string;
    program_exercises: { id: string; position: number; sets: number; reps: string | null; duration_seconds: number | null; rest_seconds: number; rpe: number | string | null; intensity: string | null; exercise: { slug: string; name: string } | null }[];
  }[])
    .sort((a, b) => a.day_number - b.day_number)
    .map((d) => {
      const ex = [...(d.program_exercises ?? [])].sort((a, b) => a.position - b.position);
      return {
        id: d.id,
        dayNumber: d.day_number,
        name: d.name,
        focus: d.focus,
        exercises: ex.map((e) => ({
          slug: e.exercise?.slug ?? "unknown",
          name: e.exercise?.name ?? "Exercise",
          sets: e.sets,
          reps: e.reps,
          seconds: e.duration_seconds,
          rpe: e.rpe == null ? null : Number(e.rpe),
          intensity: e.intensity,
        })),
        exerciseRows: ex.map((e) => ({ id: e.id, slug: e.exercise?.slug ?? "unknown", position: e.position, rest: e.rest_seconds })),
      };
    });
  return { id: week.id as string, focus: (week.focus as string) ?? "", isDeload: Boolean(week.is_deload), days };
}

export async function loadAthleteSnapshot(supabase: SupabaseClient, userId: string): Promise<AthleteSnapshot> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("unit_system, birth_year, height_cm, sex, faith_enabled, wellness_consent_at, timezone, step_goal")
    .eq("id", userId)
    .maybeSingle();
  const tz = (profile?.timezone as string) || "UTC";
  const today = isoDateInTz(new Date(), tz);
  const since120 = addDays(today, -120);
  const since7 = addDays(today, -6);

  const [answersRes, workoutsRes, datesRes, prsRes, weightsRes, goalsRes, foodRes, stepsRes, suppRes, readinessRes, challengeRes, programRef, budgetCtx] = await Promise.all([
    supabase
      .from("onboarding_answers")
      .select("primary_goal, experience, days_per_week, session_minutes, equipment, preferred_types, limitations, diet_type, goal_weight_kg, weekly_change_kg, activity_level")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("workout_sessions").select(WORKOUT_SELECT).eq("user_id", userId).eq("status", "completed").order("started_at", { ascending: false }).limit(10),
    supabase.from("workout_sessions").select("started_at").eq("user_id", userId).eq("status", "completed").gte("started_at", `${addDays(since120, -1)}T00:00:00Z`),
    supabase
      .from("personal_records")
      .select("value, achieved_at, exercise:exercises(name, slug)")
      .eq("user_id", userId)
      .eq("record_type", "estimated_1rm")
      .order("value", { ascending: false })
      .limit(8),
    supabase.from("weight_entries").select("recorded_on, weight_kg").eq("user_id", userId).gte("recorded_on", addDays(today, -90)).order("recorded_on"),
    supabase.from("nutrition_goals").select("calories, protein_g, carbs_g, fat_g, water_ml, is_estimate").eq("user_id", userId).maybeSingle(),
    supabase
      .from("meal_items")
      .select("calories, protein_g, carbs_g, fat_g, meal:meals!inner(eaten_on, status, is_template)")
      .eq("user_id", userId)
      .eq("meal.is_template", false)
      .eq("meal.status", "logged")
      .gte("meal.eaten_on", since7)
      .lte("meal.eaten_on", today),
    supabase.from("daily_steps").select("day, steps").eq("user_id", userId).gte("day", since7).order("day"),
    supabase.from("supplement_stack").select("supplement_id").eq("user_id", userId),
    supabase.from("recovery_checkins").select("checked_on, readiness_score").eq("user_id", userId).order("checked_on", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("challenge_enrollments")
      .select("challenge_slug, started_on, challenge_checkins(devotional_done, workout_done)")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("challenge_slug", CHALLENGE_SLUG)
      .maybeSingle(),
    getActiveProgramRef(supabase, userId),
    loadBudgetContext(supabase, userId).catch(() => null),
  ]);

  const a = answersRes.data;
  let program: SnapshotProgram | null = null;
  if (programRef) {
    const week = await loadProgramWeek(supabase, programRef.programId, programRef.currentWeek);
    program = {
      name: programRef.name,
      source: programRef.source,
      editable: programRef.editable,
      week: programRef.currentWeek,
      durationWeeks: programRef.durationWeeks,
      daysPerWeek: programRef.daysPerWeek,
      nextDay: programRef.currentDay,
      weekFocus: week?.focus || null,
      isDeload: week?.isDeload ?? false,
      days: (week?.days ?? []).map(({ dayNumber, name, focus, exercises }) => ({ dayNumber, name, focus, exercises })),
    };
  }

  // Food: today + last 7 days by day.
  const byDay = new Map<string, { calories: number; protein: number; carbs: number; fat: number; items: number }>();
  for (const i of (foodRes.data ?? []) as unknown as { calories: number; protein_g: number; carbs_g: number; fat_g: number; meal: { eaten_on: string } }[]) {
    const d = byDay.get(i.meal.eaten_on) ?? { calories: 0, protein: 0, carbs: 0, fat: 0, items: 0 };
    d.calories += Number(i.calories);
    d.protein += Number(i.protein_g);
    d.carbs += Number(i.carbs_g);
    d.fat += Number(i.fat_g);
    d.items += 1;
    byDay.set(i.meal.eaten_on, d);
  }
  const todayFood = byDay.get(today) ?? { calories: 0, protein: 0, carbs: 0, fat: 0, items: 0 };
  const challenge = challengeRes.data
    ? (() => {
        const checkins = (challengeRes.data.challenge_checkins ?? []) as { devotional_done: boolean; workout_done: boolean }[];
        return {
          name: CHALLENGE_NAME,
          day: challengeDayNumber(challengeRes.data.started_on as string, today),
          completedDays: checkins.filter((c) => c.devotional_done && c.workout_done).length,
          totalDays: CHALLENGE_DAYS,
        };
      })()
    : null;
  const goals = goalsRes.data;
  const b = budgetCtx?.budget ?? null;

  return {
    today,
    units: ((profile?.unit_system as UnitSystem) ?? "imperial") as UnitSystem,
    age: profile?.birth_year ? new Date().getUTCFullYear() - (profile.birth_year as number) : null,
    sex: (profile?.sex as string | null) ?? null,
    heightCm: profile?.height_cm ? Number(profile.height_cm) : null,
    goal: (a?.primary_goal as string) ?? null,
    experience: (a?.experience as string) ?? null,
    daysPerWeek: (a?.days_per_week as number) ?? null,
    sessionMinutes: (a?.session_minutes as number) ?? null,
    equipment: (a?.equipment as string[]) ?? [],
    preferredTypes: (a?.preferred_types as string[]) ?? [],
    dietType: (a?.diet_type as string) ?? null,
    limitations: a?.limitations && profile?.wellness_consent_at ? (a.limitations as string) : null,
    goalWeightKg: a?.goal_weight_kg == null ? null : Number(a.goal_weight_kg),
    weeklyChangeKg: a?.weekly_change_kg == null ? null : Number(a.weekly_change_kg),
    activity: (a?.activity_level as string) ?? null,
    budget: b ? { maintenance: b.maintenance, calories: b.calories, protein_g: b.protein_g, carbs_g: b.carbs_g, fat_g: b.fat_g, floored: b.floored } : null,
    targets: goals
      ? { calories: goals.calories as number, protein_g: goals.protein_g as number, carbs_g: goals.carbs_g as number, fat_g: goals.fat_g as number, water_ml: goals.water_ml as number, isEstimate: Boolean(goals.is_estimate) }
      : null,
    todayIntake: { calories: Math.round(todayFood.calories), protein: Math.round(todayFood.protein), carbs: Math.round(todayFood.carbs), fat: Math.round(todayFood.fat), items: todayFood.items },
    nutritionWeek: [...byDay.entries()]
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([date, d]) => ({ date, calories: Math.round(d.calories), protein: Math.round(d.protein) })),
    program,
    workouts: mapWorkouts(workoutsRes.data ?? [], tz),
    sessionDates: (datesRes.data ?? []).map((s) => isoDateInTz(new Date(s.started_at as string), tz)),
    prs: (prsRes.data ?? []).map((r) => {
      const ex = r.exercise as unknown as { name: string; slug: string } | null;
      return { name: ex?.name ?? "Exercise", slug: ex?.slug ?? "", e1rmKg: Number(r.value), achievedOn: (r.achieved_at as string).slice(0, 10) };
    }),
    weights: (weightsRes.data ?? []).map((w) => ({ date: w.recorded_on as string, kg: Number(w.weight_kg) })),
    steps: (stepsRes.data ?? []).map((s) => ({ date: s.day as string, steps: s.steps as number })),
    stepGoal: (profile?.step_goal as number) ?? null,
    supplements: (suppRes.data ?? []).map((s) => getSupplement(s.supplement_id as string)?.name ?? (s.supplement_id as string)),
    readiness: readinessRes.data ? { score: readinessRes.data.readiness_score as number, date: readinessRes.data.checked_on as string } : null,
    challenge,
    faithEnabled: Boolean(profile?.faith_enabled),
  };
}
