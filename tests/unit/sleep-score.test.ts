import { summarizeNights, type SleepSession } from "@/lib/domain/sleep";
import { nightlyScore, scoreBand, SLEEP_SCORE_VERSION } from "@/lib/domain/sleep-score";
import { scheduleStats } from "@/lib/domain/sleep-stats";

const session = (over: Partial<SleepSession>): SleepSession => ({
  id: crypto.randomUUID(),
  kind: "night",
  source: "manual",
  startedAt: "2026-10-22T22:00:00Z",
  endedAt: "2026-10-23T06:00:00Z",
  timezone: "UTC",
  nightOf: "2026-10-23",
  ...over,
});
const nightOf = (over: Partial<SleepSession> = {}) => summarizeNights([session(over)])[0]!;
const GOAL = 480;

describe("nightly score v1", () => {
  it("scores duration alone when nothing else was entered, and never penalises what's missing", () => {
    const full = nightlyScore(nightOf(), GOAL, null);
    expect(full.score).toBe(100);
    expect(full.version).toBe(SLEEP_SCORE_VERSION);
    expect(full.components.map((c) => c.key)).toEqual(["duration"]);
    expect(full.missing.map((m) => m.key)).toEqual(["efficiency", "timing", "awakenings"]);
    expect(full.basedOn).toBe("duration");
    expect(full.band).toBe("restful");

    const seven = nightlyScore(nightOf({ endedAt: "2026-10-23T05:00:00Z" }), GOAL, null);
    expect(seven.score).toBe(75);
    const six = nightlyScore(nightOf({ endedAt: "2026-10-23T04:00:00Z" }), GOAL, null);
    expect(six.score).toBe(50);
    const four = nightlyScore(nightOf({ endedAt: "2026-10-23T02:00:00Z" }), GOAL, null);
    expect(four.score).toBe(0);
    expect(four.band).toBe("rough");
  });

  it("doesn't penalise sleeping past the goal", () => {
    expect(nightlyScore(nightOf({ endedAt: "2026-10-23T07:30:00Z" }), GOAL, null).score).toBe(100);
  });

  it("adds efficiency and wake-ups when they were entered", () => {
    const n = nightOf({ onsetAt: "2026-10-22T22:20:00Z", finalWakeAt: "2026-10-23T05:50:00Z", awakeMinutes: 15, awakenings: 1 });
    // asleep 435 of 480 (91% of goal → 40.6/50), efficiency 91% (20/20), one wake-up (10/10) → 70.6/80.
    const s = nightlyScore(n, GOAL, null);
    expect(s.components.map((c) => c.key)).toEqual(["duration", "efficiency", "awakenings"]);
    expect(s.score).toBe(88);
    expect(s.basedOn).toBe("duration, efficiency and wake-ups");
    const broken = nightlyScore(nightOf({ awakenings: 6 }), GOAL, null);
    expect(broken.components.find((c) => c.key === "awakenings")?.points).toBe(0);
    expect(broken.score).toBe(83);
  });

  it("uses the member's own usual times for the timing part", () => {
    const earlier = summarizeNights([
      session({ nightOf: "2026-10-20", startedAt: "2026-10-19T22:00:00Z", endedAt: "2026-10-20T06:00:00Z" }),
      session({ nightOf: "2026-10-21", startedAt: "2026-10-20T22:10:00Z", endedAt: "2026-10-21T06:05:00Z" }),
      session({ nightOf: "2026-10-22", startedAt: "2026-10-21T21:50:00Z", endedAt: "2026-10-22T05:55:00Z" }),
    ]);
    const pattern = scheduleStats(earlier);
    const usual = nightlyScore(nightOf(), GOAL, pattern);
    expect(usual.components.find((c) => c.key === "timing")?.points).toBe(20);
    expect(usual.score).toBe(100);
    // Two hours later than usual, same length: duration full, timing none → 50/70.
    const late = nightlyScore(nightOf({ startedAt: "2026-10-23T00:00:00Z", endedAt: "2026-10-23T08:00:00Z" }), GOAL, pattern);
    expect(late.components.find((c) => c.key === "timing")?.points).toBe(0);
    expect(late.score).toBe(71);
    expect(late.band).toBe("fair");
  });

  it("bands scores in plain words", () => {
    expect(scoreBand(80)).toBe("restful");
    expect(scoreBand(60)).toBe("fair");
    expect(scoreBand(59)).toBe("rough");
  });
});
