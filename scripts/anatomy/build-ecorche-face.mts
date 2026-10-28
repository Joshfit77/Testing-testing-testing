/**
 * The filled-in face for the original Écorché model (owner's requests: "fill in his face", then "fill in his whole
 * face", keeping it red). The file itself is not changed: this builds a red layer over the whole head's bare bone and
 * cartilage (skull, temples, cheekbones, jaw, nose, ears), which the viewer adds next to those parts, and the viewer
 * hides the teeth and closes the lips.
 *
 * Each layer is a copy of one bone's surface, lifted along its normals: where muscles lie over the bone, to just under
 * the top of them (inside the muscle, so the muscle still shows); where the bone is bare, smoothly between the heights
 * of the muscles around it, so the grooves between the muscles fill in level with them. Round the eyes the layer sinks
 * under the bone. Its colour is taken from the nearest surface muscle.
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
// (The face surface below now covers the head; of the per-part layers only the ears remain, which stay outside it.
// The rest of the list is kept switchable: FACE_LAYERS=all builds them all, as for "fill in his whole face".)
const ALL = [
  "Frontal_bone", "Occipital_bone", "Sphenoid_bone", "Mandible", "Septal_nasal_cartilage", "External_ear",
  ...["parietal_bone", "temporal_bone", "zygomatic_bone", "maxilla", "nasal_bone", "lacrimal_bone", "lateral_nasal_cartilage", "major_alar_cartilage"].flatMap((n) => [`Left_${n}`, `Right_${n}`]),
];
const FILL = process.env.FACE_LAYERS === "all" ? ALL : ["External_ear"];
/** Thin parts (ears, nose cartilage): only coloured, with a fixed small lift, so their shape stays as it is. */
const THIN = /ear$|cartilage$/i;
const mm = 0.001;
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

// Every part's vertices (world frame), with their neighbours: along the part's own edges, and, so the layer is one
// continuous surface where two bones meet, any vertex of another part within 3 mm that faces the same way.
type Part = { name: string; mesh: THREE.Mesh; first: number; count: number };
const parts: Part[] = [];
const P: THREE.Vector3[] = [], N: THREE.Vector3[] = [], root: number[] = [];
const nbr: Set<number>[] = [];
for (const name of FILL) {
  const m = meshes.find((x) => x.name === name);
  if (!m) throw new Error(`no part named ${name}`);
  const g = m.geometry;
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const first = P.length;
  const normalW = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
  for (let i = 0; i < pos.count; i++) {
    P.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
    N.push(new THREE.Vector3().fromBufferAttribute(nor, i).applyMatrix3(normalW).normalize());
    nbr.push(new Set());
  }
  // (Vertices that share a position are welded: the part may be split at seams.)
  const key = (v: THREE.Vector3) => `${Math.round(v.x / 1e-5)},${Math.round(v.y / 1e-5)},${Math.round(v.z / 1e-5)}`;
  const weld = new Map<string, number>();
  for (let i = first; i < P.length; i++) root.push(weld.get(key(P[i]!)) ?? (weld.set(key(P[i]!), i), i));
  const idx = g.index;
  for (let t = 0; t < (idx ? idx.count : pos.count); t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => root[first + (idx ? idx.getX(t + k) : t + k)]!);
    nbr[a!]!.add(b!).add(c!);
    nbr[b!]!.add(a!).add(c!);
    nbr[c!]!.add(a!).add(b!);
  }
  parts.push({ name, mesh: m, first, count: pos.count });
}
const partOf = new Int32Array(P.length);
parts.forEach((pt, k) => partOf.fill(k, pt.first, pt.first + pt.count));
{
  const CELL = 3 * mm;
  const grid = new Map<string, number[]>();
  const cell = (v: THREE.Vector3, dx = 0, dy = 0, dz = 0) => `${Math.floor(v.x / CELL) + dx},${Math.floor(v.y / CELL) + dy},${Math.floor(v.z / CELL) + dz}`;
  for (let i = 0; i < P.length; i++) if (root[i] === i) (grid.get(cell(P[i]!)) ?? grid.set(cell(P[i]!), []).get(cell(P[i]!))!).push(i);
  for (let i = 0; i < P.length; i++) {
    if (root[i] !== i) continue;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const j of grid.get(cell(P[i]!, dx, dy, dz)) ?? [])
            if (partOf[j] !== partOf[i] && P[i]!.distanceTo(P[j]!) < CELL && N[i]!.dot(N[j]!) > 0.5) nbr[i]!.add(j);
  }
}

// Where muscles lie over the bone (along the normal), the layer rises to just under the top of them.
const ray = new THREE.Ray();
const bothSides = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const lift = new Float64Array(P.length);
const fixed = new Uint8Array(P.length);
const thin = (i: number) => THIN.test(parts[partOf[i]!]!.name);
for (let i = 0; i < P.length; i++) {
  if (root[i] !== i || thin(i)) continue;
  ray.origin.copy(P[i]!).addScaledVector(N[i]!, 0.05 * mm);
  ray.direction.copy(N[i]!);
  const hits = bvh.raycast(ray, bothSides, 0, 25 * mm).sort((a, b) => a.distance - b.distance);
  if (hits.length) {
    const top = hits.filter((h) => h.distance <= hits[0]!.distance + 14 * mm).at(-1)!.distance;
    lift[i] = Math.max(0.3 * mm, top - 0.8 * mm);
    fixed[i] = 1;
  }
}
// Bare bone: smoothly between the muscles around it (harmonic fill), at least 0.6 mm, at most 12 mm.
for (let i = 0; i < P.length; i++) if (root[i] === i && !fixed[i]) lift[i] = 1.5 * mm;
for (let it = 0; it < 600; it++)
  for (let i = 0; i < P.length; i++) {
    if (root[i] !== i || fixed[i] || !nbr[i]!.size) continue;
    let s = 0;
    for (const j of nbr[i]!) s += lift[j]!;
    lift[i] = s / nbr[i]!.size;
  }

// Colour: the nearest surface muscle's, turning to the muscles' usual red away from them (the top of the head is far
// from any muscle, and the muscles' edges are lighter where they turn to tendon).
const BASE = new THREE.Vector3();
for (let v = 0; v < mCol.count; v++) BASE.add(new THREE.Vector3(mCol.getX(v), mCol.getY(v), mCol.getZ(v)));
BASE.multiplyScalar(1 / mCol.count);
const colours = P.map((p) => {
  const near = surfaceBvh.closestPointToPoint(p)!;
  const c = new THREE.Vector3();
  for (let k = 0; k < 3; k++) {
    const v = mIdx.getX(near.faceIndex! * 3 + k);
    c.add(new THREE.Vector3(mCol.getX(v), mCol.getY(v), mCol.getZ(v)).multiplyScalar(1 / 3));
  }
  return c.lerp(BASE, smooth(2 * mm, 10 * mm, near.distance));
});
// (Soften the colour a little across the layer, so it reads as one surface.)
for (let it = 0; it < 4; it++) {
  const next = colours.map((c, i) => {
    const s = c.clone();
    for (const j of nbr[root[i]!]!) s.add(colours[j]!);
    return s.multiplyScalar(1 / (1 + nbr[root[i]!]!.size));
  });
  colours.splice(0, colours.length, ...next);
}

const entries: { source: string; count: number; offset: number }[] = [];
const blocks: Buffer[] = [];
let byteOffset = 0;
const target = new THREE.Vector3();
for (const { name, mesh, first, count: n } of parts) {
  // Round the eyes the layer sinks under the bone.
  const out = Buffer.alloc(n * 15);
  const inv = mesh.matrixWorld.clone().invert();
  for (let i = 0; i < n; i++) {
    const r = root[first + i]!;
    const p = P[r]!;
    eyeBvh.closestPointToPoint(p, { point: target } as never);
    const face = smooth(EYE_CLEAR, EYE_CLEAR + 2.5 * mm, p.distanceTo(target));
    const l = thin(r) ? 0.35 * mm : THREE.MathUtils.clamp(lift[r]!, fixed[r] ? 0 : 0.6 * mm, 12 * mm);
    const w = p.clone().addScaledVector(N[first + i]!, THREE.MathUtils.lerp(-1.5 * mm, l, face)).applyMatrix4(inv);
    out.writeFloatLE(w.x, i * 12);
    out.writeFloatLE(w.y, i * 12 + 4);
    out.writeFloatLE(w.z, i * 12 + 8);
    // Colours are stored as bytes of their square root (more steps in the dark reds); the viewer squares them back.
    const c = colours[r]!;
    out[n * 12 + i * 3] = Math.round(Math.sqrt(c.x) * 255);
    out[n * 12 + i * 3 + 1] = Math.round(Math.sqrt(c.y) * 255);
    out[n * 12 + i * 3 + 2] = Math.round(Math.sqrt(c.z) * 255);
  }
  const own = [...Array(n).keys()].map((i) => first + i).filter((i) => root[i] === i);
  console.log(`${name.padEnd(32)} ${n} vertices, ${own.filter((i) => fixed[i]).length} under muscle, ${own.filter((i) => !fixed[i]).length} bare`);
  entries.push({ source: name, count: n, offset: byteOffset });
  blocks.push(out);
  byteOffset += out.length;
}

// ---------------------------------------------------------------------------------------------------------------
// The face itself (owner's request: "give him a face"): one smooth red surface over the whole head, shrink-wrapped
// round it, so the face reads as a face (forehead, brows, nose, cheeks, lips, chin) instead of separate muscles. The
// eyes show through openings; the ears stay outside it.
//
// It is built on a sphere of directions round the centre of the head: along each direction, the outermost surface of
// the head (muscles, bones, cartilage; not the ears or teeth). The grooves between the muscles are closed (a
// morphological closing over 7 mm, then a blur, never less than 1 mm above the surface underneath), and it ends at the neck,
// tucked in under itself.
const C = new THREE.Vector3(0, 1.605, 0.01);
const STEP = 0.0105; // radians: about 1 mm at the head's radius
const headParts = meshes.filter((m) => head(m) && m.visible && !/_tooth$|External_ear/.test(m.name) && new THREE.Box3().setFromObject(m).min.y > 1.40);
const isEye = (m: THREE.Mesh) => /(sclera|cornea)$/.test(m.name);
const headGeoms = headParts.map((m) => {
  const g = worldGeometry(m);
  g.setAttribute("eye", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count).fill(isEye(m) ? 1 : 0), 1));
  return g;
});
const headAll = mergeGeometries(headGeoms, false)!;
const headBvh = new MeshBVH(headAll);
const eyeAttr = headAll.getAttribute("eye");
const NT = Math.round((2 * Math.PI) / STEP), NP = Math.round(2.45 / STEP);
const dir = (t: number, p: number) => new THREE.Vector3(Math.sin(p) * Math.sin((t * 2 * Math.PI) / NT), Math.cos(p), Math.sin(p) * Math.cos((t * 2 * Math.PI) / NT));
// (Eye openings only where the eyes are: a ray that reaches an eye from elsewhere, through a gap, is not one.)
const eyeBox = new THREE.Box3().setFromBufferAttribute(eyes.getAttribute("position") as THREE.BufferAttribute).expandByScalar(2 * mm);
const outer = new Float64Array(NT * NP).fill(NaN);
const eyeCell = new Uint8Array(NT * NP);
const R = 0.3;
for (let p = 0; p < NP; p++)
  for (let t = 0; t < NT; t++) {
    const d = dir(t, (p + 0.5) * STEP);
    ray.origin.copy(C).addScaledVector(d, R);
    ray.direction.copy(d).negate();
    const hit = headBvh.raycastFirst(ray, bothSides, 0, R);
    if (!hit) continue;
    outer[p * NT + t] = R - hit.distance;
    if (eyeAttr.getX(headAll.index!.getX(hit.faceIndex! * 3)) > 0.5 && eyeBox.containsPoint(hit.point) && hit.point.z > 0.07) eyeCell[p * NT + t] = 1;
  }
// A ray that slips through a hairline gap between two skull bones finds nothing behind it: such a spot takes the
// height of the surface round it.
for (let pass = 0; pass < 3; pass++)
  for (let p = 1; p < NP - 1; p++)
    for (let t = 0; t < NT; t++) {
      if (!Number.isNaN(outer[p * NT + t]!)) continue;
      let s = 0, k = 0;
      for (let dp = -1; dp <= 1; dp++)
        for (let dt = -1; dt <= 1; dt++) {
          const v = outer[(p + dp) * NT + (((t + dt) % NT) + NT) % NT]!;
          if (!Number.isNaN(v)) {
            s += v;
            k++;
          }
        }
      if (k >= 5) outer[p * NT + t] = s / k;
    }
const at = (a: Float64Array, p: number, t: number) => a[THREE.MathUtils.clamp(p, 0, NP - 1) * NT + ((t % NT) + NT) % NT]!;
// Closing (dilate, then erode) over a disc of about 4 mm, measured on the sphere.
const disc = (p: number, fn: (q: number, u: number) => void) => {
  const rad = 7;
  for (let dp = -rad; dp <= rad; dp++) {
    const q = p + dp;
    if (q < 0 || q >= NP) continue;
    const span = Math.min(NT / 2, Math.ceil(rad / Math.max(0.15, Math.sin((q + 0.5) * STEP))));
    for (let dt = -span; dt <= span; dt++) {
      const s = Math.sin((q + 0.5) * STEP) * dt;
      if (dp * dp + s * s <= rad * rad) fn(q, dt);
    }
  }
};
const filled = Float64Array.from(outer, (v) => (Number.isNaN(v) ? 0 : v));
const dil = new Float64Array(NT * NP), clo = new Float64Array(NT * NP);
for (let p = 0; p < NP; p++)
  for (let t = 0; t < NT; t++) {
    let m = 0;
    disc(p, (q, dt) => (m = Math.max(m, at(filled, q, t + dt))));
    dil[p * NT + t] = m;
  }
for (let p = 0; p < NP; p++)
  for (let t = 0; t < NT; t++) {
    let m = Infinity;
    disc(p, (q, dt) => (m = Math.min(m, at(dil, q, t + dt))));
    clo[p * NT + t] = m;
  }
// Round off steps (the top edge of the forehead muscle, the edges of the cheek muscles): blur that only ever raises.
let rr = clo;
for (let it = 0; it < 10; it++) {
  const next = new Float64Array(NT * NP);
  for (let p = 0; p < NP; p++)
    for (let t = 0; t < NT; t++) {
      const v = (at(rr, p - 1, t) + at(rr, p + 1, t) + at(rr, p, t - 1) + at(rr, p, t + 1)) / 4;
      next[p * NT + t] = Math.max(at(rr, p, t), v);
    }
  rr = next;
}
// Blur, never below the surface underneath (+1 mm).
for (let it = 0; it < 10; it++) {
  const next = new Float64Array(NT * NP);
  for (let p = 0; p < NP; p++)
    for (let t = 0; t < NT; t++) {
      const v = (2 * at(rr, p, t) + at(rr, p - 1, t) + at(rr, p + 1, t) + at(rr, p, t - 1) + at(rr, p, t + 1)) / 6;
      const o = outer[p * NT + t]!;
      next[p * NT + t] = Number.isNaN(o) ? v : Math.max(v, o + 1 * mm);
    }
  rr = next;
}
// Where it ends: the neck (below y = 1.495) and directions that miss the head. Cells next to the edge tuck in by 2 mm.
const keep = new Uint8Array(NT * NP);
const pos = (p: number, t: number, r: number) => dir(t, (p + 0.5) * STEP).multiplyScalar(r).add(C);
for (let p = 0; p < NP; p++)
  for (let t = 0; t < NT; t++) {
    const o = outer[p * NT + t]!;
    if (!Number.isNaN(o) && pos(p, t, rr[p * NT + t]!).y >= 1.495) keep[p * NT + t] = 1;
  }
const edgeDist = new Float64Array(NT * NP).fill(99);
for (let p = 0; p < NP; p++)
  for (let t = 0; t < NT; t++)
    if (keep[p * NT + t])
      for (let dp = -3; dp <= 3; dp++)
        for (let dt = -3; dt <= 3; dt++) {
          const q = p + dp;
          if (q >= 0 && q < NP && !keep[q * NT + (((t + dt) % NT) + NT) % NT]) edgeDist[p * NT + t] = Math.min(edgeDist[p * NT + t]!, Math.hypot(dp, dt));
        }
// Skin weights: those of the nearest vertex of the file (so the neck end bends with the neck).
const skinMeta = JSON.parse(readFileSync("public/anatomy/ecorche-skin.json", "utf8"));
const skinBin = readFileSync("public/anatomy/ecorche-skin.bin");
const offsetOf = new Map<string, number>(skinMeta.meshes.map((e: { name: string; offset: number }) => [e.name, e.offset]));
const vidGeoms = headParts.map((m) => {
  const g = worldGeometry(m);
  const base = offsetOf.get(m.name.replace(/_/g, " ")) ?? offsetOf.get(m.name)!;
  g.setAttribute("vid", new THREE.BufferAttribute(Float32Array.from({ length: g.getAttribute("position").count }, (_, i) => base + i), 1));
  return g;
});
const vidAll = mergeGeometries(vidGeoms, false)!;
const vidBvh = new MeshBVH(vidAll);
const vidAttr = vidAll.getAttribute("vid");
const vIndex = new Int32Array(NT * NP).fill(-1);
const vPos: number[] = [], vCol: number[] = [], vSkin: number[] = [];
for (let p = 0; p < NP; p++)
  for (let t = 0; t < NT; t++) {
    const c = p * NT + t;
    if (!keep[c] || eyeCell[c]) continue;
    const tuck = smooth(0, 3, edgeDist[c]!);
    const w = pos(p, t, rr[c]! - (1 - tuck) * 2 * mm);
    vIndex[c] = vPos.length / 3;
    vPos.push(w.x, w.y, w.z);
    const col = BASE.clone();
    vCol.push(...[col.x, col.y, col.z].map((x) => Math.round(Math.sqrt(x) * 255)));
    const near = vidBvh.closestPointToPoint(w)!;
    const vid = Math.round(vidAttr.getX(vidAll.index!.getX(near.faceIndex! * 3)));
    for (let k = 0; k < 8; k++) vSkin.push(skinBin[vid * 8 + k]!);
  }
const tri: number[] = [];
for (let p = 0; p < NP - 1; p++)
  for (let t = 0; t < NT; t++) {
    const a = vIndex[p * NT + t]!, b = vIndex[p * NT + ((t + 1) % NT)]!, c = vIndex[(p + 1) * NT + t]!, d = vIndex[(p + 1) * NT + ((t + 1) % NT)]!;
    // (Outward-facing winding.)
    if (a >= 0 && c >= 0 && b >= 0) tri.push(a, c, b);
    if (b >= 0 && c >= 0 && d >= 0) tri.push(b, c, d);
  }
const nv = vPos.length / 3;
const shellBuf = Buffer.alloc(nv * 12 + nv * 3 + nv * 8 + tri.length * 4);
new Float32Array(shellBuf.buffer, shellBuf.byteOffset, nv * 3).set(vPos);
shellBuf.set(vCol, nv * 12);
shellBuf.set(vSkin, nv * 15);
for (let i = 0; i < tri.length; i++) shellBuf.writeUInt32LE(tri[i]!, nv * 23 + i * 4);
const shell = { vertices: nv, triangles: tri.length / 3, offset: byteOffset };
blocks.push(shellBuf);
byteOffset += shellBuf.length;
console.log(`face surface: ${nv} vertices, ${tri.length / 3} triangles`);

writeFileSync("public/anatomy/ecorche-face.bin", Buffer.concat(blocks));
writeFileSync(
  "public/anatomy/ecorche-face.json",
  JSON.stringify({
    source: "Filled-in face for public/anatomy/ecorche.glb (scripts/anatomy/build-ecorche-face.mts)",
    hide: meshes.filter((m) => /_tooth$/.test(m.name)).map((m) => m.name),
    layers: entries,
    // The face surface: positions (float32 ×3, file frame), colours (3 bytes, square-root coded), skin weights (4 bone
    // indices, 4 weights), then triangles (uint32 ×3), from `offset`.
    shell,
  }),
);
console.log(`wrote public/anatomy/ecorche-face.bin (${(byteOffset / 1e3).toFixed(0)} kB) and ecorche-face.json`);
