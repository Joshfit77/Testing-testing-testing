/**
 * Regression tests for redrawn mobility demonstrations. Each was reviewed as wrong; these check the concrete defect on
 * the motion (and, for drills posed in 3D, on the 3D body the picture is projected from). Whether a pose looks right is
 * judged on the review sheets and videos (scripts/exercise-review), not here.
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
function played(slug: string, fps = 60): { def: MotionDef; frames: Frame[] } {
  const def = getMotion(slug, metaOf(slug));
  const c = compileMotion(def);
  const n = Math.round(c.duration * fps);
  return { def, frames: Array.from({ length: n }, (_, k) => evaluate(c, (k / n) * c.duration)) };
}
const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
describe("bench dip", () => {
  // Reviewed as wrong: the athlete read as sitting on the bench. In a bench dip the hands are on the edge behind the
  // hips and the hips are in front of the bench, lowering below its top as the elbows bend back.
  const { def, frames } = played("bench-dip");
  const bench = def.props?.find((p) => p.id === "bench") as { at: [number, number]; w: number; h: number } | undefined;
  it("keeps the hips in front of the bench edge and lowers them below the bench top", () => {
    expect(bench).toBeDefined();
    const front = bench!.at[0] + bench!.w / 2;
    // The seat of the shorts reaches about 10 units behind the hip joint: the joint has to be at least 12 in front of
    // the edge for the hips to be clear of the bench (the old drawing had it 10–14 in front, so it sat on the seat).
    for (const f of frames) expect(f.pts.pelvis[0], "hips clear of the bench edge").toBeGreaterThan(front + 12);
    const lowest = Math.min(...frames.map((f) => f.pts.pelvis[1]));
    const highest = Math.max(...frames.map((f) => f.pts.pelvis[1]));
    expect(lowest, "hips drop below the bench top at the bottom").toBeLessThan(bench!.h);
    expect(highest - lowest, "a real range of motion").toBeGreaterThan(12);
  });
  it("keeps the hands on the bench edge, behind the hips", () => {
    expect(range(frames.map((f) => f.pts.handR[0]))).toBeLessThan(0.5);
    for (const f of frames) expect(f.pts.handR[0]).toBeLessThan(f.pts.pelvis[0]);
  });
});
