import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHabitProgram } from "@/data/habit-programs";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { activitiesForDay, dateOfDay, habitDayNumber, habitProgress, type CheckinRow, type HabitProgram } from "@/lib/domain/habit-programs";

export interface HabitEnrollment {
  id: string;
  program_slug: string;
  started_on: string;
  status: "active" | "completed" | "stopped";
  goals: Record<string, number>;
  completed_at: string | null;
  stopped_at: string | null;
  created_at: string;
}

const ENROLLMENT_COLUMNS = "id, program_slug, started_on, status, goals, completed_at, stopped_at, created_at";

export async function listHabitEnrollments(supabase: SupabaseClient, userId: string): Promise<HabitEnrollment[]> {
  const { data, error } = await supabase.from("habit_program_enrollments").select(ENROLLMENT_COLUMNS).eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HabitEnrollment[];
}

/** The member's active enrollment in a program, else their most recent one. */
export async function getHabitEnrollment(supabase: SupabaseClient, userId: string, slug: string): Promise<HabitEnrollment | null> {
  const { data, error } = await supabase
    .from("habit_program_enrollments")
    .select(ENROLLMENT_COLUMNS)
    .eq("user_id", userId)
    .eq("program_slug", slug)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  const rows = (data ?? []) as HabitEnrollment[];
  return rows.find((r) => r.status === "active") ?? rows[0] ?? null;
}

export async function listHabitCheckins(supabase: SupabaseClient, userId: string, enrollmentId: string): Promise<(CheckinRow & { answer: string | null })[]> {
  const { data, error } = await supabase.from("habit_program_checkins").select("day_number, activity_key, answer").eq("user_id", userId).eq("enrollment_id", enrollmentId);
  if (error) throw error;
  return (data ?? []) as (CheckinRow & { answer: string | null })[];
}

/**
 * Activities the app can see were done without a tick: a completed workout on that date counts for "workout", and any
 * food logged that date counts for "track_food". Returned as virtual check-ins (never written to the table).
 */
export async function autoCheckins(supabase: SupabaseClient, userId: string, program: HabitProgram, startedOn: string, upToDay: number, tz: string): Promise<CheckinRow[]> {
  if (upToDay < 1) return [];
  const from = startedOn;
  const to = dateOfDay(startedOn, upToDay);
  const [workouts, meals] = await Promise.all([
    supabase.from("workout_sessions").select("started_at").eq("user_id", userId).eq("status", "completed").gte("started_at", `${addDays(from, -1)}T00:00:00Z`).lt("started_at", `${addDays(to, 2)}T00:00:00Z`),
    supabase.from("meals").select("eaten_on").eq("user_id", userId).eq("status", "logged").eq("is_template", false).gte("eaten_on", from).lte("eaten_on", to),
  ]);
  const workoutDays = new Set((workouts.data ?? []).map((w) => isoDateInTz(new Date(w.started_at as string), tz)));
  const foodDays = new Set((meals.data ?? []).map((m) => m.eaten_on as string));
  const out: CheckinRow[] = [];
  for (let d = 1; d <= upToDay; d++) {
    const date = dateOfDay(startedOn, d);
    const { daily, weekly } = activitiesForDay(program, d);
    for (const a of [...daily, ...weekly]) {
      if ((a.kind === "workout" && workoutDays.has(date)) || (a.kind === "track_food" && foodDays.has(date))) out.push({ day_number: d, activity_key: a.key });
    }
  }
  return out;
}

export interface HabitView {
  program: HabitProgram;
  enrollment: HabitEnrollment;
  today: string;
  day: number;
  manual: (CheckinRow & { answer: string | null })[];
  auto: CheckinRow[];
  progress: ReturnType<typeof habitProgress>;
}

export async function loadHabitView(supabase: SupabaseClient, userId: string, enrollment: HabitEnrollment, tz: string): Promise<HabitView | null> {
  const program = getHabitProgram(enrollment.program_slug);
  if (!program) return null;
  const today = isoDateInTz(new Date(), tz);
  const day = Math.min(habitDayNumber(enrollment.started_on, today), program.days);
  const [manual, auto] = await Promise.all([listHabitCheckins(supabase, userId, enrollment.id), autoCheckins(supabase, userId, program, enrollment.started_on, day, tz)]);
  const progress = habitProgress(program, enrollment.started_on, today, [...manual, ...auto]);
  return { program, enrollment, today, day, manual, auto, progress };
}

