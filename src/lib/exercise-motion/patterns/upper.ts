import { BODY, ankleForSole } from "../skeleton";
import {
  FEET,
  armThrough,
  armTo,
  armsLocal,
  both,
  keys,
  legTo,
  lm,
  mix,
  pose,
  shoulderLocal,
  solve1D,
  stanceLegs,
  worldPts,
  type KeySpec,
  type MotionDef,
  type Pose,
  type PropDef,
  type RootRule,
  type Side,
  type Vec,
} from "../build";

const ARM = BODY.upperArm + BODY.forearm;
const BENCH_TOP = 44;

/** Convert a world point to the pose's pelvis-origin frame for a given root rule. */
function toLocal(p: Pose, rule: RootRule, world: Vec, view: "side" | "front" = "side"): Vec {
  const w = worldPts(p, rule, view).pelvis;
  return [world[0] - w[0], world[1] - w[1]];
}

function legsTo(p: Pose, rule: RootRule, ankleWorld: Vec, sides: Side[] = ["L", "R"], rot = 0): Pose {
  let out = p;
  for (const s of sides) out = legTo(out, s, toLocal(out, rule, ankleWorld), rot);
  return out;
}

function handsTo(p: Pose, rule: RootRule, handWorld: Vec, sides: Side[] = ["L", "R"]): Pose {
  let out = p;
  for (const s of sides) out = armTo(out, s, toLocal(out, rule, handWorld));
  return out;
}

const ik2 = (hand: Vec, extra: Record<string, Vec> = {}) => ({ handL: hand, handR: hand, ...extra });

// ------------------------------------------------------------------------------------------------ Bench

export interface BenchOpts {
  id: string;
  label: string;
  implement?: "barbell" | "dumbbell";
  incline?: number;
  /** Seconds lowering / pressing, holds. */
  down?: number;
  up?: number;
  holdBottom?: number;
  /** "close" = narrow grip, elbows tucked. */
  grip?: "normal" | "close" | "dumbbell";
  /** Pins / spotter arms at this bar height above the chest (pin press). */
  pins?: boolean;
}

export function benchPress(o: BenchOpts): MotionDef {
  const incline = o.incline ?? 0;
  const T = -90 + incline;
  const root: RootRule = incline ? { pin: "upperBack", at: [-20, BENCH_TOP + 22] } : { pin: "upperBack", at: [0, BENCH_TOP] };
  const armD = o.grip === "close" ? 12 : o.grip === "dumbbell" ? 30 : 26;
  let base = pose({ trunk: T, spine: incline ? -4 : -9, neck: incline ? 8 : -4, ...both({ armD }) });
  // Feet flat on the floor, shins about vertical.
  const pel = worldPts(base, root).pelvis;
  const footX = pel[0] + (incline ? 40 : 50);
  const ankle = ankleForSole(footX, 0);
  base = legsTo(base, root, ankle);
  const W = worldPts(base, root);
  const sh = W.shoulder;
  const chest = W.chest;
  // Bar path: lockout over the shoulder joint, touch on the lower chest (J-curve).
  const reach = ARM * Math.cos((armD * Math.PI) / 180 / 3) - 1.5;
  const upDir: Vec = incline ? [Math.sin(((incline * 0.6) * Math.PI) / 180) * 0, 1] : [0, 1];
  const top: Vec = [sh[0] + upDir[0] * reach, sh[1] + upDir[1] * reach];
  const touch: Vec =
    o.implement === "dumbbell"
      ? [chest[0] - 2, chest[1] + 2]
      : o.grip === "close"
        ? [chest[0] + 3, chest[1] + 4]
        : [chest[0] + (incline ? -3 : 6), chest[1] + 3];
  const midDown: Vec = [(top[0] + touch[0]) / 2 + 2, (top[1] + touch[1]) / 2];
  const P = (h: Vec) => handsTo(base, root, h);
  const ft = { footL: ankle, footR: ankle };
  const pinsY = touch[1] + 6;
  const bottom: Vec = o.pins ? [touch[0], pinsY] : touch;
  const specs: KeySpec[] = [
    { pose: P(top), dur: (o.down ?? 2) * 0.5, hold: 0.35, ease: "spline", ik: ik2(top, ft) },
    { pose: P(midDown), dur: (o.down ?? 2) * 0.5, ease: "spline", ik: ik2(midDown, ft) },
    { pose: P(bottom), dur: (o.up ?? 1) * 0.5, hold: o.holdBottom ?? 0.1, ease: "spline", ik: ik2(bottom, ft) },
    { pose: P(midDown), dur: (o.up ?? 1) * 0.5, ease: "spline", ik: ik2(midDown, ft) },
  ];
  const props: PropDef[] = [];
  if (incline) props.push({ id: "bench", kind: "inclineBench", at: [W.butt[0] - 2, BENCH_TOP + 2], angle: incline, layer: "mid", w: 80, h: 34 });
  else props.push({ id: "bench", kind: "bench", at: [W.mid[0] + 8, BENCH_TOP], w: 118, layer: "mid" });
  if (o.implement === "dumbbell") {
    props.push({ id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "end", layer: "far" });
    props.push({ id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "end", layer: "front" });
  } else {
    props.push({ id: "rack", kind: "rack", at: [sh[0] - 22, top[1] - 6], layer: "back", h: o.pins ? pinsY - 3 : undefined });
    props.push({ id: "bar", kind: "barbell", at: { lm: "hands" }, layer: "front" });
  }
  return {
    id: o.id,
    view: "side",
    label: o.label,
    keyframes: keys(root, specs),
    props,
    stillPhase: 0.5,
  };
}

/** Seated machine chest press. */
export function machineChestPress(id: string, label: string): MotionDef {
  const root: RootRule = { pin: "butt", at: [0, 50] };
  let base = pose({ trunk: -8, neck: 4, ...both({ hip: 82, knee: 85, ankle: -5, armD: 30 }) });
  base = legsTo(base, root, ankleForSole(42, 0));
  const W = worldPts(base, root);
  const sh = W.shoulder;
  const start: Vec = [sh[0] + 14, sh[1] - 6];
  const end: Vec = [sh[0] + ARM * 0.86, sh[1] - 4];
  const P = (h: Vec) => handsTo(base, root, h);
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: P(start), dur: 1, hold: 0.3, ease: "inOut", ik: ik2(start) },
      { pose: P(end), dur: 2, hold: 0.2, ease: "inOut", ik: ik2(end) },
    ]),
    props: [{ id: "m", kind: "chestPress", at: [W.butt[0] - 4, 50], to: { lm: "hands" }, layer: "mid" }],
    stillPhase: 0.3,
  };
}

// ---------------------------------------------------------------------------------------------- Push-up

export interface PushUpOpts {
  id: string;
  label: string;
  /** Hand support height (0 floor, ~45 bench/box, "wall"). */
  hands?: number | "wall";
  knees?: boolean;
  down?: number;
  up?: number;
  /** Only the plank hold (no reps). */
  hold?: boolean;
  /** Forearm plank. */
  forearms?: boolean;
}

/** Plank-line pose rotated about the toes; returns pose + world points for a body angle `T`. */
function plankPose(T: number, extra: Partial<Pose> = {}): Pose {
  // Legs straight in line with the trunk; toes tucked (foot roughly perpendicular to the floor).
  const shinA = -T; // thigh / shin down-angle equals -T when straight
  const rot = -82;
  return pose({ trunk: T, neck: -6, ...both({ hip: 0, knee: 0, ankle: rot - shinA }), ...extra });
}

export function pushUp(o: PushUpOpts): MotionDef {
  const wall = o.hands === "wall";
  const hh = typeof o.hands === "number" ? o.hands : 0;
  const root: RootRule = { pin: wall ? "soleR" : "toeR", at: [0, 0] };
  const make = (T: number): Pose => {
    if (wall) return pose({ ...stanceLegs(T, 0, T), neck: -4 });
    return plankPose(T);
  };
  if (o.forearms) {
    // Forearm plank: upper arms vertical, forearms flat on the floor.
    const at = (T: number) => {
      const p = make(T);
      const T2 = p.trunk + p.spine;
      return { ...p, shL: T2, shR: T2, elL: 90, elR: 90 };
    };
    const T = solve1D((t) => worldPts(at(t), root).elbowPadR[1], 50, 89);
    const p0 = at(T);
    const p1 = { ...at(T - 0.8), neck: -3 };
    return {
      id: o.id,
      view: "side",
      label: o.label,
      keyframes: keys(root, [
        { pose: p0, dur: 2, ease: "inOut" },
        { pose: p1, dur: 2, ease: "inOut" },
      ]),
      props: [{ id: "mat", kind: "mat", at: [worldPts(p0, root).pelvis[0], 0], w: 210, layer: "back" }],
      stillPhase: 0,
    };
  }
  // Hand target: under the shoulders at the top position (arms straight, vertical-ish).
  const armsDown = (p: Pose): Pose => {
    const T2 = p.trunk + p.spine;
    return { ...p, shL: T2, shR: T2, elL: 0, elR: 0 };
  };
  const supportY = (wall ? 0 : hh) + BODY.r.hand;
  let topT: number;
  let hand: Vec;
  let wallX = 0;
  if (wall) {
    topT = 18;
    const W = worldPts(armsDown(make(topT)), root);
    wallX = W.shoulder[0] + ARM * 0.92;
    hand = [wallX - BODY.r.hand, W.shoulder[1] - 4];
  } else {
    // Hands under the shoulders at the bottom (forearms vertical), arms straight at the top.
    const bT = solve1D((t) => worldPts(make(t), root).chest[1] - (hh + 7), 30, 92);
    const Wb = worldPts(make(bT), root);
    hand = [Wb.shoulder[0] - 1, supportY];
    topT = solve1D((t) => {
      const W2 = worldPts(make(t), root);
      return Math.hypot(hand[0] - W2.shoulder[0], hand[1] - W2.shoulder[1]) - (ARM - 1);
    }, 25, bT);
  }
  // Bottom: chest a few cm above the floor (or support), or nose near the wall.
  const botT = wall
    ? solve1D((t) => worldPts(make(t), root).foreheadFront[0] - (wallX - 8), topT, 45)
    : solve1D((t) => worldPts(make(t), root).chest[1] - (hh + 7), topT, 92);
  const P = (T: number) => {
    const p = make(T);
    const loc = toLocal(p, root, hand);
    return { ...armTo(armTo(p, "L", loc), "R", loc) };
  };
  const midT = (topT + botT) / 2;
  const holdOnly = o.hold;
  const props: PropDef[] = [];
  if (wall) props.push({ id: "wall", kind: "wall", at: [wallX, 0], layer: "back" });
  else if (hh > 0) props.push({ id: "box", kind: "box", at: [hand[0] + 4, 0], w: 46, h: hh, layer: "mid" });
  const specs: KeySpec[] = holdOnly
    ? [
        { pose: P(topT), dur: 2, ease: "inOut", ik: ik2(hand) },
        { pose: P(topT + 0.6), dur: 2, ease: "inOut", ik: ik2(hand) },
      ]
    : [
        { pose: P(topT), dur: (o.down ?? 1.6) * 0.5, hold: 0.3, ease: "spline", ik: ik2(hand) },
        { pose: P(midT), dur: (o.down ?? 1.6) * 0.5, ease: "spline", ik: ik2(hand) },
        { pose: P(botT), dur: (o.up ?? 1) * 0.5, hold: 0.15, ease: "spline", ik: ik2(hand) },
        { pose: P(midT), dur: (o.up ?? 1) * 0.5, ease: "spline", ik: ik2(hand) },
      ];
  return {
    id: o.id,
    view: "side",
    label: o.label,
    keyframes: keys(root, specs),
    props,
    planted: wall ? ["L", "R"] : undefined,
    footGrounded: true,
    stillPhase: 0.5,
  };
}

/** Pike push-up: hips high, head lowers toward the floor between the hands. */
export function pikePushUp(id: string, label: string): MotionDef {
  const root: RootRule = { pin: "toeR", at: [0, 0] };
  // Legs ~35° from vertical, trunk pointing down-forward.
  const make = (T: number, legLean: number): Pose => {
    const thighA = -legLean; // pointing down-back from the hips
    const rot = -75;
    return pose({ trunk: T, neck: 8, ...both({ hip: thighA + T, knee: 0, ankle: rot - thighA }) });
  };
  const armsLine = (p: Pose): Pose => ({ ...p, shL: 180 + p.trunk * 0, shR: 180, elL: 0, elR: 0 });
  const legLean = 38;
  const topT = solve1D((t) => worldPts(armsLine(make(t, legLean)), root).handR[1] - BODY.r.hand, 100, 170);
  const hand: Vec = [worldPts(armsLine(make(topT, legLean)), root).handR[0], BODY.r.hand];
  // Bottom: crown of the head just in front of the hands, a few cm off the floor; hips stay high.
  const target: Vec = [hand[0] + 10, 14];
  let best = { T: topT, lean: legLean, err: Infinity };
  for (let lean = legLean - 10; lean <= legLean + 25; lean += 1)
    for (let T = 95; T <= 178; T += 1) {
      const W = worldPts(make(T, lean), root);
      const reach = Math.hypot(hand[0] - W.shoulder[0], hand[1] - W.shoulder[1]);
      if (reach > ARM - 2) continue;
      const err = Math.hypot(W.headTop[0] - target[0], W.headTop[1] - target[1]);
      if (err < best.err) best = { T, lean, err };
    }
  const botT = best.T;
  const botLean = best.lean;
  const P = (T: number, lean: number) => {
    const p = make(T, lean);
    const loc = toLocal(p, root, hand);
    return armTo(armTo(p, "L", loc), "R", loc);
  };
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: P(topT, legLean), dur: 1, hold: 0.3, ease: "spline", ik: ik2(hand) },
      { pose: P((topT + botT) / 2, (legLean + botLean) / 2), dur: 1, ease: "spline", ik: ik2(hand) },
      { pose: P(botT, botLean), dur: 0.6, hold: 0.15, ease: "spline", ik: ik2(hand) },
      { pose: P((topT + botT) / 2, (legLean + botLean) / 2), dur: 0.6, ease: "spline", ik: ik2(hand) },
    ]),
    props: [],
    footGrounded: true,
    stillPhase: 0.5,
  };
}

// ------------------------------------------------------------------------------------- Overhead pressing

export interface PressOpts {
  id: string;
  label: string;
  implement?: "barbell" | "dumbbell" | "log" | "axle" | "kettlebell";
  /** Leg drive (push press). */
  drive?: boolean;
  /** One arm only (near arm), the other hand on the hip. */
  oneArm?: boolean;
  /** Seated on a bench. */
  seated?: boolean;
  /** Clean from the floor first (log / axle). */
  clean?: boolean;
}

export function overheadPress(o: PressOpts): MotionDef {
  const seated = Boolean(o.seated);
  const root: RootRule = seated ? { pin: "butt", at: [0, 48] } : FEET;
  const armD = o.implement === "dumbbell" ? 34 : 24;
  let stand = seated ? pose({ trunk: -2, ...both({ hip: 88, knee: 88, ankle: -2, armD }) }) : pose({ ...stanceLegs(1, 2, -2), ...both({ armD }) });
  const seatFeet = ankleForSole(46, 0);
  if (seated) stand = legsTo(stand, root, seatFeet);
  const W = worldPts(stand, root);
  const sh = W.shoulder;
  const midX = seated ? sh[0] + 1 : 1;
  // Rack: bar resting on the front delts (barbell) or dumbbells beside the ears.
  const rack: Vec = o.implement === "dumbbell" ? [sh[0] + 2, sh[1] + 6] : o.implement === "log" ? [sh[0] + 12, sh[1] + 6] : [sh[0] + 8, sh[1] + 4];
  const reach = ARM * Math.cos((armD * Math.PI) / 180 / 2.2) - 1;
  const lockout: Vec = [midX, sh[1] + reach + 1];
  const face: Vec = [midX + 3, W.head[1] + 2];
  const P = (h: Vec, extra: Partial<Pose> = {}) => {
    let p = { ...stand, ...extra };
    // Leaning the torso must not tilt the legs: hips are relative to the trunk.
    if (extra.trunk !== undefined && extra.hipL === undefined) {
      const d = extra.trunk - stand.trunk;
      p = { ...p, hipL: stand.hipL + d, hipR: stand.hipR + d };
    }
    const sides: Side[] = o.oneArm ? ["R"] : ["L", "R"];
    p = handsTo(p, root, h, sides);
    if (o.oneArm) p = armsLocal(p, [-10, -20], [4, -36], ["L"]);
    return p;
  };
  const ik = (h: Vec) => ({ ...(o.oneArm ? { handR: h } : ik2(h)), ...(seated ? { footL: seatFeet, footR: seatFeet } : {}) });
  const props: PropDef[] = [];
  if (o.implement === "dumbbell" || o.implement === "kettlebell") {
    props.push({ id: "dbR", kind: o.implement === "kettlebell" ? "kettlebell" : "dumbbell", at: { lm: "handR" }, orient: "end", layer: "front" });
    if (!o.oneArm) props.push({ id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "end", layer: "far" });
  } else if (o.implement === "log") props.push({ id: "log", kind: "log", at: { lm: "hands", dx: -2 }, layer: "front", size: 15 });
  else props.push({ id: "bar", kind: "barbell", at: { lm: "hands" }, layer: "front", variant: o.implement === "axle" ? "axle" : undefined, size: o.implement === "axle" ? 20 : undefined });
  if (seated) props.push({ id: "bench", kind: "inclineBench", at: [W.butt[0] - 6, 46], angle: 86, w: 70, h: 26, layer: "mid" });

  const specs: KeySpec[] = [];
  if (o.drive) {
    const dip = { ...pose({ ...stanceLegs(14, 26, -1) }), ...both({ armD }) };
    const drive = { ...pose({ ...stanceLegs(-12, 0, -2) }), ...both({ armD }) };
    const W2 = worldPts(P(rack, dip), root);
    const rackDip: Vec = [W2.rack[0] + 1, W2.rack[1] + 1];
    specs.push(
      { pose: P(rack), dur: 0.45, hold: 0.4, ease: "inOut", ik: ik(rack) },
      { pose: P(rackDip, dip), dur: 0.25, hold: 0.05, ease: "out", ik: ik(rackDip) },
      { pose: P(face, drive), dur: 0.35, ease: "linear", ik: ik(face) },
      { pose: P(lockout), dur: 1.2, hold: 0.5, ease: "inOut", ik: ik(lockout) },
    );
  } else {
    specs.push(
      { pose: P(rack), dur: 0.5, hold: 0.4, ease: "spline", ik: ik(rack) },
      { pose: P(face, { trunk: -5, neck: -16 }), dur: 0.5, ease: "spline", ik: ik(face) },
      { pose: P(lockout), dur: 0.9, hold: 0.45, ease: "spline", ik: ik(lockout) },
      { pose: P(face, { trunk: -5, neck: -16 }), dur: 0.9, ease: "spline", ik: ik(face) },
    );
  }
  if (o.clean) {
    // Lift from the floor to the rack first: deadlift to the hips, then roll to the chest.
    const floorY = o.implement === "log" ? 15 : 20;
    const hingeP = pose({ ...stanceLegs(14, 75, 50), ...both({ armD }) });
    let p0 = hingeP;
    const W0 = worldPts(p0, root);
    const floor: Vec = [W0.shoulder[0] - 2, floorY];
    p0 = handsTo(p0, root, floor);
    const lap = pose({ ...stanceLegs(10, 30, 20), ...both({ armD }) });
    const W1 = worldPts(lap, root);
    const lapH: Vec = [W1.hipCrease[0] + 8, W1.hipCrease[1] + 2];
    specs.unshift(
      { pose: p0, dur: 0.8, hold: 0.35, ease: "inOut", ik: ik2(floor) },
      { pose: handsTo(lap, root, lapH), dur: 0.6, ease: "inOut", ik: ik2(lapH) },
    );
    // After the press, lower back to the floor.
    specs.push({ pose: P(rack), dur: 0.7, ease: "inOut", ik: ik(rack) }, { pose: handsTo(lap, root, lapH), dur: 0.7, ease: "inOut", ik: ik2(lapH) });
  }
  return {
    id: o.id,
    view: "side",
    label: o.label,
    keyframes: keys(root, specs),
    props,
    planted: seated ? undefined : o.drive ? undefined : ["L", "R"],
    footGrounded: true,
    stillPhase: o.clean ? 0.55 : 0.5,
  };
}

/** Half-kneeling single-arm landmine press. */
export function landminePress(id: string, label: string): MotionDef {
  const root: RootRule = { pin: "kneeCapL", at: [0, 0] };
  // Far knee down, near foot forward.
  let p = pose({ trunk: 4, hipL: -6, kneeL: 92, ankleL: -40, hipR: 92, kneeR: 92, ankleR: 2, ...both({ armD: 24 }) });
  const W = worldPts(p, root);
  const sh = W.shoulder;
  const pivot: Vec = [sh[0] + 200, 0];
  const start: Vec = [sh[0] + 13, sh[1] - 3];
  // End: arm extended up-forward along the circle around the pivot.
  const R = Math.hypot(pivot[0] - start[0], pivot[1] - start[1]);
  const ang0 = Math.atan2(start[1] - pivot[1], start[0] - pivot[0]);
  let end: Vec = start;
  for (let a = ang0; a > ang0 - 0.6; a -= 0.005) {
    const q: Vec = [pivot[0] + Math.cos(a) * R, pivot[1] + Math.sin(a) * R];
    if (Math.hypot(q[0] - sh[0], q[1] - sh[1]) > ARM - 3) break;
    end = q;
  }
  p = { ...p };
  const P = (h: Vec) => armsLocal(handsTo(p, root, h, ["R"]), [-8, -20], [4, -38], ["L"]);
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: P(start), dur: 1, hold: 0.4, ease: "inOut", ik: { handR: start } },
      { pose: P(end), dur: 1.6, hold: 0.3, ease: "inOut", ik: { handR: end } },
    ]),
    props: [
      { id: "lm", kind: "landmine", at: pivot, to: { lm: "handR" }, layer: "near" },
      { id: "pad", kind: "pad", at: [0, 2], w: 26, layer: "back" },
    ],
    stillPhase: 0.4,
  };
}

/** Parallel-bar dip. */
export function dips(id: string, label: string): MotionDef {
  const bar: Vec = [0, 120];
  const root: RootRule = { pin: "handR", at: bar };
  const top = pose({ trunk: 8, ...both({ sh: 4, el: 4, hip: 10, knee: 70, ankle: -20, armD: 12 }) });
  const bottom = pose({ trunk: 24, neck: 4, ...both({ sh: -55, el: 100, hip: 30, knee: 75, ankle: -20, armD: 12 }) });
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: top, dur: 1, hold: 0.3, ease: "spline" },
      { pose: mix(top, bottom, 0.55), dur: 1, ease: "spline" },
      { pose: bottom, dur: 0.6, hold: 0.15, ease: "spline" },
      { pose: mix(top, bottom, 0.55), dur: 0.6, ease: "spline" },
    ]),
    props: [{ id: "bars", kind: "dipBars", at: [bar[0] + 4, bar[1] - 3], layer: "far" }],
    stillPhase: 0.5,
  };
}

// --------------------------------------------------------------------------------------------- Vertical pull

export interface HangOpts {
  id: string;
  label: string;
  grip?: "overhand" | "underhand";
  /** Hang only (dead hang) or knee raises instead of pulling. */
  mode?: "pull" | "hang" | "knee-raise";
  band?: boolean;
}

export function pullUp(o: HangOpts): MotionDef {
  const bar: Vec = [0, 232];
  const root: RootRule = { pin: "handR", at: bar };
  const under = o.grip === "underhand";
  const hangLegs = { hipL: -4, hipR: 6, kneeL: 25, kneeR: 15, ankleL: -25, ankleR: -25 };
  const bottom = pose({ trunk: -4, neck: -6, ...hangLegs, ...both({ sh: 176, el: 4, armD: under ? 10 : 24 }) });
  // Top: chin clearly over the bar (bar at the collarbones, hands just above the shoulders), slight lean back, legs only a little
  // forward. Hand relative to the shoulder (forward, up); the elbows point out to the sides, so the upper arm is
  // foreshortened in this view.
  const top = pose({ trunk: under ? -8 : -10, spine: -4, neck: -8, ...hangLegs, hipL: 2, hipR: 8 });
  if (o.mode === "hang") {
    const b2 = { ...bottom, trunk: -1, hipL: 0, hipR: 4 };
    return {
      id: o.id,
      view: "side",
      label: o.label,
      keyframes: keys(root, [
        { pose: bottom, dur: 2.2, ease: "inOut" },
        { pose: b2, dur: 2.2, ease: "inOut" },
      ]),
      props: [{ id: "bar", kind: "pullupBar", at: bar, layer: "back" }],
      stillPhase: 0,
    };
  }
  if (o.mode === "knee-raise") {
    const up = { ...bottom, trunk: -12, spine: 8, ...both({ hip: 105, knee: 100, ankle: -15 }) };
    return {
      id: o.id,
      view: "side",
      label: o.label,
      keyframes: keys(root, [
        { pose: bottom, dur: 1, hold: 0.4, ease: "spline" },
        { pose: mix(bottom, up, 0.5), dur: 1, ease: "spline" },
        { pose: up, dur: 0.9, hold: 0.3, ease: "spline" },
        { pose: mix(bottom, up, 0.5), dur: 0.9, ease: "spline" },
      ]),
      props: [{ id: "bar", kind: "pullupBar", at: bar, layer: "back" }],
      stillPhase: 0.5,
    };
  }
  // Keyframes sampled along the real elbow path: with an overhand grip the elbows sweep down and out to the sides
  // (seen end-on from here), with an underhand grip down and in front. θ = elbow angle from straight overhead.
  const gripOut = under ? 3 : 15; // hand's sideways offset from the shoulder
  const fwd = under ? 0.45 : 0.08; // share of the elbow's travel that shows as forward in this view
  const along = (theta: number): Pose => {
    const u = (theta - 20) / 115;
    const t = (theta * Math.PI) / 180;
    const ex = BODY.upperArm * Math.sin(t) * fwd;
    const lat = BODY.upperArm * Math.sin(t) * Math.sqrt(1 - fwd * fwd) - gripOut;
    const hx = ex + 2 + 4 * u;
    const ey = BODY.upperArm * Math.cos(t);
    const hy = ey + Math.sqrt(Math.max(0, BODY.forearm ** 2 - lat * lat - (hx - ex) ** 2));
    const q = armsLocal(mix(bottom, top, u), [ex, ey], [hx, hy]);
    // Straight arms at the bottom, never locked past straight.
    return { ...q, elL: Math.max(3, q.elL), elR: Math.max(3, q.elR) };
  };
  const thetas = [20, 58, 96, 135];
  const [b0, s1, s2, t3] = thetas.map(along) as [Pose, Pose, Pose, Pose];
  const props: PropDef[] = [{ id: "bar", kind: "pullupBar", at: bar, layer: "back" }];
  if (o.band) props.push({ id: "band", kind: "band", at: bar, to: { lm: "kneeR", dy: -4 }, layer: "near" });
  return {
    id: o.id,
    view: "side",
    label: o.label,
    keyframes: keys(root, [
      { pose: b0, dur: 0.35, hold: 0.4, ease: "spline" },
      { pose: s1, dur: 0.35, ease: "spline" },
      { pose: s2, dur: 0.4, ease: "spline" },
      { pose: t3, dur: 0.6, hold: 0.3, ease: "spline" },
      { pose: s2, dur: 0.6, ease: "spline" },
      { pose: s1, dur: 0.6, ease: "spline" },
    ]),
    props,
    stillPhase: 0.55,
  };
}

/** Seated lat pulldown. */
export function latPulldown(id: string, label: string): MotionDef {
  const root: RootRule = { pin: "butt", at: [0, 48] };
  let base = pose({ trunk: -4, ...both({ hip: 95, knee: 95, ankle: 0, armD: 30 }) });
  base = legsTo(base, root, ankleForSole(36, 0));
  const top = { ...base, ...both({ sh: 172, el: 6 }) };
  let bottom = { ...base, trunk: -16, neck: -6, hipL: base.hipL - 12, hipR: base.hipR - 12 };
  bottom = armsLocal(bottom, [-6, -16], [9, 4]);
  let mid = mix(top, bottom, 0.5);
  mid = armsLocal(mid, [-3, -6], [9, 26]);
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: top, dur: 0.6, hold: 0.3, ease: "spline" },
      { pose: mid, dur: 0.6, ease: "spline" },
      { pose: bottom, dur: 1, hold: 0.3, ease: "spline" },
      { pose: mid, dur: 1, ease: "spline" },
    ]),
    props: [{ id: "m", kind: "latPulldown", at: [-2, 48], to: { lm: "hands" }, layer: "mid" }],
    stillPhase: 0.6,
  };
}

/** Straight-arm cable pulldown. */
export function straightArmPulldown(id: string, label: string): MotionDef {
  const base = pose({ ...stanceLegs(6, 14, 28), neck: -8, ...both({ el: 8, armD: 18 }) });
  const top = { ...base, ...both({ sh: 150 + 0, el: 8 }) };
  const bottom = { ...base, ...both({ sh: 30, el: 8 }) };
  const W = worldPts(top, FEET);
  const pulley: Vec = [W.handR[0] + 40, W.handR[1] + 40];
  return {
    id,
    view: "side",
    label,
    keyframes: keys(FEET, [
      { pose: top, dur: 1, hold: 0.3, ease: "inOut" },
      { pose: bottom, dur: 2, hold: 0.3, ease: "inOut" },
    ]),
    props: [
      { id: "tower", kind: "cableTower", at: [pulley[0] + 12, 0], h: pulley[1] + 10, layer: "back" },
      { id: "cable", kind: "cable", at: pulley, to: { lm: "hands" }, layer: "near" },
    ],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.5,
  };
}

// --------------------------------------------------------------------------------------------------- Rows

export interface RowOpts {
  id: string;
  label: string;
  kind: "barbell" | "dumbbell" | "cable" | "band" | "inverted" | "chest-supported" | "face-pull" | "sled-pull";
}

export function row(o: RowOpts): MotionDef {
  switch (o.kind) {
    case "barbell": {
      let base = pose({ ...stanceLegs(4, 26, 66), neck: -22, ...both({ armD: 12 }) });
      const W = worldPts(base, FEET);
      // Shift so the hanging bar sits over mid-foot.
      const hang: Vec = [1, W.shoulder[1] - (ARM - 1)];
      const pullTo: Vec = [W.belly[0] - 2, W.belly[1] - 4];
      const P = (h: Vec) => handsTo(base, FEET, h);
      base = P(hang);
      const mid: Vec = [(hang[0] + pullTo[0]) / 2 + 4, (hang[1] + pullTo[1]) / 2];
      return {
        id: o.id,
        view: "side",
        label: o.label,
        keyframes: keys(FEET, [
          { pose: P(hang), dur: 0.5, hold: 0.25, ease: "spline", ik: ik2(hang) },
          { pose: P(mid), dur: 0.5, ease: "spline", ik: ik2(mid) },
          { pose: P(pullTo), dur: 0.9, hold: 0.3, ease: "spline", ik: ik2(pullTo) },
          { pose: P(mid), dur: 0.9, ease: "spline", ik: ik2(mid) },
        ]),
        props: [{ id: "bar", kind: "barbell", at: { lm: "hands" }, layer: "front" }],
        planted: ["L", "R"],
        footGrounded: true,
        stillPhase: 0.5,
      };
    }
    case "dumbbell": {
      // Far knee and far hand on the bench, near foot on the floor, near arm rows.
      const benchTop = BENCH_TOP;
      const root: RootRule = { pin: "kneeCapL", at: [0, benchTop] };
      let base = pose({ trunk: 84, neck: -16, hipL: 84, kneeL: 90, ankleL: -10, hipR: 70, kneeR: 15, ankleR: 10 });
      const W = worldPts(base, root);
      const footR = ankleForSole(W.pelvis[0] + 32, 0);
      base = legsTo(base, root, footR, ["R"]);
      const benchHand: Vec = [W.shoulder[0] + 4, benchTop + BODY.r.hand];
      base = handsTo(base, root, benchHand, ["L"]);
      const W2 = worldPts(base, root);
      const hang: Vec = [W2.shoulder[0] + 2, W2.shoulder[1] - (ARM - 1)];
      const pullTo: Vec = [W2.belly[0] - 8, W2.belly[1] - 6];
      const P = (h: Vec) => handsTo(base, root, h, ["R"]);
      return {
        id: o.id,
        view: "side",
        label: o.label,
        keyframes: keys(root, [
          { pose: P(hang), dur: 1, hold: 0.25, ease: "inOut", ik: { handR: hang, handL: benchHand, footR } },
          { pose: P(pullTo), dur: 1.6, hold: 0.3, ease: "inOut", ik: { handR: pullTo, handL: benchHand, footR } },
        ]),
        props: [
          { id: "bench", kind: "bench", at: [W.kneeCapL[0] + 12, benchTop], w: 110, layer: "mid" },
          { id: "db", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", follow: "handR", layer: "front" },
        ],
        footGrounded: true,
        stillPhase: 0.4,
      };
    }
    case "chest-supported": {
      const angle = 40;
      const root: RootRule = { pin: "chest", at: [0, 84] };
      let base = pose({ trunk: 90 - angle, neck: -10, ...both({ hip: 40, knee: 30, ankle: 10, armD: 16 }) });
      const W = worldPts(base, root);
      const foot = ankleForSole(W.pelvis[0] - 6, 0);
      base = legsTo(base, root, foot, ["L", "R"], -30);
      const W2 = worldPts(base, root);
      const hang: Vec = [W2.shoulder[0] + 2, W2.shoulder[1] - (ARM - 1)];
      const pullTo: Vec = [W2.belly[0] + 2, W2.belly[1] - 10];
      const P = (h: Vec) => handsTo(base, root, h);
      return {
        id: o.id,
        view: "side",
        label: o.label,
        keyframes: keys(root, [
          { pose: P(hang), dur: 1, hold: 0.25, ease: "inOut", ik: ik2(hang) },
          { pose: P(pullTo), dur: 1.6, hold: 0.35, ease: "inOut", ik: ik2(pullTo) },
        ]),
        props: [
          { id: "bench", kind: "inclineBench", at: [W2.pelvis[0] + 6, W2.pelvis[1] - 12], angle, w: 80, h: 20, variant: "right", layer: "near" },
          { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "profile", follow: "handL", layer: "far" },
          { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", follow: "handR", layer: "front" },
        ],
        footGrounded: true,
        stillPhase: 0.4,
      };
    }
    case "cable": {
      const root: RootRule = { pin: "butt", at: [0, 42] };
      const base = pose({ trunk: 0, ...both({ hip: 86, knee: 22, ankle: -10 }) });
      const W = worldPts(base, root);
      const foot = W.ankleR;
      // Sit tall: a small forward lean at the reach and upright at the finish, so the torso does not rock.
      const reachP = { ...base, trunk: 9, neck: -4, hipL: base.hipL + 9, hipR: base.hipR + 9 };
      const W2 = worldPts(reachP, root);
      const front: Vec = [W2.shoulder[0] + ARM - 3, W2.shoulder[1] - 8];
      const pullTo: Vec = [W.belly[0] + 3, W.belly[1] + 2];
      const pullP = { ...base, trunk: 0 };
      return {
        id: o.id,
        view: "side",
        label: o.label,
        keyframes: keys(root, [
          { pose: handsTo(reachP, root, front), dur: 1, hold: 0.25, ease: "inOut", ik: { ...ik2(front), footL: foot, footR: foot } },
          { pose: handsTo(pullP, root, pullTo), dur: 1.8, hold: 0.35, ease: "inOut", ik: { ...ik2(pullTo), footL: foot, footR: foot } },
        ]),
        props: [{ id: "m", kind: "cableRowSeat", at: [W.butt[0], 42], to: { lm: "hands" }, w: W.soleR[0] - W.butt[0] + 4, layer: "mid" }],
        stillPhase: 0.5,
      };
    }
    case "band":
    case "face-pull": {
      const face = o.kind === "face-pull";
      const base = pose({ ...stanceLegs(4, 10, face ? -4 : 2), neck: 0 });
      const W = worldPts(base, FEET);
      const anchorY = face ? W.head[1] - 2 : W.chest[1];
      const anchor: Vec = [W.shoulder[0] + 110, anchorY];
      const front: Vec = [W.shoulder[0] + ARM - 4, anchorY - 2];
      let start = handsTo({ ...base, ...both({ armD: face ? 10 : 6 }) }, FEET, front);
      let end = face ? armsLocal(base, [2, 3], [10, 17]) : armsLocal(base, [-26, -12], [4, -18]);
      start = { ...start, neck: 0 };
      end = { ...end };
      const props: PropDef[] = face
        ? [
            { id: "tower", kind: "cableTower", at: [anchor[0] + 12, 0], h: anchorY + 30, layer: "back" },
            { id: "cable", kind: "cable", at: anchor, to: { lm: "hands" }, layer: "near" },
          ]
        : [
            { id: "wall", kind: "wall", at: [anchor[0], 0], layer: "back" },
            { id: "band", kind: "band", at: anchor, to: { lm: "hands" }, layer: "near" },
          ];
      return {
        id: o.id,
        view: "side",
        label: o.label,
        keyframes: keys(FEET, [
          { pose: start, dur: 1, hold: 0.25, ease: "inOut" },
          { pose: end, dur: 1.6, hold: 0.4, ease: "inOut" },
        ]),
        props,
        planted: ["L", "R"],
        footGrounded: true,
        stillPhase: 0.5,
      };
    }
    case "inverted": {
      const root: RootRule = { pin: "heelR", at: [0, 0] };
      const make = (T: number) => pose({ trunk: T, neck: 6, ...both({ hip: 0, knee: 0, ankle: 72 - 0 }) });
      // Foot rotation: toes up (rot ≈ 90 − body angle); ankle = rot − shinA, shinA = −T.
      const mk = (T: number) => {
        const p = make(T);
        const rot = 78 + (T + 90) * 0.2;
        return { ...p, ankleL: rot + T, ankleR: rot + T };
      };
      const topT = -58;
      const Wt = worldPts(mk(topT), root);
      const bar: Vec = [Wt.chest[0] + 1, Wt.chest[1] + 5];
      const botT = solve1D((t) => {
        const W = worldPts(mk(t), root);
        return Math.hypot(bar[0] - W.shoulder[0], bar[1] - W.shoulder[1]) - (ARM - 1.5);
      }, -89, topT);
      const P = (T: number) => handsTo({ ...mk(T), ...both({ armD: 20 }) }, root, bar);
      return {
        id: o.id,
        view: "side",
        label: o.label,
        keyframes: keys(root, [
          { pose: P(botT), dur: 1, hold: 0.3, ease: "inOut", ik: ik2(bar) },
          { pose: P(topT), dur: 1.6, hold: 0.35, ease: "inOut", ik: ik2(bar) },
        ]),
        props: [
          { id: "rack", kind: "rack", at: [bar[0] - 14, bar[1] - 3], layer: "back" },
          { id: "bar", kind: "barbell", at: bar, variant: "empty", layer: "front" },
        ],
        footGrounded: true,
        stillPhase: 0.6,
      };
    }
    case "sled-pull": {
      // Arm-over-arm rope pull in an athletic stance; the sled creeps closer.
      const base = pose({ ...stanceLegs(18, 40, 30), neck: -14 });
      const W = worldPts(base, FEET);
      const reach: Vec = [W.shoulder[0] + ARM - 6, W.shoulder[1] - 10];
      const pullR: Vec = [W.belly[0] - 2, W.belly[1] - 4];
      const a = handsTo(handsTo(base, FEET, reach, ["R"]), FEET, pullR, ["L"]);
      const b = handsTo(handsTo(base, FEET, pullR, ["R"]), FEET, reach, ["L"]);
      return {
        id: o.id,
        view: "side",
        label: o.label,
        keyframes: keys(FEET, [
          { pose: a, dur: 0.6, ease: "inOut", ik: { handR: reach, handL: pullR }, props: { sled: [230, 0] } },
          { pose: b, dur: 0.6, ease: "inOut", ik: { handR: pullR, handL: reach }, props: { sled: [215, 0] } },
          { pose: a, dur: 0.6, ease: "inOut", ik: { handR: reach, handL: pullR }, props: { sled: [200, 0] } },
          { pose: b, dur: 0.4, ease: "inOut", ik: { handR: pullR, handL: reach }, props: { sled: [185, 0] }, alpha: 1 },
        ]),
        props: [
          { id: "sled", kind: "sled", at: [230, 0], layer: "back" },
          { id: "rope", kind: "rope", at: { lm: "handR" }, to: [175, 20], layer: "near" },
        ],
        planted: ["L", "R"],
        footGrounded: true,
        stillPhase: 0.2,
      };
    }
  }
}

// --------------------------------------------------------------------------------------- Arms (isolation)

export interface CurlOpts {
  id: string;
  label: string;
  kind: "curl" | "hammer" | "incline-curl" | "pushdown" | "overhead-extension" | "band-curl";
}

export function armIsolation(o: CurlOpts): MotionDef {
  if (o.kind === "incline-curl") {
    const angle = 58;
    const root: RootRule = { pin: "lowBack", at: [-4, 56] };
    let base = pose({ trunk: -(90 - angle) + 0, neck: 10, ...both({ hip: 70, knee: 80, ankle: 0 }) });
    base = legsTo(base, root, ankleForSole(worldPts(base, root).pelvis[0] + 38, 0));
    const T2 = base.trunk;
    const down0 = { ...base, ...both({ sh: T2 - 2, el: 4 }) };
    const up = { ...base, ...both({ sh: T2 - 2, el: 140 }) };
    return {
      id: o.id,
      view: "side",
      label: o.label,
      keyframes: keys(root, [
        { pose: down0, dur: 1, hold: 0.3, ease: "inOut" },
        { pose: up, dur: 2, hold: 0.3, ease: "inOut" },
      ]),
      props: [
        { id: "bench", kind: "inclineBench", at: [worldPts(base, root).butt[0] + 4, 46], angle, w: 82, h: 30, layer: "mid" },
        { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "end", layer: "far" },
        { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "end", layer: "front" },
      ],
      stillPhase: 0.4,
    };
  }
  if (o.kind === "pushdown") {
    const base = pose({ ...stanceLegs(5, 12, 10), neck: -6, ...both({ sh: 8, armD: 8 }) });
    const top = { ...base, ...both({ el: 95 }) };
    const bottom = { ...base, ...both({ el: 4 }) };
    const W = worldPts(top, FEET);
    const pulley: Vec = [W.handR[0] + 18, W.head[1] + 40];
    return {
      id: o.id,
      view: "side",
      label: o.label,
      keyframes: keys(FEET, [
        { pose: top, dur: 1, hold: 0.25, ease: "inOut" },
        { pose: bottom, dur: 1.8, hold: 0.35, ease: "inOut" },
      ]),
      props: [
        { id: "tower", kind: "cableTower", at: [pulley[0] + 14, 0], h: pulley[1] + 10, layer: "back" },
        { id: "cable", kind: "cable", at: pulley, to: { lm: "hands" }, layer: "near" },
      ],
      planted: ["L", "R"],
      footGrounded: true,
      stillPhase: 0.45,
    };
  }
  if (o.kind === "overhead-extension") {
    const base = pose({ ...stanceLegs(2, 6, -4), neck: 2, ...both({ sh: 170, armD: 14 }) });
    const top = { ...base, ...both({ el: 6 }) };
    const bottom = { ...base, ...both({ el: 138 }) };
    return {
      id: o.id,
      view: "side",
      label: o.label,
      keyframes: keys(FEET, [
        { pose: top, dur: 2, hold: 0.3, ease: "inOut" },
        { pose: bottom, dur: 1.2, hold: 0.2, ease: "inOut" },
      ]),
      props: [{ id: "db", kind: "dumbbell", at: { lm: "hands" }, orient: "profile", follow: "handR", layer: "front" }],
      planted: ["L", "R"],
      footGrounded: true,
      stillPhase: 0.6,
    };
  }
  const base = pose({ ...stanceLegs(2, 5, 0), ...both({ sh: 4, armD: 6 }) });
  const down0 = { ...base, ...both({ el: 6 }) };
  // Elbows stay by the sides: the upper arm moves forward only a few degrees at the top of the curl.
  const up = { ...base, ...both({ sh: 8, el: 140 }) };
  const hammer = o.kind === "hammer";
  const props: PropDef[] =
    o.kind === "band-curl"
      ? [{ id: "band", kind: "band", at: { lm: "soleR", dx: 2, dy: 1 }, to: { lm: "hands" }, layer: "near" }]
      : [
          { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: hammer ? "profile" : "end", follow: "handL", layer: "far" },
          { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: hammer ? "profile" : "end", follow: "handR", layer: "front" },
        ];
  return {
    id: o.id,
    view: "side",
    label: o.label,
    keyframes: keys(FEET, [
      { pose: down0, dur: 1, hold: 0.3, ease: "inOut" },
      { pose: up, dur: 2, hold: 0.3, ease: "inOut" },
    ]),
    props,
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.4,
  };
}

/** Rear-delt fly: bent over, arms sweep out to the sides (seen foreshortened from the side). */
export function rearDeltFly(id: string, label: string): MotionDef {
  const base = pose({ ...stanceLegs(4, 22, 62), neck: -18 });
  const T2 = base.trunk;
  const down0 = { ...base, ...both({ sh: T2 + 4, el: 14, armD: 0 }) };
  const up = { ...base, ...both({ sh: T2 + 10, el: 14, armD: 78, foreD: 70 }) };
  return {
    id,
    view: "side",
    label,
    keyframes: keys(FEET, [
      { pose: down0, dur: 1, hold: 0.3, ease: "inOut" },
      { pose: up, dur: 1.8, hold: 0.3, ease: "inOut" },
    ]),
    props: [
      { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "end", layer: "far" },
      { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "end", layer: "front" },
    ],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.5,
  };
}

// ------------------------------------------------------------------------------------- Front-view moves

export interface FrontArmOpts {
  id: string;
  label: string;
  kind: "lateral-raise" | "cable-lateral-raise" | "chest-fly" | "pull-apart" | "external-rotation" | "pallof" | "posing";
}

export function frontArms(o: FrontArmOpts): MotionDef {
  const root: RootRule = { ground: 0 };
  const stand = pose({ ...both({ hip: 6, ankle: 3, knee: 4 }) });
  const F = (p: Partial<Pose>) => ({ ...stand, ...p });
  const k = (p: Pose, dur: number, hold = 0.25, extra: Partial<KeySpec> = {}): KeySpec => ({ pose: p, dur, hold, ease: "inOut", ...extra });
  let specs: KeySpec[] = [];
  let props: PropDef[] = [];
  switch (o.kind) {
    case "lateral-raise":
      specs = [k(F({ ...both({ sh: 12, el: 14 }) }), 1, 0.3), k(F({ ...both({ sh: 88, el: 16 }) }), 2, 0.3)];
      props = [
        { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "end", layer: "near", size: 0.85 },
        { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "end", layer: "near", size: 0.85 },
      ];
      break;
    case "cable-lateral-raise":
      specs = [k(F({ shR: -12, elR: 10, shL: 6, elL: 60 }), 1, 0.3), k(F({ shR: 85, elR: 12, shL: 6, elL: 60 }), 2, 0.3)];
      props = [
        { id: "tower", kind: "cableTower", at: [70, 0], h: 205, layer: "back" },
        { id: "cable", kind: "cable", at: [58, 14], to: { lm: "handR" }, layer: "near" },
      ];
      break;
    case "chest-fly":
      specs = [
        k(F({ ...both({ sh: 80, el: 18, armD: 10 }) }), 1, 0.3),
        k(F({ ...both({ sh: 30, el: -55, armD: 58, foreD: 35 }) }), 2, 0.4),
      ];
      props = [
        { id: "tL", kind: "cableTower", at: [118, 0], h: 210, layer: "back" },
        { id: "tR", kind: "cableTower", at: [-118, 0], h: 210, layer: "back" },
        { id: "cL", kind: "cable", at: [104, 196], to: { lm: "handL" }, layer: "near" },
        { id: "cR", kind: "cable", at: [-104, 196], to: { lm: "handR" }, layer: "near" },
      ];
      break;
    case "pull-apart":
      specs = [
        k(F({ ...both({ sh: 40, el: 0, armD: 80 }) }), 1, 0.3),
        k(F({ ...both({ sh: 90, el: 0, armD: 4 }) }), 1.8, 0.4),
      ];
      props = [{ id: "band", kind: "band", at: { lm: "handL" }, to: { lm: "handR" }, layer: "near" }];
      break;
    case "external-rotation":
      specs = [
        k(F({ shR: 6, elR: 88, foreDR: 82, shL: 6, elL: 0 }), 1, 0.3),
        k(F({ shR: 6, elR: 88, foreDR: 0, shL: 6, elL: 0 }), 1.6, 0.4),
      ];
      props = [{ id: "band", kind: "band", at: [80, 112], to: { lm: "handR" }, layer: "near", variant: "gold" }];
      break;
    case "pallof":
      specs = [
        k(F({ ...both({ sh: 18, el: 120, armD: 30, foreD: 70 }) }), 1, 0.3),
        k(F({ ...both({ sh: 10, el: 30, armD: 80, foreD: 75 }) }), 1.4, 1.2),
      ];
      props = [
        { id: "tower", kind: "cableTower", at: [-110, 0], h: 200, layer: "back" },
        { id: "cable", kind: "cable", at: [-98, 120], to: { lm: "hands" }, layer: "near" },
      ];
      break;
    case "posing":
      specs = [
        // Front relaxed → front double biceps → lat spread → relax.
        k(F({ ...both({ sh: 18, el: 8 }) }), 0.8, 0.6),
        k(F({ ...both({ sh: 95, el: 115 }), neck: 0 }), 0.7, 1.5),
        k(F({ ...both({ sh: 30, el: 70, armD: 20 }) }), 0.7, 1.5),
      ];
      break;
  }
  return {
    id: o.id,
    view: "front",
    label: o.label,
    keyframes: keys(root, specs),
    props,
    footGrounded: true,
    planted: ["L", "R"],
    stillPhase: 0.45,
  };
}

export { shoulderLocal, armThrough, lm, legTo, mix, toLocal, legsTo, handsTo, ik2 };
