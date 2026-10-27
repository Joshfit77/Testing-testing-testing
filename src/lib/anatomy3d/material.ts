import * as THREE from "three";
import { MUSCLE_ID_COUNT } from "./muscle-ids";

/**
 * The athlete's look: satin anatomical gold with fibre relief on every muscle, paler tendinous ends, ivory-gold bone and
 * tendon, dark fascia in the gaps, and an emissive glow per muscle. `glow` holds one intensity (0..1.5) per muscle id;
 * each muscle mesh carries its own id, so the light follows that muscle's shape exactly.
 */
export interface AthleteMaterial {
  material: THREE.MeshPhysicalMaterial;
  glow: Float32Array;
  /** Overall glow switch (0 = off) for the Muscle Glow toggle. */
  setGlowEnabled(on: boolean): void;
}

export const GOLD_BASE = new THREE.Color("#c8903a");
export const GLOW_COLOR = new THREE.Color("#ffb72e");

/**
 * The two looks: "gold" (the app's anatomical gold) and "medical" (a classic anatomy plate: red muscle with fine fibres,
 * pearly white tendons and aponeuroses, ivory bone). Colours in the shader are linear.
 */
export type AthleteLook = "gold" | "medical";
const f1 = (x: number) => x.toFixed(3); // GLSL floats always need a decimal point
const g3 = (v: readonly number[]) => `vec3(${v.map(f1).join(", ")})`;
const LOOKS = {
  gold: {
    // A darker, satin gold: rich in shadow, bright only where the light catches it, never a polished statue.
    base: "#ad7a30", metalness: 0.62, roughness: 0.4, clearcoat: 0.32, clearcoatRoughness: 0.28, sheen: 0.3, sheenColor: "#ffd98a",
    fibre: [0.88, 0.2], tendonEnd: [[0.93, 0.79, 0.52], 0.55], bone: [[0.8, 0.66, 0.42], 0.45], tendon: [[0.92, 0.8, 0.55], 0.5],
    hairDark: 0.16, scalp: [[0.93, 0.79, 0.52], 0], fascia: 0.42, skinMetal: 0.5, skinTint: [1, 1, 1], skinMul: 0.8, rim: [[1, 0.72, 0.32], 0.06],
    glow: "#ffb72e", glowTint: 0.45,
  },
  medical: {
    base: "#b0463a", metalness: 0, roughness: 0.5, clearcoat: 0.28, clearcoatRoughness: 0.35, sheen: 0.25, sheenColor: "#ff9f8c",
    fibre: [0.74, 0.42], tendonEnd: [[0.86, 0.8, 0.7], 0.9], bone: [[0.82, 0.75, 0.6], 0.92], tendon: [[0.88, 0.83, 0.74], 0.92],
    hairDark: 0, scalp: [[0.62, 0.52, 0.46], 0.6], fascia: 0.3, skinMetal: 0, skinTint: [1.0, 0.92, 0.9], skinMul: 0.95, rim: [[1, 0.55, 0.45], 0.05],
    // Worked muscles: a hot, bright orange-red that reads clearly against the plain muscle red.
    glow: "#ff7a2e", glowTint: 0.35,
  },
} as const;

export function makeAthleteMaterial(look: AthleteLook = "gold"): AthleteMaterial {
  const L = LOOKS[look];
  const glow = new Float32Array(MUSCLE_ID_COUNT + 1);
  const uniforms = {
    uGlow: { value: glow },
    uGlowColor: { value: new THREE.Color(L.glow) },
    uGlowOn: { value: 1 },
  };
  // Gold: satin tissue, part metal, part soft sheen, with a thin wet clearcoat, so it reads as living tissue cast in
  // gold rather than a polished statue. Medical: moist, non-metallic muscle.
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(L.base),
    metalness: L.metalness,
    roughness: L.roughness,
    clearcoat: L.clearcoat,
    clearcoatRoughness: L.clearcoatRoughness,
    sheen: L.sheen,
    sheenColor: new THREE.Color(L.sheenColor),
    sheenRoughness: 0.55,
    // Both faces are rasterised, but only the shorts keep their back faces (see the colour stage): the fabric over the
    // groin is pressed flat from the scanned skin and has folded patches, which would otherwise show as see-through
    // holes. Every other tissue is effectively single-sided.
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float muscleA;
        attribute float muscleMix;
        attribute float tissue;
        attribute vec3 fiber;
        attribute float ao;
        uniform float uGlow[${MUSCLE_ID_COUNT + 1}];
        varying float vGlow;
        varying float vExtra;
        varying float vTissue;
        varying float vStripe;
        varying float vAo;
        varying vec3 vRest;
        float glowOf(float id) { return id > 254.5 ? 0.0 : uGlow[int(id + 0.5)]; }`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vGlow = tissue > 0.5 && tissue < 1.5 ? glowOf(muscleA) : 0.0;
        vExtra = muscleMix;
        vAo = ao;
        vTissue = tissue;
        // Distance across the fibres (rest pose), for the striations.
        vec3 across = normalize(cross(fiber, objectNormal) + vec3(1e-4));
        vStripe = dot(position, across);
        vRest = position;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uGlowColor;
        uniform float uGlowOn;
        varying float vGlow;
        varying float vExtra;
        varying float vTissue;
        varying float vStripe;
        varying float vAo;
        varying vec3 vRest;
        float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        // Bump mapping from a procedural height (three.js perturbNormalArb).
        vec3 perturbFibre(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
          vec3 sx = normalize(dFdx(surfPos));
          vec3 sy = normalize(dFdy(surfPos));
          vec3 r1 = cross(sy, surfNorm);
          vec3 r2 = cross(surfNorm, sx);
          float det = dot(sx, r1) * faceDir;
          vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
          return normalize(abs(det) * surfNorm - grad);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (!gl_FrontFacing && vTissue < 5.5) discard;
        float isMuscle = step(0.5, vTissue) * (1.0 - step(1.5, vTissue));
        float isEye = step(3.5, vTissue) * (1.0 - step(4.5, vTissue));
        // Muscle fibres about 8 mm apart, faded out wherever they'd be finer than a pixel (no shimmer or moiré).
        float stripeAA = 1.0 - smoothstep(0.35, 0.9, fwidth(vStripe * 7.5));
        float fibre = 0.5 + 0.5 * sin(vStripe * 7.5) * stripeAA;
        float tendon = vExtra * isMuscle;
        diffuseColor.rgb *= mix(1.0, ${f1(L.fibre[0])} + ${f1(L.fibre[1])} * fibre, isMuscle * (1.0 - tendon));
        // Tendinous ends: paler, smoother gold.
        diffuseColor.rgb = mix(diffuseColor.rgb, ${g3(L.tendonEnd[0])}, tendon * ${f1(L.tendonEnd[1])});
        if (vTissue > 1.5 && vTissue < 2.5) diffuseColor.rgb = mix(diffuseColor.rgb, ${g3(L.bone[0])}, ${f1(L.bone[1])}); // bone
        if (vTissue > 2.5 && vTissue < 3.5) diffuseColor.rgb = mix(diffuseColor.rgb, ${g3(L.tendon[0])}, ${f1(L.tendon[1])}); // tendon
        // Hair: a short buzz cut, darker gold with a fine grain.
        float isHair = (1.0 - step(0.5, vTissue)) * smoothstep(0.2, 0.8, vExtra);
        float grain = hash3(floor(vRest * 9.0));
        // Shaved head: only a faint darker tone on the scalp.
        diffuseColor.rgb *= 1.0 - ${f1(L.hairDark)} * isHair * (0.8 + 0.4 * grain);
        // (Medical look: the pale aponeurosis over the crown of the head.)
        diffuseColor.rgb = mix(diffuseColor.rgb, ${g3(L.scalp[0])}, ${f1(L.scalp[1])} * isHair);
        // Eyes: ivory-gold whites, a dark amber iris, a black pupil.
        vec3 eye = mix(vec3(0.86, 0.74, 0.5), vec3(0.22, 0.13, 0.04), smoothstep(0.2, 0.5, vExtra));
        eye = mix(eye, vec3(0.015, 0.012, 0.01), smoothstep(0.75, 0.9, vExtra));
        diffuseColor.rgb = mix(diffuseColor.rgb, eye, isEye);
        if (vTissue > 4.5 && vTissue < 5.5) diffuseColor.rgb *= ${f1(L.fascia)}; // fascia between the muscles
        // Shorts (a fitted mesh of their own): matte black fabric with a thin gold trim drawn along the waistband and
        // hem lines (the same curves the mesh is cut on, so the line is crisp at any distance); the folded edge
        // (muscleMix 1) stays black.
        float isShorts = step(5.5, vTissue);
        float hemY = 68.5 + 3.5 * smoothstep(6.0, 16.0, abs(vRest.z));
        float waistY = 95.5 + 3.0 * smoothstep(2.0, -8.0, vRest.x);
        float toEdge = min(vRest.y - hemY, waistY - vRest.y);
        float trimW = fwidth(toEdge);
        float trim = isShorts * (1.0 - smoothstep(0.55 - trimW, 0.55 + trimW, toEdge)) * (1.0 - step(0.9, vExtra));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.018, 0.016, 0.014), isShorts * (1.0 - trim));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.66, 0.3), trim);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        // The fibres catch the light: real relief across each muscle, not just a colour change.
        float fh = sin(vStripe * 7.5) * stripeAA * isMuscle * (1.0 - tendon) * 0.5 + (grain - 0.5) * isHair * 0.06;
        normal = perturbFibre(-vViewPosition, normal, vec2(dFdx(fh), dFdy(fh)), faceDirection);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float g = clamp(vGlow, 0.0, 1.6) * uGlowOn;
        // The glow lives in the muscle: shaped by its fibres and its own shading, never a flat coat of paint.
        float fibreGlow = 0.78 + 0.22 * fibre;
        float body = 0.45 + 0.55 * vAo;
        totalEmissiveRadiance += uGlowColor * g * fibreGlow * body * 1.35;
        diffuseColor.rgb = mix(diffuseColor.rgb, uGlowColor, clamp(g, 0.0, 1.0) * ${f1(L.glowTint)});
        // Warm edge light, like light passing through the edges of the tissue.
        float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += ${g3(L.rim[0])} * pow(1.0 - facing, 4.0) * ${f1(L.rim[1])} * (1.0 - isShorts);`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
        // Shorts are matte fabric: no clearcoat or sheen (the gold trim keeps a little shine).
        #ifdef USE_CLEARCOAT
        if (isShorts > 0.5) material.clearcoat = 0.0;
        if (vTissue < 0.5) material.clearcoat *= 0.35; // face, hands, feet: less wet shine
        #endif
        #ifdef USE_SHEEN
        if (isShorts > 0.5) material.sheenColor *= 0.0;
        #endif`,
      )
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        // Baked occlusion: deep shade in the grooves between muscles and in the creases of the joints.
        float occ = vAo * vAo;
        reflectedLight.indirectDiffuse *= occ;
        reflectedLight.indirectSpecular *= mix(0.15, 1.0, occ);
        reflectedLight.directDiffuse *= mix(0.45, 1.0, vAo);
        reflectedLight.directSpecular *= mix(0.3, 1.0, vAo);`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        if (vTissue < 0.5) metalnessFactor = ${f1(L.skinMetal)}; // face, hands and feet: satin, so the features read cleanly
        if (vTissue < 0.5) diffuseColor.rgb *= ${g3(L.skinTint)} * ${f1(L.skinMul)};
        if (vTissue > 3.5 && vTissue < 4.5) metalnessFactor = 0.1;
        if (isShorts > 0.5) metalnessFactor = trim > 0.5 ? 0.85 : 0.0;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        float tendonR = vTissue > 0.5 && vTissue < 1.5 ? vExtra : 0.0;
        roughnessFactor += vTissue > 4.5 && vTissue < 5.5 ? 0.35 : 0.0;
        roughnessFactor -= (vTissue > 2.5 && vTissue < 3.5 ? 0.12 : 0.0) + tendonR * 0.14;
        if (vTissue > 3.5 && vTissue < 4.5) roughnessFactor = 0.12;
        if (isShorts > 0.5) roughnessFactor = trim > 0.5 ? 0.3 : 0.75;
        if (vTissue < 0.5) roughnessFactor = max(roughnessFactor, 0.5);
        if (vTissue < 0.5 && vExtra > 0.5) roughnessFactor = 0.45;
        roughnessFactor = clamp(roughnessFactor, 0.05, 1.0);`,
      );
  };
  material.customProgramCacheKey = () => `ngf-athlete-v14-${look}`;
  return {
    material,
    glow,
    setGlowEnabled(on) {
      uniforms.uGlowOn.value = on ? 1 : 0;
    },
  };
}
