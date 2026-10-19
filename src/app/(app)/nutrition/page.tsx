import Link from "next/link";
import { BookMarked, CalendarClock, ChevronLeft, ChevronRight, Lock, Pill, Salad, Scale, Trash2, TrendingUp } from "lucide-react";
import { BarSeriesChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { BudgetForm, CopyMealButton, QuickAddDialog } from "@/components/nutrition/diary-client";
import {
  AddFoodDialog,
  CustomFoodForm,
  GoalsForm,
  LogTemplateForm,
  SaveMealForm,
  WaterCard,
  type MyFood,
} from "@/components/nutrition/nutrition-client";
import { ActionButton } from "@/components/common/action-button";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { progressPct, sumMacros } from "@/lib/domain/nutrition";
import { hasFeature } from "@/lib/domain/plans";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { isFoodSearchConfigured } from "@/server/env";
import { isFlagEnabled } from "@/server/flags";
import { deleteCustomFoodAction, deleteMealItemAction, deleteTemplateAction, markPlannedEatenAction } from "@/server/actions/nutrition";
import { getNutritionDaily } from "@/server/services/progress";
import { loadBudgetContext } from "@/server/services/nutrition-targets";
import { exerciseCalories, projectWeightKg, remainingCalories, weeksToGoal } from "@/lib/domain/calorie-budget";
import { formatLongDate, goalDate, paceLabel, recentAndFrequent, weeklySummary, weightGoalProgress, workoutMinutes, type DiaryItem } from "@/lib/domain/diary";
import { formatWeight } from "@/lib/domain/units";
import { COMMON_FOODS } from "@/data/foods";
import { EditableMealItem, type EditableItem } from "@/components/nutrition/food-amount";
import { basisFromLegacyItem, defaultUnit, sanitizeBasis, unitIdForLabel } from "@/lib/domain/food-basis";
import { nutrientTotals } from "@/lib/domain/nutrition";
import { usdaCategories } from "@/server/services/usda-local";
import { DIETS, fitsDiet, isDietType } from "@/lib/domain/diets";
import { MEAL_TYPES } from "@/lib/domain/meals";

export const metadata = { title: "Food" };

interface MealRow {
  id: string;
  meal_type: string;
  status: "logged" | "planned";
  name: string | null;
  meal_items: {
    id: string;
    name: string;
    servings: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    is_estimate: boolean;
    fiber_g: number | null;
    sugar_g: number | null;
    sodium_mg: number | null;
    grams: number | null;
    quantity: number | null;
    unit_label: string | null;
    amount_label: string | null;
    source: string | null;
    basis: unknown;
  }[];
}

function fmt(n: number) {
  return Math.round(n * 10) / 10;
}

/** Diary row data for the edit dialog: the stored basis (or one rebuilt from an older entry). */
function editableItem(i: MealRow["meal_items"][number], mealType: string): EditableItem {
  const stored = sanitizeBasis(i.basis);
  const basis = stored ?? basisFromLegacyItem(i);
  const savedUnit = stored ? unitIdForLabel(stored, i.unit_label) : null;
  let unitId = "serving";
  let quantity = Number(i.servings);
  if (stored && savedUnit && Number(i.quantity) > 0) {
    unitId = savedUnit;
    quantity = Number(i.quantity);
  } else if (stored && !stored.servingOnly && Number(i.grams) > 0) {
    unitId = stored.liquid ? "ml" : "g";
    quantity = Number(i.grams);
  } else if (stored) {
    ({ unitId, quantity } = defaultUnit(stored));
  }
  const amount = i.amount_label ?? (Number(i.servings) !== 1 ? `${Number(i.servings)} ×` : null);
  return {
    id: i.id,
    name: i.name,
    mealType,
    basis,
    quantity,
    unitId,
    isEstimate: i.is_estimate,
    note: stored
      ? null
      : i.source === "custom"
        ? "Entered by hand, so it scales by servings of the values you entered."
        : "Logged before amounts were saved, so it scales by servings of what you logged.",
    summary: `${amount ? `${amount} · ` : ""}${Math.round(Number(i.calories))} kcal · P ${fmt(Number(i.protein_g))} · C ${fmt(Number(i.carbs_g))} · F ${fmt(Number(i.fat_g))}`,
  };
}

export default async function NutritionPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);

  if (!hasFeature(plan, "nutrition_tracking")) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Food log" title="Food" description="Track calories, macros and water, save meals and plan ahead." />
        <EmptyState
          icon={Lock}
          title="Included with Plus and Pro"
          description="Track calories, protein, carbs, fat and water, search a reliable food database, save meals and recipes, and plan ahead."
          action={
            <Button asChild>
              <Link href="/profile/billing">See plans</Link>
            </Button>
          }
        />
        <Link href="/nutrition/diets" className="lift block rounded-2xl border border-border bg-card p-4">
          <span className="font-display text-lg font-semibold uppercase">Explore diets</span>
          <span className="block text-sm text-muted-foreground">Balanced, high protein, keto, Mediterranean, Daniel Fast and more — free for everyone.</span>
        </Link>
        <Link href="/nutrition/supplements" className="lift block rounded-2xl border border-border bg-card p-4">
          <span className="font-display text-lg font-semibold uppercase">Supplements</span>
          <span className="block text-sm text-muted-foreground">Creatine, protein, vitamin D and more — what the evidence says, plus a daily stack to check off. Free for everyone.</span>
        </Link>
      </div>
    );
  }

  const today = isoDateInTz(new Date(), profile.timezone);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const supabase = await getServerSupabase();
  const prevDate = addDays(date, -1);
  const [mealsRes, goalsRes, waterRes, foodsRes, templatesRes, plannedRes, history, flag, commonRes, dietRes, prevRes, recentRes, workoutsRes, ctx, categories] = await Promise.all([
    supabase
      .from("meals")
      .select("id, meal_type, status, name, meal_items(id, name, servings, calories, protein_g, carbs_g, fat_g, is_estimate, fiber_g, sugar_g, sodium_mg, grams, quantity, unit_label, amount_label, source, basis)")
      .eq("user_id", user.id)
      .eq("eaten_on", date)
      .eq("is_template", false)
      .order("created_at"),
    supabase.from("nutrition_goals").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("water_entries").select("amount_ml").eq("user_id", user.id).eq("recorded_on", date),
    supabase.from("foods").select("id, name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, is_estimate, source").eq("owner_id", user.id).order("name"),
    supabase.from("meals").select("id, name, yield_servings, meal_items(calories, protein_g)").eq("user_id", user.id).eq("is_template", true).order("name"),
    supabase
      .from("meals")
      .select("id, eaten_on, meal_type, meal_items(name)")
      .eq("user_id", user.id)
      .eq("status", "planned")
      .eq("is_template", false)
      .gte("eaten_on", today)
      .order("eaten_on")
      .limit(14),
    getNutritionDaily(supabase, user.id, addDays(today, -13), today),
    isFlagEnabled("food_search"),
    supabase.from("foods").select("id, name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, is_estimate, source, source_ref").is("owner_id", null).order("name"),
    supabase.from("onboarding_answers").select("diet_type").eq("user_id", user.id).maybeSingle(),
    supabase.from("meals").select("meal_type, meal_items(id)").eq("user_id", user.id).eq("eaten_on", prevDate).eq("status", "logged").eq("is_template", false),
    supabase
      .from("meal_items")
      .select("id, name, calories, protein_g, carbs_g, fat_g, created_at, meal:meals!inner(eaten_on, status, is_template)")
      .eq("user_id", user.id)
      .eq("meal.is_template", false)
      .eq("meal.status", "logged")
      .gte("meal.eaten_on", addDays(today, -30))
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("workout_sessions")
      .select("started_at, ended_at, paused_seconds")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("started_at", `${addDays(date, -1)}T00:00:00Z`)
      .lt("started_at", `${addDays(date, 2)}T00:00:00Z`),
    loadBudgetContext(supabase, user.id),
    usdaCategories(),
  ]);

  const meals = (mealsRes.data ?? []) as unknown as MealRow[];
  const logged = meals.filter((m) => m.status === "logged");
  const planned = meals.filter((m) => m.status === "planned");
  const totals = sumMacros(logged.flatMap((m) => m.meal_items.map((i) => ({ ...i, calories: Number(i.calories), protein_g: Number(i.protein_g), carbs_g: Number(i.carbs_g), fat_g: Number(i.fat_g) }))));
  const anyEstimate = logged.some((m) => m.meal_items.some((i) => i.is_estimate));
  const nutrients = nutrientTotals(logged.flatMap((m) => m.meal_items));
  const goals = goalsRes.data as { calories: number; protein_g: number; carbs_g: number; fat_g: number; water_ml: number; is_estimate: boolean } | null;
  const water = (waterRes.data ?? []).reduce((s, w) => s + (w.amount_ml as number), 0);
  const myFoods = (foodsRes.data ?? []) as MyFood[];
  const diet = DIETS[isDietType(dietRes.data?.diet_type) ? dietRes.data.diet_type : "balanced"];
  const foodBySlug = new Map(COMMON_FOODS.map((f) => [f.slug, f]));
  const commonFoods = ((commonRes.data ?? []) as (MyFood & { source_ref: string | null })[]).map(({ source_ref, ...f }) => {
    const known = source_ref ? foodBySlug.get(source_ref) : undefined;
    return { ...f, fitsDiet: known ? fitsDiet(known, diet.id) : false };
  });
  const templates = (templatesRes.data ?? []) as unknown as { id: string; name: string; yield_servings: number; meal_items: { calories: number; protein_g: number }[] }[];
  const upcoming = (plannedRes.data ?? []) as unknown as { id: string; eaten_on: string; meal_type: string; meal_items: { name: string }[] }[];
  const label = date === today ? "Today" : new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  const remoteSearch = isFoodSearchConfigured() && flag;
  const units = profile.unit_system;

  // Previous day's logged meals, for "copy from yesterday".
  const prevCounts = new Map<string, number>();
  for (const m of (prevRes.data ?? []) as unknown as { meal_type: string; meal_items: { id: string }[] }[])
    prevCounts.set(m.meal_type, (prevCounts.get(m.meal_type) ?? 0) + m.meal_items.length);
  const prevTotal = [...prevCounts.values()].reduce((a, b) => a + b, 0);
  const prevLabel = date === today ? "yesterday" : new Date(`${prevDate}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  // Recent and frequent foods (last 30 days) for one-tap re-logging.
  const { recent, frequent } = recentAndFrequent(
    ((recentRes.data ?? []) as unknown as { id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; created_at: string }[]).map(
      (i): DiaryItem => ({ id: i.id, name: i.name, calories: Number(i.calories), protein_g: Number(i.protein_g), carbs_g: Number(i.carbs_g), fat_g: Number(i.fat_g), loggedAt: i.created_at }),
    ),
  );

  // Exercise: estimated calories from this day's finished workouts (strength ≈ 5 MET) at the latest bodyweight.
  const workouts = ((workoutsRes.data ?? []) as { started_at: string; ended_at: string | null; paused_seconds: number }[]).filter(
    (w) => isoDateInTz(new Date(w.started_at), profile.timezone) === date,
  );
  const workoutMins = workouts.reduce((s, w) => s + workoutMinutes(w.started_at, w.ended_at, w.paused_seconds), 0);
  const exercise = ctx ? exerciseCalories(workoutMins, ctx.weightKg) : 0;
  const food = Math.round(totals.calories);
  const remaining = goals ? remainingCalories(goals.calories, food, exercise) : null;
  const projected = date === today && ctx?.budget ? projectWeightKg(ctx.weightKg, ctx.budget.maintenance, food, exercise, 5) : null;

  // Weekly summary: the last 7 days ending today.
  const week = history.slice(-7);
  const summary = weeklySummary(week, goals?.calories ?? null);

  // Weight goal.
  const weeksLeft = ctx?.budget && ctx.goalWeightKg ? weeksToGoal(ctx.weightKg, ctx.goalWeightKg, ctx.budget.effectiveWeeklyChangeKg) : null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Food log" title="Food" description="Track what you eat. Search common foods, save your own, or enter anything by hand." actions={<AddFoodDialog date={date} myFoods={myFoods} commonFoods={commonFoods} remoteSearch={remoteSearch} categories={categories} dietName={diet.name} recent={recent} frequent={frequent} />} />
      <nav className="flex items-center justify-between rounded-2xl border border-border bg-card p-2" aria-label="Choose day">
        <Button asChild variant="ghost" size="icon" aria-label="Previous day">
          <Link href={`/nutrition?date=${addDays(date, -1)}`}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <div className="text-center">
          <p className="font-display text-lg font-semibold uppercase">{label}</p>
          {date !== today && (
            <Link href="/nutrition" className="text-xs text-gold-highlight hover:underline">
              Back to today
            </Link>
          )}
        </div>
        <Button asChild variant="ghost" size="icon" aria-label="Next day">
          <Link href={`/nutrition?date=${addDays(date, 1)}`}>
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </nav>

      <section aria-labelledby="budget-strip-title" className="rounded-2xl border border-gold-muted/60 bg-card-gradient p-4">
        <h2 id="budget-strip-title" className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          Calories remaining
        </h2>
        {goals && remaining != null ? (
          <>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-1 text-center" data-testid="budget-equation">
              <div>
                <p className="font-display text-xl font-bold tabular-nums sm:text-2xl" data-testid="budget-goal">{goals.calories}</p>
                <p className="text-[11px] text-muted-foreground">Goal</p>
              </div>
              <span className="text-muted-foreground" aria-hidden>−</span>
              <div>
                <p className="font-display text-xl font-bold tabular-nums sm:text-2xl" data-testid="budget-food">{food}</p>
                <p className="text-[11px] text-muted-foreground">Food</p>
              </div>
              <span className="text-muted-foreground" aria-hidden>+</span>
              <div>
                <p className="font-display text-xl font-bold tabular-nums sm:text-2xl" data-testid="budget-exercise">{exercise}</p>
                <p className="text-[11px] text-muted-foreground">Exercise (est.)</p>
              </div>
              <span className="text-muted-foreground" aria-hidden>=</span>
              <div>
                <p className={`font-display text-xl font-bold tabular-nums sm:text-2xl ${remaining < 0 ? "text-[#f08a8a]" : "text-gold-highlight"}`} data-testid="budget-remaining">
                  {remaining}
                </p>
                <p className="text-[11px] text-muted-foreground">Remaining</p>
              </div>
            </div>
            <p className="sr-only">
              Goal {goals.calories} minus food {food} plus exercise {exercise} equals {remaining} calories remaining.
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {goals.is_estimate ? "Goal is an estimate. " : "Goal is your custom target. "}
              {workouts.length
                ? `Exercise is estimated from ${workoutMins} min of logged workouts at your latest bodyweight.`
                : ctx
                  ? "Finish a workout to add its estimated calories here."
                  : "Log your bodyweight to estimate workout calories."}
            </p>
            {projected != null && (
              <p className="mt-2 flex items-start gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-sm" data-testid="projection">
                <TrendingUp className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                <span>
                  If every day were like today, you&apos;d weigh about <span className="font-semibold">{formatWeight(projected, units)}</span> in 5 weeks.
                  <span className="block text-[11px] text-muted-foreground">An estimate from today&apos;s food and exercise, not a prediction.</span>
                </span>
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Set your daily targets below to see your calories remaining.</p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="bg-card-gradient rounded-2xl border border-border p-5" aria-labelledby="totals-title">
          <h2 id="totals-title" className="sr-only">
            Daily totals
          </h2>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <ProgressRing
              size={136}
              ariaLabel="Calories"
              value={progressPct(totals.calories, goals?.calories ?? 0)}
              label={Math.round(totals.calories)}
              sublabel={goals ? `of ${goals.calories} kcal` : "kcal"}
            />
            <div className="w-full flex-1 space-y-3">
              {(
                [
                  ["Protein", totals.protein_g, goals?.protein_g],
                  ["Carbs", totals.carbs_g, goals?.carbs_g],
                  ["Fat", totals.fat_g, goals?.fat_g],
                ] as const
              ).map(([l, v, g]) => (
                <div key={l}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{l}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {Math.round(v)}
                      {g ? ` / ${g}` : ""} g
                    </span>
                  </div>
                  <ProgressBar value={g ? progressPct(v, g) : 0} label={`${l} progress`} />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-3" data-testid="nutrient-totals">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Nutrients</h3>
            {!(nutrients.fiber.count || nutrients.sugar.count || nutrients.sodium.count) ? (
              <p className="mt-1 text-xs text-muted-foreground">Fiber, sugar and sodium appear here for foods logged from the food database or a barcode.</p>
            ) : (
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ["Fiber", nutrients.fiber, "g", "nutrient-fiber"],
                    ["Sugar", nutrients.sugar, "g", "nutrient-sugar"],
                    ["Sodium", nutrients.sodium, "mg", "nutrient-sodium"],
                  ] as const
                ).map(([l, t, u, id]) => (
                  <div key={l} className="rounded-xl border border-border bg-card/60 p-2">
                    <dt className="text-[11px] text-muted-foreground">{l}</dt>
                    <dd className="font-semibold tabular-nums" data-testid={id}>
                      {t.count ? `${u === "mg" ? Math.round(t.total) : Math.round(t.total * 10) / 10} ${u}` : "—"}
                    </dd>
                    <dd className="text-[10px] text-muted-foreground">
                      {t.count === nutrients.items ? "all foods" : `from ${t.count} of ${nutrients.items} foods with data`}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          {anyEstimate && <p className="mt-4 text-xs text-gold">Includes estimated entries (marked “estimate”).</p>}
          {goals ? (
            goals.calories - totals.calories > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">{Math.round(goals.calories - totals.calories)} kcal remaining for the day.</p>
            )
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Set targets below to see progress.</p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="water-title">
          <h2 id="water-title" className="mb-3 font-display text-lg font-semibold uppercase">
            Water
          </h2>
          <WaterCard date={date} totalMl={water} goalMl={goals?.water_ml ?? 2500} />
        </section>
      </div>

      <section aria-labelledby="meals-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="meals-title" className="font-display text-2xl font-bold uppercase">
            Meals
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <QuickAddDialog date={date} />
            {prevTotal > 0 && <CopyMealButton fromDate={prevDate} toDate={date} label={date === today ? "Copy yesterday" : `Copy all from ${prevLabel}`} />}
          </div>
        </div>
        {logged.length === 0 && planned.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing logged yet. Use &ldquo;Add food&rdquo; to search, pick a recent or saved food, or quick add calories.</p>
        )}
        {MEAL_TYPES.map(([type, title]) => {
          const ms = logged.filter((m) => m.meal_type === type);
          const items = ms.flatMap((m) => m.meal_items);
          const mt = sumMacros(items.map((i) => ({ calories: Number(i.calories), protein_g: Number(i.protein_g) })));
          const prevCount = prevCounts.get(type) ?? 0;
          return (
            <div key={type} className="rounded-2xl border border-border bg-card p-4" data-testid={`meal-${type}`}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold uppercase">{title}</h3>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {Math.round(mt.calories)} kcal · {Math.round(mt.protein_g)}g protein
                </span>
              </div>
              {items.length > 0 && (
                <ul className="divide-y divide-border">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 py-1">
                      <EditableMealItem item={editableItem(i, type)} />
                      <ActionButton action={deleteMealItemAction} fields={{ id: i.id }} size="icon-sm" variant="ghost" aria-label={`Remove ${i.name}`}>
                        <Trash2 aria-hidden />
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <QuickAddDialog date={date} mealType={type} compact />
                {prevCount > 0 && (
                  <CopyMealButton fromDate={prevDate} toDate={date} mealType={type} label={`Copy ${title.toLowerCase()} from ${prevLabel} (${prevCount})`} />
                )}
              </div>
              {ms[0] && (
                <div className="mt-3 border-t border-border pt-3">
                  <SaveMealForm mealId={ms[0].id} defaultName={`${title} ${date}`} />
                </div>
              )}
            </div>
          );
        })}
        {planned.length > 0 && (
          <div className="rounded-2xl border border-dashed border-gold-muted/60 bg-card/60 p-4">
            <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold uppercase">
              <CalendarClock className="size-4 text-gold" aria-hidden /> Planned for this day
            </h3>
            <ul className="space-y-2">
              {planned.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    <span className="font-semibold capitalize">{m.meal_type}</span>: {m.meal_items.map((i) => i.name).join(", ")}
                  </span>
                  <ActionButton action={markPlannedEatenAction} fields={{ mealId: m.id }} size="sm" variant="secondary">
Mark eaten
                  </ActionButton>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <BarSeriesChart
            title="This week"
            description={goals ? `Calories per day vs your ${goals.calories} kcal goal (before exercise)` : "Calories per day"}
            data={week.map((d) => ({ date: d.date, calories: d.calories }))}
            xKey="date"
            xFormat="weekday"
            decimals={0}
            valueSuffix=" kcal"
            series={[{ key: "calories", label: "Calories" }]}
            referenceLine={goals ? { value: goals.calories, label: "Goal" } : undefined}
            emptyMessage="Log food this week to see your summary."
          />
          <dl className="grid grid-cols-3 gap-2 text-center" data-testid="weekly-summary">
            <div className="rounded-xl border border-border bg-card p-2">
              <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">Daily average</dt>
              <dd className="font-display text-lg font-bold tabular-nums">{summary.daysLogged ? `${summary.average} kcal` : "—"}</dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-2">
              <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">Under goal</dt>
              <dd className="font-display text-lg font-bold tabular-nums">{goals ? `${summary.under} of ${summary.daysLogged}` : "—"}</dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-2">
              <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">Over goal</dt>
              <dd className="font-display text-lg font-bold tabular-nums">{goals ? `${summary.over} of ${summary.daysLogged}` : "—"}</dd>
            </div>
          </dl>
          <p className="text-[11px] text-muted-foreground">Averages count only days with food logged ({summary.daysLogged} of the last 7).</p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="weight-goal-title">
          <h2 id="weight-goal-title" className="mb-3 flex items-center gap-2 font-display text-lg font-semibold uppercase">
            <Scale className="size-4 text-gold" aria-hidden /> Weight goal
          </h2>
          {ctx ? (
            ctx.goalWeightKg ? (
              <div className="space-y-3">
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {(
                    [
                      ["Start", ctx.startWeightKg],
                      ["Current", ctx.weightKg],
                      ["Goal", ctx.goalWeightKg],
                    ] as const
                  ).map(([l, v]) => (
                    <div key={l} className="rounded-xl border border-border bg-elevated/40 p-2">
                      <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{l}</dt>
                      <dd className="font-display text-lg font-bold tabular-nums">{formatWeight(v, units)}</dd>
                    </div>
                  ))}
                </dl>
                <ProgressBar value={weightGoalProgress(ctx.startWeightKg, ctx.weightKg, ctx.goalWeightKg)} label="Progress toward goal weight" />
                <p className="text-sm text-muted-foreground">
                  {weightGoalProgress(ctx.startWeightKg, ctx.weightKg, ctx.goalWeightKg)}% of the way.{" "}
                  {weeksLeft === 0
                    ? "You've reached your goal weight."
                    : weeksLeft != null
                      ? `At ${paceLabel(ctx.budget!.effectiveWeeklyChangeKg, units).toLowerCase()}, estimated goal date ${formatLongDate(goalDate(today, weeksLeft))}.`
                      : "Choose a pace toward your goal below to see an estimated goal date."}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Current weight {formatWeight(ctx.weightKg, units)}. Set a goal weight under Daily targets to track progress toward it.
              </p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Log your bodyweight to start tracking a weight goal.</p>
          )}
          <Button asChild variant="secondary" size="sm" className="mt-3">
            <Link href="/progress#log-weight">Log weight</Link>
          </Button>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarSeriesChart
          title="Last 14 days"
          description="Calories logged per day"
          data={history.map((d) => ({ date: d.date, calories: d.calories }))}
          xKey="date"
          xFormat="date"
          decimals={0}
          valueSuffix=" kcal"
          series={[{ key: "calories", label: "Calories" }]}
          emptyMessage="Your daily history will appear here."
        />
        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="history-title">
          <h2 id="history-title" className="mb-3 font-display text-lg font-semibold uppercase">
            Daily history
          </h2>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {[...history].reverse().map((d) => (
              <li key={d.date}>
                <Link href={`/nutrition?date=${d.date}`} className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-elevated">
                  <span className="text-muted-foreground">{d.date}</span>
                  <span className="tabular-nums">
                    {d.calories ? `${d.calories} kcal · P ${d.protein} · C ${d.carbs} · F ${d.fat}` : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>


      <Link href="/nutrition/diets" className="lift flex items-center justify-between gap-3 rounded-2xl border border-gold-muted/60 bg-card-gradient p-4">
        <span>
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Your diet</span>
          <span className="mt-1 block font-display text-xl font-semibold uppercase">{diet.name}</span>
          <span className="block text-sm text-muted-foreground">{diet.eatingWindow ?? diet.tagline}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-gold-highlight">Change</span>
      </Link>

      <Link href="/nutrition/supplements" className="lift flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <span>
          <span className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
            <Pill className="size-4 text-gold" aria-hidden /> Supplements
          </span>
          <span className="block text-sm text-muted-foreground">Evidence, doses and your daily stack.</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
      </Link>

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="targets-title">
        <h2 id="targets-title" className="mb-3 font-display text-xl font-bold uppercase">
          Daily targets
        </h2>
        <div className="mb-5 space-y-2 rounded-xl border border-border bg-elevated/40 p-4">
          <h3 className="text-sm font-semibold">Calorie budget</h3>
          <p className="text-xs text-muted-foreground">
            Change your goal weight, weekly pace or daily activity and we&apos;ll recalculate your calories and macros (an estimate).
            {ctx?.budget ? ` Maintenance is about ${ctx.budget.maintenance} kcal/day before workouts.` : ""}
          </p>
          <BudgetForm units={units} goalWeightKg={ctx?.goalWeightKg ?? null} weeklyChangeKg={ctx?.weeklyChangeKg ?? null} activity={ctx?.activity ?? null} />
        </div>
        <h3 className="mb-2 text-sm font-semibold">Custom targets</h3>
        <p className="mb-3 text-xs text-muted-foreground">Prefer your own numbers? Enter them here; they replace the estimate until you recalculate.</p>
        <GoalsForm goals={goals} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="saved-title">
          <h2 id="saved-title" className="mb-1 flex items-center gap-2 font-display text-xl font-bold uppercase">
            <BookMarked className="size-5 text-gold" aria-hidden /> Saved meals &amp; recipes
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">Save any logged meal above. Recipes with multiple servings divide nutrition per serving. Log or plan them for any date.</p>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved meals yet.</p>
          ) : (
            <ul className="space-y-4">
              {templates.map((t) => {
                const tot = sumMacros(t.meal_items.map((i) => ({ calories: Number(i.calories), protein_g: Number(i.protein_g) })));
                return (
                  <li key={t.id} className="rounded-xl border border-border bg-elevated/40 p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Per serving: {Math.round(tot.calories / Number(t.yield_servings))} kcal · {Math.round(tot.protein_g / Number(t.yield_servings))}g protein ·
                          makes {Number(t.yield_servings)}
                        </p>
                      </div>
                      <ActionButton action={deleteTemplateAction} fields={{ id: t.id }} size="icon-sm" variant="ghost" aria-label={`Delete ${t.name}`}>
<Trash2 aria-hidden />
                      </ActionButton>
                    </div>
                    <LogTemplateForm templateId={t.id} date={date} />
                  </li>
                );
              })}
            </ul>
          )}
          {upcoming.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold">Meal plan · upcoming</h3>
              <ul className="space-y-1 text-sm">
                {upcoming.map((m) => (
                  <li key={m.id}>
                    <Link href={`/nutrition?date=${m.eaten_on}`} className="flex justify-between rounded-lg px-2 py-1 hover:bg-elevated">
                      <span className="capitalize text-muted-foreground">
                        {m.eaten_on} · {m.meal_type}
                      </span>
                      <span className="truncate pl-3">{m.meal_items.map((i) => i.name).join(", ")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="foods-title">
          <h2 id="foods-title" className="mb-4 flex items-center gap-2 font-display text-xl font-bold uppercase">
            <Salad className="size-5 text-gold" aria-hidden /> My foods
          </h2>
          <CustomFoodForm />
          {myFoods.length > 0 && (
            <ul className="mt-5 divide-y divide-border">
              {myFoods.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{f.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {f.serving_size} {f.serving_unit} · {f.calories} kcal{f.is_estimate ? " · estimate" : ""}
                      {f.source === "usda" ? " · USDA" : ""}
                    </span>
                  </span>
                  <ActionButton action={deleteCustomFoodAction} fields={{ id: f.id }} size="icon-sm" variant="ghost" aria-label={`Delete ${f.name}`}>
<Trash2 aria-hidden />
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
