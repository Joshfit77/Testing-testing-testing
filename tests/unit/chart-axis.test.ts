import { describe, expect, it } from "vitest";
import { compactTick, yAxisWidth } from "@/components/charts/chart-format";

describe("chart y-axis labels", () => {
  it("are short: thousands as k, hundreds whole, small numbers with at most one decimal", () => {
    expect(compactTick(6000)).toBe("6k");
    expect(compactTick(6500)).toBe("6.5k");
    expect(compactTick(12_400)).toBe("12k");
    expect(compactTick(360, " lb")).toBe("360 lb");
    expect(compactTick(337.5, " lb")).toBe("338 lb");
    expect(compactTick(72.5, " kg")).toBe("72.5 kg");
    expect(compactTick(7.25, "", 2)).toBe("7.3");
    expect(compactTick(8, "", 0)).toBe("8");
    expect(compactTick(-1500)).toBe("-1.5k");
  });

  it("get an axis wide enough for the widest label, so '360 lb' is never cut to '60 lb'", () => {
    const w = yAxisWidth([300, 362.5], " lb");
    // "450 lb" (6 characters) at ~7px each, plus room for the tick gap.
    expect(w).toBeGreaterThanOrEqual(6 * 7 + 8);
    expect(yAxisWidth([1200, 6400])).toBeGreaterThanOrEqual(4 * 7);
    expect(yAxisWidth([60, 72.5], " kg")).toBeGreaterThanOrEqual(7 * 7);
  });

  it("stays between sensible bounds", () => {
    expect(yAxisWidth([])).toBe(40);
    expect(yAxisWidth([1, 2])).toBeGreaterThanOrEqual(32);
    expect(yAxisWidth([123_456_789], " calories")).toBeLessThanOrEqual(80);
  });
});
