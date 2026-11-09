import { describe, expect, it } from "vitest";
import {
  addFix,
  currentPace,
  finishTrack,
  gpsDiagnostics,
  haversine,
  isRecoverable,
  isResumable,
  MAX_SPEED_MS,
  pauseTrack,
  RECOVERABLE_MS,
  recoverTrack,
  resumeTrack,
  routeForSave,
  SIGNAL_LOST_MS,
  startTrack,
  tick,
  trackTotals,
  type GpsFix,
  type TrackState,
} from "@/lib/domain/gps-track";
import { activityDay, formatPace, localToUtcIso, METERS_PER_MILE, paceSecondsPer, utcToLocalParts } from "@/lib/domain/activities";

/**
 * Launch-audit edge cases for the GPS state machine (2026-11-07): synthetic traces that a phone can really produce.
 * Everything here is pure and deterministic; the distance-accuracy tolerances on realistic noise live in
 * gps-accuracy.test.ts.
 */
const LAT0 = 40.0;
const LNG0 = -75.0;
const M_PER_DEG_LAT = 111_195;
const T0 = Date.UTC(2026, 10, 1, 5, 30, 0); // 2026-11-01 05:30Z: 30 min before US fall-back in New York

const north = (m: number, t: number, accuracy = 5): GpsFix => ({ lat: LAT0 + m / M_PER_DEG_LAT, lng: LNG0, accuracy, t });

/** One fix a second heading north at `speed` m/s, starting `startM` metres up the line at time `from`. */
function straight(from: number, seconds: number, speed: number, startM = 0, accuracy = 5): GpsFix[] {
  return Array.from({ length: seconds + 1 }, (_, i) => north(startM + i * speed, from + i * 1000, accuracy));
}

function feed(s: TrackState, fixes: GpsFix[]): TrackState {
  for (const f of fixes) s = tick(addFix(s, f).state, f.t);
  return s;
}

const fresh = (kind: "run" | "walk" = "run", unit: "km" | "mi" = "km", now = T0) => startTrack({ id: "audit", kind, unit, now });

describe("straight line", () => {
  it("1 km at 3 m/s: distance within 1%, a split at the kilometre with its crossing time interpolated, moving = elapsed", () => {
    const live = feed(fresh(), straight(T0, 340, 3));
    // Live pace near the end: 3 m/s = 5:33 /km (null once finished: there is no "now" pace to show).
    const pace = currentPace(live, T0 + 340_000);
    expect(pace).not.toBeNull();
    expect(pace!).toBeGreaterThan(320);
    expect(pace!).toBeLessThan(345);
    const s = finishTrack(live, T0 + 340_000);
    expect(currentPace(s, T0 + 340_000)).toBeNull();
    const totals = trackTotals(s);
    expect(totals.distance_m).toBeGreaterThan(1020 * 0.99);
    expect(totals.distance_m).toBeLessThan(1020 * 1.01);
    expect(totals.elapsed_s).toBe(340);
    expect(totals.moving_s).toBe(340);
    expect(s.splits).toHaveLength(1);
    const km = s.splits[0]!;
    expect(km.distance_m).toBe(1000);
    // 1,000 m at 3 m/s is 333 s; the first fix is at m = 0 so the crossing is interpolated between fixes.
    expect(km.moving_s).toBeGreaterThanOrEqual(330);
    expect(km.moving_s).toBeLessThanOrEqual(338);
    expect(km.elapsed_s).toBe(km.moving_s);
    expect(km.split_s).toBe(km.moving_s);
  });

  it("mile splits use 1609.344 m and each split_s is that mile's own moving time", () => {
    const s = feed(fresh("run", "mi"), straight(T0, 1100, 3));
    expect(s.splits.map((x) => x.distance_m)).toEqual([1609, 3219]);
    expect(s.splits[1]!.split_s).toBe(s.splits[1]!.moving_s - s.splits[0]!.moving_s);
    expect(Math.abs(s.splits[0]!.moving_s - METERS_PER_MILE / 3)).toBeLessThan(6);
  });

  it("totals and the server's speed check agree: distance / moving never exceeds the kind's cap", () => {
    const s = finishTrack(feed(fresh("run"), straight(T0, 120, 9.5)), T0 + 120_000);
    const t = trackTotals(s);
    expect(t.distance_m / t.moving_s).toBeLessThanOrEqual(MAX_SPEED_MS.run * 1.1);
  });
});

describe("standing still", () => {
  it("5 minutes of 3–6 m wobble at a traffic light adds under 10 m and is reported as standing still, not as ignored", () => {
    let s = feed(fresh("walk"), straight(T0, 60, 1.4));
    const before = s.distanceM;
    const at = 60 * 1.4;
    for (let i = 1; i <= 300; i++) {
      const wobble = 4 * Math.sin(i * 0.7) + 2 * Math.cos(i * 1.9);
      s = tick(addFix(s, { lat: LAT0 + (at + wobble) / M_PER_DEG_LAT, lng: LNG0 + (3 * Math.sin(i * 0.3)) / (M_PER_DEG_LAT * Math.cos((LAT0 * Math.PI) / 180)), accuracy: 6, t: T0 + (60 + i) * 1000 }).state, T0 + (60 + i) * 1000);
    }
    expect(s.distanceM - before).toBeLessThan(10);
    expect(s.signalLost).toBe(false);
    const d = gpsDiagnostics(s, T0 + 360_000);
    // Wobble keeps the smoothed speed hovering around the 0.55 m/s threshold: the fixes split between "standing
    // still" and accepted-but-too-short-to-measure (< 6 m chord). Neither adds distance; none is a gap.
    expect(d.ignored.standingStill).toBeGreaterThan(50);
    expect(d.ignored.outliers).toBe(0);
    expect(d.gaps).toBe(0);
    expect(d.received).toBe(361);
  });
});

describe("tunnel", () => {
  it("40 s without fixes: signal lost after 15 s, nothing counted across, the straight-line gap reported, time keeps running", () => {
    let s = feed(fresh(), straight(T0, 100, 3));
    const before = s.distanceM;
    // No fixes for 40 s while the runner covers 120 m; the clock keeps ticking.
    for (let t = T0 + 101_000; t <= T0 + 140_000; t += 1000) s = tick(s, t);
    expect(s.signalLost).toBe(true);
    expect(s.breakReason).toBe("signal");
    expect(s.gaps).toBe(1);
    const lines = s.lines.length;
    s = feed(s, straight(T0 + 141_000, 100, 3, 423));
    expect(s.lines.length).toBe(lines + 1);
    expect(s.signalLost).toBe(false);
    // Only the 300 m after the tunnel were added (within a chord of error), never the 120 m inside it.
    expect(s.distanceM - before).toBeGreaterThan(280);
    expect(s.distanceM - before).toBeLessThan(312);
    const d = gpsDiagnostics(s, T0 + 241_000);
    expect(d.uncountedGapM).toBeGreaterThan(110);
    expect(d.uncountedGapM).toBeLessThan(135);
    const totals = trackTotals(finishTrack(s, T0 + 241_000));
    expect(totals.elapsed_s).toBe(241);
    expect(totals.moving_s).toBe(241);
  });

  it("SIGNAL_LOST_MS is the only gap threshold: 14 s between fixes is not a gap", () => {
    let s = feed(fresh(), straight(T0, 30, 3));
    for (let t = T0 + 31_000; t < T0 + 30_000 + SIGNAL_LOST_MS; t += 1000) s = tick(s, t);
    expect(s.signalLost).toBe(false);
    s = tick(s, T0 + 30_000 + SIGNAL_LOST_MS + 1);
    expect(s.signalLost).toBe(true);
  });
});

describe("accuracy spikes", () => {
  it("fixes worse than 25 m are ignored as inaccurate and do not move the distance", () => {
    let s = feed(fresh(), straight(T0, 60, 3));
    const before = s.distanceM;
    for (let i = 1; i <= 10; i++) s = addFix(s, north(180 + i * 40, T0 + (60 + i) * 1000, 26 + i * 50)).state;
    expect(s.distanceM).toBe(before);
    expect(s.rejected.inaccurate).toBe(10);
    expect(s.lastAccuracy).toBe(526);
  });

  it("a 60 m jump that still reports a fair accuracy is rejected as an outlier, and the track continues when honest fixes return", () => {
    let s = feed(fresh(), straight(T0, 60, 3));
    const before = s.distanceM;
    const spike = addFix(s, { lat: LAT0 + 183 / M_PER_DEG_LAT, lng: LNG0 + 60 / (M_PER_DEG_LAT * Math.cos((LAT0 * Math.PI) / 180)), accuracy: 12, t: T0 + 61_000 });
    expect(spike.accepted).toBe(false);
    expect(spike.reason).toBe("jump");
    s = feed(spike.state, straight(T0 + 62_000, 30, 3, 186));
    expect(s.lines).toHaveLength(1);
    expect(s.distanceM - before).toBeGreaterThan(80);
    expect(s.distanceM - before).toBeLessThan(100);
  });

  it("a run of agreeing 'outliers' means the track was wrong: the filter restarts there without counting the jump", () => {
    let s = feed(fresh(), straight(T0, 30, 3));
    const before = s.distanceM;
    // The member is really 200 m further on than the track thinks (e.g. a biased first fix): three agreeing fixes.
    s = feed(s, straight(T0 + 31_000, 2, 3, 290));
    expect(s.lines).toHaveLength(2);
    expect(s.distanceM).toBe(before);
    expect(s.stats?.restarts).toBe(1);
  });

  it("NaN, negative accuracy and impossible coordinates are inaccurate, never crashes", () => {
    const s = fresh();
    expect(addFix(s, { lat: NaN, lng: LNG0, accuracy: 5, t: T0 + 1000 }).reason).toBe("inaccurate");
    expect(addFix(s, { lat: LAT0, lng: LNG0, accuracy: -1, t: T0 + 1000 }).reason).toBe("inaccurate");
    expect(addFix(s, { lat: LAT0, lng: LNG0, accuracy: NaN, t: T0 + 1000 }).reason).toBe("inaccurate");
  });
});

describe("timestamps", () => {
  it("a duplicate timestamp with a different position is ignored (late or repeated), distance unchanged", () => {
    let s = feed(fresh(), straight(T0, 60, 3));
    const before = s.distanceM;
    const dup = addFix(s, north(190, T0 + 60_000));
    expect(dup.accepted).toBe(false);
    expect(dup.reason).toBe("out_of_order");
    s = dup.state;
    expect(s.distanceM).toBe(before);
    expect(s.rejected.out_of_order).toBe(1);
    // The stream continues normally afterwards.
    s = feed(s, straight(T0 + 61_000, 10, 3, 183));
    expect(s.distanceM).toBeGreaterThan(before + 20);
  });

  it("an older fix delivered late is ignored, and a cached fix from before Start is stale", () => {
    let s = feed(fresh(), straight(T0, 60, 3));
    expect(addFix(s, north(150, T0 + 50_000)).reason).toBe("out_of_order");
    expect(addFix(s, north(0, T0 - 5000)).reason).toBe("stale");
    s = addFix(s, north(0, T0 - 5000)).state;
    expect(gpsDiagnostics(s, T0 + 60_000).ignored.outOfOrder).toBe(1);
  });

  it("a recording across the US autumn clock change keeps true elapsed seconds (epoch time, not wall-clock)", () => {
    // 05:30Z → 06:30Z on 2026-11-01: New York goes from 01:30 EDT back to 01:30 EST in the middle of the run.
    const s = finishTrack(feed(fresh(), straight(T0, 3600, 2.9)), T0 + 3600_000);
    const t = trackTotals(s);
    expect(t.elapsed_s).toBe(3600);
    expect(t.moving_s).toBe(3600);
    expect(s.splits.at(-1)!.elapsed_s).toBeLessThanOrEqual(3600);
    // Saved started_at is the UTC instant; the member's local day is the 1st in New York and in Tokyo alike.
    const iso = new Date(s.startedAt).toISOString();
    expect(iso).toBe("2026-11-01T05:30:00.000Z");
    expect(activityDay(iso, "America/New_York")).toBe("2026-11-01");
    expect(activityDay(iso, "Asia/Tokyo")).toBe("2026-11-01");
    // A run starting at 23:30 local in Los Angeles lands on the previous UTC date but is still the member's day.
    expect(activityDay("2026-11-02T07:30:00.000Z", "America/Los_Angeles")).toBe("2026-11-01");
  });

  it("manual entries on the repeated and the skipped hour resolve to one instant and round-trip", () => {
    // 01:30 on 2026-11-01 happens twice in New York: the earlier (EDT, 05:30Z) instant is used.
    expect(localToUtcIso("2026-11-01", "01:30", "America/New_York")).toBe("2026-11-01T05:30:00.000Z");
    // 02:30 on 2026-03-08 does not exist in New York: the result is a real instant within the hour.
    const skipped = localToUtcIso("2026-03-08", "02:30", "America/New_York");
    expect(skipped).not.toBeNull();
    const ms = Date.parse(skipped!);
    expect(ms).toBeGreaterThanOrEqual(Date.UTC(2026, 2, 8, 6, 30));
    expect(ms).toBeLessThanOrEqual(Date.UTC(2026, 2, 8, 7, 30));
    // Ordinary times round-trip through the detail page's prefill.
    const normal = localToUtcIso("2026-11-07", "06:15", "Europe/London")!;
    expect(utcToLocalParts(normal, "Europe/London")).toEqual({ date: "2026-11-07", time: "06:15" });
    expect(localToUtcIso("2026-11-07", "06:15", "Not/AZone")).toBeNull();
  });
});

describe("pause and resume", () => {
  it("excludes the pause from moving time, rejects fixes while paused, breaks the route and counts nothing across it", () => {
    let s = feed(fresh(), straight(T0, 60, 3));
    const before = s.distanceM;
    s = pauseTrack(s, T0 + 60_000);
    expect(s.status).toBe("paused");
    const during = addFix(s, north(200, T0 + 90_000));
    expect(during.reason).toBe("paused");
    s = during.state;
    // Walked 300 m to a café during a 5-minute pause.
    s = resumeTrack(s, T0 + 360_000);
    expect(s.status).toBe("recording");
    s = feed(s, straight(T0 + 361_000, 60, 3, 480));
    expect(s.lines).toHaveLength(2);
    expect(s.distanceM - before).toBeGreaterThan(165);
    expect(s.distanceM - before).toBeLessThan(190);
    const t = trackTotals(finishTrack(s, T0 + 421_000));
    expect(t.elapsed_s).toBe(421);
    expect(t.moving_s).toBe(121);
    expect(gpsDiagnostics(s, T0 + 421_000).ignored.whilePaused).toBe(1);
  });

  it("pausing before the first fix and resuming goes back to waiting for a fix; pause/resume are idempotent", () => {
    let s = fresh();
    s = pauseTrack(s, T0 + 5000);
    expect(s.status).toBe("paused");
    expect(pauseTrack(s, T0 + 6000)).toBe(s);
    s = resumeTrack(s, T0 + 20_000);
    expect(s.status).toBe("acquiring");
    expect(resumeTrack(s, T0 + 21_000)).toBe(s);
    s = feed(s, straight(T0 + 21_000, 30, 3));
    expect(s.status).toBe("recording");
    expect(trackTotals(finishTrack(s, T0 + 51_000)).moving_s).toBe(36);
  });

  it("a double finish or a fix after finish changes nothing", () => {
    const s = finishTrack(feed(fresh(), straight(T0, 30, 3)), T0 + 30_000);
    expect(finishTrack(s, T0 + 99_000)).toBe(s);
    const after = addFix(s, north(500, T0 + 40_000));
    expect(after.accepted).toBe(false);
    expect(after.state).toBe(s);
  });
});

describe("recovery after a reload or crash", () => {
  it("offers back a recording for 12 hours, continues it with the time away as a gap, and never counts the missing stretch", () => {
    let s = feed(fresh(), straight(T0, 60, 3));
    const before = s.distanceM;
    const raw = JSON.parse(JSON.stringify(s)) as unknown;
    expect(isRecoverable(raw, T0 + RECOVERABLE_MS - 1)).toBe(true);
    expect(isRecoverable(raw, T0 + RECOVERABLE_MS)).toBe(false);
    expect(isResumable(raw, T0 + 3600_000)).toBe(true);
    expect(isResumable(JSON.parse(JSON.stringify(finishTrack(s, T0 + 61_000))), T0 + 3600_000)).toBe(false);
    expect(isRecoverable({ version: 3, startedAt: T0 }, T0)).toBe(false);
    expect(isRecoverable(null, T0)).toBe(false);
    s = recoverTrack(raw as TrackState);
    expect(s.signalLost).toBe(true);
    expect(s.breakReason).toBe("recovery");
    expect(s.gaps).toBe(1);
    // 10 minutes later, 1 km further on.
    s = feed(s, straight(T0 + 660_000, 60, 3, 1180));
    expect(s.lines).toHaveLength(2);
    expect(s.distanceM - before).toBeLessThan(190);
    const t = trackTotals(finishTrack(s, T0 + 720_000));
    // Documented behaviour: time away counts as moving time unless the recording was paused.
    expect(t.moving_s).toBe(720);
  });

  it("a version-1 draft (no filter, no stats) is upgraded and keeps recording", () => {
    const v1 = { ...feed(fresh(), straight(T0, 30, 3)), version: 1 as const };
    delete (v1 as Partial<TrackState>).filter;
    delete (v1 as Partial<TrackState>).stats;
    delete (v1.rejected as Partial<TrackState["rejected"]>).stale;
    let s = recoverTrack(v1);
    expect(s.version).toBe(2);
    expect(s.stats).toBeDefined();
    s = feed(s, straight(T0 + 60_000, 30, 3, 180));
    expect(s.lines).toHaveLength(2);
    expect(s.distanceM).toBeGreaterThan(v1.distanceM + 70);
  });

  it("a paused or finished draft is recovered as it was (no gap added)", () => {
    const paused = pauseTrack(feed(fresh(), straight(T0, 30, 3)), T0 + 30_000);
    expect(recoverTrack(paused)).toBe(paused);
    const done = finishTrack(feed(fresh(), straight(T0, 30, 3)), T0 + 30_000);
    expect(recoverTrack(done)).toBe(done);
  });
});

describe("the saved route", () => {
  it("stores [lng, lat] with 5 decimals, one line per stretch, and its length never exceeds the server's 20% + 100 m check", () => {
    let s = feed(fresh(), straight(T0, 300, 3));
    s = pauseTrack(s, T0 + 300_000);
    s = resumeTrack(s, T0 + 400_000);
    s = feed(s, straight(T0 + 401_000, 300, 3, 1200));
    s = finishTrack(s, T0 + 701_000);
    const route = routeForSave(s)!;
    expect(route.type).toBe("MultiLineString");
    expect(route.coordinates).toHaveLength(2);
    for (const line of route.coordinates) for (const [lng, lat] of line) {
      expect(lng).toBeCloseTo(LNG0, 4);
      expect(lat).toBeGreaterThanOrEqual(LAT0);
      expect(String(lng).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(5);
      expect(String(lat).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(5);
    }
    let length = 0;
    for (const line of route.coordinates) for (let i = 1; i < line.length; i++) length += haversine({ lng: line[i - 1]![0], lat: line[i - 1]![1] }, { lng: line[i]![0], lat: line[i]![1] });
    const totals = trackTotals(s);
    expect(length).toBeLessThanOrEqual(totals.distance_m * 1.2 + 100);
    expect(length).toBeGreaterThan(totals.distance_m * 0.95);
  });

  it("a track with no measured stretch has no route (nothing to draw, nothing to store)", () => {
    expect(routeForSave(fresh())).toBeNull();
    expect(routeForSave(feed(fresh(), [north(0, T0 + 1000)]))).toBeNull();
  });
});

describe("pace maths", () => {
  it("paceSecondsPer and formatPace: carries 60 s, null for zero distance or time", () => {
    expect(paceSecondsPer(1000, 300, "km")).toBe(300);
    expect(formatPace(299.6, "km")).toBe("5:00 /km");
    expect(formatPace(359.5, "mi")).toBe("6:00 /mi");
    expect(paceSecondsPer(0, 300, "km")).toBeNull();
    expect(paceSecondsPer(1000, 0, "km")).toBeNull();
    expect(paceSecondsPer(null, 300, "km")).toBeNull();
    expect(formatPace(null, "km")).toBe("—");
    // 5 km in 25:00 is 8:03 /mi.
    expect(formatPace(paceSecondsPer(5000, 1500, "mi"), "mi")).toBe("8:03 /mi");
  });

  it("a walk that breaks into a run beyond 4 m/s is held at the walking cap (documented: pick 'run' for a jog)", () => {
    let s = feed(fresh("walk"), straight(T0, 60, 1.4));
    const before = s.distanceM;
    s = feed(s, straight(T0 + 61_000, 30, 4.5, 84 + 4.5));
    // 135 m were really covered; only the ramp while the smoothed speed climbs past the cap is counted.
    expect(s.distanceM - before).toBeLessThan(60);
    expect(s.rejected.jump).toBeGreaterThan(15);
  });
});
