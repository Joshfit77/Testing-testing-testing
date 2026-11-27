/**
 * Pure helpers for runs and walks ("activities"): units, pace, moving time, weekly totals and
 * personal bests. Distances are stored in metres and durations in whole seconds; pace is always
 * computed here from distance and moving time (never stored), so there's one source of truth.
 */
import { isoDateInTz, startOfWeek } from "@/lib/domain/dates";
import type { UnitSystem } from "@/lib/domain/types";

export const METERS_PER_MILE = 1609.344;
export const METERS_PER_KM = 1000;

export type ActivityKind = "run" | "walk";
export type ActivitySource = "manual" | "treadmill" | "gps";
export type DistanceUnit = "mi" | "km";

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = { run: "Run", walk: "Walk" };
export const ACTIVITY_SOURCE_LABELS: Record<ActivitySource, string> = {
  manual: "Manual entry",
  treadmill: "Treadmill",
  gps: "GPS",
};

/** Limits shared by the form, the server action and the database check constraints. */
export const MAX_DISTANCE_M = 500_000;
export const MAX_ELAPSED_S = 172_800;
export const MAX_NOTES = 2000;

export const distanceUnitFor = (units: UnitSystem): DistanceUnit => (units === "imperial" ? "mi" : "km");
export const metersPer = (unit: DistanceUnit) => (unit === "mi" ? METERS_PER_MILE : METERS_PER_KM);

export const milesToMeters = (mi: number) => mi * METERS_PER_MILE;
export const metersToMiles = (m: number) => m / METERS_PER_MILE;
export const kmToMeters = (km: number) => km * METERS_PER_KM;
export const metersToKm = (m: number) => m / METERS_PER_KM;
export const milesToKm = (mi: number) => metersToKm(milesToMeters(mi));
export const kmToMiles = (km: number) => metersToMiles(kmToMeters(km));

/** A distance typed in `unit`, in metres rounded to the centimetre (the stored precision). */
export function toMeters(value: number, unit: DistanceUnit): number {
  return Math.round(value * metersPer(unit) * 100) / 100;
}

/** Metres expressed in `unit`. */
export function fromMeters(m: number, unit: DistanceUnit): number {
  return m / metersPer(unit);
}

/** "3.11 mi" / "5.00 km". Null distance (time-only entry) prints as an em dash. */
export function formatDistance(m: number | null | undefined, unit: DistanceUnit, decimals = 2): string {
  if (m == null || !Number.isFinite(m)) return "—";
  return `${fromMeters(m, unit).toFixed(decimals)} ${unit}`;
}

/**
 * Parse "h:mm:ss", "mm:ss" or plain minutes ("45") into seconds. Returns null for anything
 * malformed (non-numeric parts, minutes/seconds ≥ 60 after the first field, negative values).
 */
export function parseDuration(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const minutes = Number(s);
    return Number.isFinite(minutes) ? Math.round(minutes * 60) : null;
  }
  const parts = s.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  return parts.length === 3 ? nums[0]! * 3600 + nums[1]! * 60 + nums[2]! : nums[0]! * 60 + nums[1]!;
}

/** Seconds as "h:mm:ss" (always with hours, for form fields). */
export function formatHms(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Seconds per `unit` for a distance and a (moving) time; null when either is missing or zero. */
export function paceSecondsPer(distanceM: number | null | undefined, seconds: number, unit: DistanceUnit): number | null {
  if (distanceM == null || !Number.isFinite(distanceM) || distanceM <= 0 || !Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds / fromMeters(distanceM, unit);
}

/** "9:58 /mi". Rounds to the nearest second, carrying 60 s into the next minute. */
export function formatPace(secondsPerUnit: number | null | undefined, unit: DistanceUnit): string {
  if (secondsPerUnit == null || !Number.isFinite(secondsPerUnit) || secondsPerUnit <= 0) return "—";
  const total = Math.round(secondsPerUnit);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")} /${unit}`;
}

/** Average moving pace of an activity, formatted. Paused time is excluded because moving_s excludes it. */
export function formatMovingPace(a: { distance_m: number | null; moving_s: number }, unit: DistanceUnit): string {
  return formatPace(paceSecondsPer(a.distance_m, a.moving_s, unit), unit);
}

export interface TimeSegment {
  /** Epoch milliseconds. */
  start: number;
  end: number;
}

/**
 * Moving seconds from the recorded (un-paused) segments of a session. Overlapping or inverted
 * segments are tolerated: overlaps count once, inverted ones count zero. This is what live
 * tracking will store as moving_s, so paused time never lowers the average pace.
 */
export function movingSecondsFromSegments(segments: TimeSegment[]): number {
  const sorted = segments.filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start).sort((a, b) => a.start - b.start);
  let total = 0;
  let curStart = -Infinity;
  let curEnd = -Infinity;
  for (const s of sorted) {
    if (s.start > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = s.start;
      curEnd = s.end;
    } else curEnd = Math.max(curEnd, s.end);
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return Math.round(total / 1000);
}

/** Elapsed seconds minus paused seconds, never below zero or above elapsed. */
export function movingSeconds(elapsedS: number, pausedS: number): number {
  return Math.min(elapsedS, Math.max(0, elapsedS - Math.max(0, pausedS)));
}

// ---------------------------------------------------------------------------------------------
// Weekly totals
// ---------------------------------------------------------------------------------------------

export interface ActivityLike {
  id: string;
  kind: ActivityKind;
  source: ActivitySource;
  started_at: string;
  distance_m: number | null;
  elapsed_s: number;
  moving_s: number;
  deleted_at?: string | null;
}

export interface KindTotals {
  count: number;
  distanceM: number;
  movingS: number;
}
export interface WeekTotals {
  /** Monday of the week (ISO date) in the user's time zone. */
  weekStart: string;
  run: KindTotals;
  walk: KindTotals;
}

const emptyTotals = (): KindTotals => ({ count: 0, distanceM: 0, movingS: 0 });

/** The user's local calendar day for an activity start. */
export const activityDay = (startedAt: string, timeZone: string) => isoDateInTz(new Date(startedAt), timeZone);

/**
 * Totals per Monday-based week (in `timeZone`), runs and walks kept separate, newest week first.
 * Soft-deleted activities are ignored, so totals recalculate after an edit or delete.
 */
export function weeklyTotals(activities: ActivityLike[], timeZone: string): WeekTotals[] {
  const weeks = new Map<string, WeekTotals>();
  for (const a of activities) {
    if (a.deleted_at) continue;
    const weekStart = startOfWeek(activityDay(a.started_at, timeZone));
    let w = weeks.get(weekStart);
    if (!w) {
      w = { weekStart, run: emptyTotals(), walk: emptyTotals() };
      weeks.set(weekStart, w);
    }
    const t = w[a.kind];
    t.count += 1;
    t.distanceM += a.distance_m ?? 0;
    t.movingS += a.moving_s;
  }
  return [...weeks.values()].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}

/** Totals for one week (zeros when nothing was logged). */
export function totalsForWeek(activities: ActivityLike[], timeZone: string, weekStart: string): WeekTotals {
  return weeklyTotals(activities, timeZone).find((w) => w.weekStart === weekStart) ?? { weekStart, run: emptyTotals(), walk: emptyTotals() };
}

export interface DayActivity {
  day: string;
  runs: { count: number; distanceM: number };
  walks: { count: number; distanceM: number };
}

/** Per-day run and walk counts and distances for the given dates (in `timeZone`), in the given order. */
export function dailyActivity(activities: ActivityLike[], timeZone: string, days: string[]): DayActivity[] {
  const byDay = new Map(days.map((d) => [d, { day: d, runs: { count: 0, distanceM: 0 }, walks: { count: 0, distanceM: 0 } }]));
  for (const a of activities) {
    if (a.deleted_at) continue;
    const entry = byDay.get(activityDay(a.started_at, timeZone));
    if (!entry) continue;
    const t = a.kind === "run" ? entry.runs : entry.walks;
    t.count += 1;
    t.distanceM += a.distance_m ?? 0;
  }
  return days.map((d) => byDay.get(d)!);
}

// ---------------------------------------------------------------------------------------------
// Personal bests
// ---------------------------------------------------------------------------------------------

export type StandardDistance = "1mi" | "5k" | "10k";
export const STANDARD_DISTANCES: { id: StandardDistance; label: string; meters: number }[] = [
  { id: "1mi", label: "1 mile", meters: METERS_PER_MILE },
  { id: "5k", label: "5K", meters: 5000 },
  { id: "10k", label: "10K", meters: 10000 },
];

/**
 * An activity counts for a standard distance when it's a run covering that distance and at most
 * 3% more (GPS and treadmills overshoot slightly). Its moving time is used as-is, which is
 * slightly conservative. Longer runs don't count: without per-kilometre timing we can't know the
 * time at the 5K mark of a 7K run, and we never estimate one. Walks never count.
 */
export const PB_TOLERANCE = 0.03;

export function isEligibleForDistance(a: ActivityLike, meters: number): boolean {
  if (a.deleted_at || a.kind !== "run" || a.distance_m == null) return false;
  return a.distance_m >= meters && a.distance_m <= meters * (1 + PB_TOLERANCE) && a.moving_s > 0;
}

export interface PersonalBest {
  distance: StandardDistance;
  label: string;
  activityId: string;
  movingS: number;
  startedAt: string;
  source: ActivitySource;
  /** Manual and treadmill times are the user's own report; only GPS is measured by the app. */
  selfReported: boolean;
}

export interface PersonalBests {
  distance: StandardDistance;
  label: string;
  /** Fastest eligible time from any source (may be self-reported). */
  best: PersonalBest | null;
  /** Fastest GPS-recorded time, shown separately so self-reported times are never presented as measured. */
  bestGps: PersonalBest | null;
}

function toPb(a: ActivityLike, d: (typeof STANDARD_DISTANCES)[number]): PersonalBest {
  return { distance: d.id, label: d.label, activityId: a.id, movingS: a.moving_s, startedAt: a.started_at, source: a.source, selfReported: a.source !== "gps" };
}

/** Earliest wins a tie, so an older record isn't displaced by an equal time. */
function fastest(list: ActivityLike[]): ActivityLike | null {
  let best: ActivityLike | null = null;
  for (const a of list) {
    if (!best || a.moving_s < best.moving_s || (a.moving_s === best.moving_s && a.started_at < best.started_at)) best = a;
  }
  return best;
}

export function personalBests(activities: ActivityLike[]): PersonalBests[] {
  return STANDARD_DISTANCES.map((d) => {
    const eligible = activities.filter((a) => isEligibleForDistance(a, d.meters));
    const best = fastest(eligible);
    const bestGps = fastest(eligible.filter((a) => a.source === "gps"));
    return { distance: d.id, label: d.label, best: best ? toPb(best, d) : null, bestGps: bestGps ? toPb(bestGps, d) : null };
  });
}

// ---------------------------------------------------------------------------------------------
// Local date/time ↔ UTC
// ---------------------------------------------------------------------------------------------

/** Offset of `timeZone` from UTC at instant `utcMs`, in minutes (e.g. -240 for New York in summer). */
function tzOffsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - utcMs) / 60000);
}

/**
 * A wall-clock date ("2026-10-20") and time ("06:30") in `timeZone` as a UTC ISO string.
 * Returns null for malformed input or an unknown time zone. For a wall-clock time that is
 * skipped or repeated by a daylight-saving change, the earlier of the two candidate instants is used.
 */
export function localToUtcIso(date: string, time: string, timeZone: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dm || !tm) return null;
  const [y, mo, d, h, mi] = [Number(dm[1]), Number(dm[2]), Number(dm[3]), Number(tm[1]), Number(tm[2])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  if (new Date(naive).getUTCDate() !== d) return null;
  try {
    const first = naive - tzOffsetMinutes(naive, timeZone) * 60000;
    const second = naive - tzOffsetMinutes(first, timeZone) * 60000;
    return new Date(Math.min(first, second)).toISOString();
  } catch {
    return null;
  }
}

/** The wall-clock date and time ("HH:MM") of a UTC instant in `timeZone`, for prefilling forms. */
export function utcToLocalParts(iso: string, timeZone: string): { date: string; time: string } {
  const at = new Date(iso);
  let time: string;
  try {
    time = new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).format(at);
  } catch {
    time = at.toISOString().slice(11, 16);
  }
  return { date: isoDateInTz(at, timeZone), time };
}
