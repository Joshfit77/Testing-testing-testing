/**
 * The anatomical rig for the original Écorché file (public/anatomy/ecorche.glb): a skeleton whose joints are measured
 * from the model's own bones, and skin weights for every one of its 634 parts.
 *
 *   npx tsx scripts/anatomy/build-ecorche-rig.mts
 *
 * Why: the first rig took its joints and weights from a rebuilt copy of the body, with one chest bone for the whole
 * shoulder girdle, no forearm twist and no fingers, and weights by distance to bone segments. Lifting an arm overhead
 * then turned the deltoid, lats and traps around a single joint, which folded them into spikes, and a palm could not turn
 * up or down. The file has every bone and muscle as its own part, so this rig is built from the anatomy itself:
 *
 * - Bones are rigid: each bone part follows exactly one rig bone (the humerus the upper arm, the scapula the shoulder
 *   blade, each phalanx its own finger bone). A bone never bends.
 * - The shoulder girdle has its own two bones per side (clavicle, scapula), so the shoulder blade can rotate upwards as the
 *   arm rises, as it does in the body, instead of the arm swinging alone against the ribs.
 * - The forearm has the ulna (the elbow hinge) and the radius, which turns about the ulna for pronation and supination,
 *   carrying the hand: the palm can face up, down or in.
 * - Each muscle follows the bones it lies on and attaches to: per vertex, a target from its distance to those bones'
 *   surfaces, spread over the muscle and through its thickness by bone heat (Baran & Popović 2007), so a muscle that
 *   crosses a joint stretches evenly along its length.
 * - Across the joints that turn furthest (shoulder, hip, knee, elbow) the weights pass through blend helpers at the
 *   joint that turn a third and two thirds of the way, so no vertex blends two bones much more than 60° apart.
 * - Muscles that span a joint far from its centre (lats, pectorals, teres, deltoid, infraspinatus, the deep hip
 *   rotators) are marked to be skinned linearly: they stretch as straight bands across the joint instead of swinging
 *   round it.
 *
 * Joint centres: hips and shoulders by sphere fits to the femoral and humeral heads; elbows, knees and ankles on the line
 * between the epicondyles or malleoli; the spine at the intervertebral disks; fingers between the phalanges.
 *
 * Writes public/anatomy/ecorche-rig.json (frame, bones with rest frames and hinge axes, per-part vertex ranges) and
 * ecorche-rig.bin (four bone indices and four weights, a byte each, per vertex: the file's parts in order, then the face
 * surface from public/anatomy/ecorche-face.bin).
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";

const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
const buf = readFileSync("public/anatomy/ecorche.glb");
const gltf = await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, "");
gltf.scene.updateMatrixWorld(true);

type V = THREE.Vector3;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- the rig frame
// Centimetres, +X forward (the file faces +Z), +Y up, +Z the figure's right (the file's -X), soles on y = 0, scaled
// as the first rig was (184 cm), so the exercise motions' floor, benches and bars keep their heights.
const SCALE = 107.445;
const parts: { name: string; bone: boolean; pos: Float32Array; index: Uint32Array }[] = [];
gltf.scene.traverse((o) => {
  if (!(o instanceof THREE.Mesh)) return;
  const p = o.geometry.getAttribute("position");
  const pos = new Float32Array(p.count * 3);
  const v = V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
    pos.set([v.z * SCALE, v.y * SCALE, -v.x * SCALE], i * 3);
  }
  const idx = o.geometry.index ? Uint32Array.from(o.geometry.index.array) : Uint32Array.from({ length: p.count }, (_, i) => i);
  parts.push({ name: o.name, bone: (o.material as THREE.Material).name === "Bone", pos, index: idx });
});
const byName = new Map(parts.map((p) => [p.name, p]));
const part = (name: string) => {
  const p = byName.get(name);
  if (!p) throw new Error(`no part ${name}`);
  return p;
};
// Floor and centre: soles on y = 0; the mid-point between the hip joints on x = z = 0 (set once the hips are measured).
let minY = Infinity;
for (const p of parts) for (let i = 1; i < p.pos.length; i += 3) minY = Math.min(minY, p.pos[i]!);
const shift = V3(0, -minY, 0);
const applyShift = (s: V) => {
  for (const p of parts)
    for (let i = 0; i < p.pos.length; i += 3) {
      p.pos[i]! += s.x;
      p.pos[i + 1]! += s.y;
      p.pos[i + 2]! += s.z;
    }
};
applyShift(shift);

// ---------------------------------------------------------------- geometry helpers
const pts = (name: string) => {
  const p = part(name).pos;
  return Array.from({ length: p.length / 3 }, (_, i) => V3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]));
};
const centroid = (ps: V[]) => ps.reduce((a, p) => a.add(p), V3()).multiplyScalar(1 / ps.length);
/** Principal axis of a point set (power iteration on the covariance). */
const axisOf = (ps: V[]) => {
  const c = centroid(ps);
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of ps) {
    const d = [p.x - c.x, p.y - c.y, p.z - c.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j]! += d[i]! * d[j]!;
  }
  let v = V3(0.3, 1, 0.2).normalize();
  for (let it = 0; it < 60; it++)
    v = V3(C[0]! * v.x + C[1]! * v.y + C[2]! * v.z, C[3]! * v.x + C[4]! * v.y + C[5]! * v.z, C[6]! * v.x + C[7]! * v.y + C[8]! * v.z).normalize();
  return v;
};
/** The two ends of a bone along its principal axis (oriented so `toward` is the second), each the mean of the points
 *  within `band` cm of the extreme. */
const ends = (ps: V[], toward: V, band = 0.4) => {
  let ax = axisOf(ps);
  if (ax.dot(toward) < 0) ax = ax.negate();
  const t = ps.map((p) => p.dot(ax));
  const lo = Math.min(...t), hi = Math.max(...t);
  const near = (v: number) => centroid(ps.filter((_, i) => Math.abs(t[i]! - v) < band));
  return { a: near(lo), b: near(hi), axis: ax, length: hi - lo };
};
/** Least-squares sphere through points, refitted without outliers. */
const sphereFit = (ps0: V[]) => {
  let ps = ps0;
  let c = centroid(ps), r = 0;
  for (let round = 0; round < 4; round++) {
    // Linear form: |p|² = 2c·p + (r² - |c|²).
    const A: number[][] = [], b: number[] = [];
    for (const p of ps) {
      A.push([2 * p.x, 2 * p.y, 2 * p.z, 1]);
      b.push(p.lengthSq());
    }
    const x = lstsq(A, b);
    c = V3(x[0], x[1], x[2]);
    r = Math.sqrt(Math.max(0, x[3]! + c.lengthSq()));
    const res = ps.map((p) => Math.abs(p.distanceTo(c) - r));
    const sorted = [...res].sort((a, b) => a - b);
    const cut = Math.max(0.15, sorted[Math.floor(sorted.length * 0.75)]! * 1.5);
    const next = ps.filter((_, i) => res[i]! <= cut);
    if (next.length === ps.length || next.length < 12) break;
    ps = next;
  }
  return { c, r };
};
function lstsq(A: number[][], b: number[]): number[] {
  const n = A[0]!.length;
  const N = Array.from({ length: n }, () => new Array(n).fill(0));
  const y = new Array(n).fill(0);
  A.forEach((row, k) => {
    for (let i = 0; i < n; i++) {
      y[i] += row[i]! * b[k]!;
      for (let j = 0; j < n; j++) N[i]![j] += row[i]! * row[j]!;
    }
  });
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(N[r]![c]) > Math.abs(N[p]![c])) p = r;
    [N[c], N[p]] = [N[p]!, N[c]!];
    [y[c], y[p]] = [y[p], y[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = N[r]![c] / N[c]![c];
      for (let j = c; j < n; j++) N[r]![j] -= f * N[c]![j];
      y[r] -= f * y[c];
    }
  }
  return y.map((v, i) => v / N[i]![i]);
}
const quantile = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * q)]!;

// ---------------------------------------------------------------- joints, per side
const SIDES = [
  { s: "R", lr: "right", Lr: "Right", sign: 1 },
  { s: "L", lr: "left", Lr: "Left", sign: -1 },
] as const;
const FINGERS = ["index", "middle", "ring", "little"] as const;
const META = { thumb: "first", index: "second", middle: "third", ring: "fourth", little: "fifth" } as const;

const measureSide = (sd: (typeof SIDES)[number]) => {
  const { Lr, lr, sign } = sd;
  const outward = V3(0, 0, sign);
  // Hip: sphere fit to the femoral head (the inner half of the top of the femur; the greater trochanter is outside).
  const femur = pts(`${Lr}_femur`);
  const fTop = Math.max(...femur.map((p) => p.y));
  const fTopPts = femur.filter((p) => p.y > fTop - 6.5);
  const medZ = quantile(fTopPts.map((p) => p.z * sign), 0.5);
  const hip = sphereFit(fTopPts.filter((p) => p.z * sign < medZ));
  // Knee: the femoral condyles; axis between their outer extremes, centre ~one condyle radius above the lowest point.
  const fBot = Math.min(...femur.map((p) => p.y));
  const cond = femur.filter((p) => p.y < fBot + 5);
  const czs = cond.map((p) => p.z * sign);
  const zIn = quantile(czs, 0.02), zOut = quantile(czs, 0.98);
  const inner = centroid(cond.filter((p) => p.z * sign < zIn + 0.6)), outer = centroid(cond.filter((p) => p.z * sign > zOut - 0.6));
  const kneeAxis = outer.clone().sub(inner).normalize();
  const knee = inner.clone().add(outer).multiplyScalar(0.5);
  knee.y = fBot + 2.2;
  // Ankle: the malleoli (lowest points of tibia and fibula), axis between them; centre at the talus dome.
  const tibia = pts(`${Lr}_tibia`), fibula = pts(`${Lr}_fibula`);
  const lowest = (ps: V[], band = 1) => {
    const m = Math.min(...ps.map((p) => p.y));
    return centroid(ps.filter((p) => p.y < m + band));
  };
  const medMall = lowest(tibia), latMall = lowest(fibula);
  const ankleAxis = latMall.clone().sub(medMall).normalize();
  const talus = pts(`${Lr}_talus`);
  const ankle = centroid(talus);
  ankle.y = Math.max(...talus.map((p) => p.y)) - 1.4;
  // Toes: the heads of the metatarsals.
  const mtp = ["first", "second", "third", "fourth", "fifth"].map((n) => ends(pts(`${Lr}_${n}_metatarsal_bone`), V3(1, 0, 0)).b);
  const ball = centroid(mtp);
  const toeTip = centroid(["big", "second", "third"].map((n) => ends(pts(`Distal_phalanx_of_${lr}_${n}_toe`), V3(1, 0, 0)).b));
  const heel = lowest(pts(`${Lr}_calcaneus`), 0.8);

  // Shoulder girdle: the clavicle's two ends (sternoclavicular and acromioclavicular joints).
  const clav = ends(pts(`${Lr}_clavicle`), outward);
  const sc = clav.a.clone().addScaledVector(clav.axis, 0.5);
  const ac = clav.b.clone().addScaledVector(clav.axis, -0.5);
  // Shoulder: sphere fit to the humeral head (the inner, rear part of the top of the humerus).
  const hum = pts(`${Lr}_humerus`);
  const hTop = Math.max(...hum.map((p) => p.y));
  const hTopPts = hum.filter((p) => p.y > hTop - 5);
  const hz = quantile(hTopPts.map((p) => p.z * sign), 0.55);
  const shoulder = sphereFit(hTopPts.filter((p) => p.z * sign < hz));
  // Elbow: the epicondyles (outer extremes of the lower humerus) give the hinge axis; the centre sits on it, level
  // with the top of the radial head plus the capitulum's radius.
  const hBot = Math.min(...hum.map((p) => p.y));
  const low = hum.filter((p) => p.y < hBot + 5.5);
  const lzs = low.map((p) => p.z * sign);
  const eIn = centroid(low.filter((p) => p.z * sign < quantile(lzs, 0.02) + 0.5));
  const eOut = centroid(low.filter((p) => p.z * sign > quantile(lzs, 0.98) - 0.5));
  const elbowAxis = eOut.clone().sub(eIn).normalize();
  const radius = pts(`${Lr}_radius`), ulna = pts(`${Lr}_ulna`);
  const rTop = Math.max(...radius.map((p) => p.y));
  const radialHead = centroid(radius.filter((p) => p.y > rTop - 1.2));
  const uBot = Math.min(...ulna.map((p) => p.y));
  const ulnarHead = centroid(ulna.filter((p) => p.y < uBot + 1.4));
  const onAxis = (p: V, a: V, dir: V) => a.clone().addScaledVector(dir, p.clone().sub(a).dot(dir));
  const elbow = onAxis(radialHead.clone().addScaledVector(radialHead.clone().sub(ulnarHead).normalize(), 1.1), eIn, elbowAxis);
  // Wrist: between the lunate and the capitate (the wrist's centre of rotation).
  const wrist = centroid([...pts(`${Lr}_lunate`), ...pts(`${Lr}_capitate`)]);
  // Fingers: the joints between metacarpal and phalanges, each the mid-point of the two facing ends.
  const handDir = wrist.clone().sub(elbow).normalize();
  const finger = (f: (typeof FINGERS)[number] | "thumb") => {
    const meta = ends(pts(`${Lr}_${META[f]}_metacarpal_bone`), handDir);
    const prox = ends(pts(`Proximal_phalanx_of_${lr}_${f === "thumb" ? "thumb" : `${f}_finger`}`), meta.axis);
    const mid = f === "thumb" ? null : ends(pts(`Middle_phalanx_of_${lr}_${f}_finger`), prox.axis);
    const dist = ends(pts(`Distal_phalanx_of_${lr}_${f === "thumb" ? "thumb" : `${f}_finger`}`), (mid ?? prox).axis);
    const j = (a: V, b: V) => a.clone().add(b).multiplyScalar(0.5);
    return f === "thumb"
      ? { cmc: meta.a.clone().addScaledVector(meta.axis, 0.6), mcp: j(meta.b, prox.a), ip: j(prox.b, dist.a), tip: dist.b }
      : { mcp: j(meta.b, prox.a), pip: j(prox.b, mid!.a), dip: j(mid!.b, dist.a), tip: dist.b };
  };
  return {
    hip: hip.c, hipR: hip.r, knee, kneeAxis, ankle, ankleAxis, ball, toeTip, heel,
    sc, ac, shoulder: shoulder.c, shoulderR: shoulder.r, elbow, elbowAxis, radialHead, ulnarHead, wrist,
    thumb: finger("thumb"), index: finger("index"), middle: finger("middle"), ring: finger("ring"), little: finger("little"),
  };
};
let J = { R: measureSide(SIDES[0]), L: measureSide(SIDES[1]) };
// Centre the rig between the hips (x and z), and measure again in that frame.
const centre = J.R.hip.clone().add(J.L.hip).multiplyScalar(0.5);
applyShift(V3(-centre.x, 0, -centre.z));
J = { R: measureSide(SIDES[0]), L: measureSide(SIDES[1]) };

// Spine: joints at the intervertebral disks (each disk is named after the vertebra above it).
const disk = (v: string) => centroid(pts(`Intervertebral_disk_of_${v}_vertebra`));
const sacrum = pts("Sacrum");
const spine = {
  pelvis: J.R.hip.clone().add(J.L.hip).multiplyScalar(0.5),
  lumbar1: disk("fifth_lumbar"), // L5/S1
  lumbar2: disk("third_lumbar"), // L3/L4
  thorax1: disk("first_lumbar"), // L1/L2
  thorax2: disk("sixth_thoracic"), // T6/T7
  neck: disk("seventh_cervical"), // C7/T1
  head: centroid(pts("Atlas")), // the atlas: nodding and turning the head
  headTop: V3(),
};
{
  const skull = ["Frontal_bone", "Left_parietal_bone", "Right_parietal_bone", "Occipital_bone"].flatMap((n) => (byName.has(n) ? pts(n) : []));
  const top = Math.max(...skull.map((p) => p.y));
  spine.headTop = V3(centroid(skull).x, top, 0);
}
void sacrum;

// ---------------------------------------------------------------- bones
type BoneDef = {
  name: string;
  parent: string | null;
  origin: V;
  /** Along the bone (to its child joint). */
  y: V;
  /** Forward reference (orthogonalised against y). */
  x: V;
  /** Hinge axis (world, rest) for hinge joints. */
  hinge?: V;
  /** Blend helper: turns a fraction `t` of the way from bone `from`'s turn to bone `to`'s, about `to`'s joint. */
  blend?: { from: string; to: string; t: number };
};
const bones: BoneDef[] = [];
const add = (name: string, parent: string | null, origin: V, to: V, x: V = V3(1, 0, 0), hinge?: V) =>
  bones.push({ name, parent, origin: origin.clone(), y: to.clone().sub(origin).normalize(), x: x.clone(), hinge: hinge?.clone() });
add("pelvis", null, spine.pelvis, spine.lumbar1.clone().add(V3(0, 1, 0)).setX(spine.pelvis.x).setY(spine.pelvis.y + 10));
add("lumbar1", "pelvis", spine.lumbar1, spine.lumbar2);
add("lumbar2", "lumbar1", spine.lumbar2, spine.thorax1);
add("thorax1", "lumbar2", spine.thorax1, spine.thorax2);
add("thorax2", "thorax1", spine.thorax2, spine.neck);
add("neck", "thorax2", spine.neck, spine.head);
add("head", "neck", spine.head, spine.headTop);
for (const { s, sign } of SIDES) {
  const j = J[s];
  const out = V3(0, 0, sign);
  add(`clav${s}`, "thorax2", j.sc, j.ac);
  // The scapula from the acromioclavicular joint to the shoulder joint (it carries the glenoid).
  add(`scap${s}`, `clav${s}`, j.ac, j.shoulder, V3(1, 0, 0));
  add(`humerus${s}`, `scap${s}`, j.shoulder, j.elbow);
  // Hinge axes point the way a positive rotation flexes the joint (right-hand rule): for the elbow, about the axis
  // pointing to the figure's left on both sides... fixed below by testing which sign brings the hand forward.
  add(`ulna${s}`, `humerus${s}`, j.elbow, j.ulnarHead, V3(1, 0, 0), j.elbowAxis);
  // The radius turns about the line from the radial head to the ulnar head (pronation and supination).
  add(`radius${s}`, `ulna${s}`, j.radialHead, j.ulnarHead, V3(1, 0, 0));
  const handTo = j.middle.mcp;
  add(`hand${s}`, `radius${s}`, j.wrist, handTo, V3(1, 0, 0));
  const palmFwd = V3(1, 0, 0);
  add(`thumb1${s}`, `hand${s}`, j.thumb.cmc, j.thumb.mcp, palmFwd);
  add(`thumb2${s}`, `thumb1${s}`, j.thumb.mcp, j.thumb.ip, palmFwd);
  add(`thumb3${s}`, `thumb2${s}`, j.thumb.ip, j.thumb.tip, palmFwd);
  for (const f of FINGERS) {
    const g = j[f];
    add(`${f}1${s}`, `hand${s}`, g.mcp, g.pip, palmFwd);
    add(`${f}2${s}`, `${f}1${s}`, g.pip, g.dip, palmFwd);
    add(`${f}3${s}`, `${f}2${s}`, g.dip, g.tip, palmFwd);
  }
  add(`thigh${s}`, "pelvis", j.hip, j.knee);
  add(`patella${s}`, `thigh${s}`, j.knee, j.knee.clone().add(V3(4, 0, 0)), V3(0, 1, 0));
  add(`shin${s}`, `thigh${s}`, j.knee, j.ankle, V3(1, 0, 0), j.kneeAxis);
  add(`foot${s}`, `shin${s}`, j.ankle, j.ball, V3(0, -1, 0), j.ankleAxis);
  add(`toes${s}`, `foot${s}`, j.ball, j.toeTip, V3(0, -1, 0));
  void out;
}
// Blend helpers across the joints that turn furthest (shoulder, hip, knee, elbow): bones at the joint that turn a third
// and two thirds of the way from the bone above to the bone below. Flesh that crosses the joint passes from one bone to
// the next through them, so no vertex is ever blended between two bones more than about 60° apart. Blending two bones
// that have turned 150-170° from each other (an arm overhead against the chest, a hip folded for the catch of a row)
// is what tears muscles into flaps and spikes: the blend of two rotations that far apart is unstable, and it cuts the
// corner of the joint instead of going round it.
const CHAINS: { key: string; from: string; to: string }[] = [];
for (const { s } of SIDES) {
  CHAINS.push(
    { key: `shT${s}`, from: "thorax2", to: `humerus${s}` },
    { key: `shS${s}`, from: `scap${s}`, to: `humerus${s}` },
    { key: `hip${s}`, from: "pelvis", to: `thigh${s}` },
    { key: `knee${s}`, from: `thigh${s}`, to: `shin${s}` },
    { key: `elb${s}`, from: `humerus${s}`, to: `ulna${s}` },
  );
}
for (const c of CHAINS) {
  const to = bones.find((b) => b.name === c.to)!;
  for (const t of [1, 2]) {
    add(`${c.key.slice(0, -1)}${t}${c.key.slice(-1)}`, c.from, to.origin, to.origin.clone().add(to.y), to.x);
    bones[bones.length - 1]!.blend = { from: c.from, to: c.to, t: t / 3 };
  }
}
const boneIndex = new Map(bones.map((b, i) => [b.name, i]));
const bi = (n: string) => {
  const i = boneIndex.get(n);
  if (i === undefined) throw new Error(`no bone ${n}`);
  return i;
};

// ---------------------------------------------------------------- which rig bone each bone part follows
const ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];
const rigidBone = (name: string): string | null => {
  const n = name.toLowerCase();
  const side = /(^|_)left(_|$)/.test(n) ? "L" : /(^|_)right(_|$)/.test(n) ? "R" : null;
  const vert = n.match(/^(\w+?)_(cervical|thoracic|lumbar)_vertebra$/);
  if (vert) {
    const k = ORD.indexOf(vert[1]!) + 1;
    if (vert[2] === "lumbar") return k >= 4 ? "lumbar1" : k >= 2 ? "lumbar2" : "thorax1";
    if (vert[2] === "thoracic") return k >= 7 ? "thorax1" : "thorax2";
    return "neck";
  }
  if (n === "axis") return "neck";
  if (n === "atlas") return "head";
  if (/rib$/.test(n)) {
    const k = ORD.indexOf(n.split("_")[1]!) + 1;
    return k >= 7 ? "thorax1" : "thorax2";
  }
  if (/sternum|manubrium|xiphoid/.test(n)) return "thorax2";
  if (/hip_bone|sacrum|coccyx/.test(n)) return "pelvis";
  if (side) {
    if (/clavicle/.test(n)) return `clav${side}`;
    if (/scapula/.test(n)) return `scap${side}`;
    if (/humerus/.test(n)) return `humerus${side}`;
    if (/ulna$/.test(n)) return `ulna${side}`;
    if (/radius$/.test(n)) return `radius${side}`;
    if (/first_metacarpal/.test(n)) return `thumb1${side}`;
    if (/metacarpal|scaphoid|lunate|capitate|hamate|pisiform|trapezium|trapezoid|triquetrum/.test(n)) return `hand${side}`;
    const ph = n.match(/^(proximal|middle|distal)_phalanx_of_(left|right)_(\w+?)(_finger)?$/);
    if (ph && ph[4]) return `${ph[3]}${ph[1] === "proximal" ? 1 : ph[1] === "middle" ? 2 : 3}${side}`;
    if (ph && ph[3] === "thumb") return `thumb${ph[1] === "proximal" ? 2 : 3}${side}`;
    if (ph) return `toes${side}`;
    if (/femur/.test(n)) return `thigh${side}`;
    if (/patella/.test(n)) return `patella${side}`;
    if (/tibia$|fibula$/.test(n)) return `shin${side}`;
    if (/talus|calcaneus|navicular|cuboid|cuneiform|metatarsal/.test(n)) return `foot${side}`;
  }
  // The skull and everything on it.
  if (/frontal_bone|parietal|occipital|temporal_bone|sphenoid|ethmoid|maxilla|mandible|nasal|zygomatic_bone|lacrimal|palatine|vomer|concha|tooth|sclera|cornea|external_ear|alar_cartilage/.test(n)) return "head";
  return null;
};

// ---------------------------------------------------------------- which bones each soft part may follow
const TRUNK = ["pelvis", "lumbar1", "lumbar2", "thorax1", "thorax2"];
const allowedFor = (name: string): string[] => {
  const n = name.toLowerCase();
  const s = /(^|_)left(_|$)/.test(n) ? "L" : /(^|_)right(_|$)/.test(n) ? "R" : null;
  const withSide = (b: string, sd: string) => b.replace(/(@|$)/, `${sd}$1`);
  const side = (list: string[]) => (s ? list.map((b) => withSide(b, s)) : list.flatMap((b) => [withSide(b, "R"), withSide(b, "L")]));
  // Face, jaw and scalp muscles, eyes: the head.
  if (/frontalis|masseter|temporalis|orbicularis|zygomaticus|nasalis|procerus|mentalis|risorius|depressor_(anguli|labii)|levator_labii|corrugator|pterygoid|occipitalis|auricular|buccinator/.test(n)) return ["head"];
  // Neck muscles: trunk top, neck, head and the girdle.
  if (/sternocleidomastoid|scalenus|longissimus_capitis|splenius|semispinalis_capitis|rectus_capitis|obliquus_capitis|sternohyoid|sternothyroid|thyrohyoid|longus_colli|multifidus_cervicis|semispinalis_cervicis|iliocostalis_cervicis|longissimus_cervicis/.test(n))
    return ["thorax2", "neck", "head", ...side(["clav", "scap"])];
  // Foot and lower leg (before the hand: some foot muscles share the hand's names, "digiti minimi", "lumbricals").
  if (/gastrocnemius|soleus|plantaris|popliteus|tibialis|fibularis|calcaneal|hallucis|digitorum_(longus|brevis)|_foot|quadratus_plantae/.test(n))
    // (The calf's two heads start on the femur's condyles: only the lower end of the femur counts.)
    return side(["thigh@-0.22", "shin", "foot", "toes"]);
  // Thumb muscles: the short ones live in the hand and the thumb; the long ones come from the forearm.
  if (/pollicis/.test(n) && !/longus/.test(n)) return side(["hand", "thumb1", "thumb2", "thumb3"]);
  if (/pollicis_longus/.test(n)) return side(["ulna", "radius", "hand", "thumb1", "thumb2", "thumb3"]);
  // Hand and forearm (the forearm muscles start on the humerus's epicondyles: its lower end only).
  if (/of_(left|right)_hand|carpi|pollicis|digiti_minimi|digitorum_(superficialis|profundus)|extensor_digitorum($|_\(2\))|extensor_indicis|palmaris|retinaculum_of_.*wrist|pronator|supinator|brachioradialis|anconeus/.test(n))
    return side(["humerus@-0.3", "ulna", "radius", "hand", "thumb1", "thumb2", "thumb3", ...FINGERS.flatMap((f) => [`${f}1`, `${f}2`, `${f}3`])]);
  if (/biceps_brachii|triceps_brachii|brachialis/.test(n)) return side(["scap", "humerus", "ulna", "radius"]);
  if (/coracobrachialis/.test(n)) return side(["scap", "humerus@0.6"]);
  // Shoulder: each muscle follows the humerus only where it inserts (the hanging arm lies against the chest wall at
  // rest, and the whole humerus would pull the side of the trunk up with the arm).
  if (/deltoid/.test(n)) return side(["clav", "scap", "humerus@0.55"]);
  if (/supraspinatus|infraspinatus|teres_minor|subscapularis/.test(n)) return side(["scap", "humerus@0.2"]);
  if (/teres_major/.test(n)) return side(["scap", "humerus@0.28"]);
  if (/pectoralis_major/.test(n)) return ["thorax1", "thorax2", ...side(["clav", "humerus@0.3"])];
  if (/latissimus/.test(n)) return ["pelvis", "lumbar1", "lumbar2", "thorax1", "thorax2", ...side(["scap", "humerus@0.25"])];
  if (/trapezius|rhomboid|levator_scapulae|serratus_anterior|pectoralis_minor|subclavius|omohyoid/.test(n))
    return ["thorax1", "thorax2", "neck", "head", ...side(["clav", "scap"])];
  // Hip and thigh (muscles that insert on the top of the femur follow only its top).
  if (/psoas|iliacus/.test(n)) return ["lumbar1", "lumbar2", "thorax1", "pelvis", ...side(["thigh@0.22"])];
  if (/gluteus_maximus/.test(n)) return ["pelvis", "lumbar1", ...side(["thigh@0.35"])];
  if (/gluteus_(medius|minimus)|piriformis|gemellus|obturator|quadratus_femoris/.test(n)) return ["pelvis", ...side(["thigh@0.18"])];
  if (/tensor_fasciae|iliotibial|sartorius|gracilis|adductor_(brevis|longus|magnus|minimus)|pectineus|rectus_femoris|vastus|biceps_femoris|semitendinosus|semimembranosus/.test(n))
    return ["pelvis", ...side(["thigh", "patella", "shin"])];
  // Everything else is the trunk: abdominal wall, back muscles, intercostals, fascia.
  return [...TRUNK, "neck"];
};

// ---------------------------------------------------------------- distance fields to the bones
// For every rig bone, the points of the bone parts it carries, thinned to one per 0.8 cm voxel, and their bounding box.
const gkey = (x: number, y: number, z: number, c = 2) => `${Math.floor(x / c)},${Math.floor(y / c)},${Math.floor(z / c)}`;
const CELL = 2;
const rigidOf = new Map<string, string>();
const boneSets: Map<string, [number, number, number]>[] = bones.map(() => new Map());
for (const p of parts) {
  const b = rigidBone(p.name);
  if (!b || (!p.bone && !/sclera|cornea|ear|cartilage|disk/.test(p.name.toLowerCase()))) continue;
  // (Intervertebral disks and costal cartilages are soft: they blend between the bones either side.)
  if (/disk|costal_cartilage/.test(p.name.toLowerCase())) continue;
  rigidOf.set(p.name, b);
  const set = boneSets[bi(b)]!;
  for (let i = 0; i < p.pos.length; i += 3) set.set(gkey(p.pos[i]!, p.pos[i + 1]!, p.pos[i + 2]!, 0.8), [p.pos[i]!, p.pos[i + 1]!, p.pos[i + 2]!]);
}
const bonePts = boneSets.map((m) => Float32Array.from([...m.values()].flat()));
const boneBox = bonePts.map((a) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k]!, a[i + k]!);
    hi[k] = Math.max(hi[k]!, a[i + k]!);
  }
  return { lo, hi };
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const boxDist = (k: number, x: number, y: number, z: number) => {
  const { lo, hi } = boneBox[k]!;
  const dx = Math.max(lo[0]! - x, 0, x - hi[0]!), dy = Math.max(lo[1]! - y, 0, y - hi[1]!), dz = Math.max(lo[2]! - z, 0, z - hi[2]!);
  return Math.hypot(dx, dy, dz);
};
/** A source of weight: a rig bone, or only part of it ("humerusR@0.3": the top 30% of its length from its joint;
 *  "@-0.3": the bottom 30%), with its points. */
type Source = { bone: number; pts: Float32Array };
const sourceCache = new Map<string, Source>();
const sourceOf = (spec: string): Source => {
  const hit = sourceCache.get(spec);
  if (hit) return hit;
  const [name, frac] = spec.split("@") as [string, string | undefined];
  const k = bi(name);
  let pts = bonePts[k]!;
  if (frac) {
    const f = Number(frac);
    const b = bones[k]!;
    const child = bones.find((c) => c.parent === b.name && !/patella/.test(c.name));
    const len = child ? child.origin.distanceTo(b.origin) : 30;
    const keep: number[] = [];
    for (let i = 0; i < pts.length; i += 3) {
      const t = (V3(pts[i], pts[i + 1], pts[i + 2]).sub(b.origin).dot(b.y)) / len;
      if (f > 0 ? t <= f : t >= 1 + f) keep.push(pts[i]!, pts[i + 1]!, pts[i + 2]!);
    }
    pts = Float32Array.from(keep);
  }
  const src = { bone: k, pts };
  sourceCache.set(spec, src);
  return src;
};
const srcBox = new Map<Source, { lo: number[]; hi: number[] }>();
const boxOf = (src: Source) => {
  let b = srcBox.get(src);
  if (!b) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < src.pts.length; i += 3) for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k]!, src.pts[i + k]!);
      hi[k] = Math.max(hi[k]!, src.pts[i + k]!);
    }
    b = { lo, hi };
    srcBox.set(src, b);
  }
  return b;
};
const srcBoxDist = (src: Source, x: number, y: number, z: number) => {
  const { lo, hi } = boxOf(src);
  return Math.hypot(Math.max(lo[0]! - x, 0, x - hi[0]!), Math.max(lo[1]! - y, 0, y - hi[1]!), Math.max(lo[2]! - z, 0, z - hi[2]!));
};
/** Distance from a point to the nearest point of a source (brute force over the thinned points). */
const distTo = (src: Source, x: number, y: number, z: number): number => {
  const a = src.pts;
  let best = Infinity;
  for (let i = 0; i < a.length; i += 3) {
    const d = (a[i]! - x) ** 2 + (a[i + 1]! - y) ** 2 + (a[i + 2]! - z) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
};

// ---------------------------------------------------------------- bone heat
const HEAT = Number(process.env.RIG_HEAT ?? 1);
const CHORD_HEAT = Number(process.env.RIG_CHORD_HEAT ?? 0.08);
/** Solves (L + H) w = H p per channel in place (W holds p on entry, w on return), by Jacobi-preconditioned conjugate
 *  gradients. L: edges of the part's triangles and links through its thickness, each weighted 1/length²; H: HEAT/d². */
function heatWeights(p: { pos: Float32Array; index: Uint32Array }, count: number, C: number, W: Float32Array, near0: Float32Array, heatScale = HEAT): void {
  const pos = p.pos;
  const R = 1.2;
  const lists: Map<number, number>[] = Array.from({ length: count }, () => new Map());
  const link = (a: number, b: number) => {
    if (a === b) return;
    const e = Math.hypot(pos[a * 3]! - pos[b * 3]!, pos[a * 3 + 1]! - pos[b * 3 + 1]!, pos[a * 3 + 2]! - pos[b * 3 + 2]!);
    const w = 1 / Math.max(0.15, e) ** 2;
    lists[a]!.set(b, Math.max(lists[a]!.get(b) ?? 0, w));
    lists[b]!.set(a, Math.max(lists[b]!.get(a) ?? 0, w));
  };
  for (let t = 0; t < p.index.length; t += 3) {
    const a = p.index[t]!, b = p.index[t + 1]!, c = p.index[t + 2]!;
    link(a, b);
    link(b, c);
    link(c, a);
  }
  {
    const grid = new Map<string, number[]>();
    for (let i = 0; i < count; i++) {
      const k = gkey(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!, R);
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
    }
    for (let i = 0; i < count; i++) {
      const x = pos[i * 3]!, y = pos[i * 3 + 1]!, z = pos[i * 3 + 2]!;
      const ci = Math.floor(x / R), cj = Math.floor(y / R), ck = Math.floor(z / R);
      const found: [number, number][] = [];
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++)
          for (let c = -1; c <= 1; c++)
            for (const j of grid.get(`${ci + a},${cj + b},${ck + c}`) ?? []) {
              const d2 = (pos[j * 3]! - x) ** 2 + (pos[j * 3 + 1]! - y) ** 2 + (pos[j * 3 + 2]! - z) ** 2;
              if (j !== i && d2 <= R * R) found.push([j, d2]);
            }
      // (The nearest dozen: enough to tie the faces together without making the system dense.)
      found.sort((u, v) => u[1] - v[1]);
      for (const [j] of found.slice(0, 12)) link(i, j);
    }
  }
  const start = new Uint32Array(count + 1);
  for (let i = 0; i < count; i++) start[i + 1] = start[i]! + lists[i]!.size;
  const col = new Uint32Array(start[count]!), val = new Float32Array(start[count]!);
  const diag = new Float64Array(count), heat = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    let k = start[i]!;
    let s = 0;
    for (const [j, w] of lists[i]!) {
      col[k] = j;
      val[k++] = w;
      s += w;
    }
    heat[i] = heatScale / near0[i]! ** 2;
    diag[i] = s + heat[i]!;
  }
  const mul = (x: Float64Array, out: Float64Array) => {
    for (let i = 0; i < count; i++) {
      let s = diag[i]! * x[i]!;
      for (let k = start[i]!; k < start[i + 1]!; k++) s -= val[k]! * x[col[k]!]!;
      out[i] = s;
    }
  };
  const x = new Float64Array(count), r = new Float64Array(count), z = new Float64Array(count), d = new Float64Array(count), q = new Float64Array(count);
  for (let m = 0; m < C; m++) {
    // Start from the target; b = H p.
    for (let i = 0; i < count; i++) x[i] = W[i * C + m]!;
    mul(x, q);
    let bn = 0;
    for (let i = 0; i < count; i++) {
      const b = heat[i]! * W[i * C + m]!;
      bn += b * b;
      r[i] = b - q[i]!;
      z[i] = r[i]! / diag[i]!;
      d[i] = z[i]!;
    }
    let rz = 0;
    for (let i = 0; i < count; i++) rz += r[i]! * z[i]!;
    const tol = 1e-10 * Math.max(bn, 1e-30);
    for (let it = 0; it < 600; it++) {
      let rr = 0;
      for (let i = 0; i < count; i++) rr += r[i]! * r[i]!;
      if (rr < tol) break;
      mul(d, q);
      let dq = 0;
      for (let i = 0; i < count; i++) dq += d[i]! * q[i]!;
      const alpha = rz / dq;
      for (let i = 0; i < count; i++) {
        x[i]! += alpha * d[i]!;
        r[i]! -= alpha * q[i]!;
        z[i] = r[i]! / diag[i]!;
      }
      let rz2 = 0;
      for (let i = 0; i < count; i++) rz2 += r[i]! * z[i]!;
      const beta = rz2 / rz;
      rz = rz2;
      for (let i = 0; i < count; i++) d[i] = z[i]! + beta * d[i]!;
    }
    for (let i = 0; i < count; i++) W[i * C + m] = Math.min(1, Math.max(0, x[i]!));
  }
  // (Each vertex's weights still add up to one: L keeps constants and H p sums to H; renormalised for rounding.)
  for (let i = 0; i < count; i++) {
    let s = 0;
    for (let m = 0; m < C; m++) s += W[i * C + m]!;
    if (s > 0) for (let m = 0; m < C; m++) W[i * C + m]! /= s;
  }
}

// ---------------------------------------------------------------- blending across the big joints
/** Per joint (in the order applied: the elbows and knees before the shoulders and hips): the bones below it, and the
 *  groups of bones above it, each with the helpers it passes through. */
const JOINT_CHAINS = (["R", "L"] as const).flatMap((s) => [
  { below: [`ulna${s}`, `radius${s}`], above: [{ bones: [`humerus${s}`], via: `elb${s}` }] },
  { below: [`shin${s}`], above: [{ bones: [`thigh${s}`], via: `knee${s}` }] },
  { below: [`humerus${s}`], above: [{ bones: ["thorax2", "thorax1", "lumbar2", "lumbar1", "pelvis", "neck"], via: `shT${s}` }, { bones: [`scap${s}`, `clav${s}`], via: `shS${s}` }] },
  { below: [`thigh${s}`], above: [{ bones: ["pelvis", "lumbar1", "lumbar2"], via: `hip${s}` }] },
]).map((c) => ({
  below: c.below.map(bi),
  above: c.above.map((a) => ({ bones: a.bones.map(bi), h1: bi(`${a.via.slice(0, -1)}1${a.via.slice(-1)}`), h2: bi(`${a.via.slice(0, -1)}2${a.via.slice(-1)}`) })),
}));
/** Re-expresses a vertex's weights so that its share between the bones above and below a joint passes through the
 *  joint's helpers (piecewise linear: at most two neighbours of the chain at once). The turn the vertex follows is about
 *  the same; the blend is between bones a third of the joint's turn apart. */
function throughJoints(w: Map<number, number>): Map<number, number> {
  for (const c of JOINT_CHAINS) {
    const dW = c.below.reduce((s, b) => s + (w.get(b) ?? 0), 0);
    if (dW <= 0) continue;
    let best: (typeof c.above)[number] | null = null, gW = 0;
    for (const a of c.above) {
      const g = a.bones.reduce((s, b) => s + (w.get(b) ?? 0), 0);
      if (g > gW) [best, gW] = [a, g];
    }
    if (!best) continue;
    const total = dW + gW, f = dW / total;
    // Shares of the chain: [above, h1, h2, below].
    const k = f * 3;
    const share = k <= 1 ? [1 - k, k, 0, 0] : k <= 2 ? [0, 2 - k, k - 1, 0] : [0, 0, 3 - k, k - 2];
    for (const b of best.bones) if (w.has(b)) w.set(b, (w.get(b)! / gW) * total * share[0]!);
    for (const b of c.below) if (w.has(b)) w.set(b, (w.get(b)! / dW) * total * share[3]!);
    w.set(best.h1, (w.get(best.h1) ?? 0) + total * share[1]!);
    w.set(best.h2, (w.get(best.h2) ?? 0) + total * share[2]!);
  }
  return w;
}

// ---------------------------------------------------------------- weights
// The falloff of each vertex's target weights with its distance from the candidate bones (bone heat then spreads them
// over the part).
const POW = Number(process.env.RIG_POW ?? 2);
const NB = bones.length;
const total = parts.reduce((s, p) => s + p.pos.length / 3, 0);
const out = new Uint8Array(total * 8);
const report: string[] = [];
let offset = 0;
const meshes: { name: string; offset: number; count: number; bones: string[]; linear?: boolean }[] = [];
// Muscles that span a joint far from its centre (from the trunk or the shoulder blade to the arm, from the pelvis to the
// femur) are skinned linearly: blended positions run along the straight line between where the two bones carry them,
// so when the arm goes overhead the lats, teres and pectorals stretch as straight bands from the ribs to the arm, as they
// do. Dual-quaternion blending (everything else) swings them round the joint instead, out into wings at the armpit.
const CHORD = /latissimus|teres_major|teres_minor|infraspinatus|pectoralis_major|deltoid|quadratus_femoris|gemellus|obturator_internus|piriformis/;
const write = (n: number, w: Map<number, number>) => {
  const top = [...w.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((s, [, v]) => s + v, 0) || 1;
  // Bytes that add up to exactly 255: rounded, with the rounding's remainder on the largest (never below zero).
  const q = top.map(([, v]) => Math.round((v / sum) * 255));
  if (q.length) q[0]! += 255 - q.reduce((s, x) => s + x, 0);
  for (let k = 0; k < 4; k++) {
    out[n * 8 + k] = top[k] ? top[k]![0] : 0;
    out[n * 8 + 4 + k] = top[k] ? q[k]! : 0;
  }
};
for (const p of parts) {
  const count = p.pos.length / 3;
  const rigid = rigidOf.get(p.name);
  const used = new Set<string>();
  if (rigid) {
    for (let i = 0; i < count; i++) write(offset + i, new Map([[bi(rigid), 1]]));
    used.add(rigid);
  } else {
    // Soft part: candidates are the allowed bones it comes close to.
    const lower = p.name.toLowerCase();
    let allowed = allowedFor(p.name);
    if (/disk_of/.test(lower) || /costal_cartilage/.test(lower)) allowed = [...TRUNK, "neck", "head"];
    // Bones the part attaches to or lies on: within 2.5 cm somewhere (at least the nearest one).
    const all = allowed.map(sourceOf).filter((src) => src.pts.length);
    const step = Math.max(1, Math.floor(count / 400));
    const minD = all.map((src) => {
      let m = Infinity;
      for (let i = 0; i < count; i += step) {
        const x = p.pos[i * 3]!, y = p.pos[i * 3 + 1]!, z = p.pos[i * 3 + 2]!;
        if (srcBoxDist(src, x, y, z) >= m) continue;
        m = Math.min(m, distTo(src, x, y, z));
      }
      return m;
    });
    const nearest = Math.min(...minD);
    const srcs = all.filter((_, c) => minD[c]! <= Math.max(2.5, nearest + 0.5));
    const ks = srcs.map((src) => src.bone);
    const cand = ks.map((_, c) => c);
    const D = new Float32Array(count * ks.length);
    for (let i = 0; i < count; i++)
      srcs.forEach((src, c) => (D[i * ks.length + c] = distTo(src, p.pos[i * 3]!, p.pos[i * 3 + 1]!, p.pos[i * 3 + 2]!)));
    // Per vertex, the target: inverse-square distance to each candidate's surface.
    const W = new Float32Array(count * cand.length);
    const near0 = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let s = 0;
      near0[i] = Infinity;
      cand.forEach((c, m) => {
        const d = Math.max(0.6, D[i * ks.length + c]!);
        near0[i] = Math.min(near0[i]!, d);
        const w = 1 / Math.pow(d, POW);
        W[i * cand.length + m] = w;
        s += w;
      });
      for (let m = 0; m < cand.length; m++) W[i * cand.length + m]! /= s;
    }
    // Bone heat (Baran & Popović 2007): each vertex keeps its target with a strength that falls off with its distance
    // from the nearest bone, and the weights diffuse over the part, (L + H) w = H p. Near a bone a muscle moves with it;
    // where it spans free between two bones the change from one to the other spreads evenly along the whole span, so a
    // joint's turn stretches the muscle a little everywhere instead of tearing one band of it. L joins each vertex to its
    // neighbours on the surface and through the part's thickness (points within 1.2 cm), so a sheet's two faces move as
    // one.
    const chord = CHORD.test(lower);
    // (Band muscles hold to their bones more loosely, so the change from one bone to the other spreads along their whole
    // length and the stretch with it, rather than gathering where the belly leaves the bone.)
    if (cand.length > 1 && !/disk|cartilage/.test(lower)) heatWeights(p, count, cand.length, W, near0, chord ? CHORD_HEAT : HEAT);
    for (let i = 0; i < count; i++) {
      const w = new Map<number, number>();
      cand.forEach((c, m) => {
        const v = W[i * cand.length + m]!;
        if (v > 0.01) w.set(ks[c]!, (w.get(ks[c]!) ?? 0) + v);
      });
      write(offset + i, chord ? w : throughJoints(w));
    }
    for (const c of cand) used.add(bones[ks[c]!]!.name);
    for (let i = 0; i < count; i++) for (let k = 0; k < 4; k++) if (out[(offset + i) * 8 + 4 + k]) used.add(bones[out[(offset + i) * 8 + k]!]!.name);
    if (!rigidBone(p.name) && cand.length === 0) report.push(`${p.name}: no bone`);
  }
  meshes.push({ name: p.name, offset, count, bones: [...used], ...(!rigid && CHORD.test(p.name.toLowerCase()) ? { linear: true } : {}) });
  offset += count;
}

// ---------------------------------------------------------------- the face surface (public/anatomy/ecorche-face.*)
// Its vertices are in the file's frame; each takes the weights of the nearest vertex of the file's own parts.
let face: { offset: number; count: number } | null = null;
let faceOut = new Uint8Array(0);
try {
  const fmeta = JSON.parse(readFileSync("public/anatomy/ecorche-face.json", "utf8"));
  const fbin = readFileSync("public/anatomy/ecorche-face.bin");
  const sh = fmeta.shell as { vertices: number; offset: number };
  const fpos = new Float32Array(fbin.buffer.slice(fbin.byteOffset + sh.offset, fbin.byteOffset + sh.offset + sh.vertices * 12));
  // All file vertices in a grid (rig frame).
  const all = new Float32Array(total * 3);
  {
    let o = 0;
    for (const p of parts) {
      all.set(p.pos, o);
      o += p.pos.length;
    }
  }
  const grid = new Map<string, number[]>();
  for (let i = 0; i < total; i++) {
    const k = gkey(all[i * 3]!, all[i * 3 + 1]!, all[i * 3 + 2]!);
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
  }
  const shiftAll = V3(-centre.x, -minY, -centre.z);
  faceOut = new Uint8Array(sh.vertices * 8);
  for (let i = 0; i < sh.vertices; i++) {
    const x = fpos[i * 3 + 2]! * SCALE + shiftAll.x, y = fpos[i * 3 + 1]! * SCALE + shiftAll.y, z = -fpos[i * 3]! * SCALE + shiftAll.z;
    let best = -1, bd = Infinity;
    const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL), ck = Math.floor(z / CELL);
    for (let r = 0; r <= 4 && best < 0; r++)
      for (let a = -r; a <= r; a++)
        for (let b = -r; b <= r; b++)
          for (let c = -r; c <= r; c++)
            for (const u of grid.get(`${ci + a},${cj + b},${ck + c}`) ?? []) {
              const d = (all[u * 3]! - x) ** 2 + (all[u * 3 + 1]! - y) ** 2 + (all[u * 3 + 2]! - z) ** 2;
              if (d < bd) {
                bd = d;
                best = u;
              }
            }
    faceOut.set(out.subarray(best * 8, best * 8 + 8), i * 8);
  }
  face = { offset: total, count: sh.vertices };
} catch (e) {
  console.warn("no face surface:", (e as Error).message);
}

// ---------------------------------------------------------------- output
const r = (v: V) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
const frame = { scale: SCALE, offset: r(V3(-centre.x, -minY, -centre.z)), note: "rig (cm) = (z, y, -x)·scale + offset, from the file's frame (m)" };
const joints = Object.fromEntries(
  (["R", "L"] as const).map((s) => {
    const j = J[s];
    return [s, Object.fromEntries(Object.entries(j).map(([k, v]) => [k, v instanceof THREE.Vector3 ? r(v) : typeof v === "number" ? +v.toFixed(3) : Object.fromEntries(Object.entries(v).map(([a, b]) => [a, r(b as V)]))]))];
  }),
);
writeFileSync("public/anatomy/ecorche-rig.bin", Buffer.concat([Buffer.from(out), Buffer.from(faceOut)]));
writeFileSync(
  "public/anatomy/ecorche-rig.json",
  JSON.stringify({
    source: "Anatomical rig for public/anatomy/ecorche.glb (scripts/anatomy/build-ecorche-rig.mts)",
    frame,
    bones: bones.map((b) => ({ name: b.name, parent: b.parent, origin: r(b.origin), y: r(b.y), x: r(b.x), ...(b.hinge ? { hinge: r(b.hinge) } : {}), ...(b.blend ? { blend: b.blend } : {}) })),
    joints: { ...joints, spine: Object.fromEntries(Object.entries(spine).map(([k, v]) => [k, r(v)])) },
    vertices: total,
    meshes,
    face,
  }),
);
console.log(`bones: ${NB}; parts: ${parts.length} (${rigidOf.size} rigid); vertices: ${total}${face ? ` + face ${face.count}` : ""}`);
for (const s of ["R"] as const)
  for (const k of ["hip", "knee", "ankle", "ball", "sc", "ac", "shoulder", "elbow", "wrist"] as const) console.log(`${s}.${k}`, r(J[s][k] as V).join(", "));
console.log("hip radius", J.R.hipR.toFixed(2), "shoulder radius", J.R.shoulderR.toFixed(2));
console.log("spine", Object.entries(spine).map(([k, v]) => `${k} ${r(v).join(",")}`).join(" | "));
if (report.length) console.log(report.join("\n"));
