import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { addFix, pauseTrack, routeForLines, routeForSave, startTrack, type TrackState } from "@/lib/domain/gps-track";

/**
 * The recorder screen redraws every second for the clock. Its route preview simplifies every point recorded so far, so it
 * is recomputed only when the track's lines change (a point was added), never on a clock tick or a rejected fix.
 */
const T0 = Date.UTC(2026, 10, 26, 7, 0, 0);
const fix = (i: number, accuracy = 5) => ({ lat: 40 + (i * 3) / 111_195, lng: -75, accuracy, t: T0 + i * 1000 });

describe("route preview memoization", () => {
  it("routeForLines gives exactly the saved route", () => {
    let t: TrackState = startTrack({ id: "r", kind: "run", unit: "km", now: T0 - 1000 });
    for (let i = 0; i < 500; i++) t = addFix(t, fix(i)).state;
    expect(routeForLines(t.lines, 600)).toEqual(routeForSave(t, 600));
    expect(routeForLines(t.lines)).toEqual(routeForSave(t));
  });

  it("the lines keep their identity unless a point is added (so the memo holds between points)", () => {
    let t: TrackState = startTrack({ id: "r", kind: "run", unit: "km", now: T0 - 1000 });
    for (let i = 0; i < 10; i++) t = addFix(t, fix(i)).state;
    const before = t.lines;
    // A reading too inaccurate to use: the track may change (diagnostics), the lines don't.
    expect(addFix(t, fix(10, 500)).state.lines).toBe(before);
    expect(pauseTrack(t, T0 + 11_000).lines).toBe(before);
    // Accepted fixes: the lines change exactly when one adds a point (a fix that only moves the smoothed position
    // within the minimum spacing leaves them, and the preview, alone).
    const points = (s: TrackState) => s.lines.reduce((n, l) => n + l.length, 0);
    let changed = 0;
    for (let i = 10; i < 40; i++) {
      const next = addFix(t, fix(i)).state;
      expect(next.lines !== t.lines).toBe(points(next) !== points(t));
      if (next.lines !== t.lines) changed++;
      t = next;
    }
    expect(changed).toBeGreaterThan(5);
  });

  it("the recorder computes its preview through useMemo keyed on the lines", () => {
    const src = readFileSync("src/components/run/gps-recorder.tsx", "utf8");
    expect(src).toMatch(/useMemo\(\(\) => \(lines \? routeForLines\(lines, 600\) : null\), \[lines\]\)/);
    expect(src).not.toMatch(/routeForSave\(track, 600\)/);
  });
});
