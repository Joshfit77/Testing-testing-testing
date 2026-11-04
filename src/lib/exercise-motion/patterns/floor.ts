/**
 * Floor drills whose movement happens along the floor (hips rotating on the mat, a leg crossed over the other, an arm
 * opening over a side-lying body). Seen level from the side or the front, most of these happen toward or away from
 * the camera, so they are posed in 3D and drawn as the front view of a camera above the mat (straight down, or raised
 * in front of the athlete) would see them: each segment's drawn direction and foreshortening is its true projection.
 * The athlete's front-view drawing is used for the figure; a mat seen from the same camera is the floor.
 */
import { BODY, normShoulder, normalize180 } from "../skeleton";
import { keys, pose, type KeySpec, type MotionDef, type Pose, type PropDef, type RootRule, type Vec } from "../build";

/** World point: x = the athlete's left as the camera sees it (screen right), y = up, z = toward the camera. */
export type V3 = [number, number, number];

const RAD = Math.PI / 180;
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit3 = (a: V3): V3 => mul3(a, 1 / (len3(a) || 1e-9));
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Point at `l` from `from` toward `dir`. */
const toward = (from: V3, dir: V3, l: number): V3 => add3(from, mul3(unit3(dir), l));

/** A camera looking down at `pitch` degrees (0 = level, 90 = straight down), its picture turned by `roll` degrees. */
export interface FloorCam {
  pitch: number;
  roll?: number;
}

export function project(cam: FloorCam, v: V3): Vec {
  const t = cam.pitch * RAD;
  const x = v[0];
  const y = v[1] * Math.cos(t) - v[2] * Math.sin(t);
  const r = (cam.roll ?? 0) * RAD;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
}

/**
 * Two-bone limb in 3D from `a` toward `c` (segment lengths l1, l2), its middle joint bent toward `pole`. Returns the
 * middle joint and the end (on the line to `c`, exactly l2 from the middle joint).
 */
export function limb3(a: V3, c: V3, l1: number, l2: number, pole: V3): [V3, V3] {
  const ac = sub3(c, a);
  const d0 = len3(ac);
  const d = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(l1 + l2 - 1e-3, d0));
  const u = unit3(ac);
  const w = unit3(sub3(pole, mul3(u, dot3(pole, u))));
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const mid = add3(a, add3(mul3(u, l1 * cosA), mul3(w, l1 * sinA)));
  return [mid, toward(mid, sub3(add3(a, mul3(u, d)), mid), l2)];
}

/** The athlete in 3D (joint centres, segment lengths as BODY). `head` is a point along the head's crown direction. */
export interface Body3 {
  pelvis: V3;
  neckBase: V3;
  head: V3;
  hipL: V3;
  hipR: V3;
  kneeL: V3;
  kneeR: V3;
  ankleL: V3;
  ankleR: V3;
  shoulderL: V3;
  shoulderR: V3;
  elbowL: V3;
  elbowR: V3;
  handL: V3;
  handR: V3;
}

const down2 = (s: Vec) => Math.atan2(s[0], -s[1]) / RAD;
const up2 = (s: Vec) => Math.atan2(s[0], s[1]) / RAD;
const len2 = (s: Vec) => Math.hypot(s[0], s[1]);
const depth = (s: Vec, L: number) => Math.acos(Math.min(1, len2(s) / L)) / RAD;

/**
 * Front-view pose whose segments draw as the camera sees the 3D body: each limb segment's direction and length on
 * screen (foreshortening as legD / shinD / armD / foreD), the trunk's (trunkD) and the head's direction. The knee
 * parameter stays 0 so the front view adds no foreshortening of its own: the bend is in the segment directions.
 */
export function frontPose(cam: FloorCam, b: Body3): Pose {
  const P = (v: V3) => project(cam, v);
  const seg = (a: V3, c: V3): Vec => {
    const pa = P(a);
    const pc = P(c);
    return [pc[0] - pa[0], pc[1] - pa[1]];
  };
  const t = seg(b.pelvis, b.neckBase);
  const T1 = up2(t);
  const trunkD = Math.acos(Math.min(1, len2(t) / (BODY.lumbar + BODY.thorax))) / RAD;
  const out = pose({ trunk: T1, trunkD, neck: normalize180(up2(seg(b.neckBase, b.head)) - T1) });
  for (const s of ["L", "R"] as const) {
    const k = s === "L" ? 1 : -1;
    const th = seg(b[`hip${s}`], b[`knee${s}`]);
    const sn = seg(b[`knee${s}`], b[`ankle${s}`]);
    out[`hip${s}`] = normalize180(k * (down2(th) + T1));
    out[`legD${s}`] = depth(th, BODY.thigh);
    out[`knee${s}`] = 0;
    out[`ankle${s}`] = normalize180(k * (down2(sn) + T1));
    out[`shinD${s}`] = depth(sn, BODY.shin);
    const ua = seg(b[`shoulder${s}`], b[`elbow${s}`]);
    const fa = seg(b[`elbow${s}`], b[`hand${s}`]);
    out[`sh${s}`] = normShoulder(k * (down2(ua) + T1));
    out[`armD${s}`] = depth(ua, BODY.upperArm);
    out[`el${s}`] = normalize180(k * (down2(fa) - down2(ua)));
    out[`foreD${s}`] = depth(fa, BODY.forearm);
  }
  return out;
}

const ANGLES = ["trunk", "neck", "hipL", "hipR", "ankleL", "ankleR", "shL", "shR", "elL", "elR"] as const;

/** Unwrap the angles of a looping sequence of poses so each moves the short way to the next. */
function unwrap(poses: Pose[]): Pose[] {
  const out = poses.map((p) => ({ ...p }));
  for (let i = 1; i < out.length; i++)
    for (const k of ANGLES) {
      while (out[i]![k] - out[i - 1]![k] > 180) out[i]![k] -= 360;
      while (out[i]![k] - out[i - 1]![k] < -180) out[i]![k] += 360;
    }
  return out;
}

/** The camera's picture of a floor rectangle (x0..x1 across, z0..z1 toward the camera) as a mat prop. */
function matProp(cam: FloorCam, origin: Vec, x0: number, x1: number, z0: number, z1: number, id = "mat"): PropDef {
  const c = project(cam, [(x0 + x1) / 2, 0, (z0 + z1) / 2]);
  const roll = cam.roll ?? 0;
  // Size on screen before the picture's roll (the drawing turns it by `angle`).
  const w = Math.abs(x1 - x0);
  const h = Math.abs((z1 - z0) * Math.sin(cam.pitch * RAD));
  return { id, kind: "floorMat", at: [origin[0] + c[0], origin[1] + c[1]], w, h, angle: roll, layer: "back" };
}

interface Key3 {
  body: Body3;
  dur: number;
  hold?: number;
}

/** Keyframes from 3D bodies: front-view poses, the pelvis pinned where the camera sees it (shifted by `origin`). */
function keys3(cam: FloorCam, origin: Vec, ks: Key3[]): ReturnType<typeof keys> {
  const poses = unwrap(ks.map((k) => frontPose(cam, k.body)));
  return keys({ pin: "pelvis", at: origin }, ks.map((k, i): KeySpec => {
    const pp = project(cam, k.body.pelvis);
    const root: RootRule = { pin: "pelvis", at: [origin[0] + pp[0], origin[1] + pp[1]] };
    return { pose: poses[i]!, dur: k.dur, hold: k.hold, ease: "inOut", root };
  }));
}

// ---------------------------------------------------------------------------------------------------------- 90/90

/**
 * 90/90 hip switch, seen from in front and a little above (so the legs on the mat show their 90° bends): sitting tall
 * with the hands on the mat behind, one leg in front (thigh forward, shin across) and the other to the side (thigh out,
 * shin back). Both knees lift and rotate over to the other side, passing through knees-up in the middle, the feet
 * pivoting and sliding round on the mat, and settle into the mirror image.
 */
export function hip9090(id: string, label: string): MotionDef {
  const cam: FloorCam = { pitch: 38 };
  const H = 10; // hip joint height, sitting
  const pelvis: V3 = [0, H, 0];
  const hip = (k: number): V3 => [k * BODY.hipHalf, H, 0];
  const neckBase: V3 = [0, H + BODY.lumbar + BODY.thorax - 1.5, -6];
  const head: V3 = add3(neckBase, [0, 20, 3]);
  const sh = (k: number): V3 => add3(neckBase, [k * BODY.shoulderHalf, -5, 0]);
  // Hands flat on the mat behind and outside the hips, elbows soft and pointing back.
  const arm = (k: number): [V3, V3] => limb3(sh(k), [k * 31, BODY.r.hand, -26], BODY.upperArm, BODY.forearm, [k * 0.4, 0, -1]);
  // One leg in front (k = side): thigh forward, shin across toward the other side; the other leg out to the side with
  // its shin back. Knees and feet rest on the mat.
  const KNEE_Y = 6;
  const ANK_Y = 5;
  const front = (k: number): [V3, V3] => {
    const knee = toward(hip(k), [-k * 0.16, (KNEE_Y - H) / BODY.thigh, 1], BODY.thigh);
    return [knee, toward(knee, [-k * 1, (ANK_Y - KNEE_Y) / BODY.shin, 0.16], BODY.shin)];
  };
  const back = (k: number): [V3, V3] => {
    const knee = toward(hip(k), [k * 1, (KNEE_Y - H) / BODY.thigh, -0.1], BODY.thigh);
    return [knee, toward(knee, [k * 0.1, (ANK_Y - KNEE_Y) / BODY.shin, -1], BODY.shin)];
  };
  // Knees up in the middle, feet on the mat in front and a little wider than the hips.
  const up = (k: number): [V3, V3] => {
    const foot: V3 = [k * 30, ANK_Y, 36];
    return limb3(hip(k), foot, BODY.thigh, BODY.shin, [k * 0.35, 1, 0.2]);
  };
  // Side A: right leg in front (k = -1 is the right side). A's legs per side, the middle, and B (mirror).
  const legsA = { R: front(-1), L: back(1) };
  const legsB = { R: back(-1), L: front(1) };
  const legsM = { R: up(-1), L: up(1) };
  // A quadratic path through the middle position at s = 0.5 (knees and feet travel on smooth arcs).
  const via = (a: V3, m: V3, b: V3, s: number): V3 => {
    const c = sub3(mul3(m, 2), mul3(add3(a, b), 0.5));
    return add3(add3(mul3(a, (1 - s) * (1 - s)), mul3(c, 2 * s * (1 - s))), mul3(b, s * s));
  };
  const body = (s: number): Body3 => {
    const [eL, hL] = arm(1);
    const [eR, hR] = arm(-1);
    const leg = (side: "L" | "R"): [V3, V3] => {
      const k = side === "L" ? 1 : -1;
      const ankle = via(legsA[side][1], legsM[side][1], legsB[side][1], s);
      const kneeHint = via(legsA[side][0], legsM[side][0], legsB[side][0], s);
      return limb3(hip(k), ankle, BODY.thigh, BODY.shin, sub3(kneeHint, lerp3(hip(k), ankle, 0.5)));
    };
    const [kL, aL] = leg("L");
    const [kR, aR] = leg("R");
    return { pelvis, neckBase, head, hipL: hip(1), hipR: hip(-1), kneeL: kL, kneeR: kR, ankleL: aL, ankleR: aR, shoulderL: sh(1), shoulderR: sh(-1), elbowL: eL, elbowR: eR, handL: hL, handR: hR };
  };
  const STEPS = 6;
  const step = 2.4 / STEPS;
  const ks: Key3[] = [];
  for (let i = 0; i < STEPS; i++) ks.push({ body: body(i / STEPS), dur: step, hold: i === 0 ? 0.9 : undefined });
  for (let i = 0; i < STEPS; i++) ks.push({ body: body(1 - i / STEPS), dur: step, hold: i === 0 ? 0.9 : undefined });
  const origin: Vec = [0, 58];
  return {
    id,
    view: "front",
    label,
    keyframes: keys3(cam, origin, ks),
    props: [matProp(cam, origin, -100, 100, -70, 78)],
    floor: "none",
    legsInFront: true,
    // Projected angles of a view from above: a thigh lying along the mat reads far past the front view's standing ranges.
    allowLimits: ["hipL", "hipR", "ankleL", "ankleR", "shL", "shR", "elL", "elR"],
    stillPhase: 0,
  };
}

// ---------------------------------------------------------------------------------------------------- Figure four

/**
 * Figure-four glute stretch seen from above (the body lying along the picture, head to the right): lying on the back
 * with the knees bent, the right ankle crossed over the left thigh just above the knee with the right knee turned out,
 * so the legs make a "4". The hands reach behind the left thigh and draw it toward the chest (the left foot leaves the
 * floor and the crossed leg comes with it), hold, then ease back.
 */
export function figureFour(id: string, label: string): MotionDef {
  const cam: FloorCam = { pitch: 90, roll: -90 };
  // Lying on the back: z points to the feet, the head is toward -z; x is the athlete's left.
  const pelvis: V3 = [0, 10, 0];
  const hip = (k: number): V3 => [k * BODY.hipHalf, 10, 0];
  const neckBase: V3 = [0, 11, -(BODY.lumbar + BODY.thorax) + 1];
  const head: V3 = add3(neckBase, [0, 1, -20]);
  const sh = (k: number): V3 => add3(neckBase, [k * BODY.shoulderHalf, -1, 5]);
  const body = (flex: number, footDown: boolean): Body3 => {
    // Bottom (left) leg: hip flexed `flex` degrees from lying flat, knee bent; foot on the floor or lifted with the pull.
    let kneeL: V3;
    let ankleL: V3;
    if (footDown) [kneeL, ankleL] = limb3(hip(1), [BODY.hipHalf + 2, BODY.ankleH, 30], BODY.thigh, BODY.shin, [0, 1, 0]);
    else {
      kneeL = toward(hip(1), [0.06, Math.sin(flex * RAD), Math.cos(flex * RAD)], BODY.thigh);
      ankleL = toward(kneeL, [0, Math.sin((flex - 95) * RAD), Math.cos((flex - 95) * RAD)], BODY.shin);
    }
    const tdir = unit3(sub3(kneeL, hip(1)));
    // The front of the thigh faces the head; the crossed ankle rests on it just above the knee.
    const front = unit3([0, tdir[2], -tdir[1]]);
    const rest = add3(add3(toward(hip(1), tdir, BODY.thigh - 9), mul3(front, 7)), [-3, 0, 0]);
    // Crossed (right) leg: knee turned out to the right and up.
    const [kneeR, ankleR] = limb3(hip(-1), rest, BODY.thigh, BODY.shin, [-1, 0.45, 0.25]);
    // Hands behind the left thigh near the knee, elbows out.
    const grip = add3(toward(hip(1), tdir, BODY.thigh * 0.72), mul3(front, -6.5));
    const [elbowL, handL] = limb3(sh(1), add3(grip, [5, 0, 0]), BODY.upperArm, BODY.forearm, [1, 0.4, 0]);
    const [elbowR, handR] = limb3(sh(-1), add3(grip, [-4, 0, 0]), BODY.upperArm, BODY.forearm, [-1, 0.4, 0]);
    return { pelvis, neckBase, head, hipL: hip(1), hipR: hip(-1), kneeL, kneeR, ankleL, ankleR, shoulderL: sh(1), shoulderR: sh(-1), elbowL, elbowR, handL, handR };
  };
  const origin: Vec = [0, 62];
  const ks: Key3[] = [
    { body: body(62, true), dur: 0.7, hold: 0.7 },
    { body: body(88, false), dur: 0.9 },
    { body: body(112, false), dur: 1.4, hold: 2.2 },
    { body: body(95, false), dur: 0.8 },
  ];
  return {
    id,
    view: "front",
    label,
    keyframes: keys3(cam, origin, ks),
    props: [matProp(cam, origin, -48, 48, -100, 64)],
    floor: "none",
    legsInFront: true,
    // Projected angles of a view from above (limbs lying across the mat).
    allowLimits: ["hipL", "hipR", "ankleL", "ankleR", "shL", "shR", "elL", "elR", "trunk"],
    stillPhase: 0.55,
  };
}

// ----------------------------------------------------------------------------------------------- Thoracic open book

/**
 * Thoracic open book, seen from in front and above: lying on the left side facing the camera, head to the right,
 * hips and knees bent to 90° with the knees stacked, both arms straight out in front at shoulder height. The top arm
 * lifts, sweeps up over the body like a page turning and opens to the floor behind, the head turning with it, then
 * returns along the same arc. The knees stay stacked throughout.
 */
export function openBook(id: string, label: string): MotionDef {
  const cam: FloorCam = { pitch: 64, roll: -9 };
  // Lying on the left side: x = toward the head, y = up, z = toward the camera (the front of the body).
  const pelvis: V3 = [0, 16, 0];
  const hipL: V3 = [0, 7, 0];
  const hipR: V3 = [0, 25, 0];
  const neckBase: V3 = [BODY.lumbar + BODY.thorax - 0.5, 21, 0];
  const shL: V3 = add3(neckBase, [-5, -BODY.shoulderHalf + 4, 0]);
  const shR: V3 = add3(neckBase, [-5, BODY.shoulderHalf - 2, 0]);
  // Knees bent to 90° in front, stacked (the top knee resting on the bottom one), shins back along the floor.
  const kneeL: V3 = toward(hipL, [0, -2 / BODY.thigh, 1], BODY.thigh);
  const kneeR: V3 = toward(hipR, [0, -9 / BODY.thigh, 1], BODY.thigh);
  const ankleL: V3 = toward(kneeL, [-1, 0, -0.05], BODY.shin);
  const ankleR: V3 = toward(kneeR, [-1, -1.5 / BODY.shin, -0.05], BODY.shin);
  // Bottom arm straight out in front on the floor; the top arm on it, then opening over the body.
  const elbowL = toward(shL, [0.04, -0.02, 1], BODY.upperArm);
  const handL = toward(elbowL, [0.04, -0.02, 1], BODY.forearm);
  const body = (phi: number): Body3 => {
    // phi: the top arm's turn about the shoulder, 0 = resting on the bottom arm in front, 90 = up to the ceiling,
    // 180 = straight out behind at shoulder height, 235 = resting on the floor behind. The elbow stays nearly straight.
    const a = (phi - 25) * RAD;
    const dir: V3 = [0.05, Math.sin(a), Math.cos(a)];
    const bend = 6 * Math.sin(Math.min(Math.PI, Math.max(0, (phi * Math.PI) / 235)));
    const elbowR = toward(shR, dir, BODY.upperArm);
    const handR = toward(elbowR, [dir[0], dir[1] + bend / 60, dir[2]], BODY.forearm);
    // The head rests on a low cushion, then lifts and turns with the eyes on the hand.
    const look = Math.min(1, phi / 170);
    const head = add3(neckBase, [20, -6 + 11 * look, 1 - 4 * look]);
    return { pelvis, neckBase, head, hipL, hipR, kneeL, kneeR, ankleL, ankleR, shoulderL: shL, shoulderR: shR, elbowL, elbowR, handL, handR };
  };
  const origin: Vec = [0, 84];
  const phis = [0, 40, 80, 120, 160, 200, 235];
  const ks: Key3[] = [];
  phis.forEach((p, i) => ks.push({ body: body(p), dur: i === 0 ? 0.5 : 0.42, hold: i === 0 ? 0.6 : i === phis.length - 1 ? 1.4 : undefined }));
  for (let i = phis.length - 2; i > 0; i--) ks.push({ body: body(phis[i]!), dur: 0.42 });
  return {
    id,
    view: "front",
    label,
    keyframes: keys3(cam, origin, ks),
    props: [matProp(cam, origin, -72, 112, -82, 78), matProp(cam, origin, 60, 94, -17, 8, "pillow")],
    floor: "none",
    legsInFront: true,
    // Projected angles of a body lying on its side.
    allowLimits: ["hipL", "hipR", "ankleL", "ankleR", "shL", "shR", "elL", "elR", "neck", "trunk"],
    stillPhase: 0.45,
  };
}

// ------------------------------------------------------------------------------------------------------ Hip escape

/** The same body mirrored left to right (x → -x, left and right swapped). */
function mirrorBody(b: Body3): Body3 {
  const m = (v: V3): V3 => [-v[0], v[1], v[2]];
  return {
    pelvis: m(b.pelvis),
    neckBase: m(b.neckBase),
    head: m(b.head),
    hipL: m(b.hipR),
    hipR: m(b.hipL),
    kneeL: m(b.kneeR),
    kneeR: m(b.kneeL),
    ankleL: m(b.ankleR),
    ankleR: m(b.ankleL),
    shoulderL: m(b.shoulderR),
    shoulderR: m(b.shoulderL),
    elbowL: m(b.elbowR),
    elbowR: m(b.elbowL),
    handL: m(b.handR),
    handR: m(b.handL),
  };
}

/** A body part-way (t) between two: joints move on straight lines, limbs re-solved so every bone keeps its length. */
function blendBody(a: Body3, b: Body3, t: number): Body3 {
  const L = (k: keyof Body3) => lerp3(a[k], b[k], t);
  const pelvis = L("pelvis");
  const neckBase = toward(pelvis, sub3(L("neckBase"), pelvis), BODY.lumbar + BODY.thorax);
  const out: Body3 = { ...a, pelvis, neckBase, head: add3(neckBase, sub3(L("head"), L("neckBase"))), hipL: L("hipL"), hipR: L("hipR"), shoulderL: L("shoulderL"), shoulderR: L("shoulderR") };
  for (const s of ["L", "R"] as const) {
    const hip = out[`hip${s}`];
    const ank = L(`ankle${s}`);
    [out[`knee${s}`], out[`ankle${s}`]] = limb3(hip, ank, BODY.thigh, BODY.shin, sub3(L(`knee${s}`), lerp3(hip, ank, 0.5)));
    const sh = out[`shoulder${s}`];
    const hand = L(`hand${s}`);
    [out[`elbow${s}`], out[`hand${s}`]] = limb3(sh, hand, BODY.upperArm, BODY.forearm, sub3(L(`elbow${s}`), lerp3(sh, hand, 0.5)));
  }
  return out;
}

/**
 * Hip escape (shrimp) seen from above, the athlete lying along the mat with the head to the right. Starts on the back,
 * knees bent and feet planted, hands up in front of the chest. Pushing off the right foot, turns onto the left side and
 * drives the hips back (up the picture) away from the feet, the knees and shoulders curling forward into a C and the
 * arms framing out in front; returns to the back with the feet re-planted, having travelled head-first along the mat,
 * then shrimps to the other side the same way.
 */
export function hipEscape(id: string, label: string): MotionDef {
  const cam: FloorCam = { pitch: 90, roll: -90 };
  // Lying on the back: z points to the feet (the head and the direction of travel are toward -z), x is the left side.
  const D = 28; // travel per shrimp: one floor tile
  const supine = (z: number): Body3 => {
    const hip = (k: number): V3 => [k * BODY.hipHalf, 10, z];
    const sh = (k: number): V3 => [k * BODY.shoulderHalf, 10, z - 51];
    const leg = (k: number) => limb3(hip(k), [k * 14, BODY.ankleH, z + 40], BODY.thigh, BODY.shin, [k * 0.25, 1, 0]);
    const arm = (k: number) => limb3(sh(k), [k * 10, 30, z - 37], BODY.upperArm, BODY.forearm, [k, -0.6, 0.6]);
    const neckBase: V3 = [0, 11, z - (BODY.lumbar + BODY.thorax) + 1];
    return { pelvis: [0, 10, z], neckBase, head: add3(neckBase, [0, 1, -20]), hipL: hip(1), hipR: hip(-1), kneeL: leg(1)[0], ankleL: leg(1)[1], kneeR: leg(-1)[0], ankleR: leg(-1)[1], shoulderL: sh(1), shoulderR: sh(-1), elbowL: arm(1)[0], handL: arm(1)[1], elbowR: arm(-1)[0], handR: arm(-1)[1] };
  };
  // On the left side, hips driven back (-x) and a little toward the head; the right foot still planted where it pushed.
  const shrimpLeft = (z: number): Body3 => {
    const pelvis: V3 = [-22, 14, z - 6];
    const hipL: V3 = [-22, 5, z - 6];
    const hipR: V3 = [-22, 23, z - 6];
    const neckBase = toward(pelvis, [15, 4, -52], BODY.lumbar + BODY.thorax);
    const shoulderL = add3(neckBase, [3, -14, 4]);
    const shoulderR = add3(neckBase, [-3, 13, 4]);
    const kneeL = toward(hipL, [0.82, 0, 0.57], BODY.thigh);
    const ankleL = toward(kneeL, [-0.45, 0, 0.9], BODY.shin);
    const [kneeR, ankleR] = limb3(hipR, [-14, BODY.ankleH, z + 40], BODY.thigh, BODY.shin, [0.6, 0.6, 0.3]);
    const [elbowL, handL] = limb3(shoulderL, [16, 5, z - 47], BODY.upperArm, BODY.forearm, [0, -1, 0.4]);
    const [elbowR, handR] = limb3(shoulderR, [16, 22, z - 19], BODY.upperArm, BODY.forearm, [-0.3, 1, 0]);
    return { pelvis, neckBase, head: add3(neckBase, [7, -1, -18]), hipL, hipR, kneeL, kneeR, ankleL, ankleR, shoulderL, shoulderR, elbowL, elbowR, handL, handR };
  };
  const stages = [supine(0), shrimpLeft(0), supine(-D), mirrorBody(shrimpLeft(-D)), supine(-2 * D)];
  const ks: Key3[] = [];
  const timing = [
    { dur: 0.9, hold: 0.25 },
    { dur: 0.8, hold: 0.35 },
  ];
  for (let i = 0; i < 4; i++) {
    const tm = timing[i % 2]!;
    for (let j = 0; j < 3; j++) ks.push({ body: blendBody(stages[i]!, stages[i + 1]!, j / 3), dur: tm.dur / 3, hold: j === 0 ? tm.hold : undefined });
  }
  const origin: Vec = [0, 60];
  return {
    id,
    view: "front",
    label,
    keyframes: keys3(cam, origin, ks),
    travel: 2 * D,
    props: [{ id: "mat", kind: "floorMat", at: [D, origin[1]], w: 900, h: 116, size: D, layer: "back" }],
    floor: "none",
    legsInFront: true,
    // Projected angles of a body lying on the mat, seen from above.
    allowLimits: ["hipL", "hipR", "ankleL", "ankleR", "shL", "shR", "elL", "elR", "neck", "trunk"],
    stillPhase: 0.2,
  };
}
