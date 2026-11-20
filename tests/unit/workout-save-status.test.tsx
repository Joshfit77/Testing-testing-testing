import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Review 2026-11-20 (workout data protection). A backup is shown as saved only when the account confirms the copy
 * that is on screen:
 *  - an edit still waiting for the typing debounce used to leave "Synced" showing;
 *  - a backup confirmed while a newer change waited also turned the header to "Synced";
 *  - Finish could hang on "Saving…" for ever (no timeout);
 *  - a sign-in that ran out mid-workout redirected the whole app to the login page; now the member is told, the
 *    workout stays on screen and on the device.
 * Signing out with a backup that never answers is in sign-out-workout.test.tsx.
 */
const sync = vi.fn();
const finish = vi.fn();
vi.mock("@/server/actions/workouts", () => ({
  syncWorkoutDraftAction: (...a: unknown[]) => sync(...a),
  discardWorkoutAction: vi.fn(async () => ({ ok: true, data: null })),
  finishWorkoutAction: (...a: unknown[]) => finish(...a),
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

const { WorkoutLogger, FINISH_TIMEOUT_MS } = await import("@/components/workout/workout-logger");
const { loadLocalDraft } = await import("@/lib/workout-storage");
const { SIGNED_OUT_WORKOUT_MESSAGE } = await import("@/lib/domain/workout-draft");

const USER = "11111111-1111-4111-8111-111111111111";
const PUSH_UP = "22222222-2222-4222-8222-222222222222";
const catalog = [{ id: PUSH_UP, slug: "push-up", name: "Push-Up", isTimed: false, category: "strength", loaded: false, primary: ["chest"], secondary: [], steps: [], cues: [], mistakes: [] }];
const template = {
  name: "Status day",
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
const header = () => (screen.queryByText(/^Synced$/) ? "Synced" : screen.queryByText(/Saved on device/) ? "Saved on device" : screen.queryByText(/Saving/) ? "Saving" : "none");
const typeReps = (setNumber: number, value: string) => {
  const input = screen.getAllByLabelText(new RegExp(`Push-Up set ${setNumber} reps`))[0]!;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};
const okFinish = { ok: true, data: { sessionId: "s1", volumeKg: 0, records: [], badges: [], milestones: [], next: null, previous: null, reflection: null } };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sync.mockReset();
  finish.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the save status never claims more than the account has", () => {
  it("an edit waiting for the typing debounce reads 'Saved on device' until its backup is confirmed", async () => {
    sync.mockResolvedValue({ ok: true, data: null });
    renderLogger();
    await advance(0);
    fireEvent.click(screen.getAllByTestId("complete-set")[0]!);
    await advance(0);
    expect(header()).toBe("Synced");

    typeReps(2, "6");
    await advance(0);
    expect(header()).toBe("Saved on device");
    expect(loadLocalDraft(USER)!.exercises[0]!.sets[1]!.reps).toBe(6);
    const calls = sync.mock.calls.length;

    await advance(2_000);
    expect(sync.mock.calls.length).toBe(calls + 1);
    expect(header()).toBe("Synced");
  });

  it("a backup confirmed while a newer change waits doesn't turn the header to 'Synced'", async () => {
    let answer: (v: unknown) => void = () => {};
    sync.mockImplementationOnce(() => new Promise((r) => (answer = r)));
    sync.mockResolvedValue({ ok: true, data: null });
    renderLogger();
    await advance(0);
    fireEvent.click(screen.getAllByTestId("complete-set")[0]!);
    await advance(0);
    expect(header()).toBe("Saving");

    // A change typed while the first backup is on its way (it waits for the debounce, it isn't sent yet).
    typeReps(2, "7");
    await advance(500);
    answer({ ok: true, data: null });
    await advance(0);
    expect(header()).not.toBe("Synced");

    // Its own backup goes out after the debounce; only that confirmation reads "Synced".
    await advance(2_000);
    const last = sync.mock.calls.at(-1)![0] as { draft: { exercises: { sets: { reps: number | null }[] }[] } };
    expect(last.draft.exercises[0]!.sets[1]!.reps).toBe(7);
    expect(header()).toBe("Synced");
  });
});

describe("Finish never hangs, and a timeout is never taken as saved", () => {
  it("a Finish with no answer counts as not saved after the timeout: message, device copy kept, Finish can be tapped again", async () => {
    sync.mockResolvedValue({ ok: true, data: null });
    finish.mockImplementationOnce(() => new Promise(() => {}));
    renderLogger();
    await advance(0);
    fireEvent.click(screen.getAllByTestId("complete-set")[0]!);
    await advance(0);
    const clientId = loadLocalDraft(USER)!.clientId;

    fireEvent.click(screen.getAllByRole("button", { name: "Finish" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Finish & save/ }));
    await advance(FINISH_TIMEOUT_MS - 1_000);
    expect(screen.queryByText(/isn't saved yet|appear to be offline/)).toBeNull();
    await advance(1_000);
    expect(screen.getByText(/isn't saved yet|appear to be offline/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Workout complete/i })).toBeNull();
    expect(loadLocalDraft(USER)?.clientId).toBe(clientId);

    finish.mockResolvedValueOnce(okFinish);
    fireEvent.click(screen.getAllByRole("button", { name: "Finish" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Finish & save/ }));
    await advance(0);
    expect(finish).toHaveBeenCalledTimes(2);
    // Same workout both times, so a late success of the first can't make a second workout.
    expect((finish.mock.calls[1]![0] as { clientId: string }).clientId).toBe(clientId);
    expect(loadLocalDraft(USER)).toBeNull();
  });
});

describe("the sign-in runs out mid-workout", () => {
  it("the member is told, the header never says Synced, and the workout stays on screen and on the device", async () => {
    sync.mockResolvedValue({ ok: false, error: SIGNED_OUT_WORKOUT_MESSAGE });
    renderLogger();
    await advance(0);
    fireEvent.click(screen.getAllByTestId("complete-set")[0]!);
    await advance(0);
    expect(screen.getByText(SIGNED_OUT_WORKOUT_MESSAGE)).toBeInTheDocument();
    expect(header()).toBe("Saved on device");
    expect(loadLocalDraft(USER)!.exercises[0]!.sets[0]!.completed).toBe(true);
    expect(screen.getAllByTestId("complete-set").length).toBeGreaterThan(0);
  });

  it("Finish says so too, and keeps the workout", async () => {
    sync.mockResolvedValue({ ok: true, data: null });
    finish.mockResolvedValueOnce({ ok: false, error: SIGNED_OUT_WORKOUT_MESSAGE });
    renderLogger();
    await advance(0);
    fireEvent.click(screen.getAllByTestId("complete-set")[0]!);
    await advance(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Finish" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Finish & save/ }));
    await advance(0);
    expect(screen.getByText(SIGNED_OUT_WORKOUT_MESSAGE)).toBeInTheDocument();
    expect(loadLocalDraft(USER)).not.toBeNull();
  });
});
