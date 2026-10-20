import { EXERCISE_SLUGS, EXERCISES } from "@/data/exercises";
import { PROGRAMS, type ProgramSeed } from "@/data/programs";
import { compareLibraryPrograms, DISCIPLINES, disciplineForCategory } from "@/lib/domain/disciplines";
import { auditProgram, estimateSessionMinutes, framingMinutes, isHypertrophyProgram, isSpeedWork, MAJOR_AUDIT_MUSCLES } from "@/lib/domain/program-audit";
import { buildCustomProgram } from "@/lib/domain/custom-programs";
import { expandProgram } from "@/lib/domain/program-expansion";
import { EQUIPMENT } from "@/lib/domain/types";

const bySlug = (slug: string) => PROGRAMS.find((p) => p.slug === slug)!;
const exerciseBySlug = new Map(EXERCISES.map((e) => [e.slug, e]));

/** Slugs saved programs already point at — they must never disappear. */
const LEGACY_SLUGS = [
  "foundations-full-body",
  "home-bodyweight-strength",
  "barbell-strength-foundations",
  "powerlifting-base-block",
  "hypertrophy-upper-lower",
  "womens-strength-progression",
  "strongman-foundations",
  "athletic-power-development",
  "mma-fight-conditioning",
  "boxing-round-ready",
  "grappling-mat-endurance",
  "functional-engine",
  "lean-and-conditioned",
  "active-aging-low-impact",
  "daily-mobility-flow",
  "recovery-deload-week",
  "combat-conditioning-sessions",
  "athletic-qualities-sessions",
  "bench-press-specialist",
  "squat-specialist",
  "deadlift-specialist",
  "physique-show-prep",
  "speed-development",
  "agility-footwork",
  "aerobic-base-run-walk",
];

describe("program library structure", () => {
  it("keeps every existing slug and has unique slugs", () => {
    const slugs = PROGRAMS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of LEGACY_SLUGS) expect(slugs, s).toContain(s);
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(40);
  });

  it("expands to exactly `weeks` weeks of real exercises with sane prescriptions", () => {
    for (const p of PROGRAMS) {
      const weeks = expandProgram(p);
      expect(weeks, p.slug).toHaveLength(p.weeks);
      expect(p.name.length, p.slug).toBeLessThanOrEqual(120);
      expect(p.sessionMinutes, p.slug).toBeGreaterThanOrEqual(10);
      expect(p.sessionMinutes, p.slug).toBeLessThanOrEqual(180);
      expect(p.days.length, p.slug).toBeLessThanOrEqual(7);
      if (p.weekTemplates) expect(p.days, p.slug).toEqual(p.weekTemplates[0]!.days);
      for (const w of weeks)
        for (const d of w.days) {
          expect(d.exercises.length, `${p.slug} ${d.name}`).toBeGreaterThan(0);
          expect(new Set(d.exercises.map((e) => e.ex)).size, `${p.slug} w${w.weekNumber} ${d.name}: duplicate exercise`).toBe(d.exercises.length);
          expect(d.minutes, `${p.slug} ${d.name}`).toBeGreaterThanOrEqual(5);
          expect(d.minutes, `${p.slug} ${d.name}`).toBeLessThanOrEqual(240);
          expect(d.name.length).toBeLessThanOrEqual(120);
          expect(d.warmup.length + d.cooldown.length, `${p.slug} ${d.name}`).toBeGreaterThan(0);
          for (const e of d.exercises) {
            const label = `${p.slug} w${w.weekNumber} ${d.name} ${e.ex}`;
            expect(EXERCISE_SLUGS.has(e.ex), label).toBe(true);
            expect(Boolean(e.reps) || Boolean(e.seconds), label).toBe(true);
            expect(e.sets, label).toBeGreaterThanOrEqual(1);
            expect(e.sets, label).toBeLessThanOrEqual(10);
            expect(e.rest, label).toBeGreaterThanOrEqual(0);
            expect(e.rest, label).toBeLessThanOrEqual(600);
            if (e.seconds) expect(e.seconds, label).toBeLessThanOrEqual(7200);
            if (e.rpe !== undefined) {
              expect(e.rpe, label).toBeGreaterThanOrEqual(4);
              expect(e.rpe, label).toBeLessThanOrEqual(e.sets > 1 ? 9.5 : 10);
            }
            // Database constraints on program_exercises.
            if (e.reps) expect(e.reps.length, `${label} reps "${e.reps}"`).toBeLessThanOrEqual(20);
            if (e.intensity) expect(e.intensity.length, `${label} intensity "${e.intensity}"`).toBeLessThanOrEqual(60);
            if (e.notes) expect(e.notes.length, `${label} notes`).toBeLessThanOrEqual(500);
            if (e.seconds) expect(e.seconds, label).toBeGreaterThanOrEqual(5);
            // Timed exercises are prescribed by time or distance, not plain rep counts.
            if (exerciseBySlug.get(e.ex)!.timed && e.reps) expect(e.reps, label).toMatch(/m\b|ft\b|breaths|contacts|per side|event|km/);
          }
        }
    }
  });

  it("has a deload (or taper) week in every multi-week program, or a stated reason", () => {
    for (const p of PROGRAMS) {
      if (p.weeks < 4) continue;
      const weeks = expandProgram(p);
      const deloads = weeks.filter((w) => w.isDeload).map((w) => w.weekNumber);
      if (!deloads.length) {
        expect(p.noDeloadReason, p.slug).toBeTruthy();
        continue;
      }
      // No more than 7 hard weeks in a row without a lighter week.
      let run = 0;
      for (const w of weeks) {
        run = w.isDeload ? 0 : run + 1;
        expect(run, `${p.slug} week ${w.weekNumber}`).toBeLessThanOrEqual(7);
      }
      // Deloads really are lighter: fewer sets than the first week.
      // Deloads really are lighter: fewer sets than the hardest week before them.
      const sets = (n: number) => weeks[n - 1]!.days.reduce((s, d) => s + d.exercises.reduce((t, e) => t + e.sets, 0), 0);
      for (const dw of deloads) {
        const before = weeks.slice(0, dw - 1).filter((w) => !w.isDeload).map((w) => sets(w.weekNumber));
        if (before.length) expect(sets(dw), `${p.slug} deload ${dw}`).toBeLessThan(Math.max(...before));
      }
    }
  });

  it("states session lengths that match the prescription", () => {
    for (const p of PROGRAMS) {
      const weeks = expandProgram(p);
      for (const w of weeks)
        for (const d of w.days) {
          const est = estimateSessionMinutes(d.exercises, framingMinutes(d.warmup, d.cooldown));
          expect(Math.abs(d.minutes - est), `${p.slug} w${w.weekNumber} ${d.name}: stated ${d.minutes}, estimated ${est}`).toBeLessThanOrEqual(Math.max(5, est * 0.15));
        }
      const loading = weeks.find((w) => !w.isDeload) ?? weeks[0]!;
      const mean = loading.days.reduce((s, d) => s + d.minutes, 0) / loading.days.length;
      expect(Math.abs(p.sessionMinutes - mean), `${p.slug}: sessionMinutes ${p.sessionMinutes} vs mean ${mean}`).toBeLessThanOrEqual(Math.max(10, mean * 0.25));
    }
  });

  it("keeps hypertrophy programs within evidence-based weekly volume (about 10–20 hard sets per major muscle)", () => {
    const hypertrophy = PROGRAMS.filter(isHypertrophyProgram);
    expect(hypertrophy.length).toBeGreaterThanOrEqual(8);
    for (const p of hypertrophy) {
      const audit = auditProgram(p);
      const loading = audit.weeks.filter((w) => !w.isDeload);
      for (const w of loading) {
        const sets = MAJOR_AUDIT_MUSCLES.map((m) => w.setsByMuscle[m]);
        for (const m of MAJOR_AUDIT_MUSCLES) {
          // ≥ 6: at least maintenance volume even for non-priority muscles; ≤ 24: beyond ~20 there's little evidence of extra benefit.
          expect(w.setsByMuscle[m], `${p.slug} w${w.weekNumber} ${m}`).toBeGreaterThanOrEqual(6);
          expect(w.setsByMuscle[m], `${p.slug} w${w.weekNumber} ${m}`).toBeLessThanOrEqual(24);
        }
        expect(sets.filter((s) => s >= 9).length, `${p.slug} w${w.weekNumber}: at least 3 major muscles near 10+ sets`).toBeGreaterThanOrEqual(3);
      }
      // Balanced pushing and pulling (within 1.5:1 either way).
      for (const w of loading) expect(Math.max(w.pushSets, w.pullSets) / Math.max(1, Math.min(w.pushSets, w.pullSets)), `${p.slug} w${w.weekNumber} push:pull`).toBeLessThanOrEqual(1.6);
    }
  });

  it("counts speed sets as practice, not hard sets", () => {
    expect(isSpeedWork({ reps: "3", intensity: "65–70% of your 3–5RM bench" })).toBe(true);
    expect(isSpeedWork({ reps: "2", intensity: "55% 1RM" })).toBe(true);
    expect(isSpeedWork({ reps: "10", intensity: "50% TM" })).toBe(false);
    expect(isSpeedWork({ reps: "3", intensity: "85% 1RM" })).toBe(false);
  });
});

describe("tiers and organisation", () => {
  it("offers at least one free program in every discipline", () => {
    for (const d of DISCIPLINES) {
      const free = PROGRAMS.filter((p) => disciplineForCategory(p.category).id === d.id && p.tier === "free");
      expect(free.length, d.label).toBeGreaterThanOrEqual(1);
    }
    expect(PROGRAMS.filter((p) => p.tier !== "free").length).toBeGreaterThanOrEqual(20);
  });

  it("sorts each discipline beginner → advanced", () => {
    const strength = PROGRAMS.filter((p) => disciplineForCategory(p.category).id === "strength").sort(compareLibraryPrograms);
    const rank = { beginner: 0, intermediate: 1, advanced: 2 } as const;
    for (let i = 1; i < strength.length; i++) expect(rank[strength[i]!.difficulty]).toBeGreaterThanOrEqual(rank[strength[i - 1]!.difficulty]);
    expect(strength[0]!.difficulty).toBe("beginner");
    expect(strength.at(-1)!.difficulty).toBe("advanced");
  });

  it("puts new templates in the right disciplines", () => {
    const disc = (slug: string) => disciplineForCategory(bySlug(slug).category).id;
    expect(disc("wave-strength-training-max")).toBe("strength");
    expect(disc("powerbuilding-4-day")).toBe("strength");
    expect(disc("powerlifting-peaking-12-week")).toBe("strength");
    expect(disc("push-pull-legs-6-day")).toBe("physique");
    expect(disc("strongman-4-day-events")).toBe("strongman");
    expect(disc("mma-fight-camp-3-day")).toBe("combat");
    expect(disc("half-marathon-base-80-20")).toBe("endurance");
    expect(disc("active-aging-strength-2-day")).toBe("general");
  });

  it("doesn't use trademarked program names as titles", () => {
    for (const p of PROGRAMS) expect(p.name, p.slug).not.toMatch(/5\/3\/1|Starting Strength|StrongLifts|Texas Method|GZCL|PHUL|PHAT|Westside|Juggernaut|Couch to 5K|Sheiko/i);
  });
});

describe("specific templates", () => {
  const mainLift = (p: ProgramSeed, week: number, day: number) => expandProgram(p)[week - 1]!.days[day - 1]!.exercises[0]!;

  it("4-week waves use 65/75/85, 70/80/90 and 75/85/95% of the training max, then a 40/50/60% deload", () => {
    const p = bySlug("wave-strength-training-max");
    const expected = ["65% / 75% / 85% TM", "70% / 80% / 90% TM", "75% / 85% / 95% TM", "40% / 50% / 60% TM"];
    for (const cycleStart of [1, 5])
      for (let i = 0; i < 4; i++)
        for (let d = 1; d <= 4; d++) expect(mainLift(p, cycleStart + i, d).intensity!.startsWith(expected[i]!), `week ${cycleStart + i} day ${d}`).toBe(true);
    const weeks = expandProgram(p);
    expect(weeks.filter((w) => w.isDeload).map((w) => w.weekNumber)).toEqual([4, 8]);
    expect(mainLift(p, 3, 1).reps).toBe("5/3/1+");
    expect(p.description).toMatch(/90% of your true 1RM/);
    // Cycle 1: 5 × 10 of the opposite lift; cycle 2: 5 × 5 at the first-set percentage on the main row.
    expect(weeks[0]!.days[0]!.exercises[1]).toMatchObject({ ex: "bench-press", sets: 5, reps: "10", intensity: "50% TM" });
    expect(weeks[5]!.days[0]!.exercises[0]).toMatchObject({ ex: "overhead-press", sets: 8, reps: "3/3/3+ + 5×5", intensity: "70% / 80% / 90% TM; 5×5 @ 70%" });
    // Deloads drop the supplemental work.
    expect(weeks[3]!.days[0]!.exercises.map((e) => e.ex)).not.toContain("bench-press");
  });

  it("tiered program pairs a heavy T1, a 3 × 10 T2 and a high-rep T3 each day", () => {
    const days = expandProgram(bySlug("tiered-strength-program"))[0]!.days;
    for (const d of days) {
      expect(d.exercises.map((e) => [e.sets, e.reps])).toEqual([
        [5, "3 (last set 3+)"],
        [3, "10"],
        [3, "15 (last set 15+)"],
      ]);
    }
    expect(days.map((d) => d.exercises[0]!.ex)).toEqual(["back-squat", "overhead-press", "bench-press", "conventional-deadlift"]);
  });

  it("weekly undulating has a 5 × 5 volume day, a light day and a record day", () => {
    const w1 = expandProgram(bySlug("intermediate-weekly-undulating"))[0]!;
    expect(w1.days[0]!.exercises[0]).toMatchObject({ ex: "back-squat", sets: 5, reps: "5" });
    expect(w1.days[1]!.exercises[0]!.intensity).toMatch(/80%/);
    expect(w1.days[2]!.exercises[0]).toMatchObject({ sets: 1, reps: "5" });
    // Bench and overhead press alternate as the main press.
    const w2 = expandProgram(bySlug("intermediate-weekly-undulating"))[1]!;
    expect(w1.days[0]!.exercises[1]!.ex).toBe("bench-press");
    expect(w2.days[0]!.exercises[1]!.ex).toBe("overhead-press");
  });

  it("12-week peak: rising percentages, a ≥40% volume taper with intensity held, and meet-day attempts", () => {
    const p = bySlug("powerlifting-peaking-12-week");
    const weeks = expandProgram(p);
    const pctOf = (w: number) => Number(weeks[w - 1]!.days[0]!.exercises[0]!.intensity!.match(/[\d.]+/)![0]);
    expect(pctOf(2)).toBeGreaterThan(pctOf(1));
    expect(pctOf(9)).toBeGreaterThan(pctOf(6));
    const volume = (w: number) => weeks[w - 1]!.days.reduce((s, d) => s + d.exercises.reduce((t, e) => t + e.sets, 0), 0);
    expect(volume(11)).toBeLessThanOrEqual(volume(9) * 0.6);
    expect(pctOf(11)).toBeGreaterThanOrEqual(90);
    const meet = weeks[11]!.days.at(-1)!;
    expect(meet.name).toBe("Meet Day");
    expect(meet.exercises.map((e) => e.ex)).toEqual(["back-squat", "bench-press", "conventional-deadlift"]);
    for (const e of meet.exercises) expect(e.intensity).toMatch(/opener 90–92% · second 95–97% · third 100–103%/);
    // Last heavy deadlift about ten days out: nothing above 70% in the taper week.
    const taperPull = weeks[10]!.days[1]!.exercises.find((e) => e.ex === "conventional-deadlift")!;
    expect(Number(taperPull.intensity!.match(/[\d.]+/)![0])).toBeLessThanOrEqual(70);
  });

  it("conjugate rotates the max-effort exercise every two weeks and waves dynamic-effort percentages", () => {
    const weeks = expandProgram(bySlug("conjugate-4-day"));
    const me = weeks.map((w) => w.days[0]!.exercises[0]!.ex);
    expect(me[0]).toBe(me[1]);
    expect(me[2]).not.toBe(me[0]);
    const de = [1, 2, 3].map((w) => weeks[w - 1]!.days[2]!.exercises[0]!.intensity);
    expect(de).toEqual(["50% 1RM", "55% 1RM", "60% 1RM"]);
    expect(weeks[2]!.days[2]!.exercises[0]).toMatchObject({ sets: 10, reps: "2" });
  });

  it("hypertrophy blocks add sets and lower reps-in-reserve through the block, then deload", () => {
    for (const slug of ["full-body-hypertrophy-3-day", "power-hypertrophy-upper-lower", "push-pull-legs-6-day", "power-hypertrophy-5-day", "hypertrophy-upper-lower", "womens-glute-strength"]) {
      const audit = auditProgram(bySlug(slug));
      const total = (w: number) => MAJOR_AUDIT_MUSCLES.reduce((s, m) => s + audit.weeks[w - 1]!.setsByMuscle[m], 0);
      const loading = audit.weeks.filter((w) => !w.isDeload);
      expect(Math.max(...loading.map((w) => total(w.weekNumber))), slug).toBeGreaterThan(total(1));
      const deload = audit.weeks.find((w) => w.isDeload)!;
      expect(total(deload.weekNumber), slug).toBeLessThan(total(1));
      const firstRpe = audit.weeks[0]!.days[0]!.exercises.find((e) => e.rpe)!.rpe!;
      const peakRpe = Math.max(...loading.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.rpe ?? 0))));
      expect(peakRpe, slug).toBeGreaterThan(firstRpe);
    }
  });

  it("PPL trains every muscle twice a week across six days", () => {
    const days = expandProgram(bySlug("push-pull-legs-6-day"))[0]!.days.map((d) => d.name);
    expect(days).toEqual(["Pull A", "Push A", "Legs A", "Pull B", "Push B", "Legs B"]);
  });

  it("strongman event day writes moving events as distance with a target time", () => {
    const eventDay = expandProgram(bySlug("strongman-4-day-events"))[0]!.days.find((d) => d.name === "Event Day")!;
    for (const slug of ["yoke-carry", "strongman-farmers-walk", "sled-drag"]) {
      const e = eventDay.exercises.find((x) => x.ex === slug)!;
      expect(e.reps).toBe("20 m");
      expect(e.notes).toMatch(/when every run is under \d+ s/);
    }
    expect(eventDay.exercises.some((e) => e.ex === "atlas-stone-load")).toBe(true);
  });

  it("fight camp keeps alactic work:rest at 1:8+, drops glycolytic work in fight week and more than halves its volume", () => {
    const weeks = expandProgram(bySlug("mma-fight-camp-3-day"));
    for (const w of weeks)
      for (const d of w.days)
        for (const e of d.exercises) if (e.seconds && e.seconds <= 10 && !e.reps) expect(e.rest / e.seconds, `${w.weekNumber} ${e.ex}`).toBeGreaterThanOrEqual(8);
    const fight = weeks.at(-1)!;
    expect(fight.days.every((d) => d.name.startsWith("Fight Week"))).toBe(true);
    expect(fight.days.flatMap((d) => d.exercises).some((e) => (e.seconds ?? 0) >= 20 && (e.seconds ?? 0) <= 60 && e.rest <= 90 && e.ex === "air-bike-sprint")).toBe(false);
    const mins = (i: number) => weeks[i]!.days.reduce((s, d) => s + d.minutes, 0);
    expect(mins(7)).toBeLessThan(mins(6) / 2);
    expect(weeks[6]!.days[2]!.exercises[0]).toMatchObject({ ex: "heavy-bag-rounds", sets: 5, seconds: 300 });
    for (const w of weeks.slice(0, 7)) expect(w.days.flatMap((d) => d.exercises).some((e) => /neck/.test(e.ex)), `week ${w.weekNumber}`).toBe(true);
  });

  it("density progression never shortens rest on strength sets or all-out sprints", () => {
    const weeks = expandProgram(bySlug("mma-fight-conditioning"));
    const find = (w: number, ex: string, secs?: number) => weeks[w]!.days[0]!.exercises.find((e) => e.ex === ex && (secs === undefined || e.seconds === secs))!;
    expect(find(4, "trap-bar-deadlift").rest).toBe(find(0, "trap-bar-deadlift").rest);
    expect(find(4, "trap-bar-deadlift").sets).toBe(find(0, "trap-bar-deadlift").sets);
    expect(find(4, "bike-intervals", 8).rest).toBe(90);
    // Glycolytic intervals do get denser.
    const glyco = (w: number) => weeks[w]!.days[1]!.exercises.find((e) => e.ex === "bike-intervals")!;
    expect(glyco(3).rest).toBeLessThan(glyco(0).rest);
  });

  it("half-marathon plan keeps hard running at or under about 20–25% of weekly running time and ends with race day", () => {
    const weeks = expandProgram(bySlug("half-marathon-base-80-20"));
    for (const w of weeks) {
      let hard = 0;
      let total = 0;
      for (const d of w.days)
        for (const e of d.exercises) {
          if (!["zone-2-run", "running-intervals"].includes(e.ex)) continue;
          const t = (e.seconds ?? 0) * e.sets;
          total += t;
          if (e.ex === "running-intervals") hard += t;
        }
      expect(hard / total, `week ${w.weekNumber}`).toBeLessThanOrEqual(0.25);
    }
    const longRuns = weeks.slice(0, 11).map((w) => w.days[3]!.exercises[0]!.seconds!);
    expect(Math.max(...longRuns)).toBeGreaterThanOrEqual(100 * 60);
    expect(longRuns[3]!).toBeLessThan(longRuns[2]!);
    expect(weeks[11]!.days[3]!.name).toMatch(/Race Day/);
  });

  it("first 5K starts at 60 s run / 90 s walk three times a week and ends with 30 minutes continuous", () => {
    const weeks = expandProgram(bySlug("aerobic-base-run-walk"));
    expect(weeks[0]!.days).toHaveLength(3);
    expect(weeks[0]!.days[0]!.exercises[0]).toMatchObject({ ex: "run-walk-intervals", seconds: 60, rest: 90, sets: 8 });
    expect(weeks[0]!.days.every((d) => d.exercises[0]!.ex.includes("run"))).toBe(true);
    expect(weeks[7]!.days[2]!.exercises[0]).toMatchObject({ ex: "zone-2-run", seconds: 1800 });
  });

  it("speed and agility progress volume week to week and test in the last week", () => {
    const speed = expandProgram(bySlug("speed-development"));
    const accel = (w: number) => speed[w]!.days[0]!.exercises.find((e) => e.ex === "acceleration-sprint")!;
    expect(accel(3).sets).toBeGreaterThan(accel(0).sets);
    expect(accel(5).notes).toMatch(/Test/);
    const agility = expandProgram(bySlug("agility-footwork"));
    const shuttle = (w: number) => agility[w]!.days[0]!.exercises.find((e) => e.ex === "pro-agility-shuttle")!;
    expect(shuttle(4).sets).toBeGreaterThan(shuttle(0).sets);
    expect(shuttle(5).notes).toMatch(/Test/);
  });

  it("show prep holds volume, raises conditioning and posing, and avoids extreme peak-week advice", () => {
    const p = bySlug("physique-show-prep");
    const weeks = expandProgram(p);
    const posing = (w: number) => weeks[w]!.days[0]!.exercises.find((e) => e.ex === "posing-practice")!.seconds!;
    expect(posing(10)).toBeGreaterThan(posing(0));
    const liss = (w: number) => weeks[w]!.days[0]!.exercises.find((e) => e.ex === "bike-intervals")!.seconds!;
    expect(liss(10)).toBeGreaterThan(liss(0));
    expect(p.description).toMatch(/0\.5–1% of body weight per week/);
    expect(p.description).toMatch(/does not prescribe extreme dieting, dehydration or sodium manipulation/);
    expect(weeks.at(-1)!.focus).toMatch(/no extreme water or sodium manipulation/);
    for (const w of weeks) for (const d of w.days) expect(d.exercises.some((e) => e.ex === "posing-practice"), `${w.weekNumber} ${d.name}`).toBe(true);
  });

  it("active-aging programs include balance work and progressive strength", () => {
    const three = expandProgram(bySlug("active-aging-low-impact"));
    expect(three[0]!.days.flatMap((d) => d.exercises).some((e) => e.ex === "single-leg-balance")).toBe(true);
    const two = expandProgram(bySlug("active-aging-strength-2-day"));
    expect(two[0]!.days[0]!.exercises[0]!.reps).toBe("10-12");
    expect(two[4]!.days[0]!.exercises[0]!.reps).toBe("6-8");
    expect(two.filter((w) => w.isDeload).map((w) => w.weekNumber)).toEqual([4, 8]);
  });
});

describe("custom builder fixes from the audit", () => {
  const catalog = EXERCISES.map((e) => ({ slug: e.slug, name: e.name, equipment: e.equipment, pattern: e.pattern, category: e.category, difficulty: e.difficulty, timed: e.timed, lowImpact: e.lowImpact }));
  const base = { experience: "intermediate" as const, units: "metric" as const, age: 30, heightCm: 178, bodyweightKg: 80, maxesKg: {}, cardio: null, equipment: [...EQUIPMENT] };

  it("bench specialization pulls as well as it presses", () => {
    const p = buildCustomProgram({ ...base, type: "bench", goal: "increase_1rm", daysPerWeek: 4, sessionMinutes: 60, weeks: 8, division: null }, catalog);
    const heavy = p.weekTemplates![0]!.days[0]!;
    expect(heavy.exercises.some((e) => exerciseBySlug.get(e.ex)!.pattern === "vertical_pull")).toBe(true);
    const w1 = auditProgram(p).weeks[0]!;
    expect(w1.pushSets / w1.pullSets).toBeLessThanOrEqual(1.35);
  });

  it("show prep moves surplus cardio to a separate session instead of overrunning the session length", () => {
    const p = buildCustomProgram({ ...base, type: "show_prep", goal: "first_show", daysPerWeek: 4, sessionMinutes: 75, weeks: 16, division: "classic_physique" }, catalog);
    for (const w of p.weekTemplates!) for (const d of w.days) expect(d.minutes, `${w.focus} ${d.name}`).toBeLessThanOrEqual(80);
    const split = p.weekTemplates!.flatMap((w) => w.days.flatMap((d) => d.exercises)).filter((e) => /separate walk later in the day/.test(e.notes ?? ""));
    expect(split.length).toBeGreaterThan(0);
  });
});
