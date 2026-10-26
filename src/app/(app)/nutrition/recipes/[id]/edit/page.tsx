import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { NutritionLocked, nutritionPageUser } from "@/components/nutrition/nutrition-page";
import type { MyFood } from "@/components/nutrition/nutrition-client";
import { RecipeEditor, type RecipeDraft } from "@/components/nutrition/recipe-editor";
import { getServerSupabase } from "@/lib/supabase/server";
import { loadRecipe } from "@/server/services/recipes";

export const metadata = { title: "Edit recipe" };

const MY_FOOD_COLUMNS = "id, name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, is_estimate, source";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, allowed } = await nutritionPageUser("meal_planning");
  if (!allowed) return <NutritionLocked title="Edit recipe" description="Recipes are included with Pro All Access." />;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await getServerSupabase();
  const [recipe, { data: foods }] = await Promise.all([loadRecipe(supabase, user.id, id), supabase.from("foods").select(MY_FOOD_COLUMNS).eq("owner_id", user.id).order("name")]);
  if (!recipe) notFound();
  const initial: RecipeDraft = {
    name: recipe.name,
    servings: String(recipe.servings),
    notes: recipe.notes ?? "",
    ingredients: recipe.ingredients.map((i) => {
      const sep = i.source.indexOf(":");
      return {
        uid: i.id,
        id: i.id,
        food: { key: i.source, kind: i.source.slice(0, sep) as "usda" | "off" | "food", ref: i.source.slice(sep + 1), name: i.name, basis: i.basis, isEstimate: i.isEstimate },
        quantity: i.quantity,
        unitId: i.unitId,
      };
    }),
  };
  return (
    <div className="space-y-6">
      <BackLink href={`/nutrition/recipes/${recipe.id}`}>{recipe.name}</BackLink>
      <PageHeader eyebrow="Recipes" title="Edit recipe" description="Ingredients you already added keep the nutrition saved with them; new ones are read fresh from their source." />
      <RecipeEditor recipeId={recipe.id} initial={initial} myFoods={(foods ?? []) as MyFood[]} />
    </div>
  );
}
