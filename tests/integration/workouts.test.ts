import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, exerciseIds, serviceClient, stackAvailable, type TestUser } from "./helpers";
import type { FinishWorkoutInput } from "@/lib/validation/schemas";

const available = await stackAvailable();

function set(reps: number | null, weightKg: number | null, completed = true, extra: Partial<FinishWorkoutInput["exercises"][number]["sets"][number]> = {}) {
  return { reps, weightKg, durationSeconds: null, rpe: null, isWarmup: false, completed, ...extra };
}

describe.skipIf(!available)("workout logging service", async () => {
  const { finishWorkout, saveDraftSnapshot, getServerDraft, editWorkout, deleteWorkout, discardDraft } = await import("@/server/services/workouts");
  const { createPrivateProgram, activateProgram } = await import("@/server/services/programs");
  const { getActiveProgram } = await import("@/server/services/training");
  const { getProgramSeed } = await import("@/data/programs");

  let user: TestUser;
  let ex: Record<string, string>;

  beforeAll(async () => {
    user = await createTestUser("lifter");
    ex = await exerciseIds(["back-squat", "bench-press", "plank"]);
  });
  afterAll(async () => deleteTestUser(user));

  const baseInput = (clientId: string, startedAt: string, exercises: FinishWorkoutInput["exercises"]): FinishWorkoutInput => ({
    clientId,
    name: "Integration session",
    userProgramId: null,
    programDayId: null,
    startedAt,
    endedAt: new Date(Date.parse(startedAt) + 3600_000).toISOString(),
    pausedSeconds: 120,
    notes: "felt good",
    exercises,
  });

  it("saves drafts for restore and never resurrects a finished workout", async () => {
    const clientId = crypto.randomUUID();
    const startedAt = "2026-09-01T10:00:00Z";
    await saveDraftSnapshot(user.client, user.id, { clientId, name: "Draft", startedAt, userProgramId: null, programDayId: null, draft: { version: 1, marker: "first" } });
    await saveDraftSnapshot(user.client, user.id, { clientId, name: "Draft", startedAt, userProgramId: null, programDayId: null, draft: { version: 1, marker: "second" } });
    expect(await getServerDraft(user.client, user.id)).toMatchObject({ marker: "second" });

    await finishWorkout(user.client, user.id, baseInput(clientId, startedAt, [{ exerciseId: ex["back-squat"]!, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets: [set(5, 100)] }]));
    expect(await getServerDraft(user.client, user.id)).toBeNull();
    await saveDraftSnapshot(user.client, user.id, { clientId, name: "Late sync", startedAt, userProgramId: null, programDayId: null, draft: { version: 1, marker: "stale" } });
    const { data } = await user.client.from("workout_sessions").select("status, draft").eq("client_id", clientId).single();
    expect(data).toMatchObject({ status: "completed", draft: null });
  });

  it("discards an in-progress draft", async () => {
    const clientId = crypto.randomUUID();
    await saveDraftSnapshot(user.client, user.id, { clientId, name: "Discard me", startedAt: "2026-09-02T10:00:00Z", userProgramId: null, programDayId: null, draft: { version: 1 } });
    await discardDraft(user.client, user.id, clientId);
    const { data } = await user.client.from("workout_sessions").select("id").eq("client_id", clientId);
    expect(data).toEqual([]);
  });

  it("persists exercises, sets, volume and personal records, and is idempotent", async () => {
    const clientId = crypto.randomUUID();
    const input = baseInput(clientId, "2026-09-03T10:00:00Z", [
      {
        exerciseId: ex["back-squat"]!,
        substitutedFromId: null,
        notes: "belt on top set",
        skipped: false,
        skipReason: null,
        sets: [set(10, 60, true, { isWarmup: true }), set(5, 120), set(5, 125, true, { rpe: 8 }), set(5, 130, false)],
      },
      { exerciseId: ex["plank"]!, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets: [set(null, null, true, { durationSeconds: 75 })] },
      { exerciseId: ex["bench-press"]!, substitutedFromId: null, notes: "", skipped: true, skipReason: "pain", sets: [set(5, 80)] },
    ]);
    const first = await finishWorkout(user.client, user.id, input);
    expect(first.alreadyCompleted).toBe(false);
    expect(first.volumeKg).toBe(5 * 120 + 5 * 125); // warm-up, incomplete and skipped sets excluded

    const types = first.records.filter((r) => r.exerciseId === ex["back-squat"]).map((r) => r.recordType).sort();
    expect(types).toEqual(["estimated_1rm", "max_set_volume", "max_weight"]);
    expect(first.records.find((r) => r.exerciseId === ex["plank"])?.recordType).toBe("max_duration");
    expect(first.records.some((r) => r.exerciseId === ex["bench-press"])).toBe(false);

    const { data: sets } = await user.client.from("workout_sets").select("id").eq("user_id", user.id);
    const { data: wex } = await user.client.from("workout_exercises").select("skipped, skip_reason, notes").eq("session_id", first.sessionId).order("position");
    expect(wex?.[2]).toMatchObject({ skipped: true, skip_reason: "pain" });
    expect(wex?.[0]?.notes).toBe("belt on top set");

    // Retrying the same finish (e.g. after a network error) does not duplicate anything.
    const retry = await finishWorkout(user.client, user.id, input);
    expect(retry).toMatchObject({ sessionId: first.sessionId, alreadyCompleted: true });
    const { data: setsAfter } = await user.client.from("workout_sets").select("id").eq("user_id", user.id);
    expect(setsAfter?.length).toBe(sets?.length);
  });

  it("only records genuine improvements on later sessions", async () => {
    const res = await finishWorkout(
      user.client,
      user.id,
      baseInput(crypto.randomUUID(), "2026-09-05T10:00:00Z", [{ exerciseId: ex["back-squat"]!, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets: [set(3, 125)] }]),
    );
    expect(res.records).toEqual([]);
    const better = await finishWorkout(
      user.client,
      user.id,
      baseInput(crypto.randomUUID(), "2026-09-07T10:00:00Z", [{ exerciseId: ex["back-squat"]!, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets: [set(3, 140)] }]),
    );
    expect(better.records.map((r) => r.recordType).sort()).toEqual(["estimated_1rm", "max_weight"]);
  });

  it("recalculates records when a past workout is edited or deleted", async () => {
    const { data: s } = await user.client.from("workout_sessions").select("id").eq("user_id", user.id).eq("started_at", "2026-09-07T10:00:00+00:00").single();
    await editWorkout(user.client, user.id, {
      sessionId: s!.id,
      name: "Edited",
      notes: "",
      exercises: [{ exerciseId: ex["back-squat"]!, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets: [set(3, 110)] }],
    });
    const best = async () =>
      (await user.client.from("personal_records").select("value").eq("user_id", user.id).eq("exercise_id", ex["back-squat"]).eq("record_type", "max_weight").order("value", { ascending: false }).limit(1).single()).data?.value;
    expect(Number(await best())).toBe(125);
    const { data: edited } = await user.client.from("workout_sessions").select("name, total_volume_kg").eq("id", s!.id).single();
    expect(edited).toMatchObject({ name: "Edited" });
    expect(Number(edited!.total_volume_kg)).toBe(330);

    const { data: first } = await user.client.from("workout_sessions").select("id").eq("user_id", user.id).eq("started_at", "2026-09-03T10:00:00+00:00").single();
    await deleteWorkout(user.client, user.id, first!.id);
    expect(Number(await best())).toBe(125); // the 2026-09-05 session still holds 125 kg
  });

  it("advances the active program pointer after completing the scheduled day", async () => {
    const seed = getProgramSeed("foundations-full-body")!;
    const programId = await createPrivateProgram(user.client, user.id, { ...seed, slug: "x", name: "My starter" }, "starter");
    const upId = await activateProgram(user.client, user.id, programId);
    const before = await getActiveProgram(user.client, user.id);
    expect(before).toMatchObject({ currentWeek: 1, currentDay: 1 });
    expect(before!.today!.exercises.length).toBeGreaterThan(0);

    await finishWorkout(user.client, user.id, {
      ...baseInput(crypto.randomUUID(), "2026-09-10T10:00:00Z", [
        { exerciseId: before!.today!.exercises[0]!.exercise.id, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets: [set(8, 20)] },
      ]),
      userProgramId: upId,
      programDayId: before!.today!.id,
    });
    const after = await getActiveProgram(user.client, user.id);
    expect(after).toMatchObject({ currentWeek: 1, currentDay: 2 });
  });

  it("rejects a program link that belongs to another user", async () => {
    const other = await createTestUser("other");
    try {
      const { data: theirs } = await other.client.from("user_programs").select("id").limit(1);
      const seed = getProgramSeed("home-bodyweight-strength")!;
      const pid = await createPrivateProgram(other.client, other.id, { ...seed, slug: "y" }, "starter");
      const theirUp = await activateProgram(other.client, other.id, pid);
      expect(theirs).toBeDefined();
      const res = await finishWorkout(user.client, user.id, {
        ...baseInput(crypto.randomUUID(), "2026-09-11T10:00:00Z", [{ exerciseId: ex["back-squat"]!, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets: [set(1, 20)] }]),
        userProgramId: theirUp,
        programDayId: null,
      });
      const { data } = await serviceClient().from("workout_sessions").select("user_program_id").eq("id", res.sessionId).single();
      expect(data?.user_program_id).toBeNull();
    } finally {
      await deleteTestUser(other);
    }
  });
});
