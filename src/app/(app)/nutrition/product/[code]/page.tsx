import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { AddProductToDiary, CompareWith, ExplainProduct, ProductImage } from "@/components/nutrition/quality-client";
import { AllergensSection, AlternativesList, FilterResults, Indicators, IngredientsSection, NutritionTable } from "@/components/nutrition/quality-sections";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isoDateInTz } from "@/lib/domain/dates";
import type { FoodChoice } from "@/lib/domain/food-basis";
import { mealForTime } from "@/lib/domain/meal-time";
import { hasFeature } from "@/lib/domain/plans";
import { checkFilters, OFF_DATA_NOTICE, pickAlternatives, sanitizeFilters, tagLabel } from "@/lib/food-quality";
import { basisFromOffProduct, OFF_ATTRIBUTION } from "@/lib/open-food-facts";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";
import { getAiAllowance } from "@/server/services/ai-coach";
import { getQualityProduct, searchCategory, type QualityLookup } from "@/server/services/food-quality";
import { logError } from "@/server/log";

export const metadata = { title: "Product details" };

export default async function ProductQualityPage({ params }: { params: Promise<{ code: string }> }) {
  const { user, profile } = await requireOnboardedUser();
  const { code: raw } = await params;
  const code = decodeURIComponent(raw).replace(/\D/g, "").slice(0, 14);
  const back = <BackLink href="/nutrition/scanner">Food Quality Scanner</BackLink>;

  if (!rateLimit(`quality:${user.id}`, 40, 60_000).ok) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        {back}
        <Notice tone="warning">Too many product lookups in a minute. Wait a moment and try again.</Notice>
      </div>
    );
  }
  let found: QualityLookup | null = null;
  let failed = false;
  try {
    found = await getQualityProduct(code);
  } catch (err) {
    logError("food_quality.product", err);
    failed = true;
  }
  if (!found) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        {back}
        <PageHeader eyebrow="Food Quality Scanner" title={failed ? "Couldn't look that up" : "Product not found"} />
        {failed ? (
          <Notice tone="error">Open Food Facts isn&apos;t responding right now. Try again in a moment.</Notice>
        ) : (
          <Notice>
            Barcode {code || raw} isn&apos;t in Open Food Facts yet, so there&apos;s nothing to show, and nothing is guessed. You can log it yourself from the food diary using the label.
          </Notice>
        )}
        <Link href="/nutrition" className="text-sm font-semibold text-gold-highlight underline">
          Go to the food diary
        </Link>
      </div>
    );
  }

  const p = found.quality;
  const plan = await getUserPlan(user.id);
  const plus = hasFeature(plan, "food_comparisons");
  const ai = (await getAiAllowance(user.id, plan)).chatLimit > 0;
  const supabase = await getServerSupabase();
  const filters = plus ? sanitizeFilters((await supabase.from("profiles").select("food_filters").eq("id", user.id).maybeSingle()).data?.food_filters) : null;
  const filterResults = filters ? checkFilters(p, filters) : [];
  const search = await searchCategory(p.category);
  const alternatives = search.status === "ok" ? pickAlternatives(p, search.candidates, filters) : [];

  const today = isoDateInTz(new Date(), profile.timezone);
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: profile.timezone || "UTC" }).format(new Date()));
  const choice: FoodChoice | null = found.diary
    ? {
        key: `off:${found.diary.code}`,
        kind: "off",
        ref: found.diary.code,
        name: found.diary.name,
        detail: [found.diary.brand, found.diary.quantity, `barcode ${found.diary.code}`].filter(Boolean).join(" · "),
        basis: basisFromOffProduct(found.diary),
        note: `${OFF_ATTRIBUTION}.`,
      }
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5" data-testid="quality-product">
      {back}
      <div className="flex items-start gap-4">
        {p.imageUrl && <ProductImage src={p.imageUrl} alt={`Package of ${p.name}`} />}
        <PageHeader eyebrow={[p.brand, p.quantity].filter(Boolean).join(" · ") || "Product"} title={p.name} description={`Barcode ${p.code}${p.category ? ` · ${tagLabel(p.category)}` : ""}`} />
      </div>

      {choice ? (
        <AddProductToDiary choice={choice} date={today} defaultMeal={mealForTime(new Date(2000, 0, 1, hour))} />
      ) : (
        <Notice>This product has no nutrition values in Open Food Facts, so it can&apos;t be added with exact numbers. Log it from the label in the food diary.</Notice>
      )}
      {p.incomplete.length > 0 && (
        <Notice tone="warning">Open Food Facts lists this product&apos;s {p.incomplete.join(", ")} as incomplete. What&apos;s shown may be missing details: check the package.</Notice>
      )}

      {plus ? (
        <Card data-testid="your-filters">
          <CardHeader>
            <CardTitle className="text-base">Your filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <FilterResults results={filterResults} />
            <Link href="/nutrition/scanner#my-filters" className="text-sm text-gold-highlight underline">
              Edit my filters
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Indicators p={p} />
      <NutritionTable p={p} />
      <IngredientsSection p={p} />
      <AllergensSection p={p} />

      <section aria-labelledby="alternatives-title" className="space-y-2">
        <h2 id="alternatives-title" className="font-display text-lg">
          Comparable alternatives
        </h2>
        {alternatives.length ? (
          <AlternativesList base={p} items={alternatives} canCompare={plus} />
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="no-alternatives">
            {search.status === "busy" || search.status === "unavailable"
              ? "Alternatives can't be loaded right now. Try again in a minute."
              : search.status === "no_category"
                ? "This product has no category in Open Food Facts, so comparable products can't be found."
                : "No clearly better product in the same category was found in Open Food Facts."}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Alternatives are real products from the same Open Food Facts category, suggested only when they score better on Nutri-Score or processing, or on several nutrients. Prices aren&apos;t compared.</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compare with another product</CardTitle>
        </CardHeader>
        <CardContent>{plus ? <CompareWith base={p.code} /> : <p className="text-sm text-muted-foreground">Side-by-side product comparisons and personal filters are included with Plus and Pro.</p>}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">For your goals</CardTitle>
        </CardHeader>
        <CardContent>{ai ? <ExplainProduct code={p.code} /> : <p className="text-sm text-muted-foreground">An AI explanation of this product for your goals and targets is included with Pro.</p>}</CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {OFF_DATA_NOTICE}{" "}
        <a href={`https://world.openfoodfacts.org/product/${p.code}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
          View or improve this product on Open Food Facts <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>
    </div>
  );
}
