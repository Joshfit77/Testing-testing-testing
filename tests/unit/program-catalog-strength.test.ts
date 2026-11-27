import { EXERCISE_SLUGS } from "@/data/exercises";
import { CATALOG_STRENGTH } from "@/data/program-catalog/strength";
import { PROGRAMS } from "@/data/programs";
import { expandProgram } from "@/lib/domain/program-expansion";

const prescription = (w: ReturnType<typeof expandProgram>[number]) =>
  JSON.stringify(w.days.map((d) => d.exercises.map((e) => [e.ex, e.sets, e.reps, e.seconds, e.rest, e.rpe, e.intensity])));

describe("strength catalog additions", () => {
  it("contains catalog programs 1, 2 and 7, all in the library", () => {
    expect(CATALOG_STRENGTH.map((p) => p.catalogNumber)).toEqual([1, 2, 7]);
    for (const p of CATALOG_STRENGTH) expect(PROGRAMS.map((x) => x.slug), p.slug).toContain(p.slug);
  });

  for (const p of CATALOG_STRENGTH) {
    describe(p.slug, () => {
      const weeks = expandProgram(p);

      it("is a numbered Pro program with one milestone and one template per week", () => {
        expect(p.catalogNumber).toBeGreaterThan(0);
        expect(p.tier).toBe("pro");
        expect(p.milestones).toHaveLength(p.weeks);
        expect(p.weekTemplates).toHaveLength(p.weeks);
        expect(p.instructions!.length).toBeGreaterThanOrEqual(3);
        expect(p.instructions!.length).toBeLessThanOrEqual(6);
      });

      it("has a deload or a stated reason", () => {
        expect(weeks.some((w) => w.isDeload) || Boolean(p.noDeloadReason)).toBe(true);
      });

      it("uses only real exercises", () => {
        for (const w of weeks) for (const d of w.days) for (const e of d.exercises) expect(EXERCISE_SLUGS.has(e.ex), `w${w.weekNumber} ${d.name} ${e.ex}`).toBe(true);
      });

      it("progresses: week 1 and the last loading week differ in prescription", () => {
        const loading = weeks.filter((w) => !w.isDeload);
        expect(loading.length).toBeGreaterThan(1);
        expect(prescription(loading.at(-1)!)).not.toBe(prescription(weeks[0]!));
      });

      it("never repeats an identical week back to back", () => {
        for (let i = 1; i < weeks.length; i++) expect(prescription(weeks[i]!), `week ${i + 1}`).not.toBe(prescription(weeks[i - 1]!));
      });
    });
  }

  it("places the deloads and tests where the catalog says", () => {
    const deloads = (slug: string) => expandProgram(CATALOG_STRENGTH.find((p) => p.slug === slug)!).filter((w) => w.isDeload).map((w) => w.weekNumber);
    expect(deloads("beginner-strength-foundations-8-week")).toEqual([5]);
    expect(deloads("intermediate-strength-builder-upper-lower")).toEqual([4, 8]);
    expect(deloads("power-and-athletic-strength-10-week")).toEqual([5]);
    for (const p of CATALOG_STRENGTH) expect(p.weekTemplates!.at(-1)!.focus, p.slug).toMatch(/^Test week/);
  });
});
