/**
 * Sleep and training side by side (Sleep & Recovery, Stage C5): comparisons in the member's own logs between the
 * nights before training days and other nights, logged effort after short and after good nights, and how rested
 * they said they felt. Associations only: at least three on each side, worded as patterns, never as causes.
 */
import { formatDuration, type NightSummary } from "@/lib/domain/sleep";
import type { SleepCheckin } from "@/lib/domain/sleep-checkins";

export interface TrainingDay {
  date: string;
  /** Average logged RPE of the working sets, or null when none was logged. */
  avgRpe: number | null;
  sets: number;
}

export interface SleepTrainingLink {
  key: "night_before_training" | "effort_after_sleep" | "restedness_after_sleep";
  /** Counts on each side of the comparison. */
  a: number;
  b: number;
  /** One plain sentence, association wording. */
  text: string;
}

export const MIN_PER_SIDE = 3;
/** A night this far under the goal counts as short for these comparisons. */
export const SHORT_NIGHT_MARGIN = 60;

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function sleepTrainingLinks(nights: NightSummary[], training: TrainingDay[], checkins: SleepCheckin[], goalMinutes: number): SleepTrainingLink[] {
  const out: SleepTrainingLink[] = [];
  const trainingByDate = new Map(training.map((t) => [t.date, t]));
  const checkinByDate = new Map(checkins.map((c) => [c.day, c]));

  // 1. The night before a training day (the night ending that morning) vs other nights.
  const before = nights.filter((n) => trainingByDate.has(n.nightOf)).map((n) => n.asleepMinutes);
  const other = nights.filter((n) => !trainingByDate.has(n.nightOf)).map((n) => n.asleepMinutes);
  if (before.length >= MIN_PER_SIDE && other.length >= MIN_PER_SIDE) {
    const d = Math.round(avg(before) - avg(other));
    if (Math.abs(d) >= 15) {
      out.push({ key: "night_before_training", a: before.length, b: other.length, text: `On the ${before.length} nights before a workout you slept ${formatDuration(Math.round(avg(before)))} on average, ${formatDuration(Math.abs(d))} ${d < 0 ? "less" : "more"} than on ${other.length} other nights. A pattern in your own logs, not a cause.` });
    }
  }

  // 2. Logged effort (RPE) on days after a short night vs after a night near the goal.
  const short = (n: NightSummary) => n.asleepMinutes < goalMinutes - SHORT_NIGHT_MARGIN;
  const rpeAfter = (pick: (n: NightSummary) => boolean) => nights.filter(pick).map((n) => trainingByDate.get(n.nightOf)?.avgRpe ?? null).filter((r): r is number => r !== null);
  const rpeShort = rpeAfter(short);
  const rpeOk = rpeAfter((n) => !short(n));
  if (rpeShort.length >= MIN_PER_SIDE && rpeOk.length >= MIN_PER_SIDE) {
    const d = Math.round((avg(rpeShort) - avg(rpeOk)) * 10) / 10;
    if (Math.abs(d) >= 0.4) {
      out.push({ key: "effort_after_sleep", a: rpeShort.length, b: rpeOk.length, text: `Sessions after a short night (${rpeShort.length}) felt ${Math.abs(d)} RPE ${d > 0 ? "harder" : "easier"} on average than sessions after a night near your goal (${rpeOk.length}). Logged effort, your own rating.` });
    }
  }

  // 3. Reported restedness after short vs near-goal nights.
  const rested = (pick: (n: NightSummary) => boolean) => nights.filter(pick).map((n) => checkinByDate.get(n.nightOf)?.restedness ?? null).filter((r): r is number => r !== null);
  const rShort = rested(short);
  const rOk = rested((n) => !short(n));
  if (rShort.length >= MIN_PER_SIDE && rOk.length >= MIN_PER_SIDE) {
    const d = Math.round((avg(rShort) - avg(rOk)) * 10) / 10;
    if (Math.abs(d) >= 0.5) {
      out.push({ key: "restedness_after_sleep", a: rShort.length, b: rOk.length, text: `After a short night you rated restedness ${avg(rShort).toFixed(1)} out of 5 on average (${rShort.length} mornings), against ${avg(rOk).toFixed(1)} after a night near your goal (${rOk.length}).` });
    }
  }
  return out;
}
