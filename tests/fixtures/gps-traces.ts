/**
 * Controlled GPS traces with known ground truth, for measuring distance error.
 *
 * Each scenario walks a known path at a known speed profile and samples it about once a second, the way phones and
 * browsers deliver fixes. It then adds the error a phone's GPS actually has:
 *   - a slowly wandering, correlated error (first-order Gauss–Markov, τ ≈ 30–60 s: atmosphere, multipath);
 *   - fix-to-fix white noise;
 *   - a reported "accuracy" that is only loosely related to the true error.
 * Optional events: multipath spikes (a fix tens of metres off that still *reports* good accuracy), signal dropouts,
 * out-of-order and duplicate deliveries, standing still (drift), pauses, a poor first fix, and "precise location off"
 * (accuracy in the kilometres).
 *
 * Deterministic: every scenario takes a seed. The noise levels follow typical published smartphone figures (open sky
 * ≈ 3–5 m, urban ≈ 5–15 m, about a metre of fix-to-fix jitter because phones already filter their fixes). They are a
 * test model, not a measurement of any particular phone: real-device traces are still needed (docs/GPS_ACCURACY.md).
 */
import type { GpsFix } from "@/lib/domain/gps-track";

export const LAT0 = 40.0;
export const LNG0 = -75.0;
const M_PER_DEG_LAT = 111_195;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((LAT0 * Math.PI) / 180);
export const T0 = Date.UTC(2026, 9, 22, 7, 0, 0);

/** Seeded PRNG (mulberry32) and a standard normal from it. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    const u = Math.max(1e-12, next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return { next, normal };
}

type P = [number, number]; // east, north in metres

/** A closed or open path through waypoints, with points at any distance along it. */
function path(points: P[]) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1]! + Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]));
  const length = cum.at(-1)!;
  const at = (d0: number): P => {
    const d = ((d0 % length) + length) % length;
    let i = 1;
    while (i < cum.length - 1 && cum[i]! < d) i++;
    const f = (d - cum[i - 1]!) / (cum[i]! - cum[i - 1]! || 1);
    const a = points[i - 1]!;
    const b = points[i]!;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  return { length, at };
}

/** Rounded rectangle (a park loop), `r` corner radius. */
export function loop(w: number, h: number, r: number): P[] {
  const pts: P[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let k = 0; k <= 8; k++) {
      const a = a0 + (k / 8) * (Math.PI / 2);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  corner(w - r, r, -Math.PI / 2);
  corner(w - r, h - r, 0);
  corner(r, h - r, Math.PI / 2);
  corner(r, r, Math.PI);
  pts.push(pts[0]!);
  return pts;
}

/** City blocks: alternating 100 m east and 80 m north legs with square corners. */
export function blocks(n: number): P[] {
  const pts: P[] = [[0, 0]];
  for (let i = 0; i < n; i++) {
    const [x, y] = pts.at(-1)!;
    pts.push(i % 2 ? [x, y + 80] : [x + 100, y]);
  }
  return pts;
}

/** A 400 m running track (two straights, two semicircles). */
function track400(): P[] {
  const straight = 84.39;
  const r = (400 - 2 * straight) / (2 * Math.PI);
  const pts: P[] = [[0, 0], [straight, 0]];
  for (let k = 1; k <= 16; k++) pts.push([straight + r * Math.sin((k / 16) * Math.PI), r - r * Math.cos((k / 16) * Math.PI)]);
  pts.push([0, 2 * r]);
  for (let k = 1; k <= 16; k++) pts.push([-r * Math.sin((k / 16) * Math.PI), r + r * Math.cos((k / 16) * Math.PI)]);
  return pts;
}

export interface Noise {
  /** Correlated (Gauss–Markov) error, metres per axis, and its time constant (s). */
  gm: number;
  tau: number;
  /** White noise, metres per axis. */
  white: number;
  /** Low-pass time constant (s) of the correlated error (default 8). */
  smooth?: number;
}
// Phones deliver already-filtered fixes, so most of the error wanders slowly; fix-to-fix jitter is about a metre.
export const OPEN_SKY: Noise = { gm: 3, tau: 60, white: 0.7 };
export const URBAN: Noise = { gm: 6, tau: 30, white: 1.8 };
export const STILL: Noise = { gm: 5, tau: 45, white: 0.6 };

export interface Scenario {
  name: string;
  kind: "run" | "walk";
  fixes: GpsFix[];
  /** Pause / resume times (ms), applied by the harness. */
  pauses: { at: number; resume: number }[];
  /** True distance travelled while recording (not paused), metres. */
  truth: number;
  /** True distance the GPS could observe: excludes stretches with no fixes at all (tunnels). */
  observable: number;
  finishAt: number;
}

interface Leg {
  /** Seconds this leg lasts. */
  s: number;
  /** Speed, m/s (0 = standing still). */
  v: number;
  /** No fixes delivered during this leg (tunnel). */
  dropout?: boolean;
  /** The member paused the recording for this leg. */
  paused?: boolean;
}

export function simulate(o: {
  name: string;
  kind: "run" | "walk";
  seed: number;
  route: P[];
  legs: Leg[];
  noise: Noise;
  /** Reported accuracy multiplier range relative to the true error scale. */
  accuracy?: [number, number];
  spikes?: number;
  outOfOrder?: number;
  duplicates?: number;
  badStart?: boolean;
  preciseOff?: boolean;
}): Scenario {
  const r = rng(o.seed);
  const p = path(o.route);
  const sigma = Math.hypot(o.noise.gm, o.noise.white);
  const [accLo, accHi] = o.accuracy ?? [1.1, 1.9];
  // Correlated error: a Gauss–Markov process, low-pass filtered (time constant `smooth`) so it drifts smoothly the way
  // a phone's filtered position does, instead of jumping each second.
  let me = 0;
  let mn = 0;
  let ge = 0;
  let gn = 0;
  const smooth = o.noise.smooth ?? 8;
  let d = 0;
  let t = T0 + 2000;
  let truth = 0;
  let observable = 0;
  const fixes: GpsFix[] = [];
  const pauses: Scenario["pauses"] = [];
  const spikeAt = new Set<number>();
  const totalS = o.legs.reduce((a, l) => a + l.s, 0);
  for (let i = 0; i < (o.spikes ?? 0); i++) spikeAt.add(20 + Math.floor(r.next() * (totalS - 40)));
  let sec = 0;
  for (const leg of o.legs) {
    if (leg.paused) pauses.push({ at: t, resume: t + leg.s * 1000 });
    for (let k = 0; k < leg.s; k++) {
      // Fix interval: about a second, with the jitter phones show.
      const dt = 0.85 + r.next() * 0.3;
      d += leg.v * dt;
      if (!leg.paused) {
        truth += leg.v * dt;
        if (!leg.dropout) observable += leg.v * dt;
      }
      t += dt * 1000;
      sec++;
      const phi = Math.exp(-dt / o.noise.tau);
      // Driving noise scaled so the filtered error keeps a standard deviation of about `gm`.
      const q = o.noise.gm * Math.sqrt(1 - phi * phi) * Math.sqrt(1 + smooth / o.noise.tau);
      me = phi * me + q * r.normal();
      mn = phi * mn + q * r.normal();
      const lp = 1 - Math.exp(-dt / smooth);
      ge += lp * (me - ge);
      gn += lp * (mn - gn);
      if (leg.dropout) continue;
      const [x, y] = p.at(d);
      let ex = ge + o.noise.white * r.normal();
      let ey = gn + o.noise.white * r.normal();
      let accuracy = sigma * (accLo + (accHi - accLo) * r.next());
      if (spikeAt.has(sec)) {
        // Multipath: tens of metres off, yet the phone still reports a fair accuracy.
        const a = r.next() * 2 * Math.PI;
        const m = 40 + r.next() * 80;
        ex += m * Math.cos(a);
        ey += m * Math.sin(a);
        accuracy = 8 + r.next() * 12;
      }
      if (o.badStart && sec <= 12) {
        // Cold start: accuracy improves from poor to fair; the early fixes are biased.
        accuracy = Math.max(sigma * 1.5, 60 - sec * 4.5);
        ex += accuracy * 0.6;
      }
      if (o.preciseOff) accuracy = 1500 + r.next() * 1500;
      fixes.push({ lat: LAT0 + (y + ey) / M_PER_DEG_LAT, lng: LNG0 + (x + ex) / M_PER_DEG_LNG, accuracy, t: Math.round(t) });
    }
  }
  // Delivery problems: swap neighbours (out of order) and repeat some fixes (duplicates).
  for (let i = 2; i < fixes.length; i++) {
    if (r.next() < (o.outOfOrder ?? 0)) [fixes[i - 1], fixes[i]] = [fixes[i]!, fixes[i - 1]!];
  }
  if (o.duplicates) {
    for (let i = fixes.length - 1; i > 0; i--) if (r.next() < o.duplicates) fixes.splice(i, 0, { ...fixes[i]! });
  }
  return { name: o.name, kind: o.kind, fixes, pauses, truth, observable, finishAt: Math.round(t) + 1000 };
}

/** The controlled scenarios used by tests/unit/gps-accuracy.test.ts and docs/GPS_ACCURACY.md. */
export function scenarios(seed: number): Scenario[] {
  const park = loop(800, 450, 60);
  return [
    simulate({ name: "Run: 5 km park loop, open sky", kind: "run", seed, route: park, legs: [{ s: 1500, v: 3.33 }], noise: OPEN_SKY }),
    simulate({
      name: "Walk: city blocks, two stops at crossings",
      kind: "walk",
      seed,
      route: blocks(40),
      legs: [{ s: 600, v: 1.35 }, { s: 45, v: 0 }, { s: 600, v: 1.35 }, { s: 45, v: 0 }, { s: 300, v: 1.35 }],
      noise: URBAN,
    }),
    simulate({
      name: "Intervals on a 400 m track: 6 × (400 m fast, 200 m jog)",
      kind: "run",
      seed,
      route: track400(),
      legs: Array.from({ length: 6 }, () => [{ s: 80, v: 5 }, { s: 80, v: 2.5 }]).flat(),
      noise: OPEN_SKY,
    }),
    simulate({
      name: "Run with a 3-minute pause",
      kind: "run",
      seed,
      route: park,
      legs: [{ s: 300, v: 3.3 }, { s: 180, v: 0, paused: true }, { s: 300, v: 3.3 }],
      noise: OPEN_SKY,
    }),
    simulate({
      name: "Run through two 30-second tunnels (no fixes)",
      kind: "run",
      seed,
      route: park,
      legs: [{ s: 300, v: 3.3 }, { s: 30, v: 3.3, dropout: true }, { s: 300, v: 3.3 }, { s: 30, v: 3.3, dropout: true }, { s: 240, v: 3.3 }],
      noise: OPEN_SKY,
    }),
    simulate({ name: "Run with multipath spikes (40–120 m off, fair reported accuracy)", kind: "run", seed, route: blocks(60), legs: [{ s: 900, v: 3.2 }], noise: URBAN, spikes: 10 }),
    simulate({ name: "Slow walk (0.9 m/s), open sky", kind: "walk", seed, route: park, legs: [{ s: 900, v: 0.9 }], noise: OPEN_SKY }),
    simulate({ name: "Walk in a city at 1.2 m/s, no stops", kind: "walk", seed, route: blocks(30), legs: [{ s: 900, v: 1.2 }], noise: URBAN }),
    simulate({ name: "Standing still for 10 minutes (drift)", kind: "walk", seed, route: park, legs: [{ s: 600, v: 0 }], noise: STILL }),
    simulate({ name: "Run with out-of-order and duplicate deliveries", kind: "run", seed, route: park, legs: [{ s: 600, v: 3.3 }], noise: OPEN_SKY, outOfOrder: 0.05, duplicates: 0.03 }),
    simulate({ name: "Walk starting with a poor, biased first fix", kind: "walk", seed, route: blocks(20), legs: [{ s: 900, v: 1.4 }], noise: URBAN, badStart: true }),
    simulate({ name: "Browser with precise location off", kind: "walk", seed, route: park, legs: [{ s: 300, v: 1.4 }], noise: OPEN_SKY, preciseOff: true }),
  ];
}
