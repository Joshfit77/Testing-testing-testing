import { EXERCISES } from "@/data/exercises";
import { STANDARD_COOLDOWN, STANDARD_WARMUP } from "@/data/programs";
import { buildCustomProgram, CUSTOM_PROGRAM_TYPES, CUSTOM_TYPES, weeksRange } from "@/lib/domain/custom-programs";
import { estimateSessionMinutes, fitSessionToMinutes, framingMinutes } from "@/lib/domain/session-time";
import { expandProgram } from "@/lib/domain/program-expansion";
import { EQUIPMENT } from "@/lib/domain/types";

const catalog = EXERCISES.map((e) => ({ slug: e.slug, name: e.name, equipment: e.equipment, pattern: e.pattern, category: e.category, difficulty: e.difficulty, timed: e.timed, lowImpact: e.lowImpact }));
const COMPETITION = /^(Meet Day|Contest Day)/;

describe("fitSessionToMinutes", () => {
  const session = [
    { ex: "back-squat", sets: 5, reps: "5", rest: 180 },
    { ex: "romanian-deadlift", sets: 4, reps: "8", rest: 120 },
    { ex: "walking-lunge", sets: 4, reps: "10 per side", rest: 90 },
    { ex: "standing-calf-raise", sets: 4, reps: "12", rest: 60 },
  ];

  it("counts working sets, rest, warm-ups, ramp-up sets and transitions in the estimate", () => {
    const framing = framingMinutes(STANDARD_WARMUP, STANDARD_COOLDOWN);
    expect(framing).toBe(12);
    // 5 × 20 s work + 4 × 180 s rest + 60 s set-up + 180 s ramp-up sets = 1060 s for the squat alone.
    expect(estimateSessionMinutes([session[0]!], 0)).toBe(18);
    expect(estimateSessionMinutes([session[0]!], framing)).toBe(30);
  });

  it("trims accessories before touching the main lift", () => {
    const before = estimateSessionMinutes(session, 12);
    expect(before).toBeGreaterThan(45);
    const fit = fitSessionToMinutes(session, 45, 12, (e) => e.ex === "back-squat");
    expect(fit.minutes).toBeLessThanOrEqual(45);
    expect(fit.trimmed).toBe(true);
    expect(fit.exercises[0]).toMatchObject({ ex: "back-squat", sets: 5 });
    expect(fit.minutes).toBe(estimateSessionMinutes(fit.exercises, 12));
  });

  it("removes whole accessories from the end and only then cuts main sets", () => {
    const fit = fitSessionToMinutes(session, 30, 12, (e) => e.ex === "back-squat");
    expect(fit.exercises.map((e) => e.ex)).toEqual(["back-squat"]);
    expect(fit.minutes).toBeLessThanOrEqual(30);
    const tight = fitSessionToMinutes(session, 25, 12, (e) => e.ex === "back-squat");
    expect(tight.exercises[0]!.sets).toBeLessThan(5);
    expect(tight.exercises[0]!.sets).toBeGreaterThanOrEqual(2);
  });

  it("shortens a long easy cardio block instead of dropping it", () => {
    const fit = fitSessionToMinutes([{ ex: "zone-2-run", sets: 1, seconds: 3000, rest: 0 }], 40, 8);
    expect(fit.exercises).toHaveLength(1);
    expect(fit.minutes).toBeLessThanOrEqual(40);
    expect(fit.exercises[0]!.seconds).toBeGreaterThanOrEqual(600);
  });

  it("returns the honest estimate when a session can't fit", () => {
    const fit = fitSessionToMinutes([{ ex: "back-squat", sets: 2, reps: "5", rest: 300 }], 10, 12, () => true);
    expect(fit.minutes).toBeGreaterThan(10);
    expect(fit.minutes).toBe(estimateSessionMinutes(fit.exercises, 12));
  });
});

describe("program builder session length", () => {
  const build = (type: (typeof CUSTOM_PROGRAM_TYPES)[number], goal: string, minutes: number, experience: "beginner" | "intermediate" | "advanced" = "intermediate") =>
    buildCustomProgram(
      {
        type,
        goal,
        experience,
        daysPerWeek: CUSTOM_TYPES[type].days.default,
        sessionMinutes: minutes,
        weeks: weeksRange(type, goal).default,
        units: "imperial",
        age: 30,
        heightCm: 178,
        bodyweightKg: 80,
        maxesKg: { squat: 140, bench: 100, deadlift: 180, press: 60 },
        cardio: CUSTOM_TYPES[type].cardioInput ? { modality: "run", continuousMinutes: 20 } : null,
        division: type === "show_prep" ? "classic_physique" : null,
        equipment: [...EQUIPMENT],
      },
      catalog,
    );

  it("a 60-minute choice never produces a session labelled longer than 60 minutes", { timeout: 60_000 }, () => {
    for (const type of CUSTOM_PROGRAM_TYPES)
      for (const goal of CUSTOM_TYPES[type].goals)
        for (const experience of ["beginner", "intermediate", "advanced"] as const) {
          const p = build(type, goal.id, 60, experience);
          expect(p.sessionMinutes, `${type}/${goal.id}`).toBeLessThanOrEqual(60);
          expect(p.summary).not.toMatch(/7\d minutes/);
          for (const w of p.weekTemplates!)
            for (const d of w.days) {
              if (COMPETITION.test(d.name)) continue;
              expect(d.minutes, `${type}/${goal.id}/${experience} ${d.name}`).toBeLessThanOrEqual(60);
            }
        }
  });

  it("labels each day with the shared session-time estimate (warm-up and cool-down included)", () => {
    for (const minutes of [45, 60, 75]) {
      const p = build("bodybuilding", "mass", minutes);
      for (const w of p.weekTemplates!)
        for (const d of w.days) {
          const framing = framingMinutes(d.warmup ?? p.warmup, d.cooldown ?? p.cooldown);
          expect(d.minutes, d.name).toBe(Math.max(15, estimateSessionMinutes(d.exercises, framing)));
          expect(d.minutes, d.name).toBeLessThanOrEqual(minutes);
        }
    }
  });

  it("fits 45-, 75- and 90-minute choices for every program type", { timeout: 60_000 }, () => {
    for (const minutes of [45, 75, 90])
      for (const type of CUSTOM_PROGRAM_TYPES)
        for (const goal of CUSTOM_TYPES[type].goals) {
          const p = build(type, goal.id, minutes);
          for (const w of p.weekTemplates!) for (const d of w.days) if (!COMPETITION.test(d.name)) expect(d.minutes, `${minutes} ${type}/${goal.id} ${d.name}`).toBeLessThanOrEqual(minutes);
        }
  });
});

describe("onboarding starter program session length", () => {
  it("never labels a session longer than the chosen length", { timeout: 60_000 }, async () => {
    const { buildStarterProgram } = await import("@/lib/domain/program-generator");
    for (const minutes of [30, 45, 60, 75])
      for (const goal of ["build_strength", "build_muscle", "lose_fat", "improve_conditioning", "general_health"] as const)
        for (const experience of ["new", "intermediate", "advanced"] as const) {
          const p = buildStarterProgram({ primary_goal: goal, experience, equipment: [...EQUIPMENT], days_per_week: 4, session_minutes: minutes, preferred_types: [] }, catalog);
          expect(p.sessionMinutes, `${minutes} ${goal} ${experience}`).toBeLessThanOrEqual(minutes);
          // Progression in later weeks never pushes a session past the choice either.
          for (const w of expandProgram(p)) for (const d of w.days) expect(d.minutes, `${minutes} ${goal} w${w.weekNumber} ${d.name}`).toBeLessThanOrEqual(minutes);
          for (const d of p.days) {
            expect(d.minutes, `${minutes} ${goal} ${experience} ${d.name}`).toBeLessThanOrEqual(minutes);
            expect(d.minutes).toBe(Math.max(10, estimateSessionMinutes(d.exercises, framingMinutes(STANDARD_WARMUP, STANDARD_COOLDOWN))));
          }
        }
  });
});
