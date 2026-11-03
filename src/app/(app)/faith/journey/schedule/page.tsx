import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle, Dot } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { chapterHref } from "@/lib/bible/books";
import { formatReference } from "@/lib/bible/reference";
import { formatShortDate } from "@/lib/faith/dates";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { dateOfDay, loadActiveJourney } from "@/server/services/journeys";

export const metadata = { title: "Journey schedule" };

/**
 * Every day of the journey. A day shows as done only when that day's reading and prayer were both marked complete;
 * today and later days can be opened and read ahead, but reading ahead doesn't complete them.
 */
export default async function JourneySchedulePage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const view = await loadActiveJourney(supabase, user.id, profile.timezone ?? "UTC");
  if (!view) redirect("/faith/journey");
  const done = new Set(view.completedDays);

  return (
    <div className="space-y-4">
      <BackLink href="/faith/journey">Journey</BackLink>
      <PageHeader
        eyebrow={`${view.durationDays}-day journey${view.attempt.number > 1 ? ` · attempt ${view.attempt.number}` : ""}`}
        title={view.title}
        description={`${done.size} of ${view.durationDays} days complete. You can read ahead at any time; each day is marked complete on its own day.`}
        className="mb-2"
      />
      <ol className="space-y-2">
        {view.plan.schedule.map((d) => {
          const isDone = done.has(d.day);
          const isToday = view.day === d.day;
          const state = isDone ? "Done" : isToday ? "Today" : view.day !== null && d.day < view.day ? "Not completed" : "Upcoming";
          return (
            <li key={d.day} id={`day-${d.day}`} className={cn("rounded-2xl border bg-card p-3", isToday ? "border-gold" : isDone ? "border-gold-muted/60" : "border-border")}>
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
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {d.refs.map((r) => (
                      <li key={formatReference(r)}>
                        <Link href={chapterHref(r.bookId, r.chapter, r.verseStart)} className="inline-flex min-h-9 items-center text-[0.9375rem] font-semibold text-gold-highlight hover:underline">
                          {formatReference(r)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
