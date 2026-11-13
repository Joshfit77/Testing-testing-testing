import Link from "next/link";
import { ChevronLeft, ChevronRight, Snowflake } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { GenerateGroceryForm } from "@/components/nutrition/grocery-client";
import { FoodToolsNav, NutritionLocked, nutritionPageUser } from "@/components/nutrition/nutrition-page";
import { PrepShare } from "@/components/nutrition/prep-share";
import { addDays, isoDateInTz, isValidIsoDate } from "@/lib/domain/dates";
import { FRIDGE_MAX_DAYS, parseFreezeParam, prepDayLabel, prepPlanText, servingsText, toggleFreeze, type PrepBatch, type PrepPlan } from "@/lib/domain/meal-prep";
import { formatNutrient, NUTRIENT_INFO } from "@/lib/domain/recipes";
import { getServerSupabase } from "@/lib/supabase/server";
import { logError } from "@/server/log";
import { loadCurrentPlan } from "@/server/services/meal-plan";
import { loadPrepPlan } from "@/server/services/meal-prep";

export const metadata = { title: "Prep plan" };

const COLD_STORAGE_CHART = "https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts";

function prepHref(week: string, freeze: readonly string[]) {
  const q = new URLSearchParams({ week });
  if (freeze.length) q.set("freeze", freeze.join(","));
  return `/nutrition/planner/prep?${q.toString()}`;
}

const range = (from: string, to: string) => (from === to ? prepDayLabel(from) : `${prepDayLabel(from)} – ${prepDayLabel(to)}`);
const recipeHref = (key: string) => (key.startsWith("app:") ? `/nutrition/recipes/app/${key.slice(4)}` : `/nutrition/recipes/${key.slice(7)}`);
const MACRO_MISSING = (keys: string[]) => keys.map((k) => NUTRIENT_INFO[k as keyof typeof NUTRIENT_INFO]?.label.toLowerCase() ?? k).join(", ");

export default async function PrepPage({ searchParams }: { searchParams: Promise<{ week?: string; freeze?: string | string[] }> }) {
  const { user, profile, allowed } = await nutritionPageUser("meal_planning");
  if (!allowed) return <NutritionLocked title="Prep plan" description="Batch the recipes in your meal plan into prep sessions, with scaled ingredient amounts for each cook." />;
  const sp = await searchParams;
  const supabase = await getServerSupabase();
  const today = isoDateInTz(new Date(), profile.timezone);
  let week = isValidIsoDate(sp.week) ? sp.week : null;
  if (!week) {
    const current = await loadCurrentPlan(supabase, user.id, today).catch((err) => {
      logError("prep.current_plan", err);
      return null;
    });
    week = current?.start_date ?? today;
  }
  const freeze = parseFreezeParam(sp.freeze);
  let plan: PrepPlan | null = null;
  try {
    plan = await loadPrepPlan(supabase, user.id, { weekStart: week, today, freeze });
  } catch (err) {
    logError("prep.page", err);
  }

  return (
    <div className="space-y-6">
      <BackLink href="/nutrition/planner">Meal planner</BackLink>
      <PageHeader eyebrow="Food" title="Prep plan" description="The recipes in your meal plan grouped into batches, with prep days so cooked food is eaten within a few days." />
      <FoodToolsNav current="/nutrition/planner" />

      <nav aria-label="Prep week" className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-2">
        <Link href={prepHref(addDays(week, -7), [])} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden /> Earlier
        </Link>
        <p className="text-center text-[0.9375rem] font-semibold" data-testid="prep-week">
          {range(week, addDays(week, 6))}
        </p>
        <Link href={prepHref(addDays(week, 7), [])} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm text-muted-foreground hover:text-foreground">
          Later <ChevronRight className="size-4" aria-hidden />
        </Link>
      </nav>

      <Notice tone="info">
        Each prep session covers meals up to {FRIDGE_MAX_DAYS} days after cooking: cooked leftovers keep 3–4 days in the refrigerator (40&nbsp;°F / 4&nbsp;°C or below), and
        the freezer is for longer. This is general food-safety guidance from FoodSafety.gov&apos;s{" "}
        <a href={COLD_STORAGE_CHART} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
          Cold Food Storage Chart
        </a>
        ; follow your recipe and package directions, and when in doubt, throw it out.
      </Notice>

      {!plan ? (
        <Notice tone="error">The prep plan couldn&apos;t be loaded right now. Refresh the page to try again.</Notice>
      ) : (
        <PrepContent plan={plan} week={week} freeze={freeze} today={today} />
      )}
    </div>
  );
}

function PrepContent({ plan, week, freeze, today }: { plan: PrepPlan; week: string; freeze: string[]; today: string }) {
  const skipped = plan.skipped.logged + plan.skipped.past;
  const skippedNote = skipped ? (
    <p className="text-sm text-muted-foreground" data-testid="prep-skipped">
      {[plan.skipped.past ? `${plan.skipped.past} meal${plan.skipped.past === 1 ? "" : "s"} earlier than today` : "", plan.skipped.logged ? `${plan.skipped.logged} already logged` : ""].filter(Boolean).join(" and ")}{" "}
      {skipped === 1 ? "isn't" : "aren't"} included.
    </p>
  ) : null;

  if (!plan.batches.length && !plan.notBatched.length) {
    return (
      <section className="space-y-2 rounded-2xl border border-border bg-card p-4" data-testid="prep-empty">
        <h2 className="text-lg font-semibold">Nothing to prep this week</h2>
        <p className="text-[0.9375rem] text-muted-foreground">
          There are no planned meals left in these dates.{" "}
          <Link href="/nutrition/planner" className="font-semibold text-gold-highlight underline">
            Make or open a plan
          </Link>{" "}
          to get a prep plan for it.
        </p>
        {skippedNote}
      </section>
    );
  }

  const groceryFrom = week < today ? today : week;
  return (
    <>
      {skippedNote}
      {plan.sessions.length > 0 && (
        <section aria-labelledby="sessions-title" className="space-y-3">
          <h2 id="sessions-title" className="text-lg font-semibold">
            Prep sessions
          </h2>
          <ol className="space-y-3">
            {plan.sessions.map((s) => (
              <li key={s.index} className="rounded-2xl border border-gold-muted/60 bg-card-gradient p-4" data-testid="prep-session">
                <p className="text-sm font-semibold text-gold">{s.prepDate === today ? "Today" : prepDayLabel(s.prepDate)}</p>
                <h3 className="text-[1.0625rem] font-semibold">Prep for {range(s.from, s.to)}</h3>
                <ul className="mt-2 space-y-1 text-[0.9375rem]">
                  {s.cooks.map((c) => (
                    <li key={c.key} className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span>{c.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {servingsText(c.servings)}
                        {c.freezerServings ? ` · freeze ${c.freezerServings}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}

      {plan.batches.length > 0 && (
        <section aria-labelledby="batches-title" className="space-y-3">
          <h2 id="batches-title" className="text-lg font-semibold">
            Batches
          </h2>
          {plan.batches.map((b) => (
            <BatchCard key={b.key} batch={b} week={week} freeze={freeze} today={today} />
          ))}
        </section>
      )}

      {plan.notBatched.length > 0 && (
        <section aria-labelledby="loose-title" className="rounded-2xl border border-border bg-card p-4" data-testid="prep-not-batched">
          <h2 id="loose-title" className="text-lg font-semibold">
            Not batched
          </h2>
          <p className="mb-2 text-sm text-muted-foreground">Saved meals are put together from foods rather than cooked from a recipe, so there&apos;s no batch to prep. Their items are on the grocery list.</p>
          <ul className="divide-y divide-border">
            {plan.notBatched.map((n) => (
              <li key={n.key} className="py-2">
                <p className="text-[0.9375rem] font-semibold">
                  {n.name} <span className="font-normal text-muted-foreground">· {servingsText(n.servings)}</span>
                </p>
                <p className="text-sm text-muted-foreground">{n.meals.map((m) => `${prepDayLabel(m.date)} ${m.label.toLowerCase()}`).join(" · ")}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="shop-title" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="shop-title" className="mb-1 text-lg font-semibold">
          Shopping
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Build the{" "}
          <Link href="/nutrition/grocery" className="font-semibold text-gold-highlight underline">
            grocery list
          </Link>{" "}
          for these dates: every planned meal&apos;s ingredients, combined. It replaces the items from your plan and keeps the ones you added.
        </p>
        <GenerateGroceryForm defaultFrom={groceryFrom} defaultTo={plan.weekEnd} />
      </section>

      <section aria-labelledby="share-title" className="rounded-2xl border border-border bg-card p-4 print:border-0">
        <h2 id="share-title" className="mb-2 text-lg font-semibold">
          Share or print
        </h2>
        <PrepShare text={prepPlanText(plan)} />
      </section>
    </>
  );
}

function BatchCard({ batch: b, week, freeze, today }: { batch: PrepBatch; week: string; freeze: string[]; today: string }) {
  const kcal = b.perServing ? formatNutrient(b.perServing.calories, "calories") : null;
  const protein = b.perServing ? formatNutrient(b.perServing.protein_g, "protein_g") : null;
  const anyNoData = b.cooks.some((c) => c.ingredients.some((i) => i.data !== "complete"));
  return (
    <article className="rounded-2xl border border-border bg-card" data-testid="prep-batch" aria-labelledby={`batch-${b.key}`}>
      <div className="space-y-1 p-4">
        <h3 id={`batch-${b.key}`} className="text-[1.0625rem] font-semibold">
          {b.missingRecipe ? (
            b.name
          ) : (
            <Link href={recipeHref(b.key)} className="underline-offset-4 hover:underline">
              {b.name}
            </Link>
          )}
        </h3>
        <p className="text-[0.9375rem] tabular-nums">
          <span className="font-semibold" data-testid="prep-batch-servings">
            {servingsText(b.totalServings)}
          </span>{" "}
          <span className="text-muted-foreground">
            for {b.meals.length} meal{b.meals.length === 1 ? "" : "s"}
            {b.recipeServings ? ` · the recipe makes ${b.recipeServings}` : ""}
          </span>
        </p>
        {kcal && (
          <p className="text-sm text-muted-foreground">
            Per serving: {kcal} · protein {protein}
          </p>
        )}
        <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Meals in this batch">
          {b.meals.map((m) => (
            <li key={m.entryId} className="rounded-full border border-border bg-elevated px-2.5 py-1 text-xs">
              {prepDayLabel(m.date)} · {m.label} · {servingsText(m.portion)}
              {m.storage === "freezer" && (
                <>
                  <Snowflake className="ml-1 inline size-3 text-gold" aria-hidden />
                  <span className="sr-only"> (from the freezer)</span>
                </>
              )}
            </li>
          ))}
        </ul>
        {b.missingRecipe && <Notice tone="warning">This recipe was deleted or isn&apos;t available any more, so its ingredient amounts can&apos;t be shown. Swap these meals in the planner.</Notice>}
      </div>

      {b.cooks.map((c) => (
        <div key={c.sessionIndex} className="border-t border-border p-4" data-testid="prep-cook">
          <p className="text-[0.9375rem] font-semibold">
            Cook {c.prepDate === today ? "today" : `on ${prepDayLabel(c.prepDate)}`}: <span data-testid="prep-cook-servings">{servingsText(c.servings)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            For {range(c.meals[0]!.date, c.meals[c.meals.length - 1]!.date)}
            {c.freezerServings > 0 && ` · freeze ${servingsText(c.freezerServings)} on prep day for the meals more than ${FRIDGE_MAX_DAYS} days out, and thaw them in the refrigerator the day before`}
          </p>
          {c.ingredients.length > 0 && (
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-elevated" data-testid="prep-ingredients">
              {c.ingredients.map((i, idx) => (
                <li key={idx} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">{i.name}</span>
                  <span className="font-semibold tabular-nums">{i.amountLabel}</span>
                  {i.data === "none" && <span className="w-full text-xs text-gold">No nutrition data for this ingredient; its amount is scaled from the recipe as written.</span>}
                  {i.data === "partial" && <span className="w-full text-xs text-gold">Its source doesn&apos;t list {MACRO_MISSING(i.missing)}.</span>}
                </li>
              ))}
            </ul>
          )}
          {c.totals && (
            <p className="mt-2 text-sm text-muted-foreground">
              This cook: {formatNutrient(c.totals.calories, "calories")} · protein {formatNutrient(c.totals.protein_g, "protein_g")}
            </p>
          )}
        </div>
      ))}

      {anyNoData && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Totals marked &ldquo;at least&rdquo; leave out ingredients without data; nothing is estimated.</p>}

      {(b.canFreeze || b.frozen) && (
        <div className="border-t border-border p-2">
          <Link
            href={prepHref(week, toggleFreeze(freeze, b.key))}
            scroll={false}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-gold-highlight hover:underline"
            data-testid="prep-freeze-toggle"
          >
            <Snowflake className="size-4" aria-hidden />
            {b.frozen ? "Cook fresh in more than one session instead" : "Cook once and freeze portions"}
          </Link>
        </div>
      )}
    </article>
  );
}
