import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { DEFAULT_SLEEP_GOAL_MINUTES, summarizeNights } from "@/lib/domain/sleep";
import type { UnitSystem } from "@/lib/domain/types";
import { analyzeLiftProgress, windowStart, type AnalysisSet, type CheckinInput, type SleepNightInput } from "@/lib/coach/lift-analysis";
import { summarizeRunning, type RunRecord } from "@/lib/coach/running-summary";
import { summarizeRecovery } from "@/lib/coach/recovery-summary";
import type { ActivitySource } from "@/lib/domain/activities";
import { listSleepSessions } from "@/server/services/sleep";
import { getActiveProgramRef } from "./snapshot";

/**
 * Loaders for the coach's analysis tools. Every query runs on the member's own session (RLS) with an explicit
 * user_id filter, and only reads; the numbers are worked out by the pure functions in src/lib/coach.
 */

export interface AnalysisContext {
  supabase: SupabaseClient;
  userId: string;
  timeZone: string;
  today: string;
  units: UnitSystem;
}

interface RawSet {
  reps: number | null;
  weight_kg: number | string | null;
  duration_seconds: number | null;
  rpe: number | string | null;
  completed: boolean;
  is_warmup: boolean;
}

const workingSets = (sets: RawSet[] | null | undefined): AnalysisSet[] =>
  (sets ?? [])
    .filter((s) => s.completed && !s.is_warmup)
    .map((s) => ({ reps: s.reps, weightKg: s.weight_kg == null ? null : Number(s.weight_kg), rpe: s.rpe == null ? null : Number(s.rpe), seconds: s.duration_seconds }));

/** Sleep nights (only with wellness consent) and recovery check-ins from `from` to today. */
async function loadRecoveryInputs(ctx: AnalysisContext, from: string): Promise<{ sleep: SleepNightInput[] | null; goalMinutes: number; checkins: CheckinInput[] }> {
  const [{ data: profile }, { data: rows }] = await Promise.all([
    ctx.supabase.from("profiles").select("wellness_consent_at, sleep_goal_minutes").eq("id", ctx.userId).maybeSingle(),
    ctx.supabase.from("recovery_checkins").select("checked_on, sleep_quality, energy, soreness, stress, readiness_score").eq("user_id", ctx.userId).gte("checked_on", from).lte("checked_on", ctx.today).order("checked_on"),
  ]);
  const checkins = (rows ?? []).map((r) => ({
    date: r.checked_on as string,
    readiness: Number(r.readiness_score),
    energy: Number(r.energy),
    soreness: Number(r.soreness),
    stress: Number(r.stress),
    sleepQuality: Number(r.sleep_quality),
  }));
  const goalMinutes = (profile?.sleep_goal_minutes as number | null) ?? DEFAULT_SLEEP_GOAL_MINUTES;
  // Sleep is wellness data: without consent it is not used, as on every sleep screen.
  if (!profile?.wellness_consent_at) return { sleep: null, goalMinutes, checkins };
  const sessions = await listSleepSessions(ctx.supabase, ctx.userId, { fromNight: from, toNight: ctx.today });
  const sleep = summarizeNights(sessions).map((n) => ({ date: n.nightOf, asleepMinutes: n.asleepMinutes, recorded: n.recorded, estimated: n.asleepEstimated }));
  return { sleep, goalMinutes, checkins };
}

export async function loadLiftAnalysis(ctx: AnalysisContext, exercise: { id: string; slug: string; name: string }, weeks: number) {
  const start = windowStart(ctx.today, weeks);
  const [{ data, error }, ref, recovery] = await Promise.all([
    ctx.supabase
      .from("workout_exercises")
      .select("skipped, session:workout_sessions!inner(started_at, status), sets:workout_sets(reps, weight_kg, duration_seconds, rpe, completed, is_warmup)")
      .eq("user_id", ctx.userId)
      .eq("exercise_id", exercise.id)
      .eq("skipped", false)
      .eq("session.status", "completed")
      .order("created_at", { ascending: false })
      .limit(500),
    getActiveProgramRef(ctx.supabase, ctx.userId),
    loadRecoveryInputs(ctx, start),
  ]);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { session: { started_at: string }; sets: RawSet[] }[];
  const sessions = rows.map((r) => ({ date: isoDateInTz(new Date(r.session.started_at), ctx.timeZone), sets: workingSets(r.sets) })).filter((s) => s.sets.length);

  let program = null;
  if (ref) {
    const [{ data: up }, { data: done }] = await Promise.all([
      ctx.supabase.from("user_programs").select("started_at").eq("id", ref.userProgramId).eq("user_id", ctx.userId).maybeSingle(),
      ctx.supabase.from("workout_sessions").select("started_at").eq("user_id", ctx.userId).eq("user_program_id", ref.userProgramId).eq("status", "completed").gte("started_at", `${addDays(start, -1)}T00:00:00Z`).limit(400),
    ]);
    program = {
      name: ref.name,
      daysPerWeek: ref.daysPerWeek,
      startedOn: up?.started_at ? isoDateInTz(new Date(up.started_at as string), ctx.timeZone) : null,
      completedDates: (done ?? []).map((d) => isoDateInTz(new Date(d.started_at as string), ctx.timeZone)),
    };
  }
  return analyzeLiftProgress({ exercise, today: ctx.today, weeks, units: ctx.units, sessions, program, sleep: recovery.sleep, checkins: recovery.checkins });
}

export async function loadRunningSummary(ctx: AnalysisContext, weeks: number) {
  // At least four weeks, so the weekly distance change can compare two weeks with the two before.
  const from = windowStart(ctx.today, Math.max(weeks, 4));
  const [{ data, error }, { data: last }] = await Promise.all([
    ctx.supabase
      .from("activities")
      .select("started_at, source, distance_m, moving_s, perceived_effort, external_id")
      .eq("user_id", ctx.userId)
      .eq("kind", "run")
      .is("deleted_at", null)
      .gte("started_at", `${addDays(from, -1)}T00:00:00Z`)
      .order("started_at")
      .limit(1000),
    ctx.supabase.from("activities").select("started_at").eq("user_id", ctx.userId).eq("kind", "run").is("deleted_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) throw error;
  const runs: RunRecord[] = (data ?? []).map((r) => ({
    date: isoDateInTz(new Date(r.started_at as string), ctx.timeZone),
    source: r.source as ActivitySource,
    imported: Boolean(r.external_id),
    distanceM: r.distance_m == null ? null : Number(r.distance_m),
    movingS: Number(r.moving_s),
    perceivedEffort: r.perceived_effort == null ? null : Number(r.perceived_effort),
  }));
  const lastRunDate = last?.started_at ? isoDateInTz(new Date(last.started_at as string), ctx.timeZone) : null;
  return summarizeRunning({ today: ctx.today, weeks, units: ctx.units, runs, lastRunDate });
}

export async function loadRecoverySummary(ctx: AnalysisContext, days: number) {
  const start = addDays(ctx.today, -(days - 1));
  // Load always covers 28 days for the acute vs chronic comparison.
  const loadFrom = addDays(ctx.today, -Math.max(days - 1, 27));
  const [recovery, { data, error }] = await Promise.all([
    loadRecoveryInputs(ctx, start),
    ctx.supabase
      .from("workout_sessions")
      .select("started_at, workout_exercises(skipped, sets:workout_sets(reps, weight_kg, duration_seconds, rpe, completed, is_warmup))")
      .eq("user_id", ctx.userId)
      .eq("status", "completed")
      .gte("started_at", `${addDays(loadFrom, -1)}T00:00:00Z`)
      .order("started_at")
      .limit(300),
  ]);
  if (error) throw error;
  const sessions = ((data ?? []) as unknown as { started_at: string; workout_exercises: { skipped: boolean; sets: RawSet[] }[] }[]).map((s) => ({
    date: isoDateInTz(new Date(s.started_at), ctx.timeZone),
    sets: (s.workout_exercises ?? []).filter((e) => !e.skipped).flatMap((e) => workingSets(e.sets)),
  }));
  return summarizeRecovery({ today: ctx.today, days, checkins: recovery.checkins, sleep: recovery.sleep, sleepGoalMinutes: recovery.goalMinutes, sessions });
}
