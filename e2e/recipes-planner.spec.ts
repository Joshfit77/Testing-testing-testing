import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * Stage 2A journeys (SPEC §8, §16 "Build and log a recipe serving"): build a recipe from the food database,
 * check per-serving nutrition, log half a serving and find it in the diary; generate a meal plan, swap a
 * meal, build the grocery list from it and check an item off.
 */
test.describe("Recipes, meal planner and grocery list", () => {
  test("build a recipe, log a serving, plan a week, swap a meal and shop for it", async ({ page }) => {
    test.setTimeout(180_000);
    const email = uniqueEmail("recipes");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "plus");

    // ---- Build a recipe: 200 g chicken breast + 2 cups rice, makes 2 servings.
    await page.goto("/nutrition/recipes");
    await page.getByRole("link", { name: "New recipe" }).click();
    await page.waitForURL(/\/nutrition\/recipes\/new/);
    await page.getByLabel("Recipe name").fill("Chicken and rice");
    await page.getByLabel("Servings").fill("2");

    const addIngredient = async (query: string, name: RegExp, amount: string, unit?: string) => {
      await page.getByRole("button", { name: "Add ingredient" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByPlaceholder("e.g. chicken, rice, olive oil").fill(query);
      await dialog.getByRole("region", { name: "Food database results" }).getByRole("button", { name }).first().click();
      if (unit) await dialog.getByLabel("Unit").selectOption({ label: unit });
      await dialog.getByLabel("Amount", { exact: true }).fill(amount);
      await dialog.getByRole("button", { name: "Add ingredient" }).click();
      await expect(dialog).toBeHidden();
    };
    await addIngredient("chicken breast", /^Chicken breast, cooked \(roasted\)/, "200", "g");
    await addIngredient("white rice", /^White rice, cooked/, "2"); // default unit: 1 cup (158 g)
    const ingredients = page.getByTestId("recipe-ingredients");
    await expect(ingredients.getByRole("listitem")).toHaveCount(2);
    await expect(ingredients).toContainText("200 g");
    await expect(ingredients).toContainText("USDA");
    // 330 + 411 = 741 kcal for the recipe; 371 per serving.
    await expect(page.getByTestId("total-calories")).toHaveText("741 kcal");
    await expect(page.getByTestId("per-serving-calories")).toHaveText("371 kcal");

    await page.getByRole("button", { name: "Save recipe" }).click();
    await page.waitForURL(/\/nutrition\/recipes\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: "Chicken and rice", level: 1 })).toBeVisible();
    await expect(page.getByTestId("per-serving-calories")).toHaveText("371 kcal");
    await expect(page.getByTestId("per-serving-protein_g")).toHaveText(/g$/);

    // ---- Log half a serving to lunch today and check the diary.
    await page.getByLabel("Servings eaten").fill("1/2");
    await page.getByLabel("Meal", { exact: true }).selectOption("lunch");
    await expect(page.getByText(/^186 kcal/)).toBeVisible();
    await page.getByRole("button", { name: "Log to diary" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Logged 0.5 servings" })).toBeVisible();
    await page.getByRole("link", { name: "View diary" }).click();
    await page.waitForURL(/\/nutrition\?date=/);
    await expect(page.getByTestId("budget-food")).toHaveText("186");
    const lunch = page.getByTestId("meal-lunch");
    await expect(lunch.getByRole("button", { name: /^Edit Chicken and rice/ })).toBeVisible();
    await expect(lunch).toContainText("0.5 servings (recipe makes 2)");
    await expect(lunch).toContainText("Calculated");

    // Editing the recipe later doesn't change the diary entry.
    await page.goto("/nutrition/recipes");
    await page.getByRole("link", { name: /Chicken and rice/ }).click();
    await page.getByRole("link", { name: "Edit" }).click();
    await page.waitForURL(/\/edit$/);
    await page.getByLabel("Servings").fill("4");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/saved=1/);
    await expect(page.getByTestId("per-serving-calories")).toHaveText("185 kcal");
    await page.goto("/nutrition");
    await expect(page.getByTestId("budget-food")).toHaveText("186");

    // ---- Generate a meal plan.
    await page.goto("/nutrition/planner");
    // AI meal plans are Pro: a Plus member sees where to get them, not the AI form.
    await expect(page.getByRole("region", { name: "AI meal plans" })).toContainText("Pro adds AI-arranged plans");
    await expect(page.getByRole("button", { name: "Draft my plan" })).toHaveCount(0);
    await expect(page.getByText(/The plan is an estimate/)).toBeVisible();
    await page.getByRole("button", { name: "Generate a week" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Plan ready/ })).toBeVisible();
    const days = page.getByTestId("plan-day");
    await expect(days).toHaveCount(7);
    const firstDay = days.first();
    await expect(firstDay.getByTestId("day-fit")).toContainText("kcal");
    await expect(firstDay.getByTestId("plan-meal")).toHaveCount(3);

    // ---- Swap the first meal.
    const firstMeal = firstDay.getByTestId("plan-meal").first();
    const before = (await firstMeal.getByTestId("plan-meal-name").innerText()).trim();
    await firstMeal.getByRole("button", { name: /^Swap/ }).click();
    const swap = page.getByRole("dialog");
    await expect(swap.getByRole("button", { name: /^Use / }).first()).toBeVisible();
    const optionName = ((await swap.getByRole("button", { name: /^Use / }).first().getAttribute("aria-label")) ?? "").replace(/^Use /, "");
    await swap.getByRole("button", { name: /^Use / }).first().click();
    await expect(swap).toBeHidden();
    await expect(page.getByTestId("plan-day").first().getByTestId("plan-meal").first().getByTestId("plan-meal-name")).toContainText(optionName);
    expect(optionName).not.toBe(before);

    // ---- Adjust a portion.
    const meal = page.getByTestId("plan-day").first().getByTestId("plan-meal").nth(1);
    const portion = await meal.getByTestId("plan-portion").innerText();
    await meal.getByRole("button", { name: /^Bigger portion/ }).click();
    await expect(meal.getByTestId("plan-portion")).not.toHaveText(portion);

    // ---- Build the grocery list and check an item off.
    await page.goto("/nutrition/grocery");
    await expect(page.getByTestId("grocery-cost")).toContainText("No cost estimate");
    await page.getByRole("button", { name: "Build list from my plan" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Grocery list built/ })).toBeVisible();
    const items = page.getByTestId("grocery-item");
    await expect(items.first()).toBeVisible();
    const total = await items.count();
    expect(total).toBeGreaterThan(3);
    // Checked items move to "In the cart", so find the checkbox by its name rather than its position.
    const label = (await items.first().getByRole("checkbox").getAttribute("aria-label")) ?? "";
    await page.getByRole("checkbox", { name: label, exact: true }).check();
    await expect(page.getByText(/In the cart \(1\)/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: label, exact: true })).toBeChecked();
    await expect(page.getByText(/In the cart \(1\)/)).toBeVisible();

    // Add an item of your own.
    await page.getByLabel("Item", { exact: true }).fill("Coffee beans");
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText("Coffee beans", { exact: true })).toBeVisible();
    await expect(page.getByTestId("grocery-item")).toHaveCount(total + 1);
  });
});
