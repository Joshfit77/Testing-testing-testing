import { formatDuration } from "@/lib/domain/sleep";
import type { TrendPoint } from "@/lib/domain/sleep-analytics";
import { cn } from "@/lib/utils";

/** Average time asleep per week or month as bars against the goal. A bucket with no nights is an empty slot, never a zero. */
export function TrendBars({ points, goalMinutes, unit, className }: { points: TrendPoint[]; goalMinutes: number; unit: "week" | "month"; className?: string }) {
  const top = Math.max(goalMinutes * 1.25, ...points.map((p) => p.avgAsleep ?? 0));
  const goalPct = (goalMinutes / top) * 100;
  const many = points.length > 8;
  return (
    <div className={cn("relative", className)}>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gold/60" style={{ bottom: `calc(1.25rem + ${goalPct}% * 0.56)` }} />
      <ol className="flex items-end justify-between gap-1" aria-label={`Average time asleep by ${unit}`}>
        {points.map((p, i) => (
          <li key={p.start} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="sr-only">
              {unit === "week" ? `Week from ${p.label}` : p.label}: {p.avgAsleep === null ? "nothing logged" : `${formatDuration(p.avgAsleep)} on average over ${p.nights} night${p.nights === 1 ? "" : "s"}, ${p.atGoal} at goal`}
            </span>
            <span aria-hidden className={cn("flex h-14 w-3 flex-col-reverse overflow-hidden rounded-full", p.avgAsleep === null ? "border border-dashed border-border" : "bg-elevated")}>
              {p.avgAsleep !== null && <span className={cn("w-full", p.avgAsleep >= goalMinutes ? "bg-gold-gradient" : "bg-champagne")} style={{ height: `${Math.min(100, (p.avgAsleep / top) * 100)}%` }} />}
            </span>
            <span aria-hidden className={cn("truncate text-xs text-muted-foreground", many && i % 2 === 1 && "invisible")}>
              {p.label}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-1 text-xs text-muted-foreground">Dashed line: your goal of {formatDuration(goalMinutes)}. Empty slot: nothing logged that {unit}.</p>
    </div>
  );
}
