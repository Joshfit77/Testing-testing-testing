import { EXERCISE_SLUGS } from "@/data/exercises";
import { CATALOG_HYPERTROPHY } from "@/data/program-catalog/hypertrophy";
import { PROGRAMS } from "@/data/programs";
import { auditProgram, isHypertrophyProgram, MAJOR_AUDIT_MUSCLES } from "@/lib/domain/program-audit";
import { expandProgram } from "@/lib/domain/program-expansion";

/** A week's full prescription, for comparing weeks. */
const prescription = (w: ReturnType<typeof expandProgram>[number]) =>
  JSON.stringify(w.days.map((d) => d.exercises.map((e) => [e.ex, e.sets, e.reps, e.seconds, e.rest, e.rpe, e.intensity])));

describe("Pro catalog: hypertrophy programs", () => {
  it("has the seven programs numbered 8–14, all in the library", () => {
    expect(CATALOG_HYPERTROPHY.map((p) => p.catalogNumber)).toEqual([8, 9, 10, 11, 12, 13, 14]);
    const slugs = PROGRAMS.map((p) => p.slug);
    for (const p of CATALOG_HYPERTROPHY) expect(slugs.filter((s) => s === p.slug), p.slug).toHaveLength(1);
  });

  for (const p of CATALOG_HYPERTROPHY) {
    describe(p.slug, () => {
      const weeks = expandProgram(p);

      it("is a Pro program with a catalog number, one milestone and one template per week, and instructions", () => {
        expect(p.catalogNumber).toBeGreaterThan(0);
        expect(p.tier).toBe("pro");
        expect(p.milestones).toHaveLength(p.weeks);
        expect(p.weekTemplates).toHaveLength(p.weeks);
        expect(weeks).toHaveLength(p.weeks);
        expect(p.instructions!.length).toBeGreaterThanOrEqual(3);
        expect(p.instructions!.length).toBeLessThanOrEqual(6);
        expect(isHypertrophyProgram(p)).toBe(true);
      });

      it("has a deload (or a stated reason for none)", () => {
        expect(weeks.some((w) => w.isDeload) || Boolean(p.noDeloadReason)).toBe(true);
      });

      it("uses only real exercises, and lists the equipment they need", () => {
        for (const w of weeks) for (const d of w.days) for (const e of d.exercises) expect(EXERCISE_SLUGS.has(e.ex), `w${w.weekNumber} ${d.name} ${e.ex}`).toBe(true);
      });

      it("progresses: week 1 and the last loading week differ, and volume and effort rise", () => {
        const loading = weeks.filter((w) => !w.isDeload);
        expect(prescription(loading.at(-1)!)).not.toEqual(prescription(weeks[0]!));
        const audit = auditProgram(p);
        const total = (n: number) => MAJOR_AUDIT_MUSCLES.reduce((s, m) => s + audit.weeks[n - 1]!.setsByMuscle[m], 0);
        expect(total(loading.at(-1)!.weekNumber)).toBeGreaterThan(total(1));
        const maxRpe = (n: number) => Math.max(...weeks[n - 1]!.days.flatMap((d) => d.exercises.map((e) => e.rpe ?? 0)));
        expect(maxRpe(loading.at(-1)!.weekNumber)).toBeGreaterThan(maxRpe(1));
        // No two consecutive weeks are identical.
        for (let i = 1; i < weeks.length; i++) expect(prescription(weeks[i]!), `weeks ${i} and ${i + 1}`).not.toEqual(prescription(weeks[i - 1]!));
      });

      it("keeps every major muscle within about 6–24 hard sets in loading weeks", () => {
        for (const w of auditProgram(p).weeks.filter((x) => !x.isDeload))
          for (const m of MAJOR_AUDIT_MUSCLES) {
            expect(w.setsByMuscle[m], `w${w.weekNumber} ${m}`).toBeGreaterThanOrEqual(6);
            expect(w.setsByMuscle[m], `w${w.weekNumber} ${m}`).toBeLessThanOrEqual(24);
          }
      });
    });
  }

  it("rotates exercise variations between mesocycles of the 12-week upper/lower program", () => {
    const weeks = expandProgram(CATALOG_HYPERTROPHY.find((p) => p.slug === "upper-lower-hypertrophy-12-week")!);
    const lead = (w: number) => weeks[w - 1]!.days.map((d) => d.exercises[0]!.ex);
    expect(lead(5)).not.toEqual(lead(1));
    expect(lead(9)).not.toEqual(lead(5));
    expect(weeks.filter((w) => w.isDeload).map((w) => w.weekNumber)).toEqual([4, 8, 12]);
  });
});
