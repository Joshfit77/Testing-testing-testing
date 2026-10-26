import Link from "next/link";
import { BarChart3, BookMarked, Camera, ScanBarcode, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, CookingPot, Pill, Salad, Scale, ShoppingCart, Trash2, TrendingUp } from "lucide-react";
import { BarSeriesChart } from "@/components/charts/charts";
import { MainHeader } from "@/components/shell/main-header";
import { BudgetForm, CopyMealButton, QuickAddDialog } from "@/components/nutrition/diary-client";
import {
  AddFoodDialog,
  CustomFoodForm,
  GoalsForm,
    SaveMealForm,
  WaterCard,
  type MyFood,
} from "@/components/nutrition/nutrition-client";
import { ActionButton } from "@/components/common/action-button";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { NUTRITION_FEATURE_TITLE, NUTRITION_SCORE_LABEL } from "@/lib/food-iq";
import { progressPct, sumMacros } from "@/lib/domain/nutrition";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { isFoodSearchConfigured } from "@/server/env";
import { isFlagEnabled } from "@/server/flags";
import { deleteCustomFoodAction, deleteMealItemAction, markPlannedEatenAction } from "@/server/actions/nutrition";
import { getNutritionDaily } from "@/server/services/progress";
import { loadBudgetContext } from "@/server/services/nutrition-targets";
import { projectWeightKg, remainingCalories, weeksToGoal } from "@/lib/domain/calorie-budget";
import { formatLongDate, goalDate, paceLabel, recentAndFrequent, weeklySummary, weightGoalProgress, workoutMinutes, type DiaryItem } from "@/lib/domain/diary";
import { formatWeight } from "@/lib/domain/units";
import { COMMON_FOODS } from "@/data/foods";
import { EditableMealItem, type EditableItem } from "@/components/nutrition/food-amount";
import { FavoriteStar } from "@/components/nutrition/favorite-star";
import { choiceFromFavorite, isFavoritableKey, type FavoriteRow } from "@/lib/domain/food-favorites";
import { basisFromLegacyItem, defaultUnit, sanitizeBasis, unitIdForLabel } from "@/lib/domain/food-basis";
import { nutrientTotals } from "@/lib/domain/nutrition";
import { usdaCategories } from "@/server/services/usda-local";
import { DIETS, fitsDiet, isDietType } from "@/lib/domain/diets";
import { MEAL_TYPES } from "@/lib/domain/meals";
import { exerciseForDay } from "@/lib/domain/exercise-energy";
import { DayMarkControls } from "@/components/nutrition/day-mark";

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
function editableItem(i: MealRow["meal_items"][number], mealType: string, favoriteKeys: Set<string>): EditableItem {
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
    sourceKey: isFavoritableKey(i.source) ? i.source : null,
    source: i.source,
    favorite: Boolean(i.source && favoriteKeys.has(i.source)),
    summary: `${amount ? `${amount} · ` : ""}${Math.round(Number(i.calories))} kcal · P ${fmt(Number(i.protein_g))} · C ${fmt(Number(i.carbs_g))} · F ${fmt(Number(i.fat_g))}`,
  };
}

export default async function NutritionPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  // The food diary, search, barcode scanning and macros are free on every plan.
  const today = isoDateInTz(new Date(), profile.timezone);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const supabase = await getServerSupabase();
  const prevDate = addDays(date, -1);
  const [mealsRes, goalsRes, waterRes, foodsRes, templatesRes, plannedRes, history, flag, commonRes, dietRes, prevRes, recentRes, workoutsRes, ctx, categories, favoritesRes, stepsRes, activitiesRes, markRes] = await Promise.all([
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
    supabase.from("food_favorites").select("food_key, name, detail, basis, is_estimate").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("daily_steps").select("steps").eq("user_id", user.id).eq("day", date).maybeSingle(),
    supabase
      .from("activities")
      .select("kind, distance_m, moving_s, started_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gte("started_at", `${addDays(date, -1)}T00:00:00Z`)
      .lt("started_at", `${addDays(date, 2)}T00:00:00Z`),
    supabase.from("nutrition_day_marks").select("status").eq("user_id", user.id).eq("day", date).maybeSingle(),
  ]);
  const favorites = ((favoritesRes.data ?? []) as FavoriteRow[]).map(choiceFromFavorite).filter((f): f is NonNullable<typeof f> => f != null);
  const favoriteKeys = new Set(favorites.map((f) => f.key));

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
  // Runs and walks that day, and the step count: combined without double counting (exercise-energy.ts).
  const dayActivities = ((activitiesRes.data ?? []) as { kind: "run" | "walk"; distance_m: number | null; moving_s: number; started_at: string }[])
    .filter((a) => isoDateInTz(new Date(a.started_at), profile.timezone) === date)
    .map((a) => ({ kind: a.kind, distance_m: a.distance_m == null ? null : Number(a.distance_m), moving_s: Number(a.moving_s) }));
  const steps = stepsRes.data ? Number(stepsRes.data.steps) : null;
  const ex = ctx ? exerciseForDay({ weightKg: ctx.weightKg, activity: ctx.activity, workoutMinutes: workoutMins, activities: dayActivities, steps }) : null;
  const exercise = ex?.total ?? 0;
  const dayMark = (markRes.data?.status as "complete" | "fasted" | undefined) ?? null;
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
      <MainHeader title="Food" />
      <nav className="-mt-4 -mb-1 flex items-center justify-center gap-2" aria-label="Choose day">
        <Button asChild variant="ghost" size="icon" aria-label="Previous day">
          <Link href={`/nutrition?date=${addDays(date, -1)}`}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <div className="min-w-32 text-center">
          <p className="text-base font-semibold">{label}</p>
          {date !== today && (
            <Link href="/nutrition" className="text-sm text-gold-highlight hover:underline">
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

      <section aria-labelledby="food-iq-cta" className="rounded-2xl border border-gold/70 bg-gradient-to-br from-gold/12 via-card to-card p-4 shadow-bronze md:p-5" data-testid="food-iq-cta">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-gold-muted/60 bg-elevated">
            <ScanBarcode className="size-6 text-gold" aria-hidden />
          </span>
          <div className="min-w-0">
            <p id="food-iq-cta" className="font-display text-xs font-bold uppercase tracking-[0.16em] text-gold">
              {NUTRITION_FEATURE_TITLE}
            </p>
            <p className="mt-1 text-[1.0625rem] font-semibold leading-snug">Scan a packaged food&apos;s barcode to review its nutrition and ingredients.</p>
            <p className="mt-1 text-sm text-muted-foreground">Additives, sweeteners, preservatives and added sugars from the declared ingredient list, each with what regulators say, how strong the evidence is and where it comes from. It reads the label and product data; it doesn&apos;t test the food itself.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/nutrition/scanner">
              <ScanBarcode aria-hidden /> Scan a product
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/nutrition/scanner#search">Search by name</Link>
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 md:p-5" aria-labelledby="totals-title">
        <h2 id="totals-title" className="sr-only">
          Daily totals
        </h2>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <ProgressRing
            size={176}
            stroke={12}
            ariaLabel="Calories eaten of daily goal"
            value={progressPct(totals.calories, goals?.calories ?? 0)}
            label={<span className="text-3xl font-bold tabular-nums">{Math.round(totals.calories).toLocaleString()}</span>}
            sublabel={
              <>
                <span className="block text-sm text-foreground/90">calories eaten</span>
                {goals && <span className="mt-1 block">{goals.calories.toLocaleString()} daily goal</span>}
              </>
            }
          />
          <dl className="w-full flex-1 space-y-3">
            {(
              [
                ["Protein", totals.protein_g, goals?.protein_g],
                ["Carbs", totals.carbs_g, goals?.carbs_g],
                ["Fat", totals.fat_g, goals?.fat_g],
              ] as const
            ).map(([l, v, g]) => (
              <div key={l} className="grid grid-cols-[4.5rem_6.5rem_1fr] items-center gap-2 text-[0.9375rem]">
                <dt className="font-semibold">{l}</dt>
                <dd className="tabular-nums text-muted-foreground">
                  {Math.round(v)}
                  {g ? ` / ${g}` : ""} g
                </dd>
                <dd>
                  <ProgressBar value={g ? progressPct(v, g) : 0} label={`${l} progress`} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {anyEstimate && <p className="mt-3 text-sm text-gold">Includes estimated entries (marked “estimate”).</p>}
        {!goals && <p className="mt-3 text-sm text-muted-foreground">Set targets below to see progress.</p>}
      </section>

      <div className="space-y-2">
        <div className="[&>button]:w-full">
          <AddFoodDialog date={date} myFoods={myFoods} commonFoods={commonFoods} remoteSearch={remoteSearch} categories={categories} dietName={diet.name} recent={recent} frequent={frequent} favorites={favorites} />
        </div>
        <nav aria-label="Food tools" className="grid grid-cols-2 gap-2">
          {(
            [
              ["/nutrition/scanner", NUTRITION_SCORE_LABEL, ScanBarcode],
              [`/nutrition/photo?date=${date}`, "Meal photo", Camera],
              ["/nutrition/recipes", "Recipes", CookingPot],
              ["/nutrition/saved-meals", "Saved meals", BookMarked],
              ["/nutrition/planner", "Meal planner", CalendarDays],
              ["/nutrition/grocery", "Grocery list", ShoppingCart],
              ["/nutrition/insights", "Insights", BarChart3],
              ["/nutrition/supplements", "Supplements", Pill],
            ] as const
          ).map(([href, text, Icon]) => (
            <Link key={href} href={href} className="flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-card px-3 text-[0.9375rem] font-medium hover:border-gold-muted">
              <Icon className="size-4 shrink-0 text-gold" aria-hidden />
              <span className="min-w-0 flex-1">{text}</span>
            </Link>
          ))}
        </nav>
      </div>

      <section aria-labelledby="budget-strip-title" className="rounded-2xl border border-gold-muted/60 bg-card-gradient p-4">
        <h2 id="budget-strip-title" className="text-sm font-semibold text-gold">
          Calories remaining
        </h2>
        {goals && remaining != null ? (
          <>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-1 text-center" data-testid="budget-equation">
              <div>
                <p className="font-display text-xl font-bold tabular-nums sm:text-2xl" data-testid="budget-goal">{goals.calories}</p>
                <p className="text-xs text-muted-foreground">Goal</p>
              </div>
              <span className="text-muted-foreground" aria-hidden>−</span>
              <div>
                <p className="font-display text-xl font-bold tabular-nums sm:text-2xl" data-testid="budget-food">{food}</p>
                <p className="text-xs text-muted-foreground">Food</p>
              </div>
              <span className="text-muted-foreground" aria-hidden>+</span>
              <div>
                <p className="font-display text-xl font-bold tabular-nums sm:text-2xl" data-testid="budget-exercise">{exercise}</p>
                <p className="text-xs text-muted-foreground">Exercise (est.)</p>
              </div>
              <span className="text-muted-foreground" aria-hidden>=</span>
              <div>
                <p className={`font-display text-xl font-bold tabular-nums sm:text-2xl ${remaining < 0 ? "text-[#f08a8a]" : "text-gold-highlight"}`} data-testid="budget-remaining">
                  {remaining}
                </p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </div>
            </div>
            <p className="sr-only">
              Goal {goals.calories} minus food {food} plus exercise {exercise} equals {remaining} calories remaining.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{goals.is_estimate ? "Goal is an estimate." : "Goal is your custom target."}</p>
            {ex ? (
              <div className="mt-2 text-xs text-muted-foreground" data-testid="exercise-breakdown">
                <p>
                  Exercise (estimate): workouts {ex.workouts}
                  {workouts.length ? ` (${workoutMins} min)` : ""} + runs and walks {ex.activities} + extra steps {ex.steps}.
                </p>
                <p className="mt-0.5">
                  {ex.baseline == null
                    ? "Steps aren't added until your daily activity level is set, because we can't tell which steps your budget already covers."
                    : `Your activity level already covers about ${ex.baseline.toLocaleString()} steps a day${ex.stepsFromActivities ? `, and about ${ex.stepsFromActivities.toLocaleString()} steps belong to the runs and walks counted above` : ""}; only steps beyond that add calories (${ex.extraSteps.toLocaleString()} of ${ex.stepCount.toLocaleString()} today), so nothing is counted twice.`}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Log your bodyweight to estimate exercise calories.</p>
            )}
            {projected != null && (
              <p className="mt-2 flex items-start gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-sm" data-testid="projection">
                <TrendingUp className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                <span>
                  If every day were like today, you&apos;d weigh about <span className="font-semibold">{formatWeight(projected, units)}</span> in 5 weeks.
                  <span className="block text-xs text-muted-foreground">An estimate from today&apos;s food and exercise, not a prediction.</span>
                </span>
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Set your daily targets below to see your calories remaining.</p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="nutrients-title">
          <div data-testid="nutrient-totals">
            <h2 id="nutrients-title" className="text-lg font-semibold">Nutrients</h2>
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
                    <dt className="text-xs text-muted-foreground">{l}</dt>
                    <dd className="font-semibold tabular-nums" data-testid={id}>
                      {t.count ? `${u === "mg" ? Math.round(t.total) : Math.round(t.total * 10) / 10} ${u}` : "—"}
                    </dd>
                    <dd className="text-xs text-muted-foreground">
                      {t.count === nutrients.items ? "all foods" : `from ${t.count} of ${nutrients.items} foods with data`}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          {goals && goals.calories - totals.calories > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">{Math.round(goals.calories - totals.calories)} kcal remaining for the day.</p>
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
        <DayMarkControls date={date} mark={dayMark} hasFood={food > 0} />
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
                      <EditableMealItem item={editableItem(i, type, favoriteKeys)} />
                      {isFavoritableKey(i.source) && (
                        <FavoriteStar
                          food={{ key: i.source, name: i.name, basis: sanitizeBasis(i.basis) ?? basisFromLegacyItem(i), isEstimate: i.is_estimate }}
                          initial={favoriteKeys.has(i.source)}
                        />
                      )}
                      <ActionButton
                        action={deleteMealItemAction}
                        fields={{ id: i.id }}
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove ${i.name}`}
                        confirmMessage={`Remove ${i.name} from ${title.toLowerCase()}?`}
                        confirmDetail="Your totals for the day update right away."
                        confirmLabel="Remove"
                      >
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
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">Daily average</dt>
              <dd className="font-display text-lg font-bold tabular-nums">{summary.daysLogged ? `${summary.average} kcal` : "—"}</dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-2">
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">Under goal</dt>
              <dd className="font-display text-lg font-bold tabular-nums">{goals ? `${summary.under} of ${summary.daysLogged}` : "—"}</dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-2">
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">Over goal</dt>
              <dd className="font-display text-lg font-bold tabular-nums">{goals ? `${summary.over} of ${summary.daysLogged}` : "—"}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Averages count only days with food logged ({summary.daysLogged} of the last 7).{" "}
            <Link href="/nutrition/insights" className="font-semibold text-gold-highlight underline">
              Full weekly insights
            </Link>
          </p>
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
                      <dt className="text-xs uppercase tracking-widest text-muted-foreground">{l}</dt>
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
            <Link href="/progress/overview#log-weight">Log weight</Link>
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
          <span className="text-sm font-semibold text-gold">Your diet</span>
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
            <BookMarked className="size-5 text-gold" aria-hidden /> Saved meals
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">Save any logged meal above with “Save as meal”, then log or plan it for any date.</p>
          <Link href="/nutrition/saved-meals" className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-elevated/40 px-3 py-2 text-[0.9375rem] hover:border-gold-muted">
            <span>
              {templates.length ? `${templates.length} saved ${templates.length === 1 ? "meal" : "meals"}` : "No saved meals yet"}
            </span>
            <ChevronRight className="size-4 text-gold" aria-hidden />
          </Link>
          <Link href="/nutrition/recipes" className="mt-2 flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-elevated/40 px-3 py-2 text-[0.9375rem] hover:border-gold-muted">
            <span>Recipes: build from ingredients with servings</span>
            <ChevronRight className="size-4 text-gold" aria-hidden />
          </Link>
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
                  <ActionButton action={deleteCustomFoodAction} fields={{ id: f.id }} size="icon-sm" variant="ghost" aria-label={`Delete ${f.name}`} confirmMessage={`Delete ${f.name} from My foods?`} confirmDetail="Entries you already logged stay in your diary." confirmLabel="Delete">
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
