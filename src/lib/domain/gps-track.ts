/**
 * Live GPS run/walk tracking (pure, unit-tested; the screen and location sources live in src/components/run).
 *
 * Rules (docs/RUN_TRACKING_PLAN.md):
 *   - Distance only ever comes from accepted fixes, between consecutive points of the same unbroken line. Nothing
 *     is counted before the first good fix, across a pause, or across a stretch with no usable signal.
 *   - Fixes are rejected when they're inaccurate (> 25 m), out of order, an impossible jump for a run or a walk,
 *     or jitter smaller than the fix's own uncertainty while standing still.
 *   - After 15 s without an accepted fix the signal counts as lost: the clock keeps running (you're still out there)
 *     but the route breaks, and a new line starts when good fixes return.
 *   - Moving time excludes pauses; elapsed time is start to finish.
 *   - Splits are interpolated where the distance crosses each mile or kilometre.
 */
import { metersPer, type ActivityKind, type DistanceUnit } from "./activities";

export interface GpsFix {
  lat: number;
  lng: number;
  /** Horizontal accuracy in metres (68% radius). */
  accuracy: number;
  /** Milliseconds since the epoch. */
  t: number;
}

export interface TrackPoint {
  lat: number;
  lng: number;
  t: number;
  /** Cumulative distance at this point (m). */
  d: number;
}

export interface TrackSplit {
  index: number;
  unit: DistanceUnit;
  distance_m: number;
  /** Moving seconds at the split (cumulative). */
  moving_s: number;
  /** Seconds since the start at the split (cumulative). */
  elapsed_s: number;
  /** This split's own moving time. */
  split_s: number;
}

export type RejectReason = "inaccurate" | "out_of_order" | "jump" | "jitter" | "waiting_for_fix" | "paused";

export interface TrackState {
  version: 1;
  id: string;
  kind: ActivityKind;
  unit: DistanceUnit;
  status: "acquiring" | "recording" | "paused" | "finished";
  startedAt: number;
  finishedAt: number | null;
  /** Moving periods: each start/resume opens one, each pause or finish closes it. */
  periods: { start: number; end: number | null }[];
  /** Unbroken route lines (broken by pauses and signal loss). */
  lines: TrackPoint[][];
  distanceM: number;
  lastFixAt: number | null;
  /** True while the line is broken by a signal gap (the next good fix starts a new line). */
  signalLost: boolean;
  /** How many stretches of lost signal there were. */
  gaps: number;
  rejected: Record<RejectReason, number>;
  splits: TrackSplit[];
  lastAccuracy: number | null;
}

export const MAX_ACCURACY_M = 25;
export const FIRST_FIX_ACCURACY_M = 20;
export const SIGNAL_LOST_MS = 15_000;
/** Implied speed above which a fix is a jump, not movement (10 m/s ≈ 2:41/km for runs; 4 m/s for walks). */
export const MAX_SPEED_MS: Record<ActivityKind, number> = { run: 10, walk: 4 };

const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function startTrack(opts: { id: string; kind: ActivityKind; unit: DistanceUnit; now: number }): TrackState {
  return {
    version: 1,
    id: opts.id,
    kind: opts.kind,
    unit: opts.unit,
    status: "acquiring",
    startedAt: opts.now,
    finishedAt: null,
    periods: [{ start: opts.now, end: null }],
    lines: [],
    distanceM: 0,
    lastFixAt: null,
    signalLost: false,
    gaps: 0,
    rejected: { inaccurate: 0, out_of_order: 0, jump: 0, jitter: 0, waiting_for_fix: 0, paused: 0 },
    splits: [],
    lastAccuracy: null,
  };
}

/** Moving seconds up to `t` (pauses excluded). */
export function movingSecondsAt(s: Pick<TrackState, "periods">, t: number): number {
  let ms = 0;
  for (const p of s.periods) {
    const end = Math.min(p.end ?? t, t);
    if (end > p.start) ms += end - p.start;
  }
  return Math.max(0, Math.round(ms / 1000));
}

const lastPoint = (s: TrackState): TrackPoint | null => s.lines.at(-1)?.at(-1) ?? null;

function reject(s: TrackState, reason: RejectReason): { state: TrackState; accepted: false; reason: RejectReason } {
  return { state: { ...s, rejected: { ...s.rejected, [reason]: s.rejected[reason] + 1 } }, accepted: false, reason };
}

/** Add one location fix. Returns the new state and whether the fix was used. */
export function addFix(s: TrackState, fix: GpsFix): { state: TrackState; accepted: boolean; reason?: RejectReason } {
  if (s.status === "finished") return { state: s, accepted: false };
  if (s.status === "paused") return reject(s, "paused");
  const withAcc = { ...s, lastAccuracy: Math.round(fix.accuracy) };
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng) || !(fix.accuracy >= 0) || fix.accuracy > MAX_ACCURACY_M) return reject(withAcc, "inaccurate");
  if (s.status === "acquiring" && fix.accuracy > FIRST_FIX_ACCURACY_M) return reject(withAcc, "waiting_for_fix");
  const prev = lastPoint(s);
  if (s.lastFixAt != null && fix.t <= s.lastFixAt) return reject(withAcc, "out_of_order");

  // First good fix, or the first after a pause or a signal gap: start a new line, count nothing yet.
  const lineBroken = s.status === "acquiring" || s.signalLost || !prev || s.lines.length === 0;
  if (lineBroken) {
    const point = { lat: fix.lat, lng: fix.lng, t: fix.t, d: s.distanceM };
    return { state: { ...withAcc, status: "recording", signalLost: false, lastFixAt: fix.t, lines: [...s.lines, [point]] }, accepted: true };
  }

  const step = haversine(prev, fix);
  const dt = (fix.t - prev.t) / 1000;
  if (dt > 0 && step / dt > MAX_SPEED_MS[s.kind]) return reject(withAcc, "jump");
  if (step < Math.max(3, fix.accuracy / 2)) {
    // Standing still or GPS wobble: the fix is fine (keeps the signal alive) but adds no distance.
    return { state: { ...withAcc, lastFixAt: fix.t, rejected: { ...s.rejected, jitter: s.rejected.jitter + 1 } }, accepted: false, reason: "jitter" };
  }
  const distanceM = s.distanceM + step;
  const point = { lat: fix.lat, lng: fix.lng, t: fix.t, d: distanceM };
  const lines = [...s.lines.slice(0, -1), [...s.lines.at(-1)!, point]];
  const next: TrackState = { ...withAcc, lastFixAt: fix.t, distanceM, lines };
  return { state: { ...next, splits: [...s.splits, ...newSplits(s, prev, point)] }, accepted: true };
}

/** Splits crossed between two consecutive points, with the crossing time interpolated. */
function newSplits(s: TrackState, a: TrackPoint, b: TrackPoint): TrackSplit[] {
  const size = metersPer(s.unit);
  const out: TrackSplit[] = [];
  let index = s.splits.length + 1;
  while (index * size <= b.d + 1e-6) {
    const target = index * size;
    if (target < a.d) {
      index++;
      continue;
    }
    const f = b.d === a.d ? 0 : (target - a.d) / (b.d - a.d);
    const t = a.t + f * (b.t - a.t);
    const moving = movingSecondsAt(s, t);
    const prevMoving = out.at(-1)?.moving_s ?? s.splits.at(-1)?.moving_s ?? 0;
    out.push({ index, unit: s.unit, distance_m: Math.round(target), moving_s: moving, elapsed_s: Math.round((t - s.startedAt) / 1000), split_s: moving - prevMoving });
    index++;
  }
  return out;
}

/** Call every few seconds: marks the signal lost after 15 s without an accepted fix. */
export function tick(s: TrackState, now: number): TrackState {
  if (s.status !== "recording" || s.signalLost || s.lastFixAt == null) return s;
  if (now - s.lastFixAt > SIGNAL_LOST_MS) return { ...s, signalLost: true, gaps: s.gaps + 1 };
  return s;
}

export function pauseTrack(s: TrackState, now: number): TrackState {
  if (s.status !== "recording" && s.status !== "acquiring") return s;
  const periods = s.periods.map((p, i) => (i === s.periods.length - 1 && p.end == null ? { ...p, end: now } : p));
  // A pause always breaks the route line.
  return { ...s, status: "paused", periods, signalLost: s.lines.length > 0 };
}

export function resumeTrack(s: TrackState, now: number): TrackState {
  if (s.status !== "paused") return s;
  return { ...s, status: s.lines.length ? "recording" : "acquiring", periods: [...s.periods, { start: now, end: null }], lastFixAt: now };
}

export function finishTrack(s: TrackState, now: number): TrackState {
  if (s.status === "finished") return s;
  const periods = s.periods.map((p, i) => (i === s.periods.length - 1 && p.end == null ? { ...p, end: now } : p));
  return { ...s, status: "finished", finishedAt: now, periods };
}

/** Current pace from roughly the last 30 s of the current line (s per unit), or null with too little data. */
export function currentPace(s: TrackState, now: number): number | null {
  if (s.status !== "recording" || s.signalLost) return null;
  const line = s.lines.at(-1);
  if (!line || line.length < 2) return null;
  const last = line.at(-1)!;
  if (now - last.t > 10_000) return null;
  let first = last;
  for (let i = line.length - 1; i >= 0; i--) {
    first = line[i]!;
    if (last.t - first.t >= 30_000) break;
  }
  const meters = last.d - first.d;
  const seconds = (last.t - first.t) / 1000;
  if (seconds < 10 || meters < 20) return null;
  return seconds / (meters / metersPer(s.unit));
}

/** Perpendicular distance of p from segment a–b, in metres (local equirectangular approximation). */
function offset(p: TrackPoint, a: TrackPoint, b: TrackPoint): number {
  const k = Math.cos(rad(a.lat));
  const x = (q: TrackPoint) => rad(q.lng) * k * R;
  const y = (q: TrackPoint) => rad(q.lat) * R;
  const [ax, ay, bx, by, px, py] = [x(a), y(a), x(b), y(b), x(p), y(p)];
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const u = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

/** Douglas–Peucker simplification, keeping the route shape within `tolerance` metres. */
export function simplify(line: TrackPoint[], tolerance = 3): TrackPoint[] {
  if (line.length <= 2) return line;
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let max = 0;
    let idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = offset(line[k]!, line[i]!, line[j]!);
      if (d > max) {
        max = d;
        idx = k;
      }
    }
    if (idx >= 0 && max > tolerance) {
      keep[idx] = 1;
      stack.push([i, idx], [idx, j]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

export interface GpsRoute {
  type: "MultiLineString";
  /** [lng, lat] pairs, rounded to ~1 m (5 decimals). */
  coordinates: [number, number][][];
}

/** The route as stored: one line per unbroken stretch, simplified, at most `maxPoints` points in total. */
export function routeForSave(s: TrackState, maxPoints = 2000): GpsRoute | null {
  const lines = s.lines.filter((l) => l.length >= 2);
  if (!lines.length) return null;
  let tolerance = 2;
  let simplified = lines.map((l) => simplify(l, tolerance));
  while (simplified.reduce((n, l) => n + l.length, 0) > maxPoints && tolerance < 200) {
    tolerance *= 2;
    simplified = lines.map((l) => simplify(l, tolerance));
  }
  const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
  return { type: "MultiLineString", coordinates: simplified.map((l) => l.map((p) => [r5(p.lng), r5(p.lat)] as [number, number])) };
}

/** Totals for the save: elapsed and moving seconds, and distance. */
export function trackTotals(s: TrackState): { distance_m: number; elapsed_s: number; moving_s: number } {
  const end = s.finishedAt ?? s.periods.at(-1)?.end ?? s.lastFixAt ?? s.startedAt;
  const elapsed = Math.max(1, Math.round((end - s.startedAt) / 1000));
  return { distance_m: Math.round(s.distanceM * 10) / 10, elapsed_s: elapsed, moving_s: Math.max(1, Math.min(elapsed, movingSecondsAt(s, end))) };
}

/** Is a saved draft still a recording to offer to continue (not finished, and recent)? */
export function isResumable(s: unknown, now: number): s is TrackState {
  const t = s as TrackState | null;
  return Boolean(t && t.version === 1 && t.status !== "finished" && typeof t.startedAt === "number" && now - t.startedAt < 12 * 3600_000);
}

/**
 * Continue a recording after the app was closed or reloaded: the time away still counts (unless it was paused),
 * but nothing is assumed about where you went, so the route breaks and the gap is counted.
 */
export function recoverTrack(s: TrackState): TrackState {
  if (s.status === "paused" || s.status === "finished") return s;
  return { ...s, signalLost: s.lines.length > 0, gaps: s.lines.length > 0 ? s.gaps + 1 : s.gaps };
}
