/**
 * Audit 2026-11-14 (nutrition / GPS / health). GPS maths on synthetic traces, hand-checked.
 * Real outdoor accuracy cannot be tested here: every trace below is generated.
 */
import { describe, expect, it } from "vitest";
import { addFix, finishTrack, movingSecondsAt, pauseTrack, resumeTrack, splitsForSave, startTrack, suspendAwareTicker, tick, trackTotals, type GpsFix, type TrackState } from "@/lib/domain/gps-track";
import { formatPace, fromMeters, METERS_PER_MILE, paceSecondsPer, toMeters } from "@/lib/domain/activities";
import { splitRows } from "@/lib/domain/run-splits";

const T0 = Date.UTC(2026, 9, 22, 7, 0, 0);
const LAT0 = 40.0;
const LNG0 = -75.0;
const M_PER_DEG_LAT = 111_195;

/** Heading north at `speed` m/s, one fix a second. */
function trace(opts: { from: number; seconds: number; speed: number; startM?: number }): GpsFix[] {
  const fixes: GpsFix[] = [];
  for (let i = 0; i <= opts.seconds; i++) {
    const m = (opts.startM ?? 0) + i * opts.speed;
    fixes.push({ lat: LAT0 + m / M_PER_DEG_LAT, lng: LNG0, accuracy: 5, t: opts.from + i * 1000 });
  }
  return fixes;
}
const fresh = (unit: "km" | "mi" = "km"): TrackState => startTrack({ id: "a1", kind: "run", unit, now: T0 });

describe("a stretch with no fixes is a gap, however the clock behaved", () => {
  // 61 fixes at 3 m/s = 180 m, then nothing for 5 minutes, then fixes resume 750 m further on for 30 s (90 m).
  const before = trace({ from: T0 + 1000, seconds: 60, speed: 3 });
  const back = T0 + 61_000 + 300_000;
  const after = trace({ from: back + 500, seconds: 30, speed: 3, startM: 180 + 750 });

  it("browser page frozen for 5 minutes: the clock fires first on return, then one fresh fix; the 750 m straight line is not counted", () => {
    const step = suspendAwareTicker();
    let s = fresh();
    for (const f of before) s = step(addFix(s, f).state, f.t);
    expect(trackTotals(s).distance_m).toBeCloseTo(180, 0);
    s = step(s, back); // the suspend-aware clock waits for queued fixes: none exist in a browser
    for (const f of after) s = step(addFix(s, f).state, f.t + 100);
    const d = trackTotals(s).distance_m;
    expect(d).toBeGreaterThan(180 + 90 * 0.9);
    expect(d).toBeLessThan(180 + 90 * 1.03);
    expect(s.gaps).toBe(1);
    expect(s.lines).toHaveLength(2);
    // What was left out is reported, never counted.
    expect(s.stats?.uncountedGapM).toBeGreaterThan(740);
    expect(s.stats?.uncountedGapM).toBeLessThan(760);
  });

  it("no clock at all (a kept recording whose timer was frozen too): the fix's own timestamp is enough", () => {
    let s = fresh();
    for (const f of before) s = addFix(s, f).state;
    for (const f of after) s = addFix(s, f).state;
    expect(trackTotals(s).distance_m).toBeLessThan(180 + 90 * 1.03);
    expect(s.gaps).toBe(1);
  });

  it("the gap is counted once when the clock had already marked it", () => {
    let s = fresh();
    for (const f of before) s = tick(addFix(s, f).state, f.t);
    s = tick(s, T0 + 61_000 + 20_000);
    expect(s.gaps).toBe(1);
    for (const f of after) s = tick(addFix(s, f).state, f.t);
    expect(s.gaps).toBe(1);
  });

  it("fixes 15 s apart or less still join up (the threshold is the documented 15 s)", () => {
    let s = fresh();
    for (const f of before) s = addFix(s, f).state;
    // One fix 15 s later, 45 m on (3 m/s): the same line continues.
    s = addFix(s, { lat: LAT0 + (180 + 45) / M_PER_DEG_LAT, lng: LNG0, accuracy: 5, t: T0 + 61_000 + 15_000 }).state;
    expect(s.gaps).toBe(0);
    expect(s.lines).toHaveLength(1);
  });

  it("time moving keeps running through the gap, so the pace shown is the honest, slower one", () => {
    let s = fresh();
    for (const f of before) s = addFix(s, f).state;
    for (const f of after) s = addFix(s, f).state;
    s = finishTrack(s, after.at(-1)!.t);
    const t = trackTotals(s);
    expect(t.moving_s).toBe(t.elapsed_s);
    expect(t.elapsed_s).toBe(Math.round((after.at(-1)!.t - T0) / 1000));
  });
});

describe("pause and resume", () => {
  it("adds no distance for the stretch walked while paused, and moving time excludes it", () => {
    let s = fresh();
    for (const f of trace({ from: T0 + 1000, seconds: 100, speed: 3 })) s = tick(addFix(s, f).state, f.t);
    const beforePause = s.distanceM;
    s = pauseTrack(s, T0 + 102_000);
    // 200 s paused, moved 400 m meanwhile; fixes during the pause are ignored.
    for (const f of trace({ from: T0 + 103_000, seconds: 190, speed: 2, startM: 300 })) s = addFix(s, f).state;
    expect(s.distanceM).toBe(beforePause);
    s = resumeTrack(s, T0 + 302_000);
    for (const f of trace({ from: T0 + 303_000, seconds: 100, speed: 3, startM: 300 + 400 })) s = tick(addFix(s, f).state, f.t);
    s = finishTrack(s, T0 + 403_000);
    const t = trackTotals(s);
    expect(t.distance_m).toBeGreaterThan(600 * 0.97);
    expect(t.distance_m).toBeLessThan(600 * 1.02);
    // Moving: 0→102 s and 302→403 s = 203 s. Elapsed: 403 s.
    expect(t.moving_s).toBe(203);
    expect(t.elapsed_s).toBe(403);
    expect(movingSecondsAt(s, T0 + 403_000)).toBe(203);
  });
});

describe("splits", () => {
  /** A steady 3.2 km at 4 m/s (800 s), one fix a second. */
  function run(unit: "km" | "mi") {
    let s = fresh(unit);
    for (const f of trace({ from: T0, seconds: 800, speed: 4 })) s = tick(addFix(s, f).state, f.t);
    return finishTrack(s, T0 + 800_000);
  }

  it("whole splits sit on each kilometre at the pace run (250 s per km at 4 m/s)", () => {
    const s = run("km");
    expect(s.splits.map((x) => x.index)).toEqual([1, 2, 3]);
    for (const sp of s.splits) {
      expect(sp.distance_m).toBe(sp.index * 1000);
      expect(Math.abs(sp.split_s - 250)).toBeLessThanOrEqual(3);
    }
  });

  it("the saved table ends with the last partial stretch, so the split times add up to the moving time", () => {
    const s = run("km");
    const totals = trackTotals(s);
    const saved = splitsForSave(s);
    expect(saved).toHaveLength(4);
    const last = saved.at(-1)!;
    expect(last.index).toBe(4);
    expect(last.distance_m).toBe(Math.round(totals.distance_m));
    expect(last.moving_s).toBe(totals.moving_s);
    expect(saved.reduce((n, x) => n + x.split_s, 0)).toBe(totals.moving_s);
    const rows = splitRows(saved);
    expect(rows.map((r) => r.partial)).toEqual([false, false, false, true]);
    expect(rows.at(-1)!.label).toMatch(/^0\.\d\d km$/);
    expect(rows.reduce((n, r) => n + r.seconds, 0)).toBe(totals.moving_s);
  });

  it("no partial row is added for the few metres past a whole split, or for a run shorter than one split", () => {
    let s = fresh("km");
    // 503 s at 4 m/s = 2,012 m: two whole splits and a 12 m stub, which is not a row.
    for (const f of trace({ from: T0, seconds: 503, speed: 4 })) s = tick(addFix(s, f).state, f.t);
    s = finishTrack(s, T0 + 503_000);
    expect(s.splits).toHaveLength(2);
    expect(splitsForSave(s)).toHaveLength(2);
    let short = fresh("km");
    for (const f of trace({ from: T0, seconds: 150, speed: 4 })) short = tick(addFix(short, f).state, f.t);
    short = finishTrack(short, T0 + 150_000);
    expect(splitsForSave(short)).toEqual([]);
  });

  it("miles: 3.0 km is 1 whole mile and a 0.86-mile partial", () => {
    let s = fresh("mi");
    for (const f of trace({ from: T0, seconds: 750, speed: 4 })) s = tick(addFix(s, f).state, f.t);
    s = finishTrack(s, T0 + 750_000);
    const saved = splitsForSave(s);
    expect(s.splits).toHaveLength(1);
    expect(s.splits[0]!.distance_m).toBe(Math.round(METERS_PER_MILE));
    expect(saved).toHaveLength(2);
    const rows = splitRows(saved);
    expect(rows[0]!.label).toBe("Mile 1");
    expect(rows[1]!.partial).toBe(true);
    // (3000 − 1609) ÷ 1609.344 = 0.86 mi, give or take the smoothing.
    expect(rows[1]!.label).toMatch(/^0\.8[5-7] mi$/);
    expect(rows.reduce((n, r) => n + r.seconds, 0)).toBe(trackTotals(s).moving_s);
  });
});

describe("pace and units, by hand", () => {
  it("5 km in 25:00 is 5:00 /km and 8:03 /mi", () => {
    expect(formatPace(paceSecondsPer(5000, 1500, "km"), "km")).toBe("5:00 /km");
    // 1500 s ÷ (5000 ÷ 1609.344) = 482.8 s = 8:03.
    expect(formatPace(paceSecondsPer(5000, 1500, "mi"), "mi")).toBe("8:03 /mi");
  });
  it("miles and kilometres convert both ways without drift", () => {
    expect(toMeters(3.1, "mi")).toBe(4988.97);
    expect(fromMeters(toMeters(26.2, "mi"), "km")).toBeCloseTo(42.165, 3);
    expect(fromMeters(1609.344, "mi")).toBe(1);
  });
});
