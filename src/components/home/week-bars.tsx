import type { WeeklyActivityDay } from "@/lib/domain/activity-week";
import { cn } from "@/lib/utils";

/** Seven day bars (Mon–Sun). Gold for workouts, champagne for runs, bronze for walks; text labels for screen readers. */
export function WeekBars({ days, className }: { days: WeeklyActivityDay[]; className?: string }) {
  const max = Math.max(1, ...days.map((d) => d.workouts + d.runs + d.walks));
  return (
    <ol className={cn("flex items-end justify-between gap-1", className)} aria-label="Sessions by day this week">
      {days.map((d) => {
        const total = d.workouts + d.runs + d.walks;
        const parts = [
          d.workouts ? `${d.workouts} workout${d.workouts > 1 ? "s" : ""}` : null,
          d.runs ? `${d.runs} run${d.runs > 1 ? "s" : ""}` : null,
          d.walks ? `${d.walks} walk${d.walks > 1 ? "s" : ""}` : null,
        ].filter(Boolean);
        const name = new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
        return (
          <li key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <span className="sr-only">
              {name}: {parts.length ? parts.join(", ") : d.isFuture ? "upcoming" : "no sessions"}
            </span>
            <span aria-hidden className="flex h-10 w-2.5 flex-col-reverse overflow-hidden rounded-full bg-elevated">
              {total > 0 && (
                <>
                  <span className="w-full bg-gold-gradient" style={{ height: `${(d.workouts / max) * 100}%` }} />
                  <span className="w-full bg-champagne" style={{ height: `${(d.runs / max) * 100}%` }} />
                  <span className="w-full bg-bronze" style={{ height: `${(d.walks / max) * 100}%` }} />
                </>
              )}
            </span>
            <span aria-hidden className={cn("text-xs", d.isToday ? "font-bold text-gold-highlight" : "text-muted-foreground")}>
              {d.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
