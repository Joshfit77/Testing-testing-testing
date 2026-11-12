import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, exerciseIds, serviceClient, stackAvailable, type TestUser } from "./helpers";
import type { FinishWorkoutInput } from "@/lib/validation/schemas";

/**
 * Duplicate submissions of one workout's Finish that arrive at the same time (a retry sent while the first request
 * is still in flight on slow gym Wi-Fi, or two open tabs) must save the workout once: one session, its exercises and
 * sets once, its personal records once. workouts.test.ts covers a retry that arrives after the first finished.
 */
const available = await stackAvailable();

describe.skipIf(!available)("finishing the same workout concurrently saves it once", async () => {
  const { finishWorkout, saveDraftSnapshot } = await import("@/server/services/workouts");
  const svc = serviceClient();
  let user: TestUser;
  let squat: string;

  beforeAll(async () => {
    user = await createTestUser("finish-race");
    squat = (await exerciseIds(["back-squat"]))["back-squat"]!;
  });
  afterAll(async () => deleteTestUser(user));

  const input = (clientId: string, startedAt: string): FinishWorkoutInput => ({
    clientId,
    name: "Race session",
    userProgramId: null,
    programDayId: null,
    startedAt,
    endedAt: new Date(Date.parse(startedAt) + 3600_000).toISOString(),
    pausedSeconds: 0,
    notes: "",
    exercises: [
      {
        exerciseId: squat,
        substitutedFromId: null,
        notes: "",
        skipped: false,
        skipReason: null,
        sets: [
          { reps: 5, weightKg: 100, durationSeconds: null, rpe: null, isWarmup: false, completed: true },
          { reps: 5, weightKg: 105, durationSeconds: null, rpe: null, isWarmup: false, completed: true },
        ],
      },
    ],
  });

  const counts = async (clientId: string) => {
    const { data: sessions } = await svc.from("workout_sessions").select("id, status").eq("user_id", user.id).eq("client_id", clientId);
    const ids = (sessions ?? []).map((s) => s.id as string);
    const { count: exercises } = await svc.from("workout_exercises").select("id", { count: "exact", head: true }).in("session_id", ids);
    const { data: wex } = await svc.from("workout_exercises").select("id").in("session_id", ids);
    const { count: sets } = await svc.from("workout_sets").select("id", { count: "exact", head: true }).in("workout_exercise_id", (wex ?? []).map((w) => w.id as string));
    const { count: records } = await svc.from("personal_records").select("id", { count: "exact", head: true }).in("session_id", ids);
    return { sessions: sessions ?? [], exercises: exercises ?? 0, sets: sets ?? 0, records: records ?? 0 };
  };

  async function race(clientId: string, startedAt: string, n: number) {
    const results = await Promise.allSettled(Array.from({ length: n }, () => finishWorkout(user.client, user.id, input(clientId, startedAt))));
    // At least one attempt saved it; any other either reports it as already saved or fails (and its retry would then
    // find it saved).
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    return results;
  }

  it("with no server draft: one session, two sets, records once", async () => {
    const clientId = crypto.randomUUID();
    await race(clientId, "2026-08-01T10:00:00Z", 4);
    const c = await counts(clientId);
    expect(c.sessions).toEqual([expect.objectContaining({ status: "completed" })]);
    expect(c.exercises).toBe(1);
    expect(c.sets).toBe(2);
    // A retry afterwards reports it as already saved and adds nothing.
    expect(await finishWorkout(user.client, user.id, input(clientId, "2026-08-01T10:00:00Z"))).toMatchObject({ alreadyCompleted: true });
    expect(await counts(clientId)).toEqual(c);
  });

  it("with the in-progress server draft already saved (the usual case): one session, two sets, records once", async () => {
    const clientId = crypto.randomUUID();
    const startedAt = "2026-08-02T10:00:00Z";
    await saveDraftSnapshot(user.client, user.id, { clientId, name: "Race session", startedAt, userProgramId: null, programDayId: null, draft: { version: 2 } });
    await race(clientId, startedAt, 4);
    const c = await counts(clientId);
    expect(c.sessions).toEqual([expect.objectContaining({ status: "completed" })]);
    expect(c.exercises).toBe(1);
    expect(c.sets).toBe(2);
    const { data: records } = await svc.from("personal_records").select("record_type").in("session_id", c.sessions.map((s) => s.id as string));
    const types = (records ?? []).map((r) => r.record_type as string);
    expect(new Set(types).size).toBe(types.length);
  });
});
