/**
 * Front views of exercises that also have a side view: the same movement, at the same moments, seen from in front.
 *
 * Each front view is derived from the side view's own solver (squatPose, pullPose) at every key: the torso's lean
 * becomes a lean toward the camera (trunkD), and the pelvis and knee heights are carried over. The legs are then solved
 * in the frontal plane with the feet planted at the stance width, so the knee track, stance and grip that a side view
 * cannot show are visible while the depth and timing match the side view exactly. Switching views in the player keeps
 * the position in the rep (both views share the same keyframe timing).
 */
import { BODY, forwardKinematics } from "../skeleton";
import { FEET, armThrough, both, keys, lm, pose, type KeySpec, type MotionDef, type Pose, type PropDef, type Vec } from "../build";
import { pullPose, squatPose, type PullOpts, type SquatOpts } from "./lower";

const ARM = BODY.upperArm + BODY.forearm;
/** Ankle joint height above the floor (cm), as in the sumo deadlift's front view. */
const ANKLE_H = 7.5;
const deg = (r: number) => (r * 180) / Math.PI;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Pelvis and knee heights above the floor, and the torso's lean, of a side-view pose authored in the sole frame. */
function sideHeights(p: Pose): { pelvis: number; knee: number; lean: number } {
  const sole = lm(p, "soleR");
  return { pelvis: -sole[1], knee: lm(p, "kneeR")[1] - sole[1], lean: p.trunk + p.spine * 0.5 };
}

/**
 * Legs seen from the front for a pelvis `ph` cm above the floor: feet planted `footX` cm either side of the midline, the
 * knee at height `kneeY` and pushed `kneeOut` cm outward over the toes. Thigh and shin are foreshortened by however much
 * they point toward the camera (the lengths are fixed; what is left over is depth).
 */
function legsFront(p: Pose, ph: number, footX: number, kneeY: number, kneeOut: number): Pose {
  const hip: Vec = [BODY.hipHalf, 0];
  const ankle: Vec = [footX, ANKLE_H - ph];
  // The knee's screen x: on the hip–ankle line at its height, pushed outward over the toes as it bends.
  const ky = kneeY - ph;
  const t = Math.max(0, Math.min(1, (hip[1] - ky) / Math.max(1e-6, hip[1] - ankle[1])));
  const knee: Vec = [hip[0] + (ankle[0] - hip[0]) * t + kneeOut, ky];
  const th: Vec = [knee[0] - hip[0], knee[1] - hip[1]];
  const sh: Vec = [ankle[0] - knee[0], ankle[1] - knee[1]];
  const hipAbd = deg(Math.atan2(th[0], -th[1]));
  const shinTilt = deg(Math.atan2(sh[0], -sh[1]));
  const legD = deg(Math.acos(Math.min(1, Math.hypot(th[0], th[1]) / BODY.thigh)));
  const shinD = deg(Math.acos(Math.min(1, Math.hypot(sh[0], sh[1]) / BODY.shin)));
  return { ...p, hipL: hipAbd, hipR: hipAbd, ankleL: shinTilt, ankleR: shinTilt, legDL: legD, legDR: legD, shinDL: shinD, shinDR: shinD };
}

/**
 * legsFront, corrected so the soles land exactly `soleX` cm either side of the midline: a front-view foot turns with
 * its shin, so pushing the knees out moves the sole even when the ankle stays put. A few passes of measuring where the
 * sole landed and moving the ankle target by the error put it back (the planted feet then do not slide).
 */
function plantedLegsFront(p: Pose, ph: number, soleX: number, kneeY: number, kneeOut: number): Pose {
  let footX = soleX;
  let out = legsFront(p, ph, footX, kneeY, kneeOut);
  for (let i = 0; i < 4; i++) {
    const sk = forwardKinematics(out, "front");
    const err = soleX - (sk.pts.soleL[0] - sk.pts.soleR[0]) / 2;
    if (Math.abs(err) < 0.05) break;
    footX += err;
    out = legsFront(p, ph, footX, kneeY, kneeOut);
  }
  return out;
}

/** Keys at the given rep positions `s` (0 = top, 1 = bottom) with the given durations and holds. */
function track(at: (s: number) => Pose, steps: { s: number; dur: number; hold?: number }[]): KeySpec[] {
  return steps.map((k) => ({ pose: at(k.s), dur: k.dur, hold: k.hold, ease: "spline" }));
}

// ------------------------------------------------------------------------------------------------ Squat

/**
 * Barbell back squat from the front: feet a little wider than the hips, knees tracking out over the toes as the hips
 * sit down between them, bar across the upper back behind the neck with the hands just outside the shoulders. Depth,
 * torso lean and timing are the side view's (squatPose with the same options).
 */
export function backSquatFront(id: string, label: string, o: Omit<SquatOpts, "id" | "label">): MotionDef {
  const footX = 21;
  const at = (s: number): Pose => {
    const side = squatPose(s, { ...o, id, label });
    const h = sideHeights(side);
    let p = pose({ trunkD: Math.max(0, h.lean), neck: -side.neck });
    p = plantedLegsFront(p, h.pelvis, footX, h.knee, 4.5 * smooth(s));
    // Hands on the bar just outside the shoulders, elbows down under the bar (they point back, out of the picture).
    const sk = forwardKinematics(p, "front");
    for (const sideName of ["L", "R"] as const) {
      const k = sideName === "L" ? 1 : -1;
      const shoulder = sk.pts[`shoulder${sideName}`];
      const hand: Vec = [k * (BODY.shoulderHalf + 13), shoulder[1] + 4.5];
      const elbow: Vec = [k * (BODY.shoulderHalf + 15), hand[1] - 19];
      p = armThrough(p, sideName, elbow, hand, "front");
    }
    return p;
  };
  // The side view's timing (rep: down `down` s, up `up` s, holds), with extra keys so the planted feet stay put.
  const down = o.down ?? 2;
  const up = o.up ?? 1;
  // Keys close together near the bottom: there the thigh points almost straight at the camera, so its short on-screen
  // image turns quickly, and interpolating across a wide gap would let the planted feet slide. Time is shared out in
  // proportion to the distance travelled.
  const S = [0, 0.15, 0.3, 0.45, 0.6, 0.72, 0.82, 0.89, 0.94, 0.975, 1];
  const steps: { s: number; dur: number; hold?: number }[] = [];
  for (let i = 0; i < S.length - 1; i++) steps.push({ s: S[i]!, dur: down * (S[i + 1]! - S[i]!), hold: i === 0 ? (o.holdTop ?? 0.4) : undefined });
  for (let i = S.length - 1; i > 0; i--) steps.push({ s: S[i]!, dur: up * (S[i]! - S[i - 1]!), hold: i === S.length - 1 ? (o.holdBottom ?? 0) : undefined });
  const specs = track(at, steps);
  return {
    id,
    view: "front",
    label,
    keyframes: keys(FEET, specs),
    props: [{ id: "bar", kind: "barbell", variant: "front", at: { lm: "hands" }, layer: "back", size: 17.5 }],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: o.stillPhase ?? 0.45,
  };
}

// ------------------------------------------------------------------------------------------------ Deadlift

/**
 * Conventional deadlift from the front: feet about hip width, hands just outside the legs with straight arms, the bar
 * over the feet from the floor to a tall lockout. Bar heights, torso lean and timing are the side view's (pullPose).
 */
export function deadliftFront(id: string, label: string, o: Omit<PullOpts, "id" | "label"> = {}): MotionDef {
  const footX = 14;
  const grip = 24;
  const y0 = o.barStart ?? 22.5;
  const top = o.barTop ?? 86;
  const at = (s: number): Pose => {
    const barY = top + (y0 - top) * s;
    const side = pullPose(barY, { ...o, id, label, barStart: y0 });
    const h = sideHeights(side);
    let p = pose({ trunkD: Math.max(0, h.lean), neck: -Math.max(0, side.neck) });
    p = plantedLegsFront(p, h.pelvis, footX, h.knee, 1);
    // Arms hang straight from the shoulders to the bar.
    const sk = forwardKinematics(p, "front");
    for (const sideName of ["L", "R"] as const) {
      const k = sideName === "L" ? 1 : -1;
      const shoulder = sk.pts[`shoulder${sideName}`];
      const hand: Vec = [k * grip, barY - h.pelvis];
      // A straight arm: the elbow on the line from shoulder to hand, at the upper arm's share of it (any shortfall from
      // the full arm length is the arm reaching toward the camera, which armThrough turns into foreshortening).
      const f = BODY.upperArm / ARM;
      const elbow: Vec = [shoulder[0] + (hand[0] - shoulder[0]) * f, shoulder[1] + (hand[1] - shoulder[1]) * f];
      p = armThrough(p, sideName, elbow, hand, "front");
    }
    return p;
  };
  const upT = o.up ?? 1.2;
  const downT = o.down ?? 1.6;
  // The side view (pull): bottom hold, up in two halves, top hold, down in two halves; here in quarters so the planted
  // feet stay put.
  const specs = track(at, [
    { s: 1, dur: upT * 0.25, hold: o.holdBottom ?? 0.5 },
    { s: 0.75, dur: upT * 0.25 },
    { s: 0.5, dur: upT * 0.25 },
    { s: 0.25, dur: upT * 0.25 },
    { s: 0, dur: downT * 0.25, hold: o.holdTop ?? 0.5 },
    { s: 0.25, dur: downT * 0.25 },
    { s: 0.5, dur: downT * 0.25 },
    { s: 0.75, dur: downT * 0.25 },
  ]);
  return {
    id,
    view: "front",
    label,
    keyframes: keys(FEET, specs),
    props: [{ id: "bar", kind: "barbell", variant: "front", at: { lm: "hands" }, layer: "front" }],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.05,
  };
}

// ------------------------------------------------------------------------------------------------ Curl

/**
 * Dumbbell curl from the front: palms forward, upper arms still at the sides, both dumbbells curled up toward the
 * shoulders and lowered slowly. The elbow bend (6° → 140° → 6°) and timing are the side view's (1 s up, 2 s down, short
 * holds); from the front the forearm swings toward the camera, so it shortens on the way up and rises above the elbow
 * past halfway.
 */
export function curlFront(id: string, label: string): MotionDef {
  const stand = pose({ ...both({ hip: 6, ankle: 3, knee: 4 }) });
  const at = (flex: number): Pose => {
    let p = stand;
    const sk = forwardKinematics(p, "front");
    for (const sideName of ["L", "R"] as const) {
      const k = sideName === "L" ? 1 : -1;
      const shoulder = sk.pts[`shoulder${sideName}`];
      // Upper arm hangs by the side (a few degrees out so the elbow clears the torso), nearly its full length.
      const elbow: Vec = [shoulder[0] + k * 3.5, shoulder[1] - BODY.upperArm * 0.99];
      const c = Math.cos((flex * Math.PI) / 180);
      const hand: Vec = [elbow[0] + k * 1.2, elbow[1] - BODY.forearm * c];
      p = armThrough(p, sideName, elbow, hand, "front");
    }
    return p;
  };
  // Concentric 1 s and eccentric 2 s, split by elbow angle; the keys either side of 90° are a hair apart (the forearm
  // points straight at the camera there).
  const upKeys = [6, 40, 87, 93, 125, 140];
  const conc = 1;
  const ecc = 2;
  const total = 140 - 6;
  const specs: KeySpec[] = [];
  for (let i = 0; i < upKeys.length - 1; i++) {
    const a = upKeys[i]!;
    const b = upKeys[i + 1]!;
    specs.push({ pose: at(a), dur: (conc * (b - a)) / total, hold: i === 0 ? 0.3 : 0, ease: "spline" });
  }
  const downKeys = [...upKeys].reverse();
  for (let i = 0; i < downKeys.length - 1; i++) {
    const a = downKeys[i]!;
    const b = downKeys[i + 1]!;
    specs.push({ pose: at(a), dur: (ecc * (a - b)) / total, hold: i === 0 ? 0.3 : 0, ease: "spline" });
  }
  const props: PropDef[] = [
    { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "profile", angle: 0, layer: "front", size: 0.9 },
    { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", angle: 0, layer: "front", size: 0.9 },
  ];
  return {
    id,
    view: "front",
    label,
    keyframes: keys({ ground: 0 }, specs),
    props,
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.4,
  };
}
