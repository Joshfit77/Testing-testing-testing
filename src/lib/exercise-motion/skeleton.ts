import type { Landmark, Pose, Side, Vec, View } from "./types";

/** Body proportions (cm) of the demo figure: ~180 cm tall, athletic. */
export const BODY = {
  footBack: 6,
  footFront: 18,
  toeExtra: 4,
  ankleH: 7.5,
  shin: 44,
  thigh: 45,
  lumbar: 25,
  thorax: 31.5,
  neck: 9,
  headR: 11,
  upperArm: 32,
  /** Elbow to the centre of the gripping hand. */
  forearm: 31,
  /** Front view half widths. */
  hipHalf: 9,
  shoulderHalf: 18,
  /** Thickness radii used for drawing and for floor contact. */
  r: {
    thighTop: 8.6,
    knee: 5.4,
    ankle: 3.6,
    upperArm: 5.2,
    elbow: 4.1,
    wrist: 3.2,
    hand: 4,
    torsoBack: 10,
    torsoFront: 11,
  },
} as const;

export const ZERO_POSE: Pose = {
  trunk: 0,
  spine: 0,
  neck: 0,
  hipL: 0,
  hipR: 0,
  kneeL: 0,
  kneeR: 0,
  ankleL: 0,
  ankleR: 0,
  shL: 0,
  shR: 0,
  elL: 0,
  elR: 0,
  armDL: 0,
  armDR: 0,
  foreDL: 0,
  foreDR: 0,
  legDL: 0,
  legDR: 0,
  shinDL: 0,
  shinDR: 0,
  trunkD: 0,
};

/** Anatomical (projected) limits used by the definition tests. */
export const LIMITS: Record<keyof Pose, [number, number]> = {
  trunk: [-180, 180],
  spine: [-35, 75],
  neck: [-45, 50],
  hipL: [-50, 160],
  hipR: [-50, 160],
  kneeL: [0, 160],
  kneeR: [0, 160],
  ankleL: [-70, 50],
  ankleR: [-70, 50],
  shL: [-75, 190],
  shR: [-75, 190],
  elL: [0, 155],
  elR: [0, 155],
  armDL: [-90, 90],
  armDR: [-90, 90],
  foreDL: [-90, 90],
  foreDR: [-90, 90],
  legDL: [-90, 90],
  legDR: [-90, 90],
  shinDL: [-90, 90],
  shinDR: [-90, 90],
  trunkD: [-20, 75],
};

export const FRONT_LIMITS: Partial<Record<keyof Pose, [number, number]>> = {
  hipL: [-25, 80],
  hipR: [-25, 80],
  shL: [-30, 185],
  shR: [-30, 185],
  ankleL: [-30, 40],
  ankleR: [-30, 40],
  elL: [-120, 160],
  elR: [-120, 160],
};

const RAD = Math.PI / 180;
export const sin = (a: number) => Math.sin(a * RAD);
export const cos = (a: number) => Math.cos(a * RAD);
/** Unit vector for a "down-angle": 0 = straight down, 90 = forward (+x), 180 = up, -90 = backward. */
export const down = (a: number): Vec => [sin(a), -cos(a)];
/** Unit vector for a lean angle measured from straight up, + = forward. */
export const up = (a: number): Vec => [sin(a), cos(a)];
/** Unit vector pointing out of the front of a segment whose up-direction has lean `a`. */
export const frontOf = (a: number): Vec => [cos(a), -sin(a)];
export const add = (p: Vec, v: Vec, k = 1): Vec => [p[0] + v[0] * k, p[1] + v[1] * k];
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
export const len = (v: Vec) => Math.hypot(v[0], v[1]);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpV = (a: Vec, b: Vec, t: number): Vec => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
/** Down-angle of the direction from a to b. */
export const angleOf = (from: Vec, to: Vec) => Math.atan2(to[0] - from[0], -(to[1] - from[1])) / RAD;

export interface Skeleton {
  pts: Record<Landmark, Vec>;
  seg: {
    T1: number;
    T2: number;
    head: number;
    thighL: number;
    thighR: number;
    shinL: number;
    shinR: number;
    footL: number;
    footR: number;
    armL: number;
    armR: number;
    foreL: number;
    foreR: number;
  };
}

function footPoints(ankle: Vec, rot: number) {
  // Foot frame: forward (cos r, sin r), up (-sin r, cos r); rot > 0 = toes up.
  const f: Vec = [cos(rot), sin(rot)];
  const u: Vec = [-sin(rot), cos(rot)];
  const at = (fw: number, uh: number): Vec => [ankle[0] + f[0] * fw + u[0] * uh, ankle[1] + f[1] * fw + u[1] * uh];
  return {
    heel: at(-BODY.footBack, -BODY.ankleH),
    ball: at(BODY.footFront, -BODY.ankleH),
    // Toes bend at the ball: when the heel is up they stay flat on the floor.
    toe: rot < 0 ? ([ankle[0] + f[0] * BODY.footFront - u[0] * BODY.ankleH + BODY.toeExtra, ankle[1] + f[1] * BODY.footFront - u[1] * BODY.ankleH + 0.4] as Vec) : at(BODY.footFront + BODY.toeExtra, -BODY.ankleH + 1.5),
    sole: at(7, -BODY.ankleH),
  };
}

/** Forward kinematics with the pelvis at `origin`. */
export function forwardKinematics(p: Pose, view: View, origin: Vec = [0, 0]): Skeleton {
  return view === "side" ? sideFK(p, origin) : frontFK(p, origin);
}

function sideFK(p: Pose, pelvis: Vec): Skeleton {
  const T1 = p.trunk;
  const T2 = p.trunk + p.spine;
  const mid = add(pelvis, up(T1), BODY.lumbar);
  const neckBase = add(mid, up(T2), BODY.thorax);
  const shoulder = add(neckBase, up(T2), -4.5);
  const headA = T2 + p.neck;
  const neckTop = add(neckBase, up(headA), BODY.neck);
  const head = add(add(neckTop, up(headA), BODY.headR - 1), frontOf(headA), 1.5);
  const fT1 = frontOf(T1);
  const fT2 = frontOf(T2);

  const leg = (s: Side) => {
    const hip = p[`hip${s}`];
    const knee = p[`knee${s}`];
    const ankle = p[`ankle${s}`];
    const thighA = hip - T1;
    const shinA = thighA - knee;
    const kneeP = add(pelvis, down(thighA), BODY.thigh * cos(p[`legD${s}`]));
    const ankleP = add(kneeP, down(shinA), BODY.shin);
    const rot = shinA + ankle;
    const f = footPoints(ankleP, rot);
    // Kneecap / shin front surface (for kneeling contact).
    const sd = down(shinA);
    const nFront: Vec = [-sd[1], sd[0]];
    const kneeCap = add(kneeP, nFront, BODY.r.knee);
    return { thighA, shinA, rot, kneeP, ankleP, kneeCap, shinMid: add(add(kneeP, sd, BODY.shin * 0.45), nFront, 3.5), thighMid: add(pelvis, down(thighA), BODY.thigh * 0.5 * cos(p[`legD${s}`])), ...f };
  };
  const arm = (s: Side) => {
    const armA = p[`sh${s}`] - T2;
    const foreA = armA + p[`el${s}`];
    const elbow = add(shoulder, down(armA), BODY.upperArm * cos(p[`armD${s}`]));
    const hand = add(elbow, down(foreA), BODY.forearm * cos(p[`foreD${s}`]));
    const fd = down(foreA);
    // Underside of the forearm at the elbow (forearm-plank contact).
    const under: Vec = [fd[1], -fd[0]];
    return { armA, foreA, elbow, hand, elbowPad: add(elbow, under, BODY.r.elbow), forearmMid: add(add(elbow, fd, BODY.forearm * 0.45), under, 3.4) };
  };
  const L = leg("L");
  const R = leg("R");
  const aL = arm("L");
  const aR = arm("R");

  const pts: Record<Landmark, Vec> = {
    pelvis,
    mid,
    neckBase,
    shoulder,
    shoulderL: shoulder,
    shoulderR: shoulder,
    head,
    headTop: add(head, up(headA), BODY.headR),
    hipL: pelvis,
    hipR: pelvis,
    kneeL: L.kneeP,
    kneeR: R.kneeP,
    kneeCapL: L.kneeCap,
    kneeCapR: R.kneeCap,
    ankleL: L.ankleP,
    ankleR: R.ankleP,
    heelL: L.heel,
    heelR: R.heel,
    ballL: L.ball,
    ballR: R.ball,
    toeL: L.toe,
    toeR: R.toe,
    soleL: L.sole,
    soleR: R.sole,
    elbowL: aL.elbow,
    elbowR: aR.elbow,
    handL: aL.hand,
    handR: aR.hand,
    hands: lerpV(aL.hand, aR.hand, 0.5),
    trap: add(add(neckBase, up(T2), -3), fT2, -6.5),
    rack: add(add(shoulder, fT2, 8), up(T2), 2),
    chest: add(add(mid, up(T2), BODY.thorax * 0.55), fT2, 11),
    belly: add(mid, fT1, 9.5),
    hipCrease: add(add(pelvis, fT1, 9.5), up(T1), 2),
    upperBack: add(add(mid, up(T2), BODY.thorax * 0.6), fT2, -BODY.r.torsoBack),
    lowBack: add(mid, fT1, -BODY.r.torsoBack + 1),
    butt: add(add(pelvis, fT1, -7), up(T1), -4),
    waist: add(mid, up(T1), -4),
    forearmL: aL.forearmMid,
    forearmR: aR.forearmMid,
    elbowPadL: aL.elbowPad,
    elbowPadR: aR.elbowPad,
    shinL: L.shinMid,
    shinR: R.shinMid,
    thighL: L.thighMid,
    thighR: R.thighMid,
    foreheadFront: add(head, frontOf(headA), BODY.headR),
    headBack: add(head, frontOf(headA), -BODY.headR),
  };
  return {
    pts,
    seg: { T1, T2, head: headA, thighL: L.thighA, thighR: R.thighA, shinL: L.shinA, shinR: R.shinA, footL: L.rot, footR: R.rot, armL: aL.armA, armR: aR.armA, foreL: aL.foreA, foreR: aR.foreA },
  };
}

function frontFK(p: Pose, pelvis: Vec): Skeleton {
  const T1 = p.trunk;
  const T2 = p.trunk + p.spine;
  // Leaning toward the viewer shortens the torso on screen.
  const fs = cos(p.trunkD);
  const mid = add(pelvis, up(T1), BODY.lumbar * fs);
  const neckBase = add(mid, up(T2), BODY.thorax * fs);
  const headA = T2 + p.neck;
  const neckTop = add(neckBase, up(headA), BODY.neck);
  const head = add(neckTop, up(headA), BODY.headR - 1);
  const right1: Vec = frontOf(T1); // screen-right across the pelvis
  const right2: Vec = frontOf(T2);
  const sg = (s: Side) => (s === "L" ? 1 : -1);

  const leg = (s: Side) => {
    const k = sg(s);
    const hipP = add(pelvis, right1, k * BODY.hipHalf);
    const thighA = -T1 + k * p[`hip${s}`];
    const knee = p[`knee${s}`];
    const legD = p[`legD${s}`];
    const kneeP = add(hipP, down(thighA), BODY.thigh * cos(depthMix(legD, Math.min(80, knee * 0.62))));
    const shinA = -T1 + k * p[`ankle${s}`];
    const shinD = p[`shinD${s}`];
    const ankleP = add(kneeP, down(shinA), BODY.shin * cos(depthMix(shinD, Math.min(60, knee * 0.22))));
    const sole = add(ankleP, down(-T1), BODY.ankleH);
    const out: Vec = [k * cos(-T1), k * sin(-T1)];
    return { hipP, thighA, shinA, kneeP, ankleP, sole, heel: add(sole, out, -3), ball: add(sole, out, 4), toe: add(sole, out, 5) };
  };
  const shoulderOf = (s: Side) => add(add(neckBase, up(T2), -5 * fs), right2, sg(s) * BODY.shoulderHalf);
  const arm = (s: Side) => {
    const k = sg(s);
    const sh = shoulderOf(s);
    const armA = -T2 + k * p[`sh${s}`];
    const foreA = armA + k * p[`el${s}`];
    const elbow = add(sh, down(armA), BODY.upperArm * cos(p[`armD${s}`]));
    const hand = add(elbow, down(foreA), BODY.forearm * cos(p[`foreD${s}`]));
    return { sh, armA, foreA, elbow, hand };
  };
  const L = leg("L");
  const R = leg("R");
  const aL = arm("L");
  const aR = arm("R");
  const shoulder = lerpV(aL.sh, aR.sh, 0.5);
  const pts: Record<Landmark, Vec> = {
    pelvis,
    mid,
    neckBase,
    shoulder,
    shoulderL: aL.sh,
    shoulderR: aR.sh,
    head,
    headTop: add(head, up(headA), BODY.headR),
    hipL: L.hipP,
    hipR: R.hipP,
    kneeL: L.kneeP,
    kneeR: R.kneeP,
    kneeCapL: L.kneeP,
    kneeCapR: R.kneeP,
    ankleL: L.ankleP,
    ankleR: R.ankleP,
    heelL: L.heel,
    heelR: R.heel,
    ballL: L.ball,
    ballR: R.ball,
    toeL: L.toe,
    toeR: R.toe,
    soleL: L.sole,
    soleR: R.sole,
    elbowL: aL.elbow,
    elbowR: aR.elbow,
    handL: aL.hand,
    handR: aR.hand,
    hands: lerpV(aL.hand, aR.hand, 0.5),
    trap: add(neckBase, up(T2), -2),
    rack: add(neckBase, up(T2), -6),
    chest: add(mid, up(T2), BODY.thorax * 0.55 * fs),
    belly: add(mid, up(T1), -2),
    hipCrease: add(pelvis, up(T1), 2),
    upperBack: add(mid, up(T2), BODY.thorax * 0.6 * fs),
    lowBack: mid,
    butt: pelvis,
    waist: add(mid, up(T1), -4),
    forearmL: lerpV(aL.elbow, aL.hand, 0.45),
    forearmR: lerpV(aR.elbow, aR.hand, 0.45),
    elbowPadL: aL.elbow,
    elbowPadR: aR.elbow,
    shinL: lerpV(L.kneeP, L.ankleP, 0.45),
    shinR: lerpV(R.kneeP, R.ankleP, 0.45),
    thighL: lerpV(L.hipP, L.kneeP, 0.5),
    thighR: lerpV(R.hipP, R.kneeP, 0.5),
    foreheadFront: head,
    headBack: head,
  };
  return {
    pts,
    seg: { T1, T2, head: headA, thighL: L.thighA, thighR: R.thighA, shinL: L.shinA, shinR: R.shinA, footL: 0, footR: 0, armL: aL.armA, armR: aR.armA, foreL: aL.foreA, foreR: aR.foreA },
  };
}

/**
 * Two-bone inverse kinematics. Returns the absolute down-angles of the two segments so that the chain
 * starting at `root` ends at `target`. `bend` = +1 picks the solution whose second segment is rotated
 * counter-clockwise from the first (elbow flexion), -1 clockwise (knee flexion).
 */
export function solveTwoBone(root: Vec, target: Vec, a: number, b: number, bend: 1 | -1): { a1: number; a2: number; reached: boolean } {
  const d0 = len(sub(target, root));
  const d = Math.max(Math.abs(a - b) + 1e-3, Math.min(a + b - 1e-3, d0));
  const base = angleOf(root, target);
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cosA))) / RAD;
  // Down-angles increase counter-clockwise. For the second segment to sit counter-clockwise of the first
  // (bend = +1) the first segment must swing clockwise of the root→target line.
  const a1 = base - bend * alpha;
  const elbow = add(root, down(a1), a);
  const a2 = angleOf(elbow, target);
  return { a1, a2, reached: d0 <= a + b + 0.5 };
}

/** Apply IK for a limb, returning the updated pose. */
export function applyLimbIK(pose: Pose, view: View, sk: Skeleton, limb: "handL" | "handR" | "footL" | "footR", target: Vec): Pose {
  const s = limb.endsWith("L") ? "L" : "R";
  const k = view === "front" ? (s === "L" ? 1 : -1) : 1;
  const out = { ...pose };
  if (limb.startsWith("hand")) {
    const root = view === "front" ? sk.pts[`shoulder${s}`] : sk.pts.shoulder;
    const a = BODY.upperArm * cos(pose[`armD${s}`]);
    const b = BODY.forearm * cos(pose[`foreD${s}`]);
    // Elbow flexion is counter-clockwise in side view; in front view mirrored for the right arm.
    const bend = view === "front" ? (s === "L" ? 1 : -1) : 1;
    const { a1, a2 } = solveTwoBone(root, target, a, b, bend as 1 | -1);
    const T2 = pose.trunk + pose.spine;
    if (view === "side") {
      out[`sh${s}`] = normShoulder(a1 + T2);
      out[`el${s}`] = normFlex(a2 - a1);
    } else {
      out[`sh${s}`] = normShoulder(k * (a1 + T2));
      out[`el${s}`] = k * normalize180(a2 - a1);
    }
  } else {
    // Feet: target is the ankle. Keep the foot's sole orientation (rot) unchanged.
    if (view !== "side") return out;
    const root = sk.pts[`hip${s}`];
    const a = BODY.thigh * cos(pose[`legD${s}`]);
    const b = BODY.shin;
    const { a1, a2 } = solveTwoBone(root, target, a, b, -1);
    const T1 = pose.trunk;
    const rot = (s === "L" ? sk.seg.footL : sk.seg.footR);
    out[`hip${s}`] = a1 + T1;
    out[`knee${s}`] = normFlex(a1 - a2);
    out[`ankle${s}`] = rot - a2;
  }
  return out;
}

/** Combine an explicit out-of-plane angle with the implicit one from knee bend (continuous in both). */
export function depthMix(explicit: number, implicit: number) {
  const e = Math.min(90, Math.abs(explicit));
  return e + (1 - e / 90) * implicit;
}

/** Shoulder angles live in [-170, 190). */
export function normShoulder(a: number) {
  let x = a;
  while (x < -170) x += 360;
  while (x >= 190) x -= 360;
  return x;
}

/** Elbow / knee flexion lives in [-40, 320): a fold past 180° is projected hyper-flexion, not hyperextension. */
export function normFlex(a: number) {
  let x = a;
  while (x < -40) x += 360;
  while (x >= 320) x -= 360;
  return x;
}

export function normalize180(a: number) {
  let x = a % 360;
  if (x > 180) x -= 360;
  if (x < -180) x += 360;
  return x;
}

/** Ankle position that puts the sole of a flat foot (or one rotated by `rot`) on a surface at `y`, with the sole centre at `x`. */
export function ankleForSole(x: number, y: number, rot = 0): Vec {
  // Inverse of footPoints().sole = ankle + 5·f − ankleH·u.
  const f: Vec = [cos(rot), sin(rot)];
  const u: Vec = [-sin(rot), cos(rot)];
  return [x - f[0] * 7 + u[0] * BODY.ankleH, y - f[1] * 7 + u[1] * BODY.ankleH];
}
