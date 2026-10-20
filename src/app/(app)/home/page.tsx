import Link from "next/link";
import { BarChart3, CalendarDays, ChevronRight, Dumbbell, Footprints, HeartPulse, Lock, Pill, TrendingUp, Utensils, Wand2 } from "lucide-react";
import { Notice } from "@/components/common/states";
import { TodayWorkoutAction } from "@/components/home/today-workout-action";
import { WeekBars } from "@/components/home/week-bars";
import { MainHeader } from "@/components/shell/main-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TRANSLATION, scriptureForDate } from "@/data/content";
import { progressPct } from "@/lib/domain/nutrition";
import { hasFeature } from "@/lib/domain/plans";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { logError } from "@/server/log";
import { getWeeklyActivity, type WeeklyActivity } from "@/server/services/activity-summary";
import { getDashboardData } from "@/server/services/dashboard";
import { getActiveProgram } from "@/server/services/training";
import { buildWeeklyActivity } from "@/lib/domain/activity-week";
import { verseExcerpt } from "@/lib/domain/scripture";

export const metadata = { title: "Home" };

const card = "rounded-2xl border border-border bg-card";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const weeklyPromise: Promise<WeeklyActivity> = getWeeklyActivity(user.id, profile.timezone).catch((err: unknown) => {
    logError("home.weekly", err);
    return buildWeeklyActivity(new Date(), profile.timezone, { workouts: [] });
  });
  const [plan, data, active, weekly, inProgressRes, answersRes] = await Promise.all([
    getUserPlan(user.id),
    getDashboardData(supabase, user.id, profile.timezone),
    getActiveProgram(supabase, user.id),
    weeklyPromise,
    supabase.from("workout_sessions").select("name").eq("user_id", user.id).eq("status", "in_progress").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("onboarding_answers").select("days_per_week").eq("user_id", user.id).maybeSingle(),
  ]);
  const name = profile.display_name ?? "Athlete";
  const firstName = name.trim().split(/\s+/)[0] || name;
  const nutritionEnabled = hasFeature(plan, "nutrition_tracking");
  const showScripture = profile.home_scripture ?? true;
  const verse = scriptureForDate(data.today);
  const startHref = active?.today ? `/train/workout?day=${active.today.id}&up=${active.userProgramId}` : "/train/workout?blank=1";
  const weeklyTarget = active?.daysPerWeek ?? (answersRes.data?.days_per_week as number | undefined) ?? null;
  const sessionsThisWeek = weekly.workouts.length + weekly.runs.length + weekly.walks.length;
  const todayLong = new Date(`${data.today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const today = active?.today ?? null;

  return (
    <div className="space-y-4">
      <MainHeader
        title={`Hi, ${firstName}`}
        subtitle={
          showScripture ? (
            <p className="truncate">
              {todayLong} · <span className="font-serif italic text-foreground/90">{verse.reference}</span>
            </p>
          ) : (
            <p>{todayLong}</p>
          )
        }
      />

      {sp.welcome && <Notice tone="success">Welcome to Narrow Gate Fitness, {name}! Your starter program is ready — today&apos;s session is below.</Notice>}
      {sp.password === "updated" && <Notice tone="success">Your password was updated.</Notice>}
      {sp.built && active && (
        <Notice tone="success">
          Your custom program &ldquo;{active.programName}&rdquo; is built and active.{" "}
          <Link href={`/train/programs/${active.programSlug}`} className="font-semibold text-gold-highlight underline">
            See the full plan
          </Link>
        </Notice>
      )}

      {showScripture && (
        <Link
          href="/faith#todays-devotional"
          className="group relative block overflow-hidden rounded-2xl border border-border bg-card focus-visible:ring-2 focus-visible:ring-gold-highlight"
          aria-label={`Verse of the day, ${verse.reference}: ${verse.text} Open today's devotional.`}
        >
          {/* Decorative original artwork; the verse is the content. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustrations/mountains-sunrise.svg" alt="" aria-hidden className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" aria-hidden />
          <div className="relative flex min-h-40 flex-col justify-end p-4">
            <p className="text-xs font-semibold text-champagne">Verse of the day</p>
            <blockquote className="mt-1 max-w-[18rem] font-serif text-[1.375rem] leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
              {verseExcerpt(verse.text)}
            </blockquote>
            <p className="mt-1.5 flex items-center gap-1 text-sm text-white/80">
              {verse.reference} ({TRANSLATION.code}) <ChevronRight className="size-4 text-gold transition-transform group-hover:translate-x-0.5" aria-hidden />
            </p>
          </div>
        </Link>
      )}

      {/* Today's workout */}
      <section className={`${card} p-4`} aria-labelledby="today-title">
        <h2 id="today-title" className="text-sm font-semibold text-muted-foreground">
          Today&apos;s workout
        </h2>
        <Link
          href={active ? `/train/programs/${active.programSlug}` : "/train"}
          className="mt-2 flex min-h-14 items-center gap-3 rounded-xl hover:bg-elevated/50"
          aria-label={today ? `${today.name}, view program` : "Open Train"}
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-elevated text-gold">
            <Dumbbell className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-semibold">{today ? today.name : active ? "Program complete" : "No program yet"}</span>
            <span className="block text-sm text-muted-foreground">
              {today
                ? [today.estimated_minutes ? `${today.estimated_minutes} min` : null, `${today.exercises.length} exercise${today.exercises.length === 1 ? "" : "s"}`]
                    .filter(Boolean)
                    .join(" · ")
                : active
                  ? "Choose your next program in Train"
                  : "Log a free workout or pick a program"}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
        </Link>
        <div className="mt-3">
          <TodayWorkoutAction userId={user.id} startHref={startHref} serverInProgress={(inProgressRes.data?.name as string | undefined) ?? null} />
        </div>
        {!active && (
          <Link href="/train/build" className="mt-2 flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold text-gold-highlight hover:underline">
            <Wand2 className="size-4" aria-hidden /> Build my program
          </Link>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        {/* Nutrition summary */}
        <Link href={nutritionEnabled ? "/nutrition" : "/profile/billing"} className={`${card} flex flex-col p-4 hover:border-gold-muted`}>
          <span id="home-nutrition" className="flex items-center gap-2 text-sm font-semibold">
            <Utensils className="size-4 text-gold" aria-hidden /> Nutrition
          </span>
          {nutritionEnabled ? (
            data.nutrition.goalCalories ? (
              <>
                <span className="mt-2 text-xl font-bold tabular-nums">
                  {Math.round(data.nutrition.calories).toLocaleString()}
                  <span className="text-base font-medium text-muted-foreground"> / {data.nutrition.goalCalories.toLocaleString()}</span>
                </span>
                <span className="text-sm text-muted-foreground">calories</span>
                <ProgressBar className="mt-auto" value={progressPct(data.nutrition.calories, data.nutrition.goalCalories)} label="Calories eaten of daily budget" />
              </>
            ) : (
              <span className="mt-2 text-sm text-muted-foreground">
                {Math.round(data.nutrition.calories).toLocaleString()} calories logged. Set a daily target in Food.
              </span>
            )
          ) : (
            <span className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden /> Calorie tracking comes with Plus and Pro.
            </span>
          )}
        </Link>

        {/* Weekly progress */}
        <Link href="/calendar" className={`${card} flex flex-col p-4 hover:border-gold-muted`}>
          <span id="home-week" className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="size-4 text-gold" aria-hidden /> This week
          </span>
          <span className="mt-2 text-xl font-bold tabular-nums">
            {sessionsThisWeek}
            {weeklyTarget ? <span className="text-base font-medium text-muted-foreground"> / {weeklyTarget}</span> : null}
          </span>
          <span className="text-sm text-muted-foreground">this week</span>
          <WeekBars days={weekly.days} className="mt-2" />
        </Link>
      </div>

      <Link
        href="/progress"
        className="flex min-h-14 items-center gap-3 rounded-2xl border border-gold/70 bg-gradient-to-r from-gold/12 to-transparent px-4 py-3 shadow-bronze hover:border-gold-highlight"
      >
        <TrendingUp className="size-5 text-gold" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">My Progress</span>
          <span className="block truncate text-sm text-muted-foreground">Overview, badges, history</span>
        </span>
        <ChevronRight className="size-5 text-gold" aria-hidden />
      </Link>

      <Link href="/calendar" className={`${card} flex min-h-14 items-center gap-3 px-4 py-3 hover:border-gold-muted`}>
        <CalendarDays className="size-5 text-gold" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">Training calendar</span>
          <span className="block truncate text-sm text-muted-foreground">Completed and upcoming sessions</span>
        </span>
        <ChevronRight className="size-5 text-gold" aria-hidden />
      </Link>

      <nav aria-label="More for today" className="grid grid-cols-3 gap-2">
        {[
          { href: "/progress#steps", icon: Footprints, label: "Steps" },
          { href: "/nutrition/supplements", icon: Pill, label: "Supplements" },
          { href: "/train/recovery", icon: HeartPulse, label: "Recovery" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className={`${card} flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-sm font-medium hover:border-gold-muted`}>
            <l.icon className="size-5 shrink-0 text-gold" aria-hidden /> {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
