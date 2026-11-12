"use client";

import { Component, useId, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Table2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORICAL, formatters, type SeriesDef, type XFormat } from "./chart-format";
import type { PlotProps } from "./chart-plots";

export { CATEGORICAL, SERIES_GOLD, shortDate, weekdayShort, type SeriesDef } from "./chart-format";

/**
 * The plots themselves (recharts) are a separate chunk, fetched after the page is interactive: the frame below (title,
 * description, legend, table view, empty state) renders at once, with a placeholder of the plot's exact size so
 * nothing moves when the plot arrives. The table view never needs the chunk, so the numbers are always reachable.
 */
const PlotPlaceholder = () => <div className="h-full w-full animate-pulse rounded-xl bg-elevated/40" data-testid="chart-loading" aria-hidden />;
const BarPlot = dynamic(() => import("./chart-plots").then((m) => m.BarPlot), { ssr: false, loading: PlotPlaceholder });
const LinePlot = dynamic(() => import("./chart-plots").then((m) => m.LinePlot), { ssr: false, loading: PlotPlaceholder });

/** If the plot's chunk can't load (offline after the page was cached, a deploy in between), say so and offer the table. */
class PlotBoundary extends Component<{ children: ReactNode; onShowTable: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl bg-elevated/40 px-4 text-center text-sm text-muted-foreground" role="status">
        <p>The chart couldn&apos;t load. Check your connection.</p>
        <button type="button" onClick={this.props.onShowTable} className="min-h-11 font-semibold text-gold-highlight underline-offset-4 hover:underline">
          Show the numbers as a table
        </button>
      </div>
    );
  }
}

interface ChartFrameProps {
  title: string;
  description?: string;
  data: Record<string, string | number | null>[];
  xKey: string;
  series: SeriesDef[];
  /** Serializable formatting options (props may come from server components). */
  xFormat?: XFormat;
  valueSuffix?: string;
  decimals?: number;
  children: ReactNode;
  className?: string;
  emptyMessage?: string;
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
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground"
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
        <div className="h-56 w-full">
          <PlotBoundary onShowTable={() => setTable(true)}>{children}</PlotBoundary>
        </div>
      )}
    </figure>
  );
}

type ChartProps = Omit<ChartFrameProps, "children"> & Pick<PlotProps, "yDomain" | "referenceLine">;

export function BarSeriesChart(props: ChartProps) {
  return (
    <ChartFrame {...props}>
      <BarPlot data={props.data} xKey={props.xKey} series={props.series} xFormat={props.xFormat} valueSuffix={props.valueSuffix} decimals={props.decimals} referenceLine={props.referenceLine} />
    </ChartFrame>
  );
}

export function LineSeriesChart(props: ChartProps & { connectNulls?: boolean }) {
  return (
    <ChartFrame {...props}>
      <LinePlot
        data={props.data}
        xKey={props.xKey}
        series={props.series}
        xFormat={props.xFormat}
        valueSuffix={props.valueSuffix}
        decimals={props.decimals}
        yDomain={props.yDomain}
        connectNulls={props.connectNulls}
      />
    </ChartFrame>
  );
}
