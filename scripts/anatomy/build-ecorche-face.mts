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
import { join } from "node:path";
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
const FILL = process.env.FACE_LAYERS === "all" ? ALL : [];
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

/** Least-squares affine map from pairs (p → q), as rows [a b c t]. */
const fitAffine = (P: number[][], Q: number[][]) => {
  const N = Array.from({ length: 4 }, () => new Array(4).fill(0));
  const B = Array.from({ length: 4 }, () => new Array(3).fill(0));
  for (let n = 0; n < P.length; n++) {
    const h = [...P[n]!, 1];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) N[i]![j]! += h[i]! * h[j]!;
      for (let c = 0; c < 3; c++) B[i]![c]! += h[i]! * Q[n]![c]!;
    }
  }
  const aug = N.map((r, i) => [...r, ...B[i]!]);
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(aug[r]![c]!) > Math.abs(aug[p]![c]!)) p = r;
    [aug[c], aug[p]] = [aug[p]!, aug[c]!];
    const d = aug[c]![c]!;
    for (let j = 0; j < 7; j++) aug[c]![j]! /= d;
    for (let r = 0; r < 4; r++)
      if (r !== c) {
        const f = aug[r]![c]!;
        for (let j = 0; j < 7; j++) aug[r]![j]! -= f * aug[c]![j]!;
      }
  }
  return [0, 1, 2].map((c) => [aug[0]![4 + c]!, aug[1]![4 + c]!, aug[2]![4 + c]!, aug[3]![4 + c]!]);
};
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
// The face (owner's requests: "give him a face", "give a actual face like appearance", "his eyes look weird"): the
// head's skin surface from BodyParts3D, the anatomy the model's bones come from (CC BY 4.0, credited with the model).
// It is a real person's face, shaped over this skull: eyes, lids, nose, lips, chin and ears as they are, so it reads as
// an actual face (in gold, a bust). It is fitted onto the model's skull (BodyParts3D's skull bones onto the file's,
// by an affine fit on nearest points), lightly smoothed (the scan is faceted), and cut at the middle of the neck,
// tucked in under itself. The parts of the file it covers entirely (skull, face muscles, eyes, teeth) are hidden; the
// ears stay (the skin surface has none).
const BP3D = process.argv[2] ?? process.env.BP3D;
if (!BP3D) throw new Error("usage: build-ecorche-face.mts <BodyParts3D_data folder> (git clone https://github.com/Kevin-Mattheus-Moerman/BodyParts3D; assets/BodyParts3D_data)");
/** An STL's triangles (millimetres, z up). */
const stl = (id: string) => {
  const b = readFileSync(join(BP3D, "stl", `${id}.stl`));
  const n = b.readUInt32LE(80);
  const f = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) for (let k = 0; k < 9; k++) f[i * 9 + k] = b.readFloatLE(84 + i * 50 + 12 + k * 4);
  return f;
};
// The skull, in both: BodyParts3D's bones and the file's.
const SKULL_BP3D = ["FMA52734", "FMA52735", "FMA52748", "FMA52738", "FMA52739", "FMA52788", "FMA52789", "FMA52892", "FMA52893", "FMA53649", "FMA53650"];
const SKULL_FILE = /^(Frontal_bone|Occipital_bone|Mandible|(Left|Right)_(temporal_bone|parietal_bone|zygomatic_bone|maxilla))$/;
const bpSkull: THREE.Vector3[] = [];
for (const id of SKULL_BP3D) {
  const f = stl(id);
  for (let i = 0; i < f.length; i += 9) bpSkull.push(new THREE.Vector3(f[i], f[i + 1], f[i + 2]));
}
const fileSkull: THREE.Vector3[] = [];
for (const m of meshes.filter((x) => SKULL_FILE.test(x.name))) {
  const pa = worldGeometry(m).getAttribute("position");
  for (let i = 0; i < pa.count; i++) fileSkull.push(new THREE.Vector3().fromBufferAttribute(pa, i));
}
// Start: BodyParts3D is in mm with z up and the face towards -y; the file is in metres with y up and the face towards
// +z (checked below from where the face is), centres and heights matched.
const box = (pts: THREE.Vector3[]) => new THREE.Box3().setFromPoints(pts);
const bb = box(bpSkull), fb = box(fileSkull);
const bc = bb.getCenter(new THREE.Vector3()), fc = fb.getCenter(new THREE.Vector3());
const faceSign = (() => {
  const maxilla = stl("FMA53649");
  let y = 0;
  for (let i = 1; i < maxilla.length; i += 3) y += maxilla[i]!;
  return y / (maxilla.length / 3) < bc.y ? -1 : 1; // the face is on this side of y
})();
const k0 = (fb.max.y - fb.min.y) / (bb.max.z - bb.min.z);
// file = A · bp + t; rows of A: x' = k·x·sx, y' = k·z, z' = k·y·faceSign (sx keeps the handedness: a mirror if needed).
const handed = -faceSign; // x' × y' = z' must hold with the face on +z
let A = [
  [k0 * handed, 0, 0, 0],
  [0, 0, k0, 0],
  [0, k0 * faceSign, 0, 0],
];
const applyA = (a: number[][], v: THREE.Vector3) => new THREE.Vector3(...(a.map((r) => r[0]! * v.x + r[1]! * v.y + r[2]! * v.z + r[3]!) as [number, number, number]));
{
  const c = applyA(A, bc);
  for (let r = 0; r < 3; r++) A[r]![3] = [fc.x, fc.y, fc.z][r]! - [c.x, c.y, c.z][r]!;
}
// Fit: affine least squares on nearest points, 20 rounds.
const fileCloud = new THREE.BufferGeometry().setFromPoints(fileSkull);
const cloudIndex = new Map<string, number[]>();
const CELL = 0.004;
const ck = (v: THREE.Vector3, dx = 0, dy = 0, dz = 0) => `${Math.floor(v.x / CELL) + dx},${Math.floor(v.y / CELL) + dy},${Math.floor(v.z / CELL) + dz}`;
fileSkull.forEach((v, i) => (cloudIndex.get(ck(v)) ?? cloudIndex.set(ck(v), []).get(ck(v))!).push(i));
const nearestFile = (q: THREE.Vector3) => {
  let best = -1, bd = Infinity;
  for (let dx = -2; dx <= 2; dx++)
    for (let dy = -2; dy <= 2; dy++)
      for (let dz = -2; dz <= 2; dz++)
        for (const i of cloudIndex.get(ck(q, dx, dy, dz)) ?? []) {
          const d = fileSkull[i]!.distanceToSquared(q);
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
  return best < 0 ? null : { p: fileSkull[best]!, d: Math.sqrt(bd) };
};
const sample = bpSkull.filter((_, i) => i % Math.max(1, Math.floor(bpSkull.length / 20000)) === 0);
for (let it = 0; it < 20; it++) {
  const P: number[][] = [], Q: number[][] = [];
  let sum = 0;
  for (const v of sample) {
    const q = applyA(A, v);
    const n = nearestFile(q);
    if (!n || n.d > 0.01) continue;
    sum += n.d;
    P.push([v.x, v.y, v.z]);
    Q.push([n.p.x, n.p.y, n.p.z]);
  }
  A = fitAffine(P, Q);
  if (it % 5 === 4 || it === 19) console.log(`skull fit ${it + 1}: mean distance ${((sum / P.length) * 1000).toFixed(2)} mm over ${P.length} points`);
}
fileCloud.dispose();

// The skin of the head and neck, in the file's frame: welded, lightly smoothed (Taubin, keeps the shape), cut at the
// middle of the neck.
const skinTris = stl("FMA7163");
let topZ = -Infinity;
for (let i = 2; i < skinTris.length; i += 3) topZ = Math.max(topZ, skinTris[i]!);
const CUT = 1.465, TUCK = 0.006;
const vmap = new Map<string, number>();
const verts: THREE.Vector3[] = [];
const faces: number[] = [];
for (let i = 0; i < skinTris.length; i += 9) {
  if (skinTris[i + 2]! < topZ - 330 || skinTris[i + 5]! < topZ - 330 || skinTris[i + 8]! < topZ - 330) continue;
  const ids = [0, 1, 2].map((k) => {
    const x = skinTris[i + k * 3]!, y = skinTris[i + k * 3 + 1]!, z = skinTris[i + k * 3 + 2]!;
    const key = `${Math.round(x * 1e3)},${Math.round(y * 1e3)},${Math.round(z * 1e3)}`;
    let id = vmap.get(key);
    if (id === undefined) {
      id = verts.length;
      vmap.set(key, id);
      verts.push(applyA(A, new THREE.Vector3(x, y, z)));
    }
    return id;
  });
  if (ids[0] !== ids[1] && ids[1] !== ids[2] && ids[0] !== ids[2]) faces.push(...ids);
}
const adj = verts.map(() => new Set<number>());
for (let i = 0; i < faces.length; i += 3)
  for (let k = 0; k < 3; k++) {
    adj[faces[i + k]!]!.add(faces[i + ((k + 1) % 3)]!);
    adj[faces[i + k]!]!.add(faces[i + ((k + 2) % 3)]!);
  }
for (let it = 0; it < 20; it++)
  for (const f of [0.5, -0.53]) {
    const next = verts.map((v, i) => {
      if (!adj[i]!.size) return v.clone();
      const avg = new THREE.Vector3();
      for (const j of adj[i]!) avg.add(verts[j]!);
      avg.multiplyScalar(1 / adj[i]!.size);
      return v.clone().lerp(avg, f);
    });
    next.forEach((v, i) => verts[i]!.copy(v));
  }
// Normals (for the small outward lift and the tuck), then the cut.
const sg = new THREE.BufferGeometry().setFromPoints(verts);
sg.setIndex(faces);
sg.computeVertexNormals();
const sn = sg.getAttribute("normal");
const keepV = verts.map((v) => v.y >= CUT);
const newId = new Int32Array(verts.length).fill(-1);
const vPos: number[] = [], vCol: number[] = [], vSkin: number[] = [];
// Skin weights: those of the nearest vertex of the file (so the neck end bends with the neck).
const skinMeta = JSON.parse(readFileSync("public/anatomy/ecorche-skin.json", "utf8"));
const skinBin = readFileSync("public/anatomy/ecorche-skin.bin");
const offsetOf = new Map<string, number>(skinMeta.meshes.map((e: { name: string; offset: number }) => [e.name, e.offset]));
const near = meshes.filter((m) => new THREE.Box3().setFromObject(m).max.y > 1.4);
const vidAll = mergeGeometries(
  near.map((m) => {
    const g = worldGeometry(m);
    const base = offsetOf.get(m.name) ?? offsetOf.get(m.name.replace(/_/g, " "))!;
    g.setAttribute("vid", new THREE.BufferAttribute(Float32Array.from({ length: g.getAttribute("position").count }, (_, i) => base + i), 1));
    return g;
  }),
  false,
)!;
const vidBvh = new MeshBVH(vidAll);
const vidAttr = vidAll.getAttribute("vid");
verts.forEach((v, i) => {
  if (!keepV[i]) return;
  // 0.8 mm out, so nothing of the model under the skin shows through; near the cut it tucks in under itself.
  const lift = 0.8 * mm - 2.5 * mm * (1 - smooth(CUT, CUT + TUCK, v.y));
  const w = v.clone().addScaledVector(new THREE.Vector3().fromBufferAttribute(sn, i), lift);
  newId[i] = vPos.length / 3;
  vPos.push(w.x, w.y, w.z);
  vCol.push(...[BASE.x, BASE.y, BASE.z].map((x) => Math.round(Math.sqrt(x) * 255)));
  const hit = vidBvh.closestPointToPoint(w)!;
  const vid = Math.round(vidAttr.getX(vidAll.index!.getX(hit.faceIndex! * 3)));
  for (let k = 0; k < 8; k++) vSkin.push(skinBin[vid * 8 + k]!);
});
const tri: number[] = [];
for (let i = 0; i < faces.length; i += 3) {
  const [a, b, c] = [faces[i]!, faces[i + 1]!, faces[i + 2]!].map((x) => newId[x]!);
  if (a! >= 0 && b! >= 0 && c! >= 0) tri.push(a!, b!, c!);
}
// The file's parts the skin covers entirely (all of the part above the neck cut, a little above it): hidden.
// (Not the ears: the skin surface has none, so the model's own ears stay.)
const covered = meshes.filter((m) => !/External_ear/.test(m.name) && new THREE.Box3().setFromObject(m).min.y > CUT + 0.012).map((m) => m.name);
const nv = vPos.length / 3;
const shellBuf = Buffer.alloc(nv * 12 + nv * 3 + nv * 8 + tri.length * 4);
new Float32Array(shellBuf.buffer, shellBuf.byteOffset, nv * 3).set(vPos);
shellBuf.set(vCol, nv * 12);
shellBuf.set(vSkin, nv * 15);
for (let i = 0; i < tri.length; i++) shellBuf.writeUInt32LE(tri[i]!, nv * 23 + i * 4);
const shell = { vertices: nv, triangles: tri.length / 3, offset: byteOffset };
blocks.push(shellBuf);
byteOffset += shellBuf.length;
console.log(`face (skin of the head): ${nv} vertices, ${tri.length / 3} triangles; ${covered.length} parts of the file covered`);

writeFileSync("public/anatomy/ecorche-face.bin", Buffer.concat(blocks));
writeFileSync(
  "public/anatomy/ecorche-face.json",
  JSON.stringify({
    source: "Filled-in face for public/anatomy/ecorche.glb (scripts/anatomy/build-ecorche-face.mts)",
    hide: [...new Set([...meshes.filter((m) => /_tooth$/.test(m.name)).map((m) => m.name), ...covered])],
    layers: entries,
    // The face surface: positions (float32 ×3, file frame), colours (3 bytes, square-root coded), skin weights (4 bone
    // indices, 4 weights), then triangles (uint32 ×3), from `offset`.
    shell,
  }),
);
console.log(`wrote public/anatomy/ecorche-face.bin (${(byteOffset / 1e3).toFixed(0)} kB) and ecorche-face.json`);
