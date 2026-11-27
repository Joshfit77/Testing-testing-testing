import { describe, expect, it } from "vitest";
import { formatVolume, toKg } from "@/lib/domain/units";
import { totalVolume } from "@/lib/domain/strength";

describe("training volume is shown in whole units", () => {
  it("135 lb × 8 + 145 lb × 6 reads 1,950 lb, not the kg round-trip's 1949.9 lb", () => {
    const sets = [
      { weightKg: toKg(135, "imperial"), reps: 8, isWarmup: false, completed: true },
      { weightKg: toKg(145, "imperial"), reps: 6, isWarmup: false, completed: true },
    ];
    const kg = totalVolume(sets as Parameters<typeof totalVolume>[0]);
    expect(formatVolume(kg, "imperial")).toBe("1,950 lb");
  });
  it("metric, large totals and missing values", () => {
    expect(formatVolume(12345.6, "metric")).toBe("12,346 kg");
    expect(formatVolume(0, "metric")).toBe("0 kg");
    expect(formatVolume(null, "imperial")).toBe("—");
  });
});
