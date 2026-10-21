import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Trophy } from "lucide-react";
import { LineSeriesChart } from "@/components/charts/charts";
import { EmptyState } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { Button } from "@/components/ui/button";
import { buildExerciseHistory, type BestSet, type HistoryRow } from "@/lib/domain/exercise-history";
import { formatDistance } from "@/lib/domain/exercise-tracking";
import { hasFeature } from "@/lib/domain/plans";
import { summarizeSets } from "@/lib/domain/previous-performance";
import type { UnitSystem } from "@/lib/domain/types";
import { displayWeight, formatDuration, formatWeight, weightUnit } from "@/lib/domain/units";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "Exercise history" };

function bestText(b: BestSet, units: UnitSystem): string {
  switch (b.kind) {
    case "e1rm":
      return `${formatWeight(b.weightKg, units)} × ${b.reps} (estimated 1RM ${formatWeight(b.e1rmKg, units)})`;
    case "reps":
      return `${b.reps} reps`;
    case "duration":
      return formatDuration(b.seconds);
    case "distance":
      return `${formatDistance(b.metres, units)}${b.weightKg ? ` with ${formatWeight(b.weightKg, units)}` : ""}`;
  }
}

export default async function ExerciseHistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data: ex } = await supabase.from("exercises").select("id, slug, name, is_timed").eq("slug", slug).maybeSingle();
  if (!ex) notFound();
  const [plan, rowsRes] = await Promise.all([
    getUserPlan(user.id),
    supabase
      .from("workout_exercises")
      .select("skipped, session:workout_sessions!inner(id, name, started_at, status), sets:workout_sets(set_number, reps, weight_kg, duration_seconds, distance_m, is_warmup, completed)")
      .eq("user_id", user.id)
      .eq("exercise_id", ex.id)
      .eq("session.status", "completed")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const units = profile.unit_system;
  const history = buildExerciseHistory((rowsRes.data ?? []) as unknown as HistoryRow[]);
  const advanced = hasFeature(plan, "advanced_analytics");
  const tz = profile.timezone ?? "UTC";
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz });

  return (
    <div className="space-y-5">
      <BackLink href={`/train/exercises/${ex.slug}`}>{ex.name as string}</BackLink>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Your history</p>
        <h1 className="mt-1 font-display text-3xl font-bold uppercase leading-tight">{ex.name as string}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {history.sessions.length} {history.sessions.length === 1 ? "session" : "sessions"} logged · completed working sets only
        </p>
      </header>

      {history.sessions.length === 0 ? (
        <EmptyState
          title="No sets logged yet"
          description="Log this exercise in a workout and your best set, estimated 1RM trend and recent sessions will appear here."
          action={
            <Button asChild variant="secondary">
              <Link href="/train/workout?blank=1">Start a workout</Link>
            </Button>
          }
        />
      ) : (
        <>
          {history.best && (
            <section className="rounded-2xl border border-gold-muted/60 bg-gold/5 p-4" aria-labelledby="best-title">
              <h2 id="best-title" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gold-highlight">
                <Trophy className="size-4" aria-hidden /> Best set
              </h2>
              <p className="mt-1 text-lg font-semibold" data-testid="best-set">
                {bestText(history.best, units)}
              </p>
              <p className="text-xs text-muted-foreground">{fmtDate(history.best.date)}</p>
            </section>
          )}

          {history.trend.length > 0 &&
            (advanced ? (
              <LineSeriesChart
                title="Estimated 1RM trend"
                description="Best estimated 1RM per session (Epley formula)"
                data={history.trend.map((t) => ({ date: t.date.slice(0, 10), e1rm: displayWeight(t.e1rmKg, units) }))}
                xKey="date"
                xFormat="date"
                valueSuffix={` ${weightUnit(units)}`}
                series={[{ key: "e1rm", label: "Estimated 1RM" }]}
                emptyMessage="No sets that allow a 1RM estimate yet."
              />
            ) : (
              <section className="rounded-2xl border border-border bg-card p-4">
                <h2 className="font-semibold">Estimated 1RM trend</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  <Lock className="mr-1 inline size-3.5 text-gold" aria-hidden />
                  Trend charts are part of Plus. Your best estimated 1RM for each session is listed below.
                </p>
                <Button asChild size="sm" variant="secondary" className="mt-2">
                  <Link href="/profile/billing">See plans</Link>
                </Button>
              </section>
            ))}

          <section aria-labelledby="recent-title">
            <h2 id="recent-title" className="mb-2 text-lg font-semibold">
              Recent sessions
            </h2>
            <ul className="space-y-2">
              {history.sessions.slice(0, 20).map((s) => (
                <li key={s.sessionId}>
                  <Link href={`/train/history/${s.sessionId}`} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-3 hover:border-gold-muted">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{s.name}</span>
                      <span className="block text-xs text-muted-foreground">{fmtDate(s.date)}</span>
                    </span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      {summarizeSets(s.sets, units, Boolean(ex.is_timed)) ?? "—"}
                      {s.e1rmKg != null && <span className="block text-xs text-muted-foreground">e1RM {formatWeight(s.e1rmKg, units)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
