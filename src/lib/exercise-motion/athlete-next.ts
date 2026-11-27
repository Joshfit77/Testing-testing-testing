/**
 * Candidate character designs for the 2D athlete (owner review, 2026-11): the same rig and silhouettes as athlete.ts,
 * repainted three ways as a semi-realistic illustration with natural skin tones. Preview only until one is approved:
 * nothing in the app uses this file unless a design is switched on with setAthleteOverride (athlete.ts).
 *  - "studio":    smooth, controlled form shading (a light-to-shadow gradient across every segment), soft creases at
 *                 muscle borders, a fine contour. The most realistic of the three.
 *  - "editorial": two-step hard-edged tone (painted, graphic), firmer line work, a gold rim line.
 *  - "anatomy":   studio shading at lower contrast with every muscle group finely delineated, like an anatomy plate.
 * Working muscles are tinted with a colour blend that keeps the shading underneath, inside the muscle's own outline.
 */
import { BODY, add, frontOf, up, yawShift } from "./skeleton";
import type { Frame, Vec } from "./types";
import type { Highlight } from "./athlete";

type Ctx = CanvasRenderingContext2D;
type LayerFn = (name: string) => void;

// ---------------------------------------------------------------------------------------------------- Palette

interface Tone {
  base: string;
  shade: string;
  light: string;
  rim: number;
  ink: number;
}

export type DesignName = "studio" | "editorial" | "anatomy";
interface Design {
  mode: "grad" | "cel";
  /** Strength of the form shading (grad). */
  contrast: number;
  skin: [string, string, string];
  /** Contour width (cm) and opacity; ink strength; gold rim strength; always-on muscle delineation. */
  contourW: number;
  contourA: number;
  ink: number;
  rim: number;
  delineate: number;
  /** Opacity of the working-muscle tint: primary, secondary. */
  tint: [number, number];
}
const DESIGNS: Record<DesignName, Design> = {
  studio: { mode: "grad", contrast: 1, skin: ["#c7916c", "#8a583e", "#ecc29e"], contourW: 0.5, contourA: 0.6, ink: 0.5, rim: 0, delineate: 0, tint: [0.36, 0.17] },
  editorial: { mode: "cel", contrast: 1, skin: ["#c58c66", "#96603f", "#e3b58f"], contourW: 0.85, contourA: 0.92, ink: 0.8, rim: 0.75, delineate: 0, tint: [0.6, 0.26] },
  anatomy: { mode: "grad", contrast: 0.72, skin: ["#bf8d6e", "#8c5e46", "#e2b898"], contourW: 0.5, contourA: 0.7, ink: 0.6, rim: 0, delineate: 0.5, tint: [0.6, 0.26] },
};
let D: Design = DESIGNS.studio;

const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
/** Mix two hex colours (t = 0: a, 1: b). */
function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * k)},${Math.round(x[1] + (y[1] - x[1]) * k)},${Math.round(x[2] + (y[2] - x[2]) * k)})`;
}
const toHex = (c: string) => "#" + (c.match(/\d+/g) ?? []).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
const FAR = "#150e0a";
let SKIN_NEAR: Tone = { base: "", shade: "", light: "", rim: 1, ink: 1 };
let SKIN_FAR: Tone = SKIN_NEAR;
const CLOTH_NEAR: Tone = { base: "#1b1b1f", shade: "#0b0b0d", light: "#34343b", rim: 0.7, ink: 0 };
const CLOTH_FAR: Tone = { base: "#111113", shade: "#08080a", light: "#1d1d21", rim: 0.3, ink: 0 };
const SHOE: Tone = { base: "#202024", shade: "#0d0d0f", light: "#3a3a42", rim: 0.6, ink: 0 };
const HAIR: Tone = { base: "#2a1c13", shade: "#150d08", light: "#4a3423", rim: 0.6, ink: 0 };
const GOLD = "226,184,96";
const INK = "62,32,18";
/** The working-muscle tint (brand gold, pushed warm so it reads on skin). */
const TINT = "rgb(255,168,28)";
const TINT_LINE = "246,196,92";

function applyDesign(name: DesignName) {
  D = DESIGNS[name];
  const [b, sh, li] = D.skin;
  SKIN_NEAR = { base: b, shade: sh, light: li, rim: 1, ink: D.ink };
  SKIN_FAR = { base: toHex(mix(b, FAR, 0.4)), shade: toHex(mix(sh, FAR, 0.45)), light: toHex(mix(li, FAR, 0.42)), rim: 0.45, ink: D.ink * 0.7 };
}
applyDesign("studio");

/** The key light (from the front and above, in world space; mirrored scenes mirror it with the canvas). */
const LIGHT: Vec = [0.55, 0.835];
/** Where the rim light pushes the body's gold outline (toward the back, slightly up). */
const RIM_SHIFT: Vec = [-0.55, 0.16];

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
/** How much a surface facing `n` faces the key light, -1..1. Continuous in `n`. */
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
 * A body group: one silhouette with one material. Painted as a flat base colour inside a dark contour, then its
 * hard-edged shapes (muscle fills, shadow plane, ink lines) clipped to the silhouette.
 */
interface Group {
  path: Path2D;
  tone: Tone;
  /** A dark contour just outside the silhouette, separating a near limb from what is behind it. */
  halo?: number;
  /** No contour within this circle (where the limb joins the body, e.g. over the shoulder). */
  haloSkip?: [Vec, number];
  shade: () => void;
}
type Item = Group | { layer: string };

/** A flat, hard-edged shape (a smooth closed outline through the points). Call inside a clip. */
function plane(ctx: Ctx, pts: Vec[], fill: string, alpha = 1) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = fill;
  ctx.fill(smooth(pts));
  ctx.globalAlpha = 1;
}
/** The clip the queued muscle tints of the current segment are painted inside (null: the whole group). */
let curClip: Path2D | null = null;
let queue: (() => void)[] = [];
function flush(ctx: Ctx) {
  const q = queue;
  queue = [];
  for (const f of q) f();
  void ctx;
}

/**
 * Form shading for one segment. "grad": a smooth gradient across the segment, lit on the side facing the light, turning
 * through the base tone into shadow, with both edges darkened a little so the limb reads round. "cel": two hard steps of
 * shadow on the side away from the light. Both are continuous in the segment's angle to the light.
 */
function form(ctx: Ctx, s: Seg, w: number, tone: Tone, t0 = 0, t1 = 1, bias = 0.1) {
  const f = facing(s.n);
  if (D.mode === "grad") {
    const a = at(s, 0.5, -w * 1.05);
    const b = at(s, 0.5, w * 1.05);
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    for (const o of [-1, -0.6, -0.2, 0.2, 0.6, 1]) {
      const v = (f * o * 0.95 - 0.34 * o * o + 0.06) * D.contrast;
      g.addColorStop((o + 1) / 2, v > 0 ? mix(tone.base, tone.light, v) : mix(tone.base, tone.shade, -v * 1.15));
    }
    ctx.fillStyle = g;
    const P = [at(s, t0 - 0.2, -w * 2.4), at(s, t1 + 0.2, -w * 2.4), at(s, t1 + 0.2, w * 2.4), at(s, t0 - 0.2, w * 2.4)];
    ctx.beginPath();
    ctx.moveTo(P[0]![0], P[0]![1]);
    for (const q of P.slice(1)) ctx.lineTo(q[0], q[1]);
    ctx.closePath();
    ctx.fill();
    return;
  }
  const k = clamp((Math.abs(f) - 0.08) / 0.4, 0, 1);
  if (k <= 0) return;
  const side = f > 0 ? -1 : 1;
  const tm = (t0 + t1) / 2;
  for (const [b0, col, al] of [[bias, tone.shade, 0.95], [0.62, toHex(mix(tone.shade, "#1c0f08", 0.4)), 0.8]] as const) {
    const e = side * w * b0;
    const far = side * w * 1.8;
    plane(ctx, [at(s, t0 - 0.12, e), at(s, t0 + (tm - t0) * 0.5, e + side * w * 0.16), at(s, tm, e), at(s, tm + (t1 - tm) * 0.5, e + side * w * 0.16), at(s, t1 + 0.12, e), at(s, t1 + 0.12, far), at(s, t0 - 0.12, far)], col, al * k);
  }
}

/** A crisp ink line through the points (muscle borders, folds). World coordinates. */
function lineW(ctx: Ctx, ps: Vec[], alpha: number, w = 0.34, rgb = INK) {
  if (alpha <= 0 || ps.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(ps[0]![0], ps[0]![1]);
  if (ps.length === 2) ctx.lineTo(ps[1]![0], ps[1]![1]);
  for (let i = 1; i < ps.length - 1; i++) {
    const m = i === ps.length - 2 ? ps[i + 1]! : mid(ps[i]!, ps[i + 1]!);
    ctx.quadraticCurveTo(ps[i]![0], ps[i]![1], m[0], m[1]);
  }
  ctx.lineCap = "round";
  if (D.mode === "grad" && rgb === INK) {
    // A crease: a soft shadow with a fine dark core.
    ctx.strokeStyle = `rgba(${rgb},${Math.min(1, alpha * 0.34)})`;
    ctx.lineWidth = w * 3.4;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${Math.min(1, alpha * 0.8)})`;
    ctx.lineWidth = w * 0.75;
    ctx.stroke();
    return;
  }
  ctx.strokeStyle = `rgba(${rgb},${Math.min(1, alpha)})`;
  ctx.lineWidth = w;
  ctx.stroke();
}
function line(ctx: Ctx, s: Seg, pts: [number, number][], alpha: number, w = 0.34) {
  lineW(ctx, pts.map(([t, o]) => at(s, t, o)), alpha, w);
}
const gold = (ctx: Ctx, ps: Vec[], alpha: number, w: number) => lineW(ctx, ps, alpha, w, GOLD);

/**
 * A working muscle's fill: its strength `k` (the region's value times any per-part factor) and its tier. Primary muscles
 * (highlightFor gives them 1) are gold; secondary ones (0.42) steel blue, matching the key under the player.
 */
interface Glow {
  k: number;
  secondary: boolean;
}
/** Below this a region counts as secondary (highlightFor: primary 1, secondary 0.42). */
const PRIMARY_MIN = 0.7;
function gk(v: number | undefined, factor = 1): Glow {
  const x = v ?? 0;
  return { k: x * factor, secondary: x > 0 && x < PRIMARY_MIN };
}
/**
 * A muscle group: delineated finely in the "anatomy" design, and tinted when the exercise works it. The tint is a colour
 * blend (the hue changes, the shading underneath stays), bounded by a fine line, so the body's shape is preserved.
 * Queued and painted after the segment's shading, inside that segment's own outline.
 */
function muscle(ctx: Ctx, pts: Vec[], gl: Glow) {
  if (gl.k <= 0 && D.delineate <= 0) return;
  const path = smooth(pts);
  const clip = curClip;
  queue.push(() => {
    ctx.save();
    if (clip) ctx.clip(clip);
    if (D.delineate > 0) {
      ctx.strokeStyle = `rgba(${INK},${D.delineate * 0.6})`;
      ctx.lineWidth = 0.3;
      ctx.stroke(path);
    }
    if (gl.k > 0) {
      const kk = Math.min(1, gl.secondary ? gl.k / 0.42 : gl.k);
      const a = (gl.secondary ? D.tint[1] : D.tint[0]) * kk;
      ctx.fillStyle = TINT;
      ctx.globalCompositeOperation = "color";
      ctx.globalAlpha = a;
      ctx.fill(path);
      ctx.globalCompositeOperation = "soft-light";
      ctx.globalAlpha = a * 0.5;
      ctx.fill(path);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(${TINT_LINE},${gl.secondary ? 0.22 * kk : 0.55 * kk})`;
      ctx.lineWidth = 0.28;
      ctx.stroke(path);
    }
    ctx.restore();
  });
}
function muscleS(ctx: Ctx, s: Seg, pts: [number, number][], gl: Glow) {
  muscle(ctx, pts.map(([t, o]) => at(s, t, o)), gl);
}

/** Paint the items: the body's gold rim line first (its silhouette nudged toward the back light), then each group. */
function render(ctx: Ctx, items: Item[], layer: LayerFn) {
  const groups = items.filter((i): i is Group => "path" in i);
  ctx.save();
  ctx.translate(RIM_SHIFT[0], RIM_SHIFT[1]);
  for (const g of groups) {
    if (g.tone.rim <= 0) continue;
    if (D.rim <= 0) break;
    ctx.fillStyle = `rgba(${GOLD},${D.rim * g.tone.rim})`;
    ctx.fill(g.path);
  }
  ctx.restore();
  for (const i of items) {
    if (!("path" in i)) {
      layer(i.layer);
      continue;
    }
    if (i.halo) {
      // Stroked first and then covered by the fill, so only the outer half shows: one crisp dark contour around the
      // silhouette, left off where the limb joins the body.
      ctx.save();
      if (i.haloSkip) {
        const [c, r] = i.haloSkip;
        const clip = new Path2D();
        clip.rect(c[0] - 1e4, c[1] - 1e4, 2e4, 2e4);
        clip.arc(c[0], c[1], r, 0, Math.PI * 2);
        ctx.clip(clip, "evenodd");
      }
      ctx.strokeStyle = `rgba(28,14,8,${D.contourA})`;
      ctx.lineWidth = D.contourW * 2;
      ctx.lineJoin = "round";
      ctx.stroke(i.path);
      ctx.restore();
    }
    ctx.fillStyle = i.tone.base;
    ctx.fill(i.path);
    ctx.save();
    ctx.clip(i.path);
    curClip = null;
    i.shade();
    flush(ctx);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------------------------------- Limbs

/** Side-view profiles (cm). Front = toward the front of the body for a limb hanging down. */
// Shoulder to elbow: the deltoid cap (widest just below the joint), the groove at its insertion, then the biceps in
// front and the triceps behind peaking mid-arm, tapering to the elbow.
const UPPER_ARM: Profile = [
  [-0.05, 5.0, 5.2],
  [0.02, 6.6, 6.8],
  [0.1, 7.4, 7.2],
  [0.22, 6.9, 6.8],
  [0.32, 5.6, 6.1],
  [0.5, 6.3, 6.2],
  [0.66, 5.9, 5.6],
  [0.82, 4.7, 4.7],
  [0.94, 4.0, 4.1],
  [1, 3.8, 3.9],
];
// Elbow to the hand: thick at the brachioradialis and flexor bellies, tapering hard to the wrist.
const FOREARM: Profile = [
  [0, 4.1, 4.3],
  [0.14, 5.3, 4.7],
  [0.32, 4.7, 4.1],
  [0.52, 3.6, 3.2],
  [0.7, 2.8, 2.6],
  [0.82, 2.6, 2.5],
];
// Hip to knee: the quadriceps sweep in front, the hamstring behind, the vastus medialis teardrop above the knee.
const THIGH: Profile = [
  [0, 11.2, 12.4],
  [0.2, 12.2, 11.8],
  [0.42, 12.0, 10.4],
  [0.62, 10.8, 8.4],
  [0.8, 8.6, 6.6],
  [0.92, 6.8, 5.6],
  [1, 5.7, 5.2],
];
// Knee to ankle: the gastrocnemius bulge behind, the shin nearly straight in front, a slim ankle.
const SHIN: Profile = [
  [0, 5.5, 5.6],
  [0.08, 5.2, 7.0],
  [0.26, 4.9, 8.7],
  [0.42, 4.3, 7.6],
  [0.58, 3.6, 5.1],
  [0.76, 2.9, 3.3],
  [0.95, 2.6, 2.7],
];

// Front view, [t, outer, inner] (after Richer / Bammes): the vastus lateralis sweeps the outer thigh, the adductors fill
// the inner thigh high up, the knee is narrow; the outer calf peaks higher than the fuller inner calf; the inner ankle
// bone sits higher than the outer.
const THIGH_F: Profile = [
  [0, 9.6, 8.8],
  [0.18, 10.6, 9.2],
  [0.42, 10.0, 7.8],
  [0.66, 8.4, 6.4],
  [0.86, 6.4, 5.8],
  [0.96, 5.8, 5.9],
  [1, 5.6, 5.8],
];
const SHIN_F: Profile = [
  [0, 5.5, 5.8],
  [0.1, 5.7, 6.0],
  [0.22, 6.6, 6.4],
  [0.36, 6.0, 7.1],
  [0.52, 4.6, 5.6],
  [0.72, 3.3, 3.6],
  [0.9, 2.9, 3.3],
  [0.97, 3.2, 3.0],
];

/** Shoulder to fist as one silhouette: deltoid, upper arm, forearm and the closed hand. */
function armGroup(ctx: Ctx, sh: Vec, el: Vec, hd: Vec, tone: Tone, hl: Highlight, k: number, halo: number, flipFront = false): Group {
  const upper = seg(sh, el);
  const fore = seg(el, hd);
  const sgn = flipFront ? -1 : 1;
  const prof = (p: Profile): Profile => (flipFront ? p.map(([t, f, b]) => [t, b, f]) : p);
  // The biceps rounds up and the triceps flattens a little as the elbow bends (continuous in the elbow angle).
  const flex = clamp(1 - (dot(upper.d, fore.d) + 1) / 1.6, 0, 1);
  const ua = prof(UPPER_ARM.map(([t, f, b]) => [t, t > 0.3 && t < 0.86 ? f + flex * 1.5 * Math.sin(((t - 0.3) / 0.56) * Math.PI) : f, t > 0.3 && t < 0.86 ? b - flex * 0.3 * Math.sin(((t - 0.3) / 0.56) * Math.PI) : b] as [number, number, number]));
  // The fist: palm and curled fingers around the grip point, knuckles beyond it.
  const g = fore.b;
  const fn: Vec = [fore.n[0] * sgn, fore.n[1] * sgn];
  const P = (x: number, y: number): Vec => [g[0] + fore.d[0] * x + fn[0] * y, g[1] + fore.d[1] * x + fn[1] * y];
  const fist = [P(-7.0, 2.3), P(-4.2, 3.0), P(-1.2, 3.9), P(2.2, 4.1), P(4.2, 3.2), P(4.9, 1.2), P(4.7, -1.2), P(3.4, -3.0), P(0.4, -3.4), P(-3.4, -2.9), P(-7.0, -2.2)];
  const cFore = union(limbOutline(fore, prof(FOREARM), 3.2, 1.4), fist);
  const cUpper = smooth(limbOutline(upper, ua, 1.6, 3.0));
  const path = union(cFore, cUpper);
  const S = (pts: [number, number][]): [number, number][] => pts.map(([t, o]) => [t, o * sgn]);
  return {
    path,
    tone,
    halo,
    haloSkip: [sh, 11.5],
    shade: () => {
      const I = tone.ink;
      // The upper arm, inside its own outline.
      ctx.save();
      ctx.clip(cUpper);
      curClip = cUpper;
      form(ctx, upper, 5.6, tone, -0.3, 1.3);
      muscleS(ctx, upper, S([[0.3, 1.2], [0.36, 9], [0.8, 9], [0.97, 3], [0.9, 0.6], [0.5, 0.2]]), gk(hl.biceps, k));
      muscleS(ctx, upper, S([[0.27, -1.4], [0.36, -9], [0.84, -9], [0.97, -3], [0.9, -0.8], [0.5, -0.4]]), gk(hl.triceps, k));
      muscleS(ctx, upper, S([[-0.2, 0.6], [-0.1, 10], [0.2, 10], [0.37, 1.2], [0.2, -0.6]]), gk(hl.frontDelts, k));
      muscleS(ctx, upper, S([[-0.2, -0.6], [-0.1, -10], [0.2, -10], [0.37, -1.2], [0.2, 0.6]]), gk(hl.rearDelts, k));
      muscleS(ctx, upper, S([[-0.2, 0], [-0.1, 10], [0.2, 10], [0.38, 0], [0.2, -10], [-0.1, -10]]), gk(hl.sideDelts, k));
      line(ctx, upper, S([[0.16, 6.6], [0.3, 3.4], [0.37, 0.2]]), I);
      line(ctx, upper, S([[0.37, 0.2], [0.3, -3.2], [0.18, -6.4]]), I);
      line(ctx, upper, S([[0.4, 0], [0.66, -0.5], [0.93, 0.2]]), I * 0.7, 0.3);
      line(ctx, upper, S([[0.86, 3.6], [0.95, 1.2], [1.02, -0.6]]), I * 0.5, 0.28);
      flush(ctx);
      ctx.restore();
      // The forearm and hand over it: their own outline, with a fine edge where they cross the upper arm.
      ctx.save();
      ctx.clip(cFore, "nonzero");
      curClip = cFore;
      ctx.fillStyle = tone.base;
      ctx.fill(cFore);
      form(ctx, fore, 5.6, tone, -0.3, 1.3);
      muscleS(ctx, fore, S([[-0.04, 0], [0.06, 8], [0.5, 8], [0.74, 0], [0.5, -8], [0.06, -8]]), gk(hl.forearms, k));
      line(ctx, fore, S([[0.03, 2.4], [0.3, 0.9], [0.58, 0.4]]), I * 0.6, 0.3);
      // The hand: the wrist crease, the knuckle row, three lines between four curled fingers, and the thumb wrapped
      // over the handle on the near side.
      lineW(ctx, [P(-6.2, 2.2), P(-6.6, 0), P(-6.2, -2.1)], I * 0.5, 0.24);
      lineW(ctx, [P(1.9, 3.9), P(3.9, 2.9), P(4.6, 1.0), P(4.4, -1.2)], I * 0.75, 0.26);
      for (const y of [2.0, 0.3, -1.4]) lineW(ctx, [P(0.2, y * 0.92), P(4.5, y)], I * 0.6, 0.2);
      plane(ctx, [P(-4.6, 0.6), P(-2.6, 2.6), P(0.6, 3.0), P(2.4, 2.0), P(2.2, 0.6), P(-0.6, 0.2)], toHex(mix(tone.base, tone.light, 0.28)), 1);
      lineW(ctx, [P(-4.4, 0.5), P(-1.0, 0.1), P(2.2, 0.5), P(2.6, 1.8), P(1.0, 2.8)], I * 0.75, 0.24);
      flush(ctx);
      ctx.restore();
      curClip = null;
      ctx.strokeStyle = `rgba(28,14,8,${D.contourA * 0.55 * flex})`;
      ctx.lineWidth = D.contourW;
      ctx.stroke(cFore);
    },
  };
}

/** Hip to ankle as one silhouette (thigh, knee, shin); the shoe and the shorts' sleeve are their own groups. */
function legParts(ctx: Ctx, hip: Vec, knee: Vec, ankle: Vec, footRot: number, skinT: Tone, clothT: Tone, hl: Highlight, k: number, halo: number, flipFront = false, front = false) {
  const thigh = seg(hip, knee);
  const shin = seg(knee, ankle);
  const sgn = flipFront ? -1 : 1;
  const prof = (p: Profile): Profile => (flipFront ? p.map(([t, f, b]) => [t, b, f]) : p);
  const S = (pts: [number, number][]): [number, number][] => pts.map(([t, o]) => [t, o * sgn]);
  const cShin = smooth(limbOutline(shin, prof(front ? SHIN_F : SHIN), 3.8, 2));
  const cThigh = smooth(limbOutline(thigh, prof(front ? THIGH_F : THIGH), 8, 3.6));
  const bend = clamp(1 - (dot(thigh.d, shin.d) + 1) / 1.6, 0, 1);
  const skin: Group = {
    path: union(cShin, cThigh),
    tone: skinT,
    halo,
    shade: () => {
      const I = skinT.ink;
      ctx.save();
      ctx.clip(cThigh);
      curClip = cThigh;
      form(ctx, thigh, 9.6, skinT, -0.2, 1.3);
      muscleS(ctx, thigh, S([[0.0, 2.6], [0.1, 15], [0.78, 15], [0.99, 7], [0.95, 1.4], [0.5, -0.4], [0.14, 0.4]]), gk(hl.quads, k));
      muscleS(ctx, thigh, S([[0.06, -1.8], [0.5, -2.2], [0.9, -1.6], [0.97, -8], [0.5, -16], [0.08, -16]]), gk(hl.hamstrings, k));
      muscleS(ctx, thigh, front ? S([[0.02, -3], [0.5, -4], [0.56, -14], [0.02, -14]]) : S([[0.03, 1.8], [0.44, 0.9], [0.5, -1.4], [0.03, -2]]), gk(hl.adductors, k * 0.85));
      line(ctx, thigh, S([[0.08, -0.8], [0.5, -1.6], [0.9, -1.3]]), I * 0.8);
      line(ctx, thigh, S([[0.24, 5.2], [0.56, 5.2], [0.84, 3.4]]), I * 0.55, 0.3);
      line(ctx, thigh, S([[0.72, 7.4], [0.86, 5.6], [0.95, 2.6]]), I * 0.65, 0.3);
      flush(ctx);
      ctx.restore();
      ctx.save();
      ctx.clip(cShin);
      curClip = cShin;
      ctx.fillStyle = skinT.base;
      ctx.fill(cShin);
      form(ctx, shin, 9.6, skinT, -0.3, 1.1);
      muscleS(ctx, shin, S([[0.0, -1.4], [0.06, -13], [0.44, -13], [0.68, -3], [0.5, -0.9], [0.2, -0.6]]), gk(hl.calves, k));
      muscleS(ctx, shin, S([[0.03, 0.9], [0.08, 8], [0.6, 8], [0.78, 1.2], [0.4, 0.5]]), gk(hl.shins, k));
      lineW(ctx, [at(shin, -0.04, 4.6 * sgn), at(shin, 0.03, 5.4 * sgn), at(shin, 0.09, 4.2 * sgn)], I * 0.6, 0.3);
      line(ctx, shin, S([[0.3, -8.2], [0.46, -3.6], [0.7, -2.2]]), I * 0.75);
      line(ctx, shin, S([[0.1, 1.6], [0.45, 1.2], [0.86, 1.0]]), I * 0.45, 0.28);
      flush(ctx);
      ctx.restore();
      curClip = null;
      ctx.strokeStyle = `rgba(28,14,8,${D.contourA * 0.5 * bend})`;
      ctx.lineWidth = D.contourW;
      ctx.stroke(cShin);
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
  const near = clothT === CLOTH_NEAR;
  const sleeveShade = () => {
    form(ctx, thigh, 10.5, clothT, -0.05, 0.42);
    gold(ctx, [at(thigh, -0.02, front ? 9 * sgn : 0.8), at(thigh, 0.41, front ? 9.6 * sgn : 0.6)], near ? 0.85 : 0.35, 0.55);
    gold(ctx, [at(thigh, 0.412, hemF * 0.97), at(thigh, 0.412, hemB * 0.97)], near ? 0.5 : 0.2, 0.4);
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
    halo: 0.3,
    shade: () => {
      // The vamp's light plane, the heel counter's shadow, the sole and its gold edge, the lace line.
      plane(ctx, [P(0, 3.2), P(6, 0.6), P(F - 4, -H + 4.4), P(F - 2, -H + 2.6), P(2, -H + 3.2), P(-2, 0.5)], SHOE.light, 0.8);
      plane(ctx, [P(-B - 2, 3), P(-B + 2.6, 3), P(-B + 3.4, -H + 1.8), P(-B - 2, -H + 1.8)], SHOE.shade, 0.9);
      ctx.fillStyle = "#0a0a0b";
      ctx.fill(smooth(sole));
      gold(ctx, [P(-B - 1.5, -H + 1.5), P(F + 0.6, -H + 1.3)], 0.9, 0.45);
      lineW(ctx, [P(1.5, 2.8), P(8.5, -0.8)], 0.5, 0.3, "0,0,0");
    },
  };
}

function shoeFront(ctx: Ctx, ankle: Vec, shin: Seg): Group {
  // Seen from the front: the toe box toward the viewer, wider than the ankle, flat on the floor, with the sole's edge.
  const x = ankle[0] + shin.d[0] * 2;
  const top = ankle[1] + 2.5;
  const floor = ankle[1] - BODY.ankleH;
  const pts: Vec[] = [[x - 3.6, top], [x + 3.6, top], [x + 5.6, top - 4], [x + 6.6, floor + 2.2], [x + 6.2, floor - 0.2], [x - 6.2, floor - 0.2], [x - 6.6, floor + 2.2], [x - 5.6, top - 4]];
  return {
    path: smooth(pts),
    tone: SHOE,
    halo: 0.3,
    shade: () => {
      plane(ctx, [[x - 0.5, top - 1], [x + 3.4, top - 1.4], [x + 5, floor + 3.4], [x + 0.5, floor + 3]], SHOE.light, 0.8);
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(x - 6.6, floor - 0.2, 13.2, 2.2);
      ctx.fillStyle = `rgba(${GOLD},0.85)`;
      ctx.fillRect(x - 6.3, floor + 1.9, 12.6, 0.4);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(x - 1.8, top - 1.2 - i * 1.3);
        ctx.lineTo(x + 1.8, top - 1.2 - i * 1.3);
      }
      ctx.stroke();
    },
  };
}

// ---------------------------------------------------------------------------------------------------- Head

/** Head size against the rig's head: a little smaller, for an adult eight-head figure. */
const HEAD = 0.93;

/** Head points in its own frame (face toward +x, y up, centre at the origin), mapped to the world. */
function headFrame(head: Vec, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (x0: number, y0: number): Vec => {
    const x = x0 * HEAD;
    const y = y0 * HEAD;
    return [head[0] + x * c + y * s, head[1] - x * s + y * c];
  };
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

function headSideGroups(ctx: Ctx, f: Frame): Group[] {
  const { head } = f.pts;
  const a = f.seg.head;
  const W = headFrame(head, a);
  const skull = smooth(PROFILE.map(([x, y]) => W(x, y)));
  const hair = smooth(HAIR_SIDE.map(([x, y]) => W(x, y)));
  const tone = SKIN_NEAR;
  return [
    {
      path: skull,
      tone,
      halo: 0.3,
      shade: () => {
        const fa = frontOf(a);
        if (D.mode === "grad") form(ctx, { ...seg(W(0, -11), W(0, 12)), n: fa }, 9.5, tone, -0.2, 1.2);
        else plane(ctx, [W(-11, 6), W(-3.4, 4), W(-0.6, -1.4), W(2.6, -4.2), W(6.6, -7.4), W(9, -11), W(-2, -13), W(-12, -6)], tone.shade, 0.9);
        // Under the jaw and the cheek's hollow; a trace of stubble along the jaw.
        plane(ctx, [W(8.6, -9.4), W(4, -8.6), W(0.6, -5.4), W(-2, -4), W(-3, -9), W(4, -13), W(9, -12)], tone.shade, 0.55);
        plane(ctx, [W(8.4, -5.6), W(5.4, -4.4), W(1.6, -2.6), W(0.4, -5.6), W(3.6, -9.2), W(7.6, -9.6)], "#3a241a", 0.13);
        ctx.save();
        ctx.translate(head[0], head[1]);
        ctx.rotate((-a * Math.PI) / 180);
        ctx.scale(HEAD, HEAD);
        ctx.lineCap = "round";
        // Ear: the rim, the inner fold, the lobe.
        ctx.fillStyle = toHex(mix(tone.base, tone.shade, 0.25));
        ctx.strokeStyle = `rgba(${INK},0.8)`;
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.ellipse(-1.7, -0.3, 1.9, 3.1, 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-1.5, 0.2, 1.15, -1.1, 2.2);
        ctx.moveTo(-1.2, -1.2);
        ctx.quadraticCurveTo(-0.6, -1.9, -1.5, -2.6);
        ctx.stroke();
        // Eye: socket shadow, white, iris, upper lid; the brow.
        ctx.fillStyle = `rgba(${INK},0.22)`;
        ctx.beginPath();
        ctx.ellipse(6.6, 2.2, 2.2, 1.3, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#efe6dc";
        ctx.beginPath();
        ctx.moveTo(5.9, 1.7);
        ctx.quadraticCurveTo(7.1, 2.5, 8.1, 1.8);
        ctx.quadraticCurveTo(7.0, 1.2, 5.9, 1.7);
        ctx.fill();
        ctx.fillStyle = "#2a1a10";
        ctx.beginPath();
        ctx.arc(7.45, 1.82, 0.52, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(30,16,8,0.95)";
        ctx.lineWidth = 0.34;
        ctx.beginPath();
        ctx.moveTo(5.8, 1.8);
        ctx.quadraticCurveTo(7.1, 2.7, 8.25, 1.9);
        ctx.stroke();
        ctx.lineWidth = 0.75;
        ctx.strokeStyle = "rgba(36,22,12,0.95)";
        ctx.beginPath();
        ctx.moveTo(5.2, 3.5);
        ctx.quadraticCurveTo(7.0, 4.3, 8.5, 3.6);
        ctx.stroke();
        // Nose wing and nostril, lips, the line of the jaw.
        ctx.strokeStyle = `rgba(${INK},0.75)`;
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(8.3, -1.4);
        ctx.quadraticCurveTo(7.7, -2.4, 8.6, -2.7);
        ctx.moveTo(9.0, -2.5);
        ctx.quadraticCurveTo(9.5, -2.2, 9.7, -2.6);
        ctx.moveTo(6.6, -9.2);
        ctx.quadraticCurveTo(2.6, -8.6, 0.2, -5.2);
        ctx.stroke();
        ctx.fillStyle = "#a25f4c";
        ctx.beginPath();
        ctx.moveTo(7.6, -4.6);
        ctx.quadraticCurveTo(8.8, -3.9, 9.25, -4.4);
        ctx.quadraticCurveTo(8.9, -4.7, 9.0, -5.3);
        ctx.quadraticCurveTo(8.4, -5.8, 7.6, -4.6);
        ctx.fill();
        ctx.strokeStyle = "rgba(60,26,18,0.85)";
        ctx.lineWidth = 0.26;
        ctx.beginPath();
        ctx.moveTo(7.6, -4.6);
        ctx.lineTo(9.15, -4.6);
        ctx.stroke();
        ctx.restore();
      },
    },
    {
      path: hair,
      tone: HAIR,
      shade: () => {
        plane(ctx, [W(5.6, 10.2), W(5.4, 12.4), W(0, 13.1), W(-5.6, 11.8), W(-1, 10.9)], HAIR.light, 0.55);
        lineW(ctx, [W(4.4, 8.0), W(2.6, 4.6), W(1.2, 1.4)], 0.5, 0.3, "0,0,0");
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
  // Waist narrowest above the hips; the lats flare behind from the lower ribs to the armpit; the pectoral curves
  // forward to its fullest below the clavicle and turns under into the abdominal wall; the traps rise into the neck.
  return [
    [add(pelvis, u1, -2), 11.0, 12.4, f1],
    [add(pelvis, u1, 7), 10.2, 9.4, f1],
    [add(pelvis, u1, 14), 10.9, 9.2, f1],
    [m, 12.0, 10.8, fm],
    [add(m, u2, BODY.thorax * 0.2), 13.2, 13.8, f2],
    [add(m, u2, BODY.thorax * 0.36), 14.4, 15.4, f2],
    [add(m, u2, BODY.thorax * 0.52), 17.4, 15.0, f2],
    [add(m, u2, BODY.thorax * 0.7), 17.0, 14.0, f2],
    [add(m, u2, BODY.thorax * 0.88), 13.2, 13.0, f2],
    [add(neckBase, u2, 1.5), 8.0, 11.8, f2],
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
  const neck = [add(base, fT2, 6.6), add(nm, fa, 5.6), add(top, fa, 5.6), add(top, fa, -3.6), add(nm, fa, -6.2), add(base, fT2, -10.6)];
  const f1 = frontOf(f.seg.T1);
  const f2 = fT2;
  const u1 = up(f.seg.T1);
  const u2 = up(f.seg.T2);
  const th = BODY.thorax;
  const tone = SKIN_NEAR;
  const spineLow = seg(pelvis, m);
  const spineHigh = seg(m, neckBase);
  // Points on the thorax (height above mid-spine, cm toward the front) and on the lumbar segment.
  const A = (y: number, x: number): Vec => add(add(m, u2, y), f2, x);
  const B = (y: number, x: number): Vec => add(add(m, u1, y), f1, x);
  return {
    path: union(torso, neck),
    tone,
    halo: 0.2,
    shade: () => {
      form(ctx, { ...spineLow, n: f1 }, 10.8, tone, -0.3, 1, 0.3);
      form(ctx, { ...spineHigh, n: f2 }, 14.5, tone, 0, 1, 0.3);
      form(ctx, seg(base, top), 5.8, tone, 0, 1, 0.2);
      muscle(ctx, [A(th * 0.36, 7), A(th * 0.38, 24), A(th * 0.74, 24), A(th * 0.9, 12), A(th * 0.82, 5), A(th * 0.52, 4)], gk(hl.chest));
      muscle(ctx, [A(th * 0.33, 7.4), A(th * 0.33, 22), B(-10, 22), B(-23, 22), B(-23, 7.2), B(-10, 6.6)], gk(hl.abs));
      muscle(ctx, [A(th * 0.27, 4.6), B(-10, 4), B(-22, 4.6), B(-22, -0.6), B(-9, -1.6), A(th * 0.14, -0.8)], gk(hl.obliques));
      muscle(ctx, [A(th * 0.62, -1.6), A(th * 0.66, -24), A(th * 0.04, -24), B(-12, -9), B(-9, -4.2), A(th * 0.2, -3.6)], gk(hl.lats));
      muscle(ctx, [A(th * 0.62, -3), A(th * 0.62, -24), A(th * 0.9, -24), A(th * 0.9, -5)], gk(hl.upperBack));
      muscle(ctx, [A(th * 0.86, -4), A(th * 0.86, -24), add(nm, fa, -12), add(nm, fa, -2.4)], gk(hl.traps));
      muscle(ctx, [B(-23, -5.4), B(-23, -22), B(-4, -22), B(-4, -6.6)], gk(hl.lowerBack));
      muscle(ctx, [add(base, fT2, 8), add(top, fa, 7), add(top, fa, -5), add(base, fT2, -4)], gk(hl.neck));
      // Form: the chest and belly face the light, the back turns away.
      const lit2 = clamp(facing(f2) * 1.4, 0, 1);
      // Light planes: the pectoral, three abdominal blocks.
      plane(ctx, [A(th * 0.46, 9.5), A(th * 0.46, 15.4), A(th * 0.7, 15.2), A(th * 0.8, 10.6), A(th * 0.66, 7.6)], tone.light, D.mode === "cel" ? 0.35 * lit2 : 0);
      for (const [y0, y1] of [[th * 0.2, th * 0.31], [th * 0.05, th * 0.17], [-8.4, th * 0.02]] as const) plane(ctx, [A(y0, 7.4), A(y0, 11.6), A(y1, 11.8), A(y1, 7.6)], tone.light, D.mode === "cel" ? 0.3 * lit2 : 0);
      const I = tone.ink;
      // Ink: the pectoral's lower border and its edge at the armpit, the abdominal tendons and the line beside them,
      // the serratus, the latissimus' front edge, the trapezius' edge up the neck, the sternomastoid.
      lineW(ctx, [A(th * 0.44, 16.4), A(th * 0.35, 12), A(th * 0.4, 6.4), A(th * 0.52, 3.6)], I);
      for (const [y, x1] of [[th * 0.2, 12.2], [th * 0.05, 11.6], [-8.6, 10.8]] as const) lineW(ctx, [A(y - 0.6, 7.6), A(y + 0.5, (7.6 + x1) / 2), A(y - 0.2, x1)], I * 0.5, 0.26);
      lineW(ctx, [A(th * 0.33, 7.0), A(th * 0.12, 6.4), B(-8, 6.0), B(-20, 7.0)], I * 0.45, 0.26);
      for (const y of [th * 0.3, th * 0.2, th * 0.1]) lineW(ctx, [A(y, 2.2), A(y - 1.6, 5.2)], I * 0.6, 0.3);
      lineW(ctx, [A(th * 0.64, -1.4), A(th * 0.32, -4), B(-9, -5.6), B(-18, -7.6)], I * 0.75);
      lineW(ctx, [A(th * 0.9, -5.6), add(nm, fa, -3.2), add(top, fa, -1.6)], I * 0.55, 0.3);
      lineW(ctx, [add(top, fa, 1.2), add(nm, fa, 2.2), add(base, fT2, 3.6)], I * 0.6, 0.3);
    },
  };
}

/** The shorts: the seat (waistband to the gluteal fold, turning with the pelvis) and the near leg's sleeve. */
function shortsSideGroup(ctx: Ctx, f: Frame, hl: Highlight, sleevePts: Vec[], sleeveShade: () => void): Group {
  const { pelvis } = f.pts;
  const f1 = frontOf(f.seg.T1);
  const u1 = up(f.seg.T1);
  const P = (fw: number, uh: number): Vec => add(add(pelvis, f1, fw), u1, uh);
  const seat = [P(11.0, 9.6), P(11.8, 3), P(11.0, -4.5), P(3.4, -10.8), P(-5.2, -11.6), P(-12.6, -7.4), P(-14.4, 0.2), P(-12.4, 7.6), P(-10.8, 9.2), P(0, 9.9)];
  const tone = CLOTH_NEAR;
  return {
    path: union(seat, sleevePts),
    tone,
    halo: 0.25,
    shade: () => {
      // The working glutes and hip flexors show through the cloth as flat, dimmer shapes.
      const glute = [P(-2.5, 6.4), P(-13.4, 6), P(-15.6, -2), P(-10, -10.6), P(-1.5, -8)];
      form(ctx, { ...seg(P(0, -8), P(0, 9)), n: f1 }, 12.5, tone);
      sleeveShade();
      // The glutes' outline on the cloth when they are working.
      const gg = gk(hl.glutes);
      if (gg.k > 0) {
        ctx.strokeStyle = `rgba(${TINT_LINE},${gg.secondary ? 0.4 : 0.85})`;
        ctx.lineWidth = 0.45;
        ctx.stroke(smooth(glute));
      }
      // Waistband with a gold edge.
      gold(ctx, [P(10.7, 8.8), P(0, 8.2), P(-10.6, 8.0)], 0.9, 0.6);
      lineW(ctx, [P(10.9, 6.6), P(0, 6.2), P(-10.8, 5.8)], 0.8, 0.3, "0,0,0");
    },
  };
}

// ---------------------------------------------------------------------------------------------------- Views

function drawSide(ctx: Ctx, f: Frame, layer: LayerFn, hl: Highlight) {
  const p = f.pts;
  // The camera (CAMERA_YAW in skeleton.ts): the near limbs shift back a little on screen, the far limbs forward; the
  // midline (torso, head) stays. Equipment in a hand shifts with that hand (render.ts).
  const Y = (q: Vec, z: number): Vec => [q[0] + yawShift(z), q[1]];
  const zA = BODY.shoulderHalf;
  const zL = BODY.hipHalf;
  const far = legParts(ctx, Y(p.pelvis, -zL), Y(p.kneeL, -zL), Y(p.ankleL, -zL), f.seg.footL, SKIN_FAR, CLOTH_FAR, hl, 0.5, 0);
  const near = legParts(ctx, Y(p.pelvis, zL), Y(p.kneeR, zL), Y(p.ankleR, zL), f.seg.footR, SKIN_NEAR, CLOTH_NEAR, hl, 1, 0.32);
  const farSleeve: Group = { path: smooth(far.sleevePts), tone: CLOTH_FAR, shade: far.sleeveShade };
  const items: Item[] = [
    // Far side: darker, its muscle fills dimmer.
    far.skin,
    far.shoe,
    farSleeve,
    armGroup(ctx, Y(p.shoulder, -zA), Y(p.elbowL, -zA), Y(p.handL, -zA), SKIN_FAR, hl, 0.5, 0),
    { layer: "far" },
    { layer: "mid" },
    torsoSideGroup(ctx, f, hl),
    ...headSideGroups(ctx, f),
    near.skin,
    near.shoe,
    shortsSideGroup(ctx, f, hl, near.sleevePts, near.sleeveShade),
    { layer: "near" },
    armGroup(ctx, Y(p.shoulder, zA), Y(p.elbowR, zA), Y(p.handR, zA), SKIN_NEAR, hl, 1, 0.38),
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
    [add(p.mid, u2, th * 0.2), 16.2, r2],
    [add(p.mid, u2, th * 0.55), 18.4, r2],
    [add(p.neckBase, u2, -9 * fs), 18.8, r2],
    [add(p.neckBase, u2, -4.4 * fs), 21.4, r2],
    [add(p.neckBase, u2, -1.6 * fs), 17.4, r2],
    [add(p.neckBase, u2, 0.2), 11.4, r2],
    [add(p.neckBase, u2, 2.2), 6.4, r2],
  ];
  const ha = f.seg.head;
  const nb = add(p.neckBase, up(ha), -2);
  const nt = add(p.head, up(ha), -7);
  const torsoPts = [...st.map(([c, w, n]) => add(c, n, w)), ...st.map(([c, w, n]) => add(c, n, -w)).reverse()];
  const neckPts = [add(nb, r2, 7.2), add(nt, r2, 5.7), add(nt, r2, -5.7), add(nb, r2, -7.2)];
  const tone = SKIN_NEAR;
  const I = tone.ink;
  const A = (y: number, x: number): Vec => add(add(p.mid, u2, y), r2, x);
  const B = (y: number, x: number): Vec => add(add(p.mid, u1, y), r1, x);
  const lum = BODY.lumbar;
  const torso: Group = {
    path: union(torsoPts, neckPts),
    tone,
    halo: 0.2,
    shade: () => {
      // Light from the upper right: one shadow plane down the left side (screen) of the torso and neck.
      if (D.mode === "grad") {
        form(ctx, { ...seg(p.pelvis, p.neckBase), n: r2 }, 21, tone, -0.4, 1.5);
      } else plane(ctx, [A(th * 1.5, -5.6), A(th * 0.8, -8.4), A(th * 0.45, -11.6), B(-lum * 0.5, -9.6), B(-lum * 1.4, -8), B(-lum * 1.4, -40), A(th * 1.5, -40)], tone.shade, 0.9);
      for (const k of [1, -1]) {
        muscle(ctx, [A(th * 0.42, k * 1.0), A(th * 0.38, k * 12), A(th * 0.52, k * 20), A(th * 0.8, k * 19), A(th * 0.86, k * 6), A(th * 0.8, k * 1.0)], gk(hl.chest));
        muscle(ctx, [A(th * 0.5, k * 18.4), A(th * 0.5, k * 30), A(th * 0.06, k * 30), A(th * 0.06, k * 15.6)], gk(hl.lats));
        muscle(ctx, [A(th * 0.3, k * 8), A(th * 0.3, k * 22), B(-lum * 0.86, k * 22), B(-lum * 0.86, k * 7)], gk(hl.obliques));
        muscle(ctx, [A(th - 7 * fs, k * 4.6), A(th + 1, k * 4), A(th - 1, k * 15), A(th - 6 * fs, k * 15)], gk(hl.traps));
      }
      muscle(ctx, [A(th * 0.34, -7.4), A(th * 0.34, 7.4), B(-lum * 0.5, 7), B(-lum * 0.9, 5), B(-lum * 0.9, -5), B(-lum * 0.5, -7)], gk(hl.abs));
      muscle(ctx, [add(nb, r2, 9), add(nt, r2, 6), add(nt, r2, -6), add(nb, r2, -9)], gk(hl.neck));
      // Light planes: the right pectoral and the right abdominal blocks.

      for (const [y0, y1] of [[th * 0.2, th * 0.31], [th * 0.05, th * 0.17], [-lum * 0.34, th * 0.02]] as const) plane(ctx, [A(y0, 1.2), A(y0, 6.4), A(y1, 6.6), A(y1, 1.2)], tone.light, 0);
      // Ink: clavicles, the pectorals' lower borders and the sternum, the abdominal grid, the serratus, the navel.
      for (const k of [1, -1]) {
        lineW(ctx, [A(th - 2.4 * fs, k * 2.4), A(th - 1.6 * fs, k * 9), A(th - 0.6 * fs, k * 15.6)], I * 0.8);
        lineW(ctx, [A(th * 0.44, k * 1.4), A(th * 0.36, k * 9.6), A(th * 0.46, k * 16.6), A(th * 0.6, k * 19)], I);
        // The costal arch from the sternum's tip out over the ribs; the rectus' outer border, fading below the navel.
        lineW(ctx, [A(th * 0.37, k * 1.2), A(th * 0.3, k * 5.4), A(th * 0.16, k * 9.6), A(th * 0.02, k * 12)], I * 0.5, 0.28);
        lineW(ctx, [A(th * 0.22, k * 7.4), B(-lum * 0.36, k * 7.2), B(-lum * 0.7, k * 5.6)], I * 0.38, 0.26);
        // Three tendinous intersections: arched, never level with their partner across the midline, the lowest faint.
        const dy = k > 0 ? 0.9 : -0.5;
        for (const [y, a] of [[th * 0.2, 0.55], [th * 0.045, 0.5], [-lum * 0.34, 0.34]] as const)
          lineW(ctx, [A(y + dy - 0.5, k * 0.9), A(y + dy + 0.7, k * 3.4), A(y + dy + 0.2, k * 5.6), A(y + dy - 0.9, k * 6.9)], I * a, 0.26);
        for (const y of [th * 0.3, th * 0.2, th * 0.1]) lineW(ctx, [A(y, k * 13.4), A(y - 1.6, k * 10)], I * 0.6, 0.3);
        lineW(ctx, [add(nt, r2, k * 3.6), add(nb, r2, k * 1.6)], I * 0.55, 0.3);
      }
      lineW(ctx, [A(th * 0.82, 0), A(th * 0.4, 0)], I * 0.75, 0.3);
      lineW(ctx, [A(th * 0.33, 0), B(-lum * 0.3, 0.2), B(-lum * 0.62, 0)], I * 0.45, 0.26);
      // The V of the lower abdomen into the hips (inguinal lines).
      for (const k of [1, -1]) lineW(ctx, [B(-lum * 0.62, k * 12.6), B(-lum * 0.84, k * 8), B(-lum * 1.0, k * 4.4)], I * 0.4, 0.26);
      lineW(ctx, [B(-lum * 0.7, -0.5), B(-lum * 0.74, 0.5)], I, 0.4);
    },
  };
  const W = headFrame(p.head, ha);
  const facePts: Vec[] = [[0, 11.4], [6.6, 9.4], [8.3, 3.2], [8.1, -2.2], [6.6, -7.2], [3.2, -10.4], [0, -11.0], [-3.2, -10.4], [-6.6, -7.2], [-8.1, -2.2], [-8.3, 3.2], [-6.6, 9.4]];
  const earPts = (k: number): Vec[] => ([[7.6, 3.2], [9.6, 3.4], [9.9, 0.4], [9.0, -2.6], [7.6, -2.2]] as Vec[]).map(([x, y]) => W(k * x, y));
  const face = union(earPts(1), earPts(-1), facePts.map(([x, y]) => W(x, y)));
  const hairF = smooth(([[0, 13.0], [7.4, 10.9], [9.0, 4.8], [7.4, 6.8], [3.6, 8.0], [0, 7.6], [-3.6, 8.0], [-7.4, 6.8], [-9.0, 4.8], [-7.4, 10.9]] as Vec[]).map(([x, y]) => W(x, y)));
  const headG: Group = {
    path: face,
    tone,
    halo: 0.3,
    shade: () => {
      if (D.mode === "grad") form(ctx, { ...seg(W(0, -11), W(0, 12)), n: [1, 0] as Vec }, 9.6, tone, -0.2, 1.2);
      else plane(ctx, [W(-10, 9), W(-3.4, 6), W(-2.6, -2), W(-1.6, -8.6), W(2, -13), W(-10, -13)], tone.shade, 0.9);
      // Stubble along the jaw and chin, the shadow under the lower lip.
      plane(ctx, [W(-7.4, -4.4), W(-4.6, -5.2), W(0, -4.6), W(4.6, -5.2), W(7.4, -4.4), W(5.6, -9.6), W(0, -11.6), W(-5.6, -9.6)], "#3a241a", 0.12);
      ctx.save();
      ctx.translate(p.head[0], p.head[1]);
      ctx.rotate((-ha * Math.PI) / 180);
      ctx.scale(HEAD, HEAD);
      ctx.lineCap = "round";
      for (const k of [1, -1]) {
        // Socket shadow, white, iris and pupil, upper lid, brow; the ear's inner fold.
        ctx.fillStyle = `rgba(${INK},0.2)`;
        ctx.beginPath();
        ctx.ellipse(k * 3.3, 2.2, 2.4, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#efe6dc";
        ctx.beginPath();
        ctx.moveTo(k * 1.9, 1.7);
        ctx.quadraticCurveTo(k * 3.3, 2.7, k * 4.7, 1.8);
        ctx.quadraticCurveTo(k * 3.3, 1.0, k * 1.9, 1.7);
        ctx.fill();
        ctx.fillStyle = "#3b2414";
        ctx.beginPath();
        ctx.arc(k * 3.3, 1.8, 0.66, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0c0705";
        ctx.beginPath();
        ctx.arc(k * 3.3, 1.8, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(30,16,8,0.95)";
        ctx.lineWidth = 0.36;
        ctx.beginPath();
        ctx.moveTo(k * 1.8, 1.7);
        ctx.quadraticCurveTo(k * 3.3, 2.9, k * 4.8, 1.9);
        ctx.stroke();
        ctx.strokeStyle = "rgba(36,22,12,0.95)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(k * 1.4, 3.5);
        ctx.quadraticCurveTo(k * 3.4, 4.3, k * 5.5, 3.5);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${INK},0.6)`;
        ctx.lineWidth = 0.28;
        ctx.beginPath();
        ctx.moveTo(k * 8.6, 2.2);
        ctx.quadraticCurveTo(k * 9.3, 0.6, k * 8.6, -1.4);
        ctx.stroke();
      }
      // Nose: the bridge's shadow side, the wings and nostrils. Lips. The chin.
      ctx.strokeStyle = `rgba(${INK},0.6)`;
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(-0.9, 2.2);
      ctx.quadraticCurveTo(-1.3, -1.2, -1.9, -2.6);
      ctx.quadraticCurveTo(-1.5, -3.6, -0.6, -3.2);
      ctx.moveTo(0.6, -3.2);
      ctx.quadraticCurveTo(1.5, -3.6, 1.9, -2.6);
      ctx.moveTo(-1.6, -8.4);
      ctx.quadraticCurveTo(0, -9.0, 1.6, -8.4);
      ctx.stroke();
      ctx.fillStyle = "#a25f4c";
      ctx.beginPath();
      ctx.moveTo(-2.3, -5.6);
      ctx.quadraticCurveTo(-0.9, -4.8, 0, -5.1);
      ctx.quadraticCurveTo(0.9, -4.8, 2.3, -5.6);
      ctx.quadraticCurveTo(0, -7.3, -2.3, -5.6);
      ctx.fill();
      ctx.strokeStyle = "rgba(60,26,18,0.85)";
      ctx.lineWidth = 0.28;
      ctx.beginPath();
      ctx.moveTo(-2.3, -5.6);
      ctx.quadraticCurveTo(0, -5.9, 2.3, -5.6);
      ctx.stroke();
      ctx.restore();
    },
  };
  const hairG: Group = { path: hairF, tone: HAIR, shade: () => plane(ctx, [W(0.5, 12.4), W(6, 10.6), W(7.4, 8), W(3, 9.6)], HAIR.light, 0.9) };
  const legs = (["L", "R"] as const).map((s) => legParts(ctx, p[`hip${s}`], p[`knee${s}`], p[`ankle${s}`], 0, SKIN_NEAR, CLOTH_NEAR, hl, 1, 0.25, s === "R", true));
  const seat = [add(add(p.pelvis, u1, 8), r1, 14.8), add(add(p.pelvis, u1, -2), r1, 16), add(add(p.pelvis, u1, -10), r1, 4), add(add(p.pelvis, u1, -10), r1, -4), add(add(p.pelvis, u1, -2), r1, -16), add(add(p.pelvis, u1, 8), r1, -14.8)];
  const shorts: Group = {
    path: union(seat, legs[0]!.sleevePts, legs[1]!.sleevePts),
    tone: CLOTH_NEAR,
    halo: 0.25,
    shade: () => {
      plane(ctx, [add(add(p.pelvis, u1, 12), r1, -7), add(add(p.pelvis, u1, -14), r1, -6), add(add(p.pelvis, u1, -14), r1, -30), add(add(p.pelvis, u1, 12), r1, -30)], CLOTH_NEAR.shade, 0.9);
      legs[0]!.sleeveShade();
      legs[1]!.sleeveShade();
      gold(ctx, [add(add(p.pelvis, u1, 7.6), r1, 14.4), add(add(p.pelvis, u1, 7.2), r1, 0), add(add(p.pelvis, u1, 7.6), r1, -14.4)], 0.9, 0.55);
    },
  };
  const legItems: Item[] = [legs[0]!.skin, legs[1]!.skin, legs[0]!.shoe, legs[1]!.shoe];
  // The shoulder joint sits outside the ribcage: the upper arm is drawn a little further out than the rig's shoulder
  // point (the hand stays exactly where the rig puts it, on the equipment).
  const out = (q: Vec, s: "L" | "R", d: number): Vec => add(q, r2, Math.sign(dot([p[`shoulder${s}`][0] - p.neckBase[0], p[`shoulder${s}`][1] - p.neckBase[1]], r2)) * d);
  const arms = (["L", "R"] as const).map((s) => armGroup(ctx, out(p[`shoulder${s}`], s, 3.6), out(p[`elbow${s}`], s, 2.4), p[`hand${s}`], SKIN_NEAR, hl, 1, 0.3, s === "R"));
  // Opt-in (MotionDef.legsInFront): a body seen from above with its thighs raised toward the viewer has its legs, and the
  // shorts over them, in front of the torso.
  const items: Item[] = f.legsInFront
    ? [{ layer: "far" }, { layer: "mid" }, torso, headG, hairG, ...legItems, shorts, { layer: "near" }, ...arms]
    : [{ layer: "far" }, ...legItems, { layer: "mid" }, torso, shorts, headG, hairG, { layer: "near" }, ...arms];
  render(ctx, items, layer);
}

/** A painter for one of the candidate designs (same signature as drawAthlete in athlete.ts). */
export function athleteDesign(name: DesignName) {
  return (ctx: Ctx, f: Frame, layer: LayerFn, hl: Highlight = {}) => {
    applyDesign(name);
    queue = [];
    curClip = null;
    if (f.view === "side") drawSide(ctx, f, layer, hl);
    else drawFront(ctx, f, layer, hl);
  };
}
