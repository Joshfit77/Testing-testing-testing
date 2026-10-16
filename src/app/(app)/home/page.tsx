import Link from "next/link";
import { Bot, CalendarCheck, ChevronRight, Dumbbell, Flame, HeartPulse, Lock, Medal, Play, Sparkles, Trophy } from "lucide-react";
import { AreaSeriesChart, BarSeriesChart } from "@/components/charts/charts";
import { Notice } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { scriptureForDate } from "@/data/content";
import { progressPct } from "@/lib/domain/nutrition";
import { hasFeature } from "@/lib/domain/plans";
import { recommendPrograms } from "@/lib/domain/program-generator";
import type { Equipment, ExperienceLevel, PrimaryGoal, ProgramType } from "@/lib/domain/types";
import { displayWeight, formatDuration, formatWeight, weightUnit } from "@/lib/domain/units";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { getDashboardData } from "@/server/services/dashboard";
import { getActiveProgram } from "@/server/services/training";

export const metadata = { title: "Home" };

const RECORD_LABEL: Record<string, string> = {
  estimated_1rm: "Est. 1RM",
  max_weight: "Heaviest set",
  max_reps: "Most reps",
  max_duration: "Longest hold",
};

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [plan, data, active, answersRes, programsRes] = await Promise.all([
    getUserPlan(user.id),
    getDashboardData(supabase, user.id, profile.timezone),
    getActiveProgram(supabase, user.id),
    supabase.from("onboarding_answers").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("training_programs").select("slug, name, summary, goals, equipment, difficulty, tier, days_per_week, low_impact").eq("is_published", true),
  ]);
  const units = profile.unit_system;
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: profile.timezone }).format(new Date()));
  const nutritionEnabled = hasFeature(plan, "nutrition_tracking");
  const name = profile.display_name ?? "Athlete";

  const programs = programsRes.data ?? [];
  const answers = answersRes.data;
  const recs = answers
    ? recommendPrograms(
        {
          primary_goal: answers.primary_goal as PrimaryGoal,
          experience: answers.experience as ExperienceLevel,
          days_per_week: answers.days_per_week as number,
          session_minutes: answers.session_minutes as number,
          equipment: answers.equipment as Equipment[],
          preferred_types: answers.preferred_types as ProgramType[],
        },
        programs.map((p) => ({
          slug: p.slug as string,
          goals: (p.goals as string[]).filter((g) => !g.startsWith("type:")) as PrimaryGoal[],
          types: (p.goals as string[]).filter((g) => g.startsWith("type:")).map((g) => g.slice(5)) as ProgramType[],
          equipment: p.equipment as Equipment[],
          difficulty: p.difficulty as "beginner",
          tier: p.tier as "free",
          days: Array.from({ length: p.days_per_week as number }, () => ({ name: "", focus: "", minutes: 0, exercises: [] })),
          lowImpact: p.low_impact as boolean,
        })),
        plan,
      ).slice(0, 3)
    : [];
  const programBySlug = new Map(programs.map((p) => [p.slug as string, p]));

  const weights = data.weights.map((w) => ({ date: w.date, weight: displayWeight(w.weightKg, units) }));
  const latestWeight = data.weights.at(-1);
  const firstWeight = data.weights[0];
  const weightDelta = latestWeight && firstWeight ? displayWeight(latestWeight.weightKg - firstWeight.weightKg, units) : null;
  const lowReadiness = data.readiness?.band === "low";
  const trainedYesterdayAndToday = data.dayStreak >= 3;
  const verse = profile.faith_enabled ? scriptureForDate(data.today) : null;
  const startHref = active?.today ? `/train/workout?day=${active.today.id}&up=${active.userProgramId}` : "/train/workout";

  return (
    <div className="space-y-6">
      {sp.welcome && (
        <Notice tone="success">Welcome to Narrow Gate Fitness, {name}! Your starter program is ready — today&apos;s session is below.</Notice>
      )}
      {sp.password === "updated" && <Notice tone="success">Your password was updated.</Notice>}

      {/* Hero: today's workout */}
      <section className="bg-card-gradient relative overflow-hidden rounded-3xl border border-border p-5 md:p-8" aria-labelledby="today-title">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="animate-fade-up">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">
              {greeting(hour)}, {name}
            </p>
            {active?.today ? (
              <>
                <h1 id="today-title" className="mt-2 font-display text-4xl font-bold uppercase leading-none md:text-5xl">
                  {active.today.name}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {active.programName} · Week {active.currentWeek} of {active.durationWeeks} · Day {active.currentDay}
                  {active.isDeload && " · Deload week"}
                </p>
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="Exercises today">
                  {active.today.exercises.slice(0, 5).map((e) => (
                    <li key={e.id}>
                      <Badge variant="secondary">
                        {e.exercise.name} · {e.sets}×{e.reps ?? (e.duration_seconds ? formatDuration(e.duration_seconds) : "")}
                      </Badge>
                    </li>
                  ))}
                  {active.today.exercises.length > 5 && <Badge variant="outline">+{active.today.exercises.length - 5} more</Badge>}
                </ul>
              </>
            ) : (
              <>
                <h1 id="today-title" className="mt-2 font-display text-4xl font-bold uppercase leading-none md:text-5xl">
                  Ready when you are
                </h1>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {active ? "You've completed your program — choose a new one or log a free session." : "Pick a program or log a free-form workout."}
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={startHref}>
                <Play aria-hidden /> Start workout
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/train">Programs</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stat tiles */}
      <section className="stagger grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Training summary">
        {[
          { icon: CalendarCheck, label: "This week", value: String(data.workoutsThisWeek), sub: "workouts" },
          { icon: Dumbbell, label: "All time", value: String(data.workoutsTotal), sub: "workouts completed" },
          { icon: Flame, label: "Day streak", value: String(data.dayStreak), sub: data.dayStreak === 1 ? "day" : "days" },
          { icon: Medal, label: "Week streak", value: String(data.weekStreak), sub: data.weekStreak === 1 ? "week" : "weeks" },
        ].map((t) => (
          <div key={t.label} className="lift rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <t.icon className="size-4 text-gold" aria-hidden />
              {t.label}
            </div>
            <p className="mt-2 font-display text-4xl font-bold leading-none">{t.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.sub}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <BarSeriesChart
          className="lg:col-span-2"
          title="Weekly activity"
          description="Completed workouts, last 7 days"
          data={data.last7.map((d) => ({ date: d.date, workouts: d.count }))}
          xKey="date"
          xFormat="weekday"
          series={[{ key: "workouts", label: "Workouts" }]}
          decimals={0}
          emptyMessage="No workouts in the last 7 days. Today is a great day to start."
        />

        {/* Nutrition rings */}
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s nutrition</CardTitle>
          </CardHeader>
          <CardContent>
            {nutritionEnabled ? (
              data.nutrition.goalCalories ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex justify-center gap-4">
                    <ProgressRing
                      ariaLabel="Calories"
                      value={progressPct(data.nutrition.calories, data.nutrition.goalCalories)}
                      label={Math.round(data.nutrition.calories)}
                      sublabel={`/ ${data.nutrition.goalCalories} kcal`}
                    />
                    <ProgressRing
                      ariaLabel="Protein"
                      value={progressPct(data.nutrition.protein_g, data.nutrition.goalProtein ?? 0)}
                      label={`${Math.round(data.nutrition.protein_g)}g`}
                      sublabel={`/ ${data.nutrition.goalProtein ?? 0}g protein`}
                    />
                  </div>
                  {data.nutrition.goalIsEstimate && <p className="text-center text-[11px] text-muted-foreground">Targets are estimates — adjust them in Food.</p>}
                  <Button asChild variant="secondary" size="sm" className="w-full">
                    <Link href="/nutrition">Log food</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Set your targets in <Link href="/nutrition" className="text-gold-highlight underline">Food</Link>.
                </p>
              )
            ) : (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <Lock className="size-6 text-gold" aria-hidden />
                <p className="text-sm text-muted-foreground">Calorie and protein tracking is included with Plus and Pro.</p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/profile/billing">See plans</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AreaSeriesChart
            title="Bodyweight"
            description={
              weightDelta != null && data.weights.length > 1
                ? `${weightDelta > 0 ? "+" : ""}${weightDelta} ${weightUnit(units)} over the last 90 days`
                : "Last 90 days"
            }
            data={weights}
            xKey="date"
            xFormat="date"
            valueSuffix={` ${weightUnit(units)}`}
            series={[{ key: "weight", label: "Bodyweight" }]}
            emptyMessage="Log your bodyweight in Progress to see your trend."
          />
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-gold" aria-hidden /> Latest PRs
            </CardTitle>
            <Link href="/progress#records" className="text-xs text-gold-highlight hover:underline">
              All
            </Link>
          </CardHeader>
          <CardContent>
            {data.records.length ? (
              <ul className="space-y-3">
                {data.records.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-xl bg-elevated/60 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{r.exercise}</p>
                      <p className="text-xs text-muted-foreground">{RECORD_LABEL[r.recordType] ?? r.recordType}</p>
                    </div>
                    <p className="shrink-0 font-display text-lg font-semibold text-gold-highlight">
                      {r.recordType === "max_duration"
                        ? formatDuration(r.value)
                        : r.recordType === "max_reps"
                          ? `${r.value} reps`
                          : formatWeight(r.value, units)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Complete a workout to start setting personal records.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Recovery recommendation */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartPulse className="size-4 text-gold" aria-hidden /> Recovery
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            {data.readiness ? (
              <div>
                <p className="text-sm">
                  Readiness <span className="font-display text-2xl font-semibold text-gold-highlight">{data.readiness.score}</span>
                  <span className="text-muted-foreground"> / 100</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{data.readiness.note}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Check in on sleep, energy and soreness to get a readiness note.</p>
            )}
            <p className="text-sm">
              {lowReadiness || trainedYesterdayAndToday
                ? "Recommended: a 15–20 minute mobility flow or an easy walk today."
                : "Recommended: 10 minutes of mobility after your next session."}
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link href="/train/recovery">Open recovery</Link>
            </Button>
          </CardContent>
        </Card>

        {/* AI coach shortcut */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4 text-gold" aria-hidden /> AI coach
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-3">
            <ul className="space-y-2">
              {["How should I progress my squat?", "Suggest a 20-minute hotel workout", "Review my consistency this month"].map((q) => (
                <li key={q}>
                  <Link
                    href={`/coach?q=${encodeURIComponent(q)}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-elevated/60 px-3 py-2 text-sm hover:border-gold-muted"
                  >
                    {q} <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            {!hasFeature(plan, "ai_coach") && <p className="text-xs text-muted-foreground">AI coaching is included with Plus and Pro.</p>}
          </CardContent>
        </Card>

        {/* Program recommendations */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-gold" aria-hidden /> Recommended
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recs.length ? (
              recs.map((r) => {
                const p = programBySlug.get(r.slug);
                return (
                  <Link key={r.slug} href={`/train/programs/${r.slug}`} className="block rounded-xl border border-border bg-elevated/60 px-3 py-2 hover:border-gold-muted">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{p?.name as string}</span>
                      {r.locked && <Lock className="size-3.5 shrink-0 text-gold" aria-label="Requires upgrade" />}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{r.reasons[0] ?? (p?.summary as string)}</span>
                  </Link>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">Browse the program library to find your next block.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {verse && (
        <aside className="rounded-2xl border border-gold-muted/40 bg-gold/5 p-5" aria-label="Verse of the day">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Verse of the day</p>
          <blockquote className="mt-2 text-sm italic text-foreground/90">&ldquo;{verse.text}&rdquo;</blockquote>
          <p className="mt-2 text-xs text-muted-foreground">
            {verse.reference} (KJV) ·{" "}
            <Link href="/faith" className="text-gold-highlight hover:underline">
              Reflect
            </Link>
          </p>
        </aside>
      )}
    </div>
  );
}
