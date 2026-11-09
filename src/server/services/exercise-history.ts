import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildExerciseHistory, type ExerciseHistory, type HistoryRow } from "@/lib/domain/exercise-history";
import type { MilestoneActivity } from "@/lib/domain/exercise-milestones";

/** PostgREST returns at most this many rows per request (supabase/config.toml max_rows), so every list is paged. */
const PAGE = 1000;

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

const HISTORY_SELECT =
  "id, exercise_id, skipped, session:workout_sessions!inner(id, name, started_at, status), sets:workout_sets(set_number, reps, weight_kg, duration_seconds, distance_m, is_warmup, completed)";

type Row = HistoryRow & { exercise_id: string };

/**
 * Every completed session of the given exercises for one member, all of it (paged, never capped), so an all-time
 * best from years ago is never forgotten. Ordered newest first; the id breaks ties so pages never skip or repeat.
 */
export async function loadExerciseHistories(supabase: SupabaseClient, userId: string, exerciseIds: string[]): Promise<Map<string, ExerciseHistory>> {
  const out = new Map<string, ExerciseHistory>();
  if (!exerciseIds.length) return out;
  const rows = await pageAll<Row>((from, to) =>
    supabase
      .from("workout_exercises")
      .select(HISTORY_SELECT)
      .eq("user_id", userId)
      .in("exercise_id", exerciseIds)
      .eq("session.status", "completed")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: unknown }>,
  );
  for (const id of exerciseIds) out.set(id, buildExerciseHistory(rows.filter((r) => r.exercise_id === id)));
  return out;
}

/** One member's completed sessions of one exercise, for the exercise and history pages. */
export async function loadExerciseHistory(supabase: SupabaseClient, userId: string, exerciseId: string): Promise<ExerciseHistory> {
  return (await loadExerciseHistories(supabase, userId, [exerciseId])).get(exerciseId)!;
}

/**
 * Every live run and walk with a distance (GPS, treadmill or entered by hand; Free and Pro alike), summary columns
 * only, for the distance milestones. Soft-deleted activities are left out, so deleting one moves the milestone back.
 */
export async function loadMilestoneActivities(supabase: SupabaseClient, userId: string, kind?: "run" | "walk"): Promise<MilestoneActivity[]> {
  const rows = await pageAll<{ id: string; kind: "run" | "walk"; source: "gps" | "treadmill" | "manual"; distance_m: number | string | null; started_at: string }>((from, to) => {
    let q = supabase.from("activities").select("id, kind, source, distance_m, started_at").eq("user_id", userId).is("deleted_at", null).not("distance_m", "is", null);
    if (kind) q = q.eq("kind", kind);
    return q.order("started_at", { ascending: true }).order("id", { ascending: true }).range(from, to);
  });
  return rows.map((r) => ({ kind: r.kind, source: r.source, distanceM: r.distance_m == null ? null : Number(r.distance_m), startedAt: r.started_at }));
}
