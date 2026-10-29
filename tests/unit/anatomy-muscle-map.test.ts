import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { KNOWN_WORDS, muscleTargets } from "@/lib/anatomy3d/muscle-map";

describe("3D muscle glow map", () => {
  it("understands every muscle word used by the exercise catalogue", () => {
    const words = new Set(EXERCISES.flatMap((e) => [...e.primary, ...e.secondary]).map((w) => w.trim().toLowerCase()));
    const unknown = [...words].filter((w) => !KNOWN_WORDS.includes(w));
    expect(unknown).toEqual([]);
  });

  it("lights at least one muscle for every exercise", () => {
    const dark = EXERCISES.filter((e) => Object.keys(muscleTargets(e).weights).length === 0).map((e) => e.slug);
    expect(dark).toEqual([]);
  });

  it("lights the quadriceps and glutes brightest for the back squat", () => {
    const t = muscleTargets(EXERCISES.find((e) => e.slug === "back-squat")!);
    for (const r of ["rectusFemoris", "vastusLat", "vastusMed", "gluteMax"] as const) expect(t.weights[r]).toBe(1);
    expect(t.weights.semitendinosus).toBeLessThan(0.5);
  });

  it("uses the side delts for lateral raises and the front delts for overhead presses", () => {
    const lateral = EXERCISES.find((e) => /lateral raise/i.test(e.name));
    if (lateral) expect(muscleTargets(lateral).weights.deltLat).toBe(1);
    const press = EXERCISES.find((e) => e.pattern === "vertical_push" && e.primary.includes("shoulders"));
    if (press) expect(muscleTargets(press).weights.deltAnt).toBe(1);
  });
});
