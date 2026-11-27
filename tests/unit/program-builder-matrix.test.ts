import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { buildCustomProgram, CUSTOM_PROGRAM_TYPES, CUSTOM_TYPES, weeksRange, type CustomProgramInput, type CustomProgramType } from "@/lib/domain/custom-programs";
import { AUDIT_MUSCLES, auditProgram } from "@/lib/domain/program-audit";
import { BEGINNER_MAX_RPE, expandProgram } from "@/lib/domain/program-expansion";
import { isExerciseAvailable, type CatalogExercise } from "@/lib/domain/program-generator";
import { EQUIPMENT, EXPERIENCE_LEVELS, type Equipment, type ExperienceLevel } from "@/lib/domain/types";

/**
 * "Build my program" over the whole matrix (audit 2026-11-14): every type × goal × experience × equipment preset ×
 * days-per-week the form allows — 2,440 plans. Each rule collects the plans that break it.
 */
const catalog: CatalogExercise[] = EXERCISES.map((e) => ({ slug: e.slug, name: e.name, equipment: e.equipment, pattern: e.pattern, category: e.category, difficulty: e.difficulty, timed: e.timed, lowImpact: e.lowImpact }));
const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));
const PRESETS: Record<string, Equipment[]> = {
  none: [],
  dumbbells: ["dumbbell", "bench"],
  home: ["dumbbell", "bench", "band", "pull_up_bar", "kettlebell", "mat"],
  barbell: ["barbell", "rack", "bench", "pull_up_bar"],
  full: [...EQUIPMENT],
};

function inputFor(type: CustomProgramType, goal: string, experience: ExperienceLevel, equipment: Equipment[], days: number): CustomProgramInput {
  const cfg = CUSTOM_TYPES[type];
  return {
    type,
    goal,
    experience,
    daysPerWeek: days,
    sessionMinutes: cfg.defaultMinutes,
    weeks: weeksRange(type, goal).default,
    units: "imperial",
    age: 30,
    heightCm: 178,
    bodyweightKg: 80,
    maxesKg: {},
    cardio: type === "cardio" ? { modality: "run", continuousMinutes: 5 } : null,
    division: type === "show_prep" ? "classic_physique" : null,
    equipment,
  };
}

interface Result {
  combos: number;
  problems: Record<string, string[]>;
  noviceAdvancedTypes: Set<string>;
  maxWeeklySets: { novice: number; other: number };
  maxSessionSets: { novice: number; other: number };
}

function runMatrix(): Result {
  const problems: Record<string, string[]> = { threw: [], weeks: [], days: [], missing: [], equipment: [], listedEquipment: [], rpe: [], empty: [], restDay: [], noviceAdvanced: [] };
  const noviceAdvancedTypes = new Set<string>();
  const maxWeeklySets = { novice: 0, other: 0 };
  const maxSessionSets = { novice: 0, other: 0 };
  let combos = 0;
  for (const type of CUSTOM_PROGRAM_TYPES) {
    const cfg = CUSTOM_TYPES[type];
    for (const goal of cfg.goals)
      for (const experience of EXPERIENCE_LEVELS)
        for (const [preset, equipment] of Object.entries(PRESETS))
          for (let days = cfg.days.min; days <= cfg.days.max; days++) {
            combos++;
            const label = `${type}/${goal.id}/${experience}/${preset}/${days}d`;
            const novice = experience === "new" || experience === "beginner";
            const input = inputFor(type, goal.id, experience, equipment, days);
            let p;
            try {
              p = buildCustomProgram(input, catalog);
            } catch (e) {
              problems.threw!.push(`${label}: ${(e as Error).message}`);
              continue;
            }
            const weeks = expandProgram(p);
            if (weeks.length !== input.weeks) problems.weeks!.push(label);
            if (days > 6) problems.restDay!.push(label);
            for (const q of p.equipment) if (q !== "bodyweight" && !equipment.includes(q)) problems.listedEquipment!.push(`${label}: lists ${q}`);
            for (const w of weeks) {
              if (w.days.length !== days) problems.days!.push(`${label} w${w.weekNumber}: ${w.days.length} days`);
              for (const d of w.days) {
                if (!d.exercises.length) problems.empty!.push(`${label} w${w.weekNumber} ${d.name}`);
                const sets = d.exercises.reduce((n, e) => n + e.sets, 0);
                const k = novice ? "novice" : "other";
                maxSessionSets[k] = Math.max(maxSessionSets[k], sets);
                for (const e of d.exercises) {
                  const def = bySlug.get(e.ex);
                  if (!def) {
                    problems.missing!.push(`${label}: ${e.ex}`);
                    continue;
                  }
                  if (!isExerciseAvailable(def, equipment)) problems.equipment!.push(`${label}: ${e.ex}`);
                  if (p.difficulty === "beginner" && (e.rpe ?? 0) > BEGINNER_MAX_RPE) problems.rpe!.push(`${label}: ${e.ex} RPE ${e.rpe}`);
                  if (novice && def.difficulty === "advanced") {
                    noviceAdvancedTypes.add(type);
                    if (type !== "strongman") problems.noviceAdvanced!.push(`${label}: ${e.ex}`);
                  }
                }
              }
            }
            const k = novice ? "novice" : "other";
            for (const w of auditProgram(p).weeks) for (const m of AUDIT_MUSCLES) maxWeeklySets[k] = Math.max(maxWeeklySets[k], w.setsByMuscle[m]);
          }
  }
  return { combos, problems, noviceAdvancedTypes, maxWeeklySets, maxSessionSets };
}

describe("custom program builder: goals × experience × equipment × days", () => {
  const r = runMatrix();

  it("builds all 2,440 combinations without an error, with the weeks and days asked for", () => {
    expect(r.combos).toBe(2440);
    expect(r.problems.threw).toEqual([]);
    expect(r.problems.weeks).toEqual([]);
    expect(r.problems.days).toEqual([]);
    expect(r.problems.empty).toEqual([]);
  });

  it("uses only exercises that exist and that the member's equipment can do, and lists only equipment they own", () => {
    expect(r.problems.missing).toEqual([]);
    expect(r.problems.equipment).toEqual([]);
    expect(r.problems.listedEquipment).toEqual([]);
  });

  it("never asks a beginner for more than RPE 8.5", () => {
    expect(r.problems.rpe).toEqual([]);
  });

  it("gives new and beginner lifters no advanced-rated movement, except strongman events (the events are the point)", () => {
    expect(r.problems.noviceAdvanced).toEqual([]);
    expect([...r.noviceAdvancedTypes]).toEqual(["strongman"]);
  });

  it("never fills all seven days on its own: the form allows at most six sessions a week", () => {
    expect(r.problems.restDay).toEqual([]);
    expect(Math.max(...CUSTOM_PROGRAM_TYPES.map((t) => CUSTOM_TYPES[t].days.max))).toBeLessThanOrEqual(6);
  });

  it("keeps volume in a sane range (measured maxima, pinned so a change is noticed)", () => {
    // Weekly hard sets for the busiest audited group (glutes+hamstrings and lats+upper back each count as one group)
    // and the most sets in any one session. Today: 25.5 / 28 weekly, and well under 40 sets a session.
    expect(r.maxWeeklySets.novice).toBeLessThanOrEqual(26);
    expect(r.maxWeeklySets.other).toBeLessThanOrEqual(30);
    expect(r.maxSessionSets.novice).toBeLessThanOrEqual(26);
    expect(r.maxSessionSets.other).toBeLessThanOrEqual(40);
  });
});

describe("custom program builder: known limits (open findings, pinned)", () => {
  const exercises = (p: ReturnType<typeof buildCustomProgram>) => expandProgram(p).flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => ({ day: d.name, ...e }))));

  it("B-2: a barbell-specialist plan without a barbell keeps heavy low-rep work on substitutes", () => {
    // Reported, not fixed (needs a coach's rule): a bench "meet prep" for a new lifter with dumbbells ends in a
    // "Meet Day" of dumbbell-bench singles. This pins today's output so the finding stays visible until it is decided.
    const p = buildCustomProgram(inputFor("bench", "meet_prep", "new", ["dumbbell", "bench"], 3), catalog);
    const meetDay = exercises(p).filter((e) => /^Meet Day/.test(e.day));
    expect(meetDay.map((e) => `${e.ex} ${e.sets}x${e.reps}`)).toEqual(["dumbbell-bench-press 3x1"]);
  });

  it("B-3: a combined strength + run plan may fill all seven days", () => {
    const p = buildCustomProgram({ ...inputFor("strength", CUSTOM_TYPES.strength.goals[0]!.id, "intermediate", [...EQUIPMENT], 4), weeks: 8, combine: { goal: "5k", days: 3 } }, catalog);
    expect(expandProgram(p).every((w) => w.days.length === 7)).toBe(true);
  });
});
