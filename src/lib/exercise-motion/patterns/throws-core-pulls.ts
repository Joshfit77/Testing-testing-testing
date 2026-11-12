/**
 * Demonstrations rebuilt after the coach-style review: medicine-ball throws into a wall (rotational throw, scoop toss,
 * shot put), the landmine rotation, the Pallof press, the band pull-apart, the rear-delt fly (front views); the
 * kneeling cable crunch, the arm-over-arm sled pull and the sandbag to shoulder (side views).
 *
 * The front views place the arms from three-dimensional positions (x across the picture, y up, z toward the viewer):
 * a hand reaching toward the viewer is foreshortened exactly as far as its real length requires, both hands holding
 * one object meet at one point, and an elbow bends the way the arm really bends. The figure itself (proportions,
 * drawing) is unchanged; the poses are ordinary keyframes.
 */
import { BODY, ankleForSole, cos, depthMix, down, forwardKinematics, frontOf, sin, solveTwoBone } from "../skeleton";
import { armThrough, armsLocal, keys, pose, solve1D, stanceLegs, worldPts, type Anchor, type KeySpec, type MotionDef, type Pose, type RootRule, type Side, type Vec } from "../build";
import { handsTo, legsTo } from "./upper";

// ------------------------------------------------------------------------------------------ 3D helpers

type V3 = [number, number, number];
const ARM_REACH = BODY.upperArm + BODY.forearm;
const add3 = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit3 = (a: V3): V3 => mul3(a, 1 / (len3(a) || 1));
const smoothstep = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

/**
 * How arm positions are projected in a front view. yaw > 0: the camera stands a little to the figure's left (screen
 * right), so a hand reaching toward the viewer also moves to screen right; pitch > 0: the camera looks down a little, so
 * a hand reaching toward the viewer also drops on screen. Only the arms use it: the torso is drawn square on, which
 * these small angles leave believable.
 */
interface Cam {
  yaw: number;
  pitch: number;
}
const SQUARE: Cam = { yaw: 0, pitch: 0 };

function proj(c: Cam, v: V3): Vec {
  const x = v[0] * cos(c.yaw) + v[2] * sin(c.yaw);
  const z1 = -v[0] * sin(c.yaw) + v[2] * cos(c.yaw);
  return [x, v[1] * cos(c.pitch) - z1 * sin(c.pitch)];
}

/** The point in the body's plane (z = 0) that projects to `p`. */
function unproj0(c: Cam, p: Vec): V3 {
  const x = p[0] / cos(c.yaw);
  return [x, (p[1] - x * sin(c.yaw) * sin(c.pitch)) / cos(c.pitch), 0];
}

/**
 * Front view: put one arm's hand at the 3D point `hand` (relative to the pelvis, z toward the viewer), the elbow bent
 * toward `pole`. A point out of reach is pulled in; one so close that the elbow would fold past 145° is pushed out.
 *
 * The elbow can sit anywhere on a circle around the shoulder–hand line; the one nearest the pole is used, unless that
 * leaves the forearm or upper arm pointing almost straight at the viewer (drawn as a stub whose direction on screen is
 * unstable from one keyframe to the next) or, when `bend` is given, bends the drawn arm the other way (the sign of the
 * front view's elbow angle): then the nearest elbow position that avoids it is used. Keeping the drawn bend on one
 * side stops the in-betweens from swinging the forearm across from one side of the arm to the other.
 */
function frontArm(p: Pose, s: Side, hand: V3, pole: V3, cam: Cam = SQUARE, bend?: 1 | -1): Pose {
  const sk = forwardKinematics(p, "front");
  const sh2 = sk.pts[`shoulder${s}`];
  const S = unproj0(cam, sh2);
  const a = BODY.upperArm;
  const b = BODY.forearm;
  let d = sub3(hand, S);
  let L = len3(d);
  const maxL = a + b - 0.3;
  const minL = Math.sqrt(a * a + b * b - 2 * a * b * cos(35));
  const H = L > maxL ? add3(S, d, maxL / L) : L < minL ? add3(S, d, minL / L) : hand;
  d = sub3(H, S);
  L = len3(d);
  const u = unit3(d);
  let v1 = sub3(pole, mul3(u, dot3(pole, u)));
  if (len3(v1) < 1e-6) v1 = [0, -1, 0];
  v1 = unit3(v1);
  const v2: V3 = [u[1] * v1[2] - u[2] * v1[1], u[2] * v1[0] - u[0] * v1[2], u[0] * v1[1] - u[1] * v1[0]];
  const al = Math.acos(Math.max(-1, Math.min(1, (a * a + L * L - b * b) / (2 * a * L))));
  const h2 = proj(cam, sub3(H, S));
  const k = s === "L" ? 1 : -1;
  let best = { cost: Infinity, e2: [0, 0] as Vec };
  for (let deg = -180; deg < 180; deg += 2) {
    const w = add3(mul3(v1, cos(deg)), mul3(v2, sin(deg)));
    const E = add3(S, add3(mul3(u, a * Math.cos(al)), mul3(w, a * Math.sin(al))));
    const e2 = proj(cam, sub3(E, S));
    const fore: Vec = [h2[0] - e2[0], h2[1] - e2[1]];
    const upLen = Math.hypot(e2[0], e2[1]);
    const foreLen = Math.hypot(fore[0], fore[1]);
    let e = Math.atan2(fore[0], -fore[1]) - Math.atan2(e2[0], -e2[1]);
    while (e > Math.PI) e -= 2 * Math.PI;
    while (e < -Math.PI) e += 2 * Math.PI;
    const stub = Math.max(0, 12 - Math.min(upLen, foreLen));
    const wrongSide = bend !== undefined && Math.sign(k * e) !== bend && Math.abs(e) > 0.05 ? 400 : 0;
    const cost = Math.abs(deg) + 6 * stub * stub + wrongSide;
    if (cost < best.cost) best = { cost, e2 };
  }
  const e2 = best.e2;
  return armThrough(p, s, [sh2[0] + e2[0], sh2[1] + e2[1]], [sh2[0] + h2[0], sh2[1] + h2[1]], "front");
}

/**
 * Front view: a leg reaching a sole position (pelvis-origin), the knee bent toward the viewer as much as the distance
 * needs and turned out (out > 0) or in (out < 0) by about `out` degrees.
 */
function frontLeg(p: Pose, s: Side, sole: Vec, out = 5): Pose {
  const T1 = p.trunk;
  const k = s === "L" ? 1 : -1;
  const hip: Vec = [frontOf(T1)[0] * k * BODY.hipHalf, frontOf(T1)[1] * k * BODY.hipHalf];
  const dn = down(-T1);
  const ankle: Vec = [sole[0] - dn[0] * BODY.ankleH, sole[1] - dn[1] * BODY.ankleH];
  const dist = Math.hypot(ankle[0] - hip[0], ankle[1] - hip[1]);
  const lens = (kn: number): [number, number] => [BODY.thigh * cos(depthMix(p[`legD${s}`], Math.min(80, kn * 0.62))), BODY.shin * cos(depthMix(p[`shinD${s}`], Math.min(60, kn * 0.22)))];
  const need = dist / cos(Math.max(2, Math.abs(out)));
  const knee = lens(0)[0] + lens(0)[1] <= need ? 0 : solve1D((kn) => lens(kn)[0] + lens(kn)[1] - need, 0, 150);
  const [la, lb] = lens(knee);
  const outward = out >= 0;
  const bend = (s === "L") === outward ? -1 : 1;
  const { a1, a2 } = solveTwoBone(hip, ankle, la, lb, bend as 1 | -1);
  return { ...p, [`knee${s}`]: knee, [`hip${s}`]: k * (a1 + T1), [`ankle${s}`]: k * (a2 + T1) };
}

interface Stance {
  /** Pelvis (world). */
  pelvis: Vec;
  trunk: number;
  spine?: number;
  trunkD?: number;
  /** Knee turn-out of the left (screen right) and right leg, degrees (negative = knee driving in). */
  out?: [number, number];
}

/** Front view pose with both soles on their floor spots. */
function frontStance(st: Stance, soles: [Vec, Vec]): Pose {
  let p = pose({ trunk: st.trunk, spine: st.spine ?? 0, trunkD: st.trunkD ?? 0 });
  const rel = (v: Vec): Vec => [v[0] - st.pelvis[0], v[1] - st.pelvis[1]];
  p = frontLeg(p, "L", rel(soles[0]), st.out?.[0] ?? 5);
  p = frontLeg(p, "R", rel(soles[1]), st.out?.[1] ?? 5);
  return p;
}

/** Arms to world 3D hand points (z toward the viewer). */
function frontHands(p: Pose, pelvis: Vec, hands: { L: V3; R: V3 }, pole: { L: V3; R: V3 }, cam: Cam = SQUARE, bend?: 1 | -1): Pose {
  const rel = (h: V3): V3 => [h[0] - pelvis[0], h[1] - pelvis[1], h[2]];
  return frontArm(frontArm(p, "L", rel(hands.L), pole.L, cam, bend), "R", rel(hands.R), pole.R, cam, bend);
}

// ------------------------------------------------------------------------------- Medicine-ball wall throws

/**
 * One keyframe of a front-view throw. The wall is on screen left (the figure's right side faces it): the right leg is
 * the lead leg, the left leg (screen right) the back leg.
 */
interface ThrowKey {
  dur: number;
  hold?: number;
  st: Stance;
  /** Ball centre (world, z toward the viewer). */
  ball: V3;
  /** Hands on the ball: contact points relative to its centre. Omitted while the ball is in the air. */
  grip?: { L: V3; R: V3 };
  /** Hands while the ball is in the air (world). */
  free?: { L: V3; R: V3 };
  pole: { L: V3; R: V3 };
}

const BALL_R = 11.5;

function throwMotion(id: string, label: string, o: { soles: [Vec, Vec]; wallX: number; keys: ThrowKey[]; stillPhase: number; foldedElbows?: boolean }): MotionDef {
  const root: RootRule = { pin: "soleR", at: o.soles[1] };
  const specs: KeySpec[] = o.keys.map((k) => {
    let p = frontStance(k.st, o.soles);
    const hands = k.grip ? { L: add3(k.ball, k.grip.L), R: add3(k.ball, k.grip.R) } : k.free!;
    // Both elbows drawn bending the same way all through the throw (see frontArm).
    p = frontHands(p, k.st.pelvis, hands, k.pole, SQUARE, -1);
    let ball: Anchor;
    if (k.grip) {
      // The ball rides with the hands: its centre relative to the point between them (as drawn).
      const P = worldPts(p, root, "front");
      ball = { lm: "hands", dx: k.ball[0] - P.hands[0], dy: k.ball[1] - P.hands[1] };
    } else ball = [k.ball[0], k.ball[1]];
    return { pose: p, dur: k.dur, hold: k.hold, ease: "inOut", props: { ball } };
  });
  return {
    id,
    view: "front",
    label,
    keyframes: keys(root, specs),
    props: [
      { id: "wall", kind: "wall", variant: "kit-wall", at: [o.wallX, 0], w: 22, layer: "back" },
      { id: "ball", kind: "medball", at: { lm: "hands" }, size: BALL_R, layer: "near" },
    ],
    // Arms reaching across the body to the far hip read as negative abduction in the front view. With the ball at the
    // shoulder (shot put) the forearm comes toward the viewer and the drawn elbow angle reads past the front view's
    // limit; the real elbow is placed in 3D and never folds past 145° (frontArm).
    allowLimits: o.foldedElbows ? ["shL", "shR", "elL", "elR"] : ["shL", "shR"],
    footGrounded: true,
    stillPhase: o.stillPhase,
  };
}

/**
 * Medicine-ball rotational throw. Side-on to a wall about an arm's length away: the ball is loaded beside the far
 * (back) hip with the weight on the back leg; the hips start the throw (the pelvis shifts toward the wall and the back
 * knee drives in), the trunk follows and the arms whip the ball across the body into the wall at about chest height;
 * the rebound is caught and the ball carried back to the far hip.
 */
export function medBallRotationalThrow(id: string, label: string): MotionDef {
  const soles: [Vec, Vec] = [
    [27, 0],
    [-27, 0],
  ];
  const wallX = -104;
  // Elbow directions: hands at the far hip (left elbow back behind the body, right arm across in front); throwing
  // (both down/out).
  const atHip = { L: [0.35, -0.5, -1] as V3, R: [0.1, -1, 0.7] as V3 };
  const swing = { L: [0.5, -1, -0.4] as V3, R: [-0.3, -1, 0.4] as V3 };
  const thrown = { L: [0.2, -1, -0.2] as V3, R: [-0.4, -1, 0] as V3 };
  // Contact points on the ball: at the hip the back hand is under and behind it, the front hand on top in front.
  const gHip = { L: [9, -6, -5] as V3, R: [-8, 5, 7] as V3 };
  const gPush = { L: [10.5, 2, -4] as V3, R: [3, -10, 5] as V3 };
  const gCatch = { L: [9, 3, -5] as V3, R: [-1, -10, 5] as V3 };
  const keysT: ThrowKey[] = [
    // Loaded: weight on the back leg, ball beside the far hip.
    { dur: 0.16, hold: 0.35, st: { pelvis: [5, 85.5], trunk: 6, out: [9, 7] }, ball: [34, 89, -6], grip: gHip, pole: atHip },
    // Hips lead: the pelvis moves toward the wall and the back knee starts to drive in; the arms trail.
    { dur: 0.11, st: { pelvis: [-1, 87], trunk: 2, out: [-2, 6] }, ball: [28, 94, 3], grip: gHip, pole: atHip },
    // The trunk turns and the arms whip across.
    { dur: 0.1, st: { pelvis: [-6, 88], trunk: -3, out: [-9, 6] }, ball: [0, 107, 26], grip: gPush, pole: swing },
    // Release, at about chest height on the wall side, arms long.
    { dur: 0.07, st: { pelvis: [-9, 88.5], trunk: -6, out: [-12, 6] }, ball: [-50, 116, 30], grip: gPush, pole: thrown },
    // The ball hits the wall; the arms follow through toward it.
    { dur: 0.16, st: { pelvis: [-10, 88.5], trunk: -7, out: [-13, 6] }, ball: [wallX + BALL_R, 119, 24], free: { L: [-48, 117, 26], R: [-62, 108, 24] }, pole: thrown },
    // The rebound is caught in front of the lead hip.
    { dur: 0.24, st: { pelvis: [-9, 88], trunk: -5, out: [-10, 6] }, ball: [-44, 110, 28], grip: gCatch, pole: thrown },
    // Absorb, then carry the ball back across the body to the far hip.
    { dur: 0.35, st: { pelvis: [-6, 87.5], trunk: -3, out: [-4, 6] }, ball: [-24, 105, 24], grip: gCatch, pole: thrown },
    { dur: 0.35, st: { pelvis: [0, 86.5], trunk: 1, out: [4, 6] }, ball: [6, 100, 20], grip: gPush, pole: swing },
    { dur: 0.3, st: { pelvis: [4, 86], trunk: 4, out: [8, 7] }, ball: [28, 92, 2], grip: gHip, pole: atHip },
  ];
  return throwMotion(id, label, { soles, wallX, keys: keysT, stillPhase: 0.25 });
}

/**
 * Medicine-ball scoop toss. Side-on to a wall 1–2 m away: a slight squat loads the back hip with the ball low beside the
 * back pocket; the hips drive round and the arms scoop the ball up and across the body, releasing it at about chest
 * height into the wall; the rebound is caught and the ball returned to the back pocket.
 */
export function medBallScoopToss(id: string, label: string): MotionDef {
  const soles: [Vec, Vec] = [
    [29, 0],
    [-29, 0],
  ];
  const wallX = -168;
  const low = { L: [0.8, -0.6, -0.5] as V3, R: [0.2, -1, 0.8] as V3 };
  const scoop = { L: [0.5, -1, -0.3] as V3, R: [-0.2, -1, 0.5] as V3 };
  const up = { L: [0.2, -1, -0.2] as V3, R: [-0.5, -1, 0] as V3 };
  // Underneath the ball: both hands below and behind it (a scoop), the back hand lower.
  const gPocket = { L: [7, -9, -3] as V3, R: [-6, -8, 6] as V3 };
  const gScoop = { L: [8, -8, -3] as V3, R: [-2, -11, 4] as V3 };
  const gCatch = { L: [9, 3, -5] as V3, R: [-1, -10, 5] as V3 };
  const keysT: ThrowKey[] = [
    // Loaded: slight squat into the back hip, ball low beside the back pocket.
    { dur: 0.18, hold: 0.4, st: { pelvis: [6, 80], trunk: 8, out: [10, 8] }, ball: [33, 76, -6], grip: gPocket, pole: low },
    // Hips drive round first; the ball starts down and forward.
    { dur: 0.12, st: { pelvis: [0, 82], trunk: 4, out: [0, 7] }, ball: [24, 74, 6], grip: gPocket, pole: low },
    // The scoop: under and through, in front of the hips.
    { dur: 0.05, st: { pelvis: [-6, 85], trunk: -2, out: [-9, 6] }, ball: [-2, 84, 26], grip: gScoop, pole: scoop },
    { dur: 0.05, st: { pelvis: [-8.3, 86.6], trunk: -4.5, out: [-11, 6] }, ball: [-24, 97, 27], grip: gScoop, pole: scoop },
    // Release rising, at about chest height on the wall side.
    { dur: 0.09, st: { pelvis: [-10, 88], trunk: -7, out: [-13, 6] }, ball: [-44, 112, 26], grip: gScoop, pole: up },
    // In flight to the wall (chest height); the arms finish high toward it.
    { dur: 0.1, st: { pelvis: [-11, 88.5], trunk: -8, out: [-14, 6] }, ball: [-104, 124, 20], free: { L: [-50, 120, 28], R: [-52, 109, 30] }, pole: up },
    { dur: 0.22, st: { pelvis: [-11, 88.5], trunk: -8, out: [-14, 6] }, ball: [wallX + BALL_R, 130, 14], free: { L: [-48, 122, 27], R: [-52, 111, 30] }, pole: up },
    // Rebound dropping back to the hands.
    { dur: 0.2, st: { pelvis: [-10, 88], trunk: -6, out: [-12, 6] }, ball: [-100, 122, 18], free: { L: [-40, 115, 26], R: [-46, 104, 30] }, pole: up },
    { dur: 0.3, st: { pelvis: [-9, 87.5], trunk: -5, out: [-10, 6] }, ball: [-36, 106, 26], grip: gCatch, pole: up },
    // Reset: carry it back down to the back pocket.
    { dur: 0.4, st: { pelvis: [-2, 85], trunk: 0, out: [-2, 6] }, ball: [-6, 96, 22], grip: gCatch, pole: scoop },
    { dur: 0.35, st: { pelvis: [4, 81.5], trunk: 6, out: [8, 7] }, ball: [24, 82, 6], grip: gPocket, pole: low },
  ];
  return throwMotion(id, label, { soles, wallX, keys: keysT, stillPhase: 0.2 });
}

/**
 * Medicine-ball shot put. Side-on to a wall in a fighting stance, the ball held at the rear shoulder against the neck
 * with the throwing hand behind it and the elbow behind and below; the lead hand steadies it. The back foot drives, the
 * hips turn toward the wall and the throwing arm punches the ball off the shoulder into the wall at shoulder height,
 * following through; the rebound is caught with both hands and the ball returned to the rear shoulder.
 */
export function medBallShotPut(id: string, label: string): MotionDef {
  const soles: [Vec, Vec] = [
    [28, 0],
    [-28, 0],
  ];
  const wallX = -124;
  // Throwing hand behind and under the ball (screen right of it, and back), lead hand on its front.
  const gShoulder = { L: [6, -7, -8] as V3, R: [-9, 3, 7] as V3 };
  const gPunch = { L: [10, -2, -5] as V3, R: [-6, -6, 8] as V3 };
  const gCatch = { L: [9, 3, -5] as V3, R: [-2, -10, 5] as V3 };
  // The throwing elbow out to the side, behind and below the ball; the lead elbow down.
  const loaded = { L: [1, -0.5, -0.8] as V3, R: [-0.4, -1, 0.3] as V3 };
  const punch = { L: [0.4, -1, -0.5] as V3, R: [-0.6, -1, 0.2] as V3 };
  const catching = { L: [0.3, -1, -0.2] as V3, R: [-0.5, -1, 0] as V3 };
  const keysT: ThrowKey[] = [
    // Loaded on the back hip, ball tucked against the neck at the rear shoulder.
    { dur: 0.16, hold: 0.4, st: { pelvis: [5, 86], trunk: 5, out: [9, 7] }, ball: [16, 136.5, 22], grip: gShoulder, pole: loaded },
    // The back foot drives and the hips turn toward the wall; the ball has hardly left the shoulder.
    { dur: 0.12, st: { pelvis: [-2, 87.5], trunk: 1, out: [-4, 6] }, ball: [8, 140, 24], grip: gShoulder, pole: loaded },
    // The punch: the arm extends off the shoulder, the ball travelling straight toward the wall.
    { dur: 0.1, st: { pelvis: [-7, 88.5], trunk: -4, out: [-10, 6] }, ball: [-20, 141, 30], grip: gPunch, pole: punch },
    // Release at full extension; the lead arm has pulled down and back to the side.
    { dur: 0.08, st: { pelvis: [-9, 89], trunk: -6, out: [-12, 6] }, ball: [-58, 141, 32], free: { L: [-48, 140, 27], R: [-40, 104, 6] }, pole: punch },
    // Ball into the wall; follow-through.
    { dur: 0.16, st: { pelvis: [-10, 89], trunk: -7, out: [-13, 6] }, ball: [wallX + BALL_R, 140, 24], free: { L: [-52, 135, 28], R: [-40, 102, 6] }, pole: punch },
    // The rebound comes back and drops a little: caught with both hands at chest height.
    { dur: 0.28, st: { pelvis: [-8, 88.5], trunk: -5, out: [-10, 6] }, ball: [-40, 120, 28], grip: gCatch, pole: catching },
    // Back to the rear shoulder.
    { dur: 0.4, st: { pelvis: [-3, 87.5], trunk: -1, out: [-2, 6] }, ball: [-16, 130, 26], grip: gCatch, pole: catching },
    { dur: 0.4, st: { pelvis: [2, 86.5], trunk: 3, out: [6, 7] }, ball: [8, 137, 24], grip: gShoulder, pole: loaded },
  ];
  return throwMotion(id, label, { soles, wallX, keys: keysT, stillPhase: 0.12, foldedElbows: true });
}

// --------------------------------------------------------------------------------------- Landmine rotation

/**
 * Landmine rotation, from in front (the bar's pivot is on the floor in front of the lifter, so it is drawn in the
 * foreground). Both hands stay on the end of the bar with long arms; the bar end arcs from one hip, up through chest
 * height in the middle, down to the other hip. The hips turn and the back foot pivots (its knee turns in) toward the
 * side the bar goes to.
 */
export function landmineRotation(id: string, label: string): MotionDef {
  const soles: [Vec, Vec] = [
    [24, 0],
    [-24, 0],
  ];
  const root: RootRule = { pin: "soleR", at: soles[1] };
  const pivot: Vec = [0, -12];
  // Bar end (both hands) on screen for phase f (-1 = right hip, screen left; +1 = left hip, screen right).
  const end = (f: number): Vec => {
    const th = f * 72;
    return [23 * sin(th), 96 + 31 * ((cos(th) - cos(72)) / (1 - cos(72)))];
  };
  const at = (f: number): Pose => {
    const pelvis: Vec = [3 * f, 89.5 - 1.2 * Math.abs(f)];
    // The leg away from the bar pivots: its knee turns in.
    const st: Stance = { pelvis, trunk: 5 * f, out: [f < 0 ? 6 + 16 * f : 6, f > 0 ? 6 - 16 * f : 6] };
    let p = frontStance(st, soles);
    const e = end(f);
    // Long arms, out of the picture toward the bar as far as each arm's reach needs, elbows soft.
    const rel: Vec = [e[0] - pelvis[0], e[1] - pelvis[1]];
    for (const s of ["L", "R"] as const) {
      const sk = forwardKinematics(p, "front");
      const sh = sk.pts[`shoulder${s}`];
      const hand: Vec = [rel[0] + (s === "L" ? 1.6 : -1.6), rel[1] + (s === "L" ? 1.2 : -1.2)];
      const l = Math.hypot(hand[0] - sh[0], hand[1] - sh[1]);
      const z = Math.sqrt(Math.max(0, 62.2 ** 2 - l * l));
      p = frontArm(p, s, [hand[0], hand[1], z], [s === "L" ? 1 : -1, -1, 0]);
    }
    return p;
  };
  const N = 6;
  const half: KeySpec[] = [];
  const back: KeySpec[] = [];
  for (let i = 0; i < N; i++) {
    const f = -Math.cos((Math.PI * i) / N);
    half.push({ pose: at(f), dur: 0.27, hold: i === 0 ? 0.3 : 0, ease: "inOut" });
    back.push({ pose: at(-f), dur: 0.27, hold: i === 0 ? 0.3 : 0, ease: "inOut" });
  }
  return {
    id,
    view: "front",
    label,
    keyframes: keys(root, [...half, ...back]),
    props: [{ id: "lm", kind: "landmine", variant: "kit-landmine", at: pivot, to: { lm: "hands" }, size: 13, layer: "near" }],
    allowLimits: ["shL", "shR"],
    footGrounded: true,
    planted: ["L", "R"],
    stillPhase: 0.5,
  };
}

// ------------------------------------------------------------------------------------------- Pallof press

/**
 * Pallof press, from in front and a little above, standing side-on to a cable at chest height (the cable comes in
 * across the picture): the handle goes from the sternum, elbows tucked by the ribs, straight out to arm's length toward
 * the viewer — the upper arms foreshorten away and the fists drop a little in the picture as they come closer — holds
 * there with the body square (not turned toward the cable), and returns.
 *
 * Tried and rejected: a side view (the press is clear, but the cable tower then stands directly behind the lifter and
 * reads as a cable from behind) and a three-quarter camera (the far arm crosses the square-on chest and reads as a hug).
 */
export function pallofPress(id: string, label: string): MotionDef {
  const soles: [Vec, Vec] = [
    [20, 0],
    [-20, 0],
  ];
  const root: RootRule = { pin: "soleR", at: soles[1] };
  const cam: Cam = { yaw: 0, pitch: 10 };
  const pelvis: Vec = [0, 91];
  const base = frontStance({ pelvis, trunk: 0, out: [4, 4] }, soles);
  const shY = worldPts(base, root, "front").shoulderL[1];
  const chestY = shY - 18;
  const hand = (s: number): V3 => [0, chestY + 1.5 * s, 23 + 38 * s];
  // Elbows tucked down by the ribs at the chest.
  const pole = { L: [0.15, -1, -0.25] as V3, R: [-0.15, -1, -0.25] as V3 };
  const at = (s: number) => frontHands(base, pelvis, { L: hand(s), R: hand(s) }, pole, cam);
  const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  const outS = [0, 1 / 3, 2 / 3, 1].map(ease);
  const specs: KeySpec[] = [
    { pose: at(outS[0]!), dur: 0.38, hold: 0.5, ease: "inOut" },
    { pose: at(outS[1]!), dur: 0.38, ease: "inOut" },
    { pose: at(outS[2]!), dur: 0.38, ease: "inOut" },
    { pose: at(outS[3]!), dur: 0.45, hold: 1.2, ease: "inOut" },
    { pose: at(outS[2]!), dur: 0.45, ease: "inOut" },
    { pose: at(outS[1]!), dur: 0.45, ease: "inOut" },
  ];
  const towerX = -128;
  return {
    id,
    view: "front",
    label,
    keyframes: keys(root, specs),
    props: [
      { id: "tower", kind: "cableTower", at: [towerX, 0], h: 205, layer: "back" },
      { id: "cable", kind: "cable", at: [towerX + 14, chestY + 2], to: { lm: "hands" }, layer: "near" },
    ],
    footGrounded: true,
    planted: ["L", "R"],
    stillPhase: 0.55,
  };
}

// ------------------------------------------------------------------------------------------ Band pull-apart

/**
 * Band pull-apart, from in front and slightly above: arms long in front at chest height (pointing at the viewer, so
 * foreshortened), the hands sweep out and back until the arms form a T and the band is across the chest, then return
 * slowly. The band is drawn over the arms, so it stays visible at full stretch.
 */
export function bandPullApart(id: string, label: string): MotionDef {
  const soles: [Vec, Vec] = [
    [14, 0],
    [-14, 0],
  ];
  const root: RootRule = { pin: "soleR", at: soles[1] };
  const cam: Cam = { yaw: 0, pitch: 14 };
  const pelvis: Vec = [0, 93];
  const base = frontStance({ pelvis, trunk: 0, out: [3, 3] }, soles);
  const W = worldPts(base, root, "front");
  const reach = 62.2;
  // th: 0 = arms straight ahead (hands shoulder width), 1 = arms out to the sides.
  const hand = (s: Side, th: number): V3 => {
    const k = s === "L" ? 1 : -1;
    const a = 2 + 80 * th;
    const sh = W[`shoulder${s}`];
    return [sh[0] + k * reach * sin(a) - k * 2, sh[1] - 7 + 2 * th, reach * cos(a)];
  };
  const pole = { L: [0.2, -1, 0] as V3, R: [-0.2, -1, 0] as V3 };
  const at = (th: number) => frontHands(base, pelvis, { L: hand("L", th), R: hand("R", th) }, pole, cam);
  const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  const specs: KeySpec[] = [
    { pose: at(0), dur: 0.36, hold: 0.35, ease: "inOut" },
    { pose: at(ease(1 / 3)), dur: 0.36, ease: "inOut" },
    { pose: at(ease(2 / 3)), dur: 0.36, ease: "inOut" },
    { pose: at(1), dur: 0.55, hold: 0.45, ease: "inOut" },
    { pose: at(ease(2 / 3)), dur: 0.55, ease: "inOut" },
    { pose: at(ease(1 / 3)), dur: 0.55, ease: "inOut" },
  ];
  return {
    id,
    view: "front",
    label,
    keyframes: keys(root, specs),
    props: [{ id: "band", kind: "band", variant: "kit-band", at: { lm: "handL" }, to: { lm: "handR" }, layer: "front" }],
    footGrounded: true,
    planted: ["L", "R"],
    stillPhase: 0.45,
  };
}

// ----------------------------------------------------------------------------------------- Rear-delt fly

/**
 * Rear-delt fly, from in front of a lifter hinged forward toward the viewer (the torso foreshortened): dumbbells hang
 * under the chest, then the arms open out to the sides with a slight elbow bend, leading with the elbows, until they
 * are level with the shoulders; a short pause and a slow lower. The arms move across the picture, so the fly reads
 * clearly as arms opening out to the sides rather than a row.
 */
export function rearDeltFlyFront(id: string, label: string): MotionDef {
  const soles: [Vec, Vec] = [
    [16, 0],
    [-16, 0],
  ];
  const root: RootRule = { pin: "soleR", at: soles[1] };
  const pelvis: Vec = [0, 85.5];
  const base = frontStance({ pelvis, trunk: 0, trunkD: 67, out: [4, 4] }, soles);
  const W = worldPts(base, root, "front");
  const reach = 62.3;
  // th: 0 = hanging under the chest, 1 = out to the sides at shoulder level.
  const hand = (s: Side, th: number): V3 => {
    const k = s === "L" ? 1 : -1;
    const a = -5 + 88 * th;
    const sh = W[`shoulder${s}`];
    return [sh[0] + k * reach * sin(a), sh[1] - reach * cos(a), 4 * sin(180 * th)];
  };
  const pole = { L: [1, 0.9, -0.3] as V3, R: [-1, 0.9, -0.3] as V3 };
  const at = (th: number) => frontHands(base, pelvis, { L: hand("L", th), R: hand("R", th) }, pole);
  const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  const specs: KeySpec[] = [
    { pose: at(0), dur: 0.36, hold: 0.35, ease: "inOut" },
    { pose: at(ease(1 / 3)), dur: 0.36, ease: "inOut" },
    { pose: at(ease(2 / 3)), dur: 0.36, ease: "inOut" },
    { pose: at(1), dur: 0.55, hold: 0.5, ease: "inOut" },
    { pose: at(ease(2 / 3)), dur: 0.55, ease: "inOut" },
    { pose: at(ease(1 / 3)), dur: 0.55, ease: "inOut" },
  ];
  return {
    id,
    view: "front",
    label,
    keyframes: keys(root, specs),
    props: [
      { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "end", layer: "near", size: 0.8 },
      { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "end", layer: "near", size: 0.8 },
    ],
    footGrounded: true,
    planted: ["L", "R"],
    stillPhase: 0.5,
  };
}

// ------------------------------------------------------------------------------------- Kneeling cable crunch

/**
 * Kneeling cable crunch, side view: kneeling upright with the shins flat on the floor and the rope beside the head, the
 * ribs curl down toward the pelvis (the hips stay over the knees) until the elbows reach the thighs, a squeeze, and a
 * slow return. The tower stands far enough in front that the head and hands stay clear of it at the bottom.
 */
export function cableCrunch(id: string, label: string): MotionDef {
  const root: RootRule = { pin: "kneeCapR", at: [0, 0] };
  const thighA = 4;
  const kneel = (T: number, spine: number, neck: number): Pose =>
    armsLocal(pose({ trunk: T, spine, neck, hipL: thighA + T, hipR: thighA + T, kneeL: thighA + 89, kneeR: thighA + 89, ankleL: -64, ankleR: -64 }), [15, 5], [11, 25]);
  const top = kneel(8, -2, 4);
  const mid = kneel(18, 26, 12);
  const bottom = kneel(30, 52, 18);
  let reach = -Infinity;
  for (const p of [top, mid, bottom]) {
    const W = worldPts(p, root);
    reach = Math.max(reach, W.head[0] + BODY.headR, W.handR[0], W.handL[0], W.elbowR[0]);
  }
  const pulley: Vec = [reach + 26, 206];
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: top, dur: 0.7, hold: 0.4, ease: "inOut" },
      { pose: mid, dur: 0.7, ease: "inOut" },
      { pose: bottom, dur: 0.9, hold: 0.45, ease: "inOut" },
      { pose: mid, dur: 0.9, ease: "inOut" },
    ]),
    props: [
      { id: "tower", kind: "cableTower", at: [pulley[0] + 14, 0], h: pulley[1] + 9, layer: "back" },
      { id: "cable", kind: "cable", at: pulley, to: { lm: "hands" }, layer: "near" },
      { id: "pad", kind: "pad", at: [-12, 2], w: 34, layer: "back" },
    ],
    stillPhase: 0.45,
    allowLimits: [],
  };
}

// ---------------------------------------------------------------------------------- Arm-over-arm sled pull

/**
 * Arm-over-arm sled pull, side view. Braced in a staggered athletic stance, one hand pulls the rope from a long reach to
 * the hip while the other comes forward over it and grips farther along the rope, so the sled keeps moving. The rope
 * runs from the sled to the leading gripping hand, between the hands while both hold it, and drops to a pile at the
 * feet once pulled in. The sled moves exactly as far as the rope is pulled; at the loop's seam it cross-fades back.
 */
export function armOverArmSledPull(id: string, label: string): MotionDef {
  const root: RootRule = { pin: "soleR", at: [0, 0] };
  let base = pose({ ...stanceLegs(14, 44, 34, ["R"]), neck: -18 });
  const W0 = worldPts(base, root);
  const rearAnkle = ankleForSole(W0.soleR[0] - 40, 0, -26);
  base = legsTo(base, root, rearAnkle, ["L"], -26);
  const W = worldPts(base, root);
  const sledX0 = 236;
  const hitchX0 = sledX0 - 47;
  const hitchY = 9;
  // Each pull runs from a long reach (A, on the rope toward the sled) to the hip (B).
  const B: Vec = [W.belly[0] + 11, W.belly[1] - 6];
  const T = 1.8;
  const P = 0.55 * T;
  // The reach: along the rope from the hip toward the sled, as far as a long arm reaches with the elbow still soft.
  const reachFor = (hitchX: number): Vec => {
    const d: Vec = [hitchX - B[0], hitchY - B[1]];
    const L = Math.hypot(d[0], d[1]);
    const u: Vec = [d[0] / L, d[1] / L];
    const along = solve1D((s) => Math.hypot(B[0] + u[0] * s - W.shoulder[0], B[1] + u[1] * s - W.shoulder[1]) - (ARM_REACH - 3), 0, 90);
    return [B[0] + u[0] * along, B[1] + u[1] * along];
  };
  const pullLen = Math.hypot(reachFor(hitchX0)[0] - B[0], reachFor(hitchX0)[1] - B[1]);
  // The near hand pulls first (sled at its start), the far hand half a loop later (sled about one pull closer).
  const A_R = reachFor(hitchX0);
  const A_L = reachFor(hitchX0 - pullLen);
  const pullS = (x: number) => 0.14 * x + 0.86 * (0.5 - 0.5 * Math.cos(Math.PI * x));
  /** One hand, `tl` seconds into its own cycle (its pull starts at 0). */
  const hand = (tl: number, A: Vec): { h: Vec; grip: number; pulling: boolean } => {
    if (tl < P) {
      const s = pullS(tl / P);
      return { h: [A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s], grip: 1, pulling: true };
    }
    // Back over the top of the other arm to the next reach, landing on the rope.
    const k = (tl - P) / (T - P);
    const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
    const lift = 22 * Math.sin(Math.PI * k);
    const h: Vec = [B[0] + (A[0] - B[0]) * e, B[1] + (A[1] - B[1]) * e + lift];
    const grip = k < 0.14 ? 1 - smoothstep(k / 0.14) : k > 0.9 ? smoothstep((k - 0.9) / 0.1) : 0;
    return { h, grip, pulling: false };
  };
  const at = (t: number) => {
    const tt = ((t % T) + T) % T;
    return { R: hand(tt, A_R), L: hand((((tt - T / 2) % T) + T) % T, A_L) };
  };
  // The sled moves with whichever hand is pulling (where the pulls overlap, with the faster one).
  const M = 720;
  const speed = (t: number) => {
    const dt = T / M;
    let v = 0;
    for (const s of ["R", "L"] as const) {
      const a = at(t)[s];
      const b = at(t + dt)[s];
      if (a.pulling && b.pulling) v = Math.max(v, Math.hypot(b.h[0] - a.h[0], b.h[1] - a.h[1]) / dt);
    }
    return v;
  };
  const cum: number[] = [0];
  for (let i = 0; i < M; i++) cum.push(cum[i]! + speed((i / M) * T) * (T / M));
  const travel = cum[M]!;
  const progress = (t: number) => cum[Math.round((t / T) * M)]! / travel;
  const N = 18;
  const specs: KeySpec[] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * T;
    const { R, L } = at(t);
    // The trunk rocks a little with each pull.
    const rock = 1.5 * Math.sin((4 * Math.PI * t) / T);
    let p: Pose = { ...base, trunk: base.trunk + rock, hipL: base.hipL + rock, hipR: base.hipR + rock };
    p = legsTo(p, root, rearAnkle, ["L"], -26);
    p = handsTo(handsTo(p, root, R.h, ["R"]), root, L.h, ["L"]);
    const ang = 2 * Math.PI * progress(t);
    specs.push({
      pose: p,
      dur: T / N,
      ease: "spline",
      ik: { handR: R.h, handL: L.h, footL: rearAnkle },
      props: { ctrlU: [Math.cos(ang), Math.sin(ang)], ctrlG: [R.grip, L.grip] },
    });
  }
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, specs),
    props: [
      { id: "sled", kind: "sled", variant: "kit-sled", at: [sledX0, 0], size: travel, w: 90, layer: "back" },
      { id: "tail", kind: "rope", variant: "kit-ropetail", at: [sledX0, 0], layer: "mid" },
      { id: "ctrlU", kind: "rope", variant: "kit-ctrl", at: [1, 0], layer: "back" },
      { id: "ctrlG", kind: "rope", variant: "kit-ctrl", at: [1, 0], layer: "back" },
    ],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.1,
  };
}


// -------------------------------------------------------------------------------------- Sandbag to shoulder

/**
 * Sandbag to shoulder, side view: straddle and hinge to grip the bag, lap it onto the thighs, extend the hips to pop it
 * onto the (far) shoulder; then the way down under control, the reverse: off the shoulder into a hug at the chest, sit
 * back into the lap position with the bag on the thighs, and lower it to the floor between the feet.
 */
export function sandbagToShoulder(id: string, label: string): MotionDef {
  const root: RootRule = { pin: "soleR", at: [0, 0] };
  const r = 15;
  const k = (p: Pose, dur: number, extra: Partial<KeySpec> = {}): KeySpec => ({ pose: p, dur, ease: "inOut", ...extra });
  const floorObj: Vec = [22, r];
  const hinge = handsTo({ ...pose({ ...stanceLegs(16, 80, 62), spine: 18, neck: -16 }), armDL: 40, armDR: 40 }, root, [floorObj[0] + 4, floorObj[1] - 8]);
  const lapBase = pose({ ...stanceLegs(26, 112, 30), spine: 10, neck: -6 });
  const Wl = worldPts(lapBase, root);
  const lap = handsTo({ ...lapBase, armDL: 40, armDR: 40 }, root, [Wl.kneeR[0] - 2, Wl.kneeR[1] + 2]);
  const lapObj: Anchor = { lm: "thighR", dx: 4, dy: r + 4 };
  // Standing tall with the bag hugged high against the chest.
  const extend = armsLocal(pose({ ...stanceLegs(4, 10, -8) }), [14, -24], [22, -6]);
  const popObj: Anchor = { lm: "chest", dx: 10, dy: 12 };
  const shoulderObj: Anchor = { lm: "shoulder", dx: -2, dy: 9 };
  const top = armsLocal(pose({ ...stanceLegs(1, 3, 0) }), [-4, -16], [4, 14]);
  // Lowering: hugged at the chest with soft knees, then sitting back into the lap with the bag on the thighs.
  const hug = armsLocal(pose({ ...stanceLegs(6, 16, 2), neck: -4 }), [14, -24], [22, -6]);
  const chestObj: Anchor = { lm: "chest", dx: r * 0.7, dy: -2 };
  const sitBase = pose({ ...stanceLegs(20, 76, 20), spine: 8, neck: -6 });
  const sit = armsLocal(sitBase, [16, -26], [26, -12]);
  const sitObj: Anchor = { lm: "chest", dx: r * 0.75, dy: -10 };
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      k(hinge, 0.7, { hold: 0.5, props: { obj: floorObj } }),
      k(lap, 0.8, { hold: 0.3, props: { obj: lapObj } }),
      k(extend, 0.35, { props: { obj: popObj } }),
      k(top, 0.8, { hold: 0.6, props: { obj: shoulderObj }, layers: { obj: "mid" } }),
      k(hug, 0.6, { props: { obj: chestObj } }),
      k(sit, 0.55, { props: { obj: sitObj } }),
      k(lap, 0.7, { hold: 0.25, props: { obj: lapObj } }),
    ]),
    props: [{ id: "obj", kind: "sandbag", at: floorObj, w: 44, h: 28, layer: "front" }],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.3,
  };
}
