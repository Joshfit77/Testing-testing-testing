import Link from "next/link";
import { CalendarRange, ChevronRight, Footprints, LocateFixed, Medal, Route } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { ActivityForm } from "@/components/run/activity-form";
import { BarSeriesChart, LineSeriesChart } from "@/components/charts/charts";
import { RunningGoals, type GoalView } from "@/components/run/running-goals";
import { distanceGoalProgress, isRunDay, raceGoalProgress, weeklyDistanceSeries, type RunGoalKind } from "@/lib/domain/run-session";
import { getActiveProgramRef } from "@/server/coach/snapshot";
import { ActivityListItem, WeekTotalsLine } from "@/components/run/activity-summary-ui";
import { parseRunTab, RunTabs } from "@/components/run/run-tabs";
import { MainHeader } from "@/components/shell/main-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  distanceUnitFor,
  formatDistance,
  formatPace,
  fromMeters,
  isEligibleForDistance,
  localToUtcIso,
  paceSecondsPer,
  personalBests,
  totalsForWeek,
  utcToLocalParts,
  weeklyTotals,
  type DistanceUnit,
} from "@/lib/domain/activities";
import { addDays, isoDateInTz, startOfWeek } from "@/lib/domain/dates";
import { formatDuration } from "@/lib/domain/units";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { listActivities, listRunsForRecords } from "@/server/services/activities";
import { programDays } from "@/server/services/training";

export const metadata = { title: "Run" };

/** Running programs in the library (linked, never duplicated). Start one, then record its runs with GPS from here. */
const RUN_PROGRAMS = [
  { slug: "walk-to-run-beginner", blurb: "Brisk walking with short jogs, to a 20-minute jog in 6 weeks." },
  { slug: "aerobic-base-run-walk", blurb: "Run/walk intervals for beginners, couch to 5K in 8 weeks." },
  { slug: "5k-training", blurb: "8 weeks to your best 5K: easy runs, one quality session, a taper." },
  { slug: "10k-training", blurb: "10 weeks, four runs a week, threshold work and a taper." },
  { slug: "half-marathon-base-80-20", blurb: "12 weeks of mostly easy running with one quality session." },
];

/** History pages cover this many weeks, so every week's totals are complete. */
const HISTORY_WEEKS = 12;

export default async function RunPage({ searchParams }: { searchParams: Promise<{ tab?: string; before?: string }> }) {
  const { tab: tabParam, before } = await searchParams;
  const tab = parseRunTab(tabParam);
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const tz = profile.timezone || "UTC";
  const unit = distanceUnitFor(profile.unit_system);
  const today = isoDateInTz(new Date(), tz);
  const thisWeek = startOfWeek(today);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <MainHeader title="Run" subtitle="Runs and walks, outdoors or on the treadmill." />
      <RunTabs active={tab} />
      {tab === "outdoor" && <OutdoorTab userId={user.id} supabase={supabase} />}
      {tab === "log" && <LogTab today={today} unit={unit} tz={tz} />}
      {tab === "history" && <HistoryTab userId={user.id} tz={tz} unit={unit} thisWeek={thisWeek} before={before} supabase={supabase} />}
      {tab !== "history" && <Overview userId={user.id} tz={tz} unit={unit} thisWeek={thisWeek} today={today} supabase={supabase} />}
    </div>
  );
}

/** Today's day of the member's active program, when it's a running day they can record as a guided run. */
async function todaysGuidedRun(supabase: Supa, userId: string): Promise<{ href: string; dayName: string; programName: string } | null> {
  const ref = await getActiveProgramRef(supabase, userId);
  if (!ref) return null;
  const today = (await programDays(supabase, ref.programId, { week: ref.currentWeek })).find((d) => d.dayNumber === ref.currentDay);
  if (!today) return null;
  const { data: day } = await supabase.from("program_days").select("id, name, program_exercises(sets, duration_seconds, exercise:exercises(slug))").eq("id", today.id).maybeSingle();
  if (!day) return null;
  const ex = ((day.program_exercises ?? []) as unknown as { duration_seconds: number | null; exercise: { slug: string } | null }[]).map((e) => ({ slug: e.exercise?.slug ?? "", seconds: e.duration_seconds }));
  if (!isRunDay(ex)) return null;
  return { href: `/run/record?day=${day.id as string}&up=${ref.userProgramId}`, dayName: day.name as string, programName: ref.name };
}

async function OutdoorTab({ userId, supabase }: { userId: string; supabase: Supa }) {
  const guided = await todaysGuidedRun(supabase, userId).catch(() => null);
  return (
    <div className="space-y-3">
      {guided && (
        <Link href={guided.href} className="flex items-center gap-3 rounded-2xl border border-gold-muted/60 bg-card-gradient p-4 hover:border-gold" data-testid="guided-run-card">
          <LocateFixed className="size-6 shrink-0 text-gold" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Today: {guided.dayName}</span>
            <span className="block text-sm text-muted-foreground">{guided.programName} · guided with GPS, run/walk cues and splits</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
        </Link>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button asChild size="lg" className="h-auto flex-col items-start gap-0.5 py-4 text-left">
          <Link href="/run/record?kind=run">
            <span className="flex items-center gap-2 font-display text-lg uppercase">
              <LocateFixed aria-hidden /> Outdoor run
            </span>
            <span className="text-xs font-normal opacity-80">GPS distance, pace, splits</span>
          </Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="h-auto flex-col items-start gap-0.5 py-4 text-left">
          <Link href="/run/record?kind=walk">
            <span className="flex items-center gap-2 font-display text-lg uppercase">
              <Footprints aria-hidden /> Outdoor walk
            </span>
            <span className="text-xs font-normal opacity-80">GPS distance and route</span>
          </Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Location is used only while you record. Routes are private. In a browser, keep the screen open while recording; the phone app is being prepared to keep recording with the screen locked.{" "}
        <Link href="/run?tab=log" className="underline">
          Log a run or walk manually
        </Link>
        .
      </p>
    </div>
  );
}

function LogTab({ today, unit, tz }: { today: string; unit: DistanceUnit; tz: string }) {
  const now = utcToLocalParts(new Date().toISOString(), tz);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Log a run or walk</CardTitle>
        <p className="text-sm text-muted-foreground">For treadmill sessions or runs you timed yourself. Manual entries never show a map or route.</p>
      </CardHeader>
      <CardContent>
        <ActivityForm
          mode="create"
          today={today}
          initial={{
            // A fresh stable id per form render: a repeated submit saves the activity once.
            id: crypto.randomUUID(),
            kind: "run",
            source: "manual",
            date: now.date,
            time: now.time,
            distance: "",
            unit,
            duration: "",
            moving: "",
            effort: "",
            notes: "",
          }}
        />
      </CardContent>
    </Card>
  );
}

type Supa = Awaited<ReturnType<typeof getServerSupabase>>;

async function Overview({ userId, tz, unit, thisWeek, today, supabase }: { userId: string; tz: string; unit: DistanceUnit; thisWeek: string; today: string; supabase: Supa }) {
  const since = localToUtcIso(addDays(thisWeek, -1), "00:00", tz) ?? `${addDays(thisWeek, -1)}T00:00:00Z`;
  const chartStart = addDays(thisWeek, -7 * 11);
  const chartSince = localToUtcIso(chartStart, "00:00", tz) ?? `${chartStart}T00:00:00Z`;
  const [recent, runs, { data: programs }, twelveWeeks, { data: goalRows }] = await Promise.all([
    listActivities(supabase, userId, { since }),
    listRunsForRecords(supabase, userId),
    supabase.from("training_programs").select("slug, name, tier").eq("is_published", true).in("slug", RUN_PROGRAMS.map((p) => p.slug)),
    listActivities(supabase, userId, { since: chartSince, limit: 1000 }),
    supabase.from("running_goals").select("id, kind, distance_m, target_s, created_at").eq("user_id", userId).is("archived_at", null).order("created_at"),
  ]);
  const week = totalsForWeek(recent, tz, thisWeek);
  const bests = personalBests(runs);
  // Weekly distance and average run pace over the last 12 weeks (empty weeks included).
  const weekStarts = Array.from({ length: 12 }, (_, i) => addDays(chartStart, i * 7));
  const totals = weeklyTotals(twelveWeeks, tz);
  const distanceSeries = weeklyDistanceSeries(
    totals.map((w) => ({ weekStart: w.weekStart, distanceM: w.run.distanceM + w.walk.distanceM })),
    weekStarts,
  ).map((w) => ({ date: w.weekStart, distance: Math.round(fromMeters(w.distanceM, unit) * 10) / 10 }));
  const paceSeries = weekStarts.map((w) => {
    const t = totals.find((x) => x.weekStart === w)?.run;
    const pace = t && t.distanceM > 0 ? paceSecondsPer(t.distanceM, t.movingS, unit) : null;
    return { date: w, pace: pace ? Math.round((pace / 60) * 100) / 100 : null };
  });
  // Goals: this week's / month's distance, or the best qualifying time for a target-time goal.
  const monthStart = `${today.slice(0, 8)}01`;
  const monthSince = localToUtcIso(monthStart, "00:00", tz) ?? `${monthStart}T00:00:00Z`;
  const monthDistance = twelveWeeks.filter((a) => a.started_at >= monthSince).reduce((m, a) => m + (a.distance_m ?? 0), 0);
  const weekDistance = week.run.distanceM + week.walk.distanceM;
  const goals: GoalView[] = ((goalRows ?? []) as { id: string; kind: RunGoalKind; distance_m: number | string; target_s: number | null }[]).map((g) => {
    const meters = Number(g.distance_m);
    if (g.kind === "race_time") {
      const eligible = runs.filter((r) => isEligibleForDistance(r, meters));
      const best = eligible.length ? Math.min(...eligible.map((r) => r.moving_s)) : null;
      const prog = raceGoalProgress({ target_s: g.target_s, distance_m: meters }, best, unit);
      const label = meters === 5000 ? "5K" : meters === 10000 ? "10K" : meters > 21000 && meters < 21200 ? "Half marathon" : formatDistance(meters, unit);
      return {
        id: g.id,
        title: `${label} in ${formatDuration(g.target_s ?? 0)}`,
        detail: best == null ? `No ${label} run yet. Target pace ${formatPace(prog.targetPace, unit)}.` : prog.met ? `Done: your best is ${formatDuration(best)}.` : `Best ${formatDuration(best)} · ${formatDuration(prog.gapS ?? 0)} to go · target pace ${formatPace(prog.targetPace, unit)}`,
        pct: null,
        met: prog.met,
      };
    }
    const covered = g.kind === "weekly_distance" ? weekDistance : monthDistance;
    const prog = distanceGoalProgress({ distance_m: meters }, covered);
    return {
      id: g.id,
      title: `${formatDistance(meters, unit)} ${g.kind === "weekly_distance" ? "a week" : "a month"}`,
      detail: `${formatDistance(covered, unit)} so far this ${g.kind === "weekly_distance" ? "week" : "month"}${prog.met ? " — goal met" : ` · ${formatDistance(prog.remainingM, unit)} to go`}`,
      pct: prog.pct,
      met: prog.met,
    };
  });
  const programBySlug = new Map((programs ?? []).map((p) => [p.slug as string, p as { slug: string; name: string; tier: string }]));

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="size-4 text-gold" aria-hidden /> This week
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/run?tab=history">History</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <WeekTotalsLine totals={week} unit={unit} testId="run-this-week" />
        </CardContent>
      </Card>

      <section aria-labelledby="run-plans" className="space-y-2">
        <h2 id="run-plans" className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          Plans
        </h2>
        <ul className="space-y-2">
          {RUN_PROGRAMS.filter((p) => programBySlug.has(p.slug)).map((p) => {
            const prog = programBySlug.get(p.slug)!;
            return (
              <li key={p.slug}>
                <Link href={`/train/programs/${p.slug}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 hover:border-gold-muted">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {prog.name} {prog.tier !== "free" && <Badge variant="secondary">{prog.tier === "pro" ? "Pro" : "Plus"}</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.blurb}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
                </Link>
              </li>
            );
          })}
          <li>
            <Link href="/train/build?type=cardio" className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 hover:border-gold-muted">
              <div className="min-w-0">
                <p className="font-semibold">Build a cardio plan around your goal</p>
                <p className="text-xs text-muted-foreground">Pick a goal such as your first 5K and your schedule. There&apos;s no dedicated 10K plan in the library yet.</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
            </Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="run-progress" className="space-y-2">
        <h2 id="run-progress" className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          Progress
        </h2>
        <BarSeriesChart
          title="Weekly distance"
          description={`Runs and walks, last 12 weeks (${unit})`}
          data={distanceSeries}
          xKey="date"
          xFormat="date"
          decimals={1}
          valueSuffix={` ${unit}`}
          series={[{ key: "distance", label: "Distance" }]}
          emptyMessage="Record or log a run or walk to start the chart."
        />
        <LineSeriesChart
          title="Average run pace"
          description={`Minutes per ${unit}, by week (lower is faster)`}
          data={paceSeries}
          xKey="date"
          xFormat="date"
          decimals={2}
          valueSuffix={` min/${unit}`}
          series={[{ key: "pace", label: "Pace" }]}
          connectNulls={false}
          emptyMessage="Pace shows once you have runs with a distance."
        />
      </section>

      <section aria-labelledby="run-goal-list" className="space-y-2">
        <h2 id="run-goal-list" className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          Goals
        </h2>
        <Card>
          <CardContent className="pt-5">
            <RunningGoals goals={goals} unit={unit} />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="run-goals" className="space-y-2">
        <h2 id="run-goals" className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          Records
        </h2>
        <Card>
          <CardContent className="space-y-3 pt-5">
            <ul className="grid grid-cols-3 gap-2" data-testid="run-records">
              {bests.map((b) => (
                <li key={b.distance} className="rounded-xl bg-elevated px-3 py-2 text-center">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{b.label}</p>
                  {b.best ? (
                    <Link href={`/run/activities/${b.best.activityId}`} className="block font-display text-lg font-bold hover:text-gold-highlight">
                      {formatDuration(b.best.movingS)}
                    </Link>
                  ) : (
                    <p className="font-display text-lg font-bold text-muted-foreground">—</p>
                  )}
                  {b.best && <p className="text-[0.6875rem] text-muted-foreground">{b.best.selfReported ? "Self-reported" : "GPS"}</p>}
                </li>
              ))}
            </ul>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Medal className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
              Best moving time from a run of that distance (up to 3% longer). Manual and treadmill times are self-reported, not measured by the app.
            </p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

async function HistoryTab({
  userId,
  tz,
  unit,
  thisWeek,
  before,
  supabase,
}: {
  userId: string;
  tz: string;
  unit: DistanceUnit;
  thisWeek: string;
  before?: string;
  supabase: Supa;
}) {
  // Page by whole weeks: `before` is a Monday (ISO date) in the user's time zone.
  const endWeek = before && /^\d{4}-\d{2}-\d{2}$/.test(before) ? startOfWeek(before) : addDays(thisWeek, 7);
  const startWeek = addDays(endWeek, -7 * HISTORY_WEEKS);
  const since = localToUtcIso(startWeek, "00:00", tz) ?? `${startWeek}T00:00:00Z`;
  const until = localToUtcIso(endWeek, "00:00", tz) ?? `${endWeek}T00:00:00Z`;
  const [items, older] = await Promise.all([
    listActivities(supabase, userId, { since, before: until, limit: 1000 }),
    listActivities(supabase, userId, { before: since, limit: 1 }),
  ]);
  const weeks = weeklyTotals(items, tz);
  const byWeek = new Map<string, typeof items>();
  for (const a of items) {
    const w = startOfWeek(isoDateInTz(new Date(a.started_at), tz));
    byWeek.set(w, [...(byWeek.get(w) ?? []), a]);
  }
  const weekLabel = (w: string) =>
    w === thisWeek
      ? "This week"
      : `Week of ${new Date(`${w}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: w.slice(0, 4) === thisWeek.slice(0, 4) ? undefined : "numeric", timeZone: "UTC" })}`;

  if (items.length === 0 && !before) {
    return (
      <EmptyState
        icon={Footprints}
        title="No runs or walks yet"
        description="Log one by hand and it will appear here with your weekly mileage."
        action={
          <Button asChild>
            <Link href="/run?tab=log">Log a run or walk</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {weeks.length === 0 && <p className="text-sm text-muted-foreground">No activities in these weeks.</p>}
      {weeks.map((w) => (
        <section key={w.weekStart} aria-labelledby={`wk-${w.weekStart}`} className="space-y-2" data-testid={`week-${w.weekStart}`}>
          <h2 id={`wk-${w.weekStart}`} className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
            {weekLabel(w.weekStart)}
          </h2>
          <WeekTotalsLine totals={w} unit={unit} testId={w.weekStart === thisWeek ? "history-this-week" : undefined} />
          <ul className="space-y-2">
            {(byWeek.get(w.weekStart) ?? []).map((a) => (
              <li key={a.id}>
                <ActivityListItem a={a} unit={unit} timeZone={tz} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {before && (
        <Button asChild variant="ghost" className="w-full">
          <Link href="/run?tab=history">Back to recent weeks</Link>
        </Button>
      )}
      {older.length > 0 && (
        <Button asChild variant="secondary" className="w-full">
          <Link href={`/run?tab=history&before=${startWeek}`}>
            <Route aria-hidden /> Show older weeks
          </Link>
        </Button>
      )}
    </div>
  );
}
