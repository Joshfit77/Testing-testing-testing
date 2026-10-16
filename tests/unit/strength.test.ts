import { bestsFromSets, detectNewRecords, estimateOneRepMax, totalVolume } from "@/lib/domain/strength";

describe("estimateOneRepMax", () => {
  it("uses Epley for 2–12 reps", () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 2);
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });
  it("refuses unreliable inputs", () => {
    expect(estimateOneRepMax(100, 20)).toBeNull();
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
  });
});

describe("volume", () => {
  it("counts only completed working sets", () => {
    expect(
      totalVolume([
        { reps: 5, weightKg: 100, completed: true },
        { reps: 5, weightKg: 100, completed: false },
        { reps: 10, weightKg: 40, completed: true, isWarmup: true },
        { reps: 8, weightKg: 80, completed: true },
      ]),
    ).toBe(1140);
  });
});

describe("personal records", () => {
  const sets = [
    { reps: 5, weightKg: 100, completed: true },
    { reps: 3, weightKg: 110, completed: true },
    { reps: 1, weightKg: 125, completed: false },
    { reps: 12, weightKg: 0, completed: true },
    { reps: null, weightKg: null, durationSeconds: 60, completed: true },
  ];
  it("extracts the best of each record type", () => {
    const bests = bestsFromSets(sets);
    const by = Object.fromEntries(bests.map((b) => [b.recordType, b.value]));
    expect(by.max_weight).toBe(110);
    expect(by.estimated_1rm).toBeCloseTo(121, 0);
    expect(by.max_set_volume).toBe(500);
    expect(by.max_reps).toBe(12);
    expect(by.max_duration).toBe(60);
  });
  it("only reports genuine improvements", () => {
    const prev = [
      { recordType: "max_weight" as const, value: 110 },
      { recordType: "estimated_1rm" as const, value: 115 },
    ];
    const fresh = detectNewRecords(prev, bestsFromSets(sets)).map((r) => r.recordType).sort();
    expect(fresh).toEqual(["estimated_1rm", "max_duration", "max_reps", "max_set_volume"]);
  });
});
