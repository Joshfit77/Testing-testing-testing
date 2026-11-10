// Builds athlete.json for the viewer from the MakeHuman / MPFB2 CC0 data in src-assets/ (see README.md):
// base mesh + a muscular male body shape, the "game engine" skeleton and its skin weights. Node only, no dependencies.
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
const A = (f) => new URL(`./src-assets/${f}`, import.meta.url);
const V = [];
const groups = {};
const faces = { body: [], tights: [] };
let g = "";
for (const line of readFileSync(A("base.obj"), "utf8").split("\n")) {
  if (line.startsWith("v ")) V.push(line.slice(2).trim().split(/\s+/).map(Number));
  else if (line.startsWith("g ")) g = line.slice(2).trim();
  else if (line.startsWith("f ")) {
    const ix = line.slice(2).trim().split(/\s+/).map((t) => parseInt(t, 10) - 1);
    (groups[g] ??= new Set()), ix.forEach((i) => groups[g].add(i));
    const dst = g === "body" ? faces.body : g === "helper-tights" ? faces.tights : null;
    if (dst) for (let k = 1; k + 1 < ix.length; k++) dst.push(ix[0], ix[k], ix[k + 1]);
  }
}
// Body shape: the muscular young male macro at 60% (athletic, not a bodybuilder) plus the matching proportions.
const apply = (file, w) => {
  for (const line of gunzipSync(readFileSync(A(file))).toString().split("\n")) {
    const p = line.trim().split(/\s+/);
    if (p.length !== 4 || line.startsWith("#")) continue;
    const v = V[+p[0]];
    if (v) for (let k = 0; k < 3; k++) v[k] += w * +p[k + 1];
  }
};
// Body shape (second pass): the muscular young male macro, leaned out a little, then MakeHuman's own muscle and
// proportion details for each area. Every change is one of the model's sculpted shapes; nothing is inflated by hand.
apply("universal-male-young-maxmuscle-averageweight.target.gz", 0.72);
apply("detail/universal-male-young-maxmuscle-minweight.target.gz", 0.28);
apply("caucasian-male-young.target.gz", 1);
apply("ideal.target.gz", 0.6);
for (const [name, w] of [
  ["torso-muscle-pectoral-incr", 0.85], ["torso-muscle-dorsi-incr", 0.9], ["torso-vshape-incr", 0.7],
  ["l-upperarm-muscle-incr", 0.95], ["r-upperarm-muscle-incr", 0.95], ["l-lowerarm-muscle-incr", 0.75], ["r-lowerarm-muscle-incr", 0.75],
  ["l-upperleg-muscle-incr", 0.75], ["r-upperleg-muscle-incr", 0.75], ["l-lowerleg-muscle-incr", 0.8], ["r-lowerleg-muscle-incr", 0.8],
  ["buttocks-volume-incr", 0.3], ["stomach-tone-incr", 1], ["neck-scale-horiz-incr", 0.45], ["hip-scale-horiz-decr", 0.3],
  ["head-square", 0.5], ["head-fat-decr", 0.45], ["l-cheek-bones-incr", 0.5], ["r-cheek-bones-incr", 0.5], ["chin-prominent-incr", 0.4],
]) apply(`detail/${name}.target.gz`, w);
const minY = Math.min(...[...groups.body].map((i) => V[i][1]));
const P = (v) => [v[0] * 0.1, (v[1] - minY) * 0.1, v[2] * 0.1]; // decimetres -> metres, feet on the floor
const centre = (name) => {
  const s = groups[name];
  if (!s) return null;
  const c = [0, 0, 0];
  for (const i of s) for (let k = 0; k < 3; k++) c[k] += V[i][k] / s.size;
  return P(c);
};
const rig = JSON.parse(readFileSync(A("rig.json"), "utf8"));
const mean = (ix) => { const c = [0, 0, 0]; for (const i of ix) for (let k = 0; k < 3; k++) c[k] += V[i][k] / ix.length; return P(c); };
const end = (e) => (e.cube_name && centre(e.cube_name)) || (e.vertex_indices ? mean(e.vertex_indices) : e.vertex_index !== undefined ? P(V[e.vertex_index]) : (() => { throw new Error("joint " + JSON.stringify(e)); })());
const names = [];
const add = (n) => { if (names.includes(n)) return; if (rig[n].parent) add(rig[n].parent); names.push(n); };
Object.keys(rig).forEach(add);
const bones = names.map((n) => ({ name: n, parent: rig[n].parent ? names.indexOf(rig[n].parent) : -1, head: end(rig[n].head), tail: end(rig[n].tail) }));
const W = JSON.parse(readFileSync(A("weights.json"), "utf8")).weights;
const per = V.map(() => []);
for (const [bone, list] of Object.entries(W)) { const b = names.indexOf(bone); if (b >= 0) for (const [v, w] of list) per[v]?.push([b, w]); }
const mesh = (tri) => {
  const map = new Map();
  const pos = [], si = [], sw = [], idx = [];
  for (const i of tri) {
    if (!map.has(i)) {
      map.set(i, pos.length / 3);
      pos.push(...P(V[i]).map((x) => +x.toFixed(5)));
      const top = per[i].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = top.reduce((s, x) => s + x[1], 0) || 1;
      for (let k = 0; k < 4; k++) { si.push(top[k]?.[0] ?? 0); sw.push(+((top[k]?.[1] ?? 0) / sum).toFixed(4)); }
    }
    idx.push(map.get(i));
  }
  return { pos, si, sw, idx };
};
const out = { units: "metres", bones, body: mesh(faces.body), tights: mesh(faces.tights), eyes: [centre("joint-l-eye"), centre("joint-r-eye")] };
writeFileSync(new URL("./public/athlete.json", import.meta.url), JSON.stringify(out));
const ys = out.body.pos.filter((_, i) => i % 3 === 1);
console.log("verts", out.body.pos.length / 3, "tris", out.body.idx.length / 3, "tights tris", out.tights.idx.length / 3, "bones", bones.length, "height m", Math.max(...ys).toFixed(3));
console.log(bones.filter((b) => /pelvis|thigh_l|calf_l|foot_l|upperarm_l|lowerarm_l|hand_l|head|spine_03|clavicle_l/.test(b.name)).map((b) => b.name + " " + b.head.map((x) => x.toFixed(2)).join(",")).join(" | "));
