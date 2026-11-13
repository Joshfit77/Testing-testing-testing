import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatClock, formatDuration } from "@/lib/domain/sleep";
import { STEADINESS_TEXT } from "@/lib/domain/sleep-stats";
import type { ThirtyDaySummary } from "@/lib/domain/sleep-summary";

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The last 30 days from the member's own logged nights, with what each figure rests on. */
export function ThirtyDaySummaryCard({ summary, goalMinutes }: { summary: ThirtyDaySummary; goalMinutes: number }) {
  return (
    <section aria-labelledby="sleep-30-title" data-testid="sleep-30-day" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="sleep-30-title" className="font-display text-xl font-bold uppercase">
          Last 30 days
        </h2>
        <span className="text-xs text-muted-foreground">
          {fmtDate(summary.start)} – {fmtDate(summary.end)}
        </span>
      </div>
      {summary.status === "insufficient" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {summary.nightsLogged === 0 ? "No nights logged in the last 30 days." : `${summary.nightsLogged} of the ${summary.needed} nights needed are logged.`} Your 30-day summary appears once {summary.needed} nights are in, so
          a few nights don&apos;t stand in for a month.
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-elevated p-3">
              <dt className="text-xs text-muted-foreground">Average a night</dt>
              <dd className="font-display text-2xl font-bold text-gold-highlight">{formatDuration(summary.averageAsleep)}</dd>
              <dd className="text-xs text-muted-foreground">
                {formatDuration(summary.shortest)} – {formatDuration(summary.longest)}
              </dd>
            </div>
            <div className="rounded-xl bg-elevated p-3">
              <dt className="text-xs text-muted-foreground">At your {formatDuration(goalMinutes)} goal</dt>
              <dd className="font-display text-2xl font-bold text-gold-highlight">
                {summary.nightsAtGoal} of {summary.nightsLogged}
              </dd>
              <dd className="text-xs text-muted-foreground">logged nights</dd>
            </div>
            <div className="rounded-xl bg-elevated p-3">
              <dt className="text-xs text-muted-foreground">Nights logged</dt>
              <dd className="font-display text-2xl font-bold text-gold-highlight">{summary.nightsLogged} / 30</dd>
              <dd className="text-xs text-muted-foreground">
                {summary.recordedNights} recorded · {summary.selfReportedNights} by hand
              </dd>
            </div>
            <div className="rounded-xl bg-elevated p-3">
              <dt className="text-xs text-muted-foreground">Typical night</dt>
              <dd className="font-display text-2xl font-bold text-gold-highlight">{summary.typicalBed !== null ? formatClock(summary.typicalBed) : "—"}</dd>
              <dd className="text-xs text-muted-foreground">{summary.typicalWake !== null ? `up ${formatClock(summary.typicalWake)}` : "not enough nights"}</dd>
            </div>
          </dl>
          <ul className="mt-3 space-y-1 text-sm">
            {summary.change && (
              <li>
                {summary.change.direction === "same"
                  ? "The second half of the month averaged about the same as the first."
                  : `The second half of the month averaged ${formatDuration(summary.change.minutes)} ${summary.change.direction} a night than the first.`}
              </li>
            )}
            {summary.averageAsleepRecorded !== null && summary.selfReportedNights > 0 && <li>Recorded nights alone average {formatDuration(summary.averageAsleepRecorded)}.</li>}
            {summary.steadiness && <li>{STEADINESS_TEXT[summary.steadiness]}</li>}
          </ul>
          {summary.caveats.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground" aria-label="What these figures rest on">
              {summary.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </>
      )}
      <Link href="/progress/sleep/history?range=30d" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold-highlight underline">
        Every night in the last 30 days <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
