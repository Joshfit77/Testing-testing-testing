// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O-12: once the workout is saved, the summary extras (badges, milestones, next session, previous session) never turn
 * the result into "couldn't save", and a slow one is dropped after its time limit instead of holding the reply.
 */
const USER = "11111111-1111-4111-8111-111111111111";
const EX = "22222222-2222-4222-8222-222222222222";
const finishWorkout = vi.fn();
const previousComparableSession = vi.fn();
const nextSessionSummary = vi.fn();
const getAchievementStats = vi.fn();
const loadExerciseHistories = vi.fn();
const getProfile = vi.fn();

vi.mock("@/server/auth", () => ({ getCurrentUser: async () => ({ id: USER }), getProfile: (id: string) => getProfile(id), requireUser: async () => ({ id: USER }) }));
vi.mock("@/lib/supabase/server", () => {
  const q = { select: () => q, eq: () => q, in: async () => ({ data: [{ id: EX, slug: "bench", name: "Bench" }], error: null }), maybeSingle: async () => ({ data: null, error: null }) };
  return { getServerSupabase: async () => ({ from: () => q }) };
});
vi.mock("@/server/services/workouts", () => ({
  finishWorkout: (...a: unknown[]) => finishWorkout(...a),
  previousComparableSession: (...a: unknown[]) => previousComparableSession(...a),
  DraftConflictError: class extends Error {},
  WorkoutError: class extends Error {},
}));
vi.mock("@/server/services/schedule", () => ({ nextSessionSummary: (...a: unknown[]) => nextSessionSummary(...a) }));
vi.mock("@/server/services/achievements", () => ({ getAchievementStats: (...a: unknown[]) => getAchievementStats(...a) }));
vi.mock("@/server/services/exercise-history", () => ({ loadExerciseHistories: (...a: unknown[]) => loadExerciseHistories(...a) }));
const revalidatePath = vi.fn();
const scriptureForDate = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/data/content", async (orig) => ({ ...(await orig<typeof import("@/data/content")>()), scriptureForDate: (...a: unknown[]) => scriptureForDate(...a) }));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

const input = {
  clientId: "33333333-3333-4333-8333-333333333333",
  name: "Push",
  userProgramId: "44444444-4444-4444-8444-444444444444",
  programDayId: null,
  startedAt: "2026-11-26T10:00:00Z",
  endedAt: "2026-11-26T11:00:00Z",
  pausedSeconds: 0,
  notes: "",
  exercises: [{ exerciseId: EX, substitutedFromId: null, notes: "", skipped: false, skipReason: null, sets: [{ reps: 5, weightKg: 100, durationSeconds: null, distanceM: null, rpe: null, isWarmup: false, completed: true }] }],
};

beforeEach(() => {
  finishWorkout.mockResolvedValue({ sessionId: "55555555-5555-4555-8555-555555555555", volumeKg: 500, records: [] });
  getProfile.mockResolvedValue({ timezone: "UTC", unit_system: "metric", faith_enabled: false });
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  revalidatePath.mockReset();
  scriptureForDate.mockReset();
});

describe("finishWorkoutAction after the save", () => {
  it("every extra failing still reports the saved workout", async () => {
    previousComparableSession.mockRejectedValue(new Error("db down"));
    nextSessionSummary.mockRejectedValue(new Error("db down"));
    getAchievementStats.mockRejectedValue(new Error("db down"));
    loadExerciseHistories.mockRejectedValue(new Error("db down"));
    getProfile.mockRejectedValue(new Error("db down"));
    const { finishWorkoutAction } = await import("@/server/actions/workouts");
    const r = await finishWorkoutAction(input);
    expect(r).toMatchObject({ ok: true, data: { sessionId: "55555555-5555-4555-8555-555555555555", volumeKg: 500, badges: [], milestones: [], next: null, previous: null } });
  });

  it("a hanging extra is dropped after its time limit, not waited on", async () => {
    vi.useFakeTimers();
    const never = new Promise(() => {});
    previousComparableSession.mockReturnValue(never);
    nextSessionSummary.mockReturnValue(never);
    getAchievementStats.mockResolvedValue({});
    loadExerciseHistories.mockReturnValue(never);
    const { finishWorkoutAction } = await import("@/server/actions/workouts");
    const pending = finishWorkoutAction(input);
    await vi.advanceTimersByTimeAsync(8_000);
    await vi.advanceTimersByTimeAsync(8_000);
    const r = await pending;
    expect(r.ok).toBe(true);
  });

  it("everything hanging: the reply comes after ONE time limit, not one per phase", async () => {
    vi.useFakeTimers();
    const never = new Promise(() => {});
    getProfile.mockReturnValue(never);
    previousComparableSession.mockReturnValue(never);
    nextSessionSummary.mockReturnValue(never);
    getAchievementStats.mockReturnValue(never);
    loadExerciseHistories.mockReturnValue(never);
    const { finishWorkoutAction } = await import("@/server/actions/workouts");
    let settled = false;
    const pending = finishWorkoutAction(input).then((r) => ((settled = true), r));
    await vi.advanceTimersByTimeAsync(8_100);
    expect(settled).toBe(true);
    expect((await pending).ok).toBe(true);
  });

  it("a failing verse or cache refresh still reports the saved workout", async () => {
    getProfile.mockResolvedValue({ timezone: "UTC", unit_system: "metric", faith_enabled: true });
    scriptureForDate.mockImplementation(() => {
      throw new Error("verse data missing");
    });
    revalidatePath.mockImplementation(() => {
      throw new Error("revalidate failed");
    });
    for (const extra of [previousComparableSession, nextSessionSummary, getAchievementStats, loadExerciseHistories]) extra.mockRejectedValue(new Error("not under test"));
    const { finishWorkoutAction } = await import("@/server/actions/workouts");
    const r = await finishWorkoutAction(input);
    expect(r).toMatchObject({ ok: true, data: { sessionId: "55555555-5555-4555-8555-555555555555", reflection: null } });
    expect(scriptureForDate).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("a failed save is still reported as not saved", async () => {
    finishWorkout.mockRejectedValue(new Error("insert failed"));
    const { finishWorkoutAction } = await import("@/server/actions/workouts");
    expect(await finishWorkoutAction(input)).toEqual({ ok: false, error: "We couldn't save your workout. It's still on this device — please try again." });
  });
});
