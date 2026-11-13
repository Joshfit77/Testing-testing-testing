/**
 * Regression tests for the reviewed sprint, plyometric, throw, carry and shoulder-mobility demonstrations. Each checks
 * the concrete defect that was fixed, on the frames the player draws. How a pose looks is judged on the review sheets
 * and videos (scripts/exercise-review), not here.
 */
import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { getMotion } from "@/lib/exercise-motion";
import { compileMotion, evaluate } from "@/lib/exercise-motion/timeline";
import type { ExerciseMeta, Frame, MotionDef } from "@/lib/exercise-motion/types";

const metaOf = (slug: string): ExerciseMeta => {
  const e = EXERCISES.find((x) => x.slug === slug);
  if (!e) throw new Error(`unknown exercise ${slug}`);
  return { slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed };
};
function played(slug: string, fps = 120): { def: MotionDef; frames: Frame[] } {
  const def = getMotion(slug, metaOf(slug));
  const c = compileMotion(def);
  const n = Math.round(c.duration * fps);
  return { def, frames: Array.from({ length: n }, (_, k) => evaluate(c, (k / n) * c.duration)) };
}

/** Frames where a foot touches down (its lowest point reaches the floor), with that foot. */
function touchdowns(frames: Frame[]): { f: Frame; s: "L" | "R" }[] {
  const low = (f: Frame, s: "L" | "R") => Math.min(f.pts[`heel${s}`][1], f.pts[`ball${s}`][1]);
  const out: { f: Frame; s: "L" | "R" }[] = [];
  for (let i = 0; i < frames.length; i++) {
    const a = frames[(i - 1 + frames.length) % frames.length]!;
    const b = frames[i]!;
    for (const s of ["L", "R"] as const) if (low(a, s) > 0.6 && low(b, s) <= 0.6) out.push({ f: b, s });
  }
  return out;
}

describe("sprints: the foot lands near the hips, not reaching out in front (overstriding)", () => {
  it("acceleration sprint: strong forward lean, each foot landing under the hips (ankle at most 10 cm ahead), shin angled forward", () => {
    const { frames } = played("acceleration-sprint");
    const td = touchdowns(frames);
    expect(td.length).toBeGreaterThanOrEqual(2);
    for (const { f, s } of td) {
      // Before the fix the ankle landed 44 cm ahead of the hips on a nearly straight knee.
      expect(f.pts[`ankle${s}`][0] - f.pts.pelvis[0], `${s} lands`).toBeLessThan(10);
      // Knee ahead of the ankle at touchdown.
      expect(f.pts[`knee${s}`][0], `${s} shin angled forward`).toBeGreaterThan(f.pts[`ankle${s}`][0]);
    }
    for (const f of frames) expect(f.seg.T1, "leaning forward").toBeGreaterThan(30);
  });
  it("flying sprint: each foot lands at most 38 cm ahead of the hips (ankle) on a bent knee", () => {
    const { frames } = played("flying-sprint");
    const td = touchdowns(frames);
    expect(td.length).toBeGreaterThanOrEqual(2);
    for (const { f, s } of td) {
      // Before the fix: 44 cm.
      expect(f.pts[`ankle${s}`][0] - f.pts.pelvis[0]).toBeLessThan(38);
      expect(f.pose[`knee${s}`]).toBeGreaterThan(15);
    }
  });
  it("bounding: holds a split in the air (lead thigh up, push leg trailing behind)", () => {
    const { frames } = played("bounding");
    const air = frames.filter((f) => Math.min(f.pts.heelL[1], f.pts.ballL[1], f.pts.heelR[1], f.pts.ballR[1]) > 0.6);
    expect(air.length).toBeGreaterThan(0);
    // Thigh directions from vertical (+ = forward).
    const split = air.some((f) => Math.max(f.seg.thighL, f.seg.thighR) > 55 && Math.min(f.seg.thighL, f.seg.thighR) < -15);
    expect(split).toBe(true);
  });
});

describe("medicine-ball scoop toss", () => {
  const { frames } = played("medicine-ball-scoop-toss");
  const ballY = (f: Frame) => f.props.find((p) => p.def.id === "ball")!.at[1];
  it("loads in a real squat with the ball low by the back knee, then scoops it up to about chest height", () => {
    const lowest = frames.reduce((a, b) => (ballY(b) < ballY(a) ? b : a));
    expect(ballY(lowest), "ball low").toBeLessThan(70);
    expect(lowest.pts.pelvis[1], "hips down in a squat").toBeLessThan(76);
    expect(lowest.pose.trunkD, "hips back, chest over the knees").toBeGreaterThan(20);
    expect(Math.max(...frames.map(ballY)), "released high toward the wall").toBeGreaterThan(110);
  });
});

describe("band pass-through", () => {
  const { def, frames } = played("band-pass-through");
  it("takes the band from in front of the hips, over the head and all the way down behind the back, arms straight", () => {
    expect(def.view).toBe("side");
    const over = frames.some((f) => f.pts.handR[1] > f.pts.headTop[1]);
    expect(over, "overhead").toBe(true);
    const behind = frames.some((f) => f.pts.handR[0] < f.pts.pelvis[0] - 20 && f.pts.handR[1] < f.pts.shoulder[1] - 25);
    expect(behind, "down behind the back").toBe(true);
    const front = frames.some((f) => f.pts.handR[0] > f.pts.pelvis[0] + 10 && f.pts.handR[1] < f.pts.pelvis[1] + 15);
    expect(front, "in front of the hips").toBe(true);
    for (const f of frames) expect(f.pose.elR, "arms straight").toBeLessThan(5);
  });
});

describe("loaded carries", () => {
  it("farmer's and suitcase carries: short steps with the arms straight at the sides", () => {
    for (const slug of ["farmers-carry", "suitcase-carry"]) {
      const { def, frames } = played(slug);
      const td = touchdowns(frames);
      // Two steps per loop: the loop's travel is one stride.
      expect(td.length).toBe(2);
      expect((def.travel ?? 0) / 2, `${slug} step length`).toBeLessThan(52); // 56 cm before
      for (const f of frames) expect(f.pose.elR, `${slug} loaded arm straight`).toBeLessThan(6);
    }
  });
});
