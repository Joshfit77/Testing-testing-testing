/**
 * Guided running sessions and running goals (pure, unit-tested).
 *
 * A running day from the program library (run/walk intervals, continuous easy running, interval repeats, brisk
 * walking) becomes a timed script the GPS recorder follows: "Run 1:00", "Walk 1:30", and so on, timed against moving
 * time (pausing pauses the script). What the member actually completed is what gets logged against the program.
 */
import { metersPer, type DistanceUnit } from "./activities";

export interface RunPrescription {
  exerciseId: string;
  slug: string;
  name: string;
  sets: number;
  /** Work seconds per set. */
  seconds: number | null;
  /** Rest (walk or easy jog) seconds after each set. */
  rest: number;
}

export type PhaseKind = "warmup" | "run" | "walk" | "hard" | "recover" | "cooldown";

export interface ScriptPhase {
  kind: PhaseKind;
  label: string;
  seconds: number;
  /** The program exercise this phase belongs to (work phases only). */
  exerciseIndex: number | null;
}

export const RUN_SLUGS = new Set(["zone-2-run", "run-walk-intervals", "running-intervals", "brisk-walk"]);

/** Can this program day be recorded as a guided run (every exercise is a timed running or walking one)? */
export function isRunDay(exercises: Pick<RunPrescription, "slug" | "seconds">[]): boolean {
  return exercises.length > 0 && exercises.every((e) => RUN_SLUGS.has(e.slug) && (e.seconds ?? 0) > 0);
}

export function buildScript(exercises: RunPrescription[], opts: { warmupSeconds?: number; cooldownSeconds?: number } = {}): ScriptPhase[] {
  const phases: ScriptPhase[] = [];
  const warm = opts.warmupSeconds ?? 300;
  if (warm > 0) phases.push({ kind: "warmup", label: "Warm-up: brisk walk", seconds: warm, exerciseIndex: null });
  exercises.forEach((e, i) => {
    const work = e.seconds ?? 0;
    for (let s = 0; s < e.sets; s++) {
      if (e.slug === "run-walk-intervals") phases.push({ kind: "run", label: "Run easy", seconds: work, exerciseIndex: i });
      else if (e.slug === "running-intervals") phases.push({ kind: "hard", label: "Run hard (controlled)", seconds: work, exerciseIndex: i });
      else if (e.slug === "brisk-walk") phases.push({ kind: "walk", label: "Brisk walk", seconds: work, exerciseIndex: i });
      else phases.push({ kind: "run", label: "Easy run", seconds: work, exerciseIndex: i });
      const lastSetOfLast = i === exercises.length - 1 && s === e.sets - 1;
      if (e.rest > 0 && !lastSetOfLast) {
        phases.push(
          e.slug === "running-intervals"
            ? { kind: "recover", label: "Easy jog or walk", seconds: e.rest, exerciseIndex: null }
            : { kind: "walk", label: "Walk", seconds: e.rest, exerciseIndex: null },
        );
      }
    }
  });
  const cool = opts.cooldownSeconds ?? 300;
  if (cool > 0) phases.push({ kind: "cooldown", label: "Cool-down: easy walk", seconds: cool, exerciseIndex: null });
  return phases;
}

export const scriptSeconds = (script: ScriptPhase[]) => script.reduce((s, p) => s + p.seconds, 0);

/** Where the member is in the script after `movingS` seconds. */
export function phaseAt(script: ScriptPhase[], movingS: number): { index: number; phase: ScriptPhase | null; remaining: number; done: boolean } {
  let t = 0;
  for (let i = 0; i < script.length; i++) {
    const p = script[i]!;
    if (movingS < t + p.seconds) return { index: i, phase: p, remaining: Math.ceil(t + p.seconds - movingS), done: false };
    t += p.seconds;
  }
  return { index: script.length, phase: null, remaining: 0, done: true };
}

/** Work sets fully completed per exercise after `movingS` seconds (what is logged against the program). */
export function completedSets(script: ScriptPhase[], exerciseCount: number, movingS: number): number[] {
  const done = Array.from({ length: exerciseCount }, () => 0);
  let t = 0;
  for (const p of script) {
    t += p.seconds;
    if (t > movingS) break;
    if (p.exerciseIndex != null) done[p.exerciseIndex]! += 1;
  }
  return done;
}

// --------------------------------------------------------------------------- Goals

export type RunGoalKind = "weekly_distance" | "monthly_distance" | "race_time";

export interface RunGoal {
  id: string;
  kind: RunGoalKind;
  distance_m: number;
  target_s: number | null;
  created_at: string;
}

/** Progress towards a distance goal (this week's or month's live activities). */
export function distanceGoalProgress(goal: Pick<RunGoal, "distance_m">, coveredM: number): { pct: number; remainingM: number; met: boolean } {
  const pct = goal.distance_m > 0 ? Math.min(100, Math.round((coveredM / goal.distance_m) * 100)) : 0;
  return { pct, remainingM: Math.max(0, goal.distance_m - coveredM), met: coveredM >= goal.distance_m };
}

/**
 * A race-time goal against the member's best run of that distance (whole runs up to 3% longer, as the records use).
 * `bestS` is null when there's no qualifying run yet.
 */
export function raceGoalProgress(goal: Pick<RunGoal, "target_s" | "distance_m">, bestS: number | null, unit: DistanceUnit): { met: boolean; gapS: number | null; targetPace: number | null } {
  if (!goal.target_s) return { met: false, gapS: null, targetPace: null };
  const targetPace = goal.target_s / (goal.distance_m / metersPer(unit));
  if (bestS == null) return { met: false, gapS: null, targetPace };
  return { met: bestS <= goal.target_s, gapS: bestS - goal.target_s, targetPace };
}

/** Weekly distance totals (oldest first) for a chart, including empty weeks. */
export function weeklyDistanceSeries(weeks: { weekStart: string; distanceM: number }[], weekStarts: string[]): { weekStart: string; distanceM: number }[] {
  const byWeek = new Map(weeks.map((w) => [w.weekStart, w.distanceM]));
  return weekStarts.map((w) => ({ weekStart: w, distanceM: byWeek.get(w) ?? 0 }));
}
