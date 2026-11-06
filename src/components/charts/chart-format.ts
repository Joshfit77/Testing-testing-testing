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
