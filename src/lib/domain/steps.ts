/** Pure helpers for daily step tracking (manual entry and Apple Health / Health Connect sync). */
import { addDays, isoDateInTz } from "@/lib/domain/dates";

export const MAX_DAILY_STEPS = 200_000;
export const STEP_GOAL_MIN = 1_000;
export const STEP_GOAL_MAX = 50_000;
export const DEFAULT_STEP_GOAL = 8_000;
/** Longest window a single sync may write. */
export const MAX_SYNC_DAYS = 31;

export type StepSource = "manual" | "apple_health" | "health_connect";
export const STEP_SOURCE_LABELS: Record<StepSource, string> = {
  manual: "Entered by hand",
  apple_health: "Apple Health",
  health_connect: "Health Connect",
};

export interface DaySteps {
  day: string;
  steps: number;
}

/** The last `n` ISO dates ending with `today`, oldest first. */
export function lastNDates(today: string, n: number): string[] {
  const count = Math.max(0, Math.floor(n));
  return Array.from({ length: count }, (_, i) => addDays(today, i - (count - 1)));
}

/** Round and clamp a step count into the stored range. Non-finite input becomes 0. */
export function clampSteps(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_DAILY_STEPS, Math.max(0, Math.round(value)));
}

export function isValidStepCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_DAILY_STEPS;
}

export function isValidStepGoal(value: number): boolean {
  return Number.isInteger(value) && value >= STEP_GOAL_MIN && value <= STEP_GOAL_MAX;
}

/** Percent of the goal reached, 0–100 (whole number). */
export function stepGoalPct(steps: number, goal: number): number {
  if (!goal || goal <= 0 || !Number.isFinite(steps) || steps <= 0) return 0;
  return Math.min(100, Math.round((steps / goal) * 100));
}

export interface AggregatedStepSample {
  startDate: string;
  endDate?: string;
  value: number;
}

/**
 * Turn day-bucketed health samples into a { isoDate: steps } map in `timeZone`.
 * The bucket's midpoint is used, so a bucket that starts at local midnight lands on the right
 * calendar day even when the bucket timestamps are expressed in UTC or a slightly different zone.
 * Samples on the same day are summed; invalid samples are skipped.
 */
export function stepsByDay(samples: AggregatedStepSample[], timeZone: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of samples) {
    const start = Date.parse(s.startDate);
    if (Number.isNaN(start) || !Number.isFinite(s.value)) continue;
    const end = s.endDate ? Date.parse(s.endDate) : Number.NaN;
    const at = !Number.isNaN(end) && end > start ? start + (end - start) / 2 : start;
    const day = isoDateInTz(new Date(at), timeZone);
    out[day] = (out[day] ?? 0) + s.value;
  }
  for (const k of Object.keys(out)) out[k] = clampSteps(out[k]!);
  return out;
}

/** One entry per date (oldest first), 0 where nothing is recorded. */
export function fillStepDays(dates: string[], rows: DaySteps[]): DaySteps[] {
  const byDay = new Map(rows.map((r) => [r.day, r.steps]));
  return dates.map((day) => ({ day, steps: byDay.get(day) ?? 0 }));
}

/**
 * Days to send to the server after a health sync, clamped. Days with no steps are left out so a
 * sync never wipes a count the user entered by hand (iOS reports denied access as "no data").
 */
export function syncPayload(dates: string[], byDay: Record<string, number>): DaySteps[] {
  return dates.map((day) => ({ day, steps: clampSteps(byDay[day] ?? 0) })).filter((d) => d.steps > 0);
}

export function formatSteps(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
