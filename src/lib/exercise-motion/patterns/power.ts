import { BODY, ankleForSole } from "../skeleton";
import {
  armsLocal,
  both,
  keys,
  mix,
  pose,
  stanceLegs,
  trackSteps,
  worldPts,
  type Anchor,
  type KeySpec,
  type MotionDef,
  type Pose,
  type PropDef,
  type RootRule,
  type StepFrame,
  type Vec,
} from "../build";
import { pullPose, squatPose } from "./lower";
import { handsTo, legsTo } from "./upper";


const ARM = BODY.upperArm + BODY.forearm;
/** Feet pinned at the ball so heels can rise (flat foot: ball sits 11 cm ahead of mid-foot). */
const BALL = (x = 11, y = 0): RootRule => ({ pin: "ballR", at: [x, y] });
const k = (pose: Pose, dur: number, extra: Partial<KeySpec> = {}): KeySpec => ({ pose, dur, ease: "inOut", ...extra });

function armsUp(p: Pose, a = 175): Pose {
  const T2 = p.trunk + p.spine;
  return { ...p, shL: a + T2, shR: a + T2, elL: 4, elR: 4 };
}
function armsBack(p: Pose, a = -40): Pose {
  const T2 = p.trunk + p.spine;
  return { ...p, shL: a + T2, shR: a + T2, elL: 6, elR: 6 };
}

const standP = () => armsLocal(pose({ ...stanceLegs(1, 3, 2) }), [-2, -28], [6, -56]);

/** Countermovement jumps: onto a box, forward (broad jump), with a trap bar, pogo hops. */
export function jump(id: string, label: string, kind: "box" | "broad" | "trap-bar" | "pogo" | "tuck"): MotionDef {
  if (kind === "pogo") {
    const p = pose({ ...stanceLegs(2, 6, 2), ...both({ sh: 10, el: 30 }) });
    const off = { ...p, ...both({ ankle: -30, knee: 4 }) };
    return {
      id,
      view: "side",
      label,
      keyframes: keys(BALL(), [
        k(p, 0.12, { ease: "out" }),
        k(off, 0.16, { root: BALL(11, 10), ease: "out" }),
        k(off, 0.12, { root: BALL(11, 1), ease: "in" }),
      ]),
      props: [],
      stillPhase: 0.4,
    };
  }
  const dip = armsBack(squatPose(0.42, { id, label, load: "arms-forward" }), -50);
  const drive = armsUp(pose({ ...stanceLegs(-6, 2, 4), ...both({ ankle: -30 }) }), 160);
  const tuck = armsUp(pose({ trunk: 18, ...both({ hip: 95, knee: 120, ankle: -10 }) }), 70);
  const land = armsLocal(squatPose(0.38, { id, label, load: "arms-forward" }), [12, -14], [40, -10]);
  const stand = standP();
  if (kind === "trap-bar") {
    const hold = (p: Pose) => {
      const T2 = p.trunk + p.spine;
      return { ...p, shL: T2 + 2, shR: T2 + 2, elL: 2, elR: 2 };
    };
    const d = hold(pullPose(55, { id, label }));
    const st = hold(pose({ ...stanceLegs(1, 3, 2) }));
    const up = hold({ ...st, ...both({ ankle: -32 }) });
    return {
      id,
      view: "side",
      label,
      keyframes: keys(BALL(), [
        k(st, 0.5, { hold: 0.4 }),
        k(d, 0.25, { ease: "out" }),
        k(up, 0.25, { root: BALL(11, 18), ease: "out" }),
        k(up, 0.25, { root: BALL(11, 1), ease: "in" }),
        k(hold(pullPose(65, { id, label })), 0.5, { hold: 0.2 }),
      ]),
      props: [{ id: "bar", kind: "trapBar", at: { lm: "hands" }, layer: "front" }],
      stillPhase: 0.45,
    };
  }
  const dist = kind === "box" ? 64 : kind === "broad" ? 170 : 0;
  const boxH = kind === "box" ? 50 : 0;
  const peak: RootRule = { pin: "soleR", at: [dist * 0.5, boxH + 26] };
  const landRoot: RootRule = { pin: "soleR", at: [dist, boxH] };
  const start: RootRule = BALL();
  const specs: KeySpec[] = [
    k(stand, 0.5, { hold: 0.5, root: start }),
    k(dip, 0.3, { root: start, ease: "out" }),
    k(drive, 0.18, { root: start, ease: "linear" }),
    k(tuck, 0.22, { root: peak, ease: "linear" }),
    k(land, 0.45, { root: landRoot, ease: "out", hold: 0.25 }),
    k(stand, 0.4, { root: landRoot, hold: 0.4 }),
    k(stand, 0.01, { root: landRoot, alpha: 0 }),
    k(stand, 0.35, { root: start, alpha: 0 }),
  ];
  // Fade back to the start position.
  specs[5]!.dur = 0.35;
  const props: PropDef[] = kind === "box" ? [{ id: "box", kind: "box", at: [dist + 4, 0], w: 62, h: boxH, layer: "back" }] : [{ id: "line", kind: "hurdleLine", at: [-14, 0], w: 6, layer: "back" }];
  return { id, view: "side", label, keyframes: keys(start, specs), props, stillPhase: 0.32 };
}

/** Power clean (optionally followed by a press: axle / log handled in upper.ts). */
export function powerClean(id: string, label: string): MotionDef {
  const floor = pullPose(22.5, { id, label });
  const knee = pullPose(52, { id, label });
  const ext = (() => {
    const p = pose({ ...stanceLegs(-8, 4, -6), ...both({ ankle: -30 }) });
    const T2 = p.trunk;
    return { ...p, shL: T2 + 8, shR: T2 + 8, elL: 6, elR: 6, neck: -6 };
  })();
  const pull = (() => {
    const p = pose({ ...stanceLegs(-6, 4, -4), ...both({ ankle: -26 }) });
    return armsLocal(p, [-6, 2], [8, -4]);
  })();
  const catchP = squatPose(0.32, { id, label, load: "front" });
  const stand = squatPose(0, { id, label, load: "front" });
  return {
    id,
    view: "side",
    label,
    keyframes: keys(BALL(), [
      k(floor, 0.5, { hold: 0.5, ease: "in", props: { bar: { lm: "hands" } } }),
      k(knee, 0.22, { ease: "linear", props: { bar: { lm: "hands" } } }),
      k(ext, 0.14, { ease: "linear", props: { bar: { lm: "hands" } } }),
      k(pull, 0.16, { ease: "out", props: { bar: { lm: "hands" } } }),
      k(catchP, 0.6, { hold: 0.25, props: { bar: { lm: "rack" } } }),
      k(stand, 0.4, { hold: 0.5, props: { bar: { lm: "rack" } } }),
      k(mix(stand, knee, 0.3), 0.8, { props: { bar: { lm: "hands" } } }),
    ]),
    props: [{ id: "bar", kind: "barbell", at: { lm: "hands" }, layer: "front" }],
    stillPhase: 0.36,
  };
}

/** Medicine-ball slam and scoop toss (side view). */
export function medBall(id: string, label: string, kind: "slam" | "scoop"): MotionDef {
  if (kind === "slam") {
    const top = armsUp(pose({ ...stanceLegs(-4, 2, -6), ...both({ ankle: -16 }) }), 178);
    const slam = (() => {
      const p = pose({ ...stanceLegs(12, 40, 55), neck: -20 });
      const T2 = p.trunk;
      return { ...p, shL: T2 + 70, shR: T2 + 70, elL: 6, elR: 6 };
    })();
    const W = worldPts(slam, { pin: "soleR", at: [0, 0] });
    const floorPt: Vec = [W.handR[0] + 6, 12];
    const pick = (() => {
      let p = squatPose(0.72, { id, label, load: "arms-forward" });
      p = handsTo(p, { pin: "soleR", at: [0, 0] }, [floorPt[0], 12 + 10]);
      return p;
    })();
    return {
      id,
      view: "side",
      label,
      keyframes: keys(BALL(), [
        k(top, 0.35, { hold: 0.2, ease: "in", props: { ball: { lm: "hands", dy: 4 } } }),
        k(slam, 0.18, { ease: "out", props: { ball: { lm: "hands", dy: -6 } } }),
        k(slam, 0.25, { ease: "out", props: { ball: floorPt } }),
        k(pick, 0.6, { props: { ball: [floorPt[0], 22] } }),
        k(pick, 0.6, { props: { ball: { lm: "hands", dy: -2 } } }),
      ]),
      props: [{ id: "ball", kind: "medball", at: { lm: "hands" }, layer: "front" }],
      planted: ["L", "R"],
      footGrounded: true,
      stillPhase: 0.12,
    };
  }
  const low = (() => {
    let p = squatPose(0.6, { id, label, load: "arms-forward" });
    const T2 = p.trunk;
    p = { ...p, shL: T2 + 10, shR: T2 + 10, elL: 4, elR: 4 };
    return p;
  })();
  const throwP = armsUp(pose({ ...stanceLegs(-6, 2, -10), ...both({ ankle: -28 }) }), 150);
  return {
    id,
    view: "side",
    label,
    keyframes: keys(BALL(), [
      k(low, 0.35, { hold: 0.3, ease: "in", props: { ball: { lm: "hands", dy: -4 } } }),
      k(throwP, 0.25, { ease: "out", props: { ball: { lm: "hands", dy: 4 } } }),
      k(throwP, 0.5, { ease: "out", props: { ball: [150, 215] } }),
      k(standP(), 0.5, { props: { ball: [70, 225] }, ease: "in" }),
      k(standP(), 0.5, { props: { ball: { lm: "hands", dy: -2 } } }),
    ]),
    props: [{ id: "ball", kind: "medball", at: { lm: "hands" }, layer: "front" }],
    stillPhase: 0.15,
  };
}

/** Strongman / sandbag pick-ups: floor → lap → extend → load (shoulder or platform). */
export function loadObject(id: string, label: string, kind: "stone" | "sandbag-platform" | "sandbag-shoulder"): MotionDef {
  const root: RootRule = { pin: "soleR", at: [0, 0] };
  const stone = kind === "stone";
  const r = stone ? 23 : 15;
  const floorObj: Vec = [stone ? 26 : 22, r];
  const hinge = (() => {
    let p = pose({ ...stanceLegs(16, 80, 62), spine: 18, neck: -16 });
    p = handsTo({ ...p, ...both({ armD: 40 }) }, root, [floorObj[0] + 4, floorObj[1] - 8]);
    return p;
  })();
  const lap = (() => {
    let p = pose({ ...stanceLegs(26, 112, 30), spine: 10, neck: -6 });
    const W = worldPts(p, root);
    p = handsTo({ ...p, ...both({ armD: 40 }) }, root, [W.kneeR[0] - 2, W.kneeR[1] + 2]);
    return p;
  })();
  const lapObj: Anchor = { lm: "thighR", dx: 4, dy: r + 4 };
  const extend = armsLocal(pose({ ...stanceLegs(4, 10, -8) }), [14, -24], [22, -6]);
  const chestObj: Anchor = { lm: "chest", dx: r * 0.7, dy: 0 };
  const shoulderObj: Anchor = { lm: "shoulder", dx: -9, dy: 11 };
  const platH = stone ? 110 : 100;
  const platX = 72;
  const topObj: Vec = [platX - 6, platH + r];
  const specs: KeySpec[] = [
    k(hinge, 0.7, { hold: 0.5, props: { obj: floorObj } }),
    k(lap, 0.8, { hold: 0.3, props: { obj: lapObj } }),
    k(extend, 0.6, { props: { obj: kind === "sandbag-shoulder" ? shoulderObj : chestObj } }),
  ];
  if (kind === "sandbag-shoulder") {
    const top = armsLocal(pose({ ...stanceLegs(1, 3, 0) }), [-4, -16], [4, 14]);
    specs.push(k(top, 0.8, { hold: 0.6, props: { obj: shoulderObj } }), k(standP(), 0.6, { props: { obj: [26, r] } }), k(hinge, 0.5, { props: { obj: floorObj }, alpha: 1 }));
  } else {
    const reach = armsLocal(pose({ ...stanceLegs(2, 6, 8) }), [24, -6], [46, 0]);
    specs.push(
      k(reach, 0.6, { hold: 0.3, props: { obj: topObj } }),
      k(standP(), 0.4, { hold: 0.4, props: { obj: topObj } }),
      k(standP(), 0.3, { props: { obj: topObj }, alpha: 0 }),
      k(hinge, 0.3, { props: { obj: floorObj }, alpha: 0 }),
    );
  }
  const props: PropDef[] = [
    stone ? { id: "obj", kind: "stone", at: floorObj, size: r, layer: "front" } : { id: "obj", kind: "sandbag", at: floorObj, w: 44, h: 28, layer: "front" },
  ];
  if (kind !== "sandbag-shoulder") props.unshift({ id: "plat", kind: "platform", at: [platX + 14, 0], w: 44, h: platH, layer: "back" });
  return { id, view: "side", label, keyframes: keys(root, specs), props, planted: ["L", "R"], footGrounded: true, stillPhase: 0.3 };
}

// -------------------------------------------------------------------------------------- Conditioning

/** Burpee family: squat thrust (jump or step back), sprawl. */
export function burpee(id: string, label: string, kind: "jump" | "step" | "sprawl"): MotionDef {
  const feet: RootRule = { pin: "soleR", at: [0, 0] };
  const stand = kind === "sprawl" ? armsLocal(pose({ ...stanceLegs(14, 38, 22), neck: -14 }), [16, -10], [30, 8]) : standP();
  const squat = (() => {
    const p = pose({ ...stanceLegs(30, 128, 52), neck: -20 });
    const W = worldPts(p, feet);
    return { p: handsTo(p, feet, [W.kneeR[0] + 12, BODY.r.hand]), hand: [W.kneeR[0] + 12, BODY.r.hand] as Vec };
  })();
  const hand = squat.hand;
  const handsRoot: RootRule = { pin: "handR", at: hand };
  const plank = (() => {
    // Body angle chosen so the toes reach the floor with the hands under the shoulders.
    const mk = (T: number) => {
      const p = pose({ trunk: T, spine: kind === "sprawl" ? -20 : 0, neck: kind === "sprawl" ? -26 : -6, ...both({ hip: kind === "sprawl" ? -6 : 0, knee: 0, ankle: -82 + T }) });
      const T2 = p.trunk + p.spine;
      return { ...p, shL: T2 + 2, shR: T2 + 2, elL: 2, elR: 2 };
    };
    let best = mk(70);
    let err = Infinity;
    for (let t = 50; t <= 89; t += 0.25) {
      const W = worldPts(mk(t), handsRoot);
      const e = Math.abs(Math.min(W.toeL[1], W.ballL[1]));
      if (e < err) {
        err = e;
        best = mk(t);
      }
    }
    return best;
  })();
  const specs: KeySpec[] = [k(stand, 0.4, { hold: 0.2, root: feet }), k(squat.p, 0.35, { root: feet, ik: { handL: hand, handR: hand } })];
  // Weight on the hands with the hips high: the in-between position as the feet jump / step back.
  const kick = (() => {
    const T = 80;
    const p = pose({ trunk: T, neck: -14, ...both({ hip: T - 70, knee: 10, ankle: -30 }) });
    return { ...p, shL: T + 2, shR: T + 2, elL: 2, elR: 2 };
  })();
  // Feet tucked off the floor under the hips, weight on the hands.
  const tuck = (() => {
    const T = 78;
    const p = pose({ trunk: T, neck: -16, ...both({ hip: 120, knee: 130, ankle: -10 }) });
    return { ...p, shL: T + 2, shR: T + 2, elL: 2, elR: 2 };
  })();
  if (kind === "step") {
    const half = (() => {
      const T = 86;
      const p = pose({ trunk: T, neck: -12, hipR: T + 22, kneeR: 112, ankleR: 20, hipL: T - 48, kneeL: 2, ankleL: -82 + 48 });
      return { ...p, shL: T + 2, shR: T + 2, elL: 2, elR: 2 };
    })();
    specs.push(
      k(half, 0.5, { root: handsRoot }),
      k(plank, 0.5, { root: handsRoot, hold: 0.2 }),
      k(half, 0.5, { root: handsRoot }),
      k(squat.p, 0.5, { root: feet, ik: { handL: hand, handR: hand } }),
    );
  } else {
    specs.push(
      k(tuck, 0.1, { root: handsRoot, ease: "linear" }),
      k(kick, 0.12, { root: handsRoot, ease: "linear" }),
      k(plank, 0.18, { root: handsRoot, hold: kind === "sprawl" ? 0.3 : 0.15, ease: "out" }),
      k(kick, 0.12, { root: handsRoot, ease: "linear" }),
      k(tuck, 0.1, { root: handsRoot, ease: "linear" }),
      k(squat.p, 0.14, { root: feet, ik: { handL: hand, handR: hand }, ease: "out" }),
    );
  }
  if (kind === "jump") {
    const air = armsUp(pose({ ...stanceLegs(0, 2, 2), ...both({ ankle: -28 }) }));
    specs.push(k(air, 0.3, { root: { pin: "soleR", at: [0, 24] }, ease: "out" }), k(standP(), 0.3, { root: feet, ease: "in" }));
  }
  return { id, view: "side", label, keyframes: keys(feet, specs), props: [], stillPhase: 0.32 };
}

/** Mountain climbers (hands fixed) and bear crawl. */
export function mountainClimber(id: string, label: string): MotionDef {
  const hand: Vec = [0, BODY.r.hand];
  const root: RootRule = { pin: "handR", at: hand };
  const mk = (T: number) => {
    const p = pose({ trunk: T, neck: -6, ...both({ hip: 0, knee: 0, ankle: -82 + T }) });
    return { ...p, shL: T + 2, shR: T + 2, elL: 2, elR: 2 };
  };
  let T = 74;
  let err = Infinity;
  for (let t = 60; t <= 89; t += 0.25) {
    const e = Math.abs(worldPts(mk(t), root).toeL[1]);
    if (e < err) {
      err = e;
      T = t;
    }
  }
  const base = mk(T);
  const a = { ...base, hipR: 112, kneeR: 132, ankleR: -30 };
  const b = { ...base, hipL: 112, kneeL: 132, ankleL: -30 };
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, [k(a, 0.28), k(b, 0.28)]),
    props: [],
    stillPhase: 0,
  };
}

export function bearCrawl(id: string, label: string): MotionDef {
  // Hands under the shoulders, knees bent ~90° and hovering, on the balls of the feet.
  const T = 80;
  const frames: StepFrame[] = [];
  const N = 6;
  for (let i = 0; i < N; i++) {
    const ph = (i / N) * Math.PI * 2;
    const sR = Math.sin(ph);
    const sL = Math.sin(ph + Math.PI);
    const thR = 28 + 12 * sR;
    const thL = 28 + 12 * sL;
    const liftR = Math.max(0, Math.cos(ph)) * 14;
    const liftL = Math.max(0, -Math.cos(ph)) * 14;
    const p = pose({
      trunk: T,
      neck: -22,
      hipR: thR + T,
      hipL: thL + T,
      kneeR: 92 + liftR,
      kneeL: 92 + liftL,
      ankleR: 38,
      ankleL: 38,
      shR: T + 10 * sL,
      shL: T + 10 * sR,
      elR: 4 + liftL * 0.8,
      elL: 4 + liftR * 0.8,
    });
    frames.push({ pose: p, stance: Math.cos(ph) >= 0 ? "L" : "R", dur: 0.24 });
  }
  const { keyframes, travel } = trackSteps(frames);
  return { id, view: "side", label, keyframes, travel, props: [], stillPhase: 0 };
}

/** Rowing machine stroke. */
export function rowing(id: string, label: string): MotionDef {
  const seatY = 40;
  const foot = ankleForSole(0, 14, 50);
  const P = (x: number, T: number, hand: Vec | null) => {
    const root: RootRule = { pin: "butt", at: [x, seatY] };
    let p = pose({ trunk: T, neck: -4, ...both({ armD: 10 }) });
    p = legsTo(p, root, foot, ["L", "R"], 50);
    const W = worldPts(p, root);
    const h: Vec = hand ?? [W.shoulder[0] + ARM - 4, W.shoulder[1] - 22];
    p = handsTo(p, root, h);
    return { p, root, h };
  };
  const c = P(-68, 26, null);
  const handleY = c.h[1];
  const d = P(-88, 10, [c.h[0] - 30, handleY]);
  const f = P(-112, -22, null);
  const Wf = worldPts(f.p, f.root);
  const fin = P(-112, -22, [Wf.belly[0] + 4, Wf.belly[1] + 6]);
  const rec = P(-100, -10, [fin.h[0] + 36, handleY]);
  const ik = (h: Vec) => ({ handL: h, handR: h, footL: foot, footR: foot });
  return {
    id,
    view: "side",
    label,
    keyframes: [
      { pose: c.p, root: c.root, dur: 0.35, ease: "in", ik: ik(c.h) },
      { pose: d.p, root: d.root, dur: 0.35, ease: "out", ik: ik(d.h) },
      { pose: fin.p, root: fin.root, dur: 0.5, hold: 0.1, ease: "inOut", ik: ik(fin.h) },
      { pose: rec.p, root: rec.root, dur: 0.8, ease: "inOut", ik: ik(rec.h) },
    ],
    props: [{ id: "rower", kind: "rower", at: [16, 0], to: { lm: "butt" }, layer: "back" }],
    stillPhase: 0.2,
  };
}

/** Stationary / air bike pedalling. */
export function bike(id: string, label: string, air: boolean): MotionDef {
  const seat: Vec = [0, 92];
  const root: RootRule = { pin: "butt", at: [seat[0], seat[1] + 2] };
  const crank: Vec = [seat[0] + 14, 36];
  const R = 17;
  const base = pose({ trunk: air ? 22 : 18, neck: -10, ...both({ armD: 20 }) });
  const N = 8;
  const specs: KeySpec[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const pedal = (ang: number): Vec => [crank[0] + Math.cos(ang) * R, crank[1] + Math.sin(ang) * R];
    const fr = pedal(-a);
    const fl = pedal(-a + Math.PI);
    // Foot angle on the pedal adapts so the ankle stays within its range.
    const onPedal = (p0: Pose, s: "L" | "R", pt: Vec): { p: Pose; ank: Vec } => {
      let rot = -8;
      let p = p0;
      let ank = ankleForSole(pt[0], pt[1] + 1, rot);
      for (let it = 0; it < 4; it++) {
        p = legsTo(p0, root, ank, [s], rot);
        const a = p[`ankle${s}`];
        const clamped = Math.max(-35, Math.min(35, a));
        if (clamped === a) break;
        rot += clamped - a;
        ank = ankleForSole(pt[0], pt[1] + 1, rot);
      }
      return { p, ank };
    };
    const r1 = onPedal(base, "R", fr);
    const l1 = onPedal(r1.p, "L", fl);
    let p = l1.p;
    const ankR = r1.ank;
    const ankL = l1.ank;
    const W = worldPts(p, root);
    const swing = air ? Math.cos(a) * 12 : 0;
    const hR: Vec = [W.shoulder[0] + 44 + swing, W.shoulder[1] - 34];
    const hL: Vec = [W.shoulder[0] + 44 - swing, W.shoulder[1] - 34];
    p = handsTo(handsTo(p, root, hR, ["R"]), root, hL, ["L"]);
    specs.push({ pose: p, dur: (air ? 0.62 : 0.8) / N, ease: "linear", ik: { footR: ankR, footL: ankL, handR: hR, handL: hL } });
  }
  return {
    id,
    view: "side",
    label,
    keyframes: keys(root, specs),
    props: [{ id: "bike", kind: "bike", at: seat, layer: "far", variant: air ? undefined : "upright" }],
    stillPhase: 0,
  };
}

/** Shadowboxing / heavy-bag rounds: jab–cross with a bounce. */
export function boxing(id: string, label: string, bag: boolean): MotionDef {
  const stanceP = pose({ trunk: 8, neck: -6, hipR: 18, kneeR: 22, ankleR: 6, hipL: -6, kneeL: 18, ankleL: -14 });
  const guard = armsLocal(stanceP, [6, -22], [14, 6]);
  const jab = armsLocal(armsLocal({ ...stanceP, trunk: 12 }, [6, -22], [14, 6], ["L"]), [24, -2], [56, 4], ["R"]);
  const cross = armsLocal(armsLocal({ ...stanceP, trunk: 16 }, [6, -22], [14, 6], ["R"]), [24, -2], [58, 4], ["L"]);
  const W = worldPts(guard, { ground: 0 });
  const props: PropDef[] = bag ? [{ id: "bag", kind: "heavyBag", at: [W.shoulder[0] + 72, 168], layer: "front" }] : [];
  return {
    id,
    view: "side",
    label,
    keyframes: keys({ ground: 0 }, [
      k(guard, 0.3, { hold: 0.15, root: { ground: 0, lift: 0 } }),
      k(jab, 0.18, { hold: 0.05, root: { ground: 0, lift: 1 }, ease: "out" }),
      k(guard, 0.2, { root: { ground: 0, lift: 0 } }),
      k(cross, 0.2, { hold: 0.05, root: { ground: 0, lift: 0 }, ease: "out" }),
      k(guard, 0.3, { root: { ground: 0, lift: 2 } }),
    ]),
    props,
    stillPhase: 0.3,
  };
}

export function battleRopes(id: string, label: string): MotionDef {
  const base = pose({ ...stanceLegs(18, 50, 26), neck: -14 });
  const W = worldPts(base, { pin: "soleR", at: [0, 0] });
  const up = (p: Pose, s: "L" | "R", hi: boolean) => {
    const T2 = p.trunk;
    return { ...p, [`sh${s}`]: T2 + (hi ? 70 : 30), [`el${s}`]: hi ? 40 : 25 } as Pose;
  };
  const a = up(up(base, "R", true), "L", false);
  const b = up(up(base, "R", false), "L", true);
  return {
    id,
    view: "side",
    label,
    keyframes: keys({ pin: "soleR", at: [0, 0] }, [k(a, 0.22), k(b, 0.22)]),
    props: [{ id: "rope", kind: "battleRope", at: [W.shoulder[0] + 260, 10], h: W.handR[1], layer: "near" }],
    planted: ["L", "R"],
    footGrounded: true,
    stillPhase: 0,
  };
}

/** Acceleration wall drill: leaning into a wall, alternating knee drives. */
export function wallDrill(id: string, label: string): MotionDef {
  const lean = 45;
  const mk = (driveR: boolean) => {
    const p = pose({ trunk: lean, neck: -lean * 0.5, ...both({ hip: lean, knee: 4, ankle: -lean - 12 }) });
    const s = driveR ? "R" : "L";
    return { ...p, [`hip${s}`]: lean + 70, [`knee${s}`]: 90, [`ankle${s}`]: 5 } as Pose;
  };
  const stanceRoot = (s: "L" | "R"): RootRule => ({ pin: s === "R" ? "ballR" : "ballL", at: [0, 0] });
  const a = mk(false);
  const b = mk(true);
  const W = worldPts(a, stanceRoot("R"));
  const handPt: Vec = [W.shoulder[0] + ARM * 0.7, W.shoulder[1] + 20];
  const ik = { handL: handPt, handR: handPt };
  return {
    id,
    view: "side",
    label,
    keyframes: [
      { pose: handsTo(a, stanceRoot("R"), handPt), root: stanceRoot("R"), dur: 0.35, hold: 0.25, ease: "inOut", ik },
      { pose: handsTo({ ...a, hipL: lean, kneeL: 4, ankleL: -lean - 12 }, stanceRoot("R"), handPt), root: stanceRoot("R"), dur: 0.01, ease: "linear", ik },
      { pose: handsTo({ ...b, hipL: lean, kneeL: 4, ankleL: -lean - 12 }, stanceRoot("L"), handPt), root: stanceRoot("L"), dur: 0.35, hold: 0.25, ease: "inOut", ik },
      { pose: handsTo({ ...b, hipR: lean, kneeR: 4, ankleR: -lean - 12 }, stanceRoot("L"), handPt), root: stanceRoot("L"), dur: 0.01, ease: "linear", ik },
    ],
    props: [{ id: "wall", kind: "wall", at: [handPt[0] + BODY.r.hand, 0], layer: "back" }],
    footGrounded: true,
    stillPhase: 0.2,
    allowLimits: ["ankleL", "ankleR"],
  };
}

/** Lateral bound (skater jump), front view. */
export function lateralBound(id: string, label: string): MotionDef {
  const landL = pose({ trunk: -10, hipL: 18, kneeL: 45, ankleL: -10, hipR: -8, kneeR: 70, ankleR: 20, ...both({ sh: 30, el: 40 }) });
  const landR = pose({ trunk: 10, hipR: 18, kneeR: 45, ankleR: -10, hipL: -8, kneeL: 70, ankleL: 20, ...both({ sh: 30, el: 40 }) });
  const air = pose({ ...both({ hip: 14, knee: 30, ankle: 0, sh: 60, el: 30 }) });
  return {
    id,
    view: "front",
    label,
    keyframes: keys({ ground: 0 }, [
      k(landL, 0.3, { hold: 0.35, root: { ground: 60 }, ease: "out" }),
      k(air, 0.3, { root: { ground: 0, lift: 26 }, ease: "linear" }),
      k(landR, 0.3, { hold: 0.35, root: { ground: -60 }, ease: "out" }),
      k(air, 0.3, { root: { ground: 0, lift: 26 }, ease: "linear" }),
    ]),
    props: [],
    stillPhase: 0,
  };
}

export { mix, legsTo, armsLocal };
