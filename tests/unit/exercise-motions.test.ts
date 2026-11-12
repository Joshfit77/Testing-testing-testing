import { EXERCISES } from "@/data/exercises";
import { EXERCISE_MOTIONS, fallbackMotion } from "@/data/exercise-motions";
import { getMotion, hasMotion } from "@/lib/exercise-motion";
import { FRONT_LIMITS, LIMITS, armAngles3D } from "@/lib/exercise-motion/skeleton";
import { compileMotion, evaluate, lowestContact, sampleFrames } from "@/lib/exercise-motion/timeline";
import { forwardKinematics } from "@/lib/exercise-motion/skeleton";
import type { ExerciseMeta, Frame, MotionDef, Pose } from "@/lib/exercise-motion/types";

const metaOf = (e: (typeof EXERCISES)[number]): ExerciseMeta => ({ slug: e.slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed });

const SAMPLES = 36;

/**
 * Joint limits. Angles are authored as drawn (projected) 2D angles. An arm that leaves the picture plane (armD / foreD,
 * e.g. elbows flared in a front rack, hands reaching sideways to a bar on the back) projects to elbow and shoulder
 * angles that can read far outside the anatomical range while the real joint is fine, so for such arms the elbow and
 * shoulder are checked on their real three-dimensional angles (armAngles3D) instead of their projections; everything
 * else is checked on the drawn angle against LIMITS / FRONT_LIMITS.
 */
const OUT_OF_PLANE = 20;
const ELBOW_MAX = LIMITS.elR[1];
/** How far the upper arm may point behind the body, by how far it is raised: 75° hanging, 10° overhead. */
const shoulderBackAllowed = (elevation: number) => (elevation <= 75 ? 75 : elevation >= 170 ? 10 : 75 - ((elevation - 75) / 95) * 65);

function jointViolation(def: MotionDef, f: Frame, key: keyof Pose): string | null {
  const side = key.endsWith("L") ? "L" : "R";
  const arm = key === "elL" || key === "elR" || key === "shL" || key === "shR";
  const outOfPlane = def.view === "side" && arm && (Math.abs(f.pose[`armD${side}`]) >= OUT_OF_PLANE || Math.abs(f.pose[`foreD${side}`]) >= OUT_OF_PLANE);
  if (outOfPlane) {
    const a = armAngles3D(f.pose, side);
    if (key.startsWith("el")) return a.elbowFlex > ELBOW_MAX + 1 ? `${key}: real elbow flexion ${a.elbowFlex.toFixed(1)} > ${ELBOW_MAX} (projected ${f.pose[key].toFixed(1)})` : null;
    const allowed = shoulderBackAllowed(a.shoulderElevation);
    return a.shoulderBack > allowed + 1 ? `${key}: arm ${a.shoulderBack.toFixed(1)}° behind the body at ${a.shoulderElevation.toFixed(0)}° elevation (allowed ${allowed.toFixed(0)})` : null;
  }
  const [lo, hi] = (def.view === "front" ? FRONT_LIMITS[key] : undefined) ?? LIMITS[key];
  const v = f.pose[key];
  if (!Number.isFinite(v)) return `${key} not finite`;
  return v < lo - 1 || v > hi + 1 ? `${key}=${v.toFixed(1)} outside [${lo}, ${hi}]` : null;
}

function limitViolations(def: MotionDef, frames: Frame[]): string[] {
  const out: string[] = [];
  const allow = new Set(def.allowLimits ?? []);
  for (const f of frames) {
    for (const key of Object.keys(LIMITS) as (keyof Pose)[]) {
      if (allow.has(key)) continue;
      const v = jointViolation(def, f, key);
      if (v) out.push(v);
    }
  }
  return [...new Set(out)];
}

describe("exercise motions", () => {
  it("every catalog exercise resolves to a motion", () => {
    for (const e of EXERCISES) {
      expect(hasMotion(e.slug, metaOf(e)), e.slug).toBe(true);
      const def = getMotion(e.slug, metaOf(e));
      expect(def.keyframes.length, e.slug).toBeGreaterThanOrEqual(2);
      expect(def.label.length, e.slug).toBeGreaterThan(20);
    }
  });

  it("has a hand-made definition for (nearly) every catalog exercise", () => {
    // New catalog entries fall back to a pattern-based motion; keep the gap small.
    const missing = EXERCISES.filter((e) => !(e.slug in EXERCISE_MOTIONS)).map((e) => e.slug);
    expect(missing.length, `missing: ${missing.join(", ")}`).toBeLessThanOrEqual(5);
  });

  it("pattern-based fallbacks are valid for every catalog exercise (as if it were new)", () => {
    for (const e of EXERCISES) {
      const def = fallbackMotion(metaOf(e));
      const frames = sampleFrames(compileMotion(def), 12);
      expect(limitViolations(def, frames), `${e.slug} fallback`).toEqual([]);
    }
  });

  describe.each(EXERCISES.map((e) => [e.slug, e] as const))("%s", (slug, e) => {
    const def = getMotion(slug, metaOf(e));
    const c = compileMotion(def);

    it("has well-formed keyframes and timing", () => {
      for (const k of def.keyframes) {
        expect(k.dur, slug).toBeGreaterThan(0);
        expect(k.hold ?? 0).toBeGreaterThanOrEqual(0);
        for (const v of Object.values(k.pose)) expect(Number.isFinite(v)).toBe(true);
      }
      expect(c.duration).toBeGreaterThanOrEqual(0.4);
      expect(c.duration).toBeLessThan(12);
    });

    it("keeps joint angles within anatomical limits", () => {
      expect(limitViolations(def, sampleFrames(c, SAMPLES))).toEqual([]);
    });

    it("closes the loop smoothly", () => {
      const a = evaluate(c, 0);
      const b = evaluate(c, c.duration - 1e-4);
      const travel = def.travel ?? 0;
      for (const key of Object.keys(a.pose) as (keyof Pose)[]) expect(Math.abs(a.pose[key] - b.pose[key]), `${slug} ${key}`).toBeLessThan(2);
      expect(Math.abs(a.pts.pelvis[0] + travel - b.pts.pelvis[0]), "pelvis x").toBeLessThan(2);
      expect(Math.abs(a.pts.pelvis[1] - b.pts.pelvis[1]), "pelvis y").toBeLessThan(2);
    });

    it("stays on (not through or floating above) the floor", () => {
      for (const f of sampleFrames(c, SAMPLES)) {
        const sk = forwardKinematics(f.pose, def.view, f.pts.pelvis);
        expect(lowestContact(sk, def.view), slug).toBeGreaterThan(-0.1);
        // The floor clamp should only nudge a well-authored motion, never lift the whole body.
        expect(f.lifted ?? 0, `${slug} lifted`).toBeLessThan(3);
      }
    });

    if (def.footGrounded) {
      it("keeps a foot on the floor", () => {
        for (const f of sampleFrames(c, SAMPLES)) {
          const low = Math.min(f.pts.heelL[1], f.pts.heelR[1], f.pts.ballL[1], f.pts.ballR[1], f.pts.toeL[1], f.pts.toeR[1], f.pts.soleL[1], f.pts.soleR[1]);
          expect(low, slug).toBeLessThan(1.5);
        }
      });
    }

    for (const side of def.planted ?? []) {
      it(`keeps the ${side === "R" ? "near" : "far"} foot planted`, () => {
        const frames = sampleFrames(c, SAMPLES);
        const ref = frames[0]!.pts[`ball${side}`];
        for (const f of frames) {
          const p = f.pts[`ball${side}`];
          expect(Math.hypot(p[0] - ref[0], p[1] - ref[1]), slug).toBeLessThan(1.5);
        }
      });
    }
  });
});
