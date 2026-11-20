import { describe, expect, it } from "vitest";
import { createDraft, workoutReducer, type WorkoutDraft } from "@/lib/domain/workout-draft";
import { mergeDrafts, mergeFinishedExercises, restoreCandidates } from "@/lib/domain/workout-merge";

/**
 * F-29 / F-30 (security assessment 2026-11-20): two devices or tabs working on workouts at once. Two copies of one
 * workout are combined so that no completed set from either is lost; two different workouts are both kept.
 */
const SQUAT = { id: "11111111-1111-4111-8111-111111111111", slug: "back-squat", name: "Back Squat", isTimed: false };
const BENCH = { id: "22222222-2222-4222-8222-222222222222", slug: "bench-press", name: "Bench Press", isTimed: false };
// In the future, so timestamps the reducer takes from the real clock never come after these.
const T0 = "2030-01-01T10:00:00.000Z";
const at = (min: number) => new Date(Date.parse(T0) + min * 60_000).toISOString();

function base(): WorkoutDraft {
  return createDraft({
    name: "Push day",
    now: T0,
    clientId: "33333333-3333-4333-8333-333333333333",
    exercises: [
      { exercise: SQUAT, restSeconds: 0, target: { sets: 3, reps: "5" } },
      { exercise: BENCH, restSeconds: 0, target: { sets: 3, reps: "8" } },
    ],
  });
}
/** Log set `i` of exercise `e` (weight, reps, done) at minute `min`. */
function logSet(d: WorkoutDraft, e: number, i: number, weightKg: number, min: number): WorkoutDraft {
  const ex = d.exercises[e]!;
  const set = ex.sets[i]!;
  let x = workoutReducer(d, { type: "updateSet", exerciseKey: ex.id, setId: set.id, patch: { weightKg, reps: 5 }, now: at(min) } as never);
  x = workoutReducer(x, { type: "toggleSetComplete", exerciseKey: ex.id, setId: set.id, now: at(min) } as never);
  return x;
}
const done = (d: WorkoutDraft) => d.exercises.map((e) => e.sets.filter((s) => s.completed).map((s) => s.weightKg));

describe("mergeDrafts: two copies of one workout", () => {
  it("keeps every set completed on either device (phone did squats, tablet did bench)", () => {
    const start = base();
    const phone = logSet(logSet(start, 0, 0, 100, 1), 0, 1, 100, 3);
    const tablet = logSet(start, 1, 0, 60, 2);
    const m = mergeDrafts(phone, tablet, at(5));
    expect(done(m.draft)).toEqual([[100, 100], [60]]);
    expect(m.fromOther).toBe(1);
    expect(m.changed).toBe(true);
    // And the other way round: the same result.
    expect(done(mergeDrafts(tablet, phone, at(5)).draft)).toEqual([[100, 100], [60]]);
  });

  it("a set completed on one device wins over the same set still open on the other, whichever is newer", () => {
    const start = base();
    const phone = logSet(start, 0, 0, 100, 1);
    // The tablet typed a weight into the same set later but never completed it.
    const tablet = workoutReducer(start, { type: "updateSet", exerciseKey: start.exercises[0]!.id, setId: start.exercises[0]!.sets[0]!.id, patch: { weightKg: 20 }, now: at(9) } as never);
    const m = mergeDrafts(phone, tablet, at(10));
    expect(m.draft.exercises[0]!.sets[0]).toMatchObject({ completed: true, weightKg: 100 });
  });

  it("where both completed the same set, the copy changed last wins; sets and exercises on one side only are kept in place", () => {
    const start = base();
    const phone = logSet(start, 0, 0, 100, 1);
    let tablet = logSet(start, 0, 0, 102.5, 4);
    tablet = workoutReducer(tablet, { type: "addSet", exerciseKey: tablet.exercises[0]!.id, now: at(5) } as never);
    const m = mergeDrafts(phone, tablet, at(6));
    expect(m.draft.exercises[0]!.sets[0]!.weightKg).toBe(102.5);
    expect(m.draft.exercises[0]!.sets.length).toBe(4);
    expect(m.draft.exercises.map((e) => e.exerciseId)).toEqual([SQUAT.id, BENCH.id]);
  });

  it("is newer than both copies, refuses two different workouts, and reports no change when there is none", () => {
    const a = logSet(base(), 0, 0, 100, 1);
    const m = mergeDrafts(a, a, at(1));
    expect(m.changed).toBe(false);
    expect(m.fromOther).toBe(0);
    expect(Date.parse(m.draft.updatedAt)).toBeGreaterThan(Date.parse(a.updatedAt));
    expect(() => mergeDrafts(a, { ...a, clientId: "44444444-4444-4444-8444-444444444444" }, at(2))).toThrow();
  });
});

describe("restoreCandidates: what the logger offers when it opens", () => {
  it("two different unfinished workouts are both offered, this device's first (F-29)", () => {
    const local = { ...logSet(base(), 0, 0, 100, 1), baseRev: null };
    const other = { ...base(), clientId: "55555555-5555-4555-8555-555555555555", name: "Leg day", baseRev: 4 };
    const list = restoreCandidates(local, [other], at(3));
    expect(list.map((d) => d.name)).toEqual(["Push day", "Leg day"]);
  });

  it("the same workout: a device copy built on the account's revision is just newer (a set removed here stays removed)", () => {
    const server = { ...logSet(logSet(base(), 0, 0, 100, 1), 0, 1, 100, 2), baseRev: 3 };
    const removed = workoutReducer(server, { type: "removeSet", exerciseKey: server.exercises[0]!.id, setId: server.exercises[0]!.sets[1]!.id, now: at(4) } as never);
    const local = { ...removed, baseRev: 3 };
    const [only, ...rest] = restoreCandidates(local, [server], at(5));
    expect(rest).toEqual([]);
    expect(only!.exercises[0]!.sets.length).toBe(server.exercises[0]!.sets.length - 1);
  });

  it("the same workout changed on another device since: combined on the account's revision", () => {
    const start = base();
    const local = { ...logSet(start, 0, 0, 100, 1), baseRev: 2 };
    const server = { ...logSet(start, 1, 0, 60, 2), baseRev: 5 };
    const [only] = restoreCandidates(local, [server], at(3));
    expect(done(only!)).toEqual([[100], [60]]);
    expect(only!.baseRev).toBe(5);
  });
});

describe("mergeFinishedExercises: a second Finish of a workout already saved", () => {
  const set = (w: number, completed = true) => ({ reps: 5, weightKg: w, durationSeconds: null, distanceM: null, rpe: null, isWarmup: false, isDrop: false, completed });
  const ex = (id: string, sets: ReturnType<typeof set>[], skipped = false) => ({ exerciseId: id, substitutedFromId: null, notes: "", skipped, skipReason: skipped ? ("time" as const) : null, sets });

  it("keeps the saved sets and adds the other device's (the old rule dropped sets when totals were compared)", () => {
    const saved = [ex(SQUAT.id, [set(100), set(100), set(100)]), ex(BENCH.id, [set(60, false), set(60, false)])];
    const incoming = [ex(SQUAT.id, [set(100), set(0, false), set(0, false)]), ex(BENCH.id, [set(60), set(62.5)])];
    const m = mergeFinishedExercises(saved, incoming);
    expect(m.added).toBe(2);
    expect(m.exercises.map((e) => e.sets.filter((s) => s.completed).map((s) => s.weightKg))).toEqual([[100, 100, 100], [60, 62.5]]);
  });

  it("adds nothing for a plain repeat, keeps saved values where both completed, appends extra sets and exercises", () => {
    const saved = [ex(SQUAT.id, [set(100), set(100)])];
    expect(mergeFinishedExercises(saved, saved).added).toBe(0);
    const m = mergeFinishedExercises(saved, [ex(SQUAT.id, [set(90), set(90), set(110)]), ex(BENCH.id, [set(60)])]);
    expect(m.exercises[0]!.sets.map((s) => s.weightKg)).toEqual([100, 100, 110]);
    expect(m.exercises[1]!.exerciseId).toBe(BENCH.id);
    expect(m.added).toBe(2);
  });

  it("an exercise skipped on one device but done on the other counts as done", () => {
    const m = mergeFinishedExercises([ex(BENCH.id, [set(60, false)], true)], [ex(BENCH.id, [set(60)])]);
    expect(m.exercises[0]!.skipped).toBe(false);
    expect(m.added).toBe(1);
  });
});
