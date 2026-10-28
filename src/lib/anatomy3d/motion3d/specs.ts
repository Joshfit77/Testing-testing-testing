import * as THREE from "three";
import { SIDE_SIGN, type Side, type Skeleton3 } from "../body/skeleton";
import { restGoals } from "../body/solve";
import {
  Cable,
  makeAirBike,
  makeBarbell,
  makeCableBar,
  makeCableTower,
  makeDHandle,
  makeDumbbell,
  makeKettlebell,
  makeMedball,
  makeRack,
  makeRower,
  makeSled,
  makeFlexRope,

  makeWall,
  Piece,
} from "./apparatus";
import { K } from "./lift";
import { gripPoint, handNow, placeInHand, type Ctx, type Spec } from "./perform";

/**
 * Exercise specs for the anatomical rig: the equipment each exercise uses, how the hands hold it, and, where the
 * reviewed 2D motion cannot carry the movement (a trunk that rotates, a ball thrown and caught), the exercise's own
 * 3D keyframes. Specs exist so far for the exercises demonstrated first; others fall back to the lifted motion with
 * free hands (`hasSpec` tells them apart).
 */
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const rotY = (deg: number) => new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), deg * D2R);
const rotZ = (deg: number) => new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), deg * D2R);
const rotX = (deg: number) => new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), deg * D2R);
const SIDES = ["R", "L"] as const;
/** Towards the midline along a bar across the body (an overhand grip's thumb side). */
const medial = (s: Side) => V3(0, 0, -SIDE_SIGN[s]);
const lateral = (s: Side) => V3(0, 0, SIDE_SIGN[s]);

// ---------------------------------------------------------------- 3D keyframes

/** Body parameters for 3D-authored exercises (degrees; "turn" is towards the figure's right, about the vertical). */
export interface BodyKey {
  at: number;
  pelvis: [number, number, number];
  turn: number;
  tilt: number;
  chestTurn: number;
  chestFlex: number;
  chestSide?: number;
  headTurn?: number;
  /** Feet: ball of the foot on the floor at (x, z), the foot turned right by `turn`, heel lifted by `heel` degrees. */
  feet: Record<Side, [number, number, number, number]>;
}

const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => smooth(Math.min(1, Math.max(0, u)));
/** Interpolates numeric fields (and arrays of numbers) between keys by phase, eased, looping. */
export function keyed<T extends { at: number }>(keys: T[], phase: number): T {
  let i = keys.length - 1;
  while (i > 0 && keys[i]!.at > phase) i--;
  const a = keys[i]!;
  const b = keys[(i + 1) % keys.length]!;
  const span = (b.at <= a.at ? b.at + 1 : b.at) - a.at;
  const u = smooth(Math.min(1, Math.max(0, (phase - a.at + (phase < a.at ? 1 : 0)) / (span || 1))));
  const mix = (x: unknown, y: unknown): unknown =>
    typeof x === "number" ? x + ((y as number) - x) * u : Array.isArray(x) ? x.map((v, k) => mix(v, (y as unknown[])[k])) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, mix(v, (y as Record<string, unknown>)[k])])) : x;
  return mix(a, b) as T;
}

/** Goals from body parameters. */
export function bodyGoals(c: Ctx, k: BodyKey): void {
  const sk = c.sk;
  const g = restGoals(sk);
  const pel = sk.restRot[sk.i("pelvis")]!;
  g.pelvis = { pos: V3(...k.pelvis), rot: rotY(-k.turn).multiply(rotZ(-k.tilt)).multiply(pel) };
  g.chest = rotY(-k.chestTurn).multiply(rotZ(-k.chestFlex)).multiply(rotX(k.chestSide ?? 0)).multiply(sk.restRot[sk.i("thorax2")]!);
  g.head = rotY(-(k.headTurn ?? k.chestTurn)).multiply(sk.restRot[sk.i("head")]!);
  for (const s of SIDES) {
    const [x, z, turn, heel] = k.feet[s];
    const J = sk.meta.joints[s];
    const restFoot = sk.restRot[sk.i(`foot${s}`)]!;
    const ballRest = V3(...J.ball), ankleRest = V3(...J.ankle);
    const yaw = rotY(-turn);
    const latAxis = V3(0, 0, 1).applyQuaternion(yaw);
    // (Heel up: the foot pitches toes-down about the ball, a negative turn about its lateral axis.)
    const q = new THREE.Quaternion().setFromAxisAngle(latAxis, -heel * D2R).multiply(yaw);
    const ball = V3(x, ballRest.y, z);
    const ankle = ankleRest.clone().sub(ballRest).applyQuaternion(q).add(ball);
    const toesFwd = V3(1, 0, 0).applyQuaternion(yaw);
    g.legs[s] = { ankle, foot: q.clone().multiply(restFoot), pole: toesFwd.addScaledVector(V3(0, 0, SIDE_SIGN[s]), 0.25), toes: heel * 0.9 };
  }
  c.goals = g;
}

// ---------------------------------------------------------------- helpers

/** Middle of the two hands' grip points as the motion moves them (rig). */
/** A piece holding just a cable (a tube between two points). */
const cablePiece = () => {
  const p = new Piece("cable") as Piece & { cable: Cable };
  p.cable = new Cable();
  p.obj.add(p.cable.obj);
  p.inner = { get: () => p.cable.args, set: (v) => p.cable.set(V3(v[0], v[1], v[2]), V3(v[3], v[4], v[5]), v[6]) };
  return p;
};
const cableOf = (p: Piece | undefined) => (p as Piece & { cable: Cable }).cable;

const handsMid = (c: Ctx) => c.freeArm("R").grip.add(c.freeArm("L").grip).multiplyScalar(0.5);

/** How far forward (rig X) the legs reach at height `y`, as they are solved: the front of each thigh and shin there
 *  (the bone's line plus the leg's thickness in front of it, from about 9 cm at the top of the thigh to 4.5 cm at the
 *  ankle); -Infinity above the hips. */
const legsFrontAt = (c: Ctx, y: number) => {
  const sk = c.sk;
  let front = -Infinity;
  for (const s of SIDES) {
    const hip = sk.pos[sk.i(`thigh${s}`)]!, knee = sk.pos[sk.i(`shin${s}`)]!, ankle = sk.pos[sk.i(`foot${s}`)]!;
    for (const [a, b, ra, rb] of [[hip, knee, 9, 6.5], [knee, ankle, 6.5, 4.5]] as const) {
      if (y > Math.max(a.y, b.y) + 4 || y < Math.min(a.y, b.y) - 4) continue;
      const u = Math.min(1, Math.max(0, (y - a.y) / (b.y - a.y || 1)));
      front = Math.max(front, a.x + (b.x - a.x) * u + ra + (rb - ra) * u);
    }
  }
  return front;
};

// ---------------------------------------------------------------- specs

const pushPress: Spec = {
  build: () => [makeBarbell({ grip: 27 })],
  frame(c, [bar]) {
    // The bar travels where the motion's hands go (on the model's arms, each keeping its reach at the grip's width),
    // level, across the body.
    const mid = c.freeAt("R", 27).add(c.freeAt("L", -27)).multiplyScalar(0.5).setZ(0);
    const at = c.reachable(mid, ["R", "L"], 0.5, { offsets: { R: V3(0, 0, 27), L: V3(0, 0, -27) }, minBend: 140 });
    bar!.place(at, new THREE.Quaternion());
    for (const s of SIDES) c.hold(s, bar!.handle(s), medial(s));
  },
};

/**
 * Sumo deadlift: feet wide and turned out, hands inside the knees, arms long, a mixed grip (right hand over, left hand
 * under). The bar hangs below the shoulders unless the legs are in its way; then it rides just in front of the shins
 * and thighs, as a deadlift's bar does, and never passes into them (it once followed the hands alone and went through
 * the thighs at the top). The plates rest on the floor at the bottom.
 */
const SUMO_GRIP = 21 * K;
const sumoDeadlift: Spec = {
  build: () => [makeBarbell({ grip: SUMO_GRIP })],
  stance: { halfWidth: 42, toeOut: 30 },
  frame(c, [bar]) {
    const offsets = { R: V3(0, 0, SUMO_GRIP), L: V3(0, 0, -SUMO_GRIP) };
    const hanging = () => c.freeAt("R", SUMO_GRIP).add(c.freeAt("L", -SUMO_GRIP)).multiplyScalar(0.5).setZ(0);
    // Balanced over the feet: the hips go back until the bar, hanging from the shoulders, is over the middle of the
    // feet (the front view says how far the trunk leans, not where the hips are).
    const sk = c.sk;
    const midFoot = SIDES.reduce((a, s) => {
      const J = sk.meta.joints[s];
      const f = sk.i(`foot${s}`);
      return a + sk.point(f, V3(...J.ankle)).lerp(sk.point(f, V3(...J.ball)), 0.6).x / 2;
    }, 0);
    for (let i = 0; i < 3; i++) {
      const shift = midFoot - hanging().x;
      if (Math.abs(shift) < 0.2) break;
      c.goals.pelvis.pos.x += shift;
      c.presolve();
    }
    let at = hanging();
    for (let i = 0; i < 4; i++) {
      at.x = Math.max(at.x, legsFrontAt(c, at.y) + 1.4 + 0.8);
      at.y = Math.max(at.y, 22.5);
      // (Arms straight: pinned to their full reach, so a bar moved forward off the thighs slides down the arms' arc
      // rather than bending the elbows.)
      at = c.reachable(at, ["R", "L"], 4, { offsets, minBend: 16 });
    }
    bar!.place(at, new THREE.Quaternion());
    c.hold("R", bar!.handle("R"), medial("R"));
    c.hold("L", bar!.handle("L"), lateral("L"));
  },
};

const kettlebellSwing: Spec = {
  build: () => [makeKettlebell(1.15)],
  // Feet a little wider than the hips, toes out: the bell passes between the thighs, not the shins.
  stance: { halfWidth: 19, toeOut: 14 },
  frame(c, [kb]) {
    // Both hands on the handle, palms towards the body; the bell hangs on the line of the arms.
    const sh = c.gh("R").add(c.gh("L")).multiplyScalar(0.5);
    // (Arms long but not locked: the bell stays a little inside full reach.)
    const at = c.reachable(handsMid(c).setZ(0), ["R", "L"], 2.2, { offsets: { R: V3(0, 0, 2.6), L: V3(0, 0, -2.6) } });
    const along = at.clone().sub(sh).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, -1, 0), along);
    // Keep the handle across the body (local Z on the figure's Z).
    const zNow = V3(0, 0, 1).applyQuaternion(q);
    const fix = new THREE.Quaternion().setFromUnitVectors(zNow.clone().projectOnPlane(along).normalize(), V3(0, 0, 1).projectOnPlane(along).normalize());
    kb!.place(at, fix.multiply(q));
    for (const s of SIDES) c.hold(s, kb!.handle(s), medial(s), { kind: "wrap", radius: 1.2 });
  },
};

const lateralRaise: Spec = {
  build: () => [makeDumbbell(0.8), makeDumbbell(0.8)],
  frame(c) {
    // Neutral grip (thumbs forward at the bottom, the palms face down at the top), elbows slightly bent.
    for (const s of SIDES) c.free(s, 92, { kind: "wrap", radius: 1.6 });
  },
  after(c, [r, l]) {
    placeInHand(c.sk, "R", r!, 1.6);
    placeInHand(c.sk, "L", l!, 1.6);
  },
};

const farmersCarry: Spec = {
  build: () => [makeDumbbell(1.25), makeDumbbell(1.25)],
  travel: 111.85 * K,
  frame(c) {
    // Arms long at the sides (a few per cent short of locked, so the elbow keeps a direction and the arm never twists
    // from one way to the other), angled out from the thighs so the dumbbells clear them; neutral grip.
    for (const s of SIDES) {
      c.free(s, 88, { kind: "wrap", radius: 1.6 });
      const g = c.goals.arms[s];
      const gh = c.gh(s);
      const dir = g.wrist.clone().sub(gh).normalize();
      dir.z = SIDE_SIGN[s] * 0.2;
      g.wrist = gh.clone().addScaledVector(dir.normalize(), c.armReach(s) * 0.97);
    }
  },
  after(c, [r, l]) {
    placeInHand(c.sk, "R", r!, 1.6);
    placeInHand(c.sk, "L", l!, 1.6);
  },
};

const runningIntervals: Spec = {
  travel: 263.58 * K,
  // (The arms swing fast: baked at 60 frames a second.)
  bakeFps: 60,
  frame(c) {
    // Running arms: elbows about 90° (as the motion swings them), loose fists with the thumbs up, hands in close.
    for (const s of SIDES) {
      c.free(s, 80, { kind: "fist" }, 5);
      const g = c.goals.arms[s];
      g.wrist.z = c.gh(s).z * 0.75 + SIDE_SIGN[s] * 4;
    }
  },
};

const sledPush: Spec = {
  build: () => [makeSled({ gripY: 100 })],
  travel: 246.96 * K,
  frame(c, [sled]) {
    // The sled sits where the motion's hands reach the uprights; both hands on the grips, thumbs up the uprights.
    const hands = handsMid(c);
    const grip = sled!.local.R!.at;
    sled!.place(V3(hands.x - grip.x, 0, 0));
    for (const s of SIDES) {
      const h = sled!.handle(s);
      c.hold(s, h, h.axis.clone(), { kind: "wrap", radius: 2.0 });
    }
  },
};

/** Dumbbells in both hands, following the motion's arms with the given grip: `pronation` 0 is palms forward (up at
 *  the top of a curl), 90 thumbs forward. `out` angles the hanging arms away from the thighs so the inner heads clear
 *  them (fraction of the arm's direction, sideways). */
const dumbbellsInHands = (pronation: number, out = 0): Spec => ({
  build: () => [makeDumbbell(0.8), makeDumbbell(0.8)],
  frame(c) {
    for (const s of SIDES) {
      c.free(s, pronation, { kind: "wrap", radius: 1.6 });
      if (!out) continue;
      const g = c.goals.arms[s];
      const gh = c.gh(s);
      const d = g.wrist.clone().sub(gh);
      const len = d.length();
      // (Most where the arm hangs, none once the forearm comes up past level.)
      const hang = Math.max(0, -d.y / len);
      d.z += SIDE_SIGN[s] * out * len * hang;
      g.wrist = gh.clone().addScaledVector(d.normalize(), len);
    }
  },
  after(c, [r, l]) {
    placeInHand(c.sk, "R", r!, 1.6);
    placeInHand(c.sk, "L", l!, 1.6);
  },
});

/** Dumbbell curl: underhand, the palms facing forward at the bottom and up at the top. */
const dumbbellCurl = dumbbellsInHands(4, 0.22);
/** Hammer curl: neutral grip, thumbs up all the way. */
const hammerCurl = dumbbellsInHands(90, 0.14);

/**
 * Triceps pushdown on a straight bar: the tower in front, its pulley high, the bar held overhand a little narrower than
 * the shoulders; it hangs square to the cable from its swivel, and the elbows stay at the sides as the motion moves
 * the forearms.
 */
const tricepsPushdown: Spec = {
  build: () => [makeCableTower(225), makeCableBar(48, 14), cablePiece()],
  frame(c, [tower, bar, holder]) {
    const t = tower as ReturnType<typeof makeCableTower>;
    const sh = c.gh("R").add(c.gh("L")).multiplyScalar(0.5);
    // (Facing the figure: the tower's front, its pulley side, towards -X.)
    t.place(V3(sh.x + 52 * K, 0, 0), rotY(180));
    t.setPulley(207 * K);
    const at = c.freeAt("R", 14).add(c.freeAt("L", -14)).multiplyScalar(0.5).setZ(0);
    const pulley = t.pulleyAt();
    // Bar level across the body, turned about its length so the swivel points up the cable.
    const up = pulley.clone().sub(at).setZ(0).normalize();
    bar!.place(at, new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), up));
    cableOf(holder).set(pulley, (bar as ReturnType<typeof makeCableBar>).ring());
    for (const s of SIDES) c.hold(s, bar!.handle(s), medial(s));
  },
};

/**
 * Cable chest fly between two towers, pulleys high: a D-handle in each hand, hanging square to its cable, thumbs up;
 * the hands sweep from out at the sides to together in front of the lower chest as the motion's arms move them.
 */
const cableChestFly: Spec = {
  build: () => [makeCableTower(225), makeCableTower(225), makeDHandle(13), makeDHandle(13), cablePiece(), cablePiece()],
  frame(c, [towerR, towerL, hR, hL, cR, cL]) {
    const sh = c.gh("R").add(c.gh("L")).multiplyScalar(0.5);
    const towers = { R: towerR as ReturnType<typeof makeCableTower>, L: towerL as ReturnType<typeof makeCableTower> };
    const handles = { R: hR as ReturnType<typeof makeDHandle>, L: hL as ReturnType<typeof makeDHandle> };
    const cables = { R: cableOf(cR), L: cableOf(cL) };
    for (const s of SIDES) {
      // (A tower either side, a little behind the figure, its pulley side facing in.)
      towers[s].place(V3(sh.x - 22, 0, SIDE_SIGN[s] * 112 * K), rotY(SIDE_SIGN[s] * 90));
      towers[s].setPulley(196 * K);
      const arm = c.freeArm(s);
      const at = c.reachable(arm.grip, [s], 2);
      const pulley = towers[s].pulleyAt();
      // Handle: its D towards the cable, swivelled to the hand, which faces where the hands meet in front of the chest
      // (the grip runs across the palm, little finger to index). (Not "as upright as it hangs": with the arms open the
      // cable runs nearly straight up, and the grip's lie would turn over from one frame to the next.)
      const x = at.clone().sub(pulley).normalize();
      const long = arm.grip.clone().sub(arm.elbow).normalize();
      const meet = sh.clone().add(V3(45, at.y - sh.y, 0));
      const palm = meet.sub(at);
      palm.addScaledVector(long, -palm.dot(long)).normalize();
      const across = V3().crossVectors(long, palm).multiplyScalar(SIDE_SIGN[s]);
      const y = across.addScaledVector(x, -across.dot(x)).normalize();
      const z = V3().crossVectors(x, y).normalize();
      handles[s].place(at, new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)));
      cables[s].set(pulley, handles[s].ring());
      // Elbows soft and pointing back and a little down, as in a fly. (The front-view motion bends the forearms up in
      // the plane of the body, an elbow pointing at the floor, which no palm-forward grip can follow.)
      const pole = V3(-1, -0.45, SIDE_SIGN[s] * 0.15).normalize();
      const elbow = c.gh(s).lerp(at, 0.5).addScaledVector(pole, 14);
      c.hold(s, handles[s].handle("grip"), y.clone(), { kind: "wrap", radius: 1.7 }, pole, elbow);
    }
  },
};

/**
 * Overhead triceps extension with one dumbbell: both palms up under its top head, the thumbs round the handle, the bell
 * hanging below the hands (tipped a little forward, so the wrists are not asked to bend back past their range). The
 * hands go where the motion's forearms take them: overhead, then down behind the head.
 */
/** The bell's tip (towards the front, per unit of down) at the top and at the bottom of the rep. */
const OTE_TOP = -0.9;
const OTE_BOTTOM = 0;
const overheadTricepsExtension: Spec = {
  build: () => [makeDumbbell(0.9)],
  frame(c, [db]) {
    const fwd = c.chestAxes().fwd.setY(0).normalize();
    // How far the elbows are bent (0 locked out, 1 at the bottom), from the motion.
    const flex = Math.min(1, Math.max(0, (c.f ? (c.f.pose.elR + c.f.pose.elL) / 2 : 0) / 120));
    // (The palms meet the plate nearer the wrists than a fist meets a handle: near the top the plate sits a little
    // further along the forearms, so the arms straighten as the motion's do.)
    const fore = SIDES.reduce((a, s) => a.add(c.freeArm(s).grip.sub(c.freeArm(s).elbow).normalize()), V3()).normalize();
    const plate = c.reachable(handsMid(c).setZ(0).addScaledVector(fore, 6 * (1 - smooth(flex))), ["R", "L"], 1);
    // Down the handle, from the top head to the bottom one: tipped back at the top (the palms face up and back, the
    // wrists bent back within their range), hanging nearly straight down behind the head at the bottom.
    const u = V3(0, -1, 0).addScaledVector(fwd, OTE_TOP + (OTE_BOTTOM - OTE_TOP) * smooth(flex)).normalize();
    const zAxis = u.clone();
    const xAxis = fwd.clone().addScaledVector(u, -fwd.dot(u)).normalize();
    const yAxis = V3().crossVectors(zAxis, xAxis);
    db!.place(plate.clone().addScaledVector(u, 7), new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)));
    // Palms on the underside of the top head, one either side of the handle, fingers back and a little out.
    const R = 40;
    for (const s of SIDES) {
      const side = V3(0, 0, SIDE_SIGN[s]).addScaledVector(u, -u.z).normalize();
      const at = plate.clone().addScaledVector(side, 2.6);
      const fingers = xAxis.clone().negate().addScaledVector(side, 0.45).normalize();
      c.palm(s, at.clone().addScaledVector(u, -R), u, R, fingers, { kind: "cup" });
    }
  },
};

/**
 * Inverted row: a bar resting on a rack's J-hooks at about hip height, the body straight beneath it from the heels to
 * the shoulders, hands overhand a little wider than the shoulders, pulling the chest up to the bar. The bar stays put;
 * the body moves (where the motion puts the bar and the hands).
 */
const invertedRow: Spec = {
  build: () => [makeRack(), makeBarbell({ plates: false, grip: 27 })],
  frame(c, [rack, bar]) {
    const r = rack as ReturnType<typeof makeRack>;
    const def = c.f?.props.find((p) => p.def.kind === "barbell")?.def as { at?: [number, number] } | undefined;
    const at2 = def?.at ?? [0, 90];
    const seat = c.lifted!.to3(at2 as [number, number]);
    r.place(V3(seat.x, 0, 0));
    r.setHooks(seat.y - 1.4);
    const barAt = r.barAt();
    bar!.place(barAt, new THREE.Quaternion());
    // The body is a plank pivoting on the heels: the arms' bend (the motion's elbows, on the model's arms, which are a
    // little longer than the drawing's) sets how far the shoulders are from the bar, and the whole body turns about
    // the ankles until they are that far (straight arms hanging at the bottom, the chest to the bar at the top).
    if (c.f) {
      const sk = c.sk;
      const el = (softMinDeg((c.f.pose.elR + c.f.pose.elL) / 2, 140) * Math.PI) / 180;
      const J = sk.meta.joints.R;
      const L1 = V3(...J.shoulder).distanceTo(V3(...J.elbow)), fore = V3(...J.elbow).distanceTo(V3(...J.wrist)) + 7;
      const want = Math.sqrt(L1 * L1 + fore * fore + 2 * L1 * fore * Math.cos(el)) - 1.5;
      const ankle = sk.pos[sk.i("footR")]!.clone().add(sk.pos[sk.i("footL")]!).multiplyScalar(0.5);
      for (let it = 0; it < 3; it++) {
        const sh = c.gh("R").add(c.gh("L")).multiplyScalar(0.5);
        const dist = (a: number) => {
          const p = sh.clone().sub(ankle).applyAxisAngle(V3(0, 0, 1), a).add(ankle);
          return Math.hypot(p.x - barAt.x, p.y - barAt.y);
        };
        // Out from the pose as it stands, the way that brings the distance towards the one wanted, until it is passed;
        // then halved down to it. (Over a wide range the shoulders swing past the bar and the distance turns back, so a
        // search across the whole range can land on the wrong side.)
        const f = (a: number) => dist(a) - want;
        const grows = dist(0.01) > dist(-0.01) ? 1 : -1;
        const dir = f(0) > 0 ? -grows : grows;
        let lo = 0, hi = 0;
        for (let k = 1; k <= 35; k++) {
          hi = dir * k * 0.02;
          if (Math.sign(f(hi)) !== Math.sign(f(0))) break;
          lo = hi;
        }
        for (let k = 0; k < 30; k++) {
          const mid = (lo + hi) / 2;
          if (Math.sign(f(mid)) === Math.sign(f(0))) lo = mid;
          else hi = mid;
        }
        const a = (lo + hi) / 2;
        if (Math.abs(a) < 1e-4) break;
        const q = new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), a);
        const g = c.goals;
        g.pelvis.pos.sub(ankle).applyQuaternion(q).add(ankle);
        g.pelvis.rot.premultiply(q);
        g.chest.premultiply(q);
        g.head.premultiply(q);
        // (The feet turn with the body on their heels.)
        for (const s of SIDES) g.legs[s].foot?.premultiply(q);
        c.presolve();
      }
    }
    for (const s of SIDES) c.hold(s, bar!.handle(s), medial(s));
  },
};
/** A smooth minimum of an angle and a limit (degrees). */
const softMinDeg = (x: number, m: number, w = 6) => m - w * Math.log1p(Math.exp((m - x) / w));

/**
 * Rowing machine, authored in 3D (the 2D motion's finish keeps the elbows under the shoulders, which no overhand grip
 * can follow): catch with the shins upright and the arms long; the drive in order, legs, then the trunk swinging back,
 * then the arms drawing the handle to the lower ribs with the elbows past the body; the recovery in the reverse order.
 * The machine stands with its seat rail along X; the feet stay strapped to the footplates.
 */
/** Rowing keys: seat position, pelvis and chest lean (degrees forward), and the hands as an angle below the horizontal
 *  from the shoulders and a fraction of the arms' full reach. */
type RowKey = { at: number; seat: number; tilt: number; chest: number; hands: [number, number] };
const rowKeys: RowKey[] = [
  { at: 0, seat: 8, tilt: 24, chest: 32, hands: [34, 0.98] },
  { at: 0.2, seat: -38, tilt: 22, chest: 30, hands: [30, 0.98] },
  { at: 0.3, seat: -44, tilt: -10, chest: -14, hands: [26, 0.9] },
  { at: 0.42, seat: -44, tilt: -14, chest: -20, hands: [45, 0.55] },
  { at: 0.5, seat: -44, tilt: -14, chest: -20, hands: [45, 0.55] },
  { at: 0.62, seat: -44, tilt: -10, chest: -14, hands: [24, 0.95] },
  { at: 0.72, seat: -40, tilt: 20, chest: 28, hands: [30, 0.98] },
];
const rowingIntervals: Spec = {
  build: () => [makeRower()],
  body: {
    duration: 2.1,
    goals(c) {
      const k = keyed(rowKeys, c.phase);
      const sk = c.sk;
      const g = restGoals(sk);
      const seatTop = 38.5;
      g.pelvis = { pos: V3(k.seat, seatTop + 12, 0), rot: rotZ(-k.tilt).multiply(sk.restRot[sk.i("pelvis")]!) };
      g.chest = rotZ(-k.chest).multiply(sk.restRot[sk.i("thorax2")]!);
      g.head = rotZ(-k.chest * 0.4).multiply(sk.restRot[sk.i("head")]!);
      for (const s of SIDES) {
        // Feet strapped to the plates (tilted 43°, toes up), knees pointing up and a little out.
        const pitch = 43;
        g.legs[s] = { ankle: V3(47, 40, SIDE_SIGN[s] * 9.5), pole: V3(0.3, 1, SIDE_SIGN[s] * 0.25), foot: rotZ(pitch).multiply(sk.restRot[sk.i(`foot${s}`)]!) };
      }
      c.goals = g;
    },
  },
  frame(c, [rower]) {
    const r = rower as ReturnType<typeof makeRower>;
    rower!.place(V3(0, 0, 0));
    const k = keyed(rowKeys, c.phase);
    const sh = c.gh("R").add(c.gh("L")).multiplyScalar(0.5).setZ(0);
    const a = (k.hands[0] * Math.PI) / 180;
    const full = 63.8;
    const hands = c.reachable(sh.clone().add(V3(Math.cos(a), -Math.sin(a), 0).multiplyScalar(full * k.hands[1])), ["R", "L"], 0.3);
    r.set(k.seat, hands);
    // Overhand, the elbows going back past the body and out (the handle lies a little across each palm, as it does at
    // the finish); the forearms come level as the arms draw in to the lower ribs.
    const bend = Math.min(1, Math.max(0, (1 - k.hands[1]) / 0.55));
    for (const s of SIDES) {
      const h = rower!.handle(s);
      const along = h.at.clone().sub(c.gh(s)).normalize().lerp(V3(1, 0, 0), bend).normalize();
      c.hold(s, h, medial(s), { kind: "wrap", radius: 1.6 }, V3(-0.6, -0.3, SIDE_SIGN[s] * 0.8), h.at.clone().addScaledVector(along, -30));
    }
  },
};

const pallofPress: Spec = {
  build: () => [makeCableTower(), makeDHandle(20), cablePiece()],
  frame(c, [tower, handle, holder]) {
    // Standing side-on to the cable (the tower on the figure's right), the handle pressed straight out from the chest
    // and back, both hands round it, thumbs up; the trunk stays square against the cable's pull.
    const t = tower as ReturnType<typeof makeCableTower>;
    t.place(V3(0, 0, 118), rotY(90));
    t.setPulley(128);
    const at = c.reachable(handsMid(c).setZ(0), ["R", "L"], 3, { offsets: { R: V3(0, -5, 0), L: V3(0, 5, 0) } });
    const pulley = t.pulleyAt();
    const pull = pulley.clone().sub(at).normalize();
    // Handle: grip upright, its D towards the cable.
    const x = pull.clone().negate();
    const y = V3(0, 1, 0);
    const z = V3().crossVectors(x, y).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    handle!.place(at, q);
    cableOf(holder).set(pulley, (handle as ReturnType<typeof makeDHandle>).ring());
    c.hold("R", handle!.handle("lower"), V3(0, 1, 0), { kind: "wrap", radius: 1.7 }, V3(0, -1, 0.5));
    c.hold("L", handle!.handle("upper"), V3(0, 1, 0), { kind: "wrap", radius: 1.7 }, V3(0, -1, -0.5));
  },
};

/**
 * High-to-low cable wood chop with a rope, the tower on the figure's right, authored in 3D: the trunk turns through the
 * chop while the arms stay long, the hands sweeping an arc from high on the right to low beside the left hip; the
 * back foot pivots. Both hands hold the rope's two ends, thumbs towards the cable.
 */
const woodchopKeys: (BodyKey & { dir: [number, number, number]; reach: number })[] = [
  { at: 0, pelvis: [-2, 92, 2], turn: 22, tilt: 4, chestTurn: 50, chestFlex: -4, chestSide: 6, headTurn: 40, feet: { R: [10, 26, 30, 0], L: [8, -24, 8, 0] }, dir: [0.35, 0.62, 0.7], reach: 0.9 },
  { at: 0.45, pelvis: [0, 86, -3], turn: -28, tilt: 10, chestTurn: -48, chestFlex: 14, chestSide: -4, headTurn: -38, feet: { R: [10, 26, -10, 32], L: [8, -24, -6, 0] }, dir: [0.45, -0.75, -0.48], reach: 0.88 },
  { at: 0.55, pelvis: [0, 86, -3], turn: -28, tilt: 10, chestTurn: -50, chestFlex: 14, chestSide: -4, headTurn: -40, feet: { R: [10, 26, -10, 32], L: [8, -24, -6, 0] }, dir: [0.45, -0.75, -0.48], reach: 0.88 },
];
const woodchop: Spec = {
  body: {
    duration: 2.8,
    goals(c) {
      bodyGoals(c, keyed(woodchopKeys, c.phase));
    },
  },
  build: () => [makeCableTower(225), makeFlexRope(), cablePiece()],
  frame(c, [tower]) {
    const t = tower as ReturnType<typeof makeCableTower>;
    t.place(V3(30, 0, 105), rotY(70));
    t.setPulley(205);
    const k = keyed(woodchopKeys, c.phase);
    // The hands sweep an arc round the shoulders at near full reach.
    const sh = c.gh("R").add(c.gh("L")).multiplyScalar(0.5);
    const a = V3(...woodchopKeys[0]!.dir).normalize(), b = V3(...woodchopKeys[1]!.dir).normalize();
    const u = Math.min(1, Math.max(0, V3(...k.dir).normalize().sub(a).length() / b.clone().sub(a).length()));
    const dir = a.clone().applyQuaternion(new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(a, b), u));
    const right = c.chestAxes().right;
    // (Arms long with a little bend kept: within reach whichever way the hands roll round the rope.)
    const hands = c.reachable(sh.addScaledVector(dir, 63.8 * k.reach), ["R", "L"], 9, { offsets: { R: right.clone().multiplyScalar(4.5), L: right.clone().multiplyScalar(-4.5) } });
    const pulley = t.pulleyAt();
    // Each fist round its rope end, the rope square to the forearm, thumbs towards the cable. (The rope is flexible: it
    // bends where it enters the fist. When the arms reach along the cable, at the top of the chop, the cable's part
    // square to the arm vanishes, so the chest's up and right add a steady lean: the direction through the fist never
    // falls to nothing, and never switches from one choice to another.)
    const chest = c.chestAxes();
    for (const s of SIDES) {
      const at = hands.clone().addScaledVector(right, SIDE_SIGN[s] * 4.5);
      const arm = at.clone().sub(c.gh(s)).normalize();
      const square = (v: THREE.Vector3) => v.clone().addScaledVector(arm, -v.dot(arm));
      const axis = square(pulley.clone().sub(at).normalize())
        .addScaledVector(square(chest.up), 0.4)
        .addScaledVector(square(chest.right), -SIDE_SIGN[s] * 0.4)
        .normalize();
      c.hold(s, { at, axis, radius: 1.3 }, axis.clone());
    }
  },
  after(c, [tower, rope, holder]) {
    const t = tower as ReturnType<typeof makeCableTower>;
    const r = rope as ReturnType<typeof makeFlexRope>;
    const ends: Partial<Record<Side, { at: THREE.Vector3; axis: THREE.Vector3 }>> = {};
    for (const s of SIDES) ends[s] = { at: gripPoint(c.sk, s, 1.3), axis: handNow(c.sk, s).across };
    const pulley = t.pulleyAt();
    const mid = ends.R!.at.clone().add(ends.L!.at).multiplyScalar(0.5);
    const clip = mid.clone().addScaledVector(pulley.clone().sub(mid).normalize(), 18);
    r.set(clip, ends);
    cableOf(holder).set(pulley, clip);
  },
};

/** Rotational medicine-ball throw against a wall on the figure's left: load at the right hip, throw, catch. */
const throwKeys: (BodyKey & { ball: [number, number, number]; held: number })[] = [
  { at: 0, pelvis: [-3, 88, 4], turn: 30, tilt: 10, chestTurn: 62, chestFlex: 10, headTurn: -10, feet: { R: [10, 26, 10, 0], L: [8, -26, 4, 0] }, ball: [16, -44, 30], held: 1 },
  { at: 0.3, pelvis: [0, 90, -2], turn: -30, tilt: 6, chestTurn: -52, chestFlex: 4, headTurn: -60, feet: { R: [10, 26, -40, 34], L: [8, -26, -10, 0] }, ball: [30, -18, -38], held: 1 },
  { at: 0.36, pelvis: [0, 90, -2], turn: -32, tilt: 6, chestTurn: -55, chestFlex: 4, headTurn: -60, feet: { R: [10, 26, -40, 34], L: [8, -26, -10, 0] }, ball: [30, -16, -60], held: 0 },
  { at: 0.52, pelvis: [0, 90, -2], turn: -25, tilt: 6, chestTurn: -42, chestFlex: 4, headTurn: -60, feet: { R: [10, 26, -30, 20], L: [8, -26, -10, 0] }, ball: [30, -16, -60], held: 0 },
  { at: 0.66, pelvis: [-1, 89, 0], turn: -20, tilt: 8, chestTurn: -40, chestFlex: 6, headTurn: -50, feet: { R: [10, 26, -10, 6], L: [8, -26, -6, 0] }, ball: [28, -16, -36], held: 1 },
];
const rotationalThrow: Spec = {
  // (The ball comes off the wall fast: baked at 60 frames a second so the bounce is not cut short.)
  bakeFps: 60,
  body: {
    duration: 2.6,
    goals(c) {
      bodyGoals(c, keyed(throwKeys, c.phase));
    },
  },
  build: () => {
    const wall = makeWall(320, 280);
    return [wall, makeMedball(12)];
  },
  frame(c, [wall, ball]) {
    wall!.place(V3(10, 0, -140), rotY(90));
    const k = keyed(throwKeys, c.phase);
    // Held: at the hands (set from the shoulders, so the arms reach it). In flight from the release to the wall and
    // back to the catch: a straight path with a little arc, bouncing off the wall.
    let at = c.reachable(c.fromShoulders(k.ball), ["R", "L"], 6);
    const release = c.fromShoulders(throwKeys[1]!.ball);
    const catchAt = c.fromShoulders(throwKeys[4]!.ball);
    const wallHit = V3(release.x + 6, release.y + 8, -140 + 12);
    if (c.phase > 0.3 && c.phase < 0.66) {
      const p = c.phase;
      const fly = (a: THREE.Vector3, b: THREE.Vector3, u: number) => a.clone().lerp(b, Math.min(1, Math.max(0, u))).add(V3(0, Math.sin(Math.min(1, Math.max(0, u)) * Math.PI) * 6, 0));
      at = p < 0.46 ? fly(release, wallHit, (p - 0.3) / 0.16) : fly(wallHit, catchAt, (p - 0.46) / 0.2);
    }
    ball!.place(at);
    // The hands keep the ball's shape all through: on the ball while it is held; after the release they follow through
    // towards the wall, then come back in front of the chest ready for the catch (a ball they hold in the air), so the
    // hands never jump from one pose to another.
    let hands = at.clone();
    const held = c.phase <= 0.3 || c.phase >= 0.66;
    if (!held) {
      const follow = release.clone().add(V3(4, -4, -14));
      const ready = catchAt.clone().add(V3(4, 0, 6));
      const u = (c.phase - 0.3) / 0.36;
      hands = u < 0.3 ? release.clone().lerp(follow, smooth(u / 0.3)) : follow.clone().lerp(ready, smooth((u - 0.3) / 0.7)).lerp(catchAt, smooth(Math.max(0, (u - 0.85) / 0.15)));
      // (The follow-through stays within the arms' reach; over the last of the catch the hands meet the ball itself, so
      // the fingers close round the real ball, not ahead of it.)
      hands = c.reachable(hands, ["R", "L"], 6).lerp(at, clamp01((c.phase - 0.56) / 0.1));
    }
    {
      // Hands on either side of the ball, fingers spread over it and running on from the forearms (the arms reach the
      // ball from the shoulders, so the wrists stay straight whether the ball is low at the hip or out in front).
      const fwd = c.chestAxes().fwd;
      const side = V3().crossVectors(V3(0, 1, 0), fwd).normalize(); // the figure's left
      for (const s of SIDES) {
        const n = side.clone().multiplyScalar(s === "R" ? -1 : 1).addScaledVector(V3(0, -1, 0), 0.3).addScaledVector(fwd, -0.2).normalize();
        const along = hands.clone().sub(c.gh(s));
        const fingers = along.addScaledVector(n, -along.dot(n)).normalize().addScaledVector(fwd, 0.25).normalize();
        // (The fingers open over the release and close again over the catch, rather than in one frame.)
        const open = clamp01((c.phase - 0.28) / 0.08) * clamp01((0.68 - c.phase) / 0.08);
        c.palm(s, hands, n, held ? 12 : 13, fingers, { kind: "blend", from: { kind: "cup" }, to: { kind: "open" }, t: open }, { contact: held });
      }
    }
    void wall;
  },
};

/**
 * Air bike, authored in 3D: seated on the saddle, leaning forward a little, the balls of the feet on the pedals as the
 * cranks turn (two turns a loop, about 85 rpm), the hands on the levers, which swing opposite the pedals: each arm pushes
 * as the leg on its side pulls back. The chest turns a few degrees with the arms.
 */
const airBike: Spec = {
  build: () => [makeAirBike()],
  body: {
    duration: 1.4,
    goals(c) {
      const sk = c.sk;
      const g = restGoals(sk);
      const a = c.phase * Math.PI * 4;
      g.pelvis = { pos: V3(-10, 110, 0), rot: rotY(2 * Math.sin(a)).multiply(rotZ(-14)).multiply(sk.restRot[sk.i("pelvis")]!) };
      g.chest = rotY(6 * Math.sin(a)).multiply(rotZ(-24)).multiply(sk.restRot[sk.i("thorax2")]!);
      g.head = rotZ(-6).multiply(sk.restRot[sk.i("head")]!);
      // Feet: the ball on the pedal, toes pointing down about 20° (a little more over the top, a little less at the
      // bottom).
      const bike = c.pieces[0] as ReturnType<typeof makeAirBike>;
      for (const s of SIDES) {
        const J = sk.meta.joints[s];
        const ballRest = V3(...J.ball), ankleRest = V3(...J.ankle);
        // (The crank's angle as the bike turns it: forward, clockwise seen from the right.)
        const crankA = -c.phase * 4 * Math.PI + (s === "R" ? 0 : Math.PI);
        const pitch = 22 + 6 * Math.sin(crankA);
        const q = rotZ(-pitch);
        const pedal = bike.pedalAt(s, c.phase * 2);
        const ball = V3(pedal.x, pedal.y + 1 + ballRest.y, pedal.z);
        const ankle = ankleRest.clone().sub(ballRest).applyQuaternion(q).add(ball);
        g.legs[s] = { ankle, foot: q.clone().multiply(sk.restRot[sk.i(`foot${s}`)]!), pole: V3(1, 0.4, SIDE_SIGN[s] * 0.2), toes: 0 };
      }
      c.goals = g;
    },
  },
  frame(c, [bike]) {
    const b = bike as ReturnType<typeof makeAirBike>;
    bike!.place(V3(0, 0, 0));
    b.set(c.phase * 2);
    // Neutral grip on the levers, thumbs up them; elbows down and a little out.
    for (const s of SIDES) {
      const h = bike!.handle(s);
      c.hold(s, h, h.axis.clone(), { kind: "wrap", radius: 1.8 }, V3(-0.3, -1, SIDE_SIGN[s] * 0.5));
    }
  },
};

export const SPECS: Record<string, Spec> = {
  "push-press": pushPress,
  "kettlebell-swing": kettlebellSwing,
  "lateral-raise": lateralRaise,
  "farmers-carry": farmersCarry,
  "running-intervals": runningIntervals,
  "sled-push": sledPush,
  "rowing-intervals": rowingIntervals,
  "pallof-press": pallofPress,
  "cable-woodchop": woodchop,
  "medicine-ball-rotational-throw": rotationalThrow,
  "air-bike-sprint": airBike,
  "dumbbell-curl": dumbbellCurl,
  "hammer-curl": hammerCurl,
  "triceps-pushdown": tricepsPushdown,
  "cable-chest-fly": cableChestFly,
  "sumo-deadlift": sumoDeadlift,
  "overhead-triceps-extension": overheadTricepsExtension,
  "inverted-row": invertedRow,
};

/** Hands free, following the motion, no equipment: the fallback while an exercise has no spec of its own. */
export const FALLBACK: Spec = {
  frame(c) {
    for (const s of SIDES) c.free(s, 90);
  },
};

export const hasSpec = (slug: string) => slug in SPECS;
export const specFor = (slug: string): Spec => SPECS[slug] ?? FALLBACK;
export type { Skeleton3 };
