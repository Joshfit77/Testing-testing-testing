import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, exerciseIds, stackAvailable, type TestUser } from "./helpers";
import type { FinishWorkoutInput } from "@/lib/validation/schemas";

const available = await stackAvailable();

/**
 * W-5 (docs/audit-2026-11-14/workouts-programs-progress.md): a Finish is saved on the server but its reply is lost;
 * the member logs more sets, then taps Finish again. The retry must store those sets, not answer with the first save.
 * Synthetic users only; everything is removed with the user.
 */
describe.skipIf(!available)("Finish after a lost reply keeps every set logged since", async () => {
  const { finishWorkout } = await import("@/server/services/workouts");

  let user: TestUser;
  let ex: Record<string, string>;

  beforeAll(async () => {
    user = await createTestUser("lostreply");
    ex = await exerciseIds(["back-squat", "bench-press"]);
  });
  afterAll(async () => deleteTestUser(user));

  const set = (reps: number, weightKg: number, completed = true) => ({ reps, weightKg, durationSeconds: null, rpe: null, isWarmup: false, completed });
  const move = (slug: string, sets: ReturnType<typeof set>[]) => ({ exerciseId: ex[slug]!, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets });
  const payload = (clientId: string, exercises: FinishWorkoutInput["exercises"], endedAt = "2026-10-01T11:00:00Z"): FinishWorkoutInput => ({
    clientId,
    name: "Lost reply",
    userProgramId: null,
    programDayId: null,
    startedAt: "2026-10-01T10:00:00Z",
    endedAt,
    pausedSeconds: 0,
    notes: "",
    exercises,
  });
  const saved = async (clientId: string) => {
    const { data: s } = await user.client.from("workout_sessions").select("id, status, total_volume_kg, ended_at").eq("client_id", clientId).single();
    const { data: rows } = await user.client
      .from("workout_exercises")
      .select("id, exercise_id, position, sets:workout_sets(set_number, reps, weight_kg, completed)")
      .eq("session_id", s!.id)
      .order("position");
    const exercises = (rows ?? []).map((r) => ({ id: r.id as string, exerciseId: r.exercise_id as string, sets: [...(r.sets as { set_number: number; reps: number; weight_kg: number; completed: boolean }[])].sort((a, b) => a.set_number - b.set_number) }));
    const { count } = await user.client.from("workout_sessions").select("id", { count: "exact", head: true }).eq("client_id", clientId);
    return { session: s!, exercises, sessions: count };
  };

  it("sets logged after the lost reply are stored by the retry: one workout, every set, volume and end time updated", async () => {
    const clientId = crypto.randomUUID();
    const first = await finishWorkout(user.client, user.id, payload(clientId, [move("back-squat", [set(5, 100), set(5, 100)])]));
    expect(first).toMatchObject({ alreadyCompleted: false, volumeKg: 1000 });
    // The reply was lost; the member did two more sets (one on a new exercise) and tapped Finish again a minute later.
    const later = payload(clientId, [move("back-squat", [set(5, 100), set(5, 100), set(5, 105)]), move("bench-press", [set(8, 60)])], "2026-10-01T11:01:00Z");
    const retry = await finishWorkout(user.client, user.id, later);
    expect(retry).toMatchObject({ alreadyCompleted: true, sessionId: first.sessionId, volumeKg: 2005 });
    const after = await saved(clientId);
    expect(after.sessions).toBe(1);
    expect(after.session).toMatchObject({ status: "completed", total_volume_kg: 2005 });
    expect(Date.parse(after.session.ended_at as string)).toBe(Date.parse("2026-10-01T11:01:00Z"));
    expect(after.exercises.map((e) => [e.exerciseId, e.sets.map((s) => [s.reps, Number(s.weight_kg), s.completed])])).toEqual([
      [ex["back-squat"], [[5, 100, true], [5, 100, true], [5, 105, true]]],
      [ex["bench-press"], [[8, 60, true]]],
    ]);
    // Records reflect the later sets (the 105 kg set is the heaviest squat), and are not duplicated.
    const { data: prs } = await user.client.from("personal_records").select("exercise_id, record_type, weight_kg, session_id").eq("user_id", user.id).eq("session_id", first.sessionId);
    const squatHeaviest = (prs ?? []).filter((p) => p.exercise_id === ex["back-squat"] && p.record_type === "max_weight");
    expect(squatHeaviest).toHaveLength(1);
    expect(Number(squatHeaviest[0]!.weight_kg)).toBe(105);
    expect((prs ?? []).some((p) => p.exercise_id === ex["bench-press"])).toBe(true);
    const keys = (prs ?? []).map((p) => `${p.exercise_id}:${p.record_type}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("the retry's later pause time is stored with the later end time (the member paused after the lost reply)", async () => {
    const clientId = crypto.randomUUID();
    await finishWorkout(user.client, user.id, payload(clientId, [move("back-squat", [set(5, 60)])]));
    const later = { ...payload(clientId, [move("back-squat", [set(5, 60), set(5, 60)])], "2026-10-01T11:10:00Z"), pausedSeconds: 300 };
    await finishWorkout(user.client, user.id, later);
    const { data } = await user.client.from("workout_sessions").select("ended_at, paused_seconds, finish_claim").eq("client_id", clientId).single();
    expect(Date.parse(data!.ended_at as string)).toBe(Date.parse("2026-10-01T11:10:00Z"));
    expect(data!.paused_seconds).toBe(300);
    expect(data!.finish_claim).toBeNull(); // the claim taken for the edit is released
  });

  it("two retries with the same later sets at once store them once (the second is told to try again or finds them stored)", async () => {
    const clientId = crypto.randomUUID();
    await finishWorkout(user.client, user.id, payload(clientId, [move("back-squat", [set(5, 50), set(5, 50)])]));
    const later = payload(clientId, [move("back-squat", [set(5, 50), set(5, 50), set(5, 50), set(5, 50)])], "2026-10-01T11:03:00Z");
    const results = await Promise.allSettled([finishWorkout(user.client, user.id, later), finishWorkout(user.client, user.id, later)]);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    for (const r of results) if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "conflict" });
    const after = await saved(clientId);
    expect(after.exercises).toHaveLength(1);
    expect(after.exercises[0]!.sets).toHaveLength(4);
    expect(Number(after.session.total_volume_kg)).toBe(1000);
    // A retry after that (the one told to try again) is a plain repeat: nothing changes.
    await finishWorkout(user.client, user.id, later);
    expect((await saved(clientId)).exercises[0]!.sets).toHaveLength(4);
  });

  it("a plain repeat of the same Finish changes nothing (the saved rows are left as they are)", async () => {
    const clientId = crypto.randomUUID();
    const body = payload(clientId, [move("back-squat", [set(5, 90), set(5, 90)])]);
    await finishWorkout(user.client, user.id, body);
    const before = await saved(clientId);
    const retry = await finishWorkout(user.client, user.id, body);
    expect(retry).toMatchObject({ alreadyCompleted: true, volumeKg: 900 });
    const after = await saved(clientId);
    expect(after.exercises.map((e) => e.id)).toEqual(before.exercises.map((e) => e.id)); // not rewritten
    expect(after.session.ended_at).toBe(before.session.ended_at);
  });

  it("an older copy with fewer sets (another tab, a stale retry) never replaces the saved workout", async () => {
    const clientId = crypto.randomUUID();
    await finishWorkout(user.client, user.id, payload(clientId, [move("back-squat", [set(5, 80), set(5, 80), set(5, 80)])]));
    const retry = await finishWorkout(user.client, user.id, payload(clientId, [move("back-squat", [set(5, 80)])], "2026-10-01T11:05:00Z"));
    expect(retry).toMatchObject({ alreadyCompleted: true, volumeKg: 1200 });
    const after = await saved(clientId);
    expect(after.exercises[0]!.sets).toHaveLength(3);
    expect(Date.parse(after.session.ended_at as string)).toBe(Date.parse("2026-10-01T11:00:00Z"));
  });

  it("two Finishes of the same workout at once, the second with more sets: the workout ends with every set, saved once", async () => {
    const clientId = crypto.randomUUID();
    const short = payload(clientId, [move("back-squat", [set(5, 70), set(5, 70)])]);
    const long = payload(clientId, [move("back-squat", [set(5, 70), set(5, 70), set(5, 70), set(5, 70)])], "2026-10-01T11:02:00Z");
    const results = await Promise.all([finishWorkout(user.client, user.id, short), finishWorkout(user.client, user.id, long)]);
    expect(new Set(results.map((r) => r.sessionId)).size).toBe(1);
    const after = await saved(clientId);
    expect(after.sessions).toBe(1);
    expect(after.exercises).toHaveLength(1);
    expect(after.exercises[0]!.sets).toHaveLength(4);
    expect(Number(after.session.total_volume_kg)).toBe(1400);
  });
});
