import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildExerciseHistory, type ExerciseHistory, type HistoryRow } from "@/lib/domain/exercise-history";

/** One member's completed sessions of one exercise (most recent 200), for the exercise and history pages. */
export async function loadExerciseHistory(supabase: SupabaseClient, userId: string, exerciseId: string): Promise<ExerciseHistory> {
  const { data } = await supabase
    .from("workout_exercises")
    .select("skipped, session:workout_sessions!inner(id, name, started_at, status), sets:workout_sets(set_number, reps, weight_kg, duration_seconds, distance_m, is_warmup, completed)")
    .eq("user_id", userId)
    .eq("exercise_id", exerciseId)
    .eq("session.status", "completed")
    .order("created_at", { ascending: false })
    .limit(200);
  return buildExerciseHistory((data ?? []) as unknown as HistoryRow[]);
}
