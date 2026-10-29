import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";

type V3 = [number, number, number];
export interface EnvelopeMesh {
  pos: Float32Array;
  idx: Uint32Array;
}

/**
 * A smooth surface `offset` cm outside (negative: inside) a set of triangles, with every hollow narrower than about twice `radius` bridged
 * over: a morphological closing of their volume, the shape stretched fabric takes over muscle and bone. It never follows
 * small creases or crevices, and since it is extracted from a voxel field (surface nets) it is a clean manifold whatever
 * the triangles underneath look like (overlapping muscles, open meshes, internal cavities).
 *
 * Unless `closedEnds` is set, the field is open at the grid's top and bottom faces (the trunk and legs carry on there):
 * the region outside the body is found by flooding in from the four side faces only. Either way the empty space inside
 * the trunk (no organs are modelled) counts as body.
 */
export function closedEnvelope(
  pos: Float32Array,
  idx: Uint32Array,
  min: V3,
  max: V3,
  voxel: number,
  /** Closing radius (cm) at a height: smaller near the hems, so the fabric does not web between the thighs. */
  radius: (y: number) => number,
  offset: number,
  /** Also flood the outside in from the grid's top and bottom faces (when the grid spans the whole body). */
  closedEnds = false,
  /** Points that must be inside the body: reported if the outside reaches them (a leak). */
  probes: V3[] = [],
  /** Space that is always outside, however narrow (e.g. the slot between the thighs below the crotch). */
  carve?: (p: V3) => boolean,
  /** Shrink-free smoothing passes over the extracted surface (more for fabric, which should read perfectly smooth). */
  smoothing = 12,
): EnvelopeMesh {
  const n = [0, 1, 2].map((k) => Math.ceil((max[k]! - min[k]!) / voxel) + 1) as V3;
  const [nx, ny, nz] = n;
  const at = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const total = nx * ny * nz;
  const ry = Array.from({ length: ny }, (_, j) => radius(min[1] + j * voxel));
  const rMax = Math.max(...ry);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const bvh = new MeshBVH(g);
  // Outside the dilated volume: further than the closing radius from every triangle.
  const out = new Uint8Array(total);
  const p = new THREE.Vector3();
  const hit = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        p.set(min[0] + i * voxel, min[1] + j * voxel, min[2] + k * voxel);
        const h = bvh.closestPointToPoint(p, hit, 0, rMax + voxel);
        out[at(i, j, k)] = !h || h.distance > ry[j]! ? 1 : 0;
      }
  // Keep only the outside reached from the sides: enclosed space is part of the body.
  const ext = new Uint8Array(total);
  const stack: number[] = [];
  const seed = (i: number, j: number, k: number) => {
    const c = at(i, j, k);
    if (out[c] && !ext[c]) {
      ext[c] = 1;
      stack.push(c);
    }
  };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++) {
      seed(0, j, k);
      seed(nx - 1, j, k);
    }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      seed(i, j, 0);
      seed(i, j, nz - 1);
    }
  if (closedEnds)
    for (let k = 0; k < nz; k++)
      for (let i = 0; i < nx; i++) {
        seed(i, 0, k);
        seed(i, ny - 1, k);
      }
  if (carve)
    for (let k = 0; k < nz; k++)
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++)
          if (carve([min[0] + i * voxel, min[1] + j * voxel, min[2] + k * voxel])) {
            out[at(i, j, k)] = 1;
            seed(i, j, k);
          }
  while (stack.length) {
    const c = stack.pop()!;
    const i = c % nx, j = Math.floor(c / nx) % ny, k = Math.floor(c / (nx * ny));
    if (i > 0) seed(i - 1, j, k);
    if (i < nx - 1) seed(i + 1, j, k);
    if (j > 0) seed(i, j - 1, k);
    if (j < ny - 1) seed(i, j + 1, k);
    if (k > 0) seed(i, j, k - 1);
    if (k < nz - 1) seed(i, j, k + 1);
  }
  for (const q of probes) {
    const [i, j, k] = [0, 1, 2].map((a) => Math.round((q[a]! - min[a]!) / voxel));
    if (ext[at(i!, j!, k!)]) console.warn(`closedEnvelope: the outside reaches ${q.join(", ")}`);
  }
  // Erode back: distance to that outside (exact Euclidean distance transform), less the radius, plus the offset.
  const d2 = edt3(ext, nx, ny, nz);
  const field = new Float32Array(total);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const c = at(i, j, k);
        field[c] = Math.sqrt(d2[c]!) * voxel - (ry[j]! - offset);
      }
  return taubin(surfaceNets(field, nx, ny, nz, min, voxel), smoothing);
}

/** Squared Euclidean distance (in voxels) from every voxel to the nearest set voxel (Felzenszwalb & Huttenlocher). */
function edt3(mask: Uint8Array, nx: number, ny: number, nz: number): Float32Array {
  const INF = 1e12;
  const f = new Float32Array(mask.length);
  for (let c = 0; c < f.length; c++) f[c] = mask[c] ? 0 : INF;
  const pass = (len: number, count: number, index: (line: number, s: number) => number) => {
    const line = new Float64Array(len), out = new Float64Array(len);
    const v = new Int32Array(len), z = new Float64Array(len + 1);
    for (let l = 0; l < count; l++) {
      for (let s = 0; s < len; s++) line[s] = f[index(l, s)]!;
      let kk = 0;
      v[0] = 0;
      z[0] = -Infinity;
      z[1] = Infinity;
      for (let q = 1; q < len; q++) {
        let s = (line[q]! + q * q - (line[v[kk]!]! + v[kk]! * v[kk]!)) / (2 * q - 2 * v[kk]!);
        while (s <= z[kk]!) {
          kk--;
          s = (line[q]! + q * q - (line[v[kk]!]! + v[kk]! * v[kk]!)) / (2 * q - 2 * v[kk]!);
        }
        kk++;
        v[kk] = q;
        z[kk] = s;
        z[kk + 1] = Infinity;
      }
      kk = 0;
      for (let q = 0; q < len; q++) {
        while (z[kk + 1]! < q) kk++;
        out[q] = (q - v[kk]!) ** 2 + line[v[kk]!]!;
      }
      for (let s = 0; s < len; s++) f[index(l, s)] = out[s]!;
    }
  };
  pass(nx, ny * nz, (l, s) => l * nx + s);
  pass(ny, nx * nz, (l, s) => (Math.floor(l / nx) * ny + s) * nx + (l % nx));
  pass(nz, nx * ny, (l, s) => (s * ny + Math.floor(l / nx)) * nx + (l % nx));
  return f;
}

/**
 * Surface nets: one vertex per voxel cell the surface crosses (at the average of its edge crossings), one quad per
 * crossed grid edge. Inside is field > 0; the quads face outwards.
 */
function surfaceNets(field: Float32Array, nx: number, ny: number, nz: number, min: V3, voxel: number): EnvelopeMesh {
  const at = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const cell = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cAt = (i: number, j: number, k: number) => (k * (ny - 1) + j) * (nx - 1) + i;
  const pos: number[] = [];
  const corners: V3[] = [];
  for (let c = 0; c < 8; c++) corners.push([c & 1, (c >> 1) & 1, (c >> 2) & 1]);
  const edges: [number, number][] = [];
  for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) if ([0, 1, 2].filter((k) => corners[a]![k] !== corners[b]![k]).length === 1) edges.push([a, b]);
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const v = corners.map(([a, b, c]) => field[at(i + a, j + b, k + c)]!);
        let s: V3 = [0, 0, 0], m = 0;
        for (const [a, b] of edges) {
          if (v[a]! > 0 === v[b]! > 0) continue;
          const t = v[a]! / (v[a]! - v[b]!);
          for (let q = 0; q < 3; q++) s[q]! += corners[a]![q]! + t * (corners[b]![q]! - corners[a]![q]!);
          m++;
        }
        if (!m) continue;
        s = s.map((x) => x / m) as V3;
        cell[cAt(i, j, k)] = pos.length / 3;
        pos.push(min[0] + (i + s[0]) * voxel, min[1] + (j + s[1]) * voxel, min[2] + (k + s[2]) * voxel);
      }
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c);
    else idx.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const inside = field[at(i, j, k)]! > 0;
        // Edge along x: (i,j,k)-(i+1,j,k), shared by the cells (i, j-1..j, k-1..k); counter-clockwise seen from +x.
        if (i < nx - 1 && j > 0 && k > 0 && j < ny - 1 && k < nz - 1 && inside !== field[at(i + 1, j, k)]! > 0)
          quad(cell[cAt(i, j - 1, k - 1)]!, cell[cAt(i, j, k - 1)]!, cell[cAt(i, j, k)]!, cell[cAt(i, j - 1, k)]!, !inside);
        if (j < ny - 1 && i > 0 && k > 0 && i < nx - 1 && k < nz - 1 && inside !== field[at(i, j + 1, k)]! > 0)
          quad(cell[cAt(i - 1, j, k - 1)]!, cell[cAt(i - 1, j, k)]!, cell[cAt(i, j, k)]!, cell[cAt(i, j, k - 1)]!, !inside);
        if (k < nz - 1 && i > 0 && j > 0 && i < nx - 1 && j < ny - 1 && inside !== field[at(i, j, k + 1)]! > 0)
          quad(cell[cAt(i - 1, j - 1, k)]!, cell[cAt(i, j - 1, k)]!, cell[cAt(i, j, k)]!, cell[cAt(i - 1, j, k)]!, !inside);
      }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}

/** Taubin smoothing (shrink-free): removes the voxel ripple. */
function taubin(m: EnvelopeMesh, iterations: number): EnvelopeMesh {
  const nv = m.pos.length / 3;
  const nbrs: Set<number>[] = Array.from({ length: nv }, () => new Set());
  for (let t = 0; t < m.idx.length; t += 3)
    for (let a = 0; a < 3; a++) for (let b = 1; b < 3; b++) nbrs[m.idx[t + a]!]!.add(m.idx[t + ((a + b) % 3)]!);
  const step = (w: number) => {
    const next = new Float32Array(m.pos);
    for (let v = 0; v < nv; v++) {
      const ns = nbrs[v]!;
      if (!ns.size) continue;
      for (let q = 0; q < 3; q++) {
        let s = 0;
        for (const o of ns) s += m.pos[o * 3 + q]!;
        next[v * 3 + q] = m.pos[v * 3 + q]! + w * (s / ns.size - m.pos[v * 3 + q]!);
      }
    }
    m.pos.set(next);
  };
  for (let it = 0; it < iterations; it++) {
    step(0.5);
    step(-0.53);
  }
  return m;
}
