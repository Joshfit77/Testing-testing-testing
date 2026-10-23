import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { formatNightDate } from "@/components/sleep/session-list";
import { addDays, isoDateInTz, parseRange, RANGES, rangeStart, type RangeKey } from "@/lib/domain/dates";
import { clockMinutesInTz, DEFAULT_SLEEP_GOAL_MINUTES, formatClock, formatDuration, summarizeNights } from "@/lib/domain/sleep";
import { nightlyScore } from "@/lib/domain/sleep-score";
import { averageAsleepMinutes, goalPct, scheduleStats } from "@/lib/domain/sleep-stats";
import { getServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth";
import { listSleepCheckins, listSleepSessions } from "@/server/services/sleep";
import { associations, describeAssociation } from "@/lib/domain/sleep-checkins";

export const metadata = { title: "Sleep history" };

export default async function SleepHistoryPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { user, profile } = await requireOnboardedUser();
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
  const card = "rounded-2xl border border-border bg-card p-5";

  return (
    <div className="space-y-6">
      <BackLink href="/progress/sleep">Sleep & Recovery</BackLink>
      <PageHeader eyebrow="Sleep & Recovery" title="Sleep history" description="Every night you logged, with how it compared with your goal." />

      <nav aria-label="Range" className="flex gap-2">
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
        <p className="mt-3 text-xs text-muted-foreground">Averages cover logged nights only. Nights without detail count time in bed as time asleep.</p>
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
