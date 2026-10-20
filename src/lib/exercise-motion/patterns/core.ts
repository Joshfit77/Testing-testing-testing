import { BODY, ankleForSole } from "../skeleton";
import {
  FEET,
  armsLocal,
  both,
  keys,
  legTo,
  lm,
  mix,
  pose,
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
import { squatPose } from "./lower";

const ARM = BODY.upperArm + BODY.forearm;
const breathe = (p: Pose, d = 2): Pose => ({ ...p, spine: p.spine + d });
const hold2 = (a: Pose, b: Pose, dur = 2): KeySpec[] => [
  { pose: a, dur, ease: "inOut" },
  { pose: b, dur, ease: "inOut" },
];

/** Quadruped (hands under shoulders, knees under hips): trunk angle so hands and knees both touch the floor. */
export function quadruped(extra: Partial<Pose> = {}): Pose {
  const make = (T: number) => {
    const p = pose({ trunk: T, neck: -10, ...both({ hip: T, knee: 90, ankle: -65 }), ...extra });
    const T2 = p.trunk + p.spine;
    return { ...p, shL: T2, shR: T2, elL: 2, elR: 2 };
  };
  const T = solve1D((t) => {
    const P = worldPts(make(t), { ground: 0 });
    return P.handR[1] - BODY.r.hand - P.kneeCapR[1];
  }, 50, 89);
  return make(T);
}

export type CoreKind =
  | "side-plank"
  | "copenhagen"
  | "dead-bug"
  | "bird-dog"
  | "ab-wheel"
  | "cable-crunch"
  | "crunch"
  | "sit-up"
  | "leg-raise"
  | "cat-cow"
  | "childs-pose"
  | "couch-stretch"
  | "hamstring-stretch"
  | "figure-four"
  | "open-book"
  | "90-90"
  | "worlds-greatest"
  | "knee-to-wall"
  | "pass-through"
  | "deep-squat"
  | "single-leg-balance"
  | "neck-iso"
  | "neck-band"
  | "hip-escape"
  | "woodchop"
  | "landmine-rotation"
  | "rotational-throw"
  | "shot-put";

export function coreMove(id: string, label: string, kind: CoreKind): MotionDef {
  const base: Omit<MotionDef, "keyframes"> = { id, view: "side", label, props: [], stillPhase: 0.5 };
  const M = (root: RootRule, specs: KeySpec[], extra: Partial<MotionDef> = {}): MotionDef => ({ ...base, keyframes: keys(root, specs), ...extra });
  const mat: PropDef = { id: "mat", kind: "mat", at: [0, 0], w: 200, layer: "back" };
  switch (kind) {
    case "side-plank":
    case "copenhagen": {
      // Front view, body rolled onto the left forearm (screen right side down).
      const cop = kind === "copenhagen";
      const make = (T: number) => {
        const p = pose({ trunk: T, neck: -12, hipL: cop ? -14 : 0, hipR: 0, ...both({ knee: 2, ankle: 0 }) });
        return { ...p, shL: p.trunk, elL: 88, foreDL: 78, shR: cop ? 30 : 150 - T + 40, elR: cop ? 70 : 6 };
      };
      const root: RootRule = { pin: "elbowL", at: [0, BODY.r.elbow] };
      const footTarget = cop ? 44 + 4 : 4;
      const T = solve1D((t) => worldPts(make(t), root, "front")[cop ? "ankleR" : "ankleL"][1] - footTarget, 50, 89);
      const W = worldPts(make(T), root, "front");
      const props: PropDef[] = cop ? [{ id: "bench", kind: "box", at: [W.ankleR[0] - 6, 0], w: 34, h: 44, layer: "back" }] : [{ id: "mat", kind: "mat", at: [W.pelvis[0], 0], w: 220, layer: "back" }];
      return {
        ...base,
        view: "front",
        keyframes: keys(root, hold2(make(T), make(T + 1.5), 2)),
        props,
        stillPhase: 0,
      };
    }
    case "dead-bug": {
      const tab = pose({ trunk: -90, neck: 10, ...both({ sh: 90, el: 0, hip: 90, knee: 90, ankle: -10 }) });
      const extR = { ...tab, shR: 168, hipL: 18, kneeL: 4 };
      const extL = { ...tab, shL: 168, hipR: 18, kneeR: 4 };
      return M({ ground: 0 }, [
        { pose: tab, dur: 1.2, hold: 0.2, ease: "inOut" },
        { pose: extR, dur: 1.2, hold: 0.3, ease: "inOut" },
        { pose: tab, dur: 1.2, hold: 0.2, ease: "inOut" },
        { pose: extL, dur: 1.2, hold: 0.3, ease: "inOut" },
      ], { props: [mat] });
    }
    case "bird-dog": {
      const q = quadruped();
      const T2 = q.trunk + q.spine;
      const a = { ...q, shR: T2 + 88, elR: 0, hipL: q.trunk - 88, kneeL: 4, ankleL: -30 };
      const b = { ...q, shL: T2 + 88, elL: 0, hipR: q.trunk - 88, kneeR: 4, ankleR: -30 };
      const W = worldPts(q, { pin: "kneeCapR", at: [0, 0] });
      const handPt: Vec = [W.handR[0], BODY.r.hand];
      const root: RootRule = { ground: W.pelvis[0] };
      const rootL = root;
      return M(root, [
        { pose: q, dur: 1.1, hold: 0.2, ease: "inOut", ik: { handL: handPt, handR: handPt }, root },
        { pose: a, dur: 1.1, hold: 0.8, ease: "inOut", ik: { handL: handPt }, root },
        { pose: q, dur: 1.1, hold: 0.2, ease: "inOut", ik: { handL: handPt, handR: handPt }, root: rootL },
        { pose: b, dur: 1.1, hold: 0.8, ease: "inOut", ik: { handR: handPt }, root: rootL },
      ], { props: [mat] });
    }
    case "ab-wheel": {
      const root: RootRule = { pin: "kneeCapR", at: [0, 0] };
      const at = (T: number, thighA: number) => {
        const p = pose({ trunk: T, neck: -8, ...both({ hip: thighA + T, knee: thighA + 90, ankle: -60, sh: 100, el: 0 }) });
        return p;
      };
      const wheelFor = (p: Pose): Vec => {
        const W = worldPts(p, root);
        const dy = W.shoulder[1] - 10;
        const dx = Math.sqrt(Math.max(0, (ARM - 2) ** 2 - dy * dy));
        return [W.shoulder[0] + dx, 10];
      };
      const start = at(42, 18);
      const end = at(73, -66);
      const ws = wheelFor(start);
      const we = wheelFor(end);
      const P = (p: Pose, w: Vec) => handsTo(p, root, w);
      return M(root, [
        { pose: P(start, ws), dur: 2, hold: 0.3, ease: "inOut", ik: { handL: ws, handR: ws } },
        { pose: P(end, we), dur: 1.4, hold: 0.3, ease: "inOut", ik: { handL: we, handR: we } },
      ], { props: [{ id: "wheel", kind: "abWheel", at: { lm: "hands" }, layer: "front" }, { id: "pad", kind: "pad", at: [0, 2], w: 30, layer: "back" }] });
    }
    case "cable-crunch": {
      const root: RootRule = { pin: "kneeCapR", at: [0, 0] };
      const up0 = armsLocal(pose({ trunk: 14, neck: 6, ...both({ hip: 14, knee: 104, ankle: -55 }) }), [14, 6], [12, 26]);
      const down0 = armsLocal(pose({ trunk: 38, spine: 46, neck: 20, ...both({ hip: 38, knee: 128, ankle: -55 }) }), [14, 6], [12, 26]);
      const W = worldPts(up0, root);
      const pulley: Vec = [W.head[0] + 40, W.headTop[1] + 70];
      return M(root, [
        { pose: up0, dur: 1, hold: 0.3, ease: "inOut" },
        { pose: down0, dur: 1.6, hold: 0.4, ease: "inOut" },
      ], {
        props: [
          { id: "tower", kind: "cableTower", at: [pulley[0] + 14, 0], h: pulley[1] + 10, layer: "back" },
          { id: "cable", kind: "cable", at: pulley, to: { lm: "hands" }, layer: "near" },
        ],
      });
    }
    case "crunch":
    case "sit-up":
    case "leg-raise": {
      const flat = armsLocal(pose({ trunk: -90, neck: 14, ...both({ hip: 60, knee: 110, ankle: -10 }) }), [16, 8], [6, 22]);
      if (kind === "leg-raise") {
        const lo = { ...pose({ trunk: -90, neck: 8, ...both({ hip: 8, knee: 4, ankle: -20, sh: 6, el: 0 }) }) };
        const hi = { ...lo, ...both({ hip: 88 }) };
        return M({ ground: 0 }, [
          { pose: lo, dur: 1.2, hold: 0.3, ease: "inOut" },
          { pose: hi, dur: 2, hold: 0.3, ease: "inOut" },
        ], { props: [mat] });
      }
      const W = worldPts(flat, { pin: "butt", at: [0, 0] });
      const ankle = ankleForSole(W.pelvis[0] + 46, 0);
      const up1 =
        kind === "crunch"
          ? { ...flat, spine: 34, neck: 22 }
          : armsLocal(pose({ trunk: -12, spine: 10, neck: 10, ...both({ hip: 60, knee: 110, ankle: -10 }) }), [16, 8], [6, 22]);
      const root: RootRule = { pin: "butt", at: [0, 0] };
      return M(root, [
        { pose: legsTo(flat, root, ankle), dur: 1, hold: 0.3, ease: "inOut", ik: { footL: ankle, footR: ankle } },
        { pose: legsTo(up1, root, ankle), dur: 1.6, hold: 0.3, ease: "inOut", ik: { footL: ankle, footR: ankle } },
      ], { props: [mat] });
    }
    case "cat-cow": {
      const root: RootRule = { pin: "kneeCapR", at: [0, 0] };
      const q = quadruped();
      const W = worldPts(q, root);
      const hand: Vec = [W.handR[0], BODY.r.hand];
      // The lower back sags / rounds while the upper back stays roughly level (hands fixed on the floor).
      const tilt = (p: Pose, dT: number, sp: number, nk: number): Pose => ({ ...p, trunk: p.trunk + dT, spine: sp, neck: nk, hipL: p.hipL + dT, hipR: p.hipR + dT });
      const cow = tilt(q, 14, -26, -30);
      const cat = tilt(q, -18, 34, 28);
      const ik = { handL: hand, handR: hand };
      return M(root, [
        { pose: cow, dur: 2, hold: 0.4, ease: "inOut", ik },
        { pose: cat, dur: 2, hold: 0.4, ease: "inOut", ik },
      ], { props: [mat] });
    }
    case "childs-pose": {
      // Sitting back on the heels (shins flat), chest folded onto the thighs, arms long on the floor.
      const T = 104;
      const thighA = 72;
      const p = pose({ trunk: T, spine: 6, neck: 18, ...both({ hip: thighA + T, knee: thighA + 90, ankle: -65, sh: 182, el: 2 }) });
      return M({ ground: 0 }, hold2(p, breathe(p, 4), 2.4), { props: [mat], stillPhase: 0, allowLimits: ["hipL", "hipR", "kneeL", "kneeR"] });
    }
    case "couch-stretch": {
      const root: RootRule = { pin: "kneeCapL", at: [0, 0] };
      let p = pose({ trunk: -2, neck: 0, hipL: -22, kneeL: 158, ankleL: -60, hipR: 80, kneeR: 85, ankleR: 8 });
      const W = worldPts(p, root);
      const front = ankleForSole(W.pelvis[0] + 46, 0);
      p = legsTo(p, root, front, ["R"]);
      p = armsLocal(p, [6, -24], [16, -44]);
      const p2 = { ...p, trunk: -6, hipL: -26, hipR: p.hipR - 4 };
      return M(root, hold2(legsTo(p, root, front, ["R"]), legsTo(p2, root, front, ["R"]), 2.2), {
        props: [{ id: "wall", kind: "wall", at: [W.toeL[0] - 6, 0], variant: "left", layer: "back" }, { id: "pad", kind: "pad", at: [0, 2], w: 28, layer: "back" }],
        stillPhase: 0,
      });
    }
    case "hamstring-stretch": {
      const root: RootRule = { ground: 0 };
      const a = armsLocal(pose({ trunk: -90, neck: 8, hipL: 2, kneeL: 2, ankleL: -20, hipR: 78, kneeR: 4, ankleR: 10 }), [22, 6], [40, 14]);
      const b = { ...a, hipR: 90 };
      return M(root, hold2(a, b, 2.2), {
        props: [mat, { id: "band", kind: "band", at: { lm: "hands" }, to: { lm: "ballR" }, layer: "near", variant: "gold" }],
        stillPhase: 0.5,
      });
    }
    case "figure-four": {
      const a = pose({ trunk: -90, neck: 12, hipL: 75, kneeL: 90, ankleL: 0, hipR: 70, kneeR: 105, ankleR: 0, legDR: 48, ...both({ sh: 8, el: 4 }) });
      const b = { ...a, hipL: 92, hipR: 86 };
      return M({ ground: 0 }, hold2(a, b, 2.2), { props: [mat], stillPhase: 0.5 });
    }
    case "open-book": {
      // Seen from above: side-lying, knees stacked, top arm sweeps open across the chest.
      const p = pose({ trunk: 90, neck: 0, ...both({ hip: 90, knee: 90, ankle: -20, sh: 90, el: 0 }) });
      const mid = { ...p, shR: 10, armDR: 80, neck: -10 };
      const open = { ...p, shR: -80, armDR: 10, neck: -25 };
      return M({ ground: 0 }, [
        { pose: p, dur: 1.5, hold: 0.3, ease: "inOut" },
        { pose: mid, dur: 1.2, ease: "linear" },
        { pose: open, dur: 1.2, hold: 1.2, ease: "out" },
        { pose: mid, dur: 1.5, ease: "in" },
      ], { floor: "none", allowLimits: ["shR"], stillPhase: 0.55, props: [{ id: "mat", kind: "pad", at: [10, -26], w: 220, h: 86, layer: "back" }] });
    }
    case "90-90": {
      // Seated, hands behind. Front leg: thigh toward the camera, shin across; back leg: thigh out to the side, shin back.
      const arms = { ...both({ sh: 30, el: 0, armD: 45 }) };
      const sideA = pose({ ...arms, trunk: -4, hipL: 70, legDL: 70, kneeL: 90, ankleL: -95, hipR: 88, kneeR: 120, ankleR: 70 });
      const sideB = pose({ ...arms, trunk: 4, hipR: 70, legDR: 70, kneeR: 90, ankleR: -95, hipL: 88, kneeL: 120, ankleL: 70 });
      const midP = pose({ ...arms, hipL: 150, hipR: 150, legDL: 55, legDR: 55, kneeL: 90, kneeR: 90, ankleL: -8, ankleR: -8, shinDL: 72, shinDR: 72 });
      return {
        ...base,
        view: "front",
        keyframes: keys({ ground: 0 }, [
          { pose: sideA, dur: 1.2, hold: 0.8, ease: "inOut" },
          { pose: midP, dur: 1.2, ease: "inOut" },
          { pose: sideB, dur: 1.2, hold: 0.8, ease: "inOut" },
          { pose: midP, dur: 1.2, ease: "inOut" },
        ]),
        props: [mat],
        allowLimits: ["hipL", "hipR", "ankleL", "ankleR"],
        stillPhase: 0,
      };
    }
    case "worlds-greatest": {
      const root: RootRule = { pin: "soleR", at: [0, 0] };
      let lunge = pose({ ...stanceLegs(18, 100, 60, ["R"]), neck: -20 });
      const Wl = worldPts(lunge, root);
      const rear = ankleForSole(Wl.pelvis[0] - 70, 0, -40);
      lunge = legsTo(lunge, root, rear, ["L"], -40);
      lunge = handsTo(lunge, root, [Wl.soleR[0] - 6, BODY.r.hand], ["L"]);
      const elbowIn = armsLocal(lunge, [18, -24], [6, -6], ["R"]);
      const reach = { ...lunge, shR: 186, elR: 0, armDR: 50, neck: -40 };
      const handL: Vec = [Wl.soleR[0] - 6, BODY.r.hand];
      return M(root, [
        { pose: elbowIn, dur: 1.5, hold: 0.6, ease: "inOut", ik: { handL, footL: rear } },
        { pose: reach, dur: 1.5, hold: 1, ease: "inOut", ik: { handL, footL: rear } },
      ], { stillPhase: 0.6 });
    }
    case "knee-to-wall": {
      const root: RootRule = { pin: "soleR", at: [0, 0] };
      const mk = (shin: number) => {
        let p = pose({ ...stanceLegs(shin, shin * 1.6, 8, ["R"]), neck: 0, ...both({ armD: 25 }) });
        const W = worldPts(p, root);
        p = legsTo(p, root, ankleForSole(W.pelvis[0] - 50, 0, -24), ["L"], -24);
        return p;
      };
      const a = mk(6);
      const b = mk(36);
      const wallX = worldPts(b, root).kneeCapR[0] + 1;
      const handPt: Vec = [wallX - BODY.r.hand, worldPts(a, root).shoulder[1] - 10];
      const rearA = worldPts(a, root).ankleL;
      return M(root, [
        { pose: handsTo(a, root, handPt), dur: 1, hold: 0.3, ease: "inOut", ik: { handL: handPt, handR: handPt, footL: rearA } },
        { pose: handsTo(b, root, handPt), dur: 1.2, hold: 0.5, ease: "inOut", ik: { handL: handPt, handR: handPt, footL: rearA } },
      ], { props: [{ id: "wall", kind: "wall", at: [wallX, 0], layer: "back" }], planted: ["R"], footGrounded: true });
    }
    case "pass-through": {
      const s = pose({ ...stanceLegs(1, 3, 0), ...both({ el: 0 }) });
      const front = { ...s, ...both({ sh: 20, armD: 30 }) };
      const over = { ...s, ...both({ sh: 175, armD: 55 }) };
      const back = { ...s, ...both({ sh: 188, armD: 70 }), neck: 4 };
      return M(FEET, [
        { pose: front, dur: 1.4, hold: 0.2, ease: "inOut" },
        { pose: over, dur: 1, ease: "linear" },
        { pose: back, dur: 1, hold: 0.3, ease: "inOut" },
        { pose: over, dur: 1.4, ease: "linear" },
      ], { planted: ["L", "R"], footGrounded: true, props: [{ id: "band", kind: "band", at: { lm: "handL", dx: -6 }, to: { lm: "handR", dx: 6 }, layer: "near", variant: "gold" }] });
    }
    case "deep-squat": {
      const p = squatPose(1, { id, label, load: "chest-crossed", knee: 142, shin: 38 });
      return M(FEET, hold2(p, breathe(p, 3), 2.2), { planted: ["L", "R"], footGrounded: true, stillPhase: 0 });
    }
    case "single-leg-balance": {
      const p = pose({ ...stanceLegs(1, 4, 1, ["R"]), hipL: 62, kneeL: 75, ankleL: -10, ...both({ sh: 30, el: 10, armD: 50 }) });
      return M(FEET, hold2(p, { ...p, trunk: 3, hipL: 60, shL: 36 }, 1.6), { planted: ["R"], footGrounded: true, stillPhase: 0 });
    }
    case "neck-iso": {
      const s = pose({ ...stanceLegs(1, 3, 0) });
      const W = worldPts(s, FEET);
      const fore: Vec = [W.foreheadFront[0] + 3, W.foreheadFront[1] + 2];
      const back: Vec = [W.headBack[0] - 3, W.headBack[1] + 2];
      const a = handsTo({ ...s, ...both({ armD: 30 }) }, FEET, fore);
      const b = handsTo({ ...s, ...both({ armD: 40 }) }, FEET, back);
      return M(FEET, [
        { pose: a, dur: 0.8, hold: 2.2, ease: "inOut", ik: { handL: fore, handR: fore } },
        { pose: b, dur: 0.8, hold: 2.2, ease: "inOut", ik: { handL: back, handR: back } },
      ], { planted: ["L", "R"], footGrounded: true, stillPhase: 0.2 });
    }
    case "neck-band": {
      const s = pose({ ...stanceLegs(1, 3, 2), ...both({ sh: 4, el: 4 }) });
      const W = worldPts(s, FEET);
      const flex = { ...s, neck: 28 };
      const ext = { ...s, neck: -26 };
      return M(FEET, [
        { pose: flex, dur: 1.4, hold: 0.3, ease: "inOut" },
        { pose: ext, dur: 1.8, hold: 0.3, ease: "inOut" },
      ], {
        planted: ["L", "R"],
        footGrounded: true,
        props: [
          { id: "wall", kind: "wall", at: [W.head[0] + 120, 0], layer: "back" },
          { id: "band", kind: "band", at: [W.head[0] + 120, W.head[1]], to: { lm: "headBack" }, layer: "near" },
        ],
      });
    }
    case "hip-escape": {
      // Supine, knees bent: push off the near foot and shrimp the hips away, then slide the feet back in.
      const flat = armsLocal(pose({ trunk: -90, neck: 14, ...both({ hip: 70, knee: 100, ankle: -5 }) }), [14, 0], [24, 10]);
      const footW = (p: Pose, x: number) => {
        const W = worldPts(p, { ground: x });
        return ankleForSole(W.pelvis[0] + 46, 0);
      };
      const f0 = footW(flat, 0);
      const k0 = legsTo(flat, { ground: 0 }, f0);
      const shrimpBase = armsLocal(pose({ trunk: -98, spine: 28, neck: 24, ...both({ hip: 60, knee: 40, ankle: -5 }) }), [16, -6], [34, -6]);
      const k1 = legsTo(shrimpBase, { ground: -34 }, f0);
      const f2 = footW(flat, -34);
      const k2 = legsTo(flat, { ground: -34 }, f2);
      return M({ ground: 0 }, [
        { pose: k0, dur: 0.6, hold: 0.25, ease: "inOut", root: { ground: 0 }, ik: { footL: f0, footR: f0 } },
        { pose: k1, dur: 0.6, hold: 0.2, ease: "inOut", root: { ground: -34 }, ik: { footL: f0, footR: f0 } },
        { pose: k2, dur: 0.6, ease: "inOut", root: { ground: -34 }, ik: { footL: [f2[0], f2[1]], footR: [f2[0], f2[1]] } },
      ], { travel: -34, props: [], stillPhase: 0.4 });
    }
    case "woodchop":
    case "landmine-rotation":
    case "rotational-throw":
    case "shot-put": {
      return rotational(id, label, kind);
    }
  }
}

/** Front-view rotational patterns. */
function rotational(id: string, label: string, kind: "woodchop" | "landmine-rotation" | "rotational-throw" | "shot-put"): MotionDef {
  const stand = (lean: number, extra: Partial<Pose> = {}) => pose({ trunk: lean, hipL: 16, hipR: 16, kneeL: 22, kneeR: 22, ankleL: -10, ankleR: -10, ...extra });
  const root: RootRule = { ground: 0 };
  const k = (p: Pose, dur: number, hold = 0, extra: Partial<KeySpec> = {}): KeySpec => ({ pose: p, dur, hold, ease: "inOut", ...extra });
  if (kind === "woodchop") {
    const high = stand(-6, { shR: 150, elR: 4, armDR: 30, shL: -120, elL: 4, armDL: 30 });
    const low = stand(8, { shR: -35, elR: 4, armDR: 30, shL: 35, elL: 4, armDL: 30, kneeL: 34, kneeR: 34 });
    return {
      id,
      view: "front",
      label,
      keyframes: keys(root, [k(high, 1.2, 0.2), k(low, 1, 0.3)]),
      props: [
        { id: "tower", kind: "cableTower", at: [-120, 0], h: 215, layer: "back" },
        { id: "cable", kind: "cable", at: [-108, 205], to: { lm: "hands" }, layer: "near" },
      ],
      allowLimits: ["shL", "shR"],
      stillPhase: 0.5,
    };
  }
  if (kind === "landmine-rotation") {
    const left = stand(-8, { shR: 20, elR: 0, armDR: 55, shL: -38, elL: 0, armDL: 55 });
    const midP = stand(0, { shR: 70, elR: 0, armDR: 60, shL: 70, elL: 0, armDL: 60 });
    const right = stand(8, { shL: 20, elL: 0, armDL: 55, shR: -38, elR: 0, armDR: 55 });
    return {
      id,
      view: "front",
      label,
      keyframes: keys(root, [k(left, 0.9, 0.2), k(midP, 0.9), k(right, 0.9, 0.2), k(midP, 0.9)].map((s) => ({ ...s, ease: "spline" as const }))),
      props: [{ id: "lm", kind: "landmine", at: [0, 2], to: { lm: "hands" }, layer: "front" }],
      allowLimits: ["shL", "shR"],
      stillPhase: 0,
    };
  }
  // Throws: the ball rebounds off a side wall and is caught.
  const load = kind === "shot-put" ? stand(8, { shR: 60, elR: 140, shL: 40, elL: 60, kneeR: 34 }) : stand(10, { shL: -20, elL: 30, armDL: 40, shR: 50, elR: 30, armDR: 40, kneeL: 34 });
  const release = kind === "shot-put" ? stand(-10, { shR: 135, elR: 4, shL: 30, elL: 50 }) : stand(-10, { shR: 120, elR: 20, armDR: 40, shL: -70, elL: 20, armDL: 40, kneeR: 30 });
  return {
    id,
    view: "front",
    label,
    keyframes: keys(root, [
      k(load, 0.5, 0.4, { props: { ball: { lm: "hands" } } }),
      k(release, 0.35, 0, { props: { ball: { lm: "hands" } }, ease: "in" }),
      k(release, 0.45, 0, { props: { ball: [-150, 130] }, ease: "linear" }),
      k(load, 0.6, 0, { props: { ball: [-150, 130] }, ease: "linear" }),
    ]),
    props: [
      { id: "wall", kind: "wall", at: [-165, 0], variant: "left", layer: "back" },
      { id: "ball", kind: "medball", at: { lm: "hands" }, layer: "front", size: 11 },
    ],
    allowLimits: ["shL", "shR"],
    stillPhase: 0.1,
  };
}

export { lm, mix, legTo, toLocal };
