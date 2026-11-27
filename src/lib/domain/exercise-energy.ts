import { exerciseCalories, type ActivityLevel } from "./calorie-budget";

/**
 * Exercise calories added to the day's calorie budget, without counting the same movement twice
 * (SPEC §8). The rule:
 *
 * 1. The budget's daily-activity level already includes ordinary walking around. Each level assumes a
 *    typical step count (STEP_BASELINE); only steps above it can add calories.
 * 2. A logged run or walk is also counted by the phone or watch step counter. Its estimated steps are
 *    taken off the day's step count before the baseline is applied, so the run is counted once (as the
 *    run, from its distance or time) and not again as steps.
 * 3. Strength workouts are counted from their duration (MET estimate); they add few steps, so steps are
 *    not reduced for them.
 *
 * So: exercise = workouts + runs/walks + max(0, steps − baseline − steps from logged runs/walks) × kcal per step.
 * All of it is an estimate.
 */

export const STEP_BASELINE: Record<ActivityLevel, number> = {
  sedentary: 5000,
  light: 7500,
  active: 10000,
  very_active: 12500,
};

/** Approximate steps per km (running strides are longer than walking strides). */
export const STEPS_PER_KM = { run: 1250, walk: 1350 } as const;
/** Approximate steps per minute when only the time is known. */
export const STEPS_PER_MIN = { run: 160, walk: 100 } as const;

/** ≈0.04 kcal per step for a 70 kg person, scaled by bodyweight. */
export function kcalPerStep(weightKg: number): number {
  return weightKg > 0 ? (0.04 * weightKg) / 70 : 0;
}

export interface LoggedActivity {
  kind: "run" | "walk";
  distance_m: number | null;
  moving_s: number;
}

/**
 * Calories for a run or walk: about 1 kcal per kg per km running and 0.5 walking when the distance is
 * known, otherwise a MET estimate from moving time (running ≈ 9.8 MET, walking ≈ 3.5 MET).
 */
export function activityCalories(a: LoggedActivity, weightKg: number): number {
  if (!(weightKg > 0)) return 0;
  if (a.distance_m != null && a.distance_m > 0) return Math.round((a.kind === "run" ? 1 : 0.5) * weightKg * (a.distance_m / 1000));
  return exerciseCalories(Math.round(a.moving_s / 60), weightKg, a.kind === "run" ? 9.8 : 3.5);
}

/** Steps a step counter would also have recorded during a logged run or walk. */
export function activitySteps(a: LoggedActivity): number {
  if (a.distance_m != null && a.distance_m > 0) return Math.round((a.distance_m / 1000) * STEPS_PER_KM[a.kind]);
  return Math.round((a.moving_s / 60) * STEPS_PER_MIN[a.kind]);
}

export interface ExerciseDayInput {
  weightKg: number;
  activity: ActivityLevel | null;
  workoutMinutes: number;
  activities: LoggedActivity[];
  steps: number | null;
}

export interface ExerciseDay {
  workouts: number;
  activities: number;
  /** Step calories counted (only steps beyond the baseline and logged runs/walks). */
  steps: number;
  total: number;
  /** Steps recorded that day. */
  stepCount: number;
  /** Steps assumed to belong to logged runs/walks. */
  stepsFromActivities: number;
  /** Steps already covered by the activity level. */
  baseline: number | null;
  /** Steps that added calories. */
  extraSteps: number;
}

export function exerciseForDay(input: ExerciseDayInput): ExerciseDay {
  const workouts = exerciseCalories(input.workoutMinutes, input.weightKg);
  const activities = input.activities.reduce((s, a) => s + activityCalories(a, input.weightKg), 0);
  const stepCount = Math.max(0, Math.round(input.steps ?? 0));
  const stepsFromActivities = input.activities.reduce((s, a) => s + activitySteps(a), 0);
  // Without an activity level we can't tell which steps the budget already covers, so steps add nothing.
  const baseline = input.activity ? STEP_BASELINE[input.activity] : null;
  const extraSteps = baseline == null ? 0 : Math.max(0, stepCount - stepsFromActivities - baseline);
  const steps = Math.round(extraSteps * kcalPerStep(input.weightKg));
  return { workouts, activities, steps, total: workouts + activities + steps, stepCount, stepsFromActivities, baseline, extraSteps };
}
