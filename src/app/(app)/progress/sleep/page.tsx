import Link from "next/link";
import { AlarmClock, BookOpen, CalendarClock, ChevronRight, ClipboardPen, Dumbbell, History, Hourglass, Lightbulb, Moon, Settings2, Sun, X } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { listSleepCheckins } from "@/server/services/sleep";
import { clockToMinutes } from "@/lib/domain/sleep-checkins";
import { describeAlarm, parseAlarmConfig } from "@/lib/domain/sleep-alarm";
import { sleepWindows } from "@/lib/domain/sleep-schedule";
import { sleepTips } from "@/lib/domain/sleep-habits";
import { dismissSleepTipAction, restoreSleepTipsAction } from "@/server/actions/sleep";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { SleepConsentCard } from "@/components/sleep/consent-card";
import { NightBars } from "@/components/sleep/night-bars";
import { QuickCheckin } from "@/components/sleep/quick-checkin";
import { SleepScoreCard } from "@/components/sleep/score-card";
import { formatNightDate, SleepSessionList } from "@/components/sleep/session-list";
import { SleepTimerCard } from "@/components/sleep/timer-card";
import { SleepSourceCard, type SleepSourceStatus } from "@/components/sleep/source-card";
import { StageBar, stageTotals } from "@/components/sleep/stage-timeline";
import { RecordedBadge, VitalsCards } from "@/components/sleep/vitals-cards";
import { PullToRefresh } from "@/components/platform/pull-to-refresh";
import { listSleepImportRuns, listSleepStages, type SleepStageRow } from "@/server/services/sleep";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { clockMinutesInTz, DEFAULT_SLEEP_GOAL_MINUTES, formatClock, formatDuration, summarizeNights, type SleepSession } from "@/lib/domain/sleep";
import { nightlyScore } from "@/lib/domain/sleep-score";
import { averageAsleepMinutes, goalPct, nightSlots, scheduleStats, STEADINESS_TEXT } from "@/lib/domain/sleep-stats";
import { DEBT_BAND_TEXT, sleepDebt } from "@/lib/domain/sleep-debt";
import { hasFeature } from "@/lib/domain/plans";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { logError } from "@/server/log";
import { getRunningSleepSession, getSleepCheckin, listSleepSessions } from "@/server/services/sleep";
import type { SleepCheckin } from "@/lib/domain/sleep-checkins";
import { DemoNote } from "@/components/demo/demo-note";

const SAVED_TEXT: Record<string, string> = { "1": "Sleep saved.", checkin: "Check-in saved.", cleared: "Check-in cleared." };

export const metadata = { title: "Sleep & Recovery" };

export default async function SleepPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { user, profile } = await requireOnboardedUser();
  const { saved } = await searchParams;
  const supabase = await getServerSupabase();
  const tz = profile.timezone ?? "UTC";
  const today = isoDateInTz(new Date(), tz);
  const goal = profile.sleep_goal_minutes ?? DEFAULT_SLEEP_GOAL_MINUTES;
  const consented = Boolean(profile.wellness_consent_at);
  const plan = await getUserPlan(user.id);
  const analytics = hasFeature(plan, "sleep_analytics");

  let sessions: SleepSession[] = [];
  let running: SleepSession | null = null;
  let checkin: SleepCheckin | null = null;
  let checkins: SleepCheckin[] = [];
  let runs: Awaited<ReturnType<typeof listSleepImportRuns>> = [];
  let loadFailed = false;
  if (consented) {
    try {
      [sessions, running, checkin, checkins, runs] = await Promise.all([
        listSleepSessions(supabase, user.id, { fromNight: addDays(today, -29) }),
        getRunningSleepSession(supabase, user.id),
        getSleepCheckin(supabase, user.id, today),
        listSleepCheckins(supabase, user.id, addDays(today, -13), today),
        listSleepImportRuns(supabase, user.id, 1).catch(() => []),
      ]);
    } catch (err) {
      logError("sleep.page", err);
      loadFailed = true;
    }
  }
  const nights = summarizeNights(sessions);
  const lastNight = nights.find((n) => n.nightOf === today) ?? nights[0] ?? null;
  let lastStages: SleepStageRow[] = [];
  if (lastNight?.recorded) {
    try {
      lastStages = await listSleepStages(supabase, user.id, lastNight.sessions.map((s) => s.id));
    } catch (err) {
      logError("sleep.page.stages", err);
    }
  }
  const lastTotals = lastStages.length ? stageTotals(lastStages) : null;
  const lastRun = runs[0] ?? null;
  const sourceStatus: SleepSourceStatus = {
    source: profile.sleep_import_source ?? null,
    connectedAt: profile.sleep_import_connected_at ?? null,
    importEnabled: profile.sleep_import_enabled ?? true,
    lastSync: lastRun ? { at: lastRun.created_at, device: lastRun.device, added: lastRun.added, updated: lastRun.updated, withVitals: lastRun.with_vitals } : null,
    deviceName: nights.find((n) => n.deviceName)?.deviceName ?? null,
    timeZone: tz,
  };
  const fortnight = nights.filter((n) => n.nightOf >= addDays(today, -13));
  const week = nightSlots(fortnight, today, 7);
  const weekAvg = averageAsleepMinutes(week.flatMap((s) => (s.night ? [s.night] : [])));
  const schedule = scheduleStats(fortnight);
  const lastPct = goalPct(lastNight?.asleepMinutes ?? null, goal);
  const lastScore = lastNight ? nightlyScore(lastNight, goal, scheduleStats(nights.filter((n) => n.nightOf < lastNight.nightOf && n.nightOf >= addDays(lastNight.nightOf, -14)))) : null;
  const recent = sessions.filter((s) => s.nightOf >= addDays(today, -13));
  const debt = analytics ? sleepDebt(fortnight, goal, today) : null;
  const windows = sleepWindows(fortnight, goal, clockToMinutes(profile.sleep_target_wake ?? null));
  const naps = sessions.filter((s) => s.kind === "nap" && s.endedAt && s.nightOf >= addDays(today, -13));
  const dismissed = profile.sleep_tips_dismissed ?? [];
  const tips = sleepTips({ nights: fortnight, naps, checkins, goalMinutes: goal, debtMinutes: debt && debt.nightsWithData ? debt.debtMinutes : null, windows, dismissed });
  const alarm = parseAlarmConfig(profile.sleep_alarm);
  const links = [
    { href: "/progress/sleep/history", icon: History, title: "Sleep history", body: "Every night, with averages over 7 days to a year" },
    {
      href: "/progress/sleep/schedule",
      icon: CalendarClock,
      title: "Sleep schedule",
      body: !analytics ? "Pro: a suggested bedtime and wake-up window, and a gradual plan to get there" : windows.bedWindow ? `Bed ${formatClock(windows.bedWindow.start)}–${formatClock(windows.bedWindow.end)} · up ${formatClock(windows.wakeWindow!.start)}–${formatClock(windows.wakeWindow!.end)}` : "Log three nights or set a wake time for your windows",
    },
    {
      href: "/progress/sleep/energy",
      icon: Sun,
      title: "Daily energy",
      body: !analytics ? "Pro: when you're likely to feel sharp or flat today, next to what you report" : "Estimated alertness through today, and your reported energy",
    },
    {
      href: "/progress/sleep/training",
      icon: Dumbbell,
      title: "Sleep & training",
      body: hasFeature(plan, "sleep_ai_coaching") ? "Your nights and your workouts side by side, with sleep-aware suggestions you accept or decline" : "Pro: your nights and workouts side by side, and sleep-aware training suggestions",
    },
    {
      href: "/progress/sleep/debt",
      icon: Hourglass,
      title: "Estimated sleep debt",
      body: !analytics ? "Pro: how far behind your goal you are over the last two weeks, night by night" : debt && debt.nightsWithData ? `${formatDuration(debt.debtMinutes)} behind · ${DEBT_BAND_TEXT[debt.band]}` : "Log a night to start the estimate",
    },
    { href: "/progress/sleep/alarm", icon: AlarmClock, title: "Wake-up alarm", body: alarm.enabled ? describeAlarm(alarm) : "Off · a repeating alarm with snooze, from the phone app" },
    { href: "/progress/sleep/settings", icon: Settings2, title: "Goal & privacy", body: `Goal ${formatDuration(goal)} · what is stored and how to delete it` },
    { href: "/progress/sleep/method", icon: BookOpen, title: "How it's worked out", body: "Every figure explained, nothing guessed" },
  ];
  const card = "rounded-2xl border border-border bg-card p-5";

  return (
    <div className="space-y-6">
      <BackLink href="/progress">My Progress</BackLink>
      <DemoNote topic="sleep" />
      <PageHeader
        eyebrow="My Progress"
        title="Sleep & Recovery"
        description="Your nights as your watch recorded them through Apple Health or Health Connect, or by timer and by hand. The app itself measures nothing, and anything assumed is labelled."
        actions={
          consented ? (
            <Button asChild variant="secondary">
              <Link href="/progress/sleep/log">
                <ClipboardPen className="size-4" aria-hidden /> Enter sleep by hand
              </Link>
            </Button>
          ) : undefined
        }
      />

      {saved && SAVED_TEXT[saved] && <Notice tone="success">{SAVED_TEXT[saved]}</Notice>}
      {loadFailed && <Notice tone="error">Your sleep history couldn&apos;t be loaded. Try again in a moment.</Notice>}

      {!consented ? (
        <SleepConsentCard />
      ) : (
        <PullToRefresh>
          <div className="space-y-6">
          <SleepSourceCard status={sourceStatus} />
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="bg-card-gradient rounded-2xl border border-border p-5" aria-labelledby="last-night-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="last-night-title" className="font-display text-xl font-bold uppercase">
                  Last night
                </h2>
                {lastNight && <RecordedBadge recorded={lastNight.recorded} deviceName={lastNight.deviceName} />}
              </div>
              {lastNight ? (
                <>
                  <p className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-5xl font-bold text-gold-highlight">{formatDuration(lastTotals ? lastTotals.asleepMinutes : lastNight.asleepMinutes)}</span>
                    <span className="text-sm text-muted-foreground">{lastTotals ? "asleep (recorded)" : lastNight.asleepEstimated ? "in bed" : "asleep (your estimate)"}</span>
                  </p>
                  {lastTotals && <StageBar totals={lastTotals} className="mt-3" />}
                  {lastNight.recorded && <VitalsCards vitals={lastNight.vitals} deviceName={lastNight.deviceName} compact className="mt-3" />}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lastNight.nightOf === today ? "The night just gone" : formatNightDate(lastNight.nightOf)} · {formatClock(clockMinutesInTz(lastNight.bedAt, lastNight.timezone))} – {formatClock(clockMinutesInTz(lastNight.wakeAt, lastNight.timezone))}
                  </p>
                  {lastPct !== null && (
                    <div className="mt-3 space-y-1">
                      <ProgressBar value={lastPct} label={`${lastPct}% of your ${formatDuration(goal)} goal`} />
                      <p className="text-xs text-muted-foreground">
                        {lastPct >= 100 ? "Goal reached" : `${lastPct}% of your ${formatDuration(goal)} goal`}
                      </p>
                    </div>
                  )}
                  {lastScore && (
                    <div className="mt-3 border-t border-border pt-3">
                      <SleepScoreCard score={lastScore} breakdown={false} compact />
                    </div>
                  )}
                  <Link href={`/progress/sleep/night/${lastNight.nightOf}`} className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold-highlight underline">
                    Nightly report <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No sleep logged in the last 30 days. Start the timer tonight or enter last night by hand.</p>
              )}
            </section>

            <SleepTimerCard running={running} timezone={tz} />
          </div>

          <section className={card} aria-labelledby="checkin-title">
            <h2 id="checkin-title" className="font-display text-xl font-bold uppercase">
              Morning check-in
            </h2>
            <p className="mt-1 mb-3 text-sm text-muted-foreground">Optional and quick. Over time it shows which habits go with your better and worse nights.</p>
            <QuickCheckin day={today} restedness={checkin?.restedness ?? null} />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={card} aria-labelledby="week-title">
              <h2 id="week-title" className="font-display text-xl font-bold uppercase">
                This week
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {weekAvg === null ? "No nights logged in the last seven days." : `Average ${formatDuration(weekAvg)} over ${week.filter((s) => s.night).length} logged ${week.filter((s) => s.night).length === 1 ? "night" : "nights"}.`}
              </p>
              <NightBars slots={week} goalMinutes={goal} className="mt-4" />
            </section>

            <section className={card} aria-labelledby="schedule-title">
              <h2 id="schedule-title" className="font-display text-xl font-bold uppercase">
                Your rhythm
              </h2>
              {schedule.steadiness ? (
                <>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-elevated p-3">
                      <dt className="text-xs text-muted-foreground">Typical bedtime</dt>
                      <dd className="font-display text-2xl font-bold text-gold-highlight">{formatClock(schedule.typicalBed!)}</dd>
                      <dd className="text-xs text-muted-foreground">moves ±{schedule.bedSpread} min</dd>
                    </div>
                    <div className="rounded-xl bg-elevated p-3">
                      <dt className="text-xs text-muted-foreground">Typical wake time</dt>
                      <dd className="font-display text-2xl font-bold text-gold-highlight">{formatClock(schedule.typicalWake!)}</dd>
                      <dd className="text-xs text-muted-foreground">moves ±{schedule.wakeSpread} min</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-sm text-muted-foreground">{STEADINESS_TEXT[schedule.steadiness]} Based on {schedule.nights} nights in the last two weeks.</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Log three nights in a fortnight and your typical bedtime, wake time and how steady they are appear here.</p>
              )}
            </section>
          </div>

          {(tips.length > 0 || dismissed.length > 0) && (
            <section className={card} aria-labelledby="tips-title">
              <h2 id="tips-title" className="flex items-center gap-2 font-display text-xl font-bold uppercase">
                <Lightbulb className="size-5 text-gold" aria-hidden /> Habits to work on
              </h2>
              {tips.length ? (
                <ul className="mt-3 space-y-3">
                  {tips.map((t) => (
                    <li key={t.key} className="rounded-xl bg-elevated p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{t.title}</p>
                        <ActionButton action={dismissSleepTipAction} fields={{ key: t.key }} variant="ghost" size="icon-sm" aria-label={`Dismiss: ${t.title}`}>
                          <X className="size-4" aria-hidden />
                        </ActionButton>
                      </div>
                      <p className="text-sm text-muted-foreground">{t.why}</p>
                      <p className="mt-1 text-sm">{t.action}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Nothing new to suggest right now.</p>
              )}
              {dismissed.length > 0 && (
                <div className="mt-3">
                  <ActionButton action={restoreSleepTipsAction} fields={{}} variant="ghost" size="sm">
                    Show dismissed tips again
                  </ActionButton>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">General sleep-habit guidance from your own entries, not medical advice. Nothing here changes your training or suggests medication.</p>
            </section>
          )}

          <nav aria-label="More about your sleep" className="space-y-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-gold-muted">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-elevated text-gold">
                  <l.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{l.title}</span>
                  <span className="block text-sm text-muted-foreground">{l.body}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
              </Link>
            ))}
          </nav>

          <section className="space-y-3" aria-labelledby="recent-sleep-title">
            <h2 id="recent-sleep-title" className="flex items-center gap-2 font-display text-xl font-bold uppercase">
              <Moon className="size-5 text-gold" aria-hidden /> Last 14 days
            </h2>
            <SleepSessionList sessions={recent} emptyText="Nothing logged yet. Entries you add appear here with their source, and you can edit or delete any of them." />
          </section>
          </div>
        </PullToRefresh>
      )}
    </div>
  );
}
