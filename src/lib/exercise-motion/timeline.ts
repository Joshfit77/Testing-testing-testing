import { BODY, applyLimbIK, forwardKinematics, lerp, lerpV, type Skeleton } from "./skeleton";
import type { Anchor, Ease, Frame, Keyframe, Landmark, MotionDef, Pose, PoseKey, ResolvedProp, RootRule, RunPath, Vec, View } from "./types";

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
  "trunkD",
] as const satisfies readonly PoseKey[];

function lerpPose(a: Pose, b: Pose, w: number): Pose {
  const out = { ...a };
  for (const k of POSE_KEYS) out[k] = lerp(a[k], b[k], w);
  return out;
}

/**
 * Smooth interpolation through the keyframes (cubic Hermite). Each keyframe's velocity is the slope between its
 * neighbours measured in seconds, so the motion keeps a continuous speed even when one phase is slower than the next
 * (a 2 s descent into a 1 s drive); a keyframe with a hold has zero velocity, so the body eases into and out of a pause
 * instead of snapping into motion. With equal durations and no holds this is the Catmull-Rom spline used before.
 */
function tangent(c: CompiledMotion, j: number, key: PoseKey): number {
  const kfs = c.def.keyframes;
  const n = kfs.length;
  const K = kfs[j]!;
  if ((K.hold ?? 0) > 0) return 0;
  const prev = kfs[(j - 1 + n) % n]!;
  const next = kfs[(j + 1) % n]!;
  return (next.pose[key] - prev.pose[key]) / Math.max(1e-6, prev.dur + K.dur);
}

function hermitePose(c: CompiledMotion, i: number, u: number): Pose {
  const kfs = c.def.keyframes;
  const n = kfs.length;
  const A = kfs[i]!;
  const B = kfs[(i + 1) % n]!;
  const out = { ...A.pose };
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  for (const k of POSE_KEYS) out[k] = h00 * A.pose[k] + h10 * A.dur * tangent(c, i, k) + h01 * B.pose[k] + h11 * A.dur * tangent(c, (i + 1) % n, k);
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

/** The keyframe segment and the interpolated (raw) pose at time `time`. */
function interpolate(c: CompiledMotion, time: number) {
  const kfs = c.def.keyframes;
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
  const local = t - c.starts[i]!;
  const hold = A.hold ?? 0;
  const u = local < hold ? 0 : Math.min(1, (local - hold) / Math.max(1e-6, A.dur));
  const ease = A.ease ?? "inOut";
  const w = ease === "spline" ? u : EASE[ease](u);
  const pose = ease === "spline" ? hermitePose(c, i, u) : lerpPose(A.pose, kfs[(i + 1) % n]!.pose, w);
  return { t, i, u, w, ease, pose };
}

/**
 * Where a travelling body is (pelvis x on the ground, and its lift off the floor) between two keyframes, on the same
 * smooth curve as the joints. Interpolating it in straight lines changed the body's speed abruptly at every keyframe: a
 * runner lurched forward and dropped onto each step. Null unless the keyframe and its neighbours all place the body by
 * ground position (gait), so pinned movements keep their exact contacts.
 */
function groundSpline(c: CompiledMotion, i: number, u: number): [number, number] | null {
  const kfs = c.def.keyframes;
  const n = kfs.length;
  const travel = c.def.travel ?? 0;
  const g = (j: number): [number, number] | null => {
    const r = kfs[((j % n) + n) % n]!.root;
    if (!("ground" in r)) return null;
    const lap = Math.floor(j / n);
    return [r.ground + lap * travel, r.lift ?? 0];
  };
  const dur = (j: number) => kfs[((j % n) + n) % n]!.dur;
  const p0 = g(i - 1);
  const p1 = g(i);
  const p2 = g(i + 1);
  const p3 = g(i + 2);
  if (!p0 || !p1 || !p2 || !p3) return null;
  const m1 = (dur(i - 1) + dur(i)) || 1;
  const m2 = (dur(i) + dur(i + 1)) || 1;
  const d = dur(i);
  const u2 = u * u;
  const u3 = u2 * u;
  const out: [number, number] = [0, 0];
  for (const k of [0, 1] as const) {
    const t1 = ((p2[k] - p0[k]) / m1) * d;
    const t2 = ((p3[k] - p1[k]) / m2) * d;
    out[k] = (2 * u3 - 3 * u2 + 1) * p1[k] + (u3 - 2 * u2 + u) * t1 + (-2 * u3 + 3 * u2) * p2[k] + (u3 - u2) * t2;
  }
  out[1] = Math.max(0, out[1]);
  return out;
}

const GRAVITY = 981; // cm/s²
const FOOT = 24; // heel → ball of a flat foot (as in trackSteps)

/**
 * Pelvis height of a runner at time `t` of the loop. Airborne between steps it follows a ballistic arc (gravity); on the
 * support foot it dips and rises again on one smooth curve that meets the arc with the same speed at touchdown and at
 * toe-off, so the runner never drops onto a step or stops dead.
 */
function runHeight(r: RunPath, T: number, t: number): number {
  const Ts = T / 2;
  const tf = Ts * (1 - r.stance);
  const ts = Ts * r.stance;
  const up = (r.land - r.push) / tf + (GRAVITY * tf) / 2; // launch speed at toe-off
  const down = up - GRAVITY * tf; // speed at touchdown
  const ph = ((t % Ts) + Ts) % Ts;
  if (ph >= ts) {
    const a = ph - ts;
    return r.push + up * a - (GRAVITY * a * a) / 2;
  }
  const u = ph / ts;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * r.land + (u3 - 2 * u2 + u) * down * ts + (-2 * u3 + 3 * u2) * r.push + (u3 - u2) * up * ts;
}

/** Seconds by which the head trails the torso, and (in travelling movements) the forearms trail the upper arms. */
const LAG_NECK = 0.07;
const LAG_ELBOW = 0.05;

/** Compute the frame at time `t` seconds (wrapped to the loop). */
export function evaluate(c: CompiledMotion, time: number, opts: EvalOptions = {}): Frame {
  const { def } = c;
  const kfs = def.keyframes;
  const n = kfs.length;
  const T = c.duration;
  const { t, i, u, w, ease, pose: raw } = interpolate(c, time);
  const A = kfs[i]!;
  const B = kfs[(i + 1) % n]!;
  const wrap = i === n - 1;
  const travel = def.travel ?? 0;

  let pose: Pose = { ...raw };
  // Follow-through: the head settles a moment after the torso moves; a runner's forearms swing a moment after the
  // upper arms. (Hands placed by inverse kinematics are re-solved below, so contacts are kept.)
  pose.neck = interpolate(c, time - LAG_NECK).pose.neck;
  if (travel) {
    const lag = interpolate(c, time - LAG_ELBOW).pose;
    pose.elL = lag.elL;
    pose.elR = lag.elR;
  }
  // Breathing: the chest rises and falls a little (a whole number of breaths per loop, so the loop stays seamless),
  // so a held position is never a frozen one.
  if (def.view === "side") {
    const breaths = Math.max(1, Math.round(T / 3.4));
    const b = Math.sin((2 * Math.PI * breaths * t) / T);
    pose.spine += 0.7 * b;
    pose.neck -= 0.45 * b;
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
  const gs = ease === "spline" && (A.hold ?? 0) === 0 ? groundSpline(c, i, u) : null;
  if (gs) offset = [gs[0] - sk0.pts.pelvis[0], gs[1] - lowestContact(sk0, view)];
  const run = def.run && view === "side" ? def.run : null;
  const x0 = kfs[0] && "ground" in kfs[0].root ? kfs[0].root.ground : 0;
  // Running: even forward speed and the smooth up-and-down path (see runHeight).
  const runOffset = (p: Pose, at: number): Vec => {
    const s0 = forwardKinematics(p, view);
    return [x0 + (travel * at) / T - s0.pts.pelvis[0], runHeight(run!, T, at) - s0.pts.pelvis[1]];
  };
  if (run) offset = runOffset(pose, t);
  let sk = forwardKinematics(pose, view, offset);
  if (run) {
    // The support foot stays where it landed: the leg reaches it (inverse kinematics) as the body passes over it.
    // The hold fades in over the last few hundredths of a second before touchdown and out after toe-off, so the foot
    // settles onto the floor and peels off it instead of jumping between where the stride table has it and the plant.
    const Ts = T / 2;
    const stanceT = Ts * run.stance;
    const fade = 0.1;
    const hold = (side: "L" | "R", land: number, k: number, onFloor: boolean) => {
      if (k <= 0) return;
      const atLand = interpolate(c, land % T).pose;
      const heel = forwardKinematics(atLand, view, runOffset(atLand, land)).pts[`heel${side}`][0];
      const h = sk.pts[`heel${side}`];
      const b = sk.pts[`ball${side}`];
      // The foot rolls from heel to ball: whichever is lower is on the floor, at its planted spot.
      const onHeel = h[1] <= b[1];
      const contact = onHeel ? h : b;
      const plant = onHeel ? heel : heel + FOOT;
      const a = sk.pts[`ankle${side}`];
      // While fading in or out only the foot's position along the floor is eased; it meets the floor on its own at
      // touchdown (the body is at landing height then) and leaves it on its own after toe-off.
      const dy = onFloor ? -contact[1] : Math.max(0, -contact[1]);
      pose = applyLimbIK(pose, view, sk, `foot${side}`, [a[0] + k * (plant - contact[0]), a[1] + dy]);
      sk = forwardKinematics(pose, view, offset);
    };
    const side = t < Ts ? "R" : "L";
    const land = side === "R" ? 0 : Ts;
    const since = t - land;
    hold(side, land, since < stanceT ? 1 : since < stanceT + fade ? 1 - EASE.inOut((since - stanceT) / fade) : 0, since < stanceT);
    const until = land + Ts - t;
    if (until < fade) hold(side === "R" ? "L" : "R", land + Ts, EASE.inOut(1 - until / fade), false);
  }

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
    // A layer change takes effect half-way between the keyframes.
    const layer = (w < 0.5 ? A : B).layers?.[pd.id];
    return { def: pd, at, to: pd.to ? resolveAnchor(pd.to, sk) : undefined, layer };
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
      if (def.kind === "barbell" && def.variant === "front") return [at[0] - 110, at[1] - r, at[0] + 110, at[1] + r];
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

