import * as THREE from "three";
import { compileMotion, evaluate, getMotion } from "../../exercise-motion";
import type { ExerciseMeta, Frame } from "../../exercise-motion/types";
import { SIDE_SIGN, type Side, type Skeleton3 } from "../body/skeleton";
import { gripOn, gripRest, handAxes, handRotation, solvePose, type ArmGoal, type Grip, type PoseGoals, type SolveReport } from "../body/solve";
import type { Handle, Piece } from "./apparatus";
import { K, lift, type Lifted } from "./lift";

/**
 * Performs an exercise on the anatomical skeleton: every frame, the body's goals (from the reviewed 2D motion, lifted,
 * or from the exercise's own 3D keyframes), the equipment's pose, and the hands on their handles, then one solve.
 *
 * An exercise's spec (specs.ts) says what equipment it uses and how: which handle each hand holds and with which
 * grip, where the equipment is each frame, and anything the 2D motion cannot say (a trunk that turns, a ball that
 * leaves the hands). Hands that hold nothing follow the motion's own arm directions on the model's arm lengths.
 */
export interface Ctx {
  sk: Skeleton3;
  /** The 2D frame (lifted motions) or null (3D-authored motions). */
  f: Frame | null;
  t: number;
  T: number;
  /** 0..1 through the loop. */
  phase: number;
  goals: PoseGoals;
  lifted: Lifted | null;
  /** Solves the body as the goals stand (to read where the shoulders are). */
  presolve(): void;
  /** Shoulder joint (rig), after `presolve`. */
  gh(s: Side): THREE.Vector3;
  /** The chest's frame (rig): forward, up, the figure's right. */
  chestAxes(): { fwd: THREE.Vector3; up: THREE.Vector3; right: THREE.Vector3 };
  /** A free arm as the motion moves it: wrist and grip point (rig) on the model's arm. */
  freeArm(s: Side): { wrist: THREE.Vector3; grip: THREE.Vector3; elbow: THREE.Vector3 };
  /** A free arm's grip point moved across to `z` (rig), at the same distance from its shoulder (the arm keeps its
   *  bend when a bar holds the hands at a set width). */
  freeAt(s: Side, z: number): THREE.Vector3;
  /** Puts a hand on a handle: power grip with the thumb side towards `thumb`. */
  hold(s: Side, h: Handle, thumb: THREE.Vector3, grip?: Grip, pole?: THREE.Vector3, elbow?: THREE.Vector3): void;
  /** Puts a palm flat on a round surface (a ball, a stone): the contact point is `center + normal·radius`, the fingers
   *  pointing along `fingers`. With `contact: false` the hand only takes that shape (a ball already thrown): it is not
   *  counted as touching anything. */
  palm(s: Side, center: THREE.Vector3, normal: THREE.Vector3, radius: number, fingers: THREE.Vector3, grip?: Grip, o?: { contact?: boolean }): void;
  /** Brings a point within reach of the given hands' shoulders (cm short of a straight arm), moving it towards the
   *  shoulders. */
  reachable(p: THREE.Vector3, sides: Side[], margin?: number, o?: { offsets?: Partial<Record<Side, THREE.Vector3>>; minBend?: number }): THREE.Vector3;
  /** A point given as an offset from the middle of the shoulders, in the world's axes. */
  fromShoulders(off: readonly [number, number, number]): THREE.Vector3;
  /** A free hand with this pronation (degrees; 90 thumb forward) and grip, following the motion. */
  free(s: Side, pronation: number, grip?: Grip, wristFlex?: number): void;
  /** The arm's full reach from the shoulder joint to the wrist (cm). */
  armReach(s: Side): number;
  /** The exercise's equipment (as the spec built it). */
  pieces: Piece[];
}

export interface Spec {
  /** Equipment, built once (rig space). */
  build?(sk: Skeleton3): Piece[];
  /** Feet apart and turned out (lifted motions). */
  stance?: { halfWidth: number; toeOut: number };
  /** A 3D-authored body (replaces the lifted motion): duration and goals at a phase. */
  body?: { duration: number; goals(c: Ctx): void };
  /** Per frame, before the final solve: equipment and hands. */
  frame(c: Ctx, pieces: Piece[]): void;
  /** After the solve: pieces carried by the hands. */
  after?(c: Ctx, pieces: Piece[]): void;
  /** Distance travelled per loop along +X (carries, sprints), for the camera. */
  travel?: number;
}

export interface Performer {
  readonly duration: number;
  readonly group: THREE.Group;
  readonly pieces: Piece[];
  readonly view: "side" | "front";
  /** Poses the skeleton and the equipment at time t; returns the solve report. */
  pose(t: number): SolveReport;
  /** The hands' grip points and their handles at the last pose (for the contact checks). */
  contacts(): { side: Side; gap: number; turn: number }[];
}

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function makePerformer(sk: Skeleton3, ex: ExerciseMeta, spec: Spec): Performer {
  const def = getMotion(ex.slug, ex);
  const motion = compileMotion(def);
  const first = evaluate(motion, 0);
  const centerX = first.pts.pelvis[0];
  const pieces = spec.build?.(sk) ?? [];
  const group = new THREE.Group();
  for (const p of pieces) group.add(p.obj);
  const T = spec.body?.duration ?? motion.duration;
  const J = sk.meta.joints;
  const len = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
  const L1 = { R: len(J.R.shoulder, J.R.elbow), L: len(J.L.shoulder, J.L.elbow) };
  const L2 = { R: len(J.R.elbow, J.R.wrist), L: len(J.L.elbow, J.L.wrist) };
  let report: SolveReport = { reach: { wristR: 0, wristL: 0, ankleR: 0, ankleL: 0 }, handTurn: { R: 0, L: 0 }, limits: {} };
  type Hold =
    | { kind: "grip"; h: Handle; thumb: THREE.Vector3; grip: Grip; pole?: THREE.Vector3; from?: THREE.Vector3 }
    | { kind: "palm"; center: THREE.Vector3; normal: THREE.Vector3; radius: number; fingers: THREE.Vector3; grip: Grip; from?: THREE.Vector3; contact: boolean };
  const holds: Partial<Record<Side, Hold>> = {};
  const defaultPole = (s: Side, c: { fwd: THREE.Vector3; up: THREE.Vector3; right: THREE.Vector3 }) =>
    c.fwd.clone().multiplyScalar(-0.5).addScaledVector(c.up, -0.6).addScaledVector(c.right, SIDE_SIGN[s] * 0.6).normalize();

  const pose = (t: number): SolveReport => {
    const time = ((t % T) + T) % T;
    const f = spec.body ? null : evaluate(motion, time);
    const lifted = f ? lift(sk, f, { centerX, stance: spec.stance ?? null }) : null;
    const goals: PoseGoals = lifted ? lifted.goals : (null as unknown as PoseGoals);
    for (const s of ["R", "L"] as const) delete holds[s];
    const c: Ctx = {
      sk,
      f,
      t: time,
      T,
      phase: time / T,
      goals,
      lifted,
      presolve() {
        solvePose(sk, c.goals);
      },
      gh: (s) => sk.pos[sk.i(`humerus${s}`)]!.clone(),
      chestAxes() {
        const q = sk.rot[sk.i("thorax2")]!.clone().multiply(sk.restRot[sk.i("thorax2")]!.clone().invert());
        return { fwd: V3(1, 0, 0).applyQuaternion(q), up: V3(0, 1, 0).applyQuaternion(q), right: V3(0, 0, 1).applyQuaternion(q) };
      },
      freeArm(s) {
        const gh = c.gh(s);
        const d = lifted?.armDirs[s] ?? { upper: V3(0, -1, 0), fore: V3(0, -1, 0) };
        const elbow = gh.clone().addScaledVector(d.upper, L1[s]);
        const wrist = elbow.clone().addScaledVector(d.fore, L2[s]);
        return { elbow, wrist, grip: wrist.clone().addScaledVector(d.fore, 7) };
      },
      freeAt(s, z) {
        const gh = c.gh(s);
        const g = c.freeArm(s).grip;
        // The reach the motion's own elbow angle gives on the model's arm (a straight arm stays straight).
        // (No more than the model's elbow can fold.)
        const el = f ? (Math.min(140, f.pose[`el${s}`]) * Math.PI) / 180 : 0;
        const fore = L2[s] + 7;
        const d = f ? Math.sqrt(L1[s] * L1[s] + fore * fore + 2 * L1[s] * fore * Math.cos(el)) : g.distanceTo(gh);
        const dx = g.x - gh.x, dz = z - gh.z;
        const h2 = d * d - dx * dx - dz * dz;
        const out = g.clone().setZ(z);
        if (h2 > 0) out.y = gh.y + Math.sign(g.y - gh.y || 1) * Math.sqrt(h2);
        return out;
      },
      hold(s, h, thumb, grip, pole, elbow) {
        holds[s] = { kind: "grip", h, thumb, grip: grip ?? { kind: "wrap", radius: h.radius }, pole, from: elbow };
      },
      palm(s, center, normal, radius, fingers, grip, o) {
        holds[s] = { kind: "palm", center, normal: normal.clone().normalize(), radius, fingers, grip: grip ?? { kind: "cup" }, contact: o?.contact ?? true };
      },
      reachable(p, sides, margin = 4, o = {}) {
        // Each hand's point (the object's point plus that hand's offset on it) is kept within the arm's reach, and
        // (with minBend) no nearer than the elbow can fold to.
        const out = p.clone();
        for (let it = 0; it < 6; it++)
          for (const s of sides) {
            const gh = c.gh(s);
            const off = o.offsets?.[s] ?? V3();
            const fore = L2[s] + 7;
            const max = L1[s] + fore - margin;
            const bend = ((o.minBend ?? 180) * Math.PI) / 180;
            const min = Math.sqrt(L1[s] * L1[s] + fore * fore + 2 * L1[s] * fore * Math.cos(bend));
            const hand = out.clone().add(off);
            const d = hand.distanceTo(gh);
            if (d > max) out.add(gh.clone().sub(hand).multiplyScalar(1 - max / d));
            else if (d < min && d > 1e-3) out.add(hand.clone().sub(gh).multiplyScalar(min / d - 1));
          }
        return out;
      },
      fromShoulders(off) {
        return c.gh("R").add(c.gh("L")).multiplyScalar(0.5).add(V3(off[0], off[1], off[2]));
      },
      free(s, pronation, grip, wristFlex) {
        const a = c.freeArm(s);
        const mid = c.gh(s).add(a.wrist).multiplyScalar(0.5);
        const pole = a.elbow.clone().sub(mid);
        const ax = c.chestAxes();
        // (A straight arm's elbow direction is undefined: lean on the usual one, back, down and out.)
        pole.normalize().multiplyScalar(Math.min(1, pole.length() / 3)).add(defaultPole(s, ax).multiplyScalar(0.35));
        c.goals.arms[s] = { wrist: a.wrist, pole, pronation, grip: grip ?? { kind: "relaxed" }, wristFlex };
      },
      armReach: (s) => L1[s] + L2[s],
      pieces,
    };
    if (spec.body) {
      spec.body.goals(c);
    }
    // The shoulders' girdle follows the arms, so before the shoulders are read the arms must already be where the body
    // is: the arms' resting goals carried with the pelvis (they are given in the rest frame), then, once the shoulders
    // are found, the motion's own free arms, and the shoulders found again from those.
    {
      const pel = sk.i("pelvis");
      const turn = c.goals.pelvis.rot.clone().multiply(sk.restRot[pel]!.clone().invert());
      for (const s of ["R", "L"] as const) {
        const a = c.goals.arms[s];
        a.wrist = a.wrist.clone().sub(sk.restPos[pel]!).applyQuaternion(turn).add(c.goals.pelvis.pos);
        a.pole = a.pole.clone().applyQuaternion(turn);
      }
    }
    c.presolve();
    for (const s of ["R", "L"] as const) c.free(s, 90);
    c.presolve();
    // Hands on handles: the hand's roll round its handle is aimed along the forearm, from where the motion puts the
    // elbow (smooth from frame to frame), or for 3D-authored motions from the spec's elbow hint.
    const holdGoal = (s: Side, from: THREE.Vector3, ax: ReturnType<Ctx["chestAxes"]>): ArmGoal => {
      const hd = holds[s]!;
      if (hd.kind === "palm") {
        const g = palmOn(sk, s, hd.center, hd.normal, hd.radius, hd.fingers);
        // (A palm on a ball may turn about the point it touches, to suit the wrist.)
        const at = hd.center.clone().addScaledVector(hd.normal, hd.radius);
        return { wrist: g.wrist, hand: g.hand, pole: c.goals.arms[s].pole ?? defaultPole(s, ax), grip: hd.grip, roll: { center: at, axis: hd.normal, range: 70, oblique: 0 } };
      }
      const g = gripOn(sk, s, hd.h, hd.thumb, from, hd.h.radius);
      // (Round handles: the hand may roll round the handle to suit the arm.)
      return { wrist: g.wrist, hand: g.hand, pole: hd.pole ?? c.goals.arms[s].pole ?? defaultPole(s, ax), grip: hd.grip, roll: { center: hd.h.at, axis: hd.h.axis, range: 55 } };
    };
    const solveHolds = () => {
      const ax = c.chestAxes();
      for (const s of ["R", "L"] as const) {
        const hd = holds[s];
        if (!hd) continue;
        const target = hd.kind === "grip" ? hd.h.at : hd.center;
        const from = hd.from ?? (lifted ? c.freeArm(s).elbow : c.gh(s).lerp(target, 0.45).addScaledVector(hd.kind === "grip" && hd.pole ? hd.pole.clone().normalize() : defaultPole(s, ax), 12));
        c.goals.arms[s] = holdGoal(s, from, ax);
      }
      report = { reach: { wristR: 0, wristL: 0, ankleR: 0, ankleL: 0 }, handTurn: { R: 0, L: 0 }, limits: {} };
      solvePose(sk, c.goals, report);
    };
    // Hands follow the motion unless the spec holds something.
    for (const s of ["R", "L"] as const) c.free(s, 90);
    spec.frame(c, pieces);
    // Twice when holding something: the shoulders move with the arms (the girdle follows them), so the equipment the
    // spec placed from the shoulders is placed again from where they end up.
    if (holds.R || holds.L) {
      solveHolds();
      for (const s of ["R", "L"] as const) {
        delete holds[s];
        c.free(s, 90);
      }
      spec.frame(c, pieces);
    }
    solveHolds();
    spec.after?.(c, pieces);
    for (const p of pieces) p.obj.updateMatrixWorld(true);
    lastHolds = { ...holds };
    return report;
  };
  let lastHolds: typeof holds = {};
  const performer: Performer = {
    duration: T,
    group,
    pieces,
    view: def.view,
    pose,
    contacts() {
      return (["R", "L"] as const)
        .filter((s) => lastHolds[s] && !(lastHolds[s]!.kind === "palm" && !(lastHolds[s] as { contact: boolean }).contact))
        .map((s) => {
          const hd = lastHolds[s]!;
          if (hd.kind === "palm") return { side: s, gap: Math.abs(palmPoint(sk, s).distanceTo(hd.center) - hd.radius), turn: report.handTurn[s] };
          // Distance from the centre of the hand's grip to the handle's axis line, and past the handle's grip point
          // along it (cm).
          const d = gripPoint(sk, s, hd.h.radius).sub(hd.h.at);
          const along = d.dot(hd.h.axis);
          const gap = d.addScaledVector(hd.h.axis, -along).length();
          return { side: s, gap: gap + Math.max(0, Math.abs(along) - 1), turn: report.handTurn[s] };
        });
    },
  };
  void K;
  return performer;
}

/** Where the middle of a power grip is in the hand now (rig). */
export function gripPoint(sk: Skeleton3, s: Side, radius: number): THREE.Vector3 {
  return sk.point(sk.i(`hand${s}`), gripRest(sk, s, radius));
}

/** The hand's axes now (rig): long (wrist to knuckles), across (little finger to index), palm (out of the palm). */
export function handNow(sk: Skeleton3, s: Side): { long: THREE.Vector3; across: THREE.Vector3; palm: THREE.Vector3 } {
  const a = handAxes(sk, s);
  const k = sk.i(`hand${s}`);
  return { long: sk.dir(k, a.long), across: sk.dir(k, a.across), palm: sk.dir(k, a.palm) };
}

/** Places a piece so its "grip" handle sits in the hand's power grip (handle along the hand's across axis). */
export function placeInHand(sk: Skeleton3, s: Side, piece: Piece, radius: number, roll = 0): void {
  const hand = sk.i(`hand${s}`);
  const at = sk.point(hand, gripRest(sk, s, radius));
  const n = handNow(sk, s);
  // Piece frame: local Z along the hand's across axis (the handle), local Y along the hand's long axis turned by roll.
  const z = n.across.clone().normalize();
  const y = n.long.clone().applyAxisAngle(z, roll).normalize();
  const x = V3().crossVectors(y, z).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y.clone().crossVectors(z, x), z));
  const g = piece.local.grip ?? piece.local.R;
  piece.place(at.clone().sub(g!.at.clone().applyQuaternion(q)), q);
}

/** Where the middle of the palm's skin is now (rig). */
export function palmPoint(sk: Skeleton3, s: Side): THREE.Vector3 {
  const J = sk.meta.joints[s];
  const a = handAxes(sk, s);
  const rest = V3(...J.wrist).lerp(V3(...J.middle.mcp), 0.55).addScaledVector(a.palm, 1.2);
  return sk.point(sk.i(`hand${s}`), rest);
}

/** Wrist and hand pose that put the palm on a round surface at `center + normal·radius`, fingers along `fingers`. */
export function palmOn(sk: Skeleton3, s: Side, center: THREE.Vector3, normal: THREE.Vector3, radius: number, fingers: THREE.Vector3): { wrist: THREE.Vector3; hand: THREE.Quaternion } {
  const J = sk.meta.joints[s];
  const a = handAxes(sk, s);
  const palm = normal.clone().normalize().negate();
  const long = fingers.clone().addScaledVector(palm, -fingers.dot(palm)).normalize();
  const across = V3().crossVectors(long, palm).multiplyScalar(SIDE_SIGN[s]).normalize();
  const hand = handRotation(sk, s, long, across);
  const restPalm = V3(...J.wrist).lerp(V3(...J.middle.mcp), 0.55).addScaledVector(a.palm, 1.2);
  const local = restPalm.sub(V3(...J.wrist)).applyQuaternion(sk.restRot[sk.i(`hand${s}`)]!.clone().invert());
  const contact = center.clone().addScaledVector(normal.clone().normalize(), radius);
  return { wrist: contact.sub(local.applyQuaternion(hand)), hand };
}
