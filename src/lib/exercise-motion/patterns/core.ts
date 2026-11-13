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
  plantLeg,
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
import { figureFour, hip9090, hipEscape, openBook } from "./floor";

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
      const props: PropDef[] = cop ? [{ id: "bench", kind: "box", variant: "bench", at: [W.ankleR[0] - 6, 0], w: 34, h: 44, layer: "back" }] : [{ id: "mat", kind: "mat", at: [W.pelvis[0], 0], w: 220, layer: "back" }];
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
      // Sitting back on the heels (shins flat on the floor), chest folded onto the thighs, forehead resting on the floor
      // and arms reaching forward with the hands flat on the floor.
      const thighA = 72;
      const root: RootRule = { pin: "kneeCapR", at: [0, 0] };
      const fold = (T: number, spine = 10) => pose({ trunk: T, spine, neck: 22, ...both({ hip: thighA + T, knee: thighA + 90, ankle: -65 }) });
      const reach = (p: Pose): Pose => {
        const W = worldPts(p, root);
        const h = W.shoulder[1] - BODY.r.hand;
        const hand: Vec = [W.shoulder[0] + Math.sqrt(Math.max(0, (ARM - 1) ** 2 - h * h)), BODY.r.hand];
        let out = p;
        for (const s of ["L", "R"] as const) out = armTo(out, s, [hand[0] - W.pelvis[0], hand[1] - W.pelvis[1]]);
        return out;
      };
      // Trunk angle that rests the forehead on the floor.
      const T = solve1D((t) => worldPts(fold(t), root).foreheadFront[1] - 3, 40, 110);
      const p = reach(fold(T));
      const exhale = reach(fold(T, 14));
      return M(root, hold2(p, exhale, 2.4), { props: [mat], stillPhase: 0, allowLimits: ["hipL", "hipR", "kneeL", "kneeR"] });
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
    case "figure-four":
      // Front view from above (the crossed leg makes its "4" along the mat), posed in 3D (patterns/floor.ts).
      return figureFour(id, label);
    case "open-book":
      // Front view from a raised camera of the side-lying athlete, posed in 3D (patterns/floor.ts).
      return openBook(id, label);
    case "90-90":
      // Front view from a raised camera, posed in 3D (patterns/floor.ts).
      return hip9090(id, label);
    case "worlds-greatest": {
      // Deep lunge with the torso low over the front thigh so the far hand rests flat on the floor inside the front
      // foot; the near elbow drops toward the instep, then the torso rotates open and that arm points at the ceiling.
      const root: RootRule = { pin: "soleR", at: [0, 0] };
      let lunge = pose({ ...stanceLegs(24, 108, 66, ["R"]), spine: 19, neck: -26 });
      const Wl = worldPts(lunge, root);
      const rear = ankleForSole(Wl.pelvis[0] - 74, 0, -40);
      lunge = legsTo(lunge, root, rear, ["L"], -40);
      const handL: Vec = [Wl.soleR[0] - 4, BODY.r.hand];
      lunge = handsTo(lunge, root, handL, ["L"]);
      // Near elbow dropped down inside the front shin toward the instep, forearm hanging toward the floor.
      const Wn = worldPts(lunge, root);
      const elbowW: Vec = [Wn.shoulder[0] - 8, Wn.shoulder[1] - 30];
      const handW: Vec = [elbowW[0] + 8, elbowW[1] - 29];
      const local = (v: Vec): Vec => [v[0] - Wn.pelvis[0], v[1] - Wn.pelvis[1]];
      const elbowIn = armThrough(lunge, "R", local(elbowW), local(handW));
      // Seen from the side, the rotated-open arm is simply vertical: its projected shoulder angle exceeds the sagittal
      // range, hence allowLimits below.
      const T2 = lunge.trunk + lunge.spine;
      const reach = { ...lunge, shR: 180 + T2, elR: 0, armDR: 0, foreDR: 0, neck: -45 };
      // The arm opens by rotating with the chest about the spine: from hanging toward the instep it swings out toward the
      // camera (shortening as it points at the viewer) and on up to the ceiling, the elbow straightening on the way;
      // it never sweeps forward through a front reach. `phi` is that rotation (0 = down, 90 = at the camera, 180 = up),
      // `dir` the arm's drawn direction (0 = down, 180 = up; while it points almost at the camera its direction hardly
      // shows), `bend` the elbow.
      const armDown = elbowIn.shR - T2;
      const open = (phi: number, dir: number, bend: number): Pose => {
        const d = phi <= 90 ? phi : 180 - phi;
        return { ...lunge, shR: T2 + dir, elR: bend, armDR: d, foreDR: Math.min(89, d + bend * 0.3), neck: -26 - 19 * (phi / 180) };
      };
      const a1 = open(35, armDown * 0.6, elbowIn.elR * 0.35);
      const a2 = open(65, armDown * 0.2, 8);
      const a3 = open(82, 45, 4);
      const a4 = open(98, 135, 2);
      const a5 = open(130, 180, 0);
      const ik = { handL, footL: rear };
      const sweep = (p: Pose, dur: number): KeySpec => ({ pose: p, dur, ease: "inOut", ik });
      // Then both hands down inside the front foot, and the hips shift back over the back knee, which comes down to the
      // floor, to straighten the front leg (the hamstring stretch), the torso folding over it; both feet stay put.
      const handR2: Vec = [handL[0] + 5, BODY.r.hand];
      const handsDown = handsTo(lunge, root, handR2, ["R"]);
      const frontAnkle = ankleForSole(0, 0);
      const PX = frontAnkle[0] - 78.5;
      // The back foot stays on the ball of the foot where it was, its toes tucking under as the knee comes down.
      const rearBall: Vec = [worldPts(handsDown, root).ballL[0], 0];
      const hamAt = (py: number, T: number) => {
        let p = pose({ trunk: T, spine: 22, neck: -8 });
        p = legTo(p, "R", [frontAnkle[0] - PX, frontAnkle[1] - py], 0);
        return plantLeg(p, "L", [PX, py], rearBall, -66);
      };
      const at = (py: number): RootRule => ({ pin: "pelvis", at: [PX, py] });
      const PY = solve1D((y) => worldPts(hamAt(y, 120), at(y)).kneeCapL[1] - 0.8, 30, 80);
      const Th = solve1D((t) => {
        const W = worldPts(hamAt(PY, t), at(PY));
        return Math.hypot(W.shoulder[0] - handL[0], W.shoulder[1] - handL[1]) - 51;
      }, 112, 70);
      const ham = handsTo(handsTo(hamAt(PY, Th), root, handL, ["L"]), root, handR2, ["R"]);
      const ik2h = { handL, handR: handR2, footL: rear };
      const ikHam = { handL, handR: handR2, footL: worldPts(ham, root).ankleL };
      return M(root, [
        { pose: elbowIn, dur: 0.45, hold: 0.6, ease: "inOut", ik },
        sweep(a1, 0.4),
        sweep(a2, 0.25),
        sweep(a3, 0.25),
        sweep(a4, 0.3),
        sweep(a5, 0.45),
        { pose: reach, dur: 0.45, hold: 1, ease: "inOut", ik },
        sweep(a5, 0.3),
        sweep(a4, 0.25),
        sweep(a3, 0.25),
        sweep(a2, 0.4),
        sweep(a1, 0.45),
        { pose: handsDown, dur: 1, hold: 0.2, ease: "inOut", ik: ik2h },
        { pose: ham, dur: 1, hold: 1.2, ease: "inOut", ik: ikHam },
        { pose: handsDown, dur: 0.6, ease: "inOut", ik: ik2h },
      ], { stillPhase: 0.33, allowLimits: ["shR"] });
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
      // Wide grip, arms straight: the band comes up in front, over the head and on down behind the body to the lower
      // back, then back the same way. Seen from the side, the wide arms point partly out of the picture (drawn
      // shortened) and the shoulder angle keeps turning past overhead (180°) to behind the body (about 320°), hence
      // allowLimits below.
      const s = pose({ ...stanceLegs(1, 3, 0), ...both({ el: 0 }) });
      const arms = (sh: number, armD: number, extra: Partial<Pose> = {}): Pose => ({ ...s, ...both({ sh, armD, foreD: armD }), ...extra });
      const front = arms(14, 35);
      const up = arms(95, 45);
      const over = arms(178, 58, { neck: 2 });
      const passing = arms(245, 74, { neck: 4 });
      const behind = arms(318, 52, { neck: 2, spine: -2 });
      const k = (p: Pose, dur: number, hold?: number): KeySpec => ({ pose: p, dur, hold, ease: "inOut" });
      return M(FEET, [k(front, 0.8, 0.4), k(up, 0.7), k(over, 0.6), k(passing, 0.6), k(behind, 0.8, 0.5), k(passing, 0.6), k(over, 0.6), k(up, 0.7)], {
        planted: ["L", "R"],
        footGrounded: true,
        allowLimits: ["shL", "shR"],
        props: [{ id: "band", kind: "band", at: { lm: "handL", dx: -6 }, to: { lm: "handR", dx: 6 }, layer: "near", variant: "gold" }],
      });
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
    case "hip-escape":
      // Seen from above, on the side (patterns/floor.ts).
      return hipEscape(id, label);
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
