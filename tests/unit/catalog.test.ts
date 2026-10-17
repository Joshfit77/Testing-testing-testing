import { EXERCISES, EXERCISE_SLUGS } from "@/data/exercises";
import { PROGRAM_CATEGORIES, PROGRAMS } from "@/data/programs";
import { SCRIPTURES, scriptureForDate } from "@/data/content";
import { expandProgram } from "@/lib/domain/program-expansion";

describe("exercise catalog", () => {
  it("has at least 60 unique, fully described exercises", () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(60);
    expect(EXERCISE_SLUGS.size).toBe(EXERCISES.length);
    for (const e of EXERCISES) {
      expect(e.instructions.length, e.slug).toBeGreaterThanOrEqual(3);
      expect(e.cues.length, e.slug).toBeGreaterThanOrEqual(2);
      expect(e.mistakes.length, e.slug).toBeGreaterThanOrEqual(2);
      expect(e.primary.length, e.slug).toBeGreaterThan(0);
      expect(e.equipment.length, e.slug).toBeGreaterThan(0);
      expect(e.description.length, e.slug).toBeGreaterThan(10);
    }
  });
  it("only references alternatives that exist", () => {
    for (const e of EXERCISES) {
      for (const alt of e.alternatives) {
        expect(EXERCISE_SLUGS.has(alt), `${e.slug} → ${alt}`).toBe(true);
        expect(alt).not.toBe(e.slug);
      }
    }
  });
});

describe("program library", () => {
  it("defines at least 8 complete programs across all required categories", () => {
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(8);
    const categories = new Set(PROGRAM_CATEGORIES.map((c) => c.slug));
    expect(categories.size).toBe(23);
    for (const c of categories) expect(PROGRAMS.some((p) => p.category === c), c).toBe(true);
  });
  it("references only real exercises with complete prescriptions", () => {
    for (const p of PROGRAMS) {
      expect(p.days.length, p.slug).toBeGreaterThan(0);
      expect(p.days.length, p.slug).toBeLessThanOrEqual(7);
      expect(p.warmup.length, p.slug).toBeGreaterThan(0);
      expect(p.cooldown.length, p.slug).toBeGreaterThan(0);
      expect(p.progression.length, p.slug).toBeGreaterThan(10);
      for (const d of p.days) {
        for (const ex of d.exercises) {
          expect(EXERCISE_SLUGS.has(ex.ex), `${p.slug}: ${ex.ex}`).toBe(true);
          expect(Boolean(ex.reps) || Boolean(ex.seconds), `${p.slug}: ${ex.ex}`).toBe(true);
          expect(ex.sets).toBeGreaterThan(0);
        }
      }
    }
  });
  it("has some free starter programs and some paid ones", () => {
    expect(PROGRAMS.filter((p) => p.tier === "free").length).toBeGreaterThanOrEqual(3);
    expect(PROGRAMS.filter((p) => p.tier !== "free").length).toBeGreaterThanOrEqual(5);
  });
  it("expands weeks with a final deload when configured", () => {
    const p = PROGRAMS.find((x) => x.slug === "barbell-strength-foundations")!;
    const weeks = expandProgram(p);
    expect(weeks).toHaveLength(p.weeks);
    expect(weeks.at(-1)!.isDeload).toBe(true);
    const firstSquat = weeks[0]!.days[0]!.exercises[0]!;
    const laterSquat = weeks[3]!.days[0]!.exercises[0]!;
    expect(laterSquat.rpe!).toBeGreaterThan(firstSquat.rpe!);
    const deloadSquat = weeks.at(-1)!.days[0]!.exercises[0]!;
    expect(deloadSquat.sets).toBeLessThan(firstSquat.sets);
  });
});

describe("scripture", () => {
  it("is deterministic per date and attributed", () => {
    expect(scriptureForDate("2026-10-16")).toBe(scriptureForDate("2026-10-16"));
    for (const s of SCRIPTURES) {
      expect(s.reference).toMatch(/\d/);
      expect(s.text.length).toBeGreaterThan(20);
    }
  });
});
