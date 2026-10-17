import Link from "next/link";
import { BookMarked, CalendarClock, ChevronLeft, ChevronRight, Lock, Salad, Trash2, UtensilsCrossed } from "lucide-react";
import { BarSeriesChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import {
  AddFoodDialog,
  CustomFoodForm,
  GoalsForm,
  LogTemplateForm,
  SaveMealForm,
  WaterCard,
  type MyFood,
} from "@/components/nutrition/nutrition-client";
import { Badge } from "@/components/ui/badge";
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
import { COMMON_FOODS } from "@/data/foods";
import { DIETS, fitsDiet, isDietType } from "@/lib/domain/diets";
import { MEAL_TYPES } from "@/lib/domain/meals";

export const metadata = { title: "Food" };

interface MealRow {
  id: string;
  meal_type: string;
  status: "logged" | "planned";
  name: string | null;
  meal_items: { id: string; name: string; servings: number; calories: number; protein_g: number; carbs_g: number; fat_g: number; is_estimate: boolean }[];
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
      </div>
    );
  }

  const today = isoDateInTz(new Date(), profile.timezone);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const supabase = await getServerSupabase();
  const [mealsRes, goalsRes, waterRes, foodsRes, templatesRes, plannedRes, history, flag, commonRes, dietRes] = await Promise.all([
    supabase
      .from("meals")
      .select("id, meal_type, status, name, meal_items(id, name, servings, calories, protein_g, carbs_g, fat_g, is_estimate)")
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
  ]);

  const meals = (mealsRes.data ?? []) as unknown as MealRow[];
  const logged = meals.filter((m) => m.status === "logged");
  const planned = meals.filter((m) => m.status === "planned");
  const totals = sumMacros(logged.flatMap((m) => m.meal_items.map((i) => ({ ...i, calories: Number(i.calories), protein_g: Number(i.protein_g), carbs_g: Number(i.carbs_g), fat_g: Number(i.fat_g) }))));
  const anyEstimate = logged.some((m) => m.meal_items.some((i) => i.is_estimate));
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
  const searchEnabled = isFoodSearchConfigured() && flag;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Food log" title="Food" description="Track what you eat. Search common foods, save your own, or enter anything by hand." actions={<AddFoodDialog date={date} myFoods={myFoods} commonFoods={commonFoods} searchEnabled={searchEnabled} dietName={diet.name} />} />

      <Link href="/nutrition/diets" className="lift flex items-center justify-between gap-3 rounded-2xl border border-gold-muted/60 bg-card-gradient p-4">
        <span>
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Your diet</span>
          <span className="mt-1 block font-display text-xl font-semibold uppercase">{diet.name}</span>
          <span className="block text-sm text-muted-foreground">{diet.eatingWindow ?? diet.tagline}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-gold-highlight">Change</span>
      </Link>

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
        <h2 id="meals-title" className="font-display text-2xl font-bold uppercase">
          Meals
        </h2>
        {logged.length === 0 && planned.length === 0 ? (
          <EmptyState icon={UtensilsCrossed} title="Nothing logged yet" description="Use “Add food” to search, pick a saved food, or enter values manually." />
        ) : (
          MEAL_TYPES.map(([type, title]) => {
            const ms = logged.filter((m) => m.meal_type === type);
            if (!ms.length) return null;
            const items = ms.flatMap((m) => m.meal_items);
            const mt = sumMacros(items.map((i) => ({ calories: Number(i.calories), protein_g: Number(i.protein_g) })));
            return (
              <div key={type} className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold uppercase">{title}</h3>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {Math.round(mt.calories)} kcal · {Math.round(mt.protein_g)}g protein
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {i.name} {i.is_estimate && <Badge variant="outline">estimate</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Number(i.servings) !== 1 && `${Number(i.servings)} × · `}
                          {Math.round(Number(i.calories))} kcal · P {Number(i.protein_g)} · C {Number(i.carbs_g)} · F {Number(i.fat_g)}
                        </p>
                      </div>
                      <ActionButton action={deleteMealItemAction} fields={{ id: i.id }} size="icon-sm" variant="ghost" aria-label={`Remove ${i.name}`}>
<Trash2 aria-hidden />
                      </ActionButton>
                    </li>
                  ))}
                </ul>
                {ms[0] && <div className="mt-3 border-t border-border pt-3"><SaveMealForm mealId={ms[0].id} defaultName={`${title} ${date}`} /></div>}
              </div>
            );
          })
        )}
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

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="targets-title">
        <h2 id="targets-title" className="mb-3 font-display text-xl font-bold uppercase">
          Daily targets
        </h2>
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
