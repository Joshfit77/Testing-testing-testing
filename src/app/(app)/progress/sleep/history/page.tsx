import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { NightBars } from "@/components/sleep/night-bars";
import { TrendBars } from "@/components/sleep/trend-bars";
import { BackLink } from "@/components/platform/back-link";
import { formatNightDate } from "@/components/sleep/session-list";
import { addDays, isoDateInTz, parseRange, RANGES, rangeStart, type RangeKey } from "@/lib/domain/dates";
import { clockMinutesInTz, DEFAULT_SLEEP_GOAL_MINUTES, formatClock, formatDuration, summarizeNights } from "@/lib/domain/sleep";
import { nightlyScore } from "@/lib/domain/sleep-score";
import { describeShift, SLEEP_ANALYTICS_VERSION, trend, weekdayWeekend } from "@/lib/domain/sleep-analytics";
import { hasFeature } from "@/lib/domain/plans";
import { averageAsleepMinutes, goalPct, nightSlots, scheduleStats } from "@/lib/domain/sleep-stats";
import { getServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { listSleepCheckins, listSleepSessions } from "@/server/services/sleep";
import { associations, describeAssociation } from "@/lib/domain/sleep-checkins";

export const metadata = { title: "Sleep history" };

export default async function SleepHistoryPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  const compare = hasFeature(plan, "sleep_analytics");
  const { range: rawRange } = await searchParams;
  const range = parseRange(rawRange);
  const tz = profile.timezone ?? "UTC";
  const today = isoDateInTz(new Date(), tz);
  const goal = profile.sleep_goal_minutes ?? DEFAULT_SLEEP_GOAL_MINUTES;
  const start = rangeStart(range, today);
  const supabase = await getServerSupabase();
  // Fourteen extra nights so the first nights in the range still get a timing comparison.
  const [sessions, checkins] = await Promise.all([listSleepSessions(supabase, user.id, { fromNight: addDays(start, -14), toNight: today }), listSleepCheckins(supabase, user.id, start, today)]);
  const all = summarizeNights(sessions);
  const nights = all.filter((n) => n.nightOf >= start);
  const patterns = associations(nights, checkins);
  const scored = nights.map((n) => {
    const earlier = all.filter((e) => e.nightOf < n.nightOf && e.nightOf >= addDays(n.nightOf, -14));
    return { night: n, score: nightlyScore(n, goal, scheduleStats(earlier)) };
  });
  const avg = averageAsleepMinutes(nights);
  const atGoal = nights.filter((n) => n.asleepMinutes >= goal).length;
  const longest = nights.length ? Math.max(...nights.map((n) => n.asleepMinutes)) : null;
  const shortest = nights.length ? Math.min(...nights.map((n) => n.asleepMinutes)) : null;
  const avgScore = scored.length ? Math.round(scored.reduce((acc, s) => acc + s.score.score, 0) / scored.length) : null;
  const bucket = range === "1y" ? "month" : "week";
  const points = range === "7d" ? null : trend(nights, start, today, bucket, goal);
  const split = compare ? weekdayWeekend(nights, goal) : null;
  const card = "rounded-2xl border border-border bg-card p-5";
  const clock = (m: number | null) => (m === null ? "—" : formatClock(m));

  return (
    <div className="space-y-6">
      <BackLink href="/progress/sleep">Sleep & Recovery</BackLink>
      <PageHeader eyebrow="Sleep & Recovery" title="Sleep history" description="Every night you logged, with how it compared with your goal." />

      <nav aria-label="Range" className="flex flex-wrap gap-2">
        {(Object.keys(RANGES) as RangeKey[]).map((k) => (
          <Link key={k} href={`/progress/sleep/history?range=${k}`} aria-current={k === range ? "page" : undefined} className={cn("min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold", k === range ? "border-gold bg-gold/15 text-gold-highlight" : "border-border bg-card hover:border-gold-muted")}>
            {RANGES[k].label}
          </Link>
        ))}
      </nav>

      <section className={card} aria-labelledby="summary-title">
        <h2 id="summary-title" className="font-display text-xl font-bold uppercase">
          {RANGES[range].label}
        </h2>
        {nights.length ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Nights logged", String(nights.length)],
              ["Average asleep", formatDuration(avg)],
              ["Nights at goal", `${atGoal} of ${nights.length}`],
              ["Average score", avgScore === null ? "—" : `${avgScore}`],
              ["Longest", formatDuration(longest)],
              ["Shortest", formatDuration(shortest)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-elevated p-3">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-display text-xl font-bold text-gold-highlight">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No nights logged in this range. Nights you log appear here; days without an entry stay empty rather than counting as no sleep.</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Averages cover logged nights only. Nights without detail count time in bed as time asleep, and each score is based only on what that night had entered.</p>
      </section>

      <section className={card} aria-labelledby="chart-title">
        <h2 id="chart-title" className="font-display text-xl font-bold uppercase">
          {range === "7d" ? "Night by night" : bucket === "week" ? "Week by week" : "Month by month"}
        </h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">{range === "7d" ? "Time asleep each night against your goal." : `Average time asleep per ${bucket}, from the nights you logged in it.`}</p>
        {points ? <TrendBars points={points} goalMinutes={goal} unit={bucket} /> : <NightBars slots={nightSlots(nights, today, 7)} goalMinutes={goal} />}
      </section>

      <section className={card} aria-labelledby="compare-title">
        <h2 id="compare-title" className="font-display text-xl font-bold uppercase">
          Weekdays and weekends
        </h2>
        {!split ? (
          <div className="mt-2 flex gap-3 text-sm">
            <Lock className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
            <p className="text-muted-foreground">
              Included with Plus and Pro: your typical bedtime, wake time and time asleep on weekday nights next to weekend nights, and how far they shift.{" "}
              <Link href="/profile/billing" className="font-semibold text-gold-highlight underline">
                See plans
              </Link>
            </p>
          </div>
        ) : split.weekday.nights === 0 && split.weekend.nights === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing logged in this range yet.</p>
        ) : (
          <>
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">Weekday nights compared with weekend nights (nights ending on a Saturday or Sunday)</caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1 font-normal"></th>
                  <th scope="col" className="py-1 font-normal">Weekdays</th>
                  <th scope="col" className="py-1 font-normal">Weekends</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Nights", String(split.weekday.nights), String(split.weekend.nights)],
                  ["Average asleep", formatDuration(split.weekday.avgAsleep), formatDuration(split.weekend.avgAsleep)],
                  ["At goal", `${split.weekday.atGoal} of ${split.weekday.nights}`, `${split.weekend.atGoal} of ${split.weekend.nights}`],
                  ["Typical bedtime", clock(split.weekday.typicalBed), clock(split.weekend.typicalBed)],
                  ["Typical wake time", clock(split.weekday.typicalWake), clock(split.weekend.typicalWake)],
                ].map(([k, a, b]) => (
                  <tr key={k} className="border-t border-border">
                    <th scope="row" className="py-2 pr-2 text-left font-normal text-muted-foreground">
                      {k}
                    </th>
                    <td className="py-2 font-semibold">{a}</td>
                    <td className="py-2 font-semibold">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-sm">
              At the weekend you go to bed <strong>{describeShift(split.bedShift)}</strong>, wake <strong>{describeShift(split.wakeShift)}</strong> and sleep <strong>{describeShift(split.asleepDiff, "more", "less")}</strong>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Weekend nights end on a Saturday or Sunday. Typical times need three nights on each side. A wake time that shifts by more than an hour at the weekend is the pattern the schedule page calls weekend drift. Comparisons version {SLEEP_ANALYTICS_VERSION}.
            </p>
          </>
        )}
      </section>

      <section className={card} aria-labelledby="patterns-title">
        <h2 id="patterns-title" className="font-display text-xl font-bold uppercase">
          In your own entries
        </h2>
        {patterns.length ? (
          <ul className="mt-2 space-y-2 text-sm">
            {patterns.map((p) => (
              <li key={p.key} className="rounded-xl bg-elevated p-3">
                {describeAssociation(p)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {checkins.length ? `${checkins.length} check-in${checkins.length === 1 ? "" : "s"} in this range. ` : ""}
            Patterns appear once a habit (caffeine after 2 PM, alcohol, a late meal, screens, evening training, travel, a disturbance) has at least three nights with it and three without, and the difference is at least 15 minutes of sleep or half a point of restedness.
          </p>
        )}
      </section>

      {nights.length > 0 && (
        <ol className="divide-y divide-border rounded-2xl border border-border bg-card" aria-label="Nights">
          {scored.map(({ night: n, score }) => {
            const pct = goalPct(n.asleepMinutes, goal) ?? 0;
            return (
              <li key={n.nightOf}>
                <Link href={`/progress/sleep/night/${n.nightOf}`} className="flex items-center gap-3 px-4 py-3 hover:bg-elevated">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{formatNightDate(n.nightOf)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatClock(clockMinutesInTz(n.bedAt, n.timezone))} – {formatClock(clockMinutesInTz(n.wakeAt, n.timezone))} · <span className="text-foreground">{formatDuration(n.asleepMinutes)}</span>
                      {n.asleepEstimated ? " in bed" : " asleep"} · {pct}% of goal
                    </p>
                  </div>
                  <span className="text-right">
                    <span className="block font-display text-2xl font-bold text-gold-highlight">{score.score}</span>
                    <span className="block text-xs text-muted-foreground">score</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
