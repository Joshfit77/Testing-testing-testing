/**
 * More equipment in the athlete look (matte graphite and steel with thin gold edges, see props-athlete.ts), opted into
 * by a prop's `variant` ("kit-…"). Nothing else changes how it is drawn:
 *  - kit-wall: a wall seen edge-on from the front (a throw's target), its face at `at` x, the wall itself to screen left.
 *  - kit-band: a flat elastic band from `at` to `to` (both hands), drawn over the arms so it never hides behind them.
 *  - kit-landmine: a landmine bar seen from the front, from its pivot in the foreground (`at`) to the hands (`to`), with
 *    a small plate on the sleeve just below the hands and the sleeve's end showing past them.
 *  - kit-sled + kit-ropetail + kit-ctrl: an arm-over-arm sled pull. The sled creeps toward the lifter as the rope is
 *    pulled in; the taut rope runs from the sled to the leading gripping hand, between the hands while both hold it, and
 *    the pulled-in rope falls to a pile at the feet. Two invisible control props carry, per keyframe, the sled's
 *    progress through the loop (as a point on a circle, so it wraps without running backwards) and how firmly each hand
 *    grips the rope. At the loop's seam the sled cross-fades back to its starting distance.
 */
import { add, landmarkDepth, len, sub, yawShift } from "./skeleton";
import type { Frame, ResolvedProp, Vec } from "./types";

type Ctx = CanvasRenderingContext2D;

const GOLD = "226,184,96";
const STEEL_HI = "#d6dade";
const STEEL = "#8d939a";
const STEEL_LO = "#3a3e43";
const IRON_HI = "#3c3c3f";
const IRON = "#18181a";
const IRON_LO = "#070707";
const FRAME_HI = "#5a5f66";
const FRAME = "#26282c";
const FRAME_LO = "#0f1012";

const lerpV = (a: Vec, b: Vec, t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

function steelGrad(ctx: Ctx, a: Vec, b: Vec) {
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  g.addColorStop(0, STEEL_HI);
  g.addColorStop(0.45, STEEL);
  g.addColorStop(1, STEEL_LO);
  return g;
}

/** A tube from a to b shaded across its width. */
function tube(ctx: Ctx, a: Vec, b: Vec, w: number, hi = FRAME_HI, mid = FRAME, lo = FRAME_LO, cap: CanvasLineCap = "round") {
  const d = sub(b, a);
  const L = len(d) || 0.001;
  const n: Vec = [-d[1] / L, d[0] / L];
  const g = ctx.createLinearGradient(a[0] + n[0] * w * 0.5, a[1] + n[1] * w * 0.5, a[0] - n[0] * w * 0.5, a[1] - n[1] * w * 0.5);
  g.addColorStop(0, hi);
  g.addColorStop(0.4, mid);
  g.addColorStop(1, lo);
  ctx.strokeStyle = g;
  ctx.lineWidth = w;
  ctx.lineCap = cap;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

// ------------------------------------------------------------------------------------------------------ Wall

/** A solid wall seen edge-on: its face (toward the lifter) at x, the wall running off to screen left into the dark. */
function wall(ctx: Ctx, x: number, thick: number) {
  const H = 250;
  const g = ctx.createLinearGradient(x, 0, x - thick * 2.2, 0);
  g.addColorStop(0, "#2a2b2f");
  g.addColorStop(0.3, "#18191c");
  g.addColorStop(1, "rgba(12,12,13,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - thick * 2.2, 0, thick * 2.2, H);
  // Block joints, faint.
  ctx.strokeStyle = `rgba(${GOLD},0.07)`;
  ctx.lineWidth = 0.4;
  for (let y = 30; y < H; y += 30) {
    ctx.beginPath();
    ctx.moveTo(x - thick * 1.6, y);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  // The face: a lit strip with a gold edge.
  const f = ctx.createLinearGradient(x - 2.4, 0, x, 0);
  f.addColorStop(0, "#2e3034");
  f.addColorStop(1, "#4a4e55");
  ctx.fillStyle = f;
  ctx.fillRect(x - 2.4, 0, 2.4, H);
  ctx.strokeStyle = `rgba(${GOLD},0.7)`;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, H);
  ctx.stroke();
}

// ------------------------------------------------------------------------------------------------------ Band

/** A flat gold elastic band between the hands: thinner as it stretches, a little slack when short. */
function band(ctx: Ctx, a: Vec, b: Vec) {
  const d = len(sub(b, a));
  const w = Math.max(1.5, 3 - d / 110);
  const sag = Math.max(0, 6 - d / 9);
  const m: Vec = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag * 2];
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]);
  };
  ctx.lineCap = "round";
  path();
  ctx.strokeStyle = "rgba(6,6,6,0.9)";
  ctx.lineWidth = w + 1;
  ctx.stroke();
  path();
  const g = ctx.createLinearGradient(0, a[1] + w, 0, a[1] - w);
  g.addColorStop(0, "#f0cd7a");
  g.addColorStop(0.5, "#cf9f3e");
  g.addColorStop(1, "#7d5a1c");
  ctx.strokeStyle = g;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.save();
  ctx.translate(0, w * 0.22);
  path();
  ctx.strokeStyle = "rgba(255,244,214,0.35)";
  ctx.lineWidth = w * 0.25;
  ctx.stroke();
  ctx.restore();
}

// --------------------------------------------------------------------------------------------------- Landmine

/**
 * A landmine bar seen from in front: the pivot sleeve on its base plate in the foreground, the bar rising to the hands,
 * a plate on the loaded sleeve a little before the hands (tilted toward the viewer) and the sleeve's end past the grip.
 */
function landmine(ctx: Ctx, pivot: Vec, hands: Vec, plateR: number) {
  const d = sub(hands, pivot);
  const L = len(d) || 1;
  const u: Vec = [d[0] / L, d[1] / L];
  const n: Vec = [-u[1], u[0]];
  // Base plate and the pivot's sleeve.
  ctx.save();
  ctx.translate(pivot[0], pivot[1]);
  ctx.scale(1, 0.26);
  const bg = ctx.createRadialGradient(-4, 6, 1, 0, 0, 18);
  bg.addColorStop(0, IRON_HI);
  bg.addColorStop(1, IRON_LO);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(${GOLD},0.55)`;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
  tube(ctx, pivot, add(pivot, u, 9), 6.2, FRAME_HI, FRAME, FRAME_LO, "butt");
  const collarAt = Math.max(12, L - 30);
  const plateAt = Math.max(14, L - 15);
  // Bar (shaft) to the collar, then the thicker sleeve through the plate and past the hands.
  tube(ctx, add(pivot, u, 6), add(pivot, u, collarAt), 2.7, STEEL_HI, STEEL, STEEL_LO);
  tube(ctx, add(pivot, u, collarAt), add(pivot, u, L + 6), 3.6, STEEL_HI, STEEL, STEEL_LO, "butt");
  // Collar.
  tube(ctx, add(pivot, u, collarAt - 1.2), add(pivot, u, collarAt + 1.2), 5.4, STEEL_HI, STEEL, STEEL_LO, "butt");
  // Plate: an ellipse across the bar (its face turned mostly toward the viewer).
  const c = add(pivot, u, plateAt);
  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.rotate(Math.atan2(n[1], n[0]));
  const pg = ctx.createRadialGradient(plateR * 0.25, plateR * 0.2, 1, 0, 0, plateR);
  pg.addColorStop(0, IRON_HI);
  pg.addColorStop(0.65, IRON);
  pg.addColorStop(1, IRON_LO);
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.ellipse(0, 0, plateR, plateR * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(${GOLD},0.8)`;
  ctx.lineWidth = 0.55;
  ctx.stroke();
  ctx.strokeStyle = `rgba(${GOLD},0.28)`;
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.ellipse(0, 0, plateR * 0.58, plateR * 0.58 * 0.72, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = steelGrad(ctx, [2, 2], [-2, -2]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.6, 2.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The sleeve continues above the plate to the grip (drawn again so it crosses in front of the plate's hub).
  tube(ctx, add(pivot, u, plateAt + 2), add(pivot, u, L + 6), 3.6, STEEL_HI, STEEL, STEEL_LO, "butt");
}

// ------------------------------------------------------------------------------------------------- Sled pull

const SLED_LEN = 86;
/** The hitch (where the rope is tied) relative to the sled's centre on the floor. */
const HITCH: Vec = [-SLED_LEN / 2 - 4, 9];

/** A low drag sled seen from the side: steel runners turned up at both ends, a deck, a post with plates stacked on it. */
function sled(ctx: Ctx, x: number) {
  const h = SLED_LEN / 2;
  // Runners.
  tube(ctx, [x - h + 6, 1.6], [x + h - 6, 1.6], 3.2, FRAME_HI, FRAME, FRAME_LO);
  for (const s of [-1, 1]) {
    ctx.strokeStyle = FRAME;
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + s * (h - 6), 1.6);
    ctx.quadraticCurveTo(x + s * (h + 2), 1.6, x + s * (h + 3), 9);
    ctx.stroke();
  }
  // Deck and uprights.
  tube(ctx, [x - h + 8, 7], [x + h - 8, 7], 3, FRAME_HI, FRAME, FRAME_LO, "butt");
  tube(ctx, [x - h + 14, 2], [x - h + 14, 7], 2.4);
  tube(ctx, [x + h - 14, 2], [x + h - 14, 7], 2.4);
  // Post with three plates stacked flat (seen edge-on).
  tube(ctx, [x, 8], [x, 34], 3.4, STEEL_HI, STEEL, STEEL_LO, "butt");
  for (let i = 0; i < 3; i++) {
    const y = 9 + i * 5.2;
    rrect(ctx, x - 22, y, 44, 4.6, 1.6);
    const g = ctx.createLinearGradient(0, y + 4.6, 0, y);
    g.addColorStop(0, IRON_HI);
    g.addColorStop(0.5, IRON);
    g.addColorStop(1, IRON_LO);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD},0.7)`;
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }
  // Hitch ring at the front.
  const hp: Vec = [x + HITCH[0], HITCH[1]];
  tube(ctx, [x - h + 8, 7], hp, 2, FRAME_HI, FRAME, FRAME_LO);
  ctx.strokeStyle = STEEL;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(hp[0], hp[1], 2.2, 0, Math.PI * 2);
  ctx.stroke();
}

/** A thick braided rope along a polyline (quadratic smoothing between midpoints). */
function rope(ctx: Ctx, pts: Vec[], w = 3.8) {
  if (pts.length < 2) return;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0]![0], pts[0]![1]);
    if (pts.length === 2) ctx.lineTo(pts[1]![0], pts[1]![1]);
    else {
      for (let i = 1; i < pts.length - 1; i++) {
        const p = pts[i]!;
        const q = pts[i + 1]!;
        const m: Vec = i === pts.length - 2 ? q : [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
      }
    }
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  path();
  ctx.strokeStyle = "#060606";
  ctx.lineWidth = w + 0.9;
  ctx.stroke();
  path();
  ctx.strokeStyle = "#3a3324";
  ctx.lineWidth = w;
  ctx.stroke();
  path();
  ctx.setLineDash([1.4, 1.6]);
  ctx.strokeStyle = `rgba(${GOLD},0.42)`;
  ctx.lineWidth = w * 0.42;
  ctx.stroke();
  ctx.setLineDash([]);
}

/** A slightly sagging segment from a to b, as points (for `rope`). */
function sagging(a: Vec, b: Vec, sag: number, n = 6): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = lerpV(a, b, t);
    out.push([p[0], p[1] - sag * 4 * t * (1 - t)]);
  }
  return out;
}

interface RopeState {
  /** The sled's progress through the loop, 0..1. */
  u: number;
  /** Grip of the near (R) and far (L) hand on the rope, 0..1. */
  gR: number;
  gL: number;
  hR: Vec;
  hL: Vec;
  /** Where the pulled-in rope lands on the floor. */
  pile: Vec;
}

function ropeState(f: Frame): RopeState {
  const find = (id: string) => f.props.find((p) => p.def.id === id)?.at ?? ([1, 0] as Vec);
  const c = find("ctrlU");
  const g = find("ctrlG");
  const u = (((Math.atan2(c[1], c[0]) / (2 * Math.PI)) % 1) + 1) % 1;
  // The hands as the athlete look's camera draws them (near hand shifted back, far hand forward).
  const hR: Vec = [f.pts.handR[0] + yawShift(landmarkDepth("handR")), f.pts.handR[1]];
  const hL: Vec = [f.pts.handL[0] + yawShift(landmarkDepth("handL")), f.pts.handL[1]];
  const toe = f.pts.toeR[0] + yawShift(landmarkDepth("toeR"));
  return { u, gR: Math.min(1, Math.max(0, g[0])), gL: Math.min(1, Math.max(0, g[1])), hR, hL, pile: [toe + 14, 1.4] };
}

/** The rope's path from the hitch through the gripping hands (front one first) to the point where it leaves the last. */
function ropeThroughHands(s: RopeState, hitch: Vec): { taut: Vec[]; between: Vec[] | null; last: Vec } {
  const hands = [
    { h: s.hR, g: s.gR },
    { h: s.hL, g: s.gL },
  ]
    .filter((x) => x.g > 0.001)
    .sort((a, b) => b.h[0] - a.h[0]);
  if (!hands.length) return { taut: [hitch, s.pile], between: null, last: s.pile };
  // A hand letting go: the rope it held drifts from the hand toward the straight line it falls back to.
  const front = hands[0]!;
  const lineFront = (q: Vec): Vec => {
    // Closest point to q on the segment hitch → pile.
    const d = sub(s.pile, hitch);
    const t = Math.min(1, Math.max(0, ((q[0] - hitch[0]) * d[0] + (q[1] - hitch[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1])));
    return lerpV(hitch, s.pile, t);
  };
  const f0 = lerpV(lineFront(front.h), front.h, smooth(front.g));
  if (hands.length === 1) return { taut: [hitch, f0], between: null, last: f0 };
  const rear = hands[1]!;
  const lineRear = (q: Vec): Vec => {
    const d = sub(s.pile, f0);
    const L2 = d[0] * d[0] + d[1] * d[1] || 1;
    const t = Math.min(1, Math.max(0, ((q[0] - f0[0]) * d[0] + (q[1] - f0[1]) * d[1]) / L2));
    return lerpV(f0, s.pile, t);
  };
  const r0 = lerpV(lineRear(rear.h), rear.h, smooth(rear.g));
  return { taut: [hitch, f0], between: sagging(f0, r0, 1.5, 4), last: r0 };
}

/** The sled and the taut rope to the hands (one copy, at the sled position x). */
function sledAndRope(ctx: Ctx, s: RopeState, x: number) {
  sled(ctx, x);
  const hitch: Vec = [x + HITCH[0], HITCH[1]];
  const r = ropeThroughHands(s, hitch);
  rope(ctx, sagging(r.taut[0]!, r.taut[1]!, 1.2, 8));
  if (r.between) rope(ctx, r.between);
}

function sledScene(ctx: Ctx, p: ResolvedProp, f: Frame) {
  const s = ropeState(f);
  const travel = p.def.size ?? 100;
  const x0 = p.at[0];
  const x = x0 - travel * s.u;
  // Cross-fade back to the starting distance over the last part of the loop.
  const k = smooth((s.u - 0.9) / 0.1);
  const a = ctx.globalAlpha;
  if (k < 1) {
    ctx.globalAlpha = a * (1 - k);
    sledAndRope(ctx, s, x);
  }
  if (k > 0) {
    ctx.globalAlpha = a * k;
    sledAndRope(ctx, s, x + travel);
  }
  ctx.globalAlpha = a;
}

/** The pulled-in rope: from where it leaves the last gripping hand down to a loose pile in front of the feet. */
function ropeTail(ctx: Ctx, p: ResolvedProp, f: Frame) {
  const s = ropeState(f);
  const sledP = f.props.find((q) => q.def.variant === "kit-sled");
  const x = sledP ? sledP.at[0] - (sledP.def.size ?? 100) * s.u : p.at[0];
  const r = ropeThroughHands(s, [x + HITCH[0], HITCH[1]]);
  const a = r.last;
  // Hangs down from the hand and lies on the floor in a few loose coils.
  const pile = s.pile;
  const drop: Vec[] = [a, [a[0] + 2, (a[1] + pile[1]) * 0.55], [pile[0] - 4, pile[1] + 6], pile, [pile[0] - 18, 1.4], [pile[0] - 30, 1.6]];
  if (len(sub(a, pile)) > 2) rope(ctx, drop);
  // Coils on the floor (seen almost edge-on).
  for (const [dx, rx] of [
    [-12, 16],
    [-20, 13],
  ] as const) {
    ctx.save();
    ctx.translate(pile[0] + dx, 2.2);
    ctx.scale(1, 0.16);
    ctx.strokeStyle = "#060606";
    ctx.lineWidth = 3.6 / 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(pile[0] + dx, 2.2);
    ctx.scale(1, 0.16);
    ctx.strokeStyle = "#3a3324";
    ctx.lineWidth = 2.6 / 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** Draw a "kit-" prop in the athlete look. Returns false for a variant it does not know. */
export function drawKitProp(ctx: Ctx, p: ResolvedProp, f: Frame): boolean {
  switch (p.def.variant) {
    case "kit-wall":
      wall(ctx, p.at[0], p.def.w ?? 20);
      return true;
    case "kit-band":
      if (p.to) band(ctx, p.at, p.to);
      return true;
    case "kit-landmine":
      if (p.to) landmine(ctx, p.at, p.to, p.def.size ?? 14);
      return true;
    case "kit-sled":
      sledScene(ctx, p, f);
      return true;
    case "kit-ropetail":
      ropeTail(ctx, p, f);
      return true;
    case "kit-ctrl":
      return true;
    default:
      return false;
  }
}
