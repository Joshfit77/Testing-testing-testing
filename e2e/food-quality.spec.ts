import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";
import { Q } from "./off-mock";

/**
 * Food Quality Scanner against the shared Open Food Facts mock (e2e/off-mock.ts). Needs the app started with
 * OFF_API_BASE_URL pointing at E2E_OFF_MOCK_PORT. Real products, images and the live API aren't reachable here.
 */
const OFF_PORT = Number(process.env.E2E_OFF_MOCK_PORT ?? 0);

async function typeBarcode(page: Page, code: string) {
  await page.getByRole("button", { name: "Type the barcode instead" }).click();
  await page.getByLabel("Barcode number").fill(code);
  await page.getByRole("button", { name: "Look up" }).click();
  await page.waitForURL(new RegExp(`/nutrition/product/${code}`));
}

test.describe("Food Quality Scanner", () => {
  test.skip(!OFF_PORT, "Set E2E_OFF_MOCK_PORT and start the app with OFF_API_BASE_URL pointing at it.");

  test("Free: scan, full facts with unavailable values, indicators explained, ingredients, allergens, alternatives, add to diary", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("quality-free"));
    await completeOnboarding(page);
    await page.goto("/nutrition");
    await page.getByRole("navigation", { name: "Food tools" }).getByRole("link", { name: "Food quality" }).click();
    await expect(page.getByRole("heading", { name: "Food Quality Scanner", level: 1 })).toBeVisible();
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
    const additives = page.getByTestId("additives");
    await expect(additives).toContainText("E322 Lecithins");
    await expect(additives).toContainText("E951 Aspartame");
    await expect(additives).toContainText("phenylketonuria");
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
    await expect(product).toContainText("An AI explanation of this product for your goals and targets is included with Pro.");
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
});
