import { describe, expect, it } from "vitest";
import { loggedByTime, prescribedByTime } from "@/lib/domain/timed-sets";
import { createDraft, setCanComplete, workoutReducer } from "@/lib/domain/workout-draft";
import { repeatFromSession } from "@/lib/domain/workout-templates";

/**
 * Audit finding P-3 (2026-11-14): programs prescribe some rep exercises by time (kettlebell swings 30 s, cat-cow 45 s).
 * The logger used to open those sets with no reps and no time, so they could not be completed with one tap, and the
 * time prescribed was never what was logged.
 */
describe("exercises a program prescribes by time", () => {
  it("counts as timed only when the target gives seconds and no reps", () => {
    expect(prescribedByTime(false, { reps: null, seconds: 30 })).toBe(true);
    expect(prescribedByTime(false, { reps: "", seconds: 45 })).toBe(true);
    expect(prescribedByTime(false, { reps: "8-10", seconds: null })).toBe(false);
    // Reps with a time cap ("10 reps inside 30 s") stay a rep exercise.
    expect(prescribedByTime(false, { reps: "10", seconds: 30 })).toBe(false);
    expect(prescribedByTime(false, { reps: null, seconds: null })).toBe(false);
    expect(prescribedByTime(false, { reps: null, seconds: 0 })).toBe(false);
    // A catalog-timed exercise is timed whatever the target says.
    expect(prescribedByTime(true, { reps: "5", seconds: null })).toBe(true);
  });

  it("opens each set with the prescribed seconds, so one tap completes it", () => {
    const target = { sets: 3, reps: null, seconds: 30, rpe: null, intensity: null };
    const swing = { id: "00000000-0000-4000-8000-000000000001", slug: "kettlebell-swing", name: "Kettlebell Swing" };
    const asReps = workoutReducer(createDraft({ name: "Circuit", now: "2026-11-15T10:00:00.000Z" }), { type: "addExercise", exercise: { ...swing, isTimed: false }, target, restSeconds: 30 });
    // What the logger did before: nothing to complete until reps are typed.
    expect(asReps.exercises[0]!.sets.every((s) => !setCanComplete(asReps.exercises[0]!, s))).toBe(true);

    const timed = prescribedByTime(false, target);
    const d = workoutReducer(createDraft({ name: "Circuit", now: "2026-11-15T10:00:00.000Z" }), { type: "addExercise", exercise: { ...swing, isTimed: timed }, target, restSeconds: 30 });
    const ex = d.exercises[0]!;
    expect(ex.isTimed).toBe(true);
    expect(ex.sets).toHaveLength(3);
    for (const s of ex.sets) {
      expect(s.durationSeconds).toBe(30);
      expect(s.reps).toBeNull();
      expect(setCanComplete(ex, s)).toBe(true);
    }
  });

  it("reads saved time-only sets as time, and ordinary sets as reps", () => {
    expect(loggedByTime(false, [{ reps: null, durationSeconds: 30 }, { reps: null, durationSeconds: 30 }])).toBe(true);
    expect(loggedByTime(false, [{ reps: 0, durationSeconds: 45 }])).toBe(true);
    expect(loggedByTime(false, [{ reps: 8, durationSeconds: null }])).toBe(false);
    // Reps logged with a stopwatch value beside them are still reps.
    expect(loggedByTime(false, [{ reps: 12, durationSeconds: 30 }])).toBe(false);
    expect(loggedByTime(false, [])).toBe(false);
    expect(loggedByTime(false, [{ reps: null, durationSeconds: null }])).toBe(false);
    expect(loggedByTime(true, [{ reps: 8, durationSeconds: null }])).toBe(true);
  });

  it('"do this workout again" repeats a time-logged rep exercise by time', () => {
    const set = (n: number, reps: number | null, seconds: number | null) => ({ set_number: n, reps, duration_seconds: seconds, distance_m: null, is_warmup: false, is_drop: false, completed: true });
    const again = repeatFromSession({
      name: "Kettlebell circuit",
      exercises: [
        { position: 0, skipped: false, exercise: { id: "a", slug: "kettlebell-swing", name: "Kettlebell Swing", is_timed: false }, sets: [set(1, null, 30), set(2, null, 30)] },
        { position: 1, skipped: false, exercise: { id: "b", slug: "goblet-squat", name: "Goblet Squat", is_timed: false }, sets: [set(1, 10, null), set(2, 10, null)] },
      ],
    });
    expect(again.exercises[0]!.exercise.isTimed).toBe(true);
    expect(again.exercises[0]!.target).toMatchObject({ sets: 2, reps: null, seconds: 30 });
    expect(again.exercises[1]!.exercise.isTimed).toBe(false);
    expect(again.exercises[1]!.target).toMatchObject({ sets: 2, reps: "10", seconds: null });
  });
});
