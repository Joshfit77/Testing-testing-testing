import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, exerciseIds, serviceClient, stackAvailable, type TestUser } from "./helpers";
import type { FinishWorkoutInput } from "@/lib/validation/schemas";

const available = await stackAvailable();

/**
 * Workout-tracking audit, 2026-11-14 (docs/audit-2026-11-14/workouts-programs-progress.md): what really happens in the
 * database on a retry, an edit and a delete. Synthetic users only; everything is removed with the user.
 */
describe.skipIf(!available)("workout audit 2026-11-14", async () => {
  const { finishWorkout, editWorkout, deleteWorkout, saveDraftSnapshot, discardDraft, getServerDraft } = await import("@/server/services/workouts");
  const { createPrivateProgram, activateProgram } = await import("@/server/services/programs");
  const { getActiveProgram } = await import("@/server/services/training");
  const { getAchievementStats } = await import("@/server/services/achievements");
  const { computeAchievements } = await import("@/lib/domain/achievements");
  const { getProgramSeed } = await import("@/data/programs");

  let user: TestUser;
  let ex: Record<string, string>;

  beforeAll(async () => {
    user = await createTestUser("audit1114");
    ex = await exerciseIds(["back-squat", "bench-press"]);
  });
  afterAll(async () => deleteTestUser(user));

  const set = (reps: number, weightKg: number, completed = true) => ({ reps, weightKg, durationSeconds: null, rpe: null, isWarmup: false, completed });
  const input = (clientId: string, startedAt: string, exercises: FinishWorkoutInput["exercises"], extra: Partial<FinishWorkoutInput> = {}): FinishWorkoutInput => ({
    clientId,
    name: "Audit session",
    userProgramId: null,
    programDayId: null,
    startedAt,
    endedAt: new Date(Date.parse(startedAt) + 3600_000).toISOString(),
    pausedSeconds: 0,
    notes: "",
    exercises,
    ...extra,
  });
  const squat = (sets: ReturnType<typeof set>[]) => ({ exerciseId: ex["back-squat"]!, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets });
  const counts = async () => {
    const [s, e, st, pr] = await Promise.all([
      user.client.from("workout_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      user.client.from("workout_exercises").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      user.client.from("workout_sets").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      user.client.from("personal_records").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    return { sessions: s.count, exercises: e.count, sets: st.count, records: pr.count };
  };

  it("a retried finish (lost reply) completes the program step the first attempt didn't reach (audit W-4)", async () => {
    const seed = getProgramSeed("foundations-full-body")!;
    const programId = await createPrivateProgram(serviceClient(), user.id, { ...seed, slug: "x", name: "Audit starter" }, "starter");
    const upId = await activateProgram(user.client, user.id, programId);
    const before = await getActiveProgram(user.client, user.id);
    expect(before).toMatchObject({ currentWeek: 1, currentDay: 1 });
    const payload = input(crypto.randomUUID(), "2026-09-10T10:00:00Z", [{ exerciseId: before!.today!.exercises[0]!.exercise.id, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets: [set(8, 20)] }], {
      userProgramId: upId,
      programDayId: before!.today!.id,
    });
    const first = await finishWorkout(user.client, user.id, payload);
    expect(first.alreadyCompleted).toBe(false);
    expect(await getActiveProgram(user.client, user.id)).toMatchObject({ currentWeek: 1, currentDay: 2 });

    // The state a first attempt leaves when it saved the workout but died before moving the program on (the two
    // are separate writes): session completed, pointer still on the day just done.
    await serviceClient().from("user_programs").update({ current_week: 1, current_day: 1 }).eq("id", upId);
    const retry = await finishWorkout(user.client, user.id, payload);
    expect(retry).toMatchObject({ alreadyCompleted: true, sessionId: first.sessionId });
    expect(await getActiveProgram(user.client, user.id)).toMatchObject({ currentWeek: 1, currentDay: 2 });

    // A further retry is harmless: the pointer is past that day, so it stays where it is (no double advance).
    await finishWorkout(user.client, user.id, payload);
    expect(await getActiveProgram(user.client, user.id)).toMatchObject({ currentWeek: 1, currentDay: 2 });
    const { count } = await user.client.from("workout_sessions").select("id", { count: "exact", head: true }).eq("client_id", payload.clientId);
    expect(count).toBe(1);
  });

  it("the same finish sent three times in a row saves one session, its sets once and its records once", async () => {
    const before = await counts();
    const payload = input(crypto.randomUUID(), "2026-09-12T10:00:00Z", [squat([set(5, 100), set(5, 105), set(5, 110, false)])]);
    const a = await finishWorkout(user.client, user.id, payload);
    const b = await finishWorkout(user.client, user.id, payload);
    const c = await finishWorkout(user.client, user.id, payload);
    expect([a.alreadyCompleted, b.alreadyCompleted, c.alreadyCompleted]).toEqual([false, true, true]);
    expect(new Set([a.sessionId, b.sessionId, c.sessionId]).size).toBe(1);
    expect(a.volumeKg).toBe(5 * 100 + 5 * 105);
    expect(b.volumeKg).toBe(a.volumeKg);
    // The retry reports the same records the first attempt saved, flagged as baselines (nothing came before).
    expect(b.records.map((r) => r.recordType).sort()).toEqual(a.records.map((r) => r.recordType).sort());
    expect(b.records.every((r) => r.first)).toBe(true);
    const after = await counts();
    expect(after.sessions! - before.sessions!).toBe(1);
    expect(after.exercises! - before.exercises!).toBe(1);
    expect(after.sets! - before.sets!).toBe(3);
    expect(after.records! - before.records!).toBe(a.records.length);
  });

  it("an equal performance later sets no record; editing the best set down hands the record back; deleting removes it", async () => {
    const best = async (type: string) =>
      (await user.client.from("personal_records").select("value, session_id").eq("user_id", user.id).eq("exercise_id", ex["bench-press"]).eq("record_type", type).order("value", { ascending: false }).limit(1).maybeSingle()).data;
    const bench = (sets: ReturnType<typeof set>[]) => ({ exerciseId: ex["bench-press"]!, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets });

    const one = await finishWorkout(user.client, user.id, input(crypto.randomUUID(), "2026-09-14T10:00:00Z", [bench([set(5, 80)])]));
    expect(one.records.every((r) => r.first)).toBe(true);
    const same = await finishWorkout(user.client, user.id, input(crypto.randomUUID(), "2026-09-15T10:00:00Z", [bench([set(5, 80)])]));
    expect(same.records).toEqual([]); // equal, not greater
    const better = await finishWorkout(user.client, user.id, input(crypto.randomUUID(), "2026-09-16T10:00:00Z", [bench([set(5, 85)])]));
    expect(better.records.map((r) => r.recordType).sort()).toEqual(["estimated_1rm", "max_set_volume", "max_weight"]);
    expect(better.records.every((r) => !r.first)).toBe(true);
    expect(Number((await best("max_weight"))!.value)).toBe(85);

    // The member corrects a typo: it was 75, not 85. The record goes back to the first session's 80.
    const edited = await editWorkout(user.client, user.id, { sessionId: better.sessionId, name: "Audit session", notes: "", exercises: [bench([set(5, 75)])] });
    expect(edited.volumeKg).toBe(375);
    const afterEdit = await best("max_weight");
    expect(Number(afterEdit!.value)).toBe(80);
    expect(afterEdit!.session_id).toBe(one.sessionId);
    const { data: session } = await user.client.from("workout_sessions").select("total_volume_kg").eq("id", better.sessionId).single();
    expect(Number(session!.total_volume_kg)).toBe(375);

    // Badges are worked out from what is stored now: with the corrected set there is no beaten record left.
    const stats = await getAchievementStats(user.client, user.id, "UTC");
    const benchOnly = { ...stats, prs: stats.prs.filter((p) => p.exerciseId === ex["bench-press"]) };
    expect(new Set(benchOnly.prs.map((p) => p.sessionId))).toEqual(new Set([one.sessionId]));
    expect(computeAchievements(benchOnly, "2026-11-14").find((b) => b.id === "first-pr")!.earned).toBe(false);

    // Deleting the first session moves the baseline to the next one that still exists.
    await deleteWorkout(user.client, user.id, one.sessionId);
    const afterDelete = await best("max_weight");
    expect(Number(afterDelete!.value)).toBe(80);
    expect(afterDelete!.session_id).toBe(same.sessionId);
    const workoutsNow = (await getAchievementStats(user.client, user.id, "UTC")).workouts.map((w) => w.sessionId);
    expect(workoutsNow).not.toContain(one.sessionId);
  });

  it("a discarded workout is gone from the server and a late backup of a finished one changes nothing", async () => {
    const clientId = crypto.randomUUID();
    const startedAt = "2026-09-18T10:00:00Z";
    await saveDraftSnapshot(user.client, user.id, { clientId, name: "To discard", startedAt, userProgramId: null, programDayId: null, draft: { version: 2, marker: "x" } });
    expect(await getServerDraft(user.client, user.id)).toMatchObject({ marker: "x" });
    await discardDraft(user.client, user.id, clientId);
    expect(await getServerDraft(user.client, user.id)).toBeNull();
    const { data } = await user.client.from("workout_sessions").select("id").eq("client_id", clientId);
    expect(data).toEqual([]);
    // Discarding never touches a completed workout, even when asked with its client id.
    const done = await finishWorkout(user.client, user.id, input(crypto.randomUUID(), "2026-09-19T10:00:00Z", [squat([set(3, 60)])]));
    const { data: row } = await user.client.from("workout_sessions").select("client_id").eq("id", done.sessionId).single();
    await discardDraft(user.client, user.id, row!.client_id as string);
    const { data: still } = await user.client.from("workout_sessions").select("status").eq("id", done.sessionId).single();
    expect(still?.status).toBe("completed");
  });
});
