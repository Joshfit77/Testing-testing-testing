import { EXERCISES } from "@/data/exercises";
import { EXERCISE_MOTIONS, fallbackMotion } from "@/data/exercise-motions";
import { getMotion, hasMotion } from "@/lib/exercise-motion";
import { FRONT_LIMITS, LIMITS } from "@/lib/exercise-motion/skeleton";
import { compileMotion, evaluate, lowestContact, sampleFrames } from "@/lib/exercise-motion/timeline";
import { forwardKinematics } from "@/lib/exercise-motion/skeleton";
import type { ExerciseMeta, Frame, MotionDef, Pose } from "@/lib/exercise-motion/types";

const metaOf = (e: (typeof EXERCISES)[number]): ExerciseMeta => ({ slug: e.slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed });

const SAMPLES = 36;

/**
 * Limits are checked on the drawn (projected) 2D angles. A limb that leaves the picture plane (foreshortened by
 * 20° or more, e.g. elbows flared out in a front rack) can show a larger apparent elbow / shoulder angle than the
 * real joint, so those get a wider projected range.
 */
function limitFor(def: MotionDef, f: Frame, key: keyof Pose): [number, number] {
  const base = (def.view === "front" ? FRONT_LIMITS[key] : undefined) ?? LIMITS[key];
  const side = key.endsWith("L") ? "L" : "R";
  const outOfPlane = def.view === "side" && (Math.abs(f.pose[`armD${side}`]) >= 20 || Math.abs(f.pose[`foreD${side}`]) >= 20);
  if (outOfPlane && (key === "elL" || key === "elR")) return [-20, 200];
  if (outOfPlane && (key === "shL" || key === "shR")) return [-110, 215];
  return base;
}

function limitViolations(def: MotionDef, frames: Frame[]): string[] {
  const out: string[] = [];
  const allow = new Set(def.allowLimits ?? []);
  for (const f of frames) {
    for (const key of Object.keys(LIMITS) as (keyof Pose)[]) {
      if (allow.has(key)) continue;
      const [lo, hi] = limitFor(def, f, key);
      const v = f.pose[key];
      if (!Number.isFinite(v)) out.push(`${key} not finite`);
      else if (v < lo - 1 || v > hi + 1) out.push(`${key}=${v.toFixed(1)} outside [${lo}, ${hi}]`);
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
