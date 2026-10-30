/**
 * The "athlete" look for the 2D demonstrations: a muscular human figure in the style of the owner's approved
 * black-and-gold reference (assets/exercise-demos-src/_character/character-reference.png). Graphite skin under one key
 * light from the front and above, a gold rim light from behind, black shorts with a gold side stripe, black trainers, and
 * the muscles each exercise trains glowing amber.
 *
 * Built so that nothing can flicker from frame to frame:
 *  - Lighting is a continuous function of each limb's direction against a fixed light (no "which side is lit" switch:
 *    such a switch flipped a limb from light to dark in one frame whenever it turned past the light).
 *  - A limb (shoulder to fist, hip to ankle) is one silhouette filled with one flat base colour; its shading is soft light
 *    and shadow painted inside that silhouette, so knees, elbows and the wrist have no seams or edges that sweep across
 *    the body as the joints bend.
 *  - The gold rim light is the whole body's silhouette, drawn once behind it.
 *  - The muscle glow has a fixed strength per exercise.
 * It draws the same skeleton (frame.pts / frame.seg) as the classic figure, so every exercise keeps its movement. No
 * images: a handful of paths and gradients per body part, light enough to animate at 60 fps on a phone.
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
  /** Flat base colour of the material. */
  base: string;
  /** Strength of the key light's soft highlight and of the form shadow. */
  hi: number;
  lo: number;
  /** Strength of the gold rim light along this part's outer edge. */
  rim: number;
  /** Strength of the few gold anatomical lines. */
  line: number;
}
const SKIN_NEAR: Tone = { base: "#2b2826", hi: 0.2, lo: 0.6, rim: 0.95, line: 0.24 };
const SKIN_FAR: Tone = { base: "#1d1b1a", hi: 0.08, lo: 0.5, rim: 0.42, line: 0.08 };
const CLOTH_NEAR: Tone = { base: "#121213", hi: 0.09, lo: 0.5, rim: 0.6, line: 0 };
const CLOTH_FAR: Tone = { base: "#0c0c0d", hi: 0.04, lo: 0.45, rim: 0.28, line: 0 };
const SHOE: Tone = { base: "#151516", hi: 0.14, lo: 0.5, rim: 0.55, line: 0 };
const HAIR: Tone = { base: "#100f0e", hi: 0.1, lo: 0.4, rim: 0.6, line: 0 };
const GOLD = "226,184,96";
const WARM = "255,242,224";

/** The key light (from the front and above, in world space; mirrored scenes mirror it with the canvas). */
const LIGHT: Vec = [0.55, 0.835];
/** Where the rim light pushes the body's gold outline (toward the back, slightly up). */
const RIM_SHIFT: Vec = [-0.75, 0.22];

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
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** How much a surface facing `n` faces the key light, -1..1. Continuous in `n`: no switch, so no flicker. */
const facing = (n: Vec) => clamp(dot(n, LIGHT), -1, 1);

/** A smooth closed outline through the points (each point is a control point; the curve runs through the midpoints). */
function smoothInto(p: Path2D, pts: Vec[]) {
  const n = pts.length;
  const m0 = mid(pts[n - 1]!, pts[0]!);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const c = pts[i]!;
    const m = mid(c, pts[(i + 1) % n]!);
    p.quadraticCurveTo(c[0], c[1], m[0], m[1]);
  }
  p.closePath();
}
function smooth(pts: Vec[]): Path2D {
  const p = new Path2D();
  smoothInto(p, pts);
  return p;
}
/** One silhouette from several outlines (filled with the nonzero rule, overlaps merge). */
function union(...outlines: (Vec[] | Path2D)[]): Path2D {
  const p = new Path2D();
  for (const o of outlines) {
    if (o instanceof Path2D) p.addPath(o);
    else smoothInto(p, o);
  }
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
 * A body group: one silhouette with one material. Painted as a flat base colour, then soft light and shadow and the
 * muscle glow inside the silhouette (clipped), so the parts that make it up never show a seam.
 */
interface Group {
  path: Path2D;
  tone: Tone;
  /** A soft dark edge just outside the silhouette, separating a near limb from what is behind it. */
  halo?: number;
  /** No halo within this circle (where the limb joins the body, e.g. over the shoulder). */
  haloSkip?: [Vec, number];
  shade: () => void;
}
type Item = Group | { layer: string };

/** An elliptical radial fill (along `axis`) at `c`. Call inside a clip. */
function blob(ctx: Ctx, c: Vec, axis: Vec, rx: number, ry: number, rgb: string, a: number) {
  if (a <= 0.003 || rx <= 0 || ry <= 0) return;
  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.rotate(Math.atan2(axis[1], axis[0]));
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.55, `rgba(${rgb},${a * 0.45})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Form shading for one segment of a limb: a soft key-light highlight on the side facing the light and a soft shadow on
 * the side away from it. Both slide smoothly across the limb as it turns (they meet in the middle, and fade, when the
 * light runs along the limb), so the shading changes continuously from frame to frame.
 */
function form(ctx: Ctx, s: Seg, w: number, tone: Tone, t0 = 0, t1 = 1) {
  const f = facing(s.n);
  const k = Math.abs(f);
  const tm = (t0 + t1) / 2;
  const len = s.L * (t1 - t0);
  blob(ctx, at(s, tm, -f * w * 1.05), s.d, len * 0.62 + w * 0.6, w * 1.05, "0,0,0", tone.lo * (0.35 + 0.65 * k));
  blob(ctx, at(s, tm, f * w * 0.42), s.d, len * 0.52 + w * 0.3, w * 0.55, WARM, tone.hi * (0.45 + 0.55 * k));
}

/** A muscle belly catching the light: brighter the more its side of the limb faces the light (continuous). */
function belly(ctx: Ctx, s: Seg, t: number, off: number, rx: number, ry: number, tone: Tone, side: number) {
  const lightness = clamp(0.5 + 0.5 * side * facing(s.n), 0, 1);
  blob(ctx, at(s, t, off), s.d, rx, ry, WARM, tone.hi * 0.85 * lightness);
}

/** A groove between two muscles: a faint, soft dark line. */
function groove(ctx: Ctx, s: Seg, t: number, off: number, rx: number, ry: number, a: number) {
  blob(ctx, at(s, t, off), s.d, rx, ry, "0,0,0", a);
}

/** A working muscle: an amber glow of fixed strength. */
function glow(ctx: Ctx, c: Vec, axis: Vec, rx: number, ry: number, k: number) {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.rotate(Math.atan2(axis[1], axis[0]));
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(255,198,92,${0.82 * k})`);
  g.addColorStop(0.4, `rgba(226,166,64,${0.55 * k})`);
  g.addColorStop(0.78, `rgba(190,130,40,${0.2 * k})`);
  g.addColorStop(1, "rgba(190,130,40,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A thin gold anatomical line (few of them, faint, fixed strength). Points in world coordinates. */
function lineW(ctx: Ctx, ps: Vec[], alpha: number, w = 0.3) {
  if (alpha <= 0 || ps.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(ps[0]![0], ps[0]![1]);
  if (ps.length === 2) ctx.lineTo(ps[1]![0], ps[1]![1]);
  for (let i = 1; i < ps.length - 1; i++) {
    const m = i === ps.length - 2 ? ps[i + 1]! : mid(ps[i]!, ps[i + 1]!);
    ctx.quadraticCurveTo(ps[i]![0], ps[i]![1], m[0], m[1]);
  }
  ctx.strokeStyle = `rgba(${GOLD},${alpha})`;
  ctx.lineWidth = w;
  ctx.stroke();
}
function line(ctx: Ctx, s: Seg, pts: [number, number][], alpha: number, w = 0.3) {
  lineW(ctx, pts.map(([t, o]) => at(s, t, o)), alpha, w);
}

/** Paint the items: the whole body's rim light first (its silhouette nudged toward the back light), then each group. */
function render(ctx: Ctx, items: Item[], layer: LayerFn) {
  const groups = items.filter((i): i is Group => "path" in i);
  for (const [k, a] of [[2.1, 0.26], [1, 0.95]] as const) {
    ctx.save();
    ctx.translate(RIM_SHIFT[0] * k, RIM_SHIFT[1] * k);
    for (const g of groups) {
      if (g.tone.rim <= 0) continue;
      ctx.fillStyle = `rgba(${GOLD},${a * g.tone.rim})`;
      ctx.fill(g.path);
    }
    ctx.restore();
  }
  for (const i of items) {
    if (!("path" in i)) {
      layer(i.layer);
      continue;
    }
    if (i.halo) {
      // Stroked first and then covered by the fill, so only the outer half shows: a soft dark edge (three widths, fading
      // outward) around the silhouette, left off where the limb joins the body.
      ctx.save();
      if (i.haloSkip) {
        const [c, r] = i.haloSkip;
        const clip = new Path2D();
        clip.rect(c[0] - 1e4, c[1] - 1e4, 2e4, 2e4);
        clip.arc(c[0], c[1], r, 0, Math.PI * 2);
        ctx.clip(clip, "evenodd");
      }
      for (const [w, a] of [[4.2, 0.22], [2.6, 0.32], [1.3, 0.46]] as const) {
        ctx.strokeStyle = `rgba(0,0,0,${i.halo * a})`;
        ctx.lineWidth = w;
        ctx.stroke(i.path);
      }
      ctx.restore();
    }
    ctx.fillStyle = i.tone.base;
    ctx.fill(i.path);
    ctx.save();
    ctx.clip(i.path);
    i.shade();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------------------------------- Limbs

/** Side-view profiles (cm). Front = toward the front of the body for a limb hanging down. */
const UPPER_ARM: Profile = [
  [-0.02, 6.2, 6.4],
  [0.1, 7.3, 7.0],
  [0.22, 6.9, 6.8],
  [0.38, 5.8, 6.3],
  [0.56, 6.1, 6.5],
  [0.76, 5.1, 5.3],
  [0.92, 4.0, 4.2],
  [1, 3.6, 3.8],
];
const FOREARM: Profile = [
  [0, 3.8, 3.9],
  [0.14, 4.8, 4.3],
  [0.36, 4.2, 3.6],
  [0.6, 3.1, 2.8],
  [0.8, 2.45, 2.35],
];
const THIGH: Profile = [
  [0, 9.6, 10.6],
  [0.22, 10.4, 10.0],
  [0.5, 10.0, 8.8],
  [0.74, 8.6, 6.9],
  [0.9, 6.3, 5.4],
  [1, 5.0, 4.8],
];
const SHIN: Profile = [
  [0, 4.8, 4.9],
  [0.1, 4.5, 7.2],
  [0.28, 4.2, 8.1],
  [0.46, 3.7, 6.2],
  [0.66, 3.1, 3.8],
  [0.82, 2.6, 2.8],
  [0.95, 2.4, 2.5],
];

/** Shoulder to fist as one silhouette: deltoid, upper arm, forearm and the closed hand. */
function armGroup(ctx: Ctx, sh: Vec, el: Vec, hd: Vec, tone: Tone, hl: Highlight, k: number, halo: number, flipFront = false): Group {
  const upper = seg(sh, el);
  const fore = seg(el, hd);
  const sgn = flipFront ? -1 : 1;
  const prof = (p: Profile): Profile => (flipFront ? p.map(([t, f, b]) => [t, b, f]) : p);
  // The biceps rounds up as the elbow bends (continuous in the elbow angle).
  const flex = clamp(1 - (dot(upper.d, fore.d) + 1) / 1.6, 0, 1);
  const ua = prof(UPPER_ARM.map(([t, f, b]) => [t, t > 0.36 && t < 0.86 ? f + flex * 1.2 * Math.sin(((t - 0.36) / 0.5) * Math.PI) : f, b] as [number, number, number]));
  // The fist: palm and curled fingers around the grip point, knuckles beyond it.
  const g = fore.b;
  const fn: Vec = [fore.n[0] * sgn, fore.n[1] * sgn];
  const P = (x: number, y: number): Vec => [g[0] + fore.d[0] * x + fn[0] * y, g[1] + fore.d[1] * x + fn[1] * y];
  const fist = [P(-7.4, 2.5), P(-3.4, 3.9), P(0.6, 4.3), P(3.8, 3.5), P(4.9, 1.0), P(4.7, -1.8), P(2.4, -3.5), P(-2.6, -3.3), P(-7.4, -2.4)];
  const path = union(limbOutline(fore, prof(FOREARM), 3.2, 1.4), fist, limbOutline(upper, ua, 5.4, 3.0));
  return {
    path,
    tone,
    halo,
    haloSkip: [sh, 9],
    shade: () => {
      form(ctx, fore, 4.2, tone);
      form(ctx, upper, 6.4, tone);
      // Deltoid cap, biceps and triceps bellies, the groove between them; forearm muscles; knuckles.
      belly(ctx, upper, 0.04, 0, 6.2, 5.6, tone, 1);
      belly(ctx, upper, 0.58, 3 * sgn, 8, 3.4 + flex, tone, sgn);
      belly(ctx, upper, 0.46, -3.2 * sgn, 9, 3.6, tone, -sgn);
      groove(ctx, upper, 0.62, 0.4 * sgn, 10, 1.3, tone.lo * 0.4);
      groove(ctx, upper, 0.3, 0, 6, 1.6, tone.lo * 0.35);
      belly(ctx, fore, 0.22, 1.8 * sgn, 7, 2.6, tone, sgn);
      belly(ctx, fore, 0.3, -1.4 * sgn, 7, 2.3, tone, -sgn);
      blob(ctx, P(3.4, -1.6), fore.d, 2.6, 2, WARM, tone.hi * 0.6);
      glow(ctx, at(upper, 0.56, 2.4 * sgn), upper.d, 9.5, 3.8 + flex, k * (hl.biceps ?? 0));
      glow(ctx, at(upper, 0.5, -2.6 * sgn), upper.d, 10.5, 3.9, k * (hl.triceps ?? 0));
      glow(ctx, at(upper, 0.02, 2.8 * sgn), upper.d, 6.5, 4.6, k * (hl.frontDelts ?? 0));
      glow(ctx, at(upper, 0.04, 0), upper.d, 7.2, 5.6, k * (hl.sideDelts ?? 0));
      glow(ctx, at(upper, 0.02, -3 * sgn), upper.d, 6.5, 4.6, k * (hl.rearDelts ?? 0));
      glow(ctx, at(fore, 0.28, 0.6 * sgn), fore.d, 9, 3.8, k * (hl.forearms ?? 0));
      line(ctx, upper, [[0.12, 6.4 * sgn], [0.3, 3.8 * sgn], [0.36, 0.4 * sgn]], tone.line);
      lineW(ctx, [P(0.9, 4.1), P(3.6, 2.8), P(4.4, 0.4)], tone.line * 0.8, 0.24);
    },
  };
}

/** Hip to ankle as one silhouette (thigh, knee, shin); the shoe and the shorts' sleeve are their own groups. */
function legParts(ctx: Ctx, hip: Vec, knee: Vec, ankle: Vec, footRot: number, skinT: Tone, clothT: Tone, hl: Highlight, k: number, halo: number, flipFront = false, front = false) {
  const thigh = seg(hip, knee);
  const shin = seg(knee, ankle);
  const sgn = flipFront ? -1 : 1;
  const prof = (p: Profile): Profile => (flipFront ? p.map(([t, f, b]) => [t, b, f]) : p);
  const skin: Group = {
    path: union(limbOutline(shin, prof(SHIN), 3.6, 2), limbOutline(thigh, prof(THIGH), 8, 3.4)),
    tone: skinT,
    halo,
    shade: () => {
      form(ctx, thigh, 9.6, skinT);
      form(ctx, shin, 5.6, skinT);
      // Quads (with the teardrop above the knee), hamstrings and the groove between; calf and shin.
      belly(ctx, thigh, 0.56, 4.6 * sgn, 15, 4.6, skinT, sgn);
      belly(ctx, thigh, 0.84, 3.4 * sgn, 5, 3.2, skinT, sgn);
      belly(ctx, thigh, 0.56, -4.2 * sgn, 14, 4, skinT, -sgn);
      groove(ctx, thigh, 0.58, 0, 17, 1.4, skinT.lo * 0.35);
      belly(ctx, shin, 0.27, -4.8 * sgn, 9, 3.6, skinT, -sgn);
      belly(ctx, shin, 0.42, 2.2 * sgn, 11, 1.8, skinT, sgn);
      blob(ctx, knee, thigh.d, 4.6, 4.2, WARM, skinT.hi * 0.35);
      glow(ctx, at(thigh, 0.6, 3.8 * sgn), thigh.d, 19, 5.8, k * (hl.quads ?? 0));
      glow(ctx, at(thigh, 0.58, -3.6 * sgn), thigh.d, 18, 5.2, k * (hl.hamstrings ?? 0));
      glow(ctx, at(thigh, 0.32, front ? -4 * sgn : 0), thigh.d, 12, 4, k * (hl.adductors ?? 0) * 0.8);
      glow(ctx, at(shin, 0.3, -3.6 * sgn), shin.d, 12, 4.6, k * (hl.calves ?? 0));
      glow(ctx, at(shin, 0.4, 2.2 * sgn), shin.d, 12, 2.4, k * (hl.shins ?? 0));
      line(ctx, thigh, [[0.5, 6.6 * sgn], [0.72, 5.4 * sgn], [0.9, 2.8 * sgn]], skinT.line);
      line(ctx, shin, [[0.1, -3.4 * sgn], [0.3, -4.4 * sgn], [0.52, -2 * sgn]], skinT.line * 0.8);
    },
  };
  // The shorts' leg: a sleeve over the top of the thigh ending in a hem, with the gold side stripe.
  const sleeveProf: Profile = prof([
    [-0.05, 10.2, 11.6],
    [0.15, 11.0, 11.0],
    [0.3, 10.8, 10.3],
    [0.4, 10.5, 9.8],
  ]);
  const so = limbOutline(thigh, sleeveProf, 9, 0, 0.5);
  const hemF = (flipFront ? 9.9 : 10.3) * sgn;
  const hemB = -(flipFront ? 10.3 : 9.9) * sgn;
  const sleevePts = [...so.slice(0, 4), at(thigh, 0.42, hemF), at(thigh, 0.42, hemB), ...so.slice(5)];
  const sleeveShade = () => {
    form(ctx, thigh, 10.5, clothT, -0.05, 0.42);
    glow(ctx, at(thigh, 0.3, 4 * sgn), thigh.d, 12, 5, k * (hl.quads ?? 0) * 0.3);
    lineW(ctx, [at(thigh, -0.02, front ? 9 * sgn : 0.8), at(thigh, 0.41, front ? 9.6 * sgn : 0.6)], clothT === CLOTH_NEAR ? 0.7 : 0.3, 0.5);
    lineW(ctx, [at(thigh, 0.415, hemF * 0.97), at(thigh, 0.415, hemB * 0.97)], clothT === CLOTH_NEAR ? 0.22 : 0.1, 0.35);
  };
  const shoe = front ? shoeFront(ctx, ankle, shin) : shoeSide(ctx, ankle, footRot);
  return { skin, shoe, sleevePts, sleeveShade };
}

function shoeSide(ctx: Ctx, ankle: Vec, rot: number): Group {
  const r = (rot * Math.PI) / 180;
  const f: Vec = [Math.cos(r), Math.sin(r)];
  const u: Vec = [-f[1], f[0]];
  const P = (fw: number, uh: number): Vec => [ankle[0] + f[0] * fw + u[0] * uh, ankle[1] + f[1] * fw + u[1] * uh];
  const H = BODY.ankleH;
  const B = BODY.footBack;
  const F = BODY.footFront + BODY.toeExtra;
  const upper = [P(-B - 1.6, -H + 2.2), P(-B - 1.4, 2.4), P(-2, 4.4), P(3.5, 2.4), P(8, -1.0), P(F - 3, -H + 5.4), P(F + 0.6, -H + 3.2), P(F + 0.9, -H + 0.6), P(-B - 1.2, -H + 0.6)];
  const sole = [P(-B - 1.8, -H + 2.0), P(F + 0.8, -H + 1.9), P(F + 1, -H - 0.3), P(-B - 1.6, -H - 0.5)];
  const path = union(upper, sole);
  return {
    path,
    tone: SHOE,
    shade: () => {
      const s = seg(P(-B, -H / 2), P(F, -H / 2));
      form(ctx, s, 4.5, SHOE);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill(smooth(sole));
      lineW(ctx, [P(-B - 1.5, -H + 1.4), P(F + 0.6, -H + 1.2)], 0.85, 0.45);
      lineW(ctx, [P(1.5, 2.8), P(8.5, -0.8)], 0.18, 0.3);
    },
  };
}

function shoeFront(ctx: Ctx, ankle: Vec, shin: Seg): Group {
  const c: Vec = [ankle[0] + shin.d[0] * 3, ankle[1] + shin.d[1] * 3 - 1.5];
  const path = new Path2D();
  path.ellipse(c[0], c[1] - 1.5, 5.6, 4.4, 0, 0, Math.PI * 2);
  return {
    path,
    tone: SHOE,
    shade: () => {
      blob(ctx, [c[0] + 1.5, c[1] + 1], [1, 0], 4, 3, WARM, SHOE.hi);
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(c[0] - 5.8, c[1] - 6.4, 11.6, 1.7);
      ctx.fillStyle = `rgba(${GOLD},0.75)`;
      ctx.fillRect(c[0] - 5.6, c[1] - 5, 11.2, 0.4);
    },
  };
}

// ---------------------------------------------------------------------------------------------------- Head

/** Head points in its own frame (face toward +x, y up, centre at the origin), mapped to the world. */
function headFrame(head: Vec, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (x: number, y: number): Vec => [head[0] + x * c + y * s, head[1] - x * s + y * c];
}

/** Profile of the head, facing +x: brow, nose, lips, chin, jaw, nape, crown. */
const PROFILE: Vec[] = [
  [0.2, 11.6],
  [4.8, 10.6],
  [7.6, 7.8],
  [8.7, 4.4],
  [8.5, 3.0],
  [8.4, 2.0],
  [9.4, 0.4],
  [10.5, -1.6],
  [9.2, -2.6],
  [9.3, -3.6],
  [8.8, -4.5],
  [9.0, -5.3],
  [8.4, -6.5],
  [8.6, -8.0],
  [7.4, -9.9],
  [4.4, -10.0],
  [1.4, -8.6],
  [-0.4, -6.4],
  [-3.4, -4.6],
  [-7.2, -2.0],
  [-8.9, 2.0],
  [-8.4, 6.8],
  [-5.4, 10.4],
];
/** Short hair: fuller on top with a lifted front, tapered at the temple, faded at the nape, a sideburn in front of the ear. */
const HAIR_SIDE: Vec[] = [
  [5.4, 8.6],
  [7.2, 9.9],
  [6.4, 12.1],
  [2.6, 13.4],
  [-2.8, 13.2],
  [-7.3, 11.0],
  [-9.5, 5.8],
  [-9.3, 1.8],
  [-7.6, -1.0],
  [-5.6, 0.4],
  [-3.4, 1.2],
  [-1.2, 2.4],
  [0.6, 0.8],
  [1.5, -0.8],
  [2.4, 1.8],
  [3.8, 6.2],
];

function headSideGroups(ctx: Ctx, f: Frame, hl: Highlight): Group[] {
  const { head } = f.pts;
  const a = f.seg.head;
  const fa = frontOf(a);
  const W = headFrame(head, a);
  const skull = smooth(PROFILE.map(([x, y]) => W(x, y)));
  const hair = smooth(HAIR_SIDE.map(([x, y]) => W(x, y)));
  const tone = SKIN_NEAR;
  void hl;
  return [
    {
      path: skull,
      tone,
      shade: () => {
        const fs = facing(fa);
        blob(ctx, W(-4, -1), fa, 9, 10, "0,0,0", tone.lo * (0.5 + 0.3 * fs));
        blob(ctx, W(5.4, 4.6), fa, 4.6, 3.6, WARM, tone.hi * 0.9);
        blob(ctx, W(5.6, -2.4), fa, 3.4, 3, WARM, tone.hi * 0.55);
        // Eye socket, under the cheekbone, under the jaw; the jaw's light edge.
        blob(ctx, W(6.6, 1.8), fa, 2.3, 1.6, "0,0,0", 0.45);
        blob(ctx, W(4, -3.6), fa, 4, 2.2, "0,0,0", 0.18);
        blob(ctx, W(3.6, -10), fa, 6, 3, "0,0,0", 0.4);
        ctx.save();
        ctx.translate(head[0], head[1]);
        ctx.rotate((-a * Math.PI) / 180);
        // Ear: rim and inner fold.
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(-1.6, -0.4, 2.0, 3.2, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${WARM},0.14)`;
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.arc(-1.5, -0.3, 1.5, -1.3, 2.0);
        ctx.stroke();
        // Eye, brow, nostril, mouth.
        ctx.fillStyle = "#070606";
        ctx.beginPath();
        ctx.ellipse(7.3, 1.7, 0.85, 0.36, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(8,7,6,0.9)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(5.4, 3.4);
        ctx.quadraticCurveTo(7.1, 4.0, 8.5, 3.5);
        ctx.stroke();
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(8.7, -2.4);
        ctx.quadraticCurveTo(9.4, -2.1, 9.6, -2.6);
        ctx.moveTo(8.7, -4.5);
        ctx.lineTo(9.2, -4.55);
        ctx.stroke();
        ctx.restore();
      },
    },
    {
      path: hair,
      tone: HAIR,
      shade: () => {
        blob(ctx, W(3, 11.4), fa, 5.5, 2.2, WARM, 0.1);
        ctx.save();
        ctx.translate(head[0], head[1]);
        ctx.rotate((-a * Math.PI) / 180);
        ctx.strokeStyle = "rgba(160,148,130,0.16)";
        ctx.lineWidth = 0.22;
        ctx.beginPath();
        for (const [x0, y0, x1, y1] of [[6.6, 10.6, 0.6, 12.8], [5.6, 9.6, -2.6, 12.4], [3.6, 8.4, -5.6, 11], [1.6, 6.4, -7.6, 7.8]] as const) {
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
    [add(pelvis, u1, 8), 10.3, 9.4, f1],
    [add(pelvis, u1, 15), 10.6, 8.4, f1],
    [m, 11.2, 9.6, fm],
    [add(m, u2, BODY.thorax * 0.22), 12.6, 12.0, f2],
    [add(m, u2, BODY.thorax * 0.45), 15.2, 13.4, f2],
    [add(m, u2, BODY.thorax * 0.66), 15.6, 12.8, f2],
    [add(m, u2, BODY.thorax * 0.86), 12.8, 11.8, f2],
    [add(neckBase, u2, 1.5), 7.6, 10.6, f2],
  ];
}

/** Torso and neck as one silhouette (the neck flows into the trapezius and the chest). */
function torsoSideGroup(ctx: Ctx, f: Frame, hl: Highlight): Group {
  const st = torsoStationsSide(f);
  const torso = [...st.map(([c, fo, , n]) => add(c, n, fo)), ...st.map(([c, , bo, n]) => add(c, n, -bo)).reverse()];
  const { mid: m, pelvis, neckBase, head } = f.pts;
  const a = f.seg.head;
  const fa = frontOf(a);
  const fT2 = frontOf(f.seg.T2);
  const base = add(neckBase, up(a), -2);
  const top = add(head, up(a), -7.6);
  const nm = mid(base, top);
  const neck = [add(base, fT2, 6.2), add(nm, fa, 5.3), add(top, fa, 5.4), add(top, fa, -3.4), add(nm, fa, -5.8), add(base, fT2, -10)];
  const f1 = frontOf(f.seg.T1);
  const f2 = fT2;
  const u1 = up(f.seg.T1);
  const u2 = up(f.seg.T2);
  const th = BODY.thorax;
  const tone = SKIN_NEAR;
  const spineLow = seg(pelvis, m);
  const spineHigh = seg(m, neckBase);
  return {
    path: union(torso, neck),
    tone,
    shade: () => {
      // Form: the chest and belly face the light, the back turns away.
      form(ctx, { ...spineLow, n: f1 }, 10.5, tone);
      form(ctx, { ...spineHigh, n: f2 }, 13.5, tone);
      form(ctx, seg(base, top), 5.5, tone);
      // Pec, the abdominal wall, the lat's sweep, the upper back, the erectors.
      blob(ctx, add(add(m, u2, th * 0.6), f2, 10.5), u2, 7, 4.6, WARM, tone.hi * 0.85 * clamp(0.5 + 0.5 * facing(f2), 0, 1));
      blob(ctx, add(add(m, u2, th * 0.38), f2, 11), u2, 5.5, 1.6, "0,0,0", 0.3);
      blob(ctx, add(add(m, u1, -2), f1, 8.4), u1, 10, 2.4, WARM, tone.hi * 0.6 * clamp(0.5 + 0.5 * facing(f1), 0, 1));
      blob(ctx, add(add(m, u2, th * 0.4), f2, -8), u2, 11, 3.4, WARM, tone.hi * 0.45 * clamp(0.5 - 0.5 * facing(f2), 0, 1));
      blob(ctx, add(add(m, u2, th * 0.72), f2, -9), u2, 7, 3.6, WARM, tone.hi * 0.5 * clamp(0.5 - 0.5 * facing(f2), 0, 1));
      blob(ctx, add(add(m, u2, th * 0.28), f2, 2), u2, 9, 2.4, "0,0,0", 0.22);
      glow(ctx, add(add(m, u2, th * 0.6), f2, 8.5), u2, 7.5, 5.5, hl.chest ?? 0);
      glow(ctx, add(add(m, u1, -2), f1, 7.2), u1, 13, 3.6, hl.abs ?? 0);
      glow(ctx, add(add(m, u1, -1), f1, 1.5), u1, 11, 5.5, hl.obliques ?? 0);
      glow(ctx, add(add(m, u2, th * 0.42), f2, -5.5), u2, 13, 5.2, hl.lats ?? 0);
      glow(ctx, add(add(m, u2, th * 0.74), f2, -7.2), u2, 9, 5, hl.upperBack ?? 0);
      glow(ctx, add(add(neckBase, u2, -2), f2, -6), u2, 6, 4.5, hl.traps ?? 0);
      glow(ctx, add(add(m, u1, -6), f1, -6.4), u1, 11, 3.6, hl.lowerBack ?? 0);
      glow(ctx, nm, seg(base, top).d, 7, 4, hl.neck ?? 0);
      const L = tone.line;
      lineW(ctx, [add(add(m, u2, th * 0.44), f2, 14.8), add(add(m, u2, th * 0.37), f2, 9.6), add(add(m, u2, th * 0.55), f2, 3.4)], L);
      lineW(ctx, [add(add(m, u2, th * 0.66), f2, -3), add(add(m, u2, th * 0.34), f2, -8.4), add(add(pelvis, u1, 17), f1, -6.6)], L * 0.6);
      lineW(ctx, [W2(top, fa, 1.2), add(nm, fa, 2.2), add(base, fT2, 3.6)], L * 0.6);
    },
  };
}
function W2(p: Vec, n: Vec, k: number): Vec {
  return add(p, n, k);
}

/** The shorts: the seat (waistband to the gluteal fold, turning with the pelvis) and the near leg's sleeve. */
function shortsSideGroup(ctx: Ctx, f: Frame, hl: Highlight, sleevePts: Vec[], sleeveShade: () => void): Group {
  const { pelvis } = f.pts;
  const f1 = frontOf(f.seg.T1);
  const u1 = up(f.seg.T1);
  const P = (fw: number, uh: number): Vec => add(add(pelvis, f1, fw), u1, uh);
  const seat = [P(10.9, 9.6), P(11.6, 3), P(10.8, -4.5), P(3.4, -10.6), P(-4.6, -11.2), P(-12, -6.6), P(-13.4, 1), P(-11, 8.8), P(0, 9.9)];
  const tone = CLOTH_NEAR;
  return {
    path: union(seat, sleevePts),
    tone,
    halo: 0.25,
    shade: () => {
      form(ctx, { ...seg(P(0, -8), P(0, 9)), n: f1 }, 12, tone);
      blob(ctx, P(-8, -2), u1, 6, 6, WARM, tone.hi * clamp(0.5 - 0.5 * facing(f1), 0, 1));
      glow(ctx, P(-6.4, -1), u1, 8.5, 7, (hl.glutes ?? 0) * 0.65);
      glow(ctx, P(6.5, -2), u1, 6, 5, (hl.hipFlexors ?? 0) * 0.45);
      sleeveShade();
      // Waistband with a gold edge.
      lineW(ctx, [P(10.7, 8.8), P(0, 8.2), P(-10.6, 8.0)], 0.5, 0.45);
      lineW(ctx, [P(10.9, 6.8), P(0, 6.6), P(-10.8, 6.0)], 0.1, 0.6);
    },
  };
}

// ---------------------------------------------------------------------------------------------------- Views

function drawSide(ctx: Ctx, f: Frame, layer: LayerFn, hl: Highlight) {
  const p = f.pts;
  const far = legParts(ctx, p.pelvis, p.kneeL, p.ankleL, f.seg.footL, SKIN_FAR, CLOTH_FAR, hl, 0.5, 0);
  const near = legParts(ctx, p.pelvis, p.kneeR, p.ankleR, f.seg.footR, SKIN_NEAR, CLOTH_NEAR, hl, 1, 0.32);
  const farSleeve: Group = { path: smooth(far.sleevePts), tone: CLOTH_FAR, shade: far.sleeveShade };
  const items: Item[] = [
    // Far side: darker, its glow softer.
    far.skin,
    far.shoe,
    farSleeve,
    armGroup(ctx, p.shoulder, p.elbowL, p.handL, SKIN_FAR, hl, 0.5, 0),
    { layer: "far" },
    { layer: "mid" },
    torsoSideGroup(ctx, f, hl),
    ...headSideGroups(ctx, f, hl),
    near.skin,
    near.shoe,
    shortsSideGroup(ctx, f, hl, near.sleevePts, near.sleeveShade),
    { layer: "near" },
    armGroup(ctx, p.shoulder, p.elbowR, p.handR, SKIN_NEAR, hl, 1, 0.38),
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
    [add(p.mid, u1, -6), 14.4, r1],
    [add(p.mid, u2, th * 0.2), 17.0, r2],
    [add(p.mid, u2, th * 0.55), 20.0, r2],
    [add(p.neckBase, u2, -6 * fs), 22.2, r2],
    [add(p.neckBase, u2, -1), 15.4, r2],
    [add(p.neckBase, u2, 1.6), 6.6, r2],
  ];
  const ha = f.seg.head;
  const nb = add(p.neckBase, up(ha), -2);
  const nt = add(p.head, up(ha), -7);
  const torsoPts = [...st.map(([c, w, n]) => add(c, n, w)), ...st.map(([c, w, n]) => add(c, n, -w)).reverse()];
  const neckPts = [add(nb, r2, 8.6), add(nt, r2, 5.2), add(nt, r2, -5.2), add(nb, r2, -8.6)];
  const L = SKIN_NEAR.line;
  const tone = SKIN_NEAR;
  const torso: Group = {
    path: union(torsoPts, neckPts),
    tone,
    shade: () => {
      // Light from the upper right: the left side of the torso (screen) falls into shadow, smoothly.
      blob(ctx, add(add(p.mid, u2, th * 0.3), r2, -12), u2, 20, 12, "0,0,0", tone.lo * 0.7);
      blob(ctx, add(add(p.mid, u2, th * 0.4), r2, 8), u2, 16, 10, WARM, tone.hi * 0.6);
      const chestC = add(p.mid, u2, th * 0.62);
      for (const k of [1, -1]) {
        blob(ctx, add(chestC, r2, k * 7.5 + 1.5), r2, 6.5, 4.2, WARM, tone.hi * (k > 0 ? 0.9 : 0.45));
        blob(ctx, add(add(p.mid, u2, th * 0.38), r2, k * 7.5), r2, 7, 1.6, "0,0,0", 0.3);
        glow(ctx, add(chestC, r2, k * 7.5), r2, 8, 5.5, hl.chest ?? 0);
        glow(ctx, add(add(p.mid, u2, th * 0.3), r2, k * 14), u2, 10, 4, hl.lats ?? 0);
        glow(ctx, add(add(p.mid, u1, -4), r1, k * 11.5), u1, 9, 4, hl.obliques ?? 0);
        glow(ctx, add(add(p.neckBase, u2, -1.5), r2, k * 7.5), r2, 6, 3, hl.traps ?? 0);
        lineW(ctx, [add(add(p.mid, u2, th * 0.4), r2, k * 2), add(add(p.mid, u2, th * 0.36), r2, k * 10.5), add(add(p.mid, u2, th * 0.6), r2, k * 17)], L);
      }
      // The six-pack: soft light on each block, the linea alba between.
      for (const y of [th * 0.12, -3.5, -10.5]) for (const k of [1, -1]) blob(ctx, add(add(p.mid, u2, y), r2, k * 3.6), u2, 2.6, 3, WARM, tone.hi * (k > 0 ? 0.7 : 0.4));
      blob(ctx, add(p.mid, u1, -3), u1, 14, 0.9, "0,0,0", 0.28);
      glow(ctx, add(p.mid, u1, -3), u1, 13, 6, hl.abs ?? 0);
      glow(ctx, mid(nb, nt), up(ha), 6, 4, hl.neck ?? 0);
    },
  };
  const W = headFrame(p.head, ha);
  const facePts: Vec[] = [[0, 11.4], [6.6, 9.4], [8.3, 3.2], [8.1, -2.2], [6.6, -7.2], [3.2, -10.4], [0, -11.0], [-3.2, -10.4], [-6.6, -7.2], [-8.1, -2.2], [-8.3, 3.2], [-6.6, 9.4]];
  const face = smooth(facePts.map(([x, y]) => W(x, y)));
  const hairF = smooth(([[0, 13.0], [7.4, 10.9], [9.0, 4.8], [7.4, 6.8], [3.6, 8.0], [0, 7.6], [-3.6, 8.0], [-7.4, 6.8], [-9.0, 4.8], [-7.4, 10.9]] as Vec[]).map(([x, y]) => W(x, y)));
  const headG: Group = {
    path: face,
    tone,
    shade: () => {
      blob(ctx, W(-4.5, -1), [0, 1], 6, 10, "0,0,0", tone.lo * 0.6);
      blob(ctx, W(3.5, 4), [0, 1], 4, 3, WARM, tone.hi * 0.8);
      blob(ctx, W(0, -10), [1, 0], 6, 2.4, "0,0,0", 0.35);
      ctx.save();
      ctx.translate(p.head[0], p.head[1]);
      ctx.rotate((-ha * Math.PI) / 180);
      ctx.fillStyle = "#070606";
      for (const k of [1, -1]) {
        ctx.beginPath();
        ctx.ellipse(k * 3.2, 1.6, 1.1, 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(8,7,6,0.9)";
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(-5.4, 3.4);
      ctx.quadraticCurveTo(-3.2, 4.2, -1.2, 3.4);
      ctx.moveTo(5.4, 3.4);
      ctx.quadraticCurveTo(3.2, 4.2, 1.2, 3.4);
      ctx.moveTo(-2.2, -5.4);
      ctx.quadraticCurveTo(0, -6.0, 2.2, -5.4);
      ctx.stroke();
      ctx.restore();
    },
  };
  const hairG: Group = { path: hairF, tone: HAIR, shade: () => blob(ctx, W(2, 11), [1, 0], 5, 2, WARM, 0.1) };
  const legs = (["L", "R"] as const).map((s) => legParts(ctx, p[`hip${s}`], p[`knee${s}`], p[`ankle${s}`], 0, SKIN_NEAR, CLOTH_NEAR, hl, 1, 0.25, s === "R", true));
  const seat = [add(add(p.pelvis, u1, 8), r1, 14.8), add(add(p.pelvis, u1, -2), r1, 16), add(add(p.pelvis, u1, -10), r1, 4), add(add(p.pelvis, u1, -10), r1, -4), add(add(p.pelvis, u1, -2), r1, -16), add(add(p.pelvis, u1, 8), r1, -14.8)];
  const shorts: Group = {
    path: union(seat, legs[0]!.sleevePts, legs[1]!.sleevePts),
    tone: CLOTH_NEAR,
    shade: () => {
      blob(ctx, add(p.pelvis, r1, -10), u1, 12, 12, "0,0,0", 0.35);
      legs[0]!.sleeveShade();
      legs[1]!.sleeveShade();
      lineW(ctx, [add(add(p.pelvis, u1, 7.6), r1, 14.4), add(add(p.pelvis, u1, 7.2), r1, 0), add(add(p.pelvis, u1, 7.6), r1, -14.4)], 0.5, 0.4);
    },
  };
  const items: Item[] = [
    { layer: "far" },
    legs[0]!.skin,
    legs[1]!.skin,
    legs[0]!.shoe,
    legs[1]!.shoe,
    { layer: "mid" },
    torso,
    shorts,
    headG,
    hairG,
    { layer: "near" },
    ...(["L", "R"] as const).map((s) => armGroup(ctx, p[`shoulder${s}`], p[`elbow${s}`], p[`hand${s}`], SKIN_NEAR, hl, 1, 0.3, s === "R")),
  ];
  render(ctx, items, layer);
}

/** Draw the athlete for one frame; `layer` draws the equipment that sits at each depth. */
export function drawAthlete(ctx: Ctx, f: Frame, layer: LayerFn, hl: Highlight = {}) {
  if (f.view === "side") drawSide(ctx, f, layer, hl);
  else drawFront(ctx, f, layer, hl);
}
