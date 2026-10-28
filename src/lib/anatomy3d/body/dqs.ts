import type * as THREE from "three";

/**
 * Dual-quaternion skinning for three.js materials. Linear blend skinning (three.js's default) averages the bones'
 * matrices, which collapses a joint that turns far or twists: a shoulder lifted overhead folds the deltoid and lats into
 * thin spikes, a turned forearm pinches like a wrapped sweet. Blending the bones as dual quaternions keeps the volume
 * of the flesh between them, so a muscle that crosses a joint bends round it instead. Bones must be rigid (no scale),
 * as they are in this rig.
 *
 * Muscles that should stretch as straight bands across a joint (an attribute `skinLinear` = 1) blend linearly instead.
 *
 * The patch replaces three's skinning chunks (positions and normals) and keeps any onBeforeCompile already on the
 * material (the gold look, the painted eyes).
 */
const PARS = /* glsl */ `
attribute float skinLinear;
vec4 dqQuat( mat4 m ) {
  float t = m[0][0] + m[1][1] + m[2][2];
  vec4 q;
  if ( t > 0.0 ) {
    float s = sqrt( t + 1.0 ) * 2.0;
    q = vec4( ( m[1][2] - m[2][1] ) / s, ( m[2][0] - m[0][2] ) / s, ( m[0][1] - m[1][0] ) / s, 0.25 * s );
  } else if ( m[0][0] > m[1][1] && m[0][0] > m[2][2] ) {
    float s = sqrt( 1.0 + m[0][0] - m[1][1] - m[2][2] ) * 2.0;
    q = vec4( 0.25 * s, ( m[1][0] + m[0][1] ) / s, ( m[2][0] + m[0][2] ) / s, ( m[1][2] - m[2][1] ) / s );
  } else if ( m[1][1] > m[2][2] ) {
    float s = sqrt( 1.0 + m[1][1] - m[0][0] - m[2][2] ) * 2.0;
    q = vec4( ( m[1][0] + m[0][1] ) / s, 0.25 * s, ( m[2][1] + m[1][2] ) / s, ( m[2][0] - m[0][2] ) / s );
  } else {
    float s = sqrt( 1.0 + m[2][2] - m[0][0] - m[1][1] ) * 2.0;
    q = vec4( ( m[2][0] + m[0][2] ) / s, ( m[2][1] + m[1][2] ) / s, 0.25 * s, ( m[0][1] - m[1][0] ) / s );
  }
  return q;
}
vec4 dqMul( vec4 a, vec4 b ) {
  return vec4( a.w * b.xyz + b.w * a.xyz + cross( a.xyz, b.xyz ), a.w * b.w - dot( a.xyz, b.xyz ) );
}
// Real and dual parts of a bone's dual quaternion, added into the blend (same hemisphere as the first bone).
void dqAdd( mat4 m, float w, vec4 ref, inout vec4 r, inout vec4 d ) {
  vec4 q = dqQuat( m );
  if ( dot( q, ref ) < 0.0 ) w = -w;
  r += w * q;
  d += w * 0.5 * dqMul( vec4( m[3].xyz, 0.0 ), q );
}
vec3 dqRotate( vec4 r, vec3 v ) {
  return v + 2.0 * cross( r.xyz, cross( r.xyz, v ) + r.w * v );
}
vec3 dqTransform( vec4 r, vec4 d, vec3 v ) {
  return dqRotate( r, v ) + 2.0 * ( r.w * d.xyz - d.w * r.xyz + cross( r.xyz, d.xyz ) );
}
`;

const BASE = /* glsl */ `
#ifdef USE_SKINNING
  mat4 boneMatX = getBoneMatrix( skinIndex.x );
  mat4 boneMatY = getBoneMatrix( skinIndex.y );
  mat4 boneMatZ = getBoneMatrix( skinIndex.z );
  mat4 boneMatW = getBoneMatrix( skinIndex.w );
  vec4 dqR = vec4( 0.0 ), dqD = vec4( 0.0 );
  vec4 dqRef = dqQuat( boneMatX );
  dqAdd( boneMatX, skinWeight.x, dqRef, dqR, dqD );
  dqAdd( boneMatY, skinWeight.y, dqRef, dqR, dqD );
  dqAdd( boneMatZ, skinWeight.z, dqRef, dqR, dqD );
  dqAdd( boneMatW, skinWeight.w, dqRef, dqR, dqD );
  float dqLen = length( dqR );
  dqR /= dqLen;
  dqD /= dqLen;
  // (Linear blending for the parts marked so: the bones' matrices averaged, as three.js does.)
  mat4 lbsMatrix = bindMatrixInverse * ( skinWeight.x * boneMatX + skinWeight.y * boneMatY + skinWeight.z * boneMatZ + skinWeight.w * boneMatW ) * bindMatrix;
#endif
`;

const NORMAL = /* glsl */ `
#ifdef USE_SKINNING
  objectNormal = mix( ( bindMatrixInverse * vec4( dqRotate( dqR, ( bindMatrix * vec4( objectNormal, 0.0 ) ).xyz ), 0.0 ) ).xyz, ( lbsMatrix * vec4( objectNormal, 0.0 ) ).xyz, skinLinear );
  #ifdef USE_TANGENT
    objectTangent = mix( ( bindMatrixInverse * vec4( dqRotate( dqR, ( bindMatrix * vec4( objectTangent, 0.0 ) ).xyz ), 0.0 ) ).xyz, ( lbsMatrix * vec4( objectTangent, 0.0 ) ).xyz, skinLinear );
  #endif
#endif
`;

const POSITION = /* glsl */ `
#ifdef USE_SKINNING
  vec3 dqP = dqTransform( dqR, dqD, ( bindMatrix * vec4( transformed, 1.0 ) ).xyz );
  transformed = mix( ( bindMatrixInverse * vec4( dqP, 1.0 ) ).xyz, ( lbsMatrix * vec4( transformed, 1.0 ) ).xyz, skinLinear );
#endif
`;

const patched = new WeakSet<THREE.Material>();

export function applyDualQuaternionSkinning(material: THREE.Material): void {
  if (patched.has(material)) return;
  patched.add(material);
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <skinning_pars_vertex>", `#include <skinning_pars_vertex>\n#ifdef USE_SKINNING\n${PARS}\n#endif`)
      .replace("#include <skinbase_vertex>", BASE)
      .replace("#include <skinnormal_vertex>", NORMAL)
      .replace("#include <skinning_vertex>", POSITION);
  };
  material.customProgramCacheKey = () => `${key.call(material)}|dqs`;
  material.needsUpdate = true;
}

// ---------------------------------------------------------------- the same on the CPU (for the checks)

/** Dual quaternion of a rigid matrix (column-major elements, as three.js stores them). */
export function dqOf(e: ArrayLike<number>): { r: [number, number, number, number]; d: [number, number, number, number] } {
  const m = (c: number, r: number) => e[c * 4 + r]!;
  const t = m(0, 0) + m(1, 1) + m(2, 2);
  let x: number, y: number, z: number, w: number;
  if (t > 0) {
    const s = Math.sqrt(t + 1) * 2;
    [x, y, z, w] = [(m(1, 2) - m(2, 1)) / s, (m(2, 0) - m(0, 2)) / s, (m(0, 1) - m(1, 0)) / s, 0.25 * s];
  } else if (m(0, 0) > m(1, 1) && m(0, 0) > m(2, 2)) {
    const s = Math.sqrt(1 + m(0, 0) - m(1, 1) - m(2, 2)) * 2;
    [x, y, z, w] = [0.25 * s, (m(1, 0) + m(0, 1)) / s, (m(2, 0) + m(0, 2)) / s, (m(1, 2) - m(2, 1)) / s];
  } else if (m(1, 1) > m(2, 2)) {
    const s = Math.sqrt(1 + m(1, 1) - m(0, 0) - m(2, 2)) * 2;
    [x, y, z, w] = [(m(1, 0) + m(0, 1)) / s, 0.25 * s, (m(2, 1) + m(1, 2)) / s, (m(2, 0) - m(0, 2)) / s];
  } else {
    const s = Math.sqrt(1 + m(2, 2) - m(0, 0) - m(1, 1)) * 2;
    [x, y, z, w] = [(m(2, 0) + m(0, 2)) / s, (m(2, 1) + m(1, 2)) / s, 0.25 * s, (m(0, 1) - m(1, 0)) / s];
  }
  const tx = m(3, 0), ty = m(3, 1), tz = m(3, 2);
  // d = 0.5 · (t, 0) · q
  const d: [number, number, number, number] = [
    0.5 * (tx * w + ty * z - tz * y),
    0.5 * (-tx * z + ty * w + tz * x),
    0.5 * (tx * y - ty * x + tz * w),
    -0.5 * (tx * x + ty * y + tz * z),
  ];
  return { r: [x, y, z, w], d };
}

/** Skins one point (rig frame) linearly: bones' matrices (column-major), four indices and weights (0..1). */
export function lbsSkin(mats: ArrayLike<number>[], idx: ArrayLike<number>, wts: ArrayLike<number>, p: [number, number, number], out: [number, number, number]): void {
  out[0] = out[1] = out[2] = 0;
  for (let k = 0; k < 4; k++) {
    const w = wts[k]!;
    if (!w) continue;
    const e = mats[idx[k]!]!;
    out[0] += w * (e[0]! * p[0] + e[4]! * p[1] + e[8]! * p[2] + e[12]!);
    out[1] += w * (e[1]! * p[0] + e[5]! * p[1] + e[9]! * p[2] + e[13]!);
    out[2] += w * (e[2]! * p[0] + e[6]! * p[1] + e[10]! * p[2] + e[14]!);
  }
}

/** Skins one point (rig frame) with dual quaternions: bones' DQs, four indices and weights (0..1). */
export function dqSkin(
  dqs: { r: number[]; d: number[] }[],
  idx: ArrayLike<number>,
  wts: ArrayLike<number>,
  p: [number, number, number],
  out: [number, number, number],
): void {
  const r = [0, 0, 0, 0], d = [0, 0, 0, 0];
  const ref = dqs[idx[0]!]!.r;
  for (let k = 0; k < 4; k++) {
    let w = wts[k]!;
    if (!w) continue;
    const q = dqs[idx[k]!]!;
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
  // rotate: v + 2 r × (r × v + w v)
  const cx = y * p[2] - z * p[1] + w * p[0], cy = z * p[0] - x * p[2] + w * p[1], cz = x * p[1] - y * p[0] + w * p[2];
  const rx = p[0] + 2 * (y * cz - z * cy), ry = p[1] + 2 * (z * cx - x * cz), rz = p[2] + 2 * (x * cy - y * cx);
  // translate: 2 (w d - dw r + r × d)
  const [dx, dy, dz, dw] = d as [number, number, number, number];
  out[0] = rx + 2 * (w * dx - dw * x + (y * dz - z * dy));
  out[1] = ry + 2 * (w * dy - dw * y + (z * dx - x * dz));
  out[2] = rz + 2 * (w * dz - dw * z + (x * dy - y * dx));
}
