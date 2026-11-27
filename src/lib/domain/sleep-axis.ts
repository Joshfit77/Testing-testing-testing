/**
 * Time-axis ticks for the nightly sleep-stage chart. Ticks sit on whole local hours in the night's own time zone (so
 * a half-hour zone such as India still gets "2 AM", not "2:30 AM"), every two hours for an ordinary night, with short
 * labels ("11 PM"). Labels too close to either end, or to each other, are dropped so nothing overlaps on a phone.
 */
import { clockMinutesInTz } from "@/lib/domain/sleep";

/** No tick label within this share of the chart's width from either end. */
export const AXIS_EDGE_PCT = 8;
/** Smallest gap between two tick labels, as a share of the chart's width (about 34px on a 393px phone). */
export const AXIS_MIN_GAP_PCT = 13;
/** Hours between ticks, smallest first; two hours fits every ordinary night. */
const STEPS_HOURS = [2, 3, 4, 6, 12];

const MINUTE_MS = 60_000;
const QUARTER_MS = 15 * MINUTE_MS;

export interface AxisTick {
  /** Position from the left edge, 0–100. */
  left: number;
  label: string;
}

/** "11 PM", "12 AM", "1 PM": a local clock time on the hour, short. */
export function shortHourLabel(clockMinutes: number): string {
  const h = Math.floor((((Math.round(clockMinutes) % 1440) + 1440) % 1440) / 60);
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
}

export function stageAxisTicks(bedAt: string, wakeAt: string, timeZone: string): AxisTick[] {
  const start = Date.parse(bedAt);
  const end = Date.parse(wakeAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const span = end - start;
  const stepHours = STEPS_HOURS.find((h) => ((h * 60 * MINUTE_MS) / span) * 100 >= AXIS_MIN_GAP_PCT) ?? 12;
  const ticks: AxisTick[] = [];
  // Every real UTC offset is a multiple of 15 minutes, so local whole hours always fall on a quarter hour in UTC.
  for (let t = Math.ceil(start / QUARTER_MS) * QUARTER_MS; t < end; t += QUARTER_MS) {
    const clock = clockMinutesInTz(new Date(t).toISOString(), timeZone);
    if (clock % (stepHours * 60) !== 0) continue;
    const left = ((t - start) / span) * 100;
    if (left < AXIS_EDGE_PCT || left > 100 - AXIS_EDGE_PCT) continue;
    // A repeated hour when the clocks go back would otherwise put two labels almost on top of each other.
    const prev = ticks[ticks.length - 1];
    if (prev && left - prev.left < AXIS_MIN_GAP_PCT) continue;
    ticks.push({ left, label: shortHourLabel(clock) });
  }
  return ticks;
}
