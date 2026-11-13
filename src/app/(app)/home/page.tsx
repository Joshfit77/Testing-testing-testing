import Link from "next/link";
import { Suspense } from "react";
import { TodaysRemindersSection } from "@/components/notifications/todays-reminders-section";
import { BarChart3, BookOpen, Bot, CalendarDays, ChevronRight, FileText, Footprints, HandHeart, HeartPulse, Moon, ScanBarcode, SlidersHorizontal, Sparkles, Utensils, Wand2 } from "lucide-react";
import { SceneHero } from "@/components/common/scene-hero";
import { LogoMark } from "@/components/common/logo";
import { StatTile } from "@/components/ui/stat-tile";
import { CoachButton, SearchButton } from "@/components/shell/main-header";
import { QuickAddButton } from "@/components/shell/quick-add";
import { readinessBand } from "@/lib/domain/readiness";
import { isDemoMode } from "@/server/demo";
import { Notice } from "@/components/common/states";
import { TodayWorkoutAction } from "@/components/home/today-workout-action";
import { WaterQuick } from "@/components/home/water-quick";
import { WeekBars } from "@/components/home/week-bars";
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
import { todayWorkoutLink } from "./today-workout/link";
import { scriptureParts } from "@/server/bible/text";
import { ScriptureText } from "@/components/bible/scripture-text";
import { loadReadingState } from "@/server/services/bible";
import { loadActiveJourney } from "@/server/services/journeys";
import { todayReadingLink } from "@/lib/faith/today-reading";
import { latestDuePeriod } from "@/lib/domain/weekly-report";

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
  const [plan, data, active, weekly, inProgressRes, answersRes, schedule, waterRes, goalsRes, reading, readinessRes, journey] = await Promise.all([
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
    supabase.from("recovery_checkins").select("readiness_score, checked_on").eq("user_id", user.id).order("checked_on", { ascending: false }).limit(1).maybeSingle(),
    loadActiveJourney(supabase, user.id, profile.timezone).catch((err: unknown) => {
      logError("home.journey", err);
      return null;
    }),
  ]);
  // Weekly report card: Pro sees the latest due report (built on open of the reports page); after Pro ends, past
  // reports stay readable, so the card stays while there are any. Nobody else sees an advert here.
  const reportsPro = hasFeature(plan, "weekly_reports");
  const latestReport = await supabase
    .from("weekly_reports")
    .select("week_start, read_at")
    .eq("user_id", user.id)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle()
    .then((r) => (r.data as { week_start: string; read_at: string | null } | null) ?? null, () => null);
  const duePeriod = latestDuePeriod(new Date(), profile.timezone);
  // One answer to "what should I read now?", shared with the Faith tab: today's journey passage, else the last chapter.
  const read = todayReadingLink(journey, reading);
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
  // The greeting follows the member's clock, like the reference screens ("Good morning, …").
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: profile.timezone }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const readiness = readinessRes.data ? { score: readinessRes.data.readiness_score as number, on: readinessRes.data.checked_on as string } : null;
  const readinessToday = readiness?.on === todayIso || readiness?.on === isoDateInTz(new Date(Date.now() - 86400000), profile.timezone);
  const readinessLabel = !readiness || !readinessToday ? "Check in" : readinessBand(readiness.score) === "high" ? "Ready" : readinessBand(readiness.score) === "moderate" ? "Go easy" : "Rest";
  const showScripture = profile.home_scripture ?? true;
  const verse = scriptureForDate(data.today);
  const todayWorkout = todayWorkoutLink(active, schedule, data.today);
  const startHref = todayWorkout.href;
  const weeklyTarget = active?.daysPerWeek ?? answers?.days_per_week ?? null;
  const sessionsThisWeek = weekly.workouts.length;
  const todayLong = new Date(`${data.today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const today = active?.today ?? null;
  const next = schedule?.planned[0] && today && schedule.planned[0].dayId === today.id ? schedule.planned[0] : null;
  const plannedLater = next && next.date > data.today ? next : null;
  const plannedLabel = plannedLater ? new Date(`${plannedLater.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }) : null;
  const water = (waterRes.data ?? []).reduce((s, w) => s + (w.amount_ml as number), 0);
  const waterGoal = (goalsRes.data?.water_ml as number | undefined) ?? 2500;
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
      <section key="workout" className="space-y-3" aria-labelledby="today-title" data-testid="home-workout">
        <div className="card-gold rounded-2xl p-4">
          <Link href={active ? `/train/programs/${active.programSlug}` : "/train"} className="block min-w-0 rounded-xl hover:bg-white/5">
            <span className="flex items-center gap-2">
              <h2 id="today-title" className="font-display text-xl font-bold">
                Today&apos;s Workout
              </h2>
              {plannedLater && (
                <span className="rounded-full border border-gold/50 bg-black/30 px-2 py-0.5 text-xs font-semibold text-gold-highlight" data-testid="today-rest">
                  Rest day today
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-lg font-semibold text-foreground/95">{today ? today.name : active ? "Program complete" : "No program yet"}</span>
            <span className="block text-sm text-muted-foreground" data-testid="today-detail">
              {today && active && plannedLater
                ? `Week ${active.currentWeek} · Day ${active.currentDay} of ${active.daysPerWeek} · planned for ${plannedLabel}${plannedLater.moved ? " (moved)" : ""}`
                : today && active
                  ? [today.estimated_minutes ? `${today.estimated_minutes} min` : null, `${today.exercises.length} exercise${today.exercises.length === 1 ? "" : "s"}`, `Week ${active.currentWeek} of ${active.durationWeeks}`, `Day ${active.currentDay} of ${active.daysPerWeek}`]
                      .filter(Boolean)
                      .join(" • ")
                  : active
                    ? "Choose your next program in Train"
                    : "Log a free workout or pick a program"}
            </span>
          </Link>
          <div className="mt-3">
            <TodayWorkoutAction
              userId={user.id}
              startHref={startHref}
              serverInProgress={(inProgressRes.data?.name as string | undefined) ?? null}
              startLabel={plannedLater ? "Start workout early" : today ? "Start today's workout" : "Start workout"}
              detail={today?.estimated_minutes ? `${today.estimated_minutes} min` : null}
            />
          </div>
          {(next || !active) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4">
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
          )}
        </div>
        <div className="grid grid-cols-2 gap-3" aria-label="Recovery and progress">
          <StatTile icon={HeartPulse} label="Recovery" value={readinessLabel} tone={readinessLabel === "Ready" ? "good" : "default"} href="/train/recovery" testId="home-recovery" />
          <StatTile icon={BarChart3} label="Week streak" value={data.weekStreak === 1 ? "1 week" : `${data.weekStreak} weeks`} tone={data.weekStreak > 0 ? "good" : "default"} href="/progress" testId="home-progress" />
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
        <Link href={read.href} className="mt-2 flex min-h-14 items-center gap-3 rounded-xl hover:bg-elevated/50" data-testid="home-reading-link">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-elevated text-gold">
            <BookOpen className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold">{read.title}</span>
            <span className="block truncate text-sm text-muted-foreground">
              {read.detail} · {TRANSLATION.name}
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
    verse: null,
    week: (
      <section key="week" className={`${card} p-4`} aria-labelledby="home-week" data-testid="home-week">
        <Link href="/progress" className="flex items-center justify-between gap-3 rounded-xl hover:bg-elevated/40">
          <span className="min-w-0">
            <h2 id="home-week" className="font-display text-xl font-bold">
              This Week
            </h2>
            <span className="block text-base text-foreground/90">
              <span className="font-semibold tabular-nums">{sessionsThisWeek}</span>
              {weeklyTarget ? <span className="tabular-nums"> of {weeklyTarget}</span> : null} workouts
              {data.weekStreak > 0 ? <span className="text-muted-foreground"> · {data.weekStreak} week streak</span> : null}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-gold-highlight">
            My Progress <ChevronRight className="size-5" aria-hidden />
          </span>
        </Link>
        <ProgressBar className="mt-3 h-3" value={weeklyTarget ? Math.min(100, (sessionsThisWeek / weeklyTarget) * 100) : sessionsThisWeek > 0 ? 100 : 0} label="Workouts done this week" />
        <WeekBars days={weekly.days} className="mt-4" />
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
    report:
      reportsPro || latestReport ? (
        <Link key="report" href={latestReport?.week_start === duePeriod.weekStart ? `/progress/reports/${duePeriod.weekStart}` : "/progress/reports"} className={row} data-testid="home-report-card">
          <FileText className="size-5 text-gold" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">Weekly report</span>
            <span className="block truncate text-sm text-muted-foreground">
              {!reportsPro
                ? "Your past reports"
                : latestReport?.week_start === duePeriod.weekStart
                  ? latestReport.read_at
                    ? "Last week's report · read again or share"
                    : "Last week's report is ready"
                  : "Last week's report · tap to open"}
            </span>
          </span>
          <ChevronRight className="size-5 text-gold" aria-hidden />
        </Link>
      ) : null,
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
      <SceneHero className={isDemoMode() ? "-mx-4 rounded-2xl md:mx-0" : "-mx-4 -mt-[calc(env(safe-area-inset-top)+0.25rem)] pt-[env(safe-area-inset-top)] md:mx-0 md:mt-0 md:rounded-2xl"} minHeight="min-h-[21rem]">
        <div className="flex flex-col px-4 pb-6 pt-3">
          <header className="flex items-center justify-between gap-2 @container">
            {/* The buttons never shrink (they were pushed past the screen edge); the wordmark wraps instead. */}
            <span className="inline-flex min-w-0 items-center gap-2">
              <LogoMark className="size-8 shrink-0" />
              <span className="min-w-0 font-serif text-sm font-semibold uppercase leading-none tracking-[0.18em] text-champagne [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]">Narrow Gate Fitness</span>
            </span>
            <span className="flex shrink-0 items-center gap-0.5">
              <SearchButton />
              <QuickAddButton userId={user.id} today={data.today} todayWorkout={todayWorkout} />
              <CoachButton compact />
            </span>
          </header>
          <h1 className="mt-14 font-display text-[2.125rem] font-bold leading-[1.1] tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.7)] [text-wrap:balance]">
            {greeting},
            <br />
            {firstName}
          </h1>
          <p className="mt-2 text-sm text-white/80 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]">{todayLong}</p>
          {/* The verse lives in the hero; it shows while the layout keeps the "verse" module (hidden by Customize Home
              or by the Scripture card switch). */}
          {layout.includes("verse") && (
            <Link href="/faith#todays-devotional" className="group mt-4 block max-w-[22rem] rounded-lg focus-visible:ring-2 focus-visible:ring-gold-highlight">
              <span className="sr-only">Verse of the day: </span>
              <blockquote className="font-serif text-[1.0625rem] italic leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.75)]">
                &ldquo;<ScriptureText parts={scriptureParts(verse.reference, verseExcerpt(verse.text))} />&rdquo;
              </blockquote>
              <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]">
                {verse.reference} ({TRANSLATION.code}) <ChevronRight className="size-4 text-gold-highlight transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
              <span className="sr-only">. Open today&apos;s devotional.</span>
            </Link>
          )}
        </div>
      </SceneHero>

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
