import { BODY } from "../skeleton";
import {
  armsLocal,
  both,
  gaitAt,
  keys,
  plantLeg,
  pose,
  trackSteps,
  worldPts,
  type Anchor,
  type MotionDef,
  type Pose,
  type PropDef,
  type StepFrame,
} from "../build";

type Table = [number, number, number, number][];

// Sagittal joint angles over a stride (phase, hip flexion from vertical, knee flexion, ankle dorsiflexion).
const WALK: Table = [
  [0, 24, 3, 0],
  [0.1, 21, 14, -6],
  [0.25, 10, 9, 4],
  [0.4, -3, 5, 10],
  [0.5, -12, 10, 6],
  [0.6, -8, 36, -16],
  [0.7, 8, 58, -8],
  [0.82, 24, 46, 0],
  [0.92, 28, 16, 2],
];
const JOG: Table = [
  [0, 28, 14, 2],
  [0.1, 18, 36, 16],
  [0.24, -4, 22, 8],
  [0.34, -16, 14, -22],
  [0.46, -4, 62, -10],
  [0.62, 28, 105, -4],
  [0.76, 46, 72, 0],
  [0.9, 38, 26, 4],
];
const SPRINT: Table = [
  [0, 42, 24, 6],
  [0.1, 28, 40, 16],
  [0.22, 0, 26, 6],
  [0.32, -22, 18, -26],
  [0.45, 8, 112, -14],
  [0.6, 62, 132, -4],
  [0.75, 80, 82, 0],
  [0.9, 62, 34, 6],
];
const MARCH: Table = [
  [0, 0, 2, 0],
  [0.25, 0, 2, 0],
  [0.5, 0, 2, 0],
  [0.62, 40, 55, 0],
  [0.75, 70, 85, 2],
  [0.88, 40, 55, 0],
];
const ASKIP: Table = [
  [0, 0, 6, 0],
  [0.2, -8, 8, -18],
  [0.35, 10, 60, -5],
  [0.55, 75, 95, 14],
  [0.7, 72, 90, 12],
  [0.85, 30, 20, 4],
];

export type GaitKind = "walk" | "jog" | "sprint" | "accel" | "march" | "askip" | "bound" | "ladder";
export type CarryHold = "swing" | "run" | "farmer" | "suitcase" | "hug" | "yoke" | "zercher" | "keg" | "trap" | "handles" | "sled-push" | "strap" | "guard";

export interface GaitOpts {
  id: string;
  label: string;
  kind: GaitKind;
  hold?: CarryHold;
  /** Seconds per full stride (two steps). */
  cycle?: number;
  lean?: number;
  /** Scale of the stride (joint ranges). */
  stride?: number;
  props?: PropDef[];
}

function armHold(p: Pose, hold: CarryHold, hipR: number, hipL: number, k: number): Pose {
  const T2 = p.trunk + p.spine;
  switch (hold) {
    case "swing":
      return { ...p, shR: -0.8 * hipR + T2 + 4, shL: -0.8 * hipL + T2 + 4, elR: 22, elL: 22 };
    case "run":
    case "guard":
      return { ...p, shR: -1.0 * hipR * k + T2 + 10, shL: -1.0 * hipL * k + T2 + 10, elR: 88, elL: 88 };
    case "farmer":
    case "trap":
    case "handles":
      return { ...p, shR: T2 + 3, shL: T2 + 3, elR: 3, elL: 3, armDL: 10, armDR: 10 };
    case "suitcase":
      return { ...p, shR: T2 + 2, elR: 3, shL: -0.6 * hipL + T2 + 4, elL: 20 };
    case "hug":
    case "keg":
      return armsLocal(p, [15, -24], [24, -6]);
    case "zercher":
      return armsLocal(p, [17, -24], [20, -6]);
    case "yoke":
      return armsLocal(p, [-12, -14], [-6, -4]);
    case "sled-push":
      return armsLocal(p, [26, -12], [52, -14]);
    case "strap":
      return { ...p, shR: -0.8 * hipR + T2 + 4, shL: -0.8 * hipL + T2 + 4, elR: 30, elL: 30 };
  }
}

export function gait(o: GaitOpts): MotionDef {
  const table = o.kind === "walk" ? WALK : o.kind === "jog" || o.kind === "ladder" ? JOG : o.kind === "march" ? MARCH : o.kind === "askip" ? ASKIP : SPRINT;
  const lean = o.lean ?? (o.kind === "walk" ? 3 : o.kind === "jog" || o.kind === "ladder" ? 8 : o.kind === "accel" ? 38 : o.kind === "march" ? 0 : o.kind === "askip" ? 2 : 12);
  const cycle = o.cycle ?? (o.kind === "walk" ? 1.15 : o.kind === "jog" ? 0.76 : o.kind === "ladder" ? 0.5 : o.kind === "march" ? 1.2 : o.kind === "askip" ? 0.9 : o.kind === "bound" ? 1 : 0.58);
  const hold = o.hold ?? (o.kind === "walk" || o.kind === "march" ? "swing" : "run");
  const k = o.stride ?? (o.kind === "ladder" ? 0.55 : o.kind === "bound" ? 1.15 : 1);
  const N = o.kind === "march" || o.kind === "askip" ? 8 : 10;
  // Stance windows (fraction of the stride from right-foot contact).
  const stanceEnd = o.kind === "walk" || o.kind === "march" ? 0.5 : o.kind === "jog" || o.kind === "ladder" ? 0.34 : o.kind === "askip" ? 0.5 : o.kind === "bound" ? 0.26 : 0.32;
  const frames: StepFrame[] = [];
  for (let i = 0; i < N; i++) {
    const ph = i / N;
    const [hR, kR, aR] = gaitAt(table, ph);
    const [hL, kL, aL] = gaitAt(table, ph + 0.5);
    const T = lean + (o.kind === "accel" ? 0 : 0);
    let p = pose({
      trunk: T,
      neck: -Math.max(0, T - 8) * 0.5,
      hipR: hR * k + T,
      hipL: hL * k + T,
      kneeR: kR * Math.min(1.1, k),
      kneeL: kL * Math.min(1.1, k),
      ankleR: aR,
      ankleL: aL,
    });
    p = armHold(p, hold, hR, hL, k);
    const inR = ph < stanceEnd;
    const inL = ph >= 0.5 && ph < 0.5 + stanceEnd;
    const stance: StepFrame["stance"] = o.kind === "walk" || o.kind === "march" ? (ph < 0.5 ? "R" : "L") : inR ? "R" : inL ? "L" : "none";
    const flight = stance === "none";
    frames.push({ pose: p, stance, dur: cycle / N, lift: flight ? (o.kind === "bound" ? 16 : o.kind === "sprint" || o.kind === "accel" ? 7 : o.kind === "askip" ? 5 : 4) : 0 });
  }
  const { keyframes, travel } = trackSteps(frames);
  const march = o.kind === "march";
  if (march) for (const kf of keyframes) kf.root = { ground: 0 };
  const props: PropDef[] = [...(o.props ?? [])];
  return {
    id: o.id,
    view: "side",
    label: o.label,
    keyframes,
    props,
    travel: march ? 0 : travel,
    footGrounded: o.kind === "walk" || march,
    stillPhase: 0.3,
  };
}

/** Cubic Hermite interpolation between (t0, y0, slope m0) and (t1, y1, slope m1) at t. */
function hermite(t: number, t0: number, t1: number, y0: number, y1: number, m0: number, m1: number): number {
  const h = t1 - t0;
  const u = (t - t0) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * h * m1;
}

/** Piecewise-linear interpolation through `[time, value]` points (clamped at the ends). */
function through(t: number, pts: [number, number][]): number {
  if (t <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [t1, v1] = pts[i]!;
    const [t0, v0] = pts[i - 1]!;
    if (t <= t1) return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return pts[pts.length - 1]![1];
}

const smooth = (u: number) => u * u * (3 - 2 * u);

/**
 * A-skip: the sprint drill (as coached: knee up and toe up, the foot driven down under the hips, opposite arm and leg,
 * tall posture, a rhythmic skip). Authored as a body path plus fixed foot contacts instead of the generic gait tables,
 * which give a march with no flight phase.
 *
 * One half-cycle (0.46 s) starts as the support leg lands, with the other leg already at the top of its knee drive:
 *   stance, 0.30 s   The ball of the foot touches down just ahead of the hip with the shank near vertical (heel about
 *                    14° up), then the foot is held still on the floor while the body travels over it at a constant
 *                    1.2 m/s: the knee gives to about 40° and the ankle dorsiflexes at the lowest point of the body,
 *                    then the hip, knee and ankle extend (a small hop) until toe-off. The foot is placed by inverse
 *                    kinematics, so it cannot slide; the pelvis height follows a smooth dip-and-push curve.
 *   flight, 0.16 s   The pelvis follows a real ballistic path (gravity). The support leg swings through with the heel
 *                    tucked and its knee rising to the top; the leg that was up reaches down and slightly back for the
 *                    ground, accelerating, and lands as the roles swap. The second half mirrors the first.
 * Top of the drive: thigh about 4° below horizontal, knee about 96°, ankle dorsiflexed, foot under the knee. The arms
 * swing from the shoulder with the elbows near 90°, each opposite its own leg, passing each other mid-way.
 */
export const A_SKIP = {
  /** Seconds per half-cycle (one support foot + flight); a full right-left cycle is twice this. */
  half: 0.46,
  stance: 0.3,
  /** Forward speed of the body, cm/s. */
  speed: 120,
  /** Ball of the foot ahead of the pelvis at touchdown, cm. */
  ballAhead: 16,
  trunk: 5,
  spine: 2,
  /** Time step between authored keyframes (dense, so the curves below are reproduced faithfully). */
  dt: 0.02,
} as const;

export function aSkip(id: string, label: string): MotionDef {
  const { half: T_HALF, stance: T_ST, speed: V, ballAhead, trunk: TRUNK, spine: SPINE, dt: DT } = A_SKIP;
  const G = 980; // cm/s²
  const T_FL = T_HALF - T_ST;
  // Foot angle (+ = toes up) while the support foot is on the floor: ball strike with the heel up, the heel settles in
  // mid-stance, then rises into toe-off.
  const FOOT_ROT: [number, number][] = [
    [0, -14],
    [0.08, -10],
    [0.15, -7],
    [0.22, -18],
    [0.27, -38],
    [T_ST, -52],
  ];
  // Pelvis height: lands at yTd, dips to yMin in mid-stance, pushes up to yTo at toe-off, then flies ballistically.
  const Y_TD = 100;
  const Y_MIN = 92.5;
  const Y_TO = 103.2;
  const VY_TO = (Y_TD - Y_TO) / T_FL + 0.5 * G * T_FL;
  const VY_LAND = VY_TO - G * T_FL;
  const T_MIN = 0.14;
  const pelvisY = (tau: number) =>
    tau <= T_MIN ? hermite(tau, 0, T_MIN, Y_TD, Y_MIN, VY_LAND, 0) : tau <= T_ST ? hermite(tau, T_MIN, T_ST, Y_MIN, Y_TO, 0, VY_TO) : Y_TO + VY_TO * (tau - T_ST) - 0.5 * G * (tau - T_ST) ** 2;
  /** The leg that is up (D) through the stance, then reaches down in flight (angles: thigh from vertical, knee, ankle). */
  const D_STANCE: [number, [number, number, number]][] = [
    [0, [86, 96, 14]],
    [0.1, [82, 94, 14]],
    [0.2, [70, 86, 12]],
    [T_ST, [52, 72, 6]],
  ];
  const D_TOP: [number, number, number] = [86, 96, 14];
  const base = (support: "R" | "L"): Pose =>
    pose({ trunk: TRUNK, spine: SPINE, neck: -(TRUNK + SPINE) + 1, [`sh${support}`]: 0 } as Partial<Pose>);
  const leg3 = (p: Pose, s: "R" | "L"): [number, number, number] => [p[`hip${s}`] - TRUNK, p[`knee${s}`], p[`ankle${s}`]];
  const lerp3 = (a: [number, number, number], b: [number, number, number], u: number): [number, number, number] => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

  const keyframes: ReturnType<typeof trackSteps>["keyframes"] = [];
  const N = Math.round(T_HALF / DT);
  let touchdown: [number, number, number] | null = null;
  for (let h = 0; h < 2; h++) {
    const support: "R" | "L" = h === 0 ? "R" : "L";
    const drive: "R" | "L" = h === 0 ? "L" : "R";
    const x0 = V * T_HALF * h;
    const ballX = x0 + ballAhead;
    // Support-leg angles at touchdown (IK), the end point of the other leg's reach.
    if (!touchdown) {
      const p0 = plantLeg(base(support), support, [x0, pelvisY(0)], [ballX, 0], through(0, FOOT_ROT));
      touchdown = leg3(p0, support);
    }
    let toeOff: [number, number, number] | null = null;
    for (let i = 0; i < N; i++) {
      const tau = i * DT;
      const px = x0 + V * tau;
      const py = pelvisY(tau);
      let p = base(support);
      // Arms: swing from the shoulder, each opposite its leg; the support-side arm is forward at touchdown.
      const c = Math.cos((Math.PI * tau) / T_HALF);
      p = { ...p, [`sh${support}`]: 10 + 58 * c, [`sh${drive}`]: 10 - 58 * c, [`el${support}`]: 96 - 6 * c, [`el${drive}`]: 96 + 6 * c };
      const set = (s: "R" | "L", v: [number, number, number]) => ({ ...p, [`hip${s}`]: v[0] + TRUNK, [`knee${s}`]: v[1], [`ankle${s}`]: v[2] }) as Pose;
      if (tau <= T_ST + 1e-9) {
        // Stance: the support foot is planted by IK; the other leg holds its knee up, then starts to come down.
        const dv = [0, 1, 2].map((k) => through(tau, D_STANCE.map(([t, v]) => [t, v[k]!] as [number, number]))) as [number, number, number];
        p = set(drive, dv);
        p = plantLeg(p, support, [px, py], [ballX, 0], through(tau, FOOT_ROT));
        if (Math.abs(tau - T_ST) < 1e-9) toeOff = leg3(p, support);
      } else {
        const u = (tau - T_ST) / T_FL;
        const sv = toeOff!;
        // Support leg swings through: the knee folds early (heel recovery), the thigh follows, the ankle dorsiflexes.
        const sw: [number, number, number] = [
          sv[0] + (D_TOP[0] - sv[0]) * smooth(Math.min(1, u * 1.15)),
          sv[1] + (D_TOP[1] - sv[1]) * smooth(Math.min(1, u * 1.8)),
          sv[2] + (D_TOP[2] - sv[2]) * smooth(u),
        ];
        // The other leg reaches down for the ground, accelerating towards the strike.
        const dStart = D_STANCE[D_STANCE.length - 1]![1];
        const dv = lerp3(dStart, touchdown, u * u * (1.6 - 0.6 * u));
        p = set(support, sw);
        p = set(drive, dv);
      }
      // Re-apply the arms (set() spread the old pose).
      p = { ...p, [`sh${support}`]: 10 + 58 * c, [`sh${drive}`]: 10 - 58 * c, [`el${support}`]: 96 - 6 * c, [`el${drive}`]: 96 + 6 * c };
      keyframes.push({ pose: p, root: { pin: "pelvis", at: [px, py] }, dur: DT, ease: "spline" });
    }
  }
  // Still image: the left foot has just landed and the near (right) knee is at the top of its drive.
  return { id, view: "side", label, keyframes, props: [], travel: V * T_HALF * 2, footGrounded: false, stillPhase: 0.52 };
}

/** Carries: walking with the implement held. */
export function carry(id: string, label: string, hold: CarryHold): MotionDef {
  const props: PropDef[] = [];
  const shortStride = hold === "yoke" || hold === "keg" || hold === "zercher" || hold === "hug";
  switch (hold) {
    case "farmer":
      props.push(
        { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "profile", angle: 0, layer: "far" },
        { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", angle: 0, layer: "near" },
      );
      break;
    case "suitcase":
      props.push({ id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", angle: 0, layer: "near" });
      break;
    case "hug":
      props.push({ id: "bag", kind: "sandbag", at: { lm: "belly", dx: 15, dy: 12 }, w: 34, h: 42, angle: 80, layer: "near" });
      break;
    case "keg":
      props.push({ id: "keg", kind: "keg", at: { lm: "belly", dx: 19, dy: 14 }, w: 32, h: 48, layer: "near" });
      break;
    case "yoke":
      props.push({ id: "yoke", kind: "yoke", at: { lm: "trap" }, layer: "front" });
      break;
    case "zercher":
      props.push({ id: "bar", kind: "barbell", at: { lm: "elbowR", dx: 3, dy: 6 }, layer: "front" });
      break;
    case "trap":
      props.push({ id: "bar", kind: "trapBar", at: { lm: "hands" }, layer: "front" });
      break;
    case "handles":
      props.push({ id: "h", kind: "farmerHandle", at: { lm: "hands" }, layer: "front" });
      break;
    case "sled-push":
      props.push({ id: "sled", kind: "sled", at: { lm: "hands", dx: 38, y: 0 }, variant: "push", layer: "front" });
      break;
    case "strap":
      props.push(
        { id: "sled", kind: "sled", at: { lm: "pelvis", dx: -170, y: 0 }, layer: "back" },
        { id: "strap", kind: "rope", at: { lm: "pelvis", dx: -4 }, to: { lm: "pelvis", dx: -130, y: 14 }, layer: "near" },
      );
      break;
    default:
      break;
  }
  return gait({
    id,
    label,
    kind: hold === "sled-push" ? "accel" : "walk",
    hold,
    cycle: hold === "sled-push" ? 1.1 : shortStride ? 1.2 : 1.15,
    stride: hold === "sled-push" ? 0.7 : shortStride ? 0.7 : 0.85,
    lean: hold === "sled-push" ? 45 : hold === "strap" ? 14 : hold === "yoke" ? 2 : 3,
    props,
  });
}

/** Lateral shuffle in the frontal plane: two steps one way, two steps back. */
export function lateralShuffle(id: string, label: string, opts: { touch?: boolean; cones?: boolean; steps?: number } = {}): MotionDef {
  const stance = (hipL: number, hipR: number, knee = 40, extra: Partial<Pose> = {}) =>
    pose({ trunk: 0, hipL, hipR, kneeL: knee, kneeR: knee, ankleL: -hipL * 0.6, ankleR: -hipR * 0.6, ...both({ sh: 22, el: 70, armD: 30 }), ...extra });
  const frames: StepFrame[] = [];
  const steps = opts.steps ?? 2;
  const one = (dir: 1 | -1) => {
    // dir +1: move toward screen right (lead = L).
    const lead = dir === 1 ? "L" : "R";
    const trail = dir === 1 ? "R" : "L";
    const wide = stance(24, 24);
    const reach = lead === "L" ? stance(40, 12, 36) : stance(12, 40, 36);
    const close = lead === "L" ? stance(14, 10, 42) : stance(10, 14, 42);
    frames.push({ pose: wide, stance: trail, dur: 0.12 });
    frames.push({ pose: reach, stance: trail, dur: 0.12, lift: 2 });
    frames.push({ pose: wide, stance: lead, dur: 0.12 });
    frames.push({ pose: close, stance: lead, dur: 0.12, lift: 1 });
  };
  const touch = (dir: 1 | -1) => {
    const s = dir === 1 ? "L" : "R";
    const p = stance(30, 30, 80, { trunk: dir * 22, spine: dir * 10, [`sh${s}`]: 10, [`el${s}`]: 0 } as Partial<Pose>);
    frames.push({ pose: p, stance: dir === 1 ? "L" : "R", dur: 0.3, hold: 0.1 });
  };
  for (let i = 0; i < steps; i++) one(1);
  if (opts.touch) touch(1);
  for (let i = 0; i < steps; i++) one(-1);
  if (opts.touch) touch(-1);
  const { keyframes, travel } = trackSteps(frames, "front");
  const props: PropDef[] = [];
  if (opts.cones) {
    const xs = keyframes.map((k) => ("ground" in k.root ? k.root.ground : 0));
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    props.push({ id: "c1", kind: "cone", at: [lo - 45, 0], layer: "back" }, { id: "c2", kind: "cone", at: [hi + 45, 0], layer: "back" });
  }
  return {
    id,
    view: "front",
    label,
    keyframes: keyframes.map((k) => ({ ...k, ease: "inOut" })),
    props,
    travel: Math.abs(travel) < 1 ? 0 : travel,
    footGrounded: false,
    stillPhase: 0.15,
  };
}

/** Jump rope: quick bounces on the balls of the feet while the rope turns. */
export function jumpRope(id: string, label: string): MotionDef {
  const base = (bend: number) =>
    pose({ trunk: 2, ...both({ hip: 6 + bend * 0.6, knee: 8 + bend, ankle: -14 + bend * 0.5, sh: 18, el: 70, armD: 35 }) });
  const rope: Anchor[] = [
    { lm: "headTop", dy: 16 },
    { lm: "pelvis", dx: 52, dy: 10 },
    { lm: "soleR", dx: 4, y: 0.6 },
    { lm: "pelvis", dx: -50, dy: 4 },
  ];
  const lifts = [1, 4, 7, 3];
  const bends = [12, 4, 2, 8];
  const frames = rope.map((r, i) => ({ pose: base(bends[i]!), root: { ground: 0, lift: lifts[i]! } as const, dur: 0.11, ease: "linear" as const, props: { rope: r } }));
  return {
    id,
    view: "side",
    label,
    keyframes: keys({ ground: 0 }, frames),
    props: [{ id: "rope", kind: "jumpRope", at: rope[0]!, layer: "near" }],
    stillPhase: 0.5,
  };
}

/** Standing in place with a slow sway (balance, posing practice, holds). */
export function standHold(id: string, label: string, p: Pose, sway = 1.5, view: "side" | "front" = "side"): MotionDef {
  const a = { ...p, trunk: p.trunk + sway * 0.5 };
  const b = { ...p, trunk: p.trunk - sway * 0.5 };
  return {
    id,
    view,
    label,
    keyframes: keys(view === "side" ? { pin: "soleR", at: [0, 0] } : { ground: 0 }, [
      { pose: a, dur: 1.8, ease: "inOut" },
      { pose: b, dur: 1.8, ease: "inOut" },
    ]),
    props: [],
    footGrounded: true,
    stillPhase: 0,
  };
}

export { worldPts, BODY };
