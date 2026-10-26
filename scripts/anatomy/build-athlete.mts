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
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MeshoptSimplifier } from "meshoptimizer";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { BONES, muscleId, NO_MUSCLE, TISSUE, type BoneName, type Region } from "../../src/lib/anatomy3d/muscle-ids";
import { kindOf, regionOf, sideOf, type PartKind } from "./bp3d-regions";
import { buildMakeHumanHead } from "./makehuman-head";
import { computeWeights, NO_BONE } from "./weights";

type V3 = [number, number, number];
const DATA = process.argv[2];
if (!DATA || !existsSync(join(DATA, "parts_list_e.txt"))) {
  console.error("usage: npx tsx scripts/anatomy/build-athlete.mts <BodyParts3D_data dir>");
  process.exit(1);
}
const HEIGHT = 183; // cm, matching the 2D motion figure
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
writeBind();
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
let muscleTris = 0;
for (const [id, name] of names) {
  const kind = kindOf(name);
  if (!kind || !existsSync(stlPath(id))) continue;
  const raw = load(id);
  const tris = raw.idx.length / 3;
  const target = kind === "muscle" ? Math.min(7000, Math.max(450, Math.round(tris / 36))) : kind === "bone" ? Math.min(2200, Math.max(120, Math.round(tris / 70))) : Math.min(1500, Math.max(150, Math.round(tris / 30)));
  const m = simplify(raw, target, 0.01);
  orientOutward(m);
  const region = kind === "muscle" ? regionOf(name) : null;
  const axis = longAxis(m);
  let extra: Float32Array | undefined;
  if (kind === "muscle") {
    // Tendinous ends: the last stretch of the muscle along its length shades paler and glossier, like the tendons
    // and aponeuroses of an anatomy plate.
    const ps = verts(m);
    const c = centroid(ps);
    const along = ps.map((p) => dot(sub(p, c), axis));
    const reach = Math.max(...along.map(Math.abs)) || 1;
    extra = new Float32Array(along.map((a) => smoothstep(0.7, 0.97, Math.abs(a) / reach)));
    if (/rectus abdominis/.test(name)) carveAbs(m);
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
// Eyes: real eyeballs in the sockets, with the iris and pupil marked for the shader.
{
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
for (const [name, test, tris] of [
  ["face", isHead, 40000],
  ["hands", handOf, 16000],
  ["feet", isFoot, 9000],
] as const) {
  const m = cropAndSimplify(skin, test, tris);
  parts.push({ name, kind: "skin", mesh: m, label: NO_MUSCLE, fiber: [0, 1, 0], rigid: name === "face" ? "head" : null, extra: name === "face" ? hairMask(m) : undefined });
}
// A new face: the MakeHuman head (CC0), shaped for a stronger adult male face, fitted where the scanned head was.
const MAKEHUMAN = process.argv[3];
if (MAKEHUMAN) {
  const eyesPart = parts.find((pt) => pt.kind === "eye")!;
  const eyeMid = centroid(verts(eyesPart.mesh));
  const sk = verts(skin);
  const crownY = sk.reduce((m, p) => Math.max(m, p[1]), -Infinity);
  const chinY = sk
    .filter((p) => Math.abs(p[2]) < 1.5 && p[1] > eyeMid[1] - 16 && p[1] < eyeMid[1] - 5 && p[0] > eyeMid[0] - 3)
    .reduce((m, p) => Math.min(m, p[1]), Infinity);
  const { head: mhHead, eyes: mhEyes } = buildMakeHumanHead(MAKEHUMAN, { eyeMid, chinY, crownY, cutY: (x) => 147.5 - 0.35 * x });
  // The new neck is skin: the deep neck muscles that would poke through it behind the ears are left out.
  for (let i = parts.length - 1; i >= 0; i--)
    if (/splenius|semispinalis capitis|levator scapulae/.test(parts[i]!.name)) parts.splice(i, 1);
  const face = parts.findIndex((pt) => pt.name === "face");
  const headMesh: Mesh = { pos: mhHead.pos, idx: mhHead.idx };
  parts[face] = { name: "face", kind: "skin", mesh: headMesh, label: NO_MUSCLE, fiber: [0, 1, 0], rigid: null, extra: hairMask(headMesh, centroid(Array.from({ length: mhEyes.pos.length / 3 }, (_, i) => [mhEyes.pos[i * 3]!, mhEyes.pos[i * 3 + 1]!, mhEyes.pos[i * 3 + 2]!] as V3))) };
  const eyeMesh: Mesh = { pos: mhEyes.pos, idx: mhEyes.idx };
  parts[parts.indexOf(eyesPart)] = { ...eyesPart, mesh: eyeMesh, extra: eyeIris(eyeMesh) };
  console.log(`MakeHuman head: ${headMesh.idx.length / 3} triangles (chin ${chinY.toFixed(1)}, crown ${crownY.toFixed(1)})`);
}

// ---------------------------------------------------------------- fascia layer and pelvic cover
// The fascia is the body surface shrink-wrapped to just under the muscles: hidden beneath each muscle, it fills the
// grooves and gaps between them with dark tissue, so no hole ever shows through the écorché.
const CELL = 1.5;
const grid = new Map<number, number[]>();
const triPos: number[] = [];
const ck = (i: number, j: number, k: number) => (i + 512) * 1048576 + (j + 512) * 1024 + (k + 512);
for (const part of parts) {
  if (part.kind !== "muscle" && part.kind !== "bone" && part.kind !== "tendon") continue;
  const m = part.mesh;
  for (let t = 0; t < m.idx.length; t += 3) {
    const id = triPos.length / 9;
    for (let k = 0; k < 3; k++) triPos.push(...vert(m, m.idx[t + k]!));
    const o = id * 9;
    const mn = [0, 1, 2].map((k) => Math.floor(Math.min(triPos[o + k]!, triPos[o + 3 + k]!, triPos[o + 6 + k]!) / CELL));
    const mx = [0, 1, 2].map((k) => Math.floor(Math.max(triPos[o + k]!, triPos[o + 3 + k]!, triPos[o + 6 + k]!) / CELL));
    for (let i = mn[0]!; i <= mx[0]!; i++)
      for (let j = mn[1]!; j <= mx[1]!; j++)
        for (let k = mn[2]!; k <= mx[2]!; k++) {
          const key = ck(i, j, k);
          const a = grid.get(key);
          if (a) a.push(id);
          else grid.set(key, [id]);
        }
  }
}
const triV = (t: number, k: number): V3 => [triPos[t * 9 + k * 3]!, triPos[t * 9 + k * 3 + 1]!, triPos[t * 9 + k * 3 + 2]!];
/** Closest point on a triangle (Ericson, Real-Time Collision Detection 5.1.5). */
function closestOnTri(p: V3, a: V3, b: V3, c: V3): V3 {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, mul(ab, d1 / (d1 - d3)));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, mul(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(b, mul(sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6))));
  const denom = 1 / (va + vb + vc);
  return add(a, add(mul(ab, vb * denom), mul(ac, vc * denom)));
}
function nearestSurface(p: V3, radius: number): { q: V3; n: V3; d: number } | null {
  const r = Math.ceil(radius / CELL);
  const ci = Math.floor(p[0] / CELL), cj = Math.floor(p[1] / CELL), ckk = Math.floor(p[2] / CELL);
  let best: { q: V3; n: V3; d: number } | null = null;
  const seen = new Set<number>();
  for (let i = -r; i <= r; i++)
    for (let j = -r; j <= r; j++)
      for (let k = -r; k <= r; k++) {
        const list = grid.get(ck(ci + i, cj + j, ckk + k));
        if (!list) continue;
        for (const t of list) {
          if (seen.has(t)) continue;
          seen.add(t);
          const q = closestOnTri(p, triV(t, 0), triV(t, 1), triV(t, 2));
          const d = len(sub(p, q));
          if (d < radius && (!best || d < best.d)) best = { q, n: norm(cross(sub(triV(t, 1), triV(t, 0)), sub(triV(t, 2), triV(t, 0)))), d };
        }
      }
  return best;
}
{
  const body = cropAndSimplify(skin, (p) => !isHead(p) && !handOf(p) && !isFoot(p), 50000);
  const nb = body.pos.length / 3;
  const nrm = vertexNormals(body);
  const groin = (p: V3) => (1 - smoothstep(6.5, 9.5, Math.abs(p[2]))) * smoothstep(58, 63, p[1]) * (1 - smoothstep(86, 91, p[1])) * smoothstep(0, 3, p[0]);
  const coverMark = new Uint8Array(nb);
  const disp = new Float32Array(nb * 3);
  for (let n = 0; n < nb; n++) {
    const p = vert(body, n);
    const g = groin(p);
    coverMark[n] = g > 0.5 ? 1 : 0;
    if (g > 0.5) {
      // The cover is pressed smooth and close to the body: no anatomical detail of the genitals.
      // A flat, discreet panel: everything in front of a smooth curve is pressed onto it.
      const cap = 1.6 + 5.2 * smoothstep(62, 88, p[1]);
      const target: V3 = [p[0] > cap - 2 ? cap - 0.2 : p[0] - 0.2, p[1], p[2] * 0.97];
      disp.set(sub(target, p), n * 3);
      continue;
    }
    // Under the nearest muscle, bone or tendon; where there's nothing close, sink well below the surface.
    const hit = nearestSurface(p, 6);
    const target = hit ? sub(hit.q, mul(dot(sub(p, hit.q), hit.n) >= 0 ? hit.n : mul(hit.n, -1), 0.6)) : sub(p, mul([nrm[n * 3]!, nrm[n * 3 + 1]!, nrm[n * 3 + 2]!], 3));
    disp.set(sub(target, p), n * 3);
  }
  // Smooth the pull so the fascia stays a clean surface.
  const nbrs: Set<number>[] = Array.from({ length: nb }, () => new Set());
  for (let t = 0; t < body.idx.length; t += 3) {
    const a = body.idx[t]!, b2 = body.idx[t + 1]!, c = body.idx[t + 2]!;
    nbrs[a]!.add(b2).add(c);
    nbrs[b2]!.add(a).add(c);
    nbrs[c]!.add(a).add(b2);
  }
  for (let it = 0; it < 7; it++) {
    const next = new Float32Array(disp.length);
    for (let n = 0; n < nb; n++) {
      const ns = [...nbrs[n]!];
      for (let k = 0; k < 3; k++) {
        let s2 = disp[n * 3 + k]! * 2;
        for (const m of ns) s2 += disp[m * 3 + k]! / ns.length;
        next[n * 3 + k] = s2 / 3;
      }
    }
    disp.set(next);
  }
  for (let i = 0; i < body.pos.length; i++) body.pos[i]! += disp[i]!;
  const deepIdx: number[] = [], coverIdx: number[] = [];
  for (let t = 0; t < body.idx.length; t += 3) {
    const tri = [body.idx[t]!, body.idx[t + 1]!, body.idx[t + 2]!];
    (tri.some((v) => coverMark[v]) ? coverIdx : deepIdx).push(...tri);
  }
  parts.push({ name: "fascia", kind: "deep", mesh: compact(body.pos, new Uint32Array(deepIdx)), label: NO_MUSCLE, fiber: [0, 1, 0], rigid: null });
  parts.push({ name: "pelvic cover", kind: "cover", mesh: compact(body.pos, new Uint32Array(coverIdx)), label: NO_MUSCLE, fiber: [0, 1, 0], rigid: null });
}

// ---------------------------------------------------------------- shorts
// Clean black compression shorts with a short inseam: the body surface in the shorts area, pulled straight in until
// it sits just above the muscles underneath (so the fabric is smooth and snug, never patchy), with a thin gold trim at
// the waistband and the hems.
const shortsWaist = (p: V3) => 95.5 + 3 * smoothstep(2, -8, p[0]);
const shortsHem = (p: V3) => 68.5 + 3.5 * smoothstep(6, 16, Math.abs(p[2]));
{
  const under: number[] = [];
  const underIdx: number[] = [];
  for (const part of parts) {
    if (part.kind === "skin" || part.kind === "deep" || part.kind === "eye") continue;
    const base = under.length / 3;
    for (const v of part.mesh.pos) under.push(v);
    for (const i of part.mesh.idx) underIdx.push(i + base);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(under), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(underIdx), 1));
  const bvh = new MeshBVH(geo);
  const side = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const inShorts = (p: V3) => !handOf(p) && Math.abs(p[2]) < 23 && p[1] > shortsHem(p) && p[1] < shortsWaist(p);
  const m = cropAndSimplify(skin, inShorts, 26000);
  const nv = m.pos.length / 3;
  const nrm = vertexNormals(m);
  const disp = new Float32Array(nv * 3);
  const trim = new Float32Array(nv);
  const ray = new THREE.Ray();
  for (let n = 0; n < nv; n++) {
    const p = vert(m, n);
    trim[n] = Math.min(Math.abs(p[1] - shortsWaist(p)), Math.abs(p[1] - shortsHem(p))) < 1.1 ? 1 : 0;
    const nn: V3 = [nrm[n * 3]!, nrm[n * 3 + 1]!, nrm[n * 3 + 2]!];
    ray.origin.set(p[0] + nn[0] * 0.3, p[1] + nn[1] * 0.3, p[2] + nn[2] * 0.3);
    ray.direction.set(-nn[0], -nn[1], -nn[2]);
    const hit = bvh.raycastFirst(ray, side, 0, 8);
    const depth = hit ? Math.max(0, hit.distance - 0.3 - 0.55) * 0.9 : 0.8;
    let target = sub(p, mul(nn, depth));
    // Over the groin the fabric lies flat.
    const g = (1 - smoothstep(6.5, 9.5, Math.abs(p[2]))) * smoothstep(58, 63, p[1]) * smoothstep(0, 3, p[0]);
    if (g > 0) {
      const cap = 2.6 + 5.0 * smoothstep(62, 88, p[1]);
      target = [target[0] + (Math.min(target[0], cap) - target[0]) * g, target[1], target[2]];
    }
    disp.set(sub(target, p), n * 3);
  }
  const nbrs: Set<number>[] = Array.from({ length: nv }, () => new Set());
  for (let t = 0; t < m.idx.length; t += 3) {
    const a = m.idx[t]!, b2 = m.idx[t + 1]!, c = m.idx[t + 2]!;
    nbrs[a]!.add(b2).add(c);
    nbrs[b2]!.add(a).add(c);
    nbrs[c]!.add(a).add(b2);
  }
  for (let it = 0; it < 8; it++) {
    const next = new Float32Array(disp.length);
    for (let n = 0; n < nv; n++) {
      const ns = [...nbrs[n]!];
      for (let k = 0; k < 3; k++) {
        let s2 = disp[n * 3 + k]! * 2;
        for (const o of ns) s2 += disp[o * 3 + k]! / ns.length;
        next[n * 3 + k] = s2 / 3;
      }
    }
    disp.set(next);
  }
  for (let i = 0; i < m.pos.length; i++) m.pos[i]! += disp[i]!;
  parts.push({ name: "shorts", kind: "cover", mesh: m, label: NO_MUSCLE, fiber: [0, 1, 0], rigid: null, extra: trim });
}

// ---------------------------------------------------------------- assemble
const TISSUE_OF = { muscle: TISSUE.muscle, bone: TISSUE.bone, tendon: TISSUE.tendon, skin: TISSUE.skin, deep: TISSUE.deep, cover: TISSUE.cover, eye: TISSUE.eye } as const;
const NV = parts.reduce((s, p) => s + p.mesh.pos.length / 3, 0);
const NI = parts.reduce((s, p) => s + p.mesh.idx.length, 0);
const position = new Float32Array(NV * 3);
const index = new Uint32Array(NI);
const label = new Uint8Array(NV).fill(NO_MUSCLE);
const labelB = new Uint8Array(NV).fill(NO_MUSCLE);
const muscleMix = new Uint8Array(NV);
const tissue = new Uint8Array(NV);
const fiber = new Int8Array(NV * 3);
const forced = new Uint8Array(NV).fill(NO_BONE);
{
  let vo = 0, io = 0;
  for (const p of parts) {
    const nv = p.mesh.pos.length / 3;
    position.set(p.mesh.pos, vo * 3);
    for (let i = 0; i < p.mesh.idx.length; i++) index[io + i] = p.mesh.idx[i]! + vo;
    for (let n = 0; n < nv; n++) {
      label[vo + n] = p.label;
      labelB[vo + n] = p.label;
      tissue[vo + n] = TISSUE_OF[p.kind];
      if (p.extra) muscleMix[vo + n] = Math.round(p.extra[n]! * 255);
      for (let k = 0; k < 3; k++) fiber[(vo + n) * 3 + k] = Math.round(p.fiber[k]! * 127);
      if (p.rigid) forced[vo + n] = BONES.indexOf(p.rigid);
    }
    vo += nv;
    io += p.mesh.idx.length;
  }
}
console.log(`athlete: ${NV} vertices, ${NI / 3} triangles`);

// ---------------------------------------------------------------- skin weights (refined by scripts/anatomy/reweight.mts)
const { skinIndex, skinWeight } = computeWeights(position, index, label, BINDM, forced);

// ---------------------------------------------------------------- athletic proportions
// The database's subject is an average build. A broader, deeper chest and upper back, shoulders set wider to match,
// fuller arms and neck, and a slightly lower crown give an athletic frame. The change is one smooth deformation of
// space (it depends only on where a point is), so muscles, bones, fascia and joints all move together and every layer
// keeps its place.
{
  const torsoF = (y: number) => smoothstep(106, 126, y) * (1 - smoothstep(154, 163, y));
  const torso = (p: V3): V3 => {
    const f = torsoF(p[1]);
    return [(p[0] - neckBase[0]) * (1 + 0.09 * f) + neckBase[0], p[1], p[2] * (1 + 0.12 * f)];
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
    const k = (useUp ? 1.13 : 1.13 - 0.06 * smoothstep(0.0, 0.25, c.t)) * (1 - smoothstep(-1, 1.5, beyondWrist)) + smoothstep(-1, 1.5, beyondWrist);
    return { w, out: add(add(c.q, mul(sub(p, c.q), k)), shift) };
  };
  const eyesPart = parts.find((pt) => pt.kind === "eye");
  const browY = eyesPart ? centroid(verts(eyesPart.mesh))[1] + 2 : headTop[1] - 9;
  const morph = (p: V3): V3 => {
    let q = torso(p);
    for (const J of [R, L]) {
      const a = arm(p, J);
      if (a.w > 0) q = lerp(q, a.out, a.w);
    }
    // Neck: a little fuller.
    const nw = smoothstep(148, 154, p[1]) * (1 - smoothstep(160, 165, p[1])) * (1 - smoothstep(8, 11, Math.hypot(p[0] - neckBase[0], p[2])));
    if (nw > 0) {
      const c: V3 = [neckBase[0], p[1], 0];
      q = lerp(q, add(c, mul(sub(p, c), 1.08)), nw);
    }
    // Crown: slightly lower, for a natural head shape.
    if (p[1] > browY) q[1] = browY + (q[1] - browY) * (1 - 0.06 * smoothstep(browY, browY + 4, p[1]));
    return q;
  };
  for (let n = 0; n < NV; n++) position.set(morph([position[n * 3]!, position[n * 3 + 1]!, position[n * 3 + 2]!]), n * 3);
  for (const J of [R, L]) for (const k of ["shoulder", "elbow", "wrist", "hand"] as const) J[k] = morph(J[k]);
  for (const v of [head, headTop]) v.splice(0, 3, ...morph(v));
  writeBind();
}
// ---------------------------------------------------------------- write
const blocks: { name: string; data: ArrayBufferView }[] = [
  { name: "position", data: position },
  { name: "index", data: NV < 65536 ? new Uint16Array(index) : index },
  { name: "forcedBone", data: forced },
  { name: "skinIndex", data: skinIndex },
  { name: "skinWeight", data: skinWeight },
  { name: "muscleA", data: label },
  { name: "muscleB", data: labelB },
  { name: "muscleMix", data: muscleMix },
  { name: "tissue", data: tissue },
  { name: "fiber", data: fiber },
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
writeFileSync("public/anatomy/athlete.bin", Buffer.concat(chunks));
writeFileSync(
  "public/anatomy/athlete.json",
  JSON.stringify({ version: 3, source: "BodyParts3D 3.0 (CC BY-SA 2.1 JP)", vertices: NV, triangles: NI / 3, bytes: offset, layout, bones: BONES }, null, 1),
);
console.log(`wrote public/anatomy/athlete.bin (${(offset / 1e6).toFixed(2)} MB)`);
