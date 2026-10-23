import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SleepKind, SleepSession, SleepSource } from "@/lib/domain/sleep";
import type { SleepCheckin } from "@/lib/domain/sleep-checkins";

export const SLEEP_CHECKIN_COLUMNS = "day, restedness, energy_morning, energy_afternoon, energy_evening, mood, stress, sleep_quality, caffeine_last, alcohol, late_meal, exercise_timing, evening_screens, disturbances, travel, sleep_aid, notes";

function rowToCheckin(r: Record<string, unknown>): SleepCheckin {
  const caffeine = typeof r.caffeine_last === "string" ? r.caffeine_last.slice(0, 5) : null;
  return { ...(r as unknown as SleepCheckin), caffeine_last: caffeine, disturbances: (r.disturbances as SleepCheckin["disturbances"]) ?? [] };
}

/** Check-ins from `fromDay` to `toDay` (inclusive), oldest first. */
export async function listSleepCheckins(supabase: SupabaseClient, userId: string, fromDay: string, toDay: string): Promise<SleepCheckin[]> {
  const { data, error } = await supabase.from("sleep_checkins").select(SLEEP_CHECKIN_COLUMNS).eq("user_id", userId).gte("day", fromDay).lte("day", toDay).order("day");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToCheckin);
}

export async function getSleepCheckin(supabase: SupabaseClient, userId: string, day: string): Promise<SleepCheckin | null> {
  const { data, error } = await supabase.from("sleep_checkins").select(SLEEP_CHECKIN_COLUMNS).eq("user_id", userId).eq("day", day).maybeSingle();
  if (error) throw error;
  return data ? rowToCheckin(data as Record<string, unknown>) : null;
}

export interface SleepSessionRow {
  id: string;
  user_id: string;
  kind: SleepKind;
  started_at: string;
  ended_at: string | null;
  onset_at: string | null;
  final_wake_at: string | null;
  awakenings: number | null;
  awake_minutes: number | null;
  timezone: string;
  night_of: string;
  source: SleepSource;
  source_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const SLEEP_SESSION_COLUMNS = "id, user_id, kind, started_at, ended_at, onset_at, final_wake_at, awakenings, awake_minutes, timezone, night_of, source, source_id, notes, created_at, updated_at";

export function rowToSession(r: SleepSessionRow): SleepSession {
  return {
    id: r.id,
    kind: r.kind,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    onsetAt: r.onset_at,
    finalWakeAt: r.final_wake_at,
    awakenings: r.awakenings,
    awakeMinutes: r.awake_minutes,
    timezone: r.timezone,
    nightOf: r.night_of,
    source: r.source,
    notes: r.notes,
  };
}

/** Sessions listed under nights from `fromNight` on (inclusive), newest first. */
export async function listSleepSessions(supabase: SupabaseClient, userId: string, opts: { fromNight?: string; toNight?: string; limit?: number } = {}): Promise<SleepSession[]> {
  let q = supabase.from("sleep_sessions").select(SLEEP_SESSION_COLUMNS).eq("user_id", userId).order("started_at", { ascending: false });
  if (opts.fromNight) q = q.gte("night_of", opts.fromNight);
  if (opts.toNight) q = q.lte("night_of", opts.toNight);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as SleepSessionRow[]).map(rowToSession);
}

/** The timer that is still running, if any (at most one exists: sessions can't overlap). */
export async function getRunningSleepSession(supabase: SupabaseClient, userId: string): Promise<SleepSession | null> {
  const { data, error } = await supabase.from("sleep_sessions").select(SLEEP_SESSION_COLUMNS).eq("user_id", userId).is("ended_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? rowToSession(data as unknown as SleepSessionRow) : null;
}

export interface SleepStageRow {
  session_id: string;
  stage: "awake" | "light" | "deep" | "rem" | "asleep" | "unknown";
  started_at: string;
  ended_at: string;
}

/** Stage intervals of imported sessions, in time order. Empty for the app's own entries. */
export async function listSleepStages(supabase: SupabaseClient, userId: string, sessionIds: string[]): Promise<SleepStageRow[]> {
  if (!sessionIds.length) return [];
  const { data, error } = await supabase.from("sleep_stages").select("session_id, stage, started_at, ended_at").eq("user_id", userId).in("session_id", sessionIds).order("started_at");
  if (error) throw error;
  return (data ?? []) as unknown as SleepStageRow[];
}

export interface SleepImportRun {
  id: string;
  source: "apple_health" | "health_connect";
  range_start: string;
  range_end: string;
  added: number;
  duplicates: number;
  conflicts: number;
  device: string | null;
  created_at: string;
}

export async function listSleepImportRuns(supabase: SupabaseClient, userId: string, limit = 10): Promise<SleepImportRun[]> {
  const { data, error } = await supabase.from("sleep_import_runs").select("id, source, range_start, range_end, added, duplicates, conflicts, device, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as SleepImportRun[];
}

export async function getSleepSession(supabase: SupabaseClient, userId: string, id: string): Promise<SleepSession | null> {
  const { data, error } = await supabase.from("sleep_sessions").select(SLEEP_SESSION_COLUMNS).eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToSession(data as unknown as SleepSessionRow) : null;
}
