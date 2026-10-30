/**
 * The "athlete" look for the 2D demonstrations: a muscular human figure in the style of the owner's approved
 * black-and-gold reference (assets/exercise-demos-src/_character/character-reference.png). Dark charcoal skin lit from
 * the front, a warm gold rim light from behind, thin gold anatomical lines, black shorts with a gold side stripe, black
 * trainers, gripping hands, a real head with short dark hair, and the muscles each exercise trains glowing warm gold.
 *
 * It draws the same skeleton (frame.pts / frame.seg) as the classic figure, so every exercise keeps its movement; only
 * the body around the bones changes. Everything is built from a few shaped paths per body part (no images), so it stays
 * light enough to animate at 60 fps on a phone.
 */
import { BODY, add, frontOf, up } from "./skeleton";
import type { Frame, Vec } from "./types";

type Ctx = CanvasRenderingContext2D;
type LayerFn = (name: string) => void;

// ---------------------------------------------------------------------------------------------------- Muscles

export type MuscleRegion =
  | "biceps"
  | "triceps"
  | "forearms"
  | "frontDelts"
  | "sideDelts"
  | "rearDelts"
  | "chest"
  | "abs"
  | "obliques"
  | "lats"
  | "upperBack"
  | "traps"
  | "lowerBack"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "adductors"
  | "hipFlexors"
  | "calves"
  | "shins"
  | "neck";

/** How strongly each region glows, 0..1 (primary muscles 1, secondary about 0.45). */
export type Highlight = Partial<Record<MuscleRegion, number>>;

const ALIASES: Record<string, MuscleRegion[]> = {
  biceps: ["biceps"],
  brachialis: ["biceps"],
  triceps: ["triceps"],
  "triceps (long head)": ["triceps"],
  forearms: ["forearms"],
  grip: ["forearms"],
  shoulders: ["frontDelts", "sideDelts", "rearDelts"],
  "front delts": ["frontDelts"],
  "front deltoids": ["frontDelts"],
  "side delts": ["sideDelts"],
  "side deltoids": ["sideDelts"],
  "rear delts": ["rearDelts"],
  "rear deltoids": ["rearDelts"],
  "rotator cuff": ["rearDelts"],
  "teres major": ["lats"],
  chest: ["chest"],
  "upper chest": ["chest"],
  serratus: ["obliques"],
  core: ["abs", "obliques"],
  abs: ["abs"],
  abdominals: ["abs"],
  obliques: ["obliques"],
  lats: ["lats"],
  "upper back": ["upperBack", "traps"],
  rhomboids: ["upperBack"],
  "middle traps": ["upperBack"],
  traps: ["traps"],
  "upper traps": ["traps"],
  "thoracic spine": ["upperBack"],
  "spinal erectors": ["lowerBack"],
  "lower back": ["lowerBack"],
  spine: ["lowerBack"],
  glutes: ["glutes"],
  hips: ["glutes", "hipFlexors"],
  "hip flexors": ["hipFlexors"],
  "hip rotators": ["glutes"],
  quadriceps: ["quads"],
  hamstrings: ["hamstrings"],
  adductors: ["adductors"],
  legs: ["quads", "hamstrings", "calves"],
  calves: ["calves"],
  "calves (soleus)": ["calves"],
  "calves (gastrocnemius)": ["calves"],
  ankles: ["calves", "shins"],
  "foot and ankle stabilizers": ["calves", "shins"],
  "foot stabilizers": ["calves", "shins"],
  neck: ["neck"],
  "full body": ["quads", "glutes", "abs", "upperBack", "lats", "frontDelts"],
};

/** The glow for an exercise's primary and secondary muscles (names as in src/data/exercises.ts). */
export function highlightFor(primary: readonly string[] = [], secondary: readonly string[] = []): Highlight {
  const out: Highlight = {};
  const put = (names: readonly string[], k: number) => {
    for (const name of names) for (const r of ALIASES[name.trim().toLowerCase()] ?? []) out[r] = Math.max(out[r] ?? 0, k);
  };
  put(secondary, 0.42);
  put(primary, 1);
  return out;
}

// ---------------------------------------------------------------------------------------------------- Palette

interface Tone {
  hi: string;
  mid: string;
  lo: string;
  /** Strength of the gold rim light along this part's outer edge. */
  rim: number;
  /** Strength of the gold anatomical lines. */
  line: number;
  /** Strength of the light catching the muscle bellies. */
  sheen: number;
}
const SKIN_NEAR: Tone = { hi: "#958e84", mid: "#3e3a35", lo: "#0f0e0d", rim: 0.95, line: 0.4, sheen: 0.16 };
const SKIN_FAR: Tone = { hi: "#4d4944", mid: "#2a2826", lo: "#0b0a0a", rim: 0.45, line: 0.18, sheen: 0.06 };
const CLOTH_NEAR: Tone = { hi: "#303033", mid: "#131314", lo: "#050505", rim: 0.6, line: 0, sheen: 0.05 };
const CLOTH_FAR: Tone = { hi: "#1d1d1f", mid: "#0c0c0d", lo: "#030303", rim: 0.3, line: 0, sheen: 0 };
const SHOE: Tone = { hi: "#3a3a3d", mid: "#171718", lo: "#060606", rim: 0.55, line: 0, sheen: 0.06 };
const HAIR = "#0d0c0b";
const GOLD = "226,184,96";
const GOLD_HOT = "255,222,140";

/** Key light from the front and above; the gold rim light comes from behind. */
const LIGHT: Vec = [0.6, 0.8];
/** Where the rim light pushes the body's gold outline (toward the back, slightly up). */
const RIM_SHIFT: Vec = [-0.75, 0.2];

// ---------------------------------------------------------------------------------------------------- Geometry

interface Seg {
  a: Vec;
  b: Vec;
  d: Vec;
  /** "Front" normal: counter-clockwise of the direction a→b (the front of a limb hanging down in the side view). */
  n: Vec;
  L: number;
}

function seg(a: Vec, b: Vec): Seg {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 0.001;
  const d: Vec = [dx / L, dy / L];
  return { a, b, d, n: [-d[1], d[0]], L };
}

/** A point along a segment (fraction t of its length, `off` cm toward its front normal). */
function at(s: Seg, t: number, off: number): Vec {
  return [s.a[0] + s.d[0] * s.L * t + s.n[0] * off, s.a[1] + s.d[1] * s.L * t + s.n[1] * off];
}

const mid = (p: Vec, q: Vec): Vec => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
const dot = (p: Vec, q: Vec) => p[0] * q[0] + p[1] * q[1];
/** +1 when a normal faces the key light, -1 when it faces away. */
const lit = (n: Vec) => (dot(n, LIGHT) >= 0 ? 1 : -1);

/** A smooth closed outline through the points (each point is a control point; the curve runs through the midpoints). */
function smooth(pts: Vec[]): Path2D {
  const p = new Path2D();
  const n = pts.length;
  const m0 = mid(pts[n - 1]!, pts[0]!);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const c = pts[i]!;
    const m = mid(c, pts[(i + 1) % n]!);
    p.quadraticCurveTo(c[0], c[1], m[0], m[1]);
  }
  p.closePath();
  return p;
}

/** Half-widths along a limb: [t, front, back]. */
type Profile = [number, number, number][];

/** Outline of a limb from its width profile, with rounded ends (`capA` / `capB` cm beyond the ends). */
function limbOutline(s: Seg, prof: Profile, capA: number, capB: number, grow = 0): Vec[] {
  const front = prof.map(([t, f]) => at(s, t, f + grow));
  const back = prof.map(([t, , b]) => at(s, t, -(b + grow))).reverse();
  const t1 = prof[prof.length - 1]![0];
  const t0 = prof[0]![0];
  return [...front, at(s, t1 + capB / s.L, 0), ...back, at(s, t0 - capA / s.L, 0)];
}

// ---------------------------------------------------------------------------------------------------- Painting

/**
 * A body part: its outline (used for the rim light around the whole body) and how to paint it. Parts are painted in
 * order (far side first); a "layer" entry is where equipment at that depth is drawn.
 */
interface Part {
  path: Path2D;
  rim: number;
  draw: () => void;
}
type Item = Part | { layer: string };

/** Fill a body part, front-lit, with a soft dark band inside its edge for roundness (no outline: parts blend). */
function paint(ctx: Ctx, path: Path2D, c: Vec, n: Vec, r: number, tone: Tone) {
  const s = lit(n);
  const p1 = add(c, n, r * s);
  const p2 = add(c, n, -r * s);
  const g = ctx.createLinearGradient(p1[0], p1[1], p2[0], p2[1]);
  g.addColorStop(0, tone.hi);
  g.addColorStop(0.38, tone.mid);
  g.addColorStop(1, tone.lo);
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, r * 0.34);
  ctx.stroke(path);
  ctx.restore();
}

/**
 * A muscle's edge: a soft dark groove with a thin gold line along it (the reference's anatomical lines), points in world
 * coordinates.
 */
function accentW(ctx: Ctx, ps: Vec[], alpha: number, w = 0.32) {
  if (alpha <= 0 || ps.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(ps[0]![0], ps[0]![1]);
  if (ps.length === 2) ctx.lineTo(ps[1]![0], ps[1]![1]);
  for (let i = 1; i < ps.length - 1; i++) {
    const m = i === ps.length - 2 ? ps[i + 1]! : mid(ps[i]!, ps[i + 1]!);
    ctx.quadraticCurveTo(ps[i]![0], ps[i]![1], m[0], m[1]);
  }
  ctx.strokeStyle = `rgba(0,0,0,${Math.min(0.4, alpha * 0.85)})`;
  ctx.lineWidth = w * 3.4;
  ctx.stroke();
  ctx.strokeStyle = `rgba(${GOLD},${alpha})`;
  ctx.lineWidth = w;
  ctx.stroke();
}

function accent(ctx: Ctx, s: Seg, pts: [number, number][], alpha: number, w = 0.32) {
  accentW(ctx, pts.map(([t, o]) => at(s, t, o)), alpha, w);
}

/** An elliptical radial fill (along `axis`), kept inside `clip`. */
function blob(ctx: Ctx, clip: Path2D, c: Vec, axis: Vec, rx: number, ry: number, stops: [number, string][]) {
  ctx.save();
  ctx.clip(clip);
  ctx.translate(c[0], c[1]);
  ctx.rotate(Math.atan2(axis[1], axis[0]));
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Light catching the top of a muscle belly. */
function sheen(ctx: Ctx, clip: Path2D, c: Vec, axis: Vec, rx: number, ry: number, a: number) {
  if (a > 0) blob(ctx, clip, c, axis, rx, ry, [[0, `rgba(255,248,236,${a})`], [1, "rgba(255,248,236,0)"]]);
}

/** A working muscle: a warm gold glow, kept inside the body part's outline. */
function glow(ctx: Ctx, clip: Path2D, c: Vec, axis: Vec, rx: number, ry: number, k: number) {
  if (k <= 0) return;
  blob(ctx, clip, c, axis, rx, ry, [
    [0, `rgba(${GOLD_HOT},${0.92 * k})`],
    [0.35, `rgba(${GOLD},${0.7 * k})`],
    [0.75, `rgba(200,140,40,${0.28 * k})`],
    [1, "rgba(200,140,40,0)"],
  ]);
}

/** Paint the items: the whole body's gold rim light first (its silhouette nudged toward the back light), then the parts. */
function render(ctx: Ctx, items: Item[], layer: LayerFn) {
  const parts = items.filter((i): i is Part => "path" in i);
  for (const [k, a] of [[2, 0.28], [1, 0.95]] as const) {
    ctx.save();
    ctx.translate(RIM_SHIFT[0] * k, RIM_SHIFT[1] * k);
    for (const p of parts) {
      if (p.rim <= 0) continue;
      ctx.fillStyle = `rgba(${GOLD},${a * p.rim})`;
      ctx.fill(p.path);
    }
    ctx.restore();
  }
  for (const i of items) {
    if ("path" in i) i.draw();
    else layer(i.layer);
  }
}

// ---------------------------------------------------------------------------------------------------- Limbs

/** Side-view profiles (cm). Front = toward the front of the body for a limb hanging down. */
const UPPER_ARM: Profile = [
  [0, 7.4, 7.2],
  [0.12, 8.0, 7.4],
  [0.3, 6.0, 6.6],
  [0.52, 6.4, 7.0],
  [0.72, 5.4, 5.6],
  [0.9, 4.1, 4.3],
  [1, 3.7, 3.9],
];
const FOREARM: Profile = [
  [0, 4.0, 4.0],
  [0.16, 5.2, 4.5],
  [0.38, 4.4, 3.7],
  [0.62, 3.2, 2.9],
  [0.8, 2.5, 2.4],
];
const THIGH: Profile = [
  [0, 9.8, 10.8],
  [0.22, 10.6, 10.2],
  [0.5, 10.4, 9.0],
  [0.74, 9.2, 7.0],
  [0.88, 6.8, 5.6],
  [1, 5.2, 5.0],
];
const SHIN: Profile = [
  [0, 4.9, 5.0],
  [0.1, 4.5, 7.6],
  [0.28, 4.3, 8.6],
  [0.46, 3.8, 6.6],
  [0.66, 3.2, 3.9],
  [0.82, 2.7, 2.9],
  [0.94, 2.5, 2.6],
];

function armParts(ctx: Ctx, sh: Vec, el: Vec, hd: Vec, tone: Tone, hl: Highlight, k: number, flipFront = false): Part[] {
  const upper = seg(sh, el);
  const fore = seg(el, hd);
  // Front-view right arm: its lateral side is the segment's back normal, so mirror the profile.
  const sgn = flipFront ? -1 : 1;
  const prof = (p: Profile): Profile => (flipFront ? p.map(([t, f, b]) => [t, b, f]) : p);
  // The biceps peaks as the elbow bends.
  const flex = Math.max(0, Math.min(1, 1 - (dot(upper.d, fore.d) + 1) / 1.6));
  const ua = prof(UPPER_ARM.map(([t, f, b]) => [t, t > 0.35 && t < 0.85 ? f + flex * 1.3 * Math.sin(((t - 0.35) / 0.5) * Math.PI) : f, b] as [number, number, number]));
  const foreOut = smooth(limbOutline(fore, prof(FOREARM), 3.6, 1.5));
  const handPart = hand(ctx, fore, tone, sgn);
  const upOut = smooth(limbOutline(upper, ua, 3.6, 3.4));
  // The deltoid sits on the shoulder whatever the arm's direction: a rounded cap centred just below the joint,
  // stretched a little toward the elbow.
  const dc = add(sh, upper.d, 2.6);
  const delt = new Path2D();
  delt.ellipse(dc[0], dc[1], 8.6, 7.6, Math.atan2(upper.d[1], upper.d[0]), 0, Math.PI * 2);
  const deltPart: Part = {
    path: delt,
    rim: tone.rim,
    draw: () => {
      paint(ctx, delt, dc, upper.n, 7.6, tone);
      sheen(ctx, delt, add(dc, LIGHT, 3), upper.d, 5, 3.6, tone.sheen * 1.2);
      glow(ctx, delt, add(dc, upper.n, 3 * sgn), upper.d, 6.5, 4.6, k * (hl.frontDelts ?? 0));
      glow(ctx, delt, dc, upper.d, 7.5, 6, k * (hl.sideDelts ?? 0));
      glow(ctx, delt, add(dc, upper.n, -3 * sgn), upper.d, 6.5, 4.6, k * (hl.rearDelts ?? 0));
      accentW(ctx, [add(add(dc, upper.d, 5), upper.n, 6.2 * sgn), add(dc, upper.d, 7.4), add(add(dc, upper.d, 5), upper.n, -6.2 * sgn)], tone.line);
    },
  };
  return [
    {
      path: foreOut,
      rim: tone.rim,
      draw: () => {
        paint(ctx, foreOut, at(fore, 0.35, 0), fore.n, 4.6, tone);
        sheen(ctx, foreOut, at(fore, 0.22, 2 * lit(fore.n)), fore.d, 7, 2.4, tone.sheen);
        glow(ctx, foreOut, at(fore, 0.28, 0.6 * sgn), fore.d, 9, 3.6, k * (hl.forearms ?? 0));
        accent(ctx, fore, [[0.06, 1.2 * sgn], [0.3, 1.6 * sgn], [0.62, 0.6 * sgn]], tone.line * 0.8);
      },
    },
    handPart,
    {
      path: upOut,
      rim: tone.rim,
      draw: () => {
        paint(ctx, upOut, at(upper, 0.45, 0), upper.n, 6.6, tone);
        const ln = lit(upper.n);
        sheen(ctx, upOut, at(upper, 0.1, 3 * ln), upper.d, 6, 3.6, tone.sheen * 1.15);
        sheen(ctx, upOut, at(upper, 0.56, 3 * ln), upper.d, 7.5, 3, tone.sheen);
        glow(ctx, upOut, at(upper, 0.56, 2.2 * sgn), upper.d, 9.5, 3.6 + flex, k * (hl.biceps ?? 0));
        glow(ctx, upOut, at(upper, 0.5, -2.5 * sgn), upper.d, 10.5, 3.8, k * (hl.triceps ?? 0));
        glow(ctx, upOut, at(upper, 0.06, 2.6 * sgn), upper.d, 6.5, 4.2, k * (hl.frontDelts ?? 0));
        glow(ctx, upOut, at(upper, 0.08, 0), upper.d, 7, 5, k * (hl.sideDelts ?? 0));
        glow(ctx, upOut, at(upper, 0.06, -2.8 * sgn), upper.d, 6.5, 4.2, k * (hl.rearDelts ?? 0));
        // The biceps / triceps groove.
        accent(ctx, upper, [[0.42, 0.6 * sgn], [0.66, 0.4 * sgn], [0.88, 0.6 * sgn]], tone.line * 0.55);
        if ((hl.biceps ?? 0) > 0.5) accent(ctx, upper, [[0.42, 3.2 * sgn], [0.6, 4.2 * sgn + flex * sgn], [0.82, 2.8 * sgn]], Math.min(0.9, tone.line * 2) * k, 0.4);
      },
    },
    deltPart,
  ];
}

/** A closed fist around the grip point (the end of the forearm): palm and curled fingers, knuckles, the thumb. */
function hand(ctx: Ctx, fore: Seg, tone: Tone, sgn: number): Part {
  const g = fore.b;
  const d = fore.d;
  const n: Vec = [fore.n[0] * sgn, fore.n[1] * sgn];
  const P = (x: number, y: number): Vec => [g[0] + d[0] * x + n[0] * y, g[1] + d[1] * x + n[1] * y];
  const path = smooth([P(-7, 2.4), P(-3.2, 3.9), P(0.6, 4.4), P(3.9, 3.6), P(5, 1), P(4.8, -1.9), P(2.4, -3.6), P(-2.6, -3.4), P(-7, -2.3)]);
  return {
    path,
    rim: tone.rim,
    draw: () => {
      paint(ctx, path, P(0, 0), n, 3.8, tone);
      sheen(ctx, path, P(2.6, -1.4), d, 2.6, 2, tone.sheen * 1.3);
      // Curled fingers over the grip, the thumb across them.
      accentW(ctx, [P(0.8, 4.2), P(3.6, 2.8), P(4.5, 0.4)], tone.line * 0.9, 0.26);
      accentW(ctx, [P(-1.6, 4.1), P(1.8, 1.4), P(4.0, -1.3)], tone.line * 0.55, 0.24);
      accentW(ctx, [P(-4.8, 3.0), P(-1, 1.2)], tone.line * 0.8, 0.28);
    },
  };
}

function legParts(ctx: Ctx, hip: Vec, knee: Vec, ankle: Vec, footRot: number, skinT: Tone, clothT: Tone, hl: Highlight, k: number, flipFront = false, front = false): Part[] {
  const thigh = seg(hip, knee);
  const shin = seg(knee, ankle);
  const sgn = flipFront ? -1 : 1;
  const prof = (p: Profile): Profile => (flipFront ? p.map(([t, f, b]) => [t, b, f]) : p);
  const shinOut = smooth(limbOutline(shin, prof(SHIN), 3.4, 2));
  const thighOut = smooth(limbOutline(thigh, prof(THIGH), 8, 2.6));
  // Shorts over the top of the thigh: a sleeve ending in a hem, with the gold side stripe.
  const sleeveProf: Profile = prof([
    [-0.05, 10.2, 11.6],
    [0.15, 11.0, 11.0],
    [0.3, 10.8, 10.3],
    [0.4, 10.5, 9.8],
  ]);
  const so = limbOutline(thigh, sleeveProf, 9, 0, 0.5);
  const hemF = (flipFront ? 9.9 : 10.3) * sgn;
  const hemB = -(flipFront ? 10.3 : 9.9) * sgn;
  const sleeve = smooth([...so.slice(0, 4), at(thigh, 0.42, hemF), at(thigh, 0.42, hemB), ...so.slice(5)]);
  const shoe = front ? shoeFront(ctx, ankle, shin) : shoeSide(ctx, ankle, footRot);
  return [
    {
      path: shinOut,
      rim: skinT.rim,
      draw: () => {
        paint(ctx, shinOut, at(shin, 0.4, 0), shin.n, 6, skinT);
        sheen(ctx, shinOut, at(shin, 0.28, -4 * sgn), shin.d, 9, 3, skinT.sheen * 0.9);
        glow(ctx, shinOut, at(shin, 0.3, -3.4 * sgn), shin.d, 12, 4.4, k * (hl.calves ?? 0));
        glow(ctx, shinOut, at(shin, 0.4, 2.2 * sgn), shin.d, 12, 2.4, k * (hl.shins ?? 0));
        // The calf's edge, the shin bone.
        accent(ctx, shin, [[0.08, -3.2 * sgn], [0.3, -4.2 * sgn], [0.56, -1.8 * sgn]], skinT.line);
        accent(ctx, shin, [[0.14, 2.8 * sgn], [0.5, 2.2 * sgn], [0.8, 1.6 * sgn]], skinT.line * 0.4);
      },
    },
    ...shoe,
    {
      path: thighOut,
      rim: skinT.rim,
      draw: () => {
        paint(ctx, thighOut, at(thigh, 0.5, 0), thigh.n, 9.5, skinT);
        sheen(ctx, thighOut, at(thigh, 0.62, 4.6 * lit(thigh.n)), thigh.d, 13, 3.6, skinT.sheen);
        glow(ctx, thighOut, at(thigh, 0.6, 3.6 * sgn), thigh.d, 19, 5.6, k * (hl.quads ?? 0));
        glow(ctx, thighOut, at(thigh, 0.58, -3.4 * sgn), thigh.d, 18, 5, k * (hl.hamstrings ?? 0));
        glow(ctx, thighOut, at(thigh, 0.32, front ? -4 * sgn : 0), thigh.d, 12, 4, k * (hl.adductors ?? 0) * 0.8);
        // Quad sweep and teardrop, the hamstring line.
        accent(ctx, thigh, [[0.44, 6.6 * sgn], [0.68, 5.6 * sgn], [0.86, 3.2 * sgn], [0.96, 0.4 * sgn]], skinT.line);
        accent(ctx, thigh, [[0.5, -1.2 * sgn], [0.72, -1.6 * sgn], [0.9, -2.6 * sgn]], skinT.line * 0.4);
      },
    },
    {
      path: sleeve,
      rim: clothT.rim,
      draw: () => {
        paint(ctx, sleeve, at(thigh, 0.2, 0), thigh.n, 11, clothT);
        glow(ctx, sleeve, at(thigh, 0.3, 4 * sgn), thigh.d, 12, 5, k * (hl.quads ?? 0) * 0.35);
        ctx.strokeStyle = `rgba(${GOLD},${clothT === CLOTH_NEAR ? 0.75 : 0.35})`;
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        const s1 = at(thigh, -0.02, front ? 9 * sgn : 0.8);
        const s2 = at(thigh, 0.41, front ? 9.6 * sgn : 0.6);
        ctx.moveTo(s1[0], s1[1]);
        ctx.lineTo(s2[0], s2[1]);
        ctx.stroke();
        accentW(ctx, [at(thigh, 0.415, hemF * 0.97), at(thigh, 0.415, hemB * 0.97)], clothT === CLOTH_NEAR ? 0.3 : 0.12, 0.35);
      },
    },
  ];
}

function shoeSide(ctx: Ctx, ankle: Vec, rot: number): Part[] {
  const r = (rot * Math.PI) / 180;
  const f: Vec = [Math.cos(r), Math.sin(r)];
  const u: Vec = [-f[1], f[0]];
  const P = (fw: number, uh: number): Vec => [ankle[0] + f[0] * fw + u[0] * uh, ankle[1] + f[1] * fw + u[1] * uh];
  const H = BODY.ankleH;
  const B = BODY.footBack;
  const F = BODY.footFront + BODY.toeExtra;
  const upper = smooth([P(-B - 1.6, -H + 2.4), P(-B - 1.2, 2.6), P(-2, 4.4), P(3.5, 2.4), P(8, -1.2), P(F - 3, -H + 5.4), P(F + 0.6, -H + 3.2), P(F, -H + 1.2), P(-B, -H + 1.2)]);
  const sole = smooth([P(-B - 1.8, -H + 2.6), P(F + 0.8, -H + 2.4), P(F + 1, -H - 0.2), P(-B - 1.6, -H - 0.4)]);
  return [
    {
      path: upper,
      rim: SHOE.rim,
      draw: () => {
        paint(ctx, upper, P(4, -H / 2), u, 6, SHOE);
        sheen(ctx, upper, P(F - 6, -H + 4), f, 5, 2, 0.12);
        accentW(ctx, [P(1.5, 2.8), P(8.5, -1)], 0.22, 0.28);
      },
    },
    {
      path: sole,
      rim: 0,
      draw: () => {
        ctx.fillStyle = "#0a0a0a";
        ctx.fill(sole);
        ctx.strokeStyle = `rgba(${GOLD},0.85)`;
        ctx.lineWidth = 0.45;
        ctx.beginPath();
        const m1 = P(-B - 1.5, -H + 1.6);
        const m2 = P(F + 0.6, -H + 1.4);
        ctx.moveTo(m1[0], m1[1]);
        ctx.lineTo(m2[0], m2[1]);
        ctx.stroke();
      },
    },
  ];
}

function shoeFront(ctx: Ctx, ankle: Vec, shin: Seg): Part[] {
  const c: Vec = [ankle[0] + shin.d[0] * 3, ankle[1] + shin.d[1] * 3 - 1.5];
  const path = new Path2D();
  path.ellipse(c[0], c[1] - 1.5, 5.6, 4.4, 0, 0, Math.PI * 2);
  return [
    {
      path,
      rim: SHOE.rim,
      draw: () => {
        paint(ctx, path, c, [0, 1], 4, SHOE);
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(c[0] - 5.8, c[1] - 6.4, 11.6, 1.7);
        ctx.fillStyle = `rgba(${GOLD},0.75)`;
        ctx.fillRect(c[0] - 5.6, c[1] - 5, 11.2, 0.4);
      },
    },
  ];
}

// ---------------------------------------------------------------------------------------------------- Head

/** Head points in its own frame (face toward +x, y up, centre at the origin), mapped to the world. */
function headFrame(head: Vec, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (x: number, y: number): Vec => [head[0] + x * c + y * s, head[1] - x * s + y * c];
}

const PROFILE: Vec[] = [
  [0, 11.7],
  [4.6, 10.9],
  [7.6, 7.9],
  [8.8, 4.2],
  [8.3, 2.7],
  [8.8, 1.6],
  [10.9, -1.5],
  [9.0, -2.8],
  [9.3, -3.9],
  [8.6, -4.9],
  [8.9, -5.6],
  [8.2, -6.8],
  [8.7, -8.4],
  [7.0, -10.3],
  [3.0, -9.8],
  [-0.6, -7.3],
  [-2.8, -5.0],
  [-6.8, -2.6],
  [-8.9, 1.4],
  [-8.6, 6.4],
  [-5.6, 10.5],
];
const HAIR_SIDE: Vec[] = [
  [5.6, 8.4],
  [7.6, 9.9],
  [6.2, 12.0],
  [2.6, 13.1],
  [-2.8, 13.0],
  [-7.2, 10.9],
  [-9.5, 5.6],
  [-9.4, 1.6],
  [-7.6, -1.3],
  [-5.4, 0.2],
  [-3.2, 1.0],
  [-1.0, 2.4],
  [0.8, 0.6],
  [1.7, -1.0],
  [2.6, 1.8],
  [4.0, 6.0],
];

function headSideParts(ctx: Ctx, f: Frame, tone: Tone, hl: Highlight): Part[] {
  const { head, neckBase } = f.pts;
  const a = f.seg.head;
  const fa = frontOf(a);
  const fT2 = frontOf(f.seg.T2);
  const W = headFrame(head, a);
  // Neck: thick, the trapezius flaring into the upper back.
  const base = add(neckBase, up(a), -2);
  const top = add(head, up(a), -7.5);
  const nm = mid(base, top);
  const neck = smooth([add(base, fT2, 6), add(nm, fa, 5.2), add(top, fa, 5.4), add(top, fa, -3.4), add(nm, fa, -5.8), add(base, fT2, -9.8)]);
  const skull = smooth(PROFILE.map(([x, y]) => W(x, y)));
  const hair = smooth(HAIR_SIDE.map(([x, y]) => W(x, y)));
  return [
    {
      path: neck,
      rim: tone.rim,
      draw: () => {
        paint(ctx, neck, nm, fa, 5.5, tone);
        glow(ctx, neck, nm, seg(base, top).d, 7, 4, hl.neck ?? 0);
        // Sternocleidomastoid from behind the ear to the collarbone.
        accentW(ctx, [W(-1.4, -5.2), add(nm, fa, 1.4), add(base, fT2, 4.2)], tone.line * 0.8);
      },
    },
    {
      path: skull,
      rim: tone.rim,
      draw: () => {
        paint(ctx, skull, W(0, 0), fa, 9, tone);
        ctx.save();
        ctx.clip(skull);
        ctx.translate(head[0], head[1]);
        ctx.rotate((-a * Math.PI) / 180);
        // Eye socket and the cheekbone's shadow, the jaw's underside, faint stubble.
        const shade = (x: number, y: number, r: number, alpha: number) => {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(0,0,0,${alpha})`);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
        };
        shade(6.4, 1.6, 2.8, 0.5);
        shade(4.2, -2.4, 4.2, 0.22);
        shade(4.6, -9.6, 5.2, 0.35);
        shade(6.8, -6.8, 3.4, 0.18);
        const hl2 = ctx.createRadialGradient(6.4, 6.4, 0, 6.4, 6.4, 4);
        hl2.addColorStop(0, "rgba(255,248,236,0.14)");
        hl2.addColorStop(1, "rgba(255,248,236,0)");
        ctx.fillStyle = hl2;
        ctx.fillRect(2, 2, 8, 8);
        // Ear: rim, inner fold, lobe.
        ctx.fillStyle = tone.mid;
        ctx.beginPath();
        ctx.ellipse(-1.6, -0.4, 2.0, 3.2, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 0.3;
        ctx.stroke();
        ctx.strokeStyle = `rgba(${GOLD},${tone.line * 0.7})`;
        ctx.lineWidth = 0.22;
        ctx.beginPath();
        ctx.arc(-1.5, -0.2, 1.2, -1.2, 2.0);
        ctx.stroke();
        // Eye, brow, nostril, lips, jaw line.
        ctx.fillStyle = "#0a0908";
        ctx.beginPath();
        ctx.ellipse(7.2, 1.6, 0.9, 0.42, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(10,9,8,0.9)";
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        ctx.moveTo(5.2, 3.4);
        ctx.quadraticCurveTo(7.0, 4.1, 8.5, 3.4);
        ctx.stroke();
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(8.6, -2.5);
        ctx.quadraticCurveTo(9.4, -2.2, 9.6, -2.7);
        ctx.moveTo(8.5, -4.85);
        ctx.lineTo(9.0, -4.9);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${GOLD},${tone.line * 0.75})`;
        ctx.lineWidth = 0.26;
        ctx.beginPath();
        ctx.moveTo(-0.4, -6.6);
        ctx.quadraticCurveTo(3.6, -9.2, 7.6, -9.4);
        ctx.stroke();
        ctx.restore();
      },
    },
    {
      path: hair,
      rim: tone.rim * 0.7,
      draw: () => {
        ctx.fillStyle = HAIR;
        ctx.fill(hair);
        // Texture on top, combed back from a lifted front.
        ctx.save();
        ctx.clip(hair);
        ctx.translate(head[0], head[1]);
        ctx.rotate((-a * Math.PI) / 180);
        ctx.strokeStyle = "rgba(150,138,120,0.32)";
        ctx.lineWidth = 0.22;
        ctx.beginPath();
        for (const [x0, y0, x1, y1] of [[6.6, 10.6, 0.6, 12.6], [5.6, 9.6, -2.6, 12.2], [3.6, 8.4, -5.6, 10.8], [1.6, 6.4, -7.6, 7.6], [-1.6, 4.0, -8.6, 3.2]] as const) {
          ctx.moveTo(x0, y0);
          ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 1, x1, y1);
        }
        ctx.stroke();
        ctx.restore();
      },
    },
  ];
}

// ---------------------------------------------------------------------------------------------------- Torso

/** Torso outline stations in the side view: [centre, front offset, back offset, front normal]. */
function torsoStationsSide(f: Frame): [Vec, number, number, Vec][] {
  const { pelvis, mid: m, neckBase } = f.pts;
  const T1 = f.seg.T1;
  const T2 = f.seg.T2;
  const f1 = frontOf(T1);
  const f2 = frontOf(T2);
  const fm = frontOf((T1 + T2) / 2);
  const u1 = up(T1);
  const u2 = up(T2);
  return [
    [add(pelvis, u1, -2), 10.6, 11.8, f1],
    [add(pelvis, u1, 8), 10.4, 9.2, f1],
    [add(pelvis, u1, 15), 10.8, 8.2, f1],
    [m, 11.4, 9.4, fm],
    [add(m, u2, BODY.thorax * 0.22), 12.8, 12.2, f2],
    [add(m, u2, BODY.thorax * 0.45), 15.6, 13.8, f2],
    [add(m, u2, BODY.thorax * 0.66), 16.0, 13.2, f2],
    [add(m, u2, BODY.thorax * 0.86), 13.0, 12.0, f2],
    [add(neckBase, u2, 1.5), 7.6, 10.6, f2],
  ];
}

function torsoSideParts(ctx: Ctx, f: Frame, tone: Tone, hl: Highlight): Part[] {
  const st = torsoStationsSide(f);
  const path = smooth([...st.map(([c, fo, , n]) => add(c, n, fo)), ...st.map(([c, , bo, n]) => add(c, n, -bo)).reverse()]);
  const { mid: m, pelvis, neckBase } = f.pts;
  const f1 = frontOf(f.seg.T1);
  const f2 = frontOf(f.seg.T2);
  const u1 = up(f.seg.T1);
  const u2 = up(f.seg.T2);
  const th = BODY.thorax;
  return [
    {
      path,
      rim: tone.rim,
      draw: () => {
        paint(ctx, path, add(m, u2, 8), f2, 14, tone);
        sheen(ctx, path, add(add(m, u2, th * 0.6), f2, 10), u2, 7, 4.5, 0.18);
        sheen(ctx, path, add(add(m, u1, -2), f1, 8.5), u1, 10, 2.6, 0.12);
        sheen(ctx, path, add(add(m, u2, th * 0.5), f2, -6), u2, 10, 3.6, 0.06);
        glow(ctx, path, add(add(m, u2, th * 0.6), f2, 8.5), u2, 7.5, 5.5, hl.chest ?? 0);
        glow(ctx, path, add(add(m, u1, -2), f1, 7.2), u1, 13, 3.6, hl.abs ?? 0);
        glow(ctx, path, add(add(m, u1, -1), f1, 1.5), u1, 11, 5.5, hl.obliques ?? 0);
        glow(ctx, path, add(add(m, u2, th * 0.42), f2, -5.5), u2, 13, 5.2, hl.lats ?? 0);
        glow(ctx, path, add(add(m, u2, th * 0.74), f2, -7.2), u2, 9, 5, hl.upperBack ?? 0);
        glow(ctx, path, add(add(neckBase, u2, -2), f2, -6), u2, 6, 4.5, hl.traps ?? 0);
        glow(ctx, path, add(add(m, u1, -6), f1, -6.4), u1, 11, 3.6, hl.lowerBack ?? 0);
        // Pec's lower edge, serratus, the abdominal wall, the lat, the erectors along the spine.
        const L = tone.line;
        accentW(ctx, [add(add(m, u2, th * 0.44), f2, 15.2), add(add(m, u2, th * 0.36), f2, 10), add(add(m, u2, th * 0.56), f2, 3)], L);
        for (let i = 0; i < 3; i++) accentW(ctx, [add(add(m, u2, th * (0.12 + i * 0.08)), f2, 8.6), add(add(m, u2, th * (0.06 + i * 0.08)), f2, 11.2)], L * 0.5);
        accentW(ctx, [add(add(pelvis, u1, 6), f1, 8.4), add(add(pelvis, u1, 15), f1, 9.0), add(add(m, u2, th * 0.14), f2, 10.6)], L * 0.7);
        accentW(ctx, [add(add(m, u2, th * 0.7), f2, -3), add(add(m, u2, th * 0.34), f2, -8.6), add(add(pelvis, u1, 17), f1, -6.6)], L * 0.8);
        accentW(ctx, [add(add(pelvis, u1, 9), f1, -6.4), add(m, f1, -6.2), add(add(m, u2, th * 0.25), f2, -8.4)], L * 0.45);
      },
    },
  ];
}

/** The shorts' seat: waistband to the gluteal fold, rotating with the pelvis. */
function shortsSideParts(ctx: Ctx, f: Frame, tone: Tone, hl: Highlight): Part[] {
  const { pelvis } = f.pts;
  const f1 = frontOf(f.seg.T1);
  const u1 = up(f.seg.T1);
  const P = (fw: number, uh: number): Vec => add(add(pelvis, f1, fw), u1, uh);
  const path = smooth([P(10.9, 9.6), P(11.6, 3), P(10.8, -4.5), P(3.4, -10.6), P(-4.6, -11.2), P(-12, -6.6), P(-13.4, 1), P(-11, 8.8), P(0, 9.9)]);
  return [
    {
      path,
      rim: tone.rim,
      draw: () => {
        paint(ctx, path, P(0, 0), f1, 12, tone);
        glow(ctx, path, P(-6.4, -1), u1, 8.5, 7, (hl.glutes ?? 0) * 0.7);
        glow(ctx, path, P(6.5, -2), u1, 6, 5, (hl.hipFlexors ?? 0) * 0.5);
        // Waistband with a gold edge.
        ctx.strokeStyle = `rgba(${GOLD},0.55)`;
        ctx.lineWidth = 0.45;
        ctx.beginPath();
        const w1 = P(10.7, 8.8);
        const w2 = P(-10.6, 8.0);
        const wc = P(0, 8.2);
        ctx.moveTo(w1[0], w1[1]);
        ctx.quadraticCurveTo(wc[0], wc[1], w2[0], w2[1]);
        ctx.stroke();
        accentW(ctx, [P(10.9, 6.8), P(0, 6.6), P(-10.8, 6.0)], 0.12, 0.6);
      },
    },
  ];
}

// ---------------------------------------------------------------------------------------------------- Views

function drawSide(ctx: Ctx, f: Frame, layer: LayerFn, hl: Highlight) {
  const p = f.pts;
  const items: Item[] = [
    // Far side: darker, its glow softer.
    ...legParts(ctx, p.pelvis, p.kneeL, p.ankleL, f.seg.footL, SKIN_FAR, CLOTH_FAR, hl, 0.55),
    ...armParts(ctx, p.shoulder, p.elbowL, p.handL, SKIN_FAR, hl, 0.55),
    { layer: "far" },
    { layer: "mid" },
    ...torsoSideParts(ctx, f, SKIN_NEAR, hl),
    ...shortsSideParts(ctx, f, CLOTH_NEAR, hl),
    ...headSideParts(ctx, f, SKIN_NEAR, hl),
    ...legParts(ctx, p.pelvis, p.kneeR, p.ankleR, f.seg.footR, SKIN_NEAR, CLOTH_NEAR, hl, 1),
    { layer: "near" },
    ...armParts(ctx, p.shoulder, p.elbowR, p.handR, SKIN_NEAR, hl, 1),
  ];
  render(ctx, items, layer);
}

function drawFront(ctx: Ctx, f: Frame, layer: LayerFn, hl: Highlight) {
  const p = f.pts;
  const T1 = f.seg.T1;
  const T2 = f.seg.T2;
  const r1 = frontOf(T1); // screen right across the pelvis
  const r2 = frontOf(T2);
  const u1 = up(T1);
  const u2 = up(T2);
  const fs = Math.max(0.35, Math.cos((f.pose.trunkD * Math.PI) / 180));
  const th = BODY.thorax * fs;
  const st: [Vec, number, Vec][] = [
    [add(p.pelvis, u1, -3), 14.2, r1],
    [add(p.pelvis, u1, 7), 14.8, r1],
    [add(p.mid, u1, -6), 14.6, r1],
    [add(p.mid, u2, th * 0.2), 17.2, r2],
    [add(p.mid, u2, th * 0.55), 20.2, r2],
    [add(p.neckBase, u2, -6 * fs), 22.4, r2],
    [add(p.neckBase, u2, -1), 15.6, r2],
    [add(p.neckBase, u2, 1.6), 6.4, r2],
  ];
  const torso = smooth([...st.map(([c, w, n]) => add(c, n, w)), ...st.map(([c, w, n]) => add(c, n, -w)).reverse()]);
  const front: Vec = [-0.6, 0.8];
  const L = SKIN_NEAR.line;
  const torsoPart: Part = {
    path: torso,
    rim: SKIN_NEAR.rim,
    draw: () => {
      paint(ctx, torso, add(p.mid, u2, 6), front, 20, SKIN_NEAR);
      const chestC = add(p.mid, u2, th * 0.62);
      for (const k of [1, -1]) {
        sheen(ctx, torso, add(chestC, r2, k * 7.5 - 2), r2, 6, 4, 0.14);
        glow(ctx, torso, add(chestC, r2, k * 7.5), r2, 8, 5.5, hl.chest ?? 0);
        glow(ctx, torso, add(add(p.mid, u2, th * 0.3), r2, k * 14), u2, 10, 4, hl.lats ?? 0);
        glow(ctx, torso, add(add(p.mid, u1, -4), r1, k * 11.5), u1, 9, 4, hl.obliques ?? 0);
        glow(ctx, torso, add(add(p.neckBase, u2, -1.5), r2, k * 7.5), r2, 6, 3, hl.traps ?? 0);
        // Pecs, the obliques' edge.
        accentW(ctx, [add(add(p.mid, u2, th * 0.82), r2, k * 1), add(add(p.mid, u2, th * 0.4), r2, k * 2), add(add(p.mid, u2, th * 0.36), r2, k * 10.5), add(add(p.mid, u2, th * 0.6), r2, k * 17)], L);
        accentW(ctx, [add(add(p.mid, u2, th * 0.2), r2, k * 8.2), add(add(p.mid, u1, -6), r1, k * 8), add(add(p.pelvis, u1, 6), r1, k * 6)], L * 0.8);
      }
      glow(ctx, torso, add(p.mid, u1, -3), u1, 13, 6, hl.abs ?? 0);
      // Linea alba and the six-pack's rows.
      accentW(ctx, [add(p.mid, u2, th * 0.38), add(p.pelvis, u1, 7)], L * 0.9);
      for (const y of [th * 0.16, -1, -9]) accentW(ctx, [add(add(p.mid, u2, y), r2, -7), add(add(p.mid, u2, y - 0.8), r2, 0), add(add(p.mid, u2, y), r2, 7)], L * 0.6);
    },
  };
  const shorts = smooth([add(add(p.pelvis, u1, 8), r1, 14.8), add(add(p.pelvis, u1, -2), r1, 16), add(add(p.pelvis, u1, -10), r1, 4), add(add(p.pelvis, u1, -10), r1, -4), add(add(p.pelvis, u1, -2), r1, -16), add(add(p.pelvis, u1, 8), r1, -14.8)]);
  const shortsPart: Part = {
    path: shorts,
    rim: CLOTH_NEAR.rim,
    draw: () => {
      paint(ctx, shorts, p.pelvis, front, 15, CLOTH_NEAR);
      accentW(ctx, [add(add(p.pelvis, u1, 7.6), r1, 14.4), add(add(p.pelvis, u1, 7.2), r1, 0), add(add(p.pelvis, u1, 7.6), r1, -14.4)], 0.5, 0.4);
    },
  };
  const ha = f.seg.head;
  const nb = add(p.neckBase, up(ha), -2);
  const nt = add(p.head, up(ha), -7);
  const neck = smooth([add(nb, r2, 8.4), add(nt, r2, 5.2), add(nt, r2, -5.2), add(nb, r2, -8.4)]);
  const W = headFrame(p.head, ha);
  const facePts: Vec[] = [[0, 11.4], [6.6, 9.4], [8.4, 3], [8.2, -2.4], [6.6, -7.4], [3, -10.6], [0, -11.2], [-3, -10.6], [-6.6, -7.4], [-8.2, -2.4], [-8.4, 3], [-6.6, 9.4]];
  const face = smooth(facePts.map(([x, y]) => W(x, y)));
  const hairF = smooth(([[0, 12.9], [7.4, 10.8], [9.0, 4.8], [7.4, 6.6], [3.6, 7.8], [0, 7.4], [-3.6, 7.8], [-7.4, 6.6], [-9.0, 4.8], [-7.4, 10.8]] as Vec[]).map(([x, y]) => W(x, y)));
  const headParts: Part[] = [
    {
      path: neck,
      rim: SKIN_NEAR.rim,
      draw: () => {
        paint(ctx, neck, mid(nb, nt), front, 6, SKIN_NEAR);
        glow(ctx, neck, mid(nb, nt), up(ha), 6, 4, hl.neck ?? 0);
      },
    },
    {
      path: face,
      rim: SKIN_NEAR.rim,
      draw: () => {
        paint(ctx, face, p.head, front, 10, SKIN_NEAR);
        ctx.save();
        ctx.translate(p.head[0], p.head[1]);
        ctx.rotate((-ha * Math.PI) / 180);
        ctx.fillStyle = "#0a0908";
        for (const k of [1, -1]) {
          ctx.beginPath();
          ctx.ellipse(k * 3.2, 1.6, 1.1, 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = "rgba(10,9,8,0.9)";
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        ctx.moveTo(-5.4, 3.4);
        ctx.quadraticCurveTo(-3.2, 4.2, -1.2, 3.4);
        ctx.moveTo(5.4, 3.4);
        ctx.quadraticCurveTo(3.2, 4.2, 1.2, 3.4);
        ctx.moveTo(-2.2, -5.4);
        ctx.quadraticCurveTo(0, -6.0, 2.2, -5.4);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${GOLD},${L * 0.7})`;
        ctx.lineWidth = 0.28;
        ctx.beginPath();
        ctx.moveTo(0, 1.2);
        ctx.lineTo(0.6, -2.6);
        ctx.stroke();
        ctx.restore();
      },
    },
    {
      path: hairF,
      rim: SKIN_NEAR.rim * 0.7,
      draw: () => {
        ctx.fillStyle = HAIR;
        ctx.fill(hairF);
      },
    },
  ];
  const items: Item[] = [
    { layer: "far" },
    ...(["L", "R"] as const).flatMap((s) => legParts(ctx, p[`hip${s}`], p[`knee${s}`], p[`ankle${s}`], 0, SKIN_NEAR, CLOTH_NEAR, hl, 1, s === "R", true)),
    { layer: "mid" },
    torsoPart,
    shortsPart,
    ...headParts,
    { layer: "near" },
    ...(["L", "R"] as const).flatMap((s) => armParts(ctx, p[`shoulder${s}`], p[`elbow${s}`], p[`hand${s}`], SKIN_NEAR, hl, 1, s === "R")),
  ];
  render(ctx, items, layer);
}

/** Draw the athlete for one frame; `layer` draws the equipment that sits at each depth. */
export function drawAthlete(ctx: Ctx, f: Frame, layer: LayerFn, hl: Highlight = {}) {
  if (f.view === "side") drawSide(ctx, f, layer, hl);
  else drawFront(ctx, f, layer, hl);
}
