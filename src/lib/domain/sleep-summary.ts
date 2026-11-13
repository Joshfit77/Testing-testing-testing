/**
 * The 30-day sleep summary: what the member's own logged nights say about the last 30 days, and how much of it rests
 * on recorded versus self-reported data. Pure and deterministic. Nothing is filled in: a night without data is missing,
 * not zero sleep; averages need enough nights; a change is only reported when both halves of the month have data and
 * it is bigger than everyday noise.
 */
import { addDays } from "@/lib/domain/dates";
import type { NightSummary } from "@/lib/domain/sleep";
import { averageAsleepMinutes, scheduleStats, type ScheduleSteadiness } from "@/lib/domain/sleep-stats";

export const SUMMARY_DAYS = 30;
/** Nights needed before averages are shown (about two a week). */
export const MIN_NIGHTS_FOR_SUMMARY = 7;
/** Nights needed in each half of the month before a change is described. */
export const MIN_NIGHTS_PER_HALF = 3;
/** Smaller changes in average sleep than this are reported as "about the same". */
export const MEANINGFUL_CHANGE_MINUTES = 15;

export type ThirtyDaySummary =
  | { status: "insufficient"; nightsLogged: number; needed: number; start: string; end: string }
  | {
      status: "ok";
      start: string;
      end: string;
      nightsLogged: number;
      /** Nights recorded by a health platform or wearable / entered by hand or with the timer. */
      recordedNights: number;
      selfReportedNights: number;
      /** Nights where time asleep was taken as time in bed (no asleep figure was available). */
      estimatedAsleepNights: number;
      averageAsleep: number;
      /** Average over recorded nights only, when there are at least 3. */
      averageAsleepRecorded: number | null;
      nightsAtGoal: number;
      shortest: number;
      longest: number;
      typicalBed: number | null;
      typicalWake: number | null;
      steadiness: ScheduleSteadiness | null;
      /** Second half of the window against the first, in minutes of average sleep; null without enough nights. */
      change: { minutes: number; direction: "more" | "less" | "same" } | null;
      /** Plain statements of what the figures do and don't rest on. */
      caveats: string[];
    };

export function thirtyDaySummary(allNights: NightSummary[], goalMinutes: number, today: string): ThirtyDaySummary {
  const start = addDays(today, -(SUMMARY_DAYS - 1));
  const nights = allNights.filter((n) => n.nightOf >= start && n.nightOf <= today);
  if (nights.length < MIN_NIGHTS_FOR_SUMMARY) return { status: "insufficient", nightsLogged: nights.length, needed: MIN_NIGHTS_FOR_SUMMARY, start, end: today };

  const recorded = nights.filter((n) => n.recorded);
  const estimated = nights.filter((n) => n.asleepEstimated).length;
  const asleep = nights.map((n) => n.asleepMinutes);
  const schedule = scheduleStats(nights);
  const mid = addDays(start, SUMMARY_DAYS / 2);
  const firstHalf = nights.filter((n) => n.nightOf < mid);
  const secondHalf = nights.filter((n) => n.nightOf >= mid);
  let change: { minutes: number; direction: "more" | "less" | "same" } | null = null;
  if (firstHalf.length >= MIN_NIGHTS_PER_HALF && secondHalf.length >= MIN_NIGHTS_PER_HALF) {
    const d = averageAsleepMinutes(secondHalf)! - averageAsleepMinutes(firstHalf)!;
    change = { minutes: Math.abs(d), direction: Math.abs(d) < MEANINGFUL_CHANGE_MINUTES ? "same" : d > 0 ? "more" : "less" };
  }

  const caveats: string[] = [];
  const missing = SUMMARY_DAYS - nights.length;
  if (missing > 0) caveats.push(`${missing} of the last ${SUMMARY_DAYS} nights have no data. They are left out, not counted as no sleep.`);
  const selfReported = nights.length - recorded.length;
  if (selfReported > 0) caveats.push(`${selfReported} night${selfReported === 1 ? " was" : "s were"} entered by hand or with the timer: your own estimate, not a measurement.`);
  if (estimated > 0) caveats.push(`On ${estimated} night${estimated === 1 ? "" : "s"} only time in bed was known, so it is counted as time asleep (an overestimate).`);
  if (recorded.length > 0) caveats.push("Recorded nights come from your phone or watch, which estimate sleep from movement and heart rate; they are not a medical sleep test.");

  return {
    status: "ok",
    start,
    end: today,
    nightsLogged: nights.length,
    recordedNights: recorded.length,
    selfReportedNights: selfReported,
    estimatedAsleepNights: estimated,
    averageAsleep: averageAsleepMinutes(nights)!,
    averageAsleepRecorded: recorded.length >= 3 ? averageAsleepMinutes(recorded) : null,
    nightsAtGoal: nights.filter((n) => n.asleepMinutes >= goalMinutes).length,
    shortest: Math.min(...asleep),
    longest: Math.max(...asleep),
    typicalBed: schedule.typicalBed,
    typicalWake: schedule.typicalWake,
    steadiness: schedule.steadiness,
    change,
    caveats,
  };
}
