import { cmToFeetInches, displayWeight, feetInchesToCm, formatDuration, formatWeight, kgToLb, lbToKg, toKg } from "@/lib/domain/units";

describe("units", () => {
  it("converts kg and lb both ways", () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 2);
    expect(lbToKg(225)).toBeCloseTo(102.058, 2);
    expect(toKg(225, "imperial")).toBe(102.06);
    expect(toKg(100, "metric")).toBe(100);
  });
  it("formats display weights", () => {
    expect(displayWeight(100, "imperial")).toBe(220.5);
    expect(formatWeight(60, "metric")).toBe("60 kg");
    expect(formatWeight(null, "metric")).toBe("—");
  });
  it("handles feet/inches round trips", () => {
    expect(cmToFeetInches(180)).toEqual({ feet: 5, inches: 11 });
    expect(cmToFeetInches(182.88)).toEqual({ feet: 6, inches: 0 });
    expect(feetInchesToCm(5, 10)).toBe(177.8);
  });
  it("formats durations", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(-5)).toBe("0:00");
  });
});
