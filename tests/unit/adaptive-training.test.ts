import { describe, expect, it } from "vitest";
import {
  analyzeTraining,
  applyModification,
  loadIncrementKg,
  repTarget,
  roundLoadKg,
  trainingModifySchema,
  type ReviewInput,
  type ReviewProgram,
  type ReviewWorkout,
} from "@/lib/domain/adaptive-training";
import { primaryRegions, regionShares } from "@/lib/domain/body-regions";
import { addDays } from "@/lib/domain/dates";

const TODAY = "2026-10-22"; // a Thursday
const bench = { slug: "bench-press", name: "Bench Press", primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "front delts"], equipment: ["barbell"] };
const squat = { slug: "back-squat", name: "Back Squat", primaryMuscles: ["quadriceps", "glutes"], secondaryMuscles: ["hamstrings"], equipment: ["barbell"] };

const sets = (n: number, weightKg: number, reps: number, rpe: number | null = null) => Array.from({ length: n }, () => ({ weightKg, reps, rpe }));
const wo = (daysAgo: number, exercises: ReviewWorkout["exercises"]): ReviewWorkout => ({ date: addDays(TODAY, -daysAgo), exercises });

function program(over: Partial<ReviewProgram> = {}): ReviewProgram {
  return {
    programId: "11111111-1111-4111-8111-111111111111",
    name: "Strength Builder",
    editable: true,
    goals: ["build_strength"],
    currentWeek: 6,
    currentDay: 2,
    durationWeeks: 8,
    daysPerWeek: 3,
    startedOn: addDays(TODAY, -40),
    weeks: Array.from({ length: 8 }, (_, i) => ({ weekNumber: i + 1, isDeload: false })),
    upcoming: {
      weekNumber: 7,
      exercises: [
        { id: "pe-1", slug: "bench-press", name: "Bench Press", sets: 3, reps: "5", rpe: 8, primaryMuscles: ["chest"] },
        { id: "pe-2", slug: "back-squat", name: "Back Squat", sets: 3, reps: "5", rpe: 8, primaryMuscles: ["quadriceps", "glutes"] },
      ],
    },
    ...over,
  };
}

function input(over: Partial<ReviewInput> = {}): ReviewInput {
  return { today: TODAY, units: "metric", goal: "build_strength", goalChangedAfterProgramStart: false, workouts: [], program: program(), checkins: [], targets: {}, decided: new Set(), ...over };
}

describe("helpers", () => {
  it("reads rep targets and load steps", () => {
    expect(repTarget("5")).toBe(5);
    expect(repTarget("8-12")).toBe(12);
    expect(repTarget("AMRAP")).toBeNull();
    expect(repTarget(null)).toBeNull();
    expect(loadIncrementKg(primaryRegions(squat.primaryMuscles), ["barbell"], "metric")).toBe(5);
    expect(loadIncrementKg(primaryRegions(bench.primaryMuscles), ["barbell"], "metric")).toBe(2.5);
    expect(loadIncrementKg(["chest"], ["dumbbells"], "metric")).toBe(2);
    expect(roundLoadKg(101.2, "metric")).toBe(100);
    expect(Math.round((roundLoadKg(102.5, "imperial") / 0.45359237) * 10) / 10).toBe(225);
  });

  it("counts a set fully for primary muscles and half for supporting ones", () => {
    const shares = regionShares(bench.primaryMuscles, bench.secondaryMuscles);
    expect(Object.fromEntries(shares)).toEqual({ chest: 1, triceps: 0.5, shoulders: 0.5 });
    expect(Object.fromEntries(regionShares(["chest"], ["chest"]))).toEqual({ chest: 1 });
  });
});

describe("training review", () => {
  it("says what it can't see and suggests nothing without enough data", () => {
    // A program started 10 days ago, one workout logged.
    const r = analyzeTraining(input({ program: program({ startedOn: addDays(TODAY, -10), currentWeek: 2 }), workouts: [wo(2, [{ ...bench, sets: sets(3, 80, 5) }])] }));
    expect(r.recommendations).toEqual([]);
    expect(r.dataGaps.join(" ")).toMatch(/Only 1 logged workout/);
    expect(r.dataGaps.join(" ")).toMatch(/No recovery check-ins/);
  });

  it("suggests the next load when the last two sessions hit every prescribed rep at or under the target RPE", () => {
    const presc = { reps: "5", rpe: 8 };
    const r = analyzeTraining(
      input({
        workouts: [wo(9, [{ ...bench, sets: sets(3, 100, 5, 7.5), prescribed: presc }]), wo(2, [{ ...bench, sets: sets(3, 100, 5, 8), prescribed: presc }])],
      }),
    );
    const rec = r.recommendations.find((x) => x.kind === "progress_load")!;
    expect(rec.change).toEqual({ kind: "exercise_target", exerciseSlug: "bench-press", exerciseName: "Bench Press", weightKg: 102.5, reps: 5 });
    expect(rec.why[0]).toContain("every set at 100 kg reached 5+ reps at RPE 8 or less");

    // A missed rep, an RPE above target, or an existing equal target: no suggestion.
    const missed = analyzeTraining(input({ workouts: [wo(9, [{ ...bench, sets: sets(3, 100, 5), prescribed: presc }]), wo(2, [{ ...bench, sets: [...sets(2, 100, 5), { weightKg: 100, reps: 4, rpe: null }], prescribed: presc }])] }));
    expect(missed.recommendations.filter((x) => x.kind === "progress_load")).toEqual([]);
    const hard = analyzeTraining(input({ workouts: [wo(9, [{ ...bench, sets: sets(3, 100, 5, 9), prescribed: presc }]), wo(2, [{ ...bench, sets: sets(3, 100, 5, 9.5), prescribed: presc }])] }));
    expect(hard.recommendations.filter((x) => x.kind === "progress_load")).toEqual([]);
    const already = analyzeTraining(
      input({ targets: { "bench-press": { weightKg: 102.5, reps: 5 } }, workouts: [wo(9, [{ ...bench, sets: sets(3, 100, 5), prescribed: presc }]), wo(2, [{ ...bench, sets: sets(3, 100, 5), prescribed: presc }])] }),
    );
    expect(already.recommendations.filter((x) => x.kind === "progress_load")).toEqual([]);
  });

  it("flags a stall and suggests a reset to about 90%", () => {
    const workouts = [30, 23, 16, 9, 2].map((d, i) => wo(d, [{ ...squat, sets: sets(3, i === 1 ? 140 : 137.5, 5), prescribed: { reps: "5", rpe: 8 } }]));
    const r = analyzeTraining(input({ workouts }));
    expect(r.lifts.find((l) => l.slug === "back-squat")).toMatchObject({ plateau: true, sessionsSinceBest: 3 });
    const rec = r.recommendations.find((x) => x.kind === "plateau")!;
    expect(rec.change).toMatchObject({ kind: "exercise_target", exerciseSlug: "back-squat", weightKg: 125, reps: 5 });
    expect(rec.why[0]).toMatch(/No new best estimated 1-rep max in the last 3 sessions/);
  });

  it("suggests a recovery week only with evidence, and only for an editable program", () => {
    const presc = { reps: "5", rpe: 7 };
    const workouts = [26, 23, 21, 19, 16, 14, 12, 9, 7, 5, 2].map((d) => wo(d, [{ ...bench, sets: sets(3, 100, 5, 8.5), prescribed: presc }]));
    const lowCheckins = [6, 4, 2, 1].map((d) => ({ date: addDays(TODAY, -d), readiness: 40 }));
    const r = analyzeTraining(input({ workouts, checkins: lowCheckins }));
    const rec = r.recommendations.find((x) => x.kind === "deload")!;
    expect(rec.change).toEqual({ kind: "deload_week", programId: program().programId, weekNumber: 7, setsFactor: 0.6, rpeCap: 7 });
    expect(rec.why.join(" ")).toMatch(/Average readiness 40\/100/);
    expect(rec.why.join(" ")).toMatch(/logged RPE is 1.5 above/);
    expect(rec.confidence).toBe("high");

    // Recent deload: nothing. Library program: advice without a change.
    const recent = analyzeTraining(input({ workouts, checkins: lowCheckins, program: program({ weeks: program().weeks.map((w) => ({ ...w, isDeload: w.weekNumber === 4 })) }) }));
    expect(recent.recommendations.filter((x) => x.kind === "deload")).toEqual([]);
    const library = analyzeTraining(input({ workouts, checkins: lowCheckins, program: program({ editable: false }) })).recommendations.find((x) => x.kind === "deload")!;
    expect(library.change).toBeNull();
    expect(library.blocked).toMatch(/library program/);

    // No signals and only 5 weeks in: no recovery week yet.
    const fine = analyzeTraining(input({ workouts: workouts.map((w) => ({ ...w, exercises: w.exercises.map((e) => ({ ...e, sets: sets(3, 100, 5, 7) })) })) }));
    expect(fine.recommendations.filter((x) => x.kind === "deload")).toEqual([]);
  });

  it("suggests one more set when a trained region is well under the usual range and recovery is fine", () => {
    // Bench once a week, 3 sets: chest ~3 sets/week (range 10–20).
    const workouts = [20, 18, 13, 11, 6, 4].map((d, i) => wo(d, i % 2 ? [{ ...squat, sets: sets(3, 120, 5) }] : [{ ...bench, sets: sets(3, 80, 8) }]));
    const r = analyzeTraining(input({ goal: "build_muscle", workouts }));
    const chest = r.volume.find((v) => v.region === "chest")!;
    expect(chest.status).toBe("below");
    const rec = r.recommendations.find((x) => x.kind === "volume" && x.change?.kind === "volume_change" && x.change.exerciseSlug === "bench-press")!;
    expect(rec.change).toMatchObject({ kind: "volume_change", deltaSets: 1, fromWeek: 7 });
  });

  it("suggests fewer days when many planned sessions are missed, via the schedule preview", () => {
    const workouts = [20, 9].map((d) => wo(d, [{ ...bench, sets: sets(3, 80, 8) }]));
    const r = analyzeTraining(input({ workouts, program: program({ daysPerWeek: 4 }) }));
    const rec = r.recommendations.find((x) => x.kind === "frequency")!;
    expect(rec.change).toBeNull();
    expect(rec.link?.href).toBe("/profile/preferences?days=3#schedule");
    expect(rec.why[0]).toMatch(/2 of about 16 planned sessions/);
  });

  it("notes a changed goal, a low check-in today, and hides recommendations already decided", () => {
    const recent = program({ startedOn: addDays(TODAY, -10) });
    const r = analyzeTraining(input({ program: recent, goal: "build_muscle", goalChangedAfterProgramStart: true, checkins: [{ date: TODAY, readiness: 30 }] }));
    expect(r.recommendations.map((x) => x.kind)).toEqual(["low_readiness", "goal_change"]);
    const decided = analyzeTraining(input({ program: recent, goal: "build_muscle", goalChangedAfterProgramStart: true, checkins: [{ date: TODAY, readiness: 30 }], decided: new Set([`readiness:${TODAY}`]) }));
    expect(decided.recommendations.map((x) => x.kind)).toEqual(["goal_change"]);
  });

  it("applies the member's adjustments within limits", () => {
    const target = { kind: "exercise_target" as const, exerciseSlug: "bench-press", exerciseName: "Bench Press", weightKg: 102.5, reps: 5 };
    expect(applyModification(target, { weight: 225, reps: 3 }, "imperial")).toMatchObject({ weightKg: 102.06, reps: 3 });
    const deload = { kind: "deload_week" as const, programId: "p", weekNumber: 7, setsFactor: 0.6, rpeCap: 7 };
    expect(applyModification(deload, { setsPercent: 50, rpeCap: 6 }, "metric")).toMatchObject({ setsFactor: 0.5, rpeCap: 6 });
    expect(trainingModifySchema.safeParse({ setsPercent: 20 }).success).toBe(false);
    expect(trainingModifySchema.safeParse({ deltaSets: 0 }).success).toBe(false);
    expect(trainingModifySchema.safeParse({ deltaSets: 3 }).success).toBe(false);
    expect(trainingModifySchema.safeParse({ hack: true }).success).toBe(false);
  });
});

describe("logged sleep in the review", () => {
  it("adds an advice-only suggestion after a short week of sleep, and a data gap when none is logged", () => {
    const nights = [0, 1, 2, 3].map((d) => ({ date: addDays(TODAY, -d), asleepMinutes: 390 }));
    const r = analyzeTraining(input({ sleep: { goalMinutes: 480, nights } }));
    const rec = r.recommendations.find((x) => x.kind === "short_sleep")!;
    expect(rec.change).toBeNull();
    expect(rec.why[0]).toBe("Average 6h 30m asleep over 4 logged nights against a 8h goal.");
    expect(rec.link?.href).toBe("/progress/sleep");
    expect(r.recovery.sleep).toEqual({ nights7: 4, avgAsleep7: 390, goalMinutes: 480 });
    expect(r.dataGaps.join(" ")).not.toMatch(/No sleep logged/);

    const none = analyzeTraining(input());
    expect(none.recommendations.some((x) => x.kind === "short_sleep")).toBe(false);
    expect(none.recovery.sleep).toBeNull();
    expect(none.dataGaps.join(" ")).toMatch(/No sleep logged/);

    // Enough sleep: nothing to say.
    const fine = analyzeTraining(input({ sleep: { goalMinutes: 480, nights: nights.map((n) => ({ ...n, asleepMinutes: 470 })) } }));
    expect(fine.recommendations.some((x) => x.kind === "short_sleep")).toBe(false);
  });
});
