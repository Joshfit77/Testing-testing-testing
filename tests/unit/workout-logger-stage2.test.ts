import { distanceMode, formatDistance, fromMetres, toMetres, usesDistance } from "@/lib/domain/exercise-tracking";
import { lastTimeText, latestPerformances, summarizeSets, type PreviousRow, type PreviousSet } from "@/lib/domain/previous-performance";
import {
  createDraft,
  DRAFT_VERSION,
  isWorkoutDraft,
  migrateDraft,
  nextUp,
  supersetRoundOrder,
  supersetMembers,
  workoutReducer,
  type WorkoutDraft,
} from "@/lib/domain/workout-draft";
import { normalizeTemplateGroups, supersetLetter, templateFromDraft } from "@/lib/domain/workout-templates";
import { templateSchema } from "@/lib/validation/schemas";

const NOW = "2026-10-21T10:00:00.000Z";
const ex = (slug: string, isTimed = false) => ({ id: `00000000-0000-4000-8000-${slug.length.toString().padStart(12, "0")}`, slug, name: slug, isTimed });
const bench = { ...ex("bench-press"), id: "11111111-1111-4111-8111-111111111111" };
const row = { ...ex("one-arm-dumbbell-row"), id: "22222222-2222-4222-8222-222222222222" };
const curl = { ...ex("dumbbell-curl"), id: "33333333-3333-4333-8333-333333333333" };
const carry = { ...ex("farmers-carry", true), id: "44444444-4444-4444-8444-444444444444" };

function draftWithSuperset(): WorkoutDraft {
  return createDraft({
    name: "Push pull",
    now: NOW,
    exercises: [
      { exercise: bench, restSeconds: 120, target: { sets: 3, reps: "8" }, supersetGroup: 1 },
      { exercise: row, restSeconds: 90, target: { sets: 3, reps: "10" }, supersetGroup: 1 },
      { exercise: curl, restSeconds: 60, target: { sets: 2, reps: "12" } },
    ],
  });
}

describe("supersets in the logger", () => {
  it("groups exercises from a template and alternates them A1, B1, A2, B2…", () => {
    const d = draftWithSuperset();
    const [a, b, c] = d.exercises;
    expect(a!.supersetId).toBeTruthy();
    expect(b!.supersetId).toBe(a!.supersetId);
    expect(c!.supersetId).toBeNull();
    const order = supersetRoundOrder(supersetMembers(d, a!.id)).map((x) => `${x.exerciseKey === a!.id ? "A" : "B"}${x.round + 1}`);
    expect(order).toEqual(["A1", "B1", "A2", "B2", "A3", "B3"]);
  });

  it("rests only after the round, for the longer of the two rests", () => {
    let d = draftWithSuperset();
    const [a, b] = d.exercises;
    expect(nextUp(d)).toEqual({ exerciseKey: a!.id, setId: a!.sets[0]!.id });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: a!.id, setId: a!.sets[0]!.id, now: NOW });
    expect(d.rest.endsAt).toBeNull(); // straight to B1, no rest
    expect(nextUp(d)).toEqual({ exerciseKey: b!.id, setId: b!.sets[0]!.id });
    d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: b!.id, setId: b!.sets[0]!.id, now: NOW });
    expect(d.rest.durationSeconds).toBe(120); // round done → rest
    expect(nextUp(d)).toEqual({ exerciseKey: a!.id, setId: a!.sets[1]!.id });
  });

  it("moves on to the next exercise once every round is done", () => {
    let d = draftWithSuperset();
    for (const r of [0, 1, 2]) for (const e of d.exercises.slice(0, 2)) d = workoutReducer(d, { type: "toggleSetComplete", exerciseKey: e.id, setId: e.sets[r]!.id, now: NOW });
    expect(nextUp(d)!.exerciseKey).toBe(d.exercises[2]!.id);
  });

  it("links and unlinks, and splits a superset left with one exercise", () => {
    let d = createDraft({ name: "x", now: NOW, exercises: [{ exercise: bench }, { exercise: row }, { exercise: curl }] });
    d = workoutReducer(d, { type: "linkSuperset", exerciseKey: d.exercises[0]!.id });
    d = workoutReducer(d, { type: "linkSuperset", exerciseKey: d.exercises[1]!.id });
    expect(new Set(d.exercises.map((e) => e.supersetId)).size).toBe(1);
    d = workoutReducer(d, { type: "removeExercise", exerciseKey: d.exercises[1]!.id });
    expect(d.exercises[0]!.supersetId).toBe(d.exercises[1]!.supersetId);
    d = workoutReducer(d, { type: "unlinkSuperset", exerciseKey: d.exercises[1]!.id });
    expect(d.exercises.every((e) => e.supersetId === null)).toBe(true);
  });

  it("a member moved out of its superset leaves it", () => {
    let d = draftWithSuperset();
    d = workoutReducer(d, { type: "moveExercise", exerciseKey: d.exercises[1]!.id, direction: 1 });
    expect(d.exercises.map((e) => e.supersetId)).toEqual([null, null, null]);
  });
});

describe("draft format migration", () => {
  const v1 = {
    version: 1,
    clientId: "55555555-5555-4555-8555-555555555555",
    name: "Old workout",
    userProgramId: null,
    programDayId: null,
    startedAt: NOW,
    pausedAt: null,
    pausedSeconds: 0,
    notes: "",
    exercises: [
      {
        id: "e1",
        exerciseId: carry.id,
        slug: "farmers-carry",
        name: "Farmer's Carry",
        isTimed: true,
        substitutedFromId: null,
        substitutedFromName: null,
        notes: "",
        skipped: false,
        skipReason: null,
        restSeconds: 60,
        target: null,
        sets: [{ id: "s1", reps: null, weightKg: 32, durationSeconds: 40, rpe: null, isWarmup: false, completed: true }],
      },
    ],
    rest: { endsAt: null, durationSeconds: 0, pausedRemaining: null },
    updatedAt: NOW,
  };

  it("upgrades v1 drafts without losing logged sets", () => {
    expect(isWorkoutDraft(v1)).toBe(false);
    const d = migrateDraft(v1)!;
    expect(d.version).toBe(DRAFT_VERSION);
    expect(d.templateId).toBeNull();
    expect(d.exercises[0]).toMatchObject({ usesDistance: true, supersetId: null });
    expect(d.exercises[0]!.sets[0]).toMatchObject({ weightKg: 32, durationSeconds: 40, completed: true, distanceM: null });
    expect(isWorkoutDraft(d)).toBe(true);
    // A migrated draft keeps working with the reducer.
    const next = workoutReducer(d, { type: "updateSet", exerciseKey: "e1", setId: "s1", patch: { distanceM: 40 } });
    expect(next.exercises[0]!.sets[0]!.distanceM).toBe(40);
  });

  it("passes current drafts through and rejects junk", () => {
    const d = draftWithSuperset();
    expect(migrateDraft(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(migrateDraft(null)).toBeNull();
    expect(migrateDraft({ version: 3 })).toBeNull();
    expect(migrateDraft({ ...v1, exercises: "nope" })).toBeNull();
  });
});

describe("distance logging", () => {
  it("knows which exercises use distance and how", () => {
    expect(distanceMode("farmers-carry")).toBe("loaded");
    expect(distanceMode("sled-push")).toBe("loaded");
    expect(distanceMode("rowing-intervals")).toBe("cardio");
    expect(distanceMode("zone-2-run")).toBe("cardio");
    expect(usesDistance("bench-press")).toBe(false);
    expect(usesDistance("dead-hang")).toBe(false);
  });

  it("converts units for input and display", () => {
    expect(toMetres(50, "yd")).toBe(45.7);
    expect(fromMetres(45.7, "yd")).toBe(50);
    expect(toMetres(3.1, "mi")).toBe(4989);
    expect(formatDistance(40, "metric")).toBe("40 m");
    expect(formatDistance(5000, "metric")).toBe("5 km");
    expect(formatDistance(45.72, "imperial")).toBe("50 yd");
  });

  it("carries distance from the template into the logged sets", () => {
    const d = createDraft({ name: "x", now: NOW, exercises: [{ exercise: carry, target: { sets: 3, seconds: 30, distanceM: 40 } }] });
    expect(d.exercises[0]!.usesDistance).toBe(true);
    expect(d.exercises[0]!.sets.map((s) => s.distanceM)).toEqual([40, 40, 40]);
  });
});

describe("previous performance", () => {
  const s = (p: Partial<PreviousSet>): PreviousSet => ({ reps: null, weightKg: null, durationSeconds: null, distanceM: null, isWarmup: false, completed: true, ...p });
  const lb225 = 102.0582;

  it("summarizes the working sets", () => {
    expect(summarizeSets([s({ reps: 5, weightKg: 60, isWarmup: true }), s({ reps: 5, weightKg: lb225 }), s({ reps: 5, weightKg: lb225 }), s({ reps: 5, weightKg: lb225 })], "imperial", false)).toBe("3×5 @ 225 lb");
    expect(summarizeSets([s({ reps: 5, weightKg: 100 }), s({ reps: 4, weightKg: 100 })], "metric", false)).toBe("5, 4 @ 100 kg");
    expect(summarizeSets([s({ reps: 12 }), s({ reps: 12 }), s({ reps: 12, completed: false })], "metric", false)).toBe("2×12");
    expect(summarizeSets([s({ durationSeconds: 45 }), s({ durationSeconds: 45 })], "metric", true)).toBe("2 × 0:45");
    expect(summarizeSets([s({ distanceM: 40, weightKg: 32, durationSeconds: 30 }), s({ distanceM: 40, weightKg: 32, durationSeconds: 30 })], "metric", true)).toBe("2 × 40 m in 0:30 @ 32 kg");
    expect(summarizeSets([s({ reps: 5, weightKg: 100 }), s({ reps: 3, weightKg: 110 })], "metric", false)).toBe("100 kg · 5 reps, 110 kg · 3 reps");
    expect(summarizeSets([s({ reps: 5, completed: false })], "metric", false)).toBeNull();
  });

  it("finds the most recent completed session per exercise", () => {
    const rows: PreviousRow[] = [
      { exercise_id: "a", skipped: false, session: { id: "old", started_at: "2026-10-01T10:00:00Z", status: "completed" }, sets: [{ set_number: 1, reps: 5, weight_kg: 90, duration_seconds: null, distance_m: null, is_warmup: false, completed: true }] },
      { exercise_id: "a", skipped: false, session: { id: "new", started_at: "2026-10-10T10:00:00Z", status: "completed" }, sets: [{ set_number: 1, reps: 5, weight_kg: "100", duration_seconds: null, distance_m: null, is_warmup: false, completed: true }] },
      { exercise_id: "a", skipped: false, session: { id: "live", started_at: "2026-10-20T10:00:00Z", status: "in_progress" }, sets: [{ set_number: 1, reps: 5, weight_kg: 120, duration_seconds: null, distance_m: null, is_warmup: false, completed: true }] },
      { exercise_id: "b", skipped: true, session: { id: "new", started_at: "2026-10-10T10:00:00Z", status: "completed" }, sets: [] },
      { exercise_id: "c", skipped: false, session: { id: "x", started_at: "2026-10-11T10:00:00Z", status: "completed" }, sets: [{ set_number: 1, reps: 5, weight_kg: 50, duration_seconds: null, distance_m: null, is_warmup: false, completed: false }] },
    ];
    const map = latestPerformances(rows);
    expect(map.get("a")!.sessionId).toBe("new");
    expect(lastTimeText(map.get("a"), "metric", false)).toBe("Last time: 1×5 @ 100 kg");
    expect(map.has("b")).toBe(false);
    expect(map.has("c")).toBe(false);
  });
});

describe("workout templates", () => {
  it("renumbers superset groups and drops lone members", () => {
    const g = (n: number | null) => ({ supersetGroup: n });
    expect(normalizeTemplateGroups([g(3), g(3), g(null), g(5), g(7), g(7), g(7)]).map((x) => x.supersetGroup)).toEqual([1, 1, null, null, 2, 2, 2]);
    expect(supersetLetter(2)).toBe("B");
  });

  it("turns a finished workout into a valid template with its supersets and distances", () => {
    let d = draftWithSuperset();
    d = workoutReducer(d, { type: "addExercise", exercise: carry, restSeconds: 60, target: { sets: 2, seconds: 30, distanceM: 40 } });
    const t = templateFromDraft({ ...d, name: "Push pull carry" });
    expect(t.exercises.map((e) => [e.target, e.sets, e.supersetGroup])).toEqual([
      ["reps", 3, 1],
      ["reps", 3, 1],
      ["reps", 2, null],
      ["distance", 2, null],
    ]);
    expect(t.exercises[0]!.reps).toBe("8");
    expect(t.exercises[3]!.distanceM).toBe(40);
    expect(templateSchema.safeParse(t).success).toBe(true);
  });

  it("rejects a template without a target value", () => {
    const bad = { name: "x", notes: null, exercises: [{ exerciseId: bench.id, sets: 3, target: "time", reps: null, durationSeconds: null, distanceM: null, restSeconds: 60, supersetGroup: null, notes: null }] };
    expect(templateSchema.safeParse(bad).success).toBe(false);
    expect(templateSchema.safeParse({ ...bad, exercises: [] }).success).toBe(false);
  });
});

describe("exercise library muscle groups", () => {
  it("puts every catalog exercise in at least one muscle group", async () => {
    const { EXERCISES } = await import("@/data/exercises");
    const { MUSCLE_GROUPS, inMuscleGroup } = await import("@/lib/domain/muscle-groups");
    for (const e of EXERCISES) expect(MUSCLE_GROUPS.some((g) => inMuscleGroup(e.primary, g.id)), e.slug).toBe(true);
    expect(inMuscleGroup(["lats", "biceps"], "back")).toBe(true);
    expect(inMuscleGroup(["quadriceps"], "back")).toBe(false);
  });
});
