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
 * (positions linearly, rotations by slerp), looping.
 *
 * Binary layout (little-endian): "NGB1", u32 header length, header JSON, padding to 4 bytes, then per frame the bones
 * (Int16: position in 1/20 cm, then rotation x, y, z, w in 1/32767) and the pieces (Float32: position, quaternion,
 * inner state).
 */
export interface Baked {
  slug: string;
  duration: number;
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

/** Solves the performer over one loop at `fps` frames a second, once its loops repeat (see settle). */
export function bake(slug: string, perf: Performer, sk: Skeleton3, fps = 30): Baked & { settled: number } {
  const T = perf.duration;
  const n = Math.max(8, Math.round(T * fps));
  const settled = settle(perf, sk, n);
  const B = sk.names.length;
  const pieces = perf.pieces.map((p) => ({ kind: p.kind, inner: p.inner?.get().length ?? 0 }));
  const W = gearWidth(pieces);
  const pose = new Float32Array(n * B * 7);
  const gear = new Float32Array(n * W);
  for (let f = 0; f < n; f++) {
    perf.pose((f / n) * T);
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
  for (let f = 1; f < n; f++)
    for (let b = 0; b < B; b++) {
      const o = (f * B + b) * 7 + 3, p = ((f - 1) * B + b) * 7 + 3;
      if (pose[o]! * pose[p]! + pose[o + 1]! * pose[p + 1]! + pose[o + 2]! * pose[p + 2]! + pose[o + 3]! * pose[p + 3]! < 0)
        for (let k = 0; k < 4; k++) pose[o + k] = -pose[o + k]!;
    }
  return { slug, duration: T, frames: n, bones: B, pieces, pose, gear, settled };
}

export function encodeBaked(b: Baked): Uint8Array {
  const header = new TextEncoder().encode(JSON.stringify({ v: 1, slug: b.slug, duration: b.duration, frames: b.frames, bones: b.bones, pieces: b.pieces }));
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
  const h = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + len))) as Omit<Baked, "pose" | "gear">;
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

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3();

/** Sets the skeleton and the pieces to the baked motion at time t (looping), interpolating between frames. */
export function playBaked(b: Baked, t: number, sk: Skeleton3, pieces: Piece[]): void {
  const T = b.duration;
  const x = ((((t % T) + T) % T) / T) * b.frames;
  const f0 = Math.floor(x) % b.frames, f1 = (f0 + 1) % b.frames, u = x - Math.floor(x);
  const B = b.bones;
  for (let k = 0; k < B; k++) {
    const o0 = (f0 * B + k) * 7, o1 = (f1 * B + k) * 7;
    sk.pos[k]!.copy(va.fromArray(b.pose, o0).lerp(vb.fromArray(b.pose, o1), u));
    qa.fromArray(b.pose, o0 + 3);
    qb.fromArray(b.pose, o1 + 3);
    sk.rot[k]!.copy(qa.slerp(qb, u).normalize());
  }
  const W = gearWidth(b.pieces);
  let o = 0;
  b.pieces.forEach((p, k) => {
    const piece = pieces[k];
    const a = f0 * W + o, c = f1 * W + o;
    if (piece) {
      va.fromArray(b.gear, a).lerp(vb.fromArray(b.gear, c), u);
      qa.fromArray(b.gear, a + 3);
      qb.fromArray(b.gear, c + 3);
      piece.place(va, qa.slerp(qb, u).normalize());
      if (p.inner && piece.inner) {
        const v: number[] = [];
        for (let i = 0; i < p.inner; i++) v.push(b.gear[a + 7 + i]! + (b.gear[c + 7 + i]! - b.gear[a + 7 + i]!) * u);
        piece.inner.set(v);
      }
      piece.obj.updateMatrixWorld(true);
    }
    o += 7 + p.inner;
  });
}
