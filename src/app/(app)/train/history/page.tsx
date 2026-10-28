import Link from "next/link";
import { ArrowLeft, ChevronRight, Dumbbell } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { addDays, daysBetween, isoDateInTz } from "@/lib/domain/dates";
import { formatDuration, formatWeight } from "@/lib/domain/units";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { listHistory } from "@/server/services/workouts";

export const metadata = { title: "Workout history" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const { before } = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const beforeIso = before && !Number.isNaN(Date.parse(before)) ? new Date(before).toISOString() : undefined;
  const items = await listHistory(supabase, user.id, 30, beforeIso);
  const units = profile.unit_system;

  const today = isoDateInTz(new Date(), profile.timezone);
  const since = addDays(today, -29);
  const { data: last30 } = await supabase
    .from("workout_sessions")
    .select("total_volume_kg, started_at")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .gte("started_at", `${since}T00:00:00Z`);
  const volume30 = (last30 ?? []).reduce((s, r) => s + Number(r.total_volume_kg), 0);
  // Per week over the days since the first of these workouts (at least a week), so a member in their first days is
  // not told they train 0.2 times a week.
  const first = (last30 ?? []).map((r) => isoDateInTz(new Date(r.started_at as string), profile.timezone)).sort()[0];
  const spanDays = first ? Math.max(7, daysBetween(first, today) + 1) : 30;
  const perWeek = ((last30 ?? []).length / spanDays) * 7;

  const groups = new Map<string, typeof items>();
  for (const it of items) {
    const key = new Date(it.started_at).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: profile.timezone });
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }

  return (
    <div className="space-y-6">
      <Link href="/train" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Train
      </Link>
      <PageHeader title="Workout history" description="Review, edit or delete past sessions." />

      <section className="grid grid-cols-2 gap-3" aria-label="Last 30 days">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Workouts · 30 days</p>
          <p className="mt-1 font-display text-3xl font-bold">{(last30 ?? []).length}</p>
          <p className="text-xs text-muted-foreground">≈ {perWeek.toFixed(1)} per week</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Volume · 30 days</p>
          <p className="mt-1 font-display text-3xl font-bold">{formatWeight(volume30, units)}</p>
          <p className="text-xs text-muted-foreground">weight × reps, completed sets</p>
        </div>
      </section>

      {items.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title={before ? "No older workouts" : "No workouts yet"}
          description="Finish a workout and it will appear here."
          action={
            <Button asChild>
              <Link href="/train/workout">Start a workout</Link>
            </Button>
          }
        />
      ) : (
        <>
          {[...groups].map(([month, list]) => (
            <section key={month} aria-labelledby={`m-${month}`}>
              <h2 id={`m-${month}`} className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold">
                {month}
              </h2>
              <ul className="space-y-2">
                {list.map((w) => {
                  const dur = w.ended_at ? (Date.parse(w.ended_at) - Date.parse(w.started_at)) / 1000 - w.paused_seconds : 0;
                  return (
                    <li key={w.id}>
                      <Link href={`/train/history/${w.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 hover:border-gold-muted">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{w.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(w.started_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: profile.timezone })} ·{" "}
                            {formatDuration(dur)} · {w.exercise_count} exercises · {formatWeight(w.total_volume_kg, units)}
                          </p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {items.length === 30 && (
            <Button asChild variant="secondary" className="w-full">
              <Link href={`/train/history?before=${encodeURIComponent(items[items.length - 1]!.started_at)}`}>Load older workouts</Link>
            </Button>
          )}
        </>
      )}
    </div>
  );
}
