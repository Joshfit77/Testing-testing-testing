/**
 * Audit 2026-11-14 (nutrition / GPS / health). Sleep figures checked by hand against docs/SLEEP_METHOD.md.
 */
import { describe, expect, it } from "vitest";
import { nightOf, sleepDurations, summarizeNights, type NightSummary, type SleepSession } from "@/lib/domain/sleep";
import { sleepDebt } from "@/lib/domain/sleep-debt";
import { isFullerRecord, samplesToSessions, summarizeVitals } from "@/lib/domain/sleep-import";
import { nightlyScore } from "@/lib/domain/sleep-score";
import type { ScheduleStats } from "@/lib/domain/sleep-stats";

const NY = "America/New_York";
const session = (over: Partial<SleepSession>): SleepSession => ({ id: "s", kind: "night", source: "manual", timezone: NY, startedAt: "2026-10-20T02:30:00Z", endedAt: "2026-10-20T10:30:00Z", nightOf: "2026-10-20", ...over });
const night = (over: Partial<NightSummary>): NightSummary => ({
  nightOf: "2026-10-20",
  sessions: [],
  bedAt: "2026-10-20T02:30:00Z", // 10:30 PM in New York
  wakeAt: "2026-10-20T10:30:00Z", // 6:30 AM
  timezone: NY,
  inBedMinutes: 480,
  asleepMinutes: 420,
  asleepEstimated: false,
  latencyMinutes: 20,
  efficiencyPct: 88,
  awakenings: 2,
  sources: ["manual"],
  recorded: false,
  deviceName: null,
  vitals: null,
  ...over,
});
const usual: ScheduleStats = { nights: 5, typicalBed: 22 * 60 + 30, typicalWake: 6 * 60 + 30, bedSpread: 10, wakeSpread: 10, steadiness: "steady" };

describe("in bed versus asleep", () => {
  it("asleep = (final wake − fell asleep) − minutes awake; efficiency = asleep ÷ in bed", () => {
    // In bed 10:30 PM–6:30 AM (480). Asleep 10:50 PM–6:20 AM (450) minus 25 awake = 425. 425 ÷ 480 = 88.5 → 89%.
    const d = sleepDurations(session({ onsetAt: "2026-10-20T02:50:00Z", finalWakeAt: "2026-10-20T10:20:00Z", awakeMinutes: 25 }));
    expect(d).toEqual({ inBedMinutes: 480, asleepMinutes: 425, asleepEstimated: false, latencyMinutes: 20, efficiencyPct: 89 });
  });

  it("with only bed and getting-up times, asleep is time in bed and is flagged as that; no efficiency is made up", () => {
    const d = sleepDurations(session({}));
    expect(d).toEqual({ inBedMinutes: 480, asleepMinutes: 480, asleepEstimated: true, latencyMinutes: null, efficiencyPct: null });
  });
});

describe("which day a night belongs to", () => {
  it("the local date of getting up, in the session's own zone", () => {
    // 11:30 PM Oct 19 to 7:00 AM Oct 20 in New York.
    expect(nightOf({ startedAt: "2026-10-20T03:30:00Z", endedAt: "2026-10-20T11:00:00Z", timezone: NY })).toBe("2026-10-20");
    // The same instants seen from Tokyo end at 8:00 PM on Oct 20.
    expect(nightOf({ startedAt: "2026-10-20T03:30:00Z", endedAt: "2026-10-20T11:00:00Z", timezone: "Asia/Tokyo" })).toBe("2026-10-20");
    // Up at 12:30 AM local after an evening sleep: still the day of getting up.
    expect(nightOf({ startedAt: "2026-10-20T00:00:00Z", endedAt: "2026-10-20T04:30:00Z", timezone: NY })).toBe("2026-10-20");
  });

  it("clocks going back (1 Nov 2026, New York): 10 PM to 6 AM is 9 real hours, on 1 November", () => {
    const s = session({ startedAt: "2026-11-01T02:00:00Z", endedAt: "2026-11-01T11:00:00Z" }); // 10 PM EDT → 6 AM EST
    expect(sleepDurations(s).inBedMinutes).toBe(540);
    expect(nightOf(s)).toBe("2026-11-01");
  });

  it("clocks going forward (8 Mar 2026, New York): 10 PM to 6 AM is 7 real hours", () => {
    const s = session({ startedAt: "2026-03-08T03:00:00Z", endedAt: "2026-03-08T10:00:00Z" }); // 10 PM EST → 6 AM EDT
    expect(sleepDurations(s).inBedMinutes).toBe(420);
    expect(nightOf(s)).toBe("2026-03-08");
  });

  it("two sessions that end on the same local day are one night; a nap is not counted in it", () => {
    const nights = summarizeNights([
      session({ id: "a", startedAt: "2026-10-20T02:30:00Z", endedAt: "2026-10-20T07:00:00Z" }), // 4 h 30
      session({ id: "b", startedAt: "2026-10-20T07:30:00Z", endedAt: "2026-10-20T10:30:00Z" }), // 3 h
      session({ id: "n", kind: "nap", startedAt: "2026-10-20T18:00:00Z", endedAt: "2026-10-20T18:40:00Z" }),
    ]);
    expect(nights).toHaveLength(1);
    expect(nights[0]).toMatchObject({ nightOf: "2026-10-20", inBedMinutes: 450, asleepMinutes: 450, asleepEstimated: true, efficiencyPct: null, awakenings: null });
  });
});

describe("nightly score, by hand (docs/SLEEP_METHOD.md)", () => {
  it("7 h of an 8 h goal, 88% efficiency, on time, 2 wake-ups = 84", () => {
    // Duration: (0.875 − 0.5) ÷ 0.5 = 0.75 × 50 = 37.5. Efficiency: (88 − 60) ÷ 30 = 0.933 × 20 = 18.7.
    // Timing: 0 min away = 20. Wake-ups: 1 − (2 − 1) ÷ 5 = 0.8 × 10 = 8. Total 84.2 of 100 → 84.
    const s = nightlyScore(night({}), 480, usual);
    expect(s.components.map((c) => c.points)).toEqual([37.5, 18.7, 20, 8]);
    expect(s.score).toBe(84);
    expect(s.band).toBe("restful");
    expect(s.basedOn).toBe("duration, efficiency, timing and wake-ups");
    expect(s.partial).toBe(false);
  });

  it("a part with no input is left out, never scored as zero: only duration known, 6 of 8 hours = 50", () => {
    // (0.75 − 0.5) ÷ 0.5 = 0.5 × 50 = 25 of the 50 available → 50.
    const s = nightlyScore(night({ asleepMinutes: 360, asleepEstimated: true, efficiencyPct: null, awakenings: null }), 480, null);
    expect(s.score).toBe(50);
    expect(s.missing.map((m) => m.key)).toEqual(["efficiency", "timing", "awakenings"]);
    expect(s.partial).toBe(true);
    expect(s.basedOn).toBe("duration");
  });

  it("the edges: half the goal or less scores 0 for duration, sleeping past the goal is not penalised, 90 min late halves timing", () => {
    expect(nightlyScore(night({ asleepMinutes: 240, efficiencyPct: null, awakenings: null }), 480, null).score).toBe(0);
    expect(nightlyScore(night({ asleepMinutes: 600, efficiencyPct: null, awakenings: null }), 480, null).score).toBe(100);
    // Bed 90 min later than usual: 1 − (90 − 30) ÷ 90 = 0.333 × 20 = 6.7.
    const late = nightlyScore(night({ bedAt: "2026-10-20T04:00:00Z" }), 480, usual);
    expect(late.components.find((c) => c.key === "timing")!.points).toBe(6.7);
  });
});

describe("sleep debt, by hand", () => {
  const n = (date: string, asleep: number) => night({ nightOf: date, asleepMinutes: asleep });

  it("shortfalls add in full, extra sleep repays at half and only what is owed, unlogged nights change nothing", () => {
    // Goal 480. Mon 420 (+60 → 60), Tue not logged (60), Wed 540 (repay min(60, 30) = 30 → 30),
    // Thu 660 (repay min(30, 90) = 30 → 0), Fri 450 (+30 → 30).
    const d = sleepDebt([n("2026-10-12", 420), n("2026-10-14", 540), n("2026-10-15", 660), n("2026-10-16", 450)], 480, "2026-10-16", 5);
    expect(d.days.map((x) => x.debt)).toEqual([60, 60, 30, 0, 30]);
    expect(d.days[1]).toMatchObject({ asleep: null, shortfall: 0, repaid: 0 });
    expect(d.debtMinutes).toBe(30);
    expect(d.totalShortfall).toBe(90);
    expect(d.totalRepaid).toBe(60);
    expect(d.nightsWithData).toBe(4);
    expect(d.band).toBe("on_track");
  });

  it("no logged nights is no debt and no trend, not fourteen nights of zero sleep", () => {
    const d = sleepDebt([], 480, "2026-10-16");
    expect(d.debtMinutes).toBe(0);
    expect(d.nightsWithData).toBe(0);
    expect(d.trend).toBeNull();
    expect(d.days.every((x) => x.asleep === null)).toBe(true);
  });
});

describe("imported records: nothing is invented", () => {
  it("a phone's bare in-bed record has no stages, onset, wake-ups or awake minutes", () => {
    const [s] = samplesToSessions([{ startDate: "2026-10-20T02:30:00Z", endDate: "2026-10-20T10:30:00Z", sleepState: "inBed", platformId: "A1", sourceName: "iPhone" }]);
    expect(s).toMatchObject({ sourceId: "p:A1", stages: [], onsetAt: null, finalWakeAt: null, awakeMinutes: null, awakenings: null, deviceName: "iPhone" });
  });

  it("the id is stable when the same samples are read again in another order", () => {
    const samples = [
      { startDate: "2026-10-20T03:00:00Z", endDate: "2026-10-20T05:00:00Z", sleepState: "light" as const, platformId: "B2", sourceName: "Watch" },
      { startDate: "2026-10-20T05:00:00Z", endDate: "2026-10-20T10:00:00Z", sleepState: "deep" as const, platformId: "A9", sourceName: "Watch" },
    ];
    expect(samplesToSessions(samples)[0]!.sourceId).toBe("p:A9");
    expect(samplesToSessions([...samples].reverse())[0]!.sourceId).toBe("p:A9");
  });

  it("overnight measurements exist only for series with readings in the night; out-of-range readings are dropped", () => {
    const v = summarizeVitals("2026-10-20T03:00:00Z", "2026-10-20T10:00:00Z", { heartRate: [{ startDate: "2026-10-20T04:00:00Z", value: 50 }, { startDate: "2026-10-20T05:00:00Z", value: 56 }, { startDate: "2026-10-20T06:00:00Z", value: 400 }, { startDate: "2026-10-20T12:00:00Z", value: 90 }] }, "sdnn");
    expect(v).toEqual({ heartRate: { avg: 53, min: 50, max: 56, samples: 2 }, hrv: null, respiratoryRate: null });
    expect(summarizeVitals("2026-10-20T03:00:00Z", "2026-10-20T10:00:00Z", {}, "sdnn")).toBeNull();
  });

  it("a fuller record covers the stored one and is at least 10 minutes longer", () => {
    const stored = { startedAt: "2026-10-20T03:00:00Z", endedAt: "2026-10-20T07:00:00Z" };
    expect(isFullerRecord(stored, { startedAt: "2026-10-20T03:00:00Z", endedAt: "2026-10-20T11:00:00Z" })).toBe(true);
    expect(isFullerRecord(stored, { startedAt: "2026-10-20T02:45:00Z", endedAt: "2026-10-20T07:00:00Z" })).toBe(true);
    expect(isFullerRecord(stored, { startedAt: "2026-10-20T03:00:00Z", endedAt: "2026-10-20T07:05:00Z" })).toBe(false); // 5 minutes
    expect(isFullerRecord(stored, { startedAt: "2026-10-20T03:30:00Z", endedAt: "2026-10-20T11:00:00Z" })).toBe(false); // starts later
    expect(isFullerRecord(stored, { startedAt: "2026-10-20T03:00:00Z", endedAt: "2026-10-20T06:00:00Z" })).toBe(false); // shorter
    expect(isFullerRecord(stored, stored, 0)).toBe(true);
    expect(isFullerRecord(stored, { startedAt: "nope", endedAt: "2026-10-20T11:00:00Z" })).toBe(false);
  });
});
