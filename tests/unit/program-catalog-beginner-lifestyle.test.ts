import { EXERCISE_SLUGS } from "@/data/exercises";
import { CATALOG_BEGINNER_LIFESTYLE } from "@/data/program-catalog/beginner-lifestyle";
import { PROGRAMS } from "@/data/programs";
import { expandProgram } from "@/lib/domain/program-expansion";
import { estimateSessionMinutes, framingMinutes } from "@/lib/domain/session-time";

const bySlug = (slug: string) => CATALOG_BEGINNER_LIFESTYLE.find((p) => p.slug === slug)!;
/** A week's prescription as comparable text (exercise, sets, reps or time, rest, RPE). */
const prescription = (w: ReturnType<typeof expandProgram>[number]) =>
  JSON.stringify(w.days.map((d) => d.exercises.map((e) => [e.ex, e.sets, e.reps, e.seconds, e.rest, e.rpe])));

describe("beginner & lifestyle Pro catalog programs", () => {
  it("has the five assigned programs with their catalog numbers", () => {
    expect(CATALOG_BEGINNER_LIFESTYLE.map((p) => p.catalogNumber)).toEqual([15, 16, 17, 20, 21]);
    expect(bySlug("full-body-fitness-foundations").catalogNumber).toBe(16);
    for (const p of CATALOG_BEGINNER_LIFESTYLE) expect(PROGRAMS.filter((x) => x.slug === p.slug), p.slug).toHaveLength(1);
  });

  it.each(CATALOG_BEGINNER_LIFESTYLE.map((p) => [p.slug, p] as const))("%s is a complete, progressive Pro program", (_slug, p) => {
    expect(p.catalogNumber).toBeDefined();
    expect(p.tier).toBe("pro");
    expect(p.milestones).toHaveLength(p.weeks);
    expect(p.weekTemplates).toHaveLength(p.weeks);
    expect(p.instructions!.length).toBeGreaterThanOrEqual(3);
    expect(p.instructions!.length).toBeLessThanOrEqual(6);
    const weeks = expandProgram(p);
    expect(weeks.some((w) => w.isDeload) || Boolean(p.noDeloadReason)).toBe(true);
    for (const w of weeks) for (const d of w.days) for (const e of d.exercises) expect(EXERCISE_SLUGS.has(e.ex), `${p.slug} w${w.weekNumber} ${e.ex}`).toBe(true);
    const lastLoading = weeks.filter((w) => !w.isDeload).at(-1)!;
    expect(lastLoading.weekNumber).toBeGreaterThan(1);
    expect(prescription(lastLoading)).not.toBe(prescription(weeks[0]!));
    // No two consecutive loading weeks are identical.
    for (let i = 1; i < weeks.length; i++) if (!weeks[i]!.isDeload) expect(prescription(weeks[i]!), `${p.slug} week ${i + 1}`).not.toBe(prescription(weeks[i - 1]!));
  });

  it("first 30 days starts with two sets at RPE 6 and builds gradually", () => {
    const weeks = expandProgram(bySlug("first-30-days-in-the-gym"));
    for (const d of weeks[0]!.days)
      for (const e of d.exercises.filter((x) => x.rpe !== undefined && x.ex !== "brisk-walk" && x.ex !== "bike-intervals" && x.ex !== "rowing-intervals")) {
        expect(e.sets).toBe(2);
        expect(e.rpe).toBe(6);
      }
    expect(Math.max(...weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.rpe ?? 0))))).toBeLessThanOrEqual(7.5);
  });

  it("busy schedule sessions all fit in 30 minutes including the warm-up", () => {
    for (const w of expandProgram(bySlug("busy-schedule-30-minute-workouts")))
      for (const d of w.days) {
        expect(d.minutes, `w${w.weekNumber} ${d.name}`).toBeLessThanOrEqual(30);
        expect(estimateSessionMinutes(d.exercises, framingMinutes(d.warmup, d.cooldown)), `w${w.weekNumber} ${d.name}`).toBeLessThanOrEqual(30);
      }
  });

  it("active aging is low impact, flagged for review and has balance work in every session", () => {
    const p = bySlug("active-aging-strength-and-balance");
    expect(p.lowImpact).toBe(true);
    expect(p.needsSpecialistReview).toBe(true);
    for (const w of expandProgram(p))
      for (const d of w.days) {
        expect(d.exercises.some((e) => e.ex === "single-leg-balance"), `w${w.weekNumber} ${d.name}`).toBe(true);
        expect(d.exercises.some((e) => ["box-jump", "broad-jump", "burpee", "pogo-jumps", "jump-rope"].includes(e.ex))).toBe(false);
      }
    expect(p.instructions!.join(" ")).toMatch(/2-day option/);
  });

  it("fat-loss program leaves nutrition to the app's targets and offers a 3-day option", () => {
    const p = bySlug("strength-for-fat-loss");
    expect(p.instructions!.join(" ")).toMatch(/3-day option/);
    expect(p.instructions!.join(" ")).toMatch(/app's calorie and protein targets/);
  });
});
