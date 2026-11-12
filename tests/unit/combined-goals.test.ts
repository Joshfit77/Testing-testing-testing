import { EXERCISES } from "@/data/exercises";
import { buildCustomProgram, validateCustomInput, type CustomProgramInput } from "@/lib/domain/custom-programs";
import { combineWeek, isHardRun, legLoad, scheduleCombinedWeek, weekdayOf } from "@/lib/domain/combined-goals";
import { EQUIPMENT } from "@/lib/domain/types";

const catalog = EXERCISES.map((e) => ({ slug: e.slug, name: e.name, equipment: e.equipment, pattern: e.pattern, category: e.category, difficulty: e.difficulty, timed: e.timed, lowImpact: e.lowImpact }));
const bySlug = new Map(catalog.map((e) => [e.slug, e]));
const lookup = (slug: string) => bySlug.get(slug);

const base: CustomProgramInput = {
  type: "strength",
  goal: "get_stronger",
  experience: "intermediate",
  daysPerWeek: 3,
  sessionMinutes: 60,
  weeks: 8,
  units: "metric",
  age: 30,
  heightCm: 178,
  bodyweightKg: 80,
  maxesKg: { squat: 140, bench: 100, deadlift: 180, press: 60 },
  cardio: null,
  division: null,
  equipment: [...EQUIPMENT],
};

const circular = (a: number, b: number) => Math.min(Math.abs(a - b), 7 - Math.abs(a - b));

/** Every week: one session per weekday, and no hard run on or next to a heavy leg day. */
function checkSpacing(p: ReturnType<typeof buildCustomProgram>) {
  for (const w of p.weekTemplates!) {
    const days = w.days.map((d) => ({ d, wd: weekdayOf(d.name) }));
    expect(days.every((x) => x.wd !== null), w.focus).toBe(true);
    expect(new Set(days.map((x) => x.wd)).size, w.focus).toBe(days.length);
    const strength = days.filter((x) => !isHardRun(x.d) && legLoad(x.d, lookup) > 0);
    const maxLoad = Math.max(0, ...strength.map((x) => legLoad(x.d, lookup)));
    const heavy = strength.filter((x) => legLoad(x.d, lookup) >= 4 && legLoad(x.d, lookup) >= maxLoad * 0.6 && !x.d.exercises.some((e) => /Combined plan/.test(e.notes ?? "")));
    for (const run of days.filter((x) => isHardRun(x.d)))
      for (const h of heavy) expect(circular(run.wd!, h.wd!), `${w.focus}: ${run.d.name} vs ${h.d.name}`).toBeGreaterThanOrEqual(2);
  }
}

describe("scheduleCombinedWeek", () => {
  it("keeps hard runs two or more days away from heavy leg days", () => {
    const plan = scheduleCombinedWeek([true, false, true, false], [true, false], [false, true])!;
    expect(plan).toHaveLength(6);
    const heavy = plan.filter((s) => s.kind === "strength" && [0, 2].includes(s.index)).map((s) => s.weekday);
    const hardRun = plan.find((s) => s.kind === "run" && s.index === 0)!.weekday;
    for (const h of heavy) expect(circular(hardRun, h)).toBeGreaterThanOrEqual(2);
    // The long run lands on the weekend.
    expect(plan.find((s) => s.kind === "run" && s.index === 1)!.weekday).toBeGreaterThanOrEqual(5);
  });

  it("is deterministic", () => {
    const a = scheduleCombinedWeek([true, true, false], [true, false, false], [false, false, true]);
    const b = scheduleCombinedWeek([true, true, false], [true, false, false], [false, false, true]);
    expect(a).toEqual(b);
  });

  it("returns null when no placement works", () => {
    expect(scheduleCombinedWeek([true, true, true], [true], [false])).toBeNull();
    expect(scheduleCombinedWeek([true, true, true, true, true], [false, false, false], [false, false, false])).toBeNull();
  });

  it("makes the lightest heavy day moderate when three heavy full-body days meet an interval day", () => {
    const heavyDay = (name: string, sets: number) => ({ name, focus: "", minutes: 50, exercises: [{ ex: "back-squat", sets, reps: "5", rest: 180, rpe: 8 }] });
    const runs = [{ name: "Intervals", focus: "", minutes: 40, exercises: [{ ex: "running-intervals", sets: 4, seconds: 180, rest: 120 }] }];
    const week = combineWeek([heavyDay("A", 5), heavyDay("B", 4), heavyDay("C", 5)], runs, lookup);
    expect(week).toHaveLength(4);
    const moderated = week.filter((d) => d.exercises.some((e) => /Combined plan/.test(e.notes ?? "")));
    expect(moderated.map((d) => d.name)).toEqual([expect.stringContaining("B")]);
    expect(moderated[0]!.exercises[0]!.rpe).toBe(7);
  });
});

describe("builder: combined goals", () => {
  it("strength + a 5K: run days from the first-5K template on their own weekdays", () => {
    const p = buildCustomProgram({ ...base, combine: { goal: "5k", days: 3 } }, catalog);
    expect(p.name).toMatch(/\+ Run a 5K/);
    expect(p.days).toHaveLength(6);
    expect(p.goals).toContain("improve_conditioning");
    const names = p.weekTemplates![0]!.days.map((d) => d.name);
    expect(names.filter((n) => /Run/.test(n))).toHaveLength(3);
    expect(p.weekTemplates![0]!.days.flatMap((d) => d.exercises).some((e) => e.ex === "run-walk-intervals" || e.ex === "zone-2-run")).toBe(true);
    // The final (test) week includes the 5K day, still spaced from heavy legs.
    expect(p.weekTemplates!.at(-1)!.days.some((d) => d.exercises.some((e) => /5K day/.test(e.notes ?? "")))).toBe(true);
    checkSpacing(p);
  });

  it("hypertrophy + conditioning: intervals never on or next to a heavy leg day", () => {
    for (const days of [3, 4]) {
      const p = buildCustomProgram({ ...base, type: "bodybuilding", goal: "mass", daysPerWeek: days, weeks: 8, combine: { goal: "conditioning", days: 2 } }, catalog);
      expect(p.weekTemplates![0]!.days.some((d) => isHardRun(d))).toBe(true);
      checkSpacing(p);
    }
  });

  it("is deterministic and keeps session lengths within the choice", () => {
    const a = buildCustomProgram({ ...base, daysPerWeek: 4, combine: { goal: "conditioning", days: 3 } }, catalog);
    const b = buildCustomProgram({ ...base, daysPerWeek: 4, combine: { goal: "conditioning", days: 3 } }, catalog);
    expect(a).toEqual(b);
    for (const w of a.weekTemplates!) for (const d of w.days) expect(d.minutes, d.name).toBeLessThanOrEqual(60);
    checkSpacing(a);
  });

  it("rejects combinations that don't fit a week", () => {
    expect(validateCustomInput({ ...base, daysPerWeek: 5, combine: { goal: "5k", days: 3 } })).toContain("Strength and run days together can't be more than 7 a week");
    expect(validateCustomInput({ ...base, type: "mma", goal: "fight_shape", combine: { goal: "5k", days: 2 } }).join(" ")).toMatch(/strength or bodybuilding/);
  });
});

describe("onboarding second goal", () => {
  it("a 5K second goal turns the starter into a coordinated strength + run week", async () => {
    const { starterProgramInput } = await import("@/lib/domain/starter-program");
    const answers = { goal: "build_strength" as const, experience: "intermediate" as const, daysPerWeek: 4, sessionMinutes: 45, age: 34, heightCm: 178, bodyweightKg: 84, equipment: [...EQUIPMENT], units: "imperial" as const };
    const input = starterProgramInput({ ...answers, secondaryGoal: "run_5k" });
    expect(input.combine).toEqual({ goal: "5k", days: 2 });
    expect(input.daysPerWeek).toBe(2);
    const p = buildCustomProgram(input, catalog);
    expect(p.days).toHaveLength(4);
    expect(p.name).toMatch(/Run a 5K/);
    checkSpacing(p);
    // Too few days to share, or no second goal: a plain starter.
    expect(starterProgramInput({ ...answers, daysPerWeek: 3, secondaryGoal: "run_5k" }).combine).toBeUndefined();
    expect(starterProgramInput(answers).combine).toBeUndefined();
  });
});
