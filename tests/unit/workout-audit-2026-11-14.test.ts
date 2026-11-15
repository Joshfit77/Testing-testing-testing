import { describe, expect, it } from "vitest";
import { needsWeightFirst } from "@/lib/domain/load";
import { formatRecordValue } from "@/lib/domain/record-labels";
import { bestsFromSets, detectNewRecords, estimateOneRepMax, setVolume, totalVolume, type LoggedSet } from "@/lib/domain/strength";
import { displayWeight, formatVolume, formatWeight, toKg } from "@/lib/domain/units";
import { createDraft, draftSummary, finishPayload, workoutReducer, type ExerciseRef, type WorkoutDraft } from "@/lib/domain/workout-draft";

/**
 * Workout-tracking audit, 2026-11-14 (docs/audit-2026-11-14/workouts-programs-progress.md).
 * The first two blocks are regressions for defects fixed in that audit; the rest pin behaviour that was checked by
 * hand (volume, records, units) so it can't drift unnoticed.
 */
const NOW = "2026-11-14T10:00:00.000Z";
const bench: ExerciseRef = { id: "ex-bench", slug: "bench-press", name: "Barbell Bench Press", isTimed: false };
const dbBench: ExerciseRef = { id: "ex-db-bench", slug: "dumbbell-bench-press", name: "Dumbbell Bench Press", isTimed: false };
const start = (): WorkoutDraft => createDraft({ name: "Day A", now: NOW, exercises: [{ exercise: bench, restSeconds: 90, target: { sets: 3, reps: "8" } }] });
const key = (d: WorkoutDraft, i = 0) => d.exercises[i]!.id;
const set = (reps: number | null, weightKg: number | null, extra: Partial<LoggedSet> = {}): LoggedSet => ({ reps, weightKg, completed: true, ...extra });

describe("substituting an exercise starts the replacement clean (audit W-2)", () => {
  it("'no added weight' said for one exercise never carries over to its replacement", () => {
    let d = start();
    d = workoutReducer(d, { type: "confirmNoWeight", exerciseKey: key(d) });
    expect(d.exercises[0]!.noWeightConfirmed).toBe(true);
    d = workoutReducer(d, { type: "substituteExercise", exerciseKey: key(d), replacement: dbBench });
    const replacement = d.exercises[0]!;
    expect(replacement.exerciseId).toBe("ex-db-bench");
    expect(replacement.noWeightConfirmed).toBeFalsy();
    // So a loaded replacement asks for its weight again (owner decision T8): no set is logged at zero silently.
    expect(needsWeightFirst(replacement, replacement.sets[0]!, true)).toBe(true);
  });

  it("the replacement can take its own 'last time' numbers: the prefilled mark is not inherited", () => {
    let d = start();
    d = workoutReducer(d, { type: "prefillFromPrevious", exerciseKey: key(d), sets: [{ reps: 8, weightKg: 80, durationSeconds: null, distanceM: null }] });
    expect(d.exercises[0]!.prefilled).toBe(true);
    d = workoutReducer(d, { type: "substituteExercise", exerciseKey: key(d), replacement: dbBench });
    expect(d.exercises[0]!.prefilled).toBeFalsy();
    expect(d.exercises[0]!.sets.every((s) => s.weightKg === null)).toBe(true);
    // Last time's dumbbell numbers now fill the empty weights (they are the replacement's own, never the barbell's).
    d = workoutReducer(d, { type: "prefillFromPrevious", exerciseKey: key(d), sets: [{ reps: 10, weightKg: 30, durationSeconds: null, distanceM: null }] });
    expect(d.exercises[0]!.sets.map((s) => s.weightKg)).toEqual([30, 30, 30]);
  });

  it("with sets already done, the kept part keeps its flags and only the moved part is reset", () => {
    let d = start();
    d = workoutReducer(d, { type: "confirmNoWeight", exerciseKey: key(d) });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: key(d), setId: d.exercises[0]!.sets[0]!.id, now: NOW });
    d = workoutReducer(d, { type: "substituteExercise", exerciseKey: key(d), replacement: dbBench });
    expect(d.exercises).toHaveLength(2);
    expect(d.exercises[0]!.exerciseId).toBe("ex-bench");
    expect(d.exercises[0]!.noWeightConfirmed).toBe(true);
    expect(d.exercises[1]!.exerciseId).toBe("ex-db-bench");
    expect(d.exercises[1]!.noWeightConfirmed).toBeFalsy();
    expect(d.exercises[1]!.prefilled).toBeFalsy();
  });
});

describe("record values are written the same way everywhere (audit W-3)", () => {
  it("a best set volume is a whole number in the member's unit, never a conversion tail", () => {
    // 135 lb × 8 = 1,080 lb. Stored in kg (61.23 × 8 = 489.84), one decimal of pounds read 1079.9.
    const kg = toKg(135, "imperial") * 8;
    expect(formatWeight(kg, "imperial")).toBe("1079.9 lb"); // what the completion screen used to print
    expect(formatRecordValue("max_set_volume", kg, "imperial")).toBe("1,080 lb");
    expect(formatRecordValue("max_set_volume", 480, "metric")).toBe("480 kg");
  });

  it("weights keep one decimal, reps and holds their own words", () => {
    expect(formatRecordValue("max_weight", toKg(225, "imperial"), "imperial")).toBe("225 lb");
    expect(formatRecordValue("estimated_1rm", 102.5, "metric")).toBe("102.5 kg");
    expect(formatRecordValue("max_reps", 12, "imperial")).toBe("12 reps");
    expect(formatRecordValue("max_reps", 1, "imperial")).toBe("1 rep");
    expect(formatRecordValue("max_duration", 75, "metric")).toBe("1:15");
    // An unknown type falls back to a weight rather than throwing.
    expect(formatRecordValue("something_new", 50, "metric")).toBe("50 kg");
  });
});

describe("volume (checked by hand)", () => {
  it("counts completed working sets only: warm-ups, unfinished and skipped work add nothing", () => {
    const sets: LoggedSet[] = [set(10, 40, { isWarmup: true }), set(5, 100), set(5, 102.5), set(5, 105, { completed: false })];
    // 5 × 100 + 5 × 102.5 = 1012.5
    expect(totalVolume(sets)).toBe(1012.5);
    expect(setVolume(set(10, 40, { isWarmup: true }))).toBe(0);
  });

  it("bodyweight and timed sets have no load, so no volume (never an invented body weight)", () => {
    expect(totalVolume([set(12, null), set(12, 0), { reps: null, weightKg: null, durationSeconds: 60, completed: true }])).toBe(0);
  });

  it("a drop set is a working set: its reps and weight count", () => {
    let d = start();
    const k = key(d);
    const s1 = d.exercises[0]!.sets[0]!;
    d = workoutReducer(d, { type: "updateSet", exerciseKey: k, setId: s1.id, patch: { weightKg: 100 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: k, setId: s1.id, now: NOW });
    d = workoutReducer(d, { type: "addDropSet", exerciseKey: k, afterSetId: s1.id });
    const drop = d.exercises[0]!.sets[1]!;
    expect(drop.isDrop).toBe(true);
    d = workoutReducer(d, { type: "updateSet", exerciseKey: k, setId: drop.id, patch: { weightKg: 70, reps: 10 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: k, setId: drop.id, now: NOW });
    // 8 × 100 + 10 × 70 = 1500
    expect(draftSummary(d).volumeKg).toBe(1500);
    const sent = finishPayload(d, NOW).exercises[0]!.sets;
    expect(sent.filter((s) => s.completed)).toHaveLength(2);
    expect(sent[1]).toMatchObject({ isDrop: true, weightKg: 70, reps: 10, completed: true });
  });

  it("a skipped exercise's sets are sent as logged but the summary leaves them out", () => {
    let d = start();
    const k = key(d);
    const s1 = d.exercises[0]!.sets[0]!;
    d = workoutReducer(d, { type: "updateSet", exerciseKey: k, setId: s1.id, patch: { weightKg: 100 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: k, setId: s1.id, now: NOW });
    expect(draftSummary(d).volumeKg).toBe(800);
    d = workoutReducer(d, { type: "skipExercise", exerciseKey: k, reason: "pain" });
    expect(draftSummary(d).volumeKg).toBe(0);
    expect(draftSummary(d).completedSets).toBe(0);
  });

  it("shows a pound total as whole pounds: 135 × 8 + 145 × 6 is 1,950 lb, not 1949.9", () => {
    const kg = totalVolume([set(8, toKg(135, "imperial")), set(6, toKg(145, "imperial"))]);
    expect(formatVolume(kg, "imperial")).toBe("1,950 lb");
  });
});

describe("personal records (checked by hand)", () => {
  it("a first-ever set is reported as new (the caller marks it a baseline), an equal set never is", () => {
    const first = bestsFromSets([set(5, 100)]);
    expect(detectNewRecords([], first).map((r) => r.recordType).sort()).toEqual(["estimated_1rm", "max_set_volume", "max_weight"]);
    expect(detectNewRecords(first, bestsFromSets([set(5, 100)]))).toEqual([]);
  });

  it("the same pounds entered twice are the same kilograms, so no record is made up by conversion", () => {
    for (const lb of [45, 135, 185, 225, 315, 402.5]) {
      const a = bestsFromSets([set(5, toKg(lb, "imperial"))]);
      const b = bestsFromSets([set(5, toKg(displayWeight(toKg(lb, "imperial"), "imperial"), "imperial"))]);
      expect(detectNewRecords(a, b), `${lb} lb`).toEqual([]);
    }
  });

  it("only what really improved is a record: more reps at a lighter weight beats volume and 1RM, not heaviest lift", () => {
    const before = bestsFromSets([set(5, 100)]); // e1RM 116.67, volume 500, weight 100
    const after = bestsFromSets([set(10, 90)]); // e1RM 120, volume 900, weight 90
    expect(detectNewRecords(before, after).map((r) => r.recordType).sort()).toEqual(["estimated_1rm", "max_set_volume"]);
  });

  it("warm-ups and unfinished sets can't set a record", () => {
    expect(bestsFromSets([set(1, 200, { isWarmup: true }), set(1, 210, { completed: false })])).toEqual([]);
  });

  it("estimates a 1RM with Epley for 1–12 reps and declines beyond that or without a load", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 5)).toBe(116.67); // 100 × (1 + 5/30)
    expect(estimateOneRepMax(100, 12)).toBe(140);
    expect(estimateOneRepMax(100, 13)).toBeNull();
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
    // A 20-rep set still counts for heaviest lift and set volume, just not for an estimated 1RM.
    expect(bestsFromSets([set(20, 60)]).map((r) => r.recordType).sort()).toEqual(["max_set_volume", "max_weight"]);
  });

  it("bodyweight reps and holds have their own record types", () => {
    expect(bestsFromSets([set(12, null), set(15, 0)])).toEqual([{ recordType: "max_reps", value: 15, reps: 15, weightKg: null }]);
    expect(bestsFromSets([{ reps: null, weightKg: null, durationSeconds: 90, completed: true }])).toEqual([{ recordType: "max_duration", value: 90 }]);
  });
});

describe("units round-trip (checked by hand)", () => {
  it("every half pound up to 1,500 lb comes back exactly as entered", () => {
    const bad: number[] = [];
    for (let lb = 0.5; lb <= 1500; lb += 0.5) if (displayWeight(toKg(lb, "imperial"), "imperial") !== lb) bad.push(lb);
    expect(bad).toEqual([]);
    expect(formatWeight(toKg(225, "imperial"), "imperial")).toBe("225 lb");
  });

  it("every 0.25 kg up to 700 kg is stored exactly and shown to one decimal", () => {
    for (let kg = 0.25; kg <= 700; kg += 0.25) expect(toKg(kg, "metric")).toBe(kg);
    expect(formatWeight(102.5, "metric")).toBe("102.5 kg");
  });

  it("a kilogram value read in pounds and typed back unchanged stays the same kilograms (to the stored 0.01 kg ± 0.03)", () => {
    for (const kg of [20, 60, 100, 102.5, 142.5, 200]) expect(Math.abs(toKg(displayWeight(kg, "imperial"), "imperial") - kg)).toBeLessThanOrEqual(0.03);
  });
});
