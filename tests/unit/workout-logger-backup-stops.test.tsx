import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Audit regression (docs/audit-2026-11-14/workouts-programs-progress.md, W-1): the logger's in-progress backup kept a
 * retry timer alive after the workout was discarded (and after leaving the screen). When the timer fired, the old
 * draft was sent again and the server, which no longer had the workout, created it afresh: a discarded workout came
 * back as "Resume workout" on Home and on the member's other devices.
 */
const sync = vi.fn();
const discard = vi.fn();
const push = vi.fn();

vi.mock("@/server/actions/workouts", () => ({
  syncWorkoutDraftAction: (...a: unknown[]) => sync(...a),
  discardWorkoutAction: (...a: unknown[]) => discard(...a),
  finishWorkoutAction: vi.fn(),
  previousPerformanceAction: vi.fn(async () => ({ ok: true, data: {} })),
}));
vi.mock("@/server/actions/rest-alerts", () => ({ updateRestAlertsAction: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/server/actions/templates", () => ({ createTemplateAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }) }));
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
vi.mock("@/lib/native-notifications", () => ({ cancelDoneToday: vi.fn(async () => 0), deviceToday: () => "2026-11-14" }));

const { WorkoutLogger } = await import("@/components/workout/workout-logger");
const { discardedWorkoutIds, loadLocalDraft } = await import("@/lib/workout-storage");

const USER = "11111111-1111-4111-8111-111111111111";
const PUSH_UP = "22222222-2222-4222-8222-222222222222";
const catalog = [{ id: PUSH_UP, slug: "push-up", name: "Push-Up", isTimed: false, category: "strength", loaded: false, primary: ["chest"], secondary: [], steps: [], cues: [], mistakes: [] }];
const template = {
  name: "Audit day",
  userProgramId: null,
  programDayId: null,
  warmup: [],
  cooldown: [],
  exercises: [{ exercise: { id: PUSH_UP, slug: "push-up", name: "Push-Up", isTimed: false }, restSeconds: 0, target: { sets: 2, reps: "8" } }],
};

const renderLogger = () => render(<WorkoutLogger userId={USER} units="imperial" catalog={catalog} alternatives={{}} serverDraft={null} template={template} previous={{}} targets={{}} />);
/** Let pending promises settle, then move the clock. */
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sync.mockReset();
  discard.mockReset();
  push.mockReset();
  discard.mockResolvedValue({ ok: true, data: null });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the in-progress backup stops with the workout", () => {
  it("a backup that failed is retried while the workout is still open (the behaviour being protected)", async () => {
    sync.mockResolvedValue({ ok: false, error: "no connection" });
    renderLogger();
    await advance(0);
    fireEvent.click(screen.getByTestId("complete-set"));
    await advance(0);
    expect(sync).toHaveBeenCalledTimes(1);
    await advance(5_000);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("after Discard, no later retry sends the discarded workout back to the server", async () => {
    sync.mockResolvedValue({ ok: false, error: "no connection" });
    renderLogger();
    await advance(0);
    // One set done: backed up at once; the backup fails, so a retry is scheduled.
    fireEvent.click(screen.getByTestId("complete-set"));
    await advance(0);
    expect(sync).toHaveBeenCalledTimes(1);
    const clientId = loadLocalDraft(USER)!.clientId;

    fireEvent.click(screen.getByRole("button", { name: /Discard workout/ }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await advance(0);
    expect(discard).toHaveBeenCalledWith(clientId);
    expect(loadLocalDraft(USER)).toBeNull();
    expect(discardedWorkoutIds(USER)).toContain(clientId);
    expect(push).toHaveBeenCalledWith("/train");

    // The connection is back and plenty of time passes: the discarded workout must not be re-created.
    sync.mockResolvedValue({ ok: true, data: null });
    const callsAtDiscard = sync.mock.calls.length;
    await advance(10 * 60_000);
    expect(sync.mock.calls.length).toBe(callsAtDiscard);
  });

  it("after leaving the workout screen, its retry timer is gone too (the next screen owns the backup)", async () => {
    sync.mockResolvedValue({ ok: false, error: "no connection" });
    const view = renderLogger();
    await advance(0);
    fireEvent.click(screen.getByTestId("complete-set"));
    await advance(0);
    expect(sync).toHaveBeenCalledTimes(1);
    // The workout itself is still on the device for Resume.
    expect(loadLocalDraft(USER)).not.toBeNull();
    view.unmount();
    sync.mockResolvedValue({ ok: true, data: null });
    await advance(10 * 60_000);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(loadLocalDraft(USER)).not.toBeNull();
  });

  it("a discard the server refused (while online) leaves the workout open and still backed up", async () => {
    sync.mockResolvedValue({ ok: true, data: null });
    discard.mockResolvedValue({ ok: false, error: "nope" });
    renderLogger();
    await advance(0);
    fireEvent.click(screen.getByTestId("complete-set"));
    await advance(0);
    const before = sync.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /Discard workout/ }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await advance(0);
    expect(push).not.toHaveBeenCalled();
    expect(loadLocalDraft(USER)).not.toBeNull();
    // The next set is backed up as usual (a moment later: a second tap straight away counts as the same tap).
    await advance(1_500);
    fireEvent.click(screen.getByTestId("complete-set"));
    await advance(0);
    expect(sync.mock.calls.length).toBeGreaterThan(before);
  });
});
