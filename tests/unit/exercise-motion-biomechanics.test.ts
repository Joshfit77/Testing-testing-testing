/**
 * Regression checks for the motion defects fixed on 2026-11-13 (docs/animation/ANIMATION_AUDIT.md). Each check measures
 * the frames the player draws (cm of the ~180 cm athlete, degrees) against the defect it guards against. Passing them
 * does not make a demonstration anatomically correct: the audit lists which movements still need a coach or
 * physiotherapist to review them.
 */
import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { fitCamera, getMotion, getMotionViews } from "@/lib/exercise-motion";
import { compileMotion, evaluate, motionBounds, sampleFrames } from "@/lib/exercise-motion/timeline";
import { yawShift } from "@/lib/exercise-motion/skeleton";
import type { ExerciseMeta, Frame, MotionDef, Pose, Vec } from "@/lib/exercise-motion/types";

const meta = (slug: string): ExerciseMeta => {
  const e = EXERCISES.find((x) => x.slug === slug)!;
  return { slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed };
};
const def = (slug: string) => getMotion(slug, meta(slug));
/** The frames the player draws at 60 fps over one loop. */
const at60 = (d: MotionDef): Frame[] => {
  const c = compileMotion(d);
  return sampleFrames(c, Math.max(2, Math.round(c.duration * 60)));
};
const bar = (f: Frame, id = "bar") => f.props.find((p) => p.def.id === id)!.at;
/** Largest change of a joint angle between consecutive frames (degrees per frame at 60 fps), seam included. */
const maxStep = (fr: Frame[], keys: (keyof Pose)[]) => {
  let m = 0;
  for (let i = 0; i < fr.length; i++) for (const k of keys) m = Math.max(m, Math.abs(fr[(i + 1) % fr.length]!.pose[k] - fr[i]!.pose[k]));
  return m;
};
/**
 * How far in front of the face a bar in front of it stays (cm, negative = through the head): the bar's near edge
 * against the forehead, the head's centre line and the top of the head, for those within reach of the bar's height.
 */
const faceClearance = (f: Frame, b: Vec, barR = 2) => {
  let worst = Infinity;
  for (const q of [f.pts.foreheadFront, f.pts.head, f.pts.headTop]) if (Math.abs(q[1] - b[1]) < barR + 9) worst = Math.min(worst, b[0] - barR - q[0]);
  return worst;
};
const MID_FOOT = -1;

describe("squats share one set of mechanics", () => {
  const SQUATS = ["back-squat", "front-squat", "pause-squat", "tempo-squat", "zercher-squat", "overhead-squat", "goblet-squat", "bodyweight-squat"];

  it("every squat is keyed densely (the bar path is solved at seven depths each way, not four keys)", () => {
    for (const slug of SQUATS) expect(def(slug).keyframes.length, slug).toBeGreaterThanOrEqual(12);
  });

  it("pause and tempo squats move like the back squat: same depth, same bar over mid-foot", () => {
    const depth = (slug: string) => Math.min(...at60(def(slug)).map((f) => f.pts.pelvis[1]));
    for (const slug of ["pause-squat", "tempo-squat"]) {
      expect(Math.abs(depth(slug) - depth("back-squat")), slug).toBeLessThan(0.5);
      for (const f of at60(def(slug))) expect(Math.abs(bar(f)[0] - MID_FOOT), slug).toBeLessThan(3);
    }
  });

  it("the front squat keeps the bar over mid-foot with an upright torso and reaches below parallel", () => {
    const fr = at60(def("front-squat"));
    for (const f of fr) expect(Math.abs(bar(f)[0] - MID_FOOT)).toBeLessThan(4);
    const bottom = [...fr].sort((a, b) => a.pts.pelvis[1] - b.pts.pelvis[1])[0]!;
    expect(bottom.pts.pelvis[1]).toBeLessThan(bottom.pts.kneeR[1]);
    // More upright than the back squat at the bottom (about 33° there).
    expect(bottom.pose.trunk).toBeLessThan(30);
    for (const f of fr) expect(Math.abs(f.pts.heelR[1])).toBeLessThan(1);
  });

  it("every barbell held at the shoulders, on the back or overhead uses 35 cm plates (the face and hands stay readable)", () => {
    const slugs = [...SQUATS.slice(0, 6), "box-squat", "good-morning", "overhead-press", "seated-barbell-shoulder-press"];
    for (const slug of slugs) {
      const b = def(slug).props!.find((p) => p.kind === "barbell")!;
      expect(b.size, slug).toBe(17.5);
    }
  });
});

describe("standing overhead press", () => {
  const fr = at60(def("overhead-press"));

  it("the bar never passes through the head: the head moves back out of its way", () => {
    for (const f of fr) expect(faceClearance(f, bar(f))).toBeGreaterThan(2);
  });

  it("locks out over mid-foot with straight arms, and starts with the bar on the front of the shoulders", () => {
    const top = [...fr].sort((a, b) => bar(b)[1] - bar(a)[1])[0]!;
    expect(top.pose.elR).toBeLessThan(15);
    expect(Math.abs(bar(top)[0] - MID_FOOT)).toBeLessThan(6);
    const low = [...fr].sort((a, b) => bar(a)[1] - bar(b)[1])[0]!;
    expect(bar(low)[1]).toBeLessThan(low.pts.shoulder[1] + 8);
  });

  it("the elbows straighten smoothly (they snapped up to 10° in one frame at lockout)", () => {
    expect(maxStep(fr, ["elL", "elR", "shL", "shR"])).toBeLessThan(6);
  });

  it("the head comes back under the bar at lockout (through the window)", () => {
    const top = [...fr].sort((a, b) => bar(b)[1] - bar(a)[1])[0]!;
    expect(Math.abs(top.pose.neck)).toBeLessThan(4);
  });
});

describe("lat pulldown", () => {
  const fr = at60(def("lat-pulldown"));
  const hands = (f: Frame) => f.pts.hands;

  it("moves smoothly: the shoulder never swings more than 6° in a frame (it swung 7.7°)", () => {
    expect(maxStep(fr, ["shL", "shR", "elL", "elR", "trunk"])).toBeLessThan(6);
  });

  it("brings the bar down in front of the face, never through it, to the upper chest", () => {
    for (const f of fr) expect(faceClearance(f, hands(f))).toBeGreaterThan(2);
    const bottom = [...fr].sort((a, b) => hands(a)[1] - hands(b)[1])[0]!;
    expect(Math.abs(hands(bottom)[1] - bottom.pts.chest[1])).toBeLessThan(14);
    // A slight lean back at the bottom, not a row.
    expect(bottom.pose.trunk).toBeLessThan(-10);
    expect(bottom.pose.trunk).toBeGreaterThan(-20);
  });

  it("reaches up to nearly straight arms at the top", () => {
    const top = [...fr].sort((a, b) => hands(b)[1] - hands(a)[1])[0]!;
    expect(top.pose.elR).toBeLessThan(25);
  });
});

describe("rear-delt fly", () => {
  const views = getMotionViews("rear-delt-fly", meta("rear-delt-fly"));
  const fr = at60(views[0]!.def);

  it("is bent over (it was drawn standing upright from the front, like a lateral raise)", () => {
    expect(views[0]!.view).toBe("side");
    for (const f of fr) {
      expect(f.pose.trunk).toBeGreaterThan(50);
      expect(f.pose.trunk).toBeLessThan(70);
    }
  });

  it("raises the dumbbells from hanging under the chest to about shoulder height, with soft elbows", () => {
    const lowest = Math.min(...fr.map((f) => f.pts.handR[1] - f.pts.shoulder[1]));
    const highest = Math.max(...fr.map((f) => f.pts.handR[1] - f.pts.shoulder[1]));
    expect(lowest).toBeLessThan(-50);
    expect(highest).toBeGreaterThan(-16);
  });

  it("keeps the feet planted and offers the front view of the same rep", () => {
    for (const f of fr) expect(Math.min(f.pts.heelR[1], f.pts.ballR[1])).toBeLessThan(0.6);
    expect(views.map((v) => v.view)).toEqual(["side", "front"]);
    expect(compileMotion(views[1]!.def).duration).toBeCloseTo(compileMotion(views[0]!.def).duration, 6);
  });
});

describe("dumbbell flyes seen from above", () => {
  for (const slug of ["dumbbell-fly", "incline-dumbbell-fly"]) {
    it(`${slug}: an Above view whose arms open wide and close over the chest, in time with the side view`, () => {
      const views = getMotionViews(slug, meta(slug));
      expect(views.map((v) => v.label)).toEqual(["Side", "Above"]);
      const above = views[1]!.def;
      expect(compileMotion(above).duration).toBeCloseTo(compileMotion(views[0]!.def).duration, 6);
      const fr = at60(above);
      const span = fr.map((f) => Math.abs(f.pts.handL[0] - f.pts.handR[0]));
      expect(Math.min(...span)).toBeLessThan(30);
      expect(Math.max(...span)).toBeGreaterThan(140);
    });
  }
});

describe("framing", () => {
  it("a side-view barbell's plates, as the athlete look draws them, stay inside the picture in every frame", () => {
    // The near half of the bar is drawn 85 cm toward the viewer (plates scaled 1.08), which the camera's yaw puts 24 cm
    // behind the bar's centre; the far half 19 cm in front of it.
    const W = 359;
    const H = 431;
    const bad: string[] = [];
    for (const e of EXERCISES) {
      const d = getMotion(e.slug, meta(e.slug));
      if (d.view !== "side") continue;
      const b = d.props?.find((p) => p.kind === "barbell" && (!p.variant || p.variant === "axle"));
      if (!b) continue;
      const c = compileMotion(d);
      const cam = fitCamera(motionBounds(c), W, H, 1, d.mirror);
      const r = b.size ?? 22.5;
      for (let i = 0; i < 48; i++) {
        const f = evaluate(c, (i / 48) * c.duration);
        const p = f.props.find((q) => q.def.id === b.id)!.at;
        const near = p[0] + yawShift(85) * 1.08 - r * 1.08;
        const far = p[0] - yawShift(85) * 0.86 + r * 0.86;
        const sx = (x: number) => cam.ox + (x - f.cameraX) * cam.scale * (cam.mirror ? -1 : 1);
        const [a, z] = [sx(near), sx(far)].sort((u, v) => u - v);
        if (a! < -0.5 || z! > W + 0.5) {
          bad.push(`${e.slug} at ${(i / 48).toFixed(2)}`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("floor contact", () => {
  it("bodies lying or sitting stay on the floor without the floor clamp lifting them (no floating feet)", () => {
    // The clamp lifted the glute bridge 2.8 cm (the elbows bent through the floor) and the seated hip abduction 1.9 cm
    // (the soles went through the floor as the knees opened), raising the planted feet off the floor.
    for (const slug of ["glute-bridge", "single-leg-glute-bridge", "hip-abduction"]) {
      const fr = at60(def(slug));
      expect(Math.max(...fr.map((f) => f.lifted ?? 0)), slug).toBeLessThan(0.5);
    }
  });
});
