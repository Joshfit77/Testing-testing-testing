import { EXERCISE_SLUGS } from "@/data/exercises";
import { CATALOG_ENDURANCE_MOBILITY } from "@/data/program-catalog/endurance-mobility";
import { PROGRAMS } from "@/data/programs";
import { expandProgram, type ExpandedWeek } from "@/lib/domain/program-expansion";

const programs = CATALOG_ENDURANCE_MOBILITY;
const bySlug = (slug: string) => programs.find((p) => p.slug === slug)!;

/** A week's prescription, without free-text notes, for comparing weeks. */
const prescription = (w: ExpandedWeek) => JSON.stringify(w.days.map((d) => d.exercises.map((e) => [e.ex, e.sets, e.reps, e.seconds, e.rest, e.rpe])));

/** Minutes of running (run portions only) in a week. */
const runningMinutes = (w: ExpandedWeek) =>
  w.days.flatMap((d) => d.exercises).filter((e) => ["zone-2-run", "run-walk-intervals", "running-intervals"].includes(e.ex)).reduce((s, e) => s + (e.seconds ?? 0) * e.sets, 0) / 60;

describe("endurance, conditioning and mobility catalog (Pro #22, #27–#32)", () => {
  it("has the seven programs with their catalog numbers, all Pro and all in the library", () => {
    expect(programs.map((p) => p.catalogNumber)).toEqual([22, 27, 28, 29, 30, 31, 32]);
    for (const p of programs) {
      expect(p.tier, p.slug).toBe("pro");
      expect(PROGRAMS.some((x) => x.slug === p.slug), p.slug).toBe(true);
    }
  });

  it.each(programs.map((p) => [p.slug, p] as const))("%s: complete, real and progressive", (_slug, p) => {
    expect(p.catalogNumber).toBeTypeOf("number");
    expect(p.milestones).toHaveLength(p.weeks);
    expect(p.weekTemplates).toHaveLength(p.weeks);
    expect(p.instructions!.length).toBeGreaterThanOrEqual(3);
    expect(p.instructions!.length).toBeLessThanOrEqual(6);
    const weeks = expandProgram(p);
    expect(weeks.some((w) => w.isDeload) || Boolean(p.noDeloadReason)).toBe(true);
    for (const w of weeks) for (const d of w.days) for (const e of d.exercises) expect(EXERCISE_SLUGS.has(e.ex), `${w.weekNumber} ${d.name} ${e.ex}`).toBe(true);
    // Every exercise has a rest period stated.
    for (const w of weeks) for (const d of w.days) for (const e of d.exercises) expect(e.rest).toBeTypeOf("number");
    // Real progression: week 1 and the last loading week are prescribed differently.
    const lastLoading = weeks.filter((w) => !w.isDeload).at(-1)!;
    expect(lastLoading.weekNumber).toBeGreaterThan(1);
    expect(prescription(lastLoading)).not.toBe(prescription(weeks[0]!));
    // No two consecutive weeks are identical.
    for (let i = 1; i < weeks.length; i++) expect(prescription(weeks[i]!), `week ${i + 1}`).not.toBe(prescription(weeks[i - 1]!));
  });

  it("run/walk to 5K starts with 1-minute runs, lightens in weeks 4 and 8, raises running time gradually and ends with 30 minutes continuous", () => {
    const weeks = expandProgram(bySlug("beginner-run-walk-5k-10-week"));
    expect(weeks[0]!.days).toHaveLength(3);
    expect(weeks[0]!.days[0]!.exercises[0]).toMatchObject({ ex: "run-walk-intervals", seconds: 60, rest: 90 });
    expect(weeks.filter((w) => w.isDeload).map((w) => w.weekNumber)).toEqual([4, 8]);
    let best = 0;
    for (const w of weeks) {
      const mins = runningMinutes(w);
      if (best && !w.isDeload) expect(mins / best, `week ${w.weekNumber}`).toBeLessThanOrEqual(1.15);
      if (w.isDeload) expect(mins, `week ${w.weekNumber}`).toBeLessThan(best);
      if (!w.isDeload) best = Math.max(best, mins);
    }
    expect(weeks[9]!.days[2]!.exercises[0]).toMatchObject({ ex: "zone-2-run", seconds: 1800 });
    expect(bySlug("beginner-run-walk-5k-10-week").instructions!.join(" ")).toMatch(/Walking-only/);
  });

  it("hybrid plan runs 3 strength + 2 run days with no hard run the day after heavy legs, and weekly running up ≤ 10%", () => {
    const weeks = expandProgram(bySlug("hybrid-strength-run-12-week"));
    expect(weeks[0]!.days.map((d) => d.name.slice(0, 3))).toEqual(["Mon", "Tue", "Wed", "Fri", "Sat"]);
    expect(weeks.filter((w) => w.isDeload).map((w) => w.weekNumber)).toEqual([4, 8, 12]);
    let best = 0;
    for (const w of weeks) {
      const mins = runningMinutes(w);
      if (best && !w.isDeload) expect(mins / best, `week ${w.weekNumber}`).toBeLessThanOrEqual(1.1);
      if (!w.isDeload) best = Math.max(best, mins);
      // The only hard run is Wednesday, and Tuesday has no heavy leg work.
      expect(w.days[1]!.exercises.some((e) => ["back-squat", "conventional-deadlift"].includes(e.ex))).toBe(false);
    }
    const squat = (n: number) => weeks[n - 1]!.days[0]!.exercises[0]!;
    expect(squat(1)).toMatchObject({ ex: "back-squat", reps: "6", rpe: 7 });
    expect(squat(11)).toMatchObject({ ex: "back-squat", reps: "3", rpe: 9 });
  });

  it("conditioning tightens work:rest on the bike from 1:3 to 1:1 and on the circuit from 20:40 to 40:20", () => {
    const weeks = expandProgram(bySlug("conditioning-intervals-8-week"));
    const bike = (n: number) => weeks[n - 1]!.days[0]!.exercises[0]!;
    const swing = (n: number) => weeks[n - 1]!.days[1]!.exercises[0]!;
    expect(bike(1).rest / bike(1).seconds!).toBe(3);
    expect(bike(7).rest / bike(7).seconds!).toBe(1);
    expect([swing(1).seconds, swing(1).rest]).toEqual([20, 40]);
    expect([swing(7).seconds, swing(7).rest]).toEqual([40, 20]);
    expect(weeks.filter((w) => w.isDeload).map((w) => w.weekNumber)).toEqual([4, 8]);
  });

  it("mobility, core and recovery give holds in seconds that grow, and say they are not rehabilitation", () => {
    const mob = expandProgram(bySlug("full-body-mobility-6-week"));
    const couch = (n: number) => mob[n - 1]!.days[0]!.exercises.find((e) => e.ex === "couch-stretch")!;
    expect(couch(6).seconds! * couch(6).sets).toBeGreaterThan(couch(1).seconds! * couch(1).sets);
    expect(mob[0]!.days).toHaveLength(5);
    for (const d of mob[0]!.days) expect(d.minutes, d.name).toBeGreaterThanOrEqual(15);
    for (const d of mob[5]!.days) expect(d.minutes, d.name).toBeLessThanOrEqual(25);
    const core = expandProgram(bySlug("core-strength-stability-8-week"));
    const plank = (n: number) => core[n - 1]!.days[0]!.exercises.find((e) => e.ex === "plank")!.seconds!;
    expect(plank(3)).toBeGreaterThan(plank(1));
    const used = new Set(core.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.ex))));
    for (const ex of ["plank", "side-plank", "dead-bug", "bird-dog", "pallof-press", "ab-wheel-rollout", "suitcase-carry", "copenhagen-plank"]) expect(used.has(ex), ex).toBe(true);
    for (const slug of ["full-body-mobility-6-week", "flexibility-recovery-routines"]) expect(bySlug(slug).description, slug).toMatch(/not rehabilitation/);
    const rec = expandProgram(bySlug("flexibility-recovery-routines"));
    expect(rec[0]!.days).toHaveLength(4);
    expect(rec[5]!.days[0]!.exercises[0]!.seconds!).toBeGreaterThan(rec[0]!.days[0]!.exercises[0]!.seconds!);
  });

  it("movement quality moves from bodyweight to light load at a slow tempo", () => {
    const weeks = expandProgram(bySlug("movement-quality-foundations"));
    expect(weeks[0]!.days[0]!.exercises[0]!.ex).toBe("bodyweight-squat");
    expect(weeks[2]!.days[0]!.exercises[0]!.ex).toBe("goblet-squat");
    expect(weeks[0]!.days[0]!.exercises[0]!.notes).toMatch(/Tempo 3-1-1/);
    expect(weeks.at(-1)!.isDeload).toBe(true);
  });
});
