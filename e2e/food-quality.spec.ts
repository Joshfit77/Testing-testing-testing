import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";
import { Q } from "./off-mock";

/**
 * Narrow Gate Food IQ against the shared Open Food Facts mock (e2e/off-mock.ts). Needs the app started with
 * OFF_API_BASE_URL pointing at E2E_OFF_MOCK_PORT. Real products, images and the live API aren't reachable here, so
 * every product below is a fictional fixture with typical values (mock data, not live Open Food Facts).
 * The experimental 0–100 rating is checked when the app runs with FOOD_IQ_SCORE=on (E2E_FOOD_IQ_SCORE=on here).
 */
const OFF_PORT = Number(process.env.E2E_OFF_MOCK_PORT ?? 0);
const SCORE_ON = process.env.E2E_FOOD_IQ_SCORE === "on";

async function typeBarcode(page: Page, code: string) {
  await page.getByRole("button", { name: "Type the barcode instead" }).click();
  await page.getByLabel("Barcode number").fill(code);
  await page.getByRole("button", { name: "Look up" }).click();
  await page.waitForURL(new RegExp(`/nutrition/product/${code}`));
}

test.describe("Narrow Gate Food IQ", () => {
  test.skip(!OFF_PORT, "Set E2E_OFF_MOCK_PORT and start the app with OFF_API_BASE_URL pointing at it.");

  test("Free: scan, full facts with unavailable values, indicators explained, ingredients, allergens, alternatives, add to diary", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("quality-free"));
    await completeOnboarding(page);
    await page.goto("/nutrition");
    // Prominent in Food (above the day's totals), honest about what it reads, and in the Food tools.
    await expect(page.getByTestId("food-iq-cta")).toContainText("Narrow Gate Nutrition Score");
    await expect(page.getByTestId("food-iq-cta")).toContainText("Scan a packaged food's barcode to review its nutrition and ingredients.");
    await expect(page.getByTestId("food-iq-cta")).toContainText("doesn't test the food itself");
    await expect(page.getByTestId("food-iq-cta").getByRole("link", { name: "Scan a product" })).toBeVisible();
    const ctaBox = (await page.getByTestId("food-iq-cta").boundingBox())!;
    const totalsBox = (await page.getByTestId("budget-equation").boundingBox())!;
    expect(ctaBox.y).toBeLessThan(totalsBox.y);
    await page.getByRole("navigation", { name: "Food tools" }).getByRole("link", { name: "Nutrition Score" }).click();
    await expect(page.getByRole("heading", { name: "Narrow Gate Nutrition Score", level: 1 })).toBeVisible();
    await expect(page.getByTestId("my-filters")).toContainText("included with Plus and Pro");
    await typeBarcode(page, Q.honey);

    const product = page.getByTestId("quality-product");
    await expect(product.getByRole("heading", { name: "Honey Crunch", level: 1 })).toBeVisible();
    await expect(product).toContainText("Barcode 5000000000012 · Breakfast cereals");
    await expect(page.getByTestId("nutri-score")).toContainText("Grade D");
    await expect(page.getByTestId("nova")).toContainText("Group 4 · Ultra-processed food and drink products");
    await page.getByTestId("nutri-score").getByText("What this means and its limits").click();
    await expect(page.getByTestId("nutri-score")).toContainText("doesn't account for portion size");
    const levels = page.getByTestId("nutrient-levels");
    await expect(levels).toContainText("Sugars");
    await expect(levels).toContainText("high (30 g)");
    await expect(levels).toContainText("Source of fibre");
    // Per serving (40 g) and per 100 g; a value Open Food Facts doesn't have is "Not available", not 0.
    await expect(page.getByTestId("row-sugars_g")).toContainText("12 g");
    await expect(page.getByTestId("row-sugars_g")).toContainText("30 g");
    await expect(page.getByTestId("row-added_sugars_g")).toContainText("Not available");
    await expect(page.getByTestId("row-sodium_mg")).toContainText("280 mg");
    await expect(page.getByTestId("added-sugars")).toContainText("glucose syrup, honey, sugar");
    // Ingredients worth knowing about: each additive with its evidence class; the label and the evidence kept apart.
    const additives = page.getByTestId("additives");
    await expect(additives.getByTestId("alert-e951")).toContainText("E951 Aspartame");
    await expect(additives.getByTestId("alert-e951")).toContainText("Established concern under specified conditions");
    await expect(additives.getByTestId("alert-e951")).toContainText("phenylketonuria");
    await expect(additives.getByTestId("alert-e322")).toContainText("No established concern at typical permitted uses");
    await expect(additives.getByTestId("alert-added_sugars")).toContainText("glucose syrup, honey, sugar");
    await expect(additives.getByTestId("alert-sodium_sources")).toContainText("salt");
    await expect(page.getByTestId("ingredient-alerts")).toContainText("A listed additive isn't a sign of harm");
    // The section sits right under the Food IQ summary, says what it reads, and opens its evidence by default.
    await expect(page.getByTestId("ingredient-alerts")).toContainText("not a test of the food");
    const alertsBox = (await page.getByTestId("ingredient-alerts").boundingBox())!;
    const summaryBox = (await page.getByTestId("food-iq-summary").boundingBox())!;
    const factsBox = (await page.getByTestId("row-sugars_g").boundingBox())!;
    expect(alertsBox.y).toBeGreaterThan(summaryBox.y);
    expect(alertsBox.y).toBeLessThan(factsBox.y);
    // Macro analysis: legal thresholds, UK guidance and informal comparisons are labelled differently.
    await expect(page.getByTestId("class-sugar_high")).toContainText("High in sugars");
    await expect(page.getByTestId("class-sugar_high")).toContainText("UK front-of-pack level");
    await expect(page.getByTestId("class-fibre_source")).toContainText("EU claim threshold");
    await expect(page.getByTestId("class-carbs_high")).toContainText("Comparison, not a legal term");
    // Summary at the top: strengths and what to watch (always), the experimental rating when switched on.
    const summary = page.getByTestId("food-iq-summary");
    await expect(summary.getByTestId("food-iq-points")).toContainText("High in sugars");
    if (SCORE_ON) {
      await expect(summary.getByTestId("food-iq-score")).toContainText("Poor");
      await expect(summary.getByTestId("food-iq-score")).toContainText("Rated Poor, mainly because of its sugars and calories. Its fibre helps a little.");
      await expect(summary.getByTestId("food-iq-experimental")).toContainText("Experimental · not yet reviewed");
      await expect(summary).toContainText("doesn't mean a 75% chance a food is healthy or safe");
      await page.getByTestId("food-iq-breakdown").getByText("How this rating was worked out").click();
      await expect(page.getByTestId("food-iq-breakdown")).toContainText("50 + 2.5 × positive points − 1.5 × points of concern");
      await expect(page.getByTestId("food-iq-breakdown")).toContainText("The fruit, vegetable and legume share isn't known");
    } else {
      await expect(summary.getByTestId("food-iq-pending")).toContainText("being validated");
    }
    // Fits your goals is Pro.
    await expect(page.getByTestId("fits-your-goals")).toContainText("Included with Pro");
    const allergens = page.getByTestId("quality-allergens");
    await expect(allergens).toContainText("Contains: Gluten (wheat, rye, barley, oats), Soy");
    await expect(allergens).toContainText("May contain: Tree nuts");
    await expect(allergens).toContainText("can't guarantee allergen safety");
    await expect(allergens).toContainText("Not vegan");

    // Real alternatives from the same category, with the reasons; the equally graded one isn't suggested.
    const alts = page.getByTestId("alternatives");
    await expect(alts.getByRole("listitem")).toHaveCount(2);
    await expect(alts).toContainText("Rice Flakes");
    await expect(alts).toContainText("Nutri-Score A instead of D");
    await expect(alts).toContainText("Oat Hoops");
    await expect(alts).toContainText("Less sugar: 12 g vs 30 g per 100 g");
    await expect(alts).not.toContainText("Choco Puffs");
    await expect(alts.getByRole("link", { name: "Compare side by side" })).toHaveCount(0);
    await expect(product).toContainText("Side-by-side product comparisons and personal filters are included with Plus and Pro.");
    await expect(product).toContainText("Asking the AI about a product (how it fits your goals, how it compares, how to fit it into a meal plan) is included with Pro.");
    await expect(product).toContainText("Open Database License");

    // Add to Food Diary: straight to the amount step with the label serving.
    await page.getByLabel("Meal", { exact: true }).selectOption("snack");
    await page.getByTestId("add-to-diary").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("amount-food-name")).toContainText("Honey Crunch");
    await dialog.getByRole("button", { name: "Add to diary" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Logged Honey Crunch" })).toBeVisible();
    await page.goto("/nutrition");
    await expect(page.getByTestId("meal-snack")).toContainText("Honey Crunch");

    // A product with no data says so, and a code Open Food Facts doesn't know isn't guessed.
    await page.goto(`/nutrition/product/${Q.mystery}`);
    await expect(page.getByTestId("row-calories")).toContainText("Not available");
    if (SCORE_ON) await expect(page.getByTestId("food-iq-no-score")).toContainText("Not enough data for a Nutrition Score: energy, sugars, saturated fat, salt, protein are missing. Nothing is guessed.");
    await expect(page.getByTestId("ingredient-alerts")).toContainText("Unknown: there's no ingredient list");
    await expect(page.getByTestId("quality-allergens")).toContainText("Contains: no information");
    await expect(page.getByTestId("nutri-score")).toContainText("Not available");
    await expect(page.getByText(/lists this product's ingredients, nutrition, categories as incomplete/)).toBeVisible();
    await page.goto("/nutrition/product/0000000000017");
    await expect(page.getByRole("heading", { name: "Product not found" })).toBeVisible();
  });

  test("Plus: personal filters, filtered alternatives and side-by-side comparisons", async ({ page }) => {
    const email = uniqueEmail("quality-plus");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "plus");
    await page.goto("/nutrition/scanner");
    const editor = page.getByTestId("filters-editor");
    await editor.getByLabel("Gluten (wheat, rye, barley, oats)").check();
    await editor.getByLabel("Diet").selectOption("vegan");
    await editor.getByLabel("Low sugars").check();
    await editor.getByRole("button", { name: "Save filters" }).click();
    await expect(editor.getByRole("status")).toHaveText("Filters saved.");

    await typeBarcode(page, Q.honey);
    const filters = page.getByTestId("filter-results");
    await expect(filters).toContainText("Contains gluten (wheat, rye, barley, oats) (declared).");
    await expect(filters).toContainText("Not vegan, based on its ingredients.");
    await expect(filters).toContainText("Not low in sugars (30 g per 100 g).");
    // Oat Hoops contains gluten, so only Rice Flakes is offered.
    const alts = page.getByTestId("alternatives");
    await expect(alts.getByRole("listitem")).toHaveCount(1);
    await expect(alts).toContainText("Rice Flakes");

    await alts.getByRole("link", { name: "Compare side by side" }).click();
    await page.waitForURL(/\/nutrition\/compare\?a=5000000000012&b=5000000000043/);
    await expect(page.getByText('Both are in "Breakfast cereals".')).toBeVisible();
    const table = page.getByTestId("compare-table");
    await expect(table).toContainText("Honey Crunch");
    await expect(table).toContainText("Rice Flakes");
    await expect(table.getByRole("row", { name: /Sugars/ })).toContainText("5 g (better)");
    // A long row label never runs into its value on a phone-width screen.
    const gap = await table.getByRole("row", { name: /Carbohydrates/ }).evaluate((tr: HTMLTableRowElement) => {
      const text = (el: Element) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return r.getBoundingClientRect();
      };
      return text(tr.cells[1]!).left - text(tr.cells[0]!).right;
    });
    expect(gap).toBeGreaterThanOrEqual(8);

    // A drink isn't a fair comparison with a cereal: the page says so.
    await page.goto(`/nutrition/compare?a=${Q.honey}`);
    await page.getByLabel("Second product's barcode").fill(Q.cola);
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await expect(page.getByText(/One is a drink and the other a food/)).toBeVisible();
  });

  test("Pro: Fits your goals and the AI box are shown", async ({ page }) => {
    const email = uniqueEmail("quality-pro");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "pro");
    await page.goto("/nutrition/scanner");
    await typeBarcode(page, Q.honey);
    await expect(page.getByTestId("fits-your-goals")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask AI about this food" })).toBeVisible();
  });

  test("search by name, and Food IQ across kinds of product: water, a sweetened drink, cured meat and protein bars", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("food-iq"));
    await completeOnboarding(page);
    await page.goto("/nutrition/scanner");
    const search = page.getByTestId("food-iq-search");
    await search.getByLabel("Product name or brand").fill("protein bar");
    await search.getByRole("button", { name: "Search" }).click();
    await page.waitForURL(/q=protein\+bar/);
    const results = page.getByTestId("search-results");
    await expect(results.getByRole("link")).toHaveCount(3);
    await expect(results).toContainText("Peak Protein Bar Chocolate");
    await expect(results).toContainText("Lean Protein Bar Vanilla");
    await search.getByLabel("Product name or brand").fill("zzzz nothing");
    await search.getByRole("button", { name: "Search" }).click();
    await expect(page.getByTestId("search-empty")).toContainText('No products found for "zzzz nothing"');

    await page.goto("/nutrition/scanner?q=peak+chocolate");
    await page.getByTestId("search-results").getByRole("link", { name: /Peak Protein Bar Chocolate/ }).click();
    await page.waitForURL(new RegExp(`/nutrition/product/${Q.bar}`));
    await expect(page.getByTestId("class-protein_high")).toContainText("This food provides a substantial amount of protein relative to its energy content");
    await expect(page.getByTestId("additives").getByTestId("alert-e965")).toContainText("Regulatory warning");
    await expect(page.getByTestId("additives").getByTestId("alert-e955")).toContainText("No established concern at typical permitted uses");
    if (SCORE_ON) {
      // Plenty of protein and fibre, but saturated fat holds it back: protein alone doesn't make it Good.
      await expect(page.getByTestId("food-iq-score")).toContainText("Moderate");
      await expect(page.getByTestId("alternatives")).toContainText("Lean Protein Bar Vanilla");
      await expect(page.getByTestId("alternatives")).toContainText(/Nutrition Score \d+ instead of \d+/);
    }

    await page.goto(`/nutrition/product/${Q.water}`);
    if (SCORE_ON) await expect(page.getByTestId("food-iq-score")).toContainText("Plain water: the reference drink, rated 100.");
    await page.goto(`/nutrition/product/${Q.zero}`);
    await expect(page.getByTestId("additives").getByTestId("alert-e150d")).toContainText("Evidence mixed or limited");
    await expect(page.getByTestId("additives").getByTestId("alert-e338")).toContainText("kidney");
    if (SCORE_ON) {
      await page.getByTestId("food-iq-breakdown").getByText("How this rating was worked out").click();
      await expect(page.getByTestId("food-iq-breakdown")).toContainText("Non-sugar sweeteners");
      await expect(page.getByTestId("food-iq-breakdown")).toContainText("80 + 2.5 × positive points − 2 × points of concern");
    }
    await page.goto(`/nutrition/product/${Q.ham}`);
    await expect(page.getByTestId("additives").getByTestId("alert-e250")).toContainText("Group 1");
    await expect(page.getByTestId("class-salt_high")).toContainText("High in salt");
  });
});
