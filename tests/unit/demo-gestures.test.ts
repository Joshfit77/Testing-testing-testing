import { describe, expect, it } from "vitest";
import { dragIntent, frameIndex, frameTime, isTap, nextView, scrubFraction, swipeStep } from "@/lib/demo-gestures";

describe("finger gestures on the 2.5D demonstration", () => {
  it("tells a tap from a drag and a sideways scrub from a page scroll", () => {
    expect(isTap(3, -4, 120)).toBe(true);
    expect(isTap(3, -4, 900)).toBe(false);
    expect(isTap(14, 0, 100)).toBe(false);
    expect(dragIntent(4, 3)).toBe("undecided");
    expect(dragIntent(20, 6)).toBe("scrub");
    expect(dragIntent(-20, 6)).toBe("scrub");
    expect(dragIntent(5, 22)).toBe("scroll");
  });

  it("moves one whole rep across the picture's width, wrapping on a loop and stopping on a one-shot", () => {
    expect(scrubFraction(0.2, 150, 300, true)).toBeCloseTo(0.7);
    expect(scrubFraction(0.8, 150, 300, true)).toBeCloseTo(0.3);
    expect(scrubFraction(0.1, -60, 300, true)).toBeCloseTo(0.9);
    expect(scrubFraction(0.8, 150, 300, false)).toBeCloseTo(0.999);
    expect(scrubFraction(0.1, -60, 300, false)).toBe(0);
    expect(scrubFraction(0.5, 10, 0, true)).toBeGreaterThanOrEqual(0);
  });

  it("maps a position to its scrub frame and the frame back to a time inside it", () => {
    expect(frameIndex(0, 49)).toBe(0);
    expect(frameIndex(0.5, 49)).toBe(24);
    expect(frameIndex(0.9999, 49)).toBe(48);
    expect(frameIndex(1, 49)).toBe(48);
    expect(frameIndex(-0.2, 49)).toBe(0);
    expect(frameTime(0, 49, 3.267)).toBeCloseTo(0.01);
    expect(frameTime(24, 49, 3.267)).toBeCloseTo((24 / 49) * 3.267 + 0.01);
    // The same frame in the 0.5x file sits at twice the time.
    expect(frameTime(24, 49, 6.533)).toBeCloseTo((24 / 49) * 6.533 + 0.01);
    expect(frameTime(48, 49, 3.267)).toBeLessThan(3.267);
    expect(frameTime(3, 49, Number.NaN)).toBe(0);
  });

  it("changes camera view only on a clear sideways swipe, wrapping round", () => {
    expect(swipeStep(-80, 10, 200)).toBe(1);
    expect(swipeStep(80, 10, 200)).toBe(-1);
    expect(swipeStep(-30, 0, 200)).toBe(0);
    expect(swipeStep(-80, 70, 200)).toBe(0);
    expect(swipeStep(-80, 0, 1200)).toBe(0);
    expect(nextView(0, 1, 3)).toBe(1);
    expect(nextView(2, 1, 3)).toBe(0);
    expect(nextView(0, -1, 3)).toBe(2);
  });
});
