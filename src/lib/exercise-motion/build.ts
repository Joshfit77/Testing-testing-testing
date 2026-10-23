/**
 * Helpers for authoring motions: pose construction, small kinematic solvers used when generating keyframes,
 * and keyframe/timeline assembly. Everything here runs once when a motion is built, not per frame.
 */
import { BODY, ZERO_POSE, add, angleOf, cos, down, forwardKinematics, frontOf, len, normFlex, normShoulder, solveTwoBone, sub, up } from "./skeleton";
import { lowestContact } from "./timeline";
import type { Anchor, Ease, Keyframe, Landmark, MotionDef, Pose, PropDef, RootRule, Side, Vec, View } from "./types";

export const pose = (o: Partial<Pose> = {}): Pose => ({ ...ZERO_POSE, ...o });
export const mix = (a: Pose, b: Pose, t: number): Pose => {
  const out = { ...a };
  for (const k of Object.keys(a) as (keyof Pose)[]) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
};
export const both = (o: { hip?: number; knee?: number; ankle?: number; sh?: number; el?: number; armD?: number; foreD?: number; legD?: number }): Partial<Pose> => {
  const r: Partial<Pose> = {};
  if (o.hip !== undefined) r.hipL = r.hipR = o.hip;
  if (o.knee !== undefined) r.kneeL = r.kneeR = o.knee;
  if (o.ankle !== undefined) r.ankleL = r.ankleR = o.ankle;
  if (o.sh !== undefined) r.shL = r.shR = o.sh;
  if (o.el !== undefined) r.elL = r.elR = o.el;
  if (o.armD !== undefined) r.armDL = r.armDR = o.armD;
  if (o.foreD !== undefined) r.foreDL = r.foreDR = o.foreD;
  if (o.legD !== undefined) r.legDL = r.legDR = o.legD;
  return r;
};

export function lm(p: Pose, name: Landmark, view: View = "side"): Vec {
  return forwardKinematics(p, view).pts[name];
}

/** Rough whole-body centre of mass (side view), pelvis at the origin. */
export function centerOfMass(p: Pose, extra: { at: Vec; mass: number }[] = []): Vec {
  const sk = forwardKinematics(p, "side");
  const P = sk.pts;
  const mid = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const parts: [Vec, number][] = [
    [mid(P.pelvis, P.mid), 0.28],
    [mid(P.mid, P.neckBase), 0.22],
    [P.head, 0.08],
    [mid(P.pelvis, P.kneeL), 0.1],
    [mid(P.pelvis, P.kneeR), 0.1],
    [mid(P.kneeL, P.ankleL), 0.045],
    [mid(P.kneeR, P.ankleR), 0.045],
    [mid(P.shoulder, P.elbowL), 0.028],
    [mid(P.shoulder, P.elbowR), 0.028],
    [mid(P.elbowL, P.handL), 0.022],
    [mid(P.elbowR, P.handR), 0.022],
  ];
  let m = 0;
  let x = 0;
  let y = 0;
  for (const [c, w] of parts) {
    m += w;
    x += c[0] * w;
    y += c[1] * w;
  }
  for (const e of extra) {
    m += e.mass;
    x += e.at[0] * e.mass;
    y += e.at[1] * e.mass;
  }
  return [x / m, y / m];
}

/** Bisection for f(x) = 0 on [lo, hi]; falls back to the endpoint with the smaller |f|. */
export function solve1D(f: (x: number) => number, lo: number, hi: number, iters = 40): number {
  let a = lo;
  let b = hi;
  let fa = f(a);
  const fb = f(b);
  if (fa * fb > 0) return Math.abs(fa) < Math.abs(fb) ? a : b;
  for (let i = 0; i < iters; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fa * fm <= 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/**
 * Legs for a flat-footed stance with the shin leaning forward by `shinLean` and the knee bent `knee`,
 * keeping the trunk lean `trunk`. Both legs identical (side view).
 */
export function stanceLegs(shinLean: number, knee: number, trunk: number, sides: Side[] = ["L", "R"]): Partial<Pose> {
  const shinA = -shinLean;
  const thighA = shinA + knee;
  const r: Partial<Pose> = { trunk };
  for (const s of sides) {
    r[`hip${s}`] = thighA + trunk;
    r[`knee${s}`] = knee;
    r[`ankle${s}`] = shinLean;
  }
  return r;
}

/**
 * Solve the trunk lean so that a trunk landmark (or a custom point function) sits at a target x
 * relative to the midfoot (sole) — e.g. keep the bar over mid-foot. Legs keep their absolute angles.
 */
export function balanceTrunk(base: Pose, pointFn: (p: Pose) => Vec, targetX: number, lo = -20, hi = 95, foot: Side = "R"): Pose {
  const make = (T: number): Pose => {
    const d = T - base.trunk;
    return { ...base, trunk: T, hipL: base.hipL + d, hipR: base.hipR + d };
  };
  const T = solve1D((t) => {
    const p = make(t);
    const sole = lm(p, `sole${foot}`);
    return pointFn(p)[0] - sole[0] - targetX;
  }, lo, hi);
  return make(T);
}

/** Point in the upper-back frame relative to the shoulder: `fwd` along the chest normal, `upv` along the spine. */
export function shoulderLocal(p: Pose, fwd: number, upv: number, view: View = "side"): Vec {
  const sk = forwardKinematics(p, view);
  const T2 = p.trunk + p.spine;
  return add(add(sk.pts.shoulder, frontOf(T2), fwd), up(T2), upv);
}

/**
 * Set an arm so that its elbow and hand land on given points (pelvis-origin coordinates of the pose's FK),
 * using foreshortening for segments shorter than the limb (the arm leaving the picture plane).
 */
export function armThrough(p: Pose, s: Side, elbow: Vec, hand: Vec, view: View = "side"): Pose {
  const sk = forwardKinematics(p, view);
  const sh = view === "front" ? sk.pts[`shoulder${s}`] : sk.pts.shoulder;
  const T2 = p.trunk + p.spine;
  const a1 = angleOf(sh, elbow);
  const a2 = angleOf(elbow, hand);
  const l1 = Math.min(BODY.upperArm, len(sub(elbow, sh)));
  const l2 = Math.min(BODY.forearm, len(sub(hand, elbow)));
  const out = { ...p };
  const k = view === "front" ? (s === "L" ? 1 : -1) : 1;
  out[`armD${s}`] = (Math.acos(l1 / BODY.upperArm) * 180) / Math.PI;
  out[`foreD${s}`] = (Math.acos(l2 / BODY.forearm) * 180) / Math.PI;
  if (view === "front") {
    let e = a2 - a1;
    while (e > 180) e -= 360;
    while (e < -180) e += 360;
    out[`sh${s}`] = normShoulder(k * (a1 + T2));
    out[`el${s}`] = k * e;
  } else {
    out[`sh${s}`] = normShoulder(a1 + T2);
    out[`el${s}`] = normFlex(a2 - a1);
  }
  return out;
}

/** Arm (both sides) through shoulder-local elbow / hand points. */
export function armsLocal(p: Pose, elbow: [number, number], hand: [number, number], sides: Side[] = ["L", "R"]): Pose {
  let out = p;
  for (const s of sides) out = armThrough(out, s, shoulderLocal(out, elbow[0], elbow[1]), shoulderLocal(out, hand[0], hand[1]));
  return out;
}

/** Two-bone IK at build time: set an arm so the hand reaches a point (pelvis-origin coords). */
export function armTo(p: Pose, s: Side, hand: Vec): Pose {
  const sk = forwardKinematics(p, "side");
  const a = BODY.upperArm * cos(p[`armD${s}`]);
  const b = BODY.forearm * cos(p[`foreD${s}`]);
  const { a1, a2 } = solveTwoBone(sk.pts.shoulder, hand, a, b, 1);
  const T2 = p.trunk + p.spine;
  return { ...p, [`sh${s}`]: normShoulder(a1 + T2), [`el${s}`]: normFlex(a2 - a1) };
}

/** Two-bone IK at build time for a leg: put the ankle at a point keeping the foot's rotation `rot` (0 = flat). */
export function legTo(p: Pose, s: Side, ankle: Vec, rot = 0): Pose {
  const sk = forwardKinematics(p, "side");
  const { a1, a2 } = solveTwoBone(sk.pts[`hip${s}`], ankle, BODY.thigh * cos(p[`legD${s}`]), BODY.shin, -1);
  let ank = rot - a2;
  while (ank > 180) ank -= 360;
  while (ank < -180) ank += 360;
  return { ...p, [`hip${s}`]: a1 + p.trunk, [`knee${s}`]: normFlex(a1 - a2), [`ankle${s}`]: ank };
}

/** World positions of every landmark for a pose placed by a root rule (build-time helper). */
export function worldPts(p: Pose, rule: RootRule, view: View = "side"): Record<Landmark, Vec> {
  const sk0 = forwardKinematics(p, view);
  const off: Vec =
    "pin" in rule ? sub(rule.at, sk0.pts[rule.pin]) : [rule.ground - sk0.pts.pelvis[0], (rule.lift ?? 0) - lowestContact(sk0, view)];
  return forwardKinematics(p, view, off).pts;
}

/** Distance helper for authoring. */
export const dist = (a: Vec, b: Vec) => len(sub(a, b));
export { add, down, up, frontOf, sub, len };

export interface KeySpec {
  pose: Pose;
  dur: number;
  hold?: number;
  ease?: Ease;
  root?: RootRule;
  ik?: Keyframe["ik"];
  props?: Record<string, Anchor>;
  layers?: Keyframe["layers"];
  alpha?: number;
}

/** Assemble keyframes, filling in a default root rule. */
export function keys(defaultRoot: RootRule, specs: KeySpec[]): Keyframe[] {
  return specs.map((s) => ({
    pose: s.pose,
    root: s.root ?? defaultRoot,
    dur: s.dur,
    hold: s.hold,
    ease: s.ease,
    ik: s.ik,
    props: s.props,
    layers: s.layers,
    alpha: s.alpha,
  }));
}

/**
 * A repetition between a top pose and a bottom pose generated by `at(s)` (s = 0 top … 1 bottom),
 * with mid-points so the spline keeps constraints (bar over mid-foot) through the range.
 * Timing: `down` seconds to the bottom, `up` seconds back, optional holds.
 */
export function rep(
  at: (s: number) => Pose,
  t: { down: number; up: number; holdTop?: number; holdBottom?: number },
  extra: (s: number) => Partial<KeySpec> = () => ({}),
): KeySpec[] {
  const k = (s: number, dur: number, hold?: number): KeySpec => ({ pose: at(s), dur, hold, ease: "spline", ...extra(s) });
  return [
    k(0, t.down * 0.5, t.holdTop ?? 0.35),
    k(0.55, t.down * 0.5),
    k(1, t.up * 0.5, t.holdBottom ?? 0),
    k(0.55, t.up * 0.5),
  ];
}

export function motion(def: Omit<MotionDef, "keyframes"> & { keyframes: Keyframe[] }): MotionDef {
  return def;
}

export type { Anchor, Keyframe, Landmark, MotionDef, Pose, PropDef, RootRule, Side, Vec, View };

/** Standing root: near foot's mid-foot pinned at the origin. */
export const FEET: RootRule = { pin: "soleR", at: [0, 0] };

/** Down-angle helper re-exported for authoring convenience. */
export const dirDown = down;

// ------------------------------------------------------------------------------------- Gait / stepping

export interface StepFrame {
  pose: Pose;
  /** Which foot carries the body at this keyframe ("none" = flight). */
  stance: "L" | "R" | "none";
  dur: number;
  lift?: number;
  hold?: number;
  ease?: KeySpec["ease"];
  props?: Record<string, Anchor>;
  ik?: Keyframe["ik"];
}

/**
 * Place a cyclic stepping sequence so stance feet stay where they landed (the floor scrolls under a
 * following camera). Returns keyframes using `{ ground }` roots and the distance travelled per loop.
 */
export function trackSteps(frames: StepFrame[], view: View = "side"): { keyframes: Keyframe[]; travel: number } {
  const n = frames.length;
  const FOOT = 24; // heel → ball distance of a flat foot
  const contactOf = (p: Pose, s: Side): { name: "heel" | "ball" | "sole"; x: number } => {
    const P = forwardKinematics(p, view).pts;
    if (view === "front") return { name: "sole", x: P[`sole${s}`][0] };
    const h = P[`heel${s}`];
    const b = P[`ball${s}`];
    return h[1] <= b[1] + 0.5 ? { name: "heel", x: h[0] } : { name: "ball", x: b[0] };
  };
  const plant: Partial<Record<Side, { heel: number; ball: number; sole: number }>> = {};
  const times: number[] = [];
  let acc = 0;
  for (const f of frames) {
    times.push(acc);
    acc += (f.hold ?? 0) + f.dur;
  }
  const T = acc;
  const px: (number | null)[] = [];
  let prevStance: "L" | "R" | "none" = "none";
  let lastX = 0;
  let lastT = 0;
  let v = 0;
  let startX = 0;
  let startT = 0;
  const record = (s: Side, x: number, c: { name: "heel" | "ball" | "sole"; x: number }) => {
    const lx = x + c.x;
    plant[s] =
      c.name === "heel"
        ? { heel: lx, ball: lx + FOOT, sole: lx + 13 }
        : c.name === "ball"
          ? { ball: lx, heel: lx - FOOT, sole: lx - 11 }
          : { heel: lx, ball: lx, sole: lx };
  };
  let firstOfPass1: number | null = null;
  let next0 = 0;
  // Three passes over the loop: the first settles the feet, the second is used, the third gives the travel.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < n; i++) {
      const f = frames[i]!;
      const t = times[i]! + pass * T;
      let x: number | null = null;
      if (f.stance !== "none") {
        const s = f.stance;
        const o: Side = s === "L" ? "R" : "L";
        const c = contactOf(f.pose, s);
        if (prevStance === s && plant[s]) x = plant[s]![c.name] - c.x;
        else {
          if (prevStance === o && plant[o]) {
            const co = contactOf(f.pose, o);
            x = plant[o]![co.name] - co.x;
          } else x = lastX + v * (t - lastT);
          record(s, x, c);
          if (prevStance === o) delete plant[o];
        }
        if (prevStance !== s) {
          startX = x;
          startT = t;
        } else if (t > startT) v = (x - startX) / (t - startT);
        lastX = x;
        lastT = t;
      }
      if (pass === 1) px[i] = x;
      if (pass === 1 && i === 0) firstOfPass1 = x;
      if (pass === 2 && i === 0) next0 = x ?? 0;
      prevStance = f.stance;
    }
  }
  const travel = firstOfPass1 !== null ? next0 - firstOfPass1 : 0;
  // Flight frames: interpolate between neighbours in time.
  for (let i = 0; i < n; i++) {
    if (px[i] !== null) continue;
    let a = i - 1;
    while (px[(a + n) % n] === null) a--;
    let b = i + 1;
    while (px[b % n] === null) b++;
    const ta = times[(a + n) % n]! + (a < 0 ? -T : 0);
    const tb = times[b % n]! + (b >= n ? T : 0);
    const xa = (px[(a + n) % n] as number) - (a < 0 ? travel : 0);
    const xb = (px[b % n] as number) + (b >= n ? travel : 0);
    px[i] = xa + ((xb - xa) * (times[i]! - ta)) / (tb - ta);
  }
  const keyframes: Keyframe[] = frames.map((f, i) => ({
    pose: f.pose,
    root: { ground: px[i] as number, lift: f.lift ?? 0 },
    dur: f.dur,
    hold: f.hold,
    ease: f.ease ?? "spline",
    props: f.props,
    ik: f.ik,
  }));
  return { keyframes, travel };
}

/** Sample a cyclic gait table [phase 0..1, hip, knee, ankle][] at a phase (linear). */
export function gaitAt(table: [number, number, number, number][], phase: number): [number, number, number] {
  const ph = ((phase % 1) + 1) % 1;
  for (let i = 0; i < table.length; i++) {
    const a = table[i]!;
    const b = table[(i + 1) % table.length]!;
    const pb = i + 1 < table.length ? b[0] : b[0] + 1;
    if (ph >= a[0] && ph < pb) {
      const t = (ph - a[0]) / (pb - a[0]);
      return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
    }
  }
  const z = table[0]!;
  return [z[1], z[2], z[3]];
}
