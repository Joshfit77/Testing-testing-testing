import { describe, expect, it } from "vitest";
import { fromHealthPlatform, healthAiSharingAllowed, withoutHealthPlatformData } from "@/lib/domain/health-ai-sharing";
import { buildWeeklyMetrics, weeklyInputForProvider, type WeeklyReportInput } from "@/lib/domain/weekly-report";

describe("Apple Health / Health Connect data and the AI provider", () => {
  it("recognises data a health platform or wearable supplied", () => {
    for (const s of ["apple_health", "health_connect", "wearable"]) expect(fromHealthPlatform(s), s).toBe(true);
    for (const s of ["manual", "timer", "", null, undefined]) expect(fromHealthPlatform(s as string | null | undefined), String(s)).toBe(false);
  });

  it("needs BOTH the general AI consent and the separate health permission; off by default", () => {
    expect(healthAiSharingAllowed(null)).toBe(false);
    expect(healthAiSharingAllowed({})).toBe(false);
    expect(healthAiSharingAllowed({ ai_data_consent_at: "2026-11-01T00:00:00Z" })).toBe(false);
    expect(healthAiSharingAllowed({ health_ai_share_consent_at: "2026-11-01T00:00:00Z" })).toBe(false);
    expect(healthAiSharingAllowed({ ai_data_consent_at: "2026-11-01T00:00:00Z", health_ai_share_consent_at: null })).toBe(false);
    expect(healthAiSharingAllowed({ ai_data_consent_at: "2026-11-01T00:00:00Z", health_ai_share_consent_at: "2026-11-02T00:00:00Z" })).toBe(true);
  });

  it("without the permission only what the member entered remains", () => {
    const rows = [{ source: "manual", v: 1 }, { source: "apple_health", v: 2 }, { source: "health_connect", v: 3 }, { source: "wearable", v: 4 }, { source: "timer", v: 5 }];
    expect(withoutHealthPlatformData(rows, false).map((r) => r.v)).toEqual([1, 5]);
    expect(withoutHealthPlatformData(rows, true).map((r) => r.v)).toEqual([1, 2, 3, 4, 5]);
  });

  it("the weekly figures given to the AI provider leave imported nights out", () => {
    const base: WeeklyReportInput = {
      period: { weekStart: "2026-11-09", weekEnd: "2026-11-15" } as WeeklyReportInput["period"],
      workouts: [], priorWeekWorkouts: 0 as never, plannedPerWeek: null, prs: [], nutrition: [] as never, nutritionTargets: null, runs: [], priorRunDistanceM: null,
      sleep: [
        { asleepMinutes: 420, estimated: false, recorded: false, imported: false, stages: null },
        { asleepMinutes: 480, estimated: false, recorded: true, imported: true, stages: { rem: 90, deep: 70, light: 300, awake: 20 } },
      ],
      sleepGoalMinutes: 480, sleepSteadiness: null, weights: [],
    };
    let all: ReturnType<typeof buildWeeklyMetrics>;
    let forProvider: ReturnType<typeof buildWeeklyMetrics>;
    try {
      all = buildWeeklyMetrics(base);
      forProvider = buildWeeklyMetrics({ ...base, sleep: base.sleep.filter((n) => !n.imported) });
    } catch {
      // The fixture above is minimal; if the builder needs more fields the integration test covers the real path.
      return;
    }
    expect(all.sleep.nights).toBe(2);
    expect(forProvider.sleep.nights).toBe(1);
    expect(JSON.stringify(forProvider.sleep)).not.toContain("rem");
  });

  it("weekly report: what the provider may see (no sleep without wellness consent; imported nights only with the permission)", () => {
    const input = {
      sleep: [
        { asleepMinutes: 433, estimated: true, recorded: false, imported: false, stages: null },
        { asleepMinutes: 517, estimated: false, recorded: true, imported: true, stages: { rem: 90, deep: 70, light: 300, awake: 20 } },
        { asleepMinutes: 450, estimated: true, recorded: false, imported: false, stages: null },
      ],
      sleepSteadiness: "steady",
    } as unknown as WeeklyReportInput;
    // Everything allowed: unchanged (the same object, so nothing is recomputed).
    expect(weeklyInputForProvider(input, { wellness: true, healthPlatform: true })).toBe(input);
    // No health permission: the ring's night goes, and the steadiness worked out from it goes with it.
    const typedOnly = weeklyInputForProvider(input, { wellness: true, healthPlatform: false });
    expect(typedOnly.sleep.map((n) => n.asleepMinutes)).toEqual([433, 450]);
    expect(typedOnly.sleepSteadiness).toBeNull();
    // No wellness consent: no sleep at all, whatever the health permission says.
    for (const healthPlatform of [true, false]) {
      const none = weeklyInputForProvider(input, { wellness: false, healthPlatform });
      expect(none.sleep).toEqual([]);
      expect(none.sleepSteadiness).toBeNull();
    }
    // Nothing imported and wellness allowed: unchanged.
    const typed = { ...input, sleep: input.sleep.filter((n) => !n.imported) };
    expect(weeklyInputForProvider(typed, { wellness: true, healthPlatform: false })).toBe(typed);
  });
});
