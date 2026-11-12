/**
 * Sleep and training side by side (Sleep & Recovery, Stage C5): comparisons in the member's own logs between the
 * nights before training days and other nights, logged effort after short and after good nights, and how rested
 * they said they felt. Associations only: at least three on each side, worded as patterns, never as causes.
 */
import { clockMinutesInTz, circularDistance, formatDuration, type NightSummary } from "@/lib/domain/sleep";
import type { SleepCheckin } from "@/lib/domain/sleep-checkins";
import { scheduleStats } from "@/lib/domain/sleep-stats";

export interface TrainingDay {
  date: string;
  /** Average logged RPE of the working sets, or null when none was logged. */
  avgRpe: number | null;
  sets: number;
}

/** A training (recovery) check-in: the 0–100 readiness score the member's answers produced that morning. */
export interface ReadinessDay {
  date: string;
  readiness: number;
}

export interface SleepTrainingLink {
  key: "night_before_training" | "effort_after_sleep" | "restedness_after_sleep" | "readiness_after_steady_bedtime" | "readiness_after_overnight_hr";
  /** Counts on each side of the comparison. */
  a: number;
  b: number;
  /** One plain sentence, association wording. */
  text: string;
}

export const MIN_PER_SIDE = 3;
/** A night this far under the goal counts as short for these comparisons. */
export const SHORT_NIGHT_MARGIN = 60;
/** A bedtime within this of the typical one counts as steady; beyond twice it, as off-schedule. */
export const STEADY_BED_MINUTES = 30;
/** Overnight heart rate this far above the member's own fortnight average counts as higher than usual. */
export const HR_ABOVE_USUAL_BPM = 4;

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function sleepTrainingLinks(nights: NightSummary[], training: TrainingDay[], checkins: SleepCheckin[], goalMinutes: number, readiness: ReadinessDay[] = []): SleepTrainingLink[] {
  const out: SleepTrainingLink[] = [];
  const trainingByDate = new Map(training.map((t) => [t.date, t]));
  const checkinByDate = new Map(checkins.map((c) => [c.day, c]));
  const readinessByDate = new Map(readiness.map((r) => [r.date, r.readiness]));

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

  // 4. Readiness check-ins after a bedtime near the typical one vs well off it (consistency, from the member's own nights).
  const readinessAfter = (pick: (n: NightSummary) => boolean) => nights.filter(pick).map((n) => readinessByDate.get(n.nightOf) ?? null).filter((r): r is number => r !== null);
  const pattern = scheduleStats(nights);
  if (pattern.typicalBed !== null) {
    const typicalBed = pattern.typicalBed;
    const distance = (n: NightSummary) => circularDistance(clockMinutesInTz(n.bedAt, n.timezone), typicalBed);
    const steady = readinessAfter((n) => distance(n) <= STEADY_BED_MINUTES);
    const off = readinessAfter((n) => distance(n) > STEADY_BED_MINUTES * 2);
    if (steady.length >= MIN_PER_SIDE && off.length >= MIN_PER_SIDE) {
      const d = Math.round(avg(steady) - avg(off));
      if (Math.abs(d) >= 5) {
        out.push({ key: "readiness_after_steady_bedtime", a: steady.length, b: off.length, text: `Mornings after a bedtime within ${STEADY_BED_MINUTES} minutes of your usual one, your readiness check-in averaged ${Math.round(avg(steady))} out of 100 (${steady.length} mornings), against ${Math.round(avg(off))} after a bedtime more than ${STEADY_BED_MINUTES * 2} minutes off it (${off.length}). Your own answers; a pattern, not a cause.` });
      }
    }
  }

  // 5. Readiness after nights the watch recorded a higher-than-usual overnight heart rate vs the rest of the recorded nights.
  const recorded = nights.filter((n) => n.recorded && n.vitals?.heartRate);
  if (recorded.length >= MIN_PER_SIDE * 2) {
    const usual = avg(recorded.map((n) => n.vitals!.heartRate!.avg));
    const high = readinessAfter((n) => Boolean(n.recorded && n.vitals?.heartRate) && n.vitals!.heartRate!.avg >= usual + HR_ABOVE_USUAL_BPM);
    const rest = readinessAfter((n) => Boolean(n.recorded && n.vitals?.heartRate) && n.vitals!.heartRate!.avg < usual + HR_ABOVE_USUAL_BPM);
    if (high.length >= MIN_PER_SIDE && rest.length >= MIN_PER_SIDE) {
      const d = Math.round(avg(high) - avg(rest));
      if (Math.abs(d) >= 5) {
        out.push({ key: "readiness_after_overnight_hr", a: high.length, b: rest.length, text: `After nights your watch recorded an overnight heart rate at least ${HR_ABOVE_USUAL_BPM} bpm above your usual ${Math.round(usual)} bpm, your readiness averaged ${Math.round(avg(high))} out of 100 (${high.length} mornings), against ${Math.round(avg(rest))} after the other recorded nights (${rest.length}). The heart rate is the device's reading, the readiness your answer; neither is a medical measure.` });
      }
    }
  }
  return out;
}
