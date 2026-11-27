import "server-only";
import { addDays, isoDateInTz, startOfWeek } from "@/lib/domain/dates";
import { activeMinutes, buildWeeklyActivity, type WeeklyActivity, type WeeklyActivityItem } from "@/lib/domain/activity-week";
import { getServerSupabase } from "@/lib/supabase/server";

export type { WeeklyActivity, WeeklyActivityItem } from "@/lib/domain/activity-week";

/**
 * This week's (Monday–Sunday, user's time zone) completed sessions, for Home's weekly progress card.
 * Single data path for weekly activity: workouts plus runs and walks from `activities` (distance in metres).
 */
export async function getWeeklyActivity(userId: string, timezone: string): Promise<WeeklyActivity> {
  const supabase = await getServerSupabase();
  const now = new Date();
  const weekStart = startOfWeek(isoDateInTz(now, timezone));
  // Query a day either side so time-zone offsets can't drop a session at the week's edges.
  const from = `${addDays(weekStart, -1)}T00:00:00Z`;
  const to = `${addDays(weekStart, 8)}T00:00:00Z`;
  const [{ data, error }, { data: acts, error: actError }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, name, started_at, ended_at, paused_seconds")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("started_at", from)
      .lt("started_at", to)
      .order("started_at"),
    // Runs and walks (manual, treadmill, GPS); soft-deleted ones are excluded so totals recalculate.
    supabase
      .from("activities")
      .select("id, kind, source, started_at, distance_m, moving_s")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("started_at", from)
      .lt("started_at", to)
      .order("started_at"),
  ]);
  if (error) throw error;
  if (actError) throw actError;
  const workouts: WeeklyActivityItem[] = (data ?? []).map((w) => ({
    id: w.id as string,
    date: isoDateInTz(new Date(w.started_at as string), timezone),
    name: w.name as string,
    startedAt: w.started_at as string,
    minutes: activeMinutes(w.started_at as string, (w.ended_at as string | null) ?? null, Number(w.paused_seconds ?? 0)),
  }));
  const activityItems = (acts ?? []).map((a) => ({
    kind: a.kind as "run" | "walk",
    item: {
      id: a.id as string,
      date: isoDateInTz(new Date(a.started_at as string), timezone),
      name: `${a.kind === "run" ? "Run" : "Walk"}${a.source === "treadmill" ? " (treadmill)" : ""}`,
      startedAt: a.started_at as string,
      minutes: Math.round(Number(a.moving_s) / 60),
      distanceM: a.distance_m == null ? null : Number(a.distance_m),
    } satisfies WeeklyActivityItem,
  }));
  const runs = activityItems.filter((a) => a.kind === "run").map((a) => a.item);
  const walks = activityItems.filter((a) => a.kind === "walk").map((a) => a.item);
  return buildWeeklyActivity(now, timezone, { workouts, runs, walks });
}
