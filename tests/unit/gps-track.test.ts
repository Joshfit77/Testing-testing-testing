import { describe, expect, it } from "vitest";
import {
  addFix,
  currentPace,
  finishTrack,
  haversine,
  isFinishedTooOldToSave,
  isRecoverable,
  isResumable,
  RECOVERABLE_MS,
  SAVE_WINDOW_MS,
  movingSecondsAt,
  pauseTrack,
  recoverTrack,
  resumeTrack,
  routeForSave,
  startTrack,
  tick,
  trackTotals,
  type GpsFix,
  type TrackState,
} from "@/lib/domain/gps-track";

const T0 = Date.UTC(2026, 9, 22, 7, 0, 0);
const LAT0 = 40.0;
const LNG0 = -75.0;
const M_PER_DEG_LAT = 111_195;

/** A simulated trace: heading north at `speed` m/s, one fix a second, optional deterministic noise. */
function trace(opts: { from: number; seconds: number; speed: number; startM?: number; noiseM?: number; accuracy?: number }): GpsFix[] {
  const fixes: GpsFix[] = [];
  for (let i = 0; i <= opts.seconds; i++) {
    const m = (opts.startM ?? 0) + i * opts.speed;
    const noise = opts.noiseM ? Math.sin(i * 12.9898) * opts.noiseM : 0;
    fixes.push({ lat: LAT0 + (m + noise) / M_PER_DEG_LAT, lng: LNG0, accuracy: opts.accuracy ?? 5, t: opts.from + i * 1000 });
  }
  return fixes;
}

function feed(s: TrackState, fixes: GpsFix[]): TrackState {
  for (const f of fixes) s = tick(addFix(s, f).state, f.t);
  return s;
}

const fresh = (kind: "run" | "walk" = "run", unit: "km" | "mi" = "km") => startTrack({ id: "a1", kind, unit, now: T0 });

describe("distance", () => {
  it("haversine matches a known distance", () => {
    expect(haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(M_PER_DEG_LAT, -1);
  });

  it("waits for a good first fix and ignores inaccurate ones", () => {
    let s = fresh();
    s = addFix(s, { lat: LAT0, lng: LNG0, accuracy: 40, t: T0 + 1000 }).state;
    s = addFix(s, { lat: LAT0, lng: LNG0, accuracy: 22, t: T0 + 2000 }).state;
    expect(s.status).toBe("acquiring");
    expect(s.rejected).toMatchObject({ inaccurate: 1, waiting_for_fix: 1 });
    s = addFix(s, { lat: LAT0, lng: LNG0, accuracy: 8, t: T0 + 3000 }).state;
    expect(s.status).toBe("recording");
    expect(s.distanceM).toBe(0);
  });

  it("measures a steady 1.2 km run within 1%, with a split at each kilometre and a live pace", () => {
    // 5:00/km = 3.333 m/s for 360 s.
    const s = feed(fresh(), trace({ from: T0, seconds: 360, speed: 1000 / 300 }));
    expect(s.distanceM).toBeGreaterThan(1188);
    expect(s.distanceM).toBeLessThan(1212);
    expect(s.splits).toHaveLength(1);
    expect(s.splits[0]).toMatchObject({ index: 1, unit: "km", distance_m: 1000 });
    expect(Math.abs(s.splits[0]!.moving_s - 300)).toBeLessThanOrEqual(1);
    expect(currentPace(s, T0 + 360_000)).toBeCloseTo(300, -1);
  });

  it("uses mile splits for imperial members", () => {
    const s = feed(fresh("run", "mi"), trace({ from: T0, seconds: 700, speed: 2.5 }));
    expect(s.splits.map((x) => x.distance_m)).toEqual([1609]);
  });

  it("never counts an impossible jump", () => {
    let s = feed(fresh(), trace({ from: T0, seconds: 60, speed: 3 }));
    const before = s.distanceM;
    const r = addFix(s, { lat: LAT0 + 2000 / M_PER_DEG_LAT, lng: LNG0, accuracy: 5, t: T0 + 61_000 });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe("jump");
    s = r.state;
    expect(s.distanceM).toBe(before);
    // Walks cap lower: a sustained 8 m/s (a bike or a car) is fine for a sprint but never counted as walking.
    let w = feed(fresh("walk"), trace({ from: T0, seconds: 30, speed: 1.4 }));
    const walked = w.distanceM;
    // A slow walk still adds up.
    expect(walked).toBeGreaterThan(36);
    w = feed(w, trace({ from: T0 + 31_000, seconds: 20, speed: 8, startM: 50 }));
    expect(w.rejected.jump).toBeGreaterThan(0);
    expect(w.distanceM - walked).toBeLessThan(10);
    const sprint = feed(fresh("run"), trace({ from: T0, seconds: 20, speed: 8 }));
    expect(sprint.rejected.jump).toBe(0);
    expect(sprint.distanceM).toBeGreaterThan(150);
  });

  it("doesn't turn GPS wobble while standing still into distance", () => {
    const s = feed(fresh(), trace({ from: T0, seconds: 120, speed: 0, noiseM: 2 }));
    expect(s.distanceM).toBeLessThan(5);
    // The fixes still keep the signal alive: standing still is not a gap.
    expect(s.signalLost).toBe(false);
    expect(s.rejected.jitter).toBeGreaterThan(30);
  });
});

describe("pauses, gaps and recovery", () => {
  it("excludes paused time and never draws or counts across a pause", () => {
    let s = feed(fresh(), trace({ from: T0, seconds: 100, speed: 3 }));
    s = pauseTrack(s, T0 + 100_000);
    // Moved 500 m while paused (e.g. a lift or a car): ignored.
    s = feed(s, trace({ from: T0 + 101_000, seconds: 60, speed: 0, startM: 800 }));
    expect(s.rejected.paused).toBeGreaterThan(0);
    s = resumeTrack(s, T0 + 200_000);
    s = feed(s, trace({ from: T0 + 201_000, seconds: 100, speed: 3, startM: 800 }));
    s = finishTrack(s, T0 + 301_000);
    expect(s.lines).toHaveLength(2);
    expect(s.distanceM).toBeGreaterThan(590);
    expect(s.distanceM).toBeLessThan(610);
    const totals = trackTotals(s);
    expect(totals.elapsed_s).toBe(301);
    expect(totals.moving_s).toBe(201);
    expect(movingSecondsAt(s, T0 + 150_000)).toBe(100);
  });

  it("marks lost signal after 15 s and doesn't invent distance across the gap", () => {
    let s = feed(fresh(), trace({ from: T0, seconds: 60, speed: 3 }));
    s = tick(s, T0 + 70_000);
    expect(s.signalLost).toBe(false);
    s = tick(s, T0 + 80_000);
    expect(s.signalLost).toBe(true);
    expect(s.gaps).toBe(1);
    expect(currentPace(s, T0 + 80_000)).toBeNull();
    // Signal returns 300 m further on (a tunnel): a new line, and the 120 m-odd in between isn't counted.
    s = feed(s, trace({ from: T0 + 120_000, seconds: 60, speed: 3, startM: 480 }));
    expect(s.lines).toHaveLength(2);
    expect(s.distanceM).toBeGreaterThan(355);
    expect(s.distanceM).toBeLessThan(365);
    // The clock kept running through the gap: it's moving time, not a pause.
    expect(trackTotals(finishTrack(s, T0 + 180_000)).moving_s).toBe(180);
  });

  it("recovers a recording after the app was closed without assuming where you went", () => {
    const s = feed(fresh(), trace({ from: T0, seconds: 30, speed: 3 }));
    const saved = JSON.parse(JSON.stringify(s)) as unknown;
    expect(isResumable(saved, T0 + 60_000)).toBe(true);
    expect(isResumable({ ...(saved as TrackState), status: "finished" }, T0 + 60_000)).toBe(false);
    expect(isResumable(saved, T0 + 13 * 3600_000)).toBe(false);
    // A finished recording whose save failed (offline) is still offered back, for as long as it can be saved.
    const finished = { ...(saved as TrackState), status: "finished" };
    expect(isRecoverable(saved, T0 + 60_000)).toBe(true);
    expect(isRecoverable(finished, T0 + 60_000)).toBe(true);
    // In progress: offered for 12 hours, then dropped. It was never finished, so there is nothing to tell.
    expect(isRecoverable(saved, T0 + RECOVERABLE_MS - 1)).toBe(true);
    expect(isRecoverable(saved, T0 + RECOVERABLE_MS)).toBe(false);
    expect(isFinishedTooOldToSave(saved, T0 + 3 * 86_400_000)).toBe(false);
    // Finished: kept past 12 hours, right up to the server's save limit.
    expect(isRecoverable(finished, T0 + 13 * 3600_000)).toBe(true);
    expect(isRecoverable(finished, T0 + SAVE_WINDOW_MS - 1)).toBe(true);
    expect(isFinishedTooOldToSave(finished, T0 + SAVE_WINDOW_MS - 1)).toBe(false);
    // Finished and beyond the server's limit: no longer offered for saving, and flagged so the member is told.
    expect(isRecoverable(finished, T0 + SAVE_WINDOW_MS)).toBe(false);
    expect(isFinishedTooOldToSave(finished, T0 + SAVE_WINDOW_MS)).toBe(true);
    expect(SAVE_WINDOW_MS).toBe(2 * 86_400_000);
    expect(isFinishedTooOldToSave(null, T0)).toBe(false);
    expect(isFinishedTooOldToSave({ version: 3, status: "finished", startedAt: 0 }, T0)).toBe(false);
    expect(isRecoverable(null, T0)).toBe(false);
    expect(isRecoverable({ version: 3, status: "finished", startedAt: T0 }, T0)).toBe(false);
    const r = recoverTrack(saved as TrackState);
    expect(r.signalLost).toBe(true);
    expect(r.gaps).toBe(1);
    expect(r.distanceM).toBe(s.distanceM);
  });

  it("ignores out-of-order fixes", () => {
    let s = feed(fresh(), trace({ from: T0, seconds: 10, speed: 3 }));
    const r = addFix(s, { lat: LAT0, lng: LNG0, accuracy: 5, t: T0 + 5000 });
    expect(r.reason).toBe("out_of_order");
    s = r.state;
    expect(s.rejected.out_of_order).toBe(1);
  });
});

describe("saving the route", () => {
  it("stores [lng, lat] lines, simplified and capped in size", () => {
    let s = feed(fresh(), trace({ from: T0, seconds: 1500, speed: 3 }));
    s = finishTrack(s, T0 + 1_500_000);
    const route = routeForSave(s, 200)!;
    expect(route.type).toBe("MultiLineString");
    const pts = route.coordinates.flat();
    expect(pts.length).toBeLessThanOrEqual(200);
    expect(pts.length).toBeGreaterThanOrEqual(2);
    expect(pts[0]).toEqual([LNG0, LAT0]);
    // A straight line simplifies to its ends.
    expect(route.coordinates[0]).toHaveLength(2);
    expect(routeForSave(startTrack({ id: "x", kind: "run", unit: "km", now: T0 }))).toBeNull();
  });
});

describe("a locked phone (JavaScript paused while the location service keeps recording)", async () => {
  const { suspendAwareTicker, SIGNAL_LOST_MS } = await import("@/lib/domain/gps-track");

  /** 60 s of running before the lock, 90 s locked, 60 s after: fixes every second throughout (the service never stopped). */
  const before = trace({ from: T0 + 1000, seconds: 60, speed: 3 });
  const locked = trace({ from: T0 + 62_000, seconds: 89, speed: 3, startM: 61 * 3 });
  const after = trace({ from: T0 + 152_000, seconds: 60, speed: 3, startM: 151 * 3 });
  const expected = (60 + 90 + 60) * 3;

  it("counts the fixes queued while locked when the clock happens to run before they arrive", () => {
    const step = suspendAwareTicker();
    let s = fresh();
    for (const f of before) s = step(addFix(s, f).state, f.t);
    // Unlock: the clock fires first (90 s after its last tick), then the queued fixes arrive in a burst.
    const unlock = T0 + 152_500;
    s = step(s, unlock);
    expect(s.signalLost).toBe(false);
    for (const f of locked) s = addFix(s, f).state;
    for (const f of after) s = step(addFix(s, f).state, f.t + 600);
    expect(s.gaps).toBe(0);
    expect(trackTotals(s).distance_m).toBeGreaterThan(expected * 0.99);
    expect(trackTotals(s).distance_m).toBeLessThan(expected * 1.01);
  });

  it("the plain clock would have broken the route there (what the suspend-aware clock prevents)", () => {
    let s = fresh();
    for (const f of before) s = tick(addFix(s, f).state, f.t);
    s = tick(s, T0 + 152_500);
    expect(s.signalLost).toBe(true);
  });

  it("still records a real gap when nothing arrives after the unlock", () => {
    const step = suspendAwareTicker();
    let s = fresh();
    for (const f of before) s = step(addFix(s, f).state, f.t);
    const unlock = T0 + 152_500;
    for (let t = unlock; t <= unlock + SIGNAL_LOST_MS + 2000; t += 1000) s = step(s, t);
    expect(s.signalLost).toBe(true);
    expect(s.gaps).toBe(1);
  });
});
