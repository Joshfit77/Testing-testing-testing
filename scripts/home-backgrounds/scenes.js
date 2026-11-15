// The seven Home backgrounds, drawn procedurally (original artwork: no stock, no generated photographs).
// Runs in a browser page driven by render.mjs. Each scene is a dark, backlit black-and-gold composition with its
// subject in the upper right, because the Home hero puts the greeting and the verse on the left and at the bottom.
/* global FIG */
const W = 1600;
const H = 1040;
const FLOOR = 660;

const mk = (w = W, h = H) => Object.assign(document.createElement("canvas"), { width: w, height: h });
const lin = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
const rad = (ctx, x, y, r, stops) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); for (const [o, c] of stops) g.addColorStop(o, c); return g; };

// Deterministic noise, so a re-render gives the same picture.
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

function glow(ctx, x, y, r, stops, sx = 1, sy = 1, mode = "lighter") {
  ctx.save(); ctx.globalCompositeOperation = mode; ctx.translate(x, y); ctx.scale(sx, sy);
  ctx.fillStyle = rad(ctx, 0, 0, r, stops); ctx.fillRect(-r, -r, 2 * r, 2 * r); ctx.restore();
}
const WARM = (a) => [[0, `rgba(255,236,190,${a})`], [0.18, `rgba(246,200,112,${a * 0.72})`], [0.5, `rgba(190,120,44,${a * 0.28})`], [1, "rgba(120,70,20,0)"]];

function room(ctx, o = {}) {
  ctx.fillStyle = lin(ctx, 0, 0, 0, FLOOR, [[0, o.top ?? "#040302"], [0.55, o.mid ?? "#0d0906"], [1, o.low ?? "#1a120a"]]);
  ctx.fillRect(0, 0, W, FLOOR);
  ctx.fillStyle = lin(ctx, 0, FLOOR, 0, H, [[0, o.floorFar ?? "#1c130a"], [0.25, o.floorMid ?? "#0e0906"], [1, o.floorNear ?? "#050403"]]);
  ctx.fillRect(0, FLOOR, W, H - FLOOR);
  // A thin warm line where the floor meets the wall.
  ctx.fillStyle = lin(ctx, 0, 0, W, 0, [[0, "rgba(120,84,36,0)"], [0.45, "rgba(150,104,44,0.25)"], [0.72, "rgba(214,160,74,0.5)"], [1, "rgba(120,84,36,0.1)"]]);
  ctx.fillRect(0, FLOOR - 1, W, 2);
}
// Light pooled on a polished floor: an ellipse of glow and a soft vertical reflection streak.
function pool(ctx, x, rx, a = 0.55, y = FLOOR + 60) {
  glow(ctx, x, y, rx, WARM(a), 1, 0.2);
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.filter = "blur(26px)";
  ctx.fillStyle = lin(ctx, 0, FLOOR, 0, H, [[0, `rgba(246,200,112,${a * 0.5})`], [0.7, "rgba(190,120,44,0)"]]);
  ctx.fillRect(x - rx * 0.16, FLOOR, rx * 0.32, H - FLOOR); ctx.restore();
}
// Shafts of light: blurred translucent wedges from a source.
function rays(ctx, x, y, list, a = 0.16, blur = 22) {
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.filter = `blur(${blur}px)`;
  for (const [ang, spread, len, k = 1] of list) {
    const a0 = ((ang - spread / 2) * Math.PI) / 180; const a1 = ((ang + spread / 2) * Math.PI) / 180;
    const g = ctx.createRadialGradient(x, y, 0, x, y, len);
    g.addColorStop(0, `rgba(255,232,180,${a * k})`); g.addColorStop(0.6, `rgba(240,190,104,${a * k * 0.45})`); g.addColorStop(1, "rgba(200,130,50,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a0) * len, y + Math.sin(a0) * len); ctx.lineTo(x + Math.cos(a1) * len, y + Math.sin(a1) * len); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function haze(ctx, seed, n = 9, a = 0.05, box = [700, 150, 1500, 700]) {
  const r = rng(seed); ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.filter = "blur(60px)";
  for (let i = 0; i < n; i++) {
    const x = box[0] + r() * (box[2] - box[0]); const y = box[1] + r() * (box[3] - box[1]);
    ctx.fillStyle = `rgba(230,180,100,${a * (0.5 + r())})`; ctx.beginPath(); ctx.ellipse(x, y, 160 + r() * 220, 40 + r() * 60, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function motes(ctx, seed, n, box, a = 0.5) {
  const r = rng(seed); ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) { const x = box[0] + r() * (box[2] - box[0]); const y = box[1] + r() * (box[3] - box[1]); const s = 0.8 + r() * 2.2; glow(ctx, x, y, s * 3, [[0, `rgba(255,240,200,${a * r()})`], [1, "rgba(255,240,200,0)"]]); }
  ctx.restore();
}
function finish(ctx, seed) {
  // Vignette, then fine grain (hides banding in the dark gradients).
  ctx.save(); ctx.fillStyle = rad(ctx, W * 0.66, H * 0.42, W * 0.82, [[0.35, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.72)"]]); ctx.fillRect(0, 0, W, H); ctx.restore();
  const img = ctx.getImageData(0, 0, W, H); const d = img.data; const r = rng(seed);
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 9; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8; }
  ctx.putImageData(img, 0, 0);
}

// A dark solid with a warm rim where the light catches its edge.
function solid(ctx, path, light, o = {}) {
  ctx.save(); ctx.beginPath(); path(ctx);
  ctx.fillStyle = o.fill ?? "#0a0705"; ctx.fill();
  ctx.clip(); ctx.beginPath(); path(ctx);
  ctx.lineWidth = (o.rim ?? 4) * 2; ctx.lineJoin = "round";
  ctx.strokeStyle = rad(ctx, light[0], light[1], o.reach ?? 520, [[0, `rgba(255,226,160,${o.a ?? 0.85})`], [0.5, `rgba(214,160,74,${(o.a ?? 0.85) * 0.5})`], [1, "rgba(160,100,40,0)"]]);
  ctx.stroke(); ctx.restore();
}
const rr = (x, y, w, h, r) => (ctx) => { ctx.roundRect(x, y, w, h, r); };
const poly = (pts) => (ctx) => { ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath(); };

function cross(ctx, cx, top, h, light, o = {}) {
  const bw = o.bw ?? h * 0.105; const arm = o.arm ?? h * 0.31; const ay = top + h * 0.27;
  solid(ctx, (c) => {
    c.moveTo(cx - bw / 2, top); c.lineTo(cx + bw / 2, top); c.lineTo(cx + bw / 2, ay - bw / 2); c.lineTo(cx + arm, ay - bw / 2); c.lineTo(cx + arm, ay + bw / 2);
    c.lineTo(cx + bw / 2, ay + bw / 2); c.lineTo(cx + bw / 2, top + h); c.lineTo(cx - bw / 2, top + h); c.lineTo(cx - bw / 2, ay + bw / 2); c.lineTo(cx - arm, ay + bw / 2);
    c.lineTo(cx - arm, ay - bw / 2); c.lineTo(cx - bw / 2, ay - bw / 2); c.closePath();
  }, light, { fill: o.fill ?? "#0b0705", rim: o.rim ?? 5, a: o.a ?? 0.9, reach: o.reach ?? h * 1.2 });
}

// A barbell seen from the front: the bar runs across the picture, the plates are seen edge-on.
function barbellFront(ctx, cx, y, half, light, plates = [[30, 150], [26, 150], [22, 120], [16, 92]]) {
  ctx.save(); ctx.fillStyle = lin(ctx, 0, y - 6, 0, y + 6, [[0, "#6d5a3a"], [0.4, "#2a2117"], [1, "#0c0906"]]); ctx.fillRect(cx - half - 70, y - 5, 2 * half + 140, 10); ctx.restore();
  for (const dir of [-1, 1]) {
    let x = cx + dir * half;
    solid(ctx, rr(x - 7, y - 20, 14, 40, 3), light, { fill: "#17110a", rim: 2 });
    x += dir * 9;
    for (const [w, d] of plates) {
      const x0 = dir > 0 ? x : x - w;
      solid(ctx, rr(x0, y - d / 2, w, d, 6), light, { fill: "#090605", rim: 3, a: 0.75 });
      x += dir * (w + 2);
    }
  }
}
// A barbell seen end-on: one plate facing the viewer.
function barbellEnd(ctx, cx, cy, r, light) {
  solid(ctx, (c) => c.arc(cx, cy, r, 0, 7), light, { fill: "#0a0705", rim: 5, a: 0.9, reach: r * 5 });
  ctx.save(); ctx.strokeStyle = "rgba(190,140,66,0.22)"; ctx.lineWidth = 2;
  for (const k of [0.82, 0.56]) { ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, 7); ctx.stroke(); }
  ctx.restore();
  solid(ctx, (c) => c.arc(cx, cy, r * 0.2, 0, 7), light, { fill: "#2a2015", rim: 3, a: 1, reach: r * 4 });
  solid(ctx, (c) => c.arc(cx, cy, r * 0.085, 0, 7), light, { fill: "#6a5433", rim: 2, a: 1, reach: r * 4 });
}
function dumbbell(ctx, cx, y, s, light) {
  ctx.save(); ctx.fillStyle = "#2c2318"; ctx.fillRect(cx - 34 * s, y - 5 * s, 68 * s, 10 * s); ctx.restore();
  for (const d of [-1, 1]) solid(ctx, rr(cx + d * 34 * s - (d > 0 ? 0 : 30 * s), y - 22 * s, 30 * s, 44 * s, 7 * s), light, { fill: "#090605", rim: 3, a: 0.7 });
}
function kettlebell(ctx, cx, base, s, light) {
  solid(ctx, (c) => { c.arc(cx, base - 34 * s, 34 * s, 0, 7); }, light, { fill: "#090605", rim: 4, a: 0.8 });
  ctx.save(); ctx.strokeStyle = "#0b0806"; ctx.lineWidth = 11 * s; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx - 20 * s, base - 62 * s); ctx.bezierCurveTo(cx - 28 * s, base - 108 * s, cx + 28 * s, base - 108 * s, cx + 20 * s, base - 62 * s); ctx.stroke();
  ctx.strokeStyle = "rgba(230,180,96,0.45)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 22 * s, base - 70 * s); ctx.bezierCurveTo(cx - 27 * s, base - 106 * s, cx + 20 * s, base - 110 * s, cx + 23 * s, base - 76 * s); ctx.stroke(); ctx.restore();
}
function bench(ctx, x, w, top, light) {
  // Side-on flat bench: pad, beam, two splayed legs.
  for (const lx of [x + w * 0.17, x + w * 0.83]) solid(ctx, poly([[lx - 9, top + 40], [lx + 9, top + 40], [lx + 26, FLOOR], [lx - 26, FLOOR]]), light, { fill: "#0a0705", rim: 2, a: 0.6 });
  solid(ctx, rr(x + w * 0.08, top + 34, w * 0.84, 12, 3), light, { fill: "#120d08", rim: 2, a: 0.6 });
  solid(ctx, rr(x, top, w, 38, 14), light, { fill: "#0c0806", rim: 4, a: 0.85 });
}
function figure(ctx, kind, x, feetY, px, light, o = {}) {
  const f = FIG.figure(kind, px / 184, o);
  const w = f.width; const h = f.height;
  // Shadow thrown toward the viewer.
  if (o.shadow !== false) {
    ctx.save(); ctx.globalAlpha = o.shadowA ?? 0.6; ctx.filter = "blur(7px)"; ctx.translate(x, feetY); ctx.transform(1, 0, o.skew ?? -0.5, -(o.len ?? 0.42), 0, 0);
    ctx.drawImage(sil(f, "#000"), -f.ax, -f.ay); ctx.restore();
  }
  const dark = sil(f, o.fill ?? "#080604");
  ctx.drawImage(dark, x - f.ax, feetY - f.ay);
  // Rim light: the part of the silhouette that an offset copy does not cover, on the side facing the light.
  const dx = light[0] - x; const dy = light[1] - (feetY - h / 2); const L = Math.hypot(dx, dy) || 1; const k = o.rim ?? 4;
  const rim = sil(f, "rgba(255,222,150,1)"); const rc = rim.getContext("2d");
  rc.globalCompositeOperation = "destination-out"; rc.drawImage(f, (-dx / L) * k, (-dy / L) * k);
  ctx.save(); ctx.globalAlpha = o.rimA ?? 0.85; ctx.filter = "blur(0.6px)"; ctx.drawImage(rim, x - f.ax, feetY - f.ay); ctx.restore();
  void w;
}
function sil(src, color) {
  const c = mk(src.width, src.height); const x = c.getContext("2d");
  x.drawImage(src, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}

// ---------------------------------------------------------------------------------------------------------------
const SCENES = {
  // Monday: strength through Christ. A tall cross, backlit, with a loaded barbell and a kettlebell at its foot.
  monday(ctx) {
    room(ctx);
    const L = [1130, 330];
    glow(ctx, L[0], L[1], 620, WARM(0.5));
    glow(ctx, L[0], L[1] + 40, 260, WARM(0.55));
    rays(ctx, L[0], L[1], [[100, 16, 760, 1], [124, 12, 800, 0.8], [76, 12, 760, 0.8], [150, 10, 700, 0.6], [52, 10, 700, 0.6], [-90, 30, 420, 0.5]], 0.12, 30);
    haze(ctx, 11, 8, 0.045);
    pool(ctx, 1130, 520, 0.6);
    cross(ctx, 1130, 150, 512, L, { reach: 640 });
    barbellFront(ctx, 1130, 585, 190, [1130, 470]);
    kettlebell(ctx, 790, FLOOR, 1.05, [1130, 420]);
    finish(ctx, 101);
  },

  // Tuesday: discipline. A power rack with a racked bar, and a cross of light in the wall behind it.
  tuesday(ctx) {
    room(ctx, { low: "#17100a" });
    const cx = 1130;
    // The cross-shaped window: bright core, bloom, light fanning on to the floor.
    const wx = cx; const wt = 196; const wh = 330; const bw = 26;
    glow(ctx, wx, wt + 130, 560, WARM(0.42));
    rays(ctx, wx, wt + 120, [[96, 20, 820, 1], [120, 16, 860, 0.9], [140, 12, 820, 0.7], [72, 16, 820, 0.8], [50, 12, 760, 0.5]], 0.15, 34);
    ctx.save(); ctx.shadowColor = "rgba(255,214,140,0.95)"; ctx.shadowBlur = 44; ctx.fillStyle = lin(ctx, 0, wt, 0, wt + wh, [[0, "#fff6dc"], [0.5, "#ffe4a6"], [1, "#f1bd62"]]);
    ctx.fillRect(wx - bw / 2, wt, bw, wh); ctx.fillRect(wx - 86, wt + 92 - bw / 2, 172, bw); ctx.restore();
    haze(ctx, 21, 9, 0.05);
    pool(ctx, cx, 560, 0.62);
    const L = [wx, wt + 110];
    // Rack: base feet, two uprights, top beam, safety arms, hooks.
    const xl = cx - 176; const xr = cx + 176; const top = 150;
    solid(ctx, rr(xl - 60, FLOOR - 14, 120, 14, 3), L, { rim: 2, a: 0.6 });
    solid(ctx, rr(xr - 60, FLOOR - 14, 120, 14, 3), L, { rim: 2, a: 0.6 });
    for (const x of [xl, xr]) solid(ctx, rr(x - 15, top, 30, FLOOR - top - 8, 3), L, { fill: "#0a0705", rim: 4, a: 0.9, reach: 640 });
    solid(ctx, rr(xl - 15, top, xr - xl + 30, 26, 3), L, { fill: "#0a0705", rim: 3, a: 0.8, reach: 640 });
    for (const [x, d] of [[xl, 1], [xr, -1]]) {
      solid(ctx, rr(d > 0 ? x + 15 : x - 15 - 74, 498, 74, 12, 3), L, { rim: 2, a: 0.7 });
      solid(ctx, poly([[x - 15 * d, 372], [x - 40 * d, 372], [x - 40 * d, 352], [x - 30 * d, 352], [x - 30 * d, 362], [x - 15 * d, 362]]), L, { rim: 2, a: 0.8 });
    }
    // Holes in the uprights catch the light.
    ctx.save(); ctx.fillStyle = "rgba(240,190,104,0.4)"; for (const x of [xl, xr]) for (let y = top + 44; y < FLOOR - 40; y += 34) { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); } ctx.restore();
    barbellFront(ctx, cx, 358, 222, L, [[28, 196], [24, 196], [20, 150]]);
    finish(ctx, 202);
  },

  // Wednesday: faith first. An open Bible on a gym bench, in a shaft of light.
  wednesday(ctx) {
    room(ctx, { low: "#150f09" });
    const L = [820, 40];
    // A high window off to the left throws one shaft across the room on to the bench.
    rays(ctx, L[0], L[1], [[52, 13, 1100, 1.2], [58, 22, 1150, 0.6]], 0.3, 26);
    glow(ctx, 1130, 500, 420, WARM(0.42));
    haze(ctx, 31, 8, 0.05, [760, 200, 1500, 660]);
    pool(ctx, 1150, 420, 0.4);
    // Faint dumbbell rack along the back wall.
    ctx.save(); ctx.globalAlpha = 0.55;
    solid(ctx, rr(1330, 470, 250, 10, 2), [1130, 420], { rim: 2, a: 0.35 }); solid(ctx, rr(1330, 560, 250, 10, 2), [1130, 420], { rim: 2, a: 0.35 });
    for (const x of [1345, 1565]) solid(ctx, rr(x, 440, 10, FLOOR - 440, 2), [1130, 420], { rim: 2, a: 0.3 });
    for (let i = 0; i < 3; i++) { dumbbell(ctx, 1390 + i * 68, 452, 0.52, [1130, 420]); dumbbell(ctx, 1390 + i * 68, 542, 0.6, [1130, 420]); }
    ctx.restore();
    bench(ctx, 850, 560, 520, [1050, 380]);
    // The open Bible: cover, two page blocks, lit pages, ribbon.
    const bx = 1120; const by = 520;
    ctx.save(); ctx.translate(bx, by); ctx.scale(1.3, 1.3); ctx.translate(-bx, -by);
    solid(ctx, poly([[bx - 178, by - 14], [bx + 178, by - 14], [bx + 168, by + 2], [bx - 168, by + 2]]), [1000, 300], { fill: "#1a110a", rim: 2, a: 0.9 });
    const page = (dir) => {
      ctx.save(); ctx.beginPath();
      ctx.moveTo(bx, by - 30); ctx.bezierCurveTo(bx + dir * 40, by - 58, bx + dir * 120, by - 50, bx + dir * 168, by - 24);
      ctx.lineTo(bx + dir * 168, by - 12); ctx.bezierCurveTo(bx + dir * 120, by - 34, bx + dir * 40, by - 40, bx, by - 14); ctx.closePath();
      ctx.fillStyle = dir < 0 ? lin(ctx, bx - 170, 0, bx, 0, [[0, "#f9e9c0"], [0.7, "#f1d79c"], [1, "#b98f4e"]]) : lin(ctx, bx, 0, bx + 170, 0, [[0, "#a67c40"], [0.25, "#e6c98a"], [1, "#d9b572"]]);
      ctx.shadowColor = "rgba(255,226,160,0.8)"; ctx.shadowBlur = 26; ctx.fill(); ctx.restore();
      // Lines of text, only suggested.
      ctx.save(); ctx.strokeStyle = "rgba(90,60,24,0.5)"; ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) { const t = 0.2 + i * 0.2; ctx.beginPath(); ctx.moveTo(bx + dir * (18 + 0), by - 36 - 2 + i * 3.2 + 2); ctx.quadraticCurveTo(bx + dir * 90, by - 52 + i * 3.4 + t, bx + dir * 152, by - 30 + i * 3.2); ctx.stroke(); }
      ctx.restore();
    };
    page(-1); page(1);
    ctx.restore();
    ctx.save(); ctx.strokeStyle = "#7a1f18"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(bx + 2, by - 26); ctx.quadraticCurveTo(bx + 10, by + 18, bx + 26, by + 58); ctx.stroke(); ctx.restore();
    glow(ctx, bx - 30, by - 44, 190, WARM(0.5), 1, 0.5);
    dumbbell(ctx, 934, FLOOR - 20, 0.92, [1050, 420]);
    motes(ctx, 33, 70, [820, 80, 1300, 520], 0.55);
    finish(ctx, 303);
  },

  // Thursday: the narrow gate. An athlete walks toward a tall, narrow doorway filled with light.
  thursday(ctx) {
    room(ctx, { low: "#120d08", floorFar: "#1a120a" });
    const cx = 1150; const dw = 132; const top = 176; const dh = FLOOR - top;
    // Stone courses on the wall, barely visible.
    ctx.save(); ctx.strokeStyle = "rgba(160,120,70,0.07)"; ctx.lineWidth = 2;
    for (let y = 120; y < FLOOR; y += 66) { ctx.beginPath(); ctx.moveTo(620, y); ctx.lineTo(W, y); ctx.stroke(); for (let x = 640 + ((y / 66) % 2) * 70; x < W; x += 140) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 66); ctx.stroke(); } }
    ctx.restore();
    glow(ctx, cx, top + dh * 0.45, 640, WARM(0.5));
    const door = (c) => { c.moveTo(cx - dw / 2, FLOOR); c.lineTo(cx - dw / 2, top + dw / 2); c.arc(cx, top + dw / 2, dw / 2, Math.PI, 0); c.lineTo(cx + dw / 2, FLOOR); c.closePath(); };
    // Architrave, then the opening.
    ctx.save(); ctx.beginPath(); const f = 22; ctx.moveTo(cx - dw / 2 - f, FLOOR); ctx.lineTo(cx - dw / 2 - f, top + dw / 2); ctx.arc(cx, top + dw / 2, dw / 2 + f, Math.PI, 0); ctx.lineTo(cx + dw / 2 + f, FLOOR); ctx.closePath();
    ctx.fillStyle = lin(ctx, cx - 120, 0, cx + 120, 0, [[0, "#1c140b"], [0.5, "#3a2a14"], [1, "#1c140b"]]); ctx.fill();
    ctx.strokeStyle = "rgba(240,196,110,0.6)"; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.shadowColor = "rgba(255,226,160,1)"; ctx.shadowBlur = 70; ctx.beginPath(); door(ctx);
    ctx.fillStyle = lin(ctx, 0, top, 0, FLOOR, [[0, "#fff8e6"], [0.6, "#fff1cc"], [1, "#ffe1a0"]]); ctx.fill(); ctx.fill(); ctx.restore();
    rays(ctx, cx, top + 120, [[90, 30, 760, 1], [118, 18, 800, 0.7], [62, 18, 800, 0.7], [140, 12, 700, 0.4], [40, 12, 700, 0.4]], 0.2, 34);
    // The light on the floor: a path that widens toward the viewer.
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.filter = "blur(14px)";
    ctx.fillStyle = lin(ctx, 0, FLOOR, 0, H, [[0, "rgba(255,232,176,0.75)"], [0.45, "rgba(236,180,96,0.3)"], [1, "rgba(160,100,40,0)"]]);
    ctx.beginPath(); ctx.moveTo(cx - dw / 2, FLOOR); ctx.lineTo(cx + dw / 2, FLOOR); ctx.lineTo(cx + 150, H); ctx.lineTo(cx - 520, H); ctx.closePath(); ctx.fill(); ctx.restore();
    haze(ctx, 41, 8, 0.05, [820, 220, 1500, 660]);
    figure(ctx, "walker", 1010, 742, 250, [cx, 380], { skew: 0.55, len: 0.75, rim: 4, shadowA: 0.7 });
    motes(ctx, 44, 50, [900, 200, 1400, 640], 0.5);
    finish(ctx, 404);
  },

  // Friday: perseverance. An athlete kneels in prayer beside a loaded barbell, under one overhead light.
  friday(ctx) {
    room(ctx, { low: "#140e08" });
    const L = [1140, -40];
    rays(ctx, L[0], L[1], [[90, 26, 900, 1.1], [90, 44, 940, 0.5]], 0.26, 30);
    glow(ctx, 1140, 420, 520, WARM(0.3));
    haze(ctx, 51, 9, 0.05, [760, 180, 1500, 640]);
    pool(ctx, 1140, 520, 0.7, FLOOR + 50);
    // The bar lies along the line of sight: the near plate faces the viewer, the far end runs back.
    ctx.save(); ctx.strokeStyle = "#1c150d"; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(1318, 566); ctx.lineTo(1410, 548); ctx.stroke(); ctx.restore();
    barbellEnd(ctx, 1424, 556, 66, [1250, 300]);
    barbellEnd(ctx, 1300, 562, 98, [1200, 240]);
    ctx.save(); ctx.filter = "blur(10px)"; ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.ellipse(1040, FLOOR + 10, 150, 16, 0, 0, 7); ctx.fill(); ctx.restore();
    figure(ctx, "kneel", 1040, FLOOR, 330, [1140, 60], { shadow: false, rim: 4 });
    motes(ctx, 55, 60, [900, 60, 1380, 560], 0.5);
    finish(ctx, 505);
  },

  // Saturday: endurance. A runner on a mountain ridge at first light, a cross on the summit ahead.
  saturday(ctx) {
    ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, "#040303"], [0.3, "#120b06"], [0.5, "#3a2210"], [0.62, "#8a5524"], [0.7, "#c98a3c"], [0.78, "#3a2412"], [1, "#050403"]]);
    ctx.fillRect(0, 0, W, H);
    const sun = [1290, 520];
    glow(ctx, sun[0], sun[1], 700, WARM(0.75));
    glow(ctx, sun[0], sun[1], 150, [[0, "rgba(255,250,230,1)"], [0.4, "rgba(255,226,160,0.7)"], [1, "rgba(255,200,120,0)"]]);
    rays(ctx, sun[0], sun[1], [[200, 10, 900, 0.8], [220, 8, 900, 0.6], [250, 10, 800, 0.6], [290, 8, 700, 0.5], [320, 10, 800, 0.6]], 0.1, 30);
    const ridge = (seed, base, amp, color, peaks) => {
      const r = rng(seed); ctx.beginPath(); ctx.moveTo(0, H); let y = base;
      for (let x = 0; x <= W; x += 20) { let p = 0; for (const [px, ph, pw] of peaks) p += ph * Math.exp(-((x - px) ** 2) / (2 * pw * pw)); y = base - p + (r() - 0.5) * amp; ctx.lineTo(x, y); }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    ridge(61, 600, 10, lin(ctx, 0, 300, 0, 700, [[0, "#6b4320"], [1, "#2a1a0d"]]), [[380, 150, 170], [820, 110, 150], [1230, 250, 130], [1560, 120, 140]]);
    // The summit cross, small and far away, straight ahead of the runner.
    cross(ctx, 1230, 268, 92, sun, { bw: 8, arm: 24, fill: "#120b06", rim: 2, a: 1, reach: 400 });
    haze(ctx, 62, 6, 0.06, [300, 520, 1500, 640]);
    ridge(63, 690, 8, lin(ctx, 0, 500, 0, 800, [[0, "#2c1c0e"], [1, "#120b06"]]), [[200, 90, 200], [700, 60, 180], [1420, 130, 190]]);
    // The near ridge climbs to the right; the runner is on it.
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, 800); ctx.bezierCurveTo(420, 800, 700, 760, 900, 712); ctx.bezierCurveTo(1100, 664, 1300, 650, 1600, 600); ctx.lineTo(W, H); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 600, 0, H, [[0, "#0d0806"], [1, "#040303"]]); ctx.fill();
    ctx.save(); ctx.strokeStyle = "rgba(240,190,104,0.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(700, 762); ctx.bezierCurveTo(800, 738, 850, 724, 900, 712); ctx.bezierCurveTo(1100, 664, 1300, 650, 1600, 600); ctx.stroke(); ctx.restore();
    figure(ctx, "runner", 1010, 690, 230, sun, { shadow: false, rim: 4 });
    finish(ctx, 606);
  },

  // Sunday: rest and worship. A quiet gym in morning light: an arched window, a bench, a closed Bible.
  sunday(ctx) {
    room(ctx, { mid: "#120c07", low: "#20160c", floorFar: "#241a0e" });
    const cx = 1150; const ww = 250; const top = 130; const bot = 520;
    glow(ctx, cx, 330, 680, WARM(0.5));
    // The window: arched, with a cross of glazing bars.
    const win = (c) => { c.moveTo(cx - ww / 2, bot); c.lineTo(cx - ww / 2, top + ww / 2); c.arc(cx, top + ww / 2, ww / 2, Math.PI, 0); c.lineTo(cx + ww / 2, bot); c.closePath(); };
    ctx.save(); ctx.shadowColor = "rgba(255,220,150,0.95)"; ctx.shadowBlur = 60; ctx.beginPath(); win(ctx);
    ctx.fillStyle = lin(ctx, 0, top, 0, bot, [[0, "#fff4d6"], [0.55, "#ffe3a4"], [1, "#f2bb62"]]); ctx.fill(); ctx.restore();
    ctx.save(); ctx.fillStyle = "#1a120a"; ctx.fillRect(cx - 7, top, 14, bot - top); ctx.fillRect(cx - ww / 2, top + 150, ww, 14);
    ctx.strokeStyle = "#1a120a"; ctx.lineWidth = 14; ctx.beginPath(); win(ctx); ctx.stroke(); ctx.restore();
    rays(ctx, cx - 60, top + 120, [[112, 14, 900, 1], [128, 12, 940, 0.9], [144, 10, 900, 0.7], [98, 10, 760, 0.6]], 0.2, 30);
    rays(ctx, cx + 60, top + 120, [[104, 12, 860, 0.8], [120, 10, 900, 0.7], [86, 10, 700, 0.5]], 0.18, 30);
    haze(ctx, 71, 9, 0.055, [640, 200, 1500, 660]);
    pool(ctx, 1010, 600, 0.55);
    // A rack of dumbbells at rest against the wall.
    const L = [cx, 330];
    solid(ctx, rr(1350, 520, 230, 10, 2), L, { rim: 2, a: 0.5 }); solid(ctx, rr(1350, 596, 230, 10, 2), L, { rim: 2, a: 0.5 });
    for (const x of [1360, 1562]) solid(ctx, rr(x, 494, 10, FLOOR - 494, 2), L, { rim: 2, a: 0.5 });
    for (let i = 0; i < 3; i++) { dumbbell(ctx, 1402 + i * 62, 502, 0.5, L); dumbbell(ctx, 1402 + i * 62, 578, 0.56, L); }
    bench(ctx, 880, 420, 560, L);
    // The closed Bible on the bench: cover, page edge, a small gold cross, the ribbon.
    solid(ctx, rr(1010, 520, 170, 40, 5), L, { fill: "#120c07", rim: 3, a: 0.9 });
    ctx.save(); ctx.fillStyle = lin(ctx, 0, 528, 0, 552, [[0, "#f3dfae"], [1, "#b48c4c"]]); ctx.fillRect(1022, 529, 158, 22);
    ctx.strokeStyle = "rgba(90,60,24,0.5)"; ctx.lineWidth = 1; for (let y = 533; y < 550; y += 4) { ctx.beginPath(); ctx.moveTo(1022, y); ctx.lineTo(1180, y); ctx.stroke(); }
    ctx.fillStyle = "#120c07"; ctx.fillRect(1010, 520, 14, 40);
    ctx.strokeStyle = "#7a1f18"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(1150, 558); ctx.quadraticCurveTo(1156, 580, 1168, 596); ctx.stroke(); ctx.restore();
    kettlebell(ctx, 846, FLOOR, 0.8, L);
    motes(ctx, 77, 90, [700, 140, 1300, 620], 0.5);
    finish(ctx, 707);
  },
};

// On a phone the hero shows only about the middle 60 % of the picture's width, and the greeting fills the left two
// thirds of that. Every scene is composed with its subject around x = 1140; the finished picture moves it right by
// SHIFT so the bright subject clears the text (measured in e2e/home-backgrounds.spec.ts). The strip uncovered on the
// left is the scene's own dark edge, mirrored, so the wall and the floor line run on without a seam.
const SHIFT = 95;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- called from render.mjs
function renderScene(day) {
  const scene = mk(); SCENES[day](scene.getContext("2d"));
  const c = mk(); const ctx = c.getContext("2d");
  ctx.drawImage(scene, SHIFT, 0);
  ctx.save(); ctx.translate(SHIFT, 0); ctx.scale(-1, 1); ctx.drawImage(scene, 0, 0, SHIFT, H, 0, 0, SHIFT, H); ctx.restore();
  return c;
}
