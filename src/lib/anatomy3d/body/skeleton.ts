import * as THREE from "three";

/**
 * The anatomical skeleton of the Écorché model (public/anatomy/ecorche-rig.json, scripts/anatomy/build-ecorche-rig.mts):
 * 59 rigid bones whose joints were measured from the model's own bones. Rig frame: centimetres, +X forward, +Y up, +Z
 * the figure's right, soles on y = 0.
 *
 * A pose is a world rotation per bone plus the pelvis position; every other bone's position follows from its parent
 * (bones never stretch). The solver (solve.ts) sets the rotations parents first; `place` puts a bone at its joint.
 */
export interface RigMeta {
  frame: { scale: number; offset: [number, number, number] };
  bones: {
    name: string;
    parent: string | null;
    origin: [number, number, number];
    y: [number, number, number];
    x: [number, number, number];
    hinge?: [number, number, number];
    /** A blend helper: turns `t` of the way from `from`'s turn to `to`'s, about `to`'s joint (skinning only). */
    blend?: { from: string; to: string; t: number };
  }[];
  joints: Record<"R" | "L", RigSideJoints> & { spine: Record<string, [number, number, number]> };
  vertices: number;
  /** Per part of the file: its block of weights, the bones it follows, and whether it is skinned linearly (muscles that
   *  stretch as straight bands across a joint) rather than with dual quaternions. */
  meshes: { name: string; offset: number; count: number; bones: string[]; linear?: boolean }[];
  face: { offset: number; count: number } | null;
}
type P3 = [number, number, number];
export interface RigSideJoints {
  hip: P3; knee: P3; ankle: P3; ball: P3; toeTip: P3; heel: P3; sc: P3; ac: P3; shoulder: P3; elbow: P3; wrist: P3;
  radialHead: P3; ulnarHead: P3; kneeAxis: P3; ankleAxis: P3; elbowAxis: P3;
  thumb: { cmc: P3; mcp: P3; ip: P3; tip: P3 };
  index: { mcp: P3; pip: P3; dip: P3; tip: P3 };
  middle: { mcp: P3; pip: P3; dip: P3; tip: P3 };
  ring: { mcp: P3; pip: P3; dip: P3; tip: P3 };
  little: { mcp: P3; pip: P3; dip: P3; tip: P3 };
}

export type Side = "R" | "L";
export const SIDE_SIGN: Record<Side, 1 | -1> = { R: 1, L: -1 };
export const FINGERS = ["index", "middle", "ring", "little"] as const;

const v3 = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2]);

export class Skeleton3 {
  readonly names: string[];
  readonly parent: number[];
  readonly index: Map<string, number>;
  /** Rest pose: world position (joint) and rotation (the bone's frame: Y along it, X forward) of each bone. */
  readonly restPos: THREE.Vector3[];
  readonly restRot: THREE.Quaternion[];
  /** Each bone's origin in its parent's rest frame, and its rest rotation relative to the parent. */
  readonly offset: THREE.Vector3[];
  readonly restLocal: THREE.Quaternion[];
  /** Hinge axes (elbow, knee, ankle) in the parent bone's frame. */
  readonly hingeLocal: (THREE.Vector3 | null)[];
  /** The current pose (world). */
  readonly pos: THREE.Vector3[];
  readonly rot: THREE.Quaternion[];
  readonly meta: RigMeta;
  /** Blend helpers (skinning only; posed from the bones either side of their joint by `updateBlends`). */
  readonly blends: { k: number; from: number; to: number; t: number }[];

  constructor(meta: RigMeta) {
    this.meta = meta;
    this.names = meta.bones.map((b) => b.name);
    this.index = new Map(this.names.map((n, i) => [n, i]));
    this.parent = meta.bones.map((b) => (b.parent ? this.index.get(b.parent)! : -1));
    this.restPos = meta.bones.map((b) => v3(b.origin));
    this.restRot = meta.bones.map((b) => {
      const y = v3(b.y).normalize();
      const x = v3(b.x).addScaledVector(y, -v3(b.x).dot(y));
      if (x.lengthSq() < 1e-6) x.set(0, 0, 1).addScaledVector(y, -y.z);
      x.normalize();
      const z = new THREE.Vector3().crossVectors(x, y).normalize();
      return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    });
    this.offset = this.names.map((_, i) => {
      const p = this.parent[i]!;
      return p < 0 ? new THREE.Vector3() : this.restPos[i]!.clone().sub(this.restPos[p]!).applyQuaternion(this.restRot[p]!.clone().invert());
    });
    this.restLocal = this.names.map((_, i) => {
      const p = this.parent[i]!;
      return p < 0 ? this.restRot[i]!.clone() : this.restRot[p]!.clone().invert().multiply(this.restRot[i]!);
    });
    this.hingeLocal = meta.bones.map((b, i) => {
      const p = this.parent[i]!;
      return b.hinge && p >= 0 ? v3(b.hinge).normalize().applyQuaternion(this.restRot[p]!.clone().invert()) : null;
    });
    this.pos = this.restPos.map((p) => p.clone());
    this.rot = this.restRot.map((q) => q.clone());
    this.blends = meta.bones.flatMap((b, k) => (b.blend ? [{ k, from: this.index.get(b.blend.from)!, to: this.index.get(b.blend.to)!, t: b.blend.t }] : []));
  }

  /** Poses the blend helpers: each turns its share of the way between the bones either side of its joint, about that
   *  joint. The turn between them is split into the swing of the lower bone's axis and its twist about that axis, each
   *  shared out separately, so an arm overhead and turned out (a turn of near 180° all told) never flips a helper the
   *  other way round. */
  updateBlends(): void {
    const a = new THREE.Quaternion(), b = new THREE.Quaternion(), inv = new THREE.Quaternion();
    const swing = new THREE.Quaternion(), twist = new THREE.Quaternion(), id = new THREE.Quaternion();
    const axis = new THREE.Vector3(), v = new THREE.Vector3();
    for (const h of this.blends) {
      a.copy(this.rot[h.from]!).multiply(inv.copy(this.restRot[h.from]!).invert());
      b.copy(this.rot[h.to]!).multiply(inv.copy(this.restRot[h.to]!).invert());
      // r = a⁻¹ b (the lower bone's turn relative to the upper's), as swing · twist about the lower bone's rest axis.
      const r = inv.copy(a).invert().multiply(b);
      axis.set(0, 1, 0).applyQuaternion(this.restRot[h.to]!);
      v.set(r.x, r.y, r.z);
      const p = axis.dot(v);
      twist.set(axis.x * p, axis.y * p, axis.z * p, r.w);
      if (twist.lengthSq() < 1e-12) twist.identity();
      else twist.normalize();
      if (twist.w < 0) twist.set(-twist.x, -twist.y, -twist.z, -twist.w);
      swing.copy(r).multiply(id.copy(twist).invert());
      if (swing.w < 0) swing.set(-swing.x, -swing.y, -swing.z, -swing.w);
      const part = id.identity().slerp(swing, h.t).multiply(new THREE.Quaternion().slerp(twist, h.t));
      this.rot[h.k]!.copy(a).multiply(part).multiply(this.restRot[h.k]!);
      this.pos[h.k]!.copy(this.pos[h.to]!);
    }
  }

  i(name: string): number {
    const k = this.index.get(name);
    if (k === undefined) throw new Error(`no bone ${name}`);
    return k;
  }

  /** Back to the rest pose. */
  reset(): void {
    this.restPos.forEach((p, k) => this.pos[k]!.copy(p));
    this.restRot.forEach((q, k) => this.rot[k]!.copy(q));
  }

  /** Puts a bone at its joint on the parent (from the parent's current pose). */
  place(k: number): THREE.Vector3 {
    const p = this.parent[k]!;
    if (p >= 0) this.pos[k]!.copy(this.offset[k]!).applyQuaternion(this.rot[p]!).add(this.pos[p]!);
    return this.pos[k]!;
  }

  /** The rotation a bone has when it keeps its rest relation to its parent's current pose. */
  carried(k: number, out = new THREE.Quaternion()): THREE.Quaternion {
    const p = this.parent[k]!;
    return p < 0 ? out.copy(this.restRot[k]!) : out.copy(this.rot[p]!).multiply(this.restLocal[k]!);
  }

  /** Sets a bone's rotation to its carried rotation turned by `delta` (world) and places it. */
  turn(k: number, delta: THREE.Quaternion): void {
    this.carried(k, this.rot[k]!).premultiply(delta);
    this.place(k);
  }

  /** Places and orients every bone in the subtree below `k` (inclusive) as carried by its parent (no own motion). */
  carryTree(k: number): void {
    this.place(k);
    if (this.parent[k]! >= 0) this.carried(k, this.rot[k]!);
    for (let c = k + 1; c < this.names.length; c++) {
      if (!this.isBelow(c, k)) continue;
      this.place(c);
      this.carried(c, this.rot[c]!);
    }
  }

  isBelow(c: number, k: number): boolean {
    let p = this.parent[c]!;
    while (p >= 0) {
      if (p === k) return true;
      p = this.parent[p]!;
    }
    return false;
  }

  /** The bone's rotation relative to its rest relation with the parent (for joint limits and checks). */
  local(k: number, out = new THREE.Quaternion()): THREE.Quaternion {
    return this.carried(k, out).invert().premultiply(this.rot[k]!);
  }

  /** A direction given in a bone's rest frame, in the world now. */
  dir(k: number, restWorldDir: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(restWorldDir).applyQuaternion(this.restRot[k]!.clone().invert()).applyQuaternion(this.rot[k]!);
  }

  /** A point given in rest world coordinates on bone k, where it is now. */
  point(k: number, restWorld: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(restWorld).sub(this.restPos[k]!).applyQuaternion(this.restRot[k]!.clone().invert()).applyQuaternion(this.rot[k]!).add(this.pos[k]!);
  }

  /** Writes the pose into three.js bones (flat list, world matrices). */
  write(bones: THREE.Bone[]): void {
    const one = new THREE.Vector3(1, 1, 1);
    bones.forEach((b, k) => {
      b.matrix.compose(this.pos[k]!, this.rot[k]!, one);
      b.matrixWorld.copy(b.matrix);
    });
  }

  /** three.js bones and skeleton bound at the rest pose. */
  makeThree(): { bones: THREE.Bone[]; skeleton: THREE.Skeleton } {
    const one = new THREE.Vector3(1, 1, 1);
    const bones = this.names.map((n, k) => {
      const b = new THREE.Bone();
      b.name = n;
      b.matrixAutoUpdate = false;
      b.matrix.compose(this.restPos[k]!, this.restRot[k]!, one);
      b.matrixWorld.copy(b.matrix);
      return b;
    });
    const inverses = this.names.map((_, k) => new THREE.Matrix4().compose(this.restPos[k]!, this.restRot[k]!, one).invert());
    return { bones, skeleton: new THREE.Skeleton(bones, inverses) };
  }

  /** The rig frame from the file's frame (metres, facing +Z) as a matrix. */
  fileToRig(): THREE.Matrix4 {
    const { scale: s, offset: o } = this.meta.frame;
    return new THREE.Matrix4().set(0, 0, s, o[0], 0, s, 0, o[1], -s, 0, 0, o[2], 0, 0, 0, 1);
  }
}
