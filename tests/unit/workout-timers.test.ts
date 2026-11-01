import { describe, expect, it } from "vitest";
import { createDraft, draftSummary, elapsedSeconds, restRemaining, workoutReducer, type DraftAction, type WorkoutDraft } from "@/lib/domain/workout-draft";
import { bestsFromSets, detectNewRecords, estimateOneRepMax, totalVolume } from "@/lib/domain/strength";

/**
 * Rest timer, pause / resume and elapsed time in the workout logger (audit: these had no unit tests). Every timer is
 * stored as timestamps, so it survives reloads and the app being backgrounded.
 */
const T0 = "2026-10-31T09:00:00.000Z";
const at = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();

function start(): { d: WorkoutDraft; key: string; sets: string[] } {
  const d = createDraft({
    name: "Push",
    now: T0,
    exercises: [
      { exercise: { id: "e1", slug: "bench-press", name: "Bench", isTimed: false }, restSeconds: 120, target: { sets: 3, reps: "5" } },
      { exercise: { id: "e2", slug: "plank", name: "Plank", isTimed: true }, restSeconds: 60, target: { sets: 2, seconds: 45 } },
    ],
  });
  return { d, key: d.exercises[0]!.id, sets: d.exercises[0]!.sets.map((s) => s.id) };
}

const run = (d: WorkoutDraft, ...actions: DraftAction[]) => actions.reduce(workoutReducer, d);

describe("rest timer", () => {
  it("starts when a set is completed and counts down from the exercise's rest", () => {
    const { d, key, sets } = start();
    const after = run(d, { type: "toggleSetComplete", exerciseKey: key, setId: sets[0]!, now: at(30) });
    expect(after.rest.endsAt).toBe(at(150));
    expect(restRemaining(after, at(30))).toBe(120);
    expect(restRemaining(after, at(100))).toBe(50);
    expect(restRemaining(after, at(200))).toBe(0);
  });

  it("doesn't start when a completed set is un-ticked", () => {
    const { d, key, sets } = start();
    const once = run(d, { type: "toggleSetComplete", exerciseKey: key, setId: sets[0]!, now: at(30) }, { type: "clearRest" });
    const undone = run(once, { type: "toggleSetComplete", exerciseKey: key, setId: sets[0]!, now: at(40) });
    expect(undone.exercises[0]!.sets[0]!.completed).toBe(false);
    expect(undone.rest.endsAt).toBeNull();
  });

  it("can be lengthened or shortened, and ends when shortened past now", () => {
    const { d, key, sets } = start();
    const r = run(d, { type: "toggleSetComplete", exerciseKey: key, setId: sets[0]!, now: at(0) });
    expect(restRemaining(run(r, { type: "adjustRest", deltaSeconds: 15, now: at(10) }), at(10))).toBe(125);
    expect(restRemaining(run(r, { type: "adjustRest", deltaSeconds: -30, now: at(10) }), at(10))).toBe(80);
    const ended = run(r, { type: "adjustRest", deltaSeconds: -200, now: at(10) });
    expect(ended.rest).toEqual({ endsAt: null, durationSeconds: 0, pausedRemaining: null });
  });
});

describe("pause and resume", () => {
  it("freezes the rest timer and the workout clock, and picks both up again", () => {
    const { d, key, sets } = start();
    let w = run(d, { type: "toggleSetComplete", exerciseKey: key, setId: sets[0]!, now: at(60) }); // rest until 180
    w = run(w, { type: "pause", now: at(100) });
    expect(restRemaining(w, at(100))).toBe(80);
    expect(restRemaining(w, at(1000))).toBe(80); // frozen while paused
    expect(elapsedSeconds(w, at(1000))).toBe(100); // the clock stopped at the pause
    w = run(w, { type: "resume", now: at(400) });
    expect(w.pausedSeconds).toBe(300);
    expect(restRemaining(w, at(400))).toBe(80);
    expect(restRemaining(w, at(430))).toBe(50);
    expect(elapsedSeconds(w, at(500))).toBe(200); // 500 s wall time − 300 s paused
  });

  it("doesn't start a rest for a set ticked while paused, and pausing twice is harmless", () => {
    const { d, key, sets } = start();
    const p = run(d, { type: "pause", now: at(10) }, { type: "pause", now: at(20) });
    expect(p.pausedAt).toBe(at(10));
    const ticked = run(p, { type: "toggleSetComplete", exerciseKey: key, setId: sets[0]!, now: at(30) });
    expect(ticked.exercises[0]!.sets[0]!.completed).toBe(true);
    expect(ticked.rest.endsAt).toBeNull();
    expect(run(ticked, { type: "resume", now: at(70) }, { type: "resume", now: at(90) }).pausedSeconds).toBe(60);
  });
});

describe("what a finished workout saves", () => {
  it("counts only completed working sets toward volume and records", () => {
    const { d, key, sets } = start();
    let w = run(
      d,
      { type: "updateSet", exerciseKey: key, setId: sets[0]!, patch: { weightKg: 60, reps: 5, isWarmup: true } },
      { type: "updateSet", exerciseKey: key, setId: sets[1]!, patch: { weightKg: 100, reps: 5 } },
      { type: "updateSet", exerciseKey: key, setId: sets[2]!, patch: { weightKg: 110, reps: 3 } },
    );
    w = run(w, { type: "toggleSetComplete", exerciseKey: key, setId: sets[0]!, now: at(1) }, { type: "toggleSetComplete", exerciseKey: key, setId: sets[1]!, now: at(2) });
    // The 110 kg set was typed but never completed; the 60 kg set is a warm-up.
    expect(draftSummary(w).volumeKg).toBe(500);
    const bests = bestsFromSets(w.exercises[0]!.sets);
    expect(bests.find((b) => b.recordType === "max_weight")?.value).toBe(100);
    expect(bests.find((b) => b.recordType === "estimated_1rm")?.value).toBe(116.67);
    expect(detectNewRecords([{ recordType: "max_weight", value: 100 }], bests).map((b) => b.recordType)).not.toContain("max_weight");
  });

  it("rejects impossible values typed into a set", () => {
    const { d, key, sets } = start();
    const w = run(d, { type: "updateSet", exerciseKey: key, setId: sets[0]!, patch: { weightKg: -5, reps: 5000, rpe: 14 } });
    expect(w.exercises[0]!.sets[0]).toMatchObject({ weightKg: 0, reps: 1000, rpe: 10 });
    expect(totalVolume([{ reps: 5, weightKg: Number.NaN, completed: true }])).toBe(0);
    expect(estimateOneRepMax(100, 13)).toBeNull(); // beyond the formula's useful range
  });

  it("substituting an exercise keeps the reps, clears loads and ticks, and remembers the original", () => {
    const { d, key, sets } = start();
    const w = run(
      d,
      { type: "updateSet", exerciseKey: key, setId: sets[0]!, patch: { weightKg: 100, reps: 5 } },
      { type: "toggleSetComplete", exerciseKey: key, setId: sets[0]!, now: at(1) },
      { type: "substituteExercise", exerciseKey: key, replacement: { id: "e3", slug: "dumbbell-bench-press", name: "DB Bench", isTimed: false } },
    );
    const ex = w.exercises[0]!;
    expect(ex).toMatchObject({ exerciseId: "e3", substitutedFromId: "e1", substitutedFromName: "Bench" });
    expect(ex.sets[0]).toMatchObject({ reps: 5, weightKg: null, completed: false });
  });
});
