import * as THREE from "three";
import { barbell, box, curveTube, dumbbell, kettlebell, M, plate, rod } from "../equipment";

/**
 * Equipment for the anatomical rig, in rig space (cm, +X forward, +Y up, +Z the figure's right), each piece with the
 * places a hand holds it: a handle is a point on the grip, the grip's axis, and its radius. The exercise specs
 * (specs.ts) place the pieces every frame and put the hands on their handles; pieces a hand carries (dumbbells,
 * kettlebells) are placed from the solved hand instead.
 */
export interface Handle {
  at: THREE.Vector3;
  axis: THREE.Vector3;
  radius: number;
}

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** A piece whose object is posed by a matrix (position + rotation) and whose handles are fixed in its own frame. */
export class Piece {
  readonly obj = new THREE.Group();
  /** Handles in the piece's own frame. */
  readonly local: Record<string, Handle> = {};
  /** Solid parts in the piece's own frame, for the collision checks: segments with a radius. */
  readonly solids: { a: THREE.Vector3; b: THREE.Vector3; r: number }[] = [];
  constructor(readonly kind: string) {
    this.obj.name = kind;
  }
  place(pos: THREE.Vector3, rot?: THREE.Quaternion): this {
    this.obj.position.copy(pos);
    if (rot) this.obj.quaternion.copy(rot);
    this.obj.updateMatrix();
    this.obj.updateMatrixWorld(true);
    return this;
  }
  /** A handle in rig space (the piece's parent is rig space). */
  handle(name: string): Handle {
    const h = this.local[name];
    if (!h) throw new Error(`${this.kind} has no handle ${name}`);
    const q = this.obj.quaternion;
    return { at: h.at.clone().applyQuaternion(q).add(this.obj.position), axis: h.axis.clone().applyQuaternion(q).normalize(), radius: h.radius };
  }
  solidsWorld(): { a: THREE.Vector3; b: THREE.Vector3; r: number }[] {
    const m = this.obj.matrix;
    return this.solids.map((s) => ({ a: s.a.clone().applyMatrix4(m), b: s.b.clone().applyMatrix4(m), r: s.r }));
  }
}

// ---------------------------------------------------------------- free weights

/** Olympic barbell along local Z, centred; handles "L"/"R" at the grip half-width. */
export function makeBarbell(o: { plateR?: number; plates?: boolean; thick?: number; grip?: number } = {}): Piece {
  const p = new Piece("barbell");
  p.obj.add(barbell(o.plateR ?? 22.5, { plates: o.plates, thick: o.thick }));
  const g = o.grip ?? 26;
  const r = o.thick ?? 1.4;
  p.local.R = { at: V3(0, 0, g), axis: V3(0, 0, 1), radius: r };
  p.local.L = { at: V3(0, 0, -g), axis: V3(0, 0, 1), radius: r };
  p.solids.push({ a: V3(0, 0, -65), b: V3(0, 0, 65), r });
  if (o.plates !== false) for (const k of [-1, 1]) p.solids.push({ a: V3(0, 0, k * 68), b: V3(0, 0, k * 82), r: o.plateR ?? 22.5 });
  return p;
}

/** Dumbbell with the handle along local Z (centre = the middle of the handle). */
export function makeDumbbell(scale = 1): Piece {
  const p = new Piece("dumbbell");
  p.obj.add(dumbbell(scale));
  p.local.grip = { at: V3(), axis: V3(0, 0, 1), radius: 1.6 };
  p.solids.push({ a: V3(0, 0, -6.5), b: V3(0, 0, 6.5), r: 1.6 });
  for (const k of [-1, 1]) p.solids.push({ a: V3(0, 0, k * 6.5), b: V3(0, 0, k * (6.5 + 7 * scale)), r: 5.6 * scale });
  return p;
}

/** Kettlebell: the handle's top bar along local Z at the origin, the bell below (-Y). */
export function makeKettlebell(scale = 1): Piece {
  const p = new Piece("kettlebell");
  const kb = kettlebell(scale);
  // (The shared model's handle top is at y = -3 + 5.2; bring it to the origin.)
  kb.position.y = -(5.2 * scale - 3 * scale);
  kb.rotation.y = Math.PI / 2;
  p.obj.add(kb);
  p.local.grip = { at: V3(), axis: V3(0, 0, 1), radius: 1.2 };
  p.local.R = { at: V3(0, 0, 2.6 * scale), axis: V3(0, 0, 1), radius: 1.2 };
  p.local.L = { at: V3(0, 0, -2.6 * scale), axis: V3(0, 0, 1), radius: 1.2 };
  p.solids.push({ a: V3(0, -13 * scale, 0), b: V3(0, -13 * scale, 0), r: 9 * scale });
  return p;
}

export function makeMedball(r = 12): Piece {
  const p = new Piece("medball");
  p.obj.add(new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), M.rubber));
  const seam = new THREE.Mesh(new THREE.TorusGeometry(r * 1.002, 0.28, 6, 48), M.gold);
  seam.rotation.y = Math.PI / 2;
  p.obj.add(seam);
  p.solids.push({ a: V3(), b: V3(), r });
  return p;
}

// ---------------------------------------------------------------- cables

/** A cable tower (frame, weight stack) with a pulley that can sit at any height; the cable runs from the pulley. */
export function makeCableTower(h = 215): Piece & { pulley: THREE.Group; setPulley(y: number): void; pulleyAt(): THREE.Vector3 } {
  const p = new Piece("cableTower") as Piece & { pulley: THREE.Group; setPulley(y: number): void; pulleyAt(): THREE.Vector3 };
  const post = box(14, h, 14, M.frame);
  post.position.set(-14, h / 2, 0);
  const rail = box(4, h - 10, 6, M.steel);
  rail.position.set(-5, h / 2, 0);
  const stack = box(18, 70, 20, M.black);
  stack.position.set(-30, 40, 0);
  const stackTrim = box(18.4, 1, 20.4, M.gold);
  stackTrim.position.set(-30, 76, 0);
  const base = box(70, 4, 50, M.frame);
  base.position.set(-20, 2, 0);
  const top = box(40, 6, 14, M.frame);
  top.position.set(-22, h - 3, 0);
  p.obj.add(post, rail, stack, stackTrim, base, top);
  p.pulley = new THREE.Group();
  const carriage = box(8, 10, 10, M.frame);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.9, 8, 24), M.gold);
  wheel.rotation.y = Math.PI / 2;
  wheel.position.x = 4;
  p.pulley.add(carriage, wheel);
  p.obj.add(p.pulley);
  p.setPulley = (y: number) => {
    p.pulley.position.set(-2, y, 0);
    p.obj.updateMatrixWorld(true);
  };
  p.pulleyAt = () => V3(4, p.pulley.position.y, 0).applyQuaternion(p.obj.quaternion).add(p.obj.position);
  p.solids.push({ a: V3(-14, 0, 0), b: V3(-14, h, 0), r: 9 }, { a: V3(-30, 5, 0), b: V3(-30, 75, 0), r: 12 });
  return p;
}

/** A cable (a tube) between two points, rebuilt as they move. */
export class Cable {
  readonly obj = new THREE.Group();
  private last = "";
  constructor(private radius = 0.4, private material: THREE.Material = M.cable) {}
  set(a: THREE.Vector3, b: THREE.Vector3, sag = 0): void {
    const key = `${a.toArray().map((x) => x.toFixed(2))}|${b.toArray().map((x) => x.toFixed(2))}|${sag.toFixed(2)}`;
    if (key === this.last) return;
    this.last = key;
    for (const c of this.obj.children) (c as THREE.Mesh).geometry.dispose();
    this.obj.clear();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y -= sag;
    this.obj.add(curveTube(sag ? [a, mid, b] : [a, a.clone().lerp(b, 0.5), b], this.radius, this.material));
  }
}

/**
 * A single D-handle: the grip bar along local Y (centred at the origin), the D frame and the ring the cable clips to
 * at local -X (the cable pulls along -X).
 */
export function makeDHandle(len = 13): Piece & { ring: () => THREE.Vector3 } {
  const p = new Piece("dHandle") as Piece & { ring: () => THREE.Vector3 };
  const h = len / 2;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, len, 16), M.pad);
  const frame = curveTube([V3(0, h + 1, 0), V3(-4, h + 1.5, 0), V3(-9, h * 0.4, 0), V3(-10, 0, 0), V3(-9, -h * 0.4, 0), V3(-4, -h - 1.5, 0), V3(0, -h - 1, 0)], 0.6, M.steel);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.4, 6, 16), M.steel);
  ring.position.set(-11.5, 0, 0);
  p.obj.add(grip, frame, ring);
  p.local.grip = { at: V3(), axis: V3(0, 1, 0), radius: 1.7 };
  // Two hands side by side on a long grip; one hand on a short one.
  const off = len >= 18 ? len / 4 : 3.6;
  p.local.upper = { at: V3(0, off, 0), axis: V3(0, 1, 0), radius: 1.7 };
  p.local.lower = { at: V3(0, -off, 0), axis: V3(0, 1, 0), radius: 1.7 };
  p.ring = () => V3(-12.5, 0, 0).applyQuaternion(p.obj.quaternion).add(p.obj.position);
  return p;
}

/** A straight cable bar (pushdowns) along local Z, the ring at its middle above (+Y). */
export function makeCableBar(len = 50): Piece & { ring: () => THREE.Vector3 } {
  const p = new Piece("cableBar") as Piece & { ring: () => THREE.Vector3 };
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, len, 14), M.knurl);
  bar.rotation.x = Math.PI / 2;
  const swivel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 5, 12), M.steel);
  swivel.position.y = 3;
  p.obj.add(bar, swivel);
  p.local.R = { at: V3(0, 0, 9), axis: V3(0, 0, 1), radius: 1.4 };
  p.local.L = { at: V3(0, 0, -9), axis: V3(0, 0, 1), radius: 1.4 };
  p.ring = () => V3(0, 6, 0).applyQuaternion(p.obj.quaternion).add(p.obj.position);
  return p;
}

/** A triceps rope: two rope ends hanging from a clip (local origin), each with a knob; handles at the knobs' tops. */
export function makeTricepsRope(): Piece & { ring: () => THREE.Vector3; spread(d: number): void } {
  const p = new Piece("rope") as Piece & { ring: () => THREE.Vector3; spread(d: number): void };
  const rope = new THREE.Group();
  p.obj.add(rope);
  p.spread = (d: number) => {
    for (const c of rope.children) (c as THREE.Mesh).geometry?.dispose();
    rope.clear();
    for (const k of [-1, 1]) {
      const end = V3(0, -22, k * d);
      rope.add(curveTube([V3(0, 0, 0), V3(0, -8, k * d * 0.3), end], 1.3, M.rope));
      const knob = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 10), M.black);
      knob.position.copy(end).add(V3(0, -1.5, 0));
      rope.add(knob);
      p.local[k > 0 ? "R" : "L"] = { at: V3(0, -16, k * d * 0.85), axis: V3(0, 1, 0), radius: 1.3 };
    }
  };
  p.spread(5);
  p.ring = () => p.obj.position.clone();
  return p;
}

// ---------------------------------------------------------------- machines

/**
 * Rowing machine (air rower) along +X: flywheel housing at the front, monorail back to the seat, footplates with
 * straps. `set(seatX, handle)` moves the seat on the rail and the handle (a bar along Z) with its chain to the
 * flywheel. Handles "R"/"L" are on the handle bar.
 */
export function makeRower(): Piece & { set(seatX: number, handle: THREE.Vector3): void; seatTop: number; footAt: THREE.Vector3 } {
  const p = new Piece("rower") as Piece & { set(seatX: number, handle: THREE.Vector3): void; seatTop: number; footAt: THREE.Vector3 };
  const railY = 30;
  const rail = box(150, 4, 9, M.steel);
  rail.position.set(-20, railY, 0);
  const legBack = box(6, railY, 40, M.frame);
  legBack.position.set(-92, railY / 2, 0);
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 16, 40), M.black);
  housing.rotation.x = Math.PI / 2;
  housing.position.set(88, 40, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(26, 0.7, 8, 48), M.gold);
  ring.position.set(88, 40, 8.2);
  const ring2 = ring.clone();
  ring2.position.z = -8.2;
  const front = box(40, 6, 46, M.frame);
  front.position.set(84, 3, 0);
  const neck = box(30, 8, 8, M.frame);
  neck.position.set(62, 34, 0);
  // Footplates, angled, with straps.
  const feet = new THREE.Group();
  for (const k of [-1, 1]) {
    const plateF = box(4, 26, 12, M.frame);
    plateF.position.set(52, 36, k * 9);
    plateF.rotation.z = 0.75;
    const strap = box(4.4, 3, 12.4, M.gold);
    strap.position.set(55, 40, k * 9);
    strap.rotation.z = 0.75;
    feet.add(plateF, strap);
  }
  const seat = box(30, 5, 26, M.pad);
  const seatBase = box(24, 4, 12, M.frame);
  seatBase.position.y = -4;
  const seatG = new THREE.Group().add(seat, seatBase);
  const handle = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 52, 14), M.pad);
  bar.rotation.x = Math.PI / 2;
  handle.add(bar);
  const chain = new Cable(0.45, M.steel);
  p.obj.add(rail, legBack, housing, ring, ring2, front, neck, feet, seatG, handle, chain.obj);
  p.seatTop = railY + 2 + 2.5 + 4;
  p.footAt = V3(54, 37, 0);
  p.local.R = { at: V3(0, 0, 10), axis: V3(0, 0, 1), radius: 1.6 };
  p.local.L = { at: V3(0, 0, -10), axis: V3(0, 0, 1), radius: 1.6 };
  const handleLocal = V3();
  p.set = (seatX: number, h: THREE.Vector3) => {
    seatG.position.set(seatX, railY + 2 + 2.5 + 2, 0);
    handle.position.copy(h);
    handleLocal.copy(h);
    chain.set(V3(h.x + 1.6, h.y, 0), V3(70, 44, 0));
    p.local.R!.at.set(h.x, h.y, 10);
    p.local.L!.at.set(h.x, h.y, -10);
  };
  p.solids.push({ a: V3(-90, railY, 0), b: V3(60, railY, 0), r: 4 }, { a: V3(88, 40, -8), b: V3(88, 40, 8), r: 26 });
  return p;
}

/**
 * Air bike along +X: seat over the cranks, the fan at the front, and two handle levers that pivot low at the front and
 * swing forward and back opposite each other, linked to the pedals. `set(phase)` turns the cranks (one turn per
 * phase 0→1); handles "R"/"L" are the tops of the levers (vertical grips).
 */
export function makeAirBike(): Piece & { set(phase: number): void; seat: THREE.Vector3; pedal(side: "R" | "L"): THREE.Vector3 } {
  const p = new Piece("airBike") as Piece & { set(phase: number): void; seat: THREE.Vector3; pedal(side: "R" | "L"): THREE.Vector3 };
  const seatTop = V3(-8, 92, 0);
  const crank = V3(8, 32, 0);
  const pivot = V3(48, 50, 0);
  const fan = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 16, 40), M.black);
  fan.rotation.x = Math.PI / 2;
  fan.position.set(66, 42, 0);
  const fanRing = new THREE.Mesh(new THREE.TorusGeometry(30, 0.8, 8, 48), M.gold);
  fanRing.position.set(66, 42, 8.2);
  const seat = box(26, 6, 20, M.pad);
  seat.position.copy(seatTop).add(V3(0, -3, 0));
  const frame = new THREE.Group().add(
    rod(V3(-8, 86, 0), crank, 2.6, M.frame),
    rod(crank, V3(66, 42, 0), 2.6, M.frame),
    rod(V3(-30, 2, 0), V3(90, 2, 0), 2.4, M.frame),
    rod(V3(-30, 2, -24), V3(-30, 2, 24), 2.2, M.frame),
    rod(V3(90, 2, -24), V3(90, 2, 24), 2.2, M.frame),
    rod(crank, V3(-30, 2, 0), 2.2, M.frame),
    rod(V3(66, 42, 0), V3(90, 2, 0), 2.4, M.frame),
    rod(pivot, V3(52, 46, 0), 2.4, M.frame),
  );
  const levers: Record<"R" | "L", THREE.Group> = { R: new THREE.Group(), L: new THREE.Group() };
  const arms: Record<"R" | "L", THREE.Group> = { R: new THREE.Group(), L: new THREE.Group() };
  for (const s of ["R", "L"] as const) {
    const k = s === "R" ? 1 : -1;
    // Lever: from the pivot up to the grip (local, the lever's frame at the pivot, pointing up).
    const L = new THREE.Group();
    L.add(rod(V3(0, 0, k * 22), V3(0, 72, k * 22), 1.8, M.frame));
    L.add(rod(V3(0, 0, k * 8), V3(0, 0, k * 22), 1.8, M.frame));
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 16, 14), M.pad);
    grip.position.set(0, 66, k * 22);
    L.add(grip);
    L.position.copy(pivot);
    levers[s] = L;
    arms[s] = new THREE.Group();
    p.obj.add(L, arms[s]);
  }
  const cranks = new THREE.Group();
  cranks.position.copy(crank);
  p.obj.add(fan, fanRing, seat, frame, cranks);
  p.seat = seatTop.clone();
  let phase = 0;
  const pedalAt = (s: "R" | "L") => {
    const a = phase * Math.PI * 2 + (s === "R" ? 0 : Math.PI);
    return V3(crank.x + Math.cos(a) * 17, crank.y + Math.sin(a) * 17, (s === "R" ? 1 : -1) * 13);
  };
  p.pedal = (s) => pedalAt(s).applyQuaternion(p.obj.quaternion).add(p.obj.position);
  p.set = (ph: number) => {
    phase = ph;
    for (const c of cranks.children) (c as THREE.Mesh).geometry?.dispose();
    cranks.clear();
    for (const s of ["R", "L"] as const) {
      const ped = pedalAt(s).sub(crank);
      cranks.add(rod(V3(0, 0, ped.z * 0.6), V3(ped.x, ped.y, ped.z * 0.6), 1.4, M.steel));
      const pedal = box(10, 2, 9, M.black);
      pedal.position.set(ped.x, ped.y, ped.z);
      cranks.add(pedal);
      // The lever swings with the opposite pedal: forward (+angle) as the opposite pedal goes back.
      const a = phase * Math.PI * 2 + (s === "R" ? Math.PI : 0);
      const swing = Math.cos(a) * 0.38 - 0.18;
      levers[s].rotation.set(0, 0, swing);
      const k = s === "R" ? 1 : -1;
      p.local[s] = { at: V3(0, 66, k * 22).applyEuler(levers[s].rotation).add(pivot), axis: V3(0, 1, 0).applyEuler(levers[s].rotation), radius: 1.8 };
      // Link rod from the lever's foot to the crank.
      for (const c of arms[s].children) (c as THREE.Mesh).geometry?.dispose();
      arms[s].clear();
      arms[s].add(rod(V3(0, -8, k * 16).applyEuler(levers[s].rotation).add(pivot), pedalAt(s).setZ(k * 16), 1.3, M.steel));
    }
    p.obj.updateMatrixWorld(true);
  };
  p.set(0);
  p.solids.push({ a: V3(66, 42, -8), b: V3(66, 42, 8), r: 30 });
  return p;
}

/**
 * Push sled: a low frame with plates on the post and two tall uprights at the back (-X) with grips; handles "R"/"L"
 * are vertical grips on the uprights at `gripY`.
 */
export function makeSled(o: { posts?: boolean; gripY?: number } = {}): Piece & { hook: () => THREE.Vector3 } {
  const p = new Piece("sled") as Piece & { hook: () => THREE.Vector3 };
  const base = new THREE.Group();
  for (const k of [-1, 1]) {
    // Skids, curled up at the front.
    base.add(curveTube([V3(-40, 2, k * 24), V3(30, 2, k * 24), V3(42, 6, k * 24), V3(46, 14, k * 24)], 2, M.frame));
  }
  base.add(box(70, 3, 50, M.frame).translateY(6), rod(V3(0, 7, 0), V3(0, 44, 0), 2.2, M.steel));
  for (let i = 0; i < 3; i++) {
    const pl = plate(22, 5);
    pl.rotation.x = Math.PI / 2;
    pl.position.set(0, 12 + i * 5.5, 0);
    base.add(pl);
  }
  p.obj.add(base);
  const gy = o.gripY ?? 98;
  if (o.posts !== false)
    for (const k of [-1, 1]) {
      p.obj.add(rod(V3(-30, 6, k * 22), V3(-40, gy + 14, k * 22), 2.2, M.frame));
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 18, 14), M.pad);
      const dir = V3(-10, gy + 8, 0).normalize();
      grip.quaternion.setFromUnitVectors(V3(0, 1, 0), dir);
      const at = V3(-30, 6, k * 22).lerp(V3(-40, gy + 14, k * 22), (gy - 6) / (gy + 8));
      grip.position.copy(at);
      p.obj.add(grip);
      p.local[k > 0 ? "R" : "L"] = { at, axis: dir.clone(), radius: 2.0 };
    }
  p.hook = () => V3(-36, 10, 0).applyQuaternion(p.obj.quaternion).add(p.obj.position);
  p.solids.push({ a: V3(-35, 8, 0), b: V3(40, 8, 0), r: 6 }, { a: V3(0, 10, 0), b: V3(0, 26, 0), r: 22 });
  return p;
}

/** A wall (a slab facing -X at local x = 0), for throws and wall drills. */
export function makeWall(w = 260, h = 260): Piece {
  const p = new Piece("wall");
  const slab = box(24, h, w, M.wall);
  slab.position.set(12, h / 2, 0);
  const line = box(0.6, 2, w, M.gold);
  line.position.set(-0.3, 150, 0);
  p.obj.add(slab, line);
  return p;
}

/**
 * A flexible rope attachment (triceps / wood-chop rope): two ends from a clip, each passing through a fist and ending
 * in a knot. The hands decide how the rope lies in them (a rope bends): `set` draws each end from the clip through the
 * hand's grip point along the hand's grip axis.
 */
export function makeFlexRope(): Piece & { set(clip: THREE.Vector3, ends: Partial<Record<"R" | "L", { at: THREE.Vector3; axis: THREE.Vector3 }>>): void } {
  const p = new Piece("rope") as Piece & { set(clip: THREE.Vector3, ends: Partial<Record<"R" | "L", { at: THREE.Vector3; axis: THREE.Vector3 }>>): void };
  const tubes = new THREE.Group();
  const clipMesh = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.45, 8, 16), M.steel);
  p.obj.add(tubes, clipMesh);
  let last = "";
  p.set = (clip, ends) => {
    const key = JSON.stringify([clip, ends]);
    if (key === last) return;
    last = key;
    for (const c of tubes.children) (c as THREE.Mesh).geometry?.dispose();
    tubes.clear();
    clipMesh.position.copy(clip);
    for (const s of ["R", "L"] as const) {
      const e = ends[s];
      if (!e) continue;
      // The rope enters the fist on the thumb side and leaves on the little-finger side, then the knot.
      const axis = e.axis.clone().normalize();
      const enter = e.at.clone().addScaledVector(axis, 5);
      const exit = e.at.clone().addScaledVector(axis, -5);
      const mid = clip.clone().lerp(enter, 0.5);
      tubes.add(curveTube([clip, mid, enter, e.at, exit], 1.3, M.rope));
      const knot = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 10), M.black);
      knot.position.copy(exit).addScaledVector(axis, -1.8);
      tubes.add(knot);
    }
  };
  return p;
}
