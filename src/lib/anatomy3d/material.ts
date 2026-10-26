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

export function makeAthleteMaterial(): AthleteMaterial {
  const glow = new Float32Array(MUSCLE_ID_COUNT + 1);
  const uniforms = {
    uGlow: { value: glow },
    uGlowColor: { value: GLOW_COLOR.clone() },
    uGlowOn: { value: 1 },
  };
  // Satin gold tissue: part metal, part soft sheen, with a thin wet clearcoat, so it reads as living tissue cast in
  // gold rather than a polished statue.
  const material = new THREE.MeshPhysicalMaterial({
    color: GOLD_BASE,
    metalness: 0.5,
    roughness: 0.34,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14,
    sheen: 0.5,
    sheenColor: new THREE.Color("#ffd98a"),
    sheenRoughness: 0.55,
    // The shorts are an open sheet (their hems show the inside), so both faces are drawn.
    side: THREE.FrontSide,
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
        float isMuscle = step(0.5, vTissue) * (1.0 - step(1.5, vTissue));
        float isEye = step(3.5, vTissue) * (1.0 - step(4.5, vTissue));
        // Muscle fibres about 8 mm apart, faded out wherever they'd be finer than a pixel (no shimmer or moiré).
        float stripeAA = 1.0 - smoothstep(0.35, 0.9, fwidth(vStripe * 7.5));
        float fibre = 0.5 + 0.5 * sin(vStripe * 7.5) * stripeAA;
        float tendon = vExtra * isMuscle;
        diffuseColor.rgb *= mix(1.0, 0.88 + 0.2 * fibre, isMuscle * (1.0 - tendon));
        // Tendinous ends: paler, smoother gold.
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.79, 0.52), tendon * 0.55);
        if (vTissue > 1.5 && vTissue < 2.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.66, 0.42), 0.45); // bone
        if (vTissue > 2.5 && vTissue < 3.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.80, 0.55), 0.5); // tendon
        // Hair: a short buzz cut, darker gold with a fine grain.
        float isHair = (1.0 - step(0.5, vTissue)) * smoothstep(0.2, 0.8, vExtra);
        float grain = hash3(floor(vRest * 9.0));
        // Shaved head: only a faint darker tone on the scalp.
        diffuseColor.rgb *= 1.0 - 0.16 * isHair * (0.8 + 0.4 * grain);
        // Eyes: ivory-gold whites, a dark amber iris, a black pupil.
        vec3 eye = mix(vec3(0.86, 0.74, 0.5), vec3(0.22, 0.13, 0.04), smoothstep(0.2, 0.5, vExtra));
        eye = mix(eye, vec3(0.015, 0.012, 0.01), smoothstep(0.75, 0.9, vExtra));
        diffuseColor.rgb = mix(diffuseColor.rgb, eye, isEye);
        if (vTissue > 4.5 && vTissue < 5.5) diffuseColor.rgb *= 0.42; // fascia between the muscles
        // Shorts: matte black fabric, cut at a clean hem and waistband with a thin gold trim.
        float isShorts = step(5.5, vTissue);
        float hemY = 68.5 + 3.5 * smoothstep(6.0, 16.0, abs(vRest.z));
        float waistY = 95.5 + 3.0 * smoothstep(2.0, -8.0, vRest.x);
        if (isShorts > 0.5 && (vRest.y < hemY || vRest.y > waistY)) discard;
        float trim = isShorts * (1.0 - step(0.8, min(vRest.y - hemY, waistY - vRest.y)));
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
        totalEmissiveRadiance += uGlowColor * g * fibreGlow * body * 0.75;
        diffuseColor.rgb = mix(diffuseColor.rgb, uGlowColor, clamp(g, 0.0, 1.0) * 0.45);
        // Warm edge light, like light passing through the edges of the tissue.
        float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += vec3(1.0, 0.72, 0.32) * pow(1.0 - facing, 4.0) * 0.12 * (1.0 - step(5.5, vTissue));`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
        // Shorts are matte fabric: no clearcoat or sheen (the gold trim keeps a little shine).
        #ifdef USE_CLEARCOAT
        if (vTissue > 5.5) material.clearcoat = 0.0;
        if (vTissue < 0.5) material.clearcoat *= 0.35; // face, hands, feet: less wet shine
        #endif
        #ifdef USE_SHEEN
        if (vTissue > 5.5) material.sheenColor *= 0.0;
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
        if (vTissue < 0.5) metalnessFactor = 0.42; // face, hands and feet: satin, so the features read cleanly
        if (vTissue < 0.5) diffuseColor.rgb *= 0.72;
        if (vTissue > 3.5 && vTissue < 4.5) metalnessFactor = 0.1;
        if (vTissue > 5.5) metalnessFactor = trim > 0.5 ? 0.85 : 0.0;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        float tendonR = vTissue > 0.5 && vTissue < 1.5 ? vExtra : 0.0;
        roughnessFactor += vTissue > 4.5 && vTissue < 5.5 ? 0.35 : 0.0;
        roughnessFactor -= (vTissue > 2.5 && vTissue < 3.5 ? 0.12 : 0.0) + tendonR * 0.14;
        if (vTissue > 3.5 && vTissue < 4.5) roughnessFactor = 0.12;
        if (vTissue > 5.5) roughnessFactor = trim > 0.5 ? 0.3 : 0.75;
        if (vTissue < 0.5) roughnessFactor = max(roughnessFactor, 0.5);
        if (vTissue < 0.5 && vExtra > 0.5) roughnessFactor = 0.45;
        roughnessFactor = clamp(roughnessFactor, 0.05, 1.0);`,
      );
  };
  material.customProgramCacheKey = () => "ngf-athlete-v12";
  return {
    material,
    glow,
    setGlowEnabled(on) {
      uniforms.uGlowOn.value = on ? 1 : 0;
    },
  };
}
