import { BODY, ankleForSole } from "../skeleton";
import {
  FEET,
  armsLocal,
  both,
  centerOfMass,
  keys,
  legTo,
  lm,
  mix,
  pose,
  rep,
  solve1D,
  stanceLegs,
  worldPts,
  type KeySpec,
  type MotionDef,
  type Pose,
  type PropDef,
  type RootRule,
  type Vec,
} from "../build";
import { handsTo, legsTo, toLocal } from "./upper";

export type SplitKind = "split" | "reverse" | "walking" | "bulgarian";
export type HandLoad = "none" | "dumbbells" | "hips";

function handLoad(p: Pose, load: HandLoad): Pose {
  const T2 = p.trunk + p.spine;
  if (load === "dumbbells") return { ...p, shL: T2 + 2, shR: T2 + 2, elL: 3, elR: 3, armDL: 8, armDR: 8 };
  if (load === "hips") return armsLocal(p, [-12, -20], [2, -36]);
  return armsLocal(p, [6, -22], [20, -12]);
}

function dbProps(load: HandLoad): PropDef[] {
  return load === "dumbbells"
    ? [
        { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "profile", angle: 0, layer: "far" },
        { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", angle: 0, layer: "near" },
      ]
    : [];
}

/**
 * Split-stance lunge pattern: near (R) foot forward and planted, far (L) foot behind on the ball of the foot
 * (or on a bench for the Bulgarian split squat). s = 0 top … 1 bottom (rear knee just above the floor).
 */
export function splitSquat(id: string, label: string, kind: SplitKind, load: HandLoad = "none"): MotionDef {
  const benchH = 46;
  const at = (s: number, rearAnkle: Vec, rearRot: number): Pose => {
    const knee = 20 + 80 * s;
    const shin = 8 + 8 * s;
    const T = kind === "bulgarian" ? 18 + 6 * s : 7;
    let p = pose({ ...stanceLegs(shin, knee, T, ["R"]), neck: -2 });
    p = handLoad(p, load);
    // Rear leg reaches its fixed foot position (pelvis-origin coordinates relative to the planted sole).
    const sole = lm(p, "soleR");
    p = legTo(p, "L", [rearAnkle[0] + sole[0], rearAnkle[1] + sole[1]], rearRot);
    return p;
  };
  // Find the rear-foot spot that puts the rear knee ~5 cm above the floor at the bottom.
  const rearRot = kind === "bulgarian" ? -120 : -48;
  let rear: Vec = kind === "bulgarian" ? [-70, benchH + 6] : [-80, 0];
  const bottomProbe = (x: number): number => {
    const r: Vec = kind === "bulgarian" ? [x, benchH + 6] : ankleBall(x, rearRot);
    const p = at(1, r, rearRot);
    const P = worldPts(p, FEET);
    return P.kneeCapL[1] - 5;
  };
  const ankleBall = (x: number, rot: number): Vec => {
    // Ankle position that puts the ball of the rear foot on the floor at x.
    const f: Vec = [Math.cos((rot * Math.PI) / 180), Math.sin((rot * Math.PI) / 180)];
    const u: Vec = [-f[1], f[0]];
    return [x - f[0] * BODY.footFront + u[0] * BODY.ankleH, 0 - f[1] * BODY.footFront + u[1] * BODY.ankleH];
  };
  const x = solve1D(bottomProbe, -110, -40);
  rear = kind === "bulgarian" ? [x, benchH + 6] : ankleBall(x, rearRot);
  const ik = { footL: rear };
  const props: PropDef[] = dbProps(load);
  if (kind === "bulgarian") props.push({ id: "bench", kind: "bench", at: [x - 30, benchH], w: 70, layer: "back" });
  const specs = rep((s) => at(s, rear, rearRot), { down: 1.8, up: 1.1, holdTop: 0.3 }, () => ({ ik }));
  if (kind === "reverse" || kind === "walking") {
    // Step the rear leg back in from standing: start with feet together, step back, lunge, return.
    const standL = at(0, rear, rearRot);
    const together = pose({ ...stanceLegs(1, 2, 2), neck: -2 });
    const tog = handLoad(together, load);
    const lifted = handLoad(pose({ ...stanceLegs(1, 2, 3, ["R"]), hipL: 30, kneeL: 60, ankleL: -10, neck: -2 }), load);
    const keysArr: KeySpec[] = [
      { pose: tog, dur: 0.5, hold: 0.3, ease: "inOut" },
      { pose: mix(lifted, standL, 0.4), dur: 0.5, ease: "inOut" },
      { pose: standL, dur: 1.1, ease: "inOut", ik },
      { pose: at(1, rear, rearRot), dur: 1.0, hold: 0.15, ease: "inOut", ik },
      { pose: standL, dur: 0.5, ease: "inOut", ik },
      { pose: mix(lifted, standL, 0.4), dur: 0.5, ease: "inOut" },
    ];
    return {
      id,
      view: "side",
      label,
      keyframes: keys(FEET, keysArr),
      props,
      planted: ["R"],
      footGrounded: true,
      stillPhase: 0.55,
    };
  }
  return {
    id,
    view: "side",
    label,
    keyframes: keys(FEET, specs),
    props,
    planted: kind === "bulgarian" ? ["R"] : ["L", "R"],
    footGrounded: true,
    stillPhase: 0.5,
  };
}

/** Step-up onto a box with the near leg; the far leg follows and steps back down. */
export function stepUp(id: string, label: string, opts: { boxH?: number; load?: HandLoad; alternate?: boolean } = {}): MotionDef {
  const H = opts.boxH ?? 46;
  const load = opts.load ?? "none";
  const root: RootRule = { pin: "soleR", at: [0, H] };
  // Bottom: near foot on the box, far foot on the floor behind.
  let bottom = pose({ trunk: 16, neck: -6, hipR: 95, kneeR: 98, ankleR: 14 });
  bottom = handLoad(bottom, load);
  const W = worldPts(bottom, root);
  const backFoot = ankleForSole(W.pelvis[0] - 22, 0, -28);
  bottom = legsTo(bottom, root, backFoot, ["L"], -28);
  // Top: standing tall on the box, far knee driven up.
  let top = pose({ trunk: 2, neck: -2, hipR: 2, kneeR: 3, ankleR: 1, hipL: 55, kneeL: 70, ankleL: -8 });
  top = handLoad(top, load);
  const mid = handLoad(pose({ trunk: 8, hipR: 40, kneeR: 45, ankleR: 8, hipL: -10, kneeL: 30, ankleL: -20 }), load);
  const props: PropDef[] = [{ id: "box", kind: "box", at: [6, 0], w: 56, h: H, layer: "back" }, ...dbProps(load)];
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: bottom, dur: 0.7, hold: 0.25, ease: "inOut", ik: { footL: backFoot } },
      { pose: mid, dur: 0.6, ease: "inOut" },
      { pose: top, dur: 0.8, hold: 0.3, ease: "inOut" },
      { pose: mid, dur: 0.8, ease: "inOut" },
    ]),
    props,
    planted: ["R"],
    stillPhase: 0.4,
  };
}

/** Box / chair squat: sit back to touch the seat, stand. */
export function seatSquat(id: string, label: string, opts: { seat?: number; chair?: boolean; barbell?: boolean } = {}): MotionDef {
  const seatH = opts.seat ?? 46;
  if (opts.chair) return chairSitToStand(id, label, seatH);
  const at = (s: number): Pose => {
    // Enough knee range for the hips to reach the box; the depth is then solved so the butt just touches it.
    const knee = 3 + 112 * s;
    const shin = 2 + 8 * s;
    let p = pose({ ...stanceLegs(shin, knee, 4 + 36 * s) });
    const hold = (q: Pose) => (opts.barbell ? armsLocal(q, [-10, -17], [-6.5, 1]) : armsLocal(q, [16, -6 + 10 * s], [44, -6 + 16 * s]));
    for (let i = 0; i < 3; i++) {
      p = hold(p);
      const base = p;
      const T = solve1D((t) => {
        const q = hold({ ...base, trunk: t, hipL: base.hipL + (t - base.trunk), hipR: base.hipR + (t - base.trunk) });
        const c = opts.barbell ? lm(q, "trap") : centerOfMass(q);
        return c[0] - lm(q, "soleR")[0] - (s > 0.9 ? -6 : 2);
      }, -5, 70);
      p = hold({ ...base, trunk: T, hipL: base.hipL + (T - base.trunk), hipR: base.hipR + (T - base.trunk) });
    }
    return p;
  };
  // Depth: the butt just touches the seat.
  const sBottom = solve1D((s) => worldPts(at(s), FEET).butt[1] - seatH, 0.3, 1);
  const P = (s: number) => at(s * sBottom);
  const Wb = worldPts(P(1), FEET);
  const props: PropDef[] = [
    opts.chair
      ? { id: "chair", kind: "chair", at: [Wb.butt[0] + 12, seatH], layer: "back" }
      : { id: "box", kind: "box", at: [Wb.butt[0] - 6, 0], w: 40, h: seatH, layer: "back" },
  ];
  if (opts.barbell) props.push({ id: "bar", kind: "barbell", at: { lm: "trap" }, layer: "front" });
  return {
    id,
    view: "side",
    label,
    keyframes: keys(FEET, rep(P, { down: 2, up: 1, holdBottom: 0.5, holdTop: 0.4 })),
    props,
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.5,
  };
}

/** Hip thrust (upper back on a bench) or glute bridge (on the floor). */
/**
 * Sit-to-stand: sits all the way down onto the chair (the chair takes the weight, so the body need not stay balanced
 * over the feet at the bottom), then leans forward until the chest is over the toes and stands up.
 */
function chairSitToStand(id: string, label: string, seatH: number): MotionDef {
  const arms = (q: Pose, s: number) => armsLocal(q, [16, -6 + 10 * s], [44, -6 + 16 * s]);
  const legs = (shin: number, knee: number, trunk: number) => pose({ ...stanceLegs(shin, knee, trunk) });
  // Standing and part-way down: balanced over the feet, as in an unsupported squat.
  const balanced = (s: number): Pose => {
    let p = arms(legs(2 + 26 * s, 3 + 95 * s, 4 + 36 * s), s);
    const base = p;
    const T = solve1D((t) => {
      const q = arms({ ...base, trunk: t, hipL: base.hipL + (t - base.trunk), hipR: base.hipR + (t - base.trunk) }, s);
      // Weight a little behind mid-foot (still well in front of the heel) as the hips reach back for the seat.
      return centerOfMass(q)[0] - lm(q, "soleR")[0] + 3;
    }, -5, 70);
    p = arms({ ...base, trunk: T, hipL: base.hipL + (T - base.trunk), hipR: base.hipR + (T - base.trunk) }, s);
    return p;
  };
  // Seated: feet slightly behind the knees, torso leaning forward a little, knees bent just enough for the butt to rest
  // on the seat.
  const shin = 12;
  const seatedAt = (trunk: number) => {
    const knee = solve1D((k) => worldPts(arms(legs(shin, k, trunk), 1), FEET).butt[1] - seatH, 60, 130);
    return arms(legs(shin, knee, trunk), 1);
  };
  const seated = seatedAt(24);
  // Before rising: same legs, chest brought forward ("nose over toes", about 40° from upright — typical trunk flexion at
  // seat-off) so the weight moves toward the feet; the forward momentum carries it the rest of the way.
  const leanBase = seated;
  const leanT = 42;
  const lean = arms({ ...leanBase, trunk: leanT, hipL: leanBase.hipL + (leanT - leanBase.trunk), hipR: leanBase.hipR + (leanT - leanBase.trunk) }, 1);
  const Ws = worldPts(seated, FEET);
  const specs: KeySpec[] = [
    { pose: balanced(0), dur: 1, hold: 0.4, ease: "spline" },
    { pose: balanced(0.5), dur: 1.1, ease: "spline" },
    { pose: seated, dur: 0.5, hold: 0.5, ease: "inOut" },
    { pose: lean, dur: 0.5, ease: "inOut" },
    { pose: balanced(0.5), dur: 0.5, ease: "spline" },
  ];
  return {
    id,
    view: "side",
    label,
    keyframes: keys(FEET, specs),
    // Front edge of the seat ahead of the buttocks: sits toward the front of the chair, thighs supported.
    props: [{ id: "chair", kind: "chair", at: [Ws.butt[0] + 22, seatH], layer: "back" }],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.45,
  };
}

export function bridge(id: string, label: string, opts: { bench?: boolean; barbell?: boolean; singleLeg?: boolean } = {}): MotionDef {
  const benchH = 42;
  // Floor bridge pivots on the shoulder blades (shoulders stay down, the neck flexes as the hips rise).
  const root: RootRule = opts.bench ? { pin: "upperBack", at: [0, benchH + 2] } : { pin: "shoulder", at: [0, BODY.r.torsoBack] };
  // Feet flat, about a shin-length in front of the hips.
  const flat = pose({ trunk: opts.bench ? -60 : -90 });
  const footX = worldPts(flat, root).pelvis[0] + (opts.bench ? 46 : 56);
  const ankle = ankleForSole(footX, 0);
  const at = (T: number) => {
    // On the bench the chin stays tucked with the eyes forward, so the neck flexes further as the torso levels out.
    let p = pose({ trunk: T, neck: opts.bench ? Math.min(46, 22 + Math.max(0, -60 - T) * 0.8) : 8 + Math.max(0, -90 - T) });
    p = legsTo(p, root, ankle);
    if (opts.barbell) {
      const W = worldPts(p, root);
      p = handsTo({ ...p, ...both({ armD: 30 }) }, root, [W.hipCrease[0], W.hipCrease[1] + 4]);
    } else if (!opts.bench) {
      // Arms flat on the floor beside the body.
      const W = worldPts(p, root);
      p = handsTo(p, root, [W.shoulder[0] + BODY.upperArm + BODY.forearm - 2, BODY.r.hand]);
    } else p = armsLocal(p, [-6, -14], [16, -18]);
    return p;
  };
  // Bottom: hips low (bar plates on the floor for a hip thrust); top: hips extended (thighs in line with the trunk).
  const bottomT = opts.bench ? solve1D((t) => worldPts(at(t), root).hipCrease[1] - (opts.barbell ? 24 : 18), -30, -89) : -90;
  const topT = solve1D((t) => at(t).hipR - 4, opts.bench ? -60 : -90, opts.bench ? -100 : -140);
  const props: PropDef[] = [];
  if (opts.bench) props.push({ id: "bench", kind: "bench", at: [-44, benchH], w: 90, layer: "back" });
  else props.push({ id: "mat", kind: "mat", at: [20, 0], w: 200, layer: "back" });
  if (opts.barbell) props.push({ id: "bar", kind: "barbell", at: { lm: "hipCrease", dy: 4 }, layer: "front" });
  const handPt: Vec = [worldPts(at(-90), root).shoulder[0] + BODY.upperArm + BODY.forearm - 2, BODY.r.hand + 4];
  const ik = !opts.bench && !opts.barbell ? { footL: ankle, footR: ankle, handL: handPt, handR: handPt } : { footL: ankle, footR: ankle };
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: at(bottomT), dur: 0.5, hold: 0.3, ease: "spline", ik },
      { pose: at((bottomT + topT) / 2), dur: 0.5, ease: "spline", ik },
      { pose: at(topT), dur: 1, hold: 0.6, ease: "spline", ik },
      { pose: at((bottomT + topT) / 2), dur: 1, ease: "spline", ik },
    ]),
    props,
    stillPhase: 0.55,
  };
}

/** Calf raise standing (or seated in a machine). */
export function calfRaise(id: string, label: string, opts: { seated?: boolean } = {}): MotionDef {
  if (opts.seated) {
    const root: RootRule = { pin: "butt", at: [0, 50] };
    const base = pose({ trunk: 2, ...both({ hip: 88, knee: 92, ankle: 6 }) });
    const plat: Vec = [0, 0];
    void plat;
    const Wb = worldPts(base, root);
    const ball: Vec = [Wb.ballR[0], 10];
    const at = (rot: number) => {
      let p = base;
      // Keep the ball of the foot on the platform, rotate the foot, solve the leg.
      const f: Vec = [Math.cos((rot * Math.PI) / 180), Math.sin((rot * Math.PI) / 180)];
      const u: Vec = [-f[1], f[0]];
      const ank: Vec = [ball[0] - f[0] * BODY.footFront + u[0] * BODY.ankleH, ball[1] - f[1] * BODY.footFront + u[1] * BODY.ankleH];
      p = legsTo(p, root, ank, ["L", "R"], rot);
      return { p, ank };
    };
    const lo = at(14);
    const hi = at(-26);
    return {
      id,
      view: "side",
      label,
      keyframes: keys(root, [
        { pose: lo.p, dur: 1, hold: 0.4, ease: "inOut", ik: { footL: lo.ank, footR: lo.ank } },
        { pose: hi.p, dur: 1.5, hold: 0.5, ease: "inOut", ik: { footL: hi.ank, footR: hi.ank } },
      ]),
      props: [{ id: "m", kind: "calfMachine", at: [Wb.butt[0], 50], to: { lm: "kneeR", dy: 6 }, layer: "near" }],
      stillPhase: 0.5,
    };
  }
  const root: RootRule = { pin: "ballR", at: [0, 0] };
  const low = armsLocal(pose({ trunk: 1 }), [-4, -24], [6, -48]);
  const high = { ...low, ...both({ ankle: -34 }) };
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: low, dur: 1, hold: 0.3, ease: "inOut" },
      { pose: high, dur: 1.5, hold: 0.6, ease: "inOut" },
    ]),
    props: [
      { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "profile", angle: 0, layer: "far" },
      { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", angle: 0, layer: "near" },
    ],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.6,
  };
}

/** Leg press (sled at 45°). */
export function legPress(id: string, label: string): MotionDef {
  const root: RootRule = { pin: "butt", at: [0, 40] };
  const base = pose({ trunk: -48, neck: 14, ...both({ hip: 60, knee: 40, ankle: 0 }) });
  const W = worldPts(base, root);
  const hip = W.pelvis;
  const dir: Vec = [Math.SQRT1_2, Math.SQRT1_2];
  const rot = 135; // sole facing the platform (perpendicular to the rail), toes up
  const ankleAt = (d: number): Vec => [hip[0] + dir[0] * d + 6, hip[1] + dir[1] * d - 10];
  const at = (d: number) => {
    const a = ankleAt(d);
    return { p: legsTo(armsLocal(base, [10, -26], [24, -40]), root, a, ["L", "R"], rot), a };
  };
  const top = at(84);
  const bot = at(70);
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: top.p, dur: 2, hold: 0.3, ease: "inOut", ik: { footL: top.a, footR: top.a } },
      { pose: bot.p, dur: 1.2, hold: 0.2, ease: "inOut", ik: { footL: bot.a, footR: bot.a } },
    ]),
    // Back pad along the line from the buttocks to the upper back, so the lifter visibly lies on it.
    props: [{ id: "m", kind: "legPress", at: W.butt, angle: (Math.atan2(W.upperBack[0] - W.butt[0], W.upperBack[1] - W.butt[1]) * 180) / Math.PI, to: { lm: "ballR" }, layer: "mid" }],
    stillPhase: 0.4,
  };
}

/** Hack squat: back on an angled sled, feet on the platform. */
export function hackSquat(id: string, label: string): MotionDef {
  const lean = -18;
  const at = (s: number): Pose => {
    const knee = 3 + 108 * s;
    // Shin lean that keeps the trunk on the sled line (fixed lean): pelvis moves along the rail.
    const shin = 2 + 30 * s;
    return armsLocal(pose({ ...stanceLegs(shin, knee, lean), neck: 6 }), [6, -6], [-2, 10]);
  };
  const W = worldPts(at(0), FEET);
  return {
    id,
    view: "side",
    label,
    keyframes: keys(FEET, rep(at, { down: 2, up: 1.1, holdTop: 0.3 })),
    props: [{ id: "m", kind: "hackSquat", at: [W.heelR[0] - 10, 6], angle: 72, to: { lm: "upperBack" }, layer: "back" }],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0.5,
  };
}

/** Seated leg extension / seated leg curl / lying leg curl machines. */
export function legMachine(id: string, label: string, kind: "extension" | "seated-curl" | "lying-curl"): MotionDef {
  if (kind === "lying-curl") {
    const root: RootRule = { pin: "chest", at: [0, 74] };
    const base = pose({ trunk: 90, neck: -20, ...both({ hip: 6, ankle: -10 }) });
    const at = (k: number) => armsLocal({ ...base, ...both({ knee: k }) }, [10, -20], [24, -12]);
    const W = worldPts(at(0), root);
    return {
      id,
      view: "side",
      label,
      keyframes: keys(root, [
        { pose: at(4), dur: 1, hold: 0.3, ease: "inOut" },
        { pose: at(118), dur: 2, hold: 0.4, ease: "inOut" },
      ]),
      props: [{ id: "m", kind: "legCurl", at: [W.kneeR[0] - 4, 66], to: { lm: "ankleR", dy: 6 }, layer: "back" }],
      stillPhase: 0.5,
    };
  }
  const root: RootRule = { pin: "butt", at: [0, 52] };
  const base = pose({ trunk: -6, ...both({ hip: 92, ankle: 8 }) });
  const ext = kind === "extension";
  const at = (k: number) => armsLocal({ ...base, ...both({ knee: k }) }, [4, -26], [20, -44]);
  const W = worldPts(at(90), root);
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: at(ext ? 92 : 6), dur: 1, hold: 0.3, ease: "inOut" },
      { pose: at(ext ? 6 : 110), dur: 2, hold: 0.4, ease: "inOut" },
    ]),
    props: [{ id: "m", kind: ext ? "legExtension" : "seatedLegCurl", at: [W.kneeR[0] + 2, 52], to: { lm: "ankleR", dx: ext ? 5 : -5 }, layer: "back" }],
    stillPhase: 0.5,
  };
}

/** Single-leg Romanian deadlift on the near leg, dumbbell in the near hand. */
export function singleLegRdl(id: string, label: string): MotionDef {
  const at = (s: number): Pose => {
    const T = 4 + 76 * s;
    const knee = 8 + 14 * s;
    let p = pose({ ...stanceLegs(0, knee, T, ["R"]), neck: -T * 0.3, hipL: T - T * 0.98, kneeL: 6 + 4 * s, ankleL: -10 - 10 * s });
    const T2 = p.trunk;
    p = { ...p, shR: T2, elR: 2, shL: T2 + 8 * s, elL: 6 };
    // Balance: centre of mass (plus the dumbbell) over the stance foot via shin lean.
    const base = p;
    const shin = solve1D((sh) => {
      const q = { ...base, ...stanceLegs(sh, knee, T, ["R"]) };
      return centerOfMass(q, [{ at: lm(q, "handR"), mass: 0.12 }])[0] - lm(q, "soleR")[0];
    }, -25, 25);
    return { ...base, ...stanceLegs(shin, knee, T, ["R"]) };
  };
  return {
    id,
    view: "side",
    label,
    keyframes: keys(FEET, rep(at, { down: 1.8, up: 1.2, holdTop: 0.3 })),
    props: [{ id: "db", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", angle: 0, layer: "near" }],
    planted: ["R"],
    footGrounded: true,
    stillPhase: 0.6,
  };
}

/** Nordic hamstring curl: kneeling, ankles held, lower forward under control, catch, push back. */
export function nordic(id: string, label: string): MotionDef {
  const root: RootRule = { pin: "kneeCapR", at: [0, 0] };
  const at = (T: number) => {
    const p = pose({ trunk: T, neck: -4, ...both({ hip: 0, knee: 90 - T, ankle: -68 }) });
    return armsLocal(p, [10, -14], [14, 6]);
  };
  // Lowered as far as control allows, the hands catch the floor; a push returns to kneeling.
  const low = at(62);
  const Wl = worldPts(low, root);
  const hand: Vec = [Wl.shoulder[0] + 26, BODY.r.hand];
  const catchP = handsTo({ ...at(70), ...both({ armD: 20 }) }, root, hand);
  const push = handsTo({ ...at(50), ...both({ armD: 20 }) }, root, hand);
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: at(0), dur: 2.6, hold: 0.4, ease: "in" },
      { pose: { ...low, ...both({ sh: low.trunk + 70, el: 30 }) }, dur: 0.4, ease: "out" },
      { pose: catchP, dur: 0.6, ease: "inOut", ik: { handL: hand, handR: hand } },
      { pose: push, dur: 0.9, ease: "inOut", ik: { handL: hand, handR: hand } },
    ]),
    props: [
      { id: "pad", kind: "pad", at: [-20, 2], w: 70, layer: "back" },
      { id: "anchor", kind: "pad", at: { lm: "ankleR", dy: 6 }, w: 12, h: 8, layer: "near" },
    ],
    stillPhase: 0.25,
  };
}

/** 45° back extension (hyperextension bench). */
export function backExtension(id: string, label: string): MotionDef {
  const root: RootRule = { pin: "ankleR", at: [0, 22] };
  const at = (hip: number) => armsLocal(pose({ trunk: 45 + hip, neck: -hip * 0.25, ...both({ hip, knee: 2, ankle: -40 }) }), [12, -10], [16, 8]);
  const top = at(0);
  const bottom = at(88);
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [
      { pose: top, dur: 2, hold: 0.4, ease: "inOut" },
      { pose: bottom, dur: 1.2, hold: 0.2, ease: "inOut" },
    ]),
    props: [{ id: "bench", kind: "hyper", at: { lm: "thighR", dx: 0, dy: 0 }, to: { lm: "ankleR" }, layer: "near" }],
    stillPhase: 0.5,
  };
}

/** Seated hip abduction (machine or band above the knees), front view. */
export function hipAbduction(id: string, label: string): MotionDef {
  const root: RootRule = { pin: "pelvis", at: [0, 52] };
  const at = (abd: number) =>
    pose({ trunk: 0, neck: 0, hipL: 84, hipR: 84, legDL: 90 - abd, legDR: 90 - abd, kneeL: 0, kneeR: 0, ankleL: abd * 0.25, ankleR: abd * 0.25, shL: 22, shR: 22, elL: 30, elR: 30 });
  return {
    id,
    view: "front",
    label,
    keyframes: keys(root, [
      { pose: at(8), dur: 1.4, hold: 0.3, ease: "inOut" },
      { pose: at(42), dur: 1.2, hold: 0.8, ease: "inOut" },
    ]),
    props: [
      { id: "seat", kind: "box", at: [0, 0], w: 50, h: 44, layer: "far" },
      { id: "band", kind: "band", at: { lm: "kneeL", dy: 6 }, to: { lm: "kneeR", dy: 6 }, layer: "near" },
    ],
    allowLimits: ["hipL", "hipR"],
    stillPhase: 0.5,
  };
}

export { toLocal };
