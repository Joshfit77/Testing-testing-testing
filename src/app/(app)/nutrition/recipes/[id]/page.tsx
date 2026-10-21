import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { NutrientTable } from "@/components/nutrition/nutrient-table";
import { NutritionLocked, nutritionPageUser } from "@/components/nutrition/nutrition-page";
import { RecipeLogForm } from "@/components/nutrition/recipe-log-form";
import { SourceBadge } from "@/components/nutrition/source-badge";
import { Button } from "@/components/ui/button";
import { isoDateInTz } from "@/lib/domain/dates";
import { ingredientNutrition } from "@/lib/domain/recipes";
import { getServerSupabase } from "@/lib/supabase/server";
import { deleteRecipeAction } from "@/server/actions/recipes";
import { loadRecipe } from "@/server/services/recipes";

export const metadata = { title: "Recipe" };

export default async function RecipePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { user, profile, allowed } = await nutritionPageUser();
  if (!allowed) return <NutritionLocked title="Recipe" description="Recipes are included with Plus and Pro." />;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await getServerSupabase();
  const recipe = await loadRecipe(supabase, user.id, id);
  if (!recipe) notFound();
  const today = isoDateInTz(new Date(), profile.timezone);

  return (
    <div className="space-y-6">
      <BackLink href="/nutrition/recipes">Recipes</BackLink>
      <PageHeader
        eyebrow="Recipe"
        title={recipe.name}
        description={`Makes ${recipe.servings} ${recipe.servings === 1 ? "serving" : "servings"} · ${recipe.ingredients.length} ${recipe.ingredients.length === 1 ? "ingredient" : "ingredients"}`}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={`/nutrition/recipes/${recipe.id}/edit`}>
                <Pencil aria-hidden /> Edit
              </Link>
            </Button>
            <ActionButton
              action={deleteRecipeAction}
              fields={{ id: recipe.id }}
              variant="ghost"
              navigateTo="/nutrition/recipes"
              confirmMessage={`Delete the recipe “${recipe.name}”?`}
              confirmDetail="Servings you already logged stay in your diary with the values they had."
              confirmLabel="Delete"
            >
              <Trash2 aria-hidden /> Delete
            </ActionButton>
          </>
        }
      />
      {sp.saved && <Notice tone="success">Recipe saved.</Notice>}

      <section aria-labelledby="log-title" className="rounded-2xl border border-gold-muted/60 bg-card-gradient p-4">
        <h2 id="log-title" className="mb-3 text-lg font-semibold">
          Log a serving
        </h2>
        {recipe.ingredients.length ? (
          <RecipeLogForm recipeId={recipe.id} perServing={recipe.perServing} today={today} />
        ) : (
          <p className="text-sm text-muted-foreground">Add ingredients before logging this recipe.</p>
        )}
      </section>

      <section aria-labelledby="nutrition-title" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="nutrition-title" className="mb-2 text-lg font-semibold">
          Nutrition
        </h2>
        <NutrientTable totals={recipe.totals} perServing={recipe.perServing} servings={recipe.servings} />
        {recipe.anyEstimate && <p className="mt-2 text-sm text-gold">Includes estimated values (marked “Estimate” below).</p>}
      </section>

      <section aria-labelledby="ingredients-title" className="space-y-2">
        <h2 id="ingredients-title" className="text-lg font-semibold">
          Ingredients
        </h2>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {recipe.ingredients.map((i) => {
            const n = ingredientNutrition(i);
            return (
              <li key={i.id} className="px-4 py-2.5">
                <p className="text-[0.9375rem] font-semibold">
                  {i.name} <SourceBadge source={i.source} isEstimate={i.isEstimate} />
                </p>
                <p className="text-sm text-muted-foreground">
                  {i.amountLabel}
                  {n ? ` · ${n.calories} kcal · P ${n.protein_g ?? "—"} g · C ${n.carbs_g ?? "—"} g · F ${n.fat_g ?? "—"} g` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {recipe.notes && (
        <section aria-labelledby="notes-title" className="rounded-2xl border border-border bg-card p-4">
          <h2 id="notes-title" className="mb-1 text-lg font-semibold">
            Notes
          </h2>
          <p className="whitespace-pre-line text-[0.9375rem] text-muted-foreground">{recipe.notes}</p>
        </section>
      )}
    </div>
  );
}
