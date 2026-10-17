import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { buildCustomProgram } from "@/lib/domain/custom-programs";
import { expandProgram } from "@/lib/domain/program-expansion";
import type { CatalogExercise } from "@/lib/domain/program-generator";
import { EQUIPMENT_PRESETS } from "@/lib/domain/equipment-presets";
import { STARTER_PROGRAM, starterProgramInput } from "@/lib/domain/starter-program";
import { EQUIPMENT, EXPERIENCE_LEVELS, PRIMARY_GOALS, type Equipment } from "@/lib/domain/types";

const catalog: CatalogExercise[] = EXERCISES.map((e) => ({
  slug: e.slug, name: e.name, equipment: e.equipment, pattern: e.pattern, category: e.category,
  difficulty: e.difficulty, timed: e.timed, lowImpact: e.lowImpact,
}));
const SETUPS: Equipment[][] = [[...EQUIPMENT], ...EQUIPMENT_PRESETS.map((p) => p.items), []];

describe("starter program from onboarding answers", () => {
  it("covers every main goal", () => {
    expect(Object.keys(STARTER_PROGRAM).sort()).toEqual([...PRIMARY_GOALS].sort());
  });
  for (const goal of PRIMARY_GOALS)
    for (const experience of EXPERIENCE_LEVELS)
      for (const days of [2, 4, 6])
        for (const equipment of SETUPS)
          it(`builds ${goal} / ${experience} / ${days} days / ${equipment.length || "bodyweight"} equipment`, () => {
            const input = starterProgramInput({ goal, experience, daysPerWeek: days, sessionMinutes: 45, age: 34, heightCm: 175, bodyweightKg: 82, equipment, units: "imperial" });
            const seed = buildCustomProgram(input, catalog);
            const weeks = expandProgram(seed);
            expect(weeks.length).toBe(input.weeks);
            expect(weeks[0]?.days.length).toBe(input.daysPerWeek);
            for (const d of weeks[0]?.days ?? []) expect(d.exercises.length).toBeGreaterThan(0);
          });
});
