import { add, down, len, sub } from "./skeleton";
import type { Frame, ResolvedProp, Vec } from "./types";

const STEEL_HI = "#c9ced4";
const STEEL = "#8a9097";
const STEEL_LO = "#3d4146";
const IRON = "#1b1b1d";
const IRON_RIM = "#a8812c";
const PAD = "#141414";
const PAD_EDGE = "#3b3b3e";
const FRAME = "#2c2e32";
const FRAME_HI = "#555a61";

type Ctx = CanvasRenderingContext2D;

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

function line(ctx: Ctx, a: Vec, b: Vec, w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function steelGrad(ctx: Ctx, a: Vec, b: Vec) {
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  g.addColorStop(0, STEEL_HI);
  g.addColorStop(0.5, STEEL);
  g.addColorStop(1, STEEL_LO);
  return g;
}

/** Plate seen face-on (side view of a barbell). */
export function plate(ctx: Ctx, c: Vec, r: number, hub = 3.2) {
  const g = ctx.createRadialGradient(c[0] - r * 0.3, c[1] + r * 0.35, r * 0.1, c[0], c[1], r);
  g.addColorStop(0, "#3a3a3c");
  g.addColorStop(0.7, IRON);
  g.addColorStop(1, "#0c0c0c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = IRON_RIM;
  ctx.lineWidth = Math.max(1.2, r * 0.07);
  ctx.stroke();
  ctx.strokeStyle = "rgba(168,129,44,0.35)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(c[0], c[1], r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = steelGrad(ctx, [c[0] - hub, c[1] + hub], [c[0] + hub, c[1] - hub]);
  ctx.beginPath();
  ctx.arc(c[0], c[1], hub, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = STEEL_LO;
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

function forearmAngle(f: Frame, hand: "handL" | "handR") {
  return hand === "handL" ? f.seg.foreL : f.seg.foreR;
}

function dumbbell(ctx: Ctx, c: Vec, orient: string | undefined, axisDeg: number, size = 1) {
  if (orient === "end" || !orient) {
    const r = 8.5 * size;
    ctx.fillStyle = IRON;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      const x = c[0] + Math.cos(a) * r;
      const y = c[1] + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = IRON_RIM;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = steelGrad(ctx, [c[0] - 2, c[1] + 2], [c[0] + 2, c[1] - 2]);
    ctx.beginPath();
    ctx.arc(c[0], c[1], 2.2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.rotate((axisDeg * Math.PI) / 180);
  const hw = 9 * size;
  ctx.fillStyle = steelGrad(ctx, [0, 2], [0, -2]);
  ctx.fillRect(-hw, -1.6, hw * 2, 3.2);
  for (const sgn of [-1, 1]) {
    rrect(ctx, sgn > 0 ? hw - 1 : -hw - 7.5 * size + 1, -8.5 * size, 7.5 * size, 17 * size, 2.2);
    ctx.fillStyle = IRON;
    ctx.fill();
    ctx.strokeStyle = IRON_RIM;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function kettlebell(ctx: Ctx, hand: Vec, dir: Vec, size = 1) {
  const c = add(hand, dir, 12 * size);
  const r = 9.5 * size;
  // Handle.
  ctx.strokeStyle = "#232326";
  ctx.lineWidth = 2.6 * size;
  ctx.beginPath();
  const hL = add(c, [dir[1], -dir[0]], 6 * size);
  const hR = add(c, [-dir[1], dir[0]], 6 * size);
  ctx.moveTo(hL[0], hL[1]);
  ctx.quadraticCurveTo(add(hand, dir, -3)[0], add(hand, dir, -3)[1], hR[0], hR[1]);
  ctx.stroke();
  const g = ctx.createRadialGradient(c[0] - r * 0.35, c[1] + r * 0.35, 1, c[0], c[1], r);
  g.addColorStop(0, "#4a4a4e");
  g.addColorStop(0.7, IRON);
  g.addColorStop(1, "#060606");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = IRON_RIM;
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

function cable(ctx: Ctx, from: Vec, to: Vec) {
  line(ctx, from, to, 0.9, "#b9bec4");
  // Pulley.
  ctx.fillStyle = steelGrad(ctx, [from[0] - 3, from[1] + 3], [from[0] + 3, from[1] - 3]);
  ctx.beginPath();
  ctx.arc(from[0], from[1], 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = STEEL_LO;
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

function machineFrame(ctx: Ctx, pts: Vec[], w = 3.2) {
  ctx.strokeStyle = FRAME;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.stroke();
  ctx.strokeStyle = FRAME_HI;
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

function pad(ctx: Ctx, a: Vec, b: Vec, thick = 7) {
  const d = sub(b, a);
  const L = len(d);
  const ang = Math.atan2(d[1], d[0]);
  ctx.save();
  ctx.translate(a[0], a[1]);
  ctx.rotate(ang);
  rrect(ctx, 0, -thick / 2, L, thick, 3);
  ctx.fillStyle = PAD;
  ctx.fill();
  ctx.strokeStyle = PAD_EDGE;
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.restore();
}

function stack(ctx: Ctx, x: number, y0: number, h: number) {
  ctx.fillStyle = "#18181a";
  rrect(ctx, x - 7, y0, 14, h, 1.5);
  ctx.fill();
  ctx.strokeStyle = "rgba(168,129,44,0.5)";
  ctx.lineWidth = 0.5;
  for (let y = y0 + 3; y < y0 + h; y += 3.2) line(ctx, [x - 6.5, y], [x + 6.5, y], 0.5, "rgba(168,129,44,0.35)");
}

/** Draw one piece of equipment. */
export function drawProp(ctx: Ctx, p: ResolvedProp, f: Frame, t: number) {
  const { def, at } = p;
  const size = def.size;
  switch (def.kind) {
    case "barbell": {
      if (def.variant === "empty") {
        // Bar seen end-on with collars, no plates.
        ctx.fillStyle = steelGrad(ctx, [at[0] - 3, at[1] + 3], [at[0] + 3, at[1] - 3]);
        ctx.beginPath();
        ctx.arc(at[0], at[1], 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = STEEL_LO;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      } else plate(ctx, at, size ?? 22.5, def.variant === "axle" ? 4.5 : 3.2);
      return;
    }
    case "plate":
      plate(ctx, at, size ?? 22.5);
      return;
    case "dumbbell": {
      const hand = def.follow ?? "handR";
      const fa = forearmAngle(f, hand);
      // Profile: the handle runs across the fist, perpendicular to the forearm.
      dumbbell(ctx, at, def.orient, def.angle ?? fa, size ?? 1);
      return;
    }
    case "kettlebell": {
      const hand = def.follow ?? "handR";
      const dir: Vec = def.orient === "vertical" ? [0, -1] : down(forearmAngle(f, hand));
      kettlebell(ctx, at, dir, size ?? 1);
      return;
    }
    case "bench": {
      // `at` = centre of the top of the pad.
      const w = def.w ?? 110;
      const h = at[1];
      rrect(ctx, at[0] - w / 2, h - 8, w, 8, 3);
      ctx.fillStyle = PAD;
      ctx.fill();
      ctx.strokeStyle = PAD_EDGE;
      ctx.lineWidth = 1;
      ctx.stroke();
      machineFrame(ctx, [[at[0] - w / 2 + 8, h - 8], [at[0] - w / 2 + 4, 0]]);
      machineFrame(ctx, [[at[0] + w / 2 - 8, h - 8], [at[0] + w / 2 - 4, 0]]);
      machineFrame(ctx, [[at[0] - w / 2 + 6, h - 12], [at[0] + w / 2 - 6, h - 12]], 2.4);
      return;
    }
    case "inclineBench": {
      // `at` = hinge point at the back of the seat (top of pads); angle = back-pad angle from horizontal (to the left).
      const ang = ((def.angle ?? 35) * Math.PI) / 180;
      const back = def.w ?? 78;
      const seat = def.h ?? 30;
      const dirx = def.variant === "right" ? 1 : -1;
      const top: Vec = [at[0] + dirx * Math.cos(ang) * back, at[1] + Math.sin(ang) * back];
      pad(ctx, add(at, [0, -3.5]), add(top, [0, -3.5]), 7.5);
      pad(ctx, add(at, [0, -3.5]), [at[0] - dirx * seat, at[1] - 3.5], 7.5);
      machineFrame(ctx, [[at[0] - dirx * seat * 0.6, at[1] - 8], [at[0] - dirx * seat * 0.8, 0]]);
      machineFrame(ctx, [[at[0], at[1] - 8], [at[0] + dirx * 22, 0]]);
      machineFrame(ctx, [add(top, [-dirx * 6 * Math.sin(ang), -6]), [top[0], 0]], 2.2);
      return;
    }
    case "rack": {
      // `at` = [x of the uprights, height of the hooks]. variant "pins" draws safety pins at `def.h`.
      const x = at[0];
      ctx.fillStyle = "#1f2023";
      ctx.fillRect(x - 3, 0, 6, 215);
      ctx.strokeStyle = FRAME_HI;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(x - 3, 0, 6, 215);
      for (let y = 20; y < 210; y += 6) {
        ctx.fillStyle = "#0b0b0c";
        ctx.beginPath();
        ctx.arc(x, y, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      machineFrame(ctx, [[x - 30, 1.5], [x + 30, 1.5]], 3);
      // J-hook.
      ctx.strokeStyle = "#2b2c30";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 3, at[1]);
      ctx.lineTo(x + 9, at[1]);
      ctx.lineTo(x + 9, at[1] + 4);
      ctx.stroke();
      if (def.h) machineFrame(ctx, [[x - 40, def.h], [x + 40, def.h]], 2.6);
      return;
    }
    case "pullupBar": {
      // `at` = bar centre. Frame goes back and down behind the athlete.
      const back = def.w ?? 45;
      machineFrame(ctx, [at, [at[0] - back, at[1] + 6], [at[0] - back, 0]], 4);
      ctx.fillStyle = steelGrad(ctx, [at[0] - 3, at[1] + 3], [at[0] + 3, at[1] - 3]);
      ctx.beginPath();
      ctx.arc(at[0], at[1], 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = STEEL_LO;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      return;
    }
    case "dipBars": {
      const w = def.w ?? 56;
      machineFrame(ctx, [[at[0] - w / 2, at[1]], [at[0] + w / 2, at[1]]], 4.2);
      machineFrame(ctx, [[at[0] - w / 2 + 6, at[1]], [at[0] - w / 2 + 2, 0]], 3.4);
      machineFrame(ctx, [[at[0] + w / 2 - 6, at[1]], [at[0] + w / 2 - 2, 0]], 3.4);
      return;
    }
    case "cableTower": {
      // `at` = [x, 0]; h = height of the tower.
      const h = def.h ?? 210;
      const x = at[0];
      ctx.fillStyle = "#18191c";
      ctx.fillRect(x - 12, 0, 24, h);
      ctx.strokeStyle = FRAME_HI;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(x - 12, 0, 24, h);
      stack(ctx, x, 6, 60);
      line(ctx, [x, 66], [x, h - 6], 0.8, "#9aa0a6");
      return;
    }
    case "cable": {
      if (p.to) cable(ctx, at, p.to);
      return;
    }
    case "band": {
      if (!p.to) return;
      const stretch = len(sub(p.to, at));
      ctx.strokeStyle = def.variant === "gold" ? "#d8ab3a" : "#b8463c";
      ctx.lineWidth = Math.max(1.4, 3.2 - stretch / 80);
      ctx.beginPath();
      ctx.moveTo(at[0], at[1]);
      const sag = Math.max(0, 14 - stretch / 6);
      const m = [(at[0] + p.to[0]) / 2, (at[1] + p.to[1]) / 2 - sag] as Vec;
      ctx.quadraticCurveTo(m[0], m[1], p.to[0], p.to[1]);
      ctx.stroke();
      ctx.fillStyle = "#2a2a2a";
      ctx.beginPath();
      ctx.arc(at[0], at[1], 1.8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "box": {
      const w = def.w ?? 60;
      const h = def.h ?? 50;
      rrect(ctx, at[0] - w / 2, 0, w, h, 2);
      const g = ctx.createLinearGradient(0, h, 0, 0);
      g.addColorStop(0, "#2a2219");
      g.addColorStop(1, "#15110c");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(212,170,60,0.55)";
      ctx.lineWidth = 1.1;
      ctx.stroke();
      line(ctx, [at[0] - w / 2 + 4, h - 5], [at[0] + w / 2 - 4, h - 5], 0.6, "rgba(212,170,60,0.25)");
      return;
    }
    case "chair": {
      // `at` = [front edge x of seat, seat height].
      const x = at[0];
      const sh = at[1];
      pad(ctx, [x - 42, sh - 3], [x, sh - 3], 6);
      machineFrame(ctx, [[x - 3, sh - 6], [x - 3, 0]], 2.6);
      machineFrame(ctx, [[x - 39, sh - 6], [x - 39, 0]], 2.6);
      machineFrame(ctx, [[x - 41, sh], [x - 46, sh + 45]], 2.6);
      return;
    }
    case "wall": {
      const x = at[0];
      const dir = def.variant === "left" ? -1 : 1;
      const g = ctx.createLinearGradient(x, 0, x + 40 * dir, 0);
      g.addColorStop(0, "#26221a");
      g.addColorStop(1, "rgba(20,18,14,0)");
      ctx.fillStyle = g;
      ctx.fillRect(dir > 0 ? x : x - 40, 0, 40, 240);
      line(ctx, [x, 0], [x, 240], 1.4, "rgba(212,170,60,0.45)");
      return;
    }
    case "sled": {
      // `at` = [x centre, 0]; variant "push" (tall poles toward -x), otherwise low drag sled.
      const x = at[0];
      const push = def.variant === "push";
      machineFrame(ctx, [[x - 40, 3], [x + 40, 3]], 4);
      ctx.strokeStyle = FRAME;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 40, 3);
      ctx.quadraticCurveTo(x + 50, 3, x + 50, 12);
      ctx.stroke();
      machineFrame(ctx, [[x, 3], [x, 30]], 4);
      plate(ctx, [x, 26], 21);
      if (push) machineFrame(ctx, [[x - 22, 6], [x - 34, 100]], 3.6);
      return;
    }
    case "sandbag": {
      const w = def.w ?? 46;
      const h = def.h ?? 26;
      ctx.save();
      ctx.translate(at[0], at[1]);
      ctx.rotate(((def.angle ?? 0) * Math.PI) / 180);
      rrect(ctx, -w / 2, -h / 2, w, h, h / 2.3);
      const g = ctx.createLinearGradient(0, h / 2, 0, -h / 2);
      g.addColorStop(0, "#3c3a2c");
      g.addColorStop(1, "#1a1912");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(212,170,60,0.4)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      line(ctx, [-w * 0.2, -h / 2 + 1], [-w * 0.2, h / 2 - 1], 1.4, "#0e0e0b");
      line(ctx, [w * 0.2, -h / 2 + 1], [w * 0.2, h / 2 - 1], 1.4, "#0e0e0b");
      ctx.restore();
      return;
    }
    case "medball": {
      const r = size ?? 12;
      const g = ctx.createRadialGradient(at[0] - r * 0.35, at[1] + r * 0.35, 1, at[0], at[1], r);
      g.addColorStop(0, "#4b4b4e");
      g.addColorStop(0.75, "#1d1d1f");
      g.addColorStop(1, "#080808");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(at[0], at[1], r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(212,170,60,0.75)";
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(at[0], at[1], r * 0.45, r * 0.98, 0.4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(212,170,60,0.45)";
      ctx.stroke();
      return;
    }
    case "yoke": {
      // `at` = crossbar (on the upper back). Uprights hang to just above the floor.
      const x = at[0];
      const bottom = 12;
      machineFrame(ctx, [[x, at[1]], [x, bottom]], 4.6);
      machineFrame(ctx, [[x - 14, bottom], [x + 14, bottom]], 4);
      plate(ctx, [x, bottom + 21], 20);
      ctx.fillStyle = steelGrad(ctx, [x - 4, at[1] + 4], [x + 4, at[1] - 4]);
      ctx.beginPath();
      ctx.arc(x, at[1], 4.2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "farmerHandle": {
      const L = def.w ?? 120;
      machineFrame(ctx, [[at[0] - L / 2, at[1]], [at[0] + L / 2, at[1]]], 4.4);
      plate(ctx, [at[0] - L / 2 + 6, at[1]], 20);
      plate(ctx, [at[0] + L / 2 - 6, at[1]], 20);
      return;
    }
    case "trapBar": {
      // Hex frame around the lifter (behind), plates at the handle height (near side).
      const r = size ?? 22.5;
      machineFrame(ctx, [[at[0] - 30, at[1] + 3], [at[0] - 18, at[1] + 3]], 3.4);
      machineFrame(ctx, [[at[0] + 18, at[1] + 3], [at[0] + 30, at[1] + 3]], 3.4);
      plate(ctx, at, r);
      return;
    }
    case "stone": {
      const r = size ?? 23;
      const g = ctx.createRadialGradient(at[0] - r * 0.35, at[1] + r * 0.4, 2, at[0], at[1], r);
      g.addColorStop(0, "#7a7873");
      g.addColorStop(0.6, "#4a4844");
      g.addColorStop(1, "#1d1c1a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(at[0], at[1], r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      return;
    }
    case "platform": {
      const w = def.w ?? 50;
      const h = def.h ?? 120;
      rrect(ctx, at[0] - w / 2, 0, w, h, 2);
      ctx.fillStyle = "#1c1a16";
      ctx.fill();
      ctx.strokeStyle = "rgba(212,170,60,0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();
      return;
    }
    case "log": {
      const r = size ?? 15;
      const g = ctx.createRadialGradient(at[0] - 4, at[1] + 4, 1, at[0], at[1], r);
      g.addColorStop(0, "#3d3d40");
      g.addColorStop(1, "#111113");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(at[0], at[1], r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = IRON_RIM;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.strokeStyle = "rgba(168,129,44,0.4)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(at[0], at[1], r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = steelGrad(ctx, [at[0] - 3, at[1] + 3], [at[0] + 3, at[1] - 3]);
      ctx.beginPath();
      ctx.arc(at[0], at[1], 3.4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "keg": {
      const w = def.w ?? 36;
      const h = def.h ?? 50;
      rrect(ctx, at[0] - w / 2, at[1] - h / 2, w, h, 6);
      const g = ctx.createLinearGradient(at[0] - w / 2, 0, at[0] + w / 2, 0);
      g.addColorStop(0, "#d7dbe0");
      g.addColorStop(0.45, "#8e949b");
      g.addColorStop(1, "#3c4046");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = STEEL_LO;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      line(ctx, [at[0] - w / 2, at[1] + h * 0.22], [at[0] + w / 2, at[1] + h * 0.22], 1.4, "#5b6066");
      line(ctx, [at[0] - w / 2, at[1] - h * 0.22], [at[0] + w / 2, at[1] - h * 0.22], 1.4, "#5b6066");
      return;
    }
    case "jumpRope": {
      // `at` = the rope's farthest point; handles are in the hands.
      const hL = f.pts.handL;
      const hR = f.pts.handR;
      ctx.strokeStyle = "rgba(230,200,120,0.9)";
      ctx.lineWidth = 1.1;
      for (const h of [hL, hR]) {
        ctx.beginPath();
        ctx.moveTo(h[0], h[1]);
        const c = add(at, sub(h, at), 0.15);
        ctx.quadraticCurveTo(c[0] + (at[0] - h[0]) * 0.6, c[1] + (at[1] - h[1]) * 0.6, at[0], at[1]);
        ctx.stroke();
      }
      for (const h of [hL, hR]) line(ctx, add(h, [0, 3]), add(h, [0, -6]), 2.6, "#1d1d1f");
      return;
    }
    case "heavyBag": {
      const w = def.w ?? 36;
      const h = def.h ?? 105;
      const top = at[1];
      line(ctx, [at[0], top], [at[0], 250], 1, "#5d6167");
      rrect(ctx, at[0] - w / 2, top - h, w, h, 8);
      const g = ctx.createLinearGradient(at[0] - w / 2, 0, at[0] + w / 2, 0);
      g.addColorStop(0, "#3a2c1a");
      g.addColorStop(0.4, "#24190d");
      g.addColorStop(1, "#0f0b06");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(212,170,60,0.45)";
      ctx.lineWidth = 0.9;
      ctx.stroke();
      return;
    }
    case "battleRope": {
      // From the hands to an anchor at `at`, with a travelling wave.
      const hand = f.pts.handR;
      const anchor = at;
      const amp0 = hand[1] - (def.h ?? hand[1]);
      ctx.strokeStyle = "#3b352a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      const N = 40;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const x = hand[0] + (anchor[0] - hand[0]) * u;
        const base = hand[1] + (anchor[1] - hand[1]) * u - Math.sin(Math.PI * u) * 6;
        const wave = (1 - u) * (amp0 * Math.cos(u * 14 - t * 9) * 0.9);
        const y = base + wave * 0.5 + (1 - u) * 0;
        if (i === 0) ctx.moveTo(hand[0], hand[1]);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = FRAME;
      ctx.fillRect(anchor[0] - 3, 0, 6, anchor[1] + 3);
      return;
    }
    case "rower": {
      // `at` = flywheel position [x, 0] (front); `to` = seat (butt).
      const x = at[0];
      machineFrame(ctx, [[x - 150, 6], [x + 4, 6]], 4);
      machineFrame(ctx, [[x - 150, 6], [x - 150, 0]], 4);
      ctx.fillStyle = "#151517";
      ctx.beginPath();
      ctx.arc(x + 8, 32, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(212,170,60,0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();
      machineFrame(ctx, [[x - 12, 6], [x - 8, 22], [x - 2, 30]], 3);
      // Footplate.
      pad(ctx, [x - 20, 10], [x - 12, 30], 3.2);
      if (p.to) {
        pad(ctx, [p.to[0] - 12, p.to[1] - 3], [p.to[0] + 12, p.to[1] - 3], 5);
        machineFrame(ctx, [[p.to[0], p.to[1] - 5], [p.to[0], 7]], 2.5);
      }
      const hands = f.pts.handR;
      line(ctx, [x + 4, 34], hands, 0.9, "#9aa0a6");
      line(ctx, add(hands, [0, 5]), add(hands, [0, -5]), 2.6, "#1d1d1f");
      return;
    }
    case "bike": {
      // `at` = seat top [x, y]. Fan in front; crank below the seat; handles move with the hands.
      const seat = at;
      const crank: Vec = [seat[0] + 12, 36];
      const fan: Vec = [seat[0] + 70, 40];
      machineFrame(ctx, [[seat[0] - 30, 3], [seat[0] + 95, 3]], 4);
      machineFrame(ctx, [[seat[0] - 6, seat[1] - 4], crank, [fan[0] - 4, fan[1] + 4]], 4);
      machineFrame(ctx, [[seat[0] - 4, seat[1] - 6], [seat[0] - 22, 3]], 3.5);
      machineFrame(ctx, [fan, [fan[0] + 18, 3]], 3.5);
      ctx.fillStyle = "#161618";
      ctx.beginPath();
      ctx.arc(fan[0], fan[1], 29, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(212,170,60,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = t * 7 + (i * Math.PI) / 3;
        line(ctx, fan, [fan[0] + Math.cos(a) * 25, fan[1] + Math.sin(a) * 25], 0.8, "rgba(212,170,60,0.3)");
      }
      pad(ctx, [seat[0] - 12, seat[1] - 3], [seat[0] + 8, seat[1] - 3], 6);
      if (def.variant !== "upright") {
        for (const h of ["handL", "handR"] as const) machineFrame(ctx, [f.pts[h], [fan[0] - 12, 48]], 2.6);
      }
      for (const s of ["L", "R"] as const) line(ctx, crank, f.pts[`sole${s}`], 2.2, "#2d2f33");
      return;
    }
    case "landmine": {
      // `at` = floor pivot, `to` = hands. Bar continues beyond the hands to a plate.
      const end = p.to ?? at;
      const d = sub(end, at);
      const L = len(d);
      const tip = add(at, d, (L + 18) / L);
      line(ctx, at, tip, 3.2, STEEL);
      line(ctx, at, tip, 0.8, STEEL_HI);
      ctx.save();
      ctx.translate(add(at, d, (L + 10) / L)[0], add(at, d, (L + 10) / L)[1]);
      ctx.rotate(Math.atan2(d[1], d[0]));
      ctx.fillStyle = IRON;
      rrect(ctx, -3, -20, 6, 40, 2);
      ctx.fill();
      ctx.strokeStyle = IRON_RIM;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = FRAME;
      ctx.fillRect(at[0] - 6, 0, 12, 5);
      return;
    }
    case "abWheel": {
      const r = 10;
      const c: Vec = [at[0], r];
      ctx.fillStyle = "#151517";
      ctx.beginPath();
      ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(212,170,60,0.7)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = STEEL;
      ctx.beginPath();
      ctx.arc(c[0], c[1], 2.4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "mat": {
      const w = def.w ?? 180;
      rrect(ctx, at[0] - w / 2, -0.5, w, 2.2, 1);
      ctx.fillStyle = "#2a2318";
      ctx.fill();
      ctx.strokeStyle = "rgba(212,170,60,0.35)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      return;
    }
    case "legPress": {
      // `at` = seat hinge; `to` = feet (platform follows the feet along a 45° rail).
      const s = at;
      pad(ctx, [s[0] - 2, s[1] - 4], [s[0] + 28, s[1] - 4], 7);
      pad(ctx, [s[0] - 2, s[1] - 4], [s[0] - 38, s[1] + 34], 7);
      machineFrame(ctx, [[s[0] - 40, 3], [s[0] + 150, 3]], 4);
      machineFrame(ctx, [[s[0] + 5, s[1] - 8], [s[0] + 5, 3]], 4);
      machineFrame(ctx, [[s[0] + 40, 20], [s[0] + 150, 130]], 3.2);
      machineFrame(ctx, [[s[0] + 150, 3], [s[0] + 150, 130]], 3.2);
      if (p.to) {
        const ft = p.to;
        const n: Vec = [Math.SQRT1_2, -Math.SQRT1_2];
        const a = add(ft, n, 3);
        const plateDir: Vec = [-Math.SQRT1_2, -Math.SQRT1_2];
        pad(ctx, add(a, plateDir, -24), add(a, plateDir, 18), 4);
        plate(ctx, add(a, n, 16), 20);
      }
      return;
    }
    case "hackSquat": {
      // `at` = bottom of the rail (behind the feet); angle = rail angle; `to` = upper back.
      const ang = ((def.angle ?? 70) * Math.PI) / 180;
      const dir: Vec = [-Math.cos(ang), Math.sin(ang)];
      machineFrame(ctx, [at, add(at, dir, 210)], 4.2);
      machineFrame(ctx, [[at[0] - 20, 3], [at[0] + 45, 3]], 4);
      machineFrame(ctx, [add(at, dir, 210), [add(at, dir, 210)[0], 3]], 3);
      pad(ctx, [at[0] - 6, 9], [at[0] + 42, 15], 4);
      if (p.to) {
        const b = p.to;
        pad(ctx, add(b, dir, -55), add(b, dir, 12), 7);
        plate(ctx, add(add(b, dir, -10), [-dir[1], dir[0]], -14), 18);
      }
      return;
    }
    case "legExtension":
    case "seatedLegCurl": {
      // `at` = front of the seat (knee pivot), `to` = shin pad position.
      const s = at;
      pad(ctx, [s[0] - 45, s[1] - 4], [s[0], s[1] - 4], 8);
      pad(ctx, [s[0] - 46, s[1] - 2], [s[0] - 52, s[1] + 55], 8);
      machineFrame(ctx, [[s[0] - 20, s[1] - 8], [s[0] - 20, 3]], 4);
      machineFrame(ctx, [[s[0] - 50, 3], [s[0] + 30, 3]], 4);
      machineFrame(ctx, [[s[0] + 3, s[1] + 2], [s[0] + 3, 3]], 3);
      if (p.to) {
        machineFrame(ctx, [[s[0] + 3, s[1] + 2], p.to], 3);
        ctx.fillStyle = PAD;
        ctx.beginPath();
        ctx.arc(p.to[0], p.to[1], 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PAD_EDGE;
        ctx.stroke();
      }
      if (def.kind === "seatedLegCurl") pad(ctx, [s[0] - 30, s[1] + 18], [s[0] + 2, s[1] + 18], 6);
      return;
    }
    case "legCurl": {
      // Prone: `at` = knee end of the pad; the pad runs toward the head (+x); `to` = ankle pad.
      const s = at;
      pad(ctx, [s[0], s[1] - 4], [s[0] + 125, s[1] - 4], 8);
      machineFrame(ctx, [[s[0] + 100, s[1] - 8], [s[0] + 100, 3]], 4);
      machineFrame(ctx, [[s[0] + 10, s[1] - 8], [s[0] + 10, 3]], 4);
      machineFrame(ctx, [[s[0] - 20, 3], [s[0] + 130, 3]], 4);
      if (p.to) {
        machineFrame(ctx, [[s[0] - 6, s[1] - 2], p.to], 3);
        ctx.fillStyle = PAD;
        ctx.beginPath();
        ctx.arc(p.to[0], p.to[1], 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case "chestPress": {
      // `at` = seat (butt), `to` = hands.
      const s = at;
      pad(ctx, [s[0] - 10, s[1] - 4], [s[0] + 26, s[1] - 4], 8);
      pad(ctx, [s[0] - 12, s[1]], [s[0] - 18, s[1] + 62], 8);
      machineFrame(ctx, [[s[0], s[1] - 8], [s[0], 3]], 4);
      machineFrame(ctx, [[s[0] - 30, 3], [s[0] + 90, 3]], 4);
      machineFrame(ctx, [[s[0] - 18, s[1] + 62], [s[0] - 18, s[1] + 95], [s[0] + 75, s[1] + 95], [s[0] + 75, 3]], 3.2);
      if (p.to) {
        machineFrame(ctx, [p.to, [s[0] + 75, s[1] + 70]], 3);
        line(ctx, add(p.to, [0, 5]), add(p.to, [0, -5]), 3, "#1d1d1f");
      }
      return;
    }
    case "latPulldown": {
      // `at` = seat (butt), `to` = hands. Pulley overhead slightly in front.
      const s = at;
      pad(ctx, [s[0] - 16, s[1] - 4], [s[0] + 18, s[1] - 4], 8);
      machineFrame(ctx, [[s[0], s[1] - 8], [s[0], 3]], 4);
      machineFrame(ctx, [[s[0] - 40, 3], [s[0] + 50, 3]], 4);
      // Thigh pad.
      pad(ctx, [s[0] + 18, s[1] + 22], [s[0] + 38, s[1] + 22], 6);
      machineFrame(ctx, [[s[0] + 38, s[1] + 22], [s[0] + 50, s[1] + 22], [s[0] + 50, 3]], 3);
      machineFrame(ctx, [[s[0] + 50, 3], [s[0] + 50, 235], [s[0] + 8, 235]], 3.4);
      if (p.to) {
        cable(ctx, [s[0] + 8, 232], p.to);
        line(ctx, add(p.to, [-24, 1]), add(p.to, [24, 1]), 2.4, "#2a2c30");
      }
      return;
    }
    case "cableRowSeat": {
      // `at` = seat (butt); foot plate in front; `to` = hands; pulley low in front.
      const s = at;
      const front = s[0] + (def.w ?? 92);
      pad(ctx, [s[0] - 25, s[1] - 4], [front - 20, s[1] - 4], 8);
      machineFrame(ctx, [[s[0] - 20, s[1] - 8], [s[0] - 20, 3]], 3.6);
      machineFrame(ctx, [[front - 25, s[1] - 8], [front - 25, 3]], 3.6);
      pad(ctx, [front - 6, s[1] - 2], [front + 2, s[1] + 26], 4);
      machineFrame(ctx, [[front + 12, 3], [front + 12, 180]], 4);
      if (p.to) cable(ctx, [front + 10, s[1] + 12], p.to);
      return;
    }
    case "calfMachine": {
      // Seated calf raise: `at` = seat, `to` = knee pad position.
      const s = at;
      pad(ctx, [s[0] - 20, s[1] - 4], [s[0] + 20, s[1] - 4], 8);
      machineFrame(ctx, [[s[0], s[1] - 8], [s[0], 3]], 4);
      machineFrame(ctx, [[s[0] - 25, 3], [s[0] + 75, 3]], 4);
      pad(ctx, [s[0] + 34, 10], [s[0] + 56, 10], 5);
      if (p.to) {
        pad(ctx, add(p.to, [-14, 5]), add(p.to, [14, 5]), 6);
        machineFrame(ctx, [add(p.to, [10, 5]), [s[0] + 65, 3]], 3);
        plate(ctx, add(p.to, [24, -6]), 13);
      }
      return;
    }
    case "cone": {
      const h = def.h ?? 16;
      ctx.fillStyle = "#c98a2a";
      ctx.beginPath();
      ctx.moveTo(at[0] - 6, 0);
      ctx.lineTo(at[0], h);
      ctx.lineTo(at[0] + 6, 0);
      ctx.closePath();
      ctx.fill();
      line(ctx, [at[0] - 8, 0.6], [at[0] + 8, 0.6], 1.4, "#6e4c17");
      return;
    }
    case "ladder": {
      const w = def.w ?? 300;
      for (let x = at[0] - w / 2; x <= at[0] + w / 2; x += 45) line(ctx, [x - 9, 0.5], [x + 9, 0.5], 1.6, "rgba(212,170,60,0.6)");
      return;
    }
    case "stairs": {
      // `at` = foot of the first step; each step h × w, rising to +x.
      const sw = def.w ?? 30;
      const sh = def.h ?? 18;
      ctx.fillStyle = "#1b1915";
      ctx.strokeStyle = "rgba(212,170,60,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(at[0] - 200, 0);
      for (let i = 0; i < 8; i++) {
        const x = at[0] + i * sw;
        ctx.lineTo(x, i * sh);
        ctx.lineTo(x, (i + 1) * sh);
      }
      ctx.lineTo(at[0] + 8 * sw + 200, 8 * sh);
      ctx.lineTo(at[0] + 8 * sw + 200, 0);
      ctx.closePath();
      ctx.stroke();
      return;
    }
    case "rope": {
      if (!p.to) return;
      ctx.strokeStyle = "#6b5a3a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(at[0], at[1]);
      const m: Vec = [(at[0] + p.to[0]) / 2, Math.min(at[1], p.to[1]) - 8];
      ctx.quadraticCurveTo(m[0], m[1], p.to[0], p.to[1]);
      ctx.stroke();
      return;
    }
    case "hurdleLine": {
      line(ctx, [at[0], 0.4], [at[0] + (def.w ?? 8), 0.4], 2, "rgba(240,220,160,0.75)");
      return;
    }
    case "hyper": {
      // 45° back-extension bench: `at` = hip pad, `to` = ankle roller.
      const ft = p.to ?? at;
      const d = sub(at, ft);
      const L = len(d) || 1;
      const u: Vec = [d[0] / L, d[1] / L];
      const n: Vec = [u[1], -u[0]];
      pad(ctx, add(add(at, n, 7), u, -12), add(add(at, n, 7), u, 10), 8);
      machineFrame(ctx, [add(at, n, 12), add(ft, n, 10), [ft[0] - 10, 3], [at[0] + 30, 3]], 3.6);
      machineFrame(ctx, [add(at, n, 12), [at[0] + 10, 3]], 3.2);
      ctx.fillStyle = PAD;
      ctx.beginPath();
      ctx.arc(ft[0] + 4, ft[1] + 6, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PAD_EDGE;
      ctx.stroke();
      return;
    }
    case "pad": {
      const w = def.w ?? 30;
      rrect(ctx, at[0] - w / 2, at[1] - 3, w, def.h ?? 4, 1.5);
      ctx.fillStyle = "#2a2318";
      ctx.fill();
      return;
    }
  }
}
