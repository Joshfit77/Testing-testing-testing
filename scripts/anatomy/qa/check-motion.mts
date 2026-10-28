/**
 * Automated checks of the exercise demonstrations on the anatomical rig (no rendering; the same solve and the same
 * dual-quaternion skinning, on the CPU).
 *
 *   npx tsx scripts/anatomy/qa/check-motion.mts [--samples 48] [--out docs/anatomy3d/qa] [slug ...]
 *
 * Per exercise, over one loop:
 * - contacts: each held handle's distance from the centre of the hand's grip (cm), and how far the hand's orientation
 *   is from the grip's (degrees);
 * - joint limits: where the solver had to hold a joint at its range (pronation, wrist, elbow or knee out of reach);
 * - continuity: the largest jump of any bone's rotation between neighbouring samples compared with its neighbours (a
 *   pop), and the jump across the loop's seam;
 * - deformation: per part, the most a triangle edge stretches or shrinks against the rest pose (spikes and collapses);
 * - collisions: how deep the equipment's solid parts go into the body (hands excepted where they hold it), and the body
 *   below the floor or feet off the floor while planted;
 * - equipment: the motion's apparatus missing from the 3D scene.
 * Writes <out>/<slug>.json and <out>/summary.json, and prints a table. What these checks cannot see (whether a grip
 * looks right, whether a movement reads as the exercise) is left to the visual review.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { EXERCISES } from "../../../src/data/exercises";
import { getMotion } from "../../../src/lib/exercise-motion";
import { Correctives, type CorrectiveMeta } from "../../../src/lib/anatomy3d/body/correctives";
import { dqOf, dqSkin, lbsSkin } from "../../../src/lib/anatomy3d/body/dqs";
import { Skeleton3, type RigMeta } from "../../../src/lib/anatomy3d/body/skeleton";
import { bake, playBaked, settle } from "../../../src/lib/anatomy3d/motion3d/bake";
import { makePerformer } from "../../../src/lib/anatomy3d/motion3d/perform";
import { hasSpec, specFor } from "../../../src/lib/anatomy3d/motion3d/specs";

const args = process.argv.slice(2);
const opt = (name: string, d: string) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return d;
  const v = args[i + 1]!;
  args.splice(i, 2);
  return v;
};
const SAMPLES = Number(opt("samples", "48"));
const OUT = opt("out", "docs/anatomy3d/qa");
// --baked: also bake each motion (as the app plays it) and run the body checks on the baked, interpolated poses, with
// how far they stray from the live solve between frames.
const BAKED = args.includes("--baked") ? (args.splice(args.indexOf("--baked"), 1), true) : false;
// --no-correctives: the skinning alone, without the shoulder and hip corrective shapes (the viewer applies them when
// public/anatomy/ecorche-correctives.* exist).
const NO_CORR = args.includes("--no-correctives") ? (args.splice(args.indexOf("--no-correctives"), 1), true) : false;
const slugs = args.length ? args : EXERCISES.map((e) => e.slug);
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- the model and the rig
const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
const glb = readFileSync("public/anatomy/ecorche.glb");
const gltf = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer, "");
gltf.scene.updateMatrixWorld(true);
const meta = JSON.parse(readFileSync("public/anatomy/ecorche-rig.json", "utf8")) as RigMeta;
const bin = new Uint8Array(readFileSync("public/anatomy/ecorche-rig.bin"));
const probe = new Skeleton3(meta);
const fileToRig = probe.fileToRig();
const correctives: Correctives | null =
  !NO_CORR && existsSync("public/anatomy/ecorche-correctives.json")
    ? new Correctives(JSON.parse(readFileSync("public/anatomy/ecorche-correctives.json", "utf8")) as CorrectiveMeta, new Uint8Array(readFileSync("public/anatomy/ecorche-correctives.bin")).buffer as ArrayBuffer)
    : null;
if (correctives) console.log(`with the corrective shapes (${correctives.meta.rows} rows, ${correctives.meta.regions.map((r) => r.name).join(", ")})`);

/** Rest positions (rig frame), weights and triangles of every part, decimated for speed (every vertex kept; edges of
 *  all triangles). */
interface Part {
  name: string;
  pos: Float32Array;
  idx: Uint8Array;
  wt: Float32Array;
  tris: Uint32Array;
  /** Dominant bone per vertex. */
  main: Uint8Array;
  /** Skinned linearly (as the viewer does for the rig's band muscles). */
  linear: boolean;
  /** Per vertex, its corrective row, or -1. */
  row: Int32Array;
}
const parts: Part[] = [];
{
  let k = 0;
  gltf.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const e = meta.meshes[k++]!;
    const p = o.geometry.getAttribute("position");
    const m = fileToRig.clone().multiply(o.matrixWorld);
    const pos = new Float32Array(p.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const idx = new Uint8Array(p.count * 4), wt = new Float32Array(p.count * 4), main = new Uint8Array(p.count);
    for (let i = 0; i < p.count; i++) {
      let best = 0;
      for (let c = 0; c < 4; c++) {
        idx[i * 4 + c] = bin[(e.offset + i) * 8 + c]!;
        wt[i * 4 + c] = bin[(e.offset + i) * 8 + 4 + c]! / 255;
        if (wt[i * 4 + c]! > wt[i * 4 + best]!) best = c;
      }
      main[i] = idx[i * 4 + best]!;
    }
    const tris = o.geometry.index ? Uint32Array.from(o.geometry.index.array) : Uint32Array.from({ length: p.count }, (_, i) => i);
    const row = new Int32Array(p.count).fill(-1);
    const rows = correctives?.rowsOf(k - 1);
    if (correctives && rows) for (let r = rows.offset; r < rows.offset + rows.count; r++) row[correctives.vertex[r]!] = r;
    // Hidden parts (the face covers them) are not checked.
    if (o.visible) parts.push({ name: o.name, pos, idx, wt, tris, main, linear: !!e.linear, row });
  });
}
const handBones = (s: "R" | "L") => new Set(probe.names.map((n, i) => [n, i] as const).filter(([n]) => n.endsWith(s) && /^(hand|thumb|index|middle|ring|little|radius)/.test(n)).map(([, i]) => i));
const HANDS = { R: handBones("R"), L: handBones("L") };
const FEET = new Set(probe.names.map((n, i) => [n, i] as const).filter(([n]) => /^(foot|toes)/.test(n)).map(([, i]) => i));

// ---------------------------------------------------------------- helpers
const segDist = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
  const ab = b.clone().sub(a);
  const t = ab.lengthSq() > 1e-9 ? Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / ab.lengthSq())) : 0;
  return p.distanceTo(a.clone().addScaledVector(ab, t));
};
/** How deep a point is inside a solid (cm; negative outside): a capsule, or a cylinder cut square at its ends. */
const depthIn = (p: THREE.Vector3, s: { a: THREE.Vector3; b: THREE.Vector3; r: number; flat?: boolean }) => {
  if (!s.flat) return s.r - segDist(p, s.a, s.b);
  const ab = s.b.clone().sub(s.a);
  const len = ab.length();
  const t = p.clone().sub(s.a).dot(ab) / (len * len);
  if (t < 0 || t > 1) return -1;
  const radial = p.distanceTo(s.a.clone().addScaledVector(ab, t));
  return Math.min(s.r - radial, t * len, (1 - t) * len);
};
const angleDeg = (a: THREE.Quaternion, b: THREE.Quaternion) => (2 * Math.acos(Math.min(1, Math.abs(a.dot(b))))) / (Math.PI / 180);

interface Result {
  slug: string;
  converted: boolean;
  view: string;
  contact: { worst: number; mean: number; turn: number; samples: number };
  limits: Record<string, number>;
  pop: { bone: string; jump: number; at: number } | null;
  seam: { bone: string; jump: number } | null;
  stretch: { part: string; ratio: number; at: number }[];
  collapse: { part: string; ratio: number; at: number }[];
  collisions: { piece: string; depth: number; at: number; bone: string }[];
  floor: { below: number; floating: number };
  missing: string[];
  /** Baked playback against the live solve between frames (cm): the worst bone, the worst hand, the worst piece. */
  baked?: { frames: number; bytes: number; bone: number; hand: number; piece: number; worst: string };
  fails: string[];
}

const results: Result[] = [];
for (const slug of slugs) {
  const ex = EXERCISES.find((e) => e.slug === slug);
  if (!ex) {
    console.warn(`unknown exercise ${slug}`);
    continue;
  }
  const sk = new Skeleton3(meta);
  const spec = specFor(slug);
  const perf = makePerformer(sk, ex, spec);
  const def = getMotion(slug, ex);
  const T = perf.duration;
  const n = SAMPLES;
  const rots: THREE.Quaternion[][] = [];
  const res: Result = {
    slug,
    converted: hasSpec(slug),
    view: def.view,
    contact: { worst: 0, mean: 0, turn: 0, samples: 0 },
    limits: {},
    pop: null,
    seam: null,
    stretch: [],
    collapse: [],
    collisions: [],
    floor: { below: 0, floating: 0 },
    missing: [],
    fails: [],
  };
  // Equipment the motion shows that the 3D scene does not have (scenery that is only floor marking is not counted).
  const decorative = new Set(["mat", "pad", "hurdleLine", "ladder", "cone", "rack"]);
  const built = new Set(perf.pieces.map((p) => p.kind));
  const alias: Record<string, string[]> = { cable: ["cable"], cableTower: ["cableTower"], bike: ["airBike"], rower: ["rower"], medball: ["medball"], wall: ["wall"], sled: ["sled"], barbell: ["barbell"], dumbbell: ["dumbbell"], kettlebell: ["kettlebell"] };
  for (const p of def.props ?? []) if (!decorative.has(p.kind) && !(alias[p.kind] ?? [p.kind]).some((k) => built.has(k))) res.missing.push(p.kind);
  res.missing = [...new Set(res.missing)];
  let contactSum = 0;
  const stretchMax = new Map<string, { ratio: number; at: number }>();
  const detached = new Map<string, number>();
  const collapseMin = new Map<string, { ratio: number; at: number }>();
  const skinEvery = Math.max(1, Math.round(n / 16));
  const planted = def.planted ?? [];
  const baked = BAKED ? bake(slug, perf, sk) : null;
  if (baked) {
    // Between frames: the live solve half a frame on from each frame (solved in the bake's own order, so it carries
    // the same history) against the baked playback at that moment.
    res.baked = { frames: baked.frames, bytes: baked.frames * baked.bones * 14 + baked.gear.length * 4, bone: 0, hand: 0, piece: 0, worst: "" };
    const handIdx = [...HANDS.R, ...HANDS.L].filter((b) => /^hand/.test(sk.names[b]!));
    const F = baked.frames - 1;
    settle(perf, sk, F);
    for (let f = 0; f < F; f++) {
      perf.pose((f / F) * T);
      const t = ((f + 0.5) / F) * T;
      perf.pose(t);
      const live = sk.pos.map((p) => p.clone());
      const liveGear = perf.pieces.map((p) => p.obj.position.clone());
      playBaked(baked, t, sk, perf.pieces);
      sk.pos.forEach((p, b) => {
        const d = p.distanceTo(live[b]!);
        if (d > res.baked!.bone) [res.baked!.bone, res.baked!.worst] = [d, sk.names[b]!];
      });
      res.baked.hand = Math.max(res.baked.hand, ...handIdx.map((b) => sk.pos[b]!.distanceTo(live[b]!)));
      res.baked.piece = Math.max(res.baked.piece, ...perf.pieces.map((p, k) => p.obj.position.distanceTo(liveGear[k]!)));
    }
  }
  // (Loops first until they repeat, as the bake does: each arm's solution continues from the frame before.)
  settle(perf, sk, n);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * T;
    const rep = perf.pose(t);
    // (Baked: the body checks below run on the baked playback, as the app shows it.)
    if (baked) playBaked(baked, t, sk, perf.pieces);
    rots.push(sk.rot.map((q) => q.clone()));
    for (const [k, v] of Object.entries(rep.limits)) res.limits[k] = Math.max(res.limits[k] ?? 0, v);
    for (const c of perf.contacts()) {
      res.contact.worst = Math.max(res.contact.worst, c.gap);
      res.contact.turn = Math.max(res.contact.turn, c.turn);
      contactSum += c.gap;
      res.contact.samples++;
    }
    if (i % skinEvery) continue;
    // Skin the body for this sample.
    const mats = sk.names.map((_, b) => new THREE.Matrix4().compose(sk.pos[b]!, sk.rot[b]!, new THREE.Vector3(1, 1, 1)).multiply(new THREE.Matrix4().compose(sk.restPos[b]!, sk.restRot[b]!, new THREE.Vector3(1, 1, 1)).invert()).elements);
    const dqs = mats.map((e) => dqOf(e));
    correctives?.update(sk);
    const out: [number, number, number] = [0, 0, 0];
    const p: [number, number, number] = [0, 0, 0];
    const solids = perf.pieces.flatMap((p) => p.solidsWorld().map((s) => ({ ...s, piece: p.kind })));
    const held = new Set<number>();
    for (const c of perf.contacts()) for (const b of HANDS[c.side]) held.add(b);
    let lowest = Infinity;
    const footLow: Record<string, number> = { R: Infinity, L: Infinity };
    const skinnedParts: Float32Array[] = [];
    for (const part of parts) {
      const N = part.pos.length / 3;
      const now = new Float32Array(N * 3);
      skinnedParts.push(now);
      for (let v = 0; v < N; v++) {
        p[0] = part.pos[v * 3]!;
        p[1] = part.pos[v * 3 + 1]!;
        p[2] = part.pos[v * 3 + 2]!;
        if (correctives && part.row[v]! >= 0) correctives.add(part.row[v]!, p);
        (part.linear ? lbsSkin : dqSkin)((part.linear ? mats : dqs) as never, part.idx.subarray(v * 4, v * 4 + 4), part.wt.subarray(v * 4, v * 4 + 4), p, out);
        now.set(out, v * 3);
        if (out[1] < lowest) lowest = out[1];
        const mb = part.main[v]!;
        if (FEET.has(mb)) {
          const s = sk.names[mb]!.slice(-1);
          footLow[s] = Math.min(footLow[s]!, out[1]);
        }
      }
      // Edge stretch against the rest pose (edges longer than 2 mm): the 99th and 1st percentiles per part, so a muscle
      // counts as distorted when a visible share of it is, not when one sliver of a triangle at a joint is.
      // Detached: a vertex far from where its own main bone would carry it (a part bound to the wrong bones flies off).
      for (let v = 0; v < N; v += 7) {
        const mb = part.main[v]!;
        const rigid = sk.point(mb, new THREE.Vector3(part.pos[v * 3], part.pos[v * 3 + 1], part.pos[v * 3 + 2]));
        const d = rigid.distanceTo(new THREE.Vector3(now[v * 3], now[v * 3 + 1], now[v * 3 + 2]));
        if (d > 25 && d > (detached.get(part.name) ?? 0)) detached.set(part.name, d);
      }
      // Visible distortion: the share of the part's edges that more than double and grow by over 1 cm (a spike or a
      // tear), or shrink below a third and by over 1 cm (a collapse). Slivers at attachments that stretch a few
      // millimetres do not count; they cannot be seen.
      let total = 0, spikes = 0, folds = 0;
      for (let k = 0; k < part.tris.length; k += 3)
        for (const [a, b] of [[part.tris[k]!, part.tris[k + 1]!], [part.tris[k + 1]!, part.tris[k + 2]!], [part.tris[k + 2]!, part.tris[k]!]] as const) {
          const r0 = Math.hypot(part.pos[a * 3]! - part.pos[b * 3]!, part.pos[a * 3 + 1]! - part.pos[b * 3 + 1]!, part.pos[a * 3 + 2]! - part.pos[b * 3 + 2]!);
          const r1 = Math.hypot(now[a * 3]! - now[b * 3]!, now[a * 3 + 1]! - now[b * 3 + 1]!, now[a * 3 + 2]! - now[b * 3 + 2]!);
          total++;
          if (r1 > 2 * r0 && r1 - r0 > 1) spikes++;
          if (r1 < r0 / 3 && r0 - r1 > 1) folds++;
        }
      const hi = total ? (100 * spikes) / total : 0;
      const lo = total ? (100 * folds) / total : 0;
      if (hi > (stretchMax.get(part.name)?.ratio ?? 0)) stretchMax.set(part.name, { ratio: hi, at: i / n });
      if (lo > (collapseMin.get(part.name)?.ratio ?? 0)) collapseMin.set(part.name, { ratio: lo, at: i / n });
      // Equipment inside the body. (A holding hand touches its handle's surface, so its parts are allowed a little
      // further in, the depth of the skin pressing on the handle, but no further: fingers or a thumb inside a ball or a
      // plate still count.)
      if (solids.length)
        for (let v = 0; v < N; v += 3) {
          const mb = part.main[v]!;
          const allow = held.has(mb) ? 1.2 : 0;
          const p = new THREE.Vector3(now[v * 3], now[v * 3 + 1], now[v * 3 + 2]);
          for (const s of solids) {
            const depth = depthIn(p, s) - allow;
            if (depth > 0.8) {
              const prev = res.collisions.find((c) => c.piece === s.piece);
              if (!prev) res.collisions.push({ piece: s.piece, depth, at: i / n, bone: sk.names[mb]! });
              else if (depth > prev.depth) Object.assign(prev, { depth, at: i / n, bone: sk.names[mb]! });
            }
          }
        }
    }
    // Floating parts: a part most of whose points have no other part within a few centimetres (a sliver come adrift,
    // as the thumb muscle the file names for the wrong hand once did).
    {
      const key = (x: number, y: number, z: number) => `${Math.floor(x / 3)},${Math.floor(y / 3)},${Math.floor(z / 3)}`;
      const grid = new Map<string, number[]>();
      skinnedParts.forEach((q, pi) => {
        for (let v = 0; v < q.length / 3; v += 2) {
          const k = key(q[v * 3]!, q[v * 3 + 1]!, q[v * 3 + 2]!);
          const l = grid.get(k) ?? [];
          if (!l.includes(pi)) l.push(pi);
          grid.set(k, l);
        }
      });
      skinnedParts.forEach((q, pi) => {
        let alone = 0, tot = 0;
        for (let v = 0; v < q.length / 3; v += 3) {
          tot++;
          const cx = Math.floor(q[v * 3]! / 3), cy = Math.floor(q[v * 3 + 1]! / 3), cz = Math.floor(q[v * 3 + 2]! / 3);
          let other = false;
          for (let a = -1; a <= 1 && !other; a++)
            for (let b = -1; b <= 1 && !other; b++)
              for (let c = -1; c <= 1 && !other; c++) other = (grid.get(`${cx + a},${cy + b},${cz + c}`) ?? []).some((o) => o !== pi);
          if (!other) alone++;
        }
        if (tot && alone / tot > 0.5) detached.set(parts[pi]!.name, Math.max(detached.get(parts[pi]!.name) ?? 0, 100 * (alone / tot)));
      });
    }
    res.floor.below = Math.max(res.floor.below, -lowest);
    for (const s of planted) res.floor.floating = Math.max(res.floor.floating, footLow[s]! - 0.5);
  }
  res.contact.mean = res.contact.samples ? contactSum / res.contact.samples : 0;
  // Continuity: per bone, the rotation step between samples. A step much bigger than its neighbours' is looked at
  // closer: sampled eight times finer, a fast but smooth movement spreads over the sub-steps, while a pop (the solution
  // jumping) stays one big step. The loop's seam is checked the same way (the last sample to the first).
  const B = sk.names.length;
  const suspects: { b: number; i: number; s: number }[] = [];
  for (let b = 0; b < B; b++) {
    const steps = rots.map((r, i) => angleDeg(r[b]!, rots[(i + 1) % n]![b]!));
    for (let i = 0; i < n; i++) {
      const s = steps[i]!;
      const around = (steps[(i - 1 + n) % n]! + steps[(i + 1) % n]!) / 2;
      if (s > Math.max(around * 2.5, 6) || (i === n - 1 && s > 6)) suspects.push({ b, i, s });
    }
  }
  let worst: Result["pop"] = null;
  const checked = new Map<number, THREE.Quaternion[][]>();
  for (const sp of suspects.sort((a, b) => b.s - a.s).slice(0, 12)) {
    let sub = checked.get(sp.i);
    if (!sub) {
      // (Re-pose from the sample before, so each sub-step continues from the last.)
      perf.pose((sp.i / n) * T);
      sub = [];
      for (let k = 0; k <= 8; k++) {
        perf.pose(((sp.i + k / 8) / n) * T);
        sub.push(sk.rot.map((q) => q.clone()));
      }
      checked.set(sp.i, sub);
    }
    let biggest = 0;
    for (let k = 0; k < 8; k++) biggest = Math.max(biggest, angleDeg(sub[k]![sp.b]!, sub[k + 1]![sp.b]!));
    if (biggest > Math.max(8, sp.s * 0.5)) {
      if (sp.i === n - 1) {
        if (!res.seam || biggest > res.seam.jump) res.seam = { bone: sk.names[sp.b]!, jump: biggest };
      } else if (!worst || biggest > worst.jump) worst = { bone: sk.names[sp.b]!, jump: biggest, at: sp.i / n };
    }
  }
  res.pop = worst;
  // (ratio: the percentage of the part's edges visibly stretched / collapsed at its worst moment.)
  res.stretch = [...stretchMax].filter(([, v]) => v.ratio > 0.5).map(([part, v]) => ({ part, ...v })).sort((a, b) => b.ratio - a.ratio).slice(0, 8);
  res.collapse = [...collapseMin].filter(([, v]) => v.ratio > 0.5).map(([part, v]) => ({ part, ...v })).sort((a, b) => b.ratio - a.ratio).slice(0, 8);
  // Verdict.
  if (!res.converted) res.fails.push("no 3D spec yet (free hands, no equipment)");
  if (res.missing.length) res.fails.push(`missing equipment: ${res.missing.join(", ")}`);
  if (res.contact.worst > 2) res.fails.push(`hand off its handle by up to ${res.contact.worst.toFixed(1)} cm`);
  if (res.contact.turn > 25) res.fails.push(`hand turned ${res.contact.turn.toFixed(0)}° from its grip`);
  for (const [k, v] of Object.entries(res.limits)) if (v > 10) res.fails.push(`${k} held at its limit by ${v.toFixed(0)}`);
  if (res.pop) res.fails.push(`pop: ${res.pop.bone} jumps ${res.pop.jump.toFixed(0)}° at ${(res.pop.at * 100).toFixed(0)}%`);
  if (res.seam) res.fails.push(`loop seam: ${res.seam.bone} jumps ${res.seam.jump.toFixed(0)}°`);
  for (const s of res.stretch.filter((s) => s.ratio > 2)) res.fails.push(`stretched: ${s.part} (${s.ratio.toFixed(1)}% of its surface)`);
  for (const s of res.collapse.filter((s) => s.ratio > 2)) res.fails.push(`collapsed: ${s.part} (${s.ratio.toFixed(1)}% of its surface)`);
  for (const c of res.collisions.filter((c) => c.depth > 1.5)) res.fails.push(`${c.piece} ${c.depth.toFixed(1)} cm into the ${c.bone}`);
  for (const [part, d] of detached) res.fails.push(`detached: ${part} (${d.toFixed(0)})`);
  if (res.floor.below > 1.5) res.fails.push(`${res.floor.below.toFixed(1)} cm below the floor`);
  if (res.floor.floating > 2) res.fails.push(`planted foot ${res.floor.floating.toFixed(1)} cm off the floor`);
  if (res.baked && Math.max(res.baked.hand, res.baked.piece) > 1) res.fails.push(`baked playback strays ${Math.max(res.baked.hand, res.baked.piece).toFixed(1)} cm from the solve between frames`);
  results.push(res);
  writeFileSync(`${OUT}/${slug}.json`, JSON.stringify(res, null, 1));
  const bk = res.baked ? `  baked ${res.baked.frames}f ${(res.baked.bytes / 1024).toFixed(0)}KB err bone ${res.baked.bone.toFixed(2)} (${res.baked.worst}) hand ${res.baked.hand.toFixed(2)} piece ${res.baked.piece.toFixed(2)}cm` : "";
  console.log(`${slug.padEnd(34)} ${res.fails.length ? "FAIL" : "pass"}  contact ${res.contact.worst.toFixed(1)}cm/${res.contact.turn.toFixed(0)}°${bk}  ${res.fails.join("; ")}`);
}
writeFileSync(`${OUT}/summary.json`, JSON.stringify(results.map((r) => ({ slug: r.slug, pass: !r.fails.length, fails: r.fails })), null, 1));
