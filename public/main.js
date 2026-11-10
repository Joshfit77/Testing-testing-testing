// Standalone 3D exercise demonstration prototype (experiment only; not part of the Narrow Gate Fitness app).
// Body: MakeHuman / MPFB2 CC0 base mesh with a muscular male shape, the "game engine" skeleton and weights (build.mjs).
// Everything else here is constructed: skin material, shorts, shoes, hair, eyes, equipment, poses and controls.
import * as THREE from "./vendor/three.module.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Qn = () => new THREE.Quaternion();
const rad = (d) => (d * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const GOLD = new THREE.Color("#e2b860");

const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#0a0908");
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 1.2;
controls.maxDistance = 7;
controls.maxPolarAngle = Math.PI * 0.52;
controls.autoRotateSpeed = 2.4;

// Studio: soft sky fill, a key light from the front-left with shadows, a warm gold rim from behind, a dark floor.
scene.add(new THREE.HemisphereLight("#fff4e2", "#1a1510", 0.75));
const key = new THREE.DirectionalLight("#fff1dc", 2.6);
key.position.set(-2.2, 3.6, 3.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2.4, bottom: -0.4, near: 0.5, far: 12 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.012;
scene.add(key);
const fill = new THREE.DirectionalLight("#cfd8ff", 0.55);
fill.position.set(3, 1.6, 1.5);
scene.add(fill);
const rim = new THREE.DirectionalLight("#e2b860", 1.5);
rim.position.set(1.2, 2.4, -3.4);
scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 96), new THREE.MeshStandardMaterial({ color: "#12100d", roughness: 0.92, metalness: 0 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const ring = new THREE.Mesh(new THREE.RingGeometry(1.46, 1.475, 128), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.55 }));
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.002;
scene.add(ring);

// ------------------------------------------------------------------------------------------------ Athlete
const data = await (await fetch("./athlete.json")).json();
const names = data.bones.map((b) => b.name);
const H = Object.fromEntries(data.bones.map((b) => [b.name, V(...b.head)]));
const parentOf = Object.fromEntries(data.bones.map((b) => [b.name, b.parent >= 0 ? names[b.parent] : null]));
const bones = data.bones.map((b) => Object.assign(new THREE.Bone(), { name: b.name }));
data.bones.forEach((b, i) => {
  bones[i].position.copy(b.parent >= 0 ? H[b.name].clone().sub(H[names[b.parent]]) : H[b.name]);
  if (b.parent >= 0) bones[b.parent].add(bones[i]);
});
const B = Object.fromEntries(bones.map((b) => [b.name, b]));
const rootBone = bones.find((b, i) => data.bones[i].parent < 0);
const rootRest = rootBone.position.clone();
rootBone.updateMatrixWorld(true);
const skeleton = new THREE.Skeleton(bones);

function skinned(part, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(part.pos, 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(part.si, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(part.sw, 4));
  g.setIndex(part.idx);
  g.computeVertexNormals();
  const m = new THREE.SkinnedMesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  m.bind(skeleton, new THREE.Matrix4());
  return m;
}
/** A shell over part of a skinned mesh: the triangles whose vertices all pass `keep`, pushed out along the normals. */
function shell(src, keep, offset, extra = {}) {
  const pos = src.geometry.attributes.position, nor = src.geometry.attributes.normal, si = src.geometry.attributes.skinIndex, sw = src.geometry.attributes.skinWeight, idx = src.geometry.index.array;
  const map = new Map(), out = { pos: [], si: [], sw: [], idx: [] };
  const ok = new Uint8Array(pos.count);
  for (let i = 0; i < pos.count; i++) ok[i] = keep(i) ? 1 : 0;
  for (let t = 0; t < idx.length; t += 3) {
    if (!(ok[idx[t]] && ok[idx[t + 1]] && ok[idx[t + 2]])) continue;
    for (let k = 0; k < 3; k++) {
      const i = idx[t + k];
      if (!map.has(i)) {
        map.set(i, out.pos.length / 3);
        const o = typeof offset === "function" ? offset(i) : offset;
        out.pos.push(pos.getX(i) + nor.getX(i) * o, Math.max(extra.minY ?? -1, pos.getY(i) + nor.getY(i) * o), pos.getZ(i) + nor.getZ(i) * o);
        for (let c = 0; c < 4; c++) { out.si.push(si.getComponent(i, c)); out.sw.push(sw.getComponent(i, c)); }
      }
      out.idx.push(map.get(i));
    }
  }
  return out;
}

const skinMat = new THREE.MeshPhysicalMaterial({ color: "#c98f6b", roughness: 0.68, metalness: 0, sheen: 0.18, sheenColor: new THREE.Color("#ffd0b0"), sheenRoughness: 0.7 });
const hlUniform = { value: 1 };
skinMat.onBeforeCompile = (sh) => {
  // The muscle tint is part of the skin's own colour before lighting, so shading and shadows stay on top of it.
  sh.uniforms.uHL = hlUniform;
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float hl;\nvarying float vHl;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvHl = hl;");
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uHL;\nvarying float vHl;").replace("#include <color_fragment>", "#include <color_fragment>\nfloat k = smoothstep(0.08, 0.9, vHl) * uHL;\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.62, 0.12), k * 0.62);");
};
const body = skinned(data.body, skinMat);
scene.add(body);
body.add(rootBone);
const P = body.geometry.attributes.position, N = body.geometry.attributes.normal, SI = body.geometry.attributes.skinIndex, SW = body.geometry.attributes.skinWeight;
const wOf = (i, re) => { let s = 0; for (let c = 0; c < 4; c++) if (re.test(names[SI.getComponent(i, c)])) s += SW.getComponent(i, c); return s; };

// Clothing and hair are shells grown from the body itself (no clothing assets were available): fitted shorts, low
// training shoes, a short haircut. The skin underneath is pulled in a little so it never shows through.
const headTop = Math.max(...Array.from({ length: P.count }, (_, i) => P.getY(i)));
const crotchY = H.thigh_l.y - 0.085;
const inShorts = (i) => P.getY(i) > crotchY - 0.19 && P.getY(i) < H.pelvis.y + 0.075 && wOf(i, /pelvis|thigh|spine_0[12]/) > 0.5;
const inShoe = (i) => P.getY(i) < H.foot_l.y + 0.035 && wOf(i, /foot|ball/) > 0.5;
const inHair = (i) => wOf(i, /head/) > 0.7 && P.getY(i) > headTop - 0.19 + Math.max(0, P.getZ(i) + 0.02) * 1.05 && !(Math.abs(P.getX(i)) > 0.064 && P.getZ(i) > -0.025 && P.getY(i) < headTop - 0.1);
const cloth = new THREE.MeshStandardMaterial({ color: "#131316", roughness: 0.82 });
const shorts = skinned(shell(body, inShorts, 0.007), cloth);
const shoes = skinned(shell(body, inShoe, (i) => 0.014 + Math.max(0, P.getZ(i) - 0.08) * 0.12, { minY: 0.001 }), new THREE.MeshStandardMaterial({ color: "#17171b", roughness: 0.6 }));
const hair = skinned(shell(body, inHair, 0.0045), new THREE.MeshStandardMaterial({ color: "#241710", roughness: 0.95 }));
scene.add(shorts, shoes, hair);
// Gold waistband and hems.
for (let i = 0; i < P.count; i++) if (inShorts(i) || inShoe(i)) { const o = inShoe(i) ? 0.002 : 0.004; P.setXYZ(i, P.getX(i) - N.getX(i) * o, P.getY(i) - N.getY(i) * o, P.getZ(i) - N.getZ(i) * o); }
P.needsUpdate = true;

// Eyes: spheres in the sockets with a drawn iris, carried by the head bone.
const eyeTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#ece6de"; g.fillRect(0, 0, 256, 256);
  // The sphere's texture wraps 360 degrees across and 180 up, so a round iris is drawn half as wide as it is tall.
  g.translate(128, 128); g.scale(0.5, 1);
  const grd = g.createRadialGradient(0, 0, 2, 0, 0, 30);
  grd.addColorStop(0, "#0a0605"); grd.addColorStop(0.38, "#0a0605"); grd.addColorStop(0.42, "#5a3a20"); grd.addColorStop(0.9, "#3a2414"); grd.addColorStop(1, "#1a100a");
  g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
for (const e of data.eyes) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0122, 24, 16), new THREE.MeshStandardMaterial({ map: eyeTex, roughness: 0.25 }));
  eye.rotation.y = -Math.PI / 2; // the texture's centre faces +Z
  const holder = new THREE.Group();
  holder.position.copy(V(...e).sub(H.head));
  holder.add(eye);
  B.head.add(holder);
}

// ------------------------------------------------------------------------------------------------ Muscle regions
// Regions are picked on the rest pose from which bones move a vertex, where it sits and which way it faces, then
// softened over neighbouring vertices. They follow the mesh as it deforms because they are stored on its vertices.
const side = (i) => Math.sign(P.getX(i)) || 1;
const armAxis = (s) => H[`lowerarm_${s}`].clone().sub(H[`upperarm_${s}`]).normalize();
const REGION = {
  quads: (i) => wOf(i, /thigh/) > 0.5 && N.getZ(i) > 0.05 && P.getY(i) < crotchY + 0.02 && P.getY(i) > H.calf_l.y + 0.03,
  hamstrings: (i) => wOf(i, /thigh/) > 0.5 && N.getZ(i) < -0.25 && P.getY(i) < crotchY - 0.03 && P.getY(i) > H.calf_l.y + 0.04,
  glutes: (i) => wOf(i, /pelvis|thigh/) > 0.6 && N.getZ(i) < -0.3 && P.getY(i) > crotchY - 0.03 && P.getY(i) < H.pelvis.y + 0.05,
  calves: (i) => wOf(i, /calf/) > 0.5 && N.getZ(i) < -0.2 && P.getY(i) > H.foot_l.y + 0.14,
  abs: (i) => wOf(i, /spine_0[12]|pelvis/) > 0.5 && N.getZ(i) > 0.55 && Math.abs(P.getX(i)) < 0.085 && P.getY(i) > H.pelvis.y + 0.03 && P.getY(i) < H.spine_03.y + 0.09,
  lowerBack: (i) => wOf(i, /spine_0[12]|pelvis/) > 0.5 && N.getZ(i) < -0.55 && Math.abs(P.getX(i)) < 0.09 && P.getY(i) > H.pelvis.y + 0.02 && P.getY(i) < H.spine_03.y + 0.05,
  chest: (i) => wOf(i, /spine_0[23]|clavicle/) > 0.5 && N.getZ(i) > 0.3 && Math.abs(P.getX(i)) < 0.175 && Math.abs(P.getX(i)) > 0.008 && P.getY(i) > H.spine_03.y + 0.085 && P.getY(i) < H.upperarm_l.y + 0.015,
  frontDelts: (i) => { const s = side(i) > 0 ? "l" : "r"; const d = V(P.getX(i), P.getY(i), P.getZ(i)).sub(H[`upperarm_${s}`]); return d.length() < 0.1 && N.getZ(i) > 0.15 && d.dot(armAxis(s)) > -0.03 && wOf(i, /upperarm|clavicle/) > 0.4; },
  biceps: (i) => { const s = side(i) > 0 ? "l" : "r"; const d = V(P.getX(i), P.getY(i), P.getZ(i)).sub(H[`upperarm_${s}`]).dot(armAxis(s)); return wOf(i, /upperarm/) > 0.55 && N.getZ(i) > 0.25 && d > 0.1 && d < 0.27; },
  triceps: (i) => { const s = side(i) > 0 ? "l" : "r"; const d = V(P.getX(i), P.getY(i), P.getZ(i)).sub(H[`upperarm_${s}`]).dot(armAxis(s)); return wOf(i, /upperarm/) > 0.55 && N.getZ(i) < -0.2 && d > 0.07 && d < 0.27; },
  forearms: (i) => { const s = side(i) > 0 ? "l" : "r"; const d = V(P.getX(i), P.getY(i), P.getZ(i)).sub(H[`lowerarm_${s}`]).dot(H[`hand_${s}`].clone().sub(H[`lowerarm_${s}`]).normalize()); return wOf(i, /lowerarm/) > 0.55 && d > 0.02 && d < 0.2; },
};
const neighbours = Array.from({ length: P.count }, () => new Set());
{ const ix = body.geometry.index.array; for (let t = 0; t < ix.length; t += 3) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) neighbours[ix[t + a]].add(ix[t + b]); }
const regionWeights = Object.fromEntries(Object.entries(REGION).map(([name, f]) => {
  let w = Float32Array.from({ length: P.count }, (_, i) => (f(i) ? 1 : 0));
  for (let pass = 0; pass < 3; pass++) { const n = new Float32Array(P.count); for (let i = 0; i < P.count; i++) { let s = w[i] * 2, c = 2; for (const j of neighbours[i]) { s += w[j]; c++; } n[i] = s / c; } w = n; }
  return [name, w];
}));
const hlAttr = new THREE.Float32BufferAttribute(new Float32Array(P.count), 1);
body.geometry.setAttribute("hl", hlAttr);
function setMuscles(primary, secondary) {
  for (let i = 0; i < P.count; i++) {
    let v = 0;
    for (const r of secondary) v = Math.max(v, regionWeights[r][i] * 0.42);
    for (const r of primary) v = Math.max(v, regionWeights[r][i]);
    hlAttr.array[i] = v;
  }
  hlAttr.needsUpdate = true;
}

// ------------------------------------------------------------------------------------------------ Posing
const CHILD = { pelvis: "spine_01", spine_01: "spine_02", spine_02: "spine_03", spine_03: "neck_01", neck_01: "head", clavicle_l: "upperarm_l", clavicle_r: "upperarm_r", upperarm_l: "lowerarm_l", upperarm_r: "lowerarm_r", lowerarm_l: "hand_l", lowerarm_r: "hand_r", hand_l: "middle_01_l", hand_r: "middle_01_r", thigh_l: "calf_l", thigh_r: "calf_r", calf_l: "foot_l", calf_r: "foot_r", foot_l: "ball_l", foot_r: "ball_r" };
const REST = Object.fromEntries(Object.entries(CHILD).map(([a, b]) => [a, H[b].clone().sub(H[a]).normalize()]));
REST.head = V(0, 1, 0);
const LEN = Object.fromEntries(Object.entries(CHILD).map(([a, b]) => [a, H[b].distanceTo(H[a])]));
const PALM = {};
for (const s of ["l", "r"]) {
  const n = H[`index_01_${s}`].clone().sub(H[`hand_${s}`]).cross(H[`pinky_01_${s}`].clone().sub(H[`hand_${s}`])).normalize();
  if (n.y > 0) n.negate();
  PALM[s] = n; // the way the palm faces in the rest pose
}
let world = new Map(); // bone -> world rotation (bones not listed follow their parent)
let local = new Map(); // bone -> rotation relative to its parent (fingers)
let rootOffset = V();
const worldQ = (name) => { if (!name) return Qn(); if (world.has(name)) return world.get(name); const q = worldQ(parentOf[name]); return local.has(name) ? q.clone().multiply(local.get(name)) : q; };
/** Where a bone's head is, from the pose set so far. */
const posOf = (name) => { const p = parentOf[name]; return p ? posOf(p).add(H[name].clone().sub(H[p]).applyQuaternion(worldQ(p))) : rootRest.clone().add(rootOffset); };
/** Point a bone along `dir`; optionally roll it so the rest-pose vector `ref` ends up facing `target`. */
function aim(name, dir, ref, target) {
  const d = dir.clone().normalize();
  const q = Qn().setFromUnitVectors(REST[name], d);
  if (ref) {
    const a = ref.clone().applyQuaternion(q); a.addScaledVector(d, -a.dot(d)).normalize();
    const b = target.clone(); b.addScaledVector(d, -b.dot(d)).normalize();
    if (a.lengthSq() > 1e-6 && b.lengthSq() > 1e-6) q.premultiply(Qn().setFromAxisAngle(d, Math.atan2(d.dot(a.clone().cross(b)), a.dot(b))));
  }
  world.set(name, q);
}
/** The middle joint of a two-bone chain from `a` reaching toward `c`, bending toward `pole`. */
function twoBone(a, c, l1, l2, pole) {
  const ac = c.clone().sub(a);
  const d = Math.min(Math.max(ac.length(), Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  const dir = ac.normalize();
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const p = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  return a.clone().addScaledVector(dir, x).addScaledVector(p, h);
}
const FRONT = V(0, 0, 1);
/**
 * Pose the trunk: `base` turns the whole body from standing (up +Y, facing +Z) to its frame in the scene, and each
 * spine bone leans forward from its rest position by a share of `lean`, so the spine keeps its natural curve.
 */
function torso(lean, base = Qn(), factors = [0.5, 0.8, 1, 1]) {
  const X = V(1, 0, 0);
  const at = (k) => base.clone().multiply(Qn().setFromAxisAngle(X, lean * k));
  ["pelvis", "spine_01", "spine_02", "spine_03"].forEach((b, i) => world.set(b, at(factors[i])));
  world.set("neck_01", at(0.45));
  world.set("head", at(0.12));
}
function leg(s, ankle, pole, footQ = Qn()) {
  const hip = posOf(`thigh_${s}`);
  const knee = twoBone(hip, ankle, LEN[`thigh_${s}`], LEN[`calf_${s}`], pole);
  aim(`thigh_${s}`, knee.clone().sub(hip), FRONT, pole);
  aim(`calf_${s}`, ankle.clone().sub(knee), FRONT, pole);
  world.set(`foot_${s}`, footQ);
}
function arm(s, wrist, pole, handDir, palm, curl) {
  const sh = posOf(`upperarm_${s}`);
  const elbow = twoBone(sh, wrist, LEN[`upperarm_${s}`], LEN[`lowerarm_${s}`], pole);
  aim(`upperarm_${s}`, elbow.clone().sub(sh), PALM[s], palm);
  aim(`lowerarm_${s}`, wrist.clone().sub(elbow), PALM[s], palm);
  aim(`hand_${s}`, handDir, PALM[s], palm);
  fingers(s, curl);
}
function fingers(s, curl) {
  for (const f of ["index", "middle", "ring", "pinky", "thumb"]) for (const n of ["01", "02", "03"]) {
    const name = `${f}_${n}_${s}`;
    const next = f === "thumb" && n === "03" ? null : `${f}_${n === "01" ? "02" : "03"}_${s}`;
    const d = (n === "03" ? H[name].clone().sub(H[`${f}_02_${s}`]) : H[next].clone().sub(H[name])).normalize();
    const axis = d.clone().cross(PALM[s]).normalize();
    local.set(name, Qn().setFromAxisAngle(axis, curl * (f === "thumb" ? 0.35 : n === "01" ? 1 : 1.05)));
  }
}
function commit() {
  rootBone.position.copy(rootRest).add(rootOffset);
  for (const name of names) {
    if (name === rootBone.name) { B[name].quaternion.copy(worldQ(name)); continue; }
    B[name].quaternion.copy(worldQ(parentOf[name]).clone().invert().multiply(worldQ(name)));
  }
}

// ------------------------------------------------------------------------------------------------ Equipment
const steel = new THREE.MeshStandardMaterial({ color: "#b9bcc2", roughness: 0.32, metalness: 0.9 });
const iron = new THREE.MeshStandardMaterial({ color: "#2b2b30", roughness: 0.42, metalness: 0.65 });
const goldMat = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.35, metalness: 0.85 });
const cyl = (r, len, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 40), mat); m.rotation.z = Math.PI / 2; m.castShadow = true; m.receiveShadow = true; return m; };
const barbell = new THREE.Group();
barbell.add(cyl(0.014, 2.2, steel));
for (const sgn of [1, -1]) {
  const sleeve = cyl(0.025, 0.4, steel); sleeve.position.x = sgn * 0.9; barbell.add(sleeve);
  for (const [x, r] of [[0.745, 0.225], [0.79, 0.225]]) { const p = cyl(r, 0.04, iron); p.position.x = sgn * x; barbell.add(p); const ringG = new THREE.Mesh(new THREE.TorusGeometry(r - 0.022, 0.0045, 10, 72), goldMat); ringG.rotation.y = Math.PI / 2; ringG.position.x = sgn * (x + 0.021); barbell.add(ringG); const hub = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.004, 8, 48), goldMat); hub.rotation.y = Math.PI / 2; hub.position.x = sgn * (x + 0.021); barbell.add(hub); }
  const collar = cyl(0.036, 0.03, goldMat); collar.position.x = sgn * 0.83; barbell.add(collar);
}
scene.add(barbell);
const bench = new THREE.Group();
{ const pad = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.075, 1.25), new THREE.MeshStandardMaterial({ color: "#17171a", roughness: 0.7 })); pad.position.set(0, 0.4025, -0.22); pad.castShadow = pad.receiveShadow = true; bench.add(pad);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.304, 0.008, 1.254), goldMat); trim.position.set(0, 0.362, -0.22); bench.add(trim);
  for (const z of [-0.72, 0.28]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.05), iron); l.position.set(0, 0.18, z); l.castShadow = true; bench.add(l); } }
scene.add(bench);
const dumbbells = {};
for (const s of ["l", "r"]) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.15, 24), steel); g.add(handle);
  for (const y of [0.1, -0.1]) { const head = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 36), iron); head.position.y = y; head.castShadow = true; g.add(head); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0632, 0.0632, 0.008, 36), goldMat); band.position.y = y; g.add(band); }
  const axis = H[`index_01_${s}`].clone().sub(H[`pinky_01_${s}`]).normalize();
  g.quaternion.setFromUnitVectors(V(0, 1, 0), axis);
  g.position.copy(H[`middle_01_${s}`].clone().sub(H[`hand_${s}`]).multiplyScalar(0.82).addScaledVector(PALM[s], 0.03));
  B[`hand_${s}`].add(g);
  dumbbells[s] = g;
}

// ------------------------------------------------------------------------------------------------ Exercises
const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
/** Depth 0..1 through one repetition: lower, pause, raise, pause. */
const cycle = (t, [down, holdB, up, holdT]) => { const T = down + holdB + up + holdT; const u = ((t % T) + T) % T; return u < down ? ease(u / down) : u < down + holdB ? 1 : u < down + holdB + up ? 1 - ease((u - down - holdB) / up) : 0; };
const SIDES = [["l", 1], ["r", -1]];
const EX = {
  stand: {
    label: "Character", muscles: [[], []], target: 0.92, dist: 3.5,
    pose() {
      torso(0);
      for (const [s, k] of SIDES) {
        leg(s, H[`foot_${s}`].clone(), V(k * 0.2, 0, 1));
        const sh = posOf(`upperarm_${s}`);
        const wrist = sh.clone().add(V(k * 0.13, -(LEN[`upperarm_${s}`] + LEN[`lowerarm_${s}`]) * 0.985, 0.05));
        arm(s, wrist, V(k * 0.3, 0, -1), V(k * 0.05, -1, 0.1), V(-k, 0, 0.15), 0.3);
      }
    },
  },
  squat: {
    label: "Barbell back squat", muscles: [["quads", "glutes"], ["hamstrings", "abs", "lowerBack"]], time: [2, 0.15, 1.4, 0.6], target: 0.85, dist: 3.9,
    pose(s) {
      const lean = rad(7 + 27 * s);
      torso(lean);
      const hipY = lerp(H.thigh_l.y - 0.004, H.calf_l.y - 0.035, s);
      rootOffset.set(0, hipY - H.thigh_l.y, 0);
      // The bar rides on the upper back; shift the hips so it stays over mid-foot all the way down.
      const back = V(0, Math.sin(lean), -Math.cos(lean));
      const barAt = () => posOf("neck_01").addScaledVector(back, 0.085).add(V(0, -0.045, 0));
      const midFoot = H.foot_l.z + 0.075;
      rootOffset.z = midFoot - barAt().z;
      const bar = barAt();
      barbell.position.copy(bar);
      for (const [sd, k] of SIDES) {
        leg(sd, H[`foot_${sd}`].clone(), V(k * 0.42, 0, 1));
        const handDir = V(-k * 0.1, 0.92, -0.2).normalize();
        const grip = bar.clone().add(V(k * 0.42, 0, 0));
        arm(sd, grip.clone().addScaledVector(handDir, -0.075).add(V(0, 0, -0.02)), V(k * 0.25, -1, -0.55), handDir, V(0, 0.15, 1), 1.15);
      }
    },
  },
  bench: {
    label: "Barbell bench press", muscles: [["chest"], ["triceps", "frontDelts"]], time: [1.7, 0.2, 1.3, 0.5], target: 0.62, dist: 3.9,
    pose(s) {
      // Lying on the bench: head toward -Z, chest up.
      rootOffset.set(0, 0.44 + 0.105 - H.pelvis.y, 0.3 - H.pelvis.z);
      const lying = Qn().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2);
      torso(0, lying);
      const shMid = posOf("upperarm_l").add(posOf("upperarm_r")).multiplyScalar(0.5);
      const reach = LEN.upperarm_l + LEN.lowerarm_l + 0.07;
      const top = V(0, shMid.y + reach - 0.02, shMid.z + 0.01);
      const bottom = V(0, shMid.y + 0.115, shMid.z + 0.13);
      const bar = V(0, lerp(top.y, bottom.y, s), lerp(top.z, bottom.z, ease(s)));
      barbell.position.copy(bar);
      for (const [sd, k] of SIDES) {
        const hip = posOf(`thigh_${sd}`);
        leg(sd, V(k * 0.3, H[`foot_${sd}`].y, hip.z + 0.5), V(k * 0.25, 1, 0.5));
        const handDir = V(0, 1, 0);
        const grip = bar.clone().add(V(k * 0.37, 0, 0));
        arm(sd, grip.clone().addScaledVector(handDir, -0.075), V(k * 1, -0.5, 0.75), handDir, V(0, 0, 1), 1.15);
      }
    },
  },
  curl: {
    label: "Dumbbell biceps curl", muscles: [["biceps"], ["forearms"]], time: [1.2, 0.3, 2, 0.4], target: 0.92, dist: 3.5,
    pose(s) {
      torso(0);
      const e = rad(8 + 130 * s);
      for (const [sd, k] of SIDES) {
        leg(sd, H[`foot_${sd}`].clone(), V(k * 0.2, 0, 1));
        const sh = posOf(`upperarm_${sd}`);
        const elbow = sh.clone().addScaledVector(V(k * 0.1, -1, -0.04 + 0.07 * s).normalize(), LEN[`upperarm_${sd}`]);
        const f = V(k * 0.05, -Math.cos(e), Math.sin(e)).normalize();
        const palm = V(-k * 0.12, Math.sin(e), Math.cos(e));
        aim(`upperarm_${sd}`, elbow.clone().sub(sh), FRONT, FRONT);
        aim(`lowerarm_${sd}`, f, PALM[sd], palm);
        aim(`hand_${sd}`, f, PALM[sd], palm);
        fingers(sd, 1.2);
      }
    },
  },
};

// ------------------------------------------------------------------------------------------------ State and UI
const state = { ex: "stand", t: 0, playing: true, speed: 1, hl: true };
function setExercise(ex) {
  state.ex = ex; state.t = 0;
  const E = EX[ex];
  setMuscles(...E.muscles);
  barbell.visible = ex === "squat" || ex === "bench";
  bench.visible = ex === "bench";
  dumbbells.l.visible = dumbbells.r.visible = ex === "curl";
  controls.target.set(0, E.target, 0);
  for (const b of document.querySelectorAll("#ex button")) b.setAttribute("aria-pressed", String(b.dataset.ex === ex));
  const [p, s] = E.muscles;
  document.getElementById("key").innerHTML = p.length ? `<i style="background:#e9a52a"></i>Primary: ${p.join(", ")}<i style="background:#d9b98a"></i>Secondary: ${s.join(", ")}`.replace(/lowerBack/g, "lower back").replace(/frontDelts/g, "front delts") : "Drag to rotate · pinch or scroll to zoom";
  setView(currentView, true);
}
let currentView = "front";
function setView(v, keep) {
  if (v === "spin") { controls.autoRotate = !controls.autoRotate; }
  else {
    currentView = v; if (!keep) controls.autoRotate = false;
    const d = EX[state.ex].dist * (innerWidth < innerHeight * 0.8 ? 1.3 : 1), y = EX[state.ex].target + 0.12;
    const p = v === "front" ? [0.3, y, d] : v === "side" ? [d * 0.9, y, d * 0.42] : [-0.3, y, -d];
    camera.position.set(...p);
  }
  for (const b of document.querySelectorAll("#view button")) b.setAttribute("aria-pressed", String(b.dataset.v === "spin" ? controls.autoRotate : !controls.autoRotate && b.dataset.v === currentView));
}
function pose() {
  world = new Map(); local = new Map(); rootOffset = V();
  const E = EX[state.ex];
  E.pose(E.time ? cycle(state.t, E.time) : 0);
  commit();
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize);
document.getElementById("ex").addEventListener("click", (e) => e.target.dataset.ex && setExercise(e.target.dataset.ex));
document.getElementById("view").addEventListener("click", (e) => e.target.dataset.v && setView(e.target.dataset.v));
document.getElementById("speed").addEventListener("click", (e) => { if (!e.target.dataset.s) return; state.speed = +e.target.dataset.s; for (const b of document.querySelectorAll("#speed button")) b.setAttribute("aria-pressed", String(b === e.target)); });
document.querySelector('#speed [data-s="1"]').setAttribute("aria-pressed", "true");
const playBtn = document.getElementById("play");
playBtn.addEventListener("click", () => { state.playing = !state.playing; playBtn.textContent = state.playing ? "Pause" : "Play"; });
const hlBtn = document.getElementById("hl");
hlBtn.addEventListener("click", () => { state.hl = !state.hl; hlBtn.setAttribute("aria-pressed", String(state.hl)); });
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state.playing) state.t += dt * state.speed;
  hlUniform.value += ((state.hl ? 1 : 0) - hlUniform.value) * Math.min(1, dt * 8);
  pose();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
resize();
setExercise("stand");
// For automated screenshots: set a state and draw one frame immediately.
window.__shot = ({ ex, t = 0, view = "front", hl = true, cam, tgt }) => { if (ex !== state.ex) setExercise(ex); state.t = t; state.playing = false; state.hl = hl; hlUniform.value = hl ? 1 : 0; setView(view); if (cam) camera.position.set(...cam); if (tgt) controls.target.set(...tgt); pose(); controls.update(); renderer.render(scene, camera); };
requestAnimationFrame(frame);
document.body.dataset.ready = "1";
