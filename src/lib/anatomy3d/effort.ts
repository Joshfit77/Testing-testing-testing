import { compileMotion, evaluate } from "../exercise-motion";
import type { Frame, MotionDef, Vec } from "../exercise-motion/types";

/**
 * How hard the working muscles are working through one loop of a motion, 0..1, for the glow. It's an instructional
 * picture, not measured activation: the glow builds as the load is taken deeper, peaks as the athlete drives out of
 * the hardest position, eases off while lowering and resting at the top, and repeats every rep.
 *
 * The load point is the implement when there is one (barbell, dumbbell, kettlebell...) and otherwise the hips.
 */
export interface EffortCurve {
  duration: number;
  samples: Float32Array;
  /** Effort at time t (seconds, wraps). */
  at(t: number): number;
  /** Phases (0..1) of the top, the middle of the lowering, the bottom and the middle of the drive. */
  phases: { top: number; lowering: number; bottom: number; lifting: number };
}

const LOADS = new Set(["barbell", "dumbbell", "kettlebell", "trapBar", "sandbag", "medball", "stone", "log", "keg", "landmine"]);

function loadPoint(f: Frame): Vec {
  const prop = f.props.find((p) => LOADS.has(p.def.kind));
  if (prop) return prop.def.kind === "landmine" && prop.to ? prop.to : prop.at;
  return f.pts.pelvis;
}

export function effortCurve(def: MotionDef, n = 240): EffortCurve {
  const c = compileMotion(def);
  const T = c.duration;
  const h = new Float32Array(n);
  for (let i = 0; i < n; i++) h[i] = loadPoint(evaluate(c, (i / n) * T))[1];
  let hMin = Infinity, hMax = -Infinity;
  for (const y of h) {
    hMin = Math.min(hMin, y);
    hMax = Math.max(hMax, y);
  }
  const range = Math.max(1e-3, hMax - hMin);
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = (h[(i + 1) % n]! - h[(i - 1 + n) % n]!) / (2 * (T / n));
  let vUp = 1e-3;
  for (const x of v) vUp = Math.max(vUp, x);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const depth = (hMax - h[i]!) / range; // 0 at the top, 1 in the hardest (lowest) position
    const lifting = Math.max(0, v[i]!) / vUp;
    raw[i] = range < 2 ? 0.75 : Math.min(1, 0.18 + 0.42 * depth + 0.55 * lifting * (0.4 + 0.6 * depth) + 0.25 * depth * depth);
  }
  // Smooth over about a tenth of a second so the glow never flickers.
  const k = Math.max(1, Math.round((0.1 / T) * n));
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = -k; j <= k; j++) s += raw[(i + j + n) % n]!;
    samples[i] = s / (2 * k + 1);
  }
  let top = 0, bottom = 0;
  for (let i = 0; i < n; i++) {
    if (h[i]! > h[top]!) top = i;
    if (h[i]! < h[bottom]!) bottom = i;
  }
  const mid = (a: number, b: number) => {
    const span = (b - a + n) % n;
    return ((a + span / 2) % n) / n;
  };
  return {
    duration: T,
    samples,
    at(t: number) {
      const x = (((t / T) % 1) + 1) % 1 * n;
      const i = Math.floor(x);
      const f = x - i;
      return samples[i % n]! * (1 - f) + samples[(i + 1) % n]! * f;
    },
    phases: { top: top / n, lowering: mid(top, bottom), bottom: bottom / n, lifting: mid(bottom, top) },
  };
}
