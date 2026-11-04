import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, exerciseIds, stackAvailable, type TestUser } from "./helpers";
import { createDraft, draftSnapshot, finishPayload, migrateDraft, nextUp, workoutReducer, type WorkoutDraft } from "@/lib/domain/workout-draft";
import { finishWorkoutSchema } from "@/lib/validation/schemas";

const available = await stackAvailable();

/**
 * The fast-logging path against the real local database: each completed set is backed up as it happens and restores
 * exactly (a reload or another device), Finish stores what was done and what was skipped, the next workout is filled
 * in from it, and a retried Finish never duplicates sets.
 */
describe.skipIf(!available)("fast workout logging, saved and read back", async () => {
  const { saveDraftSnapshot, getServerDraft, finishWorkout, getPreviousPerformance } = await import("@/server/services/workouts");

  let user: TestUser;
  let ex: Record<string, string>;
  const lb = (n: number) => Math.round(n * 0.45359237 * 100) / 100;

  beforeAll(async () => {
    user = await createTestUser("fastlog");
    ex = await exerciseIds(["bench-press", "back-squat"]);
  });
  afterAll(async () => deleteTestUser(user));

  function start(now: string): WorkoutDraft {
    return createDraft({
      name: "Fast logging",
      now,
      exercises: [
        { exercise: { id: ex["bench-press"]!, slug: "bench-press", name: "Bench Press", isTimed: false }, restSeconds: 120 },
        { exercise: { id: ex["back-squat"]!, slug: "back-squat", name: "Back Squat", isTimed: false }, restSeconds: 150 },
      ],
    });
  }
  const backup = (d: WorkoutDraft) => saveDraftSnapshot(user.client, user.id, draftSnapshot(d));

  it("backs up every completed set, restores it exactly, stores done and skipped sets, and fills the next workout in", async () => {
    const t0 = "2026-11-02T17:00:00.000Z";
    let d = start(t0);
    const bench = d.exercises[0]!;
    const squat = d.exercises[1]!;
    const [b1, b2, b3] = bench.sets;

    // Set 1: 135 × 10, one tap → backed up.
    d = workoutReducer(d, { type: "updateSet", exerciseKey: bench.id, setId: b1!.id, patch: { weightKg: lb(135), reps: 10 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: bench.id, setId: b1!.id, now: t0 });
    await backup(d);
    // Set 2: 155 × 8; set 3 repeats it with one tap.
    d = workoutReducer(d, { type: "updateSet", exerciseKey: bench.id, setId: b2!.id, patch: { weightKg: lb(155), reps: 8 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: bench.id, setId: b2!.id, now: t0 });
    await backup(d);
    d = workoutReducer(d, { type: "repeatLastSet", exerciseKey: bench.id, setId: b3!.id });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: bench.id, setId: b3!.id, now: t0 });
    await backup(d);
    // Squat: set 1 done, set 2 skipped (the app closes here).
    d = workoutReducer(d, { type: "updateSet", exerciseKey: squat.id, setId: squat.sets[0]!.id, patch: { weightKg: 100, reps: 5 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: squat.id, setId: squat.sets[0]!.id, now: t0 });
    d = workoutReducer(d, { type: "skipSet", exerciseKey: squat.id, setId: squat.sets[1]!.id });
    await backup(d);

    // Reopened (another device, or after the app was killed): the same workout, at the same place.
    const restored = migrateDraft(await getServerDraft(user.client, user.id));
    expect(restored).toEqual(d);
    expect(nextUp(restored!)).toEqual({ exerciseKey: squat.id, setId: squat.sets[2]!.id });

    // Finish early from there: the payload the logger sends is valid, and what was done is what is stored.
    const payload = finishWorkoutSchema.parse(finishPayload(restored!, "2026-11-02T17:40:00.000Z"));
    const res = await finishWorkout(user.client, user.id, payload);
    expect(res.volumeKg).toBeCloseTo(lb(135) * 10 + lb(155) * 8 * 2 + 100 * 5, 6);
    const { data: rows } = await user.client
      .from("workout_sets")
      .select("set_number, reps, weight_kg, completed, workout_exercise:workout_exercises!inner(exercise_id, session_id)")
      .eq("workout_exercise.session_id", res.sessionId)
      .order("set_number");
    const byExercise = (id: string) => (rows ?? []).filter((r) => (r.workout_exercise as unknown as { exercise_id: string }).exercise_id === id).map((r) => [r.set_number, r.reps, Number(r.weight_kg), r.completed]);
    expect(byExercise(ex["bench-press"]!)).toEqual([
      [1, 10, lb(135), true],
      [2, 8, lb(155), true],
      [3, 8, lb(155), true],
    ]);
    // The skipped set and the one not reached are kept with the session as not done.
    expect(byExercise(ex["back-squat"]!).map(([n, , , done]) => [n, done])).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ]);
    expect(await getServerDraft(user.client, user.id)).toBeNull();

    // A retried Finish (the reply was lost) returns the same session and adds nothing.
    const again = await finishWorkout(user.client, user.id, payload);
    expect(again).toMatchObject({ sessionId: res.sessionId, alreadyCompleted: true });
    const { count } = await user.client.from("workout_sets").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    expect(count).toBe(6);

    // Next workout: last time's numbers are already there, set by set.
    const previous = await getPreviousPerformance(user.client, user.id, [ex["bench-press"]!]);
    let next = start("2026-11-04T17:00:00.000Z");
    const nb = next.exercises[0]!;
    const sets = previous[ex["bench-press"]!]!.sets.filter((s) => s.completed && !s.isWarmup).map((s) => ({ reps: s.reps, weightKg: s.weightKg, durationSeconds: s.durationSeconds, distanceM: s.distanceM }));
    next = workoutReducer(next, { type: "prefillFromPrevious", exerciseKey: nb.id, sets });
    expect(next.exercises[0]!.sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [lb(135), 10],
      [lb(155), 8],
      [lb(155), 8],
    ]);
  });
});
