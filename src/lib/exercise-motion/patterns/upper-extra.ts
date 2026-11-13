/**
 * More upper-body patterns (library expansion of 2026-11-13): lying dumbbell fly, lying triceps extension, dumbbell
 * kickback, bench dip, decline bench press and knee push-up. Built on the same primitives as ./upper.ts.
 */
import { BODY, ankleForSole, normFlex } from "../skeleton";
import { FEET, armThrough, both, keys, pose, repSmooth, solve1D, stanceLegs, worldPts, type KeySpec, type MotionDef, type Pose, type PropDef, type RootRule, type Side, type Vec } from "../build";
import { handsTo, ik2, legsTo, toLocal } from "./upper";

const ARM = BODY.upperArm + BODY.forearm;
const BENCH_TOP = 44;
const DEG = 180 / Math.PI;

/** A direction in the upper back's frame: forward (out of the chest), up (along the spine toward the head), lateral. */
type V3 = [number, number, number];

/**
 * Set a side-view arm from the real directions of its upper arm and forearm (upper-back frame). The part of each
 * segment in the picture plane gives the drawn shoulder and elbow angles, the part out of it the foreshortening.
 */
function arm3D(p: Pose, s: Side, upper: V3, fore: V3): Pose {
  const n = (v: V3): V3 => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const u = n(upper);
  const f = n(fore);
  const sh = Math.atan2(u[0], -u[1]) * DEG;
  const fa = Math.atan2(f[0], -f[1]) * DEG;
  return { ...p, [`sh${s}`]: sh, [`armD${s}`]: Math.asin(u[2]) * DEG, [`el${s}`]: normFlex(fa - sh), [`foreD${s}`]: Math.asin(f[2]) * DEG };
}

/** Lying on a flat (incline 0) or inclined bench, feet flat on the floor: the base pose and its root. */
function lying(incline: number): { base: Pose; root: RootRule; feet: Vec } {
  const root: RootRule = incline ? { pin: "upperBack", at: [-20, BENCH_TOP + 22] } : { pin: "upperBack", at: [0, BENCH_TOP] };
  let base = pose({ trunk: -90 + incline, spine: incline ? -4 : -9, neck: incline ? 8 : -4 });
  const pel = worldPts(base, root).pelvis;
  const feet = ankleForSole(pel[0] + (incline ? 40 : 50), 0);
  base = legsTo(base, root, feet);
  return { base, root, feet };
}

function benchProp(base: Pose, root: RootRule, incline: number): PropDef {
  const W = worldPts(base, root);
  return incline
    ? { id: "bench", kind: "inclineBench", at: [W.butt[0] - 2, BENCH_TOP + 2], angle: incline, layer: "mid", w: 80, h: 34 }
    : { id: "bench", kind: "bench", at: [W.mid[0] + 8, BENCH_TOP], w: 118, layer: "mid" };
}

// ------------------------------------------------------------------------------------------- Dumbbell fly

export interface FlyOpts {
  id: string;
  label: string;
  /** Bench angle (0 = flat). */
  incline?: number;
}

/**
 * Lying dumbbell fly. The arms sweep in a wide arc out to the sides and back, the elbows held slightly bent (about 20°)
 * throughout: from the dumbbells together over the chest (arms near vertical, palms facing) down until the upper arms
 * are about level with the torso, then back up. Seen from the side the arms foreshorten as they open out of the
 * picture, so the dumbbells drop to about chest height beside the body. Neutral grip: the handles stay along the body.
 */
export function dumbbellFly(o: FlyOpts): MotionDef {
  const incline = o.incline ?? 0;
  const { base, root, feet } = lying(incline);
  const BEND = 22;
  // Tilt of the arms along the body: on a flat bench a little toward the feet (the dumbbells travel over the line of the
  // nipples), on an incline toward the head so they stay over the upper chest rather than drifting toward the hips.
  // At the bottom the upper arms point straight out from the shoulders, level with the torso.
  const ALONG_TOP = incline ? Math.sin((incline * 0.7) / DEG) : -0.18;
  const ALONG_BOTTOM = -0.1;
  const at = (s: number): Pose => {
    // Arc angle from straight up (0) toward the side (90); a little past level at the bottom.
    const phi = -9 + (90 + 9) * s;
    const r = phi / DEG;
    const rf = (phi - BEND) / DEG;
    const along = ALONG_TOP + (ALONG_BOTTOM - ALONG_TOP) * s;
    const upper: V3 = [Math.cos(r), along, Math.sin(r)];
    const fore: V3 = [Math.cos(rf), along, Math.sin(rf)];
    return arm3D(arm3D(base, "L", upper, fore), "R", upper, fore);
  };
  const specs = repSmooth(at, { down: 2.2, up: 1.6, holdTop: 0.35, holdBottom: 0.15 }).map((k) => ({ ...k, ik: { footL: feet, footR: feet } }));
  return {
    id: o.id,
    view: "side",
    label: o.label,
    keyframes: keys(root, specs),
    props: [
      benchProp(base, root, incline),
      { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "profile", angle: 0, layer: "far" },
      { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", angle: 0, layer: "front" },
    ],
    stillPhase: 0.5,
  };
}

// ------------------------------------------------------------------------------ Lying triceps extension

export interface LyingExtensionOpts {
  id: string;
  label: string;
  /** "ez-bar": an EZ-bar lowered to the forehead (skull crusher); "dumbbell": two dumbbells lowered beside the head. */
  implement: "ez-bar" | "dumbbell";
}

/**
 * Lying triceps extension on a flat bench. The upper arms stay fixed, tilted slightly back toward the head from
 * vertical; only the elbows bend, lowering the EZ-bar to just above the forehead or the dumbbells beside the head, then
 * extend back to straight arms.
 */
export function lyingTricepsExtension(o: LyingExtensionOpts): MotionDef {
  const { base, root, feet } = lying(0);
  const db = o.implement === "dumbbell";
  const armD = db ? 16 : 12;
  // Upper arm tilted back from vertical toward the head (a few degrees for the bar, which comes down to the forehead;
  // more for dumbbells, which pass beside the head), kept there.
  const TILT = db ? 12 : 5;
  const tilt = (sh: number) => {
    const W = worldPts({ ...base, ...both({ sh, armD, el: 0 }) }, root);
    return (Math.atan2(W.shoulder[0] - W.elbowR[0], W.elbowR[1] - W.shoulder[1]) * DEG) - TILT;
  };
  const shoulder = solve1D(tilt, 60, 150);
  const arms = (el: number): Pose => ({ ...base, ...both({ sh: shoulder, armD, el }) });
  // Bottom: the bar just above the forehead, or the dumbbells beside the head.
  const head = worldPts(base, root).head;
  const elBottom = solve1D((el) => worldPts(arms(el), root).handR[1] - (head[1] + (db ? 3 : 16)), 60, 150);
  const at = (s: number): Pose => arms(4 + (elBottom - 4) * s);
  const specs = repSmooth(at, { down: 2, up: 1.4, holdTop: 0.35, holdBottom: 0.15 }).map((k) => ({ ...k, ik: { footL: feet, footR: feet } }));
  const props: PropDef[] = [benchProp(base, root, 0)];
  if (db) {
    props.push(
      { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "profile", follow: "handL", layer: "far" },
      { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", follow: "handR", layer: "front" },
    );
  } else {
    // An EZ-bar with small (about 25 cm) plates, seen end-on.
    props.push({ id: "bar", kind: "barbell", at: { lm: "hands" }, layer: "front", size: 12.5 });
  }
  return { id: o.id, view: "side", label: o.label, keyframes: keys(root, specs), props, stillPhase: 0.5 };
}

// ---------------------------------------------------------------------------------------------- Kickback

/**
 * Bent-over two-arm dumbbell kickback: hinged forward with a flat back and soft knees, upper arms held level with the
 * floor beside the torso; only the elbows move, from bent about 90° (forearms hanging) to straight back.
 */
export function dumbbellKickback(id: string, label: string): MotionDef {
  const base = pose({ ...stanceLegs(5, 26, 62), neck: -22, ...both({ armD: 8 }) });
  const T2 = base.trunk + base.spine;
  const sh = -(90 - T2) + 3;
  const at = (s: number): Pose => ({ ...base, ...both({ sh, el: 92 - 89 * s }) });
  return {
    id,
    view: "side",
    label,
    keyframes: keys(FEET, repSmooth(at, { down: 1.2, up: 1.8, holdTop: 0.25, holdBottom: 0.4 })),
    props: [
      { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "profile", follow: "handL", layer: "far" },
      { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", follow: "handR", layer: "front" },
    ],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.6,
  };
}

// --------------------------------------------------------------------------------------------- Bench dip

/**
 * Bench dip: hands on the edge of a bench behind the hips, knees bent about 90° and feet flat on the floor in front.
 * The elbows bend back to about 90° (upper arms near level with the floor) as the hips lower in front of the bench,
 * then the arms press back to straight.
 */
export function benchDip(id: string, label: string): MotionDef {
  const benchX = 0;
  const benchW = 34;
  const edge: Vec = [benchX + benchW / 2 - 3, BENCH_TOP + BODY.r.hand - 1];
  const root: RootRule = { pin: "handR", at: edge };
  const make = (s: number): Pose => pose({ trunk: 4 + 6 * s, neck: -2, ...both({ sh: -34 - 40 * s, el: 2 + 88 * s, armD: 14 }) });
  // Feet planted where they are with the knees at about 90° at the top.
  const W0 = worldPts(make(0), root);
  const feet = ankleForSole(W0.pelvis[0] + 50, 0);
  const at = (s: number): Pose => legsTo(make(s), root, feet);
  const specs = repSmooth(at, { down: 1.8, up: 1.3, holdTop: 0.3, holdBottom: 0.1 }).map((k) => ({ ...k, ik: { footL: feet, footR: feet } }));
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, specs),
    props: [{ id: "bench", kind: "box", variant: "bench", at: [benchX, 0], w: benchW, h: BENCH_TOP, layer: "back" }],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.5,
  };
}

// ------------------------------------------------------------------------------------- Decline bench press

export interface DeclineOpts {
  id: string;
  label: string;
  /** Bench decline in degrees (head lower than the hips). */
  decline?: number;
  implement?: "barbell" | "dumbbell";
}

/**
 * Decline bench press (barbell from a rack, or two dumbbells): lying on a bench declined about 18° with the head lower than the hips, knees hooked over
 * the raised end and the ankles under its roller pad. The bar lowers to the lower chest with the forearms near vertical
 * and presses back to lockout straight up over the shoulders.
 */
export function declineBenchPress(o: DeclineOpts): MotionDef {
  const D = o.decline ?? 18;
  const HINGE_Y = 66;
  // Butt on the pad at the hinge; the back lies along the declined pad toward the head.
  const root: RootRule = { pin: "butt", at: [0, HINGE_Y] };
  const db = o.implement === "dumbbell";
  const armD = db ? 30 : 26;
  let base = pose({ trunk: -90 - D, spine: -6, neck: -2, ...both({ armD }) });
  // Thighs along the level leg section, knees bent over its end, shins hanging to the roller.
  const W0 = worldPts(base, root);
  const knee: Vec = [W0.hipR[0] + BODY.thigh * 0.97, HINGE_Y + 9];
  const feet: Vec = [knee[0] + 8, knee[1] - BODY.shin * 0.96];
  base = legsTo(base, root, feet, ["L", "R"], -25);
  const W = worldPts(base, root);
  const sh = W.shoulder;
  const chest = W.chest;
  const reach = ARM * Math.cos(armD / DEG / 3) - 1.5;
  const top: Vec = [sh[0], sh[1] + reach];
  const touch: Vec = db ? [chest[0] - 2, chest[1] + 2] : [chest[0] + 6, chest[1] + 3];
  const mid: Vec = [(top[0] + touch[0]) / 2 + 2, (top[1] + touch[1]) / 2];
  const fore = BODY.forearm * Math.cos(12 / DEG);
  const P = (h: Vec): Pose => {
    if (Math.hypot(h[0] - sh[0], h[1] - sh[1]) > ARM - 3) return handsTo(base, root, h);
    let p = base;
    const elbowW: Vec = [h[0] + 3, h[1] - fore];
    for (const s of ["L", "R"] as const) p = armThrough(p, s, toLocal(p, root, elbowW), toLocal(p, root, h));
    return p;
  };
  const ft = { footL: feet, footR: feet };
  const specs: KeySpec[] = [
    { pose: P(top), dur: 1, hold: 0.35, ease: "spline", ik: ik2(top, ft) },
    { pose: P(mid), dur: 1, ease: "spline", ik: ik2(mid, ft) },
    { pose: P(touch), dur: 0.5, hold: 0.1, ease: "spline", ik: ik2(touch, ft) },
    { pose: P(mid), dur: 0.5, ease: "spline", ik: ik2(mid, ft) },
  ];
  const seat = W.kneeR[0] - W.butt[0] + 2;
  const props: PropDef[] = [
    { id: "bench", kind: "inclineBench", at: [W.butt[0] + 2, HINGE_Y + 2], angle: -D, w: 84, h: seat, layer: "mid" },
    // Ankle roller (seen end-on) on its post in front of the shins.
    { id: "post", kind: "box", at: [feet[0] + 9, 0], w: 3, h: feet[1] - 2, layer: "back" },
    { id: "roller", kind: "pad", at: [feet[0] + 7, feet[1] - 1], w: 9, h: 9, layer: "near" },
  ];
  if (db)
    props.push(
      { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "end", layer: "far" },
      { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "end", layer: "front" },
    );
  else
    props.push(
      { id: "rack", kind: "rack", at: [sh[0] - 22, top[1] - 6], layer: "back" },
      { id: "bar", kind: "barbell", at: { lm: "hands" }, layer: "front", size: 17.5 },
    );
  return { id: o.id, view: "side", label: o.label, keyframes: keys(root, specs), props, stillPhase: 0.5 };
}

// --------------------------------------------------------------------------------------------- Knee push-up

/**
 * Knee push-up: kneeling with the feet raised behind and a straight line from the knees through the hips to the head.
 * Hands under the shoulders at the bottom; the chest lowers to just above the floor and presses back to straight arms.
 */
export function kneePushUp(id: string, label: string): MotionDef {
  const root: RootRule = { pin: "kneeCapR", at: [0, 0] };
  // Shins raised about 40° off the floor behind the knees, toes pointed.
  const make = (T: number): Pose => pose({ trunk: T, neck: -6, ...both({ hip: 0, knee: 90 - T + 40, ankle: -35 }) });
  const bT = solve1D((t) => worldPts(make(t), root).chest[1] - 7, 40, 89);
  const hand: Vec = [worldPts(make(bT), root).shoulder[0] - 1, BODY.r.hand];
  const topT = solve1D((t) => {
    const W = worldPts(make(t), root);
    return Math.hypot(hand[0] - W.shoulder[0], hand[1] - W.shoulder[1]) - (ARM - 1);
  }, 25, bT);
  const P = (T: number): Pose => handsTo(make(T), root, hand);
  const at = (s: number) => P(topT + (bT - topT) * s);
  const specs = repSmooth(at, { down: 1.6, up: 1, holdTop: 0.3, holdBottom: 0.1 }).map((k) => ({ ...k, ik: ik2(hand) }));
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, specs),
    props: [{ id: "mat", kind: "mat", at: [worldPts(make(topT), root).pelvis[0] + 10, 0], w: 170, layer: "back" }],
    stillPhase: 0.5,
  };
}
