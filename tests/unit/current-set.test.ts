import { describe, expect, it } from "vitest";
import { completionTotals, createDraft, currentSetInfo, draftSummary, workoutReducer, type WorkoutDraft } from "@/lib/domain/workout-draft";

const NOW = "2026-11-04T10:00:00.000Z";
const ex = (slug: string, isTimed = false) => ({ exercise: { id: `id-${slug}`, slug, name: slug.replace(/-/g, " "), isTimed } });

function draft(): WorkoutDraft {
  return createDraft({
    name: "Upper",
    now: NOW,
    exercises: [
      { ...ex("bench-press"), target: { sets: 3, reps: "6-8" } },
      { ...ex("barbell-row"), target: { sets: 2, reps: "8-10" } },
    ],
  });
}

const complete = (d: WorkoutDraft, exIndex: number, setIndex: number) =>
  workoutReducer(d, { type: "toggleSetComplete", exerciseKey: d.exercises[exIndex]!.id, setId: d.exercises[exIndex]!.sets[setIndex]!.id, now: NOW });

describe("current set card", () => {
  it("starts on the first set of the first exercise, numbered for people", () => {
    const info = currentSetInfo(draft())!;
    expect(info.exercise.slug).toBe("bench-press");
    expect([info.exerciseNumber, info.exerciseCount]).toEqual([1, 2]);
    expect([info.workingNumber, info.workingCount]).toEqual([1, 3]);
    expect(info.warmup).toBe(false);
  });

  it("moves to the next set after one is completed, and to the next exercise after the last set", () => {
    let d = complete(draft(), 0, 0);
    expect(currentSetInfo(d)!.workingNumber).toBe(2);
    d = complete(complete(d, 0, 1), 0, 2);
    const info = currentSetInfo(d)!;
    expect(info.exercise.slug).toBe("barbell-row");
    expect([info.exerciseNumber, info.workingNumber, info.workingCount]).toEqual([2, 1, 2]);
  });

  it("counts warm-up sets separately from working sets", () => {
    let d = draft();
    d = workoutReducer(d, { type: "updateSet", exerciseKey: d.exercises[0]!.id, setId: d.exercises[0]!.sets[0]!.id, patch: { isWarmup: true } });
    const info = currentSetInfo(d)!;
    expect(info.warmup).toBe(true);
    expect([info.warmupNumber, info.warmupCount, info.workingCount]).toEqual([1, 1, 2]);
  });

  it("skips a skipped exercise and is null once every set is done", () => {
    const base = draft();
    const d = workoutReducer(base, { type: "skipExercise", exerciseKey: base.exercises[0]!.id, reason: "equipment" });
    expect(currentSetInfo(d)!.exercise.slug).toBe("barbell-row");
    expect(currentSetInfo(d)!.exerciseCount).toBe(1);
    let all = draft();
    for (let e = 0; e < 2; e++) for (let s = 0; s < all.exercises[e]!.sets.length; s++) all = complete(all, e, s);
    expect(currentSetInfo(all)).toBeNull();
  });

  it("won't complete a set without reps (the card asks for them first)", () => {
    let d = draft();
    d = workoutReducer(d, { type: "updateSet", exerciseKey: d.exercises[0]!.id, setId: d.exercises[0]!.sets[0]!.id, patch: { reps: null } });
    expect(complete(d, 0, 0)).toBe(d);
  });
});

describe("finish and completion totals count working sets only", () => {
  it("reports done vs planned working sets, exercises and reps; warm-ups never count", () => {
    let d = draft();
    d = workoutReducer(d, { type: "updateSet", exerciseKey: d.exercises[0]!.id, setId: d.exercises[0]!.sets[0]!.id, patch: { isWarmup: true, reps: 10 } });
    d = complete(d, 0, 0); // warm-up
    d = complete(d, 0, 1); // working, 6 reps (from the target's low end)
    const s = draftSummary(d);
    expect([s.workingCompleted, s.workingTotal]).toEqual([1, 4]);
    expect(s.completedSets).toBe(2);
    const t = completionTotals(d);
    expect([t.setsDone, t.setsPlanned, t.exercisesDone, t.exercisesPlanned]).toEqual([1, 4, 1, 2]);
    expect(t.reps).toBe(d.exercises[0]!.sets[1]!.reps);
  });

  it("an unchanged draft is a partial workout of 0 sets", () => {
    const t = completionTotals(draft());
    expect([t.setsDone, t.setsPlanned, t.reps]).toEqual([0, 5, 0]);
  });
});
