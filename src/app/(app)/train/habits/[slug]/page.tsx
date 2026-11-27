import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { HabitDay, HabitGoals, StopHabitProgram, type DayItem } from "@/components/habits/habit-day";
import { StartHabitProgram } from "@/components/habits/start-habit";
import { getHabitProgram } from "@/data/habit-programs";
import { isValidTimeZone } from "@/lib/domain/dates";
import { activitiesForDay, dailyDone, weekFor, weekOfDay, weeklyDone } from "@/lib/domain/habit-programs";
import { hasFeature } from "@/lib/domain/plans";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { getHabitEnrollment, loadHabitView } from "@/server/services/habit-programs";

export const metadata = { title: "Habit program" };
export const dynamic = "force-dynamic";

export default async function HabitProgramPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ day?: string }> }) {
  const { slug } = await params;
  const program = getHabitProgram(slug);
  if (!program) notFound();
  const { user, profile } = await requireOnboardedUser();
  const pro = hasFeature(await getUserPlan(user.id), "full_program_library");
  const supabase = await getServerSupabase();
  const tz = isValidTimeZone(profile.timezone) ? profile.timezone! : "UTC";
  const enrollment = await getHabitEnrollment(supabase, user.id, slug);
  const view = enrollment ? await loadHabitView(supabase, user.id, enrollment, tz) : null;
  const card = "rounded-2xl border border-border bg-card p-5";

  const header = (
    <>
      <BackLink href="/train/habits">Habit programs</BackLink>
      <PageHeader eyebrow={`${program.days} days · ${program.schedule}`} title={program.name} description={program.summary} />
      {program.needsProfessionalReview && (
        <p className="rounded-xl border border-gold/40 p-3 text-sm" data-testid="review-flag">
          Not yet reviewed by a {program.needsProfessionalReview.who.toLowerCase()}. {program.needsProfessionalReview.why}
        </p>
      )}
      {program.faithNote && <p className="text-sm text-muted-foreground">{program.faithNote}</p>}
    </>
  );

  // Not enrolled (or the last run ended): the preview.
  if (!view || view.enrollment.status !== "active") {
    return (
      <div className="space-y-5">
        {header}
        <section className={card}>
          <h2 className="font-display text-lg font-bold uppercase">About this program</h2>
          <p className="mt-2 text-sm">{program.description}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {program.instructions.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">To complete it: {program.completion.text}</p>
        </section>
        <section className={card} data-testid="habit-weeks">
          <h2 className="font-display text-lg font-bold uppercase">Week by week</h2>
          <ol className="mt-2 space-y-2 text-sm">
            {program.weeks.map((w) => (
              <li key={w.week}>
                <span className="font-semibold">Week {w.week}: {w.title}.</span> {w.objective} <span className="text-muted-foreground">Milestone: {w.milestone}</span>
              </li>
            ))}
          </ol>
        </section>
        {view && (
          <p className="text-sm text-muted-foreground">
            Your last run {view.enrollment.status === "completed" ? "was completed" : "was stopped"} on day {view.day}: {view.progress.totalDone} of {view.progress.totalRequired} activities done. Those records stay here.
          </p>
        )}
        {pro ? (
          <StartHabitProgram slug={program.slug} label={view ? "Start again from day 1" : "Start program"} />
        ) : (
          <div className={card} data-testid="habit-locked">
            <p className="font-semibold">Included with Pro All Access</p>
            <Link href="/profile/billing" className="mt-2 inline-flex min-h-11 items-center font-semibold text-gold-highlight underline-offset-4 hover:underline">
              See plans
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Enrolled: today (or a chosen earlier day).
  const requested = Number((await searchParams).day);
  const day = Number.isInteger(requested) && requested >= 1 && requested <= view.day ? requested : Math.max(1, view.day);
  const week = weekFor(program, day)!;
  const { daily, weekly } = activitiesForDay(program, day);
  const checkins = [...view.manual, ...view.auto];
  const autoKeys = new Set(view.auto.filter((a) => a.day_number === day).map((a) => a.activity_key));
  const items: DayItem[] = [
    ...daily.map((a) => ({ ...a, weekly: false, auto: autoKeys.has(a.key), done: dailyDone(checkins, day, a.key), answer: view.manual.find((m) => m.day_number === day && m.activity_key === a.key)?.answer ?? null })),
    ...weekly.map((a) => ({ ...a, weekly: true, auto: false, done: weeklyDone(checkins, weekOfDay(day), a.key), answer: view.manual.find((m) => weekOfDay(m.day_number) === weekOfDay(day) && m.activity_key === a.key)?.answer ?? null })),
  ];
  const pct = Math.round(view.progress.share * 100);

  return (
    <div className="space-y-5">
      {header}
      <section className="bg-card-gradient rounded-2xl border border-gold/40 p-5" data-testid="habit-progress">
        <p className="text-sm text-muted-foreground">
          Day {day} of {program.days} · Week {week.week}: {week.title}
        </p>
        <p className="mt-1 font-display text-2xl font-bold text-gold-highlight">{pct}% of activities so far</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-elevated" aria-hidden>
          <span className="block h-full bg-gold" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm">{week.objective}</p>
      </section>
      <section className={card}>
        <h2 className="font-display text-lg font-bold uppercase">{week.lesson.title}</h2>
        {week.lesson.body.map((p) => (
          <p key={p.slice(0, 40)} className="mt-2 text-sm">
            {p}
          </p>
        ))}
      </section>
      <section aria-label="Today's activities" className="space-y-2">
        <h2 className="font-display text-lg font-bold uppercase">{day === view.day ? "Today" : `Day ${day}`}</h2>
        <HabitDay enrollmentId={view.enrollment.id} day={day} items={items} editable={pro} />
        {!pro && <p className="text-sm text-muted-foreground">Your records stay readable. Ticking off new days is included with Pro.</p>}
        <nav className="flex flex-wrap gap-2 pt-1" aria-label="Earlier days">
          {Array.from({ length: Math.min(view.day, 7) }, (_, i) => view.day - i).map((d) => (
            <Link key={d} href={`/train/habits/${slug}?day=${d}`} aria-current={d === day ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-sm">
              Day {d}
            </Link>
          ))}
        </nav>
      </section>
      <section className={card}>
        <h2 className="font-display text-lg font-bold uppercase">This week&apos;s milestone</h2>
        <p className="mt-2 text-sm">{week.milestone}</p>
      </section>
      {program.goalFields.length > 0 && (
        <section className={card}>
          <h2 className="font-display text-lg font-bold uppercase">My goals</h2>
          <div className="mt-3">
            <HabitGoals enrollmentId={view.enrollment.id} fields={program.goalFields} goals={view.enrollment.goals} />
          </div>
        </section>
      )}
      <StopHabitProgram enrollmentId={view.enrollment.id} />
    </div>
  );
}
