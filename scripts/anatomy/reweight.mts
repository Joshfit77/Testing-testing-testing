/**
 * Finishing pass on public/anatomy/athlete.bin, without rebuilding the mesh (seconds instead of minutes):
 *  - skin weights (scripts/anatomy/weights.ts); the fascia takes its weights from the muscles over it
 *  - baked ambient occlusion per vertex, so the grooves between muscles read as deep cuts in any light
 *
 *   npx tsx scripts/anatomy/reweight.mts                                   (public/anatomy/athlete)
 *   ATHLETE=public/anatomy/athlete-eco npx tsx scripts/anatomy/reweight.mts  (the Écorché-based build)
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { MeshoptSimplifier } from "meshoptimizer";
import { MeshBVH } from "three-mesh-bvh";
import { MEASURED_BIND } from "../../src/lib/anatomy3d/athlete-bind.generated";
import { BONES, muscleId, TISSUE } from "../../src/lib/anatomy3d/muscle-ids";
import { computeWeights } from "./weights";

type Layout = Record<string, { offset: number; length: number; type: string }>;
const ATHLETE = process.env.ATHLETE ?? "public/anatomy/athlete";
const meta = JSON.parse(readFileSync(`${ATHLETE}.json`, "utf8")) as { layout: Layout; bytes: number } & Record<string, unknown>;
let buf: Buffer = readFileSync(`${ATHLETE}.bin`);
const view = <T,>(name: string, T: new (b: ArrayBuffer, o: number, l: number) => T) => {
  const l = meta.layout[name]!;
  return new T(buf.buffer as ArrayBuffer, buf.byteOffset + l.offset, l.length);
};
const pos = view("position", Float32Array);
const idx = meta.layout.index!.type === "Uint32Array" ? view("index", Uint32Array) : view("index", Uint16Array);
const label = view("muscleA", Uint8Array);
const forced = meta.layout.forcedBone ? view("forcedBone", Uint8Array) : undefined;
const tissue = view("tissue", Uint8Array);
const NV0 = pos.length / 3;

const { skinIndex, skinWeight } = computeWeights(pos, idx, label, MEASURED_BIND, forced, tissue.map((t) => (t === TISSUE.cover ? 1 : 0)));

// The fascia follows the muscles over it: each takes the skin weights of the nearest muscle and
// tendon vertices (inverse-distance blend), so in a deep squat the layers bend together instead of crossing.
{
  const NB = BONES.length;
  const CELL = 2;
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
  for (let v = 0; v < NV0; v++) {
    if (tissue[v] !== TISSUE.muscle && tissue[v] !== TISSUE.tendon) continue;
    const k = key(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!);
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(v);
  }
  const K = 8, R = 4;
  const w = new Float32Array(NB);
  let moved = 0;
  for (let v = 0; v < NV0; v++) {
    if (tissue[v] !== TISSUE.deep) continue;
    if (forced && forced[v] !== 255) continue;
    const x = pos[v * 3]!, y = pos[v * 3 + 1]!, z = pos[v * 3 + 2]!;
    const near: [number, number][] = [];
    const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL), ck = Math.floor(z / CELL);
    for (let i = -R; i <= R; i++)
      for (let j = -R; j <= R; j++)
        for (let k = -R; k <= R; k++)
          for (const u of grid.get(`${ci + i},${cj + j},${ck + k}`) ?? [])
            near.push([Math.hypot(pos[u * 3]! - x, pos[u * 3 + 1]! - y, pos[u * 3 + 2]! - z), u]);
    if (!near.length) continue;
    near.sort((a, b) => a[0] - b[0]);
    w.fill(0);
    let tot = 0;
    for (const [d, u] of near.slice(0, K)) {
      const f = 1 / (d + 0.5) ** 2;
      tot += f;
      for (let s = 0; s < 4; s++) w[skinIndex[u * 4 + s]!]! += (f * skinWeight[u * 4 + s]!) / 255;
    }
    const top = Array.from(w, (x2, b) => [x2 / tot, b] as [number, number]).sort((a, b) => b[0] - a[0]).slice(0, 4);
    const sum = top.reduce((s, [x2]) => s + x2, 0) || 1;
    let acc = 0;
    top.forEach(([x2, b], i) => {
      skinIndex[v * 4 + i] = b;
      const q = i === 3 ? 255 - acc : Math.round((x2 / sum) * 255);
      skinWeight[v * 4 + i] = Math.max(0, q);
      acc += q;
    });
    moved++;
  }
  console.log(`fascia: ${moved} vertices take their weights from the muscles over them`);
}
// The latissimus dorsi runs from the pelvis and spine into the armpit, onto the humerus: when the arms rise (a bar on
// the back, a pull-up) it has to stretch evenly along its whole length. Its arm-to-torso weight change is spread over
// the entire muscle instead of a narrow band at the armpit, which tore into a long sliver.
{
  const NB = BONES.length;
  const lat = new Set([muscleId("lat", 0), muscleId("lat", 1)]);
  const nbrs = new Map<number, Set<number>>();
  for (let t = 0; t < idx.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = idx[t + k]!;
      if (!lat.has(label[a]!) || (forced && forced[a] !== 255)) continue;
      const set = nbrs.get(a) ?? nbrs.set(a, new Set()).get(a)!;
      for (let j = 1; j < 3; j++) set.add(idx[t + ((k + j) % 3)]!);
    }
  const W = new Map<number, Float32Array>();
  for (const v of nbrs.keys()) {
    const w = new Float32Array(NB);
    for (let j = 0; j < 4; j++) w[skinIndex[v * 4 + j]!]! += skinWeight[v * 4 + j]! / 255;
    W.set(v, w);
  }
  for (let it = 0; it < 30; it++) {
    const next = new Map<number, Float32Array>();
    for (const [v, ns] of nbrs) {
      const w = Float32Array.from(W.get(v)!, (x) => x * 2);
      for (const o of ns) {
        const wo = W.get(o);
        if (wo) for (let b = 0; b < NB; b++) w[b]! += wo[b]! / ns.size;
        else for (let j = 0; j < 4; j++) w[skinIndex[o * 4 + j]!]! += skinWeight[o * 4 + j]! / 255 / ns.size;
      }
      next.set(v, w.map((x) => x / 3));
    }
    for (const [v, w] of next) W.set(v, w);
  }
  for (const [v, w] of W) {
    const top = Array.from(w, (x, b) => [x, b] as [number, number]).sort((a, b) => b[0] - a[0]).slice(0, 4);
    const sum = top.reduce((a, [x]) => a + x, 0) || 1;
    let acc = 0;
    top.forEach(([x, b], i) => {
      skinIndex[v * 4 + i] = b;
      const q = i === 3 ? 255 - acc : Math.round((x / sum) * 255);
      skinWeight[v * 4 + i] = Math.max(0, q);
      acc += q;
    });
  }
  console.log(`latissimus: weights spread over ${W.size} vertices`);
}
view("skinIndex", Uint8Array).set(skinIndex);
view("skinWeight", Uint8Array).set(skinWeight);

// Fascia triangles that bridge the arm and the torso (across the armpit) would stretch into long slivers when the arms
// rise: they fill no visible gap, so they go. (Written back into the index block, which only gets shorter.)
let tris: Uint32Array = new Uint32Array(idx);
{
  const ARM = new Set(BONES.flatMap((b, i) => (/upperArm|foreArm|hand/.test(b) ? [i] : [])));
  const keep: number[] = [];
  let dropped = 0;
  for (let t = 0; t < tris.length; t += 3) {
    const tri = [tris[t]!, tris[t + 1]!, tris[t + 2]!];
    if (tissue[tri[0]!] === TISSUE.deep) {
      const arm = tri.map((v) => ARM.has(skinIndex[v * 4]!));
      if (arm.some(Boolean) && !arm.every(Boolean)) {
        dropped++;
        continue;
      }
    }
    keep.push(...tri);
  }
  if (dropped) {
    tris = new Uint32Array(keep);
    const l = meta.layout.index!;
    (l.type === "Uint32Array" ? view("index", Uint32Array) : view("index", Uint16Array)).set(tris);
    l.length = tris.length;
  }
  console.log(`fascia: ${dropped} triangles bridging arm and torso removed`);
}

// Ambient occlusion: 32 cosine-weighted rays per vertex, nearer hits darker.
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
geo.setIndex(new THREE.BufferAttribute(tris, 1));
geo.computeVertexNormals();
const bvh = new MeshBVH(geo);
const nrm = geo.getAttribute("normal") as THREE.BufferAttribute;
const NV = pos.length / 3;
const RAYS = 32, REACH = 9;
const ao = new Uint8Array(NV);
const ray = new THREE.Ray();
const n = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), d = new THREE.Vector3();
const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
for (let v = 0; v < NV; v++) {
  n.fromBufferAttribute(nrm, v);
  t1.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0).cross(n).normalize();
  t2.crossVectors(n, t1);
  let occ = 0;
  for (let r = 0; r < RAYS; r++) {
    // Fibonacci points on the hemisphere, cosine weighted.
    const u = (r + 0.5) / RAYS, phi = r * 2.399963;
    const sr = Math.sqrt(u), z = Math.sqrt(1 - u);
    d.copy(t1).multiplyScalar(Math.cos(phi) * sr).addScaledVector(t2, Math.sin(phi) * sr).addScaledVector(n, z);
    ray.origin.set(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!).addScaledVector(n, 0.04);
    ray.direction.copy(d);
    const hit = bvh.raycastFirst(ray, material, 0, REACH);
    if (hit) occ += 1 - hit.distance / REACH;
  }
  ao[v] = Math.round(Math.max(0, 1 - (occ / RAYS) * 1.6) * 255);
}
// Write (replace or append a block).
const putBlock = (name: string, data: Uint8Array | Uint32Array) => {
  const old = meta.layout[name];
  if (old && old.length === data.length) {
    Buffer.from(data.buffer, data.byteOffset, data.byteLength).copy(buf, old.offset);
    return;
  }
  const offset = Math.ceil(buf.length / 4) * 4;
  buf = Buffer.concat([buf, Buffer.alloc(offset - buf.length), Buffer.from(data.buffer, data.byteOffset, data.byteLength)]);
  meta.layout[name] = { offset, length: data.length, type: data.constructor.name };
  meta.bytes = buf.length;
};
putBlock("ao", ao);

// Mobile level of detail: a second, lighter index buffer over the same vertices (each part simplified on its own, its
// outline locked so neighbouring parts still meet). Vertices are untouched, so weights, glow and shading still apply.
{
  await MeshoptSimplifier.ready;
  const src = tris;
  const lod = MeshoptSimplifier.simplify(src, new Float32Array(pos), 3, Math.round(src.length * 0.45 / 3) * 3, 0.004, ["LockBorder"])[0];
  putBlock("indexLod1", lod);
  console.log(`mobile detail: ${lod.length / 3} of ${src.length / 3} triangles`);
}
writeFileSync(`${ATHLETE}.bin`, buf);
writeFileSync(`${ATHLETE}.json`, JSON.stringify(meta, null, 1));
console.log(`finished ${NV} vertices: weights + ambient occlusion`);
