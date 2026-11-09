/**
 * The next milestone for one exercise, worked out from that exercise's own logged history (never mixed with
 * other exercises) and recalculated on every view, so a milestone moves on by itself once it is reached, and moves
 * back if the set that reached it is edited or deleted. Nothing is stored. Pure; used by the exercise page, the
 * exercise history page, the Run tab and the workout-complete screen.
 *
 * Which metric counts depends on how the exercise is measured (terms are shared with the rest of the app, see
 * record-labels.ts):
 *   - weight × reps: the heaviest lift, the most weight completed for at least one rep (what people mean by "my
 *     bench is 185"), never the estimated one-rep max, which may be a weight never lifted;
 *   - bodyweight exercises (push-ups, pull-ups, dips): the most reps at bodyweight, and separately the heaviest added
 *     weight once weighted sets are logged, so one weighted set never hides the rep count, or the other way round;
 *   - holds (planks, hangs): the longest hold;
 *   - cardio logged by time: the longest session, worded as time on your feet, not a hold;
 *   - distance (carries, sleds, runs, walks, rows): the longest single effort, in the unit the logger uses. Runs and
 *     walks also count every saved activity on the Run tab (GPS, treadmill or entered by hand, Free or Pro).
 * Milestones are round numbers in the member's own units, one sensible step above the best.
 */
import { EXERCISES } from "@/data/exercises";
import type { HistorySession } from "./exercise-history";
import { distanceMode, distanceUnit, fromMetres } from "./exercise-tracking";
import { RECORD_TERMS } from "./record-labels";
import type { UnitSystem } from "./types";
import { displayWeight, formatDuration, weightUnit } from "./units";

export type MilestoneKind = "weight" | "added_weight" | "reps" | "duration" | "distance";

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
  /** What the best is, in the app's shared terms: "Heaviest lift", "Most reps", "Longest hold", "Longest run"… */
  bestLabel: string;
  /** When the best was set (ISO), and extra context for it such as "× 5 reps" or "GPS run". */
  bestDate: string;
  bestDetail: string | null;
  message: string;
  /** A second, independent milestone: the added-weight track of a bodyweight exercise. */
  secondary?: MeasuredMilestone;
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

/** A run or walk saved on the Run tab (GPS, treadmill or entered by hand), for the distance milestones. */
export interface MilestoneActivity {
  kind: "run" | "walk";
  source: "gps" | "treadmill" | "manual";
  distanceM: number | null;
  startedAt: string;
}

/** Exercises whose sets are the same thing as a run or walk on the Run tab. */
const ACTIVITY_KIND: Record<string, "run" | "walk"> = { "zone-2-run": "run", "running-intervals": "run", "run-walk-intervals": "run", "brisk-walk": "walk" };
export const activityKindFor = (slug: string): "run" | "walk" | null => ACTIVITY_KIND[slug] ?? null;

const BODYWEIGHT_GEAR = new Set(["bodyweight", "pull_up_bar", "dip_station", "rings", "parallettes"]);
const BY_SLUG = new Map(EXERCISES.map((e) => [e.slug, e]));

type Measure = "distance" | "cardio_time" | "hold" | "bodyweight" | "load";

/** How an exercise is measured, from the catalog (an unknown slug is treated as a loaded lift). */
export function measureFor(slug: string): Measure {
  if (distanceMode(slug)) return "distance";
  const e = BY_SLUG.get(slug);
  if (!e) return "load";
  if (e.category === "cardio" || e.category === "conditioning") return e.timed ? "cardio_time" : "load";
  if (e.timed) return "hold";
  if (e.equipment.some((q) => BODYWEIGHT_GEAR.has(q))) return "bodyweight";
  return "load";
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

function measured(kind: MilestoneKind, bestLabel: string, best: Best, target: number, unit: string, label: (n: number) => string, message: string): MeasuredMilestone {
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
    bestLabel,
    bestDate: best.date,
    bestDetail: best.detail,
    message,
  };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const SOURCE_LABEL = { gps: "GPS", treadmill: "treadmill", manual: "entered by hand" } as const;

function distanceMilestone(best: Best, unit: "m" | "yd" | "km" | "mi", bestLabel: string, name: string): MeasuredMilestone {
  const target = nextDistanceMilestone(best.value, unit);
  const label = (n: number) => `${trim(n)} ${unit}`;
  const rem = Math.round((target - best.value) * 100) / 100;
  return measured("distance", bestLabel, best, target, unit, label, `${label(rem)} to go to your next ${name} milestone.`);
}

function weightMilestone(kind: "weight" | "added_weight", b: { v: number; date: string; reps: number | null }, units: UnitSystem, name: string): MeasuredMilestone {
  const unit = weightUnit(units);
  const target = nextWeightMilestone(b.v, units);
  const label = (n: number) => `${trim(n)} ${unit}`;
  const rem = Math.round((target - b.v) * 10) / 10;
  const reps = b.reps ?? 0;
  const what = kind === "added_weight" ? `added-weight ${name}` : name;
  return measured(
    kind,
    kind === "added_weight" ? RECORD_TERMS.added_weight : RECORD_TERMS.max_weight,
    { value: b.v, date: b.date, detail: `× ${reps} ${plural(reps, "rep", "reps")}` },
    target,
    unit,
    label,
    `You're ${label(rem)} away from your next ${what} milestone.`,
  );
}

function repMilestone(b: { v: number; date: string }, bestLabel: string): MeasuredMilestone {
  const target = nextRepMilestone(b.v);
  const rem = target - b.v;
  const label = (n: number) => `${n} ${plural(n, "rep", "reps")}`;
  return measured("reps", bestLabel, { value: b.v, date: b.date, detail: null }, target, "reps", label, `Only ${rem} more ${plural(rem, "rep", "reps")} to reach your next target.`);
}

function durationMilestone(b: { v: number; date: string }, cardio: boolean): MeasuredMilestone {
  const target = nextDurationMilestone(b.v);
  const rem = target - b.v;
  return measured(
    "duration",
    cardio ? RECORD_TERMS.longest_session : RECORD_TERMS.max_duration,
    { value: b.v, date: b.date, detail: null },
    target,
    "s",
    formatDuration,
    cardio ? `Keep going ${formatDuration(rem)} longer to reach your next target.` : `Hold ${formatDuration(rem)} longer to reach your next target.`,
  );
}

/**
 * The next milestone for an exercise from its history. `sessions` must be that exercise's sessions only (as built by
 * buildExerciseHistory); a session with no completed working set doesn't count. For runs and walks, pass the
 * member's saved activities too (`activities`); only those of the matching kind are used.
 */
export function exerciseMilestone(sessions: HistorySession[], ex: MilestoneExercise, units: UnitSystem, opts: { activities?: MilestoneActivity[] } = {}): ExerciseMilestone {
  const sets = working(sessions);
  const actKind = activityKindFor(ex.slug);
  const acts = actKind ? (opts.activities ?? []).filter((a) => a.kind === actKind && (a.distanceM ?? 0) > 0) : [];
  const first: FirstMilestone = { kind: "first", message: `Log your first working set of ${ex.name} to set your starting point.` };
  if (!sets.length && !acts.length) return first;

  const measure = measureFor(ex.slug);

  if (measure === "distance") {
    const unit = distanceUnit(distanceMode(ex.slug)!, units);
    const fromSets = pick(sets, (x) => fromMetres(x.distanceM ?? 0, unit));
    const fromActs = pick(
      acts.map((a) => ({ date: a.startedAt, source: a.source, distanceM: a.distanceM ?? 0 })),
      (a) => fromMetres(a.distanceM, unit),
    );
    const useAct = fromActs && (!fromSets || fromActs.v > fromSets.v + 1e-9 || (Math.abs(fromActs.v - fromSets.v) <= 1e-9 && fromActs.date < fromSets.date));
    const bestLabel = actKind === "walk" ? RECORD_TERMS.longest_walk : actKind === "run" ? RECORD_TERMS.longest_run : RECORD_TERMS.max_distance;
    if (useAct && fromActs) {
      return distanceMilestone({ value: fromActs.v, date: fromActs.date, detail: `${SOURCE_LABEL[fromActs.source]} ${actKind}` }, unit, bestLabel, ex.name);
    }
    if (fromSets) {
      const detail = fromSets.weightKg ? `with ${trim(displayWeight(fromSets.weightKg, units))} ${weightUnit(units)}` : null;
      return distanceMilestone({ value: fromSets.v, date: fromSets.date, detail }, unit, bestLabel, ex.name);
    }
    // Logged by time only (no distance on any set or activity): time on your feet, never a "hold".
    const timed = pick(sets, (x) => x.durationSeconds ?? 0);
    return timed ? durationMilestone(timed, true) : first;
  }

  if (measure === "cardio_time") {
    const timed = pick(sets, (x) => x.durationSeconds ?? 0);
    if (timed) return durationMilestone(timed, true);
  }

  if (measure === "hold") {
    const held = pick(sets, (x) => x.durationSeconds ?? 0);
    if (held) return durationMilestone(held, false);
  }

  if (measure === "bodyweight") {
    // Two tracks that never override each other: reps at bodyweight, and added weight on weighted sets.
    const bw = pick(
      sets.filter((x) => !((x.weightKg ?? 0) > 0)),
      (x) => x.reps ?? 0,
    );
    const loaded = pick(
      sets.filter((x) => (x.reps ?? 0) > 0),
      (x) => displayWeight(x.weightKg ?? 0, units),
    );
    const repsM = bw ? repMilestone(bw, RECORD_TERMS.bodyweight_reps) : null;
    const addedM = loaded ? weightMilestone("added_weight", loaded, units, ex.name) : null;
    if (repsM) return addedM ? { ...repsM, secondary: addedM } : repsM;
    if (addedM) return addedM;
  }

  // Loaded lifts (and anything not matched above): the heaviest weight completed for at least one rep.
  const lifted = pick(
    sets.filter((x) => (x.reps ?? 0) > 0),
    (x) => displayWeight(x.weightKg ?? 0, units),
  );
  if (lifted) return weightMilestone("weight", lifted, units, ex.name);

  const held = pick(
    sets.filter((x) => !x.reps),
    (x) => x.durationSeconds ?? 0,
  );
  if (held) return durationMilestone(held, measure === "cardio_time");

  const repped = pick(sets, (x) => x.reps ?? 0);
  if (repped) return repMilestone(repped, RECORD_TERMS.max_reps);

  return first;
}

/** The longest run or walk on the Run tab and the next distance to aim for (every source, Free and Pro alike). */
export function activityMilestone(activities: MilestoneActivity[], kind: "run" | "walk", units: UnitSystem): ExerciseMilestone {
  const name = kind === "run" ? "run" : "walk";
  const withDistance = activities.filter((a) => a.kind === kind && (a.distanceM ?? 0) > 0);
  if (!withDistance.length) return { kind: "first", message: `Save your first ${name} with a distance to set your starting point.` };
  const unit = units === "imperial" ? "mi" : "km";
  const b = pick(
    withDistance.map((a) => ({ date: a.startedAt, source: a.source, distanceM: a.distanceM ?? 0 })),
    (a) => fromMetres(a.distanceM, unit),
  )!;
  const m = distanceMilestone({ value: b.v, date: b.date, detail: `${SOURCE_LABEL[b.source]} ${name}` }, unit, kind === "run" ? RECORD_TERMS.longest_run : RECORD_TERMS.longest_walk, name);
  return { ...m, message: `Go ${m.remainingLabel} farther than your longest ${name} to reach ${m.targetLabel}.` };
}

export interface ReachedMilestone {
  exerciseId: string;
  name: string;
  /** What was reached, in the shared terms: "Heaviest lift", "Most reps at bodyweight"… */
  what: string;
  /** The milestone value reached: "200 lb", "12 reps", "5 km". */
  value: string;
  kind: MilestoneKind;
}

/**
 * Milestones a just-saved session reached: for each exercise, the targets in place before this session that its sets
 * now meet. Worked out from saved data only, so a retried save shows the same result and nothing is ever stored.
 */
export function reachedMilestones(
  exercises: { id: string; slug: string; name: string; sessions: HistorySession[] }[],
  sessionId: string,
  units: UnitSystem,
): ReachedMilestone[] {
  const out: ReachedMilestone[] = [];
  for (const ex of exercises) {
    if (!ex.sessions.some((s) => s.sessionId === sessionId)) continue;
    const before = exerciseMilestone(
      ex.sessions.filter((s) => s.sessionId !== sessionId),
      ex,
      units,
    );
    const after = exerciseMilestone(ex.sessions, ex, units);
    if (before.kind === "first" || after.kind === "first") continue;
    const pairs: [MeasuredMilestone, MeasuredMilestone | undefined][] = [
      [before, after.kind === before.kind ? after : after.secondary?.kind === before.kind ? after.secondary : undefined],
    ];
    if (before.secondary) pairs.push([before.secondary, after.secondary?.kind === before.secondary.kind ? after.secondary : after.kind === before.secondary.kind ? after : undefined]);
    for (const [b, a] of pairs) {
      if (a && a.current + 1e-9 >= b.target) out.push({ exerciseId: ex.id, name: ex.name, what: b.bestLabel, value: b.targetLabel, kind: b.kind });
    }
  }
  return out;
}
