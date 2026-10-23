/**
 * Summaries over several nights (Sleep & Recovery, Stage B2): a strip of recent nights with gaps kept as gaps, the
 * member's typical bedtime and wake time with how much they move, and goal completion. All deterministic and
 * computed from logged sessions; a night without data is shown as missing, never as zero sleep.
 */
import { addDays } from "@/lib/domain/dates";
import { circularMedianMinutes, circularSpreadMinutes, clockMinutesInTz, type NightSummary } from "@/lib/domain/sleep";

/** Nights needed before a bedtime/wake pattern is shown. */
export const MIN_NIGHTS_FOR_PATTERN = 3;

export interface NightSlot {
  date: string;
  /** Short weekday label ("Mon"). */
  label: string;
  isToday: boolean;
  night: NightSummary | null;
}

/** One slot per calendar date ending with `endDate`, oldest first; missing nights are null. */
export function nightSlots(nights: NightSummary[], endDate: string, days: number): NightSlot[] {
  const byDate = new Map(nights.map((n) => [n.nightOf, n]));
  const out: NightSlot[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(endDate, -i);
    out.push({
      date,
      label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      isToday: date === endDate,
      night: byDate.get(date) ?? null,
    });
  }
  return out;
}

export type ScheduleSteadiness = "steady" | "variable" | "irregular";

export interface ScheduleStats {
  nights: number;
  /** Clock minutes since midnight, or null until enough nights are logged. */
  typicalBed: number | null;
  typicalWake: number | null;
  /** Average movement from the typical time, in minutes. */
  bedSpread: number | null;
  wakeSpread: number | null;
  steadiness: ScheduleSteadiness | null;
}

/** Typical bedtime and wake time (circular medians, so nights that straddle midnight behave) and how much they vary. */
export function scheduleStats(nights: NightSummary[]): ScheduleStats {
  if (nights.length < MIN_NIGHTS_FOR_PATTERN) return { nights: nights.length, typicalBed: null, typicalWake: null, bedSpread: null, wakeSpread: null, steadiness: null };
  const beds = nights.map((n) => clockMinutesInTz(n.bedAt, n.timezone));
  const wakes = nights.map((n) => clockMinutesInTz(n.wakeAt, n.timezone));
  const typicalBed = circularMedianMinutes(beds)!;
  const typicalWake = circularMedianMinutes(wakes)!;
  const bedSpread = circularSpreadMinutes(beds, typicalBed);
  const wakeSpread = circularSpreadMinutes(wakes, typicalWake);
  const worst = Math.max(bedSpread, wakeSpread);
  return { nights: nights.length, typicalBed, typicalWake, bedSpread, wakeSpread, steadiness: worst <= 30 ? "steady" : worst <= 60 ? "variable" : "irregular" };
}

export const STEADINESS_TEXT: Record<ScheduleSteadiness, string> = {
  steady: "Your bedtime and wake time stay within about half an hour: a steady rhythm.",
  variable: "Your times move by up to an hour from night to night. Keeping the wake time fixed first is the easiest win.",
  irregular: "Your times move by more than an hour. A regular wake time, even on weekends, is where a steadier rhythm starts.",
};

export function averageAsleepMinutes(nights: NightSummary[]): number | null {
  if (!nights.length) return null;
  return Math.round(nights.reduce((acc, n) => acc + n.asleepMinutes, 0) / nights.length);
}

/** Whole-number percent of the goal, not capped (a night over the goal reads over 100). */
export function goalPct(asleepMinutes: number | null, goalMinutes: number): number | null {
  if (asleepMinutes === null || goalMinutes <= 0) return null;
  return Math.round((asleepMinutes / goalMinutes) * 100);
}
