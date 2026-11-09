/**
 * Launch-audit regressions for the sleep system (2026-11-07): health-platform import mapping, nap classification,
 * re-import idempotency, partial data, stage shares for the AI coach, sleep debt with missing nights, time zones and
 * daylight saving. Every case asserts that no figure appears without data behind it.
 */
import { describe, expect, it } from "vitest";
import { nightOf, sleepDurations, summarizeNights, validateSleepSession, zonedTimeToIso, type SleepSession } from "@/lib/domain/sleep";
import { sleepDebt } from "@/lib/domain/sleep-debt";
import { importedSessionKind, samplesToSessions, stageShares, summarizeVitals, type ImportedSession, type PlatformSleepSample } from "@/lib/domain/sleep-import";
import { nightlyScore } from "@/lib/domain/sleep-score";
import { nightSlots, scheduleStats } from "@/lib/domain/sleep-stats";

const TZ = "America/New_York";

function toSession(s: ImportedSession, tz: string, id: string, kind: "night" | "nap" = importedSessionKind(s.startedAt, s.endedAt, tz)): SleepSession {
  return { id, source: "apple_health", kind, timezone: tz, startedAt: s.startedAt, endedAt: s.endedAt, onsetAt: s.onsetAt, finalWakeAt: s.finalWakeAt, awakenings: s.awakenings, awakeMinutes: s.awakeMinutes, nightOf: nightOf({ startedAt: s.startedAt, endedAt: s.endedAt, timezone: tz }), deviceName: s.deviceName };
}

const watchNight: PlatformSleepSample[] = [
  // iPhone's in-bed envelope overlaps the watch's stage samples (EST: 11:00 PM – 6:30 AM).
  { startDate: "2026-11-06T04:00:00Z", endDate: "2026-11-06T11:30:00Z", sleepState: "inBed", platformId: "phone-1", sourceName: "iPhone" },
  { startDate: "2026-11-06T04:10:00Z", endDate: "2026-11-06T04:30:00Z", sleepState: "awake", platformId: "w1", sourceName: "Apple Watch" },
  { startDate: "2026-11-06T04:30:00Z", endDate: "2026-11-06T06:00:00Z", sleepState: "light", platformId: "w2", sourceName: "Apple Watch" },
  { startDate: "2026-11-06T06:00:00Z", endDate: "2026-11-06T07:00:00Z", sleepState: "deep", platformId: "w3", sourceName: "Apple Watch" },
  { startDate: "2026-11-06T07:00:00Z", endDate: "2026-11-06T07:20:00Z", sleepState: "awake", platformId: "w4", sourceName: "Apple Watch" },
  { startDate: "2026-11-06T07:20:00Z", endDate: "2026-11-06T09:00:00Z", sleepState: "rem", platformId: "w5", sourceName: "Apple Watch" },
  { startDate: "2026-11-06T09:00:00Z", endDate: "2026-11-06T11:15:00Z", sleepState: "light", platformId: "w6", sourceName: "Apple Watch" },
];

describe("Apple Health import: in-bed vs asleep, stages and partial data", () => {
  it("maps the in-bed envelope to time in bed and the stage samples to time asleep, with onset, final wake and awake time", () => {
    const [s] = samplesToSessions(watchNight);
    expect(s).toBeDefined();
    expect(s!.startedAt).toBe("2026-11-06T04:00:00.000Z");
    expect(s!.endedAt).toBe("2026-11-06T11:30:00.000Z");
    expect(s!.onsetAt).toBe("2026-11-06T04:30:00.000Z");
    expect(s!.finalWakeAt).toBe("2026-11-06T11:15:00.000Z");
    expect(s!.awakeMinutes).toBe(20);
    expect(s!.awakenings).toBe(1);
    expect(s!.deviceName).toBe("Apple Watch");
    // The in-bed envelope is never a stage; stage minutes never exceed the night.
    expect(s!.stages.every((st) => st.stage !== ("inBed" as string))).toBe(true);
    const stageMinutes = s!.stages.reduce((acc, st) => acc + (Date.parse(st.endedAt) - Date.parse(st.startedAt)) / 60_000, 0);
    expect(stageMinutes).toBeLessThanOrEqual(450);
    const d = sleepDurations({ ...s!, kind: "night", timezone: TZ });
    expect(d.inBedMinutes).toBe(450);
    expect(d.asleepMinutes).toBe(405 - 20);
    expect(d.asleepEstimated).toBe(false);
    expect(d.latencyMinutes).toBe(30);
    expect(d.efficiencyPct).toBe(Math.round((385 / 450) * 100));
  });

  it("a phone-only record (in bed, nothing else) yields no onset, no efficiency, no awakenings and no stage shares", () => {
    const [s] = samplesToSessions([{ startDate: "2026-11-06T04:00:00Z", endDate: "2026-11-06T11:30:00Z", sleepState: "inBed", platformId: "phone-1", sourceName: "iPhone" }]);
    expect(s!.onsetAt).toBeNull();
    expect(s!.finalWakeAt).toBeNull();
    expect(s!.awakeMinutes).toBeNull();
    expect(s!.awakenings).toBeNull();
    expect(s!.stages).toEqual([]);
    const d = sleepDurations({ ...s!, kind: "night", timezone: TZ });
    expect(d.asleepEstimated).toBe(true);
    expect(d.efficiencyPct).toBeNull();
    expect(d.latencyMinutes).toBeNull();
    expect(stageShares([])).toBeNull();
    // The nightly score then rests on duration alone and says so.
    const night = summarizeNights([toSession(s!, TZ, "a")])[0]!;
    const score = nightlyScore(night, 480, null);
    expect(score.basedOn).toBe("duration");
    expect(score.components.map((c) => c.key)).toEqual(["duration"]);
    expect(score.missing.map((m) => m.key).sort()).toEqual(["awakenings", "efficiency", "timing"]);
  });

  it("overnight vitals are null, never zero, when the device shared no samples or only implausible ones", () => {
    expect(summarizeVitals("2026-11-06T04:00:00Z", "2026-11-06T11:30:00Z", {}, "sdnn")).toBeNull();
    const v = summarizeVitals("2026-11-06T04:00:00Z", "2026-11-06T11:30:00Z", { heartRate: [{ startDate: "2026-11-06T05:00:00Z", value: 300 }], hrv: [{ startDate: "2026-11-06T05:00:00Z", value: 0 }] }, "sdnn");
    expect(v).toBeNull();
    const partial = summarizeVitals("2026-11-06T04:00:00Z", "2026-11-06T11:30:00Z", { heartRate: [{ startDate: "2026-11-06T05:00:00Z", value: 52 }, { startDate: "2026-11-06T20:00:00Z", value: 140 }] }, "sdnn");
    expect(partial).toEqual({ heartRate: { avg: 52, min: 52, max: 52, samples: 1 }, hrv: null, respiratoryRate: null });
  });
});

describe("imported naps are not nights", () => {
  it("classifies a short daytime record as a nap and a night as a night, by the import zone's clock", () => {
    // 2:00–3:00 PM New York
    expect(importedSessionKind("2026-11-06T19:00:00Z", "2026-11-06T20:00:00Z", TZ)).toBe("nap");
    // The same instants are 4:00–5:00 AM in Tokyo: a night there.
    expect(importedSessionKind("2026-11-06T19:00:00Z", "2026-11-06T20:00:00Z", "Asia/Tokyo")).toBe("night");
    // Long daytime sleep (a shift worker) stays a night.
    expect(importedSessionKind("2026-11-06T14:00:00Z", "2026-11-06T20:00:00Z", TZ)).toBe("night");
    // A short evening doze from 9 PM is a night record, not a nap.
    expect(importedSessionKind("2026-11-07T02:00:00Z", "2026-11-07T03:00:00Z", TZ)).toBe("night");
    expect(importedSessionKind("not a date", "2026-11-07T03:00:00Z", TZ)).toBe("night");
  });

  it("keeps an imported afternoon nap out of last night's totals, score and debt", () => {
    const imported = samplesToSessions([
      { startDate: "2026-11-06T04:00:00Z", endDate: "2026-11-06T11:30:00Z", sleepState: "asleep", platformId: "a", sourceName: "Apple Watch" },
      { startDate: "2026-11-06T19:00:00Z", endDate: "2026-11-06T20:00:00Z", sleepState: "asleep", platformId: "b", sourceName: "Apple Watch" },
    ]);
    expect(imported).toHaveLength(2);
    const sessions = imported.map((s, i) => toSession(s, TZ, String(i)));
    expect(sessions.map((s) => s.kind)).toEqual(["night", "nap"]);
    const nights = summarizeNights(sessions);
    expect(nights).toHaveLength(1);
    expect(nights[0]!.asleepMinutes).toBe(450);
    expect(nights[0]!.sessions).toHaveLength(1);
    // Before the nap rule the same two records were both "night" and added up to 8h 30m.
    const asNights = imported.map((s, i) => toSession(s, TZ, String(i), "night"));
    expect(summarizeNights(asNights)[0]!.asleepMinutes).toBe(510);
    const debt = sleepDebt(nights, 480, "2026-11-06");
    // The device said "asleep" for the whole record, so this is its reading, not an in-bed stand-in.
    expect(debt.days.at(-1)).toMatchObject({ date: "2026-11-06", asleep: 450, shortfall: 30, estimated: false });
  });
});

describe("re-import and overlapping records", () => {
  it("gives the same records the same source ids on a second read, so the server can skip them", () => {
    const a = samplesToSessions(watchNight);
    const b = samplesToSessions([...watchNight].reverse());
    expect(a.map((s) => s.sourceId)).toEqual(b.map((s) => s.sourceId));
    expect(a[0]!.sourceId).toBe("p:phone-1");
    // Without platform ids the fingerprint is the times, which are also stable.
    const noIds = watchNight.map(({ platformId: _id, ...rest }) => rest);
    expect(samplesToSessions(noIds)[0]!.sourceId).toBe(samplesToSessions([...noIds].reverse())[0]!.sourceId);
  });

  it("splits a night the platform recorded as two records more than 30 minutes apart, then adds it back up as one night", () => {
    const imported = samplesToSessions([
      { startDate: "2026-11-06T04:00:00Z", endDate: "2026-11-06T07:00:00Z", sleepState: "asleep", platformId: "a", sourceName: "Oura" },
      { startDate: "2026-11-06T07:45:00Z", endDate: "2026-11-06T11:30:00Z", sleepState: "asleep", platformId: "b", sourceName: "Oura" },
    ]);
    expect(imported).toHaveLength(2);
    const sessions = imported.map((s, i) => toSession(s, TZ, String(i)));
    expect(sessions.every((s) => s.kind === "night")).toBe(true);
    const night = summarizeNights(sessions)[0]!;
    expect(night.sessions).toHaveLength(2);
    expect(night.inBedMinutes).toBe(180 + 225);
    expect(night.asleepMinutes).toBe(180 + 225);
    expect(night.recorded).toBe(true);
    expect(night.deviceName).toBe("Oura");
  });

  it("drops records under 10 minutes and over 24 hours instead of storing them", () => {
    const imported = samplesToSessions([
      { startDate: "2026-11-06T04:00:00Z", endDate: "2026-11-06T04:05:00Z", sleepState: "asleep", platformId: "noise" },
      { startDate: "2026-11-04T04:00:00Z", endDate: "2026-11-05T05:00:00Z", sleepState: "inBed", platformId: "stuck-envelope" },
    ]);
    expect(imported).toEqual([]);
  });
});

describe("stage shares for the AI coach", () => {
  it("reports deep, REM and light as unknown (null), not zero, when the device recorded sleep without stages", () => {
    const t = stageShares([
      { stage: "asleep", startedAt: "2026-11-06T04:00:00Z", endedAt: "2026-11-06T08:00:00Z" },
      { stage: "awake", startedAt: "2026-11-06T08:00:00Z", endedAt: "2026-11-06T08:10:00Z" },
      { stage: "asleep", startedAt: "2026-11-06T08:10:00Z", endedAt: "2026-11-06T11:00:00Z" },
    ]);
    expect(t).not.toBeNull();
    expect(t!.staged).toBe(false);
    expect(t!.deep).toBeNull();
    expect(t!.rem).toBeNull();
    expect(t!.light).toBeNull();
    expect(t!.unlabelled).toEqual({ minutes: 410, pct: 100 });
    expect(t!.awakeMinutes).toBe(10);
  });

  it("gives shares of time asleep by stage when stages exist, and nothing for awake-only rows", () => {
    const t = stageShares([
      { stage: "light", startedAt: "2026-11-06T04:00:00Z", endedAt: "2026-11-06T07:00:00Z" },
      { stage: "deep", startedAt: "2026-11-06T07:00:00Z", endedAt: "2026-11-06T08:00:00Z" },
      { stage: "awake", startedAt: "2026-11-06T08:00:00Z", endedAt: "2026-11-06T08:30:00Z" },
    ]);
    expect(t).toMatchObject({ asleepMinutes: 240, staged: true, light: { minutes: 180, pct: 75 }, deep: { minutes: 60, pct: 25 }, rem: null, unlabelled: null, awakeMinutes: 30 });
    expect(stageShares([{ stage: "awake", startedAt: "2026-11-06T08:00:00Z", endedAt: "2026-11-06T08:30:00Z" }])).toBeNull();
  });
});

describe("sleep debt with missing nights and in-bed-only nights", () => {
  const night = (nightOfDate: string, asleep: number, estimated = false): SleepSession => ({
    id: nightOfDate,
    source: "manual",
    kind: "night",
    timezone: TZ,
    startedAt: `${nightOfDate}T03:00:00Z`,
    endedAt: new Date(Date.parse(`${nightOfDate}T03:00:00Z`) + asleep * 60_000).toISOString(),
    onsetAt: estimated ? null : `${nightOfDate}T03:00:00Z`,
    awakenings: null,
    awakeMinutes: null,
    nightOf: nightOfDate,
  });

  it("never treats an unlogged night as zero sleep and marks nights whose 'asleep' is time in bed", () => {
    const nights = summarizeNights([night("2026-11-01", 420), night("2026-11-03", 480, true), night("2026-11-06", 360)]);
    const debt = sleepDebt(nights, 480, "2026-11-06");
    expect(debt.nightsWithData).toBe(3);
    expect(debt.days).toHaveLength(14);
    const missing = debt.days.filter((d) => d.asleep === null);
    expect(missing).toHaveLength(11);
    expect(missing.every((d) => d.shortfall === 0 && d.repaid === 0 && d.estimated === false)).toBe(true);
    // 60 short on the 1st, at goal on the 3rd (in bed only), 120 short on the 6th: 180 owed, nothing invented in between.
    expect(debt.debtMinutes).toBe(180);
    expect(debt.days.find((d) => d.date === "2026-11-03")).toMatchObject({ asleep: 480, estimated: true, shortfall: 0, repaid: 0 });
    expect(debt.days.find((d) => d.date === "2026-11-01")).toMatchObject({ estimated: false, shortfall: 60 });
    expect(debt.band).toBe("behind");
  });

  it("has nothing to say with no nights at all", () => {
    const debt = sleepDebt([], 480, "2026-11-06");
    expect(debt.nightsWithData).toBe(0);
    expect(debt.debtMinutes).toBe(0);
    expect(debt.trend).toBeNull();
    expect(debt.days.every((d) => d.asleep === null)).toBe(true);
    const slots = nightSlots([], "2026-11-06", 7);
    expect(slots.every((s) => s.night === null)).toBe(true);
    expect(scheduleStats([]).typicalBed).toBeNull();
  });
});

describe("time zones and daylight saving", () => {
  it("files an imported session under the morning it ended in the import zone, which can differ from the profile zone", () => {
    const [s] = samplesToSessions([{ startDate: "2026-11-07T13:00:00Z", endDate: "2026-11-07T21:30:00Z", sleepState: "asleep", platformId: "x" }]);
    // 10 PM – 6:30 AM in Tokyo: the night of 8 November there...
    expect(nightOf({ startedAt: s!.startedAt, endedAt: s!.endedAt, timezone: "Asia/Tokyo" })).toBe("2026-11-08");
    // ...but 8:00 AM – 4:30 PM on 7 November in New York.
    expect(nightOf({ startedAt: s!.startedAt, endedAt: s!.endedAt, timezone: TZ })).toBe("2026-11-07");
  });

  it("counts the real elapsed time of an imported night across the autumn clock change", () => {
    // New York, 1 November 2026: 11 PM EDT to 7 AM EST is nine hours on the clock... and nine hours elapsed.
    const [s] = samplesToSessions([{ startDate: "2026-11-01T03:00:00Z", endDate: "2026-11-01T12:00:00Z", sleepState: "asleep", platformId: "dst" }]);
    const d = sleepDurations({ ...s!, kind: "night", timezone: TZ });
    expect(d.inBedMinutes).toBe(540);
    expect(nightOf({ startedAt: s!.startedAt, endedAt: s!.endedAt, timezone: TZ })).toBe("2026-11-01");
  });

  it("accepts a hand-entered night across the spring clock change and refuses impossible ones", () => {
    const now = Date.parse("2026-03-09T12:00:00Z");
    const start = zonedTimeToIso("2026-03-07T23:00", TZ)!;
    const end = zonedTimeToIso("2026-03-08T07:00", TZ)!;
    // Clocks went forward at 2 AM, so eight clock hours are seven real hours.
    expect((Date.parse(end) - Date.parse(start)) / 3_600_000).toBe(7);
    expect(validateSleepSession({ kind: "night", timezone: TZ, startedAt: start, endedAt: end }, now)).toEqual({ ok: true });
    expect(validateSleepSession({ kind: "night", timezone: TZ, startedAt: end, endedAt: start }, now)).toMatchObject({ ok: false, field: "endedAt" });
    // Over 24 hours (25 real hours) is refused; exactly 24 is the limit.
    expect(validateSleepSession({ kind: "night", timezone: TZ, startedAt: start, endedAt: zonedTimeToIso("2026-03-09T01:00", TZ)! }, now)).toMatchObject({ ok: false, field: "endedAt" });
    expect(validateSleepSession({ kind: "nap", timezone: TZ, startedAt: start, endedAt: end }, now)).toMatchObject({ ok: false, field: "endedAt" });
    // A night that crosses midnight belongs to the morning it ended.
    expect(nightOf({ startedAt: start, endedAt: end, timezone: TZ })).toBe("2026-03-08");
  });
});
