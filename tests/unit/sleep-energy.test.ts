import { formatClock } from "@/lib/domain/sleep";
import { energyRhythm } from "@/lib/domain/sleep-energy";

const WAKE = 6 * 60 + 30;
const BED = 22 * 60 + 30;

describe("energy rhythm v1", () => {
  it("rises in the morning, dips in the early afternoon and winds down before bed", () => {
    const r = energyRhythm(WAKE, BED, 480, 480, 0);
    const level = (h: number) => r.points[h]!.level!;
    expect(r.points[3]!.level).toBeNull(); // asleep
    expect(level(9)).toBeGreaterThan(level(7)); // morning rise
    expect(level(13)).toBeLessThan(level(10)); // afternoon dip
    expect(level(16)).toBeGreaterThan(level(13)); // second wind
    expect(level(21)).toBeLessThan(level(18)); // wind-down
    expect(formatClock(r.windDown)).toBe("9:30 PM");
    expect(r.peaks.length).toBeGreaterThan(0);
    expect(r.peaks[0]!.start).toBeGreaterThanOrEqual(8 * 60);
    expect(r.peaks[0]!.start).toBeLessThanOrEqual(11 * 60);
    expect(r.dips.some((d) => d.start >= 12 * 60 && d.start <= 15 * 60)).toBe(true);
    expect(r.scale).toBe(1);
    expect(r.assumptions.length).toBe(4);
  });

  it("lowers the whole curve after a short night and with sleep debt, never below 60%", () => {
    const rested = energyRhythm(WAKE, BED, 480, 480, 0);
    const tired = energyRhythm(WAKE, BED, 300, 480, 600);
    for (let h = 7; h < 22; h++) expect(tired.points[h]!.level!).toBeLessThan(rested.points[h]!.level!);
    expect(tired.scale).toBe(0.6);
    expect(energyRhythm(WAKE, BED, null, 480, 0).scale).toBe(1);
  });

  it("handles a bedtime after midnight", () => {
    const r = energyRhythm(8 * 60, 60, 480, 480, 0);
    expect(r.points[0]!.level).not.toBeNull(); // midnight, still up
    expect(r.points[4]!.level).toBeNull();
    expect(formatClock(r.windDown)).toBe("12:00 AM");
  });
});
