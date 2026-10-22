"use client";

import { useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chart palette. Single-series charts use brand gold. Multi-series categorical slots were
 * validated (dataviz validate_palette.js, dark mode on #171717): lightness band, chroma,
 * CVD separation, normal-vision floor and contrast all pass. Assign in this fixed order.
 */
export const SERIES_GOLD = "#C9A54C";
export const CATEGORICAL = ["#B08D3A", "#4A86C0", "#C46658"] as const;

const AXIS = { stroke: "#6b6b6b", fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = "#262626";

export interface SeriesDef {
  key: string;
  label: string;
  color?: string;
}

interface ChartFrameProps {
  title: string;
  description?: string;
  data: Record<string, string | number | null>[];
  xKey: string;
  series: SeriesDef[];
  /** Serializable formatting options (props may come from server components). */
  xFormat?: "date" | "weekday" | "raw";
  valueSuffix?: string;
  decimals?: number;
  children: React.ReactNode;
  className?: string;
  emptyMessage?: string;
}

function formatters(xFormat: ChartFrameProps["xFormat"], valueSuffix = "", decimals = 1) {
  const formatX = xFormat === "date" ? shortDate : xFormat === "weekday" ? weekdayShort : (v: string) => v;
  const f = 10 ** decimals;
  const formatValue = (v: number) => `${(Math.round(v * f) / f).toLocaleString("en-US")}${valueSuffix}`;
  return { formatX, formatValue };
}

function ChartFrame({ title, description, data, xKey, series, xFormat, valueSuffix, decimals, children, className, emptyMessage }: ChartFrameProps) {
  const [table, setTable] = useState(false);
  const id = useId();
  const hasData = data.some((d) => series.some((s) => d[s.key] != null && d[s.key] !== 0));
  const { formatX, formatValue: fmt } = formatters(xFormat, valueSuffix, decimals);
  return (
    <figure className={cn("rounded-2xl border border-border bg-card p-4 md:p-5", className)} aria-labelledby={`${id}-title`}>
      <figcaption className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 id={`${id}-title`} className="font-display text-base font-semibold uppercase tracking-wide">
            {title}
          </h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {hasData && (
          <button
            type="button"
            onClick={() => setTable((t) => !t)}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground"
            aria-label={table ? `Show ${title} as chart` : `Show ${title} as table`}
            aria-pressed={table}
          >
            {table ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
          </button>
        )}
      </figcaption>
      {series.length > 1 && hasData && !table && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
          {series.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color ?? CATEGORICAL[i % CATEGORICAL.length] }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {!hasData ? (
        <p className="flex h-40 items-center justify-center rounded-xl bg-elevated/40 px-4 text-center text-sm text-muted-foreground">
          {emptyMessage ?? "No data for this period yet."}
        </p>
      ) : table ? (
        <div className="max-h-72 overflow-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-elevated text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Date</th>
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-2 font-semibold">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={String(row[xKey])} className="border-t border-border">
                  <td className="px-3 py-1.5 text-muted-foreground">{formatX(String(row[xKey]))}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 tabular-nums">
                      {row[s.key] == null ? "—" : fmt(Number(row[s.key]))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-56 w-full">{children}</div>
      )}
    </figure>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  formatX,
  formatValue,
}: {
  active?: boolean;
  payload?: { name?: string | number; value?: number | string; color?: string; dataKey?: string | number }[];
  label?: string | number;
  formatX?: (v: string) => string;
  formatValue?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-elevated px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-foreground">{formatX ? formatX(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block size-2 rounded-sm" style={{ background: p.color }} aria-hidden />
          {p.name}: <span className="font-semibold tabular-nums text-foreground">{formatValue ? formatValue(Number(p.value)) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

type ChartProps = Omit<ChartFrameProps, "children"> & {
  yDomain?: [number | string, number | string];
  /** Optional horizontal target line (e.g. a daily calorie goal). */
  referenceLine?: { value: number; label: string };
};

export function BarSeriesChart(props: ChartProps) {
  const { data, xKey, series } = props;
  const { formatX, formatValue } = formatters(props.xFormat, props.valueSuffix, props.decimals);
  return (
    <ChartFrame {...props}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} {...AXIS} tickFormatter={formatX} minTickGap={8} />
          <YAxis {...AXIS} allowDecimals={false} tickFormatter={(v: number) => formatValue(v)} width={48} />
          <Tooltip cursor={{ fill: "rgba(201,165,76,0.08)" }} content={<ChartTooltip formatX={formatX} formatValue={formatValue} />} />
          {props.referenceLine && (
            <ReferenceLine
              y={props.referenceLine.value}
              stroke="#e8e2d0"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
              label={{ value: props.referenceLine.label, position: "insideTopRight", fill: "#a39e90", fontSize: 11 }}
            />
          )}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color ?? (series.length === 1 ? SERIES_GOLD : CATEGORICAL[i % CATEGORICAL.length])}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              stackId={undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function LineSeriesChart(props: ChartProps & { connectNulls?: boolean }) {
  const { data, xKey, series, yDomain, connectNulls = true } = props;
  const { formatX, formatValue } = formatters(props.xFormat, props.valueSuffix, props.decimals);
  return (
    <ChartFrame {...props}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} {...AXIS} tickFormatter={formatX} minTickGap={16} />
          <YAxis {...AXIS} domain={yDomain ?? ["auto", "auto"]} tickFormatter={formatValue} width={52} />
          <Tooltip cursor={{ stroke: "#8C7139", strokeWidth: 1 }} content={<ChartTooltip formatX={formatX} formatValue={formatValue} />} />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? (series.length === 1 ? SERIES_GOLD : CATEGORICAL[i % CATEGORICAL.length])}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 2, stroke: "#171717" }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#171717" }}
              connectNulls={connectNulls}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export const shortDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

export const weekdayShort = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
};
