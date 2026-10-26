import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { SmallScore } from "@/components/nutrition/food-iq-sections";
import { FiltersEditor, ProductImage, QualityScanner } from "@/components/nutrition/quality-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { hasFeature } from "@/lib/domain/plans";
import { foodIqScoreEnabled, NUTRITION_FEATURE_TITLE, NUTRITION_SCORE_LABEL, scoreFoodIq } from "@/lib/food-iq";
import { OFF_DATA_NOTICE, sanitizeFilters } from "@/lib/food-quality";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";
import { searchProducts, type ProductSearchResult } from "@/server/services/food-quality";
import { logError } from "@/server/log";

export const metadata = { title: NUTRITION_FEATURE_TITLE };

export default async function FoodIqPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user } = await requireOnboardedUser();
  const q = ((await searchParams).q ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const plus = hasFeature(await getUserPlan(user.id), "food_comparisons");
  const filters = plus ? sanitizeFilters((await (await getServerSupabase()).from("profiles").select("food_filters").eq("id", user.id).maybeSingle()).data?.food_filters) : null;
  const scoreOn = foodIqScoreEnabled();

  let results: ProductSearchResult | null = null;
  if (q) {
    if (!rateLimit(`food-iq-search:${user.id}`, 20, 60_000).ok) results = { status: "busy" };
    else {
      try {
        results = await searchProducts(q);
      } catch (err) {
        logError("food_iq.search", err);
        results = { status: "unavailable" };
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <BackLink href="/nutrition">Food</BackLink>
      <PageHeader
        eyebrow="Food"
        title={NUTRITION_FEATURE_TITLE}
        description="Scan or search a packaged food to see its nutritional quality, the ingredients worth knowing about, a protein, carb and fat breakdown, better alternatives, and how it fits your goals."
      />

      <Card className="border-gold-muted/60">
        <CardHeader>
          <CardTitle className="text-base">Scan a barcode</CardTitle>
          <p className="text-sm text-muted-foreground">Point your camera at the barcode, or type the number under it.</p>
        </CardHeader>
        <CardContent>
          <QualityScanner />
        </CardContent>
      </Card>

      <Card id="search" className="scroll-mt-4" data-testid="food-iq-search">
        <CardHeader>
          <CardTitle className="text-base">Search for a product</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action="/nutrition/scanner#search" method="get" className="flex gap-2" role="search">
            <label htmlFor="food-iq-q" className="sr-only">
              Product name or brand
            </label>
            <Input id="food-iq-q" name="q" defaultValue={q} placeholder="Product name or brand" maxLength={80} className="flex-1" />
            <Button type="submit" variant="secondary">
              <Search aria-hidden /> Search
            </Button>
          </form>
          {results?.status === "ok" &&
            (results.products.length ? (
              <ul className="space-y-2" data-testid="search-results" aria-label={`Results for ${q}`}>
                {results.products.map((p) => (
                  <li key={p.code}>
                    <Link href={`/nutrition/product/${p.code}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 hover:border-gold-muted">
                      {p.imageUrl ? <ProductImage src={p.imageUrl} alt="" small /> : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[p.brand, p.quantity].filter(Boolean).join(" · ") || `Barcode ${p.code}`}</span>
                      </span>
                      {scoreOn && <SmallScore score={scoreFoodIq(p)} />}
                      {p.nutriScore.grade && <span className="text-xs text-muted-foreground">Nutri-Score {p.nutriScore.grade.toUpperCase()}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="search-empty">
                No products found for &quot;{q}&quot; in Open Food Facts. Try fewer words, the brand, or scan the barcode.
              </p>
            ))}
          {results?.status === "busy" && <Notice tone="warning">Too many searches in the last minute. Wait a moment and try again.</Notice>}
          {results?.status === "unavailable" && <Notice tone="error">Open Food Facts isn&apos;t responding right now. Try again in a moment, or scan the barcode.</Notice>}
          {results?.status === "invalid" && <p className="text-sm text-muted-foreground">Type at least two letters.</p>}
        </CardContent>
      </Card>

      <section aria-labelledby="fiq-how" className="rounded-2xl border border-border bg-card p-4 text-sm">
        <h2 id="fiq-how" className="font-display text-base">
          What you&apos;ll see
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>{scoreOn ? `A ${NUTRITION_SCORE_LABEL} from 0 to 100 (experimental), with exactly how it was worked out.` : `Its strengths and what to watch, from published nutrition thresholds. (A ${NUTRITION_SCORE_LABEL} from 0 to 100 is being validated.)`}</li>
          <li>Ingredients worth knowing about, with what regulators and the evidence actually say.</li>
          <li>Protein, carbs, fat, sugar, fibre, salt and calories in plain words, per serving and per 100 g.</li>
          <li>Better products from the same category, Nutri-Score and NOVA, allergens, and Add to Food Diary.</li>
          <li>With Pro: how a serving fits your own targets, and Ask AI about this food.</li>
        </ul>
      </section>

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
              Personal filters and side-by-side comparisons are included with Pro All Access. Every product&apos;s declared allergens are shown on all plans.
            </p>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{OFF_DATA_NOTICE}</p>
    </div>
  );
}
