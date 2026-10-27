import { EXERCISES, EXERCISE_SLUGS } from "@/data/exercises";
import {
  buildCustomProgram,
  CUSTOM_PROGRAM_TYPES,
  CUSTOM_TYPES,
  formatLoad,
  percentIntensity,
  planWeeks,
  resolveGoalMaxes,
  resolveMaxes,
  roundLoad,
  weeksRange,
  type CustomProgramInput,
  type CustomProgramType,
} from "@/lib/domain/custom-programs";
import { expandProgram } from "@/lib/domain/program-expansion";
import { isExerciseAvailable, type CatalogExercise } from "@/lib/domain/program-generator";
import { EQUIPMENT, EXPERIENCE_LEVELS, type Equipment } from "@/lib/domain/types";
import { lbToKg } from "@/lib/domain/units";
import { customProgramSchema } from "@/lib/validation/schemas";

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
const FULL_GYM: Equipment[] = [...EQUIPMENT];

function input(type: CustomProgramType, overrides: Partial<CustomProgramInput> = {}): CustomProgramInput {
  const cfg = CUSTOM_TYPES[type];
  const goal = overrides.goal ?? cfg.goals[0]!.id;
  return {
    type,
    goal,
    experience: "intermediate",
    daysPerWeek: cfg.days.default,
    sessionMinutes: cfg.defaultMinutes,
    weeks: weeksRange(type, goal).default,
    units: "imperial",
    age: 30,
    heightCm: 180,
    bodyweightKg: 85,
    maxesKg: {},
    cardio: type === "cardio" ? { modality: "run", continuousMinutes: 5 } : null,
    division: type === "show_prep" ? "classic_physique" : null,
    equipment: FULL_GYM,
    ...overrides,
  };
}

const allExercises = (p: ReturnType<typeof buildCustomProgram>) => (p.weekTemplates ?? []).flatMap((w) => w.days.flatMap((d) => d.exercises));

describe("load rounding", () => {
  it("rounds to 5 lb in imperial and 2.5 kg in metric, never below an empty bar", () => {
    expect(roundLoad(lbToKg(227), "imperial")).toBe(225);
    expect(roundLoad(lbToKg(228), "imperial")).toBe(230);
    expect(roundLoad(101.2, "metric")).toBe(100);
    expect(roundLoad(101.3, "metric")).toBe(102.5);
    expect(roundLoad(5, "metric")).toBe(20);
    expect(roundLoad(5, "imperial")).toBe(45);
    expect(formatLoad(100, "metric")).toBe("100 kg");
  });
  it("formats percentage intensities with the working load", () => {
    // 300 lb max × 75% = 225 lb
    expect(percentIntensity(lbToKg(300), 75, "imperial")).toBe("75% · 225 lb");
    expect(percentIntensity(140, 72.5, "metric")).toBe("72.5% · 102.5 kg");
  });
});

describe("max resolution", () => {
  it("uses Epley for best sets, keeps 1RMs, and ignores lifts the type doesn't use", () => {
    const m = resolveMaxes("powerlifting", {
      squat: { weightKg: 100, reps: 5 },
      bench: { weightKg: 90, reps: 1 },
      deadlift: null,
      press: { weightKg: 60, reps: 1 },
    });
    expect(m.squat).toBeCloseTo(116.67, 1);
    expect(m.bench).toBe(90);
    expect(m.deadlift).toBeUndefined();
    expect(m.press).toBeUndefined();
  });
  it("keeps only plausible goal maxes above the current max", () => {
    expect(resolveGoalMaxes("bench", { bench: 110 }, { bench: 100 })).toEqual({ bench: 110 });
    expect(resolveGoalMaxes("bench", { bench: 90 }, { bench: 100 })).toEqual({});
    expect(resolveGoalMaxes("bench", { bench: 400 }, { bench: 100 })).toEqual({});
  });
});

describe("week planning", () => {
  it("ends non-peaking blocks with a deload and deloads every 4–6 weeks", () => {
    for (const total of [4, 6, 8, 12, 16]) {
      for (const run of [3, 4]) {
        const kinds = planWeeks(total, false, run);
        expect(kinds).toHaveLength(total);
        expect(kinds.at(-1)).toBe("deload");
        let streak = 0;
        for (const k of kinds) {
          streak = k === "deload" ? 0 : streak + 1;
          expect(streak).toBeLessThanOrEqual(run + 2);
        }
      }
    }
  });
  it("ends peaking blocks with a peak and a test week", () => {
    const kinds = planWeeks(12, true, 4);
    expect(kinds.slice(-2)).toEqual(["peak", "test"]);
    expect(kinds).toContain("deload");
    expect(kinds.indexOf("build")).toBeGreaterThan(kinds.indexOf("base"));
  });
});

describe("custom program builder", () => {
  // Exhaustive sweep: ~1.5 s locally, but well over the 5 s default on a busy 2-core CI runner.
  it("builds a valid program for every type × experience × goal", () => {
    for (const type of CUSTOM_PROGRAM_TYPES) {
      const cfg = CUSTOM_TYPES[type];
      for (const experience of EXPERIENCE_LEVELS) {
        for (const goal of cfg.goals) {
          for (const days of [cfg.days.min, cfg.days.max]) {
            const wr = weeksRange(type, goal.id);
            const p = buildCustomProgram(
              input(type, { experience, goal: goal.id, daysPerWeek: days, weeks: wr.default, maxesKg: { squat: 140, bench: 100, deadlift: 180, press: 60 } }),
              catalog,
            );
            const label = `${type}/${experience}/${goal.id}/${days}d`;
            expect(p.weeks, label).toBe(wr.default);
            expect(p.weekTemplates, label).toHaveLength(p.weeks);
            expect(p.days, label).toHaveLength(days);
            expect(p.tier).toBe("free");
            expect(p.name.length).toBeLessThanOrEqual(120);
            for (const w of p.weekTemplates!) {
              expect(w.days, label).toHaveLength(days);
              for (const d of w.days) {
                expect(d.exercises.length, `${label} ${d.name}`).toBeGreaterThanOrEqual(1);
                expect(d.minutes).toBeGreaterThanOrEqual(5);
                expect(d.minutes).toBeLessThanOrEqual(240);
                expect(d.name.length).toBeLessThanOrEqual(120);
                for (const ex of d.exercises) {
                  expect(EXERCISE_SLUGS.has(ex.ex), `${label}: ${ex.ex}`).toBe(true);
                  expect(Boolean(ex.reps) || Boolean(ex.seconds), `${label}: ${ex.ex}`).toBe(true);
                  // Database constraints on program_exercises.
                  expect(ex.sets).toBeGreaterThanOrEqual(1);
                  expect(ex.sets).toBeLessThanOrEqual(20);
                  expect(ex.rest).toBeGreaterThanOrEqual(0);
                  expect(ex.rest).toBeLessThanOrEqual(900);
                  if (ex.reps) expect(ex.reps.length, ex.reps).toBeLessThanOrEqual(20);
                  if (ex.seconds) expect(ex.seconds).toBeGreaterThanOrEqual(5);
                  if (ex.seconds) expect(ex.seconds).toBeLessThanOrEqual(7200);
                  if (ex.intensity) expect(ex.intensity.length).toBeLessThanOrEqual(60);
                  if (ex.notes) expect(ex.notes.length).toBeLessThanOrEqual(500);
                  if (ex.rpe != null) expect(ex.rpe).toBeGreaterThanOrEqual(1);
                  if (ex.rpe != null) expect(ex.rpe).toBeLessThanOrEqual(10);
                }
                expect(new Set(d.exercises.map((e) => e.ex)).size, `${label} ${d.name} duplicates`).toBe(d.exercises.length);
              }
            }
            // Expansion uses the explicit weeks verbatim.
            const expanded = expandProgram(p);
            expect(expanded).toHaveLength(p.weeks);
            expect(expanded.map((w) => w.weekNumber)).toEqual(Array.from({ length: p.weeks }, (_, i) => i + 1));
          }
        }
      }
    }
  }, 30_000);

  it("is deterministic", () => {
    const a = buildCustomProgram(input("powerlifting", { maxesKg: { squat: 150, bench: 100, deadlift: 190 } }), catalog);
    const b = buildCustomProgram(input("powerlifting", { maxesKg: { squat: 150, bench: 100, deadlift: 190 } }), catalog);
    expect(a).toEqual(b);
  });

  it("prescribes percentage loads in the user's units when a max is known", () => {
    const lb = buildCustomProgram(input("bench", { maxesKg: { bench: lbToKg(300) }, units: "imperial" }), catalog);
    const firstBench = lb.weekTemplates![0]!.days[0]!.exercises[0]!;
    expect(firstBench.ex).toBe("bench-press");
    expect(firstBench.intensity).toBe("70% · 210 lb");
    expect(firstBench.rpe).toBeUndefined();

    const kg = buildCustomProgram(input("bench", { maxesKg: { bench: 100 }, units: "metric" }), catalog);
    const firstKg = kg.weekTemplates![0]!.days[0]!.exercises[0]!;
    expect(firstKg.intensity).toBe("70% · 70 kg");
    for (const ex of allExercises(kg)) {
      if (!ex.intensity) continue;
      const m = ex.intensity.match(/· ([\d.]+) kg$/);
      expect(m, ex.intensity).not.toBeNull();
      expect(Number(m![1]) % 2.5).toBe(0);
    }
    for (const ex of allExercises(lb)) {
      if (!ex.intensity) continue;
      const m = ex.intensity.match(/· (\d+) lb$/);
      expect(m, ex.intensity).not.toBeNull();
      expect(Number(m![1]) % 5).toBe(0);
    }
  });

  it("progresses the main lift through the block and changes week to week", () => {
    const p = buildCustomProgram(input("squat", { goal: "increase_1rm", maxesKg: { squat: 150 }, units: "metric", weeks: 8 }), catalog);
    const pct = (w: number) => Number(p.weekTemplates![w]!.days[0]!.exercises[0]!.intensity?.match(/^([\d.]+)%/)?.[1] ?? NaN);
    expect(pct(1)).toBeGreaterThan(pct(0));
    expect(pct(4)).toBeGreaterThan(pct(1));
    expect(p.weekTemplates![0]!.days[0]!.exercises[0]!).not.toEqual(p.weekTemplates![4]!.days[0]!.exercises[0]!);
  });

  it("falls back to RPE when no max is entered", () => {
    const p = buildCustomProgram(input("powerlifting", { maxesKg: {} }), catalog);
    const main = p.weekTemplates![0]!.days[0]!.exercises[0]!;
    expect(main.intensity).toBeUndefined();
    expect(main.rpe).toBeGreaterThan(0);
    expect(allExercises(p).some((e) => e.intensity?.includes("%"))).toBe(false);
  });

  it("includes heavy-day warm-up guidance with loads", () => {
    const p = buildCustomProgram(input("deadlift", { goal: "increase_1rm", maxesKg: { deadlift: 200 }, units: "metric" }), catalog);
    const heavy = p.weekTemplates!.flatMap((w) => w.days[0]!.exercises.filter((e) => e.ex === "conventional-deadlift"));
    expect(heavy.some((e) => e.notes?.startsWith("Warm-up: bar (20 kg)"))).toBe(true);
  });

  it("deloads non-peaking blocks and peaks/tests peaking ones", () => {
    const off = buildCustomProgram(input("powerlifting", { goal: "build_total", weeks: 12, maxesKg: { squat: 150 } }), catalog);
    expect(off.weekTemplates!.at(-1)!.isDeload).toBe(true);
    expect(off.weekTemplates!.filter((w) => w.isDeload).length).toBeGreaterThanOrEqual(2);
    const deloadSquat = off.weekTemplates!.at(-1)!.days[0]!.exercises[0]!;
    const week1Squat = off.weekTemplates![0]!.days[0]!.exercises[0]!;
    expect(deloadSquat.sets).toBeLessThan(week1Squat.sets);

    const meet = buildCustomProgram(input("powerlifting", { goal: "meet_prep", weeks: 12, maxesKg: { squat: 150, bench: 100, deadlift: 200 } }), catalog);
    expect(meet.weekTemplates!.at(-2)!.focus).toMatch(/^Peak/);
    expect(meet.weekTemplates!.at(-1)!.focus).toMatch(/Meet week/);
    const testSquat = meet.weekTemplates!.at(-1)!.days[0]!.exercises[0]!;
    expect(testSquat.reps).toBe("1");
    expect(testSquat.notes).toMatch(/Attempts/);
    expect(meet.deloadFinalWeek).toBe(false);
  });

  it("tapers MMA fight camps and show prep, with the coach note for show prep", () => {
    const fight = buildCustomProgram(input("mma", { goal: "fight_camp", weeks: 8 }), catalog);
    expect(fight.weekTemplates!.at(-1)!.focus).toMatch(/Fight week taper/);
    const bagRounds = (w: number) => fight.weekTemplates![w]!.days[1]!.exercises.find((e) => e.ex === "heavy-bag-rounds")!;
    expect(bagRounds(fight.weeks - 1).sets).toBeLessThan(bagRounds(fight.weeks - 2).sets);

    const show = buildCustomProgram(input("show_prep", { weeks: 16, division: "bikini" }), catalog);
    expect(show.description).toMatch(/qualified coach/);
    expect(show.description).not.toMatch(/dehydrat(e|ion) (to|for)/i);
    expect(show.weekTemplates!.at(-1)!.focus).toMatch(/Show week taper/);
    expect(show.weekTemplates!.some((w) => w.days.some((d) => d.cooldown?.some((c) => c.includes("Posing practice"))))).toBe(true);
    const cardioMins = (w: number) =>
      show.weekTemplates![w]!.days.flatMap((d) => d.exercises).filter((e) => e.ex === "brisk-walk" || e.ex === "bike-intervals").reduce((s, e) => s + (e.seconds ?? 0), 0);
    expect(cardioMins(12)).toBeGreaterThan(cardioMins(0));
  });

  it("progresses a beginner from run/walk to continuous running for a first 5K", () => {
    const p = buildCustomProgram(input("cardio", { goal: "first_5k", weeks: 8, experience: "new", cardio: { modality: "run", continuousMinutes: 0 } }), catalog);
    expect(p.weekTemplates![0]!.days[0]!.exercises[0]!.ex).toBe("run-walk-intervals");
    const last = p.weekTemplates!.at(-1)!;
    expect(last.days.some((d) => d.exercises.some((e) => e.ex === "zone-2-run" && e.seconds === 1800))).toBe(true);
  });

  it("uses sprint, plyometric and change-of-direction work for speed and agility with full recovery", () => {
    const speed = buildCustomProgram(input("speed", { experience: "advanced" }), catalog);
    const speedSlugs = new Set(allExercises(speed).map((e) => e.ex));
    for (const s of ["acceleration-sprint", "flying-sprint", "a-skip", "pogo-jumps"]) expect(speedSlugs.has(s), s).toBe(true);
    for (const e of allExercises(speed).filter((x) => x.ex.endsWith("sprint"))) expect(e.rest).toBeGreaterThanOrEqual(120);

    const agility = buildCustomProgram(input("agility"), catalog);
    const agilitySlugs = new Set(allExercises(agility).map((e) => e.ex));
    for (const s of ["pro-agility-shuttle", "t-drill", "agility-ladder-drills", "reactive-mirror-drill"]) expect(agilitySlugs.has(s), s).toBe(true);
  });

  it("never uses equipment the user doesn't have", () => {
    for (const type of CUSTOM_PROGRAM_TYPES) {
      for (const owned of [[], ["dumbbell", "bench"], ["kettlebell", "band"]] as Equipment[][]) {
        const p = buildCustomProgram(input(type, { equipment: owned, maxesKg: { squat: 140, bench: 100, deadlift: 180, press: 60 } }), catalog);
        for (const ex of allExercises(p)) {
          expect(isExerciseAvailable(bySlug.get(ex.ex)!, owned), `${type} [${owned.join(",")}]: ${ex.ex}`).toBe(true);
          // Percentages only apply to the barbell lifts they were calculated for.
          if (ex.intensity?.includes("%")) expect(bySlug.get(ex.ex)!.equipment).toContain("barbell");
        }
        for (const e of p.equipment) expect([...owned, "bodyweight"]).toContain(e);
      }
    }
  });

  it("substitutes strongman implements when they aren't available", () => {
    const withTools = buildCustomProgram(input("strongman"), catalog);
    expect(allExercises(withTools).some((e) => e.ex === "log-press")).toBe(true);
    const without = buildCustomProgram(input("strongman", { equipment: FULL_GYM.filter((e) => e !== "strongman_implements") }), catalog);
    expect(allExercises(without).some((e) => ["log-press", "yoke-carry", "atlas-stone-load"].includes(e.ex))).toBe(false);
    expect(allExercises(without).some((e) => e.ex === "push-press")).toBe(true);
  });

  it("only picks exercises present in the given catalog", () => {
    const small = catalog.filter((e) => !["paused-bench-press", "pin-press", "close-grip-bench-press"].includes(e.slug));
    const p = buildCustomProgram(input("bench", { maxesKg: { bench: 100 } }), small);
    const slugs = new Set(allExercises(p).map((e) => e.ex));
    expect(slugs.has("paused-bench-press")).toBe(false);
    expect(slugs.has("bench-press")).toBe(true);
  });

  it("scales volume with experience", () => {
    const novice = buildCustomProgram(input("powerlifting", { experience: "beginner" }), catalog);
    const advanced = buildCustomProgram(input("powerlifting", { experience: "advanced" }), catalog);
    const sets = (p: typeof novice) => p.weekTemplates![0]!.days[0]!.exercises[0]!.sets;
    expect(sets(advanced)).toBeGreaterThan(sets(novice));
    // Novices deload more often.
    expect(novice.weekTemplates!.filter((w) => w.isDeload).length).toBeGreaterThanOrEqual(advanced.weekTemplates!.filter((w) => w.isDeload).length);
  });

  it("rejects invalid combinations", () => {
    expect(() => buildCustomProgram(input("speed", { daysPerWeek: 6 }), catalog)).toThrow();
    expect(() => buildCustomProgram(input("bench", { goal: "first_5k" }), catalog)).toThrow();
    expect(() => buildCustomProgram(input("strength", { age: 16 }), catalog)).toThrow();
  });
});

describe("custom program schema", () => {
  const valid = {
    type: "bench",
    goal: "increase_1rm",
    experience: "intermediate",
    daysPerWeek: 4,
    sessionMinutes: 60,
    weeks: 8,
    age: 30,
    heightCm: 180,
    weightKg: 85,
    lifts: { bench: { weightKg: 100, reps: 3 } },
    goalLifts: { bench: 110 },
    cardio: null,
    division: null,
    equipment: ["barbell", "bench", "rack"],
  };
  it("accepts a valid build", () => {
    expect(customProgramSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects under-18 users", () => {
    const r = customProgramSchema.safeParse({ ...valid, age: 17 });
    expect(r.success).toBe(false);
    expect(r.error!.issues.some((i) => i.path[0] === "age")).toBe(true);
  });
  it("enforces type-specific ranges and goals", () => {
    expect(customProgramSchema.safeParse({ ...valid, daysPerWeek: 2 }).success).toBe(false);
    expect(customProgramSchema.safeParse({ ...valid, weeks: 20 }).success).toBe(false);
    expect(customProgramSchema.safeParse({ ...valid, goal: "fight_camp" }).success).toBe(false);
    expect(customProgramSchema.safeParse({ ...valid, type: "show_prep", goal: "first_show", daysPerWeek: 5, weeks: 16 }).success).toBe(false);
    expect(customProgramSchema.safeParse({ ...valid, type: "show_prep", goal: "first_show", daysPerWeek: 5, weeks: 16, division: "bikini" }).success).toBe(true);
  });
  it("rejects implausible lift entries", () => {
    expect(customProgramSchema.safeParse({ ...valid, lifts: { bench: { weightKg: 900, reps: 1 } } }).success).toBe(false);
    expect(customProgramSchema.safeParse({ ...valid, lifts: { bench: { weightKg: 100, reps: 20 } } }).success).toBe(false);
    expect(customProgramSchema.safeParse({ ...valid, equipment: ["spaceship"] }).success).toBe(false);
  });
});
