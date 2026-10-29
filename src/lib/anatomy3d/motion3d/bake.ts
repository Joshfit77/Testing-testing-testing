import * as THREE from "three";
import type { Skeleton3 } from "../body/skeleton";
import type { Piece } from "./apparatus";
import type { Performer } from "./perform";

/**
 * Baked motions: an exercise solved offline, frame by frame, so a phone only interpolates between stored poses instead
 * of solving the body (18-21 ms a frame on a desktop for an exercise that holds equipment, too slow for a phone).
 *
 * Per frame: every bone's position and rotation, and every piece's place and inner state (cable ends, a seat on its
 * rail, cranks; see Piece.inner). Played back, bones and pieces are interpolated between the two frames either side
 * (positions linearly, rotations by slerp), looping. The last frame is the loop's very end (not its start again), so an
 * exercise that travels (a carry, a sprint) walks on to the end of the loop and only then starts again, as it does live.
 *
 * Binary layout (little-endian): "NGB1", u32 header length, header JSON, padding to 4 bytes, then per frame the bones
 * (Int16: position in 1/20 cm, then rotation x, y, z, w in 1/32767) and the pieces (Float32: position, quaternion,
 * inner state).
 */
export interface Baked {
  slug: string;
  duration: number;
  /** Frames stored: the loop's intervals plus one (the loop's end). */
  frames: number;
  bones: number;
  /** Per piece: its kind and how many inner numbers it stores. */
  pieces: { kind: string; inner: number }[];
  /** frames × bones × 7 (x, y, z, qx, qy, qz, qw). */
  pose: Float32Array;
  /** frames × (Σ per piece: 7 + inner). */
  gear: Float32Array;
}

const POS = 20;
const ROT = 32767;

const gearWidth = (pieces: { inner: number }[]) => pieces.reduce((s, p) => s + 7 + p.inner, 0);

/**
 * Runs the performer over whole loops of `n` frames until one loop repeats the one before it (every bone within half a
 * degree; at most `max` loops). Each frame's solution continues from the frame before, so the first loop, which starts
 * from nothing, can settle the arms differently from the loops after it; a baked loop must be one that repeats, or the
 * player would jump where it wraps round. Returns the largest difference left between the last two loops (degrees).
 */
export function settle(perf: Performer, sk: Skeleton3, n: number, max = 6): number {
  const T = perf.duration;
  let prev: THREE.Quaternion[][] | null = null;
  let diff = Infinity;
  for (let loop = 0; loop < max; loop++) {
    const now: THREE.Quaternion[][] = [];
    for (let i = 0; i < n; i++) {
      perf.pose((i / n) * T);
      now.push(sk.rot.map((q) => q.clone()));
    }
    if (prev) {
      diff = 0;
      for (let i = 0; i < n; i++)
        for (let b = 0; b < now[i]!.length; b++) diff = Math.max(diff, (2 * Math.acos(Math.min(1, Math.abs(now[i]![b]!.dot(prev[i]![b]!))))) / (Math.PI / 180));
      if (diff < 0.5) break;
    }
    prev = now;
  }
  return diff;
}

/** Solves the performer over one loop at `fps` frames a second (the exercise's own rate unless given), once its loops
 *  repeat (see settle). */
export function bake(slug: string, perf: Performer, sk: Skeleton3, fps = perf.bakeFps): Baked & { settled: number } {
  const T = perf.duration;
  const n = Math.max(8, Math.round(T * fps));
  const settled = settle(perf, sk, n);
  const B = sk.names.length;
  const pieces = perf.pieces.map((p) => ({ kind: p.kind, inner: p.inner?.get().length ?? 0 }));
  const W = gearWidth(pieces);
  const frames = n + 1;
  const pose = new Float32Array(frames * B * 7);
  const gear = new Float32Array(frames * W);
  for (let f = 0; f < frames; f++) {
    // (The last frame a hair before the loop's end: the loop's end itself is its start.)
    perf.pose(f < n ? (f / n) * T : T * (1 - 1e-6));
    for (let b = 0; b < B; b++) {
      const o = (f * B + b) * 7;
      sk.pos[b]!.toArray(pose, o);
      sk.rot[b]!.toArray(pose, o + 3);
    }
    let o = f * W;
    perf.pieces.forEach((p, k) => {
      p.obj.position.toArray(gear, o);
      p.obj.quaternion.toArray(gear, o + 3);
      o += 7;
      const v = p.inner?.get() ?? [];
      for (let i = 0; i < pieces[k]!.inner; i++) gear[o + i] = v[i] ?? 0;
      o += pieces[k]!.inner;
    });
  }
  // (Each frame's rotations on the same side as the frame before, so interpolation never takes the long way round.)
  for (let f = 1; f < frames; f++)
    for (let b = 0; b < B; b++) {
      const o = (f * B + b) * 7 + 3, p = ((f - 1) * B + b) * 7 + 3;
      if (pose[o]! * pose[p]! + pose[o + 1]! * pose[p + 1]! + pose[o + 2]! * pose[p + 2]! + pose[o + 3]! * pose[p + 3]! < 0)
        for (let k = 0; k < 4; k++) pose[o + k] = -pose[o + k]!;
    }
  return { slug, duration: T, frames, bones: B, pieces, pose, gear, settled };
}

export function encodeBaked(b: Baked): Uint8Array {
  const header = new TextEncoder().encode(JSON.stringify({ v: 2, slug: b.slug, duration: b.duration, frames: b.frames, bones: b.bones, pieces: b.pieces }));
  const pad = (4 - ((8 + header.length) % 4)) % 4;
  const W = gearWidth(b.pieces);
  const size = 8 + header.length + pad + b.frames * b.bones * 7 * 2 + b.frames * W * 4;
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  out.set([78, 71, 66, 49], 0);
  dv.setUint32(4, header.length, true);
  out.set(header, 8);
  let o = 8 + header.length + pad;
  for (let i = 0; i < b.frames * b.bones; i++) {
    for (let k = 0; k < 3; k++, o += 2) dv.setInt16(o, Math.round(b.pose[i * 7 + k]! * POS), true);
    for (let k = 3; k < 7; k++, o += 2) dv.setInt16(o, Math.round(b.pose[i * 7 + k]! * ROT), true);
  }
  for (let i = 0; i < b.frames * W; i++, o += 4) dv.setFloat32(o, b.gear[i]!, true);
  return out;
}

export function decodeBaked(data: ArrayBuffer | Uint8Array): Baked {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "NGB1") throw new Error("not a baked motion");
  const len = dv.getUint32(4, true);
  const h = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + len))) as Omit<Baked, "pose" | "gear"> & { v: number };
  if (h.v !== 2) throw new Error(`baked motion version ${h.v}: re-bake (scripts/anatomy/bake-motions.mts)`);
  const pad = (4 - ((8 + len) % 4)) % 4;
  let o = 8 + len + pad;
  const pose = new Float32Array(h.frames * h.bones * 7);
  for (let i = 0; i < h.frames * h.bones; i++) {
    for (let k = 0; k < 3; k++, o += 2) pose[i * 7 + k] = dv.getInt16(o, true) / POS;
    for (let k = 3; k < 7; k++, o += 2) pose[i * 7 + k] = dv.getInt16(o, true) / ROT;
  }
  const W = gearWidth(h.pieces);
  const gear = new Float32Array(h.frames * W);
  for (let i = 0; i < h.frames * W; i++, o += 4) gear[i] = dv.getFloat32(o, true);
  return { ...h, pose, gear };
}

const va = new THREE.Vector3(), qa = new THREE.Quaternion();
const cv = [0, 0, 0, 0];

/** Catmull-Rom through four values at u (0..1 between the middle two): a curve through the frames, so fast arcs (a
 *  swing, a drive) are followed between frames rather than cut across. */
const catmull = (p0: number, p1: number, p2: number, p3: number, u: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);

/** Sets the skeleton and the pieces to the baked motion at time t (looping), on a curve through the frames either
 *  side (positions and rotations alike; rotations renormalised). */
export function playBaked(b: Baked, t: number, sk: Skeleton3, pieces: Piece[]): void {
  const T = b.duration;
  const n = b.frames - 1;
  const x = ((((t % T) + T) % T) / T) * n;
  const f1 = Math.min(n - 1, Math.floor(x)), f2 = f1 + 1, u = x - f1;
  // (At the loop's ends the curve leans on the end frame itself: a carry's walk does not wrap round to its start.)
  const f0 = Math.max(0, f1 - 1), f3 = Math.min(n, f2 + 1);
  const curve = (arr: Float32Array, stride: number, off: number, len: number, out: number[]) => {
    for (let i = 0; i < len; i++) out[i] = catmull(arr[f0 * stride + off + i]!, arr[f1 * stride + off + i]!, arr[f2 * stride + off + i]!, arr[f3 * stride + off + i]!, u);
  };
  const quat = (arr: Float32Array, stride: number, off: number) => {
    // (The four rotations on the same side as the second, so the curve takes the short way.)
    const ref = f1 * stride + off;
    const sign = (f: number) => {
      const o = f * stride + off;
      return arr[o]! * arr[ref]! + arr[o + 1]! * arr[ref + 1]! + arr[o + 2]! * arr[ref + 2]! + arr[o + 3]! * arr[ref + 3]! < 0 ? -1 : 1;
    };
    const s0 = sign(f0), s2 = sign(f2), s3 = sign(f3);
    for (let i = 0; i < 4; i++) cv[i] = catmull(s0 * arr[f0 * stride + off + i]!, arr[f1 * stride + off + i]!, s2 * arr[f2 * stride + off + i]!, s3 * arr[f3 * stride + off + i]!, u);
    return qa.set(cv[0]!, cv[1]!, cv[2]!, cv[3]!).normalize();
  };
  const B = b.bones;
  const p3: number[] = [0, 0, 0];
  for (let k = 0; k < B; k++) {
    curve(b.pose, B * 7, k * 7, 3, p3);
    sk.pos[k]!.set(p3[0]!, p3[1]!, p3[2]!);
    sk.rot[k]!.copy(quat(b.pose, B * 7, k * 7 + 3));
  }
  const W = gearWidth(b.pieces);
  let o = 0;
  b.pieces.forEach((p, k) => {
    const piece = pieces[k];
    if (piece) {
      curve(b.gear, W, o, 3, p3);
      piece.place(va.set(p3[0]!, p3[1]!, p3[2]!), quat(b.gear, W, o + 3));
      if (p.inner && piece.inner) {
        const v: number[] = new Array(p.inner);
        curve(b.gear, W, o + 7, p.inner, v);
        piece.inner.set(v);
      }
      piece.obj.updateMatrixWorld(true);
    }
    o += 7 + p.inner;
  });
}
