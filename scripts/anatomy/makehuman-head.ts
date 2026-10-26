/**
 * The athlete's head and face, built from the MakeHuman base mesh and its shape targets (CC0, released September 2020;
 * https://github.com/makehumancommunity/makehuman, makehuman/data). MakeHuman's targets are the same sliders its
 * character creator uses: here a young adult male with an athletic build, a stronger jaw and chin, defined cheekbones,
 * a slightly heavier brow, a neutral expression. The head is cut from the full-body mesh just below the jaw, smoothed
 * with Catmull-Clark subdivision, and fitted to the athlete by its eyes and by its chin-to-crown height.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

type V3 = [number, number, number];
export interface HeadMesh {
  pos: Float32Array;
  idx: Uint32Array;
}

/** The face recipe: MakeHuman targets and their weights. */
export const FACE_RECIPE: [string, number][] = [
  // Young adult male, between average and maximum muscle (MakeHuman's own macro sliders), neutral weight.
  ["macrodetails/universal-male-young-averagemuscle-averageweight", 0.5],
  ["macrodetails/universal-male-young-maxmuscle-averageweight", 0.5],
  ["macrodetails/caucasian-male-young", 1],
  // A stronger, more masculine structure.
  ["chin/chin-prominent-incr", 0.55],
  ["chin/chin-width-incr", 0.45],
  ["chin/chin-bones-incr", 0.7],
  ["chin/chin-height-incr", 0.2],
  ["cheek/l-cheek-bones-incr", 0.6],
  ["cheek/r-cheek-bones-incr", 0.6],
  ["cheek/l-cheek-volume-decr", 0.5],
  ["cheek/r-cheek-volume-decr", 0.5],
  ["head/head-square", 0.35],
  ["head/head-age-incr", 0.25],
  ["eyebrows/eyebrows-trans-forward", 0.5],
  ["eyebrows/eyebrows-trans-down", 0.2],
  ["forehead/forehead-trans-backward", 0.15],
  ["nose/nose-volume-incr", 0.15],
  ["nose/nose-hump-incr", 0.3],
  ["nose/nose-width1-incr", 0.2],
  ["mouth/mouth-lowerlip-volume-incr", 0.15],
  ["neck/neck-scale-horiz-incr", 0.8],
  ["neck/neck-scale-depth-incr", 0.6],
];

interface Obj {
  pos: V3[];
  groups: Map<string, number[][]>;
}
function parseObj(path: string): Obj {
  const pos: V3[] = [];
  const groups = new Map<string, number[][]>();
  let cur = "default";
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.trim().split(/\s+/);
      pos.push([Number(x), Number(y), Number(z)]);
    } else if (line.startsWith("g ")) cur = line.trim().split(/\s+/)[1]!;
    else if (line.startsWith("f ")) {
      const f = line.trim().split(/\s+/).slice(1).map((t) => Number(t.split("/")[0]) - 1);
      (groups.get(cur) ?? groups.set(cur, []).get(cur)!).push(f);
    }
  }
  return { pos, groups };
}

function applyTargets(pos: V3[], dir: string) {
  for (const [name, w] of FACE_RECIPE) {
    for (const line of readFileSync(join(dir, "targets", `${name}.target`), "utf8").split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const [i, dx, dy, dz] = line.trim().split(/\s+/).map(Number);
      const p = pos[i!];
      if (!p) continue;
      p[0] += dx! * w;
      p[1] += dy! * w;
      p[2] += dz! * w;
    }
  }
}

/** One level of Catmull-Clark subdivision (quads and triangles; open borders keep their shape). */
function catmullClark(pos: V3[], faces: number[][]): { pos: V3[]; faces: number[][] } {
  const P = pos;
  const facePts = faces.map((f) => avg(f.map((i) => P[i]!)));
  const edgeKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const edgeFaces = new Map<string, number[]>();
  faces.forEach((f, fi) => f.forEach((a, k) => {
    const key = edgeKey(a, f[(k + 1) % f.length]!);
    (edgeFaces.get(key) ?? edgeFaces.set(key, []).get(key)!).push(fi);
  }));
  const out: V3[] = P.map((p) => [...p] as V3);
  const facePtIdx = facePts.map((p) => out.push(p) - 1);
  const edgePtIdx = new Map<string, number>();
  for (const [key, fs] of edgeFaces) {
    const [a, b] = key.split("_").map(Number) as [number, number];
    const mid = avg([P[a]!, P[b]!]);
    const pt = fs.length === 2 ? avg([P[a]!, P[b]!, facePts[fs[0]!]!, facePts[fs[1]!]!]) : mid;
    edgePtIdx.set(key, out.push(pt) - 1);
  }
  // Move the original vertices.
  const vFaces: number[][] = P.map(() => []);
  const vEdges: string[][] = P.map(() => []);
  faces.forEach((f, fi) => f.forEach((v) => vFaces[v]!.push(fi)));
  for (const key of edgeFaces.keys()) {
    const [a, b] = key.split("_").map(Number) as [number, number];
    vEdges[a]!.push(key);
    vEdges[b]!.push(key);
  }
  for (let v = 0; v < P.length; v++) {
    if (!vFaces[v]!.length) continue;
    const border = vEdges[v]!.filter((k) => edgeFaces.get(k)!.length === 1);
    if (border.length) {
      const mids = border.map((k) => {
        const [a, b] = k.split("_").map(Number) as [number, number];
        return avg([P[a]!, P[b]!]);
      });
      out[v] = avg([P[v]!, P[v]!, ...mids]);
      continue;
    }
    const n = vFaces[v]!.length;
    const F = avg(vFaces[v]!.map((fi) => facePts[fi]!));
    const R = avg(vEdges[v]!.map((k) => {
      const [a, b] = k.split("_").map(Number) as [number, number];
      return avg([P[a]!, P[b]!]);
    }));
    out[v] = [0, 1, 2].map((c) => (F[c]! + 2 * R[c]! + (n - 3) * P[v]![c]!) / n) as V3;
  }
  const newFaces: number[][] = [];
  faces.forEach((f, fi) => f.forEach((v, k) => {
    const prev = f[(k + f.length - 1) % f.length]!;
    const next = f[(k + 1) % f.length]!;
    newFaces.push([v, edgePtIdx.get(edgeKey(v, next))!, facePtIdx[fi]!, edgePtIdx.get(edgeKey(prev, v))!]);
  }));
  return { pos: out, faces: newFaces };
}
const avg = (ps: V3[]): V3 => {
  const s: V3 = [0, 0, 0];
  for (const p of ps) for (let k = 0; k < 3; k++) s[k]! += p[k]!;
  return [s[0] / ps.length, s[1] / ps.length, s[2] / ps.length];
};

/** Keeps only the vertices the faces use, and triangulates. */
function toMesh(pos: V3[], faces: number[][]): HeadMesh {
  const remap = new Map<number, number>();
  const out: number[] = [];
  const idx: number[] = [];
  const id = (v: number) => {
    let r = remap.get(v);
    if (r === undefined) {
      r = out.length / 3;
      remap.set(v, r);
      out.push(...pos[v]!);
    }
    return r;
  };
  for (const f of faces) for (let k = 1; k + 1 < f.length; k++) idx.push(id(f[0]!), id(f[k]!), id(f[k + 1]!));
  return { pos: new Float32Array(out), idx: new Uint32Array(idx) };
}

export interface HeadFit {
  /** Midpoint between the athlete's eyeball centres. */
  eyeMid: V3;
  /** The athlete's standing height: the head keeps MakeHuman's natural adult proportions at this height. */
  bodyHeight: number;
  /** Keep the head and neck above this height (a function of the forward and sideways position). */
  cutY: (x: number, z: number) => number;
}

export function buildMakeHumanHead(mhData: string, fit: HeadFit): { head: HeadMesh; eyes: HeadMesh } {
  const obj = parseObj(join(mhData, "3dobjs", "base.obj"));
  applyTargets(obj.pos, mhData);
  const centre = (g: string) => avg([...new Set(obj.groups.get(g)!.flat())].map((i) => obj.pos[i]!));
  const lEye = centre("helper-l-eye"), rEye = centre("helper-r-eye");
  const eyeMid = avg([lEye, rEye]);
  // MakeHuman: Y up, the face looks along +Z, the character's left is the side of the "l-" eye.
  const leftSign = Math.sign(lEye[0] - rEye[0]) || 1;
  const body = obj.groups.get("body")!;
  const bodyVerts = [...new Set(body.flat())].map((i) => obj.pos[i]!);
  const crown = bodyVerts.reduce((m, p) => Math.max(m, p[1]), -Infinity);
  const feet = bodyVerts.reduce((m, p) => Math.min(m, p[1]), Infinity);
  // Scale: the MakeHuman man at the athlete's height, so the head has a real adult size (about 1/7.8 of the height)
  // and a natural skull: eye to crown about as far as eye to chin. (Fitting it to the scan's chin-to-crown span made
  // the head too small and the skull too short.)
  // (0.96: a slightly smaller head than the average man's, about 7.7 head-heights tall, as on an athletic build.)
  const s = (0.96 * fit.bodyHeight) / (crown - feet);
  // To the athlete's frame: +X forward, +Y up, +Z the athlete's right (= away from the left eye).
  const toAthlete = (p: V3): V3 => [
    fit.eyeMid[0] + (p[2] - eyeMid[2]) * s,
    fit.eyeMid[1] + (p[1] - eyeMid[1]) * s,
    fit.eyeMid[2] - leftSign * (p[0] - eyeMid[0]) * s,
  ];
  const mirrored = leftSign < 0; // the mapping flips handedness: reverse the winding
  const ath = obj.pos.map(toAthlete);
  const keepFace = (f: number[]) => f.every((i) => ath[i]![1] > fit.cutY(ath[i]![0], ath[i]![2]));
  let head = { pos: ath, faces: body.filter(keepFace) };
  head = catmullClark(head.pos, head.faces);
  let eyes = { pos: ath, faces: [...obj.groups.get("helper-l-eye")!, ...obj.groups.get("helper-r-eye")!] };
  eyes = catmullClark(eyes.pos, eyes.faces);
  eyes = catmullClark(eyes.pos, eyes.faces);
  const wind = (fs: number[][]) => (mirrored ? fs.map((f) => [...f].reverse()) : fs);
  return { head: toMesh(head.pos, wind(head.faces)), eyes: toMesh(eyes.pos, wind(eyes.faces)) };
}
