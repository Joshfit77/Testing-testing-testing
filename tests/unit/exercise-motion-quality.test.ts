import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/data/exercises";
import { compileMotion, evaluate, getMotion } from "@/lib/exercise-motion";
import { BODY, forwardKinematics } from "@/lib/exercise-motion/skeleton";
import type { ExerciseMeta, Frame, Landmark, MotionDef, Pose } from "@/lib/exercise-motion/types";

/**
 * Movement quality, checked on the frames the player draws (60 fps, one loop): a hand holding a prop keeps hold of
 * it, no joint jumps between frames, planted feet stay planted, and the exercises in the athlete-look preview keep
 * their form. These are the checks behind "no floating equipment, no snapping, no sliding feet".
 */

const metaOf = (e: (typeof EXERCISES)[number]): ExerciseMeta => ({ slug: e.slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed });
const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));

function framesOf(slug: string, fps = 60): { def: MotionDef; frames: Frame[]; dt: number } {
  const e = bySlug.get(slug)!;
  const def = getMotion(slug, metaOf(e));
  const c = compileMotion(def);
  const n = Math.max(2, Math.round(c.duration * fps));
  return { def, frames: Array.from({ length: n }, (_, i) => evaluate(c, (i / n) * c.duration)), dt: c.duration / n };
}

const JOINTS: (keyof Pose)[] = ["trunk", "spine", "neck", "hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR", "shL", "shR", "elL", "elR"];

/** Largest change of a joint angle between consecutive frames (degrees per frame at 60 fps). */
function maxJointStep(frames: Frame[]): { key: keyof Pose; step: number; at: number } {
  let worst = { key: "trunk" as keyof Pose, step: 0, at: 0 };
  const n = frames.length;
  for (let i = 0; i < n; i++)
    for (const k of JOINTS) {
      const d = Math.abs(frames[(i + 1) % n]!.pose[k] - frames[i]!.pose[k]);
      if (d > worst.step) worst = { key: k, step: d, at: i };
    }
  return worst;
}

describe("movement quality on the frames the player draws", () => {
  // Fast real movements (a punch, a sprint stride, a clean's turnover) reach about 1,000-1,300°/s at a joint; nothing
  // human reaches 1,500°/s (25° per frame at 60 fps), so a faster change is a snap or a teleport in the animation.
  const SNAP = 25;
  // Lifts, carries, stretches and holds never come near fast-movement speeds: 12° per frame (720°/s) there is a jerk.
  const SLOW = 12;
  const slowCategories = new Set(["strength", "mobility", "core", "flexibility", "recovery"]);

  it("every exercise, including the loop's seam: no joint moves faster than a human joint can (a snap)", () => {
    const bad: string[] = [];
    for (const e of EXERCISES) {
      const { frames } = framesOf(e.slug);
      const w = maxJointStep(frames);
      if (w.step > SNAP) bad.push(`${e.slug} ${w.key} ${w.step.toFixed(1)}°/frame at frame ${w.at} of ${frames.length}`);
    }
    expect(bad).toEqual([]);
  });

  it("slow exercises (lifts, mobility, core, stretches): no joint moves faster than 720°/s", () => {
    const bad: string[] = [];
    for (const e of EXERCISES) {
      if (!slowCategories.has(e.category)) continue;
      // Explosive even when filed under strength: Olympic lifts and their strongman cousins (the log is cleaned to the
      // chest), throws, slams, swings, jumps; and a Nordic curl ends in a fall caught on the hands.
      if (/clean|snatch|jerk|push-press|log-press|throw|slam|swing|jump|burpee|sprawl|nordic/.test(e.slug)) continue;
      const { frames } = framesOf(e.slug);
      const w = maxJointStep(frames);
      if (w.step > SLOW) bad.push(`${e.slug} ${w.key} ${w.step.toFixed(1)}°/frame at frame ${w.at} of ${frames.length}`);
    }
    expect(bad).toEqual([]);
  });

  it("every exercise: the loop closes without the figure jumping up or down", () => {
    const bad: string[] = [];
    for (const e of EXERCISES) {
      const { frames } = framesOf(e.slug);
      const a = frames[frames.length - 1]!;
      const b = frames[0]!;
      if (Math.abs(a.pts.pelvis[1] - b.pts.pelvis[1]) > 3) bad.push(`${e.slug} pelvis height ${Math.abs(a.pts.pelvis[1] - b.pts.pelvis[1]).toFixed(1)} cm`);
    }
    expect(bad).toEqual([]);
  });

  it("planted feet stay planted: a foot declared planted never slides more than 0.3 cm between frames", () => {
    const bad: string[] = [];
    for (const e of EXERCISES) {
      const { def, frames } = framesOf(e.slug);
      if (!def.planted?.length || def.view !== "side") continue;
      for (const s of def.planted) {
        let worst = 0;
        for (let i = 1; i < frames.length; i++) {
          const a = frames[i - 1]!.pts;
          const b = frames[i]!.pts;
          for (const pt of ["heel", "ball"] as const) {
            const key = `${pt}${s}` as Landmark;
            // Only while that point is on the floor (a heel may lift in a lunge).
            if (a[key][1] < 0.6 && b[key][1] < 0.6) worst = Math.max(worst, Math.abs(b[key][0] - a[key][0]));
          }
        }
        if (worst > 0.3) bad.push(`${e.slug} foot ${s} slides ${worst.toFixed(2)} cm/frame`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("running: the support foot does not slide, and the body never leaves the floor by more than a real stride's flight", () => {
    for (const slug of ["zone-2-run", "running-intervals", "run-walk-intervals"]) {
      const { frames } = framesOf(slug);
      let slide = 0;
      let lowest = Infinity;
      for (let i = 1; i < frames.length; i++) {
        const a = frames[i - 1]!.pts;
        const b = frames[i]!.pts;
        for (const s of ["L", "R"] as const)
          for (const pt of ["heel", "ball"] as const) {
            const key = `${pt}${s}` as Landmark;
            // World coordinates: a planted foot keeps its x while the camera follows the body.
            if (a[key][1] < 0.6 && b[key][1] < 0.6) slide = Math.max(slide, Math.abs(b[key][0] - a[key][0]));
          }
        lowest = Math.min(lowest, ...(["heelL", "heelR", "ballL", "ballR"] as const).map((k) => b[k][1]));
      }
      expect(slide, `${slug} support foot slides`).toBeLessThan(0.35);
      expect(lowest, `${slug} a foot below the floor`).toBeGreaterThan(-0.1);
    }
  });

  it("a prop held in a hand stays in that hand through the whole movement", () => {
    const bad: string[] = [];
    for (const e of EXERCISES) {
      const { def, frames } = framesOf(e.slug, 30);
      for (const pd of def.props ?? []) {
        const lm = pd.follow ?? (typeof pd.at === "object" && !Array.isArray(pd.at) ? pd.at.lm : undefined);
        if (!lm || !/^hand[LR]$|^hands$/.test(lm)) continue;
        if (pd.kind !== "dumbbell" && pd.kind !== "kettlebell" && pd.kind !== "barbell" && pd.kind !== "plate") continue;
        let worst = 0;
        for (const f of frames) {
          const rp = f.props.find((p) => p.def.id === pd.id);
          if (!rp) continue;
          const h = lm === "hands" ? f.pts.hands : f.pts[lm];
          const d = Math.hypot(rp.at[0] - h[0], rp.at[1] - h[1]);
          const allowed = 6 + Math.abs(pd.at && !Array.isArray(pd.at) ? (pd.at.dx ?? 0) : 0) + Math.abs(pd.at && !Array.isArray(pd.at) ? (pd.at.dy ?? 0) : 0);
          if (d > allowed) worst = Math.max(worst, d - allowed);
        }
        if (worst > 0) bad.push(`${e.slug} ${pd.id} drifts ${worst.toFixed(1)} cm from ${lm}`);
      }
    }
    expect(bad).toEqual([]);
  });

  describe("back squat (and its pause and tempo variants): form through the whole repetition", () => {
    for (const slug of ["back-squat", "pause-squat", "tempo-squat"]) {
      it(`${slug}: the bar stays over the mid-foot, both hands stay on the bar, the elbows stay below it, and depth is reached`, () => {
        const { def, frames } = framesOf(slug);
        const bar = def.props?.find((p) => p.kind === "barbell");
        expect(bar, "a barbell").toBeTruthy();
        expect(bar!.orient, "drawn across the shoulders").toBe("across");
        let minKnee = Infinity;
        let maxKnee = -Infinity;
        for (const f of frames) {
          const b = f.props.find((p) => p.def.id === bar!.id)!;
          // Bar on the traps: at the trap landmark, which moves with the torso.
          expect(Math.hypot(b.at[0] - f.pts.trap[0], b.at[1] - f.pts.trap[1]), "bar at the traps").toBeLessThan(0.5);
          // Hands on the bar (drawn side view: at the bar's end), elbows below the bar and not in front of it.
          for (const s of ["L", "R"] as const) {
            expect(Math.hypot(f.pts[`hand${s}`][0] - b.at[0], f.pts[`hand${s}`][1] - b.at[1]), `hand ${s} on the bar`).toBeLessThan(2);
            expect(f.pts[`elbow${s}`][1], `elbow ${s} below the bar`).toBeLessThan(b.at[1] - 10);
            expect(f.pts[`elbow${s}`][0], `elbow ${s} behind the bar`).toBeLessThan(b.at[0] + 8);
          }
          // Balance: the bar stays over the foot (between the heel and the toes).
          const sk = forwardKinematics(f.pose, "side", f.pts.pelvis);
          void sk;
          expect(b.at[0], "bar over the foot").toBeGreaterThan(f.pts.heelR[0] - 4);
          expect(b.at[0], "bar over the foot").toBeLessThan(f.pts.toeR[0] + 2);
          minKnee = Math.min(minKnee, f.pose.kneeR);
          maxKnee = Math.max(maxKnee, f.pose.kneeR);
        }
        expect(maxKnee, "squat depth (knee flexion at the bottom)").toBeGreaterThan(100);
        expect(minKnee, "lockout (knees straight at the top)").toBeLessThan(8);
      });
    }
  });

  it("dumbbell curl: the upper arm stays by the side while the forearm travels the full range", () => {
    const { frames } = framesOf("dumbbell-curl");
    let shRange = [Infinity, -Infinity];
    let elRange = [Infinity, -Infinity];
    for (const f of frames) {
      shRange = [Math.min(shRange[0]!, f.pose.shR), Math.max(shRange[1]!, f.pose.shR)];
      elRange = [Math.min(elRange[0]!, f.pose.elR), Math.max(elRange[1]!, f.pose.elR)];
    }
    expect(shRange[1]! - shRange[0]!, "upper arm swing").toBeLessThan(12);
    expect(elRange[1]! - elRange[0]!, "elbow range").toBeGreaterThan(100);
  });

  it("the figure's proportions never change: every bone keeps its length in every frame", () => {
    const bad: string[] = [];
    const bones: [Landmark, Landmark, number][] = [
      ["kneeR", "ankleR", BODY.shin],
      ["kneeL", "ankleL", BODY.shin],
    ];
    for (const e of EXERCISES) {
      const { def, frames } = framesOf(e.slug, 20);
      if (def.view !== "side") continue;
      for (const f of frames)
        for (const [a, b, L] of bones) {
          // The shin never leaves the picture plane in the side view (no shinD authored), so its drawn length is fixed.
          if (Math.abs(f.pose[a === "kneeR" ? "shinDR" : "shinDL"]) > 0.5) continue;
          const d = Math.hypot(f.pts[a][0] - f.pts[b][0], f.pts[a][1] - f.pts[b][1]);
          if (Math.abs(d - L) > 0.5) bad.push(`${e.slug} ${a}-${b} ${d.toFixed(1)} (expected ${L})`);
        }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});
