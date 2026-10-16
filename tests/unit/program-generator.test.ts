import { EXERCISES } from "@/data/exercises";
import { PROGRAMS } from "@/data/programs";
import { buildStarterProgram, chooseSplit, isExerciseAvailable, recommendPrograms, type CatalogExercise } from "@/lib/domain/program-generator";
import type { GeneratorAnswers } from "@/lib/domain/program-generator";

const catalog: CatalogExercise[] = EXERCISES.map((e) => ({
  slug: e.slug,
  name: e.name,
  equipment: e.equipment,
  pattern: e.pattern,
  category: e.category,
  difficulty: e.difficulty,
  timed: e.timed,
  lowImpact: e.lowImpact,
}));
const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));

const base: GeneratorAnswers = {
  primary_goal: "build_strength",
  experience: "intermediate",
  days_per_week: 4,
  session_minutes: 60,
  equipment: ["barbell", "rack", "bench", "dumbbell", "pull_up_bar", "cable", "machine"],
  preferred_types: ["strength"],
};

describe("equipment availability", () => {
  it("requires a main implement", () => {
    expect(isExerciseAvailable({ equipment: ["barbell", "bench", "rack"] }, ["bench"])).toBe(false);
    expect(isExerciseAvailable({ equipment: ["barbell", "bench", "rack"] }, ["barbell"])).toBe(true);
    expect(isExerciseAvailable({ equipment: ["dumbbell", "kettlebell"] }, ["kettlebell"])).toBe(true);
    expect(isExerciseAvailable({ equipment: ["bodyweight"] }, [])).toBe(true);
    expect(isExerciseAvailable({ equipment: ["mat"] }, [])).toBe(true);
  });
});

describe("starter program generator", () => {
  it("chooses splits by days and goal", () => {
    expect(chooseSplit({ ...base, days_per_week: 2 })).toEqual(["full", "full"]);
    expect(chooseSplit({ ...base, days_per_week: 4 })).toEqual(["upper", "lower", "upper", "lower"]);
    expect(chooseSplit({ ...base, days_per_week: 3, primary_goal: "combat_sports" })).toContain("conditioning");
    expect(chooseSplit({ ...base, days_per_week: 9 })).toHaveLength(6);
  });

  it("only uses available exercises at or below the user's experience", () => {
    const answers: GeneratorAnswers = { ...base, experience: "new", equipment: [], days_per_week: 3, session_minutes: 30 };
    const program = buildStarterProgram(answers, catalog);
    expect(program.days).toHaveLength(3);
    for (const d of program.days) {
      expect(d.exercises.length).toBeGreaterThanOrEqual(3);
      for (const ex of d.exercises) {
        const e = bySlug.get(ex.ex)!;
        expect(e.difficulty).toBe("beginner");
        expect(isExerciseAvailable(e, [])).toBe(true);
      }
    }
  });

  it("respects low-impact preference", () => {
    const program = buildStarterProgram({ ...base, preferred_types: ["low_impact"], primary_goal: "improve_conditioning", days_per_week: 3 }, catalog);
    for (const d of program.days) for (const ex of d.exercises) expect(bySlug.get(ex.ex)!.category).not.toBe("plyometric");
  });

  it("uses heavier schemes for strength goals and is deterministic", () => {
    const a = buildStarterProgram(base, catalog);
    const b = buildStarterProgram(base, catalog);
    expect(a).toEqual(b);
    const first = a.days[0]!.exercises[0]!;
    expect(first.reps).toBe("4-6");
    expect(a.deloadFinalWeek).toBe(true);
  });

  it("prefers loaded, experience-appropriate lifts for strength goals", () => {
    const p = buildStarterProgram({ ...base, days_per_week: 3, equipment: ["barbell", "rack", "bench", "dumbbell", "pull_up_bar"] }, catalog);
    const squat = p.days[0]!.exercises[0]!;
    const e = bySlug.get(squat.ex)!;
    expect(e.pattern).toBe("squat");
    expect(e.equipment.some((x) => ["barbell", "dumbbell", "kettlebell"].includes(x))).toBe(true);
    expect(e.difficulty).not.toBe("beginner");
  });

  it("varies exercises across repeated day types", () => {
    const p = buildStarterProgram(base, catalog);
    const upperA = p.days[0]!.exercises.map((e) => e.ex);
    const upperB = p.days[2]!.exercises.map((e) => e.ex);
    expect(upperA).not.toEqual(upperB);
  });
});

describe("program recommendations", () => {
  it("ranks goal + equipment matches first and marks locked tiers", () => {
    const recs = recommendPrograms(
      { ...base, primary_goal: "mobility", equipment: [], preferred_types: ["mobility", "low_impact"], experience: "new", days_per_week: 4 },
      PROGRAMS,
      "free",
    );
    expect(recs[0]!.slug).toBe("daily-mobility-flow");
    expect(recs[0]!.locked).toBe(false);
    expect(recs.find((r) => r.slug === "powerlifting-base-block")!.locked).toBe(true);
  });
});
