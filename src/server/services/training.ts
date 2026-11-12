import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DayExercise {
  id: string;
  position: number;
  sets: number;
  reps: string | null;
  duration_seconds: number | null;
  rest_seconds: number;
  intensity: string | null;
  rpe: number | null;
  notes: string | null;
  exercise: { id: string; slug: string; name: string; is_timed: boolean; primary_muscles: string[] };
}

export interface ProgramDayDetail {
  id: string;
  day_number: number;
  name: string;
  focus: string;
  estimated_minutes: number | null;
  warmup: string[];
  cooldown: string[];
  exercises: DayExercise[];
}

export interface ActiveProgram {
  userProgramId: string;
  programId: string;
  programSlug: string;
  programName: string;
  durationWeeks: number;
  daysPerWeek: number;
  currentWeek: number;
  currentDay: number;
  weekFocus: string | null;
  isDeload: boolean;
  today: ProgramDayDetail | null;
}

export interface ProgramDayRef {
  id: string;
  dayNumber: number;
  weekId: string;
  weekNumber: number;
  isDeload: boolean;
}

/**
 * A program's days (optionally only some weeks), looked up week → day through their indexes. Fetch the exercises of
 * those days with `programExercisesOnDays`. Filtering program_exercises through an embedded `program_days!inner` /
 * `program_weeks!inner` join instead makes Postgres check the row policy on every exercise of every program, which
 * takes seconds once members have their own custom programs.
 */
export async function programDays(
  supabase: SupabaseClient,
  programId: string,
  weeks: { week?: number; fromWeek?: number; excludeDeload?: boolean } = {},
): Promise<ProgramDayRef[]> {
  let q = supabase.from("program_weeks").select("id, week_number, is_deload").eq("program_id", programId);
  if (weeks.week != null) q = q.eq("week_number", weeks.week);
  if (weeks.fromWeek != null) q = q.gte("week_number", weeks.fromWeek);
  if (weeks.excludeDeload) q = q.eq("is_deload", false);
  const { data: ws, error } = await q;
  if (error) throw error;
  if (!ws?.length) return [];
  const byId = new Map(ws.map((w) => [w.id as string, { weekNumber: w.week_number as number, isDeload: Boolean(w.is_deload) }]));
  const { data: ds, error: dErr } = await supabase.from("program_days").select("id, day_number, week_id").in("week_id", [...byId.keys()]);
  if (dErr) throw dErr;
  return (ds ?? [])
    .map((d) => ({ id: d.id as string, dayNumber: d.day_number as number, weekId: d.week_id as string, ...byId.get(d.week_id as string)! }))
    .sort((a, b) => a.weekNumber - b.weekNumber || a.dayNumber - b.dayNumber);
}

/** Rows of program_exercises on these days (in batches, to keep each request URL short), each with its day. */
export async function programExercisesOnDays<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  days: ProgramDayRef[],
  columns: string,
  opts: { exerciseId?: string } = {},
): Promise<(T & { day: ProgramDayRef })[]> {
  const byId = new Map(days.map((d) => [d.id, d]));
  const ids = [...byId.keys()];
  const out: (T & { day: ProgramDayRef })[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    let q = supabase.from("program_exercises").select(`${columns}, day_id`).in("day_id", ids.slice(i, i + 100));
    if (opts.exerciseId) q = q.eq("exercise_id", opts.exerciseId);
    const { data, error } = await q;
    if (error) throw error;
    for (const r of (data ?? []) as unknown as (T & { day_id: string })[]) out.push({ ...r, day: byId.get(r.day_id)! });
  }
  return out;
}

export async function getProgramDay(supabase: SupabaseClient, dayId: string): Promise<ProgramDayDetail | null> {
  const { data: day } = await supabase
    .from("program_days")
    .select("id, day_number, name, focus, estimated_minutes, warmup, cooldown")
    .eq("id", dayId)
    .maybeSingle();
  if (!day) return null;
  const { data: exercises } = await supabase
    .from("program_exercises")
    .select("id, position, sets, reps, duration_seconds, rest_seconds, intensity, rpe, notes, exercise:exercises(id, slug, name, is_timed, primary_muscles)")
    .eq("day_id", dayId)
    .order("position");
  return { ...(day as Omit<ProgramDayDetail, "exercises">), exercises: (exercises ?? []) as unknown as DayExercise[] };
}

export async function getActiveProgram(supabase: SupabaseClient, userId: string): Promise<ActiveProgram | null> {
  const { data: up } = await supabase
    .from("user_programs")
    .select("id, program_id, current_week, current_day, program:training_programs(id, slug, name, duration_weeks, days_per_week)")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!up) return null;
  const program = up.program as unknown as { id: string; slug: string; name: string; duration_weeks: number; days_per_week: number } | null;
  if (!program) return null;

  const { data: week } = await supabase
    .from("program_weeks")
    .select("id, focus, is_deload")
    .eq("program_id", program.id)
    .eq("week_number", up.current_week)
    .maybeSingle();
  let today: ProgramDayDetail | null = null;
  if (week) {
    const { data: day } = await supabase.from("program_days").select("id").eq("week_id", week.id).eq("day_number", up.current_day).maybeSingle();
    if (day) today = await getProgramDay(supabase, day.id as string);
  }
  return {
    userProgramId: up.id as string,
    programId: program.id,
    programSlug: program.slug,
    programName: program.name,
    durationWeeks: program.duration_weeks,
    daysPerWeek: program.days_per_week,
    currentWeek: up.current_week as number,
    currentDay: up.current_day as number,
    weekFocus: (week?.focus as string) ?? null,
    isDeload: Boolean(week?.is_deload),
    today,
  };
}

/** Move a user's program pointer to the next session after completing a program day. */
export async function advanceProgram(supabase: SupabaseClient, userId: string, userProgramId: string, completedDayId: string) {
  const { data: up } = await supabase
    .from("user_programs")
    .select("id, current_week, current_day, program:training_programs(duration_weeks, days_per_week)")
    .eq("id", userProgramId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!up) return;
  const { data: day } = await supabase.from("program_days").select("day_number, week:program_weeks(week_number)").eq("id", completedDayId).maybeSingle();
  const program = up.program as unknown as { duration_weeks: number; days_per_week: number };
  const dayWeek = (day?.week as unknown as { week_number: number } | null)?.week_number;
  // Only advance when the completed day is the one the pointer is on.
  if (!day || dayWeek !== up.current_week || day.day_number !== up.current_day) return;
  let week = up.current_week as number;
  let next = (up.current_day as number) + 1;
  if (next > program.days_per_week) {
    next = 1;
    week += 1;
  }
  if (week > program.duration_weeks) {
    await supabase.from("user_programs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", userProgramId);
    return;
  }
  await supabase.from("user_programs").update({ current_week: week, current_day: next }).eq("id", userProgramId);
}
