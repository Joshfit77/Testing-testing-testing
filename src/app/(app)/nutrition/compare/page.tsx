import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { PlanLocked } from "@/components/common/plan-locked";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { CompareWith } from "@/components/nutrition/quality-client";
import { CompareTable } from "@/components/nutrition/quality-sections";
import { hasFeature } from "@/lib/domain/plans";
import { foodIqScoreEnabled, scoreFoodIq } from "@/lib/food-iq";
import { comparable, OFF_DATA_NOTICE } from "@/lib/food-quality";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { getQualityProduct } from "@/server/services/food-quality";
import { logError } from "@/server/log";

export const metadata = { title: "Compare products" };

const clean = (v: string | undefined) => (v ?? "").replace(/\D/g, "").slice(0, 14);

export default async function CompareProductsPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { user } = await requireOnboardedUser();
  const sp = await searchParams;
  const a = clean(sp.a);
  const b = clean(sp.b);
  if (!hasFeature(await getUserPlan(user.id), "food_comparisons")) {
    return (
      <PlanLocked
        back={{ href: a ? `/nutrition/product/${a}` : "/nutrition/scanner", label: "Back" }}
        eyebrow="Narrow Gate Food IQ"
        title="Compare products"
        plan="Plus"
        description="Compare two products side by side: calories, protein, sugar, fibre, sodium, saturated fat, ingredients, additives and quality indicators."
      />
    );
  }
  const back = <BackLink href={a ? `/nutrition/product/${a}` : "/nutrition/scanner"}>Back to the product</BackLink>;
  if (!a) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        {back}
        <Notice>Scan or open a product first, then choose &ldquo;Compare with another product&rdquo;.</Notice>
      </div>
    );
  }
  let pa = null;
  let pb = null;
  try {
    [pa, pb] = await Promise.all([getQualityProduct(a), b ? getQualityProduct(b) : Promise.resolve(null)]);
  } catch (err) {
    logError("food_quality.compare", err);
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        {back}
        <Notice tone="error">Open Food Facts isn&apos;t responding right now. Try again in a moment.</Notice>
      </div>
    );
  }
  if (!pa) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        {back}
        <Notice>The first product isn&apos;t in Open Food Facts.</Notice>
      </div>
    );
  }
  const cmp = pb ? comparable(pa.quality, pb.quality) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {back}
      <PageHeader eyebrow="Narrow Gate Food IQ" title="Compare products" description={pb ? `${pa.quality.name} and ${pb.quality.name}, per 100 ${pa.quality.unit}.` : `Choose a product to compare with ${pa.quality.name}.`} />
      {b && !pb && <Notice>Barcode {b} isn&apos;t in Open Food Facts. Try another product.</Notice>}
      {pb && cmp ? (
        <>
          <Notice tone={cmp.ok ? "info" : "warning"}>{cmp.reason}</Notice>
          <CompareTable a={pa.quality} b={pb.quality} scores={foodIqScoreEnabled() ? [scoreFoodIq(pa.quality), scoreFoodIq(pb.quality)] : undefined} />
          <p className="text-sm">
            <Link href={`/nutrition/product/${pb.quality.code}`} className="text-gold-highlight underline">
              Open {pb.quality.name}
            </Link>
          </p>
        </>
      ) : (
        <CompareWith base={a} />
      )}
      <p className="text-xs text-muted-foreground">{OFF_DATA_NOTICE}</p>
    </div>
  );
}
