import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHALLENGE_SLUG } from "@/data/devotionals";
import { challengeDayNumber, type ChallengeCheckin } from "@/lib/domain/challenge";
import { addDays, isoDateInTz } from "@/lib/domain/dates";

export interface ChallengeEnrollment {
  id: string;
  startedOn: string;
  status: "active" | "completed" | "abandoned";
  completedAt: string | null;
}

export interface ChallengeState {
  today: string;
  active: ChallengeEnrollment | null;
  /** Most recent completed enrollment (for a celebration / "completed" badge). */
  lastCompleted: ChallengeEnrollment | null;
  currentDay: number | null;
  checkins: ChallengeCheckin[];
  /** Calendar dates (user's time zone) since the start of the active enrollment with a completed workout. */
  workoutDates: string[];
}

function toEnrollment(row: Record<string, unknown> | null | undefined): ChallengeEnrollment | null {
  if (!row) return null;
  return {
    id: row.id as string,
    startedOn: row.started_on as string,
    status: row.status as ChallengeEnrollment["status"],
    completedAt: (row.completed_at as string | null) ?? null,
  };
}

export async function getActiveEnrollment(supabase: SupabaseClient, userId: string): Promise<ChallengeEnrollment | null> {
  const { data } = await supabase
    .from("challenge_enrollments")
    .select("id, started_on, status, completed_at")
    .eq("user_id", userId)
    .eq("challenge_slug", CHALLENGE_SLUG)
    .eq("status", "active")
    .maybeSingle();
  return toEnrollment(data);
}

export async function getChallengeState(supabase: SupabaseClient, userId: string, timezone: string): Promise<ChallengeState> {
  const today = isoDateInTz(new Date(), timezone);
  const [active, completedRes] = await Promise.all([
    getActiveEnrollment(supabase, userId),
    supabase
      .from("challenge_enrollments")
      .select("id, started_on, status, completed_at")
      .eq("user_id", userId)
      .eq("challenge_slug", CHALLENGE_SLUG)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const lastCompleted = toEnrollment(completedRes.data);
  if (!active) return { today, active: null, lastCompleted, currentDay: null, checkins: [], workoutDates: [] };

  const [checkinsRes, sessionsRes] = await Promise.all([
    supabase
      .from("challenge_checkins")
      .select("day_number, devotional_done, workout_done, note")
      .eq("enrollment_id", active.id)
      .eq("user_id", userId)
      .order("day_number"),
    // One day of slack either side of the start so time-zone conversion can't drop a session.
    supabase
      .from("workout_sessions")
      .select("started_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("started_at", `${addDays(active.startedOn, -1)}T00:00:00Z`)
      .order("started_at")
      .limit(500),
  ]);
  const workoutDates = Array.from(
    new Set((sessionsRes.data ?? []).map((s) => isoDateInTz(new Date(s.started_at as string), timezone)).filter((d) => d >= active.startedOn)),
  );
  return {
    today,
    active,
    lastCompleted,
    currentDay: challengeDayNumber(active.startedOn, today),
    checkins: (checkinsRes.data ?? []).map((c) => ({
      day_number: c.day_number as number,
      devotional_done: Boolean(c.devotional_done),
      workout_done: Boolean(c.workout_done),
      note: (c.note as string | null) ?? null,
    })),
    workoutDates,
  };
}
