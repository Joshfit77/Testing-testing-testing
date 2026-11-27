import { describe, expect, it } from "vitest";
import { splitRows } from "@/lib/domain/run-splits";

const MI = 1609.344;

describe("run split table", () => {
  it("labels a short final split by its real length (a 3.11-mile run is not four miles)", () => {
    const total = 5000; // 3.11 mi
    const rows = splitRows([
      { index: 1, unit: "mi", distance_m: Math.round(MI), moving_s: 523, split_s: 523 },
      { index: 2, unit: "mi", distance_m: Math.round(2 * MI), moving_s: 1056, split_s: 533 },
      { index: 3, unit: "mi", distance_m: Math.round(3 * MI), moving_s: 1569, split_s: 513 },
      { index: 4, unit: "mi", distance_m: total, moving_s: 1625, split_s: 56 },
    ]);
    expect(rows.map((r) => r.label)).toEqual(["Mile 1", "Mile 2", "Mile 3", "0.11 mi"]);
    expect(rows.at(-1)).toMatchObject({ partial: true, seconds: 56 });
    expect(rows.filter((r) => r.partial)).toHaveLength(1);
  });

  it("uses each split's own time, or the difference of cumulative times when split_s is missing", () => {
    const rows = splitRows([
      { index: 1, unit: "km", distance_m: 1000, moving_s: 300 },
      { index: 2, unit: "km", distance_m: 2000, moving_s: 610 },
    ]);
    expect(rows.map((r) => [r.label, r.seconds])).toEqual([["Km 1", 300], ["Km 2", 310]]);
  });

  it("whole recorder splits (cumulative index × unit) are never marked partial", () => {
    const rows = splitRows([1, 2, 3].map((i) => ({ index: i, unit: "mi" as const, distance_m: Math.round(i * MI), moving_s: i * 500 })));
    expect(rows.every((r) => !r.partial)).toBe(true);
  });
});
