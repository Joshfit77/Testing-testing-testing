/**
 * Finishing pass on public/anatomy/athlete.bin, without rebuilding the mesh (seconds instead of minutes):
 *  - skin weights (scripts/anatomy/weights.ts); the shorts and fascia take theirs from the muscles beneath
 *  - baked ambient occlusion per vertex, so the grooves between muscles read as deep cuts in any light
 *
 *   npx tsx scripts/anatomy/reweight.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { MEASURED_BIND } from "../../src/lib/anatomy3d/athlete-bind.generated";
import { BONES, TISSUE } from "../../src/lib/anatomy3d/muscle-ids";
import { computeWeights } from "./weights";

type Layout = Record<string, { offset: number; length: number; type: string }>;
const meta = JSON.parse(readFileSync("public/anatomy/athlete.json", "utf8")) as { layout: Layout; bytes: number } & Record<string, unknown>;
let buf: Buffer = readFileSync("public/anatomy/athlete.bin");
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

const { skinIndex, skinWeight } = computeWeights(pos, idx, label, MEASURED_BIND, forced);

// The shorts and the fascia follow the muscles under them: each takes the skin weights of the nearest muscle and
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
    if (tissue[v] !== TISSUE.cover && tissue[v] !== TISSUE.deep) continue;
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
  console.log(`shorts/fascia: ${moved} vertices take their weights from the muscles beneath`);
}
view("skinIndex", Uint8Array).set(skinIndex);
view("skinWeight", Uint8Array).set(skinWeight);

// Ambient occlusion: 32 cosine-weighted rays per vertex, nearer hits darker.
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
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
// Write (replace or append the "ao" block).
if (meta.layout.ao) view("ao", Uint8Array).set(ao);
else {
  const offset = Math.ceil(buf.length / 4) * 4;
  buf = Buffer.concat([buf, Buffer.alloc(offset - buf.length), Buffer.from(ao.buffer)]);
  meta.layout.ao = { offset, length: NV, type: "Uint8Array" };
  meta.bytes = buf.length;
}
writeFileSync("public/anatomy/athlete.bin", buf);
writeFileSync("public/anatomy/athlete.json", JSON.stringify(meta, null, 1));
console.log(`finished ${NV} vertices: weights + ambient occlusion`);
