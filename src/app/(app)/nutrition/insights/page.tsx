import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { FoodToolsNav, NutritionLocked, nutritionPageUser } from "@/components/nutrition/nutrition-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { sanitizeBasis, type MacroKey } from "@/lib/domain/food-basis";
import { pctOfTarget, weeklyInsights, type DayMark, type DaySummary, type InsightItem } from "@/lib/domain/nutrition-insights";
import { getServerSupabase } from "@/lib/supabase/server";
import { logError } from "@/server/log";

export const metadata = { title: "Nutrition insights" };

const MACRO_LABEL: Record<MacroKey, string> = { protein_g: "protein", carbs_g: "carbs", fat_g: "fat" };
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function StateBadge({ d }: { d: DaySummary }) {
  if (d.state === "not_logged") return <Badge variant="outline">Not logged</Badge>;
  if (d.state === "logged_zero") return <Badge variant="secondary">Logged as zero</Badge>;
  return d.markedComplete ? <Badge variant="success">Complete</Badge> : <Badge variant="secondary">Logged · not marked complete</Badge>;
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ end?: string }> }) {
  const sp = await searchParams;
  const { user, profile, allowed } = await nutritionPageUser();
  if (!allowed) return <NutritionLocked title="Nutrition insights" description="See your week: calories and macros against your targets, logged versus missing days, and your top protein and calorie sources." />;
  const today = isoDateInTz(new Date(), profile.timezone);
  const end = sp.end && /^\d{4}-\d{2}-\d{2}$/.test(sp.end) && sp.end <= today ? sp.end : today;
  const start = addDays(end, -6);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const supabase = await getServerSupabase();
  const [itemsRes, marksRes, goalsRes] = await Promise.all([
    supabase
      .from("meal_items")
      .select("name, source, calories, protein_g, carbs_g, fat_g, basis, meal:meals!inner(eaten_on, status, is_template)")
      .eq("user_id", user.id)
      .eq("meal.status", "logged")
      .eq("meal.is_template", false)
      .gte("meal.eaten_on", start)
      .lte("meal.eaten_on", end)
      .limit(2000),
    supabase.from("nutrition_day_marks").select("day, status").eq("user_id", user.id).gte("day", start).lte("day", end),
    supabase.from("nutrition_goals").select("calories, protein_g, carbs_g, fat_g").eq("user_id", user.id).maybeSingle(),
  ]);
  const loadError = itemsRes.error ?? marksRes.error;
  if (loadError) logError("insights.page", loadError);

  const items: InsightItem[] = ((itemsRes.data ?? []) as unknown as { name: string; source: string | null; calories: number; protein_g: number; carbs_g: number; fat_g: number; basis: unknown; meal: { eaten_on: string } }[]).map((i) => ({
    date: i.meal.eaten_on,
    name: i.name,
    source: i.source,
    calories: Number(i.calories),
    protein_g: Number(i.protein_g),
    carbs_g: Number(i.carbs_g),
    fat_g: Number(i.fat_g),
    missing: sanitizeBasis(i.basis)?.missing,
  }));
  const marks = new Map(((marksRes.data ?? []) as { day: string; status: DayMark }[]).map((m) => [m.day, m.status]));
  const week = weeklyInsights(dates, items, marks);
  const goals = goalsRes.data as { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  const atLeast = (k: MacroKey) => (week.averageIncomplete.includes(k) ? "at least " : "");

  return (
    <div className="space-y-6">
      <BackLink href="/nutrition">Food</BackLink>
      <PageHeader eyebrow="Food" title="Nutrition insights" description="Your week of eating against your targets. Days you didn't log are left out of the averages, not counted as zero." />
      <FoodToolsNav current="/nutrition/insights" />

      <nav className="flex items-center justify-between gap-2" aria-label="Choose week">
        <Button asChild variant="ghost" size="icon" aria-label="Previous week">
          <Link href={`/nutrition/insights?end=${addDays(end, -7)}`}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <p className="text-center text-[0.9375rem] font-semibold">
          {dayLabel(start)} – {dayLabel(end)}
        </p>
        {end < today ? (
          <Button asChild variant="ghost" size="icon" aria-label="Next week">
            <Link href={`/nutrition/insights?end=${addDays(end, 7) > today ? today : addDays(end, 7)}`}>
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <span className="size-11" aria-hidden />
        )}
      </nav>

      {loadError && <Notice tone="error">Some of this week couldn&apos;t be loaded. Refresh the page to try again.</Notice>}

      <section aria-labelledby="avg-title" className="rounded-2xl border border-gold-muted/60 bg-card-gradient p-4" data-testid="insights-average">
        <h2 id="avg-title" className="text-lg font-semibold">
          Daily average
        </h2>
        <p className="text-sm text-muted-foreground" data-testid="insights-days">
          Over {week.loggedDays} logged {week.loggedDays === 1 ? "day" : "days"} · {week.notLoggedDays} not logged
        </p>
        {week.average ? (
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                ["Calories", `${week.average.calories.toLocaleString()} kcal`, week.average.calories, goals?.calories],
                ["Protein", `${atLeast("protein_g")}${week.average.protein_g} g`, week.average.protein_g, goals?.protein_g],
                ["Carbs", `${atLeast("carbs_g")}${week.average.carbs_g} g`, week.average.carbs_g, goals?.carbs_g],
                ["Fat", `${atLeast("fat_g")}${week.average.fat_g} g`, week.average.fat_g, goals?.fat_g],
              ] as const
            ).map(([l, text, v, target]) => {
              const pct = pctOfTarget(v, target);
              return (
                <div key={l} className="rounded-xl border border-border bg-card/70 p-3">
                  <dt className="text-sm text-muted-foreground">{l}</dt>
                  <dd className="text-lg font-bold tabular-nums">{text}</dd>
                  <dd className="text-sm tabular-nums text-muted-foreground">{target ? `${pct}% of ${target.toLocaleString()}` : "No target set"}</dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">Nothing logged this week, so there&apos;s no average yet.</p>
        )}
        {week.averageIncomplete.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            “At least”: some foods had no {week.averageIncomplete.map((k) => MACRO_LABEL[k]).join(" or ")} value, so the real number is higher. Missing values aren&apos;t counted as zero.
          </p>
        )}
      </section>

      <section aria-labelledby="days-title" className="space-y-2">
        <h2 id="days-title" className="text-lg font-semibold">
          Day by day
        </h2>
        <ul className="space-y-2" data-testid="insights-day-list">
          {week.days.map((d) => {
            const pct = goals ? Math.min(100, pctOfTarget(d.totals.calories, goals.calories) ?? 0) : 0;
            return (
              <li key={d.date}>
                <Link href={`/nutrition?date=${d.date}`} className="block rounded-2xl border border-border bg-card p-3 hover:border-gold-muted" data-testid={`insights-day-${d.date}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{dayLabel(d.date)}</span>
                    <StateBadge d={d} />
                  </div>
                  {d.state === "not_logged" ? (
                    <p className="mt-1 text-sm text-muted-foreground">No entries. Left out of the averages.</p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm tabular-nums">
                        <span className="font-semibold">{d.totals.calories.toLocaleString()} kcal</span>
                        {goals ? ` · ${pctOfTarget(d.totals.calories, goals.calories)}% of target` : ""} · P {d.incomplete.includes("protein_g") ? "≥" : ""}
                        {d.totals.protein_g} · C {d.incomplete.includes("carbs_g") ? "≥" : ""}
                        {d.totals.carbs_g} · F {d.incomplete.includes("fat_g") ? "≥" : ""}
                        {d.totals.fat_g}
                      </p>
                      {goals && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated" aria-hidden>
                          <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted-foreground">
          “Logged as zero” is a day you marked as eating nothing (or logged only zero-calorie items); it counts as 0. Mark days complete or as a fast from the diary.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["Top protein sources", week.topProtein, "g", "insights-top-protein"],
            ["Top calorie sources", week.topCalories, "kcal", "insights-top-calories"],
          ] as const
        ).map(([title, list, unit, testId]) => (
          <section key={title} aria-label={title} className="rounded-2xl border border-border bg-card p-4" data-testid={testId}>
            <h2 className="mb-2 text-lg font-semibold">{title}</h2>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing logged this week.</p>
            ) : (
              <ol className="space-y-2">
                {list.map((s) => (
                  <li key={s.name} className="text-[0.9375rem]">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{s.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {unit === "kcal" ? Math.round(s.amount).toLocaleString() : s.amount} {unit} · {s.share}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated" aria-hidden>
                      <div className="h-full rounded-full bg-gold-muted" style={{ width: `${s.share}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
