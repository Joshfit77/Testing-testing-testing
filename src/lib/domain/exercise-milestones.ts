/**
 * The next milestone for one exercise, worked out from that exercise's own logged history (never mixed with
 * other exercises) and recalculated on every view, so a milestone moves on by itself once it is reached. Nothing is
 * stored. Pure; used by the exercise page and the exercise history page.
 *
 * What counts as "your best" depends on how the exercise is logged:
 *   - weight × reps: the heaviest weight completed for at least one rep (what people mean by "my bench is 185"),
 *     not the estimated one-rep max, which may be a weight never lifted;
 *   - reps only (bodyweight): the most reps in one set;
 *   - time only (holds): the longest set;
 *   - distance (carries, sleds, runs, rows): the longest set, in the unit the logger uses for that exercise.
 * Milestones are round numbers in the member's own units, one sensible step above the best.
 */
import type { HistorySession } from "./exercise-history";
import { distanceMode, distanceUnit, fromMetres } from "./exercise-tracking";
import type { UnitSystem } from "./types";
import { displayWeight, formatDuration, weightUnit } from "./units";

export type MilestoneKind = "weight" | "reps" | "duration" | "distance";

export interface MeasuredMilestone {
  kind: MilestoneKind;
  /** Current best and next milestone, in the display unit below (lb/kg, reps, seconds, yd/m/mi/km). */
  current: number;
  target: number;
  remaining: number;
  unit: string;
  currentLabel: string;
  targetLabel: string;
  remainingLabel: string;
  /** 0–100, current ÷ target. */
  percent: number;
  /** When the best was set (ISO), and extra context for it such as "× 5 reps". */
  bestDate: string;
  bestDetail: string | null;
  message: string;
}

export interface FirstMilestone {
  kind: "first";
  message: string;
}

export type ExerciseMilestone = MeasuredMilestone | FirstMilestone;

export interface MilestoneExercise {
  slug: string;
  name: string;
}

const trim = (n: number) => String(Math.round(n * 10) / 10);

/** The smallest multiple of `step` strictly above `value`. */
function nextMultiple(value: number, step: number): number {
  return Math.round((Math.floor(value / step + 1e-9) + 1) * step * 100) / 100;
}

/** The first entry of `ladder` strictly above `value`, else `value` rounded up past the end in `tail` steps. */
function nextOnLadder(value: number, ladder: number[], tail: number): number {
  const hit = ladder.find((v) => v > value + 1e-9);
  return hit ?? nextMultiple(value, tail);
}

/** Weight steps sized to the lift: small plates for light work, bigger jumps for heavy lifts. */
export function nextWeightMilestone(best: number, units: UnitSystem): number {
  if (units === "imperial") return nextMultiple(best, best < 50 ? 5 : best < 150 ? 10 : 25);
  return nextMultiple(best, best < 20 ? 2.5 : best < 100 ? 5 : 10);
}

const REP_LADDER = [1, 3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100];
export const nextRepMilestone = (best: number) => nextOnLadder(best, REP_LADDER, 25);

/** Seconds. */
const HOLD_LADDER = [15, 30, 45, 60, 90, 120, 180, 240, 300, 420, 600, 900, 1200, 1800, 2700, 3600];
export const nextDurationMilestone = (best: number) => nextOnLadder(best, HOLD_LADDER, 900);

const KM_LADDER = [0.5, 1, 2, 3, 5, 8, 10, 15, 21.1, 42.2];
const MI_LADDER = [0.5, 1, 2, 3, 5, 6.2, 10, 13.1, 26.2];
export function nextDistanceMilestone(best: number, unit: "m" | "yd" | "km" | "mi"): number {
  if (unit === "km") return nextOnLadder(best, KM_LADDER, 5);
  if (unit === "mi") return nextOnLadder(best, MI_LADDER, 5);
  return nextMultiple(best, best < 50 ? 10 : best < 200 ? 25 : 50);
}

interface Best {
  value: number;
  date: string;
  detail: string | null;
}

function working(sessions: HistorySession[]) {
  return sessions.flatMap((s) => s.sets.filter((x) => x.completed && !x.isWarmup).map((x) => ({ ...x, date: s.date })));
}

/** Higher value wins; on a tie, the earlier date (when it was first reached). */
function pick<T extends { date: string }>(items: T[], value: (t: T) => number): (T & { v: number }) | null {
  let best: (T & { v: number }) | null = null;
  for (const t of items) {
    const v = value(t);
    if (!(v > 0)) continue;
    if (!best || v > best.v + 1e-9 || (Math.abs(v - best.v) <= 1e-9 && t.date < best.date)) best = { ...t, v };
  }
  return best;
}

function measured(kind: MilestoneKind, best: Best, target: number, unit: string, label: (n: number) => string, message: string): MeasuredMilestone {
  const remaining = Math.max(0, Math.round((target - best.value) * 100) / 100);
  return {
    kind,
    current: best.value,
    target,
    remaining,
    unit,
    currentLabel: label(best.value),
    targetLabel: label(target),
    remainingLabel: label(remaining),
    percent: Math.max(0, Math.min(100, (best.value / target) * 100)),
    bestDate: best.date,
    bestDetail: best.detail,
    message,
  };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * The next milestone for an exercise from its history. `sessions` must be that exercise's sessions only (as built by
 * buildExerciseHistory); a session with no completed working set doesn't count.
 */
export function exerciseMilestone(sessions: HistorySession[], ex: MilestoneExercise, units: UnitSystem): ExerciseMilestone {
  const sets = working(sessions);
  const first: FirstMilestone = { kind: "first", message: `Log your first working set of ${ex.name} to set your starting point.` };
  if (!sets.length) return first;

  const mode = distanceMode(ex.slug);
  if (mode) {
    const unit = distanceUnit(mode, units);
    const b = pick(sets, (x) => fromMetres(x.distanceM ?? 0, unit));
    if (b) {
      const target = nextDistanceMilestone(b.v, unit);
      const label = (n: number) => `${trim(n)} ${unit}`;
      const detail = b.weightKg ? `with ${trim(displayWeight(b.weightKg, units))} ${weightUnit(units)}` : null;
      const rem = Math.round((target - b.v) * 100) / 100;
      return measured("distance", { value: b.v, date: b.date, detail }, target, unit, label, `${label(rem)} to go to your next ${ex.name} milestone.`);
    }
  }

  const lifted = pick(
    sets.filter((x) => (x.reps ?? 0) > 0),
    (x) => displayWeight(x.weightKg ?? 0, units),
  );
  if (lifted) {
    const unit = weightUnit(units);
    const target = nextWeightMilestone(lifted.v, units);
    const label = (n: number) => `${trim(n)} ${unit}`;
    const rem = Math.round((target - lifted.v) * 10) / 10;
    const reps = lifted.reps ?? 0;
    return measured(
      "weight",
      { value: lifted.v, date: lifted.date, detail: `× ${reps} ${plural(reps, "rep", "reps")}` },
      target,
      unit,
      label,
      `You're ${label(rem)} away from your next ${ex.name} milestone.`,
    );
  }

  const held = pick(
    sets.filter((x) => !x.reps),
    (x) => x.durationSeconds ?? 0,
  );
  if (held) {
    const target = nextDurationMilestone(held.v);
    const rem = target - held.v;
    return measured("duration", { value: held.v, date: held.date, detail: null }, target, "s", formatDuration, `Hold ${formatDuration(rem)} longer to reach your next target.`);
  }

  const repped = pick(sets, (x) => x.reps ?? 0);
  if (repped) {
    const target = nextRepMilestone(repped.v);
    const rem = target - repped.v;
    const label = (n: number) => `${n} ${plural(n, "rep", "reps")}`;
    return measured("reps", { value: repped.v, date: repped.date, detail: null }, target, "reps", label, `Only ${rem} more ${plural(rem, "rep", "reps")} to reach your next target.`);
  }

  return first;
}
