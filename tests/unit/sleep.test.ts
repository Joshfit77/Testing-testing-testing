import {
  circularMedianMinutes,
  defaultManualNight,
  circularSpreadMinutes,
  clockMinutesInTz,
  findOverlap,
  formatClock,
  formatDuration,
  isoToLocalInput,
  nightOf,
  overlaps,
  sleepDurations,
  summarizeNights,
  tzOffsetMinutes,
  validateSleepSession,
  zonedTimeToIso,
  type SleepSession,
} from "@/lib/domain/sleep";

const NOW = Date.parse("2026-11-05T12:00:00Z");
const night = (over: Partial<SleepSession> = {}): SleepSession => ({
  id: over.id ?? crypto.randomUUID(),
  kind: "night",
  source: "manual",
  startedAt: "2026-10-22T22:30:00Z",
  endedAt: "2026-10-23T05:45:00Z",
  timezone: "Europe/London",
  nightOf: "2026-10-23",
  ...over,
});

describe("durations across daylight-saving changes", () => {
  it("counts the extra hour when clocks go back (New York, 1 November 2026)", () => {
    // 11:00 PM EDT on 31 Oct is 03:00Z; 7:00 AM EST on 1 Nov is 12:00Z: nine hours in bed, not eight.
    const d = sleepDurations({ kind: "night", timezone: "America/New_York", startedAt: "2026-11-01T03:00:00Z", endedAt: "2026-11-01T12:00:00Z" });
    expect(d.inBedMinutes).toBe(540);
    expect(d.asleepMinutes).toBe(540);
    expect(d.asleepEstimated).toBe(true);
    expect(d.efficiencyPct).toBeNull();
  });
  it("loses the hour when clocks go forward (New York, 8 March 2026)", () => {
    const d = sleepDurations({ kind: "night", timezone: "America/New_York", startedAt: "2026-03-08T04:00:00Z", endedAt: "2026-03-08T11:00:00Z" });
    expect(d.inBedMinutes).toBe(420);
  });
  it("uses onset, final wake and awake minutes when given", () => {
    const d = sleepDurations({
      kind: "night",
      timezone: "UTC",
      startedAt: "2026-10-22T22:00:00Z",
      onsetAt: "2026-10-22T22:20:00Z",
      finalWakeAt: "2026-10-23T05:50:00Z",
      endedAt: "2026-10-23T06:00:00Z",
      awakeMinutes: 15,
    });
    expect(d.inBedMinutes).toBe(480);
    expect(d.asleepMinutes).toBe(435);
    expect(d.latencyMinutes).toBe(20);
    expect(d.efficiencyPct).toBe(91);
    expect(d.asleepEstimated).toBe(false);
  });
  it("has no figures while the timer is still running", () => {
    expect(sleepDurations({ kind: "night", timezone: "UTC", startedAt: "2026-10-22T22:00:00Z", endedAt: null }).inBedMinutes).toBeNull();
  });
});

describe("which night a session belongs to", () => {
  it("is the local date the member got up, across midnight", () => {
    expect(nightOf({ startedAt: "2026-10-22T22:30:00Z", endedAt: "2026-10-23T05:45:00Z", timezone: "Europe/London" })).toBe("2026-10-23");
  });
  it("follows the time zone the session was logged in when travelling", () => {
    // 6:00 AM in Tokyo on 23 Oct is still 22 Oct in UTC.
    expect(nightOf({ startedAt: "2026-10-22T13:00:00Z", endedAt: "2026-10-22T21:00:00Z", timezone: "Asia/Tokyo" })).toBe("2026-10-23");
    expect(nightOf({ startedAt: "2026-10-22T13:00:00Z", endedAt: "2026-10-22T21:00:00Z", timezone: "UTC" })).toBe("2026-10-22");
  });
  it("lists a running timer under the morning after bedtime", () => {
    expect(nightOf({ startedAt: "2026-10-22T22:30:00Z", endedAt: null, timezone: "UTC" })).toBe("2026-10-23");
  });
});

describe("validation", () => {
  const base = { kind: "night" as const, timezone: "UTC", startedAt: "2026-11-04T22:00:00Z", endedAt: "2026-11-05T06:00:00Z" };
  it("accepts an ordinary night", () => {
    expect(validateSleepSession(base, NOW)).toEqual({ ok: true });
  });
  it("rejects getting up before bedtime, too-long sessions and future times", () => {
    expect(validateSleepSession({ ...base, endedAt: "2026-11-04T21:00:00Z" }, NOW).ok).toBe(false);
    expect(validateSleepSession({ ...base, endedAt: "2026-11-05T23:00:00Z" }, NOW).ok).toBe(false);
    expect(validateSleepSession({ ...base, kind: "nap", endedAt: "2026-11-05T05:00:00Z" }, NOW).ok).toBe(false);
    expect(validateSleepSession({ ...base, startedAt: "2026-11-05T13:00:00Z", endedAt: "2026-11-05T14:00:00Z" }, NOW).ok).toBe(false);
  });
  it("rejects onset, final wake and awake minutes outside the night", () => {
    expect(validateSleepSession({ ...base, onsetAt: "2026-11-04T21:30:00Z" }, NOW).ok).toBe(false);
    expect(validateSleepSession({ ...base, onsetAt: "2026-11-04T22:30:00Z", finalWakeAt: "2026-11-04T22:00:00Z" }, NOW).ok).toBe(false);
    expect(validateSleepSession({ ...base, awakeMinutes: 600 }, NOW).ok).toBe(false);
    expect(validateSleepSession({ ...base, awakenings: 99 }, NOW).ok).toBe(false);
    expect(validateSleepSession({ ...base, onsetAt: "2026-11-04T22:30:00Z", finalWakeAt: "2026-11-05T05:50:00Z", awakeMinutes: 20, awakenings: 2 }, NOW)).toEqual({ ok: true });
  });
  it("rejects unknown time zones and sessions older than three years", () => {
    expect(validateSleepSession({ ...base, timezone: "Mars/Olympus" }, NOW).ok).toBe(false);
    expect(validateSleepSession({ ...base, startedAt: "2022-11-04T22:00:00Z", endedAt: "2022-11-05T06:00:00Z" }, NOW).ok).toBe(false);
  });
  it("allows a running timer (no end yet)", () => {
    expect(validateSleepSession({ ...base, endedAt: null }, NOW)).toEqual({ ok: true });
  });
});

describe("overlaps", () => {
  const a = { startedAt: "2026-10-22T22:00:00Z", endedAt: "2026-10-23T06:00:00Z" };
  it("detects overlapping and allows back-to-back sessions", () => {
    expect(overlaps(a, { startedAt: "2026-10-23T05:30:00Z", endedAt: "2026-10-23T07:00:00Z" })).toBe(true);
    expect(overlaps(a, { startedAt: "2026-10-23T06:00:00Z", endedAt: "2026-10-23T07:00:00Z" })).toBe(false);
    expect(overlaps(a, { startedAt: "2026-10-22T20:00:00Z", endedAt: "2026-10-22T22:00:00Z" })).toBe(false);
  });
  it("treats a running timer as 20 hours long", () => {
    expect(overlaps({ startedAt: "2026-10-22T22:00:00Z", endedAt: null }, { startedAt: "2026-10-23T15:00:00Z", endedAt: "2026-10-23T16:00:00Z" })).toBe(true);
    expect(overlaps({ startedAt: "2026-10-22T22:00:00Z", endedAt: null }, { startedAt: "2026-10-23T19:00:00Z", endedAt: "2026-10-23T20:00:00Z" })).toBe(false);
  });
  it("finds the clashing session, ignoring the one being edited", () => {
    const list = [night({ id: "one" }), night({ id: "two", startedAt: "2026-10-23T22:00:00Z", endedAt: "2026-10-24T06:00:00Z", nightOf: "2026-10-24" })];
    expect(findOverlap(list, a)?.id).toBe("one");
    expect(findOverlap(list, a, "one")).toBeNull();
  });
});

describe("wall-clock times in a zone", () => {
  it("converts a datetime-local value to an instant and back", () => {
    expect(zonedTimeToIso("2026-10-22T22:30", "Europe/London")).toBe("2026-10-22T21:30:00.000Z");
    expect(zonedTimeToIso("2026-10-22T22:30", "America/New_York")).toBe("2026-10-23T02:30:00.000Z");
    expect(zonedTimeToIso("2026-10-22T22:30", "UTC")).toBe("2026-10-22T22:30:00.000Z");
    expect(isoToLocalInput("2026-10-22T21:30:00Z", "Europe/London")).toBe("2026-10-22T22:30");
    expect(isoToLocalInput("2026-10-23T02:30:00Z", "America/New_York")).toBe("2026-10-22T22:30");
  });
  it("takes the earlier instant when clocks go back and rolls forward over a skipped hour", () => {
    // London, 25 Oct 2026: 01:30 happens twice (BST then GMT); the first is 00:30Z.
    expect(zonedTimeToIso("2026-10-25T01:30", "Europe/London")).toBe("2026-10-25T00:30:00.000Z");
    // New York, 8 Mar 2026: 02:30 never happens; it becomes 03:30 EDT = 07:30Z.
    expect(zonedTimeToIso("2026-03-08T02:30", "America/New_York")).toBe("2026-03-08T07:30:00.000Z");
    expect(zonedTimeToIso("2026-13-01T02:30", "America/New_York")).toBeNull();
    expect(zonedTimeToIso("2026-02-30T02:30", "UTC")).toBeNull();
    expect(zonedTimeToIso("2026-02-28T24:30", "UTC")).toBeNull();
    expect(zonedTimeToIso("nonsense", "UTC")).toBeNull();
    expect(zonedTimeToIso("2026-10-22T22:30", "Mars/Olympus")).toBeNull();
  });
  it("knows a zone's offset at an instant", () => {
    expect(tzOffsetMinutes(Date.parse("2026-07-01T12:00:00Z"), "Europe/London")).toBe(60);
    expect(tzOffsetMinutes(Date.parse("2026-01-01T12:00:00Z"), "Europe/London")).toBe(0);
    expect(tzOffsetMinutes(Date.parse("2026-07-01T12:00:00Z"), "Asia/Kolkata")).toBe(330);
  });
});

describe("clock times", () => {
  it("reads local clock minutes in a zone", () => {
    expect(clockMinutesInTz("2026-10-23T05:45:00Z", "Europe/London")).toBe(6 * 60 + 45);
    expect(clockMinutesInTz("2026-10-23T05:45:00Z", "UTC")).toBe(5 * 60 + 45);
    expect(clockMinutesInTz("2026-10-23T00:10:00Z", "UTC")).toBe(10);
  });
  it("finds a typical bedtime even when bedtimes straddle midnight", () => {
    expect(circularMedianMinutes([23 * 60 + 30, 30, 23 * 60 + 45])).toBe(23 * 60 + 45);
    expect(circularMedianMinutes([])).toBeNull();
    expect(circularSpreadMinutes([23 * 60 + 30, 30, 23 * 60 + 45], 23 * 60 + 45)).toBe(20);
  });
  it("formats clock times and durations", () => {
    expect(formatClock(23 * 60 + 45)).toBe("11:45 PM");
    expect(formatClock(0)).toBe("12:00 AM");
    expect(formatClock(12 * 60 + 5)).toBe("12:05 PM");
    expect(formatDuration(465)).toBe("7h 45m");
    expect(formatDuration(480)).toBe("8h");
    expect(formatDuration(25)).toBe("25m");
    expect(formatDuration(null)).toBe("—");
  });
});

describe("nights", () => {
  it("marks a night recorded only when every session was imported, and carries the device's measurements", () => {
    const base = { kind: "night" as const, timezone: "UTC", nightOf: "2026-10-23", onsetAt: null, finalWakeAt: null, awakenings: null, awakeMinutes: null };
    const vitals = { heartRate: { avg: 56, min: 48, max: 72, samples: 400 }, hrv: { avgMs: 41.5, samples: 6, method: "sdnn" as const }, respiratoryRate: null };
    const watch = { ...base, id: "w", source: "apple_health" as const, startedAt: "2026-10-22T22:30:00Z", endedAt: "2026-10-23T06:30:00Z", deviceName: "Apple Watch", vitals };
    const [recorded] = summarizeNights([watch]);
    expect(recorded).toMatchObject({ recorded: true, deviceName: "Apple Watch", vitals });
    const [mixed] = summarizeNights([{ ...watch, endedAt: "2026-10-23T02:00:00Z" }, { ...base, id: "m", source: "manual" as const, startedAt: "2026-10-23T02:10:00Z", endedAt: "2026-10-23T06:30:00Z" }]);
    expect(mixed).toMatchObject({ recorded: false, deviceName: "Apple Watch", vitals });
    const [manual] = summarizeNights([{ ...base, id: "m", source: "manual" as const, startedAt: "2026-10-22T22:30:00Z", endedAt: "2026-10-23T06:30:00Z" }]);
    expect(manual).toMatchObject({ recorded: false, deviceName: null, vitals: null });
  });

  it("adds up a night logged as two sessions and skips naps and running timers", () => {
    const list = [
      night({ id: "a", startedAt: "2026-10-22T22:00:00Z", endedAt: "2026-10-23T02:00:00Z", awakenings: 1 }),
      night({ id: "b", startedAt: "2026-10-23T02:30:00Z", endedAt: "2026-10-23T06:00:00Z" }),
      night({ id: "nap", kind: "nap", startedAt: "2026-10-23T13:00:00Z", endedAt: "2026-10-23T13:30:00Z" }),
      night({ id: "run", startedAt: "2026-10-23T22:00:00Z", endedAt: null, nightOf: "2026-10-24" }),
      night({ id: "c", startedAt: "2026-10-20T22:00:00Z", endedAt: "2026-10-21T06:00:00Z", nightOf: "2026-10-21", source: "apple_health" }),
    ];
    const nights = summarizeNights(list);
    expect(nights.map((n) => n.nightOf)).toEqual(["2026-10-23", "2026-10-21"]);
    const n = nights[0]!;
    expect(n.sessions.map((s) => s.id)).toEqual(["a", "b"]);
    expect(n.bedAt).toBe("2026-10-22T22:00:00Z");
    expect(n.wakeAt).toBe("2026-10-23T06:00:00Z");
    expect(n.inBedMinutes).toBe(450);
    expect(n.asleepMinutes).toBe(450);
    // One recorded awakening plus the gap between the two sessions.
    expect(n.awakenings).toBe(2);
    expect(n.efficiencyPct).toBeNull();
    expect(nights[1]!.sources).toEqual(["apple_health"]);
  });
});

describe("defaultManualNight", () => {
  it("is last night once the morning has passed", () => {
    expect(defaultManualNight(new Date("2026-10-25T09:00:00Z"), "UTC")).toEqual({ startedAt: "2026-10-24T22:30", endedAt: "2026-10-25T06:30" });
  });

  it("is the night before when it isn't 6:30 AM yet, so it's never in the future", () => {
    expect(defaultManualNight(new Date("2026-10-25T00:20:00Z"), "UTC")).toEqual({ startedAt: "2026-10-23T22:30", endedAt: "2026-10-24T06:30" });
    expect(defaultManualNight(new Date("2026-10-25T06:29:00Z"), "UTC").endedAt).toBe("2026-10-24T06:30");
    expect(defaultManualNight(new Date("2026-10-25T06:30:00Z"), "UTC").endedAt).toBe("2026-10-25T06:30");
  });

  it("uses the member's time zone", () => {
    // 05:00 UTC is 1:00 AM in New York: the night before.
    expect(defaultManualNight(new Date("2026-10-25T05:00:00Z"), "America/New_York")).toEqual({ startedAt: "2026-10-23T22:30", endedAt: "2026-10-24T06:30" });
    // 05:00 UTC is 2:00 PM in Tokyo: last night.
    expect(defaultManualNight(new Date("2026-10-25T05:00:00Z"), "Asia/Tokyo")).toEqual({ startedAt: "2026-10-24T22:30", endedAt: "2026-10-25T06:30" });
  });
});
