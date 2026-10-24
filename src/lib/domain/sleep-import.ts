/**
 * Turning health-platform sleep records (Apple Health through HealthKit, Health Connect on Android, via the
 * @capgo/capacitor-health plugin) into the app's sessions and stage intervals (Sleep & Recovery, Stage B4). Pure
 * and unit-tested; the server does the deduplication and conflict checks against what is already stored.
 *
 * HealthKit returns a list of samples per sleep category (an "in bed" envelope and asleep/awake/stage segments) that
 * may overlap; Health Connect returns a session with stage segments. Both arrive as HealthSample-like objects here.
 */
import type { SleepSource, SleepVitals, VitalStat } from "@/lib/domain/sleep";

export type PlatformSleepState = "inBed" | "asleep" | "awake" | "rem" | "deep" | "light";

export interface PlatformSleepSample {
  startDate: string;
  endDate: string;
  sleepState?: PlatformSleepState;
  stages?: { startDate: string; endDate: string; stage: PlatformSleepState }[];
  platformId?: string;
  sourceName?: string;
}

export type ImportedStage = "awake" | "light" | "deep" | "rem" | "asleep";

export interface ImportedSession {
  /** Stable id within the source (the platform's record id, or a fingerprint of the times). */
  sourceId: string;
  startedAt: string;
  endedAt: string;
  onsetAt: string | null;
  finalWakeAt: string | null;
  awakeMinutes: number | null;
  awakenings: number | null;
  stages: { stage: ImportedStage; startedAt: string; endedAt: string }[];
  deviceName: string | null;
  /** Filled in by the native layer when the platform shared overnight measurements. */
  vitals?: SleepVitals | null;
}

/** A measurement sample from the health platform (heart rate in bpm, HRV in ms, respiratory rate in breaths/min). */
export interface PlatformVitalSample {
  startDate: string;
  endDate?: string;
  value: number;
  sourceName?: string;
}

/** Plausible ranges; anything outside is a unit mix-up or a sensor glitch and is left out rather than averaged in. */
export const VITAL_RANGES = { heartRate: [20, 250], hrv: [1, 500], respiratoryRate: [4, 60] } as const;

/** Samples closer together than this are one night. */
export const MERGE_GAP_MINUTES = 30;
/** A record shorter than this is noise, not sleep. */
export const MIN_IMPORT_MINUTES = 10;
export const MAX_IMPORT_HOURS = 24;

const ms = (iso: string) => Date.parse(iso);
const STAGE_MAP: Record<PlatformSleepState, ImportedStage | null> = { inBed: null, asleep: "asleep", awake: "awake", rem: "rem", deep: "deep", light: "light" };

interface Segment {
  start: number;
  end: number;
  stage: ImportedStage | null;
  source: string;
}

function segmentsOf(sample: PlatformSleepSample): Segment[] {
  const source = sample.sourceName ?? "";
  if (sample.stages?.length) {
    return sample.stages.map((s) => ({ start: ms(s.startDate), end: ms(s.endDate), stage: STAGE_MAP[s.stage] ?? null, source })).filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);
  }
  const start = ms(sample.startDate);
  const end = ms(sample.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  return [{ start, end, stage: sample.sleepState ? STAGE_MAP[sample.sleepState] : null, source }];
}

/**
 * Stage intervals must not overlap, or stage totals double-count. HealthKit's "in bed" envelope is already set
 * aside (it isn't a stage); this keeps one writer per night (the source with the most stage time, so a watch wins
 * over a phone's bare "asleep" record) and clips any remaining same-source overlap to the earlier interval.
 */
function oneSourceNoOverlap(segs: (Segment & { stage: ImportedStage })[]): { segs: (Segment & { stage: ImportedStage })[]; source: string | null } {
  if (!segs.length) return { segs, source: null };
  // Rank the named sources: real stage detail (light/deep/REM) beats a bare asleep/awake record, then more minutes wins.
  const bySource = new Map<string, { minutes: number; detail: boolean }>();
  for (const s of segs) {
    if (!s.source) continue;
    const cur = bySource.get(s.source) ?? { minutes: 0, detail: false };
    bySource.set(s.source, { minutes: cur.minutes + (s.end - s.start), detail: cur.detail || s.stage === "light" || s.stage === "deep" || s.stage === "rem" });
  }
  const ranked = [...bySource.entries()].sort((a, b) => Number(b[1].detail) - Number(a[1].detail) || b[1].minutes - a[1].minutes);
  const source = ranked[0]?.[0] ?? null;
  // Segments without a source name can't be told apart, so they stay with the winner.
  const kept = segs.filter((x) => !x.source || x.source === source);
  const out: (Segment & { stage: ImportedStage })[] = [];
  let cursor = -Infinity;
  for (const s of kept.sort((a, b) => a.start - b.start || a.end - b.end)) {
    const start = Math.max(s.start, cursor);
    if (s.end <= start) continue;
    out.push({ ...s, start });
    cursor = s.end;
  }
  return { segs: out, source };
}

function fingerprint(start: number, end: number): string {
  return `t:${new Date(start).toISOString()}:${new Date(end).toISOString()}`;
}

/**
 * Group overlapping or near-adjacent samples into sessions and derive the figures the app shows. Stage segments are
 * kept exactly as the platform gave them (gaps stay gaps). Onset is the first non-awake segment, the final wake-up
 * the end of the last one; awake minutes and awakenings count the awake segments in between.
 */
export function samplesToSessions(samples: PlatformSleepSample[]): ImportedSession[] {
  const items = samples
    .map((s) => ({ sample: s, segments: segmentsOf(s) }))
    .filter((x) => x.segments.length)
    .map((x) => ({ ...x, start: Math.min(...x.segments.map((s) => s.start)), end: Math.max(...x.segments.map((s) => s.end)) }))
    .sort((a, b) => a.start - b.start);
  const groups: (typeof items)[] = [];
  for (const it of items) {
    const g = groups[groups.length - 1];
    if (g && it.start - Math.max(...g.map((x) => x.end)) <= MERGE_GAP_MINUTES * 60_000) g.push(it);
    else groups.push([it]);
  }
  const out: ImportedSession[] = [];
  for (const g of groups) {
    const start = Math.min(...g.map((x) => x.start));
    const end = Math.max(...g.map((x) => x.end));
    const minutes = (end - start) / 60_000;
    if (minutes < MIN_IMPORT_MINUTES || minutes > MAX_IMPORT_HOURS * 60) continue;
    const picked = oneSourceNoOverlap(g.flatMap((x) => x.segments).filter((s): s is Segment & { stage: ImportedStage } => s.stage !== null));
    const segs = picked.segs;
    const sleeping = segs.filter((s) => s.stage !== "awake");
    const onset = sleeping.length ? Math.min(...sleeping.map((s) => s.start)) : null;
    const finalWake = sleeping.length ? Math.max(...sleeping.map((s) => s.end)) : null;
    const awakeInside = onset !== null && finalWake !== null ? segs.filter((s) => s.stage === "awake" && s.start >= onset && s.end <= finalWake) : [];
    const awakeMinutes = awakeInside.length ? Math.round(awakeInside.reduce((acc, s) => acc + (s.end - s.start), 0) / 60_000) : sleeping.length ? 0 : null;
    const ids = g.map((x) => x.sample.platformId).filter((id): id is string => Boolean(id));
    out.push({
      sourceId: ids.length ? `p:${ids.sort()[0]}` : fingerprint(start, end),
      startedAt: new Date(start).toISOString(),
      endedAt: new Date(end).toISOString(),
      onsetAt: onset !== null && onset > start ? new Date(onset).toISOString() : null,
      finalWakeAt: finalWake !== null && finalWake < end ? new Date(finalWake).toISOString() : null,
      awakeMinutes,
      awakenings: sleeping.length ? awakeInside.length : null,
      stages: segs.map((s) => ({ stage: s.stage, startedAt: new Date(s.start).toISOString(), endedAt: new Date(s.end).toISOString() })),
      // The device that recorded the stages names the night; otherwise whichever record named one.
      deviceName: picked.source ?? g.map((x) => x.sample.sourceName).find((n): n is string => Boolean(n)) ?? null,
    });
  }
  return out;
}

function stat(samples: PlatformVitalSample[], start: number, end: number, [lo, hi]: readonly [number, number], decimals: number): VitalStat | null {
  const values = samples
    .filter((s) => {
      const a = ms(s.startDate);
      const b = s.endDate ? ms(s.endDate) : a;
      if (!Number.isFinite(a)) return false;
      const mid = Number.isFinite(b) ? (a + b) / 2 : a;
      return mid >= start && mid <= end && Number.isFinite(s.value) && s.value >= lo && s.value <= hi;
    })
    .map((s) => s.value);
  if (!values.length) return null;
  const f = 10 ** decimals;
  const r = (n: number) => Math.round(n * f) / f;
  return { avg: r(values.reduce((acc, v) => acc + v, 0) / values.length), min: r(Math.min(...values)), max: r(Math.max(...values)), samples: values.length };
}

/**
 * Overnight measurements inside one session, from the platform's samples: heart rate (bpm, whole numbers), HRV (ms,
 * one decimal, with the platform's method) and respiratory rate (breaths per minute, one decimal). A sample counts
 * when its midpoint falls inside the session. Nothing is estimated: a series with no samples is null.
 */
export function summarizeVitals(
  startedAt: string,
  endedAt: string,
  samples: { heartRate?: PlatformVitalSample[]; hrv?: PlatformVitalSample[]; respiratoryRate?: PlatformVitalSample[] },
  hrvMethod: "sdnn" | "rmssd",
): SleepVitals | null {
  const start = ms(startedAt);
  const end = ms(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const heartRate = stat(samples.heartRate ?? [], start, end, VITAL_RANGES.heartRate, 0);
  const hrvStat = stat(samples.hrv ?? [], start, end, VITAL_RANGES.hrv, 1);
  const respiratoryRate = stat(samples.respiratoryRate ?? [], start, end, VITAL_RANGES.respiratoryRate, 1);
  if (!heartRate && !hrvStat && !respiratoryRate) return null;
  return { heartRate, hrv: hrvStat ? { avgMs: hrvStat.avg, samples: hrvStat.samples, method: hrvMethod } : null, respiratoryRate };
}

export const IMPORT_SOURCE_LABEL: Record<Extract<SleepSource, "apple_health" | "health_connect">, string> = { apple_health: "Apple Health", health_connect: "Health Connect" };
