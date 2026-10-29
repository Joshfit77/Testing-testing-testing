import * as THREE from "three";
import { FINGERS, SIDE_SIGN, type Side, type Skeleton3 } from "./skeleton";

/**
 * Poses the anatomical skeleton from goals: where the pelvis is, how the trunk and head turn, where each wrist and
 * ankle must be (with the hand's and foot's orientation when they hold or stand on something), which way the elbows
 * and knees point, and how the fingers close.
 *
 * Every joint moves the way it can in the body, so a pose never needs a bone to stretch or a limb to flip:
 * - elbows and knees are hinges about their measured axes; the arm's swivel (the humerus's rotation) is chosen by the
 *   pole, and the elbow angle by the distance to the wrist, exactly (analytic IK on the real bone geometry);
 * - the forearm turns the hand by pronation and supination of the radius (limited to the forearm's range); what the
 *   radius cannot turn, the swivel is searched for before the wrist is asked to bend;
 * - the wrist and ankle bend within their ranges; the shoulder blade and collarbone follow the arm (the scapula rotates
 *   upwards as the arm rises, the shoulders lift and reach forward) so the arm never pivots alone against the ribs;
 * - the trunk's bend, side bend and turn are shared over four spine joints (turning mostly in the thoracic spine,
 *   bending mostly in the lumbar spine), the head's over the neck and head;
 * - a thigh drawn up past the hip's range takes the pelvis with it: the pelvis tilts back about the hips and the lower
 *   back rounds (the lumbopelvic rhythm of a deep squat or a rowing catch), so the hip itself never flexes past it.
 *
 * Results that could not be met (a wrist out of reach, a hand turned beyond the forearm's range) are reported per
 * frame in `SolveReport`, so the checks can tell a contact that holds from one that does not.
 */

export type V = THREE.Vector3;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
const D2R = Math.PI / 180;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** How the fingers close: a power grip round a handle of this radius (cm), a flat open hand, a fist, or relaxed. */
export type Grip =
  | { kind: "wrap"; radius: number }
  | { kind: "hook"; radius: number }
  | { kind: "open" }
  | { kind: "flat" }
  | { kind: "fist" }
  | { kind: "relaxed" }
  | { kind: "cup" }
  /** Part way from one hand shape to another (`t` 0..1): fingers open or close over a few frames, never in one. */
  | { kind: "blend"; from: Grip; to: Grip; t: number };

export interface ArmGoal {
  /** Where the wrist joint must be (rig frame). */
  wrist: V;
  /** The way the elbow should point (a direction; only its part across the shoulder→wrist line counts). */
  pole: V;
  /** The hand's orientation (world rotation of the hand bone) when it holds something; otherwise `pronation`. */
  hand?: THREE.Quaternion;
  /** Pronation (degrees) of a free hand: 0 palm forward (anatomical position), 90 thumb forward, 180 palm back. */
  pronation?: number;
  /** A free hand's wrist bend (degrees; + flexion towards the palm). */
  wristFlex?: number;
  /** A round handle's axis and centre: the hand may roll round it (degrees, within `range`) and lie obliquely across it
   *  (within `oblique`, default 20°) to suit the arm. The fingers wrap this handle. */
  roll?: { center: V; axis: V; range?: number; oblique?: number };
  /** Shrug (degrees; + lifts the shoulder) and reach (+ protraction) on top of the arm's own rhythm. */
  shrug?: number;
  reach?: number;
  grip?: Grip;
  /** A ball the hand is on: the fingers stop at its surface. */
  ball?: { center: V; radius: number };
}

export interface LegGoal {
  ankle: V;
  /** The way the knee should point. */
  pole: V;
  /** The foot's orientation (world rotation of the foot bone); otherwise kept square to the shin. */
  foot?: THREE.Quaternion;
  /** Toes bent up (degrees), e.g. when standing on the balls of the feet. */
  toes?: number;
}

export interface PoseGoals {
  pelvis: { pos: V; rot: THREE.Quaternion };
  /** The upper back's orientation (world rotation of thorax2); shared over the spine. */
  chest: THREE.Quaternion;
  /** The head's orientation (world); shared over the neck and head. */
  head: THREE.Quaternion;
  arms: Record<Side, ArmGoal>;
  legs: Record<Side, LegGoal>;
}

/** Set to receive each held arm's solution (debugging). */
export const trace: {
  arm?: (
    s: Side,
    d: {
      swivel: number;
      phi: number;
      theta: number;
      over: number;
      wristOver: number;
    }
  ) => void;
} = {};

export interface SolveReport {
  /** How far each wrist / ankle ended from its target (cm). */
  reach: Record<"wristR" | "wristL" | "ankleR" | "ankleL", number>;
  /** How far each hand's orientation is from the asked one (degrees), after the forearm and wrist limits. */
  handTurn: Record<Side, number>;
  /** Degrees by which a joint had to be held at its limit (pronation, wrist, elbow, knee, ankle). */
  limits: Record<string, number>;
}

// ---------------------------------------------------------------- joint ranges (degrees)
export const RANGE = {
  elbow: [0, 148],
  knee: [0, 155],
  /** Pronation from the rest pose's palm-forward supination. */
  pronation: [-10, 186],
  wristFlex: [-70, 75],
  wristDev: [-35, 22],
  ankleFlex: [-50, 32],
  ankleInv: [-22, 30],
  toes: [-30, 75],
  fingerMcp: [-15, 90],
  fingerPip: [0, 105],
  fingerDip: [0, 80],
} as const;

/** Precomputed geometry per side, measured from the skeleton once. */
interface Limb {
  // Arm
  clav: number;
  scap: number;
  hum: number;
  ulna: number;
  rad: number;
  hand: number;
  elbowHinge: V;
  elbowFlexSign: number;
  pronSign: number;
  // Hand frame at rest: long (wrist to middle knuckle), across (little to index knuckle), palm (out of the palm).
  long: V;
  across: V;
  palm: V;
  // Leg
  thigh: number;
  shin: number;
  foot: number;
  toes: number;
  patella: number;
  kneeHinge: V;
  kneeFlexSign: number;
  ankleHinge: V;
  ankleFlexSign: number;
}

const cache = new WeakMap<Skeleton3, Record<Side, Limb>>();
function limbs(sk: Skeleton3): Record<Side, Limb> {
  const hit = cache.get(sk);
  if (hit) return hit;
  const make = (s: Side): Limb => {
    const sign = SIDE_SIGN[s];
    const J = sk.meta.joints[s];
    const v = (a: readonly number[]) => V3(a[0], a[1], a[2]);
    const hum = sk.i(`humerus${s}`),
      ulna = sk.i(`ulna${s}`),
      rad = sk.i(`radius${s}`),
      hand = sk.i(`hand${s}`);
    const thigh = sk.i(`thigh${s}`),
      shin = sk.i(`shin${s}`),
      foot = sk.i(`foot${s}`);
    const long = v(J.middle.mcp).sub(v(J.wrist)).normalize();
    const across0 = v(J.index.mcp).sub(v(J.little.mcp));
    const across = across0
      .addScaledVector(long, -across0.dot(long))
      .normalize();
    const palm = V3()
      .crossVectors(across, long)
      .multiplyScalar(sign)
      .normalize();
    // Signs: which way of turning about each hinge flexes the joint (measured on the rest skeleton).
    const elbowHinge = sk.hingeLocal[ulna]!.clone();
    const wristRest = v(J.wrist).sub(v(J.elbow));
    const flexDir = V3(1, 0, 0); // flexing the elbow brings the wrist forward from the hanging arm
    const turned = wristRest
      .clone()
      .applyAxisAngle(
        elbowHinge.clone().applyQuaternion(sk.restRot[hum]!),
        0.3
      );
    const elbowFlexSign = turned.sub(wristRest).dot(flexDir) > 0 ? 1 : -1;
    // Pronation turns the palm from forward to medial (towards the body's midline) first.
    const radAxis = V3(0, 1, 0).applyQuaternion(sk.restRot[rad]!);
    const palmTurned = palm.clone().applyAxisAngle(radAxis, 0.3);
    const pronSign = palmTurned.sub(palm).z * -sign > 0 ? 1 : -1;
    const kneeHinge = sk.hingeLocal[shin]!.clone();
    const ankleRest = v(J.ankle).sub(v(J.knee));
    const kTurned = ankleRest
      .clone()
      .applyAxisAngle(
        kneeHinge.clone().applyQuaternion(sk.restRot[thigh]!),
        0.3
      );
    const kneeFlexSign = kTurned.sub(ankleRest).x < 0 ? 1 : -1;
    const ankleHinge = sk.hingeLocal[foot]!.clone();
    const toeRest = v(J.ball).sub(v(J.ankle));
    const aTurned = toeRest
      .clone()
      .applyAxisAngle(
        ankleHinge.clone().applyQuaternion(sk.restRot[shin]!),
        0.3
      );
    // (Dorsiflexion lifts the toes.)
    const ankleFlexSign = aTurned.sub(toeRest).y > 0 ? 1 : -1;
    return {
      clav: sk.i(`clav${s}`),
      scap: sk.i(`scap${s}`),
      hum,
      ulna,
      rad,
      hand,
      elbowHinge,
      elbowFlexSign,
      pronSign,
      long,
      across,
      palm,
      thigh,
      shin,
      foot,
      toes: sk.i(`toes${s}`),
      patella: sk.i(`patella${s}`),
      kneeHinge,
      kneeFlexSign,
      ankleHinge,
      ankleFlexSign,
    };
  };
  const out = { R: make("R"), L: make("L") };
  cache.set(sk, out);
  return out;
}

/** The hand frame at rest (world): long, across and palm axes, for building hand goals. */
export function handAxes(
  sk: Skeleton3,
  s: Side
): { long: V; across: V; palm: V } {
  const L = limbs(sk)[s];
  return {
    long: L.long.clone(),
    across: L.across.clone(),
    palm: L.palm.clone(),
  };
}

/** The world rotation of the hand bone whose long, across and palm axes are the given world directions. */
export function handRotation(
  sk: Skeleton3,
  s: Side,
  long: V,
  across: V
): THREE.Quaternion {
  const L = limbs(sk)[s];
  const sign = SIDE_SIGN[s];
  const restB = new THREE.Matrix4().makeBasis(
    L.long,
    L.across,
    V3().crossVectors(L.across, L.long).multiplyScalar(sign)
  );
  const a = across.clone().addScaledVector(long, -across.dot(long)).normalize();
  const nowB = new THREE.Matrix4().makeBasis(
    long.clone().normalize(),
    a,
    V3().crossVectors(a, long).normalize().multiplyScalar(sign)
  );
  // R such that R·rest axes = now axes; the hand bone's rotation is R applied to its rest rotation.
  const R = Q().setFromRotationMatrix(nowB.multiply(restB.invert()));
  return R.multiply(sk.restRot[L.hand]!);
}

/**
 * The centre of a power grip in the hand at rest (rig): across the palm at the knuckles' line, midway across the
 * hand (between the index and little fingers), in front of the palm by the handle's radius and the palm's half
 * thickness.
 */
export function gripRest(sk: Skeleton3, s: Side, radius: number): V {
  const L = limbs(sk)[s];
  const J = sk.meta.joints[s];
  const knuckles = V3(...J.index.mcp)
    .add(V3(...J.little.mcp))
    .multiplyScalar(0.5);
  const base = V3(...J.wrist)
    .lerp(knuckles, 0.85)
    .addScaledVector(L.palm, radius + 1.4);
  // Centred across the fist, from the index finger's outer edge to the little finger's (the fingers close side by side
  // round a handle), so a handle between two heads sits in the middle of the fist.
  const index = V3(...J.index.mcp).sub(base).dot(L.across) + 0.9;
  const little = V3(...J.little.mcp).sub(base).dot(L.across) - 0.9;
  return base.addScaledVector(L.across, (index + little) / 2);
}

/** Wrist and hand pose that put the grip point of the hand on a handle (power grip). */
export function gripOn(
  sk: Skeleton3,
  s: Side,
  handle: { at: V; axis: V },
  /** Which way along the handle the thumb side points (overhand on a bar: towards the midline). */
  thumb: V,
  /** Roughly where the forearm comes from (the elbow, or the shoulder at first). */
  from: V,
  radius: number
): { wrist: V; hand: THREE.Quaternion } {
  const L = limbs(sk)[s];
  void L;
  const J = sk.meta.joints[s];
  const across = handle.axis.clone().normalize();
  if (across.dot(thumb) < 0) across.negate();
  // The hand's long axis: square to the handle, as close as it can be to the line from the forearm to the handle.
  const want = handle.at.clone().sub(from);
  const long = want.addScaledVector(across, -want.dot(across)).normalize();
  if (long.lengthSq() < 0.5) long.set(0, -1, 0);
  const hand = handRotation(sk, s, long, across);
  const wristRest = V3(...J.wrist);
  const local = gripRest(sk, s, radius)
    .sub(wristRest)
    .applyQuaternion(sk.restRot[L.hand]!.clone().invert());
  const wrist = handle.at.clone().sub(local.applyQuaternion(hand));
  return { wrist, hand };
}

// ---------------------------------------------------------------- the solve

const tmpQ = Q();
const axisAngle = (axis: V, deg: number) =>
  Q().setFromAxisAngle(axis.clone().normalize(), deg * D2R);

/** Splits q into a turn about `axis` (degrees) and the rest (q = twist · swing). */
function twistAbout(q: THREE.Quaternion, axis: V): number {
  const p = axis.clone().normalize();
  const d = q.x * p.x + q.y * p.y + q.z * p.z;
  const t = Q().set(p.x * d, p.y * d, p.z * d, q.w);
  if (t.lengthSq() < 1e-12) return 0;
  t.normalize();
  const ang = 2 * Math.atan2(Math.hypot(t.x, t.y, t.z), t.w);
  const sgn = t.x * p.x + t.y * p.y + t.z * p.z >= 0 ? 1 : -1;
  let deg = (sgn * ang) / D2R;
  if (deg > 180) deg -= 360;
  if (deg < -180) deg += 360;
  return deg;
}

/** Angle of a rotation (degrees). */
const angleOf = (q: THREE.Quaternion) =>
  (2 * Math.acos(clamp(Math.abs(q.w), 0, 1))) / D2R;

export function solvePose(
  sk: Skeleton3,
  g: PoseGoals,
  report?: SolveReport
): void {
  const lim = limbs(sk);
  const rep = report ?? {
    reach: { wristR: 0, wristL: 0, ankleR: 0, ankleL: 0 },
    handTurn: { R: 0, L: 0 },
    limits: {},
  };
  const held = (name: string, over: number) => {
    if (Math.abs(over) > 0.5)
      rep.limits[name] = Math.max(rep.limits[name] ?? 0, Math.abs(over));
  };
  // Pelvis (tilted back if the thighs are drawn up past the hips' range).
  const pel = sk.i("pelvis");
  const pelvisRot = pelvisForHips(sk, g, lim);
  sk.pos[pel]!.copy(g.pelvis.pos);
  sk.rot[pel]!.copy(pelvisRot);
  // Spine: the chest's turn relative to the pelvis, split into bend (about the pelvis's side axis), side bend (about its
  // forward axis) and turn (about its up axis), shared over the four joints.
  {
    const spine = ["lumbar1", "lumbar2", "thorax1", "thorax2"].map((n) =>
      sk.i(n)
    );
    // Where the chest would be with the spine at rest.
    const restChest = pelvisRot
      .clone()
      .multiply(sk.restRot[pel]!.clone().invert())
      .multiply(sk.restRot[spine[3]!]!);
    const rel = restChest.clone().invert().premultiply(g.chest).normalize(); // world delta: chest = rel · restChest
    // Decompose rel in the pelvis frame as turn (Y) · side bend (X: forward) · bend (Z: side).
    const pf = pelvisRot.clone().multiply(sk.restRot[pel]!.clone().invert());
    const local = pf.clone().invert().multiply(rel).multiply(pf);
    const e = new THREE.Euler().setFromQuaternion(local, "YXZ");
    const share = {
      bend: [0.3, 0.28, 0.24, 0.18],
      side: [0.25, 0.25, 0.25, 0.25],
      turn: [0.08, 0.1, 0.4, 0.42],
    };
    spine.forEach((k, n) => {
      const part = new THREE.Euler(
        e.x * share.side[n]!,
        e.y * share.turn[n]!,
        e.z * share.bend[n]!,
        "YXZ"
      );
      const delta = Q().setFromEuler(part);
      sk.place(k);
      const carried = sk.carried(k, Q());
      // Delta in the pelvis frame, applied in the world.
      sk.rot[k]!.copy(
        pf
          .clone()
          .multiply(delta)
          .multiply(pf.clone().invert())
          .multiply(carried)
      );
    });
  }
  // Neck and head.
  {
    const neck = sk.i("neck"),
      head = sk.i("head");
    sk.place(neck);
    const restHead = sk.carried(neck, Q()).multiply(sk.restLocal[head]!);
    const rel = restHead.clone().invert().premultiply(g.head).normalize();
    const half = Q().slerp(rel, 0.45);
    sk.turn(neck, half);
    const rest = Q().slerp(rel, 1).multiply(half.clone().invert());
    sk.turn(head, rest);
  }
  for (const s of ["R", "L"] as const)
    solveArm(sk, s, g.arms[s], lim[s], rep, held);
  for (const s of ["R", "L"] as const)
    solveLeg(sk, s, g.legs[s], lim[s], rep, held);
  sk.updateBlends();
}

/** Continuity weights (cost per degree squared of change from the last frame): humerus turn, forearm turn, the hand's
 *  roll and lie on its handle. */
const K_HUM = 0.04;
const K_PHI = 0.02;
const K_ROLL = 0.04;

/** The swivel each held arm had at the last solve, per skeleton (continuity from frame to frame). */
const lastSwivel = new WeakMap<Skeleton3, Record<Side, number | null>>();
/** The humerus's rotation for each held arm at the last solve. */
const lastHum = new WeakMap<Skeleton3, Record<Side, THREE.Quaternion | null>>();
/** The pronation each held arm had at the last solve. */
const lastPhi = new WeakMap<Skeleton3, Record<Side, number | null>>();
/** The roll of each hand round its handle at the last solve. */
const lastRoll = new WeakMap<Skeleton3, Record<Side, number | null>>();
/** How obliquely each hand lay across its handle at the last solve. */
const lastYaw = new WeakMap<Skeleton3, Record<Side, number | null>>();

function solveArm(
  sk: Skeleton3,
  s: Side,
  goal: ArmGoal,
  L: Limb,
  rep: SolveReport,
  held: (n: string, o: number) => void
) {
  const sign = SIDE_SIGN[s];
  const chest = sk.i("thorax2");
  const cr = sk.rot[chest]!;
  const restInv = sk.restRot[chest]!.clone().invert();
  const toChest = (v: V) =>
    v.clone().applyQuaternion(restInv).applyQuaternion(cr);
  const fwd = toChest(V3(1, 0, 0)),
    up = toChest(V3(0, 1, 0)),
    lat = toChest(V3(0, 0, sign));
  // Girdle: from the arm's direction (shoulder to wrist), the scapulohumeral rhythm.
  sk.carryTree(L.clav);
  const shoulder0 = sk.pos[L.hum]!.clone();
  const d = goal.wrist.clone().sub(shoulder0).normalize();
  const elev = Math.acos(clamp(-d.dot(up), -1, 1)) / D2R; // 0 hanging, 90 level, 180 overhead
  const forward = d.dot(fwd);
  // Scapulohumeral rhythm, shared between the collarbone (it lifts, about a third of the girdle's part) and the shoulder
  // blade (it rotates upwards and tilts back); together about a third of the arm's elevation above 30°.
  const girdle = clamp((elev - 30) / 150, 0, 1);
  const upward = 40 * girdle;
  const tilt = 16 * girdle;
  const lift = 20 * girdle + (goal.shrug ?? 0);
  const reach =
    (forward > 0 ? forward * Math.sin(elev * D2R) * 14 : forward * 16) +
    (goal.reach ?? 0);
  const elevAxis = fwd.clone().multiplyScalar(-sign);
  const protAxis = up.clone().multiplyScalar(sign);
  sk.turn(
    L.clav,
    axisAngle(protAxis, clamp(reach, -20, 22)).multiply(
      axisAngle(elevAxis, clamp(lift, -8, 28))
    )
  );
  sk.carryTree(L.scap);
  // Upward rotation turns the shoulder blade in its own plane (about 30° forward of the back's plane), so its lower
  // corner slides round the ribcage instead of lifting off it.
  // (The blade's plane faces forward and in, about 30° from the back's plane: its normal is 0.87·forward + 0.5·medial.)
  const scapAxis = fwd
    .clone()
    .multiplyScalar(0.87)
    .addScaledVector(lat, -0.5)
    .multiplyScalar(-sign)
    .normalize();
  // (Posterior tilt: the blade's lower corner presses forward onto the ribs.)
  sk.turn(
    L.scap,
    axisAngle(scapAxis, upward).multiply(
      axisAngle(lat.clone().multiplyScalar(sign), -tilt)
    )
  );
  sk.carryTree(L.hum);
  const S = sk.pos[L.hum]!.clone();

  // Geometry in the humerus's frame: elbow, then the wrist as a function of elbow flexion and pronation.
  const hingeH = L.elbowHinge; // humerus local
  const e = sk.offset[L.ulna]!;
  const wristIn = (theta: number, phi: number) => {
    // wrist in ulna local: radius origin + rotated radius frame · hand offset
    const radRot = sk.restLocal[L.rad]!.clone().multiply(
      axisAngle(V3(0, 1, 0), L.pronSign * phi)
    );
    const w = sk.offset[L.hand]!.clone()
      .applyQuaternion(radRot)
      .add(sk.offset[L.rad]!);
    const ulnaRot = axisAngle(hingeH, L.elbowFlexSign * theta).multiply(
      sk.restLocal[L.ulna]!
    );
    return w.applyQuaternion(ulnaRot).add(e);
  };
  // The target can move: a hand on a round handle may roll round it (the wrist orbits the handle's axis).
  let target = goal.wrist.clone();
  let handGoal = goal.hand;
  let toT = target.clone().sub(S);
  let dist = toT.length();
  let tDir = toT.clone().normalize();
  const aim = (w: V, h: THREE.Quaternion | undefined) => {
    target = w;
    handGoal = h;
    toT = target.clone().sub(S);
    dist = toT.length();
    tDir = toT.clone().normalize();
  };

  let phi = clamp(goal.pronation ?? 90, RANGE.pronation[0], RANGE.pronation[1]);
  let theta = 0;
  let swivel = 0;
  const solveTheta = () => {
    // |wristIn(θ)| falls as θ grows: bisection.
    let lo: number = RANGE.elbow[0],
      hi: number = RANGE.elbow[1];
    if (wristIn(lo, phi).length() <= dist) return lo;
    if (wristIn(hi, phi).length() >= dist) return hi;
    for (let it = 0; it < 40; it++) {
      const mid = (lo + hi) / 2;
      if (wristIn(mid, phi).length() > dist) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  // The humerus rotation for an elbow angle, pronation and swivel (degrees about the shoulder→wrist line).
  const humRot = (theta: number, phi: number, swivelDeg: number) => {
    const carried = sk.carried(L.hum, Q());
    const v = wristIn(theta, phi).applyQuaternion(carried).normalize();
    const base = Q().setFromUnitVectors(v, tDir).multiply(carried);
    // Swivel so the elbow points along the pole.
    const el = e.clone().applyQuaternion(base);
    const ePerp = el.addScaledVector(tDir, -el.dot(tDir));
    const pole = goal.pole.clone().addScaledVector(tDir, -goal.pole.dot(tDir));
    let ang = 0;
    if (ePerp.lengthSq() > 1e-6 && pole.lengthSq() > 1e-6) {
      ePerp.normalize();
      pole.normalize();
      ang = Math.atan2(
        V3().crossVectors(ePerp, pole).dot(tDir),
        ePerp.dot(pole)
      );
    }
    return axisAngle(tDir, ang / D2R + swivelDeg).multiply(base);
  };
  const apply = (theta: number, phi: number, sw: number) => {
    sk.rot[L.hum]!.copy(humRot(theta, phi, sw));
    sk.place(L.ulna);
    sk.carried(L.ulna, sk.rot[L.ulna]!).multiply(
      axisAngle(
        hingeH.clone().applyQuaternion(sk.restLocal[L.ulna]!.clone().invert()),
        L.elbowFlexSign * theta
      )
    );
    sk.place(L.rad);
    sk.carried(L.rad, sk.rot[L.rad]!).multiply(
      axisAngle(V3(0, 1, 0), L.pronSign * phi)
    );
    sk.place(L.hand);
  };
  // What the hand needs from the forearm: the pronation that best turns it, and the wrist rotation left over.
  const handNeeds = () => {
    if (!handGoal) return { phi, wrist: Q(), over: 0 };
    // Radius at zero pronation.
    const rad0 = sk.carried(L.rad, Q());
    // hand = rad0 · Ry(sφ) · restLocal_hand · W  →  Ry(sφ) · (restLocal_hand · W · restLocal_hand⁻¹) = rad0⁻¹ · hand · restLocal_hand⁻¹
    const M = rad0
      .clone()
      .invert()
      .multiply(handGoal)
      .multiply(sk.restLocal[L.hand]!.clone().invert());
    const want = twistAbout(M, V3(0, 1, 0)) * L.pronSign;
    // Pronation wraps at ±180: take the turn within range closest to the wanted one.
    let best = want;
    for (const c of [want - 360, want, want + 360])
      if (
        Math.abs(clamp(c, RANGE.pronation[0], RANGE.pronation[1]) - c) <
        Math.abs(clamp(best, RANGE.pronation[0], RANGE.pronation[1]) - best)
      )
        best = c;
    const ph = clamp(best, RANGE.pronation[0], RANGE.pronation[1]);
    const rest = axisAngle(V3(0, 1, 0), -L.pronSign * ph).multiply(M);
    const W = sk.restLocal[L.hand]!.clone()
      .invert()
      .multiply(rest)
      .multiply(sk.restLocal[L.hand]!);
    return { phi: ph, wrist: W, over: Math.abs(best - ph) };
  };
  // Wrist limits: flexion about the hand's across axis, deviation about its palm axis (hand local).
  const handLocal = (w: V) =>
    w.clone().applyQuaternion(sk.restRot[L.hand]!.clone().invert());
  const flexAxis = handLocal(V3().crossVectors(L.long, L.palm)); // + bends the hand towards the palm
  // (+ deviates the hand towards the thumb on both sides: the axis long × across, whose sense the mirror flips with the
  // hand. The palm axis itself would give one hand the other's limits.)
  const devAxis = handLocal(V3().crossVectors(L.long, L.across));
  const wristLimit = (W: THREE.Quaternion) => {
    const e1 = new THREE.Euler();
    // Express W as flexion then deviation about those axes.
    const basis = new THREE.Matrix4().makeBasis(
      flexAxis,
      devAxis,
      V3().crossVectors(flexAxis, devAxis)
    );
    const bq = Q().setFromRotationMatrix(basis);
    const inB = bq.clone().invert().multiply(W).multiply(bq);
    e1.setFromQuaternion(inB, "XYZ");
    const fx = e1.x / D2R,
      dv = e1.y / D2R;
    const cf = clamp(fx, RANGE.wristFlex[0], RANGE.wristFlex[1]),
      cd = clamp(dv, RANGE.wristDev[0], RANGE.wristDev[1]);
    const over = Math.abs(fx - cf) + Math.abs(dv - cd) + Math.abs(e1.z / D2R);
    const out = bq
      .clone()
      .multiply(Q().setFromEuler(new THREE.Euler(cf * D2R, cd * D2R, 0, "XYZ")))
      .multiply(bq.clone().invert());
    return { q: out, over };
  };

  // Solve: elbow angle for the distance, then (holding something) the swivel that lets the forearm and wrist turn the
  // hand within their ranges, preferring the pole's own swivel and, from one frame to the next, the swivel it had (so
  // the arm never jumps between two equally good solutions). On a round handle, the hand's roll round it is searched
  // too (as a hand settles on a bar), preferring the roll it was given and, frame to frame, the one it had.
  const memo = lastSwivel.get(sk) ?? { R: null, L: null };
  lastSwivel.set(sk, memo);
  const rollMemo = lastRoll.get(sk) ?? { R: null, L: null };
  lastRoll.set(sk, rollMemo);
  const prev = memo[s];
  const prevRoll = rollMemo[s];
  const yawMemo = lastYaw.get(sk) ?? { R: null, L: null };
  lastYaw.set(sk, yawMemo);
  const prevYaw = yawMemo[s];
  const phiMemo = lastPhi.get(sk) ?? { R: null, L: null };
  lastPhi.set(sk, phiMemo);
  const humMemo = lastHum.get(sk) ?? { R: null, L: null };
  lastHum.set(sk, humMemo);
  /** Cost of the arm at a swivel (the elbow angle and pronation as they stand): what the forearm and wrist cannot turn,
   *  how far from the pole's swivel, and how far from the last frame's. */
  const costAt = (sw: number) => {
    apply(theta, phi, sw);
    const n = handNeeds();
    const wl = wristLimit(n.wrist);
    // Continuity is measured on the humerus's own rotation (well defined even for a straight arm, where a swivel is not)
    // and on the forearm's turn (a straight arm can turn the hand with either: the last frame's choice breaks the tie).
    const prevPhi = phiMemo[s];
    const prevHum = humMemo[s];
    const humStep = prevHum
      ? (2 * Math.acos(clamp(Math.abs(prevHum.dot(sk.rot[L.hum]!)), 0, 1))) /
        D2R
      : 0;
    return {
      cost:
        n.over * 2 +
        wl.over +
        Math.abs(sw) * 0.06 +
        // (Continuity costs the square of the change: small moves are nearly free, so the arm follows its best
        // solution without sticking where it was, which made the result depend on the frames before; large jumps
        // stay dear.)
        cont * (humStep * humStep * K_HUM + (prevPhi === null ? 0 : (n.phi - prevPhi) ** 2 * K_PHI)),
      phi: n.phi,
    };
  };
  // Continuity only chooses which family of solutions the arm stays in (as the target moves, the one it was in); the
  // pose itself is then settled on that family's own best, with continuity off, so it does not lag behind by an amount
  // that depends on the step from the last frame (the same motion solved at 30 or 60 frames a second agrees).
  let cont = 1;
  const descend = (x0: number, f: (x: number) => number, lim: number) => {
    let x = x0,
      best = f(x0);
    for (const step of [2, 1, 0.5, 0.25, 0.1])
      for (let it = 0; it < 20; it++) {
        let moved = false;
        for (const c of [x - step, x + step]) {
          if (Math.abs(c) > lim) continue;
          const v = f(c);
          if (v < best - 1e-9) [best, x, moved] = [v, c, true];
        }
        if (!moved) break;
      }
    return x;
  };
  /** Best swivel for the current target: a grid every 10° over ±110°, then refined; `exact`: then settled on its own
   *  best without continuity (see cont). */
  const search = (exact = false) => {
    theta = solveTheta();
    if (!handGoal) {
      apply(theta, phi, 0);
      return 0;
    }
    let best = { cost: Infinity, sw: 0, phi };
    const grid: number[] = [];
    for (let d = -110; d <= 110; d += 10) grid.push(d);
    if (prev !== null) grid.push(prev);
    for (const sw of grid) {
      const r = costAt(sw);
      if (r.cost < best.cost) best = { cost: r.cost, sw, phi: r.phi };
    }
    // (Refined to a tenth of a degree: a coarser answer steps from one grid value to the next as the target moves,
    // and the arm shivers.)
    for (const step of [5, 2.5, 1, 0.5, 0.25, 0.1])
      for (const sw of [best.sw - step, best.sw + step]) {
        if (Math.abs(sw) > 115) continue;
        const r = costAt(sw);
        if (r.cost < best.cost) best = { cost: r.cost, sw, phi: r.phi };
      }
    if (exact) {
      const was = cont;
      cont = 0;
      best.sw = descend(best.sw, (sw) => costAt(sw).cost, 115);
      best.phi = costAt(best.sw).phi;
      cont = was;
    }
    // The pronation found changes where the wrist sits a little: settle the elbow angle for it once.
    phi = best.phi;
    theta = solveTheta();
    const r = costAt(best.sw);
    swivel = best.sw;
    phi = r.phi;
    return r.cost;
  };
  const roll = goal.hand ? goal.roll : undefined;
  if (roll) {
    const hand0 = goal.hand!.clone();
    const wrist0 = goal.wrist.clone();
    // The palm's normal at the grip (world): the axis about which the handle may lie obliquely across the palm.
    const palm0 = L.palm
      .clone()
      .applyQuaternion(sk.restRot[L.hand]!.clone().invert())
      .applyQuaternion(hand0)
      .normalize();
    // The hand rolls round the handle by `d` and lies across it at `y` (a power grip holds a handle obliquely, from
    // the heel of the little finger to the root of the index, by as much as twenty degrees from the knuckles' line).
    const rotated = (d: number, y: number) => {
      const r = axisAngle(roll.axis, d).multiply(axisAngle(palm0, y));
      return {
        w: wrist0.clone().sub(roll.center).applyQuaternion(r).add(roll.center),
        h: r.clone().multiply(hand0),
      };
    };
    const range = roll.range ?? 50;
    const yawRange = roll.oblique ?? 20;
    const score = (d: number, y: number) => {
      const t = rotated(d, y);
      aim(t.w, t.h);
      return (
        search() +
        Math.abs(d) * 0.04 +
        cont * (prevRoll === null ? 0 : (d - prevRoll) ** 2 * K_ROLL) +
        Math.abs(y) * 0.06 +
        cont * (prevYaw === null ? 0 : (y - prevYaw) ** 2 * K_ROLL)
      );
    };
    const y0 = prevYaw !== null && Math.abs(prevYaw) <= yawRange ? prevYaw : 0;
    let best = { cost: Infinity, roll: 0, yaw: y0 };
    const grid: number[] = [];
    for (let d = -range; d <= range; d += 10) grid.push(d);
    if (prevRoll !== null && Math.abs(prevRoll) <= range) grid.push(prevRoll);
    for (const d of grid) {
      const c = score(d, y0);
      if (c < best.cost) best = { cost: c, roll: d, yaw: y0 };
    }
    if (yawRange > 0)
      for (let y = -yawRange; y <= yawRange; y += 10) {
        const c = score(best.roll, y);
        if (c < best.cost) best = { ...best, cost: c, yaw: y };
      }
    // (Refined in turn to a fraction of a degree, so the hand settles rather than stepping between grid values.)
    for (const step of [5, 2.5, 1.25, 0.6, 0.3, 0.15]) {
      for (const d of [best.roll - step, best.roll + step]) {
        if (Math.abs(d) > range) continue;
        const c = score(d, best.yaw);
        if (c < best.cost) best = { ...best, cost: c, roll: d };
      }
      if (yawRange > 0)
        for (const y of [best.yaw - step, best.yaw + step]) {
          if (Math.abs(y) > yawRange) continue;
          const c = score(best.roll, y);
          if (c < best.cost) best = { ...best, cost: c, yaw: y };
        }
    }
    // Then roll and lie settled on their own best, without continuity (see cont).
    {
      cont = 0;
      const exact = (d: number, y: number) => {
        const t = rotated(d, y);
        aim(t.w, t.h);
        return search(true) + Math.abs(d) * 0.04 + Math.abs(y) * 0.06;
      };
      best.roll = descend(best.roll, (d) => exact(d, best.yaw), range);
      if (yawRange > 0) best.yaw = descend(best.yaw, (y) => exact(best.roll, y), yawRange);
      cont = 1;
    }
    const t = rotated(best.roll, best.yaw);
    aim(t.w, t.h);
    search(true);
    rollMemo[s] = best.roll;
    yawMemo[s] = best.yaw;
  } else search(true);
  // (Remembered only from solves that hold something: the free-arm solves made to find the shoulders each frame must
  // not reset what the held arm had.)
  if (goal.hand) {
    memo[s] = swivel;
    phiMemo[s] = phi;
    humMemo[s] = sk.rot[L.hum]!.clone();
  }
  apply(theta, phi, swivel);
  // The hand.
  if (goal.hand) {
    const n = handNeeds();
    const wl = wristLimit(n.wrist);
    (
      trace.arm ?? (globalThis as { __armTrace?: typeof trace.arm }).__armTrace
    )?.(s, { swivel, phi: n.phi, theta, over: n.over, wristOver: wl.over });
    sk.rot[L.hand]!.copy(sk.carried(L.hand, Q()).multiply(wl.q));
    rep.handTurn[s] = angleOf(
      sk.rot[L.hand]!.clone().invert().multiply(handGoal!)
    );
    held(`pronation${s}`, n.over);
    held(`wrist${s}`, wl.over);
  } else {
    const f = clamp(
      goal.wristFlex ?? 0,
      RANGE.wristFlex[0],
      RANGE.wristFlex[1]
    );
    sk.rot[L.hand]!.copy(
      sk.carried(L.hand, Q()).multiply(axisAngle(flexAxis, f))
    );
  }
  rep.reach[`wrist${s}`] = sk.pos[L.hand]!.distanceTo(target);
  if (theta <= RANGE.elbow[0] + 0.01 && wristIn(0, phi).length() < dist - 0.5)
    held(`elbow${s}`, dist - wristIn(0, phi).length());
  // Fingers.
  poseFingers(sk, s, goal.grip ?? { kind: "relaxed" }, L, roll, goal.ball);
  // Armpit helper: at its point on the humerus, turned with the chest.
  const ax = sk.index.get(`axilla${s}`);
  if (ax !== undefined) {
    sk.point(L.hum, sk.restPos[ax]!, sk.pos[ax]!);
    sk.carried(ax, sk.rot[ax]!);
  }
}

/** Finger curls (MCP, PIP, DIP; degrees) and thumb (opposition, MCP, IP) for each grip. */
function curls(g: Grip): {
  mcp: number;
  pip: number;
  dip: number;
  spread: number;
  thumb: [number, number, number];
} {
  switch (g.kind) {
    case "blend": {
      const a = curls(g.from),
        b = curls(g.to),
        t = clamp(g.t, 0, 1);
      const mix = (x: number, y: number) => x + (y - x) * t;
      return {
        mcp: mix(a.mcp, b.mcp),
        pip: mix(a.pip, b.pip),
        dip: mix(a.dip, b.dip),
        spread: mix(a.spread, b.spread),
        thumb: [0, 1, 2].map((k) => mix(a.thumb[k]!, b.thumb[k]!)) as [number, number, number],
      };
    }
    case "wrap":
    case "hook": {
      // Smaller handles close the fingers further (a bar ~1.4 cm, a thick handle ~2.5 cm, a log handle ~2 cm).
      const k = clamp((g.radius - 1.2) / 2.8, 0, 1);
      const hook = g.kind === "hook" ? 1 : 0;
      return {
        mcp: 62 - 22 * k - 25 * hook,
        pip: 92 - 20 * k,
        dip: 55 - 15 * k,
        spread: 0,
        thumb: hook ? [10, 10, 10] : [55 - 15 * k, 30, 35 - 10 * k],
      };
    }
    case "fist":
      return { mcp: 80, pip: 100, dip: 60, spread: 0, thumb: [50, 40, 45] };
    case "open":
      return { mcp: 18, pip: 22, dip: 12, spread: 6, thumb: [20, 10, 10] };
    case "cup":
      // (Fingers curved round a ball held in both hands, close together, not spread open like a claw.)
      return { mcp: 40, pip: 42, dip: 22, spread: 1.5, thumb: [42, 22, 22] };
    case "flat":
      return { mcp: 2, pip: 4, dip: 2, spread: 4, thumb: [5, 0, 0] };
    default:
      return { mcp: 14, pip: 26, dip: 14, spread: 2, thumb: [15, 10, 10] };
  }
}

function poseFingers(sk: Skeleton3, s: Side, grip: Grip, L: Limb, handle?: { center: V; axis: V }, ball?: { center: V; radius: number }) {
  const c = curls(grip);
  const flexW = V3().crossVectors(L.long, L.palm).normalize(); // rest world: + curls towards the palm
  const spreadW = L.palm.clone();
  const local = (k: number, w: V) =>
    w.clone().applyQuaternion(sk.restRot[k]!.clone().invert());
  // Round a handle: each joint of each finger turns until the next joint (or the fingertip) lies on the handle's surface
  // (its radius plus the finger's half thickness), so the fingers wrap the handle they hold, whatever its size, and never
  // close through it.
  if ((grip.kind === "wrap" || grip.kind === "hook") && grip.radius > 0) {
    // (Round the handle itself when the hand holds one, else round where the hand's grip would put it.)
    const hand = sk.i(`hand${s}`);
    const C = handle ? handle.center.clone() : sk.point(hand, gripRest(sk, s, grip.radius));
    const A = handle ? handle.axis.clone().normalize() : sk.dir(hand, L.across).normalize();
    const J = sk.meta.joints[s];
    const off = V3(),
      tmp = V3();
    const dist = (p: V) => {
      off.copy(p).sub(C);
      return off.addScaledVector(A, -off.dot(A)).length();
    };
    const MAX = [95, 110, 85];
    // How far each finger fans out from the middle finger at rest (degrees about the palm's normal), undone in the fist.
    const adduct: Record<string, number> = {};
    {
      const mid = V3(...J.middle.tip).sub(V3(...J.middle.mcp));
      const n = spreadW.clone().normalize();
      const flat = (v: V) => v.addScaledVector(n, -v.dot(n)).normalize();
      const m = flat(mid);
      for (const f of FINGERS) {
        const d = flat(V3(...J[f].tip).sub(V3(...J[f].mcp)));
        // Signed angle from the finger to the middle finger's direction, about the palm normal.
        adduct[f] = (Math.atan2(V3().crossVectors(d, m).dot(n), d.dot(m)) / D2R) * 0.85;
      }
    }
    FINGERS.forEach((f) => {
      const R = grip.radius + (f === "little" ? 0.7 : 0.85);
      const ends = [J[f].pip, J[f].dip, J[f].tip];
      for (let j = 0; j < 3; j++) {
        const k = sk.i(`${f}${j + 1}${s}`);
        sk.place(k);
        const carried = sk.carried(k, Q());
        // (At the knuckle the fingers first close side by side, parallel to the middle finger, as they do in a fist.)
        if (j === 0) carried.multiply(axisAngle(local(k, spreadW), adduct[f]!));
        const axis = local(k, flexW);
        const end = V3(...ends[j]!);
        const at = (deg: number) => {
          sk.rot[k]!.copy(carried).multiply(axisAngle(axis, deg));
          return dist(sk.point(k, end, tmp));
        };
        // The first angle at which the segment's end reaches the surface (or, if it never does, the closest it comes).
        let lo = 0,
          hi = -1,
          best = 0,
          bestD = Infinity;
        for (let deg = 0; deg <= MAX[j]!; deg += 4) {
          const d = at(deg);
          if (d < bestD) [best, bestD] = [deg, d];
          if (d <= R) {
            hi = deg;
            break;
          }
          lo = deg;
        }
        let deg = best;
        if (hi >= 0) {
          for (let it = 0; it < 10; it++) {
            const mid = (lo + hi) / 2;
            if (at(mid) > R) lo = mid;
            else hi = mid;
          }
          deg = (lo + hi) / 2;
        }
        at(deg);
      }
    });
  } else {
    // On a ball the fingers take their shape but stop at its surface (a finger curls no further once its next joint
    // reaches the ball, plus the finger's half thickness).
    const J = sk.meta.joints[s];
    const surface = (p: V) => (ball ? p.distanceTo(ball.center) - (ball.radius + 0.8) : Infinity);
    FINGERS.forEach((f, n) => {
      const spread = (n - 1.5) * c.spread * SIDE_SIGN[s];
      const ends = [J[f].pip, J[f].dip, J[f].tip];
      [c.mcp, c.pip, c.dip].forEach((deg, j) => {
        const k = sk.i(`${f}${j + 1}${s}`);
        sk.place(k);
        const base = sk.carried(k, Q());
        if (j === 0 && spread) base.multiply(axisAngle(local(k, spreadW), spread));
        const set = (d: number) => {
          sk.rot[k]!.copy(base).multiply(axisAngle(local(k, flexW), d));
          return surface(sk.point(k, V3(...ends[j]!)));
        };
        let want = deg + (f === "little" && j === 0 ? 4 : 0);
        if (ball && set(want) < 0) {
          // The largest curl up to the shape's that keeps the joint outside the ball (none if it starts inside).
          let lo = 0,
            hi = want;
          if (set(0) < 0) want = 0;
          else {
            for (let it = 0; it < 12; it++) {
              const mid = (lo + hi) / 2;
              if (set(mid) < 0) hi = mid;
              else lo = mid;
            }
            want = lo;
          }
        }
        set(want);
      });
    });
  }
  // Thumb: opposition (towards the palm, across the fingers), then flexion of its two joints.
  const [opp, m, ip] = c.thumb;
  const t1 = sk.i(`thumb1${s}`),
    t2 = sk.i(`thumb2${s}`),
    t3 = sk.i(`thumb3${s}`);
  const thumb = (f: number) => {
    sk.place(t1);
    sk.rot[t1]!.copy(
      sk
        .carried(t1, Q())
        .multiply(axisAngle(local(t1, L.long), -SIDE_SIGN[s] * opp * 0.6 * f))
        .multiply(axisAngle(local(t1, flexW), opp * 0.5 * f))
    );
    for (const [k, deg] of [
      [t2, m],
      [t3, ip],
    ] as const) {
      sk.place(k);
      sk.rot[k]!.copy(
        sk.carried(k, Q()).multiply(axisAngle(local(k, flexW), deg * f))
      );
    }
  };
  thumb(1);
  // On a ball the thumb, like the fingers, closes only as far as the ball's surface.
  if (ball) {
    const J = sk.meta.joints[s];
    const inside = () =>
      Math.min(
        ...([
          [t1, J.thumb.mcp],
          [t2, J.thumb.ip],
          [t3, J.thumb.tip],
        ] as const).map(([k, p]) => sk.point(k, V3(...p)).distanceTo(ball.center) - (ball.radius + 0.8))
      ) < 0;
    if (inside()) {
      let lo = 0,
        hi = 1;
      thumb(0);
      if (!inside())
        for (let it = 0; it < 12; it++) {
          const mid = (lo + hi) / 2;
          thumb(mid);
          if (inside()) hi = mid;
          else lo = mid;
        }
      thumb(lo);
    }
  }
}

/** The knee's swivel at the last solve, per skeleton. */
const lastKnee = new WeakMap<Skeleton3, Record<Side, number | null>>();

function solveLeg(
  sk: Skeleton3,
  s: Side,
  goal: LegGoal,
  L: Limb,
  rep: SolveReport,
  held: (n: string, o: number) => void
) {
  sk.carryTree(L.thigh);
  const H = sk.pos[L.thigh]!.clone();
  const hinge = L.kneeHinge; // thigh local
  const k = sk.offset[L.shin]!;
  const ankleIn = (theta: number) => {
    const shinRot = axisAngle(hinge, L.kneeFlexSign * theta).multiply(
      sk.restLocal[L.shin]!
    );
    return sk.offset[L.foot]!.clone().applyQuaternion(shinRot).add(k);
  };
  const toT = goal.ankle.clone().sub(H);
  const dist = toT.length();
  const tDir = toT.clone().normalize();
  let lo: number = RANGE.knee[0],
    hi: number = RANGE.knee[1];
  let theta: number;
  if (ankleIn(lo).length() <= dist) theta = lo;
  else if (ankleIn(hi).length() >= dist) theta = hi;
  else {
    for (let it = 0; it < 40; it++) {
      const mid = (lo + hi) / 2;
      if (ankleIn(mid).length() > dist) lo = mid;
      else hi = mid;
    }
    theta = (lo + hi) / 2;
  }
  const carried = sk.carried(L.thigh, Q());
  const v = ankleIn(theta).applyQuaternion(carried).normalize();
  const base = Q().setFromUnitVectors(v, tDir).multiply(carried);
  const kn = k.clone().applyQuaternion(base);
  const kPerp = kn.addScaledVector(tDir, -kn.dot(tDir));
  const pole = goal.pole.clone().addScaledVector(tDir, -goal.pole.dot(tDir));
  let ang = 0;
  if (kPerp.lengthSq() > 1e-6 && pole.lengthSq() > 1e-6) {
    kPerp.normalize();
    pole.normalize();
    ang =
      Math.atan2(V3().crossVectors(kPerp, pole).dot(tDir), kPerp.dot(pole)) /
      D2R;
  }
  const ax = L.ankleHinge
    .clone()
    .applyQuaternion(sk.restLocal[L.foot]!.clone().invert())
    .normalize();
  const longAx = V3(0, 1, 0);
  // Places thigh and shin for a swivel (degrees about the hip→ankle line); returns the ankle's turn and what it could
  // not reach (degrees).
  const place = (sw: number) => {
    sk.rot[L.thigh]!.copy(axisAngle(tDir, sw).multiply(base));
    sk.place(L.shin);
    sk.carried(L.shin, sk.rot[L.shin]!).multiply(
      axisAngle(
        hinge.clone().applyQuaternion(sk.restLocal[L.shin]!.clone().invert()),
        L.kneeFlexSign * theta
      )
    );
    sk.place(L.foot);
    const footCarried = sk.carried(L.foot, Q());
    if (!goal.foot)
      return { foot: footCarried, over: 0, flex: 0, cf: 0, inv: 0, ci: 0 };
    const W = footCarried.clone().invert().multiply(goal.foot);
    const flex = twistAbout(W, ax);
    const cf = clamp(
      flex * L.ankleFlexSign,
      RANGE.ankleFlex[0],
      RANGE.ankleFlex[1]
    );
    const afterFlex = axisAngle(ax, -L.ankleFlexSign * cf).multiply(W);
    const inv = twistAbout(afterFlex, longAx);
    const ci = clamp(inv, RANGE.ankleInv[0], RANGE.ankleInv[1]);
    const foot = footCarried
      .multiply(axisAngle(ax, L.ankleFlexSign * cf))
      .multiply(axisAngle(longAx, ci));
    // What is left: the turn between the foot we can make and the one asked for.
    return {
      foot,
      over: angleOf(foot.clone().invert().multiply(goal.foot)),
      flex,
      cf,
      inv,
      ci,
    };
  };
  // The knee's swivel: the pole's, or (standing on a foot) the one that lets the shin carry the foot as it is asked to
  // stand, so the knee tracks over the toes; from frame to frame, close to the last one.
  let sw = ang;
  if (goal.foot) {
    const memo = lastKnee.get(sk) ?? { R: null, L: null };
    lastKnee.set(sk, memo);
    const prev = memo[s];
    let best = { cost: Infinity, sw: ang };
    const tries: number[] = [];
    for (let d = -60; d <= 60; d += 10) tries.push(ang + d);
    if (prev !== null) tries.push(prev - 3, prev, prev + 3);
    for (const t of tries) {
      const r = place(t);
      const cost =
        r.over +
        Math.abs(t - ang) * 0.05 +
        (prev === null ? 0 : Math.abs(t - prev) * 0.3);
      if (cost < best.cost) best = { cost, sw: t };
    }
    for (const step of [4, 2, 1]) {
      for (const t of [best.sw - step, best.sw + step]) {
        const r = place(t);
        const cost =
          r.over +
          Math.abs(t - ang) * 0.05 +
          (prev === null ? 0 : Math.abs(t - prev) * 0.3);
        if (cost < best.cost) best = { cost, sw: t };
      }
    }
    sw = best.sw;
    memo[s] = sw;
  }
  const r = place(sw);
  sk.rot[L.foot]!.copy(r.foot);
  if (goal.foot)
    held(
      `ankle${s}`,
      Math.abs(r.flex * L.ankleFlexSign - r.cf) + Math.abs(r.inv - r.ci)
    );
  rep.reach[`ankle${s}`] = sk.pos[L.foot]!.distanceTo(goal.ankle);
  if (theta <= 0.01 && ankleIn(0).length() < dist - 0.5)
    held(`knee${s}`, dist - ankleIn(0).length());
  // Kneecap: halfway between the thigh and the shin.
  sk.place(L.patella);
  sk.rot[L.patella]!.copy(
    sk
      .carried(L.patella, Q())
      .multiply(
        axisAngle(
          hinge
            .clone()
            .applyQuaternion(sk.restLocal[L.patella]!.clone().invert()),
          L.kneeFlexSign * theta * 0.5
        )
      )
  );
  // Toes.
  sk.place(L.toes);
  const tAx = L.ankleHinge
    .clone()
    .applyQuaternion(sk.restRot[L.shin]!)
    .applyQuaternion(sk.restRot[L.toes]!.clone().invert());
  sk.rot[L.toes]!.copy(
    sk
      .carried(L.toes, Q())
      .multiply(
        axisAngle(
          tAx,
          L.ankleFlexSign * clamp(goal.toes ?? 0, RANGE.toes[0], RANGE.toes[1])
        )
      )
  );
  void tmpQ;
}

/** Hip flexion (degrees, the thigh against the pelvis, in the pelvis's side view) the hip allows: with the knee bent,
 *  about 120° (the femur's neck nears the rim of the socket); with the knee straight, about 95°, since the hamstrings
 *  and gracilis cross the knee too and are then at their full length. A thigh drawn further up is eased into the limit
 *  over its last HIP_EASE degrees by tilting the pelvis back. */
const HIP_MAX_BENT = 122;
const HIP_MAX_STRAIGHT = 95;
const HIP_EASE = 22;

/** The pelvis's rotation for the goals: as asked, or tilted back about the hips (whose joints lie on its side axis) by
 *  as much as either thigh would pass its hip's range. Where the thighs go does not depend on that tilt, so they are
 *  placed once to measure it (the knees' frame-to-frame memory is left as it was). */
function pelvisForHips(sk: Skeleton3, g: PoseGoals, lim: Record<Side, Limb>): THREE.Quaternion {
  const pel = sk.i("pelvis");
  sk.pos[pel]!.copy(g.pelvis.pos);
  sk.rot[pel]!.copy(g.pelvis.rot);
  const turn = g.pelvis.rot.clone().multiply(sk.restRot[pel]!.clone().invert());
  const fwd = V3(1, 0, 0).applyQuaternion(turn);
  const down = V3(0, -1, 0).applyQuaternion(turn);
  const memo = lastKnee.get(sk);
  const kept = memo ? { ...memo } : null;
  const scratch: SolveReport = { reach: { wristR: 0, wristL: 0, ankleR: 0, ankleL: 0 }, handTurn: { R: 0, L: 0 }, limits: {} };
  let back = 0;
  for (const s of ["R", "L"] as const) {
    const L = lim[s];
    solveLeg(sk, s, g.legs[s], L, scratch, () => {});
    const thigh = sk.pos[L.shin]!.clone().sub(sk.pos[L.thigh]!);
    const shin = sk.pos[L.foot]!.clone().sub(sk.pos[L.shin]!);
    const flex = Math.atan2(thigh.dot(fwd), thigh.dot(down)) / D2R;
    const knee = thigh.angleTo(shin) / D2R;
    const max = HIP_MAX_STRAIGHT + (HIP_MAX_BENT - HIP_MAX_STRAIGHT) * clamp(knee / 90, 0, 1);
    const soft = max - HIP_EASE;
    if (flex > soft) back = Math.max(back, flex - (soft + HIP_EASE * Math.tanh((flex - soft) / HIP_EASE)));
  }
  if (kept) lastKnee.set(sk, kept);
  else lastKnee.delete(sk);
  return back > 0 ? axisAngle(V3(0, 0, 1).applyQuaternion(turn), back).multiply(g.pelvis.rot) : g.pelvis.rot;
}

/** A neutral standing pose's goals (rest pelvis, upright trunk and head, arms hanging, feet under the hips). */
export function restGoals(sk: Skeleton3): PoseGoals {
  const J = sk.meta.joints;
  const v = (a: readonly number[]) => V3(a[0], a[1], a[2]);
  return {
    pelvis: {
      pos: sk.restPos[sk.i("pelvis")]!.clone(),
      rot: sk.restRot[sk.i("pelvis")]!.clone(),
    },
    chest: sk.restRot[sk.i("thorax2")]!.clone(),
    head: sk.restRot[sk.i("head")]!.clone(),
    arms: {
      R: { wrist: v(J.R.wrist), pole: V3(-1, 0, 0.3), pronation: 0 },
      L: { wrist: v(J.L.wrist), pole: V3(-1, 0, -0.3), pronation: 0 },
    },
    legs: {
      R: { ankle: v(J.R.ankle), pole: V3(1, 0, 0.1) },
      L: { ankle: v(J.L.ankle), pole: V3(1, 0, -0.1) },
    },
  };
}
