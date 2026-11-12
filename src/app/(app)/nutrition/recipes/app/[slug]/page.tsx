import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { NutrientTable } from "@/components/nutrition/nutrient-table";
import { NutritionLocked, nutritionPageUser } from "@/components/nutrition/nutrition-page";
import { SourceBadge } from "@/components/nutrition/source-badge";
import { Badge } from "@/components/ui/badge";
import { appRecipeView } from "@/server/services/recipes";

export const metadata = { title: "Recipe" };

const SLOT_NAMES = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snack: "a snack" } as const;

export default async function AppRecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { allowed } = await nutritionPageUser("meal_planning");
  if (!allowed) return <NutritionLocked title="Recipe" description="Recipes and the meal planner are included with Pro All Access." />;
  const r = await appRecipeView(slug);
  if (!r) notFound();
  return (
    <div className="space-y-6">
      <BackLink href="/nutrition/recipes">Recipes</BackLink>
      <PageHeader eyebrow="Simple recipe from the app" title={r.name} description={`Makes ${r.servings} serving${r.servings === 1 ? "" : "s"}. Good for ${r.slots.map((s) => SLOT_NAMES[s]).join(", ")}.`} />
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">App-made</Badge> Written for this app, not by a dietitian. Nutrition comes from USDA FoodData Central for the amounts listed; your ingredients and portions will vary.
      </p>
      <section aria-labelledby="nutrition-title" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="nutrition-title" className="mb-2 text-lg font-semibold">
          Nutrition
        </h2>
        <NutrientTable totals={r.totals} perServing={r.perServing} servings={r.servings} />
      </section>
      <section aria-labelledby="ingredients-title" className="space-y-2">
        <h2 id="ingredients-title" className="text-lg font-semibold">
          Ingredients
        </h2>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {r.ingredients.map((i) => (
            <li key={`${i.source}-${i.unitId}`} className="px-4 py-2.5 text-[0.9375rem]">
              <span className="font-semibold">{i.name}</span> <SourceBadge source={i.source} isEstimate={false} />
              <span className="block text-sm text-muted-foreground">{i.amountLabel}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="steps-title" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="steps-title" className="mb-2 text-lg font-semibold">
          Steps
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-[0.9375rem]">
          {r.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>
      <p className="text-sm text-muted-foreground">
        The <Link href="/nutrition/planner" className="font-semibold text-gold-highlight underline">meal planner</Link> uses these recipes alongside your own; log them from your plan.
      </p>
    </div>
  );
}
