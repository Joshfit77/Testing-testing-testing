import * as THREE from "three";
import type { Skeleton3 } from "./skeleton";

/**
 * Pose-space corrective shapes for the shoulders and hips (public/anatomy/ecorche-correctives.*, built by
 * scripts/anatomy/build-ecorche-correctives.mts).
 *
 * Skinning alone cannot carry the flesh round a joint that turns as far as the shoulder overhead or the hip at the
 * catch of a rowing stroke: the muscles that cross it (lats, teres, pectorals; adductors, gracilis, hamstrings) either
 * swing out round the joint or stretch and fold where their weights change from one bone to the other. For a set of
 * poses taken from the exercises themselves, the build works out where those muscles' surfaces should be (their
 * skinned surface relaxed: smoothed and the rest pose's detail laid back on, "delta mush", for each muscle) and stores
 * the difference, taken back into the rest pose through each vertex's own skinning. At run time each joint's turn
 * (the humerus against the thorax, the thigh against the pelvis) blends those differences by radial basis functions
 * over the stored poses (exact at each of them, fading to nothing far from all of them), and they are added to the
 * rest positions before skinning: in the vertex shader for the viewer, on the CPU for the checks.
 *
 * The differences are stored compressed: each region's are the combination of a few shapes (their principal
 * components), so a vertex keeps K offsets and a region K weights per frame.
 */

export interface CorrectiveRegion {
  name: string;
  /** The joint's turn: `bone` against `base` (each from its rest rotation). */
  base: string;
  bone: string;
  /** Width of each pose's influence (radians of turn). */
  sigma: number;
  /** The stored poses: the joint's turn as a quaternion [x, y, z, w]; the first is the rest pose. */
  samples: [number, number, number, number][];
  /** Radial basis weights: per stored pose, K numbers (row-major, samples × K). */
  weights: number[];
}

export interface CorrectiveMeta {
  source: string;
  /** Shapes per region. */
  k: number;
  regions: CorrectiveRegion[];
  /** The rig's parts that are corrected: its index in the rig's meshes, and its block of rows. */
  meshes: { mesh: number; offset: number; count: number }[];
  rows: number;
  /** Offsets are stored as int16 times this (cm). */
  scale: number;
}

/** Corrective data parsed from the build's files. Rows: one per corrected vertex (its mesh vertex, its region, and K
 *  offsets in the rig frame, cm). */
export class Correctives {
  readonly meta: CorrectiveMeta;
  readonly k: number;
  /** Per row: the vertex within its mesh, and its region. */
  readonly vertex: Uint32Array;
  readonly region: Uint8Array;
  /** Per row, K offsets (x, y, z), cm, rig frame. */
  readonly basis: Float32Array;
  /** The current weights: K per region. */
  readonly coef: Float32Array;
  private readonly byMesh = new Map<number, { offset: number; count: number }>();
  private readonly turnQ = new THREE.Quaternion();
  private readonly tmp = new THREE.Quaternion();

  constructor(meta: CorrectiveMeta, data: ArrayBuffer) {
    this.meta = meta;
    this.k = meta.k;
    const R = meta.rows;
    this.vertex = new Uint32Array(data, 0, R);
    this.region = new Uint8Array(data, R * 4, R);
    const at = R * 4 + R + ((4 - ((R * 5) % 4)) % 4);
    const q = new Int16Array(data, at, R * meta.k * 3);
    this.basis = Float32Array.from(q, (v) => v * meta.scale);
    this.coef = new Float32Array(meta.regions.length * meta.k);
    for (const m of meta.meshes) this.byMesh.set(m.mesh, m);
  }

  /** The rows of one of the rig's meshes (by its index in the rig's meshes), if it is corrected. */
  rowsOf(mesh: number): { offset: number; count: number } | undefined {
    return this.byMesh.get(mesh);
  }

  /** Sets each region's weights for the skeleton's current pose. */
  update(sk: Skeleton3): Float32Array {
    const K = this.k;
    this.meta.regions.forEach((r, ri) => {
      const b = sk.i(r.base), h = sk.i(r.bone);
      // The joint's turn: the bone's turn from rest, seen from the base's.
      const base = this.tmp.copy(sk.rot[b]!).multiply(sk.restRot[b]!.clone().invert());
      this.turnQ.copy(sk.rot[h]!).multiply(sk.restRot[h]!.clone().invert()).premultiply(base.invert());
      const q = this.turnQ;
      for (let k = 0; k < K; k++) this.coef[ri * K + k] = 0;
      r.samples.forEach((s, j) => {
        const dot = Math.min(1, Math.abs(q.x * s[0] + q.y * s[1] + q.z * s[2] + q.w * s[3]));
        const d = (2 * Math.acos(dot)) / r.sigma;
        const phi = Math.exp(-d * d);
        if (phi < 1e-6) return;
        for (let k = 0; k < K; k++) this.coef[ri * K + k] = this.coef[ri * K + k]! + phi * r.weights[j * K + k]!;
      });
    });
    return this.coef;
  }

  /** Adds the correction of one row (current weights) to `out` (rig frame, cm). */
  add(row: number, out: [number, number, number]): void {
    const K = this.k;
    const c = this.region[row]! * K;
    for (let k = 0; k < K; k++) {
      const w = this.coef[c + k]!;
      if (!w) continue;
      const o = (row * K + k) * 3;
      out[0] += w * this.basis[o]!;
      out[1] += w * this.basis[o + 1]!;
      out[2] += w * this.basis[o + 2]!;
    }
  }
}

// ---------------------------------------------------------------- the viewer: offsets added in the vertex shader

const TEX_W = 4096;

/** The GPU side: the offsets as a half-float texture (one texel per row and shape), a per-vertex row attribute on every
 *  skinned mesh (-1 where there is none), and the weights as a uniform array shared by every material. */
export function attachCorrectives(cor: Correctives, meshes: THREE.SkinnedMesh[], rigMeshes: (THREE.SkinnedMesh | null)[], materials: Iterable<THREE.Material>): void {
  const K = cor.k;
  const R = cor.meta.rows;
  const texels = R * K;
  const H = Math.max(1, Math.ceil(texels / TEX_W));
  const data = new Uint16Array(TEX_W * H * 4);
  for (let t = 0; t < texels; t++) {
    data[t * 4] = THREE.DataUtils.toHalfFloat(cor.basis[t * 3]!);
    data[t * 4 + 1] = THREE.DataUtils.toHalfFloat(cor.basis[t * 3 + 1]!);
    data[t * 4 + 2] = THREE.DataUtils.toHalfFloat(cor.basis[t * 3 + 2]!);
  }
  const tex = new THREE.DataTexture(data, TEX_W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  // Rows: row·4 + region (exact in a float up to 2^24).
  let most = 0;
  for (const m of meshes) most = Math.max(most, m.geometry.getAttribute("position").count);
  const none = new THREE.BufferAttribute(new Float32Array(most).fill(-1), 1);
  for (const m of meshes) m.geometry.setAttribute("corRow", none);
  rigMeshes.forEach((m, i) => {
    const rows = cor.rowsOf(i);
    if (!m || !rows) return;
    const a = new Float32Array(m.geometry.getAttribute("position").count).fill(-1);
    for (let r = rows.offset; r < rows.offset + rows.count; r++) a[cor.vertex[r]!] = r * 4 + cor.region[r]!;
    m.geometry.setAttribute("corRow", new THREE.BufferAttribute(a, 1));
  });
  const uniforms = { uCorr: { value: cor.coef }, uCorrTex: { value: tex } };
  const code = /* glsl */ `
#ifdef USE_SKINNING
  if ( corRow >= 0.0 ) {
    int corR = int( corRow + 0.5 );
    int corBase = ( corR >> 2 ) * ${K};
    int corReg = ( corR & 3 ) * ${K};
    vec3 corD = vec3( 0.0 );
    for ( int k = 0; k < ${K}; k++ ) {
      int t = corBase + k;
      corD += uCorr[ corReg + k ] * texelFetch( uCorrTex, ivec2( t % ${TEX_W}, t / ${TEX_W} ), 0 ).xyz;
    }
    transformed += ( bindMatrixInverse * vec4( corD, 0.0 ) ).xyz;
  }
#endif
`;
  for (const mat of materials) {
    const before = mat.onBeforeCompile;
    const key = mat.customProgramCacheKey;
    mat.onBeforeCompile = (shader, renderer) => {
      before.call(mat, shader, renderer);
      shader.uniforms.uCorr = uniforms.uCorr;
      shader.uniforms.uCorrTex = uniforms.uCorrTex;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\nattribute float corRow;\nuniform float uCorr[${cor.meta.regions.length * K}];\nuniform highp sampler2D uCorrTex;`)
        .replace("#include <morphtarget_vertex>", `#include <morphtarget_vertex>\n${code}`);
    };
    mat.customProgramCacheKey = () => `${key.call(mat)}|cor${K}`;
    mat.needsUpdate = true;
  }
}
