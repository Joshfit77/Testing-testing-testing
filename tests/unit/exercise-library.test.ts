import { describe, expect, it } from "vitest";
import { EXERCISE_DETAILS, LIBRARY_GROUPS } from "@/data/exercise-details";
import { EXERCISE_MOTIONS } from "@/data/exercise-motions";
import { EXERCISES, EXERCISE_SLUGS } from "@/data/exercises";
import { demoReadiness, ownerApproved } from "@/lib/exercise-demo-readiness";
import { normalize } from "@/lib/domain/exercise-search";

/**
 * The expanded library (2026-11-13): at least 200 distinct exercises, each fully documented, with a hand-built 2D
 * motion and an honest readiness status. Automated checks can't establish biomechanical accuracy; they only make sure
 * nothing is missing, duplicated or mislabelled (see docs/pro/EXERCISE_LIBRARY.md for the review status).
 */
describe("exercise library", () => {
  it("has at least 200 unique exercises with unique ids and names", () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(200);
    expect(EXERCISE_SLUGS.size).toBe(EXERCISES.length);
    expect(new Set(EXERCISES.map((e) => normalize(e.name))).size).toBe(EXERCISES.length);
  });

  it("documents every exercise completely", () => {
    for (const e of EXERCISES) {
      const d = EXERCISE_DETAILS[e.slug];
      expect(d, e.slug).toBeTruthy();
      expect(LIBRARY_GROUPS).toContain(d!.group);
      expect(d!.start.length, `${e.slug} start`).toBeGreaterThan(10);
      expect(d!.breathing.length, `${e.slug} breathing`).toBeGreaterThan(10);
      expect(d!.rangeOfMotion.length, `${e.slug} range`).toBeGreaterThan(10);
      expect(d!.setup.length, `${e.slug} setup`).toBeGreaterThanOrEqual(1);
      expect(d!.setup.length).toBeLessThanOrEqual(3);
      expect(typeof d!.home).toBe("boolean");
      // Aliases are other names, never the exercise's own.
      for (const a of d!.aliases) expect(normalize(a), `${e.slug} alias`).not.toBe(normalize(e.name));
      expect(e.primary.length, `${e.slug} primary`).toBeGreaterThan(0);
      expect(e.equipment.length, `${e.slug} equipment`).toBeGreaterThan(0);
      expect(e.instructions.length, `${e.slug} instructions`).toBeGreaterThanOrEqual(3);
      expect(e.mistakes.length, `${e.slug} mistakes`).toBeGreaterThanOrEqual(2);
      for (const alt of e.alternatives) expect(EXERCISE_SLUGS.has(alt), `${e.slug} → ${alt}`).toBe(true);
    }
    // No details for exercises that don't exist.
    for (const slug of Object.keys(EXERCISE_DETAILS)) expect(EXERCISE_SLUGS.has(slug), slug).toBe(true);
  });

  it("covers every library group", () => {
    const counts = Object.fromEntries(LIBRARY_GROUPS.map((g) => [g, EXERCISES.filter((e) => EXERCISE_DETAILS[e.slug]?.group === g).length]));
    for (const g of LIBRARY_GROUPS) expect(counts[g], g).toBeGreaterThanOrEqual(8);
  });

  it("gives every exercise its own motion and never presents an unreviewed demo as approved", () => {
    for (const e of EXERCISES) expect(EXERCISE_MOTIONS[e.slug], e.slug).toBeTypeOf("function");
    for (const e of EXERCISES) expect(ownerApproved(e.slug)).toBe(false);
    // The bench dip's drawing is not accurate yet, so it shows the labelled placeholder.
    expect(demoReadiness("bench-dip")).toBe("placeholder");
  });

  it("keeps distinct lifts distinct (conventional deadlift, RDL and back squat each have their own motion)", () => {
    const a = EXERCISE_MOTIONS["conventional-deadlift"]!("a");
    const b = EXERCISE_MOTIONS["romanian-deadlift"]!("b");
    const c = EXERCISE_MOTIONS["back-squat"]!("c");
    expect(JSON.stringify(a.keyframes)).not.toBe(JSON.stringify(b.keyframes));
    expect(JSON.stringify(a.keyframes)).not.toBe(JSON.stringify(c.keyframes));
  });
});
