/**
 * Comparisons over longer ranges (Sleep & Recovery, Stage C6, analytics version 1): weekday nights against weekend
 * nights, and the trend by week or by month. Everything is a plain summary of logged nights; a bucket with no
 * nights is shown as missing, never as zero sleep, and typical times need the same three nights a pattern needs.
 */
import { addDays } from "@/lib/domain/dates";
import type { NightSummary } from "@/lib/domain/sleep";
import { averageAsleepMinutes, scheduleStats } from "@/lib/domain/sleep-stats";

export const SLEEP_ANALYTICS_VERSION = 1;

/** A night belongs to the weekend when it ends (the member wakes) on a Saturday or Sunday: Friday night counts, Sunday night doesn't. */
export function isWeekendNight(nightOf: string): boolean {
  const day = new Date(`${nightOf}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export interface NightGroup {
  nights: number;
  avgAsleep: number | null;
  atGoal: number;
  /** Clock minutes, or null until three nights are in the group. */
  typicalBed: number | null;
  typicalWake: number | null;
}

export interface WeekdayWeekend {
  weekday: NightGroup;
  weekend: NightGroup;
  /** Weekend minus weekday, in minutes (positive = later at the weekend); null until both groups have typical times. */
  bedShift: number | null;
  wakeShift: number | null;
  /** Weekend minus weekday average time asleep; null until both groups have nights. */
  asleepDiff: number | null;
}

function group(nights: NightSummary[], goal: number): NightGroup {
  const s = scheduleStats(nights);
  return { nights: nights.length, avgAsleep: averageAsleepMinutes(nights), atGoal: nights.filter((n) => n.asleepMinutes >= goal).length, typicalBed: s.typicalBed, typicalWake: s.typicalWake };
}

/** Signed clock difference b − a in minutes, in −720..720, so 23:30 to 00:30 is +60 rather than −1380. */
export function clockShift(a: number, b: number): number {
  return ((((b - a + 720) % 1440) + 1440) % 1440) - 720;
}

export function weekdayWeekend(nights: NightSummary[], goal: number): WeekdayWeekend {
  const weekday = group(nights.filter((n) => !isWeekendNight(n.nightOf)), goal);
  const weekend = group(nights.filter((n) => isWeekendNight(n.nightOf)), goal);
  const both = (f: (g: NightGroup) => number | null): [number, number] | null => {
    const a = f(weekday);
    const b = f(weekend);
    return a === null || b === null ? null : [a, b];
  };
  const bed = both((g) => g.typicalBed);
  const wake = both((g) => g.typicalWake);
  const asleep = both((g) => g.avgAsleep);
  return {
    weekday,
    weekend,
    bedShift: bed ? clockShift(bed[0], bed[1]) : null,
    wakeShift: wake ? clockShift(wake[0], wake[1]) : null,
    asleepDiff: asleep ? asleep[1] - asleep[0] : null,
  };
}

export type TrendBucket = "week" | "month";

export interface TrendPoint {
  start: string;
  end: string;
  label: string;
  nights: number;
  avgAsleep: number | null;
  atGoal: number;
}

/** Nights grouped into consecutive 7-day blocks ending on `end`, or calendar months, oldest first; every block in the range is present even when empty. */
export function trend(nights: NightSummary[], start: string, end: string, bucket: TrendBucket, goal: number): TrendPoint[] {
  const out: TrendPoint[] = [];
  const point = (s: string, e: string, label: string) => {
    const inside = nights.filter((n) => n.nightOf >= s && n.nightOf <= e);
    out.push({ start: s, end: e, label, nights: inside.length, avgAsleep: averageAsleepMinutes(inside), atGoal: inside.filter((n) => n.asleepMinutes >= goal).length });
  };
  if (bucket === "week") {
    for (let e = end; e >= start; e = addDays(e, -7)) {
      const s = addDays(e, -6) < start ? start : addDays(e, -6);
      point(s, e, shortDate(s));
    }
    out.reverse();
  } else {
    let s = `${start.slice(0, 7)}-01`;
    while (s <= end) {
      const [y, m] = s.split("-").map(Number) as [number, number];
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const e = addDays(next, -1);
      point(s < start ? start : s, e > end ? end : e, new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }));
      s = next;
    }
  }
  return out;
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "45 min later", "about the same", "1h 10m earlier". */
export function describeShift(minutes: number | null, laterWord = "later", earlierWord = "earlier"): string {
  if (minutes === null) return "not enough nights";
  if (Math.abs(minutes) < 10) return "about the same";
  const abs = Math.abs(minutes);
  const text = abs >= 60 ? `${Math.floor(abs / 60)}h${abs % 60 ? ` ${abs % 60}m` : ""}` : `${abs} min`;
  return `${text} ${minutes > 0 ? laterWord : earlierWord}`;
}
