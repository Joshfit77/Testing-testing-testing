import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { FiltersEditor, QualityScanner } from "@/components/nutrition/quality-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasFeature } from "@/lib/domain/plans";
import { OFF_DATA_NOTICE, sanitizeFilters } from "@/lib/food-quality";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "Food Quality Scanner" };

export default async function FoodQualityScannerPage() {
  const { user } = await requireOnboardedUser();
  const plus = hasFeature(await getUserPlan(user.id), "food_comparisons");
  const filters = plus ? sanitizeFilters((await (await getServerSupabase()).from("profiles").select("food_filters").eq("id", user.id).maybeSingle()).data?.food_filters) : null;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <BackLink href="/nutrition">Food</BackLink>
      <PageHeader
        eyebrow="Food"
        title="Food Quality Scanner"
        description="Scan a product's barcode for its full nutrition, ingredients, additives, allergens, Nutri-Score and processing level, comparable alternatives, and a quick Add to Food Diary."
      />
      <Card>
        <CardContent className="pt-5">
          <QualityScanner />
        </CardContent>
      </Card>
      <Card id="my-filters" className="scroll-mt-4" data-testid="my-filters">
        <CardHeader>
          <CardTitle className="text-base">My product filters</CardTitle>
          <p className="text-sm text-muted-foreground">Flag allergens, vegan or vegetarian products and nutrition preferences on every product you scan.</p>
        </CardHeader>
        <CardContent>
          {filters ? (
            <FiltersEditor initial={filters} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Personal filters and side-by-side comparisons are included with Plus and Pro. Every product&apos;s declared allergens are shown on all plans.
            </p>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{OFF_DATA_NOTICE}</p>
    </div>
  );
}
