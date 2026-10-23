/**
 * Live GPS run/walk tracking (pure, unit-tested; the screen and location sources live in src/components/run).
 *
 * Rules (docs/RUN_TRACKING_PLAN.md, measured in docs/GPS_ACCURACY.md):
 *   - Distance only ever comes from accepted fixes, between consecutive points of the same unbroken line. Nothing
 *     is counted before the first good fix, across a pause, or across a stretch with no usable signal.
 *   - Fixes are rejected when they're inaccurate (> 25 m), stale or out of order, or an outlier: too far from where
 *     the smoothed track says you are for the fix's own accuracy, or an impossible speed for a run or a walk.
 *   - Positions are smoothed with a constant-velocity Kalman filter weighted by each fix's reported accuracy, and
 *     distance is measured along the smoothed track. Raw fix-to-fix sums zig-zag with the noise and read long.
 *   - Standing still adds nothing: while the smoothed speed is below a walking pace the position is followed but
 *     no distance is counted (GPS drift at a traffic light is not movement).
 *   - Several consecutive outliers that agree with each other mean the track, not the fixes, was wrong (for example
 *     a poor first fix): the filter restarts there as a new line, and nothing is counted for the jump.
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

export type RejectReason = "inaccurate" | "out_of_order" | "jump" | "jitter" | "waiting_for_fix" | "paused" | "stale";

/**
 * Kalman filter state, per axis (east, north) in metres from the line's first fix: position and velocity, with a 2×2
 * covariance [pp, pv, vv]. `ref` is the last point distance was counted from. `outliers` holds the recent rejected
 * fixes that may turn out to be right.
 */
export interface FilterState {
  lat0: number;
  lng0: number;
  t: number;
  e: [number, number];
  n: [number, number];
  Pe: [number, number, number];
  Pn: [number, number, number];
  ref: [number, number];
  outliers: GpsFix[];
}

/** What the diagnostics panel shows. Never includes positions. */
export interface TrackStats {
  accepted: number;
  /** Fix intervals: count and sum (s) of the gaps between consecutive fixes received, and the longest. */
  intervals: number;
  intervalSum: number;
  intervalMax: number;
  /** Best and worst accuracy seen (m). */
  bestAccuracy: number | null;
  worstAccuracy: number | null;
  /** Times the filter restarted after consistent outliers. */
  restarts: number;
  /** Straight-line distance across signal gaps that was NOT counted (m): shown so the member knows what's missing. */
  uncountedGapM: number;
  /** Smoothed speed (m/s) after the last accepted fix. */
  speed: number | null;
  lastReceivedAt: number | null;
}

export interface TrackState {
  /** 2 adds the smoothing filter and stats; drafts saved by version 1 still resume. */
  version: 1 | 2;
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
  /** Why the line is broken: a signal gap, a pause, or the app having been closed. */
  breakReason?: "signal" | "pause" | "recovery" | null;
  /** How many stretches of lost signal there were. */
  gaps: number;
  rejected: Record<RejectReason, number>;
  splits: TrackSplit[];
  lastAccuracy: number | null;
  /** Smoothing filter for the current line (version 2; absent in drafts saved by version 1). */
  filter?: FilterState | null;
  stats?: TrackStats;
}

export const MAX_ACCURACY_M = 25;
export const FIRST_FIX_ACCURACY_M = 20;
export const SIGNAL_LOST_MS = 15_000;
/** Implied speed above which a fix is a jump, not movement (10 m/s ≈ 2:41/km for runs; 4 m/s for walks). */
export const MAX_SPEED_MS: Record<ActivityKind, number> = { run: 10, walk: 4 };
/**
 * Distance is measured along the smoothed track in chords of at least this many metres: the leftover wobble of the
 * smoothed position would otherwise add length every second (the inflation shrinks with the square of the chord).
 */
const MIN_CHORD_M = 6;
/** Smoothed speed below which you're standing still: no distance is counted (m/s; a slow walk is ~0.8). */
export const STILL_SPEED_MS = 0.55;
/** Process noise (m²/s³): how quickly a runner or walker can change speed and direction. */
const PROCESS_Q: Record<ActivityKind, number> = { run: 1.5, walk: 0.15 };
/** Outlier gate on the normalised innovation (2 degrees of freedom, ≈ 99.97%). */
const OUTLIER_GATE = 16;
/** Consecutive agreeing outliers after which the filter restarts on them. */
const RESTART_AFTER = 3;
/** A fix older than the start of the recording (a cached position) is ignored. */
const STALE_MS = 2_000;

const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const emptyStats = (): TrackStats => ({
  accepted: 0,
  intervals: 0,
  intervalSum: 0,
  intervalMax: 0,
  bestAccuracy: null,
  worstAccuracy: null,
  restarts: 0,
  uncountedGapM: 0,
  speed: null,
  lastReceivedAt: null,
});

export function startTrack(opts: { id: string; kind: ActivityKind; unit: DistanceUnit; now: number }): TrackState {
  return {
    version: 2,
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
    rejected: { inaccurate: 0, out_of_order: 0, jump: 0, jitter: 0, waiting_for_fix: 0, paused: 0, stale: 0 },
    splits: [],
    lastAccuracy: null,
    filter: null,
    stats: emptyStats(),
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
  return { state: { ...s, rejected: { ...s.rejected, [reason]: (s.rejected[reason] ?? 0) + 1 } }, accepted: false, reason };
}

// ---------------------------------------------------------------------------------------------- Smoothing filter

const M_PER_DEG = (Math.PI / 180) * R;
const toLocal = (f: FilterState, p: { lat: number; lng: number }): [number, number] => [(p.lng - f.lng0) * M_PER_DEG * Math.cos(rad(f.lat0)), (p.lat - f.lat0) * M_PER_DEG];
const toLatLng = (f: FilterState, e: number, n: number) => ({ lat: f.lat0 + n / M_PER_DEG, lng: f.lng0 + e / (M_PER_DEG * Math.cos(rad(f.lat0))) });
/** Per-axis measurement variance from the reported accuracy (a ~68% radius), at least (2 m)². */
const measVar = (accuracy: number) => Math.max(4, (accuracy / 1.5) ** 2);

function initFilter(fix: GpsFix): FilterState {
  const r = measVar(fix.accuracy);
  return { lat0: fix.lat, lng0: fix.lng, t: fix.t, e: [0, 0], n: [0, 0], Pe: [r, 0, 25], Pn: [r, 0, 25], ref: [0, 0], outliers: [] };
}

type Axis = { x: [number, number]; P: [number, number, number] };

function predict(a: Axis, dt: number, q: number): Axis {
  const [p, v] = a.x;
  const [pp, pv, vv] = a.P;
  return {
    x: [p + v * dt, v],
    P: [pp + 2 * dt * pv + dt * dt * vv + (q * dt ** 3) / 3, pv + dt * vv + (q * dt * dt) / 2, vv + q * dt],
  };
}

function update(a: Axis, z: number, r: number): Axis {
  const [p, v] = a.x;
  const [pp, pv, vv] = a.P;
  const S = pp + r;
  const k0 = pp / S;
  const k1 = pv / S;
  const y = z - p;
  return { x: [p + k0 * y, v + k1 * y], P: [(1 - k0) * pp, (1 - k0) * pv, vv - k1 * pv] };
}

/** Do the recent outliers agree with each other (a plausible path between them)? Then they're probably right. */
function outliersAgree(kind: ActivityKind, list: GpsFix[]): boolean {
  if (list.length < RESTART_AFTER) return false;
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1]!;
    const b = list[i]!;
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0 || haversine(a, b) / dt > MAX_SPEED_MS[kind]) return false;
  }
  return true;
}

function withStats(s: TrackState, fix: GpsFix): TrackState {
  const st = { ...(s.stats ?? emptyStats()) };
  if (st.lastReceivedAt != null && fix.t > st.lastReceivedAt) {
    const dt = (fix.t - st.lastReceivedAt) / 1000;
    st.intervals += 1;
    st.intervalSum += dt;
    st.intervalMax = Math.max(st.intervalMax, dt);
  }
  if (Number.isFinite(fix.accuracy) && fix.accuracy >= 0) {
    st.bestAccuracy = st.bestAccuracy == null ? fix.accuracy : Math.min(st.bestAccuracy, fix.accuracy);
    st.worstAccuracy = st.worstAccuracy == null ? fix.accuracy : Math.max(st.worstAccuracy, fix.accuracy);
  }
  st.lastReceivedAt = Math.max(st.lastReceivedAt ?? 0, fix.t);
  return { ...s, stats: st, lastAccuracy: Number.isFinite(fix.accuracy) ? Math.round(fix.accuracy) : s.lastAccuracy };
}

/** Start a new line at this fix (first good fix, after a pause, a signal gap or a filter restart). Counts nothing. */
function startLine(s: TrackState, fix: GpsFix, restart = false): { state: TrackState; accepted: true } {
  const st = s.stats ?? emptyStats();
  // What a gap would have added in a straight line: reported (never counted).
  const prev = lastPoint(s);
  const uncounted = s.signalLost && s.breakReason === "signal" && prev && !restart ? haversine(prev, fix) : 0;
  const point = { lat: fix.lat, lng: fix.lng, t: fix.t, d: s.distanceM };
  return {
    state: {
      ...s,
      status: "recording",
      signalLost: false,
      breakReason: null,
      lastFixAt: fix.t,
      lines: [...s.lines, [point]],
      filter: initFilter(fix),
      stats: { ...st, accepted: st.accepted + 1, restarts: st.restarts + (restart ? 1 : 0), uncountedGapM: st.uncountedGapM + uncounted, speed: null },
    },
    accepted: true,
  };
}

/** Add one location fix. Returns the new state and whether the fix was used. */
export function addFix(s: TrackState, fix: GpsFix): { state: TrackState; accepted: boolean; reason?: RejectReason } {
  if (s.status === "finished") return { state: s, accepted: false };
  if (s.status === "paused") return reject(s, "paused");
  const withAcc = withStats(s, fix);
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng) || !(fix.accuracy >= 0) || fix.accuracy > MAX_ACCURACY_M) return reject(withAcc, "inaccurate");
  if (fix.t < s.startedAt - STALE_MS) return reject(withAcc, "stale");
  if (s.status === "acquiring" && fix.accuracy > FIRST_FIX_ACCURACY_M) return reject(withAcc, "waiting_for_fix");
  if (s.lastFixAt != null && fix.t <= s.lastFixAt) return reject(withAcc, "out_of_order");

  // First good fix, or the first after a pause or a signal gap: start a new line, count nothing yet.
  const prev = lastPoint(s);
  const f = s.filter;
  if (s.status === "acquiring" || s.signalLost || !prev || s.lines.length === 0 || !f) return startLine(withAcc, fix);

  const dt = Math.max(0.05, (fix.t - f.t) / 1000);
  const q = PROCESS_Q[s.kind];
  const [ze, zn] = toLocal(f, fix);
  const r = measVar(fix.accuracy);
  const pe = predict({ x: f.e, P: f.Pe }, dt, q);
  const pn = predict({ x: f.n, P: f.Pn }, dt, q);

  // Outlier: too far from the predicted position for both uncertainties, or an impossible speed from the last point.
  const nis = (ze - pe.x[0]) ** 2 / (pe.P[0] + r) + (zn - pn.x[0]) ** 2 / (pn.P[0] + r);
  const [le, ln] = [f.e[0], f.n[0]];
  const minMove = Math.max(0, Math.hypot(ze - le, zn - ln) - fix.accuracy);
  if (nis > OUTLIER_GATE || minMove / dt > MAX_SPEED_MS[s.kind]) {
    const outliers = [...f.outliers, fix].slice(-RESTART_AFTER);
    if (outliersAgree(s.kind, outliers)) return startLine({ ...withAcc, rejected: { ...withAcc.rejected, jump: withAcc.rejected.jump + 1 } }, fix, true);
    return reject({ ...withAcc, lastFixAt: s.lastFixAt, filter: { ...f, outliers } }, "jump");
  }

  const ue = update(pe, ze, r);
  const un = update(pn, zn, r);
  const speed = Math.hypot(ue.x[1], un.x[1]);
  if (speed > MAX_SPEED_MS[s.kind]) {
    // Each fix looked possible on its own, but together they're too fast for a run or a walk (a bike, a car).
    return reject({ ...withAcc, filter: { ...f, outliers: [...f.outliers, fix].slice(-RESTART_AFTER) } }, "jump");
  }
  const st = withAcc.stats!;
  let filter: FilterState = { ...f, t: fix.t, e: ue.x, n: un.x, Pe: ue.P, Pn: un.P, outliers: [] };
  const step = Math.hypot(ue.x[0] - f.ref[0], un.x[0] - f.ref[1]);
  if (speed < STILL_SPEED_MS) {
    // Standing still or GPS drift: the fix keeps the signal alive and the filter follows it, but nothing is counted.
    filter = { ...filter, ref: [ue.x[0], un.x[0]] };
    return {
      state: { ...withAcc, lastFixAt: fix.t, filter, stats: { ...st, accepted: st.accepted + 1, speed }, rejected: { ...withAcc.rejected, jitter: withAcc.rejected.jitter + 1 } },
      accepted: false,
      reason: "jitter",
    };
  }
  if (step < MIN_CHORD_M) {
    // Moving, but not far enough yet to measure reliably: keep the filter, count it with the next chord.
    return { state: { ...withAcc, lastFixAt: fix.t, filter, stats: { ...st, accepted: st.accepted + 1, speed } }, accepted: true };
  }
  filter = { ...filter, ref: [ue.x[0], un.x[0]] };
  const distanceM = s.distanceM + step;
  const pos = toLatLng(f, ue.x[0], un.x[0]);
  const point = { lat: pos.lat, lng: pos.lng, t: fix.t, d: distanceM };
  const lines = [...s.lines.slice(0, -1), [...s.lines.at(-1)!, point]];
  const next: TrackState = { ...withAcc, lastFixAt: fix.t, distanceM, lines, filter, stats: { ...st, accepted: st.accepted + 1, speed } };
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

/** Where the smoothed track puts you now (for the live map), or null before the first good fix / during a gap. */
export function currentPosition(s: TrackState): { lat: number; lng: number; accuracy: number } | null {
  const f = s.filter;
  if (!f || s.signalLost || s.status === "finished") return null;
  const p = toLatLng(f, f.e[0], f.n[0]);
  // One-sigma radius of the smoothed position, never shown tighter than 2 m.
  return { ...p, accuracy: Math.max(2, Math.sqrt((f.Pe[0] + f.Pn[0]) / 2) * 1.5) };
}

export type GpsHint = "precise_off" | "weak_signal" | "slow_updates" | "many_outliers";

/** What the "GPS details" panel shows. Counts and accuracies only: never a position. */
export interface GpsDiagnostics {
  lastFixAgeS: number | null;
  lastAccuracy: number | null;
  bestAccuracy: number | null;
  worstAccuracy: number | null;
  meanIntervalS: number | null;
  maxIntervalS: number | null;
  received: number;
  accepted: number;
  ignored: { inaccurate: number; waiting: number; outOfOrder: number; outliers: number; standingStill: number; whilePaused: number };
  gaps: number;
  uncountedGapM: number;
  restarts: number;
  speedMs: number | null;
  hints: GpsHint[];
}

export function gpsDiagnostics(s: TrackState, now: number): GpsDiagnostics {
  const st = s.stats ?? emptyStats();
  const r = s.rejected;
  const ignored = {
    inaccurate: r.inaccurate,
    waiting: r.waiting_for_fix,
    outOfOrder: r.out_of_order + (r.stale ?? 0),
    outliers: r.jump,
    standingStill: r.jitter,
    whilePaused: r.paused,
  };
  // Standing-still fixes are counted as accepted stats too (they keep the signal alive), so don't add them twice.
  const received = st.accepted + ignored.inaccurate + ignored.waiting + ignored.outOfOrder + ignored.outliers + ignored.whilePaused;
  const hints: GpsHint[] = [];
  // Approximate location only (iOS "Precise Location" off, Android "approximate"): accuracy in the hundreds of metres.
  if (st.accepted === 0 && st.bestAccuracy != null && st.bestAccuracy >= 200) hints.push("precise_off");
  else if ((s.lastAccuracy ?? 0) > FIRST_FIX_ACCURACY_M || (received >= 10 && ignored.inaccurate + ignored.waiting > received / 2)) hints.push("weak_signal");
  const meanInterval = st.intervals ? st.intervalSum / st.intervals : null;
  if (meanInterval != null && st.intervals >= 5 && meanInterval > 5) hints.push("slow_updates");
  if (received >= 20 && ignored.outliers > received / 10) hints.push("many_outliers");
  return {
    lastFixAgeS: st.lastReceivedAt != null ? Math.max(0, Math.round((now - st.lastReceivedAt) / 1000)) : null,
    lastAccuracy: s.lastAccuracy,
    bestAccuracy: st.bestAccuracy != null ? Math.round(st.bestAccuracy) : null,
    worstAccuracy: st.worstAccuracy != null ? Math.round(st.worstAccuracy) : null,
    meanIntervalS: meanInterval != null ? Math.round(meanInterval * 10) / 10 : null,
    maxIntervalS: st.intervals ? Math.round(st.intervalMax) : null,
    received,
    accepted: st.accepted,
    ignored,
    gaps: s.gaps,
    uncountedGapM: Math.round(st.uncountedGapM),
    restarts: st.restarts,
    speedMs: st.speed != null ? Math.round(st.speed * 10) / 10 : null,
    hints,
  };
}

/** Readings ignored as imprecise or impossible (standing still and paused fixes are not counted here). */
export function ignoredReadings(s: TrackState): number {
  const r = s.rejected;
  return r.inaccurate + r.waiting_for_fix + r.out_of_order + (r.stale ?? 0) + r.jump;
}

/** Call every few seconds: marks the signal lost after 15 s without an accepted fix. */
export function tick(s: TrackState, now: number): TrackState {
  if (s.status !== "recording" || s.signalLost || s.lastFixAt == null) return s;
  if (now - s.lastFixAt > SIGNAL_LOST_MS) return { ...s, signalLost: true, breakReason: "signal", gaps: s.gaps + 1 };
  return s;
}

export function pauseTrack(s: TrackState, now: number): TrackState {
  if (s.status !== "recording" && s.status !== "acquiring") return s;
  const periods = s.periods.map((p, i) => (i === s.periods.length - 1 && p.end == null ? { ...p, end: now } : p));
  // A pause always breaks the route line.
  return { ...s, status: "paused", periods, signalLost: s.lines.length > 0, breakReason: s.lines.length > 0 ? "pause" : null };
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
  return Boolean(t && (t.version === 1 || t.version === 2) && t.status !== "finished" && typeof t.startedAt === "number" && now - t.startedAt < 12 * 3600_000);
}

/**
 * Continue a recording after the app was closed or reloaded: the time away still counts (unless it was paused),
 * but nothing is assumed about where you went, so the route breaks and the gap is counted.
 */
export function recoverTrack(s: TrackState): TrackState {
  if (s.status === "paused" || s.status === "finished") return s;
  // Version 1 drafts have no filter or stats: the next fix starts a new line with a fresh filter anyway.
  const upgraded = { ...s, version: 2 as const, stats: s.stats ?? emptyStats(), rejected: { ...s.rejected, stale: s.rejected.stale ?? 0 } };
  return { ...upgraded, signalLost: s.lines.length > 0, breakReason: s.lines.length > 0 ? "recovery" : null, gaps: s.lines.length > 0 ? s.gaps + 1 : s.gaps };
}
