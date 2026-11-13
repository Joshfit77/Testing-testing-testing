/**
 * Pure 2D geometry and signal helpers for the experimental form-analysis core.
 * Image coordinates: x right, y down (see types.ts).
 */
import type { Joint, Keypoint, KeypointName, Point, PoseFrame, Side } from "./types";

const RAD_TO_DEG = 180 / Math.PI;

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Interior angle at vertex `b` formed by a-b-c, in degrees in [0, 180].
 * Returns null when either segment has zero length.
 */
export function jointAngleDeg(a: Point, b: Point, c: Point): number | null {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (n1 === 0 || n2 === 0) return null;
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (n1 * n2)));
  return Math.acos(cos) * RAD_TO_DEG;
}

/** Joint flexion in degrees: 0 = straight, larger = more bent. */
export function flexionDeg(a: Point, b: Point, c: Point): number | null {
  const angle = jointAngleDeg(a, b, c);
  return angle === null ? null : 180 - angle;
}

/** Angle of the segment a→b from vertical, in degrees in [0, 90] (direction-agnostic). */
export function angleFromVerticalDeg(a: Point, b: Point): number | null {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (dx === 0 && dy === 0) return null;
  return Math.atan2(dx, dy) * RAD_TO_DEG;
}

/** Angle of the segment a→b from horizontal, in degrees in [0, 90] (direction-agnostic). */
export function angleFromHorizontalDeg(a: Point, b: Point): number | null {
  const fromVertical = angleFromVerticalDeg(a, b);
  return fromVertical === null ? null : 90 - fromVertical;
}

/**
 * Vertical offset of the hip below the knee, as a fraction of thigh length.
 * Positive = hip lower in the image than the knee (y grows downward); negative = hip higher.
 * Returns null when the thigh has zero length.
 */
export function hipBelowKneeRatio(hip: Point, knee: Point): number | null {
  const thigh = distance(hip, knee);
  if (thigh === 0) return null;
  return (hip.y - knee.y) / thigh;
}

export function keypointName(side: Side, joint: Joint): KeypointName {
  return `${side}${joint[0]!.toUpperCase()}${joint.slice(1)}` as KeypointName;
}

/** The keypoint for one side's joint if present and at or above `minConfidence`. */
export function confidentKeypoint(
  frame: PoseFrame,
  side: Side,
  joint: Joint,
  minConfidence: number,
): Keypoint | null {
  const kp = frame.keypoints[keypointName(side, joint)];
  if (!kp || !Number.isFinite(kp.x) || !Number.isFinite(kp.y)) return null;
  return kp.confidence >= minConfidence ? kp : null;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Centred moving average over a time window. Uses timestamps rather than sample counts so that
 * dropped frames do not stretch the window.
 */
export function smoothByTime(times: readonly number[], values: readonly number[], windowMs: number): number[] {
  const half = windowMs / 2;
  const out: number[] = new Array(values.length);
  let lo = 0;
  let hi = 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const t = times[i]!;
    while (hi < values.length && times[hi]! <= t + half) sum += values[hi++]!;
    while (times[lo]! < t - half) sum -= values[lo++]!;
    out[i] = sum / (hi - lo);
  }
  return out;
}

export function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
