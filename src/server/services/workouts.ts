import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bestsFromSets, detectNewRecords, totalVolume, type LoggedSet, type PersonalBest, type RecordType } from "@/lib/domain/strength";
import type { EditWorkoutInput, FinishWorkoutInput } from "@/lib/validation/schemas";
import { preferSameSession, type PreviousPerformance, type PreviousRow, type SessionSlot } from "@/lib/domain/previous-performance";
import { mergeFinishedExercises } from "@/lib/domain/workout-merge";
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

/**
 * Finish was tapped on a copy older than the account's (another device or tab saved this workout since): nothing was
 * saved; the device combines its copy with `draft` (revision `rev`) and finishes again.
 */
export class DraftConflictError extends Error {
  constructor(
    public rev: number,
    public draft: unknown,
  ) {
    super("This workout was changed on another device.");
    this.name = "DraftConflictError";
  }
}

type ExerciseInput = FinishWorkoutInput["exercises"][number];

function toLogged(sets: ExerciseInput["sets"]): LoggedSet[] {
  return sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg, durationSeconds: s.durationSeconds, completed: s.completed, isWarmup: s.isWarmup }));
}

export function computeSessionVolume(exercises: ExerciseInput[]): number {
  return totalVolume(exercises.filter((e) => !e.skipped).flatMap((e) => toLogged(e.sets)));
}

/**
 * What happened to a backup of an unfinished workout (F-29/F-30). Only "saved" means the account now has this copy.
 *  - saved: stored as revision `rev`.
 *  - conflict: the account has a different copy (another device or tab saved since this one last looked, or this
 *    device never saw the account's copy): nothing was stored; `draft` is the account's copy at revision `rev`, which
 *    the device combines with its own (lib/domain/workout-merge.ts) and sends again on that revision.
 *  - finished: the workout was finished (on another device); a backup never brings it back. The device keeps its copy
 *    and its Finish adds any sets the saved workout lacks.
 *  - discarded: the workout had been backed up before and is gone now (discarded on another device); it is not
 *    created again.
 */
export type DraftSaveResult =
  | { status: "saved"; rev: number }
  | { status: "conflict"; rev: number; draft: unknown }
  | { status: "finished" }
  | { status: "discarded" };

export interface DraftSnapshotInput {
  clientId: string;
  name: string;
  startedAt: string;
  userProgramId: string | null;
  programDayId: string | null;
  draft: Record<string, unknown>;
  /** The revision this copy was built on: null for a workout this device has never had confirmed on the account. */
  baseRev?: number | null;
}

/** Persist an in-progress snapshot so a workout can be restored on reload or another device, never over a newer copy. */
export async function saveDraftSnapshot(supabase: SupabaseClient, userId: string, input: DraftSnapshotInput): Promise<DraftSaveResult> {
  const current = async () => {
    const { data, error } = await supabase
      .from("workout_sessions")
      .select("id, status, draft, draft_rev")
      .eq("user_id", userId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (error) throw new WorkoutError(error.message);
    return data as { id: string; status: string; draft: unknown; draft_rev: number } | null;
  };
  const answer = (row: { status: string; draft: unknown; draft_rev: number }): DraftSaveResult =>
    row.status !== "in_progress" ? { status: "finished" } : { status: "conflict", rev: row.draft_rev, draft: row.draft };

  const existing = await current();
  if (!existing) {
    // Backed up before (it has a revision) and gone now: discarded elsewhere. Never created again.
    if (input.baseRev) return { status: "discarded" };
    const { error } = await supabase.from("workout_sessions").insert({
      user_id: userId,
      client_id: input.clientId,
      name: input.name,
      started_at: input.startedAt,
      status: "in_progress",
      user_program_id: input.userProgramId,
      program_day_id: input.programDayId,
      draft: input.draft,
      draft_rev: 1,
    });
    if (!error) return { status: "saved", rev: 1 };
    if (error.code !== "23505") throw new WorkoutError(error.message);
    // Another tab or device created it a moment earlier: its copy is the account's now.
    const raced = await current();
    if (!raced) throw new WorkoutError("The workout could not be saved. Try again.");
    return answer(raced);
  }
  if (existing.status !== "in_progress") return { status: "finished" }; // never resurrect a finished workout
  if (input.baseRev === undefined || input.baseRev === null || input.baseRev !== existing.draft_rev) return answer(existing);
  const { data: stored, error } = await supabase
    .from("workout_sessions")
    .update({ name: input.name, draft: input.draft, draft_rev: input.baseRev + 1 })
    .eq("id", existing.id)
    .eq("status", "in_progress")
    .eq("draft_rev", input.baseRev)
    .select("id");
  if (error) throw new WorkoutError(error.message);
  if (stored?.length) return { status: "saved", rev: input.baseRev + 1 };
  // Changed (or finished) between the read and the write: report what is there now.
  const now = await current();
  return now ? answer(now) : { status: "discarded" };
}

/** One unfinished workout as the account holds it. */
export interface ServerDraftRow {
  draft: unknown;
  rev: number;
}

/**
 * How many unfinished workouts the logger offers at once. Several only arise from several devices (on one device a new
 * workout replaces the old only when the member discards it), so this is a cap on the page's size, not a rule: was 5,
 * which hid a sixth unfinished workout from the chooser (external review 2026-11-23). Nothing beyond it is deleted;
 * the oldest are offered as soon as fewer are left.
 */
export const SERVER_DRAFTS_SHOWN = 25;

/** Every unfinished workout on the account (up to SERVER_DRAFTS_SHOWN), most recently changed first. */
export async function getServerDrafts(supabase: SupabaseClient, userId: string): Promise<ServerDraftRow[]> {
  const { data } = await supabase
    .from("workout_sessions")
    .select("draft, draft_rev")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .not("draft", "is", null)
    .order("updated_at", { ascending: false })
    .limit(SERVER_DRAFTS_SHOWN);
  return ((data ?? []) as { draft: unknown; draft_rev: number }[]).map((r) => ({ draft: r.draft, rev: Number(r.draft_rev) || 0 }));
}

/** The most recently changed unfinished workout (kept for callers that need only one). */
export async function getServerDraft(supabase: SupabaseClient, userId: string): Promise<unknown | null> {
  return (await getServerDrafts(supabase, userId))[0]?.draft ?? null;
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
      is_drop: Boolean(s.isDrop),
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
  /** The first value ever logged for this exercise and record type: a baseline, not an improvement. */
  first: boolean;
}

/**
 * The personal records a finished session set, as finishWorkout first reported them (`first`: no earlier record of
 * that type for the exercise, so it was a baseline rather than an improvement).
 */
export async function recordsOfSession(supabase: SupabaseClient, userId: string, sessionId: string): Promise<NewRecord[]> {
  const { data } = await supabase
    .from("personal_records")
    .select("exercise_id, record_type, value, weight_kg, reps, achieved_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId);
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: others } = await supabase
    .from("personal_records")
    .select("exercise_id, record_type, achieved_at")
    .eq("user_id", userId)
    .in("exercise_id", [...new Set(rows.map((r) => r.exercise_id as string))])
    .or(`session_id.is.null,session_id.neq.${sessionId}`);
  return rows.map((r) => ({
    exerciseId: r.exercise_id as string,
    recordType: r.record_type as NewRecord["recordType"],
    value: Number(r.value),
    weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
    reps: r.reps == null ? null : Number(r.reps),
    first: !(others ?? []).some((o) => o.exercise_id === r.exercise_id && o.record_type === r.record_type && String(o.achieved_at) <= String(r.achieved_at)),
  }));
}

/** Names a workout gets when the member doesn't name it: too generic to compare "last time" against. */
const GENERIC_NAME = /^\s*((morning|afternoon|evening|night|quick|empty|new)\s+)?workout\s*$/i;

export interface PreviousSession {
  startedAt: string;
  volumeKg: number;
}

/**
 * The member's previous completed session of the same kind, for a "compared with last time" line: the same program
 * day, or (outside a program) a workout with the same, non-generic name. Null when there isn't one.
 */
export async function previousComparableSession(
  supabase: SupabaseClient,
  userId: string,
  s: { sessionId: string; startedAt: string; programDayId: string | null; name: string },
): Promise<PreviousSession | null> {
  if (!s.programDayId && GENERIC_NAME.test(s.name)) return null;
  let q = supabase
    .from("workout_sessions")
    .select("started_at, total_volume_kg")
    .eq("user_id", userId)
    .eq("status", "completed")
    .neq("id", s.sessionId)
    .lt("started_at", s.startedAt);
  q = s.programDayId ? q.eq("program_day_id", s.programDayId) : q.eq("name", s.name.trim());
  const { data } = await q.order("started_at", { ascending: false }).limit(1).maybeSingle();
  return data ? { startedAt: data.started_at as string, volumeKg: Number(data.total_volume_kg ?? 0) } : null;
}

/**
 * Finish (complete) a workout. Idempotent per client id: retries after a network error
 * return the already-completed session instead of duplicating it.
 */
export async function finishWorkout(
  supabase: SupabaseClient,
  userId: string,
  input: FinishWorkoutInput,
): Promise<{ sessionId: string; volumeKg: number; records: NewRecord[]; alreadyCompleted: boolean; addedSets: number; differingSets?: number }> {
  const { data: existing } = await supabase
    .from("workout_sessions")
    .select("id, status, total_volume_kg, user_program_id, program_day_id, draft, draft_rev")
    .eq("user_id", userId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  // Another device or tab saved this unfinished workout since this device last looked: finishing this copy would drop
  // that device's sets. The device combines the two copies first and finishes again (clients from before revisions
  // send no baseRev and are not checked).
  if (existing?.status === "in_progress" && input.baseRev !== undefined && existing.draft && (input.baseRev ?? -1) !== Number(existing.draft_rev)) {
    throw new DraftConflictError(Number(existing.draft_rev), existing.draft);
  }
  if (existing?.status === "completed") {
    // A retry after the first response was lost (gym Wi-Fi).
    // Saving the workout and moving the program on are separate writes. If the first attempt saved the workout but
    // never reached the second, the program stayed on the day just done and offered it again. advanceProgram only
    // moves a pointer that is still on that day, so repeating it here is safe (no double advance). Best-effort, from
    // what the saved session says (not from the retry's payload). First, so a failure below never skips it.
    if (existing.user_program_id && existing.program_day_id) {
      await advanceProgram(supabase, userId, existing.user_program_id as string, existing.program_day_id as string).catch(() => undefined);
    }
    // If the member logged more sets before retrying, the retry carries them: store them (as an edit of the saved
    // workout) instead of answering with the first save.
    const later = await applyLaterSets(supabase, userId, existing.id as string, input);
    // Show the same records the first attempt saved (or, after the later sets, the records as they now stand).
    const records = await recordsOfSession(supabase, userId, existing.id as string).catch(() => []);
    return { sessionId: existing.id as string, volumeKg: later.volumeKg ?? Number(existing.total_volume_kg), records, alreadyCompleted: true, addedSets: later.added, differingSets: later.differing };
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

  // Claim the session before writing: two finishes of the same workout at once (a double tap, a retry while the
  // first request is still running) would otherwise both clear and re-write the exercises and save every set twice.
  // Only the request that wins the claim writes; the others wait for it and report the workout as already saved.
  const claim = crypto.randomUUID();
  const claimedRow = { ...row, finish_claim: claim, finish_claimed_at: new Date().toISOString() };
  let sessionId: string;
  if (existing) {
    sessionId = existing.id as string;
    const staleBefore = new Date(Date.now() - FINISH_CLAIM_TTL_MS).toISOString();
    const { data: won, error } = await supabase
      .from("workout_sessions")
      .update(claimedRow)
      .eq("id", sessionId)
      .eq("status", "in_progress")
      .or(`finish_claim.is.null,finish_claimed_at.lt."${staleBefore}"`)
      .select("id");
    if (error) throw new WorkoutError(error.message);
    if (!won?.length) return awaitOtherFinish(supabase, userId, input);
  } else {
    const { data, error } = await supabase.from("workout_sessions").insert(claimedRow).select("id").single();
    // Another request created it first (unique user + client id): it holds the claim.
    if (error?.code === "23505") return awaitOtherFinish(supabase, userId, input);
    if (error || !data) throw new WorkoutError(error?.message ?? "Insert failed", error?.code === "23503" ? "invalid" : "db");
    sessionId = data.id as string;
  }

  try {
    return await writeClaimedFinish(supabase, userId, sessionId, input, userProgramId, volumeKg);
  } catch (e) {
    // Let the client's retry take over straight away instead of waiting for the claim to go stale.
    await supabase.from("workout_sessions").update({ finish_claim: null, finish_claimed_at: null }).eq("id", sessionId).eq("finish_claim", claim);
    throw e;
  }
}

/** A claim older than this is treated as abandoned (the server died mid-save), so a retry can take it over. */
const FINISH_CLAIM_TTL_MS = 120_000;

/** Number of completed sets (warm-ups included) in a finish payload. */
export function completedSetCount(exercises: ExerciseInput[]): number {
  return exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
}

/** The saved contents of a finished workout, in the shape a Finish sends (sets in order). */
async function savedExercises(supabase: SupabaseClient, userId: string, sessionId: string): Promise<{ name: string; notes: string; exercises: ExerciseInput[] }> {
  const [{ data: session, error: sErr }, { data: rows, error }] = await Promise.all([
    supabase.from("workout_sessions").select("name, notes").eq("id", sessionId).eq("user_id", userId).single(),
    supabase
      .from("workout_exercises")
      .select("position, exercise_id, substituted_from_id, notes, skipped, skip_reason, sets:workout_sets(set_number, reps, weight_kg, duration_seconds, distance_m, rpe, is_warmup, is_drop, completed)")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("position"),
  ]);
  if (sErr || error) throw new WorkoutError((sErr ?? error)!.message);
  type Row = {
    exercise_id: string;
    substituted_from_id: string | null;
    notes: string | null;
    skipped: boolean;
    skip_reason: ExerciseInput["skipReason"];
    sets: { set_number: number; reps: number | null; weight_kg: number | null; duration_seconds: number | null; distance_m: number | null; rpe: number | null; is_warmup: boolean; is_drop: boolean; completed: boolean }[];
  };
  const exercises = ((rows ?? []) as unknown as Row[]).map((r) => ({
    exerciseId: r.exercise_id,
    substitutedFromId: r.substituted_from_id,
    notes: r.notes ?? "",
    skipped: r.skipped,
    skipReason: r.skipped ? (r.skip_reason ?? "other") : null,
    sets: [...r.sets]
      .sort((a, b) => a.set_number - b.set_number)
      .map((x) => ({
        reps: x.reps,
        weightKg: x.weight_kg === null ? null : Number(x.weight_kg),
        durationSeconds: x.duration_seconds,
        distanceM: x.distance_m === null ? null : Number(x.distance_m),
        rpe: x.rpe === null ? null : Number(x.rpe),
        isWarmup: x.is_warmup,
        isDrop: x.is_drop,
        completed: x.completed,
      })),
  }));
  return { name: session.name as string, notes: (session.notes as string | null) ?? "", exercises };
}

/**
 * Another Finish for a workout that is already saved: this device's first reply was lost, or the workout was finished
 * on another device meanwhile. The two copies are combined set by set (lib/domain/workout-merge.ts): every set
 * completed in either stays completed, so neither device's sets are dropped. (Before, a copy with more completed sets
 * in total replaced the saved workout, losing sets only the saved copy had.) When the incoming copy adds nothing,
 * nothing is written. Returns the new volume and the number of sets added, or null when nothing changed. Throws if the
 * edit fails, so the device keeps its copy and can retry.
 */
async function applyLaterSets(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  input: FinishWorkoutInput,
): Promise<{ volumeKg: number | null; added: number; differing: number }> {
  const first = mergeFinishedExercises((await savedExercises(supabase, userId, sessionId)).exercises, input.exercises);
  // Nothing to add; sets both devices completed with different numbers are still reported (the saved ones stay).
  if (first.added === 0) return { volumeKg: null, added: 0, differing: first.differing };

  // Claim the saved workout first: two such retries at once would otherwise both write the sets (editWorkout adds the
  // new rows before removing the old). The one that loses is told to try again; its device keeps the workout.
  const claim = crypto.randomUUID();
  const staleBefore = new Date(Date.now() - FINISH_CLAIM_TTL_MS).toISOString();
  const { data: won, error: claimErr } = await supabase
    .from("workout_sessions")
    .update({ finish_claim: claim, finish_claimed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "completed")
    .or(`finish_claim.is.null,finish_claimed_at.lt."${staleBefore}"`)
    .select("id");
  if (claimErr) throw new WorkoutError(claimErr.message);
  if (!won?.length) throw new WorkoutError("This workout is still being saved. Try again in a moment.", "conflict");
  try {
    // Combined again under the claim: another retry may have stored more sets just before.
    const saved = await savedExercises(supabase, userId, sessionId);
    const merged = mergeFinishedExercises(saved.exercises, input.exercises);
    if (merged.added === 0) return { volumeKg: null, added: 0, differing: merged.differing };
    // The end time moves to the later Finish, with the pause time the device now has (it may have paused since).
    const { error: timeErr } = await supabase
      .from("workout_sessions")
      .update({ ended_at: input.endedAt, paused_seconds: input.pausedSeconds })
      .eq("id", sessionId)
      .eq("user_id", userId)
      .lt("ended_at", input.endedAt);
    if (timeErr) throw new WorkoutError(timeErr.message);
    const { volumeKg } = await editWorkout(supabase, userId, { sessionId, name: saved.name, notes: saved.notes, exercises: merged.exercises });
    return { volumeKg, added: merged.added, differing: merged.differing };
  } finally {
    await supabase.from("workout_sessions").update({ finish_claim: null, finish_claimed_at: null }).eq("id", sessionId).eq("finish_claim", claim);
  }
}

/** Another request is finishing this workout: wait for it, then answer as a retry would. */
async function awaitOtherFinish(supabase: SupabaseClient, userId: string, input: FinishWorkoutInput) {
  for (let i = 0; i < 40; i++) {
    const { data } = await supabase
      .from("workout_sessions")
      .select("id, status, total_volume_kg")
      .eq("user_id", userId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (data?.status === "completed") {
      const later = await applyLaterSets(supabase, userId, data.id as string, input);
      const records = await recordsOfSession(supabase, userId, data.id as string).catch(() => []);
      return { sessionId: data.id as string, volumeKg: later.volumeKg ?? Number(data.total_volume_kg), records, alreadyCompleted: true, addedSets: later.added, differingSets: later.differing };
    }
    if (data && data.status !== "in_progress") break;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new WorkoutError("This workout is still being saved. Try again in a moment.", "conflict");
}

async function writeClaimedFinish(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  input: FinishWorkoutInput,
  userProgramId: string | null,
  volumeKg: number,
): Promise<{ sessionId: string; volumeKg: number; records: NewRecord[]; alreadyCompleted: boolean; addedSets: number; differingSets?: number }> {
  // Clear anything a previous partial attempt left (an in-progress session owns no saved exercises or records).
  await supabase.from("workout_exercises").delete().eq("session_id", sessionId);
  await supabase.from("personal_records").delete().eq("user_id", userId).eq("session_id", sessionId);

  // If this throws, the session stays in progress so the client can retry safely.
  await insertExercises(supabase, userId, sessionId, input.exercises);

  // Personal records — computed from completed working sets.
  const active = input.exercises.filter((e) => !e.skipped);
  const exerciseIds = [...new Set(active.map((e) => e.exerciseId))];
  const prior = await currentBests(supabase, userId, exerciseIds);
  const records: NewRecord[] = [];
  for (const id of exerciseIds) {
    const sets = active.filter((e) => e.exerciseId === id).flatMap((e) => toLogged(e.sets));
    const before = prior.get(id) ?? [];
    for (const r of detectNewRecords(before, bestsFromSets(sets))) records.push({ ...r, exerciseId: id, first: !before.some((b) => b.recordType === r.recordType) });
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
    .update({ status: "completed", ended_at: input.endedAt, draft: null, finish_claim: null, finish_claimed_at: null })
    .eq("id", sessionId);
  if (doneErr) throw new WorkoutError(doneErr.message);

  if (userProgramId && input.programDayId) {
    await advanceProgram(supabase, userId, userProgramId, input.programDayId);
  }
  return { sessionId, volumeKg, records, alreadyCompleted: false, addedSets: 0 };
}

/**
 * Rebuild the personal-record history for the given exercises from all completed sessions.
 * Used after editing or deleting a past workout so records stay truthful.
 */
export async function rebuildRecords(supabase: SupabaseClient, userId: string, exerciseIds: string[]): Promise<void> {
  if (!exerciseIds.length) return;
  // Paged (the API returns at most 1,000 rows per request): an unpaged read dropped older sessions for members with a
  // long history, and the rebuild then deleted records those sessions held.
  const data: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await supabase
      .from("workout_exercises")
      .select("id, exercise_id, skipped, session:workout_sessions!inner(id, status, started_at, ended_at), sets:workout_sets(reps, weight_kg, duration_seconds, completed, is_warmup)")
      .eq("user_id", userId)
      .in("exercise_id", exerciseIds)
      .eq("session.status", "completed")
      .order("id")
      .range(from, from + 999);
    if (error) throw new WorkoutError(error.message);
    data.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }

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
  // Write the new exercises first and only then remove the old ones, so a failed save never leaves the workout
  // empty: on failure the partly written new rows are removed and the old ones stay.
  const { data: oldRows, error: oldErr } = await supabase.from("workout_exercises").select("id").eq("session_id", input.sessionId).eq("user_id", userId);
  if (oldErr) throw new WorkoutError(oldErr.message);
  const oldIds = (oldRows ?? []).map((r) => r.id as string);
  try {
    await insertExercises(supabase, userId, input.sessionId, input.exercises);
  } catch (err) {
    let cleanup = supabase.from("workout_exercises").delete().eq("session_id", input.sessionId).eq("user_id", userId);
    if (oldIds.length) cleanup = cleanup.not("id", "in", `(${oldIds.join(",")})`);
    await cleanup;
    throw err;
  }
  if (oldIds.length) {
    const { error: delErr } = await supabase.from("workout_exercises").delete().in("id", oldIds).eq("user_id", userId);
    if (delErr) throw new WorkoutError(delErr.message);
  }
  const { error } = await supabase
    .from("workout_sessions")
    .update({ name: input.name, notes: input.notes || null, total_volume_kg: volumeKg })
    .eq("id", input.sessionId);
  if (error) throw new WorkoutError(error.message);
  await rebuildRecords(supabase, userId, [...affected]);
  return { volumeKg };
}

/**
 * Delete a workout and make the records truthful again. The records the workout earned are removed first: deleting
 * the session only clears their session link (on delete set null), so if the rebuild then failed they stayed behind
 * for good, and a retry found no workout. A retry now still rebuilds: with the workout already gone, any records left
 * without a session (from such a half-finished delete) are rebuilt before "not found" is reported.
 */
export async function deleteWorkout(supabase: SupabaseClient, userId: string, sessionId: string): Promise<void> {
  const { data: exs } = await supabase.from("workout_exercises").select("exercise_id").eq("session_id", sessionId).eq("user_id", userId);
  const { data: held, error: heldErr } = await supabase.from("personal_records").select("exercise_id").eq("session_id", sessionId).eq("user_id", userId);
  if (heldErr) throw new WorkoutError(heldErr.message);
  const affected = new Set<string>([...(exs ?? []), ...(held ?? [])].map((r) => r.exercise_id as string));
  if (held?.length) {
    const { error: prErr } = await supabase.from("personal_records").delete().eq("session_id", sessionId).eq("user_id", userId);
    if (prErr) throw new WorkoutError(prErr.message);
  }
  const { error, count } = await supabase.from("workout_sessions").delete({ count: "exact" }).eq("id", sessionId).eq("user_id", userId);
  if (error) throw new WorkoutError(error.message);
  if (!count) {
    const { data: orphans, error: orphanErr } = await supabase.from("personal_records").select("exercise_id").eq("user_id", userId).is("session_id", null);
    if (orphanErr) throw new WorkoutError(orphanErr.message);
    for (const o of orphans ?? []) affected.add(o.exercise_id as string);
    await rebuildRecords(supabase, userId, [...affected]);
    throw new WorkoutError("Workout not found", "not_found");
  }
  await rebuildRecords(supabase, userId, [...affected]);
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
export async function getPreviousPerformance(
  supabase: SupabaseClient,
  userId: string,
  exerciseIds: string[],
  /** Today's program day, when the workout is one: its earlier sessions are preferred (see preferSameSession). */
  slot?: SessionSlot | null,
): Promise<Record<string, PreviousPerformance>> {
  const ids = [...new Set(exerciseIds)].slice(0, 40);
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from("workout_exercises")
    .select(
      "exercise_id, skipped, session:workout_sessions!inner(id, started_at, status, program_day:program_days(day_number, week:program_weeks(program_id, is_deload))), sets:workout_sets(set_number, reps, weight_kg, duration_seconds, distance_m, is_warmup, is_drop, completed)",
    )
    .eq("user_id", userId)
    .in("exercise_id", ids)
    .eq("session.status", "completed")
    .order("created_at", { ascending: false })
    .limit(Math.min(400, ids.length * 12));
  if (error) throw new WorkoutError(error.message);
  return Object.fromEntries(preferSameSession((data ?? []) as unknown as PreviousRow[], slot));
}

export interface ExerciseTarget {
  weightKg: number | null;
  reps: number | null;
}

/** Target loads the member accepted from the training review or the AI coach (Pro), by exercise id. */
export async function getExerciseTargets(supabase: SupabaseClient, userId: string, exerciseIds: string[]): Promise<Record<string, ExerciseTarget>> {
  const ids = [...new Set(exerciseIds)].slice(0, 40);
  if (!ids.length) return {};
  const { data, error } = await supabase.from("exercise_targets").select("exercise_id, weight_kg, reps").eq("user_id", userId).in("exercise_id", ids);
  if (error) throw new WorkoutError(error.message);
  return Object.fromEntries((data ?? []).map((t) => [t.exercise_id as string, { weightKg: t.weight_kg == null ? null : Number(t.weight_kg), reps: (t.reps as number | null) ?? null }]));
}
