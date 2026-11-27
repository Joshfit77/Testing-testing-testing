/**
 * Drill scenery in the "athlete" look (matte graphite with thin gold edges, like props-athlete.ts): agility cones, tape
 * lines on the floor and an agility ladder. Only props that opt in are drawn here (cones and lines with
 * `variant: "agility"`, every ladder); anything else returns false and keeps its classic drawing.
 *
 * The floor is seen nearly edge-on: world y < 0 is the strip of floor in front of the floor line (toward the viewer),
 * so a line or a ladder lying on the floor is drawn as a band just below the floor line, receding toward it.
 */
import type { Frame, ResolvedProp, Vec } from "./types";

type Ctx = CanvasRenderingContext2D;

const GOLD = "226,184,96";

/** A training cone `s` times its normal size (s < 1: farther from the camera), standing on the floor at `at`. */
function cone(ctx: Ctx, at: Vec, s: number) {
  const x = at[0];
  const h = 24 * s;
  const b = 9 * s; // half-width at the base of the cone
  const tip = 1.6 * s;
  const plate = 12 * s; // half-width of the square base plate
  const ph = 1.8 * s;
  // Contact shadow.
  const sh = ctx.createRadialGradient(x, 0, 0, x, 0, plate * 1.4);
  sh.addColorStop(0, "rgba(0,0,0,0.55)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(x - plate * 1.5, -2 * s, plate * 3, 4 * s);
  // Base plate.
  ctx.beginPath();
  ctx.rect(x - plate, 0, 2 * plate, ph);
  const pg = ctx.createLinearGradient(0, ph, 0, 0);
  pg.addColorStop(0, "#3a3c40");
  pg.addColorStop(1, "#0c0d0f");
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.strokeStyle = `rgba(${GOLD},0.55)`;
  ctx.lineWidth = 0.35 * s;
  ctx.beginPath();
  ctx.moveTo(x - plate, ph);
  ctx.lineTo(x + plate, ph);
  ctx.stroke();
  // Body: a slim cone, lit from the upper left.
  const body = new Path2D();
  body.moveTo(x - b, ph);
  body.lineTo(x - tip, h);
  body.quadraticCurveTo(x, h + 0.8 * s, x + tip, h);
  body.lineTo(x + b, ph);
  body.closePath();
  const g = ctx.createLinearGradient(x - b, 0, x + b, 0);
  g.addColorStop(0, "#4b4e54");
  g.addColorStop(0.35, "#25272b");
  g.addColorStop(1, "#08090a");
  ctx.fillStyle = g;
  ctx.fill(body);
  // Reflective gold band round the middle.
  const y0 = ph + (h - ph) * 0.42;
  const y1 = ph + (h - ph) * 0.58;
  const w0 = b + (tip - b) * 0.42;
  const w1 = b + (tip - b) * 0.58;
  ctx.beginPath();
  ctx.moveTo(x - w0, y0);
  ctx.lineTo(x - w1, y1);
  ctx.lineTo(x + w1, y1);
  ctx.lineTo(x + w0, y0);
  ctx.closePath();
  const bg = ctx.createLinearGradient(x - w0, 0, x + w0, 0);
  bg.addColorStop(0, "rgba(247,224,154,0.95)");
  bg.addColorStop(0.45, "rgba(214,170,60,0.85)");
  bg.addColorStop(1, "rgba(110,80,20,0.8)");
  ctx.fillStyle = bg;
  ctx.fill();
  // Gold rim light on the lit edge, a fainter one on the shadow side.
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(${GOLD},0.85)`;
  ctx.lineWidth = 0.45 * s;
  ctx.beginPath();
  ctx.moveTo(x - b, ph);
  ctx.lineTo(x - tip, h);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${GOLD},0.3)`;
  ctx.beginPath();
  ctx.moveTo(x + tip, h);
  ctx.lineTo(x + b, ph);
  ctx.stroke();
}

/**
 * A tape line on the floor. In the front view it runs from the floor line toward the viewer (a narrow band widening
 * slightly as it comes closer); in the side view it crosses the floor (a short band below the floor line).
 */
function floorLine(ctx: Ctx, at: Vec, f: Frame, s: number) {
  const x = at[0];
  const depth = 26 * s;
  const g = ctx.createLinearGradient(0, 0, 0, -depth);
  g.addColorStop(0, `rgba(${GOLD},0.75)`);
  g.addColorStop(0.6, `rgba(${GOLD},0.4)`);
  g.addColorStop(1, `rgba(${GOLD},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  if (f.view === "front") {
    const w0 = 1.1 * s;
    const w1 = 2.4 * s;
    const lean = 0.12 * x * s; // recedes toward the middle of the picture
    ctx.moveTo(x - w0, 0.2);
    ctx.lineTo(x + w0, 0.2);
    ctx.lineTo(x + lean + w1, -depth);
    ctx.lineTo(x + lean - w1, -depth);
  } else {
    ctx.moveTo(x - 1.2, 0.2);
    ctx.lineTo(x + 1.2, 0.2);
    ctx.lineTo(x - 2.4, -depth);
    ctx.lineTo(x - 6.4, -depth);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * An agility ladder lying on the floor, seen from the side (`at` = its middle, `w` = its length): two flat straps
 * with flat rungs every `spacing` cm, drawn as a band just below the floor line (the far strap at the floor line, the
 * near one closer to the viewer). The feet land on the floor line, between the rungs.
 */
function ladder(ctx: Ctx, at: Vec, w: number, spacing: number) {
  const x0 = at[0] - w / 2;
  const x1 = at[0] + w / 2;
  const far = -0.6;
  const near = -15;
  const slant = -3.6; // rungs recede toward the far strap
  // Faint fill between the straps (the floor inside the ladder).
  ctx.fillStyle = "rgba(226,184,96,0.07)";
  ctx.fillRect(x0, near, w, far - near);
  // Rungs: flat graphite straps across the ladder, a gold edge catching the light along the far side of each.
  for (let x = Math.ceil(x0 / spacing) * spacing; x <= x1; x += spacing) {
    const a: Vec = [x - 2.2, far];
    const b: Vec = [x + 2.2, far];
    const c: Vec = [x + 2.2 + slant * 1.4, near];
    const d: Vec = [x - 2.2 + slant * 1.4, near];
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, far, 0, near);
    g.addColorStop(0, "#2a2c30");
    g.addColorStop(1, "#4a4d53");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD},0.7)`;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.stroke();
  }
  // Straps.
  for (const [y, a, lw] of [
    [far, 0.55, 1.1],
    [near, 0.8, 1.6],
  ] as const) {
    ctx.strokeStyle = "#202226";
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${GOLD},${a})`;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(x0, y + lw * 0.4);
    ctx.lineTo(x1, y + lw * 0.4);
    ctx.stroke();
  }
}

/** Draw a drill prop in the athlete look; false when this prop is not one of them. */
export function drawDrillProp(ctx: Ctx, p: ResolvedProp, f: Frame): boolean {
  const { def, at } = p;
  switch (def.kind) {
    case "cone":
      if (def.variant !== "agility") return false;
      cone(ctx, at, def.size ?? 1);
      return true;
    case "hurdleLine":
      if (def.variant !== "agility") return false;
      floorLine(ctx, at, f, def.size ?? 1);
      return true;
    case "ladder":
      ladder(ctx, at, def.w ?? 600, def.h ?? 45);
      return true;
    default:
      return false;
  }
}
