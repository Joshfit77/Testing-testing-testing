import Link from "next/link";
import { CheckCircle2, ChevronRight, Circle, Dumbbell, Plus, RotateCcw, Sparkles } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { JourneyCheckIn } from "@/components/faith/journey-checkin";
import { FaithReminderTodaySync } from "@/components/faith/faith-reminders-settings";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { chapterHref } from "@/lib/bible/books";
import { formatLongDate } from "@/lib/faith/dates";
import { JOURNEY_RULE, RESTART_MESSAGE, RESTART_REFERENCE } from "@/lib/faith/journey-copy";
import { cn } from "@/lib/utils";
import { toggleDailyGoalAction } from "@/server/actions/faith";
import type { DailyGoals } from "@/server/services/daily-goals";
import type { JourneyView } from "@/server/services/journeys";
import { ScriptureText } from "@/components/bible/scripture-text";

/**
 * The Faith tab's first card: today's four activities. Bible reading and prayer belong to the journey (both required);
 * the Faith challenge and Fitness goal are optional and tracked on their own.
 */
export function TodayCard({ userId, journey, goals }: { userId: string; journey: JourneyView | null; goals: DailyGoals }) {
  const first = journey?.todayPlan?.refs[0];
  const fit = goals.fitness;
  const fitDone = fit.workoutDone || fit.marked;
  return (
    <section className="rounded-2xl border border-gold-muted bg-card p-4" aria-labelledby="today-journey-title">
      <FaithReminderTodaySync done={{ reading: Boolean(journey?.reading), prayer: Boolean(journey?.prayer), challenge: goals.challenge.done, fitness: fitDone }} />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Today · {formatLongDate(goals.today)}</p>
      {journey ? (
        <>
          <Link href="/faith/journey" className="mt-1 flex items-center justify-between gap-2">
            <span className="min-w-0">
              <h2 id="today-journey-title" className="truncate font-display text-xl font-bold">
                {journey.title}
              </h2>
              <span className="block text-sm text-muted-foreground">
                {journey.day ? `Day ${journey.day} of ${journey.durationDays}` : `Begins ${formatLongDate(journey.attempt.startedOn)}`}
                {journey.attempt.number > 1 ? ` · attempt ${journey.attempt.number}` : ""}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
          </Link>
          <ProgressBar className="mt-2" value={(journey.completedDays.length / journey.durationDays) * 100} label={`${journey.completedDays.length} of ${journey.durationDays} days complete`} />
          {journey.restart && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-gold-muted bg-gold/8 p-3 text-sm">
              <RotateCcw className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
              <span>
                {RESTART_MESSAGE} <span className="font-semibold text-gold">— {RESTART_REFERENCE}</span>
              </span>
            </p>
          )}
          {journey.day && journey.todayPlan ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm">
                <span className="text-muted-foreground">Reading:</span> <span className="font-semibold">{journey.todayPlan.label}</span>
              </p>
              <JourneyCheckIn
                userId={userId}
                journeyId={journey.id}
                day={journey.day}
                reading={journey.reading}
                prayer={journey.prayer}
                minutes={journey.todayPlan.minutes}
                readingHref={first ? chapterHref(first.bookId, first.chapter, first.verseStart) : null}
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Day 1&rsquo;s reading: {journey.plan.schedule[0]?.label}</p>
          )}
        </>
      ) : (
        <div className="mt-1">
          <h2 id="today-journey-title" className="font-display text-xl font-bold">
            Begin a reading journey
          </h2>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">Read through Scripture in 30 to 365 days, with Bible reading and prayer each day.</p>
          <p className="mt-2 text-sm">{JOURNEY_RULE}</p>
          <Button asChild className="mt-3" size="sm">
            <Link href="/faith/journey/new">
              <Plus aria-hidden /> Choose a journey
            </Link>
          </Button>
        </div>
      )}

      <div className="mt-4 space-y-2 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Optional today</p>
        <div className={cn("rounded-2xl border p-3", goals.challenge.done ? "border-gold-muted bg-gold/8" : "border-border bg-elevated/50")}>
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Faith challenge</p>
              <p className="text-[0.9375rem]">{goals.challenge.text}</p>
              {goals.challenge.verseText && (
                <p className="mt-1 font-serif text-sm text-muted-foreground">
                  &ldquo;
                  <ScriptureText text={goals.challenge.verseText} parts={goals.challenge.verseParts} />
                  &rdquo; <span className="font-sans font-semibold text-gold">{goals.challenge.reference} (BSB)</span>
                </p>
              )}
              <ActionButton action={toggleDailyGoalAction} fields={{ kind: "faith_challenge" }} size="sm" variant={goals.challenge.done ? "ghost" : "secondary"} className="mt-2" aria-pressed={goals.challenge.done}>
                {goals.challenge.done ? <CheckCircle2 className="text-gold" aria-hidden /> : <Circle aria-hidden />} {goals.challenge.done ? "Done" : "Mark done"}
              </ActionButton>
            </div>
          </div>
        </div>
        <div className={cn("rounded-2xl border p-3", fitDone ? "border-gold-muted bg-gold/8" : "border-border bg-elevated/50")}>
          <div className="flex items-start gap-3">
            <Dumbbell className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Fitness</p>
              <p className="text-[0.9375rem]">
                {fit.kind === "workout"
                  ? `${fit.sessionName}${fit.minutes ? ` · about ${fit.minutes} min` : ""}`
                  : fit.kind === "rest"
                    ? "Rest day in your program. Rest and recovery count."
                    : "Move your body today: a workout, a run or a walk."}
              </p>
              {fit.programName && <p className="text-xs text-muted-foreground">{fit.programName}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {fit.workoutDone ? (
                  <span className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-gold-highlight">
                    <CheckCircle2 className="size-4" aria-hidden /> Workout logged today
                  </span>
                ) : (
                  <>
                    {fit.kind === "workout" && (
                      <Button asChild size="sm" variant="secondary">
                        <Link href="/train">Go to training</Link>
                      </Button>
                    )}
                    <ActionButton action={toggleDailyGoalAction} fields={{ kind: "fitness" }} size="sm" variant={fit.marked ? "ghost" : "secondary"} aria-pressed={fit.marked}>
                      {fit.marked ? <CheckCircle2 className="text-gold" aria-hidden /> : <Circle aria-hidden />} {fit.marked ? "Done" : fit.kind === "rest" ? "Rested" : "Mark done"}
                    </ActionButton>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">These two are optional and tracked on their own: they never restart your reading journey.</p>
      </div>
    </section>
  );
}
