import { canAddDropSet, completionTotals, createDraft, currentSetInfo, finishPayload, isWorkoutDraft, nextUp, workoutReducer, type WorkoutDraft } from "@/lib/domain/workout-draft";
import { totalVolume } from "@/lib/domain/strength";
import { finishWorkoutSchema } from "@/lib/validation/schemas";

/**
 * Drop sets: right after a working set, the member adds a set at a lower weight and does it with no rest. The drop
 * set is a real working set (it counts for volume), it is never given a weight the member didn't enter, and it
 * doesn't shift the set numbers ("Set 2 of 3" stays "Set 2 of 3").
 */
const NOW = "2026-11-12T10:00:00.000Z";
const curl = { id: "33333333-3333-4333-8333-333333333333", slug: "dumbbell-curl", name: "Dumbbell curl", isTimed: false };
const row = { id: "22222222-2222-4222-8222-222222222222", slug: "one-arm-dumbbell-row", name: "Row", isTimed: false };

function start(): WorkoutDraft {
  return createDraft({ name: "Arms", now: NOW, exercises: [{ exercise: curl, restSeconds: 90, target: { sets: 3, reps: "10" } }] });
}
const exOf = (d: WorkoutDraft) => d.exercises[0]!;

function logFirst(d: WorkoutDraft, weightKg = 20, reps = 10): WorkoutDraft {
  const e = exOf(d);
  const s = e.sets[0]!;
  d = workoutReducer(d, { type: "updateSet", exerciseKey: e.id, setId: s.id, patch: { weightKg, reps } });
  return workoutReducer(d, { type: "toggleSetComplete", exerciseKey: e.id, setId: s.id, now: NOW });
}

describe("drop sets", () => {
  it("adds an empty drop set straight after the set just done, ends the rest and makes it the next set", () => {
    let d = logFirst(start());
    expect(d.rest.endsAt).not.toBeNull();
    const e = exOf(d);
    const first = e.sets[0]!;
    expect(canAddDropSet(e, first.id)).toBe(true);
    d = workoutReducer(d, { type: "addDropSet", exerciseKey: e.id, afterSetId: first.id });
    const sets = exOf(d).sets;
    expect(sets).toHaveLength(4);
    const drop = sets[1]!;
    expect(drop.isDrop).toBe(true);
    // Never a weight the member didn't enter: the lower weight is theirs to type.
    expect(drop.weightKg).toBeNull();
    expect(drop.reps).toBeNull();
    expect(drop.completed).toBe(false);
    expect(d.rest.endsAt).toBeNull();
    expect(nextUp(d)).toEqual({ exerciseKey: e.id, setId: drop.id });
    const info = currentSetInfo(d)!;
    expect(info.drop).toBe(true);
    expect(info.dropNumber).toBe(1);
    // Working sets are still counted 1 of 3, 2 of 3, 3 of 3.
    expect(info.workingCount).toBe(3);
    expect(info.workingNumber).toBeNull();
  });

  it("a second drop goes after the first; finishing the last drop starts the rest; the next set takes the main set's numbers", () => {
    let d = logFirst(start(), 20, 10);
    const key = exOf(d).id;
    const first = exOf(d).sets[0]!.id;
    d = workoutReducer(d, { type: "addDropSet", exerciseKey: key, afterSetId: first });
    const drop1 = exOf(d).sets[1]!.id;
    d = workoutReducer(d, { type: "updateSet", exerciseKey: key, setId: drop1, patch: { weightKg: 15, reps: 8 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: key, setId: drop1, now: NOW });
    d = workoutReducer(d, { type: "addDropSet", exerciseKey: key, afterSetId: drop1 });
    const drop2 = exOf(d).sets[2]!;
    expect(drop2.isDrop).toBe(true);
    expect(d.rest.endsAt).toBeNull();
    d = workoutReducer(d, { type: "updateSet", exerciseKey: key, setId: drop2.id, patch: { weightKg: 10, reps: 6 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: key, setId: drop2.id, now: NOW });
    expect(d.rest.endsAt).not.toBeNull();
    // Set 2 starts from set 1 (20 × 10), not from the last drop (10 × 6).
    const set2 = exOf(d).sets[3]!;
    expect(set2.isDrop).toBeFalsy();
    expect(set2.weightKg).toBe(20);
    expect(set2.reps).toBe(10);
    expect(currentSetInfo(d)!.workingNumber).toBe(2);
  });

  it("no rest between a set and a drop set already waiting after it", () => {
    let d = start();
    const key = exOf(d).id;
    const s1 = exOf(d).sets[0]!.id;
    d = logFirst(d);
    d = workoutReducer(d, { type: "addDropSet", exerciseKey: key, afterSetId: s1 });
    // Undo set 1 and do it again: the drop set waiting after it means no rest starts.
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: key, setId: s1, now: NOW });
    d = workoutReducer(d, { type: "clearRest" });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: key, setId: s1, now: NOW });
    expect(d.rest.endsAt).toBeNull();
  });

  it("counts completed drop sets as working volume", () => {
    let d = logFirst(start(), 20, 10);
    const key = exOf(d).id;
    d = workoutReducer(d, { type: "addDropSet", exerciseKey: key, afterSetId: exOf(d).sets[0]!.id });
    const drop = exOf(d).sets[1]!.id;
    d = workoutReducer(d, { type: "updateSet", exerciseKey: key, setId: drop, patch: { weightKg: 15, reps: 8 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: key, setId: drop, now: NOW });
    expect(completionTotals(d).setsDone).toBe(2);
    expect(totalVolume(exOf(d).sets)).toBe(20 * 10 + 15 * 8);
  });

  it("is refused after a warm-up, an unfinished set, on a superset, or past 50 sets", () => {
    let d = start();
    const e = exOf(d);
    expect(canAddDropSet(e, e.sets[0]!.id)).toBe(false); // not done yet
    expect(workoutReducer(d, { type: "addDropSet", exerciseKey: e.id, afterSetId: e.sets[0]!.id })).toBe(d);
    d = workoutReducer(d, { type: "updateSet", exerciseKey: e.id, setId: e.sets[0]!.id, patch: { isWarmup: true, reps: 10 } });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: e.id, setId: e.sets[0]!.id, now: NOW });
    expect(canAddDropSet(exOf(d), e.sets[0]!.id)).toBe(false); // a warm-up

    const ss = createDraft({
      name: "SS",
      now: NOW,
      exercises: [
        { exercise: curl, restSeconds: 60, target: { sets: 2, reps: "10" }, supersetGroup: 1 },
        { exercise: row, restSeconds: 60, target: { sets: 2, reps: "10" }, supersetGroup: 1 },
      ],
    });
    const a = ss.exercises[0]!;
    let s2 = workoutReducer(ss, { type: "updateSet", exerciseKey: a.id, setId: a.sets[0]!.id, patch: { reps: 10, weightKg: 10 } });
    s2 = workoutReducer(s2, { type: "toggleSetComplete", exerciseKey: a.id, setId: a.sets[0]!.id, now: NOW });
    expect(canAddDropSet(s2.exercises[0]!, a.sets[0]!.id)).toBe(false); // superset rounds stay aligned
  });

  it("a draft with drop sets is still a valid draft, and the server schema accepts isDrop (optional for old clients)", () => {
    let d = logFirst(start());
    d = workoutReducer(d, { type: "addDropSet", exerciseKey: exOf(d).id, afterSetId: exOf(d).sets[0]!.id });
    expect(isWorkoutDraft(d)).toBe(true);
    // What Finish sends: the drop set marked, the other sets exactly as before (no isDrop key at all).
    const sent = finishPayload(d, NOW).exercises[0]!.sets;
    expect(sent[1]).toMatchObject({ isDrop: true });
    expect("isDrop" in sent[0]!).toBe(false);
    expect(finishWorkoutSchema.safeParse(finishPayload(d, NOW)).success).toBe(true);
    const base = { clientId: "44444444-4444-4444-8444-444444444444", name: "Arms", userProgramId: null, programDayId: null, startedAt: NOW, endedAt: NOW, notes: "", pausedSeconds: 0 };
    const set = { reps: 8, weightKg: 15, durationSeconds: null, rpe: null, isWarmup: false, completed: true };
    const ex = { exerciseId: curl.id, substitutedFromId: null, notes: "", skipped: false, skipReason: null };
    expect(finishWorkoutSchema.safeParse({ ...base, exercises: [{ ...ex, sets: [{ ...set, isDrop: true }] }] }).success).toBe(true);
    expect(finishWorkoutSchema.safeParse({ ...base, exercises: [{ ...ex, sets: [set] }] }).success).toBe(true);
    // A warm-up can't be a drop set (the database refuses it too).
    expect(finishWorkoutSchema.safeParse({ ...base, exercises: [{ ...ex, sets: [{ ...set, isWarmup: true, isDrop: true }] }] }).success).toBe(false);
  });
});
