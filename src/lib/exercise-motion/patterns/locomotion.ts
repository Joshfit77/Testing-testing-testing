import { BODY } from "../skeleton";
import {
  armsLocal,
  both,
  gaitAt,
  keys,
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
