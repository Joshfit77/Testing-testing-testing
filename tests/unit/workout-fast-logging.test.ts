import { describe, expect, it } from "vitest";
import {
  afterCurrent,
  createDraft,
  currentSetInfo,
  draftSummary,
  lastDoneBefore,
  migrateDraft,
  nextUp,
  restRemaining,
  targetRepRange,
  workoutReducer,
  type ExerciseRef,
  type PreviousSetValues,
  type WorkoutDraft,
} from "@/lib/domain/workout-draft";

const NOW = "2026-11-04T10:00:00.000Z";
const bench: ExerciseRef = { id: "ex-bench", slug: "barbell-bench-press", name: "Barbell Bench Press", isTimed: false };
const row: ExerciseRef = { id: "ex-row", slug: "barbell-row", name: "Barbell Row", isTimed: false };
const curl: ExerciseRef = { id: "ex-curl", slug: "dumbbell-curl", name: "Dumbbell Curl", isTimed: false };
const at = (seconds: number) => new Date(Date.parse(NOW) + seconds * 1000).toISOString();
const lbs = (lb: number) => Math.round(lb * 0.45359237 * 100) / 100;
const prev = (...sets: [number | null, number | null][]): PreviousSetValues[] => sets.map(([weightKg, reps]) => ({ weightKg, reps, durationSeconds: null, distanceM: null }));
const numbers = (d: WorkoutDraft, i = 0) => d.exercises[i]!.sets.map((s) => [s.weightKg, s.reps]);

function custom(): WorkoutDraft {
  // An exercise added from the library: no program target, so no reps of its own.
  return createDraft({ name: "Push", now: NOW, exercises: [{ exercise: bench, restSeconds: 120 }] });
}

function program(reps: string, sets = 3): WorkoutDraft {
  return createDraft({ name: "Day A", now: NOW, exercises: [{ exercise: bench, restSeconds: 120, target: { sets, reps } }] });
}

describe("previous performance fills the workout in", () => {
  it("last workout's 135×10, 155×8, 155×8 are already there next time", () => {
    let d = custom();
    d = workoutReducer(d, { type: "prefillFromPrevious", exerciseKey: d.exercises[0]!.id, sets: prev([lbs(135), 10], [lbs(155), 8], [lbs(155), 8]) });
    expect(numbers(d)).toEqual([
      [lbs(135), 10],
      [lbs(155), 8],
      [lbs(155), 8],
    ]);
  });

  it("a program rep range takes last time's reps when they were inside it", () => {
    let d = program("8-10");
    expect(numbers(d).map(([, r]) => r)).toEqual([8, 8, 8]);
    d = workoutReducer(d, { type: "prefillFromPrevious", exerciseKey: d.exercises[0]!.id, sets: prev([60, 10], [70, 8], [70, 8]) });
    expect(numbers(d)).toEqual([
      [60, 10],
      [70, 8],
      [70, 8],
    ]);
  });

  it("reps outside the range, or a fixed rep target, keep the program's number", () => {
    let d = program("8–10");
    d = workoutReducer(d, { type: "prefillFromPrevious", exerciseKey: d.exercises[0]!.id, sets: prev([60, 12], [70, 6], [70, 9]) });
    expect(numbers(d).map(([, r]) => r)).toEqual([8, 8, 9]);
    let f = program("5");
    f = workoutReducer(f, { type: "prefillFromPrevious", exerciseKey: f.exercises[0]!.id, sets: prev([100, 8]) });
    expect(numbers(f)).toEqual([
      [100, 5],
      [100, 5],
      [100, 5],
    ]);
  });

  it("warm-up sets keep their own numbers; working sets line up with last time's working sets", () => {
    let d = program("8", 3);
    const k = d.exercises[0]!.id;
    const [w] = d.exercises[0]!.sets;
    d = workoutReducer(d, { type: "updateSet", exerciseKey: k, setId: w!.id, patch: { isWarmup: true } });
    d = workoutReducer(d, { type: "prefillFromPrevious", exerciseKey: k, sets: prev([80, 8], [85, 8]) });
    expect(numbers(d)).toEqual([
      [null, 8],
      [80, 8],
      [85, 8],
    ]);
  });

  it("fills only once: a weight cleared on purpose stays empty when the workout is resumed", () => {
    let d = custom();
    const k = d.exercises[0]!.id;
    d = workoutReducer(d, { type: "prefillFromPrevious", exerciseKey: k, sets: prev([20, 12]) });
    expect(d.exercises[0]!.prefilled).toBe(true);
    const s1 = d.exercises[0]!.sets[0]!;
    d = workoutReducer(d, { type: "updateSet", exerciseKey: k, setId: s1.id, patch: { weightKg: null } });
    // Reload: the stored draft comes back and the logger offers last time again.
    const restored = migrateDraft(JSON.parse(JSON.stringify(d)))!;
    const again = workoutReducer(restored, { type: "prefillFromPrevious", exerciseKey: k, sets: prev([20, 12]) });
    expect(again).toBe(restored);
    expect(again.exercises[0]!.sets[0]!.weightKg).toBeNull();
  });

  it("never changes a set already done", () => {
    let d = custom();
    const k = d.exercises[0]!.id;
    const s1 = d.exercises[0]!.sets[0]!;
    d = workoutReducer(d, { type: "updateSet", exerciseKey: k, setId: s1.id, patch: { weightKg: 50, reps: 5 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: k, setId: s1.id, now: NOW });
    d = workoutReducer(d, { type: "prefillFromPrevious", exerciseKey: k, sets: prev([60, 10]) });
    expect(numbers(d)[0]).toEqual([50, 5]);
  });

  it("reads rep ranges the ways programs write them", () => {
    expect(targetRepRange("8-10")).toEqual({ lo: 8, hi: 10 });
    expect(targetRepRange("8–10 reps")).toEqual({ lo: 8, hi: 10 });
    expect(targetRepRange("12 to 15")).toEqual({ lo: 12, hi: 15 });
    expect(targetRepRange("5")).toEqual({ lo: 5, hi: 5 });
    expect(targetRepRange("AMRAP")).toBeNull();
    expect(targetRepRange(null)).toBeNull();
  });
});

describe("one tap completes a set", () => {
  it("records it, starts the programmed rest, and moves to the next set with the same numbers", () => {
    let d = custom();
    const k = d.exercises[0]!.id;
    const [s1, s2] = d.exercises[0]!.sets;
    d = workoutReducer(d, { type: "updateSet", exerciseKey: k, setId: s1!.id, patch: { weightKg: lbs(155), reps: 8 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: k, setId: s1!.id, now: NOW });
    expect(d.exercises[0]!.sets[0]!.completed).toBe(true);
    expect(restRemaining(d, NOW)).toBe(120);
    expect(nextUp(d)).toEqual({ exerciseKey: k, setId: s2!.id });
    expect(numbers(d)[1]).toEqual([lbs(155), 8]);
    expect(draftSummary(d)).toMatchObject({ completedSets: 1, totalSets: 3, workingRemaining: 2 });
    // Rest: add time, then skip it.
    d = workoutReducer(d, { type: "adjustRest", deltaSeconds: 15, now: at(10) });
    expect(restRemaining(d, at(10))).toBe(125);
    d = workoutReducer(d, { type: "clearRest" });
    expect(restRemaining(d, at(11))).toBe(0);
  });
});

describe("Same as last set", () => {
  it("copies the numbers of the last set done on that exercise", () => {
    let d = program("8-10");
    const k = d.exercises[0]!.id;
    d = workoutReducer(d, { type: "prefillFromPrevious", exerciseKey: k, sets: prev([60, 10], [70, 8], [70, 8]) });
    const [s1, s2] = d.exercises[0]!.sets;
    // Today set 1 went 65 × 9 instead of 60 × 10; set 2 still shows last time's 70 × 8.
    d = workoutReducer(d, { type: "updateSet", exerciseKey: k, setId: s1!.id, patch: { weightKg: 65, reps: 9 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: k, setId: s1!.id, now: NOW });
    expect(numbers(d)[1]).toEqual([70, 8]);
    expect(lastDoneBefore(d.exercises[0]!, s2!.id)?.id).toBe(s1!.id);
    d = workoutReducer(d, { type: "repeatLastSet", exerciseKey: k, setId: s2!.id });
    expect(numbers(d)[1]).toEqual([65, 9]);
    // Nothing to change the second time.
    expect(workoutReducer(d, { type: "repeatLastSet", exerciseKey: k, setId: s2!.id })).toBe(d);
  });

  it("does nothing before any set is done, or on a set already done", () => {
    const d = custom();
    const k = d.exercises[0]!.id;
    const [s1] = d.exercises[0]!.sets;
    expect(workoutReducer(d, { type: "repeatLastSet", exerciseKey: k, setId: s1!.id })).toBe(d);
  });
});

describe("skipping a set", () => {
  it("passes over it without counting it, and Undo brings it back", () => {
    let d = custom();
    const k = d.exercises[0]!.id;
    const [s1, s2, s3] = d.exercises[0]!.sets;
    d = workoutReducer(d, { type: "skipSet", exerciseKey: k, setId: s1!.id });
    expect(nextUp(d)).toEqual({ exerciseKey: k, setId: s2!.id });
    expect(currentSetInfo(d)).toMatchObject({ workingNumber: 2, workingCount: 3 });
    expect(draftSummary(d)).toMatchObject({ completedSets: 0, skippedSets: 1, workingRemaining: 2 });
    d = workoutReducer(d, { type: "unskipSet", exerciseKey: k, setId: s1!.id });
    expect(nextUp(d)).toEqual({ exerciseKey: k, setId: s1!.id });
    // Skip the last set: nothing is left, so finishing isn't "early".
    d = workoutReducer(d, { type: "updateSet", exerciseKey: k, setId: s1!.id, patch: { reps: 5 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: k, setId: s1!.id, now: NOW });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: k, setId: s2!.id, now: NOW });
    d = workoutReducer(d, { type: "skipSet", exerciseKey: k, setId: s3!.id });
    expect(nextUp(d)).toBeNull();
    expect(draftSummary(d)).toMatchObject({ workingCompleted: 2, workingTotal: 3, workingRemaining: 0 });
  });

  it("a done set can't be skipped, and completing a skipped set counts it after all", () => {
    let d = custom();
    const k = d.exercises[0]!.id;
    const [s1] = d.exercises[0]!.sets;
    d = workoutReducer(d, { type: "updateSet", exerciseKey: k, setId: s1!.id, patch: { reps: 5 } });
    d = workoutReducer(d, { type: "skipSet", exerciseKey: k, setId: s1!.id });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: k, setId: s1!.id, now: NOW });
    expect(d.exercises[0]!.sets[0]).toMatchObject({ completed: true, skipped: false });
    const again = workoutReducer(d, { type: "skipSet", exerciseKey: k, setId: s1!.id });
    expect(again.exercises[0]!.sets[0]).toMatchObject({ completed: true, skipped: false });
  });

  it("the numbers just logged carry past a skipped set to the next one still to do", () => {
    let d = custom();
    const k = d.exercises[0]!.id;
    const [s1, s2, s3] = d.exercises[0]!.sets;
    d = workoutReducer(d, { type: "skipSet", exerciseKey: k, setId: s2!.id });
    d = workoutReducer(d, { type: "updateSet", exerciseKey: k, setId: s1!.id, patch: { weightKg: 40, reps: 12 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: k, setId: s1!.id, now: NOW });
    expect(numbers(d)[1]).toEqual([null, null]);
    expect(numbers(d)[2]).toEqual([40, 12]);
    expect(nextUp(d)).toEqual({ exerciseKey: k, setId: s3!.id });
  });

  it("inside a superset, skipping A1 goes straight to B1", () => {
    const d0 = createDraft({
      name: "Pair",
      now: NOW,
      exercises: [
        { exercise: bench, restSeconds: 90, target: { sets: 2, reps: "8" }, supersetGroup: 1 },
        { exercise: row, restSeconds: 90, target: { sets: 2, reps: "8" }, supersetGroup: 1 },
      ],
    });
    const [a, b] = d0.exercises;
    const d = workoutReducer(d0, { type: "skipSet", exerciseKey: a!.id, setId: a!.sets[0]!.id });
    expect(nextUp(d)).toEqual({ exerciseKey: b!.id, setId: b!.sets[0]!.id });
  });

  it("survives a reload (the draft is stored as it is)", () => {
    let d = custom();
    const k = d.exercises[0]!.id;
    d = workoutReducer(d, { type: "skipSet", exerciseKey: k, setId: d.exercises[0]!.sets[0]!.id });
    const restored = migrateDraft(JSON.parse(JSON.stringify(d)))!;
    expect(restored.exercises[0]!.sets[0]!.skipped).toBe(true);
    expect(nextUp(restored)).toEqual(nextUp(d));
  });
});

describe("what comes next", () => {
  it("names the next set of the same exercise, then the next exercise, then nothing", () => {
    let d = createDraft({
      name: "Day",
      now: NOW,
      exercises: [
        { exercise: bench, restSeconds: 90, target: { sets: 2, reps: "8" } },
        { exercise: curl, restSeconds: 60, target: { sets: 1, reps: "12" } },
      ],
    });
    const [a, c] = d.exercises;
    expect(afterCurrent(d)).toMatchObject({ exercise: { id: a!.id }, workingNumber: 2 });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: a!.id, setId: a!.sets[0]!.id, now: NOW });
    expect(afterCurrent(d)).toMatchObject({ exercise: { id: c!.id }, workingNumber: 1, exerciseNumber: 2 });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: a!.id, setId: a!.sets[1]!.id, now: NOW });
    expect(afterCurrent(d)).toBeNull();
    // (afterCurrent never changes the draft itself.)
    expect(nextUp(d)).toEqual({ exerciseKey: c!.id, setId: c!.sets[0]!.id });
  });
});
