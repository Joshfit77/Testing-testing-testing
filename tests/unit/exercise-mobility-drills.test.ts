/**
 * Regression tests for redrawn mobility demonstrations. Each was reviewed as wrong; these check the concrete defect on
 * the motion (and, for drills posed in 3D, on the 3D body the picture is projected from). Whether a pose looks right is
 * judged on the review sheets and videos (scripts/exercise-review), not here.
 */
import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { getMotion } from "@/lib/exercise-motion";
import { HIP_9090, hip9090Body, type V3 } from "@/lib/exercise-motion/patterns/floor";
import { BODY } from "@/lib/exercise-motion/skeleton";
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
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
/** Knee flexion (0 = straight) from the 3D hip, knee and ankle. */
const kneeFlex = (hip: V3, knee: V3, ankle: V3) => {
  const a = sub3(hip, knee);
  const b = sub3(ankle, knee);
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len3(a) * len3(b));
  return 180 - (Math.acos(cos) * 180) / Math.PI;
};

describe("90/90 hip switch", () => {
  // Reviewed as wrong: the feet slid round the mat and the "back" foot floated beside the chest. The switch is a
  // windscreen-wiper turn of both knees with the feet planted and the pelvis on the mat.
  const { frames } = played("90-90-hip-switch");
  it("keeps the pelvis on the mat and the feet planted while the knees switch sides", () => {
    expect(range(frames.map((f) => f.pts.pelvis[0]))).toBeLessThan(0.5);
    expect(range(frames.map((f) => f.pts.pelvis[1]))).toBeLessThan(0.5);
    for (const s of ["L", "R"] as const) {
      expect(range(frames.map((f) => f.pts[`ankle${s}`][0])), `ankle ${s} x`).toBeLessThan(0.5);
      expect(range(frames.map((f) => f.pts[`ankle${s}`][1])), `ankle ${s} y`).toBeLessThan(0.5);
    }
    // The torso stays upright (no lateral lean).
    for (const f of frames) expect(Math.abs(f.seg.T1)).toBeLessThan(3);
  });
  it("both knees swing over to the other side together (they both move the same way across the picture)", () => {
    const a = frames[0]!;
    const half = frames[Math.round(frames.length * 0.5)]!;
    for (const s of ["L", "R"] as const) {
      expect(half.pts[`knee${s}`][0] - a.pts[`knee${s}`][0], `knee ${s} moves to screen right`).toBeGreaterThan(25);
    }
    // The far end is the mirror image of the start.
    expect(half.pts.kneeL[0]).toBeCloseTo(-a.pts.kneeR[0], 0);
    expect(half.pts.kneeR[0]).toBeCloseTo(-a.pts.kneeL[0], 0);
  });
  it("in 3D: hip, pelvis and ankles never move; both knees bend about 90° and rest on the mat at each end", () => {
    const b0 = hip9090Body(0);
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
      const b = hip9090Body(s);
      expect(b.pelvis).toEqual(b0.pelvis);
      expect(b.pelvis[1]).toBe(HIP_9090.hipY);
      expect(b.ankleL).toEqual(b0.ankleL);
      expect(b.ankleR).toEqual(b0.ankleR);
      for (const k of ["L", "R"] as const) {
        // Bones keep their lengths.
        expect(len3(sub3(b[`knee${k}`], b[`hip${k}`]))).toBeCloseTo(BODY.thigh, 3);
        expect(len3(sub3(b[`ankle${k}`], b[`knee${k}`]))).toBeCloseTo(BODY.shin, 3);
        const flex = kneeFlex(b[`hip${k}`], b[`knee${k}`], b[`ankle${k}`]);
        expect(flex, `knee ${k} at ${s}`).toBeGreaterThan(80);
        expect(flex).toBeLessThan(100);
      }
    }
    for (const s of [0, 1]) {
      const b = hip9090Body(s);
      for (const k of ["L", "R"] as const) expect(b[`knee${k}`][1], `knee ${k} on the mat at ${s}`).toBeLessThan(HIP_9090.kneeY + 0.5);
    }
    // At s = 0 (knees over to the athlete's right, -x): the right leg is turned out (its knee outside its hip) and the
    // left is turned in (its knee inside its ankle, toward the right).
    expect(b0.kneeR[0]).toBeLessThan(b0.hipR[0] - 30);
    expect(b0.kneeL[0]).toBeLessThan(b0.ankleL[0] - 30);
    // Knees up in the middle.
    const mid = hip9090Body(0.5);
    expect(Math.min(mid.kneeL[1], mid.kneeR[1])).toBeGreaterThan(25);
  });
});
