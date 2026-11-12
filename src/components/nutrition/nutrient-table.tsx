import { NUTRIENT_INFO, NUTRIENT_KEYS, formatNutrient, isComplete, type NutrientTotals } from "@/lib/domain/recipes";

/**
 * Total and per-serving nutrition for a recipe. A nutrient that some ingredients don't list is shown as
 * "at least …", one that none list as "—"; missing values are never counted as zero.
 */
export function NutrientTable({ totals, perServing, servings, testId = "recipe-nutrition" }: { totals: NutrientTotals; perServing: NutrientTotals; servings: number; testId?: string }) {
  const gaps = NUTRIENT_KEYS.filter((k) => totals[k].total > 0 && !isComplete(totals[k]));
  return (
    <div data-testid={testId}>
      <table className="w-full text-[0.9375rem]">
        <thead>
          <tr className="text-left text-sm text-muted-foreground">
            <th scope="col" className="py-1.5 font-medium">
              Nutrient
            </th>
            <th scope="col" className="py-1.5 text-right font-medium">
              Per serving
            </th>
            <th scope="col" className="py-1.5 text-right font-medium">
              Whole recipe ({servings} {servings === 1 ? "serving" : "servings"})
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {NUTRIENT_KEYS.map((k) => (
            <tr key={k}>
              <th scope="row" className="py-1.5 text-left font-medium">
                {NUTRIENT_INFO[k].label}
              </th>
              <td className="py-1.5 text-right tabular-nums" data-testid={`per-serving-${k}`}>
                {formatNutrient(perServing[k], k)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground" data-testid={`total-${k}`}>
                {formatNutrient(totals[k], k)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {gaps.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          “At least” means some ingredients have no value for that nutrient ({gaps.map((k) => `${NUTRIENT_INFO[k].label.toLowerCase()}: ${totals[k].known} of ${totals[k].total} with data`).join("; ")}). Missing values aren&apos;t counted as zero.
        </p>
      )}
    </div>
  );
}
