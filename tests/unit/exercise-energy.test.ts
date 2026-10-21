import { describe, expect, it } from "vitest";
import { exerciseCalories } from "@/lib/domain/calorie-budget";
import { activityCalories, activitySteps, exerciseForDay, kcalPerStep, STEP_BASELINE } from "@/lib/domain/exercise-energy";

describe("exercise calories without double counting", () => {
  const weightKg = 80;

  it("counts runs and walks from distance, or from time when there's no distance", () => {
    expect(activityCalories({ kind: "run", distance_m: 5000, moving_s: 1800 }, weightKg)).toBe(400);
    expect(activityCalories({ kind: "walk", distance_m: 3000, moving_s: 2400 }, weightKg)).toBe(120);
    expect(activityCalories({ kind: "walk", distance_m: null, moving_s: 1800 }, weightKg)).toBe(exerciseCalories(30, weightKg, 3.5));
    expect(activitySteps({ kind: "run", distance_m: 5000, moving_s: 1800 })).toBe(6250);
    expect(activitySteps({ kind: "walk", distance_m: null, moving_s: 1800 })).toBe(3000);
  });

  it("adds only steps beyond the activity level's baseline", () => {
    const d = exerciseForDay({ weightKg, activity: "light", workoutMinutes: 0, activities: [], steps: 12_500 });
    expect(d.baseline).toBe(STEP_BASELINE.light);
    expect(d.extraSteps).toBe(5000);
    expect(d.steps).toBe(Math.round(5000 * kcalPerStep(weightKg)));
    expect(d.total).toBe(d.steps);
    expect(exerciseForDay({ weightKg, activity: "light", workoutMinutes: 0, activities: [], steps: 6000 }).steps).toBe(0);
  });

  it("doesn't count a logged run again through the step counter", () => {
    const run = { kind: "run" as const, distance_m: 5000, moving_s: 1800 };
    // 7,500 baseline + 6,250 steps from the run = 13,750: a step count of 13,750 adds nothing on top of the run.
    const d = exerciseForDay({ weightKg, activity: "light", workoutMinutes: 0, activities: [run], steps: 13_750 });
    expect(d.activities).toBe(400);
    expect(d.stepsFromActivities).toBe(6250);
    expect(d.extraSteps).toBe(0);
    expect(d.total).toBe(400);
    // Counting both naïvely would have added the run's steps again.
    const naive = 400 + Math.round((13_750 - 7500) * kcalPerStep(weightKg));
    expect(d.total).toBeLessThan(naive);
    // Extra walking on top of the run still counts.
    const more = exerciseForDay({ weightKg, activity: "light", workoutMinutes: 0, activities: [run], steps: 16_750 });
    expect(more.extraSteps).toBe(3000);
    expect(more.total).toBe(400 + Math.round(3000 * kcalPerStep(weightKg)));
  });

  it("adds strength workouts from their duration, without touching steps", () => {
    const d = exerciseForDay({ weightKg, activity: "sedentary", workoutMinutes: 60, activities: [], steps: 5000 });
    expect(d.workouts).toBe(exerciseCalories(60, weightKg));
    expect(d.steps).toBe(0);
    expect(d.total).toBe(d.workouts);
  });

  it("adds no step calories when the activity level is unknown, and handles missing steps", () => {
    expect(exerciseForDay({ weightKg, activity: null, workoutMinutes: 0, activities: [], steps: 20_000 }).steps).toBe(0);
    expect(exerciseForDay({ weightKg, activity: "active", workoutMinutes: 0, activities: [], steps: null }).total).toBe(0);
  });
});
