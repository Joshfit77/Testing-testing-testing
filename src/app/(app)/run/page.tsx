import Link from "next/link";
import { CalendarRange, ChevronRight, Footprints, LocateFixed, Medal, PencilLine, Route } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { ActivityForm } from "@/components/run/activity-form";
import { ActivityListItem, WeekTotalsLine } from "@/components/run/activity-summary-ui";
import { parseRunTab, RunTabs } from "@/components/run/run-tabs";
import { MainHeader } from "@/components/shell/main-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  distanceUnitFor,
  localToUtcIso,
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

export const metadata = { title: "Run" };

/** Running programs already in the library (linked, never duplicated). */
const RUN_PROGRAMS = [
  { slug: "aerobic-base-run-walk", blurb: "Run/walk intervals for beginners, couch to 5K in 8 weeks." },
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
      {tab === "outdoor" && <OutdoorTab />}
      {tab === "log" && <LogTab today={today} unit={unit} tz={tz} />}
      {tab === "history" && <HistoryTab userId={user.id} tz={tz} unit={unit} thisWeek={thisWeek} before={before} supabase={supabase} />}
      {tab !== "history" && <Overview userId={user.id} tz={tz} unit={unit} thisWeek={thisWeek} supabase={supabase} />}
    </div>
  );
}

function OutdoorTab() {
  return (
    <Card data-testid="outdoor-gps-notice">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LocateFixed className="size-4 text-gold" aria-hidden /> GPS tracking is coming next
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Live outdoor runs and walks (distance, pace, splits and your route on a map) are being added in the next stage. When it arrives, the app will
          ask for permission to use your location when you start a session, and stop using it when you finish.
        </p>
        <p>Until then, you can log a run or walk by hand with your distance and time. It counts toward your weekly mileage and records.</p>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/run?tab=log">
            <PencilLine aria-hidden /> Log a run or walk manually
          </Link>
        </Button>
      </CardContent>
    </Card>
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

async function Overview({ userId, tz, unit, thisWeek, supabase }: { userId: string; tz: string; unit: DistanceUnit; thisWeek: string; supabase: Supa }) {
  const since = localToUtcIso(addDays(thisWeek, -1), "00:00", tz) ?? `${addDays(thisWeek, -1)}T00:00:00Z`;
  const [recent, runs, { data: programs }] = await Promise.all([
    listActivities(supabase, userId, { since }),
    listRunsForRecords(supabase, userId),
    supabase.from("training_programs").select("slug, name, tier").eq("is_published", true).in("slug", RUN_PROGRAMS.map((p) => p.slug)),
  ]);
  const week = totalsForWeek(recent, tz, thisWeek);
  const bests = personalBests(runs);
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

      <section aria-labelledby="run-goals" className="space-y-2">
        <h2 id="run-goals" className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          Goals &amp; records
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
                  {b.best && <p className="text-[11px] text-muted-foreground">{b.best.selfReported ? "Self-reported" : "GPS"}</p>}
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
