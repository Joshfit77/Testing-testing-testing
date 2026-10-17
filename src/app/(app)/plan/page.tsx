import Link from "next/link";
import { CalendarDays, Dumbbell, Flame, Home, Play } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { ACTIVITY_INFO, weeksToGoal } from "@/lib/domain/calorie-budget";
import { isoDateInTz } from "@/lib/domain/dates";
import { formatLongDate, goalDate, paceLabel } from "@/lib/domain/diary";
import { DIETS } from "@/lib/domain/diets";
import { GOAL_LABELS } from "@/lib/domain/types";
import { formatWeight } from "@/lib/domain/units";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { loadBudgetContext } from "@/server/services/nutrition-targets";
import { getActiveProgram } from "@/server/services/training";

export const metadata = { title: "Your plan" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const sp = await searchParams;
  const isNew = sp.new === "1";
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const units = profile.unit_system;
  const today = isoDateInTz(new Date(), profile.timezone);

  const [ctx, goalsRes, active] = await Promise.all([
    loadBudgetContext(supabase, user.id),
    supabase.from("nutrition_goals").select("calories, protein_g, carbs_g, fat_g, water_ml, is_estimate").eq("user_id", user.id).maybeSingle(),
    getActiveProgram(supabase, user.id),
  ]);
  const goals = goalsRes.data as { calories: number; protein_g: number; carbs_g: number; fat_g: number; water_ml: number; is_estimate: boolean } | null;

  let program: { sessionMinutes: number; weekOne: { id: string; day_number: number; name: string; focus: string | null; estimated_minutes: number | null }[] } | null = null;
  if (active) {
    const [{ data: tp }, { data: week }] = await Promise.all([
      supabase.from("training_programs").select("session_minutes").eq("id", active.programId).maybeSingle(),
      supabase.from("program_weeks").select("id").eq("program_id", active.programId).eq("week_number", 1).maybeSingle(),
    ]);
    const { data: days } = week
      ? await supabase.from("program_days").select("id, day_number, name, focus, estimated_minutes").eq("week_id", week.id).order("day_number")
      : { data: [] };
    program = { sessionMinutes: (tp?.session_minutes as number) ?? 0, weekOne: (days ?? []) as NonNullable<typeof program>["weekOne"] };
  }

  const budget = ctx?.budget ?? null;
  const usesBudget = Boolean(budget && goals?.is_estimate);
  const effective = budget?.effectiveWeeklyChangeKg ?? 0;
  const weeks = ctx && budget ? weeksToGoal(ctx.weightKg, ctx.goalWeightKg, effective) : null;
  const startHref = active?.today ? `/train/workout?day=${active.today.id}&up=${active.userProgramId}` : "/train";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={isNew ? "You're all set" : "Your plan"}
        title={isNew ? "Your plan is ready" : "Your plan"}
        description={
          ctx ? `Built for your goal: ${GOAL_LABELS[ctx.goal]}. Rooted in faith. Built for strength.` : "Your training program and daily calorie budget."
        }
      />

      <section aria-labelledby="budget-title" className="bg-card-gradient rounded-2xl border border-gold-muted/60 p-5 md:p-6">
        <h2 id="budget-title" className="flex items-center gap-2 font-display text-xl font-bold uppercase">
          <Flame className="size-5 text-gold" aria-hidden /> Daily calorie budget
        </h2>
        {goals ? (
          <>
            <p className="mt-3 font-display text-5xl font-bold tabular-nums text-gold-highlight">
              {goals.calories.toLocaleString("en-US")} <span className="text-lg text-muted-foreground">kcal / day {goals.is_estimate ? "(estimate)" : "(your custom target)"}</span>
            </p>
            {budget && (
              <p className="mt-1 text-sm text-muted-foreground">
                Maintenance: about {budget.maintenance.toLocaleString("en-US")} kcal / day before workouts
                {ctx?.activity ? ` (${ACTIVITY_INFO[ctx.activity].label.toLowerCase()})` : ""}.
              </p>
            )}
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              {(
                [
                  ["Protein", goals.protein_g],
                  ["Carbs", goals.carbs_g],
                  ["Fat", goals.fat_g],
                ] as const
              ).map(([l, v]) => (
                <div key={l} className="rounded-xl border border-border bg-card p-3">
                  <dt className="text-xs uppercase tracking-widest text-muted-foreground">{l}</dt>
                  <dd className="font-display text-2xl font-bold tabular-nums">{v} g</dd>
                </div>
              ))}
            </dl>
            {ctx && budget && (
              <div className="mt-4 space-y-1 text-sm">
                <p>
                  <span className="font-semibold">Pace:</span> {paceLabel(ctx.effectiveRateKg ?? 0, units)}
                  {ctx.goalWeightKg ? ` · goal weight ${formatWeight(ctx.goalWeightKg, units)}` : ""}
                </p>
                {usesBudget &&
                  (effective === 0 || ctx.effectiveRateKg === 0 ? (
                    <p className="text-muted-foreground">Your budget is set to maintain your current weight ({formatWeight(ctx.weightKg, units)}).</p>
                  ) : weeks != null && weeks > 0 ? (
                    <p className="text-muted-foreground">
                      Estimated goal date: <span className="font-semibold text-foreground">{formatLongDate(goalDate(today, weeks))}</span> (about {weeks} weeks at this pace).
                    </p>
                  ) : ctx.goalWeightKg ? null : (
                    <p className="text-muted-foreground">Add a goal weight on the Food page to see an estimated goal date.</p>
                  ))}
                {usesBudget && budget.floored && (
                  <Notice tone="warning">
                    We raised your budget to {goals.calories.toLocaleString("en-US")} kcal, the lowest we suggest without medical supervision.{" "}
                    {effective < 0
                      ? `At this budget you'd lose about ${formatWeight(Math.abs(effective), units)} per week, slower than the pace you picked.`
                      : "At this budget you'd roughly maintain your weight."}
                  </Notice>
                )}
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Calories are an estimate (Mifflin-St Jeor equation and your activity level), not medical or dietary advice. Logged workouts add calories back on
              the day. If you&apos;re pregnant, have a medical condition or a history of disordered eating, check with your doctor or a registered dietitian.
              {ctx ? ` Diet style: ${DIETS[ctx.diet].name}.` : ""}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No calorie budget yet. Log your bodyweight in Progress, then set targets on the Food page.</p>
        )}
      </section>

      <section aria-labelledby="program-title" className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <h2 id="program-title" className="flex items-center gap-2 font-display text-xl font-bold uppercase">
          <Dumbbell className="size-5 text-gold" aria-hidden /> Your training program
        </h2>
        {active && program ? (
          <>
            <p className="mt-3 font-display text-2xl font-semibold uppercase">{active.programName}</p>
            <p className="text-sm text-muted-foreground">
              {active.durationWeeks} weeks × {active.daysPerWeek} days/week × {program.sessionMinutes} min
            </p>
            {program.weekOne.length > 0 && (
              <>
                <h3 className="mt-4 flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="size-4 text-gold" aria-hidden /> Week 1
                </h3>
                <ol className="mt-2 space-y-2">
                  {program.weekOne.map((d) => (
                    <li key={d.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-elevated/40 px-3 py-2 text-sm">
                      <span>
                        <span className="font-semibold">
                          Day {d.day_number}: {d.name}
                        </span>
                        {d.focus && <span className="block text-xs text-muted-foreground">{d.focus}</span>}
                      </span>
                      {d.estimated_minutes ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">~{d.estimated_minutes} min</span> : null}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">You don&apos;t have an active program. Build one from Train.</p>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        {active?.today ? (
          <Button asChild size="lg" className="flex-1">
            <Link href={startHref}>
              <Play aria-hidden /> Start my first workout
            </Link>
          </Button>
        ) : (
          <Button asChild size="lg" className="flex-1">
            <Link href="/train/build">
              <Dumbbell aria-hidden /> Build a program
            </Link>
          </Button>
        )}
        <Button asChild size="lg" variant="outline" className="flex-1">
          <Link href={isNew ? "/home?welcome=1" : "/home"}>
            <Home aria-hidden /> Go to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
