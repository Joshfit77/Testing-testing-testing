import Link from "next/link";
import { Suspense } from "react";
import { TodaysRemindersSection } from "@/components/notifications/todays-reminders-section";
import { BarChart3, BookOpen, Bot, CalendarDays, ChevronRight, Dumbbell, Footprints, HandHeart, Moon, ScanBarcode, SlidersHorizontal, Sparkles, Utensils, Wand2 } from "lucide-react";
import { Notice } from "@/components/common/states";
import { TodayWorkoutAction } from "@/components/home/today-workout-action";
import { WaterQuick } from "@/components/home/water-quick";
import { WeekBars } from "@/components/home/week-bars";
import { MainHeader } from "@/components/shell/main-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TRANSLATION, scriptureForDate } from "@/data/content";
import { progressPct } from "@/lib/domain/nutrition";
import { hasFeature } from "@/lib/domain/plans";
import type { ExperienceLevel, PrimaryGoal } from "@/lib/domain/types";
import { homeLayout, parseLayoutPrefs, type HomeModule } from "@/lib/layout-prefs";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { logError } from "@/server/log";
import { getWeeklyActivity, type WeeklyActivity } from "@/server/services/activity-summary";
import { getDashboardData } from "@/server/services/dashboard";
import { getActiveProgram } from "@/server/services/training";
import { listSleepSessions } from "@/server/services/sleep";
import { formatDuration, SLEEP_SOURCE_LABELS, summarizeNights } from "@/lib/domain/sleep";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { loadProgramSchedule } from "@/server/services/schedule";
import { buildWeeklyActivity } from "@/lib/domain/activity-week";
import { verseExcerpt } from "@/lib/domain/scripture";
import { scriptureParts } from "@/server/bible/text";
import { ScriptureText } from "@/components/bible/scripture-text";
import { loadReadingState } from "@/server/services/bible";
import { chapterHref, chapterLabel } from "@/lib/bible/books";

export const metadata = { title: "Home" };

const card = "rounded-2xl border border-border bg-card";
const row = `${card} flex min-h-14 items-center gap-3 px-4 py-3 hover:border-gold-muted`;

/**
 * Home: the day's essentials on the first screen, in an order that follows the member's own goal and schedule
 * (src/lib/layout-prefs.ts), which they can reorder or hide from You → Customize Home. Everything else lives in its
 * own tab; nothing was removed, only moved.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const weeklyPromise: Promise<WeeklyActivity> = getWeeklyActivity(user.id, profile.timezone).catch((err: unknown) => {
    logError("home.weekly", err);
    return buildWeeklyActivity(new Date(), profile.timezone, { workouts: [] });
  });
  const todayIso = isoDateInTz(new Date(), profile.timezone);
  const [plan, data, active, weekly, inProgressRes, answersRes, schedule, waterRes, goalsRes, reading] = await Promise.all([
    getUserPlan(user.id),
    getDashboardData(supabase, user.id, profile.timezone),
    getActiveProgram(supabase, user.id),
    weeklyPromise,
    supabase.from("workout_sessions").select("name").eq("user_id", user.id).eq("status", "in_progress").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("onboarding_answers").select("primary_goal, experience, days_per_week, session_minutes").eq("user_id", user.id).maybeSingle(),
    loadProgramSchedule(supabase, user.id, profile.timezone).catch((err: unknown) => {
      logError("home.schedule", err);
      return null;
    }),
    supabase.from("water_entries").select("amount_ml").eq("user_id", user.id).eq("recorded_on", todayIso),
    supabase.from("nutrition_goals").select("water_ml").eq("user_id", user.id).maybeSingle(),
    loadReadingState(supabase, user.id).catch(() => null),
  ]);
  // Last night's sleep: only after wellness consent, and never blocking the page.
  const lastNight = profile.wellness_consent_at
    ? await listSleepSessions(supabase, user.id, { fromNight: addDays(todayIso, -1), toNight: todayIso })
        .then((rows) => summarizeNights(rows)[0] ?? null)
        .catch((err: unknown) => {
          logError("home.sleep", err);
          return null;
        })
    : null;
  const answers = answersRes.data as { primary_goal: PrimaryGoal; experience: ExperienceLevel; days_per_week: number; session_minutes: number } | null;
  const name = profile.display_name ?? "Athlete";
  const firstName = name.trim().split(/\s+/)[0] || name;
  const showScripture = profile.home_scripture ?? true;
  const verse = scriptureForDate(data.today);
  const startHref = active?.today ? `/train/workout?day=${active.today.id}&up=${active.userProgramId}` : "/train/workout?blank=1";
  const weeklyTarget = active?.daysPerWeek ?? answers?.days_per_week ?? null;
  const sessionsThisWeek = weekly.workouts.length;
  const todayLong = new Date(`${data.today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const today = active?.today ?? null;
  const next = schedule?.planned[0] && today && schedule.planned[0].dayId === today.id ? schedule.planned[0] : null;
  const plannedLater = next && next.date > data.today ? next : null;
  const plannedLabel = plannedLater ? new Date(`${plannedLater.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }) : null;
  const water = (waterRes.data ?? []).reduce((s, w) => s + (w.amount_ml as number), 0);
  const waterGoal = (goalsRes.data?.water_ml as number | undefined) ?? 2500;
  const beginner = answers?.experience === "new" || answers?.experience === "beginner";
  const layout = homeLayout(
    {
      goal: answers?.primary_goal ?? null,
      experience: answers?.experience ?? null,
      daysPerWeek: answers?.days_per_week ?? null,
      sessionMinutes: answers?.session_minutes ?? null,
      faithEnabled: profile.faith_enabled ?? true,
      homeScripture: showScripture,
    },
    parseLayoutPrefs(profile.layout_prefs),
  );

  const modules: Record<HomeModule, React.ReactNode> = {
    workout: (
      <section key="workout" className={`${card} p-4`} aria-labelledby="today-title" data-testid="home-workout">
        <div className="flex items-center justify-between gap-2">
          <h2 id="today-title" className="text-sm font-semibold text-muted-foreground">
            Today&apos;s workout
          </h2>
          {plannedLater && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted-foreground" data-testid="today-rest">
              Rest day today
            </span>
          )}
        </div>
        <Link href={active ? `/train/programs/${active.programSlug}` : "/train"} className="mt-2 flex min-h-14 items-center gap-3 rounded-xl hover:bg-elevated/50">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-elevated text-gold">
            <Dumbbell className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-semibold">{today ? today.name : active ? "Program complete" : "No program yet"}</span>
            <span className="block text-sm text-muted-foreground" data-testid="today-detail">
              {today && active && plannedLater
                ? `Week ${active.currentWeek} · Day ${active.currentDay} of ${active.daysPerWeek} · planned for ${plannedLabel}${plannedLater.moved ? " (moved)" : ""}`
                : today && active
                  ? [`Week ${active.currentWeek} of ${active.durationWeeks}`, `Day ${active.currentDay} of ${active.daysPerWeek}`, today.estimated_minutes ? `${today.estimated_minutes} min` : null, `${today.exercises.length} exercise${today.exercises.length === 1 ? "" : "s"}`]
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
          <TodayWorkoutAction userId={user.id} startHref={startHref} serverInProgress={(inProgressRes.data?.name as string | undefined) ?? null} startLabel={plannedLater ? "Start workout early" : today ? "Start Today's Workout" : "Start workout"} />
        </div>
        {beginner && today && (
          <p className="mt-2 text-sm text-muted-foreground" data-testid="beginner-hint">
            Tap Start and the app walks you through each exercise, one set at a time, with a demonstration and a rest timer.
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4">
          {next && (
            <Link href={`/calendar?day=${next.date}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-gold-highlight hover:underline">
              <CalendarDays className="size-4" aria-hidden /> {plannedLater ? "Change the date" : "Move to another day"}
            </Link>
          )}
          {!active && (
            <Link href={hasFeature(plan, "custom_program_builder") ? "/train/build" : "/train/programs"} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-gold-highlight hover:underline">
              <Wand2 className="size-4" aria-hidden /> {hasFeature(plan, "custom_program_builder") ? "Build my program" : "Choose a program"}
            </Link>
          )}
        </div>
      </section>
    ),
    nutrition: (
      <section key="nutrition" className={`${card} p-4`} aria-labelledby="home-nutrition" data-testid="home-nutrition-card">
        <div className="flex items-center justify-between gap-2">
          <h2 id="home-nutrition" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Utensils className="size-4 text-gold" aria-hidden /> Today&apos;s nutrition
          </h2>
          <Link href="/nutrition" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold-highlight hover:underline">
            Nutrition <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xl font-bold tabular-nums">
              {Math.round(data.nutrition.calories).toLocaleString()}
              {data.nutrition.goalCalories ? <span className="text-sm font-medium text-muted-foreground"> / {data.nutrition.goalCalories.toLocaleString()}</span> : null}
            </p>
            <p className="text-sm text-muted-foreground">calories</p>
            {data.nutrition.goalCalories ? <ProgressBar className="mt-1.5" value={progressPct(data.nutrition.calories, data.nutrition.goalCalories)} label="Calories eaten of daily budget" /> : null}
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums">
              {Math.round(data.nutrition.protein_g)}
              {data.nutrition.goalProtein ? <span className="text-sm font-medium text-muted-foreground"> / {data.nutrition.goalProtein} g</span> : <span className="text-sm font-medium text-muted-foreground"> g</span>}
            </p>
            <p className="text-sm text-muted-foreground">protein</p>
            {data.nutrition.goalProtein ? <ProgressBar className="mt-1.5" value={progressPct(data.nutrition.protein_g, data.nutrition.goalProtein)} label="Protein eaten of daily target" /> : null}
          </div>
        </div>
        {!data.nutrition.goalCalories && <p className="mt-1 text-xs text-muted-foreground">No daily target set: log what you like, or set targets in Nutrition.</p>}
        <div className="mt-3 border-t border-border pt-3">
          <WaterQuick date={todayIso} totalMl={water} goalMl={waterGoal} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/nutrition?add=1" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gold/70 bg-gold/10 text-sm font-semibold text-gold-highlight hover:bg-gold/15">
            <Utensils className="size-4" aria-hidden /> Log food
          </Link>
          <Link href="/nutrition/scanner" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-elevated/60 text-sm font-semibold hover:border-gold-muted">
            <ScanBarcode className="size-4 text-gold" aria-hidden /> Scan barcode
          </Link>
        </div>
      </section>
    ),
    faith: (
      <section key="faith" className={`${card} p-4`} aria-labelledby="home-faith" data-testid="home-faith-card">
        <h2 id="home-faith" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <BookOpen className="size-4 text-gold" aria-hidden /> Faith today
        </h2>
        <Link href={reading ? chapterHref(reading.book, reading.chapter, reading.verse ?? undefined) : "/faith/bible"} className="mt-2 flex min-h-14 items-center gap-3 rounded-xl hover:bg-elevated/50">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-elevated text-gold">
            <BookOpen className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold">{reading ? "Continue reading" : "Read the Bible"}</span>
            <span className="block truncate text-sm text-muted-foreground">
              {reading ? `${chapterLabel(reading.book, reading.chapter)}${reading.verse ? `:${reading.verse}` : ""} · ${TRANSLATION.name}` : `The ${TRANSLATION.name}, free to read`}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
        </Link>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link href="/faith#todays-devotional" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-elevated/60 text-sm font-semibold hover:border-gold-muted">
            <Sparkles className="size-4 text-gold" aria-hidden /> Today&apos;s devotional
          </Link>
          <Link href="/faith/journal/new?kind=daily" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-elevated/60 text-sm font-semibold hover:border-gold-muted">
            <HandHeart className="size-4 text-gold" aria-hidden /> Pray
          </Link>
        </div>
      </section>
    ),
    quick: (
      <nav key="quick" aria-label="Quick actions" className="grid grid-cols-3 gap-2">
        {[
          { href: "/run/record?kind=run", icon: Footprints, label: "Run" },
          { href: "/nutrition?add=1", icon: Utensils, label: "Log food" },
          { href: "/coach", icon: Bot, label: "AI Coach" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className={`${card} flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-sm font-semibold hover:border-gold-muted`}>
            <l.icon className="size-5 shrink-0 text-gold" aria-hidden /> {l.label}
          </Link>
        ))}
      </nav>
    ),
    verse: showScripture ? (
      <Link
        key="verse"
        href="/faith#todays-devotional"
        className="group relative block overflow-hidden rounded-2xl border border-border bg-card focus-visible:ring-2 focus-visible:ring-gold-highlight"
        aria-label={`Verse of the day, ${verse.reference}: ${verse.text} Open today's devotional.`}
      >
        {/* Decorative original artwork; the verse is the content. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/mountains-sunrise.svg" alt="" aria-hidden className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent" aria-hidden />
        <div className="relative flex min-h-32 flex-col justify-end p-4">
          <p className="text-xs font-semibold text-champagne">Verse of the day</p>
          <blockquote className="mt-1 max-w-[18rem] font-serif text-[1.25rem] leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
            <ScriptureText parts={scriptureParts(verse.reference, verseExcerpt(verse.text))} />
          </blockquote>
          <p className="mt-1.5 flex items-center gap-1 text-sm text-white/80">
            {verse.reference} ({TRANSLATION.code}) <ChevronRight className="size-4 text-gold transition-transform group-hover:translate-x-0.5" aria-hidden />
          </p>
        </div>
      </Link>
    ) : null,
    week: (
      <section key="week" className={`${card} p-4`} aria-labelledby="home-week">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="home-week" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <BarChart3 className="size-4 text-gold" aria-hidden /> This week
            </h2>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {sessionsThisWeek}
              {weeklyTarget ? <span className="text-sm font-medium text-muted-foreground"> / {weeklyTarget}</span> : null}
              <span className="text-sm font-medium text-muted-foreground"> workouts</span>
            </p>
          </div>
          <WeekBars days={weekly.days} className="w-36" />
        </div>
        <Link href="/progress" className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-gold/70 bg-gradient-to-r from-gold/12 to-transparent px-3 text-sm font-semibold hover:border-gold-highlight">
          <span className="flex-1">My Progress</span>
          <span className="text-muted-foreground">{data.weekStreak} week streak</span>
          <ChevronRight className="size-4 text-gold" aria-hidden />
        </Link>
      </section>
    ),
    sleep: (
      <Link key="sleep" href="/progress/sleep" className={row} data-testid="home-sleep-card">
        <Moon className="size-5 text-gold" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">Sleep &amp; Recovery</span>
          <span className="block truncate text-sm text-muted-foreground">
            {lastNight
              ? `Last night ${formatDuration(lastNight.asleepMinutes)}${lastNight.asleepEstimated ? " in bed" : " asleep"} · ${lastNight.sources.map((s) => SLEEP_SOURCE_LABELS[s]).join(", ")}`
              : profile.wellness_consent_at
                ? "Nothing for last night yet · sync your watch or log it by hand"
                : "Sleep from your watch or by hand: scores, debt, schedule and energy"}
          </span>
        </span>
        <ChevronRight className="size-5 text-gold" aria-hidden />
      </Link>
    ),
    calendar: (
      <Link key="calendar" href="/calendar" className={row}>
        <CalendarDays className="size-5 text-gold" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">Training calendar</span>
          <span className="block truncate text-sm text-muted-foreground">Workouts, runs, walks and planned sessions</span>
        </span>
        <ChevronRight className="size-5 text-gold" aria-hidden />
      </Link>
    ),
  };

  return (
    <div className="space-y-3">
      <MainHeader title={`Hi, ${firstName}`} subtitle={<p className="truncate">{todayLong}</p>} />

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

      {layout.map((m) => modules[m])}

      <Suspense fallback={null}>
        <TodaysRemindersSection supabase={supabase} userId={user.id} profile={profile} />
      </Suspense>

      <p className="text-center">
        <Link href="/profile/customize" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <SlidersHorizontal className="size-4" aria-hidden /> Customize Home
        </Link>
      </p>
    </div>
  );
}
