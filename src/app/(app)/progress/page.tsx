import Link from "next/link";
import { CheckCircle2, Lock, Target, Trash2, Trophy } from "lucide-react";
import { BarSeriesChart, CATEGORICAL, LineSeriesChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { GoalForm, MeasurementForm, WeightForm } from "@/components/progress/progress-forms";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { isoDateInTz, parseRange, RANGES, rangeStart, type RangeKey } from "@/lib/domain/dates";
import { hasFeature } from "@/lib/domain/plans";
import { displayLength, displayWeight, formatDuration, formatWeight, kgToLb, lengthUnit, weightUnit } from "@/lib/domain/units";
import { cn, titleCase } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { deleteWeightAction, setGoalStatusAction } from "@/server/actions/progress";
import { BIG_THREE, getNutritionDaily, getPersonalBests, getStrengthSeries, getTrainingBuckets } from "@/server/services/progress";

export const metadata = { title: "Progress" };

function Locked({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gold-muted/50 bg-card/60 p-6 text-center">
      <Lock className="size-5 text-gold" aria-hidden />
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">Advanced analytics are included with Plus and Pro.</p>
      <Button asChild size="sm" variant="outline">
        <Link href="/profile/billing">See plans</Link>
      </Button>
    </div>
  );
}

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ range?: string; ex?: string }> }) {
  const sp = await searchParams;
  const range: RangeKey = parseRange(sp.range);
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const plan = await getUserPlan(user.id);
  const advanced = hasFeature(plan, "advanced_analytics");
  const nutrition = hasFeature(plan, "nutrition_tracking");
  const units = profile.unit_system;
  const tz = profile.timezone;
  const today = isoDateInTz(new Date(), tz);
  const start = rangeStart(range, today);
  const byMonth = range === "1y";

  const [weightsRes, training, bests, goalsRes, exercisesRes, measurementsRes] = await Promise.all([
    supabase.from("weight_entries").select("id, recorded_on, weight_kg").eq("user_id", user.id).gte("recorded_on", start).order("recorded_on"),
    getTrainingBuckets(supabase, user.id, start, today, tz, byMonth),
    getPersonalBests(supabase, user.id),
    supabase.from("fitness_goals").select("*").eq("user_id", user.id).neq("status", "archived").order("created_at", { ascending: false }),
    supabase.from("exercises").select("id, slug, name").eq("is_published", true).eq("is_timed", false).order("name"),
    advanced
      ? supabase.from("measurement_entries").select("recorded_on, waist_cm, chest_cm, hips_cm, arm_cm, thigh_cm, body_fat_pct").eq("user_id", user.id).gte("recorded_on", start).order("recorded_on")
      : Promise.resolve({ data: [] }),
  ]);
  const exercises = exercisesRes.data ?? [];
  const exBySlug = new Map(exercises.map((e) => [e.slug as string, e]));
  const bigThreeIds = BIG_THREE.map((b) => exBySlug.get(b.slug)?.id as string | undefined).filter(Boolean) as string[];
  const selected = sp.ex ? exBySlug.get(sp.ex) : undefined;

  // Advanced data is only queried for entitled users (server-side gate).
  const [strength, nutritionDaily] = await Promise.all([
    advanced ? getStrengthSeries(supabase, user.id, [...bigThreeIds, ...(selected ? [selected.id as string] : [])], start, tz) : Promise.resolve(new Map()),
    advanced && nutrition ? getNutritionDaily(supabase, user.id, start, today) : Promise.resolve([]),
  ]);

  const weights = (weightsRes.data ?? []).map((w) => ({ id: w.id as string, date: w.recorded_on as string, weight: displayWeight(Number(w.weight_kg), units) }));
  const latestWeightKg = weightsRes.data?.length ? Number(weightsRes.data[weightsRes.data.length - 1]!.weight_kg) : null;

  const bigThreeDates = [...new Set([...strength.values()].flatMap((m: Map<string, number>) => [...m.keys()]))].sort();
  const bigThreeData = bigThreeDates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    BIG_THREE.forEach((b) => {
      const id = exBySlug.get(b.slug)?.id as string | undefined;
      const v = id ? strength.get(id)?.get(date) : undefined;
      row[b.slug] = v == null ? null : displayWeight(v, units);
    });
    return row;
  });
  const selectedSeries = selected ? [...(strength.get(selected.id as string)?.entries() ?? [])].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, e1rm: displayWeight(v as number, units) })) : [];

  const measurements = (measurementsRes.data ?? []).map((m) => ({
    date: m.recorded_on as string,
    waist: m.waist_cm == null ? null : displayLength(Number(m.waist_cm), units),
    chest: m.chest_cm == null ? null : displayLength(Number(m.chest_cm), units),
    hips: m.hips_cm == null ? null : displayLength(Number(m.hips_cm), units),
  }));

  const goals = goalsRes.data ?? [];
  const weeksInRange = Math.max(1, RANGES[range].days / 7);
  const recentWorkoutsPerWeek = training.total / weeksInRange;
  const goalProgress = (g: Record<string, unknown>): { current: number | null; pct: number } => {
    const target = g.target_value == null ? null : Number(g.target_value);
    let current: number | null = null;
    if (g.goal_type === "bodyweight" && latestWeightKg != null) current = g.unit === "lb" ? kgToLb(latestWeightKg) : latestWeightKg;
    if (g.goal_type === "strength") {
      const b = bests.find((x) => x.exerciseId === g.exercise_id);
      if (b?.e1rm) current = g.unit === "lb" ? kgToLb(b.e1rm) : b.e1rm;
    }
    if (g.goal_type === "frequency") current = recentWorkoutsPerWeek;
    if (current == null || target == null) return { current, pct: g.status === "completed" ? 100 : 0 };
    const startV = g.start_value == null ? null : Number(g.start_value);
    let pct: number;
    if (startV != null && startV !== target) pct = ((current - startV) / (target - startV)) * 100;
    else pct = target > 0 ? (g.goal_type === "bodyweight" && latestWeightKg != null && current > target ? (target / current) * 100 : (current / target) * 100) : 0;
    return { current: Math.round(current * 10) / 10, pct: Math.max(0, Math.min(100, Math.round(pct))) };
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Progress" title="Progress & analytics" description="Every rep you log adds up. Here's the trend." />

      <nav aria-label="Time range" className="flex gap-2">
        {(Object.keys(RANGES) as RangeKey[]).map((r) => (
          <Link
            key={r}
            href={`/progress?range=${r}${sp.ex ? `&ex=${sp.ex}` : ""}`}
            aria-current={r === range ? "page" : undefined}
            className={cn(
              "flex h-10 items-center rounded-xl border px-4 text-sm font-semibold",
              r === range ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {RANGES[r].label}
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Summary">
        {[
          { label: "Workouts", value: String(training.total) },
          { label: "Per week", value: recentWorkoutsPerWeek.toFixed(1) },
          { label: "Training days", value: String(training.sessionDays) },
          { label: "Volume", value: formatWeight(training.buckets.reduce((s, b) => s + b.volumeKg, 0), units) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-bold md:text-3xl">{s.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <LineSeriesChart
          title="Bodyweight"
          description={RANGES[range].label}
          data={weights.map(({ date, weight }) => ({ date, weight }))}
          xKey="date"
          xFormat="date"
          valueSuffix={` ${weightUnit(units)}`}
          series={[{ key: "weight", label: "Bodyweight" }]}
          emptyMessage="No bodyweight entries in this period."
        />
        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="log-weight">
          <h2 id="log-weight" className="mb-3 font-display text-lg font-semibold uppercase">
            Log bodyweight
          </h2>
          <WeightForm units={units} today={today} />
          {weights.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-muted-foreground">Recent entries</summary>
              <ul className="mt-2 space-y-1">
                {[...weights].reverse().slice(0, 8).map((w) => (
                  <li key={w.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{w.date}</span>
                    <span className="flex items-center gap-2">
                      {w.weight} {weightUnit(units)}
                      <form action={deleteWeightAction}>
                        <input type="hidden" name="id" value={w.id} />
                        <button type="submit" className="rounded p-1 text-muted-foreground hover:text-destructive" aria-label={`Delete weight entry for ${w.date}`}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarSeriesChart
          title={byMonth ? "Monthly activity" : "Weekly activity"}
          description="Completed workouts"
          data={training.buckets.map((b) => ({ date: b.week, workouts: b.workouts }))}
          xKey="date"
          xFormat="date"
          decimals={0}
          series={[{ key: "workouts", label: "Workouts" }]}
        />
        {advanced ? (
          <BarSeriesChart
            title="Training volume"
            description={`Weight × reps of completed working sets, per ${byMonth ? "month" : "week"}`}
            data={training.buckets.map((b) => ({ date: b.week, volume: displayWeight(b.volumeKg, units, 0) }))}
            xKey="date"
            xFormat="date"
            decimals={0}
            valueSuffix={` ${weightUnit(units)}`}
            series={[{ key: "volume", label: "Volume" }]}
          />
        ) : (
          <Locked title="Training volume" />
        )}
      </div>

      {advanced ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <LineSeriesChart
            title="Squat · Bench · Deadlift"
            description="Best estimated 1RM per session (Epley)"
            data={bigThreeData}
            xKey="date"
            xFormat="date"
            valueSuffix={` ${weightUnit(units)}`}
            series={BIG_THREE.map((b, i) => ({ key: b.slug, label: b.label, color: CATEGORICAL[i] }))}
            emptyMessage="Log back squats, bench press or deadlifts to see your big-three trend."
          />
          <div className="space-y-3">
            <form className="flex gap-2" action="/progress">
              <input type="hidden" name="range" value={range} />
              <label htmlFor="ex-select" className="sr-only">
                Exercise
              </label>
              <select id="ex-select" name="ex" defaultValue={sp.ex ?? ""} className="h-11 flex-1 rounded-xl border border-border bg-elevated px-3 text-sm">
                <option value="">Choose an exercise…</option>
                {exercises.map((e) => (
                  <option key={e.slug as string} value={e.slug as string}>
                    {e.name as string}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary">
                Show
              </Button>
            </form>
            <LineSeriesChart
              title={selected ? `${selected.name as string}` : "Strength improvements"}
              description="Best estimated 1RM per session"
              data={selectedSeries}
              xKey="date"
              xFormat="date"
              valueSuffix={` ${weightUnit(units)}`}
              series={[{ key: "e1rm", label: "Est. 1RM" }]}
              emptyMessage={selected ? "No logged sets for this exercise in this period." : "Pick an exercise to chart its progress."}
            />
          </div>
        </div>
      ) : (
        <Locked title="Strength trends for squat, bench, deadlift and any exercise" />
      )}

      {advanced && nutrition && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BarSeriesChart
            title="Calories"
            description="Logged per day"
            data={nutritionDaily.map((d) => ({ date: d.date, calories: d.calories }))}
            xKey="date"
            xFormat="date"
            decimals={0}
            valueSuffix=" kcal"
            series={[{ key: "calories", label: "Calories" }]}
            emptyMessage="No food logged in this period."
          />
          <LineSeriesChart
            title="Macros"
            description="Grams per day"
            data={nutritionDaily.map((d) => ({ date: d.date, protein: d.protein || null, carbs: d.carbs || null, fat: d.fat || null }))}
            xKey="date"
            xFormat="date"
            decimals={0}
            valueSuffix=" g"
            connectNulls={false}
            series={[
              { key: "protein", label: "Protein", color: CATEGORICAL[0] },
              { key: "carbs", label: "Carbs", color: CATEGORICAL[1] },
              { key: "fat", label: "Fat", color: CATEGORICAL[2] },
            ]}
            emptyMessage="No food logged in this period."
          />
        </div>
      )}

      <section id="goals" className="scroll-mt-24" aria-labelledby="goals-title">
        <h2 id="goals-title" className="mb-3 flex items-center gap-2 font-display text-2xl font-bold uppercase">
          <Target className="size-5 text-gold" aria-hidden /> Goals
        </h2>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          {goals.length ? (
            <ul className="space-y-3">
              {goals.map((g) => {
                const p = goalProgress(g);
                const done = g.status === "completed";
                return (
                  <li key={g.id as string} className={cn("rounded-2xl border bg-card p-4", done ? "border-success/50" : "border-border")}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{g.title as string}</p>
                        <p className="text-xs text-muted-foreground">
                          {titleCase(g.goal_type as string)}
                          {g.target_value != null && ` · target ${g.target_value} ${(g.unit as string) ?? ""}`}
                          {p.current != null && ` · now ${p.current}`}
                          {g.target_date ? ` · by ${g.target_date}` : ""}
                        </p>
                      </div>
                      <form action={setGoalStatusAction} className="flex gap-1">
                        <input type="hidden" name="id" value={g.id as string} />
                        {done ? (
                          <Button type="submit" name="status" value="archived" size="sm" variant="ghost">
                            Archive
                          </Button>
                        ) : (
                          <>
                            <Button type="submit" name="status" value="completed" size="sm" variant="secondary" aria-label={`Mark ${g.title} complete`}>
                              <CheckCircle2 aria-hidden /> Done
                            </Button>
                            <Button type="submit" name="status" value="archived" size="icon-sm" variant="ghost" aria-label={`Archive ${g.title}`}>
                              <Trash2 aria-hidden />
                            </Button>
                          </>
                        )}
                      </form>
                    </div>
                    <ProgressBar className="mt-3" value={done ? 100 : p.pct} label={`${g.title} progress`} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Target} title="No goals yet" description="Set a realistic, measurable goal to track your progress." />
          )}
          <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="new-goal">
            <h3 id="new-goal" className="mb-3 font-display text-lg font-semibold uppercase">
              New goal
            </h3>
            <GoalForm exercises={exercises.map((e) => ({ id: e.id as string, name: e.name as string }))} units={units} />
          </section>
        </div>
      </section>

      <section id="records" className="scroll-mt-24" aria-labelledby="records-title">
        <h2 id="records-title" className="mb-3 flex items-center gap-2 font-display text-2xl font-bold uppercase">
          <Trophy className="size-5 text-gold" aria-hidden /> Personal bests
        </h2>
        {bests.length ? (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-elevated text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Exercise</th>
                  <th className="px-4 py-3 font-semibold">Est. 1RM</th>
                  <th className="px-4 py-3 font-semibold">Heaviest</th>
                  <th className="px-4 py-3 font-semibold">Reps / Time</th>
                  <th className="px-4 py-3 font-semibold">Last PR</th>
                </tr>
              </thead>
              <tbody>
                {bests.map((b) => (
                  <tr key={b.exerciseId} className="border-t border-border">
                    <td className="px-4 py-2.5 font-semibold">
                      <Link href={`/train/exercises/${b.slug}`} className="hover:text-gold-highlight">
                        {b.exercise}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-gold-highlight">{b.e1rm ? formatWeight(b.e1rm, units) : "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums">{b.maxWeight ? formatWeight(b.maxWeight, units) : "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums">{b.maxDuration ? formatDuration(b.maxDuration) : b.maxReps ? `${b.maxReps} reps` : "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(b.lastAchieved).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Trophy} title="No personal bests yet" description="Complete sets in a workout and your records will appear here." />
        )}
      </section>

      <section aria-labelledby="measure-title">
        <h2 id="measure-title" className="mb-3 font-display text-2xl font-bold uppercase">
          Body measurements <span className="text-sm font-normal normal-case text-muted-foreground">(optional)</span>
        </h2>
        {advanced ? (
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <LineSeriesChart
              title="Measurements"
              description={`Waist, chest and hips (${lengthUnit(units)})`}
              data={measurements}
              xKey="date"
              xFormat="date"
              valueSuffix={` ${lengthUnit(units)}`}
              series={[
                { key: "waist", label: "Waist", color: CATEGORICAL[0] },
                { key: "chest", label: "Chest", color: CATEGORICAL[1] },
                { key: "hips", label: "Hips", color: CATEGORICAL[2] },
              ]}
              emptyMessage="No measurements logged in this period."
            />
            <section className="rounded-2xl border border-border bg-card p-5">
              <MeasurementForm units={units} today={today} />
            </section>
          </div>
        ) : (
          <Locked title="Body measurement tracking" />
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        Showing {start} to {today}.
      </p>
    </div>
  );
}
