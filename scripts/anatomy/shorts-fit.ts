import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { TISSUE } from "../../src/lib/anatomy3d/muscle-ids";

/**
 * Shorts clearance: the fabric must lie over the muscles, never under them. Wherever a muscle comes within `clear` of
 * the fabric or pokes through it (by at most `maxPoke`; anything further out is another body part, e.g. the forearm
 * hanging beside the hip, and is ignored), the fabric is lifted to sit `clear` above it, and the lift is feathered
 * out over the neighbouring fabric so it rises in a smooth swell, not a spike. Moves the shorts vertices in place.
 */
export function fitShorts(pos: Float32Array, idx: ArrayLike<number>, tissue: Uint8Array, clear = 0.45, maxPoke = 1.6): number {
  const isUnder = (v: number) => tissue[v] === TISSUE.muscle || tissue[v] === TISSUE.bone || tissue[v] === TISSUE.tendon;
  const tri: number[] = [];
  const shortsTri: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    if (isUnder(idx[i]!)) tri.push(idx[i]!, idx[i + 1]!, idx[i + 2]!);
    else if (tissue[idx[i]!] === TISSUE.cover) shortsTri.push(idx[i]!, idx[i + 1]!, idx[i + 2]!);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(tri), 1));
  const under = new MeshBVH(g);
  const both = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const verts = [...new Set(shortsTri)];
  const nbrs = new Map<number, Set<number>>(verts.map((v) => [v, new Set<number>()]));
  for (let i = 0; i < shortsTri.length; i += 3)
    for (let k = 0; k < 3; k++) for (let j = 1; j < 3; j++) nbrs.get(shortsTri[i + k]!)!.add(shortsTri[i + ((k + j) % 3)]!);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  sg.setIndex(new THREE.BufferAttribute(new Uint32Array(shortsTri), 1));
  const ray = new THREE.Ray();
  let lifted = 0;
  for (let round = 0; round < 2; round++) {
    sg.computeVertexNormals();
    const nrm = sg.getAttribute("normal") as THREE.BufferAttribute;
    let lift = new Map<number, number>();
    for (const v of verts) {
      const n = new THREE.Vector3().fromBufferAttribute(nrm, v);
      ray.origin.set(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!).addScaledVector(n, maxPoke);
      ray.direction.copy(n).negate();
      const hit = under.raycastFirst(ray, both, 0, maxPoke + 4);
      const h = hit ? hit.distance - maxPoke : Infinity; // height of the fabric above the muscle (negative: under it)
      const l = h < clear && hit!.distance > 0.05 ? clear - h : 0;
      lift.set(v, l);
      if (round === 0 && l > 0) lifted++;
    }
    for (let it = 0; it < 3; it++) {
      const next = new Map<number, number>();
      for (const v of verts) {
        const m = lift.get(v)!;
        let s = 0;
        for (const o of nbrs.get(v)!) s += lift.get(o)!;
        next.set(v, Math.max(m, 0.5 * m + 0.5 * (s / (nbrs.get(v)!.size || 1))));
      }
      lift = next;
    }
    for (const v of verts) {
      const l = lift.get(v)!;
      if (l > 0) for (let k = 0; k < 3; k++) pos[v * 3 + k]! += nrm.getComponent(v, k) * l;
    }
  }
  return lifted;
}
