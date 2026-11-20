/**
 * Regression tests for the standing cable chest fly, rebuilt 2026-11-20. The old demonstration had the pulleys at the top
 * of the towers and finished with the hands dropped to the hips and the elbows folded: a crossover pushdown, not a fly.
 * These check the movement on frames sampled as the player draws them (normal and 0.5× speed). They cannot judge how it
 * looks; the review sheets are for a person, and no coach has reviewed it.
 */
import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { getMotion } from "@/lib/exercise-motion";
import { CHEST_FLY } from "@/lib/exercise-motion/patterns/upper";
import { compileMotion, evaluate } from "@/lib/exercise-motion/timeline";
import type { ExerciseMeta, Frame, MotionDef, Vec } from "@/lib/exercise-motion/types";

const SLUG = "cable-chest-fly";
const e = EXERCISES.find((x) => x.slug === SLUG)!;
const meta: ExerciseMeta = { slug: SLUG, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed };

function played(fps: number): { def: MotionDef; frames: Frame[]; duration: number } {
  const def = getMotion(SLUG, meta);
  const c = compileMotion(def);
  const n = Math.round(c.duration * fps);
  return { def, duration: c.duration, frames: Array.from({ length: n }, (_, k) => evaluate(c, (k / n) * c.duration)) };
}
const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const shoulderY = (f: Frame) => (f.pts.shoulderL[1] + f.pts.shoulderR[1]) / 2;
const gap = (f: Frame) => f.pts.handL[0] - f.pts.handR[0];

describe("cable chest fly", () => {
  const { def, frames, duration } = played(60);
  const slow = played(120).frames;
  const widest = frames.reduce((a, f) => (gap(f) > gap(a) ? f : a));
  const closest = frames.reduce((a, f) => (gap(f) < gap(a) ? f : a));

  it("is drawn from the front with both towers and a cable from each pulley to its own hand", () => {
    expect(def.view).toBe("front");
    const cables = def.props!.filter((p) => p.kind === "cable");
    expect(cables.map((c) => c.to)).toEqual([{ lm: "handL" }, { lm: "handR" }]);
    expect(def.props!.filter((p) => p.kind === "cableTower")).toHaveLength(2);
    for (const f of frames) {
      for (const p of f.props.filter((r) => r.def.kind === "cable")) {
        const hand = (p.def.to as { lm: "handL" | "handR" }).lm;
        expect(dist(p.to!, f.pts[hand]), "cable ends at the hand").toBeLessThan(0.01);
      }
    }
  });

  it("sets the pulleys at about shoulder height (as the instructions say), on the towers, and they never move", () => {
    const sy = shoulderY(frames[0]!);
    for (const c of def.props!.filter((p) => p.kind === "cable")) {
      const at = c.at as Vec;
      expect(Math.abs(at[1] - sy), "pulley height vs shoulder").toBeLessThan(6);
      expect(Math.abs(Math.abs(at[0]) - (CHEST_FLY.towerX - 14))).toBeLessThan(0.01);
    }
    expect(e.instructions[0]).toMatch(/shoulder height/);
    for (const f of frames) for (const p of f.props) if (p.def.kind === "cable") expect(p.at).toEqual(frames[0]!.props.find((q) => q.def.id === p.def.id)!.at);
  });

  it("opens wide at the stretch and closes with the hands in front of the lower chest, never touching or crossing", () => {
    // Stretch: hands out wide at about shoulder height.
    expect(gap(widest)).toBeGreaterThan(140);
    expect(Math.abs(widest.pts.handL[1] - shoulderY(widest))).toBeLessThan(10);
    // Squeeze: hands near the midline, a hand's width or so apart, between the shoulders and the navel.
    expect(gap(closest)).toBeGreaterThan(10);
    expect(gap(closest)).toBeLessThan(22);
    const drop = shoulderY(closest) - closest.pts.handL[1];
    expect(drop).toBeGreaterThan(12);
    expect(drop).toBeLessThan(30);
    expect(closest.pts.handL[1]).toBeGreaterThan(closest.pts.belly[1]);
    for (const f of [...frames, ...slow]) expect(gap(f), "the hands never meet or cross").toBeGreaterThan(10);
  });

  it("is a fly, not a press: the elbows stay a fixed, slight bend and the hand stays a full arm's reach from the shoulder", () => {
    expect(CHEST_FLY.elbowDeg).toBeGreaterThanOrEqual(10);
    expect(CHEST_FLY.elbowDeg).toBeLessThanOrEqual(30);
    // A press brings the hands in toward the shoulders; a fly keeps them on an arc at a nearly constant 3D distance.
    // At the stretch the arm is almost in the picture plane, so its projected reach is the real one.
    const reach = dist(widest.pts.shoulderL, widest.pts.handL);
    const full = 32 + 31;
    expect(reach).toBeGreaterThan(full * 0.9);
    // The upper arm sweeps from slightly behind the body to straight ahead.
    expect(CHEST_FLY.openDeg).toBeLessThan(0);
    expect(CHEST_FLY.closeDeg).toBeGreaterThanOrEqual(85);
    expect(CHEST_FLY.closeDeg).toBeLessThanOrEqual(95);
  });

  it("keeps the hands at chest height through the whole arc (never above the shoulders, never down at the hips)", () => {
    for (const f of [...frames, ...slow]) {
      const sy = shoulderY(f);
      for (const h of [f.pts.handL, f.pts.handR]) {
        expect(h[1]).toBeLessThan(sy + 6);
        expect(h[1]).toBeGreaterThan(f.pts.belly[1]);
      }
    }
  });

  it("stands still: feet planted, pelvis steady, a slight lean toward the camera", () => {
    for (const s of ["L", "R"] as const) {
      const xs = frames.map((f) => f.pts[`ankle${s}`][0]);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.5);
    }
    const py = frames.map((f) => f.pts.pelvis[1]);
    expect(Math.max(...py) - Math.min(...py)).toBeLessThan(0.5);
    for (const f of frames) expect(f.pose.trunkD).toBeGreaterThan(5);
  });

  it("moves smoothly and loops without a jump, with a slower return than the squeeze", () => {
    const step = (fs: Frame[]) => Math.max(...fs.map((f, i) => dist(f.pts.handL, fs[(i + 1) % fs.length]!.pts.handL)));
    // At 60 fps no hand moves more than ~3.5 cm between frames, including from the last frame back to the first.
    expect(step(frames)).toBeLessThan(3.5);
    expect(step(slow)).toBeLessThan(1.8);
    // About 1.2 s in, 2 s back, with short holds: 3.5–4.5 s per rep.
    expect(duration).toBeGreaterThan(3.5);
    expect(duration).toBeLessThan(4.5);
    const tClose = frames.indexOf(closest) / frames.length;
    expect(tClose).toBeGreaterThan(0.3);
    expect(tClose).toBeLessThan(0.55);
  });
});
