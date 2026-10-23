/**
 * Turning health-platform sleep records (Apple Health through HealthKit, Health Connect on Android, via the
 * @capgo/capacitor-health plugin) into the app's sessions and stage intervals (Sleep & Recovery, Stage B4). Pure
 * and unit-tested; the server does the deduplication and conflict checks against what is already stored.
 *
 * HealthKit returns a list of samples per sleep category (an "in bed" envelope and asleep/awake/stage segments) that
 * may overlap; Health Connect returns a session with stage segments. Both arrive as HealthSample-like objects here.
 */
import type { SleepSource } from "@/lib/domain/sleep";

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
}

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
}

function segmentsOf(sample: PlatformSleepSample): Segment[] {
  if (sample.stages?.length) {
    return sample.stages.map((s) => ({ start: ms(s.startDate), end: ms(s.endDate), stage: STAGE_MAP[s.stage] ?? null })).filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);
  }
  const start = ms(sample.startDate);
  const end = ms(sample.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  return [{ start, end, stage: sample.sleepState ? STAGE_MAP[sample.sleepState] : null }];
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
    const segs = g
      .flatMap((x) => x.segments)
      .filter((s) => s.stage !== null)
      .sort((a, b) => a.start - b.start) as (Segment & { stage: ImportedStage })[];
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
      deviceName: g.map((x) => x.sample.sourceName).find((n): n is string => Boolean(n)) ?? null,
    });
  }
  return out;
}

export const IMPORT_SOURCE_LABEL: Record<Extract<SleepSource, "apple_health" | "health_connect">, string> = { apple_health: "Apple Health", health_connect: "Health Connect" };
