/**
 * Distance error against ground truth on controlled GPS traces (tests/fixtures/gps-traces.ts): realistic phone
 * noise, multipath spikes, dropouts, pauses, standing still, out-of-order delivery, a poor first fix and approximate
 * location. Bounds are on the worst of several seeds. The traces are a model, not recordings from a real phone:
 * docs/GPS_ACCURACY.md lists what still needs testing outdoors.
 */
import { describe, expect, it } from "vitest";
import { gpsDiagnostics, haversine, routeForSave } from "@/lib/domain/gps-track";
import { record } from "../fixtures/gps-harness";
import { scenarios, type Scenario } from "../fixtures/gps-traces";

const SEEDS = [1, 2, 3, 4, 5, 6];
const NAMES = scenarios(1).map((s) => s.name);
const byName = (name: string, seed: number): Scenario => {
  const s = scenarios(seed).find((x) => x.name === name);
  if (!s) throw new Error(name);
  return s;
};
/** Worst relative error over the seeds (signed, the one furthest from zero). */
function worst(name: string, against: "truth" | "observable" = "truth"): number {
  let w = 0;
  for (const seed of SEEDS) {
    const sc = byName(name, seed);
    const e = (record(sc).distanceM - sc[against]) / sc[against];
    if (Math.abs(e) > Math.abs(w)) w = e;
  }
  return w;
}
const find = (prefix: string) => NAMES.find((n) => n.startsWith(prefix))!;

describe("GPS distance accuracy on controlled traces", () => {
  it("open-sky run within ±2%", () => {
    expect(Math.abs(worst(find("Run: 5 km park loop")))).toBeLessThan(0.02);
  });

  it("intervals with speed changes within ±3%", () => {
    expect(Math.abs(worst(find("Intervals")))).toBeLessThan(0.03);
  });

  it("pausing excludes the paused stretch and stays within ±2%", () => {
    expect(Math.abs(worst(find("Run with a 3-minute pause")))).toBeLessThan(0.02);
  });

  it("out-of-order and duplicate deliveries change nothing (within ±2%)", () => {
    expect(Math.abs(worst(find("Run with out-of-order")))).toBeLessThan(0.02);
  });

  it("multipath spikes are ignored (within +6%)", () => {
    const w = worst(find("Run with multipath spikes"));
    expect(w).toBeLessThan(0.06);
    expect(w).toBeGreaterThan(-0.03);
    const s = record(byName(find("Run with multipath spikes"), 1));
    expect(s.rejected.jump).toBeGreaterThan(0);
  });

  it("walking in a city reads close to the truth (raw summing read 30–50% long)", () => {
    expect(worst(find("Walk in a city"))).toBeLessThan(0.12);
    expect(worst(find("Walk: city blocks"))).toBeLessThan(0.1);
    expect(worst(find("Walk in a city"))).toBeGreaterThan(-0.05);
  });

  it("a slow walk is still counted (no more than 5% short)", () => {
    expect(worst(find("Slow walk"))).toBeGreaterThan(-0.05);
    expect(worst(find("Slow walk"))).toBeLessThan(0.05);
  });

  it("standing still for 10 minutes adds almost nothing", () => {
    for (const seed of SEEDS) {
      const s = record(byName(find("Standing still"), seed));
      expect(s.distanceM).toBeLessThan(30);
      expect(s.signalLost).toBe(false);
    }
  });

  it("a poor, biased first fix doesn't inflate the walk (within +10%)", () => {
    expect(worst(find("Walk starting with a poor"))).toBeLessThan(0.1);
  });

  it("tunnels: nothing is counted across a gap, the rest is measured within ±2%, and the gap is reported", () => {
    expect(Math.abs(worst(find("Run through two"), "observable"))).toBeLessThan(0.02);
    const sc = byName(find("Run through two"), 1);
    const s = record(sc);
    expect(s.gaps).toBe(2);
    expect(s.lines.length).toBe(3);
    // About 100 m per 30 s tunnel at 3.3 m/s, reported as not counted.
    expect(s.stats!.uncountedGapM).toBeGreaterThan(150);
    expect(s.stats!.uncountedGapM).toBeLessThan(sc.truth - sc.observable + 10);
  });

  it("approximate location (precise location off): nothing is counted and the reason is surfaced", () => {
    const sc = byName(find("Browser with precise location off"), 1);
    const s = record(sc);
    expect(s.distanceM).toBe(0);
    expect(s.status).toBe("finished");
    const d = gpsDiagnostics(s, sc.finishAt);
    expect(d.hints).toContain("precise_off");
    expect(d.ignored.inaccurate).toBe(sc.fixes.length);
  });

  it("the saved route matches the counted distance (the server check allows 20%)", () => {
    for (const name of NAMES.filter((n) => !n.startsWith("Browser") && !n.startsWith("Standing"))) {
      const s = record(byName(name, 2));
      const route = routeForSave(s)!;
      let m = 0;
      for (const line of route.coordinates) for (let i = 1; i < line.length; i++) m += haversine({ lng: line[i - 1]![0], lat: line[i - 1]![1] }, { lng: line[i]![0], lat: line[i]![1] });
      expect(m, name).toBeLessThan(s.distanceM * 1.05 + 20);
      expect(m, name).toBeGreaterThan(s.distanceM * 0.9 - 20);
    }
  });
});

describe("GPS diagnostics", () => {
  it("summarises the recording without any position", () => {
    const sc = byName(find("Run with multipath spikes"), 3);
    const s = record(sc);
    const d = gpsDiagnostics(s, sc.finishAt);
    expect(d.accepted).toBeGreaterThan(800);
    expect(d.received).toBeGreaterThanOrEqual(d.accepted);
    expect(d.meanIntervalS).toBeGreaterThan(0.8);
    expect(d.meanIntervalS).toBeLessThan(1.3);
    expect(d.ignored.outliers).toBeGreaterThan(0);
    const json = JSON.stringify(d);
    expect(json).not.toMatch(/lat|lng|-75\.|40\.0/);
  });

  it("flags slow updates (a throttled background browser)", () => {
    const sc = byName(find("Run: 5 km park loop"), 1);
    const sparse = { ...sc, fixes: sc.fixes.filter((_, i) => i % 8 === 0) };
    const d = gpsDiagnostics(record(sparse), sc.finishAt);
    expect(d.hints).toContain("slow_updates");
  });
});
