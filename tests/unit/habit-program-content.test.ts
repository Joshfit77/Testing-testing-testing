import { describe, expect, it } from "vitest";
import { getHabitProgram, HABIT_PROGRAMS } from "@/data/habit-programs";
import { bookBySlug } from "@/lib/bible/books";
import { validateHabitProgram, type HabitActivity } from "@/lib/domain/habit-programs";

const SPEC: Record<string, { days: number; weeks: number; category: string }> = {
  "nutrition-foundations": { days: 28, weeks: 4, category: "nutrition" },
  "sustainable-fat-loss": { days: 84, weeks: 12, category: "nutrition" },
  "muscle-gain-nutrition": { days: 56, weeks: 8, category: "nutrition" },
  "meal-prep-protein": { days: 42, weeks: 6, category: "nutrition" },
  "faith-fitness-foundations": { days: 56, weeks: 8, category: "faith_fitness" },
  "strength-and-scripture": { days: 84, weeks: 12, category: "faith_fitness" },
  "healthy-habits-90": { days: 90, weeks: 13, category: "lifestyle" },
};

const activities = (slug: string): HabitActivity[] => getHabitProgram(slug)!.weeks.flatMap((w) => [...w.daily, ...w.weekly]);

describe("habit program content", () => {
  it("has the seven programs with unique slugs", () => {
    expect(HABIT_PROGRAMS).toHaveLength(7);
    const slugs = HABIT_PROGRAMS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(7);
    expect(slugs.sort()).toEqual(Object.keys(SPEC).sort());
  });

  it.each(HABIT_PROGRAMS.map((p) => [p.slug, p] as const))("%s is structurally valid and matches its spec", (slug, p) => {
    const spec = SPEC[slug]!;
    expect(validateHabitProgram(p)).toEqual([]);
    expect(p.days).toBe(spec.days);
    expect(p.weeks).toHaveLength(spec.weeks);
    expect(p.category).toBe(spec.category);
    expect(p.instructions.length).toBeGreaterThanOrEqual(3);
    expect(p.instructions.length).toBeLessThanOrEqual(6);
    for (const w of p.weeks) {
      expect(w.lesson.body.length).toBeGreaterThanOrEqual(2);
      const checkin = w.weekly.find((a) => a.kind === "checkin");
      expect(checkin?.questions?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
    // Weeks progress rather than repeat: every week has its own title and objective.
    expect(new Set(p.weeks.map((w) => w.title)).size).toBe(p.weeks.length);
    expect(new Set(p.weeks.map((w) => w.objective)).size).toBe(p.weeks.length);
  });

  it("links every Bible reference to an existing book and chapter", () => {
    const refs = HABIT_PROGRAMS.flatMap((p) => p.weeks.flatMap((w) => [...w.daily, ...w.weekly]))
      .map((a) => a.href)
      .filter((h): h is string => !!h && h.startsWith("/faith/bible/"));
    expect(refs.length).toBeGreaterThan(100);
    for (const href of refs) {
      const m = /^\/faith\/bible\/([a-z0-9-]+)\/(\d+)$/.exec(href);
      expect(m, href).not.toBeNull();
      const book = bookBySlug(m![1]!);
      expect(book, href).toBeDefined();
      const chapter = Number(m![2]);
      expect(chapter, href).toBeGreaterThanOrEqual(1);
      expect(chapter, href).toBeLessThanOrEqual(book!.chapters);
    }
  });

  it("flags nutrition programs and the 90-day journey for dietitian review", () => {
    for (const slug of ["nutrition-foundations", "sustainable-fat-loss", "muscle-gain-nutrition", "meal-prep-protein", "healthy-habits-90"]) {
      expect(getHabitProgram(slug)?.needsProfessionalReview?.who, slug).toBe("Registered dietitian");
      expect(getHabitProgram(slug)?.needsProfessionalReview?.why.length, slug).toBeGreaterThan(20);
    }
  });

  it("faith programs carry the faith note, link their training program and keep faith activities optional", () => {
    const faith = HABIT_PROGRAMS.filter((p) => p.category === "faith_fitness");
    expect(faith.map((p) => p.slug).sort()).toEqual(["faith-fitness-foundations", "strength-and-scripture"]);
    for (const p of faith) expect(p.faithNote).toMatch(/never a measure of your spiritual standing/);
    expect(getHabitProgram("faith-fitness-foundations")?.linkedProgramSlug).toBe("full-body-fitness-foundations");
    expect(getHabitProgram("strength-and-scripture")?.linkedProgramSlug).toBe("intermediate-strength-builder");
    expect(activities("faith-fitness-foundations").find((a) => a.kind === "workout")?.onDays).toEqual([1, 3, 5]);
    expect(activities("strength-and-scripture").find((a) => a.kind === "workout")?.onDays).toEqual([1, 2, 4, 5]);
    for (const p of HABIT_PROGRAMS) {
      for (const w of p.weeks) {
        for (const a of [...w.daily, ...w.weekly]) {
          if (a.kind === "scripture" || a.kind === "prayer" || a.kind === "reflection") expect(a.optional, `${p.slug} ${a.key}`).toBe(true);
          if (a.kind === "reflection") expect(a.href).toBe("/faith/journal/new");
        }
      }
    }
  });

  it("strength-and-scripture has a weekly memory verse and healthy-habits-90 lets members pick 2–4 workouts", () => {
    for (const w of getHabitProgram("strength-and-scripture")!.weeks) expect(w.weekly.some((a) => a.key === "memory-verse" && a.optional)).toBe(true);
    const hh = getHabitProgram("healthy-habits-90")!;
    expect(hh.goalFields.find((g) => g.key === "workouts_per_week")).toMatchObject({ min: 2, max: 4 });
  });

  it("uses only known in-app links", () => {
    const allowed = /^\/(nutrition(\/(planner|grocery|recipes))?|train(\/programs)?|run|progress\/sleep|faith(\/journal\/new)?|faith\/bible\/[a-z0-9-]+\/\d+)$/;
    for (const p of HABIT_PROGRAMS) for (const a of p.weeks.flatMap((w) => [...w.daily, ...w.weekly])) if (a.href) expect(a.href, `${p.slug} ${a.key}`).toMatch(allowed);
  });
});
