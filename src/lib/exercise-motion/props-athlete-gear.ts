/**
 * The rest of the equipment in the "athlete" look (props-athlete.ts draws the barbell, plates, dumbbells, rack, bench
 * and cable station): bands, the trap bar, strongman implements, sleds, the bikes and the leg machines, in the same
 * matte graphite and iron with thin gold edges, seen with the athlete's camera (CAMERA_YAW in skeleton.ts).
 *
 * These pieces sit at more than one depth: the half of a trap bar or a pair of dip bars beside the near side of the body
 * is drawn over the near leg and under the near hand, the far half behind the whole athlete; a leg machine's lever runs
 * on the far side of the legs while its roller pad crosses in front of both shins. So each kind is drawn part by part:
 * `drawGearAthlete` is called once per drawing layer and paints only the parts that belong to that layer.
 *
 * Only the drawing changes here: every prop keeps the positions its motion gives it (where a hand holds it, the part in
 * the hand is drawn where the athlete's hand is drawn).
 */
import { BODY, add, landmarkDepth, len, sub, yawShift } from "./skeleton";
import {
  FAR_SCALE,
  FRAME,
  FRAME_HI,
  FRAME_LO,
  GOLD,
  IRON,
  IRON_HI,
  IRON_LO,
  LEATHER,
  LEATHER_HI,
  NEAR_SCALE,
  STEEL_HI,
  STEEL,
  STEEL_LO,
  cushion,
  plateFace,
  rrect,
  steel,
  tube,
} from "./props-athlete";
import type { Anchor, Frame, Landmark, PropDef, ResolvedProp, Vec } from "./types";

type Ctx = CanvasRenderingContext2D;
type Layer = NonNullable<PropDef["layer"]>;

/** Depth of the athlete's drawn arms and legs (the camera shifts them by these, see athlete.ts). */
const Z_ARM = BODY.shoulderHalf;
const Z_LEG = BODY.hipHalf;

interface Gear {
  ctx: Ctx;
  p: ResolvedProp;
  f: Frame;
  t: number;
  /** The layer being drawn. */
  layer: string;
  /** The prop's own layer (its main parts). */
  main: Layer;
  side: boolean;
  /** A world point `z` cm toward the viewer, as the athlete look's camera sees it (side view only). */
  Y: (q: Vec, z: number) => Vec;
}

// ------------------------------------------------------------------------------------------------ Drawing helpers

const unit = (v: Vec): Vec => {
  const L = len(v) || 1;
  return [v[0] / L, v[1] / L];
};
const lerp2 = (a: Vec, b: Vec, k: number): Vec => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/** A graphite tube (frame member) with a thin gold line along its lit edge. */
function frameTube(ctx: Ctx, a: Vec, b: Vec, w: number, gold = 0.35) {
  tube(ctx, a, b, w);
  if (gold <= 0) return;
  const d = unit(sub(b, a));
  const n: Vec = [-d[1], d[0]];
  // The edge facing up / toward the light.
  const s = n[1] >= 0 ? 1 : -1;
  const o = (w / 2 - 0.35) * s;
  ctx.strokeStyle = `rgba(${GOLD},${gold})`;
  ctx.lineWidth = 0.32;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a[0] + n[0] * o, a[1] + n[1] * o);
  ctx.lineTo(b[0] + n[0] * o, b[1] + n[1] * o);
  ctx.stroke();
}

/** A polyline of graphite tube (bent frame members). */
function framePath(ctx: Ctx, pts: Vec[], w: number, gold = 0.35) {
  for (let i = 0; i + 1 < pts.length; i++) frameTube(ctx, pts[i]!, pts[i + 1]!, w, gold);
}

/** Steel bar (shaft, sleeve, handle) from a to b, shaded across its thickness. */
function steelBar(ctx: Ctx, a: Vec, b: Vec, w: number, cap: CanvasLineCap = "round", shadow = 0) {
  const d = unit(sub(b, a));
  const n: Vec = [-d[1], d[0]];
  ctx.strokeStyle = steel(ctx, add(a, n, w / 2), add(a, n, -w / 2));
  ctx.lineWidth = w;
  ctx.lineCap = cap;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  if (shadow > 0) {
    ctx.strokeStyle = `rgba(0,0,0,${shadow})`;
    ctx.stroke();
  }
}

/** A rubber / knurled grip: dark, with a gold edge. */
function grip(ctx: Ctx, a: Vec, b: Vec, w: number) {
  tube(ctx, a, b, w, "#2e2f33", "#151618", "#050506");
  ctx.strokeStyle = `rgba(${GOLD},0.45)`;
  ctx.lineWidth = 0.3;
  const d = unit(sub(b, a));
  const n: Vec = [-d[1], d[0]];
  ctx.beginPath();
  ctx.moveTo(...(add(a, n, w / 2 - 0.3) as [number, number]));
  ctx.lineTo(...(add(b, n, w / 2 - 0.3) as [number, number]));
  ctx.stroke();
}

/**
 * An iron plate on a sleeve running toward / away from the viewer: its rim band between the projected centres of its
 * two faces `a` and `b`, then the face the viewer sees (`face`), as on the barbell (props-athlete.ts).
 */
function plateOnSleeve(ctx: Ctx, a: Vec, b: Vec, r: number, face: Vec, hub: number, shadow = 0) {
  const d = sub(b, a);
  const L = len(d) || 0.001;
  const n: Vec = [-d[1] / L, d[0] / L];
  const band = new Path2D();
  band.moveTo(a[0] + n[0] * r, a[1] + n[1] * r);
  band.lineTo(b[0] + n[0] * r, b[1] + n[1] * r);
  band.lineTo(b[0] - n[0] * r, b[1] - n[1] * r);
  band.lineTo(a[0] - n[0] * r, a[1] - n[1] * r);
  band.closePath();
  band.arc(a[0], a[1], r, 0, Math.PI * 2);
  band.moveTo(b[0] + r, b[1]);
  band.arc(b[0], b[1], r, 0, Math.PI * 2);
  ctx.fillStyle = IRON_LO;
  ctx.fill(band, "nonzero");
  ctx.strokeStyle = `rgba(${GOLD},0.35)`;
  ctx.lineWidth = 0.3;
  ctx.stroke(band);
  plateFace(ctx, face, r, hub);
  if (shadow > 0) {
    ctx.fillStyle = `rgba(0,0,0,${shadow})`;
    ctx.beginPath();
    ctx.arc(face[0], face[1], r + 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A plate lying flat (seen edge-on): a sled's or a carriage's stacked load. */
function plateFlat(ctx: Ctx, c: Vec, w: number, h: number) {
  rrect(ctx, c[0] - w / 2, c[1] - h / 2, w, h, h / 2);
  const g = ctx.createLinearGradient(0, c[1] + h / 2, 0, c[1] - h / 2);
  g.addColorStop(0, IRON_HI);
  g.addColorStop(0.5, IRON);
  g.addColorStop(1, IRON_LO);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = `rgba(${GOLD},0.7)`;
  ctx.lineWidth = 0.4;
  ctx.stroke();
}

/** A padded cylinder across the body (a roller or thigh pad) between its two projected end centres; `a` is the near end. */
function rollerPad(ctx: Ctx, a: Vec, b: Vec, r: number) {
  const d = sub(b, a);
  const L = len(d) || 0.001;
  const n: Vec = [-d[1] / L, d[0] / L];
  const body = new Path2D();
  body.moveTo(a[0] + n[0] * r, a[1] + n[1] * r);
  body.lineTo(b[0] + n[0] * r, b[1] + n[1] * r);
  body.arc(b[0], b[1], r, Math.atan2(n[1], n[0]), Math.atan2(-n[1], -n[0]), d[0] < 0);
  body.lineTo(a[0] - n[0] * r, a[1] - n[1] * r);
  body.closePath();
  const g = ctx.createLinearGradient(a[0], a[1] + r, a[0], a[1] - r);
  g.addColorStop(0, LEATHER_HI);
  g.addColorStop(0.45, LEATHER);
  g.addColorStop(1, "#040404");
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.strokeStyle = `rgba(${GOLD},0.4)`;
  ctx.lineWidth = 0.35;
  ctx.stroke(body);
  // The near end face: leather, a gold rim, the steel end of its axle.
  const fg = ctx.createRadialGradient(a[0] - r * 0.3, a[1] + r * 0.35, r * 0.1, a[0], a[1], r);
  fg.addColorStop(0, "#3d3d40");
  fg.addColorStop(0.7, LEATHER);
  fg.addColorStop(1, "#050505");
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(a[0], a[1], r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(${GOLD},0.85)`;
  ctx.lineWidth = Math.max(0.4, r * 0.07);
  ctx.stroke();
  ctx.fillStyle = steel(ctx, [a[0] + 1, a[1] + 1], [a[0] - 1, a[1] - 1]);
  ctx.beginPath();
  ctx.arc(a[0], a[1], r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

/** A pivot hub: a dark disc with a gold ring and a steel axle. */
function hub(ctx: Ctx, c: Vec, r: number) {
  const g = ctx.createRadialGradient(c[0] - r * 0.3, c[1] + r * 0.35, r * 0.1, c[0], c[1], r);
  g.addColorStop(0, "#4a4d52");
  g.addColorStop(0.6, FRAME);
  g.addColorStop(1, FRAME_LO);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(${GOLD},0.75)`;
  ctx.lineWidth = 0.4;
  ctx.stroke();
  ctx.fillStyle = steel(ctx, [c[0] + 1, c[1] + 1], [c[0] - 1, c[1] - 1]);
  ctx.beginPath();
  ctx.arc(c[0], c[1], r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

/** A rounded foot / end cap on the floor (a stabiliser seen end-on). */
function foot(ctx: Ctx, x: number, w: number, h = 4.5) {
  rrect(ctx, x - w / 2, 0, w, h, 1.6);
  const g = ctx.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, FRAME_HI);
  g.addColorStop(0.5, FRAME);
  g.addColorStop(1, FRAME_LO);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = `rgba(${GOLD},0.4)`;
  ctx.lineWidth = 0.3;
  ctx.stroke();
}

/**
 * A flat elastic band through `pts`: graphite with gold edges (the default resistance band), or gold webbing with dark
 * edges (variant "gold": a strap or light band).
 */
function ribbon(ctx: Ctx, pts: Vec[], w: number, gold: boolean) {
  if (pts.length < 2) return;
  const L: Vec[] = [];
  const R: Vec[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const d = unit(sub(b, a));
    const n: Vec = [-d[1], d[0]];
    L.push(add(pts[i]!, n, w / 2));
    R.push(add(pts[i]!, n, -w / 2));
  }
  const path = new Path2D();
  path.moveTo(L[0]![0], L[0]![1]);
  for (const q of L.slice(1)) path.lineTo(q[0], q[1]);
  for (const q of R.reverse()) path.lineTo(q[0], q[1]);
  path.closePath();
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  if (gold) {
    g.addColorStop(0, "#b8913e");
    g.addColorStop(0.5, "#d9b45c");
    g.addColorStop(1, "#9c7a2e");
  } else {
    g.addColorStop(0, "#2c2d31");
    g.addColorStop(0.5, "#1a1b1e");
    g.addColorStop(1, "#2c2d31");
  }
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.lineJoin = "round";
  ctx.strokeStyle = gold ? "rgba(60,40,8,0.75)" : `rgba(${GOLD},0.85)`;
  ctx.lineWidth = gold ? 0.35 : 0.4;
  ctx.stroke(path);
  // A sheen along the middle.
  ctx.strokeStyle = gold ? "rgba(255,240,200,0.35)" : `rgba(${GOLD},0.3)`;
  ctx.lineWidth = Math.max(0.25, w * 0.18);
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]);
  ctx.stroke();
}

/** Points along a quadratic curve. */
function quad(a: Vec, m: Vec, b: Vec, n = 18): Vec[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    return [(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * m[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * m[1] + u * u * b[1]];
  });
}

/** A steel ring (a band's anchor, a tow ring). */
function ring(ctx: Ctx, c: Vec, r: number) {
  ctx.strokeStyle = steel(ctx, [c[0] + r, c[1] + r], [c[0] - r, c[1] - r]);
  ctx.lineWidth = Math.max(0.8, r * 0.45);
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${GOLD},0.5)`;
  ctx.lineWidth = 0.25;
  ctx.stroke();
}

// ------------------------------------------------------------------------------------------------ Kinds

/** The landmark an anchor follows, if any. */
const anchorLm = (a: Anchor | undefined): Landmark | undefined => (a && !Array.isArray(a) ? a.lm : undefined);

/**
 * Resistance band / strap. The ends tied to the body are drawn where the athlete's hand, knee or head is drawn. A band
 * held in both hands from one anchor ("hands") runs as two strands, one to each hand: the far strand behind the
 * athlete. A loop around both knees (front view) wraps round the outside of each leg.
 */
function band(g: Gear) {
  const { ctx, p, f, Y } = g;
  const def = p.def;
  if (!p.to) return;
  const gold = def.variant === "gold";
  const la = anchorLm(def.at);
  const lb = anchorLm(def.to);
  // Where an end is drawn: a hand where the athlete's hand is drawn (its own depth; the classic look's sideways offsets
  // only made the band visible without that camera), other landmarks at their own depth, fixed anchors as they are.
  const endOf = (anchor: Anchor | undefined, at: Vec): Vec => {
    const lm = anchorLm(anchor);
    if (!g.side || !lm || Array.isArray(anchor)) return at;
    const a = anchor as { lm: Landmark; dx?: number; dy?: number; y?: number };
    if (/^hand[LR]$/.test(lm)) return Y([f.pts[lm][0], a.y ?? f.pts[lm][1] + (a.dy ?? 0)], landmarkDepth(lm));
    return Y(at, landmarkDepth(lm));
  };
  const strand = (a: Vec, b: Vec, sagScale = 1) => {
    const stretch = len(sub(b, a));
    const w = Math.max(1.5, 2.8 - stretch / 110);
    const sag = Math.max(0, 14 - stretch / 6) * sagScale;
    return { pts: quad(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag], b), w };
  };
  const isMain = g.layer === g.main;
  // Two hands on one band: two strands (side view).
  if (g.side && (la === "hands" || lb === "hands")) {
    const fixedEnd = la === "hands" ? endOf(def.to, p.to) : endOf(def.at, p.at);
    const hand = (s: "L" | "R") => Y(f.pts[`hand${s}`], s === "R" ? Z_ARM : -Z_ARM);
    if (g.layer === "back") {
      const s = strand(fixedEnd, hand("L"));
      ribbon(ctx, s.pts, s.w * 0.9, gold);
    }
    if (isMain) {
      const s = strand(fixedEnd, hand("R"));
      ribbon(ctx, s.pts, s.w, gold);
      if (!anchorLm(la === "hands" ? def.to : def.at)) ring(ctx, fixedEnd, 1.6);
    }
    return;
  }
  if (!isMain) return;
  let a = endOf(def.at, p.at);
  let b = endOf(def.to, p.to);
  // Both ends in the hands (side view): the band stretched between the drawn hands, with short tails past each fist.
  if (g.side && la && lb && /^hand[LR]$/.test(la) && /^hand[LR]$/.test(lb)) {
    const d = unit(sub(b, a));
    a = add(a, d, -9);
    b = add(b, d, 9);
    ribbon(ctx, [a, b], 2.6, gold);
    return;
  }
  // A loop round both legs (front view): across the front of both thighs and round the outside of each.
  if (!g.side && la && lb && /^(knee|thigh)[LR]$/.test(la) && /^(knee|thigh)[LR]$/.test(lb)) {
    const d = unit(sub(b, a));
    const n: Vec = [-d[1], d[0]];
    const out = 6.5;
    const pts: Vec[] = [add(add(a, d, -out), n, -1.6), add(a, d, -out + 1.4), ...quad(a, lerp2(a, b, 0.5), b, 8), add(b, d, out - 1.4), add(add(b, d, out), n, -1.6)];
    ribbon(ctx, pts, 2.6, gold);
    return;
  }
  // A loop hanging from a bar under one knee (band-assisted pull-up): two strands down to the knee and a U under it.
  if (g.side && lb && /^knee[LR]$/.test(lb) && !la) {
    const knee = Y(f.pts[lb], landmarkDepth(lb));
    const shin = unit(sub(f.pts[lb === "kneeR" ? "ankleR" : "ankleL"], f.pts[lb]));
    const n: Vec = [-shin[1], shin[0]];
    const r = BODY.r.knee + 1.6;
    const front = add(add(knee, n, r), shin, 1.5);
    const back = add(add(knee, n, -r), shin, 1.5);
    const u: Vec[] = [];
    for (let i = 0; i <= 10; i++) {
      const ang = Math.atan2(n[1], n[0]) - (Math.PI * i) / 10;
      u.push([knee[0] + Math.cos(ang) * r + shin[0] * 1.5, knee[1] + Math.sin(ang) * r + shin[1] * 1.5]);
    }
    // An assistance band is wide (about 3 cm).
    const top = a;
    ribbon(ctx, [add(top, [1.8, 0]), back], 3, gold);
    ribbon(ctx, [add(top, [-1.8, 0]), front], 3, gold);
    ribbon(ctx, u, 3, gold);
    ring(ctx, top, 2.6);
    return;
  }
  const s = strand(a, b);
  ribbon(ctx, s.pts, s.w, gold);
  if (!la) ring(ctx, a, 1.6);
  if (!lb) ring(ctx, b, 1.6);
}

/**
 * Trap (hex) bar seen from the side: the hexagonal frame is edge-on (a rail at handle height running past the front of
 * the shins and behind the calves), the handles run alongside the body under the hands, and the sleeves stick out to
 * the plates beside the lifter. Near half over the near leg and under the near hand, far half behind the athlete.
 */
function trapBar(g: Gear) {
  const { ctx, p } = g;
  if (!g.side) return;
  const half = g.layer === "near" ? 1 : g.layer === "back" ? -1 : 0;
  if (!half) return;
  const c = p.at;
  const r0 = p.def.size ?? 22.5;
  const sc = half > 0 ? NEAR_SCALE : FAR_SCALE;
  const shadow = half > 0 ? 0 : 0.45;
  const P = (x: number, z: number): Vec => [c[0] + x + yawShift(z * half) * (z > Z_ARM ? sc : 1), c[1]];
  // Hexagon (x along the lifter, z outward): front / back rails at |z| ≤ 14, angled sides to the sleeve at z = 40.
  const FR = 31;
  const ZR = 14;
  const ZS = 40;
  framePath(ctx, [P(-FR, 0), P(-FR, ZR), P(0, ZS), P(FR, ZR), P(FR, 0)], 3.8, 0.6);
  // The handle under the hand: a grip from the back angled side to the front one, at the hand's depth.
  const hz = Z_ARM;
  const k = (ZS - hz) / (ZS - ZR);
  grip(ctx, P(-FR * k, hz), P(FR * k, hz), 3.6);
  if (shadow) {
    ctx.strokeStyle = `rgba(0,0,0,${shadow})`;
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(...(P(-FR, 0) as [number, number]));
    ctx.lineTo(...(P(FR, 0) as [number, number]));
    ctx.stroke();
  }
  // Sleeve and two plates.
  const r = r0 * sc;
  const z0 = ZS + 3;
  if (half > 0) {
    steelBar(ctx, P(0, ZS), P(0, z0 + 10), 4.2 * sc, "butt");
    plateOnSleeve(ctx, P(0, z0), P(0, z0 + 5), r, P(0, z0 + 5), 0);
    plateOnSleeve(ctx, P(0, z0 + 5), P(0, z0 + 10), r, P(0, z0 + 10), 0);
    steelBar(ctx, P(0, z0 + 10), P(0, z0 + 19), 4.2 * sc, "butt");
  } else {
    steelBar(ctx, P(0, z0 + 10), P(0, z0 + 19), 4.2 * sc, "butt", shadow);
    plateOnSleeve(ctx, P(0, z0 + 10), P(0, z0 + 5), r, P(0, z0 + 5), 0, shadow);
    plateOnSleeve(ctx, P(0, z0 + 5), P(0, z0), r, P(0, z0), 0, shadow);
  }
}

/**
 * Strongman farmer's walk handles: one frame in each hand, running along the body, with plates on pins at both ends.
 * The near one is drawn at the near hand over the near leg, the far one at the far hand behind the athlete.
 */
function farmerHandle(g: Gear) {
  const { ctx, p, f, Y } = g;
  const near = g.layer === "near";
  if (!near && g.layer !== "back") return;
  const s = near ? "R" : "L";
  const z = near ? Z_ARM : -Z_ARM;
  const hand = f.pts[`hand${s}`];
  // Keep the implement level: it hangs from the fist.
  const L = (p.def.w ?? 120) / 2;
  const at = (x: number, dz: number): Vec => Y([hand[0] + x, hand[1]], z + dz * (near ? 1 : -1));
  const sc = near ? 1 : 0.92;
  const shadow = near ? 0 : 0.45;
  frameTube(ctx, at(-L + 4, 0), at(L - 4, 0), 4.4, 0.5);
  grip(ctx, at(-7, 0), at(7, 0), 4.8);
  for (const x of [-L + 6, L - 6]) {
    steelBar(ctx, at(x, 0), at(x, 12), 4, "butt");
    // Two plates on the pin, painted far to near (the near implement shows its outer faces, the far one its inner).
    const plates: [number, number][] = near ? [[3, 7], [7, 11]] : [[7, 11], [3, 7]];
    for (const [z0, z1] of plates) plateOnSleeve(ctx, at(x, z0), at(x, z1), 20 * sc, at(x, near ? z1 : z0), near ? 2.2 : 0, shadow);
  }
}

/**
 * Strongman log: a thick steel cylinder across the body, the hands on the neutral handles inside it. Seen with the
 * camera, its near end face shows behind the hands and its far end in front.
 */
function logBar(g: Gear) {
  const { ctx, p } = g;
  const half = g.layer === "near" ? 1 : g.layer === "back" ? -1 : 0;
  if (!half || !g.side) return;
  const c = p.at;
  const R = p.def.size ?? 15;
  const sc = half > 0 ? NEAR_SCALE : FAR_SCALE;
  const end: Vec = [c[0] + yawShift(70 * half) * sc, c[1]];
  const r = R * sc;
  // The cylinder's side from its middle to this end.
  rrect(ctx, Math.min(c[0], end[0]), c[1] - r, Math.abs(end[0] - c[0]), 2 * r, 0);
  const gr = ctx.createLinearGradient(0, c[1] + r, 0, c[1] - r);
  gr.addColorStop(0, "#4a4c51");
  gr.addColorStop(0.35, "#232428");
  gr.addColorStop(1, "#08090a");
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.strokeStyle = `rgba(${GOLD},0.55)`;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(c[0], c[1] + r - 0.3);
  ctx.lineTo(end[0], end[1] + r - 0.3);
  ctx.moveTo(c[0], c[1] - r + 0.3);
  ctx.lineTo(end[0], end[1] - r + 0.3);
  ctx.stroke();
  // Weld seams.
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.6;
  const seam = lerp2(c, end, 0.55);
  ctx.beginPath();
  ctx.moveTo(seam[0], seam[1] - r);
  ctx.lineTo(seam[0], seam[1] + r);
  ctx.stroke();
  if (half > 0) {
    // The near end face: a capped steel drum with a gold rim and a short loading sleeve.
    plateFace(ctx, end, r, 0);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.arc(end[0], end[1], r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    steelBar(ctx, end, [end[0] - 2.4, end[1]], 5, "butt");
    ctx.fillStyle = steel(ctx, [end[0] + 2, end[1] + 2], [end[0] - 2, end[1] - 2]);
    ctx.beginPath();
    ctx.arc(end[0] - 2.4, end[1], 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#0a0a0b";
    ctx.beginPath();
    ctx.arc(end[0], end[1], r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD},0.35)`;
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }
}

/**
 * Yoke: a crossbar on the upper back, an upright down each side to the floor with plates on pins at its foot. The near
 * upright stands beside the near side of the body (drawn over the near leg), the far one behind the athlete.
 */
function yoke(g: Gear) {
  const { ctx, p } = g;
  const half = g.layer === "near" ? 1 : g.layer === "back" ? -1 : 0;
  if (!half || !g.side) return;
  const c = p.at;
  const sc = half > 0 ? NEAR_SCALE : FAR_SCALE;
  const P = (x: number, y: number, z: number): Vec => [c[0] + x + yawShift(z * half) * sc, y];
  const shadow = half > 0 ? 0 : 0.45;
  const ZU = 58;
  const top = c[1] + 4;
  // Crossbar from the middle (on the traps) to the upright.
  steelBar(ctx, [c[0], c[1]], P(0, c[1], ZU), 4.6 * sc, "round", shadow);
  // Upright, its foot (front–back) and the braces.
  frameTube(ctx, P(0, top, ZU), P(0, 7, ZU), 5.6 * sc, 0.5);
  frameTube(ctx, P(-24, 4, ZU), P(24, 4, ZU), 5 * sc, 0.5);
  frameTube(ctx, P(-16, 5, ZU), P(0, 26, ZU), 3 * sc, 0.3);
  frameTube(ctx, P(16, 5, ZU), P(0, 26, ZU), 3 * sc, 0.3);
  // Plates on the pin at the foot of the upright, painted far to near (outer faces on the near side, inner on the far).
  const pin = 30;
  steelBar(ctx, P(0, pin, ZU), P(0, pin, ZU + 14), 4 * sc, "butt", shadow);
  const plates: [number, number][] = half > 0 ? [[2, 7], [7, 12]] : [[7, 12], [2, 7]];
  for (const [z0, z1] of plates) plateOnSleeve(ctx, P(0, pin, ZU + z0), P(0, pin, ZU + z1), 21 * sc, P(0, pin, ZU + (half > 0 ? z1 : z0)), half > 0 ? 2.4 : 0, shadow);
  if (half > 0) steelBar(ctx, P(0, pin, ZU + 12), P(0, pin, ZU + 15), 4 * sc, "butt");
  // Cap on the upright.
  rrect(ctx, P(0, top, ZU)[0] - 3.6 * sc, top - 1, 7.2 * sc, 3.2, 1);
  ctx.fillStyle = FRAME_HI;
  ctx.fill();
}

/** Which way a sled's front points: a push sled away from the athlete, a drag sled toward the athlete. */
function sledFacing(p: ResolvedProp, f: Frame): number {
  if (p.def.variant === "push") return 1;
  return p.at[0] < f.pts.pelvis[0] ? 1 : -1;
}
/** Where a drag sled's rope or strap is tied. */
function sledTow(p: ResolvedProp, f: Frame): Vec {
  return [p.at[0] + 40 * sledFacing(p, f), 14];
}
/**
 * Sled: two runners with upturned fronts, a deck, plates stacked flat on the loading post; the push sled's two poles
 * rise to the hands (near pole under the near hand, far pole behind the athlete). A drag sled faces the athlete and has
 * a tow ring at its front, where the rope or strap ends.
 */
function sled(g: Gear) {
  const { ctx, p, f, Y } = g;
  const push = p.def.variant === "push";
  const x = p.at[0];
  const dir = sledFacing(p, f);
  const runner = (z: number, shadow: number) => {
    const P = (dx: number, y: number): Vec => Y([x + dx * dir, y], z);
    framePath(ctx, [P(-42, 2.2), P(34, 2.2)], 4.2, 0.5);
    // Upturned front.
    ctx.lineCap = "round";
    ctx.strokeStyle = FRAME;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    const a = P(34, 2.2);
    const m = P(46, 2.2);
    const b = P(48, 13);
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${GOLD},0.45)`;
    ctx.lineWidth = 0.32;
    ctx.stroke();
    if (shadow) {
      ctx.strokeStyle = `rgba(0,0,0,${shadow})`;
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(...(P(-42, 2.2) as [number, number]));
      ctx.lineTo(...(P(34, 2.2) as [number, number]));
      ctx.stroke();
    }
  };
  const hand = (s: "L" | "R") => Y(f.pts[`hand${s}`], s === "R" ? Z_ARM : -Z_ARM);
  const pole = (z: number, s: "L" | "R") => {
    const base = Y([x - 22, 6], z);
    const h = hand(s);
    const d = unit(sub(h, base));
    frameTube(ctx, base, add(h, d, -6), 4, 0.5);
    grip(ctx, add(h, d, -7), add(h, d, 5), 4.6);
  };
  if (g.layer === "back") {
    runner(-22, 0.4);
    if (push) pole(-22, "L");
  }
  // The rest with the near runner: a push sled (listed in front of the athlete) under the near arm, so the near hand
  // closes over its pole; a drag sled in its own layer.
  if (g.layer !== (g.main === "front" ? "near" : g.main)) return;
  // Deck, post and the stacked plates.
  frameTube(ctx, Y([x - 34 * dir, 5.5], 0), Y([x + 30 * dir, 5.5], 0), 3, 0.4);
  for (let i = 0; i < 3; i++) plateFlat(ctx, Y([x - 2 * dir, 9 + i * 5.2], 0), 44 - i * 2, 4.6);
  steelBar(ctx, Y([x - 2 * dir, 6], 0), Y([x - 2 * dir, 30], 0), 3.2, "round");
  runner(22, 0);
  if (push) pole(22, "R");
  else ring(ctx, sledTow(p, f), 2);
}

/** Rope or strap: thick braided rope with a light highlight; ends at a sled's tow ring when there is a sled. */
function rope(g: Gear) {
  const { ctx, p, f, Y } = g;
  if (g.layer !== g.main || !p.to) return;
  const lm = anchorLm(p.def.at);
  const a = lm && /^hand[LR]$/.test(lm) ? Y(f.pts[lm], landmarkDepth(lm)) : p.at;
  const s = f.props.find((q) => q.def.kind === "sled" && q.def.variant !== "push");
  const b = s ? sledTow(s, f) : p.to;
  const m: Vec = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 8];
  const pts = quad(a, m, b, 24);
  const strap = !!lm && !/^hand/.test(lm);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const path = new Path2D();
  path.moveTo(pts[0]![0], pts[0]![1]);
  for (const q of pts.slice(1)) path.lineTo(q[0], q[1]);
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = strap ? 3 : 3.2;
  ctx.stroke(path);
  ctx.strokeStyle = strap ? "#2a2b2f" : "#5a4a2c";
  ctx.lineWidth = strap ? 2.2 : 2.4;
  ctx.stroke(path);
  ctx.strokeStyle = `rgba(${GOLD},${strap ? 0.55 : 0.45})`;
  ctx.lineWidth = 0.4;
  ctx.setLineDash(strap ? [] : [1.4, 1.2]);
  ctx.stroke(path);
  ctx.setLineDash([]);
  if (strap) {
    // The harness belt's ring at the waist.
    ring(ctx, a, 1.8);
  }
}

/**
 * Leg press, 45°: seat and back pad along the lifter's back, a frame on the floor, the sled riding its rail with the
 * footplate under the feet and plates on the sled's horn.
 */
function legPress(g: Gear) {
  const { ctx, p } = g;
  if (g.layer !== g.main) return;
  const s = p.at;
  const lean = ((p.def.angle ?? -45) * Math.PI) / 180;
  const backDir: Vec = [Math.sin(lean), Math.cos(lean)];
  const behind: Vec = [-Math.cos(lean), Math.sin(lean)];
  const b0 = add(s, behind, 0.5);
  // Frame: floor beams, seat column, back-pad brace.
  frameTube(ctx, [s[0] - 52, 3], [s[0] + 162, 3], 4.6, 0.4);
  foot(ctx, s[0] - 50, 10);
  foot(ctx, s[0] + 160, 10);
  frameTube(ctx, [s[0] + 8, s[1] - 9], [s[0] + 8, 3], 5);
  const brace = add(add(b0, backDir, 38), behind, 8);
  frameTube(ctx, brace, [brace[0] + 4, 3], 4);
  frameTube(ctx, add(b0, behind, 8), brace, 3.4);
  if (p.to) {
    const ft = p.to;
    const n: Vec = [Math.SQRT1_2, -Math.SQRT1_2];
    const dir: Vec = [Math.SQRT1_2, Math.SQRT1_2];
    const a = add(ft, n, 3);
    const plateDir: Vec = [-Math.SQRT1_2, -Math.SQRT1_2];
    const q = add(ft, n, 26);
    const r0 = add(q, dir, Math.max((12 - q[1]) / dir[1], (s[0] + 40 - q[0]) / dir[0]));
    const r1 = add(q, dir, (150 - q[1]) / dir[1]);
    // Rail on two legs.
    frameTube(ctx, r0, [r0[0], 3], 4.4);
    frameTube(ctx, r1, [r1[0], 3], 4.4);
    frameTube(ctx, r0, r1, 5.4, 0.55);
    // Sled: carriage on the rail, footplate under the feet, plates on the horn.
    const c0 = add(a, n, 22);
    frameTube(ctx, add(a, plateDir, -14), add(c0, plateDir, -14), 3.6);
    frameTube(ctx, add(a, plateDir, 12), add(c0, plateDir, 12), 3.6);
    frameTube(ctx, add(c0, plateDir, -18), add(c0, plateDir, 16), 4.4, 0.5);
    // Plates on the horn at the top of the carriage, above the toes.
    const horn = add(add(a, n, 15), plateDir, -34);
    steelBar(ctx, add(horn, [2, 0]), add(horn, [-5, 0]), 3.6, "butt");
    plateOnSleeve(ctx, horn, add(horn, [-3, 0]), 16, add(horn, [-3, 0]), 2.4);
    // Footplate: a steel plate edge-on under the soles.
    ctx.save();
    const fa = add(a, plateDir, -26);
    const fb = add(a, plateDir, 20);
    ctx.translate(fa[0], fa[1]);
    ctx.rotate(Math.atan2(fb[1] - fa[1], fb[0] - fa[0]));
    rrect(ctx, 0, -4, len(sub(fb, fa)), 4, 1.2);
    const gr = ctx.createLinearGradient(0, 0, 0, -4);
    gr.addColorStop(0, "#4a4d52");
    gr.addColorStop(1, "#0d0e10");
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD},0.75)`;
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.restore();
  }
  // Pads.
  cushion(ctx, [s[0] - 4, s[1]], [s[0] + 30, s[1]], 8.5);
  cushion(ctx, add(b0, backDir, 80), b0, 8.5);
}

/**
 * Hack squat: two rails at the machine's angle, the foot platform, and the carriage riding them with the back pad and
 * the shoulder pads over the shoulders (the near one in front of the near shoulder). Plates on the carriage's horn.
 */
function hackSquat(g: Gear) {
  const { ctx, p, f, Y } = g;
  const at = p.at;
  const ang = ((p.def.angle ?? 70) * Math.PI) / 180;
  const dir: Vec = [-Math.cos(ang), Math.sin(ang)];
  const nrm: Vec = [dir[1], -dir[0]]; // toward the lifter
  const T2 = f.seg.T2;
  const up2: Vec = [Math.sin((T2 * Math.PI) / 180), Math.cos((T2 * Math.PI) / 180)];
  const fwd2: Vec = [up2[1], -up2[0]];
  const sh = f.pts.shoulder;
  // Shoulder pad: on top of the shoulder, its bracket from the carriage behind the back, a handle under its front end.
  const shoulderPad = (z: number, parts: "pad" | "frame") => {
    const c = Y(add(sh, up2, 8.5), z);
    const a = add(c, fwd2, -10);
    const b = add(c, fwd2, 8);
    if (parts === "frame") {
      frameTube(ctx, add(a, up2, -1), add(Y(add(sh, fwd2, -15), z), up2, 1), 3.6, 0.5);
      grip(ctx, add(b, up2, -2), add(add(b, fwd2, 2), up2, -10), 3.4);
      return;
    }
    cushion(ctx, add(a, up2, 3.5), add(b, up2, 3.5), 7.5);
  };
  if (g.layer === "back") {
    // Base, the far rail, rear support.
    const top = add(at, dir, 212);
    frameTube(ctx, [at[0] - 24, 3], [at[0] + 50, 3], 4.6, 0.4);
    foot(ctx, at[0] - 22, 10);
    foot(ctx, at[0] + 48, 10);
    frameTube(ctx, Y(at, -14), Y(top, -14), 5.4, 0.5);
    frameTube(ctx, top, [top[0] - 2, 3], 4.4);
    frameTube(ctx, add(at, dir, 90), [top[0] + 2, 3], 3.4, 0.25);
    if (p.to) {
      shoulderPad(-Z_ARM, "frame");
      shoulderPad(-Z_ARM, "pad");
      const b = p.to;
      // Carriage plates (on the horn behind the back pad).
      const horn = add(add(b, dir, -16), nrm, -15);
      plateOnSleeve(ctx, horn, add(horn, [-3, 0]), 18, add(horn, [-3, 0]), 2.4);
      // Carriage frame and back pad along the rail.
      frameTube(ctx, add(add(b, dir, -58), nrm, -7), add(add(b, dir, 14), nrm, -7), 4.4, 0.5);
      cushion(ctx, add(b, dir, 14), add(b, dir, -58), 8);
    }
    // Near rail in front of the carriage and pad.
    frameTube(ctx, Y(at, 14), Y(top, 14), 5.4, 0.6);
    // Foot platform: an angled steel plate under the feet.
    ctx.save();
    ctx.translate(at[0] - 4, 8);
    ctx.rotate(Math.atan2(7, 50));
    rrect(ctx, 0, -3.6, 50, 3.6, 1.2);
    const gr = ctx.createLinearGradient(0, 0, 0, -3.6);
    gr.addColorStop(0, "#4a4d52");
    gr.addColorStop(1, "#0d0e10");
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD},0.75)`;
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.restore();
    frameTube(ctx, [at[0] - 2, 7], [at[0] - 2, 3], 3);
    frameTube(ctx, [at[0] + 40, 13], [at[0] + 40, 3], 3);
  }
  // The near pad lies over the top of the near shoulder; its bracket and handle under the near hand.
  if (g.layer === "near" && p.to) shoulderPad(Z_ARM - 4, "frame");
  if (g.layer === "front" && p.to) shoulderPad(Z_ARM - 4, "pad");
}

/**
 * Parallel dip bars: one beside each side of the body at the hands' depth, each on two legs. The near bar is drawn over
 * the near leg and under the near hand, the far bar behind the athlete.
 */
function dipBars(g: Gear) {
  const { ctx, p, Y } = g;
  const near = g.layer === "near";
  if (!near && g.layer !== "back") return;
  const z = near ? Z_ARM : -Z_ARM;
  const w = p.def.w ?? 56;
  const at = p.at;
  const P = (x: number, y: number): Vec => Y([at[0] + x, y], z);
  frameTube(ctx, P(-w / 2 + 7, at[1] - 2), P(-w / 2 + 3, 3), 4, 0.4);
  frameTube(ctx, P(w / 2 - 7, at[1] - 2), P(w / 2 - 3, 3), 4, 0.4);
  frameTube(ctx, P(-w / 2 - 2, 3), P(w / 2 + 2, 3), 4.2, 0.4);
  grip(ctx, P(-w / 2, at[1]), P(w / 2, at[1]), 4.4);
  ctx.fillStyle = FRAME_HI;
  for (const x of [-w / 2, w / 2]) {
    const q = P(x, at[1]);
    ctx.beginPath();
    ctx.arc(q[0], q[1], 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Pull-up bar on a wall-mounted rig, seen from the side: the bar runs across (near half in front of the head and under
 * the near hand, far half behind the athlete), carried by brackets back to the upright.
 */
function pullupBar(g: Gear) {
  const { ctx, p, Y } = g;
  const at = p.at;
  const back = p.def.w ?? 45;
  if (g.layer === "back") {
    const post = Y([at[0] - back, 0], -60);
    frameTube(ctx, Y([at[0] - back, at[1] + 14], -60), [post[0], 3], 6, 0.45);
    foot(ctx, post[0], 26);
    frameTube(ctx, Y([at[0] - back, at[1] + 6], -60), Y([at[0] + 1, at[1] + 6], -60), 4.4, 0.45);
    frameTube(ctx, Y([at[0], at[1] + 6], -60), Y(at, -60), 3.6);
    steelBar(ctx, at, Y(at, -60), 3, "round", 0.45);
  }
  if (g.layer === "near") steelBar(ctx, at, [at[0] + yawShift(58) * NEAR_SCALE, at[1]], 3 * NEAR_SCALE, "round");
}

/** Copenhagen plank support: a flat bench seen end-on (front view): padded top with gold piping on an A-frame. */
function benchEnd(g: Gear) {
  const { ctx, p } = g;
  if (g.layer !== g.main) return;
  const x = p.at[0];
  const w = p.def.w ?? 34;
  const h = p.def.h ?? 44;
  frameTube(ctx, [x - 7, h - 9], [x - w / 2 + 1, 3], 4, 0.4);
  frameTube(ctx, [x + 7, h - 9], [x + w / 2 - 1, 3], 4, 0.4);
  frameTube(ctx, [x - w / 2 - 4, 2.4], [x + w / 2 + 4, 2.4], 4.4, 0.4);
  frameTube(ctx, [x - 10, h * 0.42], [x + 10, h * 0.42], 3);
  frameTube(ctx, [x - w / 2 + 4, h - 10], [x + w / 2 - 4, h - 10], 3.6);
  // The pad's end: leather, rounded, gold piping round its top.
  rrect(ctx, x - w / 2, h - 9, w, 9, 3.2);
  const gr = ctx.createLinearGradient(0, h, 0, h - 9);
  gr.addColorStop(0, LEATHER_HI);
  gr.addColorStop(0.4, LEATHER);
  gr.addColorStop(1, "#050505");
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.strokeStyle = `rgba(${GOLD},0.75)`;
  ctx.lineWidth = 0.45;
  ctx.stroke();
  ctx.strokeStyle = `rgba(${GOLD},0.35)`;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 2.5, h - 1.4);
  ctx.lineTo(x + w / 2 - 2.5, h - 1.4);
  ctx.stroke();
}

/**
 * Stationary bike (upright: fixed handlebar and console) or air bike (fan, moving handles drawn as separate props):
 * saddle, frame, crank and pedals under the feet. `at` = the saddle's top, `to` = the crank centre.
 */
function bikeBody(g: Gear) {
  const { ctx, p, f, t, Y } = g;
  if (g.layer !== g.main) return;
  const seat = p.at;
  const C: Vec = p.to ?? [seat[0] + 26, 33];
  const air = p.def.variant !== "upright";
  // Pedals under the soles (the motion keeps the soles on the crank's circle).
  const pedal = (s: "L" | "R"): Vec => {
    const so = f.pts[`sole${s}`];
    return Y([so[0], so[1] - 1.2], s === "R" ? Z_LEG + 3 : -Z_LEG - 3);
  };
  const crankArm = (s: "L" | "R") => {
    const z = s === "R" ? 7 : -7;
    const c = Y(C, z);
    const q = pedal(s);
    steelBar(ctx, c, q, 2.8, "round", s === "L" ? 0.35 : 0);
    // Pedal body seen from the side.
    rrect(ctx, q[0] - 5, q[1] - 1.4, 10, 2.8, 1);
    ctx.fillStyle = s === "L" ? "#101012" : "#1e1f22";
    ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD},${s === "L" ? 0.3 : 0.6})`;
    ctx.lineWidth = 0.3;
    ctx.stroke();
  };
  crankArm("L");
  // Floor beam with stabiliser feet.
  const rearX = seat[0] - 30;
  const frontX = C[0] + (air ? 86 : 72);
  frameTube(ctx, [rearX, 3.2], [frontX, 3.2], 4.4, 0.4);
  foot(ctx, rearX, 12);
  foot(ctx, frontX, 12);
  // Seat tube from under the saddle down to the crank; rear stay from the floor to it.
  const seatBase = add(C, [-3, 7]);
  const post: Vec = [seat[0] - 2, seat[1] - 5];
  frameTube(ctx, [rearX + 4, 4], lerp2(post, seatBase, 0.45), 4.6);
  frameTube(ctx, post, seatBase, 5.6, 0.5);
  steelBar(ctx, [seat[0] - 1, seat[1] - 1], add(post, [-0.6, -6]), 3, "butt");
  if (air) {
    // Fan in a cage ahead of the crank, its spokes turning; front leg and the beam from the crank.
    const F: Vec = [C[0] + 58, C[1] + 32];
    const R = 29;
    frameTube(ctx, C, add(F, [-6, -16]), 5.2, 0.5);
    frameTube(ctx, F, [frontX - 2, 4], 4.6);
    frameTube(ctx, add(C, [24, -6]), [frontX - 14, 4], 3.6);
    const gr = ctx.createRadialGradient(F[0] - 8, F[1] + 10, 2, F[0], F[1], R);
    gr.addColorStop(0, "#2a2b2f");
    gr.addColorStop(0.75, "#141517");
    gr.addColorStop(1, "#070708");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(F[0], F[1], R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD},0.75)`;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${GOLD},0.2)`;
    ctx.lineWidth = 0.4;
    for (const rr of [R * 0.72, R * 0.45]) {
      ctx.beginPath();
      ctx.arc(F[0], F[1], rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(170,175,182,0.4)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) {
      const a = t * 9 + (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(F[0] + Math.cos(a) * 4, F[1] + Math.sin(a) * 4);
      ctx.lineTo(F[0] + Math.cos(a + 0.25) * (R - 3), F[1] + Math.sin(a + 0.25) * (R - 3));
      ctx.stroke();
    }
    hub(ctx, F, 4.2);
    // Console on top of the fan.
    ctx.save();
    ctx.translate(F[0] - 6, F[1] + R + 4);
    ctx.rotate(-0.35);
    rrect(ctx, -8, -3, 16, 6.5, 1.4);
    ctx.fillStyle = "#0e0f11";
    ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD},0.7)`;
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.restore();
    frameTube(ctx, add(F, [-4, R - 2]), [F[0] - 6, F[1] + R + 1], 2.6);
  } else {
    // Flywheel housing ahead of the crank, the stem rising to the handlebar and console.
    const H: Vec = [C[0] + 30, C[1] + 8];
    const shroud = new Path2D();
    shroud.moveTo(C[0] - 4, C[1] - 12);
    shroud.quadraticCurveTo(C[0] + 40, C[1] - 18, H[0] + 24, H[1] - 6);
    shroud.quadraticCurveTo(H[0] + 30, H[1] + 22, H[0] + 4, H[1] + 30);
    shroud.quadraticCurveTo(C[0] + 6, C[1] + 26, C[0] - 4, C[1] - 12);
    shroud.closePath();
    const gr = ctx.createLinearGradient(C[0], C[1] + 30, C[0] + 40, C[1] - 18);
    gr.addColorStop(0, "#2f3135");
    gr.addColorStop(0.5, "#17181b");
    gr.addColorStop(1, "#08090a");
    ctx.fillStyle = gr;
    ctx.fill(shroud);
    ctx.strokeStyle = `rgba(${GOLD},0.7)`;
    ctx.lineWidth = 0.55;
    ctx.stroke(shroud);
    frameTube(ctx, [H[0] + 10, 4], [H[0] + 14, H[1] - 2], 5);
    // Stem to the handlebar (where the hands are), console just ahead of it.
    const bar = f.pts.handR;
    const stemTop: Vec = [bar[0] + 7, bar[1] - 5];
    frameTube(ctx, [H[0] + 6, H[1] + 24], stemTop, 5.2, 0.55);
    ctx.save();
    ctx.translate(stemTop[0] + 4, stemTop[1] + 9);
    ctx.rotate(-0.6);
    rrect(ctx, -7, -3, 14, 6, 1.4);
    ctx.fillStyle = "#0e0f11";
    ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD},0.7)`;
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.restore();
    frameTube(ctx, stemTop, add(stemTop, [3, 7]), 2.6);
    // Handlebar across, under both hands (the far grip behind the far hand is covered by the near arm's reach).
    const far = Y(bar, -22);
    const nearG = Y(bar, 22);
    frameTube(ctx, stemTop, lerp2(far, nearG, 0.5), 3.2);
    grip(ctx, far, nearG, 3.4);
  }
  hub(ctx, C, 6.5);
  crankArm("R");
  // Saddle.
  const sp = new Path2D();
  const sx = seat[0];
  const sy = seat[1];
  sp.moveTo(sx - 13, sy - 1);
  sp.quadraticCurveTo(sx - 13, sy + 1.6, sx - 8, sy + 1.2);
  sp.quadraticCurveTo(sx + 2, sy + 0.4, sx + 12, sy + 0.2);
  sp.quadraticCurveTo(sx + 13.5, sy - 1.2, sx + 10, sy - 2.2);
  sp.quadraticCurveTo(sx - 2, sy - 5.5, sx - 13, sy - 1);
  sp.closePath();
  const sg = ctx.createLinearGradient(0, sy + 1.6, 0, sy - 5);
  sg.addColorStop(0, LEATHER_HI);
  sg.addColorStop(0.4, LEATHER);
  sg.addColorStop(1, "#040404");
  ctx.fillStyle = sg;
  ctx.fill(sp);
  ctx.strokeStyle = `rgba(${GOLD},0.6)`;
  ctx.lineWidth = 0.35;
  ctx.stroke(sp);
}

/** Air bike handle arm: from its pivot low at the front up to the grip in the hand (near one outside the near leg). */
function bikeHandle(g: Gear) {
  const { ctx, p, f, Y } = g;
  if (g.layer !== g.main || !p.to) return;
  const lm = anchorLm(p.def.to);
  const near = lm !== "handL";
  const zH = near ? Z_ARM : -Z_ARM;
  const zP = near ? 24 : -24;
  const pv = Y(p.at, zP);
  const hand = Y(f.pts[near ? "handR" : "handL"], zH);
  const d = unit(sub(hand, pv));
  frameTube(ctx, add(pv, d, -10), add(hand, d, -6), 3.8, 0.55);
  grip(ctx, add(hand, d, -7), add(hand, d, 8), 4.4);
  hub(ctx, pv, 3.2);
  if (!near) {
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(pv[0], pv[1]);
    ctx.lineTo(hand[0], hand[1]);
    ctx.stroke();
  }
}

/** Depth of a machine lever and its column: on the far side of the legs. */
const Z_LEVER = -18;
/** Roller pad radius and how far its centre sits from the shin bone (shin half-thickness at the ankle + radius). */
const ROLLER_R = 6;
const ROLLER_OFF = 10.3;

/**
 * A leg machine's lever: it pivots in line with the knee (on the far side of the legs, so it never covers them), runs
 * alongside the shin, and carries the roller pad that crosses in front of both shins: on the front of the lower shins
 * (leg extension) or behind the ankles, just above the heels (leg curls).
 */
function machineLever(g: Gear) {
  const { ctx, p, f, Y } = g;
  const K = f.pts.kneeR;
  const A = f.pts.ankleR;
  const d = unit(sub(A, K));
  const nF: Vec = [-d[1], d[0]];
  let s = p.def.variant === "front" ? 1 : p.def.variant === "back" ? -1 : 0;
  if (!s && p.to) s = (p.to[0] - A[0]) * nF[0] + (p.to[1] - A[1]) * nF[1] >= 0 ? 1 : -1;
  if (!s) s = 1;
  const n: Vec = [nF[0] * s, nF[1] * s];
  const roller = add(add(K, d, BODY.shin - 6), n, ROLLER_OFF);
  if (g.layer === "back") {
    // Column from the floor to the pivot, the pivot hub, the cam out to the lever and the lever down to the roller.
    // The column leans in from the machine's front, clear of the hanging shin (toward the feet when lying prone).
    const pv = Y(K, Z_LEVER);
    const away = Math.sign(K[0] - f.pts.pelvis[0]) || 1;
    frameTube(ctx, Y([K[0] + 24 * away, 3], Z_LEVER), add(pv, [0, -4]), 5, 0.45);
    const cam = Y(add(K, n, ROLLER_OFF), Z_LEVER);
    frameTube(ctx, pv, cam, 4.6, 0.5);
    frameTube(ctx, cam, Y(roller, Z_LEVER - 2), 3.8, 0.6);
    hub(ctx, pv, 5.6);
  }
  if (g.layer === g.main) rollerPad(ctx, Y(roller, 20), Y(roller, -20), ROLLER_R);
}

/**
 * Seated leg extension / seated leg curl: base frame, seat (front edge at `at`), back pad (`w` cm behind the seat's
 * front, reclined `angle`°). Variants "handles" (the grips at the seat's sides, `at` = the grip) and "thighPad" (the
 * seated curl's pad locked on the thighs, `at` = its centre). The lever and roller are the machineLever prop.
 */
function seatedMachine(g: Gear) {
  const { ctx, p, f, Y } = g;
  const v = p.def.variant;
  if (v === "handles") {
    const draw = (z: number) => {
      const c = Y(p.at, z);
      frameTube(ctx, add(c, [-6, -1]), add(c, [-9, -9]), 2.8);
      grip(ctx, add(c, [-7, 0]), add(c, [7, 0]), 3.4);
    };
    if (g.layer === "back") draw(-Z_ARM);
    if (g.layer === g.main) draw(Z_ARM);
    return;
  }
  if (v === "thighPad") {
    if (g.layer === "back") {
      // Its arm from the lever's pivot housing up and back over the thighs.
      const K = f.pts.kneeR;
      const top = Y([K[0] + 4, p.at[1] + 1], Z_LEVER);
      frameTube(ctx, Y(K, Z_LEVER), top, 4, 0.5);
      frameTube(ctx, top, Y(p.at, Z_LEVER - 4), 3.6, 0.5);
    }
    if (g.layer === g.main) rollerPad(ctx, Y(p.at, 20), Y(p.at, -20), 5.2);
    return;
  }
  if (g.layer !== g.main) return;
  const front = p.at[0];
  const seatTop = p.at[1];
  const depth = p.def.w ?? 46;
  const lean = ((p.def.angle ?? -6) * Math.PI) / 180;
  const up: Vec = [Math.sin(lean), Math.cos(lean)];
  const padBase: Vec = [front - depth, seatTop + 1];
  const padTop = add(padBase, up, 64);
  // Base, seat column, back-pad brace.
  frameTube(ctx, [padBase[0] - 18, 3.2], [front + 34, 3.2], 4.6, 0.4);
  foot(ctx, padBase[0] - 16, 11);
  foot(ctx, front + 32, 11);
  frameTube(ctx, [front - depth * 0.45, seatTop - 8], [front - depth * 0.45, 3], 5.4, 0.45);
  const brace = add(add(padBase, up, 34), [-up[1], up[0]], 9);
  frameTube(ctx, brace, [padBase[0] - 12, 3.5], 4.2, 0.45);
  frameTube(ctx, add(padBase, [-6, -6]), [front - depth * 0.45, seatTop - 8], 3.6);
  // Seat and back pad (its face on the athlete's back).
  cushion(ctx, [padBase[0] - 4, seatTop], [front, seatTop], 9);
  cushion(ctx, padTop, add(padBase, up, 2), 10);
}

/**
 * Lying leg curl: the bench (`at` = its knee end, the pad running toward the head), the frame, and the handles under
 * the front of the pad where the hands hold on. The lever and roller are the machineLever prop.
 */
function lyingCurl(g: Gear) {
  const { ctx, p, f, Y } = g;
  if (g.layer !== g.main) return;
  // The pad's top under the chest and thighs (the body lies on it), its end just above the knees so they clear it.
  const s: Vec = [p.at[0] + 9, Math.max(p.at[1], f.pts.chest[1] - 0.5)];
  frameTube(ctx, [s[0] - 31, 3.2], [s[0] + 125, 3.2], 4.6, 0.4);
  foot(ctx, s[0] - 29, 11);
  foot(ctx, s[0] + 123, 11);
  frameTube(ctx, [s[0] + 10, s[1] - 9], [s[0] + 6, 3], 5, 0.45);
  frameTube(ctx, [s[0] + 96, s[1] - 9], [s[0] + 100, 3], 5, 0.45);
  frameTube(ctx, [s[0] + 2, s[1] - 13], [s[0] + 110, s[1] - 13], 3.6);
  // Handles: a post down from under the front of the pad to a grip at the hands.
  const hR = Y(f.pts.handR, Z_ARM);
  const post: Vec = [Math.min(s[0] + 112, hR[0] + 6), s[1] - 9];
  frameTube(ctx, post, [post[0], hR[1]], 3.2);
  grip(ctx, [post[0] - 9, hR[1]], [post[0] + 2, hR[1]], 3.4);
  cushion(ctx, [s[0], s[1]], [s[0] + 116, s[1]], 9);
}

/**
 * Jump rope. `at` gives the rope's phase: the direction, from the hands, of the loop's farthest point as it turns over
 * the head, in front, under the feet and behind. The loop keeps the rope's length (it reaches the same distance all the
 * way round, cut short by the floor so it skims it, never below), leaving each handle below the fist and wider than the
 * hands (seen a little from behind). The far strand is behind the athlete; the near one passes in front of the near
 * side, except while the loop is behind the back, when both are behind the body.
 */
/** The loop's reach from the hands: about 95 cm in front and behind, 130 cm up and down (cut by the floor / frame). */
const ROPE_REACH: Vec = [95, 130];
function jumpRope(g: Gear) {
  const { p, f } = g;
  const behind = p.at[0] < f.pts.pelvis[0] - 6;
  const nearPass = behind ? "back" : g.main;
  if (g.layer !== nearPass && g.layer !== "back") return;
  // In the back layer with the loop behind the back: draw both strands there.
  for (const near of g.layer === "back" && behind ? [false, true] : [g.layer === nearPass]) {
    jumpRopeStrand(g, near);
  }
}
function jumpRopeStrand(g: Gear, near: boolean) {
  const { ctx, p, f, Y } = g;
  const s = near ? "R" : "L";
  const zH = near ? Z_ARM : -Z_ARM;
  const hand = f.pts[`hand${s}`];
  // Handle: from the fist down and slightly out, the rope leaving its tip.
  const fore = unit(sub(hand, f.pts[`elbow${s}`]));
  const hd = unit(add(fore, [0, -1.4]));
  const tip = add(hand, hd, 8);
  grip(ctx, Y(add(hand, hd, -3), zH), Y(tip, zH + (near ? 1 : -1)), 2.6);
  const tipsMid = lerp2(add(f.pts.handL, hd, 8), add(f.pts.handR, hd, 8), 0.5);
  const u = unit(sub(p.at, tipsMid));
  // Full reach, or as far as the floor allows (the rope skims it 0.6 cm up); overhead no higher than the motion's own
  // top point, so it stays in the picture.
  let D = 1 / Math.hypot(u[0] / ROPE_REACH[0], u[1] / ROPE_REACH[1]);
  if (u[1] < -0.05) D = Math.min(D, (tipsMid[1] - 0.6) / -u[1]);
  if (u[1] > 0.05) D = Math.min(D, (f.pts.headTop[1] + 16 - tipsMid[1]) / u[1]);
  const pts: Vec[] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    // From this handle's tip (k = 1) to the far point (k = 0).
    const k = 1 - i / N;
    const reach = D * Math.sqrt(Math.max(0, Math.cos((Math.PI / 2) * k)));
    const z = (near ? 1 : -1) * (Z_ARM + 2) * Math.sin((Math.PI / 2) * k) + (near ? 1 : -1) * 6 * Math.sin(Math.PI * k);
    const w = add(tipsMid, u, reach);
    // Blend the start onto the drawn handle tip.
    const q = Y(w, z);
    const t0 = Y(tip, zH + (near ? 1 : -1));
    const b = Math.max(0, (k - 0.85) / 0.15);
    pts.push([q[0] + (t0[0] - q[0]) * b, Math.max(0.5, q[1] + (t0[1] - q[1]) * b)]);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const path = new Path2D();
  path.moveTo(pts[0]![0], pts[0]![1]);
  for (const q of pts.slice(1)) path.lineTo(q[0], q[1]);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1.9;
  ctx.stroke(path);
  ctx.strokeStyle = near ? `rgba(${GOLD},0.95)` : `rgba(${GOLD},0.6)`;
  ctx.lineWidth = 1.05;
  ctx.stroke(path);
}

/**
 * Landmine: the bar from its pivot sleeve on the floor up to the hand(s), which hold the end of its sleeve; a plate on
 * the sleeve just below the hands (seen nearly edge-on from the side, more face-on from the front).
 */
function landmine(g: Gear) {
  const { ctx, p, f, Y } = g;
  if (g.layer !== g.main || !p.to) return;
  const lm = anchorLm(p.def.to);
  const end = g.side && lm && /^hand[LR]$/.test(lm) ? Y(f.pts[lm], landmarkDepth(lm)) : p.to;
  const piv = p.at;
  const d = unit(sub(end, piv));
  const L = len(sub(end, piv));
  const n: Vec = [-d[1], d[0]];
  // Pivot unit: a floor plate and the swivel sleeve.
  rrect(ctx, piv[0] - 11, 0, 22, 3.4, 1.2);
  ctx.fillStyle = FRAME;
  ctx.fill();
  ctx.strokeStyle = `rgba(${GOLD},0.5)`;
  ctx.lineWidth = 0.35;
  ctx.stroke();
  frameTube(ctx, [piv[0], 3], add(piv, d, 16), 5.4, 0.55);
  hub(ctx, [piv[0], 4.5], 3);
  // Bar shaft, collar, sleeve (in the hands, past the plate).
  const collar = L - 30;
  steelBar(ctx, add(piv, d, 12), add(piv, d, collar), 2.8);
  steelBar(ctx, add(piv, d, collar - 1), add(piv, d, collar + 2), 6, "butt");
  steelBar(ctx, add(piv, d, collar + 2), add(piv, d, L + 4), 4.6, "round");
  // The plate, perpendicular to the bar: an ellipse whose other axis is its depth seen by the camera.
  const c = add(piv, d, collar + 6);
  const r = 20;
  const depth = g.side ? -Math.sin((15 * Math.PI) / 180) : 0.42;
  const ell = (cc: Vec) => {
    ctx.save();
    ctx.transform(n[0] * r, n[1] * r, g.side ? depth * r : -d[0] * r * depth, g.side ? 0 : -d[1] * r * depth, cc[0], cc[1]);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.restore();
  };
  // Rim (thickness along the bar), then the face toward the hands.
  for (let k = 0; k <= 4; k++) {
    ell(add(c, d, -2.5 + k * 1.25));
    ctx.fillStyle = IRON_LO;
    ctx.fill();
  }
  ell(add(c, d, 2.5));
  const gr = ctx.createLinearGradient(c[0] + n[0] * r, c[1] + n[1] * r, c[0] - n[0] * r, c[1] - n[1] * r);
  gr.addColorStop(0, IRON_HI);
  gr.addColorStop(0.6, IRON);
  gr.addColorStop(1, IRON_LO);
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.strokeStyle = `rgba(${GOLD},0.8)`;
  ctx.lineWidth = 0.45;
  ctx.stroke();
  steelBar(ctx, add(c, d, 2.5), add(piv, d, L + 4), 4.6, "round");
}

/**
 * Lat pulldown station: seat on its column, the roller pad over the thighs, the upright with the weight stack in front
 * of the knees, the beam over the head to the pulley, the cable and the lat bar across in the hands (its near half
 * under the near hand, its far half behind the athlete).
 */
function latPulldown(g: Gear) {
  const { ctx, p, Y } = g;
  const s = p.at;
  const hands = p.to;
  const barHalf = (half: 1 | -1) => {
    if (!hands) return;
    const sc = half > 0 ? NEAR_SCALE : FAR_SCALE;
    const P = (z: number, dy = 0): Vec => [hands[0] + yawShift(z * half) * sc, hands[1] + dy];
    steelBar(ctx, P(0), P(52), 2.8 * sc, "round", half > 0 ? 0 : 0.45);
    steelBar(ctx, P(52), P(62, -5), 2.8 * sc, "round", half > 0 ? 0 : 0.45);
    grip(ctx, P(36), P(52), 3.4 * sc);
  };
  if (g.layer === "back") barHalf(-1);
  if (g.layer === "near") barHalf(1);
  if (g.layer !== g.main) return;
  const X = s[0] + 50;
  // Base, seat column, upright to the top beam and back over the head to the pulley.
  frameTube(ctx, [s[0] - 40, 3.2], [X + 26, 3.2], 4.6, 0.4);
  foot(ctx, s[0] - 38, 11);
  foot(ctx, X + 24, 11);
  frameTube(ctx, [s[0], s[1] - 8], [s[0], 3], 5.2, 0.45);
  frameTube(ctx, [X, 3], [X, 236], 5.6, 0.5);
  frameTube(ctx, [X + 3, 236], [s[0] + 4, 236], 5, 0.5);
  // Weight stack on its guide rods in front of the upright.
  const sx = X + 13;
  for (const dx of [-5, 5]) tube(ctx, [sx + dx, 6], [sx + dx, 150], 0.9, STEEL_HI, STEEL, STEEL_LO);
  for (let i = 0; i < 12; i++) {
    const y = 6 + i * 4.6;
    rrect(ctx, sx - 9.5, y, 19, 4.1, 0.8);
    const gr = ctx.createLinearGradient(sx - 9.5, y + 4, sx + 9.5, y);
    gr.addColorStop(0, IRON_HI);
    gr.addColorStop(0.6, IRON);
    gr.addColorStop(1, IRON_LO);
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD},${i === 11 ? 0.7 : 0.25})`;
    ctx.lineWidth = 0.3;
    ctx.stroke();
  }
  frameTube(ctx, [sx - 12, 150], [sx + 12, 150], 3.4);
  tube(ctx, [sx, 61], [sx, 232], 0.6, STEEL_HI, STEEL, STEEL_LO);
  // Thigh-pad bracket and roller over the thighs.
  const tp: Vec = [s[0] + 28, s[1] + 22];
  frameTube(ctx, Y([tp[0], tp[1]], -22), Y([X, tp[1]], -22), 3.6, 0.45);
  // Cable from the overhead pulley to the bar.
  const pul: Vec = [s[0] + 8, 231];
  if (hands) {
    ctx.strokeStyle = "#c3c8ce";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(pul[0], pul[1]);
    ctx.lineTo(hands[0], hands[1]);
    ctx.stroke();
  }
  hub(ctx, pul, 4.2);
  cushion(ctx, [s[0] - 18, s[1]], [s[0] + 20, s[1]], 8.5);
  rollerPad(ctx, Y(tp, 20), Y(tp, -20), 5.2);
}

/**
 * Adjustable incline bench: the back pad at `angle`° (rising toward -x, or +x for variant "right") from the hinge at
 * `at` (the top of the pads), the seat on the other side, on a graphite frame, matching the flat bench.
 */
function inclineBench(g: Gear) {
  const { ctx, p } = g;
  if (g.layer !== g.main) return;
  const at = p.at;
  const ang = ((p.def.angle ?? 35) * Math.PI) / 180;
  const back = p.def.w ?? 78;
  const seat = p.def.h ?? 30;
  const dx = p.def.variant === "right" ? 1 : -1;
  const top: Vec = [at[0] + dx * Math.cos(ang) * back, at[1] + Math.sin(ang) * back];
  const seatEnd: Vec = [at[0] - dx * seat, at[1]];
  // Frame: a leg under the seat's front, the post under the hinge, the back pad's strut, the floor rail.
  const floorA = Math.min(seatEnd[0], at[0] + dx * 22, top[0]) - 6;
  const floorB = Math.max(seatEnd[0], at[0] + dx * 22, top[0]) + 6;
  frameTube(ctx, [floorA, 2.6], [floorB, 2.6], 4.2, 0.4);
  foot(ctx, floorA + 2, 10);
  foot(ctx, floorB - 2, 10);
  frameTube(ctx, [seatEnd[0] + dx * 6, at[1] - 9], [seatEnd[0] + dx * 9, 3], 4, 0.45);
  frameTube(ctx, [at[0], at[1] - 9], [at[0] + dx * 22, 3], 4, 0.45);
  const strutTop: Vec = [at[0] + dx * Math.cos(ang) * back * 0.62, at[1] + Math.sin(ang) * back * 0.62 - 9];
  frameTube(ctx, strutTop, [strutTop[0] + dx * 4, 3], 3.4, 0.35);
  // Pads, their thickness behind / under the surfaces the athlete lies and sits on.
  if (dx < 0) {
    cushion(ctx, top, at, 8);
    cushion(ctx, at, seatEnd, 8);
  } else {
    cushion(ctx, at, top, 8);
    cushion(ctx, seatEnd, at, 8);
  }
}

// ------------------------------------------------------------------------------------------------ Dispatch

/** The kinds drawn here, by kind (some only in a variant or a view). */
function drawerFor(p: ResolvedProp, f: Frame): ((g: Gear) => void) | null {
  const { kind, variant } = p.def;
  // Props drawn for a specific motion (props-athlete-kit.ts, variant "kit-…") keep their own drawing.
  if (variant?.startsWith("kit-")) return null;
  switch (kind) {
    case "band":
      return band;
    case "trapBar":
      return f.view === "side" ? trapBar : null;
    case "farmerHandle":
      return f.view === "side" ? farmerHandle : null;
    case "log":
      return f.view === "side" ? logBar : null;
    case "yoke":
      return f.view === "side" ? yoke : null;
    case "sled":
      return f.view === "side" ? sled : null;
    case "rope":
      return f.view === "side" ? rope : null;
    case "legPress":
      return f.view === "side" ? legPress : null;
    case "hackSquat":
      return f.view === "side" ? hackSquat : null;
    case "dipBars":
      return f.view === "side" ? dipBars : null;
    case "pullupBar":
      return f.view === "side" ? pullupBar : null;
    case "box":
      return variant === "bench" ? benchEnd : null;
    case "bike":
      return f.view !== "side" ? null : variant === "handle" ? bikeHandle : bikeBody;
    case "machineLever":
      return f.view === "side" ? machineLever : null;
    case "legExtension":
    case "seatedLegCurl":
      return f.view === "side" && variant ? seatedMachine : null;
    case "legCurl":
      return f.view === "side" && variant === "body" ? lyingCurl : null;
    case "jumpRope":
      return f.view === "side" ? jumpRope : null;
    case "landmine":
      return landmine;
    case "latPulldown":
      return f.view === "side" ? latPulldown : null;
    case "inclineBench":
      return f.view === "side" ? inclineBench : null;
    default:
      return null;
  }
}

/**
 * Draw the parts of a prop that belong to `layer` in the athlete look, if this module draws its kind. Returns false for
 * kinds it does not draw (props-athlete.ts, or the classic drawing, then draws them). `p` is the prop as the motion
 * places it (no camera shift applied: each part is shifted here by its own depth).
 */
export function drawGearAthlete(ctx: Ctx, p: ResolvedProp, f: Frame, t: number, layer: string): boolean {
  const draw = drawerFor(p, f);
  if (!draw) return false;
  const side = f.view === "side";
  const Y = (q: Vec, z: number): Vec => (side ? [q[0] + yawShift(z), q[1]] : q);
  ctx.save();
  draw({ ctx, p, f, t, layer, main: p.layer ?? p.def.layer ?? "near", side, Y });
  ctx.restore();
  return true;
}
