import { describe, expect, it } from "vitest";
import {
  dailyActivity,
  distanceUnitFor,
  formatDistance,
  formatHms,
  formatMovingPace,
  formatPace,
  isEligibleForDistance,
  kmToMiles,
  localToUtcIso,
  METERS_PER_MILE,
  metersToMiles,
  milesToKm,
  milesToMeters,
  movingSeconds,
  movingSecondsFromSegments,
  paceSecondsPer,
  parseDuration,
  personalBests,
  toMeters,
  totalsForWeek,
  utcToLocalParts,
  weeklyTotals,
  type ActivityLike,
} from "@/lib/domain/activities";

let n = 0;
function act(p: Partial<ActivityLike>): ActivityLike {
  n += 1;
  return {
    id: p.id ?? `a${n}`,
    kind: "run",
    source: "manual",
    started_at: "2026-10-20T12:00:00Z",
    distance_m: 5000,
    elapsed_s: 1800,
    moving_s: 1800,
    deleted_at: null,
    ...p,
  };
}

describe("unit conversion", () => {
  it("converts miles and kilometres exactly", () => {
    expect(milesToMeters(1)).toBe(1609.344);
    expect(metersToMiles(1609.344)).toBe(1);
    expect(milesToKm(26.2)).toBeCloseTo(42.165, 3);
    expect(kmToMiles(5)).toBeCloseTo(3.10686, 5);
    expect(toMeters(3.1, "mi")).toBe(4988.97);
    expect(toMeters(5, "km")).toBe(5000);
  });
  it("picks the display unit from the profile and formats distances", () => {
    expect(distanceUnitFor("imperial")).toBe("mi");
    expect(distanceUnitFor("metric")).toBe("km");
    expect(formatDistance(5000, "km")).toBe("5.00 km");
    expect(formatDistance(5000, "mi")).toBe("3.11 mi");
    expect(formatDistance(null, "mi")).toBe("—");
  });
});

describe("durations", () => {
  it("parses h:mm:ss, mm:ss and plain minutes", () => {
    expect(parseDuration("1:02:03")).toBe(3723);
    expect(parseDuration("31:45")).toBe(1905);
    expect(parseDuration("45")).toBe(2700);
    expect(parseDuration("0:00:30")).toBe(30);
    expect(parseDuration(" 0:31:45 ")).toBe(1905);
  });
  it("rejects malformed durations", () => {
    for (const bad of ["", "abc", "1:60", "1:2:3:4", "-5", "1:-1", "1::2", "0:75:00"]) expect(parseDuration(bad)).toBeNull();
  });
  it("formats h:mm:ss for form fields", () => {
    expect(formatHms(3723)).toBe("1:02:03");
    expect(formatHms(59)).toBe("0:00:59");
  });
});

describe("pace", () => {
  it("computes seconds per unit and formats min:ss", () => {
    expect(paceSecondsPer(5000, 1500, "km")).toBe(300);
    expect(formatPace(300, "km")).toBe("5:00 /km");
    // 5 km in 25:00 is 8:03 per mile.
    expect(formatPace(paceSecondsPer(5000, 1500, "mi"), "mi")).toBe("8:03 /mi");
    expect(formatPace(paceSecondsPer(METERS_PER_MILE, 600, "mi"), "mi")).toBe("10:00 /mi");
  });
  it("carries a rounded 60 seconds into the next minute", () => {
    expect(formatPace(359.6, "km")).toBe("6:00 /km");
  });
  it("has no pace without distance or time", () => {
    expect(paceSecondsPer(null, 1200, "mi")).toBeNull();
    expect(paceSecondsPer(0, 1200, "mi")).toBeNull();
    expect(paceSecondsPer(5000, 0, "mi")).toBeNull();
    expect(formatPace(null, "mi")).toBe("—");
  });
  it("uses moving time, so paused time doesn't slow the average", () => {
    const a = { distance_m: 5000, moving_s: 1500, elapsed_s: 1800 };
    expect(formatMovingPace(a, "km")).toBe("5:00 /km");
  });
});

describe("moving time", () => {
  it("subtracts paused time and clamps", () => {
    expect(movingSeconds(1800, 300)).toBe(1500);
    expect(movingSeconds(1800, -10)).toBe(1800);
    expect(movingSeconds(100, 500)).toBe(0);
  });
  it("sums recorded segments, ignoring the pauses between them", () => {
    const t0 = Date.parse("2026-10-20T07:00:00Z");
    const segs = [
      { start: t0, end: t0 + 10 * 60_000 }, // 10 min
      // 5 min pause
      { start: t0 + 15 * 60_000, end: t0 + 30 * 60_000 }, // 15 min
    ];
    expect(movingSecondsFromSegments(segs)).toBe(25 * 60);
  });
  it("counts overlapping segments once and ignores inverted ones", () => {
    const segs = [
      { start: 0, end: 60_000 },
      { start: 30_000, end: 90_000 },
      { start: 200_000, end: 100_000 },
    ];
    expect(movingSecondsFromSegments(segs)).toBe(90);
    expect(movingSecondsFromSegments([])).toBe(0);
  });
});

describe("weekly totals", () => {
  it("separates runs and walks and ignores deleted activities", () => {
    const list = [
      act({ kind: "run", distance_m: 5000, started_at: "2026-10-20T12:00:00Z" }),
      act({ kind: "run", distance_m: 3000, started_at: "2026-10-21T12:00:00Z", moving_s: 900 }),
      act({ kind: "walk", distance_m: 2000, started_at: "2026-10-22T12:00:00Z" }),
      act({ kind: "walk", distance_m: null, started_at: "2026-10-22T13:00:00Z" }),
      act({ kind: "run", distance_m: 10000, started_at: "2026-10-22T14:00:00Z", deleted_at: "2026-10-23T00:00:00Z" }),
    ];
    const [w] = weeklyTotals(list, "UTC");
    expect(w).toEqual({
      weekStart: "2026-10-19",
      run: { count: 2, distanceM: 8000, movingS: 2700 },
      walk: { count: 2, distanceM: 2000, movingS: 3600 },
    });
  });

  it("buckets by the user's time zone, not UTC", () => {
    // Sunday 2026-10-25 at 23:30 in Los Angeles is Monday 06:30 UTC.
    const late = act({ started_at: "2026-10-26T06:30:00Z" });
    expect(weeklyTotals([late], "UTC")[0]!.weekStart).toBe("2026-10-26");
    expect(weeklyTotals([late], "America/Los_Angeles")[0]!.weekStart).toBe("2026-10-19");
    // Monday 00:30 in Auckland is still Sunday in UTC.
    const early = act({ started_at: "2026-10-25T11:30:00Z" });
    expect(weeklyTotals([early], "Pacific/Auckland")[0]!.weekStart).toBe("2026-10-26");
    expect(weeklyTotals([early], "UTC")[0]!.weekStart).toBe("2026-10-19");
  });

  it("orders weeks newest first and returns zeros for an empty week", () => {
    const list = [act({ started_at: "2026-10-05T12:00:00Z" }), act({ started_at: "2026-10-20T12:00:00Z" })];
    expect(weeklyTotals(list, "UTC").map((w) => w.weekStart)).toEqual(["2026-10-19", "2026-10-05"]);
    expect(totalsForWeek(list, "UTC", "2026-10-12")).toEqual({
      weekStart: "2026-10-12",
      run: { count: 0, distanceM: 0, movingS: 0 },
      walk: { count: 0, distanceM: 0, movingS: 0 },
    });
  });

  it("recalculates when an activity is edited or deleted", () => {
    const a = act({ distance_m: 5000 });
    expect(totalsForWeek([a], "UTC", "2026-10-19").run.distanceM).toBe(5000);
    expect(totalsForWeek([{ ...a, distance_m: 8000 }], "UTC", "2026-10-19").run.distanceM).toBe(8000);
    expect(totalsForWeek([{ ...a, deleted_at: "2026-10-21T00:00:00Z" }], "UTC", "2026-10-19").run.count).toBe(0);
  });

  it("gives per-day run and walk counts and distances", () => {
    const list = [act({ kind: "run", distance_m: 5000 }), act({ kind: "walk", distance_m: 1500 }), act({ kind: "walk", distance_m: 500 })];
    expect(dailyActivity(list, "UTC", ["2026-10-19", "2026-10-20"])).toEqual([
      { day: "2026-10-19", runs: { count: 0, distanceM: 0 }, walks: { count: 0, distanceM: 0 } },
      { day: "2026-10-20", runs: { count: 1, distanceM: 5000 }, walks: { count: 2, distanceM: 2000 } },
    ]);
  });
});

describe("personal bests", () => {
  it("only counts runs covering the distance (up to 3% over), never walks or deleted runs", () => {
    expect(isEligibleForDistance(act({ distance_m: 5000 }), 5000)).toBe(true);
    expect(isEligibleForDistance(act({ distance_m: 5150 }), 5000)).toBe(true);
    expect(isEligibleForDistance(act({ distance_m: 5151 }), 5000)).toBe(false);
    expect(isEligibleForDistance(act({ distance_m: 4999 }), 5000)).toBe(false);
    expect(isEligibleForDistance(act({ kind: "walk" }), 5000)).toBe(false);
    expect(isEligibleForDistance(act({ distance_m: null }), 5000)).toBe(false);
    expect(isEligibleForDistance(act({ deleted_at: "2026-10-21T00:00:00Z" }), 5000)).toBe(false);
  });

  it("picks the fastest moving time and flags self-reported sources", () => {
    const list = [
      act({ id: "slow-gps", source: "gps", moving_s: 1700 }),
      act({ id: "fast-manual", source: "manual", moving_s: 1500 }),
      act({ id: "tread", source: "treadmill", moving_s: 1600 }),
      act({ id: "mile", source: "gps", distance_m: 1610, moving_s: 420 }),
    ];
    const [mile, fiveK, tenK] = personalBests(list);
    expect(fiveK!.best).toMatchObject({ activityId: "fast-manual", movingS: 1500, source: "manual", selfReported: true });
    expect(fiveK!.bestGps).toMatchObject({ activityId: "slow-gps", selfReported: false });
    expect(mile!.best).toMatchObject({ activityId: "mile", selfReported: false });
    expect(tenK!.best).toBeNull();
    expect(tenK!.bestGps).toBeNull();
  });

  it("keeps the earlier activity on a tie and recalculates after a delete", () => {
    const first = act({ id: "first", moving_s: 1500, started_at: "2026-10-01T12:00:00Z" });
    const second = act({ id: "second", moving_s: 1500, started_at: "2026-10-10T12:00:00Z" });
    expect(personalBests([second, first])[1]!.best!.activityId).toBe("first");
    expect(personalBests([{ ...first, deleted_at: "2026-10-11T00:00:00Z" }, second])[1]!.best!.activityId).toBe("second");
  });
});

describe("local time ↔ UTC", () => {
  it("converts a wall-clock time in the user's zone", () => {
    expect(localToUtcIso("2026-10-20", "06:30", "UTC")).toBe("2026-10-20T06:30:00.000Z");
    expect(localToUtcIso("2026-10-20", "06:30", "America/New_York")).toBe("2026-10-20T10:30:00.000Z");
    expect(localToUtcIso("2026-01-20", "06:30", "America/New_York")).toBe("2026-01-20T11:30:00.000Z");
    expect(localToUtcIso("2026-10-20", "06:30", "Asia/Kolkata")).toBe("2026-10-20T01:00:00.000Z");
  });
  it("uses the earlier instant for a repeated hour (DST end)", () => {
    // 2026-11-01 01:30 happens twice in New York; the first is EDT (UTC-4).
    expect(localToUtcIso("2026-11-01", "01:30", "America/New_York")).toBe("2026-11-01T05:30:00.000Z");
  });
  it("rejects malformed dates, times and zones", () => {
    expect(localToUtcIso("2026-02-30", "06:30", "UTC")).toBeNull();
    expect(localToUtcIso("2026-10-20", "25:00", "UTC")).toBeNull();
    expect(localToUtcIso("20-10-2026", "06:30", "UTC")).toBeNull();
    expect(localToUtcIso("2026-10-20", "06:30", "Not/AZone")).toBeNull();
  });
  it("round-trips through utcToLocalParts", () => {
    const iso = localToUtcIso("2026-10-20", "23:45", "America/Los_Angeles")!;
    expect(utcToLocalParts(iso, "America/Los_Angeles")).toEqual({ date: "2026-10-20", time: "23:45" });
  });
});
