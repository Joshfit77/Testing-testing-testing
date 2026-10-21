import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bestsFromSets, detectNewRecords, totalVolume, type LoggedSet, type PersonalBest, type RecordType } from "@/lib/domain/strength";
import type { EditWorkoutInput, FinishWorkoutInput } from "@/lib/validation/schemas";
import { latestPerformances, type PreviousPerformance, type PreviousRow } from "@/lib/domain/previous-performance";
import { advanceProgram } from "./training";

export class WorkoutError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "conflict" | "invalid" | "db" = "db",
  ) {
    super(message);
    this.name = "WorkoutError";
  }
}

type ExerciseInput = FinishWorkoutInput["exercises"][number];

function toLogged(sets: ExerciseInput["sets"]): LoggedSet[] {
  return sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg, durationSeconds: s.durationSeconds, completed: s.completed, isWarmup: s.isWarmup }));
}

export function computeSessionVolume(exercises: ExerciseInput[]): number {
  return totalVolume(exercises.filter((e) => !e.skipped).flatMap((e) => toLogged(e.sets)));
}

/** Persist an in-progress snapshot so a workout can be restored on reload or another device. */
export async function saveDraftSnapshot(
  supabase: SupabaseClient,
  userId: string,
  input: { clientId: string; name: string; startedAt: string; userProgramId: string | null; programDayId: string | null; draft: Record<string, unknown> },
): Promise<void> {
  const { data: existing, error: selErr } = await supabase
    .from("workout_sessions")
    .select("id, status")
    .eq("user_id", userId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (selErr) throw new WorkoutError(selErr.message);
  if (existing && existing.status !== "in_progress") return; // never resurrect a finished/discarded workout
  if (existing) {
    const { error } = await supabase
      .from("workout_sessions")
      .update({ name: input.name, draft: input.draft })
      .eq("id", existing.id)
      .eq("status", "in_progress");
    if (error) throw new WorkoutError(error.message);
    return;
  }
  const { error } = await supabase.from("workout_sessions").insert({
    user_id: userId,
    client_id: input.clientId,
    name: input.name,
    started_at: input.startedAt,
    status: "in_progress",
    user_program_id: input.userProgramId,
    program_day_id: input.programDayId,
    draft: input.draft,
  });
  // A concurrent insert of the same client id is fine — the unique constraint protects us.
  if (error && error.code !== "23505") throw new WorkoutError(error.message);
}

export async function getServerDraft(supabase: SupabaseClient, userId: string): Promise<unknown | null> {
  const { data } = await supabase
    .from("workout_sessions")
    .select("draft")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .not("draft", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.draft ?? null;
}

export async function discardDraft(supabase: SupabaseClient, userId: string, clientId: string): Promise<void> {
  const { error } = await supabase.from("workout_sessions").delete().eq("user_id", userId).eq("client_id", clientId).eq("status", "in_progress");
  if (error) throw new WorkoutError(error.message);
}

async function insertExercises(supabase: SupabaseClient, userId: string, sessionId: string, exercises: ExerciseInput[]) {
  if (!exercises.length) return;
  const { data: rows, error } = await supabase
    .from("workout_exercises")
    .insert(
      exercises.map((e, position) => ({
        session_id: sessionId,
        user_id: userId,
        exercise_id: e.exerciseId,
        substituted_from_id: e.substitutedFromId,
        position,
        notes: e.notes || null,
        skipped: e.skipped,
        skip_reason: e.skipped ? (e.skipReason ?? "other") : null,
      })),
    )
    .select("id, position");
  if (error) throw new WorkoutError(error.message, error.code === "23503" ? "invalid" : "db");
  const idByPosition = new Map((rows ?? []).map((r) => [r.position as number, r.id as string]));
  const sets = exercises.flatMap((e, position) =>
    e.sets.map((s, i) => ({
      workout_exercise_id: idByPosition.get(position)!,
      user_id: userId,
      set_number: i + 1,
      reps: s.reps,
      weight_kg: s.weightKg,
      duration_seconds: s.durationSeconds,
      distance_m: s.distanceM ?? null,
      rpe: s.rpe,
      is_warmup: s.isWarmup,
      completed: s.completed,
    })),
  );
  if (sets.length) {
    const { error: setErr } = await supabase.from("workout_sets").insert(sets);
    if (setErr) throw new WorkoutError(setErr.message);
  }
}

async function currentBests(supabase: SupabaseClient, userId: string, exerciseIds: string[]): Promise<Map<string, PersonalBest[]>> {
  const out = new Map<string, PersonalBest[]>();
  if (!exerciseIds.length) return out;
  const { data, error } = await supabase.from("personal_records").select("exercise_id, record_type, value").eq("user_id", userId).in("exercise_id", exerciseIds);
  if (error) throw new WorkoutError(error.message);
  for (const r of data ?? []) {
    const list = out.get(r.exercise_id as string) ?? [];
    const existing = list.find((b) => b.recordType === r.record_type);
    if (!existing) list.push({ recordType: r.record_type as RecordType, value: Number(r.value) });
    else if (Number(r.value) > existing.value) existing.value = Number(r.value);
    out.set(r.exercise_id as string, list);
  }
  return out;
}

export interface NewRecord extends PersonalBest {
  exerciseId: string;
}

/**
 * Finish (complete) a workout. Idempotent per client id: retries after a network error
 * return the already-completed session instead of duplicating it.
 */
export async function finishWorkout(
  supabase: SupabaseClient,
  userId: string,
  input: FinishWorkoutInput,
): Promise<{ sessionId: string; volumeKg: number; records: NewRecord[]; alreadyCompleted: boolean }> {
  const { data: existing } = await supabase
    .from("workout_sessions")
    .select("id, status, total_volume_kg")
    .eq("user_id", userId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (existing?.status === "completed") {
    return { sessionId: existing.id as string, volumeKg: Number(existing.total_volume_kg), records: [], alreadyCompleted: true };
  }

  // Only link to a program the user actually owns a record for.
  let userProgramId = input.userProgramId;
  if (userProgramId) {
    const { data: up } = await supabase.from("user_programs").select("id").eq("id", userProgramId).eq("user_id", userId).maybeSingle();
    if (!up) userProgramId = null;
  }

  const volumeKg = computeSessionVolume(input.exercises);
  const row = {
    user_id: userId,
    client_id: input.clientId,
    name: input.name,
    status: "in_progress" as const,
    started_at: input.startedAt,
    user_program_id: userProgramId,
    program_day_id: input.programDayId,
    paused_seconds: input.pausedSeconds,
    notes: input.notes || null,
    total_volume_kg: volumeKg,
    draft: null,
  };

  let sessionId: string;
  if (existing) {
    sessionId = existing.id as string;
    const { error } = await supabase.from("workout_sessions").update(row).eq("id", sessionId);
    if (error) throw new WorkoutError(error.message);
    // Clear any rows from a previous partial attempt.
    await supabase.from("workout_exercises").delete().eq("session_id", sessionId);
  } else {
    const { data, error } = await supabase.from("workout_sessions").insert(row).select("id").single();
    if (error || !data) throw new WorkoutError(error?.message ?? "Insert failed", error?.code === "23503" ? "invalid" : "db");
    sessionId = data.id as string;
  }

  // If this throws, the session stays in progress so the client can retry safely.
  await insertExercises(supabase, userId, sessionId, input.exercises);

  // Personal records — computed from completed working sets.
  const active = input.exercises.filter((e) => !e.skipped);
  const exerciseIds = [...new Set(active.map((e) => e.exerciseId))];
  const prior = await currentBests(supabase, userId, exerciseIds);
  const records: NewRecord[] = [];
  for (const id of exerciseIds) {
    const sets = active.filter((e) => e.exerciseId === id).flatMap((e) => toLogged(e.sets));
    for (const r of detectNewRecords(prior.get(id) ?? [], bestsFromSets(sets))) records.push({ ...r, exerciseId: id });
  }
  if (records.length) {
    const { error } = await supabase.from("personal_records").insert(
      records.map((r) => ({
        user_id: userId,
        exercise_id: r.exerciseId,
        record_type: r.recordType,
        value: r.value,
        weight_kg: r.weightKg ?? null,
        reps: r.reps ?? null,
        session_id: sessionId,
        achieved_at: input.endedAt,
      })),
    );
    if (error) throw new WorkoutError(error.message);
  }

  const { error: doneErr } = await supabase
    .from("workout_sessions")
    .update({ status: "completed", ended_at: input.endedAt, draft: null })
    .eq("id", sessionId);
  if (doneErr) throw new WorkoutError(doneErr.message);

  if (userProgramId && input.programDayId) {
    await advanceProgram(supabase, userId, userProgramId, input.programDayId);
  }
  return { sessionId, volumeKg, records, alreadyCompleted: false };
}

/**
 * Rebuild the personal-record history for the given exercises from all completed sessions.
 * Used after editing or deleting a past workout so records stay truthful.
 */
export async function rebuildRecords(supabase: SupabaseClient, userId: string, exerciseIds: string[]): Promise<void> {
  if (!exerciseIds.length) return;
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("exercise_id, skipped, session:workout_sessions!inner(id, status, started_at, ended_at), sets:workout_sets(reps, weight_kg, duration_seconds, completed, is_warmup)")
    .eq("user_id", userId)
    .in("exercise_id", exerciseIds)
    .eq("session.status", "completed");
  if (error) throw new WorkoutError(error.message);

  type Row = {
    exercise_id: string;
    skipped: boolean;
    session: { id: string; started_at: string; ended_at: string | null };
    sets: { reps: number | null; weight_kg: number | null; duration_seconds: number | null; completed: boolean; is_warmup: boolean }[];
  };
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => !r.skipped);
  rows.sort((a, b) => a.session.started_at.localeCompare(b.session.started_at));

  const inserts: Record<string, unknown>[] = [];
  for (const exerciseId of exerciseIds) {
    let bests: PersonalBest[] = [];
    const bySession = new Map<string, Row[]>();
    for (const r of rows.filter((x) => x.exercise_id === exerciseId)) bySession.set(r.session.id, [...(bySession.get(r.session.id) ?? []), r]);
    for (const [sessionId, group] of bySession) {
      const sets: LoggedSet[] = group.flatMap((g) =>
        g.sets.map((s) => ({ reps: s.reps, weightKg: s.weight_kg == null ? null : Number(s.weight_kg), durationSeconds: s.duration_seconds, completed: s.completed, isWarmup: s.is_warmup })),
      );
      const fresh = detectNewRecords(bests, bestsFromSets(sets));
      for (const r of fresh) {
        inserts.push({
          user_id: userId,
          exercise_id: exerciseId,
          record_type: r.recordType,
          value: r.value,
          weight_kg: r.weightKg ?? null,
          reps: r.reps ?? null,
          session_id: sessionId,
          achieved_at: group[0]!.session.ended_at ?? group[0]!.session.started_at,
        });
        bests = [...bests.filter((b) => b.recordType !== r.recordType), r];
      }
    }
  }
  const { error: delErr } = await supabase.from("personal_records").delete().eq("user_id", userId).in("exercise_id", exerciseIds);
  if (delErr) throw new WorkoutError(delErr.message);
  if (inserts.length) {
    const { error: insErr } = await supabase.from("personal_records").insert(inserts);
    if (insErr) throw new WorkoutError(insErr.message);
  }
}

/** Replace the contents of a completed workout. */
export async function editWorkout(supabase: SupabaseClient, userId: string, input: EditWorkoutInput): Promise<{ volumeKg: number }> {
  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, status")
    .eq("id", input.sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!session) throw new WorkoutError("Workout not found", "not_found");
  if (session.status !== "completed") throw new WorkoutError("Only completed workouts can be edited", "conflict");

  const { data: before } = await supabase.from("workout_exercises").select("exercise_id").eq("session_id", input.sessionId);
  const affected = new Set<string>([...(before ?? []).map((b) => b.exercise_id as string), ...input.exercises.map((e) => e.exerciseId)]);

  const volumeKg = computeSessionVolume(input.exercises);
  const { error: delErr } = await supabase.from("workout_exercises").delete().eq("session_id", input.sessionId);
  if (delErr) throw new WorkoutError(delErr.message);
  await insertExercises(supabase, userId, input.sessionId, input.exercises);
  const { error } = await supabase
    .from("workout_sessions")
    .update({ name: input.name, notes: input.notes || null, total_volume_kg: volumeKg })
    .eq("id", input.sessionId);
  if (error) throw new WorkoutError(error.message);
  await rebuildRecords(supabase, userId, [...affected]);
  return { volumeKg };
}

export async function deleteWorkout(supabase: SupabaseClient, userId: string, sessionId: string): Promise<void> {
  const { data: exs } = await supabase.from("workout_exercises").select("exercise_id").eq("session_id", sessionId).eq("user_id", userId);
  const { error, count } = await supabase.from("workout_sessions").delete({ count: "exact" }).eq("id", sessionId).eq("user_id", userId);
  if (error) throw new WorkoutError(error.message);
  if (!count) throw new WorkoutError("Workout not found", "not_found");
  await rebuildRecords(supabase, userId, [...new Set((exs ?? []).map((e) => e.exercise_id as string))]);
}

export interface HistoryItem {
  id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  total_volume_kg: number;
  paused_seconds: number;
  exercise_count: number;
}

export async function listHistory(supabase: SupabaseClient, userId: string, limit = 30, before?: string): Promise<HistoryItem[]> {
  let q = supabase
    .from("workout_sessions")
    .select("id, name, started_at, ended_at, total_volume_kg, paused_seconds, workout_exercises(count)")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("started_at", before);
  const { data, error } = await q;
  if (error) throw new WorkoutError(error.message);
  return (data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    started_at: s.started_at as string,
    ended_at: s.ended_at as string | null,
    total_volume_kg: Number(s.total_volume_kg),
    paused_seconds: s.paused_seconds as number,
    exercise_count: (s.workout_exercises as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

/**
 * The most recent completed performance of each exercise ("Last time: 3×5 @ 225 lb"), for the logger.
 * Owner-scoped by user id (and RLS). Reads the newest rows only, so it stays cheap for long histories.
 */
export async function getPreviousPerformance(supabase: SupabaseClient, userId: string, exerciseIds: string[]): Promise<Record<string, PreviousPerformance>> {
  const ids = [...new Set(exerciseIds)].slice(0, 40);
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("exercise_id, skipped, session:workout_sessions!inner(id, started_at, status), sets:workout_sets(set_number, reps, weight_kg, duration_seconds, distance_m, is_warmup, completed)")
    .eq("user_id", userId)
    .in("exercise_id", ids)
    .eq("session.status", "completed")
    .order("created_at", { ascending: false })
    .limit(Math.min(400, ids.length * 12));
  if (error) throw new WorkoutError(error.message);
  return Object.fromEntries(latestPerformances((data ?? []) as unknown as PreviousRow[]));
}
