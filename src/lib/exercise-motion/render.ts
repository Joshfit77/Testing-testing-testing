import { BODY, add, down, frontOf, up } from "./skeleton";
import { drawProp } from "./props";
import type { Frame, Vec } from "./types";

export interface Palette {
  hi: string;
  mid: string;
  lo: string;
  line: string;
}

export const GOLD_NEAR: Palette = { hi: "#f7e09a", mid: "#d6aa3c", lo: "#7f5a14", line: "rgba(60,40,8,0.55)" };
export const GOLD_FAR: Palette = { hi: "#b08c40", mid: "#86662a", lo: "#3f2d0c", line: "rgba(30,20,4,0.6)" };
const TORSO: Palette = { hi: "#f2d68a", mid: "#cfa13a", lo: "#6f4d10", line: "rgba(60,40,8,0.5)" };

/** Light comes from the upper left of the scene. */
const LIGHT: Vec = [-0.55, 0.83];

export interface Camera {
  /** Pixels per world unit (CSS pixels). */
  scale: number;
  /** Screen position (CSS px) of world x = cameraX. */
  ox: number;
  /** Screen y (CSS px) of the floor. */
  oy: number;
  /** Canvas size in CSS px. */
  w: number;
  h: number;
  dpr: number;
  mirror: boolean;
}

export interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Fit the motion's bounds into a canvas. */
export function fitCamera(b: Bounds, w: number, h: number, dpr: number, mirror = false): Camera {
  const padX = 0.06 * w;
  const padTop = 0.07 * h;
  const padBottom = 0.12 * h;
  const bw = Math.max(60, b.x1 - b.x0);
  const bh = Math.max(60, b.y1 - Math.min(0, b.y0));
  const scale = Math.min((w - 2 * padX) / bw, (h - padTop - padBottom) / bh);
  const cx = (b.x0 + b.x1) / 2;
  const ox = w / 2 - cx * scale * (mirror ? -1 : 1);
  const oy = h - padBottom + Math.min(0, b.y0) * scale;
  return { scale, ox, oy, w, h, dpr, mirror };
}

export interface RenderOptions {
  /** Floor style ("none" for top-down views). */
  floor?: "plain" | "mat" | "none";
  time?: number;
}

/** Draw one frame. The context is reset and the whole canvas repainted. */
export function renderFrame(ctx: CanvasRenderingContext2D, frame: Frame, cam: Camera, opts: RenderOptions = {}) {
  const { dpr, w, h } = cam;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackdrop(ctx, w, h, cam, frame, opts.floor !== "none");

  // World transform: y up, camera following.
  const sx = cam.scale * (cam.mirror ? -1 : 1);
  ctx.setTransform(dpr * sx, 0, 0, -dpr * cam.scale, dpr * (cam.ox - frame.cameraX * sx), dpr * cam.oy);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (opts.floor !== "none") drawShadow(ctx, frame);
  ctx.globalAlpha = frame.alpha;
  const t = opts.time ?? 0;
  const layer = (name: string) => {
    for (const p of frame.props) if ((p.def.layer ?? "near") === name) drawProp(ctx, p, frame, t);
  };
  layer("back");
  if (frame.view === "side") drawSideFigure(ctx, frame, layer);
  else drawFrontFigure(ctx, frame, layer);
  layer("front");
  ctx.globalAlpha = 1;
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera, frame: Frame, floor: boolean) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  g.addColorStop(0, "#1c1810");
  g.addColorStop(0.55, "#110f0b");
  g.addColorStop(1, "#070707");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (!floor) return;
  // Floor.
  const fy = cam.oy;
  const fg = ctx.createLinearGradient(0, fy, 0, h);
  fg.addColorStop(0, "rgba(212,170,60,0.10)");
  fg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fg;
  ctx.fillRect(0, fy, w, h - fy);
  const lg = ctx.createLinearGradient(0, 0, w, 0);
  lg.addColorStop(0, "rgba(212,170,60,0)");
  lg.addColorStop(0.5, "rgba(212,170,60,0.55)");
  lg.addColorStop(1, "rgba(212,170,60,0)");
  ctx.strokeStyle = lg;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, fy + 0.5);
  ctx.lineTo(w, fy + 0.5);
  ctx.stroke();
  // Floor marks scroll with travelling movements so the ground reads as moving.
  {
    const spacing = 60 * cam.scale;
    const shift = (((frame.cameraX * cam.scale * (cam.mirror ? -1 : 1)) % spacing) + spacing) % spacing;
    ctx.strokeStyle = "rgba(212,170,60,0.16)";
    ctx.lineWidth = 1;
    for (let x = cam.ox % spacing - shift - spacing; x < w + spacing; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, fy + 4);
      ctx.lineTo(x - 10, h);
      ctx.stroke();
    }
  }
}

function drawShadow(ctx: CanvasRenderingContext2D, f: Frame) {
  const xs = [f.pts.soleL[0], f.pts.soleR[0], f.pts.pelvis[0], f.pts.handL[0], f.pts.handR[0], f.pts.head[0]];
  const lowY = Math.min(f.pts.soleL[1], f.pts.soleR[1], f.pts.pelvis[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const cx = (x0 + x1) / 2;
  const rx = Math.max(22, (x1 - x0) / 2 + 12);
  const k = Math.max(0.25, 1 - Math.max(0, lowY) / 120);
  ctx.save();
  ctx.translate(cx, 0);
  ctx.scale(rx, 4.5);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(0,0,0,${0.55 * k})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function shade(ctx: CanvasRenderingContext2D, a: Vec, n: Vec, r: number, pal: Palette) {
  // Lit side is the normal facing the light.
  const s = n[0] * LIGHT[0] + n[1] * LIGHT[1] >= 0 ? 1 : -1;
  const g = ctx.createLinearGradient(a[0] + n[0] * r * s, a[1] + n[1] * r * s, a[0] - n[0] * r * s, a[1] - n[1] * r * s);
  g.addColorStop(0, pal.hi);
  g.addColorStop(0.42, pal.mid);
  g.addColorStop(1, pal.lo);
  return g;
}

/**
 * A shaped limb from p1 (radius r1) to p2 (radius r2) with muscle bulges.
 * `bf` / `bb` = extra bulge on the front / back side, centred at fraction `at` of the length.
 */
export function limb(ctx: CanvasRenderingContext2D, p1: Vec, p2: Vec, r1: number, r2: number, pal: Palette, bf = 0, bb = 0, at = 0.4) {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const L = Math.hypot(dx, dy) || 0.001;
  const d: Vec = [dx / L, dy / L];
  const n: Vec = [-d[1], d[0]]; // "front" normal (counter-clockwise of the direction)
  const rm = r1 + (r2 - r1) * at;
  const m = add(p1, d, L * at);
  const f1 = add(p1, n, r1);
  const f2 = add(p2, n, r2);
  const b1 = add(p1, n, -r1);
  const cf = add(m, n, (rm + bf) * 1.12);
  const cb = add(m, n, -(rm + bb) * 1.12);
  const ang = Math.atan2(d[1], d[0]);
  ctx.beginPath();
  ctx.moveTo(f1[0], f1[1]);
  ctx.quadraticCurveTo(cf[0], cf[1], f2[0], f2[1]);
  ctx.arc(p2[0], p2[1], r2, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.quadraticCurveTo(cb[0], cb[1], b1[0], b1[1]);
  ctx.arc(p1[0], p1[1], r1, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
  ctx.fillStyle = shade(ctx, m, n, rm + Math.max(bf, bb), pal);
  ctx.fill();
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

function ball(ctx: CanvasRenderingContext2D, c: Vec, r: number, pal: Palette) {
  const g = ctx.createRadialGradient(c[0] + LIGHT[0] * r * 0.45, c[1] + LIGHT[1] * r * 0.45, r * 0.1, c[0], c[1], r);
  g.addColorStop(0, pal.hi);
  g.addColorStop(0.55, pal.mid);
  g.addColorStop(1, pal.lo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

function drawFoot(ctx: CanvasRenderingContext2D, ankle: Vec, rot: number, pal: Palette) {
  const f: Vec = [Math.cos((rot * Math.PI) / 180), Math.sin((rot * Math.PI) / 180)];
  const u: Vec = [-f[1], f[0]];
  const at = (fw: number, uh: number): Vec => [ankle[0] + f[0] * fw + u[0] * uh, ankle[1] + f[1] * fw + u[1] * uh];
  const H = BODY.ankleH;
  const pts: Vec[] = [at(-3, 3), at(-BODY.footBack - 1.5, -H + 3), at(-BODY.footBack + 1, -H), at(BODY.footFront, -H), at(BODY.footFront + BODY.toeExtra, -H + 1.6), at(BODY.footFront + 1, -H + 4.5), at(4, -1.5), at(2, 3.5)];
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
  ctx.fillStyle = shade(ctx, at(6, -H / 2), u, 6, pal);
  ctx.fill();
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // Sole line.
  ctx.strokeStyle = "rgba(20,14,4,0.55)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  const s1 = at(-BODY.footBack + 0.5, -H + 0.4);
  const s2 = at(BODY.footFront + 1.5, -H + 0.4);
  ctx.moveTo(s1[0], s1[1]);
  ctx.lineTo(s2[0], s2[1]);
  ctx.stroke();
}

function drawHand(ctx: CanvasRenderingContext2D, hand: Vec, foreA: number, pal: Palette) {
  const d = down(foreA);
  const c = add(hand, d, -0.5);
  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.rotate(Math.atan2(d[1], d[0]));
  const g = ctx.createRadialGradient(-1, 1.5, 0.5, 0, 0, 5);
  g.addColorStop(0, pal.hi);
  g.addColorStop(0.6, pal.mid);
  g.addColorStop(1, pal.lo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();
}

function drawHeadSide(ctx: CanvasRenderingContext2D, f: Frame) {
  const { head, neckBase } = f.pts;
  const a = f.seg.head;
  const nb = add(neckBase, up(a), -1);
  const nt = add(head, up(a), -6);
  limb(ctx, nb, nt, 5.4, 4.6, TORSO);
  ctx.save();
  ctx.translate(head[0], head[1]);
  ctx.rotate((-a * Math.PI) / 180);
  // Cranium + jaw (facing +x).
  const g = ctx.createRadialGradient(-3, 5, 1, 0, 0, 13);
  g.addColorStop(0, TORSO.hi);
  g.addColorStop(0.6, TORSO.mid);
  g.addColorStop(1, TORSO.lo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(-0.5, 1, 9.6, 10.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TORSO.line;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8.6, 3);
  ctx.quadraticCurveTo(11.6, 0.5, 9.4, -2.5); // nose / brow
  ctx.quadraticCurveTo(9.5, -7.5, 4.5, -9.5); // chin
  ctx.quadraticCurveTo(0, -10.5, -2, -6);
  ctx.lineTo(4, 2);
  ctx.closePath();
  ctx.fill();
  // Ear hint.
  ctx.fillStyle = "rgba(90,60,10,0.35)";
  ctx.beginPath();
  ctx.ellipse(-1.5, 0, 1.8, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function torsoSide(ctx: CanvasRenderingContext2D, f: Frame) {
  const { pelvis, mid, neckBase } = f.pts;
  const T1 = f.seg.T1;
  const T2 = f.seg.T2;
  const f1 = frontOf(T1);
  const f2 = frontOf(T2);
  const u1 = up(T1);
  const u2 = up(T2);
  // Stations along the spine: [centre, front offset, back offset, normal]
  const st: [Vec, number, number, Vec][] = [
    [add(pelvis, u1, -6), 7, 8, f1],
    [pelvis, 10, 11.5, f1],
    [add(pelvis, u1, 12), 9.2, 8.6, f1],
    [mid, 9.6, 8.6, frontOf((T1 + T2) / 2)],
    [add(mid, u2, BODY.thorax * 0.45), 12.6, 9.6, f2],
    [add(mid, u2, BODY.thorax * 0.8), 11, 9.4, f2],
    [add(neckBase, u2, 0.5), 6, 7.5, f2],
  ];
  const front = st.map(([c, fo, , n]) => add(c, n, fo));
  const back = st.map(([c, , bo, n]) => add(c, n, -bo)).reverse();
  const ring = [...front, ...back];
  ctx.beginPath();
  const m0: Vec = [(ring[0]![0] + ring[ring.length - 1]![0]) / 2, (ring[0]![1] + ring[ring.length - 1]![1]) / 2];
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
  const c = add(mid, u2, 6);
  ctx.fillStyle = shade(ctx, c, f2, 13, TORSO);
  ctx.fill();
  ctx.strokeStyle = TORSO.line;
  ctx.lineWidth = 0.7;
  ctx.stroke();
  // Pec / ab line hints.
  ctx.strokeStyle = "rgba(90,60,10,0.35)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  const pecA = add(add(mid, u2, BODY.thorax * 0.3), f2, 10.5);
  const pecB = add(add(mid, u2, BODY.thorax * 0.62), f2, 6);
  ctx.moveTo(pecA[0], pecA[1]);
  ctx.quadraticCurveTo(pecB[0], pecB[1], add(pecB, u2, 4)[0], add(pecB, u2, 4)[1]);
  ctx.stroke();
}

type LayerFn = (name: string) => void;

function sideLeg(ctx: CanvasRenderingContext2D, f: Frame, s: "L" | "R", pal: Palette) {
  const hip = f.pts.pelvis;
  const knee = f.pts[`knee${s}`];
  const ankle = f.pts[`ankle${s}`];
  limb(ctx, add(ankle, down(f.seg[`shin${s}`]), -1), knee, BODY.r.ankle, BODY.r.knee, pal, 0.3, 2.6, 0.72);
  drawFoot(ctx, ankle, f.seg[`foot${s}`], pal);
  limb(ctx, knee, hip, BODY.r.knee, BODY.r.thighTop, pal, 0.6, 1.4, 0.55);
  ball(ctx, knee, BODY.r.knee * 0.96, pal);
}

function sideArm(ctx: CanvasRenderingContext2D, f: Frame, s: "L" | "R", pal: Palette) {
  const sh = f.pts.shoulder;
  const el = f.pts[`elbow${s}`];
  const hd = f.pts[`hand${s}`];
  limb(ctx, el, add(hd, down(f.seg[`fore${s}`]), -3), BODY.r.elbow, BODY.r.wrist, pal, 1.2, 0.6, 0.25);
  drawHand(ctx, hd, f.seg[`fore${s}`], pal);
  limb(ctx, sh, el, BODY.r.upperArm + 0.8, BODY.r.elbow, pal, 1.0, 0.8, 0.45);
  ball(ctx, sh, 6.3, pal);
}

function drawSideFigure(ctx: CanvasRenderingContext2D, f: Frame, layer: LayerFn) {
  sideLeg(ctx, f, "L", GOLD_FAR);
  sideArm(ctx, f, "L", GOLD_FAR);
  layer("far");
  layer("mid");
  torsoSide(ctx, f);
  drawHeadSide(ctx, f);
  sideLeg(ctx, f, "R", GOLD_NEAR);
  layer("near");
  sideArm(ctx, f, "R", GOLD_NEAR);
}

function drawFrontFigure(ctx: CanvasRenderingContext2D, f: Frame, layer: LayerFn) {
  const p = f.pts;
  layer("far");
  for (const s of ["L", "R"] as const) {
    const hip = p[`hip${s}`];
    const knee = p[`knee${s}`];
    const ankle = p[`ankle${s}`];
    const pal = GOLD_NEAR;
    limb(ctx, ankle, knee, BODY.r.ankle, BODY.r.knee, pal, 1.2, 1.2, 0.7);
    limb(ctx, knee, hip, BODY.r.knee, BODY.r.thighTop, pal, 1, 1, 0.55);
    ball(ctx, knee, BODY.r.knee * 0.95, pal);
    // Foot seen from the front (toes slightly out).
    const sole = p[`sole${s}`];
    const k = s === "L" ? 1 : -1;
    ctx.save();
    ctx.translate(sole[0], sole[1]);
    ctx.rotate(((-f.seg.T1) * Math.PI) / 180);
    ctx.fillStyle = shade(ctx, [k * 2, 3], [0, 1], 4, pal);
    ctx.beginPath();
    ctx.ellipse(k * 2.5, 3.2, 6.2, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();
  }
  layer("mid");
  // Torso.
  const T1 = f.seg.T1;
  const T2 = f.seg.T2;
  const r1 = frontOf(T1);
  const r2 = frontOf(T2);
  const u1 = up(T1);
  const u2 = up(T2);
  const st: [Vec, number, Vec][] = [
    [add(p.pelvis, u1, -6), 12.5, r1],
    [add(p.pelvis, u1, 4), 14, r1],
    [add(p.mid, u1, -4), 12.2, r1],
    [add(p.mid, u2, 8), 15.5, r2],
    [add(p.neckBase, u2, -6), 20, r2],
    [add(p.neckBase, u2, -1.5), 15, r2],
    [add(p.neckBase, u2, 1), 6, r2],
  ];
  const left = st.map(([c, w, n]) => add(c, n, w));
  const right = st.map(([c, w, n]) => add(c, n, -w)).reverse();
  const ring = [...left, ...right];
  ctx.beginPath();
  const m0: Vec = [(ring[0]![0] + ring[ring.length - 1]![0]) / 2, (ring[0]![1] + ring[ring.length - 1]![1]) / 2];
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  ctx.closePath();
  ctx.fillStyle = shade(ctx, p.mid, r2, 18, TORSO);
  ctx.fill();
  ctx.strokeStyle = TORSO.line;
  ctx.lineWidth = 0.7;
  ctx.stroke();
  // Sternum / ab line.
  ctx.strokeStyle = "rgba(90,60,10,0.35)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  const a1 = add(p.neckBase, u2, -8);
  const a2 = add(p.mid, u1, -10);
  ctx.moveTo(a1[0], a1[1]);
  ctx.lineTo(a2[0], a2[1]);
  const c1 = add(add(p.mid, u2, 14), r2, 0);
  ctx.moveTo(add(c1, r2, -10)[0], add(c1, r2, -10)[1]);
  ctx.quadraticCurveTo(add(c1, u2, -4)[0], add(c1, u2, -4)[1], add(c1, r2, 10)[0], add(c1, r2, 10)[1]);
  ctx.stroke();
  // Neck and head.
  const ha = f.seg.head;
  limb(ctx, add(p.neckBase, up(ha), -2), add(p.head, up(ha), -6), 5.6, 4.8, TORSO);
  ctx.save();
  ctx.translate(p.head[0], p.head[1]);
  ctx.rotate((-ha * Math.PI) / 180);
  const g = ctx.createRadialGradient(-3, 4, 1, 0, 0, 13);
  g.addColorStop(0, TORSO.hi);
  g.addColorStop(0.6, TORSO.mid);
  g.addColorStop(1, TORSO.lo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0.5, 8.6, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TORSO.line;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();
  layer("near");
  for (const s of ["L", "R"] as const) {
    const pal = GOLD_NEAR;
    const sh = p[`shoulder${s}`];
    const el = p[`elbow${s}`];
    const hd = p[`hand${s}`];
    limb(ctx, el, add(hd, down(f.seg[`fore${s}`]), -3), BODY.r.elbow, BODY.r.wrist, pal, 1, 1, 0.25);
    drawHand(ctx, hd, f.seg[`fore${s}`], pal);
    limb(ctx, sh, el, BODY.r.upperArm + 0.6, BODY.r.elbow, pal, 1, 1, 0.45);
    ball(ctx, sh, 6.8, pal);
  }
}
