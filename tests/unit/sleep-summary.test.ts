import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/domain/dates";
import type { NightSummary, SleepSource } from "@/lib/domain/sleep";
import { MIN_NIGHTS_FOR_SUMMARY, thirtyDaySummary } from "@/lib/domain/sleep-summary";

const TODAY = "2026-11-13";
function night(daysAgo: number, asleep: number, opts: { source?: SleepSource; estimated?: boolean; bed?: string } = {}): NightSummary {
  const nightOf = addDays(TODAY, -daysAgo);
  const source = opts.source ?? "apple_health";
  const bedAt = `${addDays(nightOf, -1)}T${opts.bed ?? "22:30"}:00Z`;
  return {
    nightOf,
    sessions: [],
    bedAt,
    wakeAt: `${nightOf}T06:30:00Z`,
    timezone: "UTC",
    inBedMinutes: 480,
    asleepMinutes: asleep,
    asleepEstimated: opts.estimated ?? false,
    latencyMinutes: null,
    efficiencyPct: null,
    awakenings: null,
    sources: [source],
    recorded: ["apple_health", "health_connect", "wearable"].includes(source),
    deviceName: null,
    vitals: null,
  };
}

describe("30-day sleep summary", () => {
  it("shows nothing but a count until enough nights are logged", () => {
    const s = thirtyDaySummary([night(0, 420), night(1, 400)], 480, TODAY);
    expect(s).toEqual({ status: "insufficient", nightsLogged: 2, needed: MIN_NIGHTS_FOR_SUMMARY, start: "2026-10-15", end: TODAY });
  });

  it("averages only logged nights in the window and never counts a missing night as zero", () => {
    const nights = [0, 1, 2, 3, 4, 5, 6].map((d) => night(d, 420)).concat([night(40, 100)]);
    const s = thirtyDaySummary(nights, 480, TODAY);
    if (s.status !== "ok") throw new Error("expected a summary");
    expect(s.nightsLogged).toBe(7);
    expect(s.averageAsleep).toBe(420);
    expect(s.nightsAtGoal).toBe(0);
    expect(s.caveats[0]).toContain("23 of the last 30 nights have no data");
  });

  it("separates recorded from self-reported nights and says which figures are estimates", () => {
    const nights = [
      ...[0, 1, 2].map((d) => night(d, 450)),
      ...[3, 4, 5].map((d) => night(d, 390, { source: "manual" })),
      night(6, 480, { source: "manual", estimated: true }),
    ];
    const s = thirtyDaySummary(nights, 480, TODAY);
    if (s.status !== "ok") throw new Error("expected a summary");
    expect(s.recordedNights).toBe(3);
    expect(s.selfReportedNights).toBe(4);
    expect(s.estimatedAsleepNights).toBe(1);
    expect(s.averageAsleepRecorded).toBe(450);
    expect(s.nightsAtGoal).toBe(1);
    expect(s.caveats.some((c) => c.includes("4 nights were entered by hand"))).toBe(true);
    expect(s.caveats.some((c) => c.includes("only time in bed was known"))).toBe(true);
    expect(s.caveats.some((c) => c.includes("not a medical sleep test"))).toBe(true);
  });

  it("describes a change only when both halves have data and it is bigger than noise", () => {
    const early = [20, 21, 22, 23].map((d) => night(d, 380));
    const late = [0, 1, 2, 3].map((d) => night(d, 440));
    const up = thirtyDaySummary([...early, ...late], 480, TODAY);
    expect(up.status === "ok" && up.change).toEqual({ minutes: 60, direction: "more" });
    const flat = thirtyDaySummary([...early.map((n) => ({ ...n, asleepMinutes: 430 })), ...late], 480, TODAY);
    expect(flat.status === "ok" && flat.change?.direction).toBe("same");
    const oneSided = thirtyDaySummary([0, 1, 2, 3, 4, 5, 6].map((d) => night(d, 420)), 480, TODAY);
    expect(oneSided.status === "ok" && oneSided.change).toBeNull();
  });

  it("reports the typical bedtime from logged nights", () => {
    const s = thirtyDaySummary([0, 1, 2, 3, 4, 5, 6].map((d) => night(d, 420, { bed: "23:00" })), 480, TODAY);
    expect(s.status === "ok" && s.typicalBed).toBe(23 * 60);
    expect(s.status === "ok" && s.steadiness).toBe("steady");
  });
});
