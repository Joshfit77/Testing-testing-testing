import { Component, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reliability closure (2026-11-17, docs/launch-readiness/04_RELIABILITY_CLOSURE.md), the real logger rendered with
 * stand-in server actions (the same harness as workout-logger-backup-stops.test.tsx):
 * - a crash while rendering shows the app's recovery screen, and "Try again" brings the workout back with every set;
 * - a device copy the logger cannot use does not take the workout screen down with it;
 * - a Finish that fails is retried with the same workout id and end time, and the device copy is kept until it lands.
 */
const sync = vi.fn();
const finish = vi.fn();

vi.mock("@/server/actions/workouts", () => ({
  syncWorkoutDraftAction: (...a: unknown[]) => sync(...a),
  discardWorkoutAction: vi.fn(async () => ({ ok: true, data: null })),
  finishWorkoutAction: (...a: unknown[]) => finish(...a),
  previousPerformanceAction: vi.fn(async () => ({ ok: true, data: {} })),
}));
vi.mock("@/server/actions/rest-alerts", () => ({
  updateRestAlertsAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/server/actions/templates", () => ({
  createTemplateAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/train/exercise-demo", () => ({
  ExerciseDemo: () => null,
  ExerciseDemoMini: () => null,
}));
vi.mock("@/components/train/exercise-info-dialog", () => ({
  ExerciseInfoDialog: () => null,
}));
vi.mock("@/components/bible/scripture-text", () => ({
  ScriptureText: () => null,
}));
vi.mock("@/lib/error-report", () => ({ reportClientError: vi.fn() }));
vi.mock("@/lib/native", () => ({
  canVibrate: () => false,
  cancelRestNotification: vi.fn(async () => undefined),
  hapticSuccess: vi.fn(async () => undefined),
  scheduleRestNotification: vi.fn(async () => undefined),
  vibrate: vi.fn(async () => undefined),
}));
vi.mock("@/lib/native-notifications", () => ({
  cancelDoneToday: vi.fn(async () => 0),
  deviceToday: () => "2026-11-17",
}));

const { WorkoutLogger } = await import("@/components/workout/workout-logger");
const { default: AppError } = await import("@/app/(app)/error");
const { loadLocalDraft, localDraftKey } = await import("@/lib/workout-storage");
const { workoutReducer } = await import("@/lib/domain/workout-draft");

const USER = "11111111-1111-4111-8111-111111111111";
const PUSH_UP = "22222222-2222-4222-8222-222222222222";
const catalog = [
  {
    id: PUSH_UP,
    slug: "push-up",
    name: "Push-Up",
    isTimed: false,
    category: "strength",
    loaded: false,
    primary: ["chest"],
    secondary: [],
    steps: [],
    cues: [],
    mistakes: [],
  },
];
const template = {
  name: "Closure day",
  userProgramId: null,
  programDayId: null,
  warmup: [],
  cooldown: [],
  exercises: [
    {
      exercise: {
        id: PUSH_UP,
        slug: "push-up",
        name: "Push-Up",
        isTimed: false,
      },
      restSeconds: 0,
      target: { sets: 3, reps: "8" },
    },
  ],
};
const logger = (serverDraft: unknown = null) => (
  <WorkoutLogger
    userId={USER}
    units="imperial"
    catalog={catalog}
    alternatives={{}}
    serverDraft={serverDraft as never}
    template={template}
    previous={{}}
    targets={{}}
  />
);
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const doneSets = () => loadLocalDraft(USER)?.exercises[0]!.sets.filter((s) => s.completed).length ?? 0;

/** What Next.js does with src/app/(app)/error.tsx: catch a render error below it and show the file, with reset(). */
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? <AppError error={this.state.error} reset={() => this.setState({ error: null })} /> : this.props.children;
  }
}
let explode = false;
function Bomb() {
  if (explode) throw new Error("render crash");
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sync.mockReset();
  finish.mockReset();
  sync.mockResolvedValue({ ok: true, data: null });
  explode = false;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("crash recovery", () => {
  it("a render crash mid-workout shows the recovery screen; Try again brings the workout back with both sets", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(
      <Boundary>
        <Bomb />
        {logger()}
      </Boundary>
    );
    await advance(0);
    fireEvent.click(screen.getByTestId("complete-set"));
    await advance(1_500);
    fireEvent.click(screen.getByTestId("complete-set"));
    await advance(0);
    expect(doneSets()).toBe(2);

    // Something on the page throws while rendering: the logger is unmounted and the recovery screen shows instead.
    explode = true;
    view.rerender(
      <Boundary>
        <Bomb />
        {logger()}
      </Boundary>
    );
    await advance(0);
    expect(screen.getByText("We couldn't load this page")).toBeInTheDocument();
    expect(screen.queryByTestId("complete-set")).toBeNull();
    // Nothing logged was lost with it.
    expect(doneSets()).toBe(2);

    explode = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await advance(0);
    expect(screen.getAllByRole("button", { name: /set 1 completed/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /set 2 completed/ }).length).toBeGreaterThan(0);
    expect(doneSets()).toBe(2);
  });

  it("a device copy the logger can't use (damaged, or from an unknown version) is passed over, not a crash", async () => {
    for (const broken of [
      "{not json",
      JSON.stringify({ version: 2, clientId: "x" }),
      JSON.stringify({ version: 99, exercises: [] }),
      // Passes the old top-level check, but an exercise has no sets: this one crashed the screen on every open.
      JSON.stringify({
        version: 2,
        clientId: "33333333-3333-4333-8333-333333333333",
        name: "x",
        startedAt: "2026-11-17T10:00:00.000Z",
        updatedAt: new Date().toISOString(),
        exercises: [{ id: "e1" }],
        rest: {},
      }),
    ]) {
      localStorage.setItem(localDraftKey(USER), broken);
      render(logger());
      await advance(0);
      expect(screen.getByTestId("complete-set")).toBeInTheDocument();
      cleanup();
    }
  });
});

describe("the same workout open in two tabs", () => {
  it("adopting the other tab's copy never writes it back over a newer one that tab saved meanwhile", async () => {
    // Found by e2e/reliability-closure.spec.ts (it failed one run in two): tab B typed set 2's weight, then completed
    // it. Tab A adopted the first copy and, a moment later, saved that copy to the device again, over B's completed
    // set; B's second storage event then read A's older copy back and was ignored. A was left without set 2, and so
    // was the device copy. Storage events reach other tabs as separate tasks, which is the gap modelled here.
    render(logger());
    await advance(0);
    fireEvent.click(screen.getByTestId("complete-set"));
    await advance(0);
    const mine = loadLocalDraft(USER)!;
    const e = mine.exercises[0]!;
    const set2 = e.sets[1]!;
    const t = (s: number) => new Date(Date.parse(mine.updatedAt) + s * 1000).toISOString();
    const typed = workoutReducer(mine, { type: "updateSet", exerciseKey: e.id, setId: set2.id, patch: { weightKg: 60, reps: 8 } });
    const completedInB = workoutReducer(typed, { type: "toggleSetComplete", exerciseKey: e.id, setId: set2.id, now: t(6) });
    expect(completedInB.exercises[0]!.sets[1]!.completed).toBe(true);
    const key = localDraftKey(USER);

    await act(async () => {
      localStorage.setItem(key, JSON.stringify(typed));
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: JSON.stringify(typed) }));
      // Tab B's next save lands before tab A has re-rendered; its event is delivered afterwards.
      localStorage.setItem(key, JSON.stringify(completedInB));
    });
    await advance(0);
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: JSON.stringify(completedInB) }));
    });
    await advance(0);

    expect(loadLocalDraft(USER)!.exercises[0]!.sets[1]!.completed).toBe(true);
    expect(screen.getAllByRole("button", { name: /set 2 completed/ }).length).toBeGreaterThan(0);
  });

  it("a copy taken from the other tab is not saved or backed up again from this tab (that tab already did both)", async () => {
    // Found by the same browser test after the fix above: each tab sees the other's device writes a moment late, so
    // this tab's re-save of the adopted copy could still land after the other tab's newer save and replace it, and its
    // backup could replace the newer one on the account.
    render(logger());
    await advance(0);
    fireEvent.click(screen.getByTestId("complete-set"));
    await advance(3_000);
    const mine = loadLocalDraft(USER)!;
    const e = mine.exercises[0]!;
    const other = workoutReducer(mine, {
      type: "toggleSetComplete",
      exerciseKey: e.id,
      setId: e.sets[1]!.id,
      now: new Date(Date.parse(mine.updatedAt) + 5_000).toISOString(),
    });
    const key = localDraftKey(USER);
    localStorage.setItem(key, JSON.stringify(other));
    const backups = sync.mock.calls.length;
    const writes = vi.spyOn(Storage.prototype, "setItem");
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: JSON.stringify(other) }));
    });
    await advance(5_000);
    expect(screen.getAllByRole("button", { name: /set 2 completed/ }).length).toBeGreaterThan(0);
    expect(writes.mock.calls.filter(([k]) => k === key)).toHaveLength(0);
    expect(sync.mock.calls.length).toBe(backups);
  });
});

describe("Finish that fails, then succeeds", () => {
  it("is retried with the same workout id and the end time of the first tap; the device copy stays until it lands", async () => {
    render(logger());
    await advance(0);
    fireEvent.click(screen.getByTestId("complete-set"));
    await advance(0);
    const clientId = loadLocalDraft(USER)!.clientId;

    // First attempt: the request never completes (connection dropped, or the reply was lost).
    finish.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(screen.getAllByRole("button", { name: "Finish" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Finish & save/ }));
    await advance(0);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/isn't saved yet|appear to be offline/)).toBeInTheDocument();
    expect(loadLocalDraft(USER)?.clientId).toBe(clientId);
    const first = finish.mock.calls[0]![0] as {
      clientId: string;
      endedAt: string;
    };

    // A minute later the member tries again and it goes through (the server answers for that workout id once).
    await advance(60_000);
    finish.mockResolvedValueOnce({
      ok: true,
      data: {
        sessionId: "s1",
        volumeKg: 0,
        records: [],
        badges: [],
        milestones: [],
        next: null,
        previous: null,
        reflection: null,
      },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Finish" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Finish & save/ }));
    await advance(0);
    expect(finish).toHaveBeenCalledTimes(2);
    const second = finish.mock.calls[1]![0] as {
      clientId: string;
      endedAt: string;
    };
    expect(second.clientId).toBe(first.clientId);
    expect(second.endedAt).toBe(first.endedAt);
    expect(screen.getByRole("heading", { name: /Workout complete/i })).toBeInTheDocument();
    expect(loadLocalDraft(USER)).toBeNull();
    // Nothing is backed up after the finish (it would only be refused, but must not be sent).
    const calls = sync.mock.calls.length;
    await advance(10 * 60_000);
    expect(sync.mock.calls.length).toBe(calls);
  });
});
