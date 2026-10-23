import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";
import { BAR_CODE } from "./off-mock";

/**
 * MyFitnessPal-style food log: USDA search with exact amounts in oz / g / household measures, editing an
 * entry, browsing by food type, and a barcode (typed code) with the package's label serving.
 *
 * The barcode part needs the app server started with OFF_API_BASE_URL=http://127.0.0.1:<E2E_OFF_MOCK_PORT>
 * so Open Food Facts is answered by the shared local mock (e2e/off-mock.ts; the real API isn't reachable from tests).
 */
// Open Food Facts is answered by the shared mock in off-mock.ts, started by global-setup.ts.
const OFF_PORT = Number(process.env.E2E_OFF_MOCK_PORT ?? 0);

async function openAddFood(page: Page) {
  await page.getByRole("button", { name: "Add food" }).click();
  const dialog = page.getByRole("dialog");
  const searchTab = dialog.getByRole("tab", { name: "Search" });
  await searchTab.click();
  return dialog;
}

test.describe("food amounts (MyFitnessPal style)", () => {
  test("on the Free plan: search USDA foods, log ounces, edit to grams and another meal, browse by type, scan a barcode", async ({ page }) => {
    const email = uniqueEmail("amounts");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await page.goto("/nutrition");

    // Empty search: browse chips and popular foods.
    let dialog = await openAddFood(page);
    await expect(dialog.getByRole("region", { name: "Browse by type" }).getByRole("button", { name: "Poultry Products" })).toBeVisible();
    await expect(dialog.getByRole("region", { name: "Popular foods" }).getByRole("button").first()).toBeVisible();

    // Search and pick the USDA roasted chicken breast.
    await dialog.getByPlaceholder("e.g. chicken, banana, rice").fill("chicken breast");
    const db = dialog.getByRole("region", { name: "Food database" });
    await db.getByRole("button", { name: /^Chicken breast, cooked \(roasted\)/ }).click();
    await expect(dialog.getByTestId("amount-food-name")).toContainText("Chicken breast, cooked (roasted)");

    // Household measure + fractions: 3/4 cup chopped = 105 g → 173 kcal.
    await dialog.getByLabel("Unit", { exact: true }).selectOption({ label: "1 cup, chopped or diced — 140 g" });
    await dialog.getByLabel("Amount", { exact: true }).fill("3/4");
    await expect(dialog.getByTestId("amount-calories")).toHaveText("173");

    // 6 oz = 170 g → 281 kcal, 52.7 g protein.
    await dialog.getByLabel("Unit", { exact: true }).selectOption({ label: "oz" });
    await dialog.getByLabel("Amount", { exact: true }).fill("6");
    await expect(dialog.getByTestId("amount-calories")).toHaveText("281");
    await expect(dialog.getByTestId("amount-protein")).toHaveText("52.7 g");
    await expect(dialog.getByText("= 6 oz (170 g)")).toBeVisible();
    await dialog.getByLabel("Meal", { exact: true }).selectOption("lunch");
    await dialog.getByRole("button", { name: "Log food" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Logged Chicken breast, cooked (roasted) (6 oz (170 g)).");
    await page.keyboard.press("Escape");

    const lunch = page.getByTestId("meal-lunch");
    await expect(lunch.getByText("6 oz (170 g) · 281 kcal · P 52.7")).toBeVisible();
    await expect(page.getByTestId("budget-food")).toHaveText("281");
    await expect(page.getByTestId("nutrient-sodium")).toHaveText("126 mg");

    // Edit: switch to grams and move it to dinner.
    await lunch.getByRole("button", { name: "Edit Chicken breast, cooked (roasted)" }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Amount", { exact: true })).toHaveValue("6");
    await expect(dialog.getByLabel("Unit", { exact: true })).toHaveValue("oz");
    await dialog.getByLabel("Unit", { exact: true }).selectOption({ label: "g" });
    await dialog.getByLabel("Amount", { exact: true }).fill("200");
    await expect(dialog.getByTestId("amount-calories")).toHaveText("330");
    await dialog.getByLabel("Meal", { exact: true }).selectOption("dinner");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("meal-dinner").getByText("200 g · 330 kcal · P 62")).toBeVisible();
    await expect(page.getByTestId("meal-lunch").getByText("Chicken breast")).toHaveCount(0);
    await expect(page.getByTestId("budget-food")).toHaveText("330");

    // Browse a category, paginate and narrow it.
    dialog = await openAddFood(page);
    await dialog.getByRole("button", { name: "Fruits and Fruit Juices" }).click();
    const fruits = dialog.getByRole("region", { name: "Fruits and Fruit Juices" });
    await expect(fruits.getByText(/USDA · \d+ foods/)).toBeVisible();
    await expect(fruits.getByRole("button", { name: /^Abiyuch, raw/ })).toBeVisible();
    await expect(fruits.locator("li")).toHaveCount(40);
    await fruits.getByRole("button", { name: /Show more/ }).click();
    await expect(fruits.locator("li")).toHaveCount(80);
    await dialog.getByPlaceholder("Search Fruits and Fruit Juices").fill("apple");
    await fruits.getByRole("button", { name: /^Apples, raw, with skin/ }).first().click();
    await expect(dialog.getByTestId("amount-food-name")).toContainText("Apples, raw, with skin");
    await dialog.getByRole("button", { name: "Back to results" }).click();
    await expect(dialog.getByRole("button", { name: "All types" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Barcode (typed code) → amount step with the package's label serving.
    test.skip(!OFF_PORT, "Set E2E_OFF_MOCK_PORT and start the app with OFF_API_BASE_URL pointing at it to run the barcode part.");
    dialog = await openAddFood(page);
    await dialog.getByRole("tab", { name: "Scan" }).click();
    await dialog.getByRole("button", { name: "Type the barcode instead" }).click();
    await dialog.getByLabel("Barcode number").fill("0000000000017");
    await dialog.getByRole("button", { name: "Look up" }).click();
    await expect(dialog.getByText(/isn't in Open Food Facts yet/)).toBeVisible();
    await dialog.getByLabel("Barcode number").fill(BAR_CODE);
    await dialog.getByRole("button", { name: "Look up" }).click();
    await expect(dialog.getByTestId("amount-food-name")).toContainText("Peanut Protein Bar");
    const unit = dialog.getByLabel("Unit", { exact: true });
    await expect(unit).toHaveValue("serving");
    await expect(unit.locator("option")).toHaveText(["serving (1 bar (60 g)) — 60 g", "g", "oz", "lb"]);
    await expect(dialog.getByTestId("amount-calories")).toHaveText("210");
    await expect(dialog.getByText(/Open Food Facts \(community data\)/)).toBeVisible();
    await dialog.getByLabel("Amount", { exact: true }).fill("2");
    await expect(dialog.getByTestId("amount-calories")).toHaveText("420");
    await dialog.getByLabel("Meal", { exact: true }).selectOption("snack");
    await dialog.getByRole("button", { name: "Log food" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Logged Peanut Protein Bar (Test Foods) (2 × 1 bar (60 g) = 120 g).");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("meal-snack").getByText(/2 × 1 bar \(60 g\) = 120 g · 420 kcal/)).toBeVisible();
    await expect(page.getByTestId("nutrient-fiber")).toHaveText("12 g");
    await expect(page.getByTestId("nutrient-sodium")).toHaveText("628 mg"); // 200 g chicken (148 mg) + 2 bars (480 mg)
  });
});
