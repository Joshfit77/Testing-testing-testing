import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { DEFAULT_SLEEP_GOAL_MINUTES, summarizeNights } from "@/lib/domain/sleep";
import { rowToSession, SLEEP_SESSION_COLUMNS, type SleepSessionRow } from "@/server/services/sleep";
import { programDays, programExercisesOnDays } from "@/server/services/training";
import { analyzeTraining, type ReviewInput, type ReviewProgram, type ReviewWorkout, type TrainingChange, type TrainingReview } from "@/lib/domain/adaptive-training";
import type { UnitSystem } from "@/lib/domain/types";
import { displayWeight, weightUnit } from "@/lib/domain/units";
import { getActiveProgramRef } from "@/server/coach/snapshot";

/**
 * Loads the member's own logs for the training review (their session and RLS, plus an explicit user filter) and
 * applies the changes they accept. Every accepted change is recorded in training_adjustments with the values it
 * replaced, so it can be undone; workout history is never modified.
 */

export class TrainingChangeError extends Error {}

interface RawSession {
  started_at: string;
  program_day_id: string | null;
  workout_exercises: {
    exercise_id: string;
    skipped: boolean;
    exercise: { slug: string; name: string; primary_muscles: string[]; secondary_muscles: string[]; equipment: string[] } | null;
    sets: { reps: number | null; weight_kg: number | string | null; rpe: number | string | null; completed: boolean; is_warmup: boolean }[];
  }[];
}

/** The week a change would apply to: this week if it hasn't started yet, otherwise the next one. */
export function upcomingWeek(ref: { currentWeek: number; currentDay: number; durationWeeks: number }): number {
  if (ref.currentDay <= 1) return ref.currentWeek;
  return Math.min(ref.durationWeeks, ref.currentWeek + 1);
}

export async function loadReviewInput(supabase: SupabaseClient, userId: string): Promise<{ input: ReviewInput; timeZone: string }> {
  const { data: profile } = await supabase.from("profiles").select("unit_system, timezone, sleep_goal_minutes, wellness_consent_at").eq("id", userId).maybeSingle();
  const timeZone = (profile?.timezone as string) || "UTC";
  const today = isoDateInTz(new Date(), timeZone);
  const since = addDays(today, -56);

  const [sessionsRes, checkinsRes, targetsRes, decisionsRes, answersRes, ref, sleepRes] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select(
        "started_at, program_day_id, workout_exercises(exercise_id, skipped, exercise:exercises!workout_exercises_exercise_id_fkey(slug, name, primary_muscles, secondary_muscles, equipment), sets:workout_sets(reps, weight_kg, rpe, completed, is_warmup))",
      )
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("started_at", `${since}T00:00:00Z`)
      .order("started_at")
      .limit(200),
    supabase.from("recovery_checkins").select("checked_on, readiness_score").eq("user_id", userId).gte("checked_on", addDays(today, -13)).order("checked_on"),
    supabase.from("exercise_targets").select("weight_kg, reps, exercise:exercises(slug)").eq("user_id", userId),
    supabase.from("training_recommendation_decisions").select("recommendation_key").eq("user_id", userId),
    supabase.from("onboarding_answers").select("primary_goal, updated_at").eq("user_id", userId).maybeSingle(),
    getActiveProgramRef(supabase, userId),
    supabase.from("sleep_sessions").select(SLEEP_SESSION_COLUMNS).eq("user_id", userId).eq("kind", "night").not("ended_at", "is", null).gte("night_of", addDays(today, -13)).order("started_at"),
  ]);
  if (sessionsRes.error) throw sessionsRes.error;
  const sessions = (sessionsRes.data ?? []) as unknown as RawSession[];

  // What the program prescribed in each logged session (by program day and exercise).
  const dayIds = [...new Set(sessions.map((s) => s.program_day_id).filter((d): d is string => Boolean(d)))];
  const prescribed = new Map<string, { reps: string | null; rpe: number | null }>();
  if (dayIds.length) {
    const { data } = await supabase.from("program_exercises").select("day_id, exercise_id, reps, rpe").in("day_id", dayIds);
    for (const r of data ?? []) prescribed.set(`${r.day_id}:${r.exercise_id}`, { reps: (r.reps as string | null) ?? null, rpe: r.rpe == null ? null : Number(r.rpe) });
  }

  const workouts: ReviewWorkout[] = sessions.map((s) => ({
    date: isoDateInTz(new Date(s.started_at), timeZone),
    exercises: (s.workout_exercises ?? [])
      .filter((e) => !e.skipped && e.exercise)
      .map((e) => ({
        slug: e.exercise!.slug,
        name: e.exercise!.name,
        primaryMuscles: e.exercise!.primary_muscles ?? [],
        secondaryMuscles: e.exercise!.secondary_muscles ?? [],
        equipment: e.exercise!.equipment ?? [],
        sets: (e.sets ?? [])
          .filter((x) => x.completed && !x.is_warmup)
          .map((x) => ({ reps: x.reps, weightKg: x.weight_kg == null ? null : Number(x.weight_kg), rpe: x.rpe == null ? null : Number(x.rpe) })),
        prescribed: s.program_day_id ? (prescribed.get(`${s.program_day_id}:${e.exercise_id}`) ?? null) : null,
      }))
      .filter((e) => e.sets.length),
  }));

  let program: ReviewProgram | null = null;
  let goalChanged = false;
  if (ref) {
    const week = upcomingWeek(ref);
    const [{ data: up }, { data: prog }, { data: weeks }, rows] = await Promise.all([
      supabase.from("user_programs").select("started_at").eq("id", ref.userProgramId).maybeSingle(),
      supabase.from("training_programs").select("goals").eq("id", ref.programId).maybeSingle(),
      supabase.from("program_weeks").select("week_number, is_deload").eq("program_id", ref.programId),
      programDays(supabase, ref.programId, { week }).then((days) =>
        programExercisesOnDays<{ id: string; sets: number; reps: string | null; rpe: number | string | null; exercise: { slug: string; name: string; primary_muscles: string[] } | null }>(
          supabase,
          days,
          "id, sets, reps, rpe, exercise:exercises(slug, name, primary_muscles)",
        ),
      ),
    ]);
    const startedOn = up?.started_at ? isoDateInTz(new Date(up.started_at as string), timeZone) : null;
    program = {
      programId: ref.programId,
      name: ref.name,
      editable: ref.editable,
      goals: (prog?.goals as string[]) ?? [],
      currentWeek: ref.currentWeek,
      currentDay: ref.currentDay,
      durationWeeks: ref.durationWeeks,
      daysPerWeek: ref.daysPerWeek,
      startedOn,
      weeks: (weeks ?? []).map((x) => ({ weekNumber: x.week_number as number, isDeload: Boolean(x.is_deload) })),
      upcoming: {
        weekNumber: week,
        exercises: rows
          .filter((r) => r.exercise)
          .map((r) => ({ id: r.id, slug: r.exercise!.slug, name: r.exercise!.name, sets: r.sets, reps: r.reps, rpe: r.rpe == null ? null : Number(r.rpe), primaryMuscles: r.exercise!.primary_muscles ?? [] })),
      },
    };
    goalChanged = Boolean(answersRes.data?.updated_at && up?.started_at && (answersRes.data.updated_at as string) > (up.started_at as string));
  }

  const targets: ReviewInput["targets"] = {};
  for (const t of (targetsRes.data ?? []) as unknown as { weight_kg: number | string | null; reps: number | null; exercise: { slug: string } | null }[]) {
    if (t.exercise) targets[t.exercise.slug] = { weightKg: t.weight_kg == null ? null : Number(t.weight_kg), reps: t.reps };
  }

  return {
    timeZone,
    input: {
      today,
      units: ((profile?.unit_system as UnitSystem) ?? "imperial") as UnitSystem,
      goal: (answersRes.data?.primary_goal as string | null) ?? null,
      goalChangedAfterProgramStart: goalChanged,
      workouts,
      program,
      checkins: (checkinsRes.data ?? []).map((c) => ({ date: c.checked_on as string, readiness: c.readiness_score as number })),
      targets,
      decided: new Set((decisionsRes.data ?? []).map((d) => d.recommendation_key as string)),
      // Sleep is wellness data: once consent is withdrawn the rows stay for the member but are not used here.
      sleep: profile?.wellness_consent_at
        ? {
            goalMinutes: (profile?.sleep_goal_minutes as number | null) ?? DEFAULT_SLEEP_GOAL_MINUTES,
            nights: summarizeNights(((sleepRes.data ?? []) as unknown as SleepSessionRow[]).map(rowToSession)).map((n) => ({ date: n.nightOf, asleepMinutes: n.asleepMinutes })),
          }
        : null,
    },
  };
}

export async function getTrainingReview(supabase: SupabaseClient, userId: string): Promise<{ review: TrainingReview; input: ReviewInput }> {
  const { input } = await loadReviewInput(supabase, userId);
  return { review: analyzeTraining(input), input };
}

interface ChangeRecord {
  table: "program_exercises" | "program_weeks" | "exercise_targets";
  id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

async function requireEditableActiveProgram(supabase: SupabaseClient, userId: string, programId: string) {
  const ref = await getActiveProgramRef(supabase, userId);
  if (!ref || ref.programId !== programId) throw new TrainingChangeError("That program is no longer your active program.");
  if (!ref.editable) throw new TrainingChangeError("This is a library program, which can't be edited.");
  return ref;
}

/** Put the recorded rows back as they were (best effort, used when a multi-row change fails part-way). */
async function restore(supabase: SupabaseClient, records: ChangeRecord[]) {
  for (const r of [...records].reverse()) {
    if (r.table === "exercise_targets") {
      if (r.before) await supabase.from("exercise_targets").update(r.before).eq("id", r.id);
      else await supabase.from("exercise_targets").delete().eq("id", r.id);
    } else if (r.before) {
      await supabase.from(r.table).update(r.before).eq("id", r.id);
    }
  }
}

/**
 * Apply one accepted change. Validates it against the member's current program and data, applies it, and records it
 * (with what it replaced). Throws TrainingChangeError with a message for the member when it can't be applied.
 */
export async function applyTrainingChange(
  supabase: SupabaseClient,
  userId: string,
  change: TrainingChange,
  meta: { source: "review" | "coach"; reason: string; recommendationKey?: string | null; messageId?: string | null; units: UnitSystem },
): Promise<{ adjustmentId: string; summary: string }> {
  const records: ChangeRecord[] = [];
  let summary: string;
  let programId: string | null = null;
  try {
    if (change.kind === "exercise_target") {
      const { data: ex } = await supabase.from("exercises").select("id, name").eq("slug", change.exerciseSlug).maybeSingle();
      if (!ex) throw new TrainingChangeError("That exercise is no longer in the catalog.");
      if (!(change.weightKg > 0 && change.weightKg <= 1000)) throw new TrainingChangeError("Choose a load between 0 and 1,000 kg.");
      const { data: existing } = await supabase.from("exercise_targets").select("id, weight_kg, reps, note, source").eq("user_id", userId).eq("exercise_id", ex.id).maybeSingle();
      const after = { weight_kg: change.weightKg, reps: change.reps, note: meta.reason.slice(0, 300), source: meta.source };
      if (existing) {
        const { error } = await supabase.from("exercise_targets").update(after).eq("id", existing.id);
        if (error) throw error;
        records.push({ table: "exercise_targets", id: existing.id as string, before: { weight_kg: existing.weight_kg, reps: existing.reps, note: existing.note, source: existing.source }, after });
      } else {
        const { data: row, error } = await supabase.from("exercise_targets").insert({ user_id: userId, exercise_id: ex.id, ...after }).select("id").single();
        if (error || !row) throw error ?? new Error("Target insert failed");
        records.push({ table: "exercise_targets", id: row.id as string, before: null, after });
      }
      summary = `Target for ${ex.name as string}: ${displayWeight(change.weightKg, meta.units)} ${weightUnit(meta.units)}${change.reps ? ` × ${change.reps}` : ""}.`;
    } else if (change.kind === "deload_week") {
      await requireEditableActiveProgram(supabase, userId, change.programId);
      programId = change.programId;
      if (!(change.setsFactor >= 0.4 && change.setsFactor <= 0.8)) throw new TrainingChangeError("Keep between 40% and 80% of the sets.");
      if (!(change.rpeCap >= 5 && change.rpeCap <= 8)) throw new TrainingChangeError("Cap effort between RPE 5 and 8.");
      const { data: week } = await supabase.from("program_weeks").select("id, focus, is_deload").eq("program_id", change.programId).eq("week_number", change.weekNumber).maybeSingle();
      if (!week) throw new TrainingChangeError(`Week ${change.weekNumber} isn't in this program.`);
      if (week.is_deload) throw new TrainingChangeError(`Week ${change.weekNumber} is already a recovery week.`);
      const rows = await programExercisesOnDays<{ id: string; sets: number; rpe: number | string | null }>(
        supabase,
        await programDays(supabase, change.programId, { week: change.weekNumber }),
        "id, sets, rpe",
      );
      for (const r of rows) {
        const before = { sets: r.sets, rpe: r.rpe == null ? null : Number(r.rpe) };
        const after = { sets: Math.max(1, Math.round(r.sets * change.setsFactor)), rpe: before.rpe == null ? change.rpeCap : Math.min(before.rpe, change.rpeCap) };
        const { error } = await supabase.from("program_exercises").update(after).eq("id", r.id);
        if (error) throw error;
        records.push({ table: "program_exercises", id: r.id, before, after });
      }
      const weekAfter = { is_deload: true, focus: "Recovery week (approved)" };
      const { error: wErr } = await supabase.from("program_weeks").update(weekAfter).eq("id", week.id);
      if (wErr) throw wErr;
      records.push({ table: "program_weeks", id: week.id as string, before: { is_deload: false, focus: week.focus }, after: weekAfter });
      summary = `Week ${change.weekNumber} is now a recovery week: ${Math.round(change.setsFactor * 100)}% of the sets, effort up to RPE ${change.rpeCap}.`;
    } else {
      await requireEditableActiveProgram(supabase, userId, change.programId);
      programId = change.programId;
      if (!Number.isInteger(change.deltaSets) || change.deltaSets === 0 || Math.abs(change.deltaSets) > 2) throw new TrainingChangeError("Change by one or two sets.");
      const { data: ex } = await supabase.from("exercises").select("id").eq("slug", change.exerciseSlug).maybeSingle();
      if (!ex) throw new TrainingChangeError("That exercise is no longer in the catalog.");
      const list = await programExercisesOnDays<{ id: string; sets: number }>(
        supabase,
        await programDays(supabase, change.programId, { fromWeek: change.fromWeek, excludeDeload: true }),
        "id, sets",
        { exerciseId: ex.id as string },
      );
      if (!list.length) throw new TrainingChangeError(`${change.exerciseName} isn't in the rest of your program.`);
      for (const r of list) {
        const after = { sets: Math.min(10, Math.max(1, r.sets + change.deltaSets)) };
        if (after.sets === r.sets) continue;
        const { error } = await supabase.from("program_exercises").update(after).eq("id", r.id);
        if (error) throw error;
        records.push({ table: "program_exercises", id: r.id, before: { sets: r.sets }, after });
      }
      if (!records.length) throw new TrainingChangeError("Nothing to change: the sets are already at the limit.");
      summary = `${change.deltaSets > 0 ? "Added" : "Removed"} ${Math.abs(change.deltaSets)} set${Math.abs(change.deltaSets) === 1 ? "" : "s"} ${change.deltaSets > 0 ? "to" : "from"} ${change.exerciseName} from week ${change.fromWeek} on.`;
    }

    const { data: adj, error: aErr } = await supabase
      .from("training_adjustments")
      .insert({
        user_id: userId,
        program_id: programId,
        kind: change.kind,
        summary: summary.slice(0, 300),
        reason: meta.reason.slice(0, 1000),
        changes: records,
        source: meta.source,
        recommendation_key: meta.recommendationKey ?? null,
        source_message_id: meta.messageId ?? null,
      })
      .select("id")
      .single();
    if (aErr || !adj) throw aErr ?? new Error("Adjustment insert failed");
    return { adjustmentId: adj.id as string, summary };
  } catch (err) {
    await restore(supabase, records);
    throw err;
  }
}

/** Undo an accepted change, if what it changed hasn't been changed again since. */
export async function undoTrainingAdjustment(supabase: SupabaseClient, userId: string, adjustmentId: string): Promise<string> {
  const { data: adj } = await supabase.from("training_adjustments").select("id, summary, changes, reverted_at").eq("id", adjustmentId).eq("user_id", userId).maybeSingle();
  if (!adj) throw new TrainingChangeError("That change wasn't found.");
  if (adj.reverted_at) throw new TrainingChangeError("That change was already undone.");
  const records = (adj.changes ?? []) as ChangeRecord[];
  // Check first: only undo when every row still has the values this change set.
  for (const r of records) {
    const cols = Object.keys(r.after ?? {});
    const { data: cur } = await supabase.from(r.table).select(cols.join(", ") || "id").eq("id", r.id).maybeSingle();
    if (!cur) throw new TrainingChangeError("Part of that change no longer exists (the program may have been replaced), so it can't be undone.");
    for (const c of cols) {
      const a = (r.after as Record<string, unknown>)[c];
      const b = (cur as unknown as Record<string, unknown>)[c];
      const same = typeof a === "number" || typeof b === "number" ? Number(a) === Number(b) : a === b;
      if (!same) throw new TrainingChangeError("This has been changed again since, so it can't be undone automatically.");
    }
  }
  await restore(supabase, records);
  const { error } = await supabase.from("training_adjustments").update({ reverted_at: new Date().toISOString() }).eq("id", adjustmentId).eq("user_id", userId);
  if (error) throw error;
  return `Undone: ${adj.summary as string}`;
}
