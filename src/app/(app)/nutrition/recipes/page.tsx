import Link from "next/link";
import { ChevronRight, CookingPot, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { FoodToolsNav, NutritionLocked, nutritionPageUser } from "@/components/nutrition/nutrition-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNutrient } from "@/lib/domain/recipes";
import { getServerSupabase } from "@/lib/supabase/server";
import { logError } from "@/server/log";
import { appRecipeViews, loadRecipes, type RecipeView } from "@/server/services/recipes";

export const metadata = { title: "Recipes" };

export default async function RecipesPage() {
  const { user, allowed } = await nutritionPageUser();
  if (!allowed) return <NutritionLocked title="Recipes" description="Build recipes from the food database, see per-serving nutrition and log a serving to your diary." />;
  const supabase = await getServerSupabase();
  let recipes: RecipeView[] = [];
  let loadFailed = false;
  try {
    recipes = await loadRecipes(supabase, user.id);
  } catch (err) {
    logError("recipes.page", err);
    loadFailed = true;
  }
  const app = await appRecipeViews();

  return (
    <div className="space-y-6">
      <BackLink href="/nutrition">Food</BackLink>
      <PageHeader
        eyebrow="Food"
        title="Recipes"
        description="Build a recipe from foods in the food database, set how many servings it makes, and log a serving (or part of one) to your diary."
        actions={
          <Button asChild>
            <Link href="/nutrition/recipes/new">
              <Plus aria-hidden /> New recipe
            </Link>
          </Button>
        }
      />
      <FoodToolsNav current="/nutrition/recipes" />

      <section aria-labelledby="my-recipes-title" className="space-y-3">
        <h2 id="my-recipes-title" className="text-lg font-semibold">
          Your recipes
        </h2>
        {loadFailed ? (
          <Notice tone="error">Your recipes couldn&apos;t be loaded right now. Refresh the page to try again.</Notice>
        ) : recipes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-[0.9375rem] text-muted-foreground">
            No recipes yet. Tap <span className="font-semibold text-foreground">New recipe</span> to add ingredients and servings.
          </p>
        ) : (
          <ul className="space-y-2">
            {recipes.map((r) => (
              <li key={r.id}>
                <Link href={`/nutrition/recipes/${r.id}`} className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-gold-muted">
                  <CookingPot className="size-5 shrink-0 text-gold" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{r.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {formatNutrient(r.perServing.calories, "calories")} · {formatNutrient(r.perServing.protein_g, "protein_g")} protein per serving · makes {r.servings}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="app-recipes-title" className="space-y-3">
        <div>
          <h2 id="app-recipes-title" className="text-lg font-semibold">
            Simple recipes from the app
          </h2>
          <p className="text-sm text-muted-foreground">
            Everyday meals we wrote for the meal planner, with nutrition from USDA FoodData Central. Not reviewed by a dietitian; values are estimates for the amounts listed.
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {app.map((r) => (
            <li key={r.slug}>
              <Link href={`/nutrition/recipes/app/${r.slug}`} className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-gold-muted">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {r.name} <Badge variant="secondary">App-made</Badge>
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {formatNutrient(r.perServing.calories, "calories")} · {formatNutrient(r.perServing.protein_g, "protein_g")} protein
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
