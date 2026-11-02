import { describe, expect, it } from "vitest";
import { createDraft, draftAgeHours, elapsedSeconds, setCanComplete, workoutReducer, type ExerciseRef, type WorkoutDraft } from "@/lib/domain/workout-draft";

const NOW = "2026-10-28T10:00:00.000Z";
const bench: ExerciseRef = { id: "ex-bench", slug: "barbell-bench-press", name: "Barbell Bench Press", isTimed: false };
const dbBench: ExerciseRef = { id: "ex-db-bench", slug: "dumbbell-bench-press", name: "Dumbbell Bench Press", isTimed: false };
const plank: ExerciseRef = { id: "ex-plank", slug: "plank", name: "Plank", isTimed: true };

function start(): WorkoutDraft {
  return createDraft({ name: "Day A", now: NOW, exercises: [{ exercise: bench, restSeconds: 90, target: { sets: 4, reps: "8" } }] });
}
const key = (d: WorkoutDraft, i = 0) => d.exercises[i]!.id;
const at = (seconds: number) => new Date(Date.parse(NOW) + seconds * 1000).toISOString();

describe("logging sets", () => {
  it("a set with no reps cannot be marked done (nothing to log), one with reps can", () => {
    const d = start();
    const s1 = d.exercises[0]!.sets[0]!;
    expect(setCanComplete(d.exercises[0]!, { ...s1, reps: null })).toBe(false);
    const blocked = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: key(d), setId: s1.id, now: NOW });
    // (Reps are prefilled from the target, so clear them first.)
    const cleared = workoutReducer(d, { type: "updateSet", exerciseKey: key(d), setId: s1.id, patch: { reps: null } });
    const still = workoutReducer(cleared, { type: "toggleSetComplete", exerciseKey: key(cleared), setId: s1.id, now: NOW });
    expect(still.exercises[0]!.sets[0]!.completed).toBe(false);
    expect(blocked.exercises[0]!.sets[0]!.completed).toBe(true);
  });

  it("timed and distance sets need their time or distance", () => {
    expect(setCanComplete({ isTimed: true, usesDistance: false }, { id: "s", reps: null, weightKg: null, durationSeconds: 30, distanceM: null, rpe: null, isWarmup: false, completed: false })).toBe(true);
    expect(setCanComplete({ isTimed: true, usesDistance: false }, { id: "s", reps: null, weightKg: null, durationSeconds: null, distanceM: null, rpe: null, isWarmup: false, completed: false })).toBe(false);
    expect(setCanComplete({ isTimed: false, usesDistance: true }, { id: "s", reps: null, weightKg: 20, durationSeconds: null, distanceM: 40, rpe: null, isWarmup: false, completed: false })).toBe(true);
  });

  it("completing a set carries its weight and reps down to the next set that has none", () => {
    let d = start();
    const [s1, s2, s3] = d.exercises[0]!.sets;
    d = workoutReducer(d, { type: "updateSet", exerciseKey: key(d), setId: s1!.id, patch: { weightKg: 60 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: key(d), setId: s1!.id, now: NOW });
    expect(d.exercises[0]!.sets[1]!.weightKg).toBe(60);
    // A value the member already typed is kept.
    d = workoutReducer(d, { type: "updateSet", exerciseKey: key(d), setId: s3!.id, patch: { weightKg: 65 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: key(d), setId: s2!.id, now: NOW });
    expect(d.exercises[0]!.sets[2]!.weightKg).toBe(65);
    expect(d.rest.endsAt).toBe(at(90));
  });

  it("prefills empty sets from the last time, without touching typed values or done sets", () => {
    let d = start();
    const s1 = d.exercises[0]!.sets[0]!;
    d = workoutReducer(d, { type: "updateSet", exerciseKey: key(d), setId: s1.id, patch: { weightKg: 70 } });
    d = workoutReducer(d, { type: "prefillFromPrevious", exerciseKey: key(d), sets: [{ weightKg: 60, reps: 8, durationSeconds: null, distanceM: null }, { weightKg: 62.5, reps: 8, durationSeconds: null, distanceM: null }] });
    expect(d.exercises[0]!.sets.map((s) => s.weightKg)).toEqual([70, 62.5, 62.5, 62.5]);
    // Nothing to fill: the same draft comes back.
    expect(workoutReducer(d, { type: "prefillFromPrevious", exerciseKey: key(d), sets: [{ weightKg: 1, reps: 1, durationSeconds: null, distanceM: null }] })).toBe(d);
  });
});

describe("substituting an exercise", () => {
  it("before any set is done, replaces it in place (reps kept, load cleared)", () => {
    let d = start();
    d = workoutReducer(d, { type: "updateSet", exerciseKey: key(d), setId: d.exercises[0]!.sets[0]!.id, patch: { weightKg: 60 } });
    d = workoutReducer(d, { type: "substituteExercise", exerciseKey: key(d), replacement: dbBench });
    expect(d.exercises).toHaveLength(1);
    expect(d.exercises[0]).toMatchObject({ exerciseId: "ex-db-bench", substitutedFromName: "Barbell Bench Press" });
    expect(d.exercises[0]!.sets.map((s) => [s.reps, s.weightKg, s.completed])).toEqual([[8, null, false], [8, null, false], [8, null, false], [8, null, false]]);
  });

  it("keeps the sets already done on the original exercise and moves the rest to the replacement", () => {
    let d = start();
    const [s1, s2] = d.exercises[0]!.sets;
    for (const s of [s1!, s2!]) {
      d = workoutReducer(d, { type: "updateSet", exerciseKey: key(d), setId: s.id, patch: { weightKg: 60 } });
      d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: key(d), setId: s.id, now: NOW });
    }
    d = workoutReducer(d, { type: "substituteExercise", exerciseKey: key(d), replacement: dbBench });
    expect(d.exercises).toHaveLength(2);
    const [kept, moved] = d.exercises;
    expect(kept).toMatchObject({ exerciseId: "ex-bench", substitutedFromId: null });
    expect(kept!.sets.map((s) => [s.weightKg, s.completed])).toEqual([[60, true], [60, true]]);
    expect(kept!.target?.sets).toBe(2);
    expect(moved).toMatchObject({ exerciseId: "ex-db-bench", substitutedFromName: "Barbell Bench Press" });
    expect(moved!.sets.map((s) => [s.reps, s.weightKg, s.completed])).toEqual([[8, null, false], [8, null, false]]);
    expect(moved!.id).not.toBe(kept!.id);
  });

  it("with every set done, the replacement still gets one set to do", () => {
    let d = createDraft({ name: "W", now: NOW, exercises: [{ exercise: bench, target: { sets: 1, reps: "5" } }] });
    const s = d.exercises[0]!.sets[0]!;
    d = workoutReducer(d, { type: "updateSet", exerciseKey: key(d), setId: s.id, patch: { weightKg: 60 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: key(d), setId: s.id, now: NOW });
    d = workoutReducer(d, { type: "substituteExercise", exerciseKey: key(d), replacement: plank });
    expect(d.exercises[1]!.sets).toHaveLength(1);
    expect(d.exercises[1]!.sets[0]).toMatchObject({ completed: false, reps: null, durationSeconds: 30 });
  });
});

describe("coming back to a draft", () => {
  it("knows how long ago a draft was touched", () => {
    const d = start();
    expect(draftAgeHours(d, at(3 * 3600))).toBe(3);
  });

  it("counts time away as paused, not as training, and drops a stale rest timer", () => {
    let d = start();
    const s1 = d.exercises[0]!.sets[0]!;
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: key(d), setId: s1.id, now: at(600) });
    expect(d.rest.endsAt).not.toBeNull();
    // Back 20 hours later.
    const later = at(600 + 20 * 3600);
    d = workoutReducer(d, { type: "continueAfterGap", now: later });
    expect(d.pausedSeconds).toBe(20 * 3600);
    expect(d.rest.endsAt).toBeNull();
    expect(elapsedSeconds(d, later)).toBe(600);
    // A short gap (a reload) is not a pause.
    const fresh = workoutReducer(start(), { type: "continueAfterGap", now: at(30) });
    expect(fresh.pausedSeconds).toBe(0);
  });

  it("remembers when Finish was first asked for, so a retry keeps that end time", () => {
    let d = start();
    d = workoutReducer(d, { type: "requestFinish", now: at(1800) });
    d = workoutReducer(d, { type: "requestFinish", now: at(7200) });
    expect(d.finishRequestedAt).toBe(at(1800));
  });
});
