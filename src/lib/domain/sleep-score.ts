/**
 * Nightly sleep score, version 1 (Sleep & Recovery, Stage B3). Transparent and deterministic: each part is scored only
 * when its inputs were recorded, the parts that exist are averaged by weight, and a missing part never lowers the
 * score. It describes one night's sleep as logged; it is not a measure of sleep debt, recovery or health.
 * Full method: docs/SLEEP_METHOD.md.
 */
import { circularDistance, clockMinutesInTz, type NightSummary } from "@/lib/domain/sleep";
import type { ScheduleStats } from "@/lib/domain/sleep-stats";

export const SLEEP_SCORE_VERSION = 1;

export type ScoreKey = "duration" | "efficiency" | "timing" | "awakenings";

export interface ScoreComponent {
  key: ScoreKey;
  label: string;
  weight: number;
  /** Points earned out of `weight`. */
  points: number;
  detail: string;
}

export interface MissingComponent {
  key: ScoreKey;
  label: string;
  why: string;
}

export type ScoreBand = "restful" | "fair" | "rough";

export interface SleepScore {
  score: number;
  version: typeof SLEEP_SCORE_VERSION;
  band: ScoreBand;
  components: ScoreComponent[];
  missing: MissingComponent[];
  /** "duration and timing", for the label next to the score. */
  basedOn: string;
}

export const SCORE_BAND_TEXT: Record<ScoreBand, string> = {
  restful: "A restful night by what you logged.",
  fair: "A fair night: some room to improve.",
  rough: "A short or broken night.",
};

const WEIGHTS: Record<ScoreKey, number> = { duration: 50, efficiency: 20, timing: 20, awakenings: 10 };
const LABELS: Record<ScoreKey, string> = { duration: "Time asleep vs goal", efficiency: "Sleep efficiency", timing: "Timing vs your usual", awakenings: "Wake-ups" };

/** Linear ramp: 0 at or below `lo`, 1 at or above `hi`. */
const ramp = (value: number, lo: number, hi: number) => Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
const pts = (fraction: number, weight: number) => Math.round(fraction * weight * 10) / 10;

export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return "restful";
  if (score >= 60) return "fair";
  return "rough";
}

/**
 * Score one night. `pattern` is the member's own typical bedtime and wake time from earlier nights (null or without
 * enough nights means the timing part is left out).
 */
export function nightlyScore(night: NightSummary, goalMinutes: number, pattern: ScheduleStats | null): SleepScore {
  const components: ScoreComponent[] = [];
  const missing: MissingComponent[] = [];

  // Duration: full marks at the goal, nothing at half the goal or less. Sleeping past the goal isn't penalised.
  const ratio = goalMinutes > 0 ? night.asleepMinutes / goalMinutes : 0;
  components.push({
    key: "duration",
    label: LABELS.duration,
    weight: WEIGHTS.duration,
    points: pts(ramp(ratio, 0.5, 1), WEIGHTS.duration),
    detail: `${Math.round(ratio * 100)}% of your goal${night.asleepEstimated ? " (time in bed, as nothing else was entered)" : ""}`,
  });

  // Efficiency: 90%+ is full marks, 60% or less is none.
  if (night.efficiencyPct === null) missing.push({ key: "efficiency", label: LABELS.efficiency, why: "Enter when you fell asleep, your final wake-up or minutes awake." });
  else components.push({ key: "efficiency", label: LABELS.efficiency, weight: WEIGHTS.efficiency, points: pts(ramp(night.efficiencyPct, 60, 90), WEIGHTS.efficiency), detail: `${night.efficiencyPct}% of time in bed asleep` });

  // Timing: within 30 minutes of the member's own typical times is full marks; two hours away is none.
  if (!pattern || pattern.typicalBed === null || pattern.typicalWake === null) missing.push({ key: "timing", label: LABELS.timing, why: "Needs three earlier nights to know your usual times." });
  else {
    const bed = circularDistance(clockMinutesInTz(night.bedAt, night.timezone), pattern.typicalBed);
    const wake = circularDistance(clockMinutesInTz(night.wakeAt, night.timezone), pattern.typicalWake);
    const worst = Math.max(bed, wake);
    components.push({ key: "timing", label: LABELS.timing, weight: WEIGHTS.timing, points: pts(1 - ramp(worst, 30, 120), WEIGHTS.timing), detail: `bedtime ${bed} min and wake time ${wake} min from your usual` });
  }

  // Wake-ups: one or none is full marks; six or more is none.
  if (night.awakenings === null) missing.push({ key: "awakenings", label: LABELS.awakenings, why: "Enter how many times you woke up." });
  else components.push({ key: "awakenings", label: LABELS.awakenings, weight: WEIGHTS.awakenings, points: pts(1 - ramp(night.awakenings, 1, 6), WEIGHTS.awakenings), detail: `${night.awakenings} recorded` });

  const weight = components.reduce((acc, c) => acc + c.weight, 0);
  const earned = components.reduce((acc, c) => acc + c.points, 0);
  const score = Math.round((earned / weight) * 100);
  const names = components.map((c) => (c.key === "duration" ? "duration" : c.key === "efficiency" ? "efficiency" : c.key === "timing" ? "timing" : "wake-ups"));
  const basedOn = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return { score, version: SLEEP_SCORE_VERSION, band: scoreBand(score), components, missing, basedOn };
}
