"use client";

/**
 * The drawn part of every chart (recharts, ~110 KB gzipped). Loaded on demand by ./charts.tsx after the page's own
 * JavaScript, so screens with charts become usable sooner; the title, legend, table view and empty state don't wait.
 */
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, CATEGORICAL, GRID, SERIES_GOLD, formatters, type SeriesDef, type XFormat } from "./chart-format";

export interface PlotProps {
  data: Record<string, string | number | null>[];
  xKey: string;
  series: SeriesDef[];
  xFormat?: XFormat;
  valueSuffix?: string;
  decimals?: number;
  yDomain?: [number | string, number | string];
  /** Optional horizontal target line (e.g. a daily calorie goal). */
  referenceLine?: { value: number; label: string };
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

export function BarPlot(props: PlotProps) {
  const { data, xKey, series } = props;
  const { formatX, formatValue } = formatters(props.xFormat, props.valueSuffix, props.decimals);
  return (
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
  );
}

export function LinePlot(props: PlotProps & { connectNulls?: boolean }) {
  const { data, xKey, series, yDomain, connectNulls = true } = props;
  const { formatX, formatValue } = formatters(props.xFormat, props.valueSuffix, props.decimals);
  return (
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
  );
}
