/**
 * Side-view drills authored as a body path plus fixed hand and foot contacts (like the A-skip): the dumbbell walking
 * lunge, the bear crawl, the acceleration wall drill and agility-ladder footwork. A pose is solved for every 1/50 s by
 * inverse kinematics, so a planted foot or hand stays exactly on its spot on the floor (or the wall) while the body
 * moves, and the in-between frames follow the engine's smooth curve through those poses.
 */
import { BODY, forwardKinematics } from "../skeleton";
import { armTo, legTo, plantLeg, pose, solve1D, type Keyframe, type MotionDef, type Pose, type PropDef, type Side, type Vec } from "../build";
import { mj } from "./agility";

const DT = 0.02;

/** Piecewise cubic Hermite through knots [time, value, slope] (times increasing; clamped outside). */
function hermiteKnots(t: number, ks: [number, number, number][]): number {
  if (t <= ks[0]![0]) return ks[0]![1];
  for (let i = 1; i < ks.length; i++) {
    const [t1, y1, m1] = ks[i]!;
    const [t0, y0, m0] = ks[i - 1]!;
    if (t <= t1) {
      const h = t1 - t0;
      const u = (t - t0) / h;
      const u2 = u * u;
      const u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * h * m1;
    }
  }
  return ks[ks.length - 1]![1];
}

/** Dense keyframes from a pose-and-pelvis function sampled every ~DT over a loop of T seconds. */
function sampled(T: number, at: (t: number) => { pose: Pose; pelvis: Vec }): Keyframe[] {
  const n = Math.max(2, Math.round(T / DT));
  const dt = T / n;
  return Array.from({ length: n }, (_, i) => {
    const { pose: p, pelvis } = at(i * dt);
    return { pose: p, root: { pin: "pelvis", at: pelvis }, dur: dt, ease: "spline" } as Keyframe;
  });
}

/** Unit foot vectors for a sole rotated by `rot` (+ = toes up). */
const footFrame = (rot: number) => {
  const r = (rot * Math.PI) / 180;
  return { f: [Math.cos(r), Math.sin(r)] as Vec, u: [-Math.sin(r), Math.cos(r)] as Vec };
};

/**
 * Plant a foot by the ball, rolling the heel up just enough that the ankle never bends past `maxDorsi` degrees of
 * dorsiflexion (a lunge's back foot, a push-off). Returns the pose.
 */
function rollingPlant(p: Pose, s: Side, pelvis: Vec, ball: Vec, maxDorsi: number, rotMax = 0): Pose {
  let rot = rotMax;
  let out = plantLeg(p, s, pelvis, ball, rot);
  for (let it = 0; it < 6; it++) {
    const shinA = out[`hip${s}`] - out.trunk - out[`knee${s}`];
    const want = Math.min(rotMax, shinA + maxDorsi);
    if (Math.abs(want - rot) < 0.05) break;
    rot = want;
    out = plantLeg(p, s, pelvis, ball, rot);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ Walking lunge

/**
 * Dumbbell walking lunge. Each half of the loop: the front foot has just landed heel first a long step ahead; the body
 * lowers straight down until the front thigh is about level and the back knee hovers just above the floor (torso tall,
 * front shin near vertical, front knee over the toes); a brief pause; then the front leg drives the body up and forward
 * over the front foot while the back leg swings through beside it and reaches forward into the next lunge. The planted
 * front foot never moves; the back foot stays on its spot and rolls onto its ball, then leaves the floor. The second
 * half mirrors the first with the other leg, a step further on (the camera follows).
 */
export function walkingLungeDrill(id: string, label: string): MotionDef {
  const S = 88; // ankle to ankle, front foot to the next front foot
  const T_LOW = 0.9;
  const T_BOT = 0.12;
  const T_UP = 0.46;
  const T_STEP = 0.34;
  const HALF = T_LOW + T_BOT + T_UP + T_STEP;
  const tOff = T_LOW + T_BOT + 0.1; // back foot leaves the floor
  const heelRot = 14; // toes up as the heel lands
  const tFlat = 0.16; // heel-to-flat after landing
  const base = (T: number): Pose => {
    const p = pose({ trunk: T, neck: -T + 2 });
    return { ...p, shL: T + 1, shR: T + 1, elL: 4, elR: 4, armDL: 8, armDR: 8 };
  };
  // Bottom height: the back knee hovers about 4 cm above the floor.
  const backBall = -S + BODY.footFront;
  const bottomX = -38;
  const yBottom = solve1D((y) => {
    const p = rollingPlant(base(4), "L", [bottomX, y], [backBall, 0], 42);
    const P = forwardKinematics(p, "side", [bottomX, y]).pts;
    return P.kneeCapL[1] - 4;
  }, 40, 80);
  // Pelvis knots for one half, relative to the front ankle at x = 0 (time, value, slope).
  const px: [number, number, number][] = [
    [0, -50, 38],
    [T_LOW, bottomX, 0],
    [T_LOW + T_BOT, bottomX, 0],
    [T_LOW + T_BOT + T_UP, 4, 100],
    [HALF, S - 50, 38],
  ];
  const py: [number, number, number][] = [
    [0, 81, -45],
    [T_LOW, yBottom, 0],
    [T_LOW + T_BOT, yBottom, 0],
    [T_LOW + T_BOT + T_UP, 91, 0],
    [HALF, 81, -45],
  ];
  const lean: [number, number, number][] = [
    [0, 5, 0],
    [T_LOW, 4, 0],
    [T_LOW + T_BOT + 0.2, 9, 0],
    [HALF, 5, 0],
  ];
  // The heel that lands at the end of a half (x of the heel, the foot at heelRot).
  const heelX = S - BODY.footBack;
  const landAnkle = (): Vec => {
    const { f, u } = footFrame(heelRot);
    return [heelX + f[0] * BODY.footBack + u[0] * BODY.ankleH, f[1] * BODY.footBack + u[1] * BODY.ankleH];
  };
  // How far the planted back foot may let the ankle bend before the heel rises: little while pushing off, more at the
  // bottom of the lunge (the back heel is well up there).
  const maxDorsi = (t: number) => (t < T_LOW ? 25 + 17 * mj(t / T_LOW) : 42 - 26 * mj((t - T_LOW) / (tOff - T_LOW)));
  const front = (t: number): { ball: Vec; rot: number } => {
    if (t >= tFlat) return { ball: [BODY.footFront, 0], rot: 0 };
    // Heel strike: the foot pivots on its heel down to flat.
    const rot = heelRot * (1 - mj(t / tFlat));
    const { f } = footFrame(rot);
    const heel: Vec = [-BODY.footBack, 0];
    return { ball: [heel[0] + f[0] * (BODY.footBack + BODY.footFront), f[1] * (BODY.footBack + BODY.footFront)], rot };
  };
  const toeOff = { ankle: [0, 0] as Vec, rot: 0, done: false };
  const half = (t: number, h: 0 | 1) => {
    const F: Side = h === 0 ? "R" : "L";
    const B: Side = h === 0 ? "L" : "R";
    const x0 = h * S;
    const pel: Vec = [x0 + hermiteKnots(t, px), hermiteKnots(t, py)];
    const T = hermiteKnots(t, lean);
    let p = base(T);
    // Front leg: planted (heel strike then flat), rolling onto its ball late in the drive.
    const fr = front(t);
    const driveDorsi = t > T_LOW + T_BOT ? 25 : 60;
    p = t >= tFlat ? rollingPlant(p, F, pel, [x0 + fr.ball[0], 0], driveDorsi) : plantLeg(p, F, pel, [x0 + fr.ball[0], fr.ball[1]], fr.rot);
    // Back leg: planted on its ball until toe-off, then swings through to the next heel strike.
    if (t < tOff) {
      p = rollingPlant(p, B, pel, [x0 + backBall, 0], maxDorsi(t));
    } else {
      if (!toeOff.done) {
        const q = rollingPlant(p, B, [hermiteKnots(tOff, px), hermiteKnots(tOff, py)], [backBall, 0], maxDorsi(tOff));
        const P = forwardKinematics(q, "side", [hermiteKnots(tOff, px), hermiteKnots(tOff, py)]).pts;
        toeOff.ankle = P[`ankle${B}`];
        toeOff.rot = q[`hip${B}`] - q.trunk - q[`knee${B}`] + q[`ankle${B}`];
        toeOff.done = true;
      }
      const u = (t - tOff) / (HALF - tOff);
      const end = landAnkle();
      const a0 = toeOff.ankle;
      const ax = a0[0] + (end[0] - a0[0]) * mj(u);
      const ay = a0[1] + (end[1] - a0[1]) * u + 13 * Math.pow(Math.sin(Math.PI * u), 1.4);
      const rot = u < 0.5 ? toeOff.rot + (-4 - toeOff.rot) * mj(u / 0.5) : -4 + (heelRot + 4) * mj((u - 0.5) / 0.5);
      p = legTo(p, B, [x0 + ax - pel[0], ay - pel[1]], rot);
    }
    return { pose: p, pelvis: pel };
  };
  const keyframes = sampled(2 * HALF, (t) => (t < HALF ? half(t, 0) : half(t - HALF, 1)));
  const props: PropDef[] = [
    { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "profile", angle: 0, layer: "far" },
    { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", angle: 0, layer: "near" },
  ];
  return { id, view: "side", label, keyframes, props, travel: 2 * S, footGrounded: true, stillPhase: (T_LOW + 0.05) / (2 * HALF) };
}

// ------------------------------------------------------------------------------------------------ Bear crawl

/**
 * Bear crawl: hands under the shoulders, back flat with the hips a little below the shoulders, knees bent and hovering
 * an inch or two off the floor, on the balls of the feet. The opposite hand and foot step forward together in small
 * steps (near hand with far foot, then far hand with near foot) while the body glides forward at an even speed.
 */
export function bearCrawlDrill(id: string, label: string): MotionDef {
  const C = 0.9; // seconds per full cycle (each limb steps once)
  const STEP = 18;
  const v = STEP / C;
  const FOOT_ROT = -64;
  const HAND_Y = BODY.r.hand;
  // Trunk angle and pelvis height: knees hovering ~3.5 cm, hands flat under the shoulders with the elbows soft.
  const legs = (p: Pose, pel: Vec, ballX: number) => plantLeg(plantLeg(p, "L", pel, [ballX, 0], FOOT_ROT), "R", pel, [ballX, 0], FOOT_ROT);
  const hip = 6; // thigh slightly forward of vertical
  const Hp = 54;
  const T = 77;
  const probe = pose({ trunk: T, neck: -14, hipL: T + hip, hipR: T + hip, kneeL: 100, kneeR: 100, ankleL: 40, ankleR: 40 });
  // Ball of the foot where the knee hovers 3.5 cm above the floor with the thigh at `hip`.
  const kneeAt = forwardKinematics(probe, "side", [0, Hp]).pts.kneeL;
  const ballX0 = solve1D((x) => forwardKinematics(legs(probe, [0, Hp], x), "side", [0, Hp]).pts.kneeCapL[1] - 3.5, kneeAt[0] - 70, kneeAt[0] - 38);
  const sh = forwardKinematics(probe, "side", [0, Hp]).pts.shoulder;
  const handX0 = sh[0] + 3;
  // Swing windows within the cycle: near hand + far foot first, then far hand + near foot.
  const swings: Record<"handR" | "footL" | "handL" | "footR", [number, number]> = {
    handR: [0, 0.38],
    footL: [0.02, 0.4],
    handL: [0.45, 0.83],
    footR: [0.47, 0.85],
  };
  // Where a limb is at time t: [x, lift], planted between swings, centred on its neutral spot mid-stance.
  const limb = (key: keyof typeof swings, neutral: number, lift: number, t: number): Vec => {
    const [s0, s1] = swings[key];
    const tm = (s1 + s0 + C) / 2; // middle of the stance after this swing
    const xNext = (k: number) => neutral + v * (tm + k * C);
    const ph = ((t % C) + C) % C;
    const lap = Math.floor(t / C);
    if (ph < s0) return [xNext(lap - 1), 0];
    if (ph < s1) {
      const u = (ph - s0) / (s1 - s0);
      return [xNext(lap - 1) + (xNext(lap) - xNext(lap - 1)) * mj(u), lift * Math.pow(Math.sin(Math.PI * u), 1.2)];
    }
    return [xNext(lap), 0];
  };
  const at = (t: number) => {
    const pel: Vec = [v * t, Hp + 0.6 * Math.sin((4 * Math.PI * t) / C)];
    let p = pose({ trunk: T, neck: -14, hipL: T + hip, hipR: T + hip, kneeL: 100, kneeR: 100, ankleL: 40, ankleR: 40, elL: 6, elR: 6 });
    for (const s of ["L", "R"] as const) {
      const f = limb(`foot${s}`, ballX0, 4, t);
      p = plantLeg(p, s, pel, [f[0], f[1]], FOOT_ROT);
      const h = limb(`hand${s}`, handX0, 5, t);
      p = armTo(p, s, [h[0] - pel[0], HAND_Y + h[1] - pel[1]]);
    }
    return { pose: p, pelvis: pel };
  };
  const keyframes = sampled(C, at);
  // The hands are also pinned frame by frame (breathing moves the shoulders a little; a planted hand must not move).
  keyframes.forEach((kf, i) => {
    const t = (i * C) / keyframes.length;
    const hand = (s: Side): Vec => {
      const h = limb(`hand${s}`, handX0, 5, t);
      return [h[0], HAND_Y + h[1]];
    };
    kf.ik = { handL: hand("L"), handR: hand("R") };
  });
  return { id, view: "side", label, keyframes, props: [], travel: STEP, footGrounded: true, stillPhase: 0.2 };
}

// ------------------------------------------------------------------------------------------------ Wall drill

/**
 * Acceleration wall drill: hands on the wall at shoulder height, arms straight, the body one straight line from head
 * to heel at 45° (no pike at the hips), the support leg straight behind on the ball of the foot. One knee is driven up
 * (thigh about 20° below level, knee bent, toes pulled up); on the switch the up leg punches down and back to the same
 * spot under the body while the other knee drives up, quickly, then the position is held.
 */
export function wallDrillStraight(id: string, label: string): MotionDef {
  const LEAN = 45;
  const SUPPORT = { hip: 0, knee: 3, rot: -40 };
  const DRIVE = { hip: 115, knee: 96, ankle: 12 };
  const T_HOLD = 0.42;
  const T_SW = 0.2;
  const legAngles = (sup: number): { hip: number; knee: number; ankle: number } => {
    // sup = 1 support, 0 driven up (blend of the two through the switch).
    const shinS = SUPPORT.hip - LEAN - SUPPORT.knee;
    const s = { hip: SUPPORT.hip, knee: SUPPORT.knee, ankle: SUPPORT.rot - shinS };
    return { hip: DRIVE.hip + (s.hip - DRIVE.hip) * sup, knee: DRIVE.knee + (s.knee - DRIVE.knee) * sup, ankle: DRIVE.ankle + (s.ankle - DRIVE.ankle) * sup };
  };
  const body = (supL: number, supR: number): Pose => {
    const l = legAngles(supL);
    const r = legAngles(supR);
    return pose({ trunk: LEAN, spine: 0, neck: 0, hipL: l.hip, kneeL: l.knee, ankleL: l.ankle, hipR: r.hip, kneeR: r.knee, ankleR: r.ankle });
  };
  // Pelvis placed so the support foot's ball is at the origin; hands on the wall level with the shoulder.
  const ref = body(1, 0);
  const P0 = forwardKinematics(ref, "side").pts;
  const pel: Vec = [-P0.ballL[0], -P0.ballL[1]];
  const shoulder: Vec = [pel[0] + P0.shoulder[0], pel[1] + P0.shoulder[1]];
  const reach = (BODY.upperArm + BODY.forearm) * 0.97;
  const hand: Vec = [shoulder[0] + reach * Math.cos((6 * Math.PI) / 180), shoulder[1] - reach * Math.sin((6 * Math.PI) / 180)];
  const T = 2 * (T_HOLD + T_SW);
  // The two foot positions (ball of the foot relative to the pelvis, and the sole's angle): on the floor behind, and up.
  const sup = { ball: [P0.ballL[0], P0.ballL[1]] as Vec, rot: SUPPORT.rot };
  const up = { ball: [P0.ballR[0], P0.ballR[1]] as Vec, rot: forwardKinematics(ref, "side").seg.footR };
  // Through a switch: the up foot is punched down and back onto the same spot (it arrives from above, never scraping
  // the floor); the support foot leaves the floor at once and its knee drives up.
  const foot = (state: "support" | "up" | "down" | "rise", u: number): { ball: Vec; rot: number } => {
    if (state === "support") return sup;
    if (state === "up") return up;
    if (state === "down") {
      const kx = mj(Math.min(1, u * 1.15));
      return { ball: [up.ball[0] + (sup.ball[0] - up.ball[0]) * kx, sup.ball[1] + (up.ball[1] - sup.ball[1]) * (1 - mj(u))], rot: up.rot + (sup.rot - up.rot) * mj(u) };
    }
    const ky = 1 - Math.pow(1 - u, 2.4);
    return { ball: [sup.ball[0] + (up.ball[0] - sup.ball[0]) * mj(u), sup.ball[1] + (up.ball[1] - sup.ball[1]) * ky], rot: sup.rot + (up.rot - sup.rot) * mj(u) };
  };
  const keyframes = sampled(T, (t) => {
    let L: { ball: Vec; rot: number };
    let R: { ball: Vec; rot: number };
    if (t < T_HOLD) [L, R] = [foot("support", 0), foot("up", 0)];
    else if (t < T_HOLD + T_SW) {
      const u = (t - T_HOLD) / T_SW;
      [L, R] = [foot("rise", u), foot("down", u)];
    } else if (t < 2 * T_HOLD + T_SW) [L, R] = [foot("up", 0), foot("support", 0)];
    else {
      const u = (t - 2 * T_HOLD - T_SW) / T_SW;
      [L, R] = [foot("down", u), foot("rise", u)];
    }
    let p = body(1, 0);
    p = plantLeg(plantLeg(p, "L", [0, 0], L.ball, L.rot), "R", [0, 0], R.ball, R.rot);
    for (const s of ["L", "R"] as const) p = armTo(p, s, [hand[0] - pel[0], hand[1] - pel[1]]);
    return { pose: p, pelvis: pel };
  });
  // The hands are also pinned to the wall frame by frame, so breathing and the in-betweens never move them.
  for (const kf of keyframes) kf.ik = { handL: hand, handR: hand };
  return {
    id,
    view: "side",
    label,
    keyframes,
    props: [{ id: "wall", kind: "wall", at: [hand[0] + BODY.r.hand, 0], layer: "back" }],
    footGrounded: false,
    stillPhase: 0.15,
  };
}

// ------------------------------------------------------------------------------------------------ Agility ladder

/**
 * Agility ladder, "two feet in each box" (the classic first pattern), side view: quick, light contacts on the balls of
 * the feet, near foot then far foot into each box, so every foot lands in every box between the rungs; knees lift a
 * little, the arms pump opposite the legs, the torso leans slightly forward with the eyes up. The ladder is drawn on
 * the floor and scrolls past as the camera follows.
 */
export function agilityLadderDrill(id: string, label: string): MotionDef {
  const BOX = 45;
  const STEP_T = 0.2; // one foot contact per 0.2 s
  const SWING = 0.15;
  const C = 2 * STEP_T; // each foot moves one box per cycle
  const v = BOX / C;
  const LEAN = 16;
  const H = 86;
  const ROT = -24;
  // Foot spots: the ball lands a little past the middle of each box.
  const spot = (k: number) => k * BOX + BOX * 0.55;
  // Near foot (R) swings at [0, SWING), the far foot (L) half a cycle later. Each lands in the next box.
  const foot = (s: Side, t: number): { ball: Vec; rot: number } => {
    const off = s === "R" ? 0 : STEP_T;
    const tt = t - off;
    const lap = Math.floor(tt / C);
    const ph = tt - lap * C;
    if (ph >= SWING) return { ball: [spot(lap + 1), 0], rot: ROT };
    const u = ph / SWING;
    const x = spot(lap) + BOX * mj(u);
    // Quick knee lift: the foot rises early in the swing and is driven down into the next box.
    const lift = 19 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 1.2);
    return { ball: [x, lift], rot: ROT + (u < 0.4 ? -14 * Math.sin((Math.PI * u) / 0.8) : 10 * Math.sin((Math.PI * (u - 0.4)) / 0.6)) };
  };
  // The pelvis travels evenly, centred over the contacts: each foot lands a little ahead of it and leaves behind it.
  const at = (t: number) => {
    const pel: Vec = [v * t + BOX * 0.55 + 3, H - 1.2 * Math.cos((2 * Math.PI * t) / STEP_T)];
    let p = pose({ trunk: LEAN, neck: -LEAN + 2 });
    for (const s of ["L", "R"] as const) {
      const f = foot(s, t);
      p = rollingPlant(p, s, pel, f.ball, 40, f.rot);
    }
    // Arms pump opposite the legs, elbows near 90°.
    const ph = (2 * Math.PI * t) / C;
    const swing = 40 * Math.sin(ph + Math.PI * 0.35);
    p = { ...p, shR: LEAN + 10 - swing, shL: LEAN + 10 + swing, elR: 90 + 10 * Math.sin(ph), elL: 90 - 10 * Math.sin(ph) };
    return { pose: p, pelvis: pel };
  };
  // Two cycles per loop (two boxes), so the loop is not over before the eye has read it.
  const keyframes = sampled(2 * C, at);
  const props: PropDef[] = [{ id: "ladder", kind: "ladder", at: [BOX * 2, 0], w: BOX * 24, h: BOX, layer: "back" }];
  return { id, view: "side", label, keyframes, props, travel: BOX * 2, footGrounded: true, stillPhase: 0.3 };
}

// ------------------------------------------------------------------------------------------------ Three-cone drill

/** One fine time step of a route: where the body is (x across the frame, z away from the camera) and how it moves. */
interface RouteRow {
  t: number;
  x: number;
  z: number;
  /** Distance run so far (the legs' stride runs on this, so planted feet stay put while the body runs over them). */
  s: number;
  v: number;
  facing: 1 | -1;
  /** 0..1: crouched with the near hand on the line at `line` (world x). */
  touch: number;
  line: number;
  alpha: number;
  /** Share of the running speed that is across the frame (1 = running across, 0 = straight toward or away). */
  k: number;
}

/** 0..1 plateau around `tc` (held `hold` s each side of it), easing in over `rin` before and out over `rout` after. */
function bumpW(t: number, tc: number, hold: number, rin: number, rout: number): number {
  if (t < tc - hold) return mj(1 - (tc - hold - t) / rin);
  if (t <= tc + hold) return 1;
  return mj(1 - (t - tc - hold) / rout);
}

/** Uniform Catmull-Rom through points, sampled densely; returns the polyline. */
function catmullRom(pts: Vec[], per = 40): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let k = 0; k < per; k++) {
      const u = k / per;
      const u2 = u * u;
      const u3 = u2 * u;
      const c = (a: number, b: number, c2: number, d: number) => 0.5 * (2 * b + (-a + c2) * u + (2 * a - 5 * b + 4 * c2 - d) * u2 + (-a + 3 * b - 3 * c2 + d) * u3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/**
 * Three-cone (L) drill, side view with the far cone set back from the camera (distances shortened). The athlete
 * sprints from the start line to the second cone, chops the last steps short, drops the hips and touches the line,
 * turns, sprints back and touches the start line, turns, sprints out again, rounds the second cone, runs to the third
 * cone (away from the viewer, so drawn smaller), goes round it, comes back round the second cone and sprints past the
 * start. A profile figure cannot be drawn mid-turn, so each 180° turn is shown as a quick fade while the body is at its
 * lowest (at the lines) or farthest (behind the third cone); after the finish the athlete fades out and is back at the
 * start line for the next rep.
 */
export function threeConeDrill(id: string, label: string): MotionDef {
  const XS = -95;
  const XC2 = 95;
  const C3: Vec = [150, 240];
  const CAM_D = 430;
  const ZX = 250;
  const scaleAt = (z: number) => CAM_D / (CAM_D + z);
  const REACH = 46; // the pelvis stops this far short of a line it touches
  const FDT = 0.005;
  const rows: RouteRow[] = [];
  let cur: RouteRow = { t: 0, x: XS - 12, z: 0, s: 0, v: 0, facing: 1, touch: 0, line: 0, alpha: 1, k: 1 };
  const push = (r: Partial<RouteRow>, jump = false) => {
    const dx = (r.x ?? cur.x) - cur.x;
    const dz = (r.z ?? cur.z) - cur.z;
    const ds = jump ? 0 : Math.hypot(dx, dz);
    cur = { ...cur, ...r, t: cur.t + FDT, s: cur.s + ds, v: ds / FDT };
    rows.push(cur);
  };
  const hold = (dur: number, extra: (u: number) => Partial<RouteRow> = () => ({})) => {
    for (let i = 0, n = Math.round(dur / FDT); i < n; i++) push(extra((i + 1) / n));
  };
  // Straight sprint along x to `x1` (min-jerk: accelerates out, chops down to a stop).
  const sprint = (x1: number, dur: number) => {
    const x0 = cur.x;
    for (let i = 0, n = Math.round(dur / FDT); i < n; i++) push({ x: x0 + (x1 - x0) * mj((i + 1) / n) });
  };
  /** Turns (the figure is mirrored from then on, with a quick fade around the moment) and line touches. */
  const turns: { t: number; facing: 1 | -1 }[] = [];
  const touches: { t: number; line: number }[] = [];
  // Stop at a line: a short pause (the plant) in which the near hand touches the line and the body turns round. The
  // crouch begins over the last chopped steps and the body rises out of it while driving away.
  const touchTurn = (line: number, pause = 0.18) => {
    const tc = cur.t + 0.05;
    touches.push({ t: tc, line });
    turns.push({ t: tc, facing: line > cur.x ? -1 : 1 });
    hold(pause);
  };
  // A curved run through waypoints with speeds at each, turning round where the run reverses across the frame.
  const route = (pts: Vec[], speeds: number[]) => {
    const poly = catmullRom(pts);
    const cum = [0];
    for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1]! + Math.hypot(poly[i]![0] - poly[i - 1]![0], poly[i]![1] - poly[i - 1]![1]));
    // Arc length at each waypoint (on the polyline: waypoint i is sample i * 40).
    const knotS = pts.map((_, i) => cum[Math.min(cum.length - 1, i * 40)]!);
    const knots: [number, number, number][] = [];
    let tt = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) tt += (2 * (knotS[i]! - knotS[i - 1]!)) / Math.max(20, speeds[i - 1]! + speeds[i]!);
      knots.push([tt, knotS[i]!, speeds[i]!]);
    }
    const at = (sArc: number): Vec => {
      let j = 1;
      while (j < cum.length - 1 && cum[j]! < sArc) j++;
      const u = (sArc - cum[j - 1]!) / Math.max(1e-9, cum[j]! - cum[j - 1]!);
      return [poly[j - 1]![0] + (poly[j]![0] - poly[j - 1]![0]) * u, poly[j - 1]![1] + (poly[j]![1] - poly[j - 1]![1]) * u];
    };
    // Where the run reverses across the frame (largest x): the turn.
    let turnS = 0;
    let best = -Infinity;
    for (let i = 0; i < poly.length; i++) if (poly[i]![0] > best) [best, turnS] = [poly[i]![0], cum[i]!];
    const n = Math.round(tt / FDT);
    let turned = false;
    for (let i = 0; i < n; i++) {
      const sArc = hermiteKnots((i + 1) * FDT, knots);
      const p = at(sArc);
      if (!turned && sArc >= turnS) {
        turns.push({ t: cur.t + FDT, facing: -1 });
        turned = true;
      }
      push({ x: p[0], z: p[1] });
    }
  };
  // The rep.
  hold(0.35);
  sprint(XC2 - REACH, 1.25);
  touchTurn(XC2);
  sprint(XS + REACH, 1.05);
  touchTurn(XS);
  const A: Vec = [cur.x, 0];
  route(
    [A, [XC2 - 15, 0], [XC2 + 26, 40], [C3[0] - 26, C3[1] - 64], [C3[0] - 6, C3[1] + 32], [C3[0] + 28, C3[1] + 16], [C3[0] + 30, C3[1] - 56], [XC2 + 20, 38], [XC2 - 25, 0], [XS - 25, 0], [XS - 50, 0]],
    [0, 330, 250, 270, 220, 200, 250, 260, 340, 220, 0],
  );
  // Rest: fade out, back to the start line (facing forward again), fade in.
  hold(0.3, (u) => ({ alpha: 1 - mj(u / 0.8) }));
  hold(0.06, () => ({ alpha: 0 }));
  turns.push({ t: cur.t + FDT, facing: 1 });
  push({ alpha: 0, x: XS - 12, z: 0 }, true);
  hold(0.3, (u) => ({ alpha: mj(u) }));
  // Facing, the fade at each turn, and the crouch-and-touch, laid over the route.
  for (const r of rows) {
    let f: 1 | -1 = 1;
    let dip = 1;
    for (const tn of turns) {
      if (r.t >= tn.t) f = tn.facing;
      const d = Math.abs(r.t - tn.t);
      dip = Math.min(dip, d < 0.05 ? 0 : d < 0.13 ? mj((d - 0.05) / 0.08) : 1);
    }
    r.facing = f;
    r.alpha *= dip;
    for (const tc of touches) {
      const w = bumpW(r.t, tc.t, 0.05, 0.36, 0.42);
      if (w > r.touch) [r.touch, r.line] = [w, tc.line];
    }
  }
  // The legs stride on the distance run across the frame (in the facing direction), so a planted foot stays on its
  // spot; running away from or toward the viewer the stride is seen end-on and shortens (`k`, the share of the speed
  // that is across the frame). The cadence still follows the full running speed.
  let sp = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const prev = rows[i - 1];
    const dx = prev ? r.x - prev.x : 0;
    const jump = Math.abs(dx) > 20; // the reset to the start line, unseen
    const ds = prev ? Math.hypot(dx, r.z - prev.z) : 0;
    if (!jump) sp += r.facing * dx;
    r.k = !jump && ds > 1e-6 ? Math.abs(dx) / ds : 1;
    r.s = sp;
  }
  const T = cur.t;

  // ---- Legs: footfalls on the stride distance s, from a cadence that rises with speed.
  const R = (t: number): RouteRow => rows[Math.max(0, Math.min(rows.length - 1, Math.round(t / FDT) - 1))]!;
  const cad = (v: number) => 2.7 + v / 260;
  const lead = (v: number) => 6 + v * 0.04;
  interface Fall {
    t: number;
    s: number;
    side: Side;
    v: number;
  }
  const falls: Fall[] = [];
  let phase = 0;
  let moving = false;
  let side: Side = "R";
  let lastFall = -1;
  const stops: [number, number][] = [];
  let stopStart = 0;
  for (const r of rows) {
    const run = r.v > 15;
    if (run && !moving) {
      phase = 0.62;
      if (stopStart >= 0) stops.push([stopStart, r.t]);
      stopStart = -1;
    }
    if (!run && moving) {
      // Coming to a stop: the next foot plants ahead (at the line for a touch), unless one just did.
      if (r.t - lastFall > 0.08) {
        falls.push({ t: r.t, s: r.s + (rows.find((q) => q.t > r.t && q.touch > 0.5) ? 24 : 6), side, v: r.v });
        side = side === "R" ? "L" : "R";
        lastFall = r.t;
      }
      stopStart = r.t;
    }
    moving = run;
    if (run) {
      phase += cad(r.v) * FDT;
      if (phase >= 1) {
        phase -= 1;
        falls.push({ t: r.t, s: r.s + lead(r.v) * r.k, side, v: r.v });
        side = side === "R" ? "L" : "R";
        lastFall = r.t;
      }
    }
  }
  if (stopStart >= 0) stops.push([stopStart, T + 1]);
  const sEnd = rows[rows.length - 1]!.s;
  // Each foot's landings in order; at the loop's end the feet stand where they started (relative to the body).
  const byFoot = (sd: Side) => falls.filter((f) => f.side === sd);
  const landings: Record<Side, Fall[]> = { R: byFoot("R"), L: byFoot("L") };
  const startRel: Record<Side, number> = {
    R: (landings.R[landings.R.length - 1]?.s ?? sEnd) - sEnd,
    L: (landings.L[landings.L.length - 1]?.s ?? sEnd - 20) - sEnd,
  };
  const inStop = (t: number) => stops.find(([a, b]) => t >= a && t < b);
  /** Sole angle of a planted foot: on the ball, the heel rising as the body runs past it. */
  const plantedRot = (rel: number) => -10 - 0.9 * Math.max(0, -rel - 4);
  /** Where a foot is at time t: stride position (relative to the body), lift and sole angle. */
  const footAt = (sd: Side, t: number): { rel: number; lift: number; rot: number } => {
    const sNow = R(t).s;
    const L = landings[sd];
    let prevS = startRel[sd] + rows[0]!.s;
    let prevT = -Infinity;
    for (const f of L) {
      if (f.t <= t) {
        prevS = f.s;
        prevT = f.t;
        continue;
      }
      // Next landing f: the swing starts a swing-time before it (never before the previous landing plus a short
      // stance, never during a stop).
      const sw = Math.min(0.36, Math.max(0.17, 1.35 / cad(f.v)));
      let t0 = Math.max(f.t - sw, prevT + 0.06);
      const st = inStop(t0);
      if (st && st[1] < f.t) t0 = Math.max(t0, st[1]);
      if (t < t0) return { rel: prevS - sNow, lift: 0, rot: plantedRot(prevS - sNow) };
      const u = (t - t0) / (f.t - t0);
      const x = prevS + (f.s - prevS) * mj(u);
      const hi = 6 + Math.min(15, f.v * 0.05);
      const r0 = plantedRot(prevS - R(t0).s);
      return { rel: x - sNow, lift: hi * Math.pow(Math.sin(Math.PI * u), 1.2), rot: r0 + (-10 - r0) * mj(u) - 14 * Math.sin(Math.PI * u) };
    }
    return { rel: prevS - sNow, lift: 0, rot: plantedRot(prevS - sNow) };
  };

  // ---- Poses.
  const keyframes = sampled(T, (t) => {
    const r = R(t);
    const ahead = R(t + 0.06);
    const behind = R(t - 0.06);
    const acc = (ahead.v - behind.v) / 0.12;
    const run = Math.min(1, r.v / 300);
    const lean = Math.max(3, Math.min(30, 9 + acc * 0.018 + 4 * run));
    const T1 = lean + (75 - lean) * r.touch;
    const y = 86 + 4 * run - 36 * r.touch;
    let p = pose({ trunk: T1, spine: 8 * r.touch, neck: -(T1 * 0.58) });
    // Arms pump opposite the legs (bigger when faster, still when standing); the near hand reaches the line in a touch.
    let k = -1;
    while (k + 1 < falls.length && falls[k + 1]!.t <= t) k++;
    const ta = k >= 0 ? falls[k]!.t : 0;
    const tb = k + 1 < falls.length ? falls[k + 1]!.t : T;
    const ph = Math.PI * (k + Math.min(1, (t - ta) / Math.max(1e-6, tb - ta)));
    const amp = 46 * run;
    const T2 = p.trunk + p.spine;
    p = { ...p, shR: T2 + 12 + amp * Math.cos(ph), shL: T2 + 12 - amp * Math.cos(ph), elR: 95, elL: 95 };
    for (const sd of ["L", "R"] as const) {
      const f = footAt(sd, t);
      // A planted foot rolls its heel up if the ankle would bend past 40° (the deep crouch at a line).
      p = rollingPlant(p, sd, [0, y], [f.rel, f.lift], 42, f.rot);
    }
    if (r.touch > 0) {
      const P = forwardKinematics(p, "side", [0, y]).pts;
      // In the body's own frame the line is ahead of it (after the turn the figure is drawn mirrored).
      const target: Vec = [Math.abs(r.line - r.x), BODY.r.hand + 0.5];
      let hand: Vec = [P.handR[0] + (target[0] - P.handR[0]) * r.touch, P.handR[1] + (target[1] - P.handR[1]) * r.touch];
      // Reach no further than a slightly bent arm: the hand gets there as the body comes down (no snap to straight).
      const d: Vec = [hand[0] - P.shoulder[0], hand[1] - P.shoulder[1]];
      const L = Math.hypot(d[0], d[1]);
      const max = (BODY.upperArm + BODY.forearm) * 0.94;
      if (L > max) hand = [P.shoulder[0] + (d[0] * max) / L, P.shoulder[1] + (d[1] * max) / L];
      p = armTo(p, "R", [hand[0], hand[1] - y]);
      p = { ...p, shL: p.shL + (T2 - 30 - p.shL) * r.touch, elL: p.elL + (40 - p.elL) * r.touch };
    }
    return { pose: p, pelvis: [r.x, y] };
  });
  // Facing, perspective and the fades, per keyframe.
  for (const kf of keyframes) {
    const tk = keyframes.indexOf(kf) * (T / keyframes.length);
    const r = R(tk);
    if (r.facing === -1) kf.facing = -1;
    kf.zoom = scaleAt(r.z);
    if (r.alpha < 1) kf.alpha = r.alpha;
  }
  const sc = (z: number, x: number): Vec => [ZX + (x - ZX) * scaleAt(z), 0];
  const props: PropDef[] = [
    { id: "lineS", kind: "hurdleLine", variant: "agility", at: [XS, 0], layer: "back" },
    { id: "line2", kind: "hurdleLine", variant: "agility", at: [XC2, 0], layer: "back" },
    { id: "cS", kind: "cone", variant: "agility", at: sc(30, XS), size: scaleAt(30), layer: "back" },
    { id: "c2", kind: "cone", variant: "agility", at: sc(30, XC2), size: scaleAt(30), layer: "back" },
    { id: "c3", kind: "cone", variant: "agility", at: sc(C3[1], C3[0]), size: scaleAt(C3[1]), layer: "front" },
  ];
  return { id, view: "side", label, keyframes, props, zoomAt: ZX, footGrounded: false, stillPhase: 0.12 };
}
