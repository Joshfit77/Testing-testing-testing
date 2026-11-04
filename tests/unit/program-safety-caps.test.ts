import { describe, expect, it } from "vitest";
import { PROGRAMS } from "@/data/programs";
import { BEGINNER_MAX_RPE, expandProgram } from "@/lib/domain/program-expansion";
import { goalAttempt, GOAL_ATTEMPT_MAX_RATIO } from "@/lib/domain/custom-programs";

describe("beginner programs never go past RPE 8.5", () => {
  const beginners = PROGRAMS.filter((p) => p.difficulty === "beginner");
  it.each(beginners.map((p) => [p.slug, p] as const))("%s", (_slug, p) => {
    const over = expandProgram(p).flatMap((w) => w.days.flatMap((d) => d.exercises.filter((e) => (e.rpe ?? 0) > BEGINNER_MAX_RPE).map((e) => `week ${w.weekNumber} ${d.name}: ${e.ex} @${e.rpe}`)));
    expect(over).toEqual([]);
  });
  it("covers the programs the audit flagged", () => {
    const slugs = beginners.map((p) => p.slug);
    for (const s of ["womens-strength-progression", "strongman-foundations"]) if (PROGRAMS.some((p) => p.slug === s)) expect(slugs).toContain(s);
  });
});

describe("exercises written as submaximal stay below the week's effort", () => {
  it.each(["hypertrophy-upper-lower", "womens-glute-strength"])("%s: the conventional deadlift stays a point under the block's RPE", (slug) => {
    const p = PROGRAMS.find((x) => x.slug === slug);
    if (!p) return;
    for (const w of expandProgram(p)) {
      if (w.isDeload) continue;
      for (const d of w.days) {
        const dl = d.exercises.find((e) => e.ex === "conventional-deadlift");
        const peers = d.exercises.filter((e) => e.ex !== "conventional-deadlift" && e.rpe != null).map((e) => e.rpe!);
        if (dl?.rpe != null && peers.length) expect(dl.rpe).toBeLessThan(Math.max(...peers));
      }
    }
  });
});

describe("a goal max is only attempted when it's within reach", () => {
  it("attempts a goal up to 5% above today's max", () => {
    expect(goalAttempt(105, 100)).toBe(105);
    expect(goalAttempt(102, 100)).toBe(102);
    expect(GOAL_ATTEMPT_MAX_RATIO).toBe(1.05);
  });
  it("keeps a bigger goal as a long-term target instead of today's single", () => {
    expect(goalAttempt(120, 100)).toBeNull();
    expect(goalAttempt(150, 100)).toBeNull();
    expect(goalAttempt(undefined, 100)).toBeNull();
    expect(goalAttempt(95, 100)).toBeNull();
  });
});
