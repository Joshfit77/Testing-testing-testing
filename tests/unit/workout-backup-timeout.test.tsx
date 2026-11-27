import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A backup request that never answers (gym Wi-Fi with no internet behind it) used to hold the one-at-a-time backup slot
 * forever, so no later set reached the server until the page was reloaded. Now a backup that takes longer than
 * BACKUP_TIMEOUT_MS counts as NOT saved: the header says "Saved on device", the copy on the device stays, and the
 * backup is retried. A late success of the timed-out request is never taken as proof of saving.
 */
const sync = vi.fn();
vi.mock("@/server/actions/workouts", () => ({
  syncWorkoutDraftAction: (...a: unknown[]) => sync(...a),
  discardWorkoutAction: vi.fn(async () => ({ ok: true, data: null })),
  finishWorkoutAction: vi.fn(),
  previousPerformanceAction: vi.fn(async () => ({ ok: true, data: {} })),
}));
vi.mock("@/server/actions/rest-alerts", () => ({ updateRestAlertsAction: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/server/actions/templates", () => ({ createTemplateAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/train/exercise-demo", () => ({ ExerciseDemo: () => null, ExerciseDemoMini: () => null }));
vi.mock("@/components/train/exercise-info-dialog", () => ({ ExerciseInfoDialog: () => null }));
vi.mock("@/components/bible/scripture-text", () => ({ ScriptureText: () => null }));
vi.mock("@/lib/native", () => ({
  canVibrate: () => false,
  cancelRestNotification: vi.fn(async () => undefined),
  hapticSuccess: vi.fn(async () => undefined),
  scheduleRestNotification: vi.fn(async () => undefined),
  vibrate: vi.fn(async () => undefined),
}));
vi.mock("@/lib/native-notifications", () => ({ cancelDoneToday: vi.fn(async () => 0), deviceToday: () => "2026-11-20" }));

const { WorkoutLogger, BACKUP_TIMEOUT_MS } = await import("@/components/workout/workout-logger");
const { loadLocalDraft } = await import("@/lib/workout-storage");

const USER = "11111111-1111-4111-8111-111111111111";
const PUSH_UP = "22222222-2222-4222-8222-222222222222";
const catalog = [{ id: PUSH_UP, slug: "push-up", name: "Push-Up", isTimed: false, category: "strength", loaded: false, primary: ["chest"], secondary: [], steps: [], cues: [], mistakes: [] }];
const template = {
  name: "Timeout day",
  userProgramId: null,
  programDayId: null,
  warmup: [],
  cooldown: [],
  exercises: [{ exercise: { id: PUSH_UP, slug: "push-up", name: "Push-Up", isTimed: false }, restSeconds: 0, target: { sets: 3, reps: "8" } }],
};
const renderLogger = () => render(<WorkoutLogger userId={USER} units="imperial" catalog={catalog} alternatives={{}} serverDraft={null} template={template} previous={{}} targets={{}} />);
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sync.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("a backup that never answers", () => {
  it("counts as not saved after the timeout, keeps the device copy, and a later backup still goes out", async () => {
    let lateResolve: (v: unknown) => void = () => {};
    sync.mockImplementationOnce(() => new Promise((r) => (lateResolve = r)));
    sync.mockResolvedValue({ ok: true, data: null });
    renderLogger();
    await advance(0);
    fireEvent.click(screen.getAllByTestId("complete-set")[0]!);
    await advance(0);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Saving/)).toBeTruthy();

    await advance(BACKUP_TIMEOUT_MS);
    // Not "Synced": the server never confirmed it.
    expect(screen.queryByText(/^Synced$/)).toBeNull();
    expect(screen.getByText(/Saved on device/)).toBeTruthy();
    expect(loadLocalDraft(USER)!.exercises[0]!.sets[0]!.completed).toBe(true);

    // The slot is free: the retry goes out and its confirmed save is what turns the header to "Synced".
    await advance(5_000);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/^Synced$/)).toBeTruthy();

    // The hung request finally answering changes nothing.
    lateResolve({ ok: true, data: null });
    await advance(0);
    expect(sync).toHaveBeenCalledTimes(2);
  });
});
