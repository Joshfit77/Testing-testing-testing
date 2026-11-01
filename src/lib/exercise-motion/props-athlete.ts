/**
 * Equipment in the "athlete" look: matte black iron and steel with thin gold edges, matching the athlete, seen with
 * the same camera as the athlete (CAMERA_YAW in skeleton.ts). Kinds not redrawn here keep their classic drawing
 * (props.ts). A side-view barbell (barAcross) shows a short length of bar with the plates at both ends beside the
 * lifter and the hands on the bar, instead of one plate face hiding the head and hands.
 */
import { add, landmarkDepth, len, sub, yawShift } from "./skeleton";
import type { Frame, PropDef, ResolvedProp, Vec } from "./types";

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
const LEATHER_HI = "#3a3a3d";
const LEATHER = "#161618";

function steel(ctx: Ctx, a: Vec, b: Vec) {
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  g.addColorStop(0, STEEL_HI);
  g.addColorStop(0.45, STEEL);
  g.addColorStop(1, STEEL_LO);
  return g;
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

/** A steel tube from a to b, shaded across its width. */
function tube(ctx: Ctx, a: Vec, b: Vec, w: number, hi = FRAME_HI, midC = FRAME, lo = FRAME_LO) {
  const d = sub(b, a);
  const L = len(d) || 0.001;
  const n: Vec = [-d[1] / L, d[0] / L];
  const g = ctx.createLinearGradient(a[0] + n[0] * w * 0.5, a[1] + n[1] * w * 0.5, a[0] - n[0] * w * 0.5, a[1] - n[1] * w * 0.5);
  g.addColorStop(0, hi);
  g.addColorStop(0.4, midC);
  g.addColorStop(1, lo);
  ctx.strokeStyle = g;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

/** A padded surface from a to b (`thick` cm), leather sheen and a gold piping line along the top. */
function cushion(ctx: Ctx, a: Vec, b: Vec, thick = 8) {
  const d = sub(b, a);
  const L = len(d);
  ctx.save();
  ctx.translate(a[0], a[1]);
  ctx.rotate(Math.atan2(d[1], d[0]));
  rrect(ctx, 0, -thick, L, thick, Math.min(3.5, thick / 2));
  const g = ctx.createLinearGradient(0, 0, 0, -thick);
  g.addColorStop(0, LEATHER_HI);
  g.addColorStop(0.35, LEATHER);
  g.addColorStop(1, "#050505");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 0.4;
  ctx.stroke();
  ctx.strokeStyle = `rgba(${GOLD},0.5)`;
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(2, -1.2);
  ctx.lineTo(L - 2, -1.2);
  ctx.stroke();
  ctx.restore();
}

/** A round iron plate face-on: raised rim, recessed face, inner ring, steel hub. */
export function plateFace(ctx: Ctx, c: Vec, r: number, hub = 2.6) {
  // hub 0: the face away from the viewer (no sleeve end showing).
  const g = ctx.createRadialGradient(c[0] + r * 0.25, c[1] + r * 0.35, r * 0.1, c[0], c[1], r);
  g.addColorStop(0, IRON_HI);
  g.addColorStop(0.65, IRON);
  g.addColorStop(1, IRON_LO);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
  ctx.fill();
  // Raised rim: a lighter band with a gold edge.
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  ctx.arc(c[0], c[1], r * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${GOLD},0.8)`;
  ctx.lineWidth = Math.max(0.45, r * 0.03);
  ctx.beginPath();
  ctx.arc(c[0], c[1], r - 0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${GOLD},0.28)`;
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.arc(c[0], c[1], r * 0.58, 0, Math.PI * 2);
  ctx.stroke();
  // Hub: the sleeve's end with a collar.
  if (hub <= 0) return;
  ctx.fillStyle = steel(ctx, [c[0] + hub, c[1] + hub], [c[0] - hub, c[1] - hub]);
  ctx.beginPath();
  ctx.arc(c[0], c[1], hub, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = STEEL_LO;
  ctx.lineWidth = 0.3;
  ctx.stroke();
}

const COLLAR = 66; // bar centre to the inner collar (cm)
const PLATE_T = 5; // plate thickness (cm)
/** Perspective: the near plates are closer to the camera than the lifter, the far ones farther (camera about 4 m away). */
const NEAR_SCALE = 1.08;
const FAR_SCALE = 0.86;

/**
 * One half of a barbell, seen with the athlete look's camera (CAMERA_YAW): the bar from its middle (on the traps, in
 * the hands, on the chest) out to the collar, two plates and the sleeve's end. The hands, shifted by the same camera
 * (a shoulder-width grip), land on it. `side` +1 is the half toward the viewer (drawn before the near arm, so the hand
 * closes over the bar), -1 the far half (drawn behind the athlete). Parts are painted far to near.
 */
function barAcross(ctx: Ctx, at: Vec, r0: number, side: 1 | -1) {
  const sc = side > 0 ? NEAR_SCALE : FAR_SCALE;
  const P = (z: number): Vec => [at[0] + yawShift(z * side) * sc, at[1]];
  const r = r0 * sc;
  const shadow = side > 0 ? 0 : 0.5;
  const line = (a: Vec, b: Vec, w: number, cap: CanvasLineCap) => {
    ctx.strokeStyle = steel(ctx, [a[0], a[1] + w / 2], [a[0], a[1] - w / 2]);
    ctx.lineWidth = w;
    ctx.lineCap = cap;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    if (shadow) {
      ctx.strokeStyle = `rgba(0,0,0,${shadow})`;
      ctx.stroke();
    }
  };
  // A plate between depths z0 and z1 (outward from the centre): its rim band, then the face toward the viewer.
  const plate = (z0: number, z1: number) => {
    const a = P(z0);
    const b = P(z1);
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
    // The face the viewer sees: the outer one on the near half, the inner one on the far half.
    const face = side > 0 ? b : a;
    plateFace(ctx, face, r, side > 0 ? 2.6 * sc : 0);
    if (shadow) {
      ctx.fillStyle = `rgba(0,0,0,${shadow})`;
      ctx.beginPath();
      ctx.arc(face[0], face[1], r + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const shaft = () => line(at, P(COLLAR), 2.6 * sc, "round");
  const sleeve = () => line(P(COLLAR + 2 * PLATE_T), P(COLLAR + 2 * PLATE_T + 9), 4.2 * sc, "butt");
  if (side > 0) {
    shaft();
    plate(COLLAR, COLLAR + PLATE_T);
    plate(COLLAR + PLATE_T, COLLAR + 2 * PLATE_T);
    sleeve();
  } else {
    sleeve();
    plate(COLLAR + PLATE_T, COLLAR + 2 * PLATE_T);
    plate(COLLAR, COLLAR + PLATE_T);
    shaft();
  }
}

/**
 * A barbell seen from the front (sumo deadlift): the bar runs across the picture with the plates edge-on outside the
 * hands. Thick iron plates with a gold rim and a lit edge, collars, and the steel bar shaded across its thickness.
 */
function barFront(ctx: Ctx, c: Vec, r: number) {
  const [x, y] = c;
  // Shaft, knurled in the middle third, and the sleeves.
  ctx.lineCap = "butt";
  ctx.strokeStyle = steel(ctx, [x, y + 1.4], [x, y - 1.4]);
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(x - 64, y);
  ctx.lineTo(x + 64, y);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 0.35;
  for (let k = -20; k <= 20; k += 2.2) {
    ctx.beginPath();
    ctx.moveTo(x + k, y - 1.2);
    ctx.lineTo(x + k + 1, y + 1.2);
    ctx.stroke();
  }
  for (const k of [-1, 1]) {
    ctx.strokeStyle = steel(ctx, [x, y + 2.1], [x, y - 2.1]);
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(x + k * 62, y);
    ctx.lineTo(x + k * 112, y);
    ctx.stroke();
    // Collar.
    rrect(ctx, x + k * 63 - 1.6, y - 3.4, 3.2, 6.8, 0.8);
    ctx.fillStyle = STEEL;
    ctx.fill();
    // Two plates a side, the inner one first.
    for (let i = 0; i < 2; i++) {
      const px = x + k * (67.5 + i * 5.6);
      rrect(ctx, px - 2.6, y - r, 5.2, 2 * r, 1.6);
      const g = ctx.createLinearGradient(px - 2.6, y, px + 2.6, y);
      g.addColorStop(0, IRON_HI);
      g.addColorStop(0.45, IRON);
      g.addColorStop(1, IRON_LO);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = `rgba(${GOLD},0.75)`;
      ctx.lineWidth = 0.45;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(px - 1.6, y - r + 2);
      ctx.lineTo(px - 1.6, y + r - 2);
      ctx.stroke();
    }
  }
}

/** Screen shift of a prop with the athlete look's camera: it follows the depth of the landmark it is anchored to. */
export function propShift(def: PropDef): number {
  const lm = def.follow ?? (typeof def.at === "object" && !Array.isArray(def.at) ? def.at.lm : undefined);
  return lm ? yawShift(landmarkDepth(lm)) : 0;
}

/** Round-plate dumbbell. End-on: a plate face (supinated / pronated grip seen from the side). Profile: handle and plates. */
function dumbbell(ctx: Ctx, c: Vec, orient: string | undefined, axisDeg: number, size = 1) {
  if (orient === "end" || !orient) {
    plateFace(ctx, c, 9.6 * size, 2.0 * size);
    return;
  }
  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.rotate((axisDeg * Math.PI) / 180);
  const hw = 6.5 * size;
  ctx.fillStyle = steel(ctx, [0, 1.6], [0, -1.6]);
  ctx.fillRect(-hw - 1, -1.5, (hw + 1) * 2, 3);
  for (const sgn of [-1, 1]) {
    const x = sgn > 0 ? hw : -hw - 5.2 * size;
    rrect(ctx, x, -9.6 * size, 5.2 * size, 19.2 * size, 2.4 * size);
    const g = ctx.createLinearGradient(x, 0, x + 5.2 * size, 0);
    g.addColorStop(0, IRON_HI);
    g.addColorStop(0.5, IRON);
    g.addColorStop(1, IRON_LO);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD},0.7)`;
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }
  ctx.restore();
}

function rack(ctx: Ctx, at: Vec, pinsH?: number) {
  const x = at[0];
  const H = 220;
  // Base, two uprights (near and far, offset for depth), J-hook, safety arm.
  tube(ctx, [x - 34, 2], [x + 34, 2], 4);
  for (const [dx, w, dark] of [[-6, 6.5, true], [0, 7.5, false]] as const) {
    ctx.fillStyle = dark ? FRAME_LO : FRAME;
    const g = ctx.createLinearGradient(x + dx - w / 2, 0, x + dx + w / 2, 0);
    g.addColorStop(0, dark ? "#202226" : FRAME_HI);
    g.addColorStop(0.45, dark ? "#141518" : FRAME);
    g.addColorStop(1, FRAME_LO);
    ctx.fillStyle = g;
    ctx.fillRect(x + dx - w / 2, 0, w, H);
    if (!dark) for (let y = 30; y < H - 8; y += 5.5) {
      ctx.fillStyle = "#050506";
      ctx.beginPath();
      ctx.arc(x + dx, y, 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = `rgba(${GOLD},0.35)`;
  ctx.lineWidth = 0.3;
  ctx.strokeRect(x - 3.75, 0, 7.5, H);
  ctx.strokeStyle = "#2c2e33";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 3.75, at[1]);
  ctx.lineTo(x + 10, at[1]);
  ctx.lineTo(x + 10.5, at[1] + 4.5);
  ctx.stroke();
  if (pinsH) tube(ctx, [x - 42, pinsH], [x + 42, pinsH], 3);
}

function cableTower(ctx: Ctx, at: Vec, h: number) {
  const x = at[0];
  // Frame: two posts, top beam; weight stack on guide rods; pulley wheels top and bottom.
  tube(ctx, [x - 14, 0], [x - 14, h], 4.5);
  tube(ctx, [x + 14, 0], [x + 14, h], 4.5);
  tube(ctx, [x - 16, h], [x + 16, h], 4.5);
  tube(ctx, [x - 22, 1.5], [x + 22, 1.5], 3.5);
  tube(ctx, [x - 5, 6], [x - 5, h - 8], 0.9, STEEL_HI, STEEL, STEEL_LO);
  tube(ctx, [x + 5, 6], [x + 5, h - 8], 0.9, STEEL_HI, STEEL, STEEL_LO);
  for (let i = 0; i < 12; i++) {
    const y = 6 + i * 4.6;
    rrect(ctx, x - 9.5, y, 19, 4.1, 0.8);
    const g = ctx.createLinearGradient(x - 9.5, y + 4, x + 9.5, y);
    g.addColorStop(0, IRON_HI);
    g.addColorStop(0.6, IRON);
    g.addColorStop(1, IRON_LO);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD},${i === 11 ? 0.7 : 0.25})`;
    ctx.lineWidth = 0.3;
    ctx.stroke();
  }
  tube(ctx, [x, 61], [x, h - 6], 0.6, STEEL_HI, STEEL, STEEL_LO);
}

function pulley(ctx: Ctx, c: Vec, r = 4.2) {
  const g = ctx.createRadialGradient(c[0] + r * 0.3, c[1] + r * 0.3, 0.3, c[0], c[1], r);
  g.addColorStop(0, "#4a4d52");
  g.addColorStop(1, "#111214");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(${GOLD},0.6)`;
  ctx.lineWidth = 0.35;
  ctx.stroke();
  ctx.fillStyle = steel(ctx, [c[0] + 1, c[1] + 1], [c[0] - 1, c[1] - 1]);
  ctx.beginPath();
  ctx.arc(c[0], c[1], r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** Steel cable from a pulley to a handle held in the hands (a D-handle). */
function cableTo(ctx: Ctx, from: Vec, to: Vec, handle: "d" | "v" | "rope" | "none" = "d") {
  ctx.strokeStyle = "#c3c8ce";
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
  ctx.stroke();
  pulley(ctx, from);
  if (handle === "none") return;
  // The handle hangs from the cable's end through the fist.
  const d = sub(to, from);
  const L = len(d) || 0.001;
  const u: Vec = [d[0] / L, d[1] / L];
  const n: Vec = [-u[1], u[0]];
  const c0 = add(to, u, -3.6);
  ctx.strokeStyle = "#2a2c30";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  if (handle === "v") {
    // V-handle seen from the side: two short arms down to the grip.
    ctx.moveTo(c0[0], c0[1]);
    ctx.lineTo(...(add(to, n, 3.2) as [number, number]));
    ctx.moveTo(c0[0], c0[1]);
    ctx.lineTo(...(add(to, n, -3.2) as [number, number]));
  } else {
    const a = add(c0, n, 3.4);
    const b = add(c0, n, -3.4);
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(...(add(to, u, 2.4) as [number, number]), b[0], b[1]);
    ctx.closePath();
  }
  ctx.stroke();
  ctx.strokeStyle = `rgba(${GOLD},0.5)`;
  ctx.lineWidth = 0.3;
  ctx.stroke();
}

function bench(ctx: Ctx, at: Vec, w: number) {
  const h = at[1];
  cushion(ctx, [at[0] - w / 2, h], [at[0] + w / 2, h], 8);
  tube(ctx, [at[0] - w / 2 + 10, h - 8], [at[0] - w / 2 + 6, 1.5], 3.6);
  tube(ctx, [at[0] + w / 2 - 10, h - 8], [at[0] + w / 2 - 6, 1.5], 3.6);
  tube(ctx, [at[0] - w / 2 + 1, 1.5], [at[0] - w / 2 + 14, 1.5], 3);
  tube(ctx, [at[0] + w / 2 - 14, 1.5], [at[0] + w / 2 - 1, 1.5], 3);
  tube(ctx, [at[0] - w / 2 + 8, h - 12], [at[0] + w / 2 - 8, h - 12], 2.6);
}

/**
 * Seated cable row: seat on a floor rail, a footplate against the soles (heel to toes), the low pulley in front of it
 * and the weight stack's tower behind. `seatAt` = the seat top under the buttocks.
 */
function rowStation(ctx: Ctx, seatAt: Vec, f: Frame, hands: Vec | undefined) {
  const s = seatAt;
  const heel = f.pts.heelR;
  const ball = f.pts.ballR;
  const v = sub(ball, heel);
  const L = len(v) || 1;
  const u: Vec = [v[0] / L, v[1] / L];
  const out: Vec = [u[1], -u[0]]; // out of the sole
  const p0 = add(add(heel, u, -4), out, 1.8);
  const p1 = add(add(ball, u, 8), out, 1.8);
  const plateX = Math.max(p0[0], p1[0]) + 2;
  tube(ctx, [s[0] - 34, 2], [plateX + 44, 2], 4);
  cushion(ctx, [s[0] - 26, s[1]], [s[0] + 20, s[1]], 8);
  tube(ctx, [s[0] - 3, s[1] - 8], [s[0] - 3, 3], 4.4);
  // Footplate braced down to the rail.
  tube(ctx, add(p0, out, 2), [p0[0] + 4, 3], 3);
  tube(ctx, add(p1, out, 2), [plateX + 10, 3], 3);
  ctx.save();
  ctx.translate(p0[0], p0[1]);
  ctx.rotate(Math.atan2(p1[1] - p0[1], p1[0] - p0[0]));
  rrect(ctx, 0, 0, len(sub(p1, p0)), 3.4, 1.2);
  const g = ctx.createLinearGradient(0, 0, 0, 3.4);
  g.addColorStop(0, "#3c3e42");
  g.addColorStop(1, "#0d0e10");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = `rgba(${GOLD},0.55)`;
  ctx.lineWidth = 0.35;
  ctx.stroke();
  ctx.restore();
  // Tower and stack behind the footplate; the low pulley just in front of the plate, between the feet.
  cableTower(ctx, [plateX + 40, 0], 190);
  const pul: Vec = [plateX + 6, Math.max(14, Math.min(p0[1], p1[1]) + 6)];
  tube(ctx, [pul[0] + 2, 3], pul, 3);
  if (hands) cableTo(ctx, pul, hands, "v");
}

/**
 * Where a prop is drawn in the athlete look. A side-view barbell draws its near half under the near arm (the hand
 * closes over it) and its far half behind the athlete.
 */
export function athleteLayer(p: ResolvedProp, f: Frame): string {
  const l = p.layer ?? p.def.layer ?? "near";
  if (p.def.kind === "barbell" && f.view === "side" && !p.def.variant) return "near";
  return l;
}

/**
 * Draw a prop in the athlete look. Returns false for kinds it does not redraw (the caller draws the classic one).
 * `pass` "extra" draws the second part of a side-view barbell: its far half.
 */
export function drawPropAthlete(ctx: Ctx, p: ResolvedProp, f: Frame, pass: "main" | "extra" = "main"): boolean {
  const { def, at } = p;
  const size = def.size;
  switch (def.kind) {
    case "barbell": {
      if (def.variant === "front") {
        if (pass === "main") barFront(ctx, at, size ?? 22.5);
        return true;
      }
      if (f.view !== "side" || def.variant) return false;
      barAcross(ctx, at, size ?? 22.5, pass === "main" ? 1 : -1);
      return true;
    }
    case "plate":
      plateFace(ctx, at, size ?? 22.5);
      return true;
    case "dumbbell": {
      const hand = def.follow ?? "handR";
      const fa = hand === "handL" ? f.seg.foreL : f.seg.foreR;
      dumbbell(ctx, at, def.orient, def.angle ?? fa, size ?? 1);
      return true;
    }
    case "rack":
      rack(ctx, at, def.h);
      return true;
    case "bench":
      bench(ctx, at, def.w ?? 110);
      return true;
    case "cableTower":
      cableTower(ctx, at, def.h ?? 210);
      return true;
    case "cable":
      if (p.to) cableTo(ctx, at, p.to, def.variant === "rope" ? "rope" : "d");
      return true;
    case "cableRowSeat":
      rowStation(ctx, at, f, p.to);
      return true;
    default:
      return false;
  }
}

/** The layer of a prop's second part, if it has one: a side-view barbell's far half, behind the athlete. */
export function extraLayer(p: ResolvedProp, f: Frame): string | null {
  return p.def.kind === "barbell" && f.view === "side" && !p.def.variant ? "far" : null;
}
