import Link from "next/link";
import { Activity, BarChart3, BookmarkCheck, CalendarDays, ChevronDown, ChevronRight, Dumbbell, Footprints, HeartPulse, History, Pause, Plus, Wand2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { TodayWorkoutAction } from "@/components/home/today-workout-action";
import { MainHeader } from "@/components/shell/main-header";
import { MissedSessionsCard } from "@/components/calendar/missed-sessions-card";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/domain/units";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { hasFeature } from "@/lib/domain/plans";
import { pauseActiveProgramAction } from "@/server/actions/programs";
import { getActiveProgram } from "@/server/services/training";
import { getAiAllowance } from "@/server/services/ai-coach";
import { loadProgramSchedule } from "@/server/services/schedule";
import { isoDateInTz } from "@/lib/domain/dates";
import { parseLayoutPrefs, sectionLayout, TRAIN_SECTIONS, type TrainSection } from "@/lib/layout-prefs";

export const metadata = { title: "Train" };

const card = "rounded-2xl border border-border bg-card";
const row = `${card} flex min-h-14 items-center gap-3 px-4 py-3 hover:border-gold-muted`;

/**
 * Train: today's session with Start on the first screen, then running (GPS runs and walks live here now), the
 * program, the exercise library and the calendar. Builder, history, templates, recovery and the training review are
 * one tap further, under "More training tools" (nothing was removed).
 */
export default async function TrainPage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const tz = profile.timezone ?? "UTC";
  const [active, schedule, inProgressRes, plan] = await Promise.all([
    getActiveProgram(supabase, user.id),
    loadProgramSchedule(supabase, user.id, tz),
    supabase.from("workout_sessions").select("name").eq("user_id", user.id).eq("status", "in_progress").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    getUserPlan(user.id),
  ]);
  const canBuild = hasFeature(plan, "custom_program_builder");
  // Same gate as /train/review: Pro, or a subscription that kept its AI allowance.
  const canReview = (await getAiAllowance(user.id, plan)).chatLimit > 0;
  const today = active?.today ?? null;
  const todayIso = isoDateInTz(new Date(), tz);
  const first = schedule?.planned[0];
  const next = first && today && first.dayId === today.id ? first : null;
  const plannedLater = next && next.date > todayIso ? next : null;
  const plannedLabel = plannedLater ? new Date(`${plannedLater.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }) : null;
  const startHref = today && active ? `/train/workout?day=${today.id}&up=${active.userProgramId}` : "/train/workout?blank=1";

  const sections = sectionLayout(TRAIN_SECTIONS, parseLayoutPrefs(profile.layout_prefs).train);
  const tools = [
    { href: "/train/build", icon: Wand2, label: canBuild ? "Program builder" : "Program builder (Pro)" },
    { href: "/train/history", icon: History, label: "Workout history" },
    { href: "/train/templates", icon: BookmarkCheck, label: "My workouts" },
    { href: "/train/workout?blank=1", icon: Plus, label: "Empty workout" },
    { href: "/train/recovery", icon: HeartPulse, label: "Recovery" },
    { href: "/train/review", icon: Activity, label: canReview ? "Training review" : "Training review (Pro)" },
  ];

  const rows: Record<Exclude<TrainSection, "tools">, React.ReactNode> = {
    run: (
        <Link key="/run" href="/run" className={row}>
          <Footprints className="size-5 shrink-0 text-gold" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Run &amp; walk</span>
            <span className="block truncate text-sm text-muted-foreground">GPS runs and walks, running plans, records</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
        </Link>
    ),
    programs: (
        <Link key="/train/programs" href="/train/programs" className={row}>
          <BarChart3 className="size-5 shrink-0 text-gold" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Programs</span>
            <span className="block truncate text-sm text-muted-foreground">{active ? `Active: ${active.programName}` : "Strength, muscle, conditioning, sport and running plans"}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
        </Link>
    ),
    exercises: (
        <Link key="/train/exercises" href="/train/exercises" className={row}>
          <Dumbbell className="size-5 shrink-0 text-gold" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Exercises</span>
            <span className="block truncate text-sm text-muted-foreground">The library, with demonstrations and your history for each</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
        </Link>
    ),
    calendar: (
        <Link key="/calendar" href="/calendar" className={row}>
          <CalendarDays className="size-5 shrink-0 text-gold" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Training calendar</span>
            <span className="block truncate text-sm text-muted-foreground">Workouts, runs, walks, planned sessions and rest days</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
        </Link>
    ),
  };

  return (
    <div className="space-y-4">
      <MainHeader title="Train" />

      {schedule && schedule.missed.missed.length > 0 && (
        <MissedSessionsCard
          view={{
            missed: schedule.missed.missed.map((m) => ({ dayId: m.dayId, name: m.name, wasDue: m.wasDue })),
            resume: schedule.missed.resumeAt ? { name: schedule.missed.resumeAt.name, date: schedule.missed.resumeAt.date } : null,
            canSkip: schedule.missed.canSkip,
          }}
          today={todayIso}
          canReschedule={hasFeature(plan, "advanced_calendar")}
          startHref={startHref}
        />
      )}

      <section aria-labelledby="today-title" className={`${card} overflow-hidden`}>
        <div className="px-4 pt-4">
          <h2 id="today-title" className="text-sm font-semibold text-muted-foreground">
            Today&apos;s workout
          </h2>
          {active && (
            <Link href={`/train/programs/${active.programSlug}`} className="mt-1 flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-highlight hover:underline">
              <span className="min-w-0 truncate">{active.programName}</span>
              <span className="shrink-0 text-muted-foreground">
                · Week {active.currentWeek} of {active.durationWeeks}
                {active.isDeload ? " · Deload" : ""}
              </span>
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </Link>
          )}
        </div>
        {today ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gold/12 text-gold">
                <Dumbbell className="size-6" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-lg font-semibold">{today.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {[today.estimated_minutes ? `${today.estimated_minutes} min` : null, `${today.exercises.length} exercise${today.exercises.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                </span>
              </span>
            </div>
            <div className="px-4">
              <TodayWorkoutAction userId={user.id} startHref={startHref} serverInProgress={(inProgressRes.data?.name as string | undefined) ?? null} {...(plannedLater ? { startLabel: "Start workout early" } : {})} />
              {plannedLater && (
                <p className="pt-2 text-center text-sm text-muted-foreground">
                  Planned for {plannedLabel}
                  {plannedLater.moved ? " (moved)" : ""} ·{" "}
                  <Link href={`/calendar?day=${plannedLater.date}`} className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-gold-highlight underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-gold-highlight">
                    Open calendar
                  </Link>
                </p>
              )}
            </div>
            <details className="group mt-2 border-t border-border">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <span>{today.exercises.length} exercises in this session</span>
                <ChevronDown className="size-5 text-gold transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="divide-y divide-border border-t border-border" aria-label="Exercises">
                {today.exercises.map((e, i) => (
                  <li key={e.id}>
                    <Link href={`/train/exercises/${e.exercise.slug}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-elevated/50">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-sm font-semibold tabular-nums text-muted-foreground" aria-hidden>
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.exercise.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {e.sets} {e.sets === 1 ? "set" : "sets"} × {e.reps ? `${e.reps} reps` : e.duration_seconds ? formatDuration(e.duration_seconds) : "—"}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="p-3">
                <ActionButton action={pauseActiveProgramAction} fields={{}} variant="ghost" className="w-full" confirmMessage="Pause this program? You can resume it from Programs.">
                  <Pause aria-hidden /> Pause program
                </ActionButton>
              </div>
            </details>
          </>
        ) : (
          <div className="p-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {active ? "You've finished this program. Choose your next one, or log a free workout." : canBuild ? "No active program. Build one around your goals, start one from the library, or log a free workout." : "No active program. Rebuild your free starter program from your answers, or log a free workout."}
            </p>
            <div className="mt-3 space-y-2">
              <TodayWorkoutAction userId={user.id} startHref={startHref} serverInProgress={(inProgressRes.data?.name as string | undefined) ?? null} />
              {/* The builder and the library are Pro; Free members rebuild their free starter program instead. */}
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant={canBuild ? "default" : "secondary"}>
                  {canBuild ? <Link href="/train/build">Build my program</Link> : <Link href="/profile/preferences" data-testid="rebuild-starter">Rebuild starter program</Link>}
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/train/programs">{canBuild ? "Browse programs" : "Programs (Pro)"}</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* The sections in the member's order (You → Customize); a hidden one is still one tap away in Search. */}
      {sections.some((x) => x !== "tools") && (
        <nav aria-label="Training sections" className="space-y-2">
          {sections.filter((x): x is Exclude<TrainSection, "tools"> => x !== "tools").map((x) => rows[x])}
        </nav>
      )}
      {sections.includes("tools") && (
      <details className={`group ${card}`} data-testid="train-tools">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 text-[0.9375rem] font-semibold [&::-webkit-details-marker]:hidden">
          <span>More training tools</span>
          <ChevronDown className="size-5 text-gold transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <nav aria-label="Training tools" className="grid grid-cols-2 gap-2 px-3 pb-3">
          {tools.map((t) => (
            <Link key={t.href} href={t.href} className="flex min-h-14 items-center gap-2.5 rounded-xl border border-border bg-elevated/50 px-3 py-2 text-[0.9375rem] font-medium leading-tight hover:border-gold-muted">
              <t.icon className="size-5 shrink-0 text-gold" aria-hidden />
              <span className="min-w-0 flex-1">{t.label}</span>
            </Link>
          ))}
        </nav>
      </details>
      )}
    </div>
  );
}
