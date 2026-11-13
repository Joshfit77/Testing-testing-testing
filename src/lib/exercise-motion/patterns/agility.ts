/**
 * Agility drills seen from the front (lateral shuffle, reactive mirror drill, 5-10-5 pro agility shuttle, T-drill) and
 * the lateral bound.
 *
 * The front view has no inverse kinematics for the feet, so these are authored the way the A-skip is: a timeline of
 * where each foot is on the floor (planted, or travelling in a low arc to its next spot), a pelvis path that follows the
 * feet smoothly, and a pose solved for every 1/50 s so the planted feet stay exactly where they landed while the body
 * travels across the frame (the camera is fixed: the drills go out and come back, so each loop closes on itself).
 */
import { BODY, add, cos, depthMix, down, forwardKinematics, frontOf, len, solveTwoBone, sub, up } from "../skeleton";
import { armThrough, armTo, mix, plantLeg, pose, solve1D, type Keyframe, type MotionDef, type Pose, type PropDef, type Side, type Vec } from "../build";

/** Narrowest stance while shuffling: about shoulder width between the feet (cm). */
const NARROW = 44;

/** Seconds between authored keyframes (dense, so the solved foot contacts are reproduced faithfully). */
export const KEY_DT = 0.02;

const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
/** Minimum-jerk 0 → 1 ramp: starts and ends at rest. */
export const mj = (u: number) => {
  const x = clamp01(u);
  return x * x * x * (10 - 15 * x + 6 * x * x);
};

/**
 * Front-view leg: knee flexion, hip abduction and shin tilt that put the sole at `sole` (world) with the pelvis at
 * `pelvis` (world). A bent knee is drawn by foreshortening the thigh (the knee comes toward the viewer), so the knee
 * is solved first from the distance to cover; the leg then bends a touch outward over the foot (knees out, not caving).
 */
export function frontLeg(p: Pose, s: Side, pelvis: Vec, sole: Vec, slack = 0.95): Pose {
  const k = s === "L" ? 1 : -1;
  const T1 = p.trunk;
  const hip = add(pelvis, frontOf(T1), k * BODY.hipHalf);
  const ankle = add(sole, down(-T1), -BODY.ankleH);
  const d = len(sub(ankle, hip));
  const A = (kn: number) => BODY.thigh * cos(depthMix(p[`legD${s}`], Math.min(80, kn * 0.62)));
  const B = (kn: number) => BODY.shin * cos(depthMix(p[`shinD${s}`], Math.min(60, kn * 0.22)));
  const kn = solve1D((x) => A(x) + B(x) - d / slack, 0, 155);
  const { a1, a2 } = solveTwoBone(hip, ankle, A(kn), B(kn), (-k) as 1 | -1);
  return { ...p, [`knee${s}`]: kn, [`hip${s}`]: k * (a1 + T1), [`ankle${s}`]: k * (a2 + T1) } as Pose;
}

/**
 * Athletic "ready" arms seen from the front: elbows bent and a little away from the ribs, hands in front of the
 * belly (the forearms point at the viewer, so they are drawn foreshortened). `pump` swings each arm forward (+) or
 * back (-), which in this view raises or lowers the hand.
 */
export function readyArms(p: Pose, pumpL = 0, pumpR = 0, spread = 8): Pose {
  let out = p;
  const P = forwardKinematics(p, "front").pts;
  const T2 = p.trunk + p.spine;
  const r = frontOf(T2);
  const u = up(T2);
  for (const s of ["L", "R"] as const) {
    const k = s === "L" ? 1 : -1;
    const pump = s === "L" ? pumpL : pumpR;
    const sh = P[`shoulder${s}`];
    // Forward swing: the upper arm comes toward the viewer, so the elbow shows higher and closer in under the shoulder;
    // the hand rises with it. Back swing: the elbow drops and goes out a little, the hand down toward the hip.
    const elbow = add(add(sh, r, k * (spread + (pump < 0 ? -2 : -4) * pump)), u, -22 + (pump > 0 ? 9 : 5) * pump);
    const hand = add(add(elbow, r, -k * 11), u, -1 + (pump < 0 ? 5 : 1) * pump);
    out = armThrough(out, s, elbow, hand, "front");
  }
  return out;
}

/** A foot travelling from one spot on the floor to another in a low arc. */
export interface Swing {
  t0: number;
  t1: number;
  x0: number;
  x1: number;
  lift: number;
}

/** A smooth plateau: 0 before `t0 - rin`, rising to 1 by `t0`, 1 until `t1`, back to 0 by `t1 + rout`. */
export interface Bump {
  t0: number;
  t1: number;
  rin: number;
  rout: number;
  v: number;
}

export function bumpAt(b: Bump, t: number): number {
  if (t < b.t0) return b.rin > 0 ? mj(1 - (b.t0 - t) / b.rin) : 0;
  if (t <= b.t1) return 1;
  return b.rout > 0 ? mj(1 - (t - b.t1) / b.rout) : 0;
}

/** Sum of bumps on a loop of length T (each bump also counted one loop earlier and later, so it wraps). */
export function bumpsAt(bs: Bump[], t: number, T: number): number {
  let v = 0;
  for (const b of bs) for (const o of [-T, 0, T]) v += b.v * bumpAt(b, t + o);
  return v;
}

/** A hand reaching to touch the floor (a line or a cone's base). */
export interface Touch {
  side: Side;
  /** World x of the hand at the touch. */
  x: number;
  t0: number;
  t1: number;
  rin: number;
  rout: number;
}

/**
 * The script of a front-view drill: where each foot is over time, and the smooth extras (pelvis offset and height,
 * trunk lean, hand touches) layered on top. Built step by step with a time cursor.
 */
export class FrontScript {
  t = 0;
  x: Record<Side, number>;
  readonly start: Record<Side, number>;
  swings: Record<Side, Swing[]> = { L: [], R: [] };
  /** Pelvis offset along the floor from the feet's midpoint. */
  shift: Bump[] = [];
  /** Pelvis height offset (negative = lower). */
  dip: Bump[] = [];
  /** Lateral trunk lean (+ = toward screen right). */
  lean: Bump[] = [];
  /** Extra forward lean toward the viewer (trunkD). */
  hinge: Bump[] = [];
  touches: Touch[] = [];
  /** Arm pump (+ forward) by side. */
  pump: Record<Side, Bump[]> = { L: [], R: [] };

  constructor(xL: number, xR: number) {
    this.x = { L: xL, R: xR };
    this.start = { L: xL, R: xR };
  }

  /** Move one foot by dx over `dur` seconds starting at the cursor + `delay` (the cursor does not move). */
  step(s: Side, dx: number, dur: number, lift: number, delay = 0): this {
    const t0 = this.t + delay;
    this.swings[s].push({ t0, t1: t0 + dur, x0: this.x[s], x1: this.x[s] + dx, lift });
    this.x[s] += dx;
    return this;
  }

  wait(dur: number): this {
    this.t += dur;
    return this;
  }

  /**
   * One shuffle cycle toward `dir` (+1 = screen right): the lead foot reaches out by `d`, then the trail foot pushes and
   * follows until the feet are `narrow` apart again (they never come together or cross). `C` seconds per cycle.
   */
  shuffle(dir: 1 | -1, d: number, C: number, lift = 3, narrow = NARROW): this {
    const lead: Side = dir === 1 ? "L" : "R";
    const trail: Side = dir === 1 ? "R" : "L";
    this.step(lead, dir * d, 0.44 * C, lift);
    const width = this.x.L - this.x.R;
    this.step(trail, dir * (width - narrow), 0.44 * C, lift * 0.8, 0.5 * C);
    return this.wait(C);
  }

  /** Both feet hop a few centimetres (a split-step: loaded and ready to react), landing `widen` cm wider. */
  splitStep(dur = 0.16, lift = 3, widen = 0): this {
    this.step("L", widen / 2, dur, lift);
    this.step("R", -widen / 2, dur, lift);
    this.dip.push({ t0: this.t + dur * 0.5, t1: this.t + dur * 0.5, rin: dur * 0.5, rout: dur * 0.5, v: 2.5 });
    this.dip.push({ t0: this.t + dur + 0.04, t1: this.t + dur + 0.04, rin: 0.08, rout: 0.12, v: -3 });
    return this.wait(dur);
  }

  /** Where a foot is at time t: [x, height of the sole]. */
  foot(s: Side, t: number): Vec {
    let x = this.start[s];
    for (const w of this.swings[s]) {
      if (t >= w.t1) x = w.x1;
      else if (t >= w.t0) {
        const u = (t - w.t0) / (w.t1 - w.t0);
        // The foot leaves the floor before it travels much, and travels before it lands: no scuffing along the floor.
        return [w.x0 + (w.x1 - w.x0) * mj(u), w.lift * Math.pow(Math.sin(Math.PI * clamp01(u)), 0.75)];
      }
    }
    return [x, 0];
  }
}

/** Periodic Gaussian smoothing of a sampled function on [0, T). */
export function smoothLoop(f: (t: number) => number, T: number, sigma: number, step = 0.004): (t: number) => number {
  const n = Math.max(8, Math.round(T / step));
  const h = T / n;
  const raw = Array.from({ length: n }, (_, i) => f(i * h));
  const r = Math.ceil((3 * sigma) / h);
  const w = Array.from({ length: 2 * r + 1 }, (_, j) => Math.exp(-0.5 * (((j - r) * h) / sigma) ** 2));
  const ws = w.reduce((a, b) => a + b, 0);
  const sm = raw.map((_, i) => {
    let v = 0;
    for (let j = -r; j <= r; j++) v += raw[(((i + j) % n) + n) % n]! * w[j + r]!;
    return v / ws;
  });
  return (t: number) => {
    const x = ((((t % T) + T) % T) / h) as number;
    const i = Math.floor(x);
    const u = x - i;
    return sm[i % n]! * (1 - u) + sm[(i + 1) % n]! * u;
  };
}

export interface FrontDrillOpts {
  /** Pelvis height in the athletic stance (cm). */
  height: number;
  /** Forward lean toward the viewer in the stance (trunkD, degrees). */
  hinge: number;
  /** Pelvis smoothing (seconds). */
  sigma?: number;
  /** Extra pose tweaks per time (arms for a sprint, etc.). */
  extra?: (p: Pose, t: number) => Pose;
  /** Figure scale per time (perspective: drawn smaller when farther from the camera). */
  zoom?: (t: number) => number;
}

/** Turn a script into dense keyframes: the pelvis on a smooth path, each foot solved onto its spot. */
export function frontKeyframes(sc: FrontScript, T: number, o: FrontDrillOpts): Keyframe[] {
  const mid = (t: number) => (sc.foot("L", t)[0] + sc.foot("R", t)[0]) / 2 + bumpsAt(sc.shift, t, T);
  const px = smoothLoop(mid, T, o.sigma ?? 0.06);
  const n = Math.round(T / KEY_DT);
  const dt = T / n;
  const out: Keyframe[] = [];
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const pel: Vec = [px(t), o.height + bumpsAt(sc.dip, t, T)];
    // A lean toward a hand touch is mostly a side bend of the spine; the pelvis tilts less (the legs stay under it).
    const lean = bumpsAt(sc.lean, t, T);
    const T1 = 0.4 * lean;
    const spine = 0.6 * lean;
    let p = pose({ trunk: T1, spine, neck: -(T1 + spine) * 0.85, trunkD: o.hinge + bumpsAt(sc.hinge, t, T) });
    p = readyArms(p, bumpsAt(sc.pump.L, t, T), bumpsAt(sc.pump.R, t, T));
    if (o.extra) p = o.extra(p, t);
    for (const s of ["L", "R"] as const) p = frontLeg(p, s, pel, sc.foot(s, t));
    // Hand touches: the arm reaches to the floor, blended in and out.
    for (const tc of sc.touches) {
      let w = 0;
      for (const off of [-T, 0, T]) w = Math.max(w, bumpAt({ t0: tc.t0, t1: tc.t1, rin: tc.rin, rout: tc.rout, v: 1 }, t + off));
      if (w <= 0) continue;
      // The elbow and hand travel from where the ready arm holds them to a straight arm reaching for the floor (the
      // elbow a touch outside the line), so the arm unfolds smoothly into the picture plane.
      const s = tc.side;
      const k = s === "L" ? 1 : -1;
      const P = forwardKinematics(p, "front", pel).pts;
      const sh = P[`shoulder${s}`];
      const dir = sub([tc.x, BODY.r.hand + 0.6], sh);
      const reach = Math.min(1, ((BODY.upperArm + BODY.forearm) * 0.99) / len(dir));
      const handTo = add(sh, dir, reach);
      const elbowTo = add(add(sh, dir, (reach * BODY.upperArm) / (BODY.upperArm + BODY.forearm)), [k, 0], 2.5);
      const mixV = (a: Vec, b: Vec): Vec => [a[0] + (b[0] - a[0]) * w - pel[0], a[1] + (b[1] - a[1]) * w - pel[1]];
      p = armThrough(p, s, mixV(P[`elbow${s}`], elbowTo), mixV(P[`hand${s}`], handTo), "front");
    }
    const kf: Keyframe = { pose: p, root: { pin: "pelvis", at: pel }, dur: dt, ease: "spline" };
    if (o.zoom) kf.zoom = o.zoom(t);
    out.push(kf);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ Lateral shuffle

/** Stance and step sizes shared by the shuffling drills (cm, s). */
const STEP = 26;
const CYCLE = 0.3;
const PLANT = 14;

/**
 * Lateral shuffle: from an athletic stance (knees bent, hips back, chest up) the lead foot reaches out and the trail
 * foot pushes and follows, never closer than about shoulder width, so the feet never cross or click. Three shuffles
 * to screen right, a plant on the outside foot with the hips dropping, three shuffles back and a plant on the other
 * side. The torso stays upright and square (the listed mistakes are standing tall and leaning).
 */
export function lateralShuffleDrill(id: string, label: string, opts: { cycles?: number } = {}): MotionDef {
  const n = opts.cycles ?? 3;
  const sc = new FrontScript(NARROW / 2 - (n * STEP) / 2, -NARROW / 2 - (n * STEP) / 2 - PLANT);
  const planted = (dir: 1 | -1) => {
    const out: Side = dir === 1 ? "L" : "R";
    // Plant: the outside foot lands a short step further out, the hips sink over it and the body stops, then pushes back.
    sc.step(out, dir * PLANT, 0.12, 2.5);
    sc.shift.push({ t0: sc.t + 0.12, t1: sc.t + 0.2, rin: 0.12, rout: 0.16, v: dir * 5 });
    sc.dip.push({ t0: sc.t + 0.1, t1: sc.t + 0.22, rin: 0.14, rout: 0.2, v: -5 });
    sc.lean.push({ t0: sc.t + 0.1, t1: sc.t + 0.22, rin: 0.12, rout: 0.18, v: -dir * 3 });
    sc.wait(0.32);
  };
  for (const dir of [1, -1] as const) {
    for (let i = 0; i < n; i++) sc.shuffle(dir, STEP, CYCLE);
    planted(dir);
  }
  const T = sc.t;
  const keyframes = frontKeyframes(sc, T, { height: 76, hinge: 20 });
  return { id, view: "front", label, keyframes, props: [], footGrounded: true, stillPhase: 0.12 };
}

// ------------------------------------------------------------------------------------------------ Shared drill moves

/** Step each foot back to a spot (one after the other), e.g. to settle into the starting stance. */
function settleTo(sc: FrontScript, xL: number, xR: number, dur = 0.22): void {
  const moves = (["L", "R"] as const).filter((s) => Math.abs((s === "L" ? xL : xR) - sc.x[s]) > 0.5);
  for (const [i, s] of moves.entries()) sc.step(s, (s === "L" ? xL : xR) - sc.x[s], dur, 2.5, i * dur * 0.8);
  sc.wait(moves.length ? dur * (0.8 * (moves.length - 1) + 1) : 0);
}

/**
 * Shuffle toward `dir` until the outside foot plants on `target`: even cycles of about `d`, then a short plant step
 * with the hips dropping. Returns the time the plant foot lands.
 */
function driveTo(sc: FrontScript, dir: 1 | -1, target: number, d: number, C: number, lift: number, plant = 16): number {
  const out: Side = dir === 1 ? "L" : "R";
  const dist = (target - sc.x[out]) * dir - plant;
  const n = Math.max(1, Math.round(dist / d));
  for (let i = 0; i < n; i++) sc.shuffle(dir, dist / n, C, lift);
  sc.step(out, dir * plant, 0.13, lift * 0.7);
  return sc.t + 0.13;
}

/** Plant and touch the floor at `x` with the outside hand: hips drop, the torso tips toward the hand. */
function touchDown(sc: FrontScript, dir: 1 | -1, x: number, tHand: number, depth = 1): void {
  const side: Side = dir === 1 ? "L" : "R";
  const hold = 0.06;
  sc.touches.push({ side, x, t0: tHand, t1: tHand + hold, rin: 0.2, rout: 0.26 });
  sc.dip.push({ t0: tHand, t1: tHand + hold, rin: 0.22, rout: 0.26, v: -20 * depth });
  sc.lean.push({ t0: tHand, t1: tHand + hold, rin: 0.2, rout: 0.24, v: dir * 32 * depth });
  sc.hinge.push({ t0: tHand, t1: tHand + hold, rin: 0.2, rout: 0.24, v: 46 * depth });
  sc.shift.push({ t0: tHand, t1: tHand + hold, rin: 0.2, rout: 0.26, v: dir * 14 });
}

// ------------------------------------------------------------------------------------------------ Reactive mirror

/**
 * Reactive mirror drill: facing the partner (the viewer, who leads), the athlete split-steps (a small loaded hop: ready
 * to react), then mirrors the partner's moves as they come, in an irregular pattern inside a small marked area: a quick
 * two-step shuffle one way and a plant, a short sprint toward the partner (drawn growing as it comes closer) and a
 * backpedal back to the line, a three-step shuffle the other way, and one step back to the middle. Low, square and
 * balanced throughout, feet never crossing.
 */
export function reactiveMirrorDrill(id: string, label: string): MotionDef {
  const sc = new FrontScript(NARROW / 2, -NARROW / 2);
  const C = 0.25;
  const d = 30;
  const CAM_D = 420;
  const Z_HOME = 150;
  const Z_NEAR = 45;
  const scaleAt = (z: number) => CAM_D / (CAM_D + z);
  const moves: [number, number, number, number][] = []; // [t0, t1, z0, z1]
  const plant = (dir: 1 | -1) => {
    const out: Side = dir === 1 ? "L" : "R";
    sc.step(out, dir * 10, 0.11, 2);
    sc.shift.push({ t0: sc.t + 0.11, t1: sc.t + 0.16, rin: 0.1, rout: 0.14, v: dir * 4 });
    sc.dip.push({ t0: sc.t + 0.1, t1: sc.t + 0.16, rin: 0.12, rout: 0.16, v: -4 });
    sc.wait(0.2);
  };
  const mid = () => (sc.x.L + sc.x.R) / 2;
  sc.wait(0.3);
  sc.splitStep(0.18, 4);
  for (let i = 0; i < 2; i++) sc.shuffle(1, d, C);
  plant(1);
  sc.splitStep(0.18, 4);
  // Short sprint toward the partner, then backpedal to the line.
  const c = mid();
  let t0 = sc.t;
  sc.dip.push({ t0: sc.t + 0.12, t1: sc.t + 0.5, rin: 0.12, rout: 0.15, v: 8 });
  runInPlace(sc, 3, 0.19, 15, 11, "R", c);
  sc.step("L", c + NARROW / 2 - sc.x.L, 0.13, 3);
  sc.step("R", c - NARROW / 2 - sc.x.R, 0.13, 3, 0.04);
  sc.dip.push({ t0: sc.t + 0.12, t1: sc.t + 0.18, rin: 0.1, rout: 0.15, v: -4 });
  sc.wait(0.22);
  moves.push([t0 + 0.05, sc.t - 0.06, Z_HOME, Z_NEAR]);
  t0 = sc.t;
  sc.hinge.push({ t0: sc.t + 0.08, t1: sc.t + 0.6, rin: 0.12, rout: 0.15, v: 6 });
  runInPlace(sc, 4, 0.16, 7, 14, "L", c);
  settleTo(sc, c + NARROW / 2, c - NARROW / 2, 0.16);
  moves.push([t0 + 0.03, sc.t - 0.08, Z_NEAR, Z_HOME]);
  sc.splitStep(0.18, 4);
  for (let i = 0; i < 3; i++) sc.shuffle(-1, d, C);
  plant(-1);
  sc.splitStep(0.18, 4);
  // Back toward the middle: one quick cycle, then settle square into the ready stance.
  sc.shuffle(1, Math.max(12, NARROW / 2 - sc.x.L), C);
  settleTo(sc, NARROW / 2, -NARROW / 2, 0.2);
  sc.wait(0.15);
  const T = sc.t;
  const z = (t: number) => {
    for (const [a, b, z0, z1] of moves) if (t >= a && t <= b) return z0 + (z1 - z0) * mj((t - a) / (b - a));
    const last = moves.filter(([, b]) => b < t).pop();
    return last ? last[3] : Z_HOME;
  };
  const keyframes = frontKeyframes(sc, T, { height: 75, hinge: 22, zoom: (t) => scaleAt(z(t)) });
  const xs = (["L", "R"] as const).flatMap((s) => sc.swings[s].flatMap((w) => [w.x0, w.x1]));
  const sh = scaleAt(Z_HOME);
  const props: PropDef[] = [
    { id: "c1", kind: "cone", variant: "agility", at: [(Math.min(...xs) - 34) * sh, 0], size: 0.9 * sh, layer: "back" },
    { id: "c2", kind: "cone", variant: "agility", at: [(Math.max(...xs) + 34) * sh, 0], size: 0.9 * sh, layer: "back" },
  ];
  return { id, view: "front", label, keyframes, props, zoomAt: 0, footGrounded: false, stillPhase: 0.2 };
}

// ------------------------------------------------------------------------------------------------ 5-10-5

/** Position fraction 0 → 1 of a run whose speed rises and falls as u^a (1-u)^b (starts and ends at rest). */
function speedRamp(a: number, b: number, n = 400): (u: number) => number {
  const cum = [0];
  for (let i = 1; i <= n; i++) {
    const u = (i - 0.5) / n;
    cum.push(cum[i - 1]! + Math.pow(u, a) * Math.pow(1 - u, b));
  }
  const total = cum[n]!;
  return (u: number) => {
    const x = clamp01(u) * n;
    const i = Math.min(n - 1, Math.floor(x));
    return (cum[i]! + (cum[i + 1]! - cum[i]!) * (x - i)) / total;
  };
}

/**
 * Plant a foot by the ball (side view), rolling the heel up just enough that the ankle never bends past `maxDorsi`
 * degrees of dorsiflexion.
 */
function plantBall(p: Pose, s: Side, pelvis: Vec, ball: Vec, maxDorsi: number, rotMax: number): Pose {
  let rot = rotMax;
  let out = plantLeg(p, s, pelvis, ball, rot);
  for (let it = 0; it < 6; it++) {
    const shin = out[`hip${s}`] - out.trunk - out[`knee${s}`];
    const want = Math.min(rotMax, shin + maxDorsi);
    if (Math.abs(want - rot) < 0.05) break;
    rot = want;
    out = plantLeg(p, s, pelvis, ball, rot);
  }
  return out;
}

/** The three lines of the 5-10-5, 5 yards apart, drawn this far apart (cm; the distances are shortened to fit). */
export const PRO_AGILITY_LINE = 190;

/**
 * 5-10-5 pro agility shuttle, side view (the camera in front of the drill, so the athlete runs across the picture), the
 * distances shortened to fit: three lines 5 yards apart. The athlete sets in a three-point stance straddling the middle
 * line, one hand on the floor; explodes out to screen right with a strong forward lean, chops the last steps short and
 * plants the outside foot at the line with the hips dropping low and the hand touching the line; turns, drives 10 yards
 * the other way, plants and touches the far line; turns again and sprints back through the middle line, easing off
 * after it. Each run builds speed over the first steps and brakes hard into the plant (the feet land ahead of the hips,
 * the body sinks). A profile figure cannot be drawn mid-turn (in the drill the athlete's chest faces the camera at each
 * line), so each 180° turn is a brief fade while the athlete is low at the line; after the finish the athlete fades
 * out and is back in the stance for the next rep. A planted foot never slides.
 */
export function proAgilityDrill(id: string, label: string): MotionDef {
  const L = PRO_AGILITY_LINE;
  const REACH = 50; // the pelvis stops this far short of a line the hand touches
  const FDT = 0.005;
  // ---- The route: pelvis x over time, facing, touches, turns and the fade between reps.
  interface Row {
    t: number;
    x: number;
    facing: 1 | -1;
    alpha: number;
  }
  const rows: Row[] = [];
  let cur: Row = { t: 0, x: -26, facing: 1, alpha: 1 };
  const push = (r: Partial<Row>) => {
    cur = { ...cur, ...r, t: cur.t + FDT };
    rows.push(cur);
  };
  const hold = (dur: number, f: (u: number) => Partial<Row> = () => ({})) => {
    for (let i = 0, n = Math.round(dur / FDT); i < n; i++) push(f((i + 1) / n));
  };
  interface Run {
    t0: number;
    t1: number;
    dir: 1 | -1;
    /** Where the run ends: a plant at a line (its x), or a run-through. */
    plantAt?: number;
  }
  const runs: Run[] = [];
  const run = (x1: number, dur: number, a: number, b: number, plantAt?: number) => {
    const x0 = cur.x;
    const f = speedRamp(a, b);
    const t0 = cur.t;
    for (let i = 0, n = Math.round(dur / FDT); i < n; i++) push({ x: x0 + (x1 - x0) * f((i + 1) / n) });
    runs.push({ t0, t1: cur.t, dir: x1 > x0 ? 1 : -1, plantAt });
  };
  const touches: { t: number; line: number }[] = [];
  const turns: { t: number; facing: 1 | -1 }[] = [];
  // At a line: the hand reaches the line as the body bottoms out, holds it for an instant, comes off, and the body
  // turns round (the fade) while still low.
  const touchTurn = (line: number, facing: 1 | -1) => {
    const tc = cur.t + 0.07;
    touches.push({ t: tc, line });
    turns.push({ t: tc + 0.17, facing });
    hold(0.24);
  };
  const T_SET = 0.55;
  hold(T_SET);
  // 5 yards to screen right: drives hard for most of it, brakes over the last two steps.
  run(L - REACH, 1.02, 1.1, 0.85, L);
  touchTurn(L, -1);
  // 10 yards to the far line.
  run(-L + REACH, 1.68, 1.1, 0.8, -L);
  touchTurn(-L, 1);
  // 5 yards back through the middle line at speed, easing off after it.
  run(0.55 * L, 1.5, 1.0, 2.3);
  hold(0.14);
  // Fade out, back into the stance unseen, fade in.
  hold(0.26, (u) => ({ alpha: 1 - mj(u) }));
  // Unseen, the body goes back to the start and settles into the stance (over a few frames, so no joint snaps).
  const tReset = cur.t;
  const xEnd = cur.x;
  hold(0.3, (u) => ({ x: xEnd + (-26 - xEnd) * mj(u), alpha: 0 }));
  hold(0.3, (u) => ({ alpha: mj(u) }));
  const T = cur.t;
  // Facing and the fade at each turn.
  for (const r of rows) {
    let f: 1 | -1 = 1;
    let a = 1;
    for (const tn of turns) {
      if (r.t >= tn.t) f = tn.facing;
      const d = Math.abs(r.t - tn.t);
      a = Math.min(a, d < 0.035 ? 0 : d < 0.12 ? mj((d - 0.035) / 0.085) : 1);
    }
    r.facing = f;
    r.alpha *= a;
  }
  const R = (t: number): Row => rows[Math.max(0, Math.min(rows.length - 1, Math.round(t / FDT) - 1))]!;
  const vel = (t: number) => (R(t + 0.01).x - R(t - 0.01).x) / 0.02;
  const accel = (t: number) => (vel(t + 0.05) - vel(t - 0.05)) / 0.1;

  // ---- Feet: every landing (time, world x of the ball of the foot), per foot.
  interface Fall {
    t: number;
    x: number;
    /** The foot does not leave the floor for this step before this time (the push begins). */
    from?: number;
  }
  const falls: Record<Side, Fall[]> = { L: [], R: [] };
  // The stance: near (R) foot forward just past the middle line, far (L) foot back; the R hand on the floor ahead.
  const SET_R = 14;
  const SET_L = -44;
  falls.R.push({ t: -1, x: SET_R });
  falls.L.push({ t: -1, x: SET_L });
  const last = (s: Side) => falls[s][falls[s].length - 1]!;
  /** Each run: steps from a cadence that rises with speed, the last one planting at the line. */
  const stepTimes: { t: number; side: Side }[] = [];
  for (const rn of runs) {
    // The first step is taken by the foot that is behind in the new direction.
    let side: Side = (last("R").x - last("L").x) * rn.dir < 0 ? "R" : "L";
    // Steps are spaced by phase: cadence (steps / s) rises with speed (3.3 at a standstill, ~4.5 at full speed).
    const cad = (t: number) => 3.7 + Math.min(0.8, Math.abs(vel(t)) / 300);
    const start = rn.t0 + 0.07;
    let ph = 0;
    const ts: number[] = [];
    for (let t = start; t < rn.t1; t += FDT) {
      ph += cad(t) * FDT;
      if (ph >= 1) {
        ph -= 1;
        ts.push(t);
      }
    }
    // A plant run ends with the plant foot landing at the line just as the body stops (the last step is stretched or
    // squeezed onto that moment); a run-through ends with a short stopping step.
    if (rn.plantAt !== undefined) {
      if (ts.length && rn.t1 - ts[ts.length - 1]! < 0.13) ts.pop();
      ts.push(rn.t1 - 0.03);
    } else ts.push(rn.t1 + 0.04);
    // The first step comes quickly out of the stance or the plant.
    ts[0] = Math.min(ts[0]!, rn.t0 + 0.22);
    for (const [i, t] of ts.entries()) {
      const isLast = i === ts.length - 1;
      const v = Math.abs(vel(t));
      const braking = Math.max(0, Math.min(1, (-accel(t) * rn.dir) / 900));
      // Accelerating, the foot lands under the hips (the ball just ahead of them); braking, well ahead of them.
      let x = R(t).x + rn.dir * (2 + v * 0.02 + 36 * braking);
      if (isLast && rn.plantAt !== undefined) x = rn.plantAt - rn.dir * 7;
      // The step before the plant lands a long stride behind it: a wide, low base to stop on.
      if (i === ts.length - 2 && rn.plantAt !== undefined) x = rn.plantAt - rn.dir * 62;
      if (isLast && rn.plantAt === undefined) x = R(t).x + rn.dir * 16;
      // The first step drives the back foot through, past the other foot.
      const otherX = last(side === "R" ? "L" : "R").x;
      if (i === 0) x = rn.dir > 0 ? Math.max(x, otherX + 4) : Math.min(x, otherX - 4);
      falls[side].push({ t, x, ...(i === 0 ? { from: rn.t0 + 0.02 } : {}) });
      stepTimes.push({ t, side });
      side = side === "R" ? "L" : "R";
    }
  }
  // The other foot catches up on the stop after the run-through, then both are in the stance again after the reset.
  const lastStep = stepTimes[stepTimes.length - 1]!;
  const other: Side = lastStep.side === "R" ? "L" : "R";
  const catchUp = last(lastStep.side).x - 12;
  if (catchUp > last(other).x + 4) falls[other].push({ t: lastStep.t + 0.22, x: catchUp });
  falls.R.push({ t: tReset + 0.28, x: SET_R, from: tReset + 0.005 });
  falls.L.push({ t: tReset + 0.28, x: SET_L, from: tReset + 0.005 });
  for (const s of ["L", "R"] as const) falls[s].sort((a, b) => a.t - b.t);
  /** Sole angle of a planted foot (on the ball, the heel rising as the hips run past it), from its offset ahead. */
  const plantedRot = (rel: number) => -6 - 0.8 * Math.max(0, -rel - 6);
  /** Where a foot is: world x of its ball, its height, and the sole's angle (+ = toes up). */
  const footAt = (s: Side, t: number): { x: number; lift: number; airborne: boolean; u?: number; rot0?: number } => {
    const F = falls[s];
    let k = 0;
    while (k + 1 < F.length && F[k + 1]!.t <= t) k++;
    const prev = F[k]!;
    const next = F[k + 1];
    if (!next) return { x: prev.x, lift: 0, airborne: false };
    // The swing starts a swing-time before the landing (a sprint has a short flight between steps), never before the
    // foot has had a short stance.
    const sw = Math.min(0.34, Math.max(0.2, (next.t - prev.t) * 0.62));
    let t0 = Math.max(next.t - sw, prev.t + 0.08, next.from ?? -Infinity);
    // ...and the foot comes off the floor once the hips have run well past it (the leg cannot stretch further).
    for (let tt = Math.max(prev.t, 0); tt < t0; tt += FDT) {
      const r = R(tt);
      if ((r.x - prev.x) * r.facing > 24) {
        t0 = tt;
        break;
      }
    }
    if (t < t0) return { x: prev.x, lift: 0, airborne: false };
    const u = (t - t0) / (next.t - t0);
    // A sprinter's swing: the heel folds up under the hips first (the higher, the longer the stride), then the knee
    // drives forward and the foot comes down onto the ball.
    const hi = Math.min(38, 6 + Math.abs(next.x - prev.x) * 0.3);
    const lift = hi * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 1.5);
    // The sole leaves the floor at the angle it had rolled to.
    const r0 = R(t0);
    const rot0 = plantedRot((prev.x - r0.x) * r0.facing);
    return { x: prev.x + (next.x - prev.x) * mj(Math.pow(u, 1.25)), lift, airborne: true, u, rot0 };
  };

  // ---- Smooth body targets: pelvis height and trunk lean.
  const touchW = (t: number) => {
    let w = 0;
    for (const tc of touches) w = Math.max(w, bumpAt({ t0: tc.t - 0.03, t1: tc.t + 0.05, rin: 0.24, rout: 0.17, v: 1 }, t));
    return w;
  };
  const lowW = (t: number) => {
    let w = 0;
    for (const tc of touches) w = Math.max(w, bumpAt({ t0: tc.t - 0.05, t1: tc.t + 0.1, rin: 0.3, rout: 0.3, v: 1 }, t));
    return w;
  };
  const setW = (t: number) => (t < T_SET ? 1 : t < T_SET + 0.3 ? 1 - mj((t - T_SET) / 0.3) : t > tReset ? mj((t - tReset) / 0.28) : 0);
  // Driving out of the stance or a plant: low and leaning hard over the first steps, rising as the speed builds.
  const driveW = (t: number) => {
    let w = 0;
    for (const rn of runs) w = Math.max(w, bumpAt({ t0: rn.t0, t1: rn.t0 + 0.12, rin: 0.12, rout: 0.42, v: 1 }, t));
    return w;
  };
  const yRaw = (t: number) => {
    const v = Math.abs(vel(t));
    const run = 84 + Math.min(4, v / 80) - 5 * driveW(t);
    const low = 49;
    const set = 59;
    const s = setW(t);
    return (run + (low - run) * lowW(t)) * (1 - s) + set * s;
  };
  const leanRaw = (t: number) => {
    const r = R(t);
    // Leaning into the acceleration, upright while braking.
    const a = accel(t) * r.facing;
    const lean = Math.max(3, Math.min(42, 24 + a * 0.025)) + 12 * driveW(t);
    const s = setW(t);
    return (lean + (68 - lean) * touchW(t)) * (1 - s) + 79 * s;
  };
  const yS = smoothLoop(yRaw, T, 0.05);
  const leanS = smoothLoop(leanRaw, T, 0.045);

  // ---- Poses.
  const n = Math.round(T / KEY_DT);
  const dt = T / n;
  const keyframes: Keyframe[] = [];
  /** The pose at time t, the feet and hand placed in the body's own frame for `facing`. */
  const poseAt = (t: number, facing: 1 | -1): Pose => {
    const r = R(t);
    const pel: Vec = [r.x, yS(t)];
    const T1 = leanS(t);
    const s = setW(t);
    const tw = touchW(t);
    const spine = 6 + 8 * Math.max(tw, s);
    let p = pose({ trunk: T1, spine, neck: Math.max(-44, -(T1 + spine) * 0.62) });
    // Arms pump opposite the legs (the arm opposite the forward foot swings forward), bigger at speed; still in the
    // stance.
    const relOf = (sd: Side) => (footAt(sd, t).x - r.x) * facing;
    const sw = Math.tanh((relOf("R") - relOf("L")) / 30);
    const amp = 52 * Math.min(1, Math.abs(vel(t)) / 230) * (1 - s);
    const T2 = T1 + spine;
    p = { ...p, shR: T2 + 8 - amp * sw, shL: T2 + 8 + amp * sw, elR: 92, elL: 92 };
    // Legs: each foot on its spot (in the body's own frame: mirrored when facing -x).
    for (const sd of ["L", "R"] as const) {
      const f = footAt(sd, t);
      const rel = (f.x - r.x) * facing;
      // On the balls of the feet while running; a planted foot rolls its heel up as the hips pass it.
      const e = mj(f.u ?? 0);
      const rot = f.airborne ? (f.rot0 ?? -8) * (1 - e) - 8 * e - 34 * Math.min(1, f.lift / 30) * (1 - (f.u ?? 0)) : plantedRot(rel);
      p = plantBall(p, sd, [0, pel[1]], [rel, f.lift], 38, Math.max(-60, rot));
    }
    // The near hand: on the floor in the stance; reaching the line in a touch.
    const P = forwardKinematics(p, "side", [0, pel[1]]).pts;
    // The arm turns from its swing to the reach (its joint angles blend, so it unfolds smoothly however fast the body
    // is moving), the hand ending on the target or as near as a straight arm allows.
    const reach = (target: Vec, w: number) => {
      let hand = target;
      const d: Vec = [hand[0] - P.shoulder[0], hand[1] - P.shoulder[1]];
      const Ld = Math.hypot(d[0], d[1]);
      const max = (BODY.upperArm + BODY.forearm) * 0.97;
      if (Ld > max) hand = [P.shoulder[0] + (d[0] * max) / Ld, P.shoulder[1] + (d[1] * max) / Ld];
      const q = armTo(p, "R", [hand[0], hand[1] - pel[1]]);
      p = { ...p, shR: p.shR + (q.shR - p.shR) * w, elR: p.elR + (q.elR - p.elR) * w };
    };
    if (s > 0) {
      reach([SET_R + 16 - r.x, BODY.r.hand + 0.4], s);
      // The other arm cocked back, ready to drive.
      p = { ...p, shL: p.shL + (T2 - 40 - p.shL) * s, elL: p.elL + (80 - p.elL) * s };
    }
    if (tw > 0) {
      const tc = touches.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
      reach([(tc.line - r.x) * facing, BODY.r.hand + 0.4], tw);
      p = { ...p, shL: p.shL + (T2 - 25 - p.shL) * tw, elL: p.elL + (60 - p.elL) * tw };
    }
    return p;
  };
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const r = R(t);
    const pel: Vec = [r.x, yS(t)];
    let p = poseAt(t, r.facing);
    // Turning round (the figure is mirrored from the turn on) the planted feet and the hand on the line swap sides of
    // the body: while the figure is faded out, the limbs blend from one solution to the other over a few frames, so no
    // joint snaps.
    const tn = turns.find((x) => Math.abs(t - x.t) < 0.09);
    if (tn) {
      const w = mj((t - (tn.t - 0.09)) / 0.18);
      p = mix(poseAt(t, (tn.facing * -1) as 1 | -1), poseAt(t, tn.facing), w);
    }
    const kf: Keyframe = { pose: p, root: { pin: "pelvis", at: pel }, dur: dt, ease: "spline" };
    if (r.facing === -1) kf.facing = -1;
    if (r.alpha < 1) kf.alpha = r.alpha;
    keyframes.push(kf);
  }
  const props: PropDef[] = [];
  for (const [i, x] of [-L, 0, L].entries()) {
    props.push({ id: `line${i}`, kind: "hurdleLine", variant: "agility", at: [x, 0], layer: "back" });
    props.push({ id: `cone${i}`, kind: "cone", variant: "agility", at: [x + 22, 0], size: 0.7, layer: "back" });
  }
  // Still image: the hand on the first line.
  return { id, view: "side", label, keyframes, props, footGrounded: false, stillPhase: (touches[0]!.t + 0.02) / T };
}

// ------------------------------------------------------------------------------------------------ T-drill

/**
 * Running steps toward or away from the viewer, seen from the front: the feet stay in their lanes on screen while each
 * knee drives up in turn (toward the viewer, so the thigh is drawn foreshortened) and the arms pump opposite the legs.
 */
function runInPlace(sc: FrontScript, steps: number, stepDur: number, lift: number, lane: number, first: Side = "R", centre = 0): void {
  for (let i = 0; i < steps; i++) {
    const s: Side = (i % 2 === 0) === (first === "R") ? "R" : "L";
    const o: Side = s === "R" ? "L" : "R";
    const x = centre + (s === "L" ? lane : -lane);
    sc.step(s, x - sc.x[s], stepDur * 0.9, lift);
    const b = { t0: sc.t + stepDur * 0.45, t1: sc.t + stepDur * 0.45, rin: stepDur * 0.45, rout: stepDur * 0.55 };
    sc.pump[o].push({ ...b, v: lift > 10 ? 1 : 0.6 });
    sc.pump[s].push({ ...b, v: lift > 10 ? -1 : -0.6 });
    sc.wait(stepDur);
  }
}

/**
 * T-drill, seen from the top of the T looking back down its stem (distances shortened to fit), so the athlete faces the
 * viewer the whole time, as in the drill: sprints forward from the start cone toward the viewer (drawn growing as it
 * comes closer), stops at the middle cone and touches it, shuffles 5 yards to its left and touches that cone, 10 yards
 * to the right and touches, shuffles back to the middle, then backpedals to the start (drawn shrinking as it moves away),
 * staying low and never crossing the feet.
 */
export function tDrill(id: string, label: string): MotionDef {
  const D = 420; // camera to the row of cones (cm)
  const Z_START = 330; // start cone behind the row (10 yards, shortened)
  const Z_ROW = 30; // the athlete stops just behind the row
  const scaleAt = (z: number) => D / (D + z);
  const sRow = scaleAt(Z_ROW);
  const Lx = 120; // cone spacing on screen (5 yards, shortened)
  // The camera stands a little to one side of the stem, so the run toward it is seen slightly on the diagonal (and the
  // middle cone does not hide the athlete's feet at the start). Screen x of a cone in the row -> the athlete's world x.
  const ZX = 120;
  const atRow = (screenX: number) => ZX + (screenX - ZX) / sRow;
  const sc = new FrontScript(NARROW / 2, -NARROW / 2);
  sc.wait(0.4);
  // Sprint to the middle cone: the first steps narrow the feet into running lanes.
  const tRun0 = sc.t;
  sc.dip.push({ t0: sc.t + 0.2, t1: sc.t + 0.95, rin: 0.2, rout: 0.25, v: 12 });
  sc.hinge.push({ t0: sc.t + 0.15, t1: sc.t + 0.7, rin: 0.15, rout: 0.3, v: 10 });
  runInPlace(sc, 6, 0.19, 19, 11);
  const tRun1 = sc.t + 0.08;
  // Stop: the feet set wide, hips drop, the right hand touches the middle cone.
  sc.step("L", NARROW / 2 + 4 - sc.x.L, 0.14, 4);
  sc.step("R", -NARROW / 2 - 4 - sc.x.R, 0.14, 4, 0.05);
  sc.wait(0.19);
  const tTouch = sc.t + 0.02;
  touchDown(sc, -1, atRow(-14), tTouch);
  sc.wait(0.2);
  // 5 yards to the athlete's left (screen right), touch with the left hand.
  let land = driveTo(sc, 1, atRow(Lx - 4), 34, 0.26, 4);
  touchDown(sc, 1, atRow(Lx - 13), land + 0.08);
  sc.wait(0.14);
  // 10 yards to the right, touch with the right hand.
  land = driveTo(sc, -1, atRow(-Lx + 4), 34, 0.26, 4);
  touchDown(sc, -1, atRow(-Lx + 13), land + 0.08);
  sc.wait(0.14);
  // Back to the middle.
  driveTo(sc, 1, NARROW / 2, 34, 0.26, 4, 12);
  sc.shift.push({ t0: sc.t + 0.12, t1: sc.t + 0.16, rin: 0.12, rout: 0.16, v: 4 });
  sc.dip.push({ t0: sc.t + 0.12, t1: sc.t + 0.16, rin: 0.12, rout: 0.18, v: -4 });
  sc.wait(0.3);
  settleTo(sc, NARROW / 2, -NARROW / 2, 0.16);
  // Backpedal to the start: short, quick steps, hips low, chest over the toes.
  const tBack0 = sc.t;
  sc.hinge.push({ t0: sc.t + 0.1, t1: sc.t + 1.3, rin: 0.15, rout: 0.2, v: 8 });
  sc.dip.push({ t0: sc.t + 0.1, t1: sc.t + 1.3, rin: 0.15, rout: 0.2, v: 3 });
  runInPlace(sc, 8, 0.17, 8, 15, "L");
  const tBack1 = sc.t;
  settleTo(sc, NARROW / 2, -NARROW / 2, 0.2);
  sc.wait(0.3);
  const T = sc.t;
  const z = (t: number) => {
    if (t <= tRun0 + 0.05) return Z_START;
    if (t <= tRun1) {
      // Accelerates out of the start, holds speed, brakes over the last two steps.
      const u = (t - tRun0 - 0.05) / (tRun1 - tRun0 - 0.05);
      return Z_START + (Z_ROW - Z_START) * mj(u * 0.92 + 0.08 * u * u);
    }
    if (t <= tBack0) return Z_ROW;
    if (t <= tBack1) return Z_ROW + (Z_START - Z_ROW) * mj((t - tBack0) / (tBack1 - tBack0));
    return Z_START;
  };
  const keyframes = frontKeyframes(sc, T, { height: 74, hinge: 22, sigma: 0.05, zoom: (t) => scaleAt(z(t)) });
  const props: PropDef[] = [
    { id: "start", kind: "cone", variant: "agility", at: [ZX + (42 - ZX) * scaleAt(Z_START + 10), 0], size: scaleAt(Z_START + 10), layer: "back" },
    { id: "left", kind: "cone", variant: "agility", at: [Lx, 0], size: 0.9, layer: "front" },
    { id: "mid", kind: "cone", variant: "agility", at: [0, 0], size: 0.9, layer: "front" },
    { id: "right", kind: "cone", variant: "agility", at: [-Lx, 0], size: 0.9, layer: "front" },
  ];
  // Still image: the hand on the middle cone.
  return { id, view: "front", label, keyframes, props, zoomAt: ZX, footGrounded: false, stillPhase: (tTouch + 0.03) / T };
}

// ------------------------------------------------------------------------------------------------ Lateral bound

/**
 * Lateral bound (skater jump), front view. Stands on one leg in a quarter squat (hips back, knee over the toes, the
 * free foot off the floor), sinks a little, pushes the ground away sideways and flies on a real ballistic arc, lands
 * softly on the other leg alone (the takeoff leg trails and stays up), absorbs with hip and knee bending, sticks the
 * landing, and bounds back. The arms swing across the body in the direction of the jump, as a speed skater's do.
 */
export function lateralBoundDrill(id: string, label: string): MotionDef {
  const G = 980;
  const X = 64; // landing foot (sole centre), each side of the middle
  const H = 76; // pelvis height sticking the landing
  const T_ABS = 0.2;
  const T_HOLD = 0.42;
  const T_LOAD = 0.2;
  const T_PUSH = 0.16;
  const T_FLY = 0.32;
  const HALF = T_ABS + T_HOLD + T_LOAD + T_PUSH + T_FLY;
  // One half: standing on L (screen right, foot at +X) from its landing, then the bound to R. dir = -1: travel left.
  const land: Vec = [X - 26, H + 13];
  const stick: Vec = [X - 6, H];
  const load: Vec = [X - 2, H - 7];
  const off: Vec = [X - 30, 86];
  const landR: Vec = [-land[0], land[1]];
  const vOff: Vec = [(landR[0] - off[0]) / T_FLY, (landR[1] - off[1] + 0.5 * G * T_FLY * T_FLY) / T_FLY];
  const vLand: Vec = [vOff[0], vOff[1] - G * T_FLY];
  const herm = (u: number, p0: number, p1: number, v0: number, v1: number, h: number) => {
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * v0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * v1;
  };
  // Pelvis in a half where the support is L, arriving from the left (velocity mirrored from vLand).
  const vIn: Vec = [-vLand[0], vLand[1]];
  const pelvisHalf = (t: number): Vec => {
    if (t < T_ABS) {
      const u = t / T_ABS;
      return [herm(u, land[0], stick[0], vIn[0], 0, T_ABS), herm(u, land[1], stick[1], vIn[1], 0, T_ABS)];
    }
    let a = t - T_ABS;
    if (a < T_HOLD) return [stick[0], stick[1] - 0.6 * Math.sin((Math.PI * a) / T_HOLD)];
    a -= T_HOLD;
    if (a < T_LOAD) {
      const u = a / T_LOAD;
      return [herm(u, stick[0], load[0], 0, 0, T_LOAD), herm(u, stick[1], load[1], 0, 0, T_LOAD)];
    }
    a -= T_LOAD;
    if (a < T_PUSH) {
      const u = a / T_PUSH;
      return [herm(u, load[0], off[0], 0, vOff[0], T_PUSH), herm(u, load[1], off[1], 0, vOff[1], T_PUSH)];
    }
    a -= T_PUSH;
    return [off[0] + vOff[0] * a, off[1] + vOff[1] * a - 0.5 * G * a * a];
  };
  const tOff = T_ABS + T_HOLD + T_LOAD + T_PUSH;
  // Arm swing: +1 = swung toward screen right (just landed on the right foot), -1 = toward screen left.
  const swingHalf = (t: number) => {
    if (t < tOff - T_PUSH - T_LOAD) return 1;
    if (t < tOff - T_PUSH) return 1 + 0.25 * mj((t - (tOff - T_PUSH - T_LOAD)) / T_LOAD);
    return 1.25 - 2.25 * mj((t - (tOff - T_PUSH)) / ((T_PUSH + T_FLY) * 0.97));
  };
  const armsFor = (p: Pose, a: number): Pose => {
    let out = p;
    const P = forwardKinematics(p, "front").pts;
    const T2 = p.trunk + p.spine;
    const r = frontOf(T2);
    const u = up(T2);
    for (const s of ["L", "R"] as const) {
      const k = s === "L" ? 1 : -1;
      const sh = P[`shoulder${s}`];
      // Toward its own side (out and back) when a·k > 0, across the chest when a·k < 0.
      const q = Math.max(-1.25, Math.min(1.25, a * k));
      const outE: Vec = [k * 15, -23];
      const outH: Vec = [k * 26, -46];
      const acrossE: Vec = [-k * 4, -22];
      const acrossH: Vec = [-k * 24, -10];
      const midE: Vec = [k * 8, -24];
      const midH: Vec = [k * 1, -32];
      const pick = (o: Vec, m: Vec, c: Vec): Vec => (q >= 0 ? [m[0] + (o[0] - m[0]) * q, m[1] + (o[1] - m[1]) * q] : [m[0] + (c[0] - m[0]) * -q, m[1] + (c[1] - m[1]) * -q]);
      const e = pick(outE, midE, acrossE);
      const h = pick(outH, midH, acrossH);
      out = armThrough(out, s, add(add(sh, r, e[0]), u, e[1]), add(add(sh, r, h[0]), u, h[1]), "front");
    }
    return out;
  };
  const n = Math.round((2 * HALF) / KEY_DT);
  const dt = (2 * HALF) / n;
  const keyframes: Keyframe[] = [];
  // The loop starts while the first landing is held (a calm frame), not at the instant of touchdown.
  const t0 = T_ABS + T_HOLD * 0.5;
  for (let i = 0; i < n; i++) {
    const t = (i * dt + t0) % (2 * HALF);
    const second = t >= HALF;
    const th = second ? t - HALF : t;
    const m = second ? -1 : 1; // mirror for the second half (standing on R, bounding right)
    const pRaw = pelvisHalf(th);
    const pel: Vec = [m * pRaw[0], pRaw[1]];
    const stanceS: Side = second ? "R" : "L";
    const freeS: Side = second ? "L" : "R";
    const a = m * swingHalf(th);
    const flying = th >= tOff;
    const lean = flying ? -m * 5 * mj((th - tOff) / T_FLY) : m * 5 * (1 - mj(Math.max(0, th - (tOff - T_PUSH)) / T_PUSH));
    const hinge = flying ? 30 - 14 * Math.sin((Math.PI * (th - tOff)) / T_FLY) : 30;
    let p = pose({ trunk: lean, spine: lean * 0.3, neck: -lean * 1.2, trunkD: hinge });
    p = armsFor(p, a);
    // Stance leg on its foot until takeoff; then it trails, folding under its hip.
    const stanceSole: Vec = [m * X, 0];
    const freeRest = (pp: Vec, s: Side): Vec => [pp[0] + (s === "L" ? 13 : -13), 17];
    if (!flying) {
      p = frontLeg(p, stanceS, pel, stanceSole, 0.93);
      // The free foot hangs under its hip off the floor; during the push it starts to reach toward the landing.
      const rest = freeRest(pel, freeS);
      const reach = th > tOff - T_PUSH ? mj((th - (tOff - T_PUSH)) / T_PUSH) * 0.25 : 0;
      const landSole: Vec = [-m * X, 0];
      p = frontLeg(p, freeS, pel, [rest[0] + (landSole[0] - rest[0]) * reach, rest[1] + (8 - rest[1]) * reach]);
    } else {
      const u = (th - tOff) / T_FLY;
      // Takeoff leg: from its foot on the floor to hanging under its hip.
      const rel0: Vec = [stanceSole[0] - m * off[0], -off[1]];
      const rest = freeRest(pel, stanceS);
      const rel1: Vec = [rest[0] - pel[0], rest[1] - pel[1]];
      const k1 = mj(Math.min(1, u * 1.15));
      p = frontLeg(p, stanceS, pel, [pel[0] + rel0[0] + (rel1[0] - rel0[0]) * k1, Math.max(0.5, pel[1] + rel0[1] + (rel1[1] - rel0[1]) * k1)]);
      // Landing leg: reaches out and down to the landing spot, arriving as the pelvis does.
      const startRest = freeRest([m * off[0], off[1]], freeS);
      const start: Vec = [startRest[0] + (-m * X - startRest[0]) * 0.25, startRest[1] + (8 - startRest[1]) * 0.25];
      const relS: Vec = [start[0] - m * off[0], start[1] - off[1]];
      const relE: Vec = [-m * X - m * landR[0], -landR[1]];
      const k2 = mj(u);
      p = frontLeg(p, freeS, pel, [pel[0] + relS[0] + (relE[0] - relS[0]) * k2, Math.max(0, pel[1] + relS[1] + (relE[1] - relS[1]) * k2)]);
    }
    keyframes.push({ pose: p, root: { pin: "pelvis", at: pel }, dur: dt, ease: "spline" });
  }
  return { id, view: "front", label, keyframes, props: [], footGrounded: false, stillPhase: 0.12 };
}
