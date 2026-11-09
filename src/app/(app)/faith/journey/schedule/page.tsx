import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ChevronRight, Circle, Dot } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { chapterHref } from "@/lib/bible/books";
import type { PlanDay } from "@/lib/bible/plans";
import { formatReference } from "@/lib/bible/reference";
import { formatShortDate } from "@/lib/faith/dates";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { dateOfDay, loadActiveJourney, type JourneyView } from "@/server/services/journeys";

export const metadata = { title: "Journey schedule" };

function ScheduleDay({ view, d, isDone }: { view: JourneyView; d: PlanDay; isDone: boolean }) {
  const isToday = view.day === d.day;
  const state = isDone ? "Done" : isToday ? "Today" : view.day !== null && d.day < view.day ? "Not completed" : "Upcoming";
  return (
    <li id={`day-${d.day}`} className={cn("scroll-mt-20 rounded-2xl border bg-card p-3", isToday ? "border-gold" : isDone ? "border-gold-muted/60" : "border-border")}>
      <div className="flex items-start gap-3">
        {isDone ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden /> : isToday ? <Dot className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/60" aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
            <span className="font-semibold">
              Day {d.day} <span className="font-normal text-muted-foreground">· {formatShortDate(dateOfDay(view, d.day))}</span>
            </span>
            <span className={cn("text-xs font-semibold", isDone || isToday ? "text-gold" : "text-muted-foreground")}>
              {state}
              {state ? " · " : ""}
              {d.minutes} min
            </span>
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-3">
            {d.refs.map((r) => (
              <li key={formatReference(r)}>
                <Link href={chapterHref(r.bookId, r.chapter, r.verseStart)} className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-gold-highlight hover:underline">
                  {formatReference(r)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

/**
 * Every day of the journey. A day shows as done only when that day's reading and prayer were both marked complete;
 * today and later days can be opened and read ahead, but reading ahead doesn't complete them. Days already completed
 * before today are folded into one row, so the list starts at today (the journey links here with #day-N).
 */
export default async function JourneySchedulePage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const view = await loadActiveJourney(supabase, user.id, profile.timezone ?? "UTC");
  if (!view) redirect("/faith/journey");
  const done = new Set(view.completedDays);
  const isFolded = (day: number) => view.day !== null && day < view.day && done.has(day);
  const folded = view.plan.schedule.filter((d) => isFolded(d.day));
  const rest = view.plan.schedule.filter((d) => !isFolded(d.day));
  const first = folded[0]?.day;
  const last = folded.at(-1)?.day;
  const contiguous = first !== undefined && last !== undefined && last - first + 1 === folded.length;
  const foldedLabel = folded.length === 1 ? `Day ${first} complete` : contiguous ? `Days ${first}–${last} complete` : `${folded.length} days complete`;

  return (
    <div className="space-y-4">
      <BackLink href="/faith/journey">Journey</BackLink>
      <PageHeader
        eyebrow={`${view.durationDays}-day journey`}
        title={view.title}
        description={`${done.size} of ${view.durationDays} days complete. You can read ahead at any time; each day is marked complete on its own day.`}
        className="mb-2"
      />
      {folded.length > 0 && (
        <details className="group rounded-2xl border border-gold-muted/60 bg-card" data-testid="schedule-completed">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-3 py-2 font-semibold [&::-webkit-details-marker]:hidden">
            <CheckCircle2 className="size-5 shrink-0 text-gold" aria-hidden />
            <span className="flex-1">{foldedLabel}</span>
            <ChevronRight className="size-4 shrink-0 text-gold transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
          </summary>
          <ol className="space-y-2 px-2 pb-2">
            {folded.map((d) => (
              <ScheduleDay key={d.day} view={view} d={d} isDone />
            ))}
          </ol>
        </details>
      )}
      <ol className="space-y-2">
        {rest.map((d) => (
          <ScheduleDay key={d.day} view={view} d={d} isDone={done.has(d.day)} />
        ))}
      </ol>
    </div>
  );
}
