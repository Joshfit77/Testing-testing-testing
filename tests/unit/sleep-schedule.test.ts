import { formatClock, summarizeNights, type SleepSession } from "@/lib/domain/sleep";
import { consistencyScore, sleepWindows } from "@/lib/domain/sleep-schedule";

const night = (date: string, bed: string, wake: string, onset?: string): SleepSession => ({
  id: `${date}`,
  kind: "night",
  source: "manual",
  startedAt: bed,
  endedAt: wake,
  onsetAt: onset,
  timezone: "UTC",
  nightOf: date,
});
const GOAL = 480;

describe("sleep windows v1", () => {
  it("gives consistency guidance only, never a window, with too few nights and no target", () => {
    const w = sleepWindows(summarizeNights([night("2026-10-23", "2026-10-22T22:30:00Z", "2026-10-23T06:30:00Z")]), GOAL);
    expect(w.bedWindow).toBeNull();
    expect(w.wakeWindow).toBeNull();
    expect(w.guidance[0]).toContain("Log 2 more nights");
    expect(w.consistency).toBeNull();
  });

  it("hangs the windows off a chosen wake time, allowing for time to fall asleep", () => {
    // Wake 6:30, goal 8 h, usual 20 min to fall asleep, 10 min to settle: bedtime centre 10:00 PM.
    const nights = summarizeNights([
      night("2026-10-23", "2026-10-22T22:00:00Z", "2026-10-23T06:30:00Z", "2026-10-22T22:20:00Z"),
      night("2026-10-22", "2026-10-21T22:05:00Z", "2026-10-22T06:25:00Z", "2026-10-21T22:25:00Z"),
      night("2026-10-21", "2026-10-20T21:55:00Z", "2026-10-21T06:35:00Z", "2026-10-20T22:15:00Z"),
    ]);
    const w = sleepWindows(nights, GOAL, 6 * 60 + 30);
    expect(w.anchorSource).toBe("target");
    expect(w.latencyMinutes).toBe(20);
    expect([formatClock(w.bedWindow!.start), formatClock(w.bedWindow!.end)]).toEqual(["9:30 PM", "10:30 PM"]);
    expect([formatClock(w.wakeWindow!.start), formatClock(w.wakeWindow!.end)]).toEqual(["6:15 AM", "6:45 AM"]);
    expect(w.adjustment).toBeNull();
    expect(w.consistency).toBeGreaterThan(90);
    expect(w.guidance.some((g) => g.includes("steady"))).toBe(true);
  });

  it("uses the typical wake time when no target is set and plans a gradual shift when bedtime is far off", () => {
    // Going to bed at 1 AM, getting up at 6: short nights. Centre for an 8 h goal is about 9:35 PM: 3.5 h earlier.
    const nights = summarizeNights([
      night("2026-10-23", "2026-10-23T01:00:00Z", "2026-10-23T06:00:00Z"),
      night("2026-10-22", "2026-10-22T01:10:00Z", "2026-10-22T06:00:00Z"),
      night("2026-10-21", "2026-10-21T00:50:00Z", "2026-10-21T06:00:00Z"),
    ]);
    const w = sleepWindows(nights, GOAL);
    expect(w.anchorSource).toBe("typical");
    expect(formatClock(w.anchorWake!)).toBe("6:00 AM");
    expect(w.adjustment).toMatchObject({ direction: "earlier", minutesPerNight: 15 });
    expect(w.adjustment!.nights).toBe(14);
    expect(w.guidance.some((g) => g.includes("15 minutes a night"))).toBe(true);
  });

  it("notices a weekend wake-time shift when both sides have three nights", () => {
    // 2026-10-17/18 and 10-24/25 are Saturdays/Sundays.
    const days: [string, string][] = [
      ["2026-10-19", "06:00"],
      ["2026-10-20", "06:00"],
      ["2026-10-21", "06:10"],
      ["2026-10-17", "08:30"],
      ["2026-10-18", "08:40"],
      ["2026-10-24", "08:20"],
    ];
    const nights = summarizeNights(days.map(([d, w]) => night(d, `${d}T00:00:00Z`.replace("T00:00", "T00:00"), `${d}T${w}:00Z`)));
    const w = sleepWindows(nights, GOAL);
    expect(w.weekendShift).toMatchObject({ minutes: 150 });
    expect(w.guidance.some((g) => g.includes("weekend wake time"))).toBe(true);
  });

  it("turns spread into a 0–100 consistency score", () => {
    expect(consistencyScore({ nights: 5, typicalBed: 0, typicalWake: 0, bedSpread: 0, wakeSpread: 0, steadiness: "steady" })).toBe(100);
    expect(consistencyScore({ nights: 5, typicalBed: 0, typicalWake: 0, bedSpread: 60, wakeSpread: 60, steadiness: "variable" })).toBe(50);
    expect(consistencyScore({ nights: 1, typicalBed: null, typicalWake: null, bedSpread: null, wakeSpread: null, steadiness: null })).toBeNull();
  });
});
