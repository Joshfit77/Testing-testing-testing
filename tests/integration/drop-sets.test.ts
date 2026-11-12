import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, exerciseIds, serviceClient, stackAvailable, type TestUser } from "./helpers";
import type { FinishWorkoutInput } from "@/lib/validation/schemas";

/**
 * Drop sets (migration 20261112000062) are saved as working sets marked is_drop: they count towards the session's
 * volume, survive editing the workout afterwards, stay out of "last time" set alignment, and can't be warm-ups.
 */
const available = await stackAvailable();

describe.skipIf(!available)("drop sets are saved, kept on edit, and left out of last time", async () => {
  const { finishWorkout, editWorkout, getPreviousPerformance } = await import("@/server/services/workouts");
  const svc = serviceClient();
  let user: TestUser;
  let curl: string;

  beforeAll(async () => {
    user = await createTestUser("drop-sets");
    curl = (await exerciseIds(["dumbbell-curl"]))["dumbbell-curl"]!;
  });
  afterAll(async () => deleteTestUser(user));

  const sets = [
    { reps: 10, weightKg: 20, durationSeconds: null, rpe: null, isWarmup: false, completed: true },
    { reps: 8, weightKg: 15, durationSeconds: null, rpe: null, isWarmup: false, isDrop: true, completed: true },
    { reps: 10, weightKg: 20, durationSeconds: null, rpe: null, isWarmup: false, completed: true },
  ];
  const input = (): FinishWorkoutInput => ({
    clientId: "7d1f2c3a-1111-4b22-8c33-444455556666",
    name: "Arms",
    userProgramId: null,
    programDayId: null,
    startedAt: "2026-11-10T10:00:00.000Z",
    endedAt: "2026-11-10T11:00:00.000Z",
    pausedSeconds: 0,
    notes: "",
    exercises: [{ exerciseId: curl, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets }],
  });

  const savedSets = async (sessionId: string) => {
    const { data: wex } = await svc.from("workout_exercises").select("id").eq("session_id", sessionId);
    const { data } = await svc.from("workout_sets").select("set_number, reps, weight_kg, is_drop, is_warmup").in("workout_exercise_id", (wex ?? []).map((w) => w.id as string)).order("set_number");
    return data ?? [];
  };

  let sessionId = "";
  it("saves the drop set marked as one, and counts it in the volume", async () => {
    await finishWorkout(user.client, user.id, input());
    const { data: session } = await svc.from("workout_sessions").select("id, total_volume_kg").eq("user_id", user.id).eq("client_id", input().clientId).single();
    sessionId = session!.id as string;
    expect(Number(session!.total_volume_kg)).toBe(20 * 10 + 15 * 8 + 20 * 10);
    expect((await savedSets(sessionId)).map((s) => s.is_drop)).toEqual([false, true, false]);
  });

  it("keeps the drop set when the workout is edited afterwards", async () => {
    await editWorkout(user.client, user.id, { sessionId, name: "Arms (edited)", notes: "", exercises: input().exercises });
    expect((await savedSets(sessionId)).map((s) => s.is_drop)).toEqual([false, true, false]);
  });

  it("last time lines up with the working sets only (the drop is left out)", async () => {
    const prev = await getPreviousPerformance(user.client, user.id, [curl]);
    const p = (prev as Record<string, { sets: { reps: number | null; weightKg: number | null }[] }>)[curl]!;
    expect(p.sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [20, 10],
      [20, 10],
    ]);
  });

  it("the database refuses a warm-up drop set", async () => {
    const { data: wex } = await svc.from("workout_exercises").select("id").eq("session_id", sessionId).limit(1).single();
    const { error } = await user.client.from("workout_sets").insert({ workout_exercise_id: wex!.id, user_id: user.id, set_number: 9, reps: 5, is_warmup: true, is_drop: true, completed: true });
    expect(error).not.toBeNull();
  });
});
