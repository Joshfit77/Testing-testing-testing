import { EXERCISE_SLUGS } from "@/data/exercises";
import { ADOPTED_CATALOG } from "@/data/program-catalog/adopted";
import { CATALOG_AEROBIC_ENDURANCE } from "@/data/program-catalog/aerobic-endurance";
import { CATALOG_PROGRAMS } from "@/data/program-catalog";
import { PROGRAMS } from "@/data/programs";
import { programSimilarity } from "@/lib/domain/program-audit";
import { expandProgram, type ExpandedWeek } from "@/lib/domain/program-expansion";

const SLUG = "aerobic-endurance-builder-8-week";
const program = CATALOG_AEROBIC_ENDURANCE[0]!;
const weeks = expandProgram(program);

/** A week's prescription, without free-text notes, for comparing weeks. */
const prescription = (w: ExpandedWeek) => JSON.stringify(w.days.map((d) => d.exercises.map((e) => [e.ex, e.sets, e.reps, e.seconds, e.rest, e.rpe])));

/** Minutes of aerobic work in a week (easy sessions, strides and tempo; recoveries between reps not counted). */
const aerobicMinutes = (w: ExpandedWeek) =>
  w.days.flatMap((d) => d.exercises).filter((e) => ["zone-2-run", "running-intervals"].includes(e.ex)).reduce((s, e) => s + (e.seconds ?? 0) * e.sets, 0) / 60;

describe("Aerobic Endurance Builder (Pro #26)", () => {
  it("is one Pro program, registered in the catalog and library, and the only #26", () => {
    expect(CATALOG_AEROBIC_ENDURANCE).toHaveLength(1);
    expect(program.slug).toBe(SLUG);
    expect(program.catalogNumber).toBe(26);
    expect(program.tier).toBe("pro");
    expect(CATALOG_PROGRAMS.some((p) => p.slug === SLUG)).toBe(true);
    expect(PROGRAMS.filter((p) => p.catalogNumber === 26).map((p) => p.slug)).toEqual([SLUG]);
    const numbers = PROGRAMS.map((p) => p.catalogNumber).filter((n): n is number => n != null);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("no longer adopts the First 5K run/walk as #26, which stays in the library without a catalog number", () => {
    expect(ADOPTED_CATALOG["aerobic-base-run-walk"]).toBeUndefined();
    const old = PROGRAMS.find((p) => p.slug === "aerobic-base-run-walk");
    expect(old).toBeDefined();
    expect(old!.catalogNumber).toBeUndefined();
  });

  it("is complete: 8 weeks, one milestone per week, 3–6 instructions, bodyweight only", () => {
    expect(program.weeks).toBe(8);
    expect(weeks).toHaveLength(8);
    expect(program.weekTemplates).toHaveLength(8);
    expect(program.milestones).toHaveLength(8);
    for (const m of program.milestones!) {
      expect(m.trim().length).toBeGreaterThan(0);
      expect(m.length, m).toBeLessThanOrEqual(160);
    }
    expect(program.instructions!.length).toBeGreaterThanOrEqual(3);
    expect(program.instructions!.length).toBeLessThanOrEqual(6);
    expect(program.instructions!.join(" ")).toMatch(/talk test/);
    expect(program.instructions!.join(" ")).toMatch(/GPS run recorder/);
    expect(program.instructions!.join(" ")).toMatch(/chest pain/);
    expect(program.equipment).toEqual(["bodyweight"]);
    expect(program.warmup.length).toBeGreaterThan(0);
    expect(program.cooldown.length).toBeGreaterThan(0);
  });

  it("uses only real exercises, with rest stated, effort by RPE and no paces", () => {
    for (const w of weeks)
      for (const d of w.days)
        for (const e of d.exercises) {
          const label = `w${w.weekNumber} ${d.name} ${e.ex}`;
          expect(EXERCISE_SLUGS.has(e.ex), label).toBe(true);
          expect(e.rest, label).toBeTypeOf("number");
          expect(e.seconds, label).toBeGreaterThan(0);
          expect(e.rpe, label).toBeGreaterThanOrEqual(4);
          expect(e.rpe, label).toBeLessThanOrEqual(6);
          expect(`${e.notes} ${e.intensity ?? ""}`, label).not.toMatch(/\/km|\/mile|min\/|pace of|km\/h|mph/i);
        }
  });

  it("has three core days a week and a long easy session every week", () => {
    for (const w of weeks) {
      expect(w.days, `week ${w.weekNumber}`).toHaveLength(3);
      const sat = w.days[2]!.exercises[0]!;
      expect(sat.ex).toBe("zone-2-run");
      expect(sat.seconds!, `week ${w.weekNumber}`).toBeGreaterThanOrEqual(Math.max(...w.days.slice(0, 2).map((d) => d.exercises[0]!.seconds!)));
    }
  });

  it("progresses for real: more weekly time, at most ~10% per full week, a lighter week 4 and an easier final week with a 30-minute check", () => {
    const mins = weeks.map(aerobicMinutes);
    const peak = Math.max(...mins);
    expect(mins[0]!).toBeLessThan(peak);
    expect(peak / mins[0]!).toBeGreaterThanOrEqual(1.3);
    expect(weeks.filter((w) => w.isDeload).map((w) => w.weekNumber)).toEqual([4, 8]);
    // The cutback week is lower than the week before it, and the final week is lower than week 7.
    expect(mins[3]!).toBeLessThan(mins[2]!);
    expect(mins[3]! / mins[2]!).toBeLessThanOrEqual(0.8);
    expect(mins[7]!).toBeLessThan(mins[6]!);
    // Each full week is at most about 10% above the previous full week (so week 5 is compared with week 3).
    let prev = 0;
    for (const w of weeks) {
      if (w.isDeload) continue;
      const m = mins[w.weekNumber - 1]!;
      if (prev) expect(m / prev, `week ${w.weekNumber}`).toBeLessThanOrEqual(1.1);
      prev = m;
    }
    // The long session grows from 35 to 55 minutes; steady tempo appears only from week 5.
    const long = weeks.map((w) => w.days[2]!.exercises[0]!.seconds! / 60);
    expect(long.slice(0, 3)).toEqual([35, 38, 42]);
    expect(long[6]).toBe(55);
    const tempoWeeks = weeks.filter((w) => w.days[1]!.exercises.some((e) => e.ex === "running-intervals")).map((w) => w.weekNumber);
    expect(tempoWeeks).toEqual([5, 6, 7]);
    expect(weeks[7]!.days[2]).toMatchObject({ name: "Sat · 30-Minute Aerobic Check" });
    expect(weeks[7]!.days[2]!.exercises[0]).toMatchObject({ ex: "zone-2-run", seconds: 1800 });
    // Week 1 and the last loading week are prescribed differently, and no two consecutive weeks are identical.
    expect(prescription(weeks[6]!)).not.toBe(prescription(weeks[0]!));
    for (let i = 1; i < weeks.length; i++) expect(prescription(weeks[i]!), `week ${i + 1}`).not.toBe(prescription(weeks[i - 1]!));
  });

  it("states session lengths from the prescription", () => {
    const mean = weeks[0]!.days.reduce((s, d) => s + d.minutes, 0) / weeks[0]!.days.length;
    expect(Math.abs(program.sessionMinutes - mean)).toBeLessThanOrEqual(5);
    // Later weeks are longer than week 1 (the long session especially).
    expect(weeks[6]!.days[2]!.minutes).toBeGreaterThan(weeks[0]!.days[2]!.minutes);
  });

  it("differs from the beginner run/walk to 5K (#22): no run/walk intervals, a different length and weekly structure", () => {
    const rw = PROGRAMS.find((p) => p.slug === "beginner-run-walk-5k-10-week")!;
    expect(rw).toBeDefined();
    expect(program.slug).not.toBe(rw.slug);
    expect(program.catalogNumber).not.toBe(rw.catalogNumber);
    expect(program.weeks).not.toBe(rw.weeks);
    const rwWeeks = expandProgram(rw);
    const used = new Set(weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.ex))));
    expect(used.has("run-walk-intervals")).toBe(false);
    expect(rwWeeks[0]!.days[0]!.exercises[0]!.ex).toBe("run-walk-intervals");
    // Week 1 starts with continuous sessions of 25+ minutes, where #22 starts with 1-minute bouts.
    for (const d of weeks[0]!.days) expect(d.exercises[0]).toMatchObject({ ex: "zone-2-run", sets: 1 });
    expect(Math.min(...weeks[0]!.days.map((d) => d.exercises[0]!.seconds!))).toBeGreaterThanOrEqual(25 * 60);
    expect(weeks[0]!.days.map((d) => d.name)).not.toEqual(rwWeeks[0]!.days.map((d) => d.name));
    expect(prescription(weeks[0]!)).not.toBe(prescription(rwWeeks[0]!));
    expect(programSimilarity(program, rw)).toBeLessThan(0.2);
    expect(programSimilarity(program, PROGRAMS.find((p) => p.slug === "aerobic-base-run-walk")!)).toBeLessThan(0.2);
  });
});
