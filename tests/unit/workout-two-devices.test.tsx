import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDraft, type WorkoutDraft } from "@/lib/domain/workout-draft";

/**
 * F-29 / F-30 in the logger (security assessment 2026-11-20): what the member's phone does when another device has
 * been working too. The server side (revisions, refusals) is tests/integration/workout-revisions.test.ts.
 */
const sync = vi.fn();
const finish = vi.fn();
const confirm = vi.fn();
vi.mock("@/server/actions/workouts", () => ({
  syncWorkoutDraftAction: (...a: unknown[]) => sync(...a),
  discardWorkoutAction: vi.fn(async () => ({ ok: true, data: null })),
  finishWorkoutAction: (...a: unknown[]) => finish(...a),
  previousPerformanceAction: vi.fn(async () => ({ ok: true, data: {} })),
}));
vi.mock("@/components/ui/confirm", () => ({ confirmDialog: (...a: unknown[]) => confirm(...a) }));
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
vi.mock("@/lib/native-notifications", () => ({ cancelDoneToday: vi.fn(async () => 0), deviceToday: () => "2026-11-21" }));

const { WorkoutLogger } = await import("@/components/workout/workout-logger");
const { loadLocalDraft, saveLocalDraft } = await import("@/lib/workout-storage");

const USER = "11111111-1111-4111-8111-111111111111";
const PUSH_UP = "22222222-2222-4222-8222-222222222222";
const ref = { id: PUSH_UP, slug: "push-up", name: "Push-Up", isTimed: false };
const catalog = [{ ...ref, category: "strength", loaded: false, primary: ["chest"], secondary: [], steps: [], cues: [], mistakes: [] }];
const template = { name: "Push day", userProgramId: null, programDayId: null, warmup: [], cooldown: [], exercises: [{ exercise: ref, restSeconds: 0, target: { sets: 3, reps: "8" } }] };
type Snapshot = { clientId: string; baseRev: number | null; draft: WorkoutDraft };
const sent = (i: number) => sync.mock.calls[i]![0] as Snapshot;
const completed = (d: WorkoutDraft) => d.exercises[0]!.sets.map((s) => s.completed);
const okFinish = { ok: true, data: { sessionId: "s1", volumeKg: 0, records: [], badges: [], milestones: [], next: null, previous: null, reflection: null } };
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const header = () => (screen.queryByText(/^Synced$/) ? "Synced" : screen.queryByText(/Saved on device/) ? "Saved on device" : screen.queryByText(/Saving/) ? "Saving" : "none");

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sync.mockReset();
  finish.mockReset();
  confirm.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the same workout changed on another device (F-30)", () => {
  it("a backup refused as older is combined with the other device's copy (both devices' sets kept) and saved on its revision", async () => {
    // The account has moved to revision 2: the tablet completed set 2 at 80 kg.
    sync.mockImplementationOnce(async (s: Snapshot) => {
      const theirs = structuredClone(s.draft);
      theirs.exercises[0]!.sets[1] = { ...theirs.exercises[0]!.sets[1]!, completed: true, reps: 9 };
      theirs.updatedAt = new Date(Date.parse(s.draft.updatedAt) - 1000).toISOString();
      return { ok: true, data: { status: "conflict", rev: 2, draft: theirs } };
    });
    sync.mockResolvedValue({ ok: true, data: { status: "saved", rev: 3 } });
    render(<WorkoutLogger userId={USER} units="imperial" catalog={catalog} alternatives={{}} serverDrafts={[]} template={template} previous={{}} targets={{}} />);
    await advance(0);
    fireEvent.click(screen.getAllByTestId("complete-set")[0]!);
    await advance(0);
    expect(sent(0).baseRev).toBeNull();
    await advance(0);

    // Sent again, combined, on revision 2: set 1 (this phone) and set 2 (the tablet) both done.
    expect(sync).toHaveBeenCalledTimes(2);
    expect(sent(1).baseRev).toBe(2);
    expect(completed(sent(1).draft)).toEqual([true, true, false]);
    expect(completed(loadLocalDraft(USER)!)).toEqual([true, true, false]);
    expect(screen.getByTestId("workout-sync-notice").textContent).toMatch(/1 set added\. Nothing from this device was lost/);
    expect(header()).toBe("Synced");
    // The next backup goes on the revision the account confirmed.
    expect(loadLocalDraft(USER)!.baseRev).toBe(3);
  });

  it("a workout finished on another device: told, never shown as synced, backups stop, Finish still adds this device's sets", async () => {
    sync.mockResolvedValue({ ok: true, data: { status: "finished" } });
    render(<WorkoutLogger userId={USER} units="imperial" catalog={catalog} alternatives={{}} serverDrafts={[]} template={template} previous={{}} targets={{}} />);
    await advance(0);
    fireEvent.click(screen.getAllByTestId("complete-set")[0]!);
    await advance(0);
    expect(screen.getByTestId("workout-sync-notice").textContent).toMatch(/finished on another device/);
    expect(header()).toBe("Saved on device");
    // The next set, a moment later (a second tap straight away counts as the same tap).
    await advance(1_500);
    fireEvent.click(screen.getAllByTestId("complete-set")[0]!);
    await advance(10_000);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(loadLocalDraft(USER)!.exercises[0]!.sets.filter((s) => s.completed)).toHaveLength(2);

    finish.mockResolvedValueOnce({ ...okFinish, data: { ...okFinish.data, alreadyCompleted: true, addedSets: 2 } });
    fireEvent.click(screen.getAllByRole("button", { name: "Finish" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Finish & save/ }));
    await advance(0);
    expect(screen.getByTestId("finish-sync-note").textContent).toMatch(/2 sets from this device were added/);
  });

  it("Finish on an older copy is combined with the account's copy and finished again with both devices' sets", async () => {
    sync.mockResolvedValue({ ok: true, data: { status: "saved", rev: 1 } });
    render(<WorkoutLogger userId={USER} units="imperial" catalog={catalog} alternatives={{}} serverDrafts={[]} template={template} previous={{}} targets={{}} />);
    await advance(0);
    fireEvent.click(screen.getAllByTestId("complete-set")[0]!);
    await advance(0);
    const mine = loadLocalDraft(USER)!;
    const theirs = structuredClone(mine);
    theirs.exercises[0]!.sets[2] = { ...theirs.exercises[0]!.sets[2]!, completed: true, reps: 7 };
    finish.mockResolvedValueOnce({ ok: false, error: "conflict", conflict: { rev: 4, draft: theirs } });
    finish.mockResolvedValueOnce(okFinish);
    fireEvent.click(screen.getAllByRole("button", { name: "Finish" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Finish & save/ }));
    await advance(0);
    expect(finish).toHaveBeenCalledTimes(2);
    const second = finish.mock.calls[1]![0] as { baseRev: number; exercises: { sets: { completed: boolean }[] }[] };
    expect(second.baseRev).toBe(4);
    expect(second.exercises[0]!.sets.map((s) => s.completed)).toEqual([true, false, true]);
    expect(screen.getByTestId("finish-sync-note").textContent).toMatch(/1 set from your other device was included/);
    expect(loadLocalDraft(USER)).toBeNull();
  });
});

describe("two different unfinished workouts (F-29)", () => {
  const phoneWorkout = (): WorkoutDraft => {
    const d = createDraft({ name: "Phone workout", now: "2026-11-21T08:00:00.000Z", clientId: "33333333-3333-4333-8333-333333333333", exercises: template.exercises });
    d.exercises[0]!.sets[0] = { ...d.exercises[0]!.sets[0]!, completed: true, reps: 8 };
    return { ...d, baseRev: null };
  };
  const tabletWorkout = () => createDraft({ name: "Tablet workout", now: "2026-11-21T09:00:00.000Z", clientId: "44444444-4444-4444-8444-444444444444", exercises: template.exercises });

  it("both are offered; neither is dropped. Offline, switching away from this device's unsaved one is refused", async () => {
    saveLocalDraft(USER, phoneWorkout());
    sync.mockResolvedValueOnce({ ok: false, error: "offline" });
    render(<WorkoutLogger userId={USER} units="imperial" catalog={catalog} alternatives={{}} serverDrafts={[{ draft: tabletWorkout(), rev: 4 }]} template={null} previous={{}} targets={{}} />);
    await advance(0);
    expect(screen.getByTestId("workout-chooser")).toBeInTheDocument();
    expect(screen.getAllByTestId("workout-choice").map((li) => li.querySelector("p")!.textContent)).toEqual(["Phone workout", "Tablet workout"]);
    expect(screen.getAllByTestId("workout-choice")[0]!.textContent).toMatch(/on this device only/);

    fireEvent.click(screen.getByRole("button", { name: "Continue Tablet workout" }));
    await advance(0);
    expect(screen.getByText(/Phone workout is only on this device and couldn't be saved/)).toBeInTheDocument();
    expect(screen.getByTestId("workout-chooser")).toBeInTheDocument();
    expect(loadLocalDraft(USER)!.name).toBe("Phone workout");
  });

  it("continuing the account's workout first saves this device's one to the account, so both survive", async () => {
    saveLocalDraft(USER, phoneWorkout());
    sync.mockResolvedValue({ ok: true, data: { status: "saved", rev: 1 } });
    render(<WorkoutLogger userId={USER} units="imperial" catalog={catalog} alternatives={{}} serverDrafts={[{ draft: tabletWorkout(), rev: 4 }]} template={null} previous={{}} targets={{}} />);
    await advance(0);
    fireEvent.click(screen.getByRole("button", { name: "Continue Tablet workout" }));
    await advance(0);
    expect(sent(0).clientId).toBe("33333333-3333-4333-8333-333333333333");
    expect(completed(sent(0).draft)).toEqual([true, false, false]);
    expect(screen.queryByTestId("workout-chooser")).toBeNull();
    // The tablet workout is open here now, on the account's revision.
    fireEvent.click(screen.getAllByTestId("complete-set")[0]!);
    await advance(0);
    expect(sent(sync.mock.calls.length - 1)).toMatchObject({ clientId: "44444444-4444-4444-8444-444444444444", baseRev: 4 });
  });
});
