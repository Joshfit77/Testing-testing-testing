import { EXERCISES } from "@/data/exercises";
import {
  BODYBUILDING_WEEKLY_SETS,
  buildCustomProgram,
  CUSTOM_TYPES,
  hardSetsByMuscle,
  MAJOR_MUSCLES,
  MMA_SC_PREFIX,
  SPECIALIZATION_BONUS,
  STRONGMAN_MOVING_EVENTS,
  weeksRange,
  type CustomProgramInput,
  type CustomProgramType,
} from "@/lib/domain/custom-programs";
import { isExerciseAvailable, type CatalogExercise } from "@/lib/domain/program-generator";
import { EQUIPMENT, EXPERIENCE_LEVELS, type Equipment } from "@/lib/domain/types";

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
const FULL: Equipment[] = [...EQUIPMENT];
const NO_IMPLEMENTS = FULL.filter((e) => e !== "strongman_implements");

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
    bodyweightKg: 90,
    maxesKg: {},
    cardio: null,
    division: type === "show_prep" ? "classic_physique" : null,
    equipment: FULL,
    ...overrides,
  };
}

const IMPLEMENT_EVENTS = new Set(["yoke-carry", "strongman-farmers-walk", "keg-carry", "sled-drag", "zercher-carry", "trap-bar-carry", "sandbag-bear-hug-carry", "arm-over-arm-sled-pull"]);
const MOVING = new Set<string>(Object.values(STRONGMAN_MOVING_EVENTS).flat());
/** A moving event: one of the event options, prescribed as a distance. */
const isMovingEvent = (e: { ex: string; reps?: string }) => MOVING.has(e.ex) && /^\d+ (ft|m)$/.test(e.reps ?? "");

describe("strongman", () => {
  it("has max-effort static days and an event day with ≥2 moving events prescribed by distance", () => {
    for (const experience of EXPERIENCE_LEVELS)
      for (const days of [3, 4, 5])
        for (const goal of CUSTOM_TYPES.strongman.goals) {
          const p = buildCustomProgram(input("strongman", { experience, daysPerWeek: days, goal: goal.id }), catalog);
          const label = `${experience}/${days}d/${goal.id}`;
          const week1 = p.weekTemplates![0]!;
          expect(week1.days.some((d) => d.name.startsWith("Max Effort — Overhead")), label).toBe(true);
          expect(week1.days.some((d) => d.name.startsWith("Max Effort — Deadlift")), label).toBe(true);
          const eventDays = week1.days.filter((d) => d.name.startsWith("Event Day"));
          expect(eventDays.length, label).toBeGreaterThanOrEqual(days === 5 ? 2 : 1);
          const moving = eventDays.flatMap((d) => d.exercises).filter(isMovingEvent);
          for (const e of eventDays.flatMap((d) => d.exercises)) if (IMPLEMENT_EVENTS.has(e.ex)) expect(isMovingEvent(e), `${label} ${e.ex}`).toBe(true);
          expect(new Set(moving.map((e) => e.ex)).size, label).toBeGreaterThanOrEqual(2);
          for (const e of moving) {
                        expect(e.seconds, `${label} ${e.ex}`).toBeGreaterThan(0);
            expect(e.notes, `${label} ${e.ex}`).toMatch(/add .* when every run is under \d+ s/);
          }
          // Real implements are used when available.
          const slugs = new Set(p.weekTemplates!.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.ex))));
          for (const s of ["yoke-carry", "strongman-farmers-walk", "log-press"]) expect(slugs.has(s), `${label} ${s}`).toBe(true);
          // Overhead at least twice a week (a static press day plus clean & press practice or volume).
          const pressDays = week1.days.filter((d) => d.exercises.some((e) => bySlug.get(e.ex)!.pattern === "vertical_push"));
          expect(pressDays.length, label).toBeGreaterThanOrEqual(2);
          // Grip and trunk work every week.
          expect(slugs.has("dead-hang") || slugs.has("trap-bar-carry"), label).toBe(true);
        }
  });

  it("writes metric distances for metric users", () => {
    const p = buildCustomProgram(input("strongman", { units: "metric" }), catalog);
    const yoke = p.weekTemplates![0]!.days.flatMap((d) => d.exercises).find((e) => e.ex === "yoke-carry")!;
    expect(yoke.reps).toBe("20 m");
    expect(yoke.notes).toMatch(/^Yoke: 4 × 20 m.*add 10 kg next week when every run is under 15 s/);
  });

  it("substitutes sandbag and dumbbell carries when there are no implements", () => {
    const owned: Equipment[] = ["sandbag", "dumbbell", "bench"];
    const p = buildCustomProgram(input("strongman", { equipment: owned, daysPerWeek: 4 }), catalog);
    const eventDay = p.weekTemplates![0]!.days.find((d) => d.name.startsWith("Event Day"))!;
    const slugs = eventDay.exercises.map((e) => e.ex);
    expect(slugs).toContain("sandbag-bear-hug-carry");
    expect(slugs).toContain("farmers-carry");
    expect(slugs.some((s) => s.startsWith("sandbag-load") || s === "sandbag-to-shoulder")).toBe(true);
    expect(slugs).toContain("one-arm-dumbbell-push-press");
    for (const w of p.weekTemplates!)
      for (const d of w.days)
        for (const e of d.exercises) {
          expect(bySlug.get(e.ex)!.equipment).not.toContain("strongman_implements");
          expect(isExerciseAvailable(bySlug.get(e.ex)!, owned), e.ex).toBe(true);
        }
    const sub = eventDay.exercises.find((e) => e.ex === "sandbag-bear-hug-carry")!;
    expect(sub.notes).toMatch(/substitute/);

    // A barbell gym without implements gets zercher and trap-bar carries instead.
    const gym = buildCustomProgram(input("strongman", { equipment: NO_IMPLEMENTS }), catalog);
    const gymSlugs = new Set(gym.weekTemplates![0]!.days.flatMap((d) => d.exercises.map((e) => e.ex)));
    expect(gymSlugs.has("zercher-carry")).toBe(true);
    expect(gymSlugs.has("trap-bar-carry")).toBe(true);
    expect(gymSlugs.has("sled-drag")).toBe(true);
  });

  it("peaks into contest week with event openers instead of max tests", () => {
    const p = buildCustomProgram(input("strongman", { goal: "contest_prep", weeks: 10, daysPerWeek: 4 }), catalog);
    const peak = p.weekTemplates!.at(-2)!;
    expect(peak.focus).toMatch(/Event rehearsal/);
    const last = p.weekTemplates!.at(-1)!;
    expect(last.focus).toMatch(/Contest week/);
    expect(last.days[0]!.name).toBe("Contest Week — Openers");
    expect(last.days.at(-1)!.name).toBe("Contest Day");
    for (const d of last.days) for (const e of d.exercises) expect(e.notes ?? "").not.toMatch(/Max test/);
    const openerYoke = last.days[0]!.exercises.find((e) => e.ex === "yoke-carry")!;
    expect(openerYoke.sets).toBe(1);
    expect(openerYoke.notes).toMatch(/opener/);
  });
});

describe("MMA / combat", () => {
  const scDays = <D extends { name: string }>(days: D[]) => days.filter((d) => d.name.startsWith(MMA_SC_PREFIX));
  type Ex = { ex: string; seconds?: number; rest: number; reps?: string };
  const conditioning = (e: Ex) => ["cardio", "conditioning"].includes(bySlug.get(e.ex)!.category) && !e.reps;
  const isAlactic = (e: Ex) => conditioning(e) && (e.seconds ?? 99) <= 10 && e.rest >= 8 * (e.seconds ?? 0);
  const isGlycolytic = (e: Ex) => conditioning(e) && (e.seconds ?? 0) >= 20 && (e.seconds ?? 0) <= 60 && e.rest <= 3 * (e.seconds ?? 0);

  it("never schedules more than 3 S&C days and trains alactic, glycolytic, neck and rotational qualities", () => {
    for (const experience of EXPERIENCE_LEVELS)
      for (const days of [2, 3, 4, 5])
        for (const goal of CUSTOM_TYPES.mma.goals) {
          const p = buildCustomProgram(input("mma", { experience, daysPerWeek: days, goal: goal.id }), catalog);
          for (const w of p.weekTemplates!) {
            const label = `${experience}/${days}d/${goal.id} ${w.focus}`;
            expect(scDays(w.days).length, label).toBeLessThanOrEqual(3);
            // Low soreness: nothing prescribed harder than RPE 8.
            for (const e of w.days.flatMap((d) => d.exercises)) if (e.rpe) expect(e.rpe, `${label} ${e.ex}`).toBeLessThanOrEqual(8);
          }
          const week1 = p.weekTemplates![0]!;
          const label = `${experience}/${days}d/${goal.id}`;
          const sc = scDays(week1.days).flatMap((d) => d.exercises);
          expect(sc.some(isAlactic), label).toBe(true);
          expect(sc.some(isGlycolytic), label).toBe(true);
          expect(sc.some((e) => ["neck-isometrics", "band-neck-training"].includes(e.ex)), label).toBe(true);
          expect(sc.some((e) => bySlug.get(e.ex)!.pattern === "rotation"), label).toBe(true);
          expect(sc.some((e) => bySlug.get(e.ex)!.pattern === "power"), label).toBe(true);
          if (days >= 3) expect(sc.some((e) => e.ex === "heavy-bag-rounds" && e.seconds === 180), label).toBe(true);
          expect(p.description).toMatch(/sparring/);
        }
  });

  it("periodizes a fight camp: 5-minute rounds at the peak, no glycolytic work in fight week", () => {
    const p = buildCustomProgram(input("mma", { goal: "fight_camp", weeks: 8, daysPerWeek: 3 }), catalog);
    const peak = p.weekTemplates!.at(-2)!;
    expect(peak.days.flatMap((d) => d.exercises).some((e) => e.ex === "heavy-bag-rounds" && e.seconds === 300 && e.sets === 5)).toBe(true);
    const fightWeek = p.weekTemplates!.at(-1)!;
    expect(fightWeek.days.every((d) => d.name.startsWith("Fight Week"))).toBe(true);
    expect(fightWeek.days.flatMap((d) => d.exercises).some(isGlycolytic)).toBe(false);
    const fightMinutes = fightWeek.days.reduce((s, d) => s + d.minutes, 0);
    const peakMinutes = peak.days.reduce((s, d) => s + d.minutes, 0);
    expect(fightMinutes).toBeLessThan(peakMinutes / 2);
    // Strength moves from base to max strength to fast, light power work.
    const main = (w: number) => p.weekTemplates![w]!.days[0]!.exercises[1]!;
    expect(main(0).reps).toBe("5");
    expect(p.weekTemplates!.some((w) => w.days[0]!.exercises[1]!.reps === "3")).toBe(true);
    expect(main(p.weeks - 2).reps).toBe("2");
  });
});

describe("bodybuilding & physique", () => {
  const loadingWeeks = (p: ReturnType<typeof buildCustomProgram>) => p.weekTemplates!.filter((w) => !w.isDeload && /^(Accumulation|Peak volume)/.test(w.focus));

  it("keeps weekly hard sets per major muscle within the experience-scaled range", () => {
    for (const experience of EXPERIENCE_LEVELS)
      for (const days of [3, 4, 5, 6])
        for (const goal of ["mass", "body_part_split"]) {
          const p = buildCustomProgram(input("bodybuilding", { experience, daysPerWeek: days, goal, sessionMinutes: 150 }), catalog);
          const [lo, hi] = BODYBUILDING_WEEKLY_SETS[experience].major;
          const weeks = loadingWeeks(p);
          expect(weeks.length).toBeGreaterThan(0);
          for (const w of weeks) {
            const sets = hardSetsByMuscle(w);
            for (const m of MAJOR_MUSCLES) {
              expect(sets[m], `${experience}/${days}d/${goal} ${m} ${w.focus}`).toBeGreaterThanOrEqual(lo);
              expect(sets[m], `${experience}/${days}d/${goal} ${m} ${w.focus}`).toBeLessThanOrEqual(hi);
            }
          }
          // Volume builds through the block and drops on deloads.
          const first = hardSetsByMuscle(weeks[0]!).quads;
          const peak = Math.max(...weeks.map((w) => hardSetsByMuscle(w).quads));
          expect(peak).toBeGreaterThan(first);
          const deload = p.weekTemplates!.find((w) => w.isDeload)!;
          expect(hardSetsByMuscle(deload).quads).toBeLessThan(first);
        }
  });

  it("uses proper splits, RIR targets and lengthened, machine and cable work", () => {
    const names = (goal: string, d: number) => buildCustomProgram(input("bodybuilding", { goal, daysPerWeek: d }), catalog).weekTemplates![0]!.days.map((x) => x.name);
    expect(names("mass", 4)).toEqual(["Upper A — Chest & Back", "Lower A — Quads", "Upper B — Shoulders & Arms", "Lower B — Hamstrings & Glutes"]);
    expect(names("mass", 6).filter((n) => /^(Push|Pull|Legs)/.test(n))).toHaveLength(6);
    expect(names("body_part_split", 5)).toEqual(["Chest", "Back", "Shoulders", "Legs", "Arms"]);

    const p = buildCustomProgram(input("bodybuilding", { experience: "advanced", daysPerWeek: 4 }), catalog);
    const all = p.weekTemplates!.flatMap((w) => w.days.flatMap((d) => d.exercises));
    expect(all.every((e) => /in reserve/.test(e.notes ?? ""))).toBe(true);
    const slugs = new Set(all.map((e) => e.ex));
    for (const s of ["hack-squat", "seated-leg-curl", "incline-dumbbell-curl", "overhead-triceps-extension", "cable-lateral-raise"]) expect(slugs.has(s), s).toBe(true);
    expect(all.some((e) => /Lengthened focus/.test(e.notes ?? ""))).toBe(true);
    // Isolation work goes closer to failure than compounds; the heavy compound ranges are lower-rep.
    const w1 = p.weekTemplates![0]!.days[0]!.exercises;
    expect(w1[0]!.reps).toBe("6-10");
    expect(p.progression).toMatch(/Double progression/);
  });

  it("gives priority muscles extra sets in specialization blocks", () => {
    const p = buildCustomProgram(input("bodybuilding", { goal: "upper_emphasis", daysPerWeek: 5, sessionMinutes: 150, experience: "advanced" }), catalog);
    const [lo, hi] = BODYBUILDING_WEEKLY_SETS.advanced.major;
    for (const w of loadingWeeks(p)) {
      const s = hardSetsByMuscle(w);
      expect(s.chest).toBeGreaterThan(s.quads);
      expect(s.back).toBeGreaterThan(s.hamstrings);
      expect(s.chest).toBeLessThanOrEqual(hi + SPECIALIZATION_BONUS);
      expect(s.quads).toBe(lo);
    }
  });

  it("show prep: posing every session, more cardio and steps over time, and no extreme peak-week advice", () => {
    for (const division of ["bodybuilding", "bikini", "mens_physique"] as const) {
      const p = buildCustomProgram(input("show_prep", { division, weeks: 16 }), catalog);
      const posing = p.weekTemplates!.map((w) => w.days.map((d) => d.exercises.find((e) => e.ex === "posing-practice")));
      for (const week of posing) for (const ex of week) expect(ex).toBeDefined();
      expect(posing.at(-2)![0]!.seconds!).toBeGreaterThan(posing[0]![0]!.seconds!);
      expect(p.description).toMatch(/qualified coach/);
      expect(p.description).toMatch(/does not prescribe extreme dieting, water cutting or sodium manipulation/);
      expect(p.weekTemplates!.at(-1)!.focus).toMatch(/no extreme water or sodium manipulation/);
      const steps = (w: number) => Number(p.weekTemplates![w]!.days[0]!.exercises.find((e) => /Daily steps/.test(e.notes ?? ""))!.notes!.match(/about ([\d,]+)/)![1]!.replace(",", ""));
      expect(steps(12)).toBeGreaterThan(steps(0));
      // Show prep holds volume in the lower half of the range while dieting.
      const [lo, hi] = BODYBUILDING_WEEKLY_SETS.intermediate.major;
      for (const w of loadingWeeks(p)) expect(hardSetsByMuscle(w).back).toBeLessThanOrEqual(Math.round((lo + hi) / 2) + (division === "bikini" ? 0 : SPECIALIZATION_BONUS));
    }
    const bikini = buildCustomProgram(input("show_prep", { division: "bikini" }), catalog);
    expect(bikini.weekTemplates![0]!.days[0]!.exercises.find((e) => e.ex === "posing-practice")!.notes).toMatch(/heels/);
  });
});

describe("powerlifting meet week", () => {
  it("ends single-lift meet preps with a meet day for that lift", () => {
    const bench = buildCustomProgram(input("bench", { goal: "meet_prep", weeks: 8, maxesKg: { bench: 100 }, units: "metric" }), catalog);
    const last = bench.weekTemplates!.at(-1)!;
    expect(last.days.at(-1)!.name).toBe("Meet Day — Bench");
    const attempt = last.days.at(-1)!.exercises[0]!;
    expect(attempt.intensity).toBe("91% · 90 kg");
    expect(attempt.notes).toMatch(/second ~95–97% \(95 kg\)/);
    expect(attempt.notes).toMatch(/Press/);
  });
});
