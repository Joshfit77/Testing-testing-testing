import { BODY, applyLimbIK, forwardKinematics, lerp, lerpV, type Skeleton } from "./skeleton";
import type { Anchor, Ease, Frame, Keyframe, Landmark, MotionDef, Pose, PoseKey, ResolvedProp, RootRule, Vec, View } from "./types";

export interface CompiledMotion {
  def: MotionDef;
  starts: number[];
  duration: number;
}

export function compileMotion(def: MotionDef): CompiledMotion {
  const starts: number[] = [];
  let t = 0;
  for (const k of def.keyframes) {
    starts.push(t);
    t += (k.hold ?? 0) + k.dur;
  }
  return { def, starts, duration: t };
}

const EASE: Record<Exclude<Ease, "spline">, (u: number) => number> = {
  linear: (u) => u,
  in: (u) => u * u,
  out: (u) => 1 - (1 - u) * (1 - u),
  inOut: (u) => 0.5 - 0.5 * Math.cos(Math.PI * u),
};

const POSE_KEYS = [
  "trunk",
  "spine",
  "neck",
  "hipL",
  "hipR",
  "kneeL",
  "kneeR",
  "ankleL",
  "ankleR",
  "shL",
  "shR",
  "elL",
  "elR",
  "armDL",
  "armDR",
  "foreDL",
  "foreDR",
  "legDL",
  "legDR",
  "shinDL",
  "shinDR",
] as const satisfies readonly PoseKey[];

function lerpPose(a: Pose, b: Pose, w: number): Pose {
  const out = { ...a };
  for (const k of POSE_KEYS) out[k] = lerp(a[k], b[k], w);
  return out;
}

function splinePose(p0: Pose, p1: Pose, p2: Pose, p3: Pose, u: number): Pose {
  const out = { ...p1 };
  const u2 = u * u;
  const u3 = u2 * u;
  for (const k of POSE_KEYS) {
    const a = p0[k];
    const b = p1[k];
    const c = p2[k];
    const d = p3[k];
    out[k] = 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  }
  return out;
}

/** Points that may touch the floor, with their thickness. */
const CONTACTS_SIDE: [Landmark, number][] = [
  ["heelL", 0],
  ["heelR", 0],
  ["ballL", 0],
  ["ballR", 0],
  ["toeL", 0],
  ["toeR", 0],
  ["kneeCapL", 0],
  ["kneeCapR", 0],
  ["handL", BODY.r.hand],
  ["handR", BODY.r.hand],
  ["elbowPadL", 0],
  ["elbowPadR", 0],
  ["forearmL", 0],
  ["forearmR", 0],
  ["butt", 0],
  ["upperBack", 0],
  ["lowBack", 0],
  ["chest", 0],
  ["belly", 0],
  ["head", BODY.r.hand + 7],
  ["shinL", 0],
  ["shinR", 0],
  ["thighL", 6.5],
  ["thighR", 6.5],
];
const CONTACTS_FRONT: [Landmark, number][] = [
  ["soleL", 0],
  ["soleR", 0],
  ["ankleL", 4],
  ["ankleR", 4],
  ["handL", BODY.r.hand],
  ["handR", BODY.r.hand],
  ["elbowL", BODY.r.elbow],
  ["elbowR", BODY.r.elbow],
  ["kneeL", BODY.r.knee],
  ["kneeR", BODY.r.knee],
  ["pelvis", 9],
  ["mid", 10],
  ["shoulderL", 6],
  ["shoulderR", 6],
  ["head", BODY.r.hand + 7],
];

export function lowestContact(sk: Skeleton, view: View): number {
  let m = Infinity;
  for (const [lm, r] of view === "side" ? CONTACTS_SIDE : CONTACTS_FRONT) m = Math.min(m, sk.pts[lm][1] - r);
  return m;
}

function rootOffset(rule: RootRule, sk0: Skeleton, view: View): Vec {
  if ("pin" in rule) {
    const p = sk0.pts[rule.pin];
    return [rule.at[0] - p[0], rule.at[1] - p[1]];
  }
  const p = sk0.pts.pelvis;
  return [rule.ground - p[0], (rule.lift ?? 0) - lowestContact(sk0, view)];
}

export function resolveAnchor(a: Anchor, sk: Skeleton, shift = 0): Vec {
  if (Array.isArray(a)) return [a[0] + shift, a[1]];
  const p = sk.pts[a.lm];
  return [p[0] + (a.dx ?? 0), a.y ?? p[1] + (a.dy ?? 0)];
}

const LIMB_KEYS: Record<"handL" | "handR" | "footL" | "footR", PoseKey[]> = {
  handL: ["shL", "elL"],
  handR: ["shR", "elR"],
  footL: ["hipL", "kneeL", "ankleL"],
  footR: ["hipR", "kneeR", "ankleR"],
};

export interface EvalOptions {
  /** Skip the floor-penetration clamp (used by the tests to detect bad poses). */
  noClamp?: boolean;
}

/** Compute the frame at time `t` seconds (wrapped to the loop). */
export function evaluate(c: CompiledMotion, time: number, opts: EvalOptions = {}): Frame {
  const { def } = c;
  const kfs = def.keyframes;
  const n = kfs.length;
  const T = c.duration;
  const t = ((time % T) + T) % T;
  let i = n - 1;
  for (let j = 0; j < n; j++) {
    const next = j + 1 < n ? c.starts[j + 1]! : T;
    if (t < next) {
      i = j;
      break;
    }
  }
  const A = kfs[i]!;
  const B = kfs[(i + 1) % n]!;
  const wrap = i === n - 1;
  const travel = def.travel ?? 0;
  const local = t - c.starts[i]!;
  const hold = A.hold ?? 0;
  const u = local < hold ? 0 : Math.min(1, (local - hold) / Math.max(1e-6, A.dur));
  const ease = A.ease ?? "inOut";
  const w = ease === "spline" ? u : EASE[ease](u);

  let pose: Pose;
  if (ease === "spline") {
    const P0 = kfs[(i - 1 + n) % n]!.pose;
    const P3 = kfs[(i + 2) % n]!.pose;
    pose = splinePose(P0, A.pose, B.pose, P3, u);
  } else {
    pose = lerpPose(A.pose, B.pose, w);
  }

  // Knees never hyperextend (spline overshoot guard).
  if (pose.kneeL < 0) pose.kneeL = 0;
  if (pose.kneeR < 0) pose.kneeR = 0;
  const view = def.view;
  const sk0 = forwardKinematics(pose, view);
  const oA = rootOffset(A.root, sk0, view);
  const oB = rootOffset(B.root, sk0, view);
  if (wrap) oB[0] += travel;
  let offset = lerpV(oA, oB, w);
  let sk = forwardKinematics(pose, view, offset);

  // Inverse kinematics for limbs pinned to targets.
  const limbs = new Set([...Object.keys(A.ik ?? {}), ...Object.keys(B.ik ?? {})]) as Set<keyof NonNullable<Keyframe["ik"]>>;
  if (limbs.size) {
    let p2 = pose;
    for (const limb of limbs) {
      const ta = A.ik?.[limb];
      const tb = B.ik?.[limb];
      if (ta && tb) {
        const target = lerpV(resolveAnchor(ta, sk), resolveAnchor(tb, sk, wrap ? travel : 0), w);
        p2 = applyLimbIK(p2, view, sk, limb, target);
      } else {
        const anchor = (ta ?? tb)!;
        const solved = applyLimbIK(p2, view, sk, limb, resolveAnchor(anchor, sk, tb && wrap ? travel : 0));
        const k = ta ? 1 - w : w;
        const next = { ...p2 };
        for (const key of LIMB_KEYS[limb]) next[key] = lerp(p2[key], solved[key], k);
        p2 = next;
      }
    }
    pose = p2;
    sk = forwardKinematics(pose, view, offset);
  }

  let lifted = 0;
  if (!opts.noClamp) {
    // Feet and hands slide along the floor instead of passing through it (only that limb moves).
    if (view === "side") {
      const pinned = (rule: RootRule) => ("pin" in rule ? rule.pin : "");
      // A limb counts as pinned only when both keyframes pin it (mid-blend it is free to be corrected).
      const footPinned = (s: "L" | "R") => [pinned(A.root), pinned(B.root)].every((p) => /^(heel|ball|toe|sole|ankle|shin|kneeCap)/.test(p) && p.endsWith(s));
      let changed = false;
      for (const s of ["L", "R"] as const) {
        const low = Math.min(sk.pts[`heel${s}`][1], sk.pts[`ball${s}`][1], sk.pts[`toe${s}`][1]);
        const isPinned = footPinned(s);
        if (low < -0.5 && !isPinned) {
          const a = sk.pts[`ankle${s}`];
          pose = applyLimbIK(pose, view, sk, `foot${s}`, [a[0], a[1] - low]);
          changed = true;
        }
        const h = sk.pts[`hand${s}`][1] - BODY.r.hand;
        if (h < -0.5 && !(pinned(A.root) === `hand${s}` && pinned(B.root) === `hand${s}`)) {
          const hp = sk.pts[`hand${s}`];
          pose = applyLimbIK(pose, view, sk, `hand${s}`, [hp[0], hp[1] - h]);
          changed = true;
        }
      }
      if (changed) sk = forwardKinematics(pose, view, offset);
    }
    const low = lowestContact(sk, view);
    if (low < -0.01) {
      lifted = -low;
      offset = [offset[0], offset[1] - low];
      sk = forwardKinematics(pose, view, offset);
    }
  }

  const props: ResolvedProp[] = (def.props ?? []).map((pd) => {
    const a1 = A.props?.[pd.id] ?? pd.at;
    const b1 = B.props?.[pd.id] ?? pd.at;
    const pa = resolveAnchor(a1, sk);
    const pb = resolveAnchor(b1, sk, wrap && Array.isArray(b1) && b1 !== pd.at ? travel : 0);
    const at = a1 === b1 ? pa : lerpV(pa, pb, w);
    return { def: pd, at, to: pd.to ? resolveAnchor(pd.to, sk) : undefined };
  });

  return {
    view,
    pose,
    pts: sk.pts,
    seg: sk.seg,
    props,
    alpha: lerp(A.alpha ?? 1, B.alpha ?? 1, w),
    cameraX: travel * (t / T),
    lifted,
  };
}

/** The frame used for still images (reduced motion, thumbnails). */
export function stillFrame(c: CompiledMotion): Frame {
  return evaluate(c, (c.def.stillPhase ?? 0.5) * c.duration);
}

/** World-space bounds of the figure and its equipment over the loop (relative to the camera). */
export function motionBounds(c: CompiledMotion, samples = 48): { x0: number; x1: number; y0: number; y1: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = 0;
  let y1 = -Infinity;
  for (let s = 0; s < samples; s++) {
    const f = evaluate(c, (s / samples) * c.duration);
    const pts: Vec[] = Object.values(f.pts);
    for (const p of pts) {
      x0 = Math.min(x0, p[0] - f.cameraX - 12);
      x1 = Math.max(x1, p[0] - f.cameraX + 12);
      y1 = Math.max(y1, p[1] + 14);
      y0 = Math.min(y0, p[1] - 4);
    }
    for (const pr of f.props) {
      const b = propExtent(pr);
      if (!b) continue;
      x0 = Math.min(x0, b[0] - f.cameraX);
      x1 = Math.max(x1, b[2] - f.cameraX);
      y0 = Math.min(y0, b[1]);
      y1 = Math.max(y1, b[3]);
    }
  }
  return { x0, x1, y0, y1 };
}

/** Rough extent of a prop for framing: [x0, y0, x1, y1] or null to ignore (very large scenery). */
function propExtent(p: ResolvedProp): [number, number, number, number] | null {
  const { def, at } = p;
  const s = def.size ?? 0;
  switch (def.kind) {
    case "wall":
    case "cableTower":
    case "rack":
    case "pullupBar":
    case "mat":
    case "ladder":
    case "hurdleLine":
    case "cable":
    case "band":
    case "rope":
    case "battleRope":
      return null;
    case "barbell":
    case "plate":
    case "log":
    case "stone": {
      const r = s || 22.5;
      return [at[0] - r, at[1] - r, at[0] + r, at[1] + r];
    }
    default: {
      const w = def.w ?? 30;
      const h = def.h ?? 30;
      return [at[0] - w / 2, at[1] - 2, at[0] + w / 2, at[1] + h];
    }
  }
}

/** Utility for tests / previews: sample the loop at `n` evenly spaced times. */
export function sampleFrames(c: CompiledMotion, n: number, opts?: EvalOptions): Frame[] {
  return Array.from({ length: n }, (_, k) => evaluate(c, (k / n) * c.duration, opts));
}

