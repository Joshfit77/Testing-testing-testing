import { formatDuration } from "@/lib/domain/sleep";
import type { NightSlot } from "@/lib/domain/sleep-stats";
import { cn } from "@/lib/utils";

/** Recent nights as bars against the sleep goal. A night without data is an empty slot, never a zero. */
export function NightBars({ slots, goalMinutes, className }: { slots: NightSlot[]; goalMinutes: number; className?: string }) {
  const top = Math.max(goalMinutes * 1.25, ...slots.map((s) => s.night?.asleepMinutes ?? 0));
  const goalPct = (goalMinutes / top) * 100;
  return (
    <div className={cn("relative", className)}>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gold/60" style={{ bottom: `calc(1.25rem + ${goalPct}% * 0.56)` }} />
      <ol className="flex items-end justify-between gap-1" aria-label="Time asleep by night">
        {slots.map((s) => {
          const minutes = s.night?.asleepMinutes ?? null;
          const name = new Date(`${s.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
          return (
            <li key={s.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="sr-only">
                {name}: {minutes === null ? "not logged" : `${formatDuration(minutes)}${s.night?.asleepEstimated ? " in bed" : " asleep"}`}
              </span>
              <span aria-hidden className={cn("flex h-14 w-3 flex-col-reverse overflow-hidden rounded-full", minutes === null ? "border border-dashed border-border" : "bg-elevated")}>
                {minutes !== null && <span className={cn("w-full", minutes >= goalMinutes ? "bg-gold-gradient" : "bg-champagne")} style={{ height: `${Math.min(100, (minutes / top) * 100)}%` }} />}
              </span>
              <span aria-hidden className={cn("text-xs", s.isToday ? "font-bold text-gold-highlight" : "text-muted-foreground")}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-xs text-muted-foreground">Dashed line: your goal of {formatDuration(goalMinutes)}. Empty slot: nothing logged.</p>
    </div>
  );
}
