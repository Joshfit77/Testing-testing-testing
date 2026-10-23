import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { SleepScoreCard } from "@/components/sleep/score-card";
import { formatNightDate, SleepSessionList } from "@/components/sleep/session-list";
import { ProgressBar } from "@/components/ui/progress-bar";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { hasFeature } from "@/lib/domain/plans";
import { circularDistance, clockMinutesInTz, DEFAULT_SLEEP_GOAL_MINUTES, formatClock, formatDuration, minutesBetween, napsOn, SLEEP_SOURCE_LABELS, summarizeNights } from "@/lib/domain/sleep";
import { nightlyScore } from "@/lib/domain/sleep-score";
import { averageAsleepMinutes, goalPct, scheduleStats } from "@/lib/domain/sleep-stats";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { getSleepCheckin, listSleepSessions, listSleepStages, type SleepStageRow } from "@/server/services/sleep";
import { DISTURBANCE_LABELS, EXERCISE_TIMING_LABELS, RATING_FIELDS, RATING_LABELS } from "@/lib/domain/sleep-checkins";

export const metadata = { title: "Nightly report" };

const STAGE_LABEL: Record<SleepStageRow["stage"], string> = { awake: "Awake", light: "Light", deep: "Deep", rem: "REM", asleep: "Asleep (stage not given)", unknown: "Unknown" };

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right">
        <span className="font-semibold">{value}</span>
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </dd>
    </div>
  );
}

export default async function NightReportPage({ params }: { params: Promise<{ date: string }> }) {
  const { user, profile } = await requireOnboardedUser();
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) notFound();
  const tz = profile.timezone ?? "UTC";
  const today = isoDateInTz(new Date(), tz);
  const goal = profile.sleep_goal_minutes ?? DEFAULT_SLEEP_GOAL_MINUTES;
  const supabase = await getServerSupabase();
  const [sessions, before, plan, checkin] = await Promise.all([
    listSleepSessions(supabase, user.id, { fromNight: date, toNight: date }),
    listSleepSessions(supabase, user.id, { fromNight: addDays(date, -14), toNight: addDays(date, -1) }),
    getUserPlan(user.id),
    getSleepCheckin(supabase, user.id, date),
  ]);
  const yesNo = (v: boolean | null) => (v === null ? null : v ? "Yes" : "No");
  const checkinRows: [string, string][] = checkin
    ? [
        ...RATING_FIELDS.flatMap((f): [string, string][] => (checkin[f] === null ? [] : [[RATING_LABELS[f].label.replace(/\?$/, ""), `${checkin[f]} / 5`]])),
        ...(checkin.caffeine_last ? [["Last caffeine", checkin.caffeine_last] as [string, string]] : []),
        ...([
          ["Alcohol", yesNo(checkin.alcohol)],
          ["Large meal near bedtime", yesNo(checkin.late_meal)],
          ["Screens before bed", yesNo(checkin.evening_screens)],
          ["Travel or unusual schedule", yesNo(checkin.travel)],
        ].filter((r): r is [string, string] => r[1] !== null) as [string, string][]),
        ...(checkin.exercise_timing ? [["Training", EXERCISE_TIMING_LABELS[checkin.exercise_timing]] as [string, string]] : []),
        ...(checkin.disturbances.length ? [["Disturbances", checkin.disturbances.map((d) => DISTURBANCE_LABELS[d]).join(", ")] as [string, string]] : []),
        ...(checkin.sleep_aid ? [["Sleep aid", checkin.sleep_aid] as [string, string]] : []),
      ]
    : [];
  const analytics = hasFeature(plan, "sleep_analytics");
  const night = summarizeNights(sessions)[0] ?? null;
  const naps = napsOn(sessions, date);
  const stages = night ? await listSleepStages(supabase, user.id, night.sessions.map((s) => s.id)) : [];
  const previous = summarizeNights(before);
  const prevAvg = averageAsleepMinutes(previous);
  const pattern = scheduleStats(previous);
  const score = night ? nightlyScore(night, goal, pattern) : null;
  const pct = goalPct(night?.asleepMinutes ?? null, goal);
  const stageTotals = stages.reduce<Record<string, number>>((acc, s) => {
    acc[s.stage] = (acc[s.stage] ?? 0) + minutesBetween(s.started_at, s.ended_at);
    return acc;
  }, {});
  const bedDelta = night && pattern.typicalBed !== null ? clockMinutesInTz(night.bedAt, night.timezone) - pattern.typicalBed : null;
  const wakeDelta = night && pattern.typicalWake !== null ? clockMinutesInTz(night.wakeAt, night.timezone) - pattern.typicalWake : null;
  const signed = (d: number) => `${d >= 0 ? "+" : "−"}${Math.abs(d)} min`;
  const card = "rounded-2xl border border-border bg-card p-5";

  return (
    <div className="space-y-6">
      <BackLink href="/progress/sleep">Sleep & Recovery</BackLink>
      <PageHeader
        eyebrow="Nightly report"
        title={formatNightDate(date)}
        description={night ? `${night.sources.map((s) => SLEEP_SOURCE_LABELS[s]).join(", ")}. Figures are what you recorded; anything not entered shows as not recorded.` : "No sleep was logged for this night."}
        actions={
          <div className="flex gap-2">
            <Link href={`/progress/sleep/night/${addDays(date, -1)}`} className="flex min-h-11 items-center gap-1 rounded-xl border border-border px-3 text-sm font-semibold hover:border-gold-muted" aria-label="Previous night">
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </Link>
            {date < today && (
              <Link href={`/progress/sleep/night/${addDays(date, 1)}`} className="flex min-h-11 items-center gap-1 rounded-xl border border-border px-3 text-sm font-semibold hover:border-gold-muted" aria-label="Next night">
                Next <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        }
      />

      {night ? (
        <>
          <section className="bg-card-gradient rounded-2xl border border-border p-5" aria-labelledby="night-total-title">
            <h2 id="night-total-title" className="font-display text-xl font-bold uppercase">
              Time asleep
            </h2>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold text-gold-highlight">{formatDuration(night.asleepMinutes)}</span>
              <span className="text-sm text-muted-foreground">{night.asleepEstimated ? "taken as time in bed" : "your estimate"}</span>
            </p>
            {pct !== null && (
              <div className="mt-3 space-y-1">
                <ProgressBar value={pct} label={`${pct}% of your ${formatDuration(goal)} goal`} />
                <p className="text-xs text-muted-foreground">{pct >= 100 ? `Goal of ${formatDuration(goal)} reached` : `${pct}% of your ${formatDuration(goal)} goal`}</p>
              </div>
            )}
          </section>

          {score && (
            <section className={card} aria-labelledby="night-score-title">
              <h2 id="night-score-title" className="font-display text-xl font-bold uppercase">
                Sleep score
              </h2>
              <div className="mt-2">
                <SleepScoreCard score={score} breakdown={analytics} />
              </div>
            </section>
          )}

          <section className={card} aria-labelledby="night-detail-title">
            <h2 id="night-detail-title" className="font-display text-xl font-bold uppercase">
              The night
            </h2>
            <dl className="mt-2 divide-y divide-border">
              <Row label="Got into bed" value={formatClock(clockMinutesInTz(night.bedAt, night.timezone))} note={bedDelta !== null ? `${signed(bedDelta)} vs your typical bedtime` : undefined} />
              <Row label="Got up" value={formatClock(clockMinutesInTz(night.wakeAt, night.timezone))} note={wakeDelta !== null ? `${signed(wakeDelta)} vs your typical wake time` : undefined} />
              <Row label="Time in bed" value={formatDuration(night.inBedMinutes)} />
              <Row label="Time to fall asleep" value={night.latencyMinutes === null ? "Not recorded" : formatDuration(night.latencyMinutes)} />
              <Row label="Wake-ups" value={night.awakenings === null ? "Not recorded" : String(night.awakenings)} />
              <Row label="Sleep efficiency" value={night.efficiencyPct === null ? "Not recorded" : `${night.efficiencyPct}%`} note={night.efficiencyPct === null ? "Needs when you fell asleep or time awake" : "Time asleep ÷ time in bed"} />
            </dl>
          </section>

          <section className={card} aria-labelledby="night-compare-title">
            <h2 id="night-compare-title" className="font-display text-xl font-bold uppercase">
              Compared with your last two weeks
            </h2>
            {!analytics ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Plus compares each night with your own last two weeks: average time asleep and how far the night was from your usual bedtime and wake time.{" "}
                <Link href="/profile/billing" className="font-semibold text-gold-highlight underline">
                  See plans
                </Link>
              </p>
            ) : prevAvg === null ? (
              <p className="mt-2 text-sm text-muted-foreground">Nothing logged in the previous 14 nights to compare with.</p>
            ) : (
              <dl className="mt-2 divide-y divide-border">
                <Row label={`Average of ${previous.length} ${previous.length === 1 ? "night" : "nights"}`} value={formatDuration(prevAvg)} note={`${signed(night.asleepMinutes - prevAvg)} tonight`} />
                {pattern.typicalBed !== null && <Row label="Typical bedtime" value={formatClock(pattern.typicalBed)} note={`tonight ${circularDistance(clockMinutesInTz(night.bedAt, night.timezone), pattern.typicalBed)} min away`} />}
                {pattern.typicalWake !== null && <Row label="Typical wake time" value={formatClock(pattern.typicalWake)} />}
              </dl>
            )}
          </section>

          <section className={card} aria-labelledby="night-stages-title">
            <h2 id="night-stages-title" className="font-display text-xl font-bold uppercase">
              Sleep stages
            </h2>
            {stages.length ? (
              <>
                <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["deep", "rem", "light", "awake"] as const).filter((k) => stageTotals[k]).map((k) => (
                    <div key={k} className="rounded-xl bg-elevated p-3">
                      <dt className="text-xs text-muted-foreground">{STAGE_LABEL[k]}</dt>
                      <dd className="font-semibold">{formatDuration(stageTotals[k] ?? 0)}</dd>
                    </div>
                  ))}
                </dl>
                <ol className="mt-3 space-y-1 text-sm" aria-label="Stage timeline">
                  {stages.map((s, i) => (
                    <li key={`${s.session_id}-${i}`} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {formatClock(clockMinutesInTz(s.started_at, night.timezone))} – {formatClock(clockMinutesInTz(s.ended_at, night.timezone))}
                      </span>
                      <span>{STAGE_LABEL[s.stage]}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-muted-foreground">Stages come from the device that recorded them; gaps between intervals are unknown time, not awake time.</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No stage information. Stages only come from a health platform or wearable that records them; the app never guesses them from bed and wake times.</p>
            )}
          </section>

          <section className={card} aria-labelledby="night-checkin-title">
            <h2 id="night-checkin-title" className="font-display text-xl font-bold uppercase">
              Your check-in
            </h2>
            {checkinRows.length ? (
              <dl className="mt-2 divide-y divide-border">
                {checkinRows.map(([k, v]) => (
                  <Row key={k} label={k} value={v} />
                ))}
                {checkin?.notes && <Row label="Notes" value={checkin.notes} />}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No check-in for this day.</p>
            )}
            <Link href={`/progress/sleep/checkin?day=${date}`} className="mt-3 inline-block text-sm font-semibold text-gold-highlight underline">
              {checkinRows.length ? "Edit check-in" : "Add a check-in"}
            </Link>
          </section>

          {naps.length > 0 && (
            <section className="space-y-3" aria-labelledby="naps-title">
              <h2 id="naps-title" className="font-display text-xl font-bold uppercase">
                Naps that day
              </h2>
              <SleepSessionList sessions={naps} emptyText="" />
            </section>
          )}

          <section className="space-y-3" aria-labelledby="night-entries-title">
            <h2 id="night-entries-title" className="font-display text-xl font-bold uppercase">
              Entries
            </h2>
            <SleepSessionList sessions={night.sessions} emptyText="" />
          </section>
        </>
      ) : (
        <section className={card}>
          <p className="text-sm text-muted-foreground">
            Nothing logged for the night of {formatNightDate(date)}.{" "}
            <Link href="/progress/sleep/log" className="font-semibold text-gold-highlight underline">
              Enter it by hand
            </Link>{" "}
            if you remember it; otherwise it stays a gap, which is more honest than a guess.
          </p>
          {naps.length > 0 && (
            <div className="mt-4">
              <h2 className="mb-2 font-display text-lg font-bold uppercase">Naps that day</h2>
              <SleepSessionList sessions={naps} emptyText="" />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
