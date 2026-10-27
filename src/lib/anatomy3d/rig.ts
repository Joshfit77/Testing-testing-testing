import * as THREE from "three";
import type { Frame, Vec } from "../exercise-motion/types";
import { bindVersion, HALF, LIMB } from "./bind";
import { bindFrames, frameMatrix, type BoneFrame } from "./mesh";
import { BONES, type BoneName } from "./muscle-ids";

/**
 * Poses the 3D athlete from a frame of the keyframed motion engine (src/lib/exercise-motion). The motions are authored
 * in one plane (side or front view) with "depth" fields for limbs that point out of that plane; here every joint is
 * lifted into 3D: in-plane positions come straight from the frame (so the 3D athlete matches the reviewed technique
 * exactly when seen from the motion's own camera), and each limb's out-of-plane offset is recovered from its known
 * length. Bones then swing from their rest direction with the smallest rotation, so joints bend naturally.
 *
 * World axes: +X forward (side-view motions face +X), +Y up, +Z the athlete's right.
 */
export interface Joints3 {
  pelvis: THREE.Vector3;
  mid: THREE.Vector3;
  neck: THREE.Vector3;
  neckTop: THREE.Vector3;
  head: THREE.Vector3;
  headTop: THREE.Vector3;
  R: Limbs;
  L: Limbs;
}
interface Limbs {
  shoulder: THREE.Vector3;
  elbow: THREE.Vector3;
  hand: THREE.Vector3;
  hip: THREE.Vector3;
  knee: THREE.Vector3;
  ankle: THREE.Vector3;
  heel: THREE.Vector3;
  ball: THREE.Vector3;
  toe: THREE.Vector3;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Recovers the out-of-plane part of a limb of known length from its in-plane offset. */
function outOfPlane(len: number, dx: number, dy: number): number {
  return Math.sqrt(Math.max(0, len * len - dx * dx - dy * dy));
}

/** How the hands meet the equipment: on a bar at this half-width (cm from the midline), or free. */
export interface RigOptions {
  centerX?: number;
  barGrip?: number | null;
  /** Feet this far from the midline (cm) with the toes turned out this many degrees, e.g. a squat stance. */
  stance?: { halfWidth: number; toeOut: number } | null;
}

/** Two-bone IK: the middle joint for a chain root→end with lengths a, b, bending towards `pole`. */
export function solveTwoBone(root: THREE.Vector3, end: THREE.Vector3, a: number, b: number, pole: THREE.Vector3): THREE.Vector3 {
  const d = end.clone().sub(root);
  const dist = Math.min(Math.max(d.length(), 1e-3), a + b - 1e-3);
  const dir = d.normalize();
  const along = (a * a - b * b + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const p = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (p.lengthSq() < 1e-8) p.set(0, 0, 1).addScaledVector(dir, -dir.z);
  p.normalize();
  return root.clone().addScaledVector(dir, along).addScaledVector(p, h);
}

export function jointsFromFrame(f: Frame, opts: RigOptions | number = {}): Joints3 {
  const o: RigOptions = typeof opts === "number" ? { centerX: opts } : opts;
  const centerX = o.centerX ?? 0;
  const p = f.pts;
  const pose = f.pose;
  if (f.view === "side") {
    // In-plane: x forward, y up. Out of plane: z (athlete's right toward the viewer).
    const P = (v: Vec, z = 0) => V(v[0] - centerX, v[1], z);
    const limbs = (side: 1 | -1, s: "R" | "L"): Limbs => {
      const sh = P(p.shoulder, side * HALF.shoulder);
      const e2 = p[`elbow${s}`];
      const h2 = p[`hand${s}`];
      // Hand: on the bar at the grip width, or free (its out-of-plane offset recovered from the arm's foreshortening).
      const dirA = Math.sign(pose[`armD${s}`]) || 1;
      const dirF = Math.sign(pose[`foreD${s}`]) || 1;
      const ez0 = sh.z + side * dirA * outOfPlane(LIMB.upperArm, e2[0] - p.shoulder[0], e2[1] - p.shoulder[1]);
      const hzFree = ez0 + side * dirF * outOfPlane(LIMB.forearm, h2[0] - e2[0], h2[1] - e2[1]);
      const hz = o.barGrip ? side * o.barGrip : side * Math.min(Math.max(side * hzFree, 6), 70);
      const hand = P(h2, hz);
      // Elbow: bend towards where the motion puts it, flaring slightly outwards.
      const mid = sh.clone().add(hand).multiplyScalar(0.5);
      const pole = P(e2, 0).sub(V(mid.x, mid.y, 0));
      pole.z = side * (o.barGrip ? 9 : 4);
      const elbow = solveTwoBone(sh, hand, LIMB.upperArm, LIMB.forearm, pole);
      // Leg: ankle from the frame, knee by IK towards the motion's knee (tracking slightly out over the toes).
      const hip = P(p.pelvis, side * HALF.hip);
      const k2 = p[`knee${s}`];
      const dirL = Math.sign(pose[`legD${s}`]) || 1;
      const kz = hip.z + side * dirL * outOfPlane(LIMB.thigh, k2[0] - p.pelvis[0], k2[1] - p.pelvis[1]);
      const az = o.stance ? side * o.stance.halfWidth : side * Math.max(side * kz * 0.85 + 0.15 * HALF.hip, HALF.hip - 1);
      const ankle = P(p[`ankle${s}`], az);
      const kPole = P(k2, 0).sub(V((p.pelvis[0] + p[`ankle${s}`][0]) / 2 - centerX, (p.pelvis[1] + p[`ankle${s}`][1]) / 2, 0));
      // Knees track out over the toes.
      kPole.z = o.stance ? side * (6 + o.stance.halfWidth * 0.35) : side * 3 + (kz - az) * 0.5;
      const knee = solveTwoBone(hip, ankle, LIMB.thigh, LIMB.shin, kPole);
      // Feet: turned out about the ankle.
      const turn = ((o.stance?.toeOut ?? 0) * Math.PI) / 180;
      const foot = (v: Vec, extra: number) => {
        const q = P(v, az + side * extra).sub(ankle);
        return ankle.clone().add(V(q.x * Math.cos(turn), q.y, q.z + side * q.x * Math.sin(turn)));
      };
      return {
        shoulder: sh,
        elbow,
        hand,
        hip,
        knee,
        ankle,
        heel: foot(p[`heel${s}`], 0),
        ball: foot(p[`ball${s}`], 1.2),
        toe: foot(p[`toe${s}`], 1.6),
      };
    };
    return {
      pelvis: P(p.pelvis),
      mid: P(p.mid),
      neck: P(p.neckBase),
      ...headJoints(P(p.head), P(p.headTop), P(p.foreheadFront)),
      R: limbs(1, "R"),
      L: limbs(-1, "L"),
    };
  }
  // Front view: in-plane x is the athlete's left-right (their left on screen right), y up; out of plane is forward.
  const F = (v: Vec, x = 0) => V(x, v[1], -(v[0] - centerX));
  const lean = Math.sign(pose.trunkD) || 1;
  const pelvis = F(p.pelvis);
  const midX = pelvis.x + lean * outOfPlane(LIMB.lumbar, p.mid[0] - p.pelvis[0], p.mid[1] - p.pelvis[1]);
  const neckX = midX + lean * outOfPlane(LIMB.thorax, p.neckBase[0] - p.mid[0], p.neckBase[1] - p.mid[1]);
  const limbs = (s: "R" | "L"): Limbs => {
    const sh = F(p[`shoulder${s}`], neckX - 1.5);
    const e2 = p[`elbow${s}`];
    const h2 = p[`hand${s}`];
    const ex = sh.x + (Math.sign(pose[`armD${s}`]) || 1) * outOfPlane(LIMB.upperArm, e2[0] - p[`shoulder${s}`][0], e2[1] - p[`shoulder${s}`][1]);
    const hx = ex + (Math.sign(pose[`foreD${s}`]) || 1) * outOfPlane(LIMB.forearm, h2[0] - e2[0], h2[1] - e2[1]);
    const hip = F(p[`hip${s}`], pelvis.x);
    const k2 = p[`knee${s}`];
    const kx = hip.x + (Math.sign(pose[`legD${s}`]) || 1) * outOfPlane(LIMB.thigh, k2[0] - p[`hip${s}`][0], k2[1] - p[`hip${s}`][1]);
    const a2 = p[`ankle${s}`];
    const ax = kx - (Math.sign(pose[`shinD${s}`]) || 1) * outOfPlane(LIMB.shin, a2[0] - k2[0], a2[1] - k2[1]) * 0.6;
    const ankle = F(a2, ax);
    const soleY = Math.min(p[`heel${s}`][1], p[`ball${s}`][1]);
    return {
      shoulder: sh,
      elbow: F(e2, ex),
      hand: F(h2, hx),
      hip,
      knee: F(k2, kx),
      ankle,
      heel: V(ankle.x - 6, soleY, ankle.z),
      ball: V(ankle.x + 18, soleY, ankle.z),
      toe: V(ankle.x + 22, soleY + 0.6, ankle.z),
    };
  };
  const neck = F(p.neckBase, neckX);
  return {
    pelvis,
    mid: F(p.mid, midX),
    neck,
    ...headJoints(F(p.head, neckX + 1.5), F(p.headTop, neckX + 1.5), null),
    R: limbs("R"),
    L: limbs("L"),
  };
}

function headJoints(head: THREE.Vector3, headTop: THREE.Vector3, forehead: THREE.Vector3 | null) {
  const up = headTop.clone().sub(head).normalize();
  const fwd = forehead ? forehead.clone().sub(head).normalize() : V(1, 0, 0);
  const neckTop = head.clone().addScaledVector(up, -(LIMB.headR - 1)).addScaledVector(fwd, -1.5);
  return { head, headTop: head.clone().addScaledVector(up, LIMB.headR), neckTop };
}

// ---------------------------------------------------------------- bone frames

/** Rest rotation and length of each bone (limbs stretch along their axis to the motion's segment lengths), rebuilt
 *  when the asset in use brings its own joints. */
let restCache: { version: number; rot: Record<BoneName, THREE.Quaternion>; len: Record<BoneName, number> } | null = null;
function rest() {
  if (restCache?.version !== bindVersion) {
    const frames = bindFrames();
    restCache = {
      version: bindVersion,
      rot: Object.fromEntries(BONES.map((b) => [b, new THREE.Quaternion().setFromRotationMatrix(frameMatrix(frames[b]))])) as Record<BoneName, THREE.Quaternion>,
      len: Object.fromEntries(BONES.map((b) => [b, Math.hypot(...frames[b].y)])) as Record<BoneName, number>,
    };
  }
  return restCache;
}
const STRETCH = new Set<BoneName>(["pelvis", "chest", "upperArmR", "foreArmR", "upperArmL", "foreArmL", "thighR", "shinR", "thighL", "shinL"]);
const PARENT: Partial<Record<BoneName, BoneName>> = {
  upperArmR: "chest",
  foreArmR: "upperArmR",
  handR: "foreArmR",
  upperArmL: "chest",
  foreArmL: "upperArmL",
  handL: "foreArmL",
  thighR: "pelvis",
  shinR: "thighR",
  footR: "shinR",
  thighL: "pelvis",
  shinL: "thighL",
  footL: "shinL",
};

const tmpQ = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();
const tmpS = new THREE.Vector3();

/** Sets every bone's world matrix for the given joints. */
export function poseBones(j: Joints3, bones: THREE.Bone[]): void {
  const rot: Partial<Record<BoneName, THREE.Quaternion>> = {};
  const pos: Partial<Record<BoneName, THREE.Vector3>> = {};
  const len: Partial<Record<BoneName, number>> = {};
  const right = j.R.hip.clone().sub(j.L.hip).normalize();
  const rightSh = j.R.shoulder.clone().sub(j.L.shoulder).normalize();
  const torso = (name: BoneName, origin: THREE.Vector3, to: THREE.Vector3, r: THREE.Vector3) => {
    const y = to.clone().sub(origin).normalize();
    const x = new THREE.Vector3().crossVectors(y, r).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    tmpM.makeBasis(x, y, z);
    rot[name] = new THREE.Quaternion().setFromRotationMatrix(tmpM);
    pos[name] = origin.clone();
    len[name] = to.distanceTo(origin);
  };
  torso("pelvis", j.pelvis, j.mid, right);
  torso("chest", j.mid, j.neck, rightSh);
  torso("neck", j.neck, j.neckTop, rightSh);
  torso("head", j.neckTop, j.headTop, rightSh);
  rot.clavR = rot.chest!.clone();
  rot.clavL = rot.chest!.clone();
  pos.clavR = j.neck.clone();
  pos.clavL = j.neck.clone();

  // Limbs: swing each bone from its rest direction (carried by the parent) to the new direction.
  const limb = (name: BoneName, origin: THREE.Vector3, to: THREE.Vector3) => {
    const parent = PARENT[name]!;
    const restInParent = rest().rot[parent].clone().invert().multiply(rest().rot[name]);
    const carried = rot[parent]!.clone().multiply(restInParent);
    const restDir = new THREE.Vector3(0, 1, 0).applyQuaternion(carried);
    const newDir = to.clone().sub(origin).normalize();
    tmpQ.setFromUnitVectors(restDir, newDir);
    rot[name] = tmpQ.clone().multiply(carried);
    pos[name] = origin.clone();
    len[name] = to.distanceTo(origin);
  };
  for (const s of ["R", "L"] as const) {
    const J = j[s];
    limb(`upperArm${s}`, J.shoulder, J.elbow);
    limb(`foreArm${s}`, J.elbow, J.hand);
    const fd = J.hand.clone().sub(J.elbow).normalize();
    limb(`hand${s}`, J.elbow.clone().addScaledVector(fd, 25), J.hand.clone().addScaledVector(fd, 5));
    limb(`thigh${s}`, J.hip, J.knee);
    limb(`shin${s}`, J.knee, J.ankle);
    limb(`foot${s}`, J.ankle, J.ball);
  }
  BONES.forEach((name, i) => {
    const b = bones[i]!;
    const stretch = STRETCH.has(name) && len[name] ? len[name]! / rest().len[name] : 1;
    b.matrix.compose(pos[name]!, rot[name]!, tmpS.set(1, stretch, 1));
    b.matrixWorld.copy(b.matrix);
  });
}

export type { BoneFrame };
