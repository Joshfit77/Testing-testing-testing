import { BODY, ankleForSole, forwardKinematics, solveTwoBone, angleOf } from "../skeleton";
import {
  FEET,
  armThrough,
  armTo,
  armsLocal,
  balanceTrunk,
  both,
  centerOfMass,
  keys,
  lm,
  pose,
  rep,
  shoulderLocal,
  solve1D,
  stanceLegs,
  type KeySpec,
  type MotionDef,
  type Pose,
  type PropDef,
  type Vec,
} from "../build";

export type SquatLoad = "back" | "front" | "goblet" | "zercher" | "overhead" | "arms-forward" | "hands-hips" | "chest-crossed";

export interface SquatOpts {
  id: string;
  label: string;
  load: SquatLoad;
  /** Knee flexion at the bottom. */
  knee?: number;
  /** Shin lean at the bottom. */
  shin?: number;
  down?: number;
  up?: number;
  holdBottom?: number;
  holdTop?: number;
  props?: PropDef[];
  /** Implement drawn at the hands / bar position. */
  implement?: "barbell" | "dumbbell" | "kettlebell" | "none";
  stillPhase?: number;
  /** Shift of the balance point relative to mid-foot (cm, + = toward toes). */
  balanceX?: number;
}

/** Arm placement for each way of holding the load (shoulder-local elbow / hand points). */
function holdArms(p: Pose, load: SquatLoad, s: number): Pose {
  switch (load) {
    case "back":
      // Elbows down under the bar (slightly behind it), forearms close to vertical, hands on the bar at the traps.
      return armsLocal(p, [-5, -24], [-6.5, 1]);
    case "front":
      return armsLocal(p, [23, 1], [8.5, 3.5]);
    case "goblet":
      return armsLocal(p, [7, -22], [16, -9]);
    case "zercher":
      return armsLocal(p, [17, -22], [20, -4]);
    case "chest-crossed":
      return armsLocal(p, [10, -12], [12, 2]);
    case "hands-hips":
      return armsLocal(p, [-12, -20], [2, -36]);
    case "overhead": {
      // Arms vertical in the world, wide grip (foreshortened).
      const T2 = p.trunk + p.spine;
      return { ...p, ...both({ el: 0, armD: 38, foreD: 30 }), shL: 180 + T2, shR: 180 + T2 };
    }
    case "arms-forward": {
      // Arms rise to horizontal as the squat deepens (counterbalance).
      const T2 = p.trunk + p.spine;
      const a = 40 + 50 * Math.min(1, s * 1.6);
      return { ...p, shL: a + T2, shR: a + T2, elL: 5, elR: 5 };
    }
  }
}

function barPoint(p: Pose, load: SquatLoad): Vec {
  switch (load) {
    case "back":
      return lm(p, "trap");
    case "front":
      return lm(p, "rack");
    case "overhead":
      return lm(p, "hands");
    default:
      return centerOfMass(p, load === "goblet" || load === "zercher" ? [{ at: lm(p, "hands"), mass: 0.25 }] : []);
  }
}

export function squatPose(s: number, o: SquatOpts): Pose {
  const knee = (o.knee ?? 128) * s + 2;
  const shin = (o.shin ?? 36) * s + 1;
  let p = pose({ ...stanceLegs(shin, knee, 5 + 30 * s), neck: -6 * s });
  for (let i = 0; i < 3; i++) {
    p = holdArms(p, o.load, s);
    p = balanceTrunk(p, (q) => barPoint(holdArms(q, o.load, s), o.load), o.balanceX ?? (o.load === "back" || o.load === "front" || o.load === "overhead" ? 1 : 2), -10, 70);
  }
  p = holdArms(p, o.load, s);
  // Keep the head neutral-to-up as the torso leans.
  p.neck = -Math.max(0, p.trunk - 10) * 0.45;
  return p;
}

export function squat(o: SquatOpts): MotionDef {
  const implement = o.implement ?? (o.load === "back" || o.load === "front" || o.load === "overhead" ? "barbell" : o.load === "zercher" ? "barbell" : "none");
  const props: PropDef[] = [...(o.props ?? [])];
  if (implement === "barbell") {
    const at = o.load === "back" ? { lm: "trap" as const } : o.load === "front" ? { lm: "rack" as const } : o.load === "zercher" ? { lm: "elbowR" as const, dx: 3, dy: 6 } : { lm: "hands" as const };
    props.push({ id: "bar", kind: "barbell", at, layer: "front" });
  } else if (implement === "dumbbell") props.push({ id: "db", kind: "dumbbell", at: { lm: "hands", dy: -3 }, orient: "profile", angle: 90, layer: "near", size: 1.05 });
  else if (implement === "kettlebell") props.push({ id: "kb", kind: "kettlebell", at: { lm: "hands" }, orient: "vertical", layer: "near" });
  const specs = rep((s) => squatPose(s, o), { down: o.down ?? 2, up: o.up ?? 1, holdBottom: o.holdBottom, holdTop: o.holdTop ?? 0.4 });
  return {
    id: o.id,
    view: "side",
    label: o.label,
    keyframes: keys(FEET, specs),
    props,
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: o.stillPhase ?? 0.45,
  };
}

// ---------------------------------------------------------------------------------------------- Hinge


/**
 * Solve a flat-footed pulling position in the sole frame (mid-foot at the origin):
 * the shoulder must reach `S`; the shin leans `shinLean`. Returns the pose with the trunk solved.
 */
export function solvePull(shinLean: number, S: Vec, spine = 0, neck = -10): Pose {
  const A = ankleForSole(0, 0);
  const K: Vec = [A[0] + BODY.shin * Math.sin((shinLean * Math.PI) / 180), A[1] + BODY.shin * Math.cos((shinLean * Math.PI) / 180)];
  // Vector pelvis→shoulder for the given spine flexion at trunk = 0.
  const v = forwardKinematics(pose({ spine }), "side").pts.shoulder;
  const rho = Math.hypot(v[0], v[1]);
  const beta = (Math.atan2(v[0], v[1]) * 180) / Math.PI;
  // Chain K → P (thigh) → S (trunk); hips behind: choose the solution with smaller x.
  const c1 = solveTwoBone(K, S, BODY.thigh, rho, 1);
  const c2 = solveTwoBone(K, S, BODY.thigh, rho, -1);
  const P1: Vec = [K[0] + BODY.thigh * Math.sin((c1.a1 * Math.PI) / 180), K[1] - BODY.thigh * Math.cos((c1.a1 * Math.PI) / 180)];
  const P2: Vec = [K[0] + BODY.thigh * Math.sin((c2.a1 * Math.PI) / 180), K[1] - BODY.thigh * Math.cos((c2.a1 * Math.PI) / 180)];
  const P = P1[0] < P2[0] ? P1 : P2;
  const lean = (Math.atan2(S[0] - P[0], S[1] - P[1]) * 180) / Math.PI;
  const T1 = lean - beta;
  const thighA = angleOf(P, K);
  const shinA = -shinLean;
  return pose({ trunk: T1, spine, neck, hipL: thighA + T1, hipR: thighA + T1, kneeL: thighA - shinA, kneeR: thighA - shinA, ankleL: shinLean, ankleR: shinLean });
}

/** Put both hands on a point given in the sole frame. */
export function handsAt(p: Pose, hand: Vec, sides: ("L" | "R")[] = ["L", "R"]): Pose {
  const sole = lm(p, "soleR");
  let out = p;
  for (const s of sides) out = armTo(out, s, [hand[0] + sole[0], hand[1] + sole[1]]);
  return out;
}

export interface PullOpts {
  id: string;
  label: string;
  /** Bar centre height at the start (floor = plate radius). */
  barStart?: number;
  barTop?: number;
  /** Shin lean at the start. */
  shin0?: number;
  /** Bar x relative to mid-foot. */
  barX?: number;
  /** Seconds up / down. */
  up?: number;
  down?: number;
  holdTop?: number;
  holdBottom?: number;
  implement?: "barbell" | "trapBar" | "dumbbell" | "kettlebell" | "stone" | "sandbag";
  plateR?: number;
  props?: PropDef[];
  /** Starting from the top (Romanian deadlift style) instead of the floor. */
  fromTop?: boolean;
  /** Knee bend held during a Romanian deadlift. */
  rdlKnee?: number;
  spine?: number;
  /** Height of a platform the lifter stands on (deficit pulls). Bar heights are measured from the floor. */
  platform?: number;
  armLen?: number;
}

const ARM = BODY.upperArm + BODY.forearm;

/** Deadlift-family pose for a bar height (sole frame). */
export function pullPose(barY: number, o: PullOpts): Pose {
  const barX = o.barX ?? 1;
  const y0 = o.barStart ?? 22.5;
  const kneeH = 52;
  const shin0 = o.shin0 ?? 12;
  const frac = Math.max(0, Math.min(1, (barY - y0) / (kneeH - y0)));
  const shin = shin0 * (1 - frac) * (1 - frac * 0.3);
  const delta = 7 * (1 - Math.max(0, Math.min(1, (barY - y0) / (84 - y0))));
  const S: Vec = [barX + delta, barY + Math.sqrt(ARM * ARM - delta * delta) - 0.5];
  let p = solvePull(shin, S, o.spine ?? 0);
  p = handsAt(p, [barX, barY]);
  p.neck = -Math.max(0, p.trunk - 15) * 0.35;
  return p;
}

/** Romanian deadlift: knees fixed soft, hips back, shins slightly behind vertical, bar over mid-foot. */
export function rdlPose(barY: number, o: PullOpts): Pose {
  const knee = o.rdlKnee ?? 18;
  const barX = o.barX ?? 1;
  // Find the shin lean (slightly behind vertical is normal) giving the requested knee bend while the
  // shoulders hang over the bar.
  let best = pose();
  let bestErr = Infinity;
  for (let shin = -22; shin <= 22; shin += 0.5) {
    const S: Vec = [barX + 2, barY + ARM - 0.5];
    const p = solvePull(shin, S, o.spine ?? 0);
    const err = Math.abs(p.kneeR - knee);
    if (err < bestErr) {
      bestErr = err;
      best = p;
    }
  }
  best = handsAt(best, [barX, barY]);
  best.neck = -Math.max(0, best.trunk - 20) * 0.3;
  return best;
}

export function pull(o: PullOpts): MotionDef {
  const plat = o.platform ?? 0;
  const y0 = (o.barStart ?? 22.5) - plat;
  const top = o.barTop ?? 83.5;
  const at = (s: number) => {
    // s: 0 = lockout, 1 = bottom.
    const y = top + (y0 - top) * s;
    return o.fromTop ? rdlPose(y, o) : pullPose(y, { ...o, barStart: y0 });
  };
  const props: PropDef[] = [...(o.props ?? [])];
  const impl = o.implement ?? "barbell";
  if (impl === "barbell") props.push({ id: "bar", kind: "barbell", at: { lm: "hands" }, layer: "front", size: o.plateR });
  else if (impl === "trapBar") props.push({ id: "bar", kind: "trapBar", at: { lm: "hands" }, layer: "front", size: o.plateR });
  else if (impl === "dumbbell") props.push({ id: "db", kind: "dumbbell", at: { lm: "handR" }, orient: "end", layer: "near" }, { id: "db2", kind: "dumbbell", at: { lm: "handL" }, orient: "end", layer: "far" });
  else if (impl === "kettlebell") props.push({ id: "kb", kind: "kettlebell", at: { lm: "hands" }, layer: "near" });
  // Lifting from the floor: start at the bottom, pull up (faster), lower under control.
  const upT = o.up ?? 1.2;
  const downT = o.down ?? 1.6;
  const specs: KeySpec[] = o.fromTop
    ? rep(at, { down: downT, up: upT, holdTop: o.holdTop ?? 0.4, holdBottom: o.holdBottom ?? 0.15 })
    : [
        { pose: at(1), dur: upT * 0.5, hold: o.holdBottom ?? 0.5, ease: "spline" },
        { pose: at(0.5), dur: upT * 0.5, ease: "spline" },
        { pose: at(0), dur: downT * 0.5, hold: o.holdTop ?? 0.5, ease: "spline" },
        { pose: at(0.5), dur: downT * 0.5, ease: "spline" },
      ];
  return {
    id: o.id,
    view: "side",
    label: o.label,
    keyframes: keys(plat ? { pin: "soleR", at: [0, plat] } : FEET, specs),
    props,
    planted: plat ? undefined : ["L", "R"],
    footGrounded: !plat,
    stillPhase: o.fromTop ? 0.45 : 0.05,
  };
}

/** Good morning: bar on the back, hinge with soft knees. */
/**
 * Sumo deadlift, seen from the front so the stance is visible: feet about twice shoulder width with the toes turned out,
 * knees pushed out over the toes, hands gripping the bar at shoulder width inside the knees, plates outside the feet.
 * The hips start lower and the torso more upright than in a conventional pull (here about 54° from upright at the
 * floor, against about 68° for this figure's conventional deadlift), and hips and shoulders rise together.
 */
export function sumoPull(id: string, label: string): MotionDef {
  const footX = 42; // sole centre from the body's midline
  const grip = 21; // hand from the midline (shoulder-width grip)
  const ARM_REACH = Math.sqrt(ARM * ARM - (grip - BODY.shoulderHalf) ** 2);
  const torso = BODY.lumbar + BODY.thorax - 5; // pelvis → shoulder line, upright
  const hipY0 = 7.5 + Math.sqrt((BODY.thigh + BODY.shin) ** 2 - (footX - BODY.hipHalf) ** 2);
  const barTop = hipY0 + torso - ARM_REACH;
  const barBottom = 22.5;
  const hipYBottom = 56;
  const kneeBottom: Vec = [46, 48.5];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const at = (s: number): Pose => {
    const barY = barTop + (barBottom - barTop) * s;
    const ph = hipY0 + (hipYBottom - hipY0) * s;
    const fs = Math.min(1, (barY + ARM_REACH - ph) / torso);
    let p = pose({ trunkD: (Math.acos(fs) * 180) / Math.PI });
    // Legs, in pelvis-origin coordinates (pelvis at height ph above the floor).
    const hip: Vec = [BODY.hipHalf, 0];
    const ankle: Vec = [footX, 7.5 - ph];
    const onLine: Vec = [hip[0] + (ankle[0] - hip[0]) * (BODY.thigh / (BODY.thigh + BODY.shin)), hip[1] + (ankle[1] - hip[1]) * (BODY.thigh / (BODY.thigh + BODY.shin))];
    const w = smooth(s);
    const knee: Vec = [onLine[0] + (kneeBottom[0] - onLine[0]) * w, onLine[1] + (kneeBottom[1] - ph - onLine[1]) * w];
    const th: Vec = [knee[0] - hip[0], knee[1] - hip[1]];
    const sh: Vec = [ankle[0] - knee[0], ankle[1] - knee[1]];
    const deg = (r: number) => (r * 180) / Math.PI;
    const hipAbd = deg(Math.atan2(th[0], -th[1]));
    const shinTilt = deg(Math.atan2(sh[0], -sh[1]));
    const legD = deg(Math.acos(Math.min(1, Math.hypot(th[0], th[1]) / BODY.thigh)));
    const shinD = deg(Math.acos(Math.min(1, Math.hypot(sh[0], sh[1]) / BODY.shin)));
    p = { ...p, hipL: hipAbd, hipR: hipAbd, ankleL: shinTilt, ankleR: shinTilt, legDL: legD, legDR: legD, shinDL: shinD, shinDR: shinD };
    // Arms hang straight to the bar.
    const sk = forwardKinematics(p, "front");
    for (const side of ["L", "R"] as const) {
      const k = side === "L" ? 1 : -1;
      const shoulder = sk.pts[`shoulder${side}`];
      const hand: Vec = [k * grip, barY - ph];
      const elbow: Vec = [shoulder[0] + (hand[0] - shoulder[0]) * (BODY.upperArm / ARM), shoulder[1] + (hand[1] - shoulder[1]) * (BODY.upperArm / ARM)];
      p = armThrough(p, side, elbow, hand, "front");
    }
    return p;
  };
  // Several in-between keys so the interpolated legs keep the feet planted.
  const upS = [1, 0.75, 0.5, 0.25];
  const downS = [0, 0.25, 0.5, 0.75];
  const specs: KeySpec[] = [
    ...upS.map((v, i): KeySpec => ({ pose: at(v), dur: 0.3, hold: i === 0 ? 0.5 : 0, ease: "spline" })),
    ...downS.map((v, i): KeySpec => ({ pose: at(v), dur: 0.4, hold: i === 0 ? 0.5 : 0, ease: "spline" })),
  ];
  return {
    id,
    view: "front",
    label,
    keyframes: keys(FEET, specs),
    props: [{ id: "bar", kind: "barbell", variant: "front", at: { lm: "hands" }, layer: "front" }],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.05,
  };
}

export function goodMorning(id: string, label: string): MotionDef {
  const at = (s: number) => {
    const T = 6 + 72 * s;
    const knee = 4 + 16 * s;
    let p = pose({ ...stanceLegs(0, knee, T) });
    for (let i = 0; i < 3; i++) {
      p = armsLocal(p, [-10, -17], [-6.5, 1]);
      // Shift the shin (ankle angle) so the bar stays over mid-foot.
      const base = p;
      const shin = solve1D((sh) => {
        const q = armsLocal(pose({ ...base, ...stanceLegs(sh, knee, T) }), [-10, -17], [-6.5, 1]);
        return lm(q, "trap")[0] - lm(q, "soleR")[0] - 1;
      }, -20, 25);
      p = armsLocal(pose({ ...base, ...stanceLegs(shin, knee, T) }), [-10, -17], [-6.5, 1]);
    }
    p.neck = -T * 0.35;
    return p;
  };
  return {
    id,
    view: "side",
    label,
    keyframes: keys(FEET, rep(at, { down: 2, up: 1.2, holdTop: 0.4 })),
    props: [{ id: "bar", kind: "barbell", at: { lm: "trap" }, layer: "front" }],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.45,
  };
}

/** Kettlebell swing: hike back, hip snap, bell floats to chest height. */
export function kettlebellSwing(id: string, label: string): MotionDef {
  const hinge = (() => {
    let p = rdlPose(30, { id, label, rdlKnee: 26 });
    // Hike: hands back between the legs.
    const T2 = p.trunk + p.spine;
    p = { ...p, shL: T2 - 30, shR: T2 - 30, elL: 0, elR: 0 };
    return p;
  })();
  const mid = (() => {
    let p = rdlPose(60, { id, label, rdlKnee: 18 });
    const T2 = p.trunk + p.spine;
    p = { ...p, shL: T2 + 5, shR: T2 + 5, elL: 0, elR: 0 };
    return p;
  })();
  const top = (() => {
    let p = pose({ ...stanceLegs(0, 3, -4), neck: 2 });
    const T2 = p.trunk;
    p = { ...p, shL: 88 + T2, shR: 88 + T2, elL: 0, elR: 0 };
    return p;
  })();
  const float = (() => {
    let p = pose({ ...stanceLegs(0, 3, 0) });
    p = { ...p, shL: 45, shR: 45 };
    return p;
  })();
  return {
    id,
    view: "side",
    label,
    keyframes: keys(FEET, [
      { pose: hinge, dur: 0.35, ease: "spline" },
      { pose: mid, dur: 0.3, ease: "spline" },
      { pose: top, dur: 0.35, hold: 0.08, ease: "spline" },
      { pose: float, dur: 0.35, ease: "spline" },
      { pose: mid, dur: 0.3, ease: "spline" },
    ]),
    props: [{ id: "kb", kind: "kettlebell", at: { lm: "hands" }, layer: "near", follow: "handR" }],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.4,
  };
}

export { shoulderLocal, armThrough, ankleForSole };
