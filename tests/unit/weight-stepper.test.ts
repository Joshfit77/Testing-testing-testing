import { describe, expect, it } from "vitest";
import { stepValue } from "@/components/workout/current-set-card";

describe("current set stepper (− / +)", () => {
  it("snaps an odd weight to the step in the tapped direction", () => {
    expect(stepValue(292.1, 1, 5)).toBe(295);
    expect(stepValue(292.1, -1, 5)).toBe(290);
    expect(stepValue(52.9, 1, 2.5)).toBe(55);
    expect(stepValue(52.9, -1, 2.5)).toBe(52.5);
  });

  it("moves a value already on the step by one whole step", () => {
    expect(stepValue(295, 1, 5)).toBe(300);
    expect(stepValue(295, -1, 5)).toBe(290);
    expect(stepValue(60, 1, 2.5)).toBe(62.5);
    expect(stepValue(62.5, -1, 2.5)).toBe(60);
    expect(stepValue(8, 1, 1)).toBe(9);
  });

  it("treats float noise as on the step", () => {
    expect(stepValue(0.1 + 0.2 + 299.7, 1, 5)).toBe(305);
  });

  it("never goes below zero, and − on an empty field leaves it empty", () => {
    expect(stepValue(3, -1, 5)).toBe(0);
    expect(stepValue(0, -1, 5)).toBe(0);
    expect(stepValue(null, -1, 5)).toBeNull();
    expect(stepValue(null, 1, 5)).toBe(5);
  });
});
