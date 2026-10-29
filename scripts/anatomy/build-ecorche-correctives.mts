/**
 * Pose-space corrective shapes for the shoulders and hips (src/lib/anatomy3d/body/correctives.ts):
 *
 *   npx tsx scripts/anatomy/build-ecorche-correctives.mts [--k 4] [--iter 20] [--sigma 0.6] [--samples 10] [--min 0.05]
 *                                                          [--out public/anatomy/ecorche-correctives]
 *
 * Why: skinning alone folds the muscles that cross a joint turned as far as the shoulder overhead (the push press, the
 * overhead triceps extension) or the hip at a rowing catch and a sumo pull: the lats and teres, the adductors and
 * gracilis stretch into bands or collapse where their weights pass from one bone to the other (the QA's stretch and
 * collapse checks fail at 2-5% of their surface).
 *
 * How: for each region (right and left shoulder: the humerus against the thorax; right and left hip: the thigh against
 * the pelvis) the exercises that take the joint furthest are posed at evenly spaced moments, and the joint's turn at
 * each is a candidate pose; the most different ones (farthest-point, by the angle between turns) are kept as the
 * samples. At each sample the region's muscles are skinned as the viewer skins them, relaxed by delta mush (the
 * surface smoothed, the rest pose's detail laid back on in the smoothed surface's own frame), and the difference is
 * taken back into the rest pose through each vertex's own skinning (the inverse of its blended transform), so adding
 * it to the rest position before skinning gives the relaxed surface. The differences over the samples are reduced to K
 * shapes per region (principal components); radial basis weights over the samples reproduce each sample's shape at
 * its pose and fade to nothing far from all of them.
 *
 * Writes <out>.json (regions, samples, weights, rows per mesh, scale) and <out>.bin (rows: vertex, region, K offsets
 * as int16), the format Correctives reads. Prints the stretch and collapse share of each region's parts at each
 * sample, skinned and corrected, so the gain can be seen before the QA runs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Skeleton3, type RigMeta } from "../../src/lib/anatomy3d/body/skeleton";
import { dqOf, dqSkin, lbsSkin } from "../../src/lib/anatomy3d/body/dqs";
import type { CorrectiveMeta, CorrectiveRegion } from "../../src/lib/anatomy3d/body/correctives";
import { makePerformer, type Performer } from "../../src/lib/anatomy3d/motion3d/perform";
import { specFor } from "../../src/lib/anatomy3d/motion3d/specs";
import { EXERCISES } from "../../src/data/exercises";

const args = process.argv.slice(2);
const opt = (name: string, d: string) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return d;
  const v = args[i + 1]!;
  args.splice(i, 2);
  return v;
};
const K = Number(opt("k", "4"));
const ITER = Number(opt("iter", "20"));
const SIGMA = Number(opt("sigma", "0.6"));
const MAX_SAMPLES = Number(opt("samples", "10"));
const MIN_MOVE = Number(opt("min", "0.05"));
/** A correction further than this (cm) is not a correction: a vertex with no bone of its own. */
const MAX_MOVE = Number(opt("max", "8"));
const OUT = opt("out", "public/anatomy/ecorche-correctives");
const MOMENTS = 12;
const MIN_SEP = (10 * Math.PI) / 180;

// Only the band muscles the checks fail: relaxing the compact muscles round the joint (teres minor, infraspinatus,
// supraspinatus, the deltoid, adductor brevis, pectineus) made them worse, so they keep their skinning.
// `zero`: exercises whose poses are sampled with no correction (the relaxation made them worse: the arm straight up
// with the elbow bent behind the head stretches the teres major between its attachments, which no smoothing shortens),
// so the shapes of nearby poses do not bleed into them.
const REGIONS: { name: string; base: string; bone: string; side: "R" | "L"; parts: RegExp; exercises: string[]; zero?: string[] }[] = [
  { name: "shoulderR", base: "thorax2", bone: "humerusR", side: "R", parts: /latissimus|teres_major/i, exercises: ["push-press", "lateral-raise", "cable-woodchop"], zero: ["overhead-triceps-extension"] },
  { name: "shoulderL", base: "thorax2", bone: "humerusL", side: "L", parts: /latissimus|teres_major/i, exercises: ["push-press", "lateral-raise", "cable-woodchop"], zero: ["overhead-triceps-extension"] },
  { name: "hipR", base: "pelvis", bone: "thighR", side: "R", parts: /adductor_(magnus|longus|minimus)/i, exercises: ["rowing-intervals", "sumo-deadlift", "kettlebell-swing"] },
  { name: "hipL", base: "pelvis", bone: "thighL", side: "L", parts: /adductor_(magnus|longus|minimus)/i, exercises: ["rowing-intervals", "sumo-deadlift", "kettlebell-swing"] },
];
const sideOf = (name: string): "R" | "L" | null => (/right/i.test(name) ? "R" : /left/i.test(name) ? "L" : null);

// ---------------------------------------------------------------- the model, the rig, the parts

const glb = readFileSync("public/anatomy/ecorche.glb");
const gltf = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer, "");
gltf.scene.updateMatrixWorld(true);
const meta: RigMeta = JSON.parse(readFileSync("public/anatomy/ecorche-rig.json", "utf8"));
const bin = new Uint8Array(readFileSync("public/anatomy/ecorche-rig.bin"));
const sk = new Skeleton3(meta);
const f2r = sk.fileToRig();

interface Part {
  name: string;
  mesh: number;
  rest: Float32Array;
  idx: Uint8Array;
  wt: Float32Array;
  tris: Uint32Array;
  linear: boolean;
}
const parts: Part[] = [];
{
  let k = 0;
  gltf.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mesh = k++;
    const e = meta.meshes[mesh]!;
    const p = o.geometry.getAttribute("position");
    const m = f2r.clone().multiply(o.matrixWorld);
    const rest = new Float32Array(p.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      rest.set([v.x, v.y, v.z], i * 3);
    }
    const idx = new Uint8Array(p.count * 4), wt = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++)
      for (let c = 0; c < 4; c++) {
        idx[i * 4 + c] = bin[(e.offset + i) * 8 + c]!;
        wt[i * 4 + c] = bin[(e.offset + i) * 8 + 4 + c]! / 255;
      }
    const tris = o.geometry.index ? Uint32Array.from(o.geometry.index.array) : Uint32Array.from({ length: p.count }, (_, i) => i);
    parts.push({ name: o.name, mesh, rest, idx, wt, tris, linear: !!e.linear });
  });
}

// ---------------------------------------------------------------- skinning and its inverse, per sample pose

interface PoseXf {
  mats: number[][];
  dqs: { r: number[]; d: number[] }[];
}
function poseTransforms(): PoseXf {
  const mats = sk.names.map((_, b) => new THREE.Matrix4().compose(sk.pos[b]!, sk.rot[b]!, new THREE.Vector3(1, 1, 1)).multiply(new THREE.Matrix4().compose(sk.restPos[b]!, sk.restRot[b]!, new THREE.Vector3(1, 1, 1)).invert()).elements as number[]);
  return { mats, dqs: mats.map((e) => dqOf(e)) };
}
/** The vertex's blended transform as a matrix (its skinning, exactly: the blended dual quaternion or the blended matrix). */
function blendedMatrix(xf: PoseXf, part: Part, v: number, out: THREE.Matrix4): THREE.Matrix4 {
  const idx = part.idx.subarray(v * 4, v * 4 + 4), wts = part.wt.subarray(v * 4, v * 4 + 4);
  if (part.linear) {
    const e = new Array<number>(16).fill(0);
    for (let k = 0; k < 4; k++) {
      const w = wts[k]!;
      if (!w) continue;
      const m = xf.mats[idx[k]!]!;
      for (let i = 0; i < 16; i++) e[i] += w * m[i]!;
    }
    return out.fromArray(e);
  }
  const r = [0, 0, 0, 0], d = [0, 0, 0, 0];
  const ref = xf.dqs[idx[0]!]!.r;
  for (let k = 0; k < 4; k++) {
    let w = wts[k]!;
    if (!w) continue;
    const q = xf.dqs[idx[k]!]!;
    if (q.r[0]! * ref[0]! + q.r[1]! * ref[1]! + q.r[2]! * ref[2]! + q.r[3]! * ref[3]! < 0) w = -w;
    for (let c = 0; c < 4; c++) {
      r[c]! += w * q.r[c]!;
      d[c]! += w * q.d[c]!;
    }
  }
  const len = Math.hypot(r[0]!, r[1]!, r[2]!, r[3]!) || 1;
  for (let c = 0; c < 4; c++) {
    r[c]! /= len;
    d[c]! /= len;
  }
  const [x, y, z, w] = r as [number, number, number, number];
  const [dx, dy, dz, dw] = d as [number, number, number, number];
  const t = new THREE.Vector3(2 * (w * dx - dw * x + (y * dz - z * dy)), 2 * (w * dy - dw * y + (z * dx - x * dz)), 2 * (w * dz - dw * z + (x * dy - y * dx)));
  return out.compose(t, new THREE.Quaternion(x, y, z, w), new THREE.Vector3(1, 1, 1));
}
function skinPart(xf: PoseXf, part: Part, offsets?: Float32Array): Float32Array {
  const N = part.rest.length / 3, now = new Float32Array(N * 3);
  const out: [number, number, number] = [0, 0, 0];
  for (let v = 0; v < N; v++) {
    const p: [number, number, number] = [part.rest[v * 3]! + (offsets?.[v * 3] ?? 0), part.rest[v * 3 + 1]! + (offsets?.[v * 3 + 1] ?? 0), part.rest[v * 3 + 2]! + (offsets?.[v * 3 + 2] ?? 0)];
    (part.linear ? lbsSkin : dqSkin)((part.linear ? xf.mats : xf.dqs) as never, part.idx.subarray(v * 4, v * 4 + 4), part.wt.subarray(v * 4, v * 4 + 4), p, out);
    now.set(out, v * 3);
  }
  return now;
}

// ---------------------------------------------------------------- delta mush (per part, welded)

interface Mesh {
  node: Int32Array;
  M: number;
  nb: number[][];
  wt: Int32Array;
  R0: Float64Array;
  S0: Float64Array;
  F0: THREE.Matrix3[];
}
function weld(pos: Float32Array) {
  const N = pos.length / 3, key = new Map<string, number>(), node = new Int32Array(N);
  let M = 0;
  for (let i = 0; i < N; i++) {
    const k = `${Math.round(pos[i * 3]! * 1e3)},${Math.round(pos[i * 3 + 1]! * 1e3)},${Math.round(pos[i * 3 + 2]! * 1e3)}`;
    let n = key.get(k);
    if (n === undefined) {
      n = M++;
      key.set(k, n);
    }
    node[i] = n;
  }
  return { node, M };
}
function smooth(x: Float64Array, nb: number[][], it: number) {
  const M = nb.length, y = new Float64Array(x.length);
  for (let r = 0; r < it; r++) {
    for (let i = 0; i < M; i++) {
      const n = nb[i]!;
      if (!n.length) {
        y[i * 3] = x[i * 3]!;
        y[i * 3 + 1] = x[i * 3 + 1]!;
        y[i * 3 + 2] = x[i * 3 + 2]!;
        continue;
      }
      let a = 0, b = 0, c = 0;
      for (const j of n) {
        a += x[j * 3]!;
        b += x[j * 3 + 1]!;
        c += x[j * 3 + 2]!;
      }
      const L = 0.5;
      y[i * 3] = (1 - L) * x[i * 3]! + (L * a) / n.length;
      y[i * 3 + 1] = (1 - L) * x[i * 3 + 1]! + (L * b) / n.length;
      y[i * 3 + 2] = (1 - L) * x[i * 3 + 2]! + (L * c) / n.length;
    }
    x.set(y);
  }
}
function frames(s: Float64Array, tris: Int32Array, nb: number[][]) {
  const M = nb.length, nrm = new Float64Array(M * 3);
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t]!, tris[t + 1]!, tris[t + 2]!];
    const ux = s[b * 3]! - s[a * 3]!, uy = s[b * 3 + 1]! - s[a * 3 + 1]!, uz = s[b * 3 + 2]! - s[a * 3 + 2]!;
    const vx = s[c * 3]! - s[a * 3]!, vy = s[c * 3 + 1]! - s[a * 3 + 1]!, vz = s[c * 3 + 2]! - s[a * 3 + 2]!;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      nrm[v * 3] += nx;
      nrm[v * 3 + 1] += ny;
      nrm[v * 3 + 2] += nz;
    }
  }
  const F: THREE.Matrix3[] = [];
  for (let i = 0; i < M; i++) {
    const n = new THREE.Vector3(nrm[i * 3]!, nrm[i * 3 + 1]!, nrm[i * 3 + 2]!);
    if (n.lengthSq() < 1e-12) n.set(0, 1, 0);
    n.normalize();
    const j = nb[i]![0] ?? i;
    const t = new THREE.Vector3(s[j * 3]! - s[i * 3]!, s[j * 3 + 1]! - s[i * 3 + 1]!, s[j * 3 + 2]! - s[i * 3 + 2]!);
    t.addScaledVector(n, -t.dot(n));
    if (t.lengthSq() < 1e-12) t.set(1, 0, 0).addScaledVector(n, -n.x);
    t.normalize();
    const b = new THREE.Vector3().crossVectors(n, t);
    F.push(new THREE.Matrix3().set(t.x, b.x, n.x, t.y, b.y, n.y, t.z, b.z, n.z));
  }
  return F;
}
function meshOf(part: Part): Mesh {
  const { node, M } = weld(part.rest);
  const nbS = Array.from({ length: M }, () => new Set<number>());
  const wt = new Int32Array(part.tris.length);
  for (let t = 0; t < part.tris.length; t++) wt[t] = node[part.tris[t]!]!;
  for (let t = 0; t < wt.length; t += 3)
    for (const [a, b] of [[wt[t]!, wt[t + 1]!], [wt[t + 1]!, wt[t + 2]!], [wt[t + 2]!, wt[t]!]] as [number, number][])
      if (a !== b) {
        nbS[a]!.add(b);
        nbS[b]!.add(a);
      }
  const nb = nbS.map((s) => [...s]);
  const R0 = average(part.rest, node, M);
  const S0 = R0.slice();
  smooth(S0, nb, ITER);
  return { node, M, nb, wt, R0, S0, F0: frames(S0, wt, nb) };
}
function average(src: Float32Array, node: Int32Array, M: number) {
  const x = new Float64Array(M * 3), cnt = new Int32Array(M), N = src.length / 3;
  for (let i = 0; i < N; i++) {
    const n = node[i]!;
    x[n * 3] += src[i * 3]!;
    x[n * 3 + 1] += src[i * 3 + 1]!;
    x[n * 3 + 2] += src[i * 3 + 2]!;
    cnt[n]++;
  }
  for (let n = 0; n < M; n++) for (let c = 0; c < 3; c++) x[n * 3 + c] /= cnt[n] || 1;
  return x;
}
/** The relaxed surface for a skinned pose: smoothed, with the rest pose's detail laid back on. */
function mush(part: Part, m: Mesh, now: Float32Array): Float32Array {
  const N = part.rest.length / 3;
  const S1 = average(now, m.node, m.M);
  smooth(S1, m.nb, ITER);
  const F1 = frames(S1, m.wt, m.nb);
  const out = new Float32Array(N * 3);
  const d = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const n = m.node[i]!;
    d.set(part.rest[i * 3]! - m.S0[n * 3]!, part.rest[i * 3 + 1]! - m.S0[n * 3 + 1]!, part.rest[i * 3 + 2]! - m.S0[n * 3 + 2]!)
      .applyMatrix3(m.F0[n]!.clone().transpose())
      .applyMatrix3(F1[n]!);
    out.set([S1[n * 3]! + d.x, S1[n * 3 + 1]! + d.y, S1[n * 3 + 2]! + d.z], i * 3);
  }
  return out;
}
/** Share of a part's edges stretched (more than doubled, by over 1 cm) and collapsed (below a third, by over 1 cm). */
function share(p0: Float32Array, p1: Float32Array, tris: Uint32Array) {
  let total = 0, sp = 0, fo = 0;
  for (let t = 0; t < tris.length; t += 3)
    for (const [a, b] of [[tris[t]!, tris[t + 1]!], [tris[t + 1]!, tris[t + 2]!], [tris[t + 2]!, tris[t]!]] as [number, number][]) {
      const r0 = Math.hypot(p0[a * 3]! - p0[b * 3]!, p0[a * 3 + 1]! - p0[b * 3 + 1]!, p0[a * 3 + 2]! - p0[b * 3 + 2]!);
      const r1 = Math.hypot(p1[a * 3]! - p1[b * 3]!, p1[a * 3 + 1]! - p1[b * 3 + 1]!, p1[a * 3 + 2]! - p1[b * 3 + 2]!);
      total++;
      if (r1 > 2 * r0 && r1 - r0 > 1) sp++;
      if (r1 < r0 / 3 && r0 - r1 > 1) fo++;
    }
  return { stretch: (sp / total) * 100, collapse: (fo / total) * 100 };
}

/** Per vertex, the worst stretch or collapse ratio of its edges in the skinned pose (1 = as at rest). */
function badness(part: Part, now: Float32Array): Float32Array {
  const N = part.rest.length / 3, bad = new Float32Array(N).fill(1), tris = part.tris, p0 = part.rest;
  for (let t = 0; t < tris.length; t += 3)
    for (const [a, b] of [[tris[t]!, tris[t + 1]!], [tris[t + 1]!, tris[t + 2]!], [tris[t + 2]!, tris[t]!]] as [number, number][]) {
      const r0 = Math.hypot(p0[a * 3]! - p0[b * 3]!, p0[a * 3 + 1]! - p0[b * 3 + 1]!, p0[a * 3 + 2]! - p0[b * 3 + 2]!);
      const r1 = Math.hypot(now[a * 3]! - now[b * 3]!, now[a * 3 + 1]! - now[b * 3 + 1]!, now[a * 3 + 2]! - now[b * 3 + 2]!);
      if (Math.abs(r1 - r0) < 0.5 || r0 < 1e-6 || r1 < 1e-6) continue;
      const ratio = Math.max(r1 / r0, r0 / r1);
      if (ratio > bad[a]!) bad[a] = ratio;
      if (ratio > bad[b]!) bad[b] = ratio;
    }
  return bad;
}
/** Where the correction applies: full where edges stretch or collapse past 2.4×, nothing below 1.6×, grown by two
 *  rings and feathered, so only the folds are relaxed and the rest of the muscle keeps its skinning. */
function maskFor(part: Part, m: Mesh, now: Float32Array): Float32Array {
  const bad = badness(part, now), N = bad.length;
  const node = new Float64Array(m.M);
  for (let i = 0; i < N; i++) {
    const v = Math.min(1, Math.max(0, (bad[i]! - 1.6) / 0.8));
    if (v > node[m.node[i]!]!) node[m.node[i]!] = v;
  }
  for (let ring = 0; ring < 2; ring++) {
    const grown = node.slice();
    for (let n = 0; n < m.M; n++) for (const j of m.nb[n]!) if (node[j]! > grown[n]!) grown[n] = node[j]!;
    node.set(grown);
  }
  for (let it = 0; it < 3; it++) {
    const soft = node.slice();
    for (let n = 0; n < m.M; n++) {
      const nb = m.nb[n]!;
      if (!nb.length) continue;
      let a = node[n]!;
      for (const j of nb) a += node[j]!;
      soft[n] = a / (nb.length + 1);
    }
    node.set(soft);
  }
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = node[m.node[i]!]!;
  return out;
}

// ---------------------------------------------------------------- sample poses per region

const performers = new Map<string, Performer>();
function performer(slug: string): Performer {
  let p = performers.get(slug);
  if (!p) {
    const ex = EXERCISES.find((e) => e.slug === slug);
    if (!ex) throw new Error(`no exercise ${slug}`);
    p = makePerformer(sk, ex, specFor(slug));
    for (let i = 0; i < 24; i++) p.pose((i / 24) * p.duration);
    performers.set(slug, p);
  }
  return p;
}
/** The joint's turn: the bone's turn from rest, seen from the base's (as Correctives.update measures it). */
function jointTurn(base: string, bone: string): THREE.Quaternion {
  const b = sk.i(base), h = sk.i(bone);
  const baseQ = sk.rot[b]!.clone().multiply(sk.restRot[b]!.clone().invert());
  return sk.rot[h]!.clone().multiply(sk.restRot[h]!.clone().invert()).premultiply(baseQ.invert());
}
const angle = (a: THREE.Quaternion, b: THREE.Quaternion) => 2 * Math.acos(Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)));
interface Sample {
  q: THREE.Quaternion;
  slug: string | null;
  t: number;
}
function pickSamples(region: (typeof REGIONS)[number]): Sample[] {
  const candidates: Sample[] = [];
  for (const slug of [...region.exercises, ...(region.zero ?? [])]) {
    const p = performer(slug);
    for (let i = 0; i < MOMENTS; i++) {
      const t = (i / MOMENTS) * p.duration;
      p.pose(t);
      candidates.push({ q: jointTurn(region.base, region.bone), slug, t });
    }
  }
  const chosen: Sample[] = [{ q: new THREE.Quaternion(), slug: null, t: 0 }];
  for (;;) {
    let best: Sample | null = null, bestD = 0;
    for (const c of candidates) {
      const d = Math.min(...chosen.map((s) => angle(s.q, c.q)));
      if (d > bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best || bestD < MIN_SEP || chosen.length >= MAX_SAMPLES) break;
    chosen.push(best);
  }
  return chosen;
}

// ---------------------------------------------------------------- small linear algebra (S × S)

function jacobiEigen(A: number[][]): { values: number[]; vectors: number[][] } {
  const n = A.length;
  const a = A.map((r) => r.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i]![j]! ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p]![q]!) < 1e-15) continue;
        const theta = (a[q]![q]! - a[p]![p]!) / (2 * a[p]![q]!);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k]![p]!, akq = a[k]![q]!;
          a[k]![p] = c * akp - s * akq;
          a[k]![q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p]![k]!, aqk = a[q]![k]!;
          a[p]![k] = c * apk - s * aqk;
          a[q]![k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k]![p]!, vkq = V[k]![q]!;
          V[k]![p] = c * vkp - s * vkq;
          V[k]![q] = s * vkp + c * vkq;
        }
      }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[j]![j]! - a[i]![i]!);
  return { values: order.map((i) => a[i]![i]!), vectors: order.map((i) => V.map((row) => row[i]!)) };
}
/** Solves A X = B (A: n×n, B: n×m) by Gaussian elimination with partial pivoting and a small ridge. */
function solve(A: number[][], B: number[][]): number[][] {
  const n = A.length, m = B[0]!.length;
  const M = A.map((r, i) => [...r.map((v, j) => v + (i === j ? 1e-6 : 0)), ...B[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    [M[c], M[p]] = [M[p]!, M[c]!];
    const d = M[c]![c]!;
    for (let j = c; j < n + m; j++) M[c]![j]! /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]!;
      if (!f) continue;
      for (let j = c; j < n + m; j++) M[r]![j]! -= f * M[c]![j]!;
    }
  }
  return M.map((r) => r.slice(n));
}

// ---------------------------------------------------------------- build

interface Row {
  mesh: number;
  vertex: number;
  region: number;
  /** K offsets (x, y, z), cm, rig frame. */
  basis: number[];
}
const rows: Row[] = [];
const regionsOut: CorrectiveRegion[] = [];
const report: string[] = [];
REGIONS.forEach((region, ri) => {
  const regionParts = parts.filter((p) => region.parts.test(p.name) && sideOf(p.name) === region.side);
  const meshes = new Map(regionParts.map((p) => [p.name, meshOf(p)]));
  const samples = pickSamples(region);
  const V = regionParts.reduce((s, p) => s + p.rest.length / 3, 0);
  console.log(`${region.name}: ${regionParts.length} parts, ${V} vertices, ${samples.length} sample poses (${samples.slice(1).map((s) => `${s.slug}@${(s.t / performer(s.slug!).duration).toFixed(2)} ${((angle(s.q, samples[0]!.q) * 180) / Math.PI).toFixed(0)}°`).join(", ")})`);
  // Rest-space differences per sample (sample 0, the rest pose: zero).
  const D: Float32Array[] = samples.map(() => new Float32Array(V * 3));
  const inv = new THREE.Matrix4(), v = new THREE.Vector3();
  samples.forEach((s, si) => {
    if (si === 0) return;
    if (region.zero?.includes(s.slug!)) {
      console.log(`  ${s.slug}@${(s.t / performer(s.slug!).duration).toFixed(2)}: pinned to no correction`);
      return;
    }
    performer(s.slug!).pose(s.t);
    const xf = poseTransforms();
    let at = 0;
    const before = { stretch: 0, collapse: 0 }, after = { stretch: 0, collapse: 0 };
    let n = 0;
    for (const part of regionParts) {
      const N = part.rest.length / 3;
      const now = skinPart(xf, part);
      const mask = maskFor(part, meshes.get(part.name)!, now);
      let masked = 0;
      for (let i = 0; i < N; i++) if (mask[i]! > 0.01) masked++;
      const relaxed = now.slice();
      if (masked) {
        const full = mush(part, meshes.get(part.name)!, now);
        for (let i = 0; i < N * 3; i++) relaxed[i] = now[i]! + mask[i / 3 | 0]! * (full[i]! - now[i]!);
      }
      const d = D[si]!;
      for (let i = 0; i < N; i++) {
        // (A vertex with no weights, or one whose correction is absurd, is left as it is.)
        const wsum = part.wt[i * 4]! + part.wt[i * 4 + 1]! + part.wt[i * 4 + 2]! + part.wt[i * 4 + 3]!;
        if (wsum < 0.5) continue;
        blendedMatrix(xf, part, i, inv).invert();
        v.set(relaxed[i * 3]!, relaxed[i * 3 + 1]!, relaxed[i * 3 + 2]!).applyMatrix4(inv);
        const dx = v.x - part.rest[i * 3]!, dy = v.y - part.rest[i * 3 + 1]!, dz = v.z - part.rest[i * 3 + 2]!;
        if (!Number.isFinite(dx + dy + dz) || Math.hypot(dx, dy, dz) > MAX_MOVE) continue;
        d[(at + i) * 3] = dx;
        d[(at + i) * 3 + 1] = dy;
        d[(at + i) * 3 + 2] = dz;
      }
      // (The corrected surface as the viewer will make it: rest plus the difference, skinned.)
      const corrected = skinPart(xf, part, d.subarray(at * 3, (at + N) * 3));
      const b = share(part.rest, now, part.tris), a = share(part.rest, corrected, part.tris);
      before.stretch += b.stretch;
      before.collapse += b.collapse;
      after.stretch += a.stretch;
      after.collapse += a.collapse;
      n++;
      if (b.stretch > 1 || b.collapse > 1 || a.stretch > 1 || a.collapse > 1) report.push(`${region.name} ${s.slug}@${(s.t / performer(s.slug!).duration).toFixed(2)} ${part.name}: stretch ${b.stretch.toFixed(1)}% → ${a.stretch.toFixed(1)}%, collapse ${b.collapse.toFixed(1)}% → ${a.collapse.toFixed(1)}%`);
      at += N;
    }
    console.log(`  ${s.slug}@${(s.t / performer(s.slug!).duration).toFixed(2)}: mean stretch ${(before.stretch / n).toFixed(2)}% → ${(after.stretch / n).toFixed(2)}%, collapse ${(before.collapse / n).toFixed(2)}% → ${(after.collapse / n).toFixed(2)}%`);
  });
  // Principal components of the differences: the Gram matrix over samples.
  const S = samples.length;
  const G = Array.from({ length: S }, () => Array.from({ length: S }, () => 0));
  for (let i = 0; i < S; i++)
    for (let j = i; j < S; j++) {
      let s = 0;
      const a = D[i]!, b = D[j]!;
      for (let k = 0; k < a.length; k++) s += a[k]! * b[k]!;
      G[i]![j] = G[j]![i] = s;
    }
  const { values, vectors } = jacobiEigen(G);
  const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const kept = values.slice(0, K).reduce((a, b) => a + Math.max(0, b), 0);
  console.log(`  ${K} shapes keep ${((100 * kept) / total).toFixed(1)}% of the differences' energy`);
  // Shapes in cm: basis_k = Dᵀu_k (= sqrt(λ_k) times the unit component), so each sample's coefficient is u_ks (within
  // ±1) and Σ_k u_ks basis_k reproduces the sample's differences.
  const basis: Float32Array[] = [];
  const coef = Array.from({ length: S }, () => new Array<number>(K).fill(0));
  for (let k = 0; k < K; k++) {
    const u = vectors[k]!;
    const b = new Float32Array(V * 3);
    for (let s = 0; s < S; s++) {
      const w = u[s]!;
      if (!w) continue;
      const d = D[s]!;
      for (let i = 0; i < b.length; i++) b[i] += w * d[i]!;
    }
    basis.push(b);
    for (let s = 0; s < S; s++) coef[s]![k] = u[s]!;
  }
  // Radial basis weights: Φ W = C, exact at each sample.
  const Phi = samples.map((a) => samples.map((b) => Math.exp(-((angle(a.q, b.q) / SIGMA) ** 2))));
  const W = solve(Phi, coef);
  regionsOut.push({ name: region.name, base: region.base, bone: region.bone, sigma: SIGMA, samples: samples.map((s) => [s.q.x, s.q.y, s.q.z, s.q.w]), weights: W.flat() });
  // Rows: every vertex whose shapes move it at all.
  let at = 0;
  for (const part of regionParts) {
    const N = part.rest.length / 3;
    for (let i = 0; i < N; i++) {
      const b: number[] = [];
      let most = 0;
      for (let k = 0; k < K; k++) {
        const o = (at + i) * 3;
        b.push(basis[k]![o]!, basis[k]![o + 1]!, basis[k]![o + 2]!);
        most = Math.max(most, Math.hypot(basis[k]![o]!, basis[k]![o + 1]!, basis[k]![o + 2]!));
      }
      if (most >= MIN_MOVE) rows.push({ mesh: part.mesh, vertex: i, region: ri, basis: b });
    }
    at += N;
  }
});

// ---------------------------------------------------------------- write

rows.sort((a, b) => a.mesh - b.mesh || a.vertex - b.vertex);
const meshesOut: CorrectiveMeta["meshes"] = [];
rows.forEach((r, i) => {
  const last = meshesOut[meshesOut.length - 1];
  if (last && last.mesh === r.mesh) last.count++;
  else meshesOut.push({ mesh: r.mesh, offset: i, count: 1 });
});
let most = 0;
for (const r of rows) for (const x of r.basis) most = Math.max(most, Math.abs(x));
const scale = most / 32767 || 1;
const R = rows.length;
const pad = (4 - ((R * 5) % 4)) % 4;
const buf = new ArrayBuffer(R * 4 + R + pad + R * K * 3 * 2);
const vertex = new Uint32Array(buf, 0, R), region = new Uint8Array(buf, R * 4, R), q = new Int16Array(buf, R * 4 + R + pad, R * K * 3);
rows.forEach((r, i) => {
  vertex[i] = r.vertex;
  region[i] = r.region;
  r.basis.forEach((x, j) => (q[i * K * 3 + j] = Math.round(x / scale)));
});
const metaOut: CorrectiveMeta = { source: "scripts/anatomy/build-ecorche-correctives.mts", k: K, regions: regionsOut, meshes: meshesOut, rows: R, scale };
writeFileSync(`${OUT}.json`, JSON.stringify(metaOut));
writeFileSync(`${OUT}.bin`, new Uint8Array(buf));
console.log(`\n${OUT}.json/.bin: ${R} rows over ${meshesOut.length} parts, K=${K}, ${(buf.byteLength / 1024).toFixed(0)} KB (offsets up to ${most.toFixed(2)} cm)`);
console.log(`\nParts over 1% at a sample (skinned → corrected):\n${report.join("\n")}`);
