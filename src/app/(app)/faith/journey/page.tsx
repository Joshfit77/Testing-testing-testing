import Link from "next/link";
import { CalendarDays, ChevronRight, Flag, History, Plus, RotateCcw, Trophy } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { JourneyCheckIn } from "@/components/faith/journey-checkin";
import { NotificationTodaySync } from "@/components/notifications/notification-sync";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { chapterHref } from "@/lib/bible/books";
import { formatReference, parseReference } from "@/lib/bible/reference";
import { formatLongDate } from "@/lib/faith/dates";
import { JOURNEY_RULE, REASON_TEXT, RESTART_MESSAGE, RESTART_REFERENCE, RULE_GRACE } from "@/lib/faith/journey-copy";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { endJourneyAction } from "@/server/actions/journeys";
import { passageText } from "@/server/bible/text";
import { dateOfDay, loadActiveJourney, loadPastJourneys, loadRecentlyCompleted, type JourneyView } from "@/server/services/journeys";

export const metadata = { title: "Reading journey" };

function Readings({ view, day }: { view: JourneyView; day: number }) {
  const d = view.plan.schedule[day - 1];
  if (!d) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {d.refs.map((r) => (
        <li key={formatReference(r)}>
          <Link href={chapterHref(r.bookId, r.chapter, r.verseStart)} className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-3 text-sm font-semibold text-gold-highlight hover:border-gold-muted">
            {formatReference(r)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function JourneyPage({ searchParams }: { searchParams: Promise<{ started?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const tz = profile.timezone ?? "UTC";
  const [view, past] = await Promise.all([loadActiveJourney(supabase, user.id, tz), loadPastJourneys(supabase, user.id)]);
  const finished = view ? null : await loadRecentlyCompleted(supabase, user.id, tz);
  const lam = passageText(parseReference("Lamentations 3:22-23")!);

  if (!view) {
    return (
      <div className="space-y-5">
        <BackLink href="/faith">Faith</BackLink>
        <PageHeader title="Reading journey" description="Read through Scripture on a schedule you choose: 30, 60, 90, 180 or 365 days. Free, always." className="mb-2" />
        {finished && (
          <section className="rounded-2xl border border-gold bg-card p-4" aria-labelledby="done-title">
            <h2 id="done-title" className="flex items-center gap-2 font-display text-xl font-bold">
              <Trophy className="size-6 text-gold" aria-hidden /> Journey complete
            </h2>
            <p className="mt-1">
              You finished {finished.title}: {finished.durationDays} days of reading and prayer
              {finished.attempts.length > 1 ? `, on attempt ${finished.attempt.number}` : ""}.
            </p>
          </section>
        )}
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="font-semibold">How a journey works</p>
          <p className="mt-1 text-[0.9375rem]">Each day has a Bible reading and time for prayer. Mark each one complete when you&rsquo;ve done it.</p>
          <p className="mt-2 rounded-xl border border-gold-muted bg-gold/8 p-3 text-[0.9375rem] font-semibold">{JOURNEY_RULE}</p>
          <p className="mt-2 text-sm text-muted-foreground">{RULE_GRACE}</p>
          <Button asChild className="mt-3">
            <Link href="/faith/journey/new">
              <Plus aria-hidden /> Choose a journey
            </Link>
          </Button>
        </section>
        <PastJourneys past={past} />
      </div>
    );
  }

  const upcomingFrom = view.day ? view.day + 1 : 1;
  const upcoming = view.plan.schedule.slice(upcomingFrom - 1, upcomingFrom - 1 + 5);
  const done = view.completedDays;
  const recent = [...done].reverse().slice(0, 5);
  const notStarted = view.day === null;

  return (
    <div className="space-y-5">
      <BackLink href="/faith">Faith</BackLink>
      <PageHeader
        eyebrow={`${view.durationDays}-day journey${view.attempt.number > 1 ? ` · attempt ${view.attempt.number}` : ""}`}
        title={view.title}
        description={notStarted ? `Begins ${formatLongDate(view.attempt.startedOn)}.` : `Day ${view.day} of ${view.durationDays} · ${done.length} complete`}
        className="mb-2"
      />
      {sp.started && <p className="rounded-xl border border-gold-muted bg-gold/8 p-3 text-sm font-semibold" role="status">Your journey has begun. {notStarted ? `Day 1 is ${formatLongDate(view.attempt.startedOn)}.` : "Day 1 is today."}</p>}

      {view.restart && (
        <section className="rounded-2xl border border-gold bg-card p-4" aria-labelledby="restart-title">
          <h2 id="restart-title" className="flex items-center gap-2 font-semibold">
            <RotateCcw className="size-5 text-gold" aria-hidden /> A new beginning
          </h2>
          <p className="mt-1 font-serif text-lg">{RESTART_MESSAGE}</p>
          <p className="text-sm font-semibold text-gold">— {RESTART_REFERENCE}</p>
          {lam && <p className="mt-2 font-serif text-[0.9375rem] text-muted-foreground">&ldquo;{lam}&rdquo; ({RESTART_REFERENCE}, BSB)</p>}
          <p className="mt-2 text-sm text-muted-foreground">
            On {formatLongDate(view.restart.missedOn)}, {REASON_TEXT[view.restart.reason]}, so the journey restarted at Day 1 after {view.restart.previousDays} completed day{view.restart.previousDays === 1 ? "" : "s"}. Your reading history, notes and prayers are all still saved.
          </p>
        </section>
      )}

      <ProgressBar value={(done.length / view.durationDays) * 100} label={`${done.length} of ${view.durationDays} days complete`} />

      {notStarted ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="font-semibold">Day 1 · {formatLongDate(view.attempt.startedOn)}</p>
          <p className="mb-2 text-sm text-muted-foreground">About {view.plan.schedule[0]!.minutes} min of reading</p>
          <Readings view={view} day={1} />
        </section>
      ) : (
        <section className="rounded-2xl border border-gold-muted bg-card p-4" aria-labelledby="today-title">
          <h2 id="today-title" className="font-display text-xl font-bold">
            Today · Day {view.day}
          </h2>
          <p className="mb-2 text-sm text-muted-foreground">{view.todayPlan!.label}</p>
          <div className="mb-3">
            <Readings view={view} day={view.day!} />
          </div>
          <NotificationTodaySync today={view.today} done={{ reading: view.reading, prayer: view.prayer }} />
          <JourneyCheckIn
            userId={user.id}
            journeyId={view.id}
            day={view.day!}
            reading={view.reading}
            prayer={view.prayer}
            minutes={view.todayPlan!.minutes}
            readingHref={view.todayPlan!.refs[0] ? chapterHref(view.todayPlan!.refs[0].bookId, view.todayPlan!.refs[0].chapter, view.todayPlan!.refs[0].verseStart) : null}
          />
        </section>
      )}

      <section aria-labelledby="next-title">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 id="next-title" className="flex items-center gap-2 font-semibold">
            <CalendarDays className="size-5 text-gold" aria-hidden /> Coming up
          </h2>
          <Link href="/faith/journey/schedule" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold-highlight hover:underline">
            Full schedule <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        {upcoming.length ? (
          <ol className="space-y-2">
            {upcoming.map((d) => (
              <li key={d.day} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">
                    Day {d.day} · {formatLongDate(dateOfDay(view, d.day))}
                  </span>
                  <span className="block truncate font-semibold">{d.label}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{d.minutes} min</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Today is the last day of this journey.</p>
        )}
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="done-days-title">
          <h2 id="done-days-title" className="mb-2 font-semibold">
            Completed
          </h2>
          <ol className="space-y-2">
            {recent.map((n) => (
              <li key={n} className="flex items-center justify-between gap-3 rounded-xl border border-gold-muted/60 bg-card px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">Day {n}</span>
                  <span className="block truncate font-semibold">{view.plan.schedule[n - 1]?.label}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-gold">Done</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-4 text-[0.9375rem]">
        <p className="font-semibold">The daily rule</p>
        <p className="mt-1">{JOURNEY_RULE}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Days follow your time zone ({view.timezone}). {RULE_GRACE}
        </p>
      </section>

      {view.attempts.length > 1 && (
        <section aria-labelledby="attempts-title">
          <h2 id="attempts-title" className="mb-2 flex items-center gap-2 font-semibold">
            <History className="size-5 text-gold" aria-hidden /> Attempts
          </h2>
          <ol className="space-y-2">
            {view.attempts.map((a) => (
              <li key={a.id} className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
                <span className="font-semibold">Attempt {a.number}</span> · began {formatLongDate(a.startedOn)} ·{" "}
                {a.status === "active"
                  ? "in progress"
                  : a.status === "interrupted"
                    ? `${a.daysCompleted} day${a.daysCompleted === 1 ? "" : "s"} completed; restarted after ${formatLongDate(a.interruptedOn!)} (${REASON_TEXT[a.reason!]})`
                    : a.status}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href="/faith/journey/new">
            <Plus aria-hidden /> Change journey
          </Link>
        </Button>
        <ActionButton action={endJourneyAction} fields={{}} variant="ghost" confirmMessage="End this journey?" confirmDetail="Your reading history, notes, prayers and this journey's record stay saved." confirmLabel="End journey">
          <Flag aria-hidden /> End journey
        </ActionButton>
      </div>
      <PastJourneys past={past} />
    </div>
  );
}

function PastJourneys({ past }: { past: Awaited<ReturnType<typeof loadPastJourneys>> }) {
  if (!past.length) return null;
  return (
    <section aria-labelledby="past-title">
      <h2 id="past-title" className="mb-2 font-semibold">
        Past journeys
      </h2>
      <ul className="space-y-2">
        {past.map((p) => (
          <li key={p.id} className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
            <span className="font-semibold">{p.title}</span> · {p.durationDays} days · {p.status === "completed" ? "completed" : "ended"}
            {p.endedAt ? ` ${formatLongDate(p.endedAt.slice(0, 10))}` : ""}
            {p.attempts > 1 ? ` · ${p.attempts} attempts` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
