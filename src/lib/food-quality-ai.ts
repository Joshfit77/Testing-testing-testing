import { z } from "zod";
import { addedSugarIngredients, allergenLabel, describeAdditive, NOVA_INFO, NUTRIENT_KEYS, tagLabel, type Nutrients, type QualityProduct } from "./food-quality";

/** Pro: an AI explanation of a scanned product for the member's goals, from the known data only. */
export const productExplanationSchema = z.object({
  summary: z.string().describe("Two or three sentences on how this product fits the member's goals and targets."),
  fits: z.array(z.string()).describe("Ways it fits their goals, each tied to a number from the data."),
  watch_outs: z.array(z.string()).describe("Things to keep in mind for their goals, each tied to the data."),
  uncertainties: z.array(z.string()).describe("What's missing or uncertain in the data that affects this explanation."),
});
export type ProductExplanation = z.infer<typeof productExplanationSchema>;

export const PRODUCT_EXPLAIN_INSTRUCTIONS = `You explain a packaged food to a member of a fitness app in relation to their goals.

Rules:
- Use ONLY the product data and member details given. If a value is "not available", say it's unknown; never guess it.
- Tie every point to the numbers given (per serving or per 100 g/ml).
- Don't call a food healthy or unhealthy in general, and don't say an additive is harmful. Describe additives neutrally if at all.
- Don't give medical, allergy or weight-loss guarantees. Allergen data may be incomplete: tell them to check the label if allergens matter.
- Keep it short and practical (portion, timing around training, how it fits the day's targets).`;

const NUTRIENT_LABEL: Record<keyof Nutrients, string> = {
  calories: "energy (kcal)",
  protein_g: "protein (g)",
  carbs_g: "carbohydrates (g)",
  fat_g: "fat (g)",
  sat_fat_g: "saturated fat (g)",
  sugars_g: "sugars (g)",
  added_sugars_g: "added sugars (g)",
  fiber_g: "fibre (g)",
  sodium_mg: "sodium (mg)",
  salt_g: "salt (g)",
};

function nutrientLine(v: Nutrients): string {
  return NUTRIENT_KEYS.map((k) => `${NUTRIENT_LABEL[k]}: ${v[k] == null ? "not available" : v[k]}`).join("; ");
}

/** The product as plain facts for the model (no free text from the record beyond name, brand and ingredients). */
export function productFactsForAi(p: QualityProduct): string {
  const sugars = addedSugarIngredients(p.ingredientsText);
  return [
    `Product: ${p.name}${p.brand ? ` (${p.brand})` : ""}${p.quantity ? `, ${p.quantity}` : ""}. Category: ${p.category ? tagLabel(p.category) : "not available"}.`,
    `Per 100 ${p.unit}: ${nutrientLine(p.per100)}.`,
    p.perServing ? `Per serving (${p.servingLabel ?? `${p.servingQuantity} ${p.unit}`}): ${nutrientLine(p.perServing)}.` : "Serving size: not available.",
    `Nutri-Score: ${p.nutriScore.grade ? p.nutriScore.grade.toUpperCase() : p.nutriScore.status === "not_applicable" ? "not applicable" : "not available"}. NOVA: ${p.nova ? `${p.nova} (${NOVA_INFO.groups[p.nova]})` : "not available"}.`,
    `Ingredients: ${p.ingredientsText ? p.ingredientsText.slice(0, 1200) : "not available"}.`,
    `Forms of sugar in the ingredient list: ${sugars.length ? sugars.join(", ") : p.ingredientsText ? "none named" : "unknown"}.`,
    `Additives: ${p.additives.length ? p.additives.map((a) => `${describeAdditive(a).code} ${describeAdditive(a).name}`).join(", ") : "none listed"}.`,
    `Declared allergens: ${p.allergens.length ? p.allergens.map(allergenLabel).join(", ") : "none listed"}. May contain: ${p.traces.length ? p.traces.map(allergenLabel).join(", ") : "none listed"}.`,
    `Vegan: ${p.vegan}. Vegetarian: ${p.vegetarian}.`,
    p.incomplete.length ? `Open Food Facts marks these parts as incomplete: ${p.incomplete.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
