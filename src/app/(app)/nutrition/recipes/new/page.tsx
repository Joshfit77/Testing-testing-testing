import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { NutritionLocked, nutritionPageUser } from "@/components/nutrition/nutrition-page";
import type { MyFood } from "@/components/nutrition/nutrition-client";
import { RecipeEditor } from "@/components/nutrition/recipe-editor";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "New recipe" };

const MY_FOOD_COLUMNS = "id, name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, is_estimate, source";

export default async function NewRecipePage() {
  const { user, allowed } = await nutritionPageUser();
  if (!allowed) return <NutritionLocked title="New recipe" description="Build recipes from the food database, see per-serving nutrition and log a serving to your diary." />;
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("foods").select(MY_FOOD_COLUMNS).eq("owner_id", user.id).order("name");
  return (
    <div className="space-y-6">
      <BackLink href="/nutrition/recipes">Recipes</BackLink>
      <PageHeader eyebrow="Recipes" title="New recipe" description="Add each ingredient with the amount used in the whole recipe, then say how many servings it makes." />
      <RecipeEditor myFoods={(data ?? []) as MyFood[]} />
    </div>
  );
}
