import Link from "next/link";
import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { FoodToolsNav, NutritionLocked, nutritionPageUser } from "@/components/nutrition/nutrition-page";
import { GeneratePlanForm, PlanDays, PlannerSettingsForm, type PlanDayView } from "@/components/nutrition/planner-client";
import { Button } from "@/components/ui/button";
import { isoDateInTz } from "@/lib/domain/dates";
import { DIETS } from "@/lib/domain/diets";
import { dayFit, eligibleCandidates, exclusionReason, slotsForMeals } from "@/lib/domain/meal-planner";
import { getServerSupabase } from "@/lib/supabase/server";
import { deletePlanAction } from "@/server/actions/meal-plan";
import { logError } from "@/server/log";
import { loadCurrentPlan, loadPlannerPrefs, loadPlannerTargets, plannerSettings, planDays } from "@/server/services/meal-plan";
import { plannerDishes } from "@/server/services/recipes";

export const metadata = { title: "Meal planner" };

const dayTitle = (iso: string, today: string) =>
  `${iso === today ? "Today · " : ""}${new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}`;

export default async function PlannerPage() {
  const { user, profile, allowed } = await nutritionPageUser("meal_planning");
  if (!allowed) return <NutritionLocked title="Meal planner" description="Plan a week of meals around your calorie and macro targets, diet, allergies and budget, then build a grocery list." />;
  const supabase = await getServerSupabase();
  const today = isoDateInTz(new Date(), profile.timezone);
  let failed = false;
  const [prefs, targets, plan] = await Promise.all([loadPlannerPrefs(supabase, user.id), loadPlannerTargets(supabase, user.id), loadCurrentPlan(supabase, user.id, today)]).catch((err) => {
    logError("planner.page", err);
    failed = true;
    return [null, null, null] as const;
  });
  if (failed || !prefs) {
    return (
      <div className="space-y-6">
        <BackLink href="/nutrition">Food</BackLink>
        <PageHeader eyebrow="Food" title="Meal planner" />
        <Notice tone="error">The planner couldn&apos;t be loaded right now. Refresh the page to try again.</Notice>
      </div>
    );
  }
  const dishes = targets ? await plannerDishes(supabase, user.id, prefs.includeApp) : [];
  const settings = targets ? plannerSettings(targets, prefs) : null;
  const eligible = settings ? eligibleCandidates(dishes, settings) : [];
  const excluded = settings ? dishes.map((d) => exclusionReason(d, settings)).filter(Boolean).length : 0;

  const days: PlanDayView[] = plan
    ? planDays(plan).map((d) => {
        const specs = slotsForMeals(plan.settings.mealsPerDay);
        return {
          date: d.date,
          title: dayTitle(d.date, today),
          fit: dayFit(d.meals, plan.targets.calories),
          meals: d.entries.map((e, i) => ({
            label: e?.label ?? specs[i]?.label ?? "Meal",
            meal: e
              ? {
                  entryId: e.id,
                  label: e.label,
                  name: e.name,
                  href: e.source_key.startsWith("recipe:") ? `/nutrition/recipes/${e.source_key.slice(7)}` : e.source_key.startsWith("app:") ? `/nutrition/recipes/app/${e.source_key.slice(4)}` : "/nutrition/saved-meals",
                  origin: e.source_key.startsWith("app:") ? "app" : e.source_key.startsWith("recipe:") ? "recipe" : "saved_meal",
                  portion: Number(e.portion),
                  nutrition: d.meals[i]!.nutrition,
                  complete: d.meals[i]!.complete,
                  logged: Boolean(e.logged_at),
                }
              : null,
          })),
        };
      })
    : [];

  return (
    <div className="space-y-6">
      <BackLink href="/nutrition">Food</BackLink>
      <PageHeader eyebrow="Food" title="Meal planner" description="A week of meals from your recipes and saved meals (and the app's simple recipes), sized to your calorie and macro targets." />
      <FoodToolsNav current="/nutrition/planner" />

      <Notice tone="info">
        The plan is an estimate. Portions are rounded to quarter servings and nutrition comes from the ingredients&apos; database and label values, so real meals will differ. It isn&apos;t medical or dietetic advice.
      </Notice>

      {!targets ? (
        <Notice tone="warning">
          Set your daily calorie and macro targets on the{" "}
          <Link href="/nutrition#targets-title" className="font-semibold underline">
            Food screen
          </Link>{" "}
          first; the planner builds around them.
        </Notice>
      ) : (
        <section aria-labelledby="targets-title" className="rounded-2xl border border-border bg-card p-4">
          <h2 id="targets-title" className="text-lg font-semibold">
            Planning for
          </h2>
          <p className="mt-1 text-[0.9375rem] tabular-nums">
            {targets.calories.toLocaleString()} kcal · protein {targets.protein_g} g · carbs {targets.carbs_g} g · fat {targets.fat_g} g
          </p>
          <p className="text-sm text-muted-foreground">
            {targets.origin === "custom" ? "Your custom targets" : "Your estimated calorie budget"} · {DIETS[targets.diet].name} diet (
            <Link href="/nutrition/diets" className="underline">
              change
            </Link>
            ) · {prefs.mealsPerDay} meals a day · {prefs.budget} budget
          </p>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="planner-pool">
            {eligible.length} of {dishes.length} dishes fit your settings{excluded ? ` (${excluded} left out by diet, allergies, dislikes or budget)` : ""}.
          </p>
        </section>
      )}

      {targets && (
        <section aria-labelledby="generate-title" className="rounded-2xl border border-gold-muted/60 bg-card-gradient p-4">
          <h2 id="generate-title" className="mb-3 text-lg font-semibold">
            {plan ? "Plan another week" : "Make a plan"}
          </h2>
          <GeneratePlanForm defaultStart={today} hasPlan={Boolean(plan)} />
          <p className="mt-2 text-sm text-muted-foreground">Generating for a start date that already has a plan replaces it. Meals you already logged stay in your diary.</p>
        </section>
      )}

      {plan && (
        <section aria-labelledby="plan-title" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="plan-title" className="text-lg font-semibold">
              Week of {dayTitle(plan.start_date, "").trim()}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/nutrition/grocery">Grocery list</Link>
              </Button>
              <ActionButton
                action={deletePlanAction}
                fields={{ id: plan.id }}
                size="sm"
                variant="ghost"
                confirmMessage="Delete this meal plan?"
                confirmDetail="Meals you already logged stay in your diary."
                confirmLabel="Delete"
              >
                <Trash2 aria-hidden /> Delete plan
              </ActionButton>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Planned meals aren&apos;t in your diary until you tap <span className="font-semibold text-foreground">Log this meal</span>. Built for {plan.targets.calories.toLocaleString()} kcal a day.
          </p>
          <PlanDays days={days} target={plan.targets} />
        </section>
      )}

      <section aria-labelledby="settings-title" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="settings-title" className="mb-3 text-lg font-semibold">
          Planner settings
        </h2>
        <PlannerSettingsForm prefs={prefs} />
      </section>
    </div>
  );
}
