/**
 * Builds the gold anatomical athlete (public/anatomy/athlete.bin + .json) from the BodyParts3D anatomy database.
 *
 *   npx tsx scripts/anatomy/build-athlete.mts <BodyParts3D_data dir> && npx tsx scripts/anatomy/reweight.mts
 *
 * The data directory is BodyParts3D 3.0 converted to STL (https://github.com/Kevin-Mattheus-Moerman/BodyParts3D,
 * assets/BodyParts3D_data). It isn't checked in (about 0.5 GB); only the derived mesh is.
 * Licence: "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1
 * Japan". The derived athlete mesh carries the same licence (see public/anatomy/LICENSE.md).
 *
 * The athlete is an écorché, like an anatomy-atlas figure: every superficial muscle is its own real, separately
 * shaped mesh (so the muscles, and the grooves between them, are actually there), with the bones, cartilage and
 * tendons that show at the surface (kneecaps, shins, collarbones, ribs, spine, iliotibial band, Achilles tendon).
 * The scanned skin is kept only for the face, hands and feet. A dark fascia layer just under the muscles fills the
 * gaps, and a small smooth cover sits over the pelvis.
 *
 * Joint centres are measured from the bones (femoral and humeral heads by sphere fit, knee, ankle, elbow and wrist
 * from the joint surfaces) and written to src/lib/anatomy3d/athlete-bind.generated.ts.
 *
 * Écorché (github.com/Charleeh/ecorche, CC BY-SA 4.0: BodyParts3D cleaned up, with the Z-Anatomy abdominal wall,
 * lats and back), aligned to the BodyParts3D skeleton, which still gives the joints, skin, hands and feet:
 *   ECORCHE=<path to ecorche.glb> ECORCHE_USE=torso   the torso and back muscles from Écorché (the athlete as built)
 *   ECORCHE=<path to ecorche.glb>                     every muscle, tendon and bone from Écorché (evaluation build,
 *                                                     written to public/anatomy/athlete-eco unless ATHLETE_OUT is set)
 *   ECORCHE=<path to ecorche.glb> ECORCHE_USE=raw     the Écorché model itself, unaltered (public/anatomy/athlete-raw):
 *                                                     every mesh with its own geometry, proportions and colours, its
 *                                                     own head, eyes and teeth; only the rig, the shorts and the muscle
 *                                                     labels for the glow are added. No skin, fascia, sculpting or
 *                                                     athletic proportions, and its own (unwidened) joints.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MeshoptSimplifier } from "meshoptimizer";
import * as THREE from "three";
import { BONES, muscleId, NO_MUSCLE, REGION_COUNT, REGIONS, TISSUE, type BoneName, type Region } from "../../src/lib/anatomy3d/muscle-ids";
import { kindOf, regionOf, sideOf, type PartKind } from "./bp3d-regions";
import { buildMakeHumanHead } from "./makehuman-head";
import { closedEnvelope } from "./shorts-envelope";
import { fitShorts } from "./shorts-fit";
import { computeWeights, LIMB, LIMB_CODE, NO_BONE } from "./weights";

type V3 = [number, number, number];
const DATA = process.argv[2];
if (!DATA || !existsSync(join(DATA, "parts_list_e.txt"))) {
  console.error("usage: npx tsx scripts/anatomy/build-athlete.mts <BodyParts3D_data dir>");
  process.exit(1);
}
const HEIGHT = 183; // cm, matching the 2D motion figure
const ECORCHE = process.env.ECORCHE;
/** Which muscles come from Écorché: "torso" (chest, abdomen and back) or "all" (every muscle, tendon and bone). */
const ECORCHE_USE = process.env.ECORCHE_USE === "torso" || process.env.ECORCHE_USE === "raw" ? process.env.ECORCHE_USE : "all";
/** The raw Écorché athlete (ECORCHE_USE=raw). */
const RAW = !!ECORCHE && ECORCHE_USE === "raw";
/** Shorts: always on the gold athlete; on the raw Écorché athlete only with ECORCHE_SHORTS=1 (by default it is shown
 *  exactly as published, with nothing covered or cut away). */
const SHORTS = !RAW || process.env.ECORCHE_SHORTS === "1";
const OUT =
  process.env.ATHLETE_OUT ?? (RAW ? "public/anatomy/athlete-raw" : ECORCHE && ECORCHE_USE === "all" ? "public/anatomy/athlete-eco" : "public/anatomy/athlete");
/** The shipped joint file is written only by the build that ships (the skeleton, and so the joints, is the same). */
const WRITE_BIND = OUT === "public/anatomy/athlete";
await MeshoptSimplifier.ready;

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const lerp = (a: V3, b: V3, t: number): V3 => add(a, mul(sub(b, a), t));
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- loading
const names = new Map<string, string>();
for (const line of readFileSync(join(DATA, "parts_list_e.txt"), "utf8").split("\n").slice(1)) {
  const [id, name] = line.trim().split("\t");
  if (id && name) names.set(id, name);
}
const idOf = (name: string) => [...names].find(([, n]) => n === name)?.[0];
const stlPath = (id: string) => join(DATA, "stl", `${id}.stl`);

interface Mesh {
  pos: Float32Array;
  idx: Uint32Array;
}
let SCALE = 1;
const OFFSET: V3 = [0, 0, 0];
/** Reads a binary STL, welds it, and converts mm Z-up (-Y front, -X right) to cm Y-up (+X front, +Z right). */
function load(id: string): Mesh {
  const b = readFileSync(stlPath(id));
  const n = b.readUInt32LE(80);
  const map = new Map<string, number>();
  const pos: number[] = [];
  const idx: number[] = [];
  const t = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let v = 0; v < 3; v++) {
      const o = 84 + i * 50 + 12 + v * 12;
      const x = b.readFloatLE(o), y = b.readFloatLE(o + 4), z = b.readFloatLE(o + 8);
      const key = `${Math.round(x * 100)},${Math.round(y * 100)},${Math.round(z * 100)}`;
      let k = map.get(key);
      if (k === undefined) {
        k = pos.length / 3;
        map.set(key, k);
        pos.push((-y / 10) * SCALE + OFFSET[0], (z / 10) * SCALE + OFFSET[1], (-x / 10) * SCALE + OFFSET[2]);
      }
      t[v] = k;
    }
    if (t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]) idx.push(t[0]!, t[1]!, t[2]!);
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
function simplify(m: Mesh, targetTris: number, error = 0.02): Mesh {
  if (m.idx.length / 3 <= targetTris) return m;
  const [s] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, targetTris * 3, error, []);
  return compact(m.pos, s);
}
function compact(pos: Float32Array, idx: Uint32Array): Mesh {
  const remap = new Int32Array(pos.length / 3).fill(-1);
  const out: number[] = [];
  const ix = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) {
    let r = remap[idx[i]!]!;
    if (r < 0) {
      r = remap[idx[i]!] = out.length / 3;
      out.push(pos[idx[i]! * 3]!, pos[idx[i]! * 3 + 1]!, pos[idx[i]! * 3 + 2]!);
    }
    ix[i] = r;
  }
  return { pos: new Float32Array(out), idx: ix };
}
const vert = (m: Mesh, i: number): V3 => [m.pos[i * 3]!, m.pos[i * 3 + 1]!, m.pos[i * 3 + 2]!];
const verts = (m: Mesh) => Array.from({ length: m.pos.length / 3 }, (_, i) => vert(m, i));
const bbox = (ps: V3[]) => {
  const mn: V3 = [Infinity, Infinity, Infinity], mx: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of ps)
    for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k]!, p[k]!);
      mx[k] = Math.max(mx[k]!, p[k]!);
    }
  return { mn, mx };
};
const centroid = (ps: V3[]): V3 => mul(ps.reduce((s, p) => add(s, p), [0, 0, 0] as V3), 1 / Math.max(1, ps.length));

// Scale from the skin's height, then measure everything in the final frame.
{
  const raw = verts(load("FMA7163"));
  const { mn, mx } = bbox(raw);
  SCALE = HEIGHT / (mx[1] - mn[1]);
  OFFSET[1] = -mn[1] * SCALE;
}

// ---------------------------------------------------------------- joints, measured from the bones
function sphereFit(ps: V3[]): V3 {
  // x²+y²+z² = 2ax + 2by + 2cz + d, least squares.
  const A = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  const B = [0, 0, 0, 0];
  for (const p of ps) {
    const row = [2 * p[0], 2 * p[1], 2 * p[2], 1];
    const r = dot(p, p);
    for (let i = 0; i < 4; i++) {
      B[i]! += row[i]! * r;
      for (let j = 0; j < 4; j++) A[i]![j]! += row[i]! * row[j]!;
    }
  }
  // Gaussian elimination.
  for (let i = 0; i < 4; i++) {
    let p = i;
    for (let r = i + 1; r < 4; r++) if (Math.abs(A[r]![i]!) > Math.abs(A[p]![i]!)) p = r;
    [A[i], A[p]] = [A[p]!, A[i]!];
    [B[i], B[p]] = [B[p]!, B[i]!];
    for (let r = i + 1; r < 4; r++) {
      const f = A[r]![i]! / A[i]![i]!;
      for (let c = i; c < 4; c++) A[r]![c]! -= f * A[i]![c]!;
      B[r]! -= f * B[i]!;
    }
  }
  const x = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) {
    let s = B[i]!;
    for (let c = i + 1; c < 4; c++) s -= A[i]![c]! * x[c]!;
    x[i] = s / A[i]![i]!;
  }
  return [x[0]!, x[1]!, x[2]!];
}
const bone = (name: string) => verts(load(idOf(name)!));
type SideJ = { shoulder: V3; elbow: V3; wrist: V3; hand: V3; hip: V3; knee: V3; ankle: V3; heel: V3; ball: V3; toe: V3 };
const skinRaw = load("FMA7163");
const skinVerts = verts(skinRaw);
function measureSide(side: "right" | "left"): SideJ {
  const medial = (ps: V3[], top: number, band: number) => {
    const { mx } = bbox(ps);
    const head = ps.filter((p) => p[1] > mx[1] - top);
    const minAbsZ = Math.min(...head.map((p) => Math.abs(p[2])));
    return head.filter((p) => Math.abs(p[2]) < minAbsZ + band);
  };
  const femur = bone(`${side} femur`), tibia = bone(`${side} tibia`), talus = bone(`${side} talus`), calc = bone(`${side} calcaneus`);
  const humerus = bone(`${side} humerus`), radius = bone(`${side} radius`), ulna = bone(`${side} ulna`);
  const hip = sphereFit(medial(femur, 6, 4.5));
  const shoulder = sphereFit(medial(humerus, 4.5, 3.5));
  const fb = bbox(femur), tb = bbox(tibia);
  const plateau = centroid(tibia.filter((p) => p[1] > tb.mx[1] - 1.5));
  const knee: V3 = [plateau[0], (fb.mn[1] + tb.mx[1]) / 2 + 0.8, plateau[2]];
  const ta = bbox(talus);
  const dome = centroid(talus.filter((p) => p[1] > ta.mx[1] - 1));
  const ankle: V3 = [dome[0], ta.mx[1] - 1.2, dome[2]];
  const hb = bbox(humerus);
  const elbow = centroid(humerus.filter((p) => p[1] < hb.mn[1] + 2.5));
  elbow[1] = hb.mn[1] + 1.4;
  const wr = (ps: V3[]) => centroid(ps.filter((p) => p[1] < bbox(ps).mn[1] + 1.5));
  const wrist = lerp(wr(radius), wr(ulna), 0.4);
  const hand = add(wrist, mul(norm(sub(wrist, elbow)), 8));
  const sgn = side === "right" ? 1 : -1;
  const foot = skinVerts.filter((p) => p[1] < 3 && p[2] * sgn > 2);
  const fbx = bbox(foot);
  const heelX = bbox(calc).mn[0];
  const toeP = foot.reduce((a, p) => (p[0] > a[0] ? p : a));
  const heel: V3 = [heelX, 0.6, ankle[2]];
  const toe: V3 = [fbx.mx[0], 1.2, toeP[2]];
  const ball: V3 = [lerp(heel, toe, 0.76)[0], 0.6, lerp(ankle, toe, 0.7)[2]];
  return { shoulder, elbow, wrist, hand, hip, knee, ankle, heel, ball, toe };
}
let R = measureSide("right");
let L = measureSide("left");
// Centre the athlete between the hip joints.
const shift: V3 = [-(R.hip[0] + L.hip[0]) / 2, 0, -(R.hip[2] + L.hip[2]) / 2];
OFFSET[0] += shift[0];
OFFSET[2] += shift[2];
const moveSide = (s: SideJ): SideJ => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, add(v, shift)])) as SideJ;
R = moveSide(R);
L = moveSide(L);
const spine = (name: string) => add(centroid(bone(name)), [0, 0, 0]);
const c7 = spine("seventh cervical vertebra"), t1 = spine("first thoracic vertebra"), atlas = spine("atlas");
const pelvis: V3 = mul(add(R.hip, L.hip), 0.5);
const neckBase: V3 = [lerp(c7, t1, 0.5)[0] + 2.5, lerp(c7, t1, 0.5)[1], 0];
const neckTop: V3 = [atlas[0] + 1, atlas[1], 0];
const skinNow = verts(load("FMA7163"));
const headTopY = bbox(skinNow).mx[1];
const headTop: V3 = [neckTop[0] + 1, headTopY, 0];
const head: V3 = [neckTop[0] + 1.5, headTopY - 11, 0];
const mid: V3 = lerp(pelvis, neckBase, 25 / 56.5);
const BINDM = { pelvis, mid, neckBase, neckTop, head, headTop, R, L };
const r1 = (v: V3) => v.map((x) => Math.round(x * 10) / 10);
function writeBind() {
  writeFileSync(
    "src/lib/anatomy3d/athlete-bind.generated.ts",
    `// Generated by scripts/anatomy/build-athlete.mts from the BodyParts3D skeleton. Do not edit.\n` +
      `// Joint centres of the 3D athlete's rest pose, in centimetres (+X forward, +Y up, +Z the athlete's right).\n` +
      `type V3 = [number, number, number];\n` +
      `const v = (a: number[]) => a as V3;\n` +
      `export const MEASURED_BIND = {\n` +
      ["pelvis", "mid", "neckBase", "neckTop", "head", "headTop"].map((k) => `  ${k}: v(${JSON.stringify(r1(BINDM[k as "mid"]))}),\n`).join("") +
      (["R", "L"] as const)
        .map((s) => `  ${s}: {\n` + Object.entries(BINDM[s]).map(([k, val]) => `    ${k}: v(${JSON.stringify(r1(val))}),\n`).join("") + "  },\n")
        .join("") +
      `};\n`,
  );
}
if (WRITE_BIND) writeBind();
console.log("joints", JSON.stringify({ pelvis: r1(pelvis), neckBase: r1(neckBase), R: Object.fromEntries(Object.entries(R).map(([k, v]) => [k, r1(v)])) }));

// ---------------------------------------------------------------- parts
/** Extra thickness per region (cm), for an athletic build and to keep each muscle proud of the fascia layer. */
const BULK: Partial<Record<Region, number>> = {
  deltAnt: 0.25, deltLat: 0.3, deltPost: 0.2, biceps: 0.25, triceps: 0.2, pecUpper: 0.2, pecLower: 0.25, trapUpper: 0.2,
  rectusFemoris: 0.15, vastusLat: 0.15, vastusMed: 0.2, gluteMax: 0.2, gastroc: 0.2,
};
/** Which rig bone carries each bone part rigidly. */
function rigidBone(name: string): BoneName | null {
  const s = /\bleft\b/.test(name) ? "L" : "R";
  if (/femur/.test(name)) return `thigh${s}`;
  if (/\btibia$|fibula|patella/.test(name)) return `shin${s}`;
  if (/talus|calcaneus/.test(name)) return `foot${s}`;
  if (/humerus/.test(name)) return `upperArm${s}`;
  if (/radius|ulna/.test(name)) return `foreArm${s}`;
  if (/hip bone|sacrum|lumbar vertebra/.test(name)) return "pelvis";
  if (/cervical vertebra|hyoid|thyroid/.test(name)) return "neck";
  if (/rib|costal|sternum|manubrium|thoracic vertebra/.test(name)) return "chest";
  return null; // clavicle and scapula follow the shoulder blend
}
interface Part {
  name: string;
  kind: PartKind | "skin" | "deep" | "cover" | "eye";
  mesh: Mesh;
  label: number;
  fiber: V3;
  rigid: BoneName | null;
  /** Per-vertex 0..1 extra: how tendinous (muscle ends), or the iris (eyes). */
  extra?: Float32Array;
  /** The source's own vertex colours (raw Écorché), RGB bytes. */
  rgb?: Uint8Array;
}
const parts: Part[] = [];
function vertexNormals(m: Mesh): Float32Array {
  const nrm = new Float32Array(m.pos.length);
  for (let t = 0; t < m.idx.length; t += 3) {
    const a = vert(m, m.idx[t]!), b = vert(m, m.idx[t + 1]!), c = vert(m, m.idx[t + 2]!);
    const fnrm = cross(sub(b, a), sub(c, a));
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) nrm[m.idx[t + k]! * 3 + j]! += fnrm[j]!;
  }
  for (let i = 0; i < nrm.length; i += 3) {
    const l = Math.hypot(nrm[i]!, nrm[i + 1]!, nrm[i + 2]!) || 1;
    for (let j = 0; j < 3; j++) nrm[i + j]! /= l;
  }
  return nrm;
}
/** Winds the triangles outwards (positive signed volume; the database's meshes are closed). */
function orientOutward(m: Mesh) {
  let vol = 0;
  for (let t = 0; t < m.idx.length; t += 3) vol += dot(vert(m, m.idx[t]!), cross(vert(m, m.idx[t + 1]!), vert(m, m.idx[t + 2]!)));
  if (vol < 0) for (let t = 0; t < m.idx.length; t += 3) [m.idx[t + 1], m.idx[t + 2]] = [m.idx[t + 2]!, m.idx[t + 1]!];
}
/** The rectus abdominis's tendinous intersections: three shallow grooves across each side (the "six-pack"). */
function carveAbs(m: Mesh) {
  const ps = verts(m);
  const ys = ps.map((p) => p[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const nrm = vertexNormals(m);
  for (let n = 0; n < ps.length; n++) {
    if (nrm[n * 3]! < 0.25) continue; // only the front surface
    const f = (ps[n]![1] - y0) / (y1 - y0);
    let g = 0;
    for (const at of [0.47, 0.66, 0.84]) g = Math.max(g, Math.exp(-((((f - at) * (y1 - y0)) / 0.85) ** 2)));
    for (let k = 0; k < 3; k++) m.pos[n * 3 + k]! -= nrm[n * 3 + k]! * 0.55 * g;
  }
}
function longAxis(m: Mesh): V3 {
  const ps = verts(m);
  const c = centroid(ps);
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of ps) {
    const d = sub(p, c);
    for (let a = 0; a < 3; a++) for (let b2 = 0; b2 < 3; b2++) C[a * 3 + b2]! += d[a]! * d[b2]!;
  }
  let f: V3 = [0.2, 1, 0.1];
  for (let it = 0; it < 40; it++) f = norm([0, 1, 2].map((a) => C[a * 3]! * f[0] + C[a * 3 + 1]! * f[1] + C[a * 3 + 2]! * f[2]) as V3);
  return f;
}
/**
 * Écorché's muscles, tendons and bones in the athlete's frame. Its axes are converted (metres, Y up, facing +Z) and
 * then fitted to this build's BodyParts3D bones by scale and offset (both come from the same BodyParts3D subject), so
 * they sit on the skeleton that gives the joints, the skin, the hands and the feet. The white aponeurosis that
 * Écorché lays over the six-pack (the sheath of the external oblique) is left out in front of the rectus abdominis:
 * the abs are what an exercise model has to show.
 */
async function ecorcheSources(path: string, raw = false): Promise<Source[]> {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const buf = readFileSync(path);
  const gltf = await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, "");
  gltf.scene.updateMatrixWorld(true);
  const meshes: { name: string; layer: string; tissue: string; pos: V3[]; idx: Uint32Array; tint: Float32Array; rgb: number[] }[] = [];
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    const pa = g.getAttribute("position"), ca = g.getAttribute("color");
    const v = new THREE.Vector3();
    const pos: V3[] = [];
    const tint = new Float32Array(pa.count);
    const rgb: number[] = [];
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(mesh.matrixWorld);
      pos.push([v.z * 100, v.y * 100, -v.x * 100]); // +X forward, +Y up, +Z the figure's right
      if (ca) tint[i] = smoothstep(0.45, 0.85, ca.getY(i) / Math.max(1e-3, ca.getX(i)));
      // (The source's colour bytes, exactly: glTF vertex colours, linear.)
      rgb.push(...(ca ? [ca.getX(i), ca.getY(i), ca.getZ(i)].map((c) => Math.round(c * 255)) : [255, 255, 255]));
    }
    const idx0 = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: pa.count }, (_, i) => i);
    // Weld: glTF splits vertices along colour and normal seams. Left split, each copy would be pushed out along its own
    // normal (athletic bulk, sculpting) and the surface would crack open along the seams.
    const weld = new Map<string, number>();
    const remap = new Uint32Array(pos.length);
    const wpos: V3[] = [], wtint: number[] = [], wrgb: number[] = [];
    pos.forEach((p, i) => {
      const key = p.map((c) => Math.round(c * 1000)).join(",");
      let w = weld.get(key);
      if (w === undefined) {
        w = wpos.length;
        weld.set(key, w);
        wpos.push(p);
        wtint.push(tint[i]!);
        wrgb.push(rgb[i * 3]!, rgb[i * 3 + 1]!, rgb[i * 3 + 2]!);
      }
      remap[i] = w;
    });
    const idx: number[] = [];
    for (let t = 0; t < idx0.length; t += 3) {
      const a = remap[idx0[t]!]!, b = remap[idx0[t + 1]!]!, c = remap[idx0[t + 2]!]!;
      if (a !== b && b !== c && a !== c) idx.push(a, b, c);
    }
    meshes.push({
      name: String(mesh.userData.name ?? mesh.name).toLowerCase().replace(/ \(2\)$/, ""),
      layer: String(mesh.userData.layer),
      tissue: String(mesh.userData.tissue ?? ""),
      pos: wpos,
      idx: new Uint32Array(idx),
      tint: new Float32Array(wtint),
      rgb: wrgb,
    });
  });
  // Fit rotation, scale and offset on the bones both have (Horn's closed-form absolute orientation).
  const pairs: [V3, V3][] = [];
  for (const r of meshes) {
    if (r.layer !== "skeleton" || kindOf(r.name) !== "bone") continue;
    const id = idOf(r.name);
    if (!id || !existsSync(stlPath(id))) continue;
    pairs.push([centroid(r.pos), centroid(verts(load(id)))]);
  }
  const ca = centroid(pairs.map((p) => p[0])), cb = centroid(pairs.map((p) => p[1]));
  const S = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let den = 0;
  for (const [a, b] of pairs) {
    const A = sub(a, ca), B = sub(b, cb);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i * 3 + j]! += A[i]! * B[j]!;
    den += dot(A, A);
  }
  const [Sxx, Sxy, Sxz, Syx, Syy, Syz, Szx, Szy, Szz] = S as [number, number, number, number, number, number, number, number, number];
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  // Largest eigenvector of N (power iteration on N + cI, which shifts every eigenvalue positive).
  const shiftC = N.flat().reduce((a, v) => a + Math.abs(v), 0);
  let q = [1, 0, 0, 0];
  for (let it = 0; it < 500; it++) {
    const nq = N.map((row, i) => row.reduce((a, v, j) => a + v * q[j]!, 0) + shiftC * q[i]!);
    const l = Math.hypot(...nq);
    q = nq.map((v) => v / l);
  }
  const [qw, qx, qy, qz] = q as [number, number, number, number];
  const rot = new THREE.Matrix3().set(
    1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qw * qz), 2 * (qx * qz + qw * qy),
    2 * (qx * qy + qw * qz), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qw * qx),
    2 * (qx * qz - qw * qy), 2 * (qy * qz + qw * qx), 1 - 2 * (qx * qx + qy * qy),
  );
  const rv = new THREE.Vector3();
  const rotate = (p: V3): V3 => rv.set(...p).applyMatrix3(rot).toArray() as V3;
  const k = pairs.reduce((a, [p, b]) => a + dot(rotate(sub(p, ca)), sub(b, cb)), 0) / den;
  const fit = (p: V3): V3 => add(cb, mul(rotate(sub(p, ca)), k));
  const angle = (2 * Math.acos(Math.min(1, Math.abs(qw))) * 180) / Math.PI;
  const rms = Math.sqrt(pairs.reduce((s2, [a, b]) => s2 + len(sub(fit(a), b)) ** 2, 0) / pairs.length);
  console.log(`Écorché: ${meshes.length} meshes; fitted on ${pairs.length} bones, scale ${k.toFixed(3)}, rotation ${angle.toFixed(2)}°, residual ${rms.toFixed(2)} cm`);
  const rectusZ = meshes.filter((r) => /rectus abdominis/.test(r.name)).flatMap((r) => r.pos.map((p) => Math.abs(fit(p)[2]))).reduce((a, b) => Math.max(a, b), 0);
  const out: Source[] = [];
  for (const r of meshes) {
    // Raw: every mesh, as it is (eyes, teeth, cartilage and all; the skeleton layer moves with the bones).
    const kind: Source["kind"] | null = raw ? (r.tissue === "eye" ? "eye" : r.layer === "skeleton" ? "bone" : "muscle") : kindOf(r.name);
    if (!kind || (!raw && (r.layer === "skeleton") !== (kind === "bone"))) continue;
    const pos = new Float32Array(r.pos.flatMap(fit));
    if (raw) {
      out.push({ name: r.name, kind, mesh: { pos, idx: r.idx }, tint: kind === "muscle" ? r.tint : undefined, rgb: Uint8Array.from(r.rgb) });
      continue;
    }
    let idx = r.idx;
    if (/external oblique/.test(r.name)) {
      const keep: number[] = [];
      for (let t = 0; t < idx.length; t += 3) {
        const tri = [idx[t]!, idx[t + 1]!, idx[t + 2]!];
        const sheath = tri.every((v) => r.tint[v]! > 0.5 && Math.abs(pos[v * 3 + 2]!) < rectusZ + 0.8 && pos[v * 3]! > 0);
        if (!sheath) keep.push(...tri);
      }
      idx = new Uint32Array(keep);
    }
    // Compact (keeping each vertex's tint), and cap the heaviest sheets.
    const used = new Int32Array(pos.length / 3).fill(-1);
    let nu = 0;
    for (const v of idx) if (used[v]! < 0) used[v] = nu++;
    const np = new Float32Array(nu * 3), nt = new Float32Array(nu);
    used.forEach((u, v) => {
      if (u < 0) return;
      np.set(pos.subarray(v * 3, v * 3 + 3), u * 3);
      nt[u] = r.tint[v]!;
    });
    let mesh: Mesh = { pos: np, idx: Uint32Array.from(idx, (v) => used[v]!) };
    let tint: Float32Array | undefined = kind === "muscle" ? nt : undefined;
    if (mesh.idx.length / 3 > 12000) {
      const [si] = MeshoptSimplifier.simplify(mesh.idx, mesh.pos, 3, 12000 * 3, 0.01, []);
      const keepV = new Int32Array(nu).fill(-1);
      let n2 = 0;
      for (const v of si) if (keepV[v]! < 0) keepV[v] = n2++;
      const p2 = new Float32Array(n2 * 3), t2 = new Float32Array(n2);
      keepV.forEach((u, v) => {
        if (u < 0) return;
        p2.set(mesh.pos.subarray(v * 3, v * 3 + 3), u * 3);
        t2[u] = nt[v]!;
      });
      mesh = { pos: p2, idx: Uint32Array.from(si, (v) => keepV[v]!) };
      if (tint) tint = t2;
    }
    out.push({ name: r.name, kind, mesh, tint });
  }
  return out;
}
let muscleTris = 0;
/** A source mesh: name (lower case, BodyParts3D style), its kind, and (Écorché) a per-vertex tendon tint and colours. */
interface Source {
  name: string;
  kind: PartKind | "eye";
  mesh: Mesh;
  tint?: Float32Array;
  rgb?: Uint8Array;
}
/** The chest, abdomen and back: the muscles taken from Écorché with ECORCHE_USE=torso. */
const TORSO: ReadonlySet<Region> = new Set(["pecUpper", "pecLower", "abs", "obliques", "serratus", "lat", "trapUpper", "trapMid", "rhomboid", "erector"]);
const inTorso = (name: string) => {
  const r = regionOf(name);
  return !!r && r !== "drop" && TORSO.has(r);
};
const sources: Source[] = !ECORCHE
  ? []
  : RAW
    ? await ecorcheSources(ECORCHE, true)
    : ECORCHE_USE === "all"
    ? await ecorcheSources(ECORCHE)
    : (await ecorcheSources(ECORCHE)).filter((s) => s.kind === "muscle" && inTorso(s.name));
if (ECORCHE_USE === "torso" && ECORCHE) console.log(`Écorché torso muscles: ${sources.length} (${[...new Set(sources.map((s) => regionOf(s.name)))].join(", ")})`);
if (!ECORCHE || ECORCHE_USE === "torso")
  for (const [id, name] of names) {
    const kind = kindOf(name);
    if (!kind || !existsSync(stlPath(id))) continue;
    if (ECORCHE && kind === "muscle" && inTorso(name)) continue;
    const raw = load(id);
    const tris = raw.idx.length / 3;
    const target = kind === "muscle" ? Math.min(7000, Math.max(450, Math.round(tris / 36))) : kind === "bone" ? Math.min(2200, Math.max(120, Math.round(tris / 70))) : Math.min(1500, Math.max(150, Math.round(tris / 30)));
    sources.push({ name, kind, mesh: simplify(raw, target, 0.01) });
  }
for (const { name, kind, mesh: m, tint, rgb } of sources) {
  if (RAW) {
    // As published: no re-winding, sculpting or bulk.
    const region = kind === "muscle" ? regionOf(name) : null;
    parts.push({
      name,
      kind,
      mesh: m,
      label: region && region !== "drop" ? muscleId(region, sideOf(name)) : NO_MUSCLE,
      fiber: longAxis(m),
      rigid: kind === "bone" ? rigidBone(name) : kind === "eye" ? "head" : null,
      extra: tint,
      rgb,
    });
    if (kind === "muscle") muscleTris += m.idx.length / 3;
    continue;
  }
  if (kind === "eye") continue;
  orientOutward(m);
  const region = kind === "muscle" ? regionOf(name) : null;
  const axis = longAxis(m);
  let extra: Float32Array | undefined;
  if (kind === "muscle") {
    // Tendinous ends: paler and glossier, like the tendons and aponeuroses of an anatomy plate. Écorché marks them
    // itself (its tendon tint); for the raw BodyParts3D meshes, the last stretch of the muscle along its length.
    if (tint) extra = tint;
    else {
      const ps = verts(m);
      const c = centroid(ps);
      const along = ps.map((p) => dot(sub(p, c), axis));
      const reach = along.reduce((a, v) => Math.max(a, Math.abs(v)), 0) || 1;
      extra = new Float32Array(along.map((a) => smoothstep(0.7, 0.97, Math.abs(a) / reach)));
      if (/rectus abdominis/.test(name)) carveAbs(m);
    }
  }
  if (kind === "muscle") {
    // Athletic bulk: push the muscle out along its normals.
    const bulk = (region && region !== "drop" ? BULK[region] : undefined) ?? 0.08;
    const nrm = vertexNormals(m);
    for (let i = 0; i < m.pos.length; i++) m.pos[i]! += nrm[i]! * bulk;
    muscleTris += m.idx.length / 3;
  }
  parts.push({
    name,
    kind,
    mesh: m,
    label: region && region !== "drop" ? muscleId(region, sideOf(name)) : NO_MUSCLE,
    fiber: axis,
    rigid: kind === "bone" ? rigidBone(name) : null,
    extra,
  });
}
// Chest and abdomen, as on a bodybuilder: a full, rounded pectoral mass with a clear lower shelf, and a cut six-pack
// (each segment of the rectus abdominis rounded between its tendinous lines). Only the front faces are pushed out, along
// their normals, so the muscles thicken over the fascia and never open a gap.
if (!RAW) {
  for (const side of [0, 1] as const) {
    const pec = parts.filter((p) => /pectoralis major/.test(p.name) && sideOf(p.name) === side);
    const front: V3[] = [];
    for (const p of pec) {
      const nrm = vertexNormals(p.mesh);
      verts(p.mesh).forEach((v, n) => nrm[n * 3]! > 0.3 && front.push(v));
    }
    if (!front.length) continue;
    const c = centroid(front);
    const centre: V3 = [c[0], c[1] - 2.5, c[2] * 1.06];
    for (const p of pec) {
      const nrm = vertexNormals(p.mesh);
      const ps = verts(p.mesh);
      ps.forEach((v, n) => {
        const dy = (v[1] - centre[1]) / (v[1] < centre[1] ? 6.5 : 11);
        const dz = (v[2] - centre[2]) / 10.5;
        const r2 = dy * dy + dz * dz;
        if (r2 >= 1) return;
        const d = 1.5 * (1 - r2) ** 2 * smoothstep(-0.15, 0.45, nrm[n * 3]!);
        for (let k = 0; k < 3; k++) p.mesh.pos[n * 3 + k]! += nrm[n * 3 + k]! * d;
      });
    }
  }
  for (const p of parts.filter((q) => /rectus abdominis/.test(q.name))) {
    const ps = verts(p.mesh);
    const nrm = vertexNormals(p.mesh);
    const y0 = ps.reduce((m, v) => Math.min(m, v[1]), Infinity), y1 = ps.reduce((m, v) => Math.max(m, v[1]), -Infinity);
    // The muscle's inner and outer edge at each height (1 cm slabs of the front surface).
    const slab = new Map<number, [number, number]>();
    ps.forEach((v, n) => {
      if (nrm[n * 3]! < 0.25) return;
      const k = Math.round(v[1]);
      const r = slab.get(k) ?? [Infinity, -Infinity];
      slab.set(k, [Math.min(r[0], Math.abs(v[2])), Math.max(r[1], Math.abs(v[2]))]);
    });
    const SEG = [0.1, 0.47, 0.66, 0.84, 0.985];
    ps.forEach((v, n) => {
      const nx = nrm[n * 3]!;
      if (nx < 0.05) return;
      const f = (v[1] - y0) / (y1 - y0);
      const i = SEG.findIndex((b, j) => j > 0 && f < b);
      if (i <= 0) return;
      const a = SEG[i - 1]!, b = SEG[i]!;
      const along = Math.sin(Math.PI * Math.max(0, Math.min(1, (f - a) / (b - a)))) ** 0.6;
      const r = slab.get(Math.round(v[1]));
      if (!r || r[1] - r[0] < 1) return;
      const t = Math.max(0, Math.min(1, (Math.abs(v[2]) - r[0]) / (r[1] - r[0])));
      const across = Math.sin(Math.PI * t) ** 0.6;
      const d = 0.75 * along * across * smoothstep(0.05, 0.45, nx);
      for (let k = 0; k < 3; k++) p.mesh.pos[n * 3 + k]! += nrm[n * 3 + k]! * d;
    });
  }
}
// Eyes: real eyeballs in the sockets, with the iris and pupil marked for the shader.
if (!RAW) {
  const eyeId = idOf("eyeball");
  if (eyeId && existsSync(stlPath(eyeId))) {
    const m = simplify(load(eyeId), 3000, 0.005);
    orientOutward(m);
    parts.push({ name: "eyes", kind: "eye", mesh: m, label: NO_MUSCLE, fiber: [0, 1, 0], rigid: "head", extra: eyeIris(m) });
  }
}
console.log(`parts: ${parts.length} (${muscleTris} muscle triangles)`);

// ---------------------------------------------------------------- skin: face, hands, feet
const skin = compact(skinRaw.pos.map((v, i) => v + shift[i % 3]!), skinRaw.idx);
const isHead = (p: V3) => p[1] > 161.5 - 0.3 * p[0];
const handOf = (p: V3) => {
  for (const J of [R, L]) {
    const fd = norm(sub(J.wrist, J.elbow));
    const along = dot(sub(p, J.wrist), fd);
    if (along > -0.6 && len(sub(sub(p, J.wrist), mul(fd, along))) < 9 && Math.sign(p[2]) === Math.sign(J.wrist[2])) return true;
  }
  return false;
};
const isFoot = (p: V3) => p[1] < R.ankle[1] + 0.8;
/** Iris (0.6) and pupil (1) on each eyeball, looking straight ahead. */
function eyeIris(m: Mesh): Float32Array {
  const ps = verts(m);
  const centres = [ps.filter((p) => p[2] > 0), ps.filter((p) => p[2] <= 0)].map(centroid);
  return new Float32Array(
    ps.map((p) => {
      const c = p[2] > 0 ? centres[0]! : centres[1]!;
      const facing = dot(norm(sub(p, c)), norm([1, 0, 0.08 * Math.sign(p[2])]));
      return smoothstep(0.8, 0.86, facing) * 0.6 + smoothstep(0.955, 0.97, facing) * 0.4;
    }),
  );
}
/** A short buzz cut: 1 on the scalp above a natural hairline (higher at the forehead, down to the nape behind). */
function hairMask(m: Mesh, eyeCentre?: V3): Float32Array {
  const eyeId = idOf("eyeball");
  const eyes = eyeCentre ? [eyeCentre] : eyeId && existsSync(stlPath(eyeId)) ? verts(load(eyeId)) : [];
  const eyeY = eyes.length ? centroid(eyes)[1] : 168;
  const front = Math.max(...verts(m).map((p) => p[0]));
  return new Float32Array(
    verts(m).map((p) => {
      const h = p[1] - eyeY;
      const fromFront = front - p[0];
      // Hairline height above the eyes: about 7.5 cm at the forehead, 3 cm at the temples, dropping behind the ears.
      const line = 6.2 - 3.6 * smoothstep(2, 6, fromFront) - 9 * smoothstep(10, 16, fromFront);
      const ears = smoothstep(5.8, 6.6, Math.abs(p[2])) * smoothstep(6.5, 7.5, fromFront) * (1 - smoothstep(12.5, 13.5, fromFront)) * (1 - smoothstep(2, 3, h));
      return smoothstep(line - 0.5, line + 0.5, h) * (1 - ears);
    }),
  );
}
function cropAndSimplify(m: Mesh, test: (p: V3) => boolean, tris: number): Mesh {
  const idx: number[] = [];
  for (let t = 0; t < m.idx.length; t += 3) {
    if (test(centroid([vert(m, m.idx[t]!), vert(m, m.idx[t + 1]!), vert(m, m.idx[t + 2]!)]))) idx.push(m.idx[t]!, m.idx[t + 1]!, m.idx[t + 2]!);
  }
  const part = compact(m.pos, new Uint32Array(idx));
  const [si] = MeshoptSimplifier.simplify(part.idx, part.pos, 3, Math.min(part.idx.length, tris * 3), 0.002, ["LockBorder"]);
  return compact(part.pos, si);
}
for (const [name, test, tris] of RAW
  ? []
  : ([
      ["face", isHead, 40000],
      ["hands", handOf, 16000],
      ["feet", isFoot, 9000],
    ] as const)) {
  const m = cropAndSimplify(skin, test, tris);
  parts.push({ name, kind: "skin", mesh: m, label: NO_MUSCLE, fiber: [0, 1, 0], rigid: name === "face" ? "head" : null, extra: name === "face" ? hairMask(m) : undefined });
}
// A new face: the MakeHuman head (CC0), shaped for a stronger adult male face, fitted where the scanned head was.
const MAKEHUMAN = process.argv[3];
const neckCut = (p: V3) => 147.5 - 0.35 * p[0] + 9 * smoothstep(7, 11, Math.abs(p[2]));
if (MAKEHUMAN && !RAW) {
  const eyesPart = parts.find((pt) => pt.kind === "eye")!;
  const eyeMid = centroid(verts(eyesPart.mesh));
  const sk = verts(skin);
  const bodyHeight = sk.reduce((m, p) => Math.max(m, p[1]), -Infinity);
  const { head: mhHead, eyes: mhEyes } = buildMakeHumanHead(MAKEHUMAN, {
    eyeMid,
    bodyHeight,
    // (Kept a little long here; cut exactly below.)
    cutY: (x, z) => neckCut([x, 0, z]) - 2.5,
  });
  // The new neck is skin: the deep neck muscles that would poke through it behind the ears are left out.
  for (let i = parts.length - 1; i >= 0; i--)
    if (/splenius|semispinalis capitis|levator scapulae/.test(parts[i]!.name)) parts.splice(i, 1);
  const face = parts.findIndex((pt) => pt.name === "face");
  // The neck column only (the slopes of the trapezius and the tops of the shoulders stay real muscle), cut along one
  // smooth curve and folded in at the edge so it meets the muscles cleanly.
  const headMesh: Mesh = foldEdges(clipMesh({ pos: mhHead.pos, idx: mhHead.idx }, (p) => p[1] - neckCut(p)), 0.6);
  parts[face] = { name: "face", kind: "skin", mesh: headMesh, label: NO_MUSCLE, fiber: [0, 1, 0], rigid: null, extra: hairMask(headMesh, centroid(Array.from({ length: mhEyes.pos.length / 3 }, (_, i) => [mhEyes.pos[i * 3]!, mhEyes.pos[i * 3 + 1]!, mhEyes.pos[i * 3 + 2]!] as V3))) };
  const eyeMesh: Mesh = { pos: mhEyes.pos, idx: mhEyes.idx };
  parts[parts.indexOf(eyesPart)] = { ...eyesPart, mesh: eyeMesh, extra: eyeIris(eyeMesh) };
  const hy = verts(headMesh).map((p) => p[1]);
  console.log(`MakeHuman head: ${headMesh.idx.length / 3} triangles, crown ${hy.reduce((a, b) => Math.max(a, b)).toFixed(1)} (body height ${bodyHeight.toFixed(1)})`);
}

// ---------------------------------------------------------------- fascia layer
// The fascia is a smooth sheet about 1 cm under the surface of the muscles, bones and tendons, bridging every gap between
// them narrower than about 2.5 cm: hidden beneath each muscle, it fills the grooves and gaps between them with dark tissue, so
// no hole ever shows through the écorché. It is extracted from a voxel field (see closedEnvelope), so it cannot fold or
// crumple; built from the scanned skin instead, it folded over itself where neighbouring points sank to different
// depths, and the folds showed between the muscles as bright shards.
if (!RAW) {
  const all: number[] = [];
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const pt of parts) {
    if (pt.kind !== "muscle" && pt.kind !== "bone" && pt.kind !== "tendon") continue;
    for (const i of pt.mesh.idx) {
      const v = vert(pt.mesh, i);
      all.push(...v);
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k]!, v[k]!);
        hi[k] = Math.max(hi[k]!, v[k]!);
      }
    }
  }
  // No organs are modelled, so the trunk is hollow, and open at the bottom of the pelvis: through there the sheet
  // followed the outside into the empty trunk, and then out through every gap between the abdominal muscles (the spine
  // showed between them). A disc across the pelvis closes it (inside the shorts, where the fascia is removed anyway).
  {
    const c = lerp(R.hip, L.hip, 0.5);
    const y = c[1] - 6;
    const ring = Array.from({ length: 48 }, (_, i) => [c[0] + 13 * Math.cos((i / 48) * 2 * Math.PI), y, c[2] + 13 * Math.sin((i / 48) * 2 * Math.PI)] as V3);
    ring.forEach((p, i) => all.push(c[0], y, c[2], ...p, ...ring[(i + 1) % 48]!));
  }
  for (let k = 0; k < 3; k++) {
    lo[k]! -= 3.5;
    hi[k]! += 3.5;
  }
  const env = closedEnvelope(new Float32Array(all), new Uint32Array(all.length / 3).map((_, i) => i), lo, hi, 0.5, () => 1.2, -1.0, true, [[4, 108, 0], [2, 125, 0]]);
  const body = cropAndSimplify(env, (p) => !isHead(p) && !handOf(p) && !isFoot(p), 60000);
  console.log(`fascia: ${env.idx.length / 3} triangles, ${body.idx.length / 3} kept`);
  parts.push({ name: "fascia", kind: "deep", mesh: body, label: NO_MUSCLE, fiber: [0, 1, 0], rigid: null });
}

/** Cuts a mesh exactly along the zero line of a scalar field, keeping the part where it is positive (watertight). */
function clipMesh(m: Mesh, field: (p: V3) => number): Mesh {
  const nv = m.pos.length / 3;
  const f = Array.from({ length: nv }, (_, n) => field(vert(m, n)));
  const pos = Array.from(m.pos);
  const idx: number[] = [];
  const onEdge = new Map<string, number>();
  const mid = (a: number, b: number) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    let r = onEdge.get(key);
    if (r === undefined) {
      const t = f[a]! / (f[a]! - f[b]!);
      r = pos.length / 3;
      pos.push(...lerp(vert(m, a), vert(m, b), t));
      onEdge.set(key, r);
    }
    return r;
  };
  for (let t = 0; t < m.idx.length; t += 3) {
    const tri = [m.idx[t]!, m.idx[t + 1]!, m.idx[t + 2]!];
    const ins = tri.map((v) => f[v]! >= 0);
    const n = ins.filter(Boolean).length;
    if (n === 3) idx.push(...tri);
    if (n === 0 || n === 3) continue;
    // Rotate so the odd one out comes first.
    const k = n === 1 ? ins.indexOf(true) : ins.indexOf(false);
    const a = tri[k]!, b2 = tri[(k + 1) % 3]!, c = tri[(k + 2) % 3]!;
    const ab = mid(a, b2), ac = mid(a, c);
    if (n === 1) idx.push(a, ab, ac);
    else idx.push(ab, b2, c, ab, c, ac);
  }
  return compact(new Float32Array(pos), new Uint32Array(idx));
}
/** clipMesh for a part with per-vertex data: keeps where `f` >= 0 and carries colours and extras onto the cut. */
function clipWithData(m: Mesh, f: number[], rgb?: Uint8Array, extra?: Float32Array): { mesh: Mesh; rgb?: Uint8Array; extra?: Float32Array } {
  const pos = Array.from(m.pos);
  const col = rgb ? Array.from(rgb) : null;
  const ex = extra ? Array.from(extra) : null;
  const fv = [...f];
  const idx: number[] = [];
  const onEdge = new Map<string, number>();
  const mid = (a: number, b: number) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    let r = onEdge.get(key);
    if (r === undefined) {
      const t = fv[a]! / (fv[a]! - fv[b]!);
      r = pos.length / 3;
      pos.push(...lerp(vert(m, a), vert(m, b), t));
      if (col) for (let k = 0; k < 3; k++) col.push(Math.round(col[a * 3 + k]! + (col[b * 3 + k]! - col[a * 3 + k]!) * t));
      if (ex) ex.push(ex[a]! + (ex[b]! - ex[a]!) * t);
      fv.push(0);
      onEdge.set(key, r);
    }
    return r;
  };
  for (let t = 0; t < m.idx.length; t += 3) {
    const tri = [m.idx[t]!, m.idx[t + 1]!, m.idx[t + 2]!];
    const ins = tri.map((v) => fv[v]! >= 0);
    const n = ins.filter(Boolean).length;
    if (n === 3) idx.push(...tri);
    if (n === 0 || n === 3) continue;
    const k = n === 1 ? ins.indexOf(true) : ins.indexOf(false);
    const a = tri[k]!, b2 = tri[(k + 1) % 3]!, c = tri[(k + 2) % 3]!;
    const ab = mid(a, b2), ac = mid(a, c);
    if (n === 1) idx.push(a, ab, ac);
    else idx.push(ab, b2, c, ab, c, ac);
  }
  // Compact, keeping each vertex's data with it.
  const used = new Int32Array(pos.length / 3).fill(-1);
  let nu = 0;
  for (const v of idx) if (used[v]! < 0) used[v] = nu++;
  const np = new Float32Array(nu * 3), nc = col ? new Uint8Array(nu * 3) : undefined, ne = ex ? new Float32Array(nu) : undefined;
  used.forEach((u, v) => {
    if (u < 0) return;
    for (let k = 0; k < 3; k++) np[u * 3 + k] = pos[v * 3 + k]!;
    if (nc) for (let k = 0; k < 3; k++) nc[u * 3 + k] = col![v * 3 + k]!;
    if (ne) ne[u] = ex![v]!;
  });
  return { mesh: { pos: np, idx: Uint32Array.from(idx, (v) => used[v]!) }, rgb: nc, extra: ne };
}
/**
 * Folds every open edge of a mesh inwards by `depth`: a finished edge. By default the fold follows the surface normal;
 * `inward` gives the direction instead (normals right at a freshly cut edge are unreliable and made the strip spike).
 */
function foldEdges(m: Mesh, depth: number, inward?: (p: V3) => V3): Mesh {
  const nrm = vertexNormals(m);
  const edgeUse = new Map<string, [number, number]>();
  for (let t = 0; t < m.idx.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = m.idx[t + k]!, b = m.idx[t + ((k + 1) % 3)]!;
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      edgeUse.set(key, edgeUse.has(key) ? [-1, -1] : [a, b]);
    }
  const pos = Array.from(m.pos);
  const idx = Array.from(m.idx);
  const fold = new Map<number, number>();
  const inner = (v: number) => {
    let r = fold.get(v);
    if (r === undefined) {
      r = pos.length / 3;
      const p = vert(m, v);
      pos.push(...(inward ? add(p, mul(inward(p), depth)) : sub(p, mul([nrm[v * 3]!, nrm[v * 3 + 1]!, nrm[v * 3 + 2]!], depth))));
      fold.set(v, r);
    }
    return r;
  };
  for (const [a, b] of edgeUse.values()) {
    if (a < 0) continue;
    // (a, b) runs along the edge with the surface on its left: the folded strip continues the same surface.
    const ai = inner(a), bi = inner(b);
    idx.push(b, a, ai, b, ai, bi);
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}

// ---------------------------------------------------------------- shorts
// Fitted black compression shorts, built as real geometry: the body's own skin surface over the hips (so the fabric
// follows the body exactly, like compression wear), smoothed flat over the groin, cut exactly along the hem and
// waistband curves (new vertices on the cut, not a shader mask), with a finished edge that folds in to meet the body.
// Everything the shorts cover is then removed from the anatomy underneath: the pelvic internals, the fascia, and the
// covered parts of the hip, glute and thigh muscles. Nothing can show through or poke out, and the pelvis reads as
// one clean surface.
const shortsWaist = (p: V3) => 95.5 + 3 * smoothstep(2, -8, p[0]);
/** Hem height on the inside of the thigh: mid-thigh shorts, or short trunks on the raw Écorché athlete, which leave the
 *  quads, hamstrings and adductors in view. */
const HEM = RAW ? 78.5 : 68.5;
const shortsHem = (p: V3) => HEM + 3.5 * smoothstep(6, 16, Math.abs(p[2]));
/** Signed distance (cm, vertical) inside the shorts band: positive between hem and waistband. */
const shortsF = (p: V3) => Math.min(p[1] - shortsHem(p), shortsWaist(p) - p[1]);
if (SHORTS) {
  // The fabric: a smooth envelope 5 mm over the muscles and bones of the hips and thighs, bridging every crease and
  // hollow narrower than about 6 cm (3 cm near the hems, so it does not web between the thighs). Built from the anatomy,
  // not the scanned skin, so nothing of the genitals' shape or the skin's creases is left in it.
  const forearm = (p: V3) =>
    [R, L].some((J) => {
      const ab = sub(J.wrist, J.elbow);
      const t = Math.max(0, Math.min(1, dot(sub(p, J.elbow), ab) / dot(ab, ab)));
      return len(sub(p, add(J.elbow, mul(ab, t)))) < 7;
    });
  const hullPos: number[] = [];
  const lo: V3 = [Infinity, 60, Infinity], hi: V3 = [-Infinity, 106, -Infinity];
  for (const pt of parts) {
    if (pt.kind !== "muscle" && pt.kind !== "bone" && pt.kind !== "tendon") continue;
    for (let t = 0; t < pt.mesh.idx.length; t += 3) {
      const tri = [0, 1, 2].map((k) => vert(pt.mesh, pt.mesh.idx[t + k]!));
      const c = centroid(tri);
      if (c[1] < lo[1] || c[1] > hi[1] || Math.abs(c[2]) > 24 || handOf(c) || forearm(c)) continue;
      for (const v of tri) {
        hullPos.push(...v);
        for (const k of [0, 2]) {
          lo[k] = Math.min(lo[k]!, v[k]!);
          hi[k] = Math.max(hi[k]!, v[k]!);
        }
      }
    }
  }
  const radius = (y: number) => 1.5 + 1.5 * smoothstep(HEM + 2.5, HEM + 10.5, y);
  // The crotch: just under the lowest bone on the midline (the pubic symphysis). From a 5 cm gusset below it, the legs
  // get separate tubes, cut apart along the midline (the inner thighs nearly touch, and bridged they made a skirt-like panel that the knees
  // stretched apart).
  let crotch = Infinity;
  for (const pt of parts)
    if (pt.kind === "bone") for (const v of verts(pt.mesh)) if (Math.abs(v[2]) < 1.5 && v[1] > 60 && v[1] < 100) crotch = Math.min(crotch, v[1] - 2);
  console.log(`shorts: crotch at ${crotch.toFixed(1)} cm`);
  const midZ = lerp(R.hip, L.hip, 0.5)[2];
  for (const k of [0, 2]) {
    lo[k]! -= 4.5;
    hi[k]! += 4.5;
  }
  const m0 = cropAndSimplify(closedEnvelope(new Float32Array(hullPos), new Uint32Array(hullPos.length / 3).map((_, i) => i), lo, hi, 0.5, radius, 0.5, false, [], (p) => p[1] < crotch - 5 && Math.abs(p[2] - midZ) < 0.3, 30), () => true, 24000);
  const cut = clipMesh(m0, shortsF);
  // Finished edge: every cut edge folds straight in towards the body by 8 mm, an even band that reads as the hem's
  // thickness and closes the view under the fabric.
  const nrm = vertexNormals(cut);
  // The hems fold in towards the thigh's axis and the waistband towards the trunk's, level with the cut: a clean band.
  const thighAxis = (p: V3, J: SideJ): V3 => {
    const ab = sub(J.knee, J.hip);
    const t = (p[1] - J.hip[1]) / ab[1];
    return add(J.hip, mul(ab, Math.max(0, Math.min(1, t))));
  };
  const trunk: V3 = [lerp(R.hip, L.hip, 0.5)[0] - 2, 0, 0];
  const m = foldEdges(cut, 0.8, (p) => {
    const atHem = p[1] - shortsHem(p) < shortsWaist(p) - p[1];
    const c = atHem ? thighAxis(p, p[2] > 0 ? R : L) : trunk;
    return norm([c[0] - p[0], 0, c[2] - p[2]]);
  });
  // Trim: a thin gold line along the waistband and hems (0.8), and the folded edge itself (0.85).
  const extra = new Float32Array(m.pos.length / 3);
  // (0.85 marks the folded strip and 0.8 the band along the edge: the clearance fit leaves both where the cut put them;
  // they are drawn as the gold trim.)
  for (let n = 0; n < extra.length; n++) extra[n] = n >= cut.pos.length / 3 ? 0.85 : shortsF(vert(m, n)) < 0.8 ? 0.8 : 0;
  // Remove the anatomy the shorts cover: every triangle more than 2.5 cm inside the hem and waistband, and on the
  // inner side of the fabric (or less than 1.5 cm outside it).
  const sGrid = new Map<string, number[]>();
  const SC = 3;
  const skey = (p: V3) => `${Math.floor(p[0] / SC)},${Math.floor(p[1] / SC)},${Math.floor(p[2] / SC)}`;
  for (let n = 0; n < cut.pos.length / 3; n++) {
    const k2 = skey(vert(cut, n));
    (sGrid.get(k2) ?? sGrid.set(k2, []).get(k2)!).push(n);
  }
  const covered = (p: V3) => {
    if (shortsF(p) < 2.5 || handOf(p)) return false;
    // The forearms hang beside the hips: never part of what the shorts cover.
    for (const J of [R, L]) {
      const ab = sub(J.wrist, J.elbow);
      const t = Math.max(0, Math.min(1, dot(sub(p, J.elbow), ab) / dot(ab, ab)));
      if (len(sub(p, add(J.elbow, mul(ab, t)))) < 6) return false;
    }
    // Nearest fabric point (searching further out for the deep pelvic structures, up to 21 cm away).
    let best = -1, bd = Infinity;
    const [ci, cj, ck2] = [0, 1, 2].map((k) => Math.floor(p[k]! / SC));
    for (const R of [2, 7]) {
      for (let i = -R; i <= R; i++)
        for (let j = -R; j <= R; j++)
          for (let k = -R; k <= R; k++)
            for (const q of sGrid.get(`${ci! + i},${cj! + j},${ck2! + k}`) ?? []) {
              const d = len(sub(p, vert(cut, q)));
              if (d < bd) {
                bd = d;
                best = q;
              }
            }
      if (best >= 0) break;
    }
    if (best < 0) return false;
    // Inside the fabric, or poking less than 1.5 cm out of it (a misfit, not a body part that belongs outside).
    return dot(sub(p, vert(cut, best)), [nrm[best * 3]!, nrm[best * 3 + 1]!, nrm[best * 3 + 2]!]) < 1.5;
  };
  // The anatomy is cut exactly along the line (2.5 cm inside the band; the band's edge for the fascia), not trimmed by
  // whole triangles: the large triangles that straddled the line reached deep under the fabric and came through it in
  // a squat. New vertices on the cut take the colour and tint of the edge they split.
  let removed = 0, dropped = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const pt = parts[i]!;
    if (pt.kind === "skin" || pt.kind === "eye") continue;
    // The fascia only fills gaps between visible muscles; under the shorts it has no job, and over the groin (where no
    // muscle stops it) it kept the scanned skin's shape in front of the fabric. All of it inside the band goes.
    const f = verts(pt.mesh).map((p) => {
      const depth = pt.kind === "deep" ? shortsF(p) : shortsF(p) - 2.5;
      const gone = pt.kind === "deep" ? shortsF(p) > 0 && !handOf(p) && Math.abs(p[2]) < 24 : covered(p);
      return gone ? -depth : Math.max(-depth, 0.05);
    });
    if (f.every((x) => x >= 0)) continue;
    if (f.every((x) => x < 0)) {
      removed += pt.mesh.idx.length / 3;
      parts.splice(i, 1);
      dropped++;
      continue;
    }
    const before = pt.mesh.idx.length / 3;
    const cut = clipWithData(pt.mesh, f, pt.rgb, pt.extra);
    pt.mesh = cut.mesh;
    pt.rgb = cut.rgb;
    pt.extra = cut.extra;
    removed += Math.max(0, before - pt.mesh.idx.length / 3);
  }
  console.log(`shorts: ${m.idx.length / 3} triangles; removed ${removed} covered anatomy triangles (${dropped} parts entirely)`);
  parts.push({ name: "shorts", kind: "cover", mesh: m, label: NO_MUSCLE, fiber: [0, 1, 0], rigid: null, extra });
}

// ---------------------------------------------------------------- assemble
const TISSUE_OF = { muscle: TISSUE.muscle, bone: TISSUE.bone, tendon: TISSUE.tendon, skin: TISSUE.skin, deep: TISSUE.deep, cover: TISSUE.cover, eye: TISSUE.eye } as const;
const NV = parts.reduce((s, p) => s + p.mesh.pos.length / 3, 0);
const NI = parts.reduce((s, p) => s + p.mesh.idx.length, 0);
const position = new Float32Array(NV * 3);
const index = new Uint32Array(NI);
const label = new Uint8Array(NV).fill(NO_MUSCLE);
const muscleMix = new Uint8Array(NV);
const tissue = new Uint8Array(NV);
const fiber = new Int8Array(NV * 3);
const forced = new Uint8Array(NV).fill(NO_BONE);
const color = new Uint8Array(NV * 3).fill(255);
const limbs = new Uint8Array(NV);
/**
 * Which limb a part belongs to (see computeWeights): its muscle region, or for unlabelled parts where it lies (a whole
 * mesh at the hand is the hand's, one below the hips the leg's; a vertex-by-vertex test could not tell the small
 * muscles of the thigh beside the resting hand from those of the hand itself).
 */
function limbCode(pt: Part): number {
  if (pt.kind === "skin") return pt.name === "hands" ? LIMB_CODE.arm : pt.name === "feet" ? LIMB_CODE.leg : 0;
  if (pt.kind !== "muscle" && pt.kind !== "tendon") return 0;
  if (pt.label !== NO_MUSCLE) return LIMB_CODE[LIMB[REGIONS[pt.label % REGION_COUNT]!]];
  const c = centroid(verts(pt.mesh));
  const nearArm = [R, L].some((J) =>
    [[J.shoulder, J.elbow], [J.elbow, J.wrist]].some(([a, b]) => {
      const ab = sub(b!, a!);
      const t = Math.max(0, Math.min(1, dot(sub(c, a!), ab) / dot(ab, ab)));
      return len(sub(c, add(a!, mul(ab, t)))) < 4.5;
    }),
  );
  if (handOf(c) || nearArm) return LIMB_CODE.arm;
  return c[1] < pelvis[1] - 4 ? LIMB_CODE.leg : 0;
}
{
  let vo = 0, io = 0;
  for (const p of parts) {
    const nv = p.mesh.pos.length / 3;
    position.set(p.mesh.pos, vo * 3);
    for (let i = 0; i < p.mesh.idx.length; i++) index[io + i] = p.mesh.idx[i]! + vo;
    for (let n = 0; n < nv; n++) {
      label[vo + n] = p.label;
      tissue[vo + n] = TISSUE_OF[p.kind];
      if (p.extra) muscleMix[vo + n] = Math.round(p.extra[n]! * 255);
      for (let k = 0; k < 3; k++) fiber[(vo + n) * 3 + k] = Math.round(p.fiber[k]! * 127);
      if (p.rigid) forced[vo + n] = BONES.indexOf(p.rigid);
    }
    if (p.rgb) color.set(p.rgb, vo * 3);
    limbs.fill(limbCode(p), vo, vo + nv);
    vo += nv;
    io += p.mesh.idx.length;
  }
}
console.log(`athlete: ${NV} vertices, ${NI / 3} triangles`);

// ---------------------------------------------------------------- skin weights (refined by scripts/anatomy/reweight.mts)
const { skinIndex, skinWeight } = computeWeights(position, index, label, BINDM, forced, tissue.map((t) => (t === TISSUE.cover ? 1 : 0)), limbs);

// ---------------------------------------------------------------- athletic proportions
// The database's subject is an average build. A broader, deeper chest and upper back, shoulders set wider to match,
// fuller arms and neck, and a slightly lower crown give an athletic frame. The change is one smooth deformation of
// space (it depends only on where a point is), so muscles, bones, fascia and joints all move together and every layer
// keeps its place.
if (!RAW) {
  const torsoF = (y: number) => smoothstep(106, 126, y) * (1 - smoothstep(154, 163, y));
  const torso = (p: V3): V3 => {
    const f = torsoF(p[1]);
    return [(p[0] - neckBase[0]) * (1 + 0.13 * f) + neckBase[0], p[1], p[2] * (1 + 0.2 * f)];
  };
  const closestOnSeg = (p: V3, a: V3, b: V3) => {
    const ab = sub(b, a);
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
    return { q: add(a, mul(ab, t)), t };
  };
  const arm = (p: V3, J: SideJ): { w: number; out: V3 } => {
    if (Math.sign(p[2]) !== Math.sign(J.shoulder[2]) || Math.abs(p[2]) < 6) return { w: 0, out: p };
    const shift = sub(torso(J.shoulder), J.shoulder);
    const up = closestOnSeg(p, J.shoulder, J.elbow);
    const lo = closestOnSeg(p, J.elbow, J.wrist);
    const useUp = len(sub(p, up.q)) <= len(sub(p, lo.q));
    const c = useUp ? up : lo;
    const dist = len(sub(p, c.q));
    const along = dot(sub(p, J.shoulder), norm(sub(J.elbow, J.shoulder)));
    const w = smoothstep(-3, 7, along) * (1 - smoothstep(13, 19, dist));
    const beyondWrist = dot(sub(p, J.wrist), norm(sub(J.wrist, J.elbow)));
    const k = (useUp ? 1.24 : 1.24 - 0.09 * smoothstep(0.0, 0.25, c.t)) * (1 - smoothstep(-1, 1.5, beyondWrist)) + smoothstep(-1, 1.5, beyondWrist);
    return { w, out: add(add(c.q, mul(sub(p, c.q), k)), shift) };
  };
  // Legs: fuller quads, hamstrings and calves, swelling about the thigh and shin bones.
  const leg = (p: V3, J: SideJ): { w: number; out: V3 } => {
    const sideW = smoothstep(0.5, 4.5, Math.sign(J.hip[2]) * p[2]);
    if (sideW <= 0 || p[1] < J.ankle[1] + 2) return { w: 0, out: p };
    const up = closestOnSeg(p, J.hip, J.knee);
    const lo = closestOnSeg(p, J.knee, J.ankle);
    const useUp = len(sub(p, up.q)) <= len(sub(p, lo.q));
    const c = useUp ? up : lo;
    const dist = len(sub(p, c.q));
    const below = J.hip[1] - p[1];
    const w = sideW * smoothstep(2, 10, below) * (1 - smoothstep(15, 21, dist));
    const k = useUp ? 1.15 : 1.1 - 0.08 * smoothstep(0.55, 0.95, c.t);
    return { w, out: add(c.q, mul(sub(p, c.q), k)) };
  };
  const morph = (p: V3): V3 => {
    let q = torso(p);
    for (const J of [R, L]) {
      const a = arm(p, J);
      if (a.w > 0) q = lerp(q, a.out, a.w);
      const l = leg(p, J);
      if (l.w > 0) q = lerp(q, l.out, l.w);
    }
    // Neck: a little fuller.
    const nw = smoothstep(148, 154, p[1]) * (1 - smoothstep(160, 165, p[1])) * (1 - smoothstep(8, 11, Math.hypot(p[0] - neckBase[0], p[2])));
    if (nw > 0) {
      const c: V3 = [neckBase[0], p[1], 0];
      q = lerp(q, add(c, mul(sub(p, c), 1.12)), nw);
    }
    return q;
  };
  for (let n = 0; n < NV; n++) position.set(morph([position[n * 3]!, position[n * 3 + 1]!, position[n * 3 + 2]!]), n * 3);
  for (const J of [R, L]) for (const k of ["shoulder", "elbow", "wrist", "hand"] as const) J[k] = morph(J[k]);
  // (Leg joints sit on the bone axes, which the leg swelling leaves in place.)
  for (const v of [head, headTop]) v.splice(0, 3, ...morph(v));
  if (WRITE_BIND) writeBind();
}
console.log(`shorts: ${fitShorts(position, index, tissue, (v) => tissue[v] === TISSUE.cover && muscleMix[v]! >= 200)} vertices lifted clear of the muscles`);
// ---------------------------------------------------------------- write
const blocks: { name: string; data: ArrayBufferView }[] = [
  { name: "position", data: position },
  { name: "index", data: NV < 65536 ? new Uint16Array(index) : index },
  { name: "forcedBone", data: forced },
  { name: "skinIndex", data: skinIndex },
  { name: "skinWeight", data: skinWeight },
  { name: "muscleA", data: label },
  { name: "muscleMix", data: muscleMix },
  { name: "tissue", data: tissue },
  { name: "fiber", data: fiber },
  { name: "limb", data: limbs },
  ...(RAW ? [{ name: "color", data: color }] : []),
];
let offset = 0;
const layout: Record<string, { offset: number; length: number; type: string }> = {};
const chunks: Buffer[] = [];
for (const p of blocks) {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    offset += pad;
  }
  const buf = Buffer.from(p.data.buffer, p.data.byteOffset, p.data.byteLength);
  layout[p.name] = { offset, length: (p.data as unknown as { length: number }).length, type: p.data.constructor.name };
  chunks.push(buf);
  offset += buf.byteLength;
}
mkdirSync("public/anatomy", { recursive: true });
writeFileSync(`${OUT}.bin`, Buffer.concat(chunks));
const source = RAW
  ? `Écorché (github.com/Charleeh/ecorche, CC BY-SA 4.0; BodyParts3D CC BY 4.0, Z-Anatomy CC BY-SA 4.0), unaltered geometry and colours; rig${SHORTS ? ", shorts" : ""} and muscle labels added`
  : !ECORCHE
  ? "BodyParts3D 3.0 (CC BY-SA 2.1 JP)"
  : ECORCHE_USE === "torso"
    ? "BodyParts3D 3.0 (CC BY-SA 2.1 JP) with torso and back muscles from Écorché (github.com/Charleeh/ecorche, CC BY-SA 4.0; BodyParts3D CC BY 4.0, Z-Anatomy CC BY-SA 4.0); head MakeHuman (CC0)"
    : "Écorché (github.com/Charleeh/ecorche, CC BY-SA 4.0; BodyParts3D CC BY 4.0, Z-Anatomy CC BY-SA 4.0) + BodyParts3D skin";
// The raw athlete keeps its own proportions, so it carries its own (measured, unwidened) joints.
const bind = RAW ? JSON.parse(JSON.stringify(BINDM, (_, v) => (Array.isArray(v) && typeof v[0] === "number" ? r1(v as V3) : v))) : undefined;
writeFileSync(`${OUT}.json`, JSON.stringify({ version: 3, source, vertices: NV, triangles: NI / 3, bytes: offset, layout, bones: BONES, bind }, null, 1));
console.log(`wrote ${OUT}.bin (${(offset / 1e6).toFixed(2)} MB)`);
