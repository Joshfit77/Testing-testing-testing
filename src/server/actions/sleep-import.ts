"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { isoDateInTz } from "@/lib/domain/dates";
import { findOverlap, isValidTimeZone, nightOf, validateSleepSession, type SleepSessionTimes } from "@/lib/domain/sleep";
import { IMPORT_SOURCE_LABEL, MAX_IMPORT_HOURS, VITAL_RANGES } from "@/lib/domain/sleep-import";
import { hasVitals, type SleepVitals } from "@/lib/domain/sleep";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { listSleepSessions } from "@/server/services/sleep";

const refresh = () => {
  for (const p of ["/progress/sleep", "/progress/sleep/settings", "/progress", "/home"]) revalidatePath(p);
  revalidatePath("/progress/sleep", "layout");
};

const iso = z.string().datetime({ offset: true });
const stage = z.object({ stage: z.enum(["awake", "light", "deep", "rem", "asleep"]), startedAt: iso, endedAt: iso }).refine((st) => Date.parse(st.endedAt) > Date.parse(st.startedAt), "A stage must end after it starts");
/** Printable text only: a device name is shown back to the member, never interpreted. */
const deviceName = z
  .string()
  .max(120)
  .nullable()
  .transform((v) => v?.replace(/\p{C}/gu, "").trim() || null);
const bounded = (range: readonly [number, number]) => z.number().min(range[0]).max(range[1]);
const samples = z.number().int().min(1).max(100000);
const statOf = (range: readonly [number, number]) => z.object({ avg: bounded(range), min: bounded(range), max: bounded(range), samples }).refine((s) => s.min <= s.avg && s.avg <= s.max, "Low, average and high must be in order").nullable();
/** Overnight measurements the device recorded, as the native layer summarised them; each series may be null. */
const vitals = z
  .object({
    heartRate: statOf(VITAL_RANGES.heartRate),
    hrv: z.object({ avgMs: bounded(VITAL_RANGES.hrv), samples, method: z.enum(["sdnn", "rmssd"]) }).nullable(),
    respiratoryRate: statOf(VITAL_RANGES.respiratoryRate),
  })
  .nullable()
  .optional();
// Stages are validated one by one so a single odd interval drops that interval, not the night.
const session = z.object({
  sourceId: z.string().min(1).max(200),
  startedAt: iso,
  endedAt: iso,
  onsetAt: iso.nullable(),
  finalWakeAt: iso.nullable(),
  awakeMinutes: z.number().int().min(0).max(1440).nullable(),
  awakenings: z.number().int().min(0).max(50).nullable(),
  stages: z.array(z.unknown()).max(2000),
  deviceName,
  vitals,
});

/** The vitals columns for a session row (all null when the device recorded nothing). */
function vitalColumns(v: SleepVitals | null | undefined) {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    hr_avg: v?.heartRate ? Math.round(v.heartRate.avg) : null,
    hr_min: v?.heartRate ? Math.round(v.heartRate.min) : null,
    hr_max: v?.heartRate ? Math.round(v.heartRate.max) : null,
    hr_samples: v?.heartRate?.samples ?? null,
    hrv_avg_ms: v?.hrv ? r1(v.hrv.avgMs) : null,
    hrv_method: v?.hrv?.method ?? null,
    hrv_samples: v?.hrv?.samples ?? null,
    rr_avg: v?.respiratoryRate ? r1(v.respiratoryRate.avg) : null,
    rr_min: v?.respiratoryRate ? r1(v.respiratoryRate.min) : null,
    rr_max: v?.respiratoryRate ? r1(v.respiratoryRate.max) : null,
    rr_samples: v?.respiratoryRate?.samples ?? null,
  };
}
/** Each record is checked on its own below, so one unusable record can't block the rest of the import. */
const importSchema = z.object({
  source: z.enum(["apple_health", "health_connect"]),
  timezone: z.string().refine(isValidTimeZone, "Unknown time zone"),
  rangeStart: iso,
  rangeEnd: iso,
  sessions: z.array(z.unknown()).max(200),
});
const MAX_STAGES_PER_SESSION = 500;
/** How many import records to keep per member; older ones are pruned after each run. */
const KEEP_IMPORT_RUNS = 50;

/** The stages of a record that are well formed and inside the record's own window, oldest first, capped. */
function usableStages(raw: unknown[], startedAt: string, endedAt: string) {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  return raw
    .map((st) => stage.safeParse(st))
    .flatMap((r) => (r.success ? [r.data] : []))
    .filter((st) => Date.parse(st.startedAt) >= start && Date.parse(st.endedAt) <= end)
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
    .slice(0, MAX_STAGES_PER_SESSION);
}

export interface ImportSummary extends ActionState {
  added?: number;
  duplicates?: number;
  conflicts?: number;
  rejected?: number;
  /** Earlier imports that gained overnight measurements this time. */
  updated?: number;
  withVitals?: number;
}

/**
 * Store sleep records read from Apple Health / Health Connect on the device. Each record is checked like a manual
 * entry, skipped if that platform record was imported before, and skipped (never merged) if it overlaps anything
 * already stored; the counts are recorded so the member can see exactly what happened.
 */
export async function importSleepAction(input: unknown): Promise<ImportSummary> {
  const user = await requireUser();
  const [profile, supabase] = await Promise.all([getProfile(user.id), getServerSupabase()]);
  if (!profile?.wellness_consent_at) return actionError("Allow sleep logging first.");
  if (profile.sleep_import_enabled === false) return actionError("Health-platform import is switched off in your sleep settings.");
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return actionError("The sleep records from your phone couldn't be read. Please try again.");
  const v = parsed.data;
  const label = IMPORT_SOURCE_LABEL[v.source];
  if (Date.parse(v.rangeEnd) - Date.parse(v.rangeStart) > 93 * 86_400_000) return actionError("Import at most three months at a time.");

  const existing = await listSleepSessions(supabase, user.id, { fromNight: isoDateInTz(new Date(Date.parse(v.rangeStart) - 2 * 86_400_000), v.timezone) }).catch(() => []);
  const { data: knownIds } = await supabase.from("sleep_sessions").select("source_id").eq("user_id", user.id).eq("source", v.source).not("source_id", "is", null);
  const known = new Set(((knownIds ?? []) as { source_id: string }[]).map((r) => r.source_id));
  let added = 0;
  let duplicates = 0;
  let conflicts = 0;
  let rejected = 0;
  let updated = 0;
  let withVitals = 0;
  const now = Date.now();
  const stored: (SleepSessionTimes & { id: string })[] = existing.map((s) => ({ ...s }));

  let deviceSeen: string | null = null;
  for (const raw of v.sessions) {
    const one = session.safeParse(raw);
    if (!one.success) {
      rejected++;
      continue;
    }
    const s = one.data;
    deviceSeen ??= s.deviceName;
    if (known.has(s.sourceId)) {
      duplicates++;
      // A record imported before the device's measurements were read can still gain them; nothing else changes.
      if (hasVitals(s.vitals)) {
        const { data: filled } = await supabase
          .from("sleep_sessions")
          .update({ ...vitalColumns(s.vitals), device_name: s.deviceName })
          .eq("user_id", user.id)
          .eq("source", v.source)
          .eq("source_id", s.sourceId)
          .is("hr_avg", null)
          .is("hrv_avg_ms", null)
          .is("rr_avg", null)
          .select("id");
        if (filled?.length) {
          updated++;
          withVitals++;
        }
      }
      continue;
    }
    const times: SleepSessionTimes = { kind: "night", timezone: v.timezone, startedAt: s.startedAt, endedAt: s.endedAt, onsetAt: s.onsetAt, finalWakeAt: s.finalWakeAt, awakeMinutes: s.awakeMinutes, awakenings: s.awakenings };
    const check = validateSleepSession(times, now + 60_000);
    if (!check.ok || (Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 3_600_000 > MAX_IMPORT_HOURS) {
      rejected++;
      continue;
    }
    if (findOverlap(stored, times)) {
      conflicts++;
      continue;
    }
    const id = crypto.randomUUID();
    const { error } = await supabase.from("sleep_sessions").insert({
      id,
      user_id: user.id,
      kind: "night",
      started_at: s.startedAt,
      ended_at: s.endedAt,
      onset_at: s.onsetAt,
      final_wake_at: s.finalWakeAt,
      awakenings: s.awakenings,
      awake_minutes: s.awakeMinutes,
      timezone: v.timezone,
      night_of: nightOf(times),
      source: v.source,
      source_id: s.sourceId,
      device_name: s.deviceName,
      ...vitalColumns(s.vitals),
    });
    if (error) {
      if (error.code === "23505") duplicates++;
      else if (error.code === "23P01") conflicts++;
      else {
        logError("sleep.import.session", error);
        rejected++;
      }
      continue;
    }
    const stages = usableStages(s.stages, s.startedAt, s.endedAt);
    if (stages.length) {
      const { error: stageErr } = await supabase.from("sleep_stages").insert(stages.map((st) => ({ session_id: id, user_id: user.id, stage: st.stage, started_at: st.startedAt, ended_at: st.endedAt })));
      if (stageErr) logError("sleep.import.stages", stageErr);
    }
    stored.push({ id, ...times });
    known.add(s.sourceId);
    added++;
    if (hasVitals(s.vitals)) withVitals++;
  }

  const { error: runErr } = await supabase.from("sleep_import_runs").insert({ user_id: user.id, source: v.source, range_start: v.rangeStart, range_end: v.rangeEnd, added, duplicates, conflicts, updated, with_vitals: withVitals, device: deviceSeen });
  if (runErr) logError("sleep.import.run", runErr);
  else {
    // The platform answered with records, so it counts as connected from the first time it did.
    if (added || duplicates) {
      const { error: connErr } = await supabase
        .from("profiles")
        .update({ sleep_import_source: v.source, sleep_import_connected_at: profile.sleep_import_connected_at ?? new Date().toISOString() })
        .eq("id", user.id);
      if (connErr) logError("sleep.import.connect", connErr);
    }
    const { data: old } = await supabase.from("sleep_import_runs").select("id").eq("user_id", user.id).order("created_at", { ascending: false }).range(KEEP_IMPORT_RUNS, KEEP_IMPORT_RUNS + 200);
    if (old?.length) await supabase.from("sleep_import_runs").delete().eq("user_id", user.id).in("id", old.map((r) => r.id as string));
  }
  refresh();
  const parts = [`${added} added`];
  if (updated) parts.push(`${updated} gained overnight measurements`);
  if (duplicates - updated > 0) parts.push(`${duplicates - updated} already imported`);
  if (conflicts) parts.push(`${conflicts} skipped (overlap an entry you made)`);
  if (rejected) parts.push(`${rejected} couldn't be used`);
  return { ...actionOk(`${label}: ${parts.join(", ")}.`), added, duplicates, conflicts, rejected, updated, withVitals };
}

/** Switch automatic import on or off. Records already imported stay until deleted. */
export async function setSleepImportEnabledAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const enabled = formData.get("enabled") === "on";
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("profiles").update({ sleep_import_enabled: enabled }).eq("id", user.id);
  if (error) logError("sleep.import.toggle", error);
  refresh();
}

/**
 * Disconnect the health source: imports stop and the connection status clears. With `remove` on, every imported
 * session goes too (hand-entered and timer entries always stay). The phone's own health records are never touched.
 */
export async function disconnectSleepSourceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("profiles").update({ sleep_import_enabled: false, sleep_import_source: null, sleep_import_connected_at: null }).eq("id", user.id);
  if (error) logError("sleep.import.disconnect", error);
  if (formData.get("remove") === "on") {
    const { error: delErr } = await supabase.from("sleep_sessions").delete().eq("user_id", user.id).in("source", ["apple_health", "health_connect", "wearable"]);
    if (delErr) logError("sleep.import.disconnect_delete", delErr);
  }
  refresh();
}

/** Remove every imported session (and its stages and import records). Hand-entered and timer entries stay. */
export async function deleteImportedSleepAction(): Promise<void> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("sleep_sessions").delete().eq("user_id", user.id).in("source", ["apple_health", "health_connect", "wearable"]);
  if (error) logError("sleep.import.delete", error);
  const { error: runErr } = await supabase.from("sleep_import_runs").delete().eq("user_id", user.id);
  if (runErr) logError("sleep.import.delete_runs", runErr);
  refresh();
}
