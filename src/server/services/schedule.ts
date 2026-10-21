import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { planSchedule, type PendingSession, type PlannedSession } from "@/lib/domain/training-schedule";

/** How many pending sessions get dates (enough for ~2 months of a 7-day program). */
export const SCHEDULE_HORIZON_SESSIONS = 56;

export interface ProgramSchedule {
  userProgramId: string;
  programId: string;
  programName: string;
  daysPerWeek: number;
  today: string;
  planned: PlannedSession[];
  /** program_day_id → date, as stored (including stale entries for completed days, which planSchedule ignores). */
  overrides: Record<string, string>;
}

/**
 * Dated schedule for the user's active program: pending sessions from the program pointer onwards,
 * the user's reschedules applied. Null when no program is active (or it has no sessions left).
 */
export async function loadProgramSchedule(supabase: SupabaseClient, userId: string, timezone: string): Promise<ProgramSchedule | null> {
  const today = isoDateInTz(new Date(), timezone);
  const { data: up } = await supabase
    .from("user_programs")
    .select("id, current_week, current_day, program:training_programs(id, name, days_per_week, duration_weeks)")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const program = up?.program as unknown as { id: string; name: string; days_per_week: number; duration_weeks: number } | null;
  if (!up || !program) return null;
  const currentWeek = up.current_week as number;
  const currentDay = up.current_day as number;

  const [weeksRes, overridesRes, doneRes] = await Promise.all([
    supabase
      .from("program_weeks")
      .select("week_number, program_days(id, day_number, name, estimated_minutes)")
      .eq("program_id", program.id)
      .gte("week_number", currentWeek)
      .order("week_number"),
    supabase.from("planned_session_overrides").select("program_day_id, planned_date").eq("user_id", userId).eq("user_program_id", up.id),
    supabase
      .from("workout_sessions")
      .select("started_at")
      .eq("user_id", userId)
      .eq("user_program_id", up.id)
      .eq("status", "completed")
      .gte("started_at", `${addDays(today, -1)}T00:00:00Z`),
  ]);

  const pending: PendingSession[] = ((weeksRes.data ?? []) as unknown as { week_number: number; program_days: { id: string; day_number: number; name: string; estimated_minutes: number | null }[] }[])
    .flatMap((w) =>
      [...(w.program_days ?? [])]
        .sort((a, b) => a.day_number - b.day_number)
        .filter((d) => w.week_number > currentWeek || d.day_number >= currentDay)
        .map((d) => ({ dayId: d.id, week: w.week_number, day: d.day_number, name: d.name, minutes: d.estimated_minutes })),
    )
    .slice(0, SCHEDULE_HORIZON_SESSIONS);
  const overrides: Record<string, string> = {};
  for (const o of overridesRes.data ?? []) overrides[o.program_day_id as string] = o.planned_date as string;
  const completedToday = (doneRes.data ?? []).some((s) => isoDateInTz(new Date(s.started_at as string), timezone) === today);

  return {
    userProgramId: up.id as string,
    programId: program.id,
    programName: program.name,
    daysPerWeek: program.days_per_week,
    today,
    planned: planSchedule({ pending, overrides, today, daysPerWeek: program.days_per_week, completedToday }),
    overrides,
  };
}
