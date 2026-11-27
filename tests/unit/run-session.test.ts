import { describe, expect, it } from "vitest";
import { buildScript, completedSets, distanceGoalProgress, isRunDay, phaseAt, raceGoalProgress, scriptSeconds, weeklyDistanceSeries, type RunPrescription } from "@/lib/domain/run-session";
import { PROGRAMS } from "@/data/programs";

const runWalk: RunPrescription = { exerciseId: "e1", slug: "run-walk-intervals", name: "Run/Walk Intervals", sets: 3, seconds: 60, rest: 90 };
const easy: RunPrescription = { exerciseId: "e2", slug: "zone-2-run", name: "Easy Run", sets: 1, seconds: 600, rest: 0 };

describe("guided running sessions", () => {
  it("turns run/walk intervals into a timed script with a warm-up and cool-down", () => {
    const s = buildScript([runWalk]);
    expect(s.map((p) => `${p.kind}:${p.seconds}`)).toEqual(["warmup:300", "run:60", "walk:90", "run:60", "walk:90", "run:60", "cooldown:300"]);
    expect(scriptSeconds(s)).toBe(960);
  });

  it("knows where you are, counting moving time only, and what was completed", () => {
    const s = buildScript([runWalk, easy]);
    expect(phaseAt(s, 0)).toMatchObject({ index: 0, remaining: 300 });
    expect(phaseAt(s, 330)).toMatchObject({ phase: { kind: "run" }, remaining: 30 });
    expect(phaseAt(s, 380)).toMatchObject({ phase: { kind: "walk", label: "Walk" } });
    expect(completedSets(s, 2, 359)).toEqual([0, 0]);
    expect(completedSets(s, 2, 360)).toEqual([1, 0]);
    // After the intervals and the 10-minute easy run, before the cool-down ends.
    expect(completedSets(s, 2, 300 + 60 * 3 + 90 * 3 + 600)).toEqual([3, 1]);
    expect(phaseAt(s, 100_000)).toMatchObject({ done: true, phase: null });
  });

  it("recognises which program days are running days, including the new plans", () => {
    expect(isRunDay([runWalk, easy])).toBe(true);
    expect(isRunDay([{ slug: "back-squat", seconds: null }])).toBe(false);
    expect(isRunDay([])).toBe(false);
    for (const slug of ["walk-to-run-beginner", "aerobic-base-run-walk", "5k-training", "10k-training"]) {
      const p = PROGRAMS.find((x) => x.slug === slug)!;
      const days = p.weekTemplates!.flatMap((w) => w.days);
      expect(days.every((d) => isRunDay(d.exercises.map((e) => ({ slug: e.ex, seconds: e.seconds ?? null })))), slug).toBe(true);
    }
  });

  it("the 5K and 10K plans keep hard running to about 20% of weekly time and end with race day", () => {
    for (const slug of ["5k-training", "10k-training"]) {
      const p = PROGRAMS.find((x) => x.slug === slug)!;
      for (const [i, w] of p.weekTemplates!.entries()) {
        const all = w.days.flatMap((d) => d.exercises);
        const total = all.reduce((t, e) => t + (e.seconds ?? 0) * e.sets, 0);
        const hard = all.filter((e) => e.ex === "running-intervals").reduce((t, e) => t + (e.seconds ?? 0) * e.sets, 0);
        expect(hard / total, `${slug} week ${i + 1}`).toBeLessThanOrEqual(0.25);
      }
      expect(p.weekTemplates!.at(-1)!.days.at(-1)!.name).toMatch(/Race Day/);
    }
  });
});

describe("running goals", () => {
  it("tracks distance goals", () => {
    expect(distanceGoalProgress({ distance_m: 20_000 }, 5_000)).toEqual({ pct: 25, remainingM: 15_000, met: false });
    expect(distanceGoalProgress({ distance_m: 20_000 }, 21_000)).toEqual({ pct: 100, remainingM: 0, met: true });
  });

  it("compares a target time with the best qualifying run", () => {
    expect(raceGoalProgress({ distance_m: 5000, target_s: 1680 }, null, "km")).toEqual({ met: false, gapS: null, targetPace: 336 });
    expect(raceGoalProgress({ distance_m: 5000, target_s: 1680 }, 1750, "km")).toMatchObject({ met: false, gapS: 70 });
    expect(raceGoalProgress({ distance_m: 5000, target_s: 1680 }, 1600, "km")).toMatchObject({ met: true });
  });

  it("fills empty weeks in the distance chart", () => {
    expect(weeklyDistanceSeries([{ weekStart: "2026-10-12", distanceM: 5000 }], ["2026-10-05", "2026-10-12"])).toEqual([
      { weekStart: "2026-10-05", distanceM: 0 },
      { weekStart: "2026-10-12", distanceM: 5000 },
    ]);
  });
});
