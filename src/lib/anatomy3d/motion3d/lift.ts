import * as THREE from "three";
import type { Frame, Vec } from "../../exercise-motion/types";
import { SIDE_SIGN, type Side, type Skeleton3 } from "../body/skeleton";
import { restGoals, type PoseGoals } from "../body/solve";

/**
 * Lifts a frame of the reviewed 2D exercise motions (src/lib/exercise-motion) onto the anatomical skeleton.
 *
 * The 2D figure and the model differ a little in proportions, so nothing is copied as a position that the model's
 * own bones would then have to stretch to: the motion's segment directions and its explicit out-of-plane angles (the
 * `armD`, `foreD`, `legD` depth fields, in degrees) become 3D directions, and limbs are solved on the model's lengths.
 * Positions that matter are kept: the feet on the floor where the motion puts them, the pelvis's height, and the
 * equipment (placed by the exercise's spec, in rig space).
 *
 * Rig frame: centimetres, +X forward, +Y up, +Z the figure's right. 2D side view: x forward, the near (R) side towards
 * +Z. 2D front view: the figure faces the camera; screen right is the figure's left (-Z), depth is forward (+X).
 */

/** The 2D world (a 184 cm figure on 96.5 cm legs) scaled to the model's legs (95.1 cm to the hip joints). */
export const K = 95.1 / 96.5;
/** The model's ankle joint stands 6.9 cm above the soles; the 2D figure's 7.5 cm (scaled). */
const ANKLE_DROP = 7.5 * K - 6.9;
/** The 2D foot's toe line at rest, from the ball (degrees up). */
const TOE_REST = (Math.atan2(2, 4) * 180) / Math.PI;

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const rotZ = (deg: number) => new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), deg * D2R);
const rotX = (deg: number) => new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), deg * D2R);
const rotY = (deg: number) => new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), deg * D2R);
/** Lean of a 2D segment from vertical, degrees (+ towards +x). */
const lean = (a: Vec, b: Vec) => Math.atan2(b[0] - a[0], b[1] - a[1]) / D2R;

export interface LiftOptions {
  /** Plane-space x of the motion's centre (taken off so the figure stands near the origin). */
  centerX: number;
  /** Feet this far from the midline (cm) with the toes turned out this many degrees. */
  stance?: { halfWidth: number; toeOut: number } | null;
}

export interface Lifted {
  goals: PoseGoals;
  /** A free arm's 3D directions (world): upper arm and forearm, from the motion. */
  armDirs: Record<Side, { upper: THREE.Vector3; fore: THREE.Vector3 }>;
  /** Maps a 2D point (and an across / depth offset) to rig space. */
  to3: (v: Vec, off?: number) => THREE.Vector3;
}

export function lift(sk: Skeleton3, f: Frame, o: LiftOptions): Lifted {
  const g = restGoals(sk);
  const p = f.pts;
  const pose = f.pose;
  const restPel = sk.restRot[sk.i("pelvis")]!;
  const restChest = sk.restRot[sk.i("thorax2")]!;
  const restHead = sk.restRot[sk.i("head")]!;
  const J = sk.meta.joints;
  const armDirs = {} as Lifted["armDirs"];
  if (f.view === "side") {
    const to3 = (v: Vec, z = 0) => V3((v[0] - o.centerX) * K, v[1] * K, z);
    const pel = to3(p.pelvis);
    const trunk = lean(p.pelvis, p.mid);
    const chest = lean(p.mid, p.neckBase);
    const head = lean(p.head, p.headTop);
    g.pelvis = { pos: pel, rot: rotZ(-trunk * 0.7).multiply(restPel) };
    g.chest = rotZ(-chest).multiply(restChest);
    g.head = rotZ(-head).multiply(restHead);
    for (const s of ["R", "L"] as const) {
      const sign = SIDE_SIGN[s];
      // Legs: the ankle where the motion puts it, the knee towards the motion's knee (and a little out, over the toes).
      const half = o.stance?.halfWidth ?? Math.abs(J[s].ankle[2]);
      const ankle = to3(p[`ankle${s}`], sign * half);
      ankle.y -= ANKLE_DROP;
      const hip = to3(p.pelvis);
      const knee2 = to3(p[`knee${s}`]);
      const mid = hip.clone().add(ankle).multiplyScalar(0.5);
      const pole = V3(knee2.x - mid.x, knee2.y - mid.y, 0);
      if (pole.lengthSq() < 1) pole.set(1, 0, 0);
      pole.normalize();
      pole.z = sign * (o.stance ? 0.35 + o.stance.halfWidth / 60 : 0.15);
      // Foot: pitched as the motion's heel→ball line, turned out by the stance.
      const pitch = lean([0, 0], [p[`ball${s}`][1] - p[`heel${s}`][1], p[`ball${s}`][0] - p[`heel${s}`][0]]);
      const toeOut = (o.stance?.toeOut ?? 6) - 6;
      const foot = rotY(-sign * toeOut).multiply(rotZ(pitch)).multiply(sk.restRot[sk.i(`foot${s}`)]!);
      // (The 2D figure's toes are drawn turned up about 27° at rest; only bending beyond that is the toes bending.)
      const toeBend = lean([0, 0], [p[`toe${s}`][1] - p[`ball${s}`][1], p[`toe${s}`][0] - p[`ball${s}`][0]]) - pitch - TOE_REST;
      g.legs[s] = { ankle, pole, foot, toes: Math.max(0, toeBend) };
      // Arms: the motion's segment directions in the plane, turned out of it by the depth angles (+ outwards).
      const dir = (a: Vec, b: Vec, depthDeg: number) => {
        const d = V3(b[0] - a[0], b[1] - a[1], 0);
        if (d.lengthSq() < 1e-6) d.set(0, -1, 0);
        d.normalize();
        const c = Math.cos(depthDeg * D2R);
        return V3(d.x * c, d.y * c, sign * Math.sin(depthDeg * D2R)).normalize();
      };
      armDirs[s] = {
        upper: dir(p.shoulder, p[`elbow${s}`], pose[`armD${s}`]),
        fore: dir(p[`elbow${s}`], p[`hand${s}`], pose[`foreD${s}`]),
      };
    }
    return { goals: g, armDirs, to3 };
  }
  // Front view.
  const to3 = (v: Vec, depth = 0) => V3(depth, v[1] * K, -(v[0] - o.centerX) * K);
  const side = lean(p.pelvis, p.mid); // + towards screen right = the figure's left
  const sideChest = lean(p.mid, p.neckBase);
  const sideHead = lean(p.head, p.headTop);
  const fwd = pose.trunkD;
  g.pelvis = { pos: to3(p.pelvis), rot: rotZ(-fwd * 0.6).multiply(rotX(-side * 0.8)).multiply(restPel) };
  g.chest = rotZ(-fwd).multiply(rotX(-sideChest)).multiply(restChest);
  g.head = rotZ(-fwd * 0.5).multiply(rotX(-sideHead)).multiply(restHead);
  for (const s of ["R", "L"] as const) {
    const sign = SIDE_SIGN[s];
    const ankle = to3(p[`ankle${s}`]);
    ankle.y -= ANKLE_DROP;
    // The knee comes forward by what the thigh's foreshortening hides.
    const hip = to3(p[`hip${s}`]);
    const knee2 = to3(p[`knee${s}`]);
    const thigh2 = knee2.distanceTo(hip);
    const L = 45.4;
    const forward = Math.sqrt(Math.max(0, L * L - thigh2 * thigh2)) * (Math.sign(pose[`legD${s}`]) || 1);
    const mid = hip.clone().add(ankle).multiplyScalar(0.5);
    const pole = V3(Math.max(0.2, forward / L), 0, knee2.z - mid.z).normalize();
    const footYaw = sign * 4;
    g.legs[s] = { ankle, pole, foot: rotY(-footYaw).multiply(sk.restRot[sk.i(`foot${s}`)]!) };
    const dir = (a: Vec, b: Vec, depthDeg: number) => {
      const d = V3(0, b[1] - a[1], -(b[0] - a[0]));
      if (d.lengthSq() < 1e-6) d.set(0, -1, 0);
      d.normalize();
      const c = Math.cos(depthDeg * D2R);
      return V3(Math.sin(depthDeg * D2R), d.y * c, d.z * c).normalize();
    };
    armDirs[s] = {
      upper: dir(p[`shoulder${s}`], p[`elbow${s}`], pose[`armD${s}`]),
      fore: dir(p[`elbow${s}`], p[`hand${s}`], pose[`foreD${s}`]),
    };
  }
  return { goals: g, armDirs, to3 };
}
