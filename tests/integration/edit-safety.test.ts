import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, exerciseIds, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** A failed edit leaves a workout or template exactly as it was, instead of empty. */
describe.skipIf(!available)("failed edits never wipe a workout or a template", async () => {
  const { createTemplate, getTemplate, updateTemplate } = await import("@/server/services/templates");
  const { editWorkout, finishWorkout } = await import("@/server/services/workouts");
  let user: TestUser;
  let ids: Record<string, string>;
  const missing = "00000000-0000-4000-8000-000000000000"; // no such exercise

  beforeAll(async () => {
    user = await createTestUser("edit-safety");
    ids = await exerciseIds(["bench-press", "back-squat"]);
  });
  afterAll(async () => deleteTestUser(user));

  it("template", async () => {
    const ex = (exerciseId: string) => ({ exerciseId, sets: 3, target: "reps" as const, reps: "8", durationSeconds: null, distanceM: null, restSeconds: 90, supersetGroup: null, notes: null });
    const id = await createTemplate(user.client, user.id, { name: "Keep me", notes: null, exercises: [ex(ids["bench-press"]!), ex(ids["back-squat"]!)] });
    await expect(updateTemplate(user.client, user.id, id, { name: "Keep me", notes: null, exercises: [ex(missing)] })).rejects.toBeTruthy();
    const t = await getTemplate(user.client, user.id, id);
    expect(t?.exercises.map((e) => e.slug)).toEqual(["bench-press", "back-squat"]);
  });

  it("completed workout", async () => {
    const set = { reps: 5, weightKg: 100, durationSeconds: null, distanceM: null, rpe: null, isWarmup: false, completed: true };
    const ex = (exerciseId: string) => ({ exerciseId, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets: [set, set] });
    const res = await finishWorkout(user.client, user.id, {
      clientId: crypto.randomUUID(),
      name: "Keep me",
      userProgramId: null,
      programDayId: null,
      startedAt: new Date(Date.now() - 3600_000).toISOString(),
      endedAt: new Date().toISOString(),
      pausedSeconds: 0,
      notes: "",
      exercises: [ex(ids["bench-press"]!), ex(ids["back-squat"]!)],
    });
    const { sessionId } = res;
    await expect(editWorkout(user.client, user.id, { sessionId, name: "Keep me", notes: "", exercises: [ex(missing)] })).rejects.toBeTruthy();
    const { data } = await user.client.from("workout_exercises").select("position, exercise_id, workout_sets(id)").eq("session_id", sessionId).order("position");
    expect(data?.map((r) => r.exercise_id)).toEqual([ids["bench-press"], ids["back-squat"]]);
    expect(data?.every((r) => (r.workout_sets as unknown[]).length === 2)).toBe(true);
  });
});
