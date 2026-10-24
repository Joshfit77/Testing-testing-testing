/**
 * Pure sleep calculations (Sleep & Recovery, Stage B1): durations, which night a session belongs to, validation and
 * overlap checks. Everything is computed on epoch milliseconds, so a daylight-saving change or travel never adds or
 * loses an hour; a session's stored time zone is only used for clock times and for the date a night belongs to.
 * The app's own entries only know when the member was in bed and, if they said so, when they think they fell asleep
 * and woke: nothing here estimates sleep stages or physiology. Method and versions: docs/SLEEP_METHOD.md.
 */
import { isoDateInTz } from "@/lib/domain/dates";

export const SLEEP_CALC_VERSION = 1;

export const SLEEP_GOAL_MIN_MINUTES = 240;
export const SLEEP_GOAL_MAX_MINUTES = 720;
export const DEFAULT_SLEEP_GOAL_MINUTES = 480;
export const MIN_SESSION_MINUTES = 5;
export const MAX_NIGHT_MINUTES = 24 * 60;
export const MAX_NAP_MINUTES = 6 * 60;
export const MAX_AWAKENINGS = 50;
/** How far back a session may be entered by hand. */
export const MAX_HISTORY_DAYS = 3 * 366;
/** A running timer that was never stopped counts as this long for overlap checks, and is closed after it. */
export const TIMER_AUTO_CLOSE_HOURS = 20;
/** Sessions a member may keep (about ten years of nights and naps). */
export const MAX_SESSIONS_PER_USER = 4000;

export const SLEEP_KINDS = ["night", "nap"] as const;
export type SleepKind = (typeof SLEEP_KINDS)[number];

export const SLEEP_SOURCES = ["manual", "timer", "apple_health", "health_connect", "wearable"] as const;
export type SleepSource = (typeof SLEEP_SOURCES)[number];
export const SLEEP_SOURCE_LABELS: Record<SleepSource, string> = {
  manual: "Entered by hand",
  timer: "Sleep timer",
  apple_health: "Apple Health",
  health_connect: "Health Connect",
  wearable: "Wearable",
};
/** Sources whose records the app imports (they carry a source id and may bring stage intervals). */
export const IMPORTED_SOURCES: readonly SleepSource[] = ["apple_health", "health_connect", "wearable"];

export interface SleepSessionTimes {
  /** Got into bed (ISO 8601). */
  startedAt: string;
  /** Got out of bed; null while the timer is running. */
  endedAt: string | null;
  /** Estimated time of falling asleep, if the member gave one. */
  onsetAt?: string | null;
  /** Final wake-up, if different from getting up. */
  finalWakeAt?: string | null;
  awakenings?: number | null;
  /** Minutes awake during the night, if the member gave them. */
  awakeMinutes?: number | null;
  /** IANA time zone the session was logged in. */
  timezone: string;
  kind: SleepKind;
}

/** One overnight measurement series summarised: average, lowest, highest and how many samples the device recorded. */
export interface VitalStat {
  avg: number;
  min: number;
  max: number;
  samples: number;
}

/**
 * Overnight measurements a wearable recorded and the health platform shared, summarised over the session. Never
 * computed by the app itself: null means the device didn't record it or the member didn't allow it.
 */
export interface SleepVitals {
  heartRate: VitalStat | null;
  /** HealthKit gives SDNN, Health Connect RMSSD; the two aren't comparable, so the method travels with the number. */
  hrv: { avgMs: number; samples: number; method: "sdnn" | "rmssd" } | null;
  respiratoryRate: VitalStat | null;
}

export const HRV_METHOD_LABEL: Record<"sdnn" | "rmssd", string> = { sdnn: "SDNN", rmssd: "RMSSD" };

export function hasVitals(v: SleepVitals | null | undefined): v is SleepVitals {
  return Boolean(v && (v.heartRate || v.hrv || v.respiratoryRate));
}

export interface SleepSession extends SleepSessionTimes {
  id: string;
  source: SleepSource;
  nightOf: string;
  notes?: string | null;
  /** The watch, ring or app the platform attributed an imported record to. */
  deviceName?: string | null;
  vitals?: SleepVitals | null;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export function parseIso(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/** Whole minutes from `a` to `b` (negative when `b` is earlier). */
export function minutesBetween(a: string, b: string): number {
  const ta = parseIso(a);
  const tb = parseIso(b);
  if (ta === null || tb === null) return 0;
  return Math.round((tb - ta) / MINUTE_MS);
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export type SleepValidation = { ok: true } | { ok: false; message: string; field?: string };

/** Checks a session the member is saving. `now` is injectable for tests. */
export function validateSleepSession(t: SleepSessionTimes, now = Date.now()): SleepValidation {
  const start = parseIso(t.startedAt);
  if (start === null) return { ok: false, message: "Enter when you went to bed.", field: "startedAt" };
  if (!isValidTimeZone(t.timezone)) return { ok: false, message: "Unknown time zone.", field: "timezone" };
  if (start > now + 5 * MINUTE_MS) return { ok: false, message: "Bedtime can't be in the future.", field: "startedAt" };
  if (start < now - MAX_HISTORY_DAYS * 24 * HOUR_MS) return { ok: false, message: "Sleep can be entered for the last three years.", field: "startedAt" };
  const end = t.endedAt === null ? null : parseIso(t.endedAt);
  if (t.endedAt !== null && end === null) return { ok: false, message: "Enter when you got up.", field: "endedAt" };
  if (end !== null) {
    const minutes = (end - start) / MINUTE_MS;
    if (minutes < MIN_SESSION_MINUTES) return { ok: false, message: "Getting up must be after bedtime (at least 5 minutes).", field: "endedAt" };
    const max = t.kind === "nap" ? MAX_NAP_MINUTES : MAX_NIGHT_MINUTES;
    if (minutes > max) return { ok: false, message: t.kind === "nap" ? "A nap can be at most 6 hours. Log longer sleep as a night." : "A night can be at most 24 hours.", field: "endedAt" };
    if (end > now + 5 * MINUTE_MS) return { ok: false, message: "Wake-up time can't be in the future.", field: "endedAt" };
  }
  const onset = t.onsetAt ? parseIso(t.onsetAt) : null;
  if (t.onsetAt && onset === null) return { ok: false, message: "Enter a valid time for falling asleep.", field: "onsetAt" };
  if (onset !== null && (onset < start || (end !== null && onset > end))) return { ok: false, message: "Falling asleep must be between bedtime and getting up.", field: "onsetAt" };
  const wake = t.finalWakeAt ? parseIso(t.finalWakeAt) : null;
  if (t.finalWakeAt && wake === null) return { ok: false, message: "Enter a valid final wake-up time.", field: "finalWakeAt" };
  if (wake !== null && (wake < (onset ?? start) || (end !== null && wake > end))) return { ok: false, message: "The final wake-up must be after falling asleep and before getting up.", field: "finalWakeAt" };
  if (t.awakenings != null && (!Number.isInteger(t.awakenings) || t.awakenings < 0 || t.awakenings > MAX_AWAKENINGS)) return { ok: false, message: "Awakenings must be a whole number up to 50.", field: "awakenings" };
  if (t.awakeMinutes != null) {
    if (!Number.isInteger(t.awakeMinutes) || t.awakeMinutes < 0) return { ok: false, message: "Minutes awake must be a whole number.", field: "awakeMinutes" };
    const spanEnd = wake ?? end;
    if (spanEnd !== null && t.awakeMinutes > (spanEnd - (onset ?? start)) / MINUTE_MS) return { ok: false, message: "Minutes awake can't be longer than the night itself.", field: "awakeMinutes" };
  }
  return { ok: true };
}

/**
 * The local date a session is listed under: the day the member got up ("last night" shows on the morning after).
 * A session still running is provisionally listed under the date eight hours after bedtime.
 */
export function nightOf(t: Pick<SleepSessionTimes, "startedAt" | "endedAt" | "timezone">): string {
  const end = t.endedAt ? parseIso(t.endedAt) : null;
  const start = parseIso(t.startedAt) ?? Date.now();
  return isoDateInTz(new Date(end ?? start + 8 * HOUR_MS), t.timezone);
}

export interface SleepDurations {
  /** Null while the session is still running. */
  inBedMinutes: number | null;
  asleepMinutes: number | null;
  /** True when nothing but bed and getting-up times are known, so "asleep" is simply time in bed. */
  asleepEstimated: boolean;
  latencyMinutes: number | null;
  /** Asleep ÷ in bed, only when the member gave onset, final wake or awake minutes. */
  efficiencyPct: number | null;
}

export function sleepDurations(t: SleepSessionTimes): SleepDurations {
  if (!t.endedAt) return { inBedMinutes: null, asleepMinutes: null, asleepEstimated: true, latencyMinutes: null, efficiencyPct: null };
  const inBed = minutesBetween(t.startedAt, t.endedAt);
  const onset = t.onsetAt ?? t.startedAt;
  const wake = t.finalWakeAt ?? t.endedAt;
  const awake = t.awakeMinutes ?? 0;
  const asleep = Math.max(0, minutesBetween(onset, wake) - awake);
  const hasDetail = Boolean(t.onsetAt || t.finalWakeAt || t.awakeMinutes != null);
  return {
    inBedMinutes: inBed,
    asleepMinutes: asleep,
    asleepEstimated: !hasDetail,
    latencyMinutes: t.onsetAt ? minutesBetween(t.startedAt, t.onsetAt) : null,
    efficiencyPct: hasDetail && inBed > 0 ? Math.round((asleep / inBed) * 100) : null,
  };
}

type Interval = Pick<SleepSessionTimes, "startedAt" | "endedAt">;

function intervalOf(s: Interval): [number, number] {
  const start = parseIso(s.startedAt) ?? 0;
  const end = s.endedAt ? (parseIso(s.endedAt) ?? start) : start + TIMER_AUTO_CLOSE_HOURS * HOUR_MS;
  return [start, end];
}

/** Half-open intervals: a session that ends exactly when the next begins does not overlap it. */
export function overlaps(a: Interval, b: Interval): boolean {
  const [as, ae] = intervalOf(a);
  const [bs, be] = intervalOf(b);
  return as < be && bs < ae;
}

export function findOverlap<T extends Interval & { id: string }>(sessions: T[], candidate: Interval, excludeId?: string): T | null {
  return sessions.find((s) => s.id !== excludeId && overlaps(s, candidate)) ?? null;
}

/** A zone Intl accepts, or UTC: a stored zone can only be wrong through a direct database write, and a page must not crash on it. */
function safeZone(timeZone: string): string {
  return isValidTimeZone(timeZone) ? timeZone : "UTC";
}

/** Minutes since local midnight (0–1439) of an instant in a time zone. */
export function clockMinutesInTz(iso: string, timeZone: string): number {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: safeZone(timeZone), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** Minutes east of UTC that `timeZone` was at instant `t`. */
export function tzOffsetMinutes(t: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: safeZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(t / 1000) * 1000) / MINUTE_MS);
}

/**
 * The instant a wall-clock time ("2026-10-22T22:30", as a datetime-local field gives it) means in a time zone.
 * When clocks go back and a time happens twice, the earlier one is used; a time skipped when clocks go forward
 * rolls on to the next valid instant. Returns null for malformed input.
 */
export function zonedTimeToIso(local: string, timeZone: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m || !isValidTimeZone(timeZone)) return null;
  const [y, mo, d, h, mi, s] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  // A day that doesn't exist (30 February) rolls into the next month: reject it.
  if (!Number.isFinite(wall) || new Date(wall).getUTCMonth() !== mo - 1) return null;
  const candidates = new Set<number>();
  for (const probe of [wall - 24 * HOUR_MS, wall, wall + 24 * HOUR_MS]) candidates.add(wall - tzOffsetMinutes(probe, timeZone) * MINUTE_MS);
  const exact = [...candidates].filter((t) => wall - tzOffsetMinutes(t, timeZone) * MINUTE_MS === t).sort((a, b) => a - b);
  if (exact.length) return new Date(exact[0]!).toISOString();
  // A skipped time: take the offset in force just before it, which lands on the next valid clock time.
  const before = wall - tzOffsetMinutes(wall - HOUR_MS - tzOffsetMinutes(wall, timeZone) * MINUTE_MS, timeZone) * MINUTE_MS;
  return new Date(before).toISOString();
}

/** An instant as a datetime-local field value ("2026-10-22T22:30") in a time zone. */
export function isoToLocalInput(iso: string, timeZone: string): string {
  const t = parseIso(iso);
  if (t === null) return "";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${String(Number(get("hour")) % 24).padStart(2, "0")}:${get("minute")}`;
}

export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

/** Shortest distance around the clock between two clock times, in minutes. */
export function circularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 1440;
  return Math.min(d, 1440 - d);
}

/**
 * The clock time nearest to all the others (the value with the smallest total circular distance), so bedtimes that
 * straddle midnight (11:30 PM, 12:30 AM) average to around midnight rather than to noon.
 */
export function circularMedianMinutes(values: number[]): number | null {
  if (!values.length) return null;
  let best: number | null = null;
  let bestSum = Number.POSITIVE_INFINITY;
  for (const v of values) {
    const sum = values.reduce((acc, w) => acc + circularDistance(v, w), 0);
    if (sum < bestSum) {
      bestSum = sum;
      best = v;
    }
  }
  return best;
}

/** Average distance from a centre, in minutes: how much a bedtime or wake time moves from night to night. */
export function circularSpreadMinutes(values: number[], center: number): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((acc, v) => acc + circularDistance(v, center), 0) / values.length);
}

export interface NightSummary {
  nightOf: string;
  sessions: SleepSession[];
  /** Earliest bedtime and latest getting-up time of the night's sessions. */
  bedAt: string;
  wakeAt: string;
  timezone: string;
  inBedMinutes: number;
  asleepMinutes: number;
  asleepEstimated: boolean;
  latencyMinutes: number | null;
  efficiencyPct: number | null;
  awakenings: number | null;
  /** The sources the night's sessions came from, for the data-source label. */
  sources: SleepSource[];
  /** True when every session of the night came from a health platform or wearable (nothing entered by hand). */
  recorded: boolean;
  deviceName: string | null;
  /** Overnight measurements from the recording device, from the session that carried the most heart-rate samples. */
  vitals: SleepVitals | null;
}

/** Finished nights (not naps) grouped by the date they belong to, newest first. A night split into two logged sessions is added up. */
export function summarizeNights(sessions: SleepSession[]): NightSummary[] {
  const byNight = new Map<string, SleepSession[]>();
  for (const s of sessions) {
    if (s.kind !== "night" || !s.endedAt) continue;
    const list = byNight.get(s.nightOf) ?? [];
    list.push(s);
    byNight.set(s.nightOf, list);
  }
  const out: NightSummary[] = [];
  for (const [night, list] of byNight) {
    list.sort((a, b) => (parseIso(a.startedAt) ?? 0) - (parseIso(b.startedAt) ?? 0));
    const first = list[0]!;
    const last = list.reduce((acc, s) => ((parseIso(s.endedAt) ?? 0) > (parseIso(acc.endedAt) ?? 0) ? s : acc), first);
    const parts = list.map(sleepDurations);
    const inBed = parts.reduce((acc, p) => acc + (p.inBedMinutes ?? 0), 0);
    const asleep = parts.reduce((acc, p) => acc + (p.asleepMinutes ?? 0), 0);
    const estimated = parts.every((p) => p.asleepEstimated);
    const awakeningsKnown = list.some((s) => s.awakenings != null);
    const awakenings = awakeningsKnown ? list.reduce((acc, s) => acc + (s.awakenings ?? 0), 0) + Math.max(0, list.length - 1) : null;
    const latency = parts[0]?.latencyMinutes ?? null;
    out.push({
      nightOf: night,
      sessions: list,
      bedAt: first.startedAt,
      wakeAt: last.endedAt!,
      timezone: last.timezone,
      inBedMinutes: inBed,
      asleepMinutes: asleep,
      asleepEstimated: estimated,
      latencyMinutes: latency,
      efficiencyPct: estimated || inBed <= 0 ? null : Math.round((asleep / inBed) * 100),
      awakenings,
      sources: [...new Set(list.map((s) => s.source))],
      recorded: list.every((s) => IMPORTED_SOURCES.includes(s.source)),
      deviceName: list.map((s) => s.deviceName).find((d): d is string => Boolean(d)) ?? null,
      vitals: list.filter((s) => hasVitals(s.vitals)).sort((a, b) => (b.vitals?.heartRate?.samples ?? 0) - (a.vitals?.heartRate?.samples ?? 0))[0]?.vitals ?? null,
    });
  }
  return out.sort((a, b) => (a.nightOf < b.nightOf ? 1 : -1));
}

/** Naps of one local date, newest first. */
export function napsOn(sessions: SleepSession[], date: string): SleepSession[] {
  return sessions.filter((s) => s.kind === "nap" && s.endedAt && s.nightOf === date).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}
