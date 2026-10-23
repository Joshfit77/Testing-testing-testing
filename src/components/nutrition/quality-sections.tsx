import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleHelp, Info, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SmallScore } from "@/components/nutrition/food-iq-sections";
import type { FoodIqScore } from "@/lib/food-iq";
import {
  addedSugarIngredients,
  allergenLabel,
  COMPARE_ROWS,
  describeAdditive,
  LEVELS_INFO,
  NOVA_INFO,
  NUTRI_SCORE_INFO,
  nutrientLevels,
  percentOfReference,
  tagLabel,
  thresholdsMet,
  type FilterResult,
  type Grade,
  type Level,
  type Nutrients,
  type QualityProduct,
} from "@/lib/food-quality";
import { cn } from "@/lib/utils";

const GRADE_STYLE: Record<Grade, string> = {
  a: "bg-[#1f7a4d] text-white",
  b: "bg-[#5aa846] text-white",
  c: "bg-[#d6b13c] text-black",
  d: "bg-[#d9772f] text-black",
  e: "bg-[#c6452c] text-white",
};
const LEVEL_STYLE: Record<Level, string> = { low: "text-[#5fc49a]", medium: "text-gold", high: "text-[#f08a8a]" };

export function Unavailable() {
  return <span className="text-muted-foreground">Not available</span>;
}

function Explain({ what, limits }: { what: string; limits: string }) {
  return (
    <details className="mt-2 text-sm text-muted-foreground">
      <summary className="cursor-pointer text-gold-highlight">What this means and its limits</summary>
      <p className="mt-1">{what}</p>
      <p className="mt-1">{limits}</p>
    </details>
  );
}

export function Indicators({ p }: { p: QualityProduct }) {
  const levels = nutrientLevels(p.per100, p.unit);
  const met = thresholdsMet(p.per100, p.unit);
  return (
    <section aria-labelledby="indicators-title" className="space-y-3" data-testid="quality-indicators">
      <h2 id="indicators-title" className="font-display text-lg">
        Quality indicators
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4" data-testid="nutri-score">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Nutri-Score</p>
          {p.nutriScore.grade ? (
            <p className="mt-1 flex items-center gap-2">
              <span className={cn("inline-flex size-9 items-center justify-center rounded-lg font-display text-xl font-bold", GRADE_STYLE[p.nutriScore.grade])} aria-hidden>
                {p.nutriScore.grade.toUpperCase()}
              </span>
              <span className="font-semibold">Grade {p.nutriScore.grade.toUpperCase()}</span>
            </p>
          ) : (
            <p className="mt-1 font-semibold">{p.nutriScore.status === "not_applicable" ? "Not applicable to this kind of product" : "Not available"}</p>
          )}
          <Explain {...NUTRI_SCORE_INFO} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4" data-testid="nova">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Processing (NOVA)</p>
          {p.nova ? (
            <p className="mt-1">
              <span className="font-semibold">Group {p.nova}</span> <span className="text-sm text-muted-foreground">· {NOVA_INFO.groups[p.nova]}</span>
            </p>
          ) : (
            <p className="mt-1 font-semibold">Not available</p>
          )}
          <Explain what={NOVA_INFO.what} limits={NOVA_INFO.limits} />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4" data-testid="nutrient-levels">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Levels per 100 {p.unit}</p>
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {levels.map((l) => (
            <li key={l.key} className="rounded-xl bg-elevated/60 p-2 text-sm">
              <span className="block text-xs text-muted-foreground">{l.label}</span>
              {l.level ? (
                <span>
                  <span className={cn("font-semibold capitalize", LEVEL_STYLE[l.level])}>{l.level}</span> <span className="text-muted-foreground">({l.value} g)</span>
                </span>
              ) : (
                <Unavailable />
              )}
            </li>
          ))}
        </ul>
        {met.length > 0 && (
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">Meets the EU threshold for:</span> {met.join(" · ")}
          </p>
        )}
        <Explain
          what={`${LEVELS_INFO.what} Low is at most ${levels.map((l) => `${l.thresholds[0]} g ${l.label.toLowerCase()}`).join(", ")}; high is above ${levels.map((l) => `${l.thresholds[1]} g`).join(", ")} respectively. "Meets the EU threshold" uses the EU nutrition-claim rules (Regulation 1924/2006); it doesn't mean the maker makes that claim.`}
          limits={LEVELS_INFO.limits}
        />
      </div>
    </section>
  );
}

const ROWS: { key: keyof Nutrients; label: string; unit: string; indent?: boolean }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbohydrates", unit: "g" },
  { key: "sugars_g", label: "of which sugars", unit: "g", indent: true },
  { key: "added_sugars_g", label: "of which added sugars", unit: "g", indent: true },
  { key: "fat_g", label: "Total fat", unit: "g" },
  { key: "sat_fat_g", label: "of which saturated", unit: "g", indent: true },
  { key: "fiber_g", label: "Fibre", unit: "g" },
  { key: "sodium_mg", label: "Sodium", unit: "mg" },
  { key: "salt_g", label: "Salt", unit: "g" },
];

export function NutritionTable({ p }: { p: QualityProduct }) {
  const servingHeader = p.servingLabel ?? (p.servingQuantity ? `${p.servingQuantity} ${p.unit}` : null);
  return (
    <section aria-labelledby="nutrition-title" className="rounded-2xl border border-border bg-card p-4" data-testid="quality-nutrition">
      <h2 id="nutrition-title" className="font-display text-lg">
        Nutrition facts
      </h2>
      <p className="text-sm text-muted-foreground">Serving size: {servingHeader ?? "Not available"}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="py-1.5 font-medium">
                Nutrient
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Per serving
              </th>
              <th scope="col" className="py-1.5 pl-3 text-right font-medium">
                % RI
              </th>
              <th scope="col" className="py-1.5 pl-3 text-right font-medium">
                Per 100 {p.unit}
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const s = p.perServing?.[r.key] ?? null;
              const h = p.per100[r.key];
              const ri = percentOfReference(r.key, s);
              return (
                <tr key={r.key} className="border-b border-border/60" data-testid={`row-${r.key}`}>
                  <th scope="row" className={cn("py-1.5 text-left font-normal", r.indent && "pl-4 text-muted-foreground")}>
                    {r.label}
                  </th>
                  <td className="py-1.5 text-right tabular-nums">{s == null ? <Unavailable /> : `${s} ${r.unit}`}</td>
                  <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">{ri == null ? "—" : `${ri}%`}</td>
                  <td className="py-1.5 pl-3 text-right tabular-nums">{h == null ? <Unavailable /> : `${h} ${r.unit}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        % RI: share of the EU reference intake for an average adult (2,000 kcal) in one serving. &quot;Not available&quot; means the value isn&apos;t in the product data; it isn&apos;t zero.
      </p>
    </section>
  );
}

export function IngredientsSection({ p }: { p: QualityProduct }) {
  const sugars = addedSugarIngredients(p.ingredientsText);
  return (
    <section aria-labelledby="ingredients-title" className="space-y-3 rounded-2xl border border-border bg-card p-4" data-testid="quality-ingredients">
      <h2 id="ingredients-title" className="font-display text-lg">
        Ingredients
      </h2>
      {p.ingredientsText ? (
        <>
          <p className="text-sm">{p.ingredientsText}</p>
          {p.ingredientsLang && <p className="text-xs text-muted-foreground">Shown as printed (language: {p.ingredientsLang.toUpperCase()}). The checks below look for English words, so they may miss some.</p>}
          <div className="text-sm" data-testid="added-sugars">
            <span className="font-semibold">Forms of sugar named in the ingredients: </span>
            {sugars.length ? sugars.join(", ") : "none found in the text"}
            {p.per100.added_sugars_g != null && <span className="text-muted-foreground"> · added sugars on the label: {p.per100.added_sugars_g} g per 100 {p.unit}</span>}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">The ingredient list isn&apos;t in the product data yet. Check the package.</p>
      )}
      {p.additives.length > 0 && (
        <p className="text-sm">
          <span className="font-semibold">Additives: </span>
          {p.additives.map((code) => describeAdditive(code)).map((a) => `${a.code} ${a.name}`).join(", ")}
          <span className="text-muted-foreground"> · what each is for and what the evidence says is under &quot;Ingredients worth knowing about&quot;.</span>
        </p>
      )}
    </section>
  );
}

export function AllergensSection({ p }: { p: QualityProduct }) {
  const noData = p.allergens.length === 0 && p.traces.length === 0 && !p.ingredientsText;
  const diet = (v: QualityProduct["vegan"], word: string) =>
    v === "yes" ? `Looks ${word} from its ingredients` : v === "no" ? `Not ${word} (from its ingredients)` : v === "maybe" ? `Possibly not ${word}: some ingredients are unclear` : `Can't tell if it's ${word}`;
  return (
    <section aria-labelledby="allergens-title" className="space-y-2 rounded-2xl border border-border bg-card p-4" data-testid="quality-allergens">
      <h2 id="allergens-title" className="font-display text-lg">
        Allergens and diet
      </h2>
      <p className="text-sm">
        <span className="font-semibold">Contains: </span>
        {p.allergens.length ? p.allergens.map(allergenLabel).join(", ") : noData ? "no information" : "none declared in the data"}
      </p>
      <p className="text-sm">
        <span className="font-semibold">May contain: </span>
        {p.traces.length ? p.traces.map(allergenLabel).join(", ") : noData ? "no information" : "none declared in the data"}
      </p>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
        Allergen data comes from volunteers and may be incomplete. Missing information doesn&apos;t mean a product is free of an allergen; this app can&apos;t guarantee allergen safety. Always read the label.
      </p>
      <p className="text-sm">
        {diet(p.vegan, "vegan")} · {diet(p.vegetarian, "vegetarian")}
        {p.palmOil === "yes" ? " · Contains palm oil" : p.palmOil === "no" ? " · No palm oil" : ""}
      </p>
      {p.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Labels on the package">
          {p.labels.slice(0, 12).map((l) => (
            <Badge key={l} variant="secondary">
              {tagLabel(l)}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}

const STATUS_ICON = { conflict: XCircle, caution: AlertTriangle, unknown: CircleHelp, ok: CheckCircle2 } as const;
const STATUS_STYLE = { conflict: "text-[#f08a8a]", caution: "text-gold", unknown: "text-muted-foreground", ok: "text-[#5fc49a]" } as const;

export function FilterResults({ results }: { results: FilterResult[] }) {
  if (!results.length) return <p className="text-sm text-muted-foreground">No filters set yet.</p>;
  return (
    <ul className="space-y-1.5 text-sm" data-testid="filter-results">
      {results.map((r, i) => {
        const Icon = STATUS_ICON[r.status];
        return (
          <li key={i} className="flex items-start gap-2">
            <Icon className={cn("mt-0.5 size-4 shrink-0", STATUS_STYLE[r.status])} aria-hidden />
            <span>
              <span className="sr-only">{r.status === "conflict" ? "Doesn't match: " : r.status === "caution" ? "Caution: " : r.status === "unknown" ? "Unknown: " : "Matches: "}</span>
              {r.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AlternativesList({
  base,
  items,
  canCompare,
  scores,
}: {
  base: QualityProduct;
  items: { product: QualityProduct; reasons: string[]; sameCategory: string }[];
  canCompare: boolean;
  /** Food IQ ratings by barcode, when the rating is enabled. */
  scores?: Record<string, FoodIqScore>;
}) {
  return (
    <ul className="space-y-2" data-testid="alternatives">
      {items.map(({ product: a, reasons, sameCategory }) => (
        <li key={a.code} className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/nutrition/product/${a.code}`} className="font-semibold hover:underline">
                {a.name}
              </Link>
              <p className="text-xs text-muted-foreground">{[a.brand, a.quantity].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {scores?.[a.code] && <SmallScore score={scores[a.code]!} />}
              {a.nutriScore.grade && <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-bold", GRADE_STYLE[a.nutriScore.grade])}>{a.nutriScore.grade.toUpperCase()}</span>}
            </div>
          </div>
          <p className="mt-1 text-sm">
            <span className="text-muted-foreground">Why: </span>
            {reasons.join("; ")}. {sameCategory}
          </p>
          {canCompare && (
            <Link href={`/nutrition/compare?a=${base.code}&b=${a.code}`} className="mt-1 inline-block text-sm font-semibold text-gold-highlight underline">
              Compare side by side
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function CompareTable({ a, b, scores }: { a: QualityProduct; b: QualityProduct; scores?: [FoodIqScore, FoodIqScore] }) {
  const fmt = (v: number | null, unit: string) => (v == null ? "Not available" : `${v} ${unit}`);
  const better = (x: number | null, y: number | null, dir: "lower" | "higher" | null) => (x == null || y == null || dir == null || x === y ? null : (dir === "lower" ? x < y : x > y) ? "a" : "b");
  const ingredientsCount = (p: QualityProduct) => (p.ingredientsText ? p.ingredientsText.split(/,(?![^()]*\))/).filter((s) => s.trim()).length : null);
  return (
    <div className="overflow-x-auto" data-testid="compare-table">
      <table className="w-full min-w-[22rem] text-sm [&_td]:pr-3 [&_td]:align-top [&_th]:pr-3 [&_th]:align-top">
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="py-2 font-medium text-muted-foreground">
              Per 100 {a.unit}
            </th>
            <th scope="col" className="py-2 font-semibold">
              {a.name}
            </th>
            <th scope="col" className="py-2 font-semibold">
              {b.name}
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map((r) => {
            const win = better(a.per100[r.key], b.per100[r.key], r.better);
            return (
              <tr key={r.key} className="border-b border-border/60">
                <th scope="row" className="py-1.5 text-left font-normal">
                  {r.label}
                </th>
                {(["a", "b"] as const).map((side) => (
                  <td key={side} className={cn("py-1.5 tabular-nums", win === side && "font-semibold text-[#5fc49a]")}>
                    {fmt((side === "a" ? a : b).per100[r.key], r.unit)}
                    {win === side && <span className="sr-only"> (better)</span>}
                  </td>
                ))}
              </tr>
            );
          })}
          {scores && (
            <tr className="border-b border-border/60" data-testid="compare-food-iq">
              <th scope="row" className="py-1.5 text-left font-normal">
                Food IQ (experimental)
              </th>
              {scores.map((sc, i) => (
                <td key={i} className="py-1.5 tabular-nums">
                  {sc.status === "scored" ? `${sc.score}/100 · ${sc.band.label}` : sc.status === "insufficient" ? "Not enough data" : "Not rated"}
                </td>
              ))}
            </tr>
          )}
          <tr className="border-b border-border/60">
            <th scope="row" className="py-1.5 text-left font-normal">
              Nutri-Score
            </th>
            {[a, b].map((p) => (
              <td key={p.code} className="py-1.5">
                {p.nutriScore.grade ? p.nutriScore.grade.toUpperCase() : "Not available"}
              </td>
            ))}
          </tr>
          <tr className="border-b border-border/60">
            <th scope="row" className="py-1.5 text-left font-normal">
              NOVA group
            </th>
            {[a, b].map((p) => (
              <td key={p.code} className="py-1.5">
                {p.nova ?? "Not available"}
              </td>
            ))}
          </tr>
          <tr className="border-b border-border/60">
            <th scope="row" className="py-1.5 text-left font-normal">
              Ingredients
            </th>
            {[a, b].map((p) => (
              <td key={p.code} className="py-1.5">
                {ingredientsCount(p) == null ? "Not available" : `${ingredientsCount(p)} listed`}
              </td>
            ))}
          </tr>
          <tr className="border-b border-border/60">
            <th scope="row" className="py-1.5 text-left font-normal">
              Additives
            </th>
            {[a, b].map((p) => (
              <td key={p.code} className="py-1.5">
                {p.additives.length ? p.additives.map((x) => x.toUpperCase()).join(", ") : p.ingredientsText ? "None listed" : "Not available"}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="py-1.5 text-left font-normal">
              Allergens
            </th>
            {[a, b].map((p) => (
              <td key={p.code} className="py-1.5">
                {p.allergens.length ? p.allergens.map(allergenLabel).join(", ") : "None declared"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Green marks the lower sugar, salt or saturated fat and the higher protein or fibre. Calories, fat and carbs aren&apos;t marked: what&apos;s better depends on your goals.
      </p>
    </div>
  );
}
