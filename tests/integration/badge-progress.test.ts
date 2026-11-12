import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, exerciseIds, serviceClient, stackAvailable, type TestUser } from "./helpers";
import type { FinishWorkoutInput } from "@/lib/validation/schemas";

const available = await stackAvailable();

const set = (reps: number | null, weightKg: number | null, extra: Partial<FinishWorkoutInput["exercises"][number]["sets"][number]> = {}) => ({
  reps,
  weightKg,
  durationSeconds: null,
  rpe: null,
  isWarmup: false,
  completed: true,
  ...extra,
});

/**
 * Badges, records and milestones are worked out from saved data on every view. These tests prove that against the
 * real database: an edit or a delete moves them back, a retried save shows the same milestones, runs saved on the Run
 * tab count for run milestones, and a history longer than one API page (1,000 rows) is read in full.
 */
describe.skipIf(!available)("badge progress and milestones stay accurate", async () => {
  const { finishWorkout, editWorkout, deleteWorkout } = await import("@/server/services/workouts");
  const { loadExerciseHistory, loadExerciseHistories, loadMilestoneActivities } = await import("@/server/services/exercise-history");
  const { getAchievementStats } = await import("@/server/services/achievements");
  const { computeAchievements } = await import("@/lib/domain/achievements");
  const { exerciseMilestone, reachedMilestones } = await import("@/lib/domain/exercise-milestones");

  let user: TestUser;
  let ex: Record<string, string>;
  beforeAll(async () => {
    user = await createTestUser("badges");
    ex = await exerciseIds(["bench-press", "pull-up", "zone-2-run"]);
  });
  afterAll(async () => deleteTestUser(user));

  const finish = (startedAt: string, exercises: FinishWorkoutInput["exercises"]) =>
    finishWorkout(user.client, user.id, {
      clientId: crypto.randomUUID(),
      name: "Badge test",
      userProgramId: null,
      programDayId: null,
      startedAt,
      endedAt: new Date(Date.parse(startedAt) + 3600_000).toISOString(),
      pausedSeconds: 0,
      notes: "",
      exercises,
    });
  const bench = (sets: ReturnType<typeof set>[]) => [{ exerciseId: ex["bench-press"]!, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets }];
  const benchMilestone = async () => exerciseMilestone((await loadExerciseHistory(user.client, user.id, ex["bench-press"]!)).sessions, { slug: "bench-press", name: "Bench Press" }, "metric");
  const workoutsBadge = async () => computeAchievements(await getAchievementStats(user.client, user.id, "UTC"), "2026-11-09").find((b) => b.id === "workouts-10")!;

  it("moves badges, records and milestones back when a workout is edited down or deleted", async () => {
    await finish("2026-10-01T10:00:00Z", bench([set(5, 80)]));
    const pr = await finish("2026-10-08T10:00:00Z", bench([set(1, 100)]));
    expect(await benchMilestone()).toMatchObject({ kind: "weight", current: 100, target: 110 });
    expect((await workoutsBadge()).current).toBe(2);

    await editWorkout(user.client, user.id, { sessionId: pr.sessionId, name: "Edited", notes: "", exercises: bench([set(1, 90)]) });
    expect(await benchMilestone()).toMatchObject({ current: 90, target: 95 });
    const maxWeight = async () =>
      Number((await user.client.from("personal_records").select("value").eq("user_id", user.id).eq("exercise_id", ex["bench-press"]).eq("record_type", "max_weight").order("value", { ascending: false }).limit(1).single()).data?.value);
    expect(await maxWeight()).toBe(90);

    await deleteWorkout(user.client, user.id, pr.sessionId);
    expect(await benchMilestone()).toMatchObject({ current: 80, target: 85 });
    expect(await maxWeight()).toBe(80);
    expect((await workoutsBadge()).current).toBe(1);
  });

  it("reports a reached milestone once from saved data, the same on a retried save", async () => {
    const clientId = crypto.randomUUID();
    const input: FinishWorkoutInput = {
      clientId,
      name: "Milestone day",
      userProgramId: null,
      programDayId: null,
      startedAt: "2026-10-15T10:00:00Z",
      endedAt: "2026-10-15T11:00:00Z",
      pausedSeconds: 0,
      notes: "",
      exercises: bench([set(1, 85)]),
    };
    const first = await finishWorkout(user.client, user.id, input);
    const retry = await finishWorkout(user.client, user.id, input);
    expect(retry.sessionId).toBe(first.sessionId);
    const reached = async () => {
      const h = await loadExerciseHistories(user.client, user.id, [ex["bench-press"]!]);
      return reachedMilestones([{ id: ex["bench-press"]!, slug: "bench-press", name: "Bench Press", sessions: h.get(ex["bench-press"]!)!.sessions }], first.sessionId, "metric");
    };
    expect(await reached()).toEqual([{ exerciseId: ex["bench-press"], name: "Bench Press", what: "Heaviest lift", value: "85 kg", kind: "weight" }]);
    expect(await reached()).toEqual(await reached());
  });

  it("counts runs saved on the Run tab (GPS, treadmill, by hand) and drops a deleted one", async () => {
    const svc = serviceClient();
    const base = { user_id: user.id, kind: "run", timezone: "UTC", elapsed_s: 1800, moving_s: 1700 };
    const { data: rows, error } = await svc
      .from("activities")
      .insert([
        { ...base, source: "manual", started_at: "2026-09-01T07:00:00Z", distance_m: 3000 },
        { ...base, source: "treadmill", started_at: "2026-09-03T07:00:00Z", distance_m: 5200 },
        { ...base, source: "manual", started_at: "2026-09-05T07:00:00Z", distance_m: null },
      ])
      .select("id, distance_m");
    expect(error).toBeNull();
    const run = { slug: "zone-2-run", name: "Easy Zone 2 Run" };
    const m = async () => exerciseMilestone([], run, "metric", { activities: await loadMilestoneActivities(user.client, user.id, "run") });
    expect(await m()).toMatchObject({ kind: "distance", current: 5.2, bestDetail: "treadmill run", target: 8 });
    // Soft-deleting the treadmill run moves the milestone back to the 3 km run.
    const treadmill = rows!.find((r) => Number(r.distance_m) === 5200)!;
    await svc.from("activities").update({ deleted_at: new Date().toISOString() }).eq("id", treadmill.id);
    expect(await m()).toMatchObject({ current: 3, target: 5 });
  });

  it("reads a history longer than one API page in full, so an old best is never forgotten", async () => {
    const svc = serviceClient();
    const other = await createTestUser("longhistory");
    try {
      // 1,050 completed sessions of pull-ups; the best (22 reps) is the oldest one.
      const sessions = Array.from({ length: 1050 }, (_, i) => ({
        user_id: other.id,
        client_id: crypto.randomUUID(),
        name: "Pull-ups",
        status: "completed",
        started_at: new Date(Date.UTC(2023, 0, 1) + i * 86400_000).toISOString(),
        ended_at: new Date(Date.UTC(2023, 0, 1) + i * 86400_000 + 1800_000).toISOString(),
      }));
      const ids: string[] = [];
      for (let i = 0; i < sessions.length; i += 500) {
        const { data, error } = await svc.from("workout_sessions").insert(sessions.slice(i, i + 500)).select("id, started_at").order("started_at");
        expect(error).toBeNull();
        ids.push(...data!.map((d) => d.id as string));
      }
      const wex = ids.map((id) => ({ session_id: id, user_id: other.id, exercise_id: ex["pull-up"]!, position: 0 }));
      const wexIds: string[] = [];
      for (let i = 0; i < wex.length; i += 500) {
        const { data, error } = await svc.from("workout_exercises").insert(wex.slice(i, i + 500)).select("id, session_id");
        expect(error).toBeNull();
        const bySession = new Map(data!.map((d) => [d.session_id as string, d.id as string]));
        wexIds.push(...wex.slice(i, i + 500).map((w) => bySession.get(w.session_id)!));
      }
      const sets = wexIds.map((id, i) => ({ workout_exercise_id: id, user_id: other.id, set_number: 1, reps: i === 0 ? 22 : 10, completed: true }));
      for (let i = 0; i < sets.length; i += 500) {
        const { error } = await svc.from("workout_sets").insert(sets.slice(i, i + 500));
        expect(error).toBeNull();
      }
      const history = await loadExerciseHistory(other.client, other.id, ex["pull-up"]!);
      expect(history.sessions).toHaveLength(1050);
      expect(exerciseMilestone(history.sessions, { slug: "pull-up", name: "Pull-Up" }, "metric")).toMatchObject({ kind: "reps", current: 22, target: 25 });
    } finally {
      await deleteTestUser(other);
    }
  }, 120_000);
});
