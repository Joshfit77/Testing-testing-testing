import Link from "next/link";
import { BarChart3, BookOpen, ChevronRight, Dumbbell, HeartPulse, History, Pause, Plus, Wand2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { TodayWorkoutAction } from "@/components/home/today-workout-action";
import { MainHeader } from "@/components/shell/main-header";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/domain/units";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { pauseActiveProgramAction } from "@/server/actions/programs";
import { getActiveProgram } from "@/server/services/training";

export const metadata = { title: "Train" };

const card = "rounded-2xl border border-border bg-card";

export default async function TrainPage() {
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [active, inProgressRes] = await Promise.all([
    getActiveProgram(supabase, user.id),
    supabase.from("workout_sessions").select("name").eq("user_id", user.id).eq("status", "in_progress").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const today = active?.today ?? null;
  const startHref = today && active ? `/train/workout?day=${today.id}&up=${active.userProgramId}` : "/train/workout?blank=1";

  const tools = [
    { href: "/train/programs", icon: BarChart3, label: "Programs" },
    { href: "/train/exercises", icon: Dumbbell, label: "Exercises" },
    { href: "/train/build", icon: Wand2, label: "Program builder" },
    { href: "/train/history", icon: History, label: "Workout history" },
    { href: "/train/workout?blank=1", icon: Plus, label: "Empty workout" },
    { href: "/train/recovery", icon: HeartPulse, label: "Recovery" },
  ];

  return (
    <div className="space-y-5">
      <MainHeader title="Train" />

      <section aria-labelledby="program-title">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="program-title" className="text-lg font-semibold">
            Your program
          </h2>
          <Link href="/train/programs" className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-gold-highlight hover:underline">
            View all
          </Link>
        </div>
        {active ? (
          <Link href={`/train/programs/${active.programSlug}`} className={`${card} flex min-h-16 items-center gap-3 px-4 py-3 hover:border-gold-muted`}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-elevated text-gold">
              <Dumbbell className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{active.programName}</span>
              <span className="block truncate text-sm text-muted-foreground">
                Week {active.currentWeek} of {active.durationWeeks}
                {active.isDeload ? " · Deload week" : active.weekFocus ? ` · ${active.weekFocus}` : ""}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
          </Link>
        ) : (
          <div className={`${card} p-4`}>
            <p className="font-semibold">No active program</p>
            <p className="mt-1 text-sm text-muted-foreground">Build one around your goals, start one from the library, or log a free workout.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button asChild>
                <Link href="/train/build">Build my program</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/train/programs">Browse programs</Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="today-title">
        <h2 id="today-title" className="mb-2 text-lg font-semibold">
          Today&apos;s workout
        </h2>
        <div className={`${card} overflow-hidden`}>
          {today ? (
            <>
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gold/12 text-gold">
                  <Dumbbell className="size-6" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-lg font-semibold">{today.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {[today.estimated_minutes ? `${today.estimated_minutes} min` : null, `${today.exercises.length} exercise${today.exercises.length === 1 ? "" : "s"}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </div>
              <ul className="divide-y divide-border" aria-label="Exercises">
                {today.exercises.map((e, i) => (
                  <li key={e.id}>
                    <Link href={`/train/exercises/${e.exercise.slug}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-elevated/50">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-sm font-semibold tabular-nums text-muted-foreground" aria-hidden>
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.exercise.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {e.sets} {e.sets === 1 ? "set" : "sets"} ×{" "}
                          {e.reps ? `${e.reps} reps` : e.duration_seconds ? formatDuration(e.duration_seconds) : "—"}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="space-y-1 p-4 pt-3">
                <TodayWorkoutAction userId={user.id} startHref={startHref} serverInProgress={(inProgressRes.data?.name as string | undefined) ?? null} />
                <ActionButton action={pauseActiveProgramAction} fields={{}} variant="ghost" className="w-full" confirmMessage="Pause this program? You can resume it from Programs.">
                  <Pause aria-hidden /> Pause program
                </ActionButton>
              </div>
            </>
          ) : (
            <div className="p-4">
              <p className="text-sm text-muted-foreground">
                {active ? "You've finished this program. Choose your next one, or log a free workout." : "No scheduled session. Log a free workout any time."}
              </p>
              <div className="mt-3">
                <TodayWorkoutAction userId={user.id} startHref={startHref} serverInProgress={(inProgressRes.data?.name as string | undefined) ?? null} />
              </div>
            </div>
          )}
        </div>
      </section>

      <nav aria-label="Training tools" className="grid grid-cols-2 gap-2">
        {tools.map((t) => (
          <Link key={t.href} href={t.href} className={`${card} flex min-h-14 items-center gap-2.5 px-3 py-2 text-[0.9375rem] font-medium leading-tight hover:border-gold-muted`}>
            <t.icon className="size-5 shrink-0 text-gold" aria-hidden />
            <span className="min-w-0 flex-1">{t.label}</span>
          </Link>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground">
        <BookOpen className="mr-1 inline size-4 align-[-3px] text-gold" aria-hidden />
        Saved custom workout templates aren&apos;t available yet; the program builder creates a full custom program instead.
      </p>
    </div>
  );
}
