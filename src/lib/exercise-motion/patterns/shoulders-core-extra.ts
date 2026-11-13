/**
 * Extra shoulder and core patterns for the 2026-11-13 library expansion (src/data/exercise-batches/shoulders-core.*).
 * Built only on the engine's authoring helpers (build.ts) and the exported helpers of patterns/upper.ts, so the
 * existing patterns are untouched.
 */
import { BODY, ankleForSole } from "../skeleton";
import { FEET, both, keys, mix, pose, stanceLegs, worldPts, type KeySpec, type MotionDef, type Pose, type PropDef, type RootRule, type Vec } from "../build";
import { handsTo, ik2, legsTo } from "./upper";

const ARM = BODY.upperArm + BODY.forearm;
const k = (p: Pose, dur: number, hold = 0, extra: Partial<KeySpec> = {}): KeySpec => ({ pose: p, dur, hold, ease: "inOut", ...extra });

// ------------------------------------------------------------------------------------------- Front raise

/**
 * Dumbbell front raise, side view: standing tall with the dumbbells in front of the thighs (palms facing the body),
 * both arms rise forward with a soft elbow to shoulder height, pause, and lower slowly. The torso stays still.
 */
export function frontRaise(id: string, label: string): MotionDef {
  const base = pose({ ...stanceLegs(1, 3, 0), neck: 0 });
  const down0 = { ...base, ...both({ sh: 6, el: 8 }) };
  const top = { ...base, ...both({ sh: 90, el: 10 }) };
  return {
    id,
    view: "side",
    label,
    keyframes: keys(FEET, [k(down0, 1.6, 0.3), k(mix(down0, top, 0.55), 0.6), k(top, 1.2, 0.35), k(mix(down0, top, 0.55), 0.9)].map((s) => ({ ...s, ease: "spline" as const }))),
    props: [
      { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "end", layer: "far" },
      { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "end", layer: "front" },
    ],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.5,
  };
}

// ------------------------------------------------------------------------------------------------ Y-raise

/**
 * Incline Y-raise, side view: lying face down on a bench set at about 40° with the feet on the floor, light dumbbells
 * hanging under the shoulders. Both arms rise with straight elbows, thumbs up, until they are in line with the torso
 * in a Y (out about 30° to each side, so drawn a little short), pause, and lower slowly.
 */
export function inclineYRaise(id: string, label: string): MotionDef {
  const angle = 40;
  const root: RootRule = { pin: "chest", at: [0, 84] };
  let base = pose({ trunk: 90 - angle, neck: -14, ...both({ hip: 40, knee: 30, ankle: 10, armD: 0 }) });
  const W = worldPts(base, root);
  const foot = ankleForSole(W.pelvis[0] - 6, 0);
  base = legsTo(base, root, foot, ["L", "R"], -30);
  const W2 = worldPts(base, root);
  const hang: Vec = [W2.shoulder[0] + 2, W2.shoulder[1] - (ARM - 2)];
  const bottom = handsTo(base, root, hang);
  // Arms in line with the torso, overhead from the body's point of view; out about 30° to the sides.
  const top = { ...base, ...both({ sh: 178, el: 3, armD: 30, foreD: 30 }) };
  const mid = { ...base, ...both({ sh: 100, el: 4, armD: 14, foreD: 14 }) };
  const ikF = { footL: foot, footR: foot };
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      k(bottom, 0.9, 0.3, { ik: { ...ik2(hang), ...ikF } }),
      k(mid, 0.8, 0, { ik: ikF }),
      k(top, 1.3, 0.45, { ik: ikF }),
      k(mid, 1, 0, { ik: ikF }),
    ]),
    props: [
      { id: "bench", kind: "inclineBench", at: [W2.pelvis[0] + 6, W2.pelvis[1] - 12], angle, w: 80, h: 20, variant: "right", layer: "near" },
      { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "profile", follow: "handL", layer: "far" },
      { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", follow: "handR", layer: "front" },
    ],
    footGrounded: true,
    stillPhase: 0.5,
  };
}

// ------------------------------------------------------------------------------------------ Hollow hold

/**
 * Hollow body hold, side view: lying on the back with the lower back pressed into the mat, the shoulder blades and
 * head curled just off the floor, arms reaching past the ears and straight legs together a little off the floor;
 * held with slow breathing.
 */
export function hollowHold(id: string, label: string): MotionDef {
  const make = (lift: number, legs: number) => pose({ trunk: -90, spine: lift, neck: 14, ...both({ hip: legs, knee: 0, ankle: -32, sh: 174, el: 4 }) });
  const a = make(22, 26);
  const b = make(20, 24);
  return {
    id,
    view: "side",
    label,
    keyframes: keys({ ground: 0 }, [k(a, 2.1), k(b, 2.1)]),
    props: [{ id: "mat", kind: "mat", at: [0, 0], w: 220, layer: "back" }],
    stillPhase: 0,
  };
}

// ---------------------------------------------------------------------------------------- Reverse crunch

/**
 * Reverse crunch, side view: lying on the back, arms by the sides with the palms down, hips and knees bent about 90°
 * with the shins level. The abs curl the pelvis up off the mat so the knees travel toward the chest (the upper back and
 * shoulders stay down), then the hips lower slowly back to the start.
 */
export function reverseCrunch(id: string, label: string): MotionDef {
  // The upper back stays flat on the mat: trunk + spine stays -90 while the lower back curls up.
  const at = (curl: number) => pose({ trunk: -90 - curl, spine: curl, neck: 10, ...both({ hip: 88 + curl * 1.3, knee: 92 - curl * 0.3, ankle: -16, sh: 8, el: 0 }) });
  const start = at(0);
  const flat = worldPts(start, { ground: 0 });
  const root: RootRule = { pin: "upperBack", at: flat.upperBack };
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [k(start, 0.9, 0.3), k(at(14), 0.6), k(at(28), 1.4, 0.35), k(at(14), 0.9)].map((s) => ({ ...s, ease: "spline" as const }))),
    props: [{ id: "mat", kind: "mat", at: [flat.pelvis[0] - 20, 0], w: 220, layer: "back" }],
    stillPhase: 0.5,
  };
}

// ------------------------------------------------------------------------------------------------- V-up

/**
 * V-up, side view: lying flat with the arms overhead on the mat and the legs straight. The torso and the straight legs
 * rise together until the body balances on the seat in a V with the hands reaching to the shins, then both lower back
 * to the mat under control.
 */
export function vUp(id: string, label: string): MotionDef {
  const flat = pose({ trunk: -90, neck: 4, ...both({ hip: 0, knee: 0, ankle: -28, sh: 178, el: 4 }) });
  const W0 = worldPts(flat, { ground: 0 });
  const root: RootRule = { pin: "butt", at: W0.butt };
  let top = pose({ trunk: -38, spine: 14, neck: 8, ...both({ hip: 112, knee: 2, ankle: -28 }) });
  const Wt = worldPts(top, root);
  const reach: Vec = [(Wt.kneeR[0] + Wt.ankleR[0]) / 2 - 4, (Wt.kneeR[1] + Wt.ankleR[1]) / 2 - 6];
  top = handsTo(top, root, reach);
  const mid = mix(flat, top, 0.5);
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [k(flat, 0.7, 0.35), k(mid, 0.45), k(top, 1.2, 0.3), k(mid, 0.6)].map((s) => ({ ...s, ease: "spline" as const }))),
    props: [{ id: "mat", kind: "mat", at: [W0.pelvis[0] - 10, 0], w: 230, layer: "back" }],
    stillPhase: 0.55,
  };
}

// ------------------------------------------------------------------------------------ Hanging leg raise

/**
 * Hanging straight-leg raise, side view: hanging from a bar with straight arms, the straight legs rise together to
 * at least hip height (the pelvis curling up at the top and the body leaning back a little to balance), then lower
 * slowly without swinging.
 */
export function hangingLegRaise(id: string, label: string): MotionDef {
  const bar: Vec = [0, 232];
  const root: RootRule = { pin: "handR", at: bar };
  const arms = both({ sh: 176, el: 4, armD: 24 });
  const bottom = pose({ trunk: -4, neck: -6, ...arms, ...both({ hip: 2, knee: 6, ankle: -22 }) });
  const up = pose({ trunk: -16, spine: 10, neck: 4, ...arms, ...both({ hip: 104, knee: 4, ankle: -24 }) });
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: bottom, dur: 1, hold: 0.45, ease: "spline" },
      { pose: mix(bottom, up, 0.5), dur: 0.9, ease: "spline" },
      { pose: up, dur: 1.1, hold: 0.3, ease: "spline" },
      { pose: mix(bottom, up, 0.5), dur: 1.1, ease: "spline" },
    ]),
    props: [{ id: "bar", kind: "pullupBar", at: bar, layer: "back" } satisfies PropDef],
    stillPhase: 0.5,
  };
}
