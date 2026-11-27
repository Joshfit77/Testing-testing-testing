import { EXERCISES } from "@/data/exercises";
import { planChanges, planChangeSentence, summarizeDays, summarizeSeed } from "@/lib/domain/plan-preview";
import { buildStarterProgram } from "@/lib/domain/program-generator";
import { EQUIPMENT } from "@/lib/domain/types";

const catalog = EXERCISES.map((e) => ({ slug: e.slug, name: e.name, equipment: e.equipment, pattern: e.pattern, category: e.category, difficulty: e.difficulty, timed: e.timed, lowImpact: e.lowImpact }));

describe("plan preview", () => {
  it("states what changes, e.g. 4 → 3 days, sessions 52 → 61 min", () => {
    const before = summarizeDays("Upper/Lower", [50, 54, 50, 54], 8);
    const after = summarizeDays("Full Body", [61, 60, 62], 8);
    expect(planChangeSentence(before, after)).toBe("4 → 3 days, sessions 52 → 61 min");
    expect(planChanges(before, after).map((c) => [c.key, c.before, c.after])).toEqual([
      ["days", "4", "3"],
      ["minutes", "~52 min", "~61 min"],
      ["program", "Upper/Lower", "Full Body"],
    ]);
    expect(planChangeSentence(before, before)).toBe("Same schedule and session length");
    expect(planChanges(null, after)[0]!.key).toBe("program");
  });

  it("previews a schedule change from the real generator with honest session lengths", () => {
    const answers = { primary_goal: "build_muscle" as const, experience: "intermediate" as const, equipment: [...EQUIPMENT], preferred_types: [] };
    const four = summarizeSeed(buildStarterProgram({ ...answers, days_per_week: 4, session_minutes: 45 }, catalog));
    const three = summarizeSeed(buildStarterProgram({ ...answers, days_per_week: 3, session_minutes: 60 }, catalog));
    expect(four.daysPerWeek).toBe(4);
    expect(three.daysPerWeek).toBe(3);
    expect(four.maxMinutes).toBeLessThanOrEqual(45);
    expect(three.maxMinutes).toBeLessThanOrEqual(60);
    expect(three.minutes).toBeGreaterThan(four.minutes);
    expect(planChangeSentence(four, three)).toMatch(/^4 → 3 days, sessions \d+ → \d+ min$/);
  });
});
