/**
 * Skin weights for the original Écorché file (public/anatomy/ecorche.glb), so the player can move the model itself in
 * the exercises instead of a rebuilt copy. The weights come from the rigged copy of the same model
 * (public/anatomy/athlete-raw, with its per-limb weights and the hip bones that follow the glutes): every vertex of
 * the original file takes the weights of the same point in the copy. The copy is the file under one similarity
 * transform (scale, rotation, offset into the rig's frame), which is fitted here (affine least squares, iterated on
 * nearest points from a bounding-box start) and stored with the weights.
 *
 *   npx tsx scripts/anatomy/build-ecorche-skin.mts
 *
 * Writes public/anatomy/ecorche-skin.json (transform, joints, per-mesh vertex ranges) and ecorche-skin.bin (four bone
 * indices and four weights, one byte each, per vertex of each mesh in the file's order).
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";

const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
const buf = readFileSync("public/anatomy/ecorche.glb");
const gltf = await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, "");
gltf.scene.updateMatrixWorld(true);

// The original file's vertices, in its world frame (metres), mesh by mesh in traversal order.
const meshes: { name: string; count: number; world: Float32Array }[] = [];
gltf.scene.traverse((o) => {
  if (!(o instanceof THREE.Mesh)) return;
  const p = o.geometry.getAttribute("position");
  const world = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
    world.set([v.x, v.y, v.z], i * 3);
  }
  meshes.push({ name: o.name, count: p.count, world });
});
const NG = meshes.reduce((s, m) => s + m.count, 0);
const G = new Float32Array(NG * 3);
{
  let o = 0;
  for (const m of meshes) {
    G.set(m.world, o);
    o += m.world.length;
  }
}

// The rigged copy.
const meta = JSON.parse(readFileSync("public/anatomy/athlete-raw.json", "utf8"));
const bin = readFileSync("public/anatomy/athlete-raw.bin");
const view = <T,>(name: string, T: new (b: ArrayBuffer, o: number, l: number) => T) => {
  const l = meta.layout[name];
  return new T(bin.buffer as ArrayBuffer, bin.byteOffset + l.offset, l.length);
};
const A = view("position", Float32Array);
const skinIndex = view("skinIndex", Uint8Array);
const skinWeight = view("skinWeight", Uint8Array);
const NA = A.length / 3;

// Nearest-point lookup in the copy (1 cm grid).
const CELL = 1;
const grid = new Map<string, number[]>();
const key = (x: number, y: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
for (let i = 0; i < NA; i++) {
  const k = key(A[i * 3]!, A[i * 3 + 1]!, A[i * 3 + 2]!);
  (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
}
const nearest = (x: number, y: number, z: number, reach = 2): [number, number] => {
  let best = -1, bd = Infinity;
  const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL), ck = Math.floor(z / CELL);
  for (let r = 0; r <= reach && best < 0; r++)
    for (let i = -r; i <= r; i++)
      for (let j = -r; j <= r; j++)
        for (let k = -r; k <= r; k++)
          for (const u of grid.get(`${ci + i},${cj + j},${ck + k}`) ?? []) {
            const d = (A[u * 3]! - x) ** 2 + (A[u * 3 + 1]! - y) ** 2 + (A[u * 3 + 2]! - z) ** 2;
            if (d < bd) {
              bd = d;
              best = u;
            }
          }
  return [best, Math.sqrt(bd)];
};

// Start: the rig's frame is the file's turned a quarter (rig (x, y, z) = file (z, y, -x)) and scaled to the copy's
// height, centres matched.
const bbox = (P: Float32Array) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k]!, P[i + k]!);
    hi[k] = Math.max(hi[k]!, P[i + k]!);
  }
  return { lo, hi, c: lo.map((v, k) => (v + hi[k]!) / 2) };
};
const bg = bbox(G), ba = bbox(A);
const k0 = (ba.hi[1]! - ba.lo[1]!) / (bg.hi[1]! - bg.lo[1]!);
// M: 3x4 affine, file → rig.
let M = [
  [0, 0, k0, ba.c[0]! - k0 * bg.c[2]!],
  [0, k0, 0, ba.c[1]! - k0 * bg.c[1]!],
  [-k0, 0, 0, ba.c[2]! + k0 * bg.c[0]!],
];
const apply = (m: number[][], x: number, y: number, z: number) => m.map((r) => r[0]! * x + r[1]! * y + r[2]! * z + r[3]!);
/** Least-squares affine map from pairs (p → q). */
const fitAffine = (P: number[][], Q: number[][]) => {
  const N = Array.from({ length: 4 }, () => new Array(4).fill(0));
  const B = Array.from({ length: 4 }, () => new Array(3).fill(0));
  for (let n = 0; n < P.length; n++) {
    const h = [...P[n]!, 1];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) N[i]![j]! += h[i]! * h[j]!;
      for (let c = 0; c < 3; c++) B[i]![c]! += h[i]! * Q[n]![c]!;
    }
  }
  // Solve N X = B (Gauss-Jordan).
  const aug = N.map((r, i) => [...r, ...B[i]!]);
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(aug[r]![c]!) > Math.abs(aug[p]![c]!)) p = r;
    [aug[c], aug[p]] = [aug[p]!, aug[c]!];
    const d = aug[c]![c]!;
    for (let j = 0; j < 7; j++) aug[c]![j]! /= d;
    for (let r = 0; r < 4; r++) if (r !== c) {
      const f = aug[r]![c]!;
      for (let j = 0; j < 7; j++) aug[r]![j]! -= f * aug[c]![j]!;
    }
  }
  return [0, 1, 2].map((c) => [aug[0]![4 + c]!, aug[1]![4 + c]!, aug[2]![4 + c]!, aug[3]![4 + c]!]);
};
const step = Math.max(1, Math.floor(NG / 30000));
for (let it = 0; it < 18; it++) {
  const P: number[][] = [], Q: number[][] = [];
  let sum = 0;
  for (let i = 0; i < NG; i += step) {
    const q = apply(M, G[i * 3]!, G[i * 3 + 1]!, G[i * 3 + 2]!);
    const [u, d] = nearest(q[0]!, q[1]!, q[2]!, 6);
    if (u < 0) continue;
    sum += d;
    P.push([G[i * 3]!, G[i * 3 + 1]!, G[i * 3 + 2]!]);
    Q.push([A[u * 3]!, A[u * 3 + 1]!, A[u * 3 + 2]!]);
  }
  M = fitAffine(P, Q);
  console.log(`fit ${it}: mean nearest distance ${(sum / P.length).toFixed(4)} cm over ${P.length} points`);
}

// Every vertex of the file takes the weights of its point in the copy.
const out = new Uint8Array(NG * 8);
const dist: number[] = [];
let far = 0;
for (let i = 0; i < NG; i++) {
  const q = apply(M, G[i * 3]!, G[i * 3 + 1]!, G[i * 3 + 2]!);
  const [u, d] = nearest(q[0]!, q[1]!, q[2]!, 4);
  if (d > 0.3) far++;
  dist.push(d);
  for (let s = 0; s < 4; s++) {
    out[i * 8 + s] = skinIndex[u * 4 + s]!;
    out[i * 8 + 4 + s] = skinWeight[u * 4 + s]!;
  }
}
dist.sort((a, b) => a - b);
console.log(`weights: ${NG} vertices; distance to the copy: median ${dist[NG >> 1]!.toFixed(4)} cm, 99.9% ${dist[Math.floor(NG * 0.999)]!.toFixed(3)} cm, max ${dist[NG - 1]!.toFixed(3)} cm; ${far} over 3 mm`);

writeFileSync("public/anatomy/ecorche-skin.bin", out);
let offset = 0;
writeFileSync(
  "public/anatomy/ecorche-skin.json",
  JSON.stringify({
    source: "Skin weights for public/anatomy/ecorche.glb, taken from the rigged copy public/anatomy/athlete-raw (scripts/anatomy/build-ecorche-skin.mts)",
    // Row-major 3x4: rig frame (cm, +X forward, +Z right) = M · file frame (m, facing +Z).
    toRig: M.map((r) => r.map((v) => +v.toFixed(7))),
    bind: meta.bind,
    vertices: NG,
    meshes: meshes.map((m) => {
      const e = { name: m.name, offset, count: m.count };
      offset += m.count;
      return e;
    }),
  }),
);
console.log(`wrote public/anatomy/ecorche-skin.bin (${(out.length / 1e6).toFixed(2)} MB) and ecorche-skin.json`);
