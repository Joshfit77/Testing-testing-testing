import Link from "next/link";
import { AlarmClock, BookOpen, CalendarClock, ChevronRight, ClipboardPen, Dumbbell, History, Hourglass, Lightbulb, Moon, Settings2, Sun, X } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { listSleepCheckins } from "@/server/services/sleep";
import { clockToMinutes } from "@/lib/domain/sleep-checkins";
import { describeAlarm, parseAlarmConfig } from "@/lib/domain/sleep-alarm";
import { sleepWindows, windDownStart } from "@/lib/domain/sleep-schedule";
import { sleepTips, type SleepTip } from "@/lib/domain/sleep-habits";
import { recoveryInsight } from "@/lib/domain/sleep-insight";
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
import { RecordedBadge } from "@/components/sleep/vitals-cards";
import { PullToRefresh } from "@/components/platform/pull-to-refresh";
import { listSleepImportRuns } from "@/server/services/sleep";
import { Button } from "@/components/ui/button";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { clockMinutesInTz, DEFAULT_SLEEP_GOAL_MINUTES, formatClock, formatDuration, summarizeNights, type SleepSession } from "@/lib/domain/sleep";
import { nightlyScore } from "@/lib/domain/sleep-score";
import { ThirtyDaySummaryCard } from "@/components/sleep/thirty-day-summary";
import { thirtyDaySummary } from "@/lib/domain/sleep-summary";
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
/** Entries listed at the foot of the dashboard; History has every night. */
const RECENT_ENTRIES = 3;

export const metadata = { title: "Sleep & Recovery" };

function TipItem({ tip }: { tip: SleepTip }) {
  return (
    <li className="rounded-xl bg-elevated p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{tip.title}</p>
        <ActionButton action={dismissSleepTipAction} fields={{ key: tip.key }} variant="ghost" size="icon-sm" className="shrink-0" aria-label={`Dismiss: ${tip.title}`}>
          <X className="size-4" aria-hidden />
        </ActionButton>
      </div>
      <p className="text-sm text-muted-foreground">{tip.why}</p>
      <p className="mt-1 text-sm">{tip.action}</p>
    </li>
  );
}

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
  const weekNights = week.flatMap((s) => (s.night ? [s.night] : []));
  const weekAvg = averageAsleepMinutes(weekNights);
  const schedule = scheduleStats(fortnight);
  const lastPct = goalPct(lastNight?.asleepMinutes ?? null, goal);
  const lastScore = lastNight ? nightlyScore(lastNight, goal, scheduleStats(nights.filter((n) => n.nightOf < lastNight.nightOf && n.nightOf >= addDays(lastNight.nightOf, -14)))) : null;
  const recent = sessions.filter((s) => s.nightOf >= addDays(today, -13));
  const debt = analytics ? sleepDebt(fortnight, goal, today) : null;
  const insight = recoveryInsight({ week: weekNights, goalMinutes: goal, debt });
  const windows = sleepWindows(fortnight, goal, clockToMinutes(profile.sleep_target_wake ?? null));
  const naps = sessions.filter((s) => s.kind === "nap" && s.endedAt && s.nightOf >= addDays(today, -13));
  const dismissed = profile.sleep_tips_dismissed ?? [];
  const tips = sleepTips({ nights: fortnight, naps, checkins, goalMinutes: goal, debtMinutes: debt && debt.nightsWithData ? debt.debtMinutes : null, windows, dismissed });
  const [tip, ...moreTips] = tips;
  const alarm = parseAlarmConfig(profile.sleep_alarm);
  const month = thirtyDaySummary(nights, goal, today);
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
  const isLastNight = lastNight?.nightOf === today;
  // The same label as the nightly report: measured, taken as time in bed, or the member's own estimate.
  const asleepLabel = !lastNight ? "" : lastNight.asleepEstimated ? "in bed" : lastNight.recorded ? "asleep (recorded)" : "asleep (your estimate)";

  return (
    <div className="space-y-6">
      <BackLink href="/progress">My Progress</BackLink>
      <DemoNote topic="sleep" when={sessions.length > 0} />
      <PageHeader
        title="Sleep & Recovery"
        description="From your watch, the timer or by hand. Estimates are labelled."
        actions={
          consented ? (
            <Button asChild variant="secondary" size="sm">
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
            {/* The first screen on a phone: last night (time asleep, goal, score), the last seven nights and one line
                on recovery, with the source as one line at the foot. Stages and overnight measurements are on the
                nightly report. */}
            <section className="bg-card-gradient rounded-2xl border border-border p-4 sm:p-5" aria-labelledby="last-night-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="last-night-title" className="font-display text-xl font-bold uppercase">
                  {!lastNight || isLastNight ? "Last night" : formatNightDate(lastNight.nightOf)}
                </h2>
                {lastNight && <RecordedBadge recorded={lastNight.recorded} deviceName={lastNight.deviceName} />}
              </div>
              {lastNight ? (
                <>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                    <span className="font-display text-5xl font-bold text-gold-highlight">{formatDuration(lastNight.asleepMinutes)}</span>
                    <span className="text-sm text-muted-foreground">{asleepLabel}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatClock(clockMinutesInTz(lastNight.bedAt, lastNight.timezone))} – {formatClock(clockMinutesInTz(lastNight.wakeAt, lastNight.timezone))}
                    {lastPct !== null && <> · {lastPct >= 100 ? <span className="font-semibold text-foreground">Goal reached</span> : `${lastPct}% of your ${formatDuration(goal)} goal`}</>}
                  </p>
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-x-3">
                    {lastScore && (
                      <div className="min-w-0 flex-1 basis-52">
                        <SleepScoreCard score={lastScore} breakdown={false} compact />
                      </div>
                    )}
                    <Link href={`/progress/sleep/night/${lastNight.nightOf}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-gold-highlight underline">
                      Nightly report <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  </div>

                  <div className="mt-2 border-t border-border pt-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h3 className="text-sm font-semibold">Last 7 nights</h3>
                      <p className="text-xs text-muted-foreground">{weekAvg === null ? "None logged" : `Average ${formatDuration(weekAvg)} · ${weekNights.length} logged`}</p>
                    </div>
                    <NightBars slots={week} goalMinutes={goal} className="mt-2" />
                  </div>
                  <div className="mt-3 flex gap-2 text-sm" data-testid="sleep-insight">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                    <p>
                      {insight.text}
                      {insight.href && (
                        <>
                          {" "}
                          <Link href={insight.href} className="font-semibold text-gold-highlight underline">
                            {insight.linkLabel}
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="mt-2 border-t border-border pt-2">
                    <SleepSourceCard status={sourceStatus} variant="inline" />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No sleep logged in the last 30 days. Tonight, tap <strong className="text-foreground">Going to bed</strong> on the sleep timer below, or{" "}
                  <Link href="/progress/sleep/log" className="font-semibold text-gold-highlight underline">
                    enter last night by hand
                  </Link>
                  . Stages and overnight heart rate come from a watch, connected in the phone app.
                </p>
              )}
            </section>

            {!lastNight && <SleepSourceCard status={sourceStatus} />}

            {(tip || dismissed.length > 0) && (
              <section className={card} aria-labelledby="tips-title">
                <h2 id="tips-title" className="flex items-center gap-2 font-display text-xl font-bold uppercase">
                  <Lightbulb className="size-5 text-gold" aria-hidden /> One habit to try
                </h2>
                {tip ? (
                  <ul className="mt-3 space-y-3">
                    <TipItem tip={tip} />
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Nothing new to suggest right now.</p>
                )}
                {moreTips.length > 0 && (
                  <details className="mt-3">
                    <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-gold-highlight">More habits ({moreTips.length})</summary>
                    <ul className="mt-2 space-y-3">
                      {moreTips.map((t) => (
                        <TipItem key={t.key} tip={t} />
                      ))}
                    </ul>
                  </details>
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

            <section className={card} aria-labelledby="checkin-title">
              <h2 id="checkin-title" className="font-display text-xl font-bold uppercase">
                Morning check-in
              </h2>
              <p className="mt-1 mb-3 text-sm text-muted-foreground">Optional and quick. Over time it shows which habits go with your better and worse nights.</p>
              <QuickCheckin day={today} restedness={checkin?.restedness ?? null} />
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <SleepTimerCard running={running} timezone={tz} />

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
                    <p className="mt-3 text-sm text-muted-foreground">
                      {STEADINESS_TEXT[schedule.steadiness]} Based on {schedule.nights} nights in the last two weeks.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Log three nights in a fortnight and your typical bedtime, wake time and how steady they are appear here.</p>
                )}
                {/* The bedtime window and wind-down time are the same figures the schedule and energy pages show. */}
                {analytics && windows.bedWindow && (
                  <p className="mt-2 text-sm">
                    Suggested bedtime {formatClock(windows.bedWindow.start)}–{formatClock(windows.bedWindow.end)} · start winding down {formatClock(windDownStart(windows.bedWindow))}.
                  </p>
                )}
              </section>
            </div>

            <ThirtyDaySummaryCard summary={month} goalMinutes={goal} />

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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="recent-sleep-title" className="flex items-center gap-2 font-display text-xl font-bold uppercase">
                  <Moon className="size-5 text-gold" aria-hidden /> Recent entries
                </h2>
                {recent.length > 0 && (
                  <Link href="/progress/sleep/history" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold-highlight underline">
                    All nights <ChevronRight className="size-4" aria-hidden />
                  </Link>
                )}
              </div>
              <SleepSessionList sessions={recent.slice(0, RECENT_ENTRIES)} emptyText="Nothing logged yet. Entries you add appear here with their source, and you can edit or delete any of them." />
            </section>
          </div>
        </PullToRefresh>
      )}
    </div>
  );
}
