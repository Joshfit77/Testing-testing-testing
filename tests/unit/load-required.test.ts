import { describe, expect, it } from "vitest";
import { needsWeightFirst, requiresWeight } from "@/lib/domain/load";
import { workoutReducer, type WorkoutDraft } from "@/lib/domain/workout-draft";

describe("T8: a loaded exercise needs its weight (or an explicit 'no added weight') before a set is logged", () => {
  it("knows which exercises are loaded", () => {
    expect(requiresWeight(["barbell", "rack"])).toBe(true);
    expect(requiresWeight(["dumbbell"])).toBe(true);
    expect(requiresWeight(["machine"])).toBe(true);
    expect(requiresWeight(["cable"])).toBe(true);
    expect(requiresWeight(["bodyweight"])).toBe(false);
    expect(requiresWeight(["pull_up_bar"])).toBe(false);
    expect(requiresWeight(["band"])).toBe(false);
    // Doable either way (a lunge with or without dumbbells): optional.
    expect(requiresWeight(["bodyweight", "dumbbell"])).toBe(false);
    // Timed holds and distance work never ask.
    expect(requiresWeight(["dumbbell"], { isTimed: true })).toBe(false);
    expect(requiresWeight(["sandbag"], { usesDistance: true })).toBe(false);
    expect(requiresWeight(null)).toBe(false);
  });

  it("asks before logging a loaded set with no weight; never for a weight entered, a bodyweight move, or after confirming", () => {
    const ex = { isTimed: false, usesDistance: false };
    expect(needsWeightFirst(ex, { weightKg: null, completed: false }, true)).toBe(true);
    expect(needsWeightFirst(ex, { weightKg: 0, completed: false }, true)).toBe(true);
    expect(needsWeightFirst(ex, { weightKg: 60, completed: false }, true)).toBe(false);
    expect(needsWeightFirst(ex, { weightKg: null, completed: false }, false)).toBe(false);
    expect(needsWeightFirst({ ...ex, noWeightConfirmed: true }, { weightKg: null, completed: false }, true)).toBe(false);
    // Unticking a set already logged is never blocked.
    expect(needsWeightFirst(ex, { weightKg: null, completed: true }, true)).toBe(false);
  });

  it("'no added weight' is remembered on the draft for that exercise only", () => {
    const set = (id: string) => ({ id, reps: 8, weightKg: null, durationSeconds: null, distanceM: null, rpe: null, isWarmup: false, completed: false, skipped: false });
    const exercise = (id: string) => ({ id, exerciseId: `x-${id}`, slug: "back-squat", name: "Squat", isTimed: false, usesDistance: false, supersetId: null, substitutedFromId: null, substitutedFromName: null, notes: "", skipped: false, skipReason: null, restSeconds: 90, target: null, sets: [set(`${id}-1`)] });
    const draft = { exercises: [exercise("a"), exercise("b")] } as unknown as WorkoutDraft;
    const next = workoutReducer(draft, { type: "confirmNoWeight", exerciseKey: "a" });
    expect(next.exercises[0]!.noWeightConfirmed).toBe(true);
    expect(next.exercises[1]!.noWeightConfirmed).toBeUndefined();
  });
});
