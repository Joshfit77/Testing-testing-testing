/** Chart palette, axis styling and value/date formatting, shared by the chart frame and the (lazily loaded) plots. */

/**
 * Chart palette. Single-series charts use brand gold. Multi-series categorical slots were
 * validated (dataviz validate_palette.js, dark mode on #171717): lightness band, chroma,
 * CVD separation, normal-vision floor and contrast all pass. Assign in this fixed order.
 */
export const SERIES_GOLD = "#C9A54C";
export const CATEGORICAL = ["#B08D3A", "#4A86C0", "#C46658"] as const;

export const AXIS = { stroke: "#6b6b6b", fontSize: 12, tickLine: false, axisLine: false } as const;
export const GRID = "#262626";

export interface SeriesDef {
  key: string;
  label: string;
  color?: string;
}

export type XFormat = "date" | "weekday" | "raw";

export function formatters(xFormat: XFormat | undefined, valueSuffix = "", decimals = 1) {
  const formatX = xFormat === "date" ? shortDate : xFormat === "weekday" ? weekdayShort : (v: string) => v;
  const f = 10 ** decimals;
  const formatValue = (v: number) => `${(Math.round(v * f) / f).toLocaleString("en-US")}${valueSuffix}`;
  return { formatX, formatValue };
}

export const shortDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

export const weekdayShort = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
};

/**
 * A y-axis tick in a few characters, so it is never cut off on a phone: "6k", "12.5k", "360 lb", "72.5 kg". The
 * tooltip and the table view still show the full value.
 */
export function compactTick(v: number, valueSuffix = "", decimals = 1): string {
  const a = Math.abs(v);
  let n: string;
  if (a >= 10_000) n = `${Math.round(v / 1000)}k`;
  else if (a >= 1000) n = `${Math.round(v / 100) / 10}k`;
  else if (a >= 100) n = String(Math.round(v));
  else {
    const f = 10 ** Math.min(1, Math.max(0, decimals));
    n = String(Math.round(v * f) / f);
  }
  return `${n}${valueSuffix}`;
}

/** Axis label font (AXIS.fontSize 12): a generous average character width, in px. */
const TICK_CHAR_PX = 7.2;

/**
 * Width (px) of the y-axis that fits the widest tick label for these values. Ticks can run a little past the data,
 * so the extremes are widened by a quarter before formatting.
 */
export function yAxisWidth(values: readonly number[], valueSuffix = "", decimals = 1): number {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return 40;
  const lo = Math.min(...finite, 0);
  const hi = Math.max(...finite, 0);
  const candidates = [lo, hi, lo * 1.25, hi * 1.25, lo + (hi - lo) / 3];
  let chars = Math.max(...candidates.map((v) => compactTick(v, valueSuffix, decimals).length));
  // Below 100 a tick can carry a decimal (72.5) even when the extremes happen not to.
  if (decimals > 0 && Math.max(Math.abs(lo), Math.abs(hi)) * 1.25 < 100) chars = Math.max(chars, compactTick(-99.5, valueSuffix, decimals).length - (lo < 0 ? 0 : 1));
  return Math.min(80, Math.max(32, Math.ceil(chars * TICK_CHAR_PX) + 10));
}
