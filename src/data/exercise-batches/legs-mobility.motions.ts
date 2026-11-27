import type { Keyframe, MotionDef, Pose, PropDef, Vec } from "../../lib/exercise-motion/types";
import { FEET, armTo, armsLocal, centerOfMass, lm, plantLeg, pose, solve1D, stanceLegs, worldPts } from "../../lib/exercise-motion/build";
import { ankleForSole, BODY } from "../../lib/exercise-motion/skeleton";
import { pull, squat } from "../../lib/exercise-motion/patterns/lower";
import { bridge, calfRaise } from "../../lib/exercise-motion/patterns/lower2";
import { standHold } from "../../lib/exercise-motion/patterns/locomotion";
import { handsTo, legsTo } from "../../lib/exercise-motion/patterns/upper";

const S = "Side view. ";

/** Apply a pose change to every keyframe of a pattern's motion (single-leg and stance variants of a two-leg pattern). */
function eachKey(def: MotionDef, f: (k: Keyframe) => Keyframe): MotionDef {
  return { ...def, keyframes: def.keyframes.map(f) };
}

/**
 * Single-leg glute bridge: the glute-bridge pattern with the far leg lifted off the floor and held straight, its thigh
 * level with the working thigh, so only the near foot pushes.
 */
function singleLegBridge(id: string, label: string): MotionDef {
  const def = bridge(id, label);
  return eachKey(def, (k) => {
    const ik = { ...k.ik };
    delete ik.footL;
    return { ...k, ik, pose: { ...k.pose, hipL: k.pose.hipR, kneeL: 2, ankleL: 0 } };
  });
}

/**
 * Single-leg hip thrust: the bench hip-thrust pattern (no bar) with the far knee held up, the hip and knee each bent about
 * 90° throughout, so only the near foot drives.
 */
function singleLegHipThrust(id: string, label: string): MotionDef {
  const def = bridge(id, label, { bench: true });
  return eachKey(def, (k) => {
    const ik = { ...k.ik };
    delete ik.footL;
    return { ...k, ik, pose: { ...k.pose, hipL: 95, kneeL: 90, ankleL: 0 } };
  });
}

/**
 * Single-leg calf raise: the standing calf-raise pattern on the near foot only, the far knee bent so that foot is off the
 * floor behind, one dumbbell in the near hand.
 */
function singleLegCalfRaise(id: string, label: string): MotionDef {
  const def = calfRaise(id, label);
  return {
    ...eachKey(def, (k) => ({ ...k, pose: { ...k.pose, hipL: k.pose.hipR + 6, kneeL: 72, ankleL: -24 } })),
    props: (def.props ?? []).filter((p) => p.id !== "dbL"),
    planted: ["R"],
  };
}

/**
 * B-stance (kickstand) Romanian deadlift: the dumbbell Romanian-deadlift pattern with the far foot back on its toes, the
 * ball of that foot level with the near heel, so the near leg takes most of the load. The far foot stays fixed while the
 * hips hinge.
 */
function bStanceRdl(id: string, label: string): MotionDef {
  const def = pull({ id, label, fromTop: true, implement: "dumbbell", barStart: 44, down: 2, up: 1.2 });
  const ball: Vec = [-BODY.footBack - 12, 0];
  const rot = -30;
  return {
    ...eachKey(def, (k) => {
      const W = worldPts(k.pose, k.root);
      const p = plantLeg({ ...k.pose, kneeL: 20 }, "L", W.pelvis, ball, rot);
      const ankle = worldPts(p, k.root).ankleL;
      return { ...k, pose: p, ik: { ...k.ik, footL: ankle } };
    }),
    planted: ["R"],
  };
}

/** Wall sit: back flat on the wall, thighs level, knees over the ankles, hands resting on the thighs. */
function wallSit(id: string, label: string): MotionDef {
  let p = pose({ ...stanceLegs(0, 90, 0), neck: 0 });
  const W = worldPts(p, FEET);
  const hand: Vec = [W.kneeR[0] - 8, W.kneeR[1] + 6];
  p = handsTo(p, FEET, hand);
  const wallX = worldPts(p, FEET).upperBack[0] - 0.5;
  const def = standHold(id, label, p, 0);
  return { ...def, props: [{ id: "wall", kind: "wall", at: [wallX, 0], variant: "left", layer: "back" }], planted: ["L", "R"] };
}

/** Standing quad stretch: balanced on the near leg, the far hand holds the far ankle behind, heel drawn toward the glute. */
function standingQuadStretch(id: string, label: string): MotionDef {
  const make = (shin: number): Pose => {
    let p = pose({ ...stanceLegs(shin, 3, 2, ["R"]), neck: 0, hipL: 2 - 6, kneeL: 142, ankleL: -42 });
    // Far hand on the far ankle; near arm forward a little for balance.
    const A = worldPts(p, { pin: "pelvis", at: [0, 0] }).ankleL;
    p = armTo(p, "L", [A[0] - 2, A[1] + 3]);
    return { ...p, shR: 40, elR: 12 };
  };
  // Balance the whole body over the standing foot (shin lean).
  const shin = solve1D((s) => centerOfMass(make(s))[0] - lm(make(s), "soleR")[0], -10, 10);
  return { ...standHold(id, label, make(shin), 1.2), planted: ["R"] };
}

/**
 * Half-kneeling hip-flexor stretch: back knee on a pad with the top of the back foot flat on the floor, front foot flat
 * with the knee bent about 90°, torso tall and the hands on the hips.
 */
function halfKneelingHipFlexor(id: string, label: string): MotionDef {
  const T = -2;
  const thighBack = -24; // back thigh angle from vertical (behind the body)
  let p = pose({ trunk: T, neck: 0, hipL: thighBack + T, kneeL: thighBack + 90, ankleL: -65, hipR: 80, kneeR: 85, ankleR: 8 });
  const root = { pin: "kneeCapL" as const, at: [0, 0] as Vec };
  const W = worldPts(p, root);
  const front = ankleForSole(W.pelvis[0] + 50, 0);
  p = legsTo(p, root, front, ["R"]);
  p = armsLocal(p, [-12, -20], [2, -36]);
  const def = standHold(id, label, p, 0);
  const Wk = worldPts(p, FEET);
  const pad: PropDef = { id: "pad", kind: "pad", at: [Wk.kneeCapL[0], 2], w: 28, layer: "back" };
  return { ...def, props: [pad] };
}

/**
 * Standing wall calf stretch: hands on the wall at shoulder height, front knee bent, back leg straight with the heel
 * pressed to the floor, body leaning toward the wall.
 */
function wallCalfStretch(id: string, label: string): MotionDef {
  const lean = 14;
  let p = pose({ ...stanceLegs(22, 52, lean, ["R"]), neck: -4 });
  // Back foot flat, the leg straight: find how far back the ankle goes for a straight knee.
  const at = (x: number) => legsTo(p, FEET, ankleForSole(x, 0), ["L"]);
  const x = solve1D((v) => at(v).kneeL - 3, -20, -120);
  p = at(x);
  const Ws = worldPts(p, FEET);
  const wallX = Ws.shoulder[0] + (BODY.upperArm + BODY.forearm) * 0.82;
  const hand: Vec = [wallX - BODY.r.hand, Ws.shoulder[1] + 2];
  p = handsTo(p, FEET, hand);
  const def = standHold(id, label, p, 0);
  return { ...def, props: [{ id: "wall", kind: "wall", at: [wallX, 0], layer: "back" }], planted: ["L", "R"] };
}

/** Hand-tuned 2D motions for the exercises in ./legs-mobility.ts, built from the shared movement patterns. */
export const MOTIONS_LEGS_MOBILITY: Record<string, (id: string) => MotionDef> = {
  // ------------------------------------------------------------------ Quads & glutes
  "overhead-squat": (id) =>
    squat({ id, load: "overhead", knee: 130, shin: 40, holdBottom: 0.3, label: `${S}Barbell locked out overhead on straight arms: squats down to about parallel with the bar staying over mid-foot, then stands back up.` }),
  "single-leg-hip-thrust": (id) =>
    singleLegHipThrust(id, `${S}Upper back on a bench, one foot flat and the other knee held up toward the chest: drives the hips up off the planted foot until the torso is level, then lowers.`),
  "barbell-glute-bridge": (id) =>
    bridge(id, `${S}Lying on the floor with knees bent and a barbell across the hip crease: drives the hips up until shoulders, hips and knees line up, holds, and lowers.`, { barbell: true }),
  "single-leg-glute-bridge": (id) =>
    singleLegBridge(id, `${S}Lying on the back, one foot flat and the other leg held straight in line with the thigh: drives the hips up off the planted foot, holds, and lowers.`),
  "wall-sit": (id) => wallSit(id, `${S}Back flat against a wall, thighs level and knees bent to 90° over the ankles, hands resting on the thighs: holds the position.`),

  // ------------------------------------------------------------------ Hamstrings & calves
  "stiff-leg-deadlift": (id) =>
    pull({ id, fromTop: true, rdlKnee: 8, barStart: 30, down: 2.2, up: 1.3, label: `${S}From standing with the knees almost straight, hinges at the hips and lowers the bar close to the legs to about mid-shin, then drives the hips forward to stand.` }),
  "kettlebell-deadlift": (id) =>
    pull({ id, implement: "kettlebell", barStart: 22, shin0: 8, label: `${S}Kettlebell on the floor between the feet: hinges down to grip the handle, stands up tall with straight arms, and lowers it back to the floor.` }),
  "b-stance-romanian-deadlift": (id) =>
    bStanceRdl(id, `${S}Near foot flat, far foot back on its toes level with the near heel, dumbbells in both hands: hinges at the hips with a soft front knee to just below the knee, then stands.`),
  "deficit-romanian-deadlift": (id) =>
    pull({
      id,
      fromTop: true,
      platform: 8,
      barStart: 36,
      down: 2.2,
      up: 1.3,
      label: `${S}Standing on a low platform: hinges with soft knees, sliding the bar down the legs past the knees to mid-shin, then drives the hips forward to stand.`,
      props: [{ id: "plat", kind: "box", at: [0, 0], w: 54, h: 8, layer: "back" }],
    }),
  "single-leg-calf-raise": (id) =>
    singleLegCalfRaise(id, `${S}Standing on the near foot with the far knee bent and that foot off the floor, a dumbbell in the near hand: rises onto the ball of the foot, pauses, and lowers the heel slowly.`),

  // ------------------------------------------------------------------ Mobility
  "standing-quad-stretch": (id) =>
    standingQuadStretch(id, `${S}Balancing on the near leg, the far hand holds the far ankle behind, heel drawn toward the glute with the knees side by side, torso tall.`),
  "half-kneeling-hip-flexor-stretch": (id) =>
    halfKneelingHipFlexor(id, `${S}Half-kneeling with the back knee on a pad and the top of that foot on the floor, front knee bent about 90°, hands on the hips: holds the stretch with the torso tall.`),
  "wall-calf-stretch": (id) =>
    wallCalfStretch(id, `${S}Hands on a wall, front knee bent and the back leg straight with its heel down: leans toward the wall and holds the stretch in the back calf.`),
};
