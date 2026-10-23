/**
 * Suggested sleep windows and schedule guidance, version 1 (Sleep & Recovery, Stage C1). Worked out from the
 * member's own bedtimes, wake times and goal; nothing here measures circadian phase. With fewer than three nights
 * (and no chosen wake time) only consistency guidance is given, never a precise window. Method: docs/SLEEP_METHOD.md.
 */
import { circularDistance, circularMedianMinutes, clockMinutesInTz, type NightSummary } from "@/lib/domain/sleep";
import { MIN_NIGHTS_FOR_PATTERN, scheduleStats, type ScheduleStats } from "@/lib/domain/sleep-stats";

export const SLEEP_SCHEDULE_VERSION = 1;
/** Fallback time to fall asleep when the member never entered one. */
export const DEFAULT_LATENCY_MINUTES = 15;
/** Minutes to settle after getting into bed, before the time asleep is expected to start. */
export const SETTLE_MINUTES = 10;
export const BED_WINDOW_HALF = 30;
export const WAKE_WINDOW_HALF = 15;
/** Largest nightly shift suggested when moving towards a new bedtime. */
export const SHIFT_PER_NIGHT = 15;

export interface ClockWindow {
  start: number;
  end: number;
}

export interface Adjustment {
  fromBed: number;
  toBed: number;
  direction: "earlier" | "later";
  minutesPerNight: number;
  nights: number;
}

export interface SleepWindows {
  version: typeof SLEEP_SCHEDULE_VERSION;
  nights: number;
  /** The wake time the windows hang off: the member's chosen target, else their typical wake time. */
  anchorWake: number | null;
  anchorSource: "target" | "typical" | null;
  latencyMinutes: number;
  wakeWindow: ClockWindow | null;
  bedWindow: ClockWindow | null;
  pattern: ScheduleStats;
  /** 0–100: how steady bed and wake times have been (100 = within a few minutes every night). */
  consistency: number | null;
  /** Difference between typical weekday and weekend wake times, when both have three nights. */
  weekendShift: { minutes: number; weekdayWake: number; weekendWake: number } | null;
  adjustment: Adjustment | null;
  guidance: string[];
}

const wrap = (m: number) => ((Math.round(m) % 1440) + 1440) % 1440;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

function isWeekend(nightOf: string): boolean {
  // The night listed under a Saturday or Sunday morning is a weekend night.
  const d = new Date(`${nightOf}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
}

export function consistencyScore(p: ScheduleStats): number | null {
  if (p.bedSpread === null || p.wakeSpread === null) return null;
  const avg = (p.bedSpread + p.wakeSpread) / 2;
  return Math.round(100 * (1 - Math.min(1, avg / 120)));
}

export function sleepWindows(nights: NightSummary[], goalMinutes: number, targetWake: number | null = null): SleepWindows {
  const pattern = scheduleStats(nights);
  const latencies = nights.flatMap((n) => (n.latencyMinutes === null ? [] : [n.latencyMinutes]));
  const latency = median(latencies) ?? DEFAULT_LATENCY_MINUTES;
  const anchorWake = targetWake ?? pattern.typicalWake;
  const anchorSource: SleepWindows["anchorSource"] = targetWake !== null ? "target" : pattern.typicalWake !== null ? "typical" : null;
  const guidance: string[] = [];

  let wakeWindow: ClockWindow | null = null;
  let bedWindow: ClockWindow | null = null;
  let adjustment: Adjustment | null = null;
  if (anchorWake !== null) {
    wakeWindow = { start: wrap(anchorWake - WAKE_WINDOW_HALF), end: wrap(anchorWake + WAKE_WINDOW_HALF) };
    const bedCenter = wrap(anchorWake - goalMinutes - latency - SETTLE_MINUTES);
    bedWindow = { start: wrap(bedCenter - BED_WINDOW_HALF), end: wrap(bedCenter + BED_WINDOW_HALF) };
    if (pattern.typicalBed !== null) {
      const gap = circularDistance(pattern.typicalBed, bedCenter);
      if (gap > BED_WINDOW_HALF) {
        // Is the centre earlier or later than the usual bedtime, going the short way round the clock?
        const earlier = wrap(pattern.typicalBed - bedCenter) <= 720;
        adjustment = { fromBed: pattern.typicalBed, toBed: bedCenter, direction: earlier ? "earlier" : "later", minutesPerNight: SHIFT_PER_NIGHT, nights: Math.ceil(gap / SHIFT_PER_NIGHT) };
        guidance.push(`Move bedtime ${earlier ? "earlier" : "later"} by about ${SHIFT_PER_NIGHT} minutes a night rather than all at once; ${adjustment.nights} nights gets you there.`);
      }
    }
  }

  let weekendShift: SleepWindows["weekendShift"] = null;
  const weekdayWakes = nights.filter((n) => !isWeekend(n.nightOf)).map((n) => clockMinutesInTz(n.wakeAt, n.timezone));
  const weekendWakes = nights.filter((n) => isWeekend(n.nightOf)).map((n) => clockMinutesInTz(n.wakeAt, n.timezone));
  if (weekdayWakes.length >= MIN_NIGHTS_FOR_PATTERN && weekendWakes.length >= MIN_NIGHTS_FOR_PATTERN) {
    const wd = circularMedianMinutes(weekdayWakes)!;
    const we = circularMedianMinutes(weekendWakes)!;
    weekendShift = { minutes: circularDistance(wd, we), weekdayWake: wd, weekendWake: we };
    if (weekendShift.minutes > 60) guidance.push(`Your weekend wake time is about ${Math.round(weekendShift.minutes / 15) * 15} minutes from your weekday one. Keeping it within an hour makes Monday mornings easier.`);
  }

  if (anchorSource === null) guidance.unshift(`Log ${Math.max(0, MIN_NIGHTS_FOR_PATTERN - pattern.nights)} more ${MIN_NIGHTS_FOR_PATTERN - pattern.nights === 1 ? "night" : "nights"} (or set a wake time you want to keep) and a suggested window appears here. Until then, the single most useful habit is getting up at about the same time every day.`);
  else if (pattern.steadiness === "irregular") guidance.push("Your wake time moves by more than an hour night to night. Fix the wake time first; bedtime tends to follow within a week or two.");
  else if (pattern.steadiness === "variable") guidance.push("Keeping your wake time inside its window every day, including weekends, is the easiest way to make your bedtime feel natural.");
  else if (pattern.steadiness === "steady") guidance.push("Your rhythm is steady. Keep the wake time where it is; adjust bedtime only if you're short of your goal.");

  return { version: SLEEP_SCHEDULE_VERSION, nights: pattern.nights, anchorWake, anchorSource, latencyMinutes: latency, wakeWindow, bedWindow, pattern, consistency: consistencyScore(pattern), weekendShift, adjustment, guidance };
}
