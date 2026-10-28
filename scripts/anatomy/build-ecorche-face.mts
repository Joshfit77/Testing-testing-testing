/**
 * The filled-in face for the original Écorché model (owner's request: "fill in his face", keeping it red). The file
 * itself is not changed: this builds a thin red layer over the face's bare bone and cartilage (forehead below the
 * frontalis line, temples, cheekbones, jaw, nose), which the viewer adds next to those parts, and the viewer hides the
 * teeth and closes the lips.
 *
 * Each layer is a copy of one bone's surface, lifted along its normals: where a muscle lies over the bone, to just under
 * that muscle (so the muscle still shows); where the bone is bare, smoothly between the heights of the muscles around
 * it, so the gaps fill in level with the muscles instead of showing bone. Round the eyes, above the frontalis line and
 * behind the ears the layer sinks under the bone (unchanged there). Its colour is taken from the nearest muscle.
 *
 *   npx tsx scripts/anatomy/build-ecorche-face.mts
 *
 * Writes public/anatomy/ecorche-face.json (one entry per layer: the part it covers and where its data is) and
 * ecorche-face.bin (per vertex, in the part's own frame and order: position as three float32, then colour as three
 * bytes, in blocks per part).
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
const buf = readFileSync("public/anatomy/ecorche.glb");
const gltf = await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, "");
gltf.scene.updateMatrixWorld(true);

/** The face's bones and cartilages that get a layer (names as three.js reads them). */
const FILL = [
  "Frontal_bone", "Sphenoid_bone", "Mandible", "Septal_nasal_cartilage",
  ...["temporal_bone", "zygomatic_bone", "maxilla", "nasal_bone", "lacrimal_bone", "lateral_nasal_cartilage", "major_alar_cartilage"].flatMap((n) => [`Left_${n}`, `Right_${n}`]),
];
const mm = 0.001;
/** Highest point of the fill on the forehead (top of the frontalis), and how far it fades. */
const BROW_TOP = 1.672, BROW_FADE = 0.012;
/** The fill stops this far in front of the ear canal line (z, file frame) and fades over FADE. */
const EAR_Z = -0.012, FADE = 0.008;
/** Clear space round the eyes. */
const EYE_CLEAR = 3.5 * mm;

const meshes: THREE.Mesh[] = [];
gltf.scene.traverse((o) => {
  if (o instanceof THREE.Mesh) meshes.push(o);
});
const isMuscle = (m: THREE.Mesh) => (m.material as THREE.Material).name === "Muscle";
const worldGeometry = (m: THREE.Mesh) => {
  const g = m.geometry.clone();
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "color" && k !== "normal") g.deleteAttribute(k);
  if (!g.getAttribute("color")) g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute("position").count * 3).fill(0.2), 3));
  // (The file's positions and normals are quantized: they become plain floats before moving into the world frame.)
  for (const k of ["position", "normal", "color"]) {
    const a = g.getAttribute(k);
    const f = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) f.set([a.getX(i), a.getY(i), a.getZ(i)], i * 3);
    g.setAttribute(k, new THREE.BufferAttribute(f, 3));
  }
  g.applyMatrix4(m.matrixWorld);
  return g;
};
const head = (m: THREE.Mesh) => new THREE.Box3().setFromObject(m).max.y > 1.45;
const muscles = mergeGeometries(meshes.filter((m) => isMuscle(m) && head(m)).map(worldGeometry), false)!;
const bvh = new MeshBVH(muscles);
// Colours come from the muscles on the surface only (the deep ones are darker and would leave near-black patches).
const DEEP = /pterygoid|deep_part|multifidus|obliquus|rectus_capitis|semispinalis|scalenus|longus|thyrohyoid/;
const surface = mergeGeometries(meshes.filter((m) => isMuscle(m) && head(m) && !DEEP.test(m.name)).map(worldGeometry), false)!;
const surfaceBvh = new MeshBVH(surface);
const mCol = surface.getAttribute("color");
const mIdx = surface.index!;
const eyes = mergeGeometries(meshes.filter((m) => /(sclera|cornea)$/.test(m.name)).map(worldGeometry), false)!;
const eyeBvh = new MeshBVH(eyes);

const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const entries: { source: string; count: number; offset: number }[] = [];
const blocks: Buffer[] = [];
let byteOffset = 0;
for (const name of FILL) {
  const m = meshes.find((x) => x.name === name);
  if (!m) throw new Error(`no part named ${name}`);
  const g = m.geometry;
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const n = pos.count;
  const toWorld = m.matrixWorld;
  const normalW = new THREE.Matrix3().getNormalMatrix(toWorld);
  const P: THREE.Vector3[] = [], N: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    P.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toWorld));
    N.push(new THREE.Vector3().fromBufferAttribute(nor, i).applyMatrix3(normalW).normalize());
  }
  // Neighbours along the part's edges (welding vertices that share a position, as the part may be split at seams).
  const key = (v: THREE.Vector3) => `${Math.round(v.x / 1e-5)},${Math.round(v.y / 1e-5)},${Math.round(v.z / 1e-5)}`;
  const weld = new Map<string, number>();
  const root = P.map((v, i) => weld.get(key(v)) ?? (weld.set(key(v), i), i));
  const nbr = Array.from({ length: n }, () => new Set<number>());
  const idx = g.index;
  for (let t = 0; t < (idx ? idx.count : n); t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => root[idx ? idx.getX(t + k) : t + k]!);
    nbr[a!]!.add(b!).add(c!);
    nbr[b!]!.add(a!).add(c!);
    nbr[c!]!.add(a!).add(b!);
  }

  // Where a muscle lies over the bone (along the normal, within 9 mm), the layer stops just under it.
  const ray = new THREE.Ray();
  const bothSides = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const lift = new Float64Array(n);
  const fixed = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (root[i] !== i) continue;
    ray.origin.copy(P[i]!).addScaledVector(N[i]!, 0.05 * mm);
    ray.direction.copy(N[i]!);
    const hit = bvh.raycastFirst(ray, bothSides, 0, 9 * mm);
    if (hit) {
      lift[i] = Math.max(0.3 * mm, hit.distance - 0.7 * mm);
      fixed[i] = 1;
    }
  }
  // Bare bone: smoothly between the muscles around it (harmonic fill), at least 0.6 mm, at most 6 mm.
  for (let i = 0; i < n; i++) if (root[i] === i && !fixed[i]) lift[i] = 1.5 * mm;
  for (let it = 0; it < 400; it++)
    for (let i = 0; i < n; i++) {
      if (root[i] !== i || fixed[i] || !nbr[i]!.size) continue;
      let s = 0;
      for (const j of nbr[i]!) s += lift[j]!;
      lift[i] = s / nbr[i]!.size;
    }
  // Where the face ends (above the frontalis line, behind the temples, round the eyes), the layer sinks under the bone.
  const target = new THREE.Vector3();
  const out = Buffer.alloc(n * 15);
  const inv = toWorld.clone().invert();
  const col = new THREE.Vector3();
  const colours: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const r = root[i]!;
    const p = P[r]!;
    let face = (1 - smooth(BROW_TOP, BROW_TOP + BROW_FADE, p.y)) * smooth(EAR_Z - FADE, EAR_Z, p.z);
    eyeBvh.closestPointToPoint(p, { point: target } as never);
    face *= smooth(EYE_CLEAR, EYE_CLEAR + 2.5 * mm, p.distanceTo(target));
    const h = THREE.MathUtils.lerp(-1.5 * mm, THREE.MathUtils.clamp(lift[r]!, fixed[r] ? 0 : 0.6 * mm, 6 * mm), face);
    const w = p.clone().addScaledVector(N[i]!, h).applyMatrix4(inv);
    out.writeFloatLE(w.x, i * 12);
    out.writeFloatLE(w.y, i * 12 + 4);
    out.writeFloatLE(w.z, i * 12 + 8);
    // Colour of the nearest muscle.
    const near = surfaceBvh.closestPointToPoint(p)!;
    col.set(0, 0, 0);
    for (let k = 0; k < 3; k++) {
      const v = mIdx.getX(near.faceIndex! * 3 + k);
      col.x += mCol.getX(v) / 3;
      col.y += mCol.getY(v) / 3;
      col.z += mCol.getZ(v) / 3;
    }
    colours.push(col.clone());
  }
  // (Soften the colour a little across the layer, so it reads as one surface.)
  for (let it = 0; it < 3; it++) {
    const next = colours.map((c, i) => {
      const s = c.clone();
      for (const j of nbr[root[i]!]!) s.add(colours[j]!);
      return s.multiplyScalar(1 / (1 + nbr[root[i]!]!.size));
    });
    colours.splice(0, n, ...next);
  }
  // Colours are stored as bytes of their square root (more steps in the dark reds); the viewer squares them back.
  colours.forEach((c, i) => {
    out[n * 12 + i * 3] = Math.round(Math.sqrt(c.x) * 255);
    out[n * 12 + i * 3 + 1] = Math.round(Math.sqrt(c.y) * 255);
    out[n * 12 + i * 3 + 2] = Math.round(Math.sqrt(c.z) * 255);
  });
  const filled = [...Array(n).keys()].filter((i) => root[i] === i);
  console.log(`${name.padEnd(32)} ${n} vertices, ${filled.filter((i) => fixed[i]).length} under muscle, ${filled.filter((i) => !fixed[i]).length} bare`);
  entries.push({ source: name, count: n, offset: byteOffset });
  blocks.push(out);
  byteOffset += out.length;
}

writeFileSync("public/anatomy/ecorche-face.bin", Buffer.concat(blocks));
writeFileSync(
  "public/anatomy/ecorche-face.json",
  JSON.stringify({
    source: "Filled-in face for public/anatomy/ecorche.glb (scripts/anatomy/build-ecorche-face.mts)",
    hide: meshes.filter((m) => /_tooth$/.test(m.name)).map((m) => m.name),
    layers: entries,
  }),
);
console.log(`wrote public/anatomy/ecorche-face.bin (${(byteOffset / 1e3).toFixed(0)} kB) and ecorche-face.json`);
