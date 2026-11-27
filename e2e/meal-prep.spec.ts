import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, seedRows, signUpAndConfirm, uniqueEmail } from "./helpers";

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Meal-prep batching (Pro): build a recipe, plan it for lunch on all seven days of a week, open the prep plan from the
 * planner and check the batch (7 servings), the two prep sessions that keep every portion within 4 days of cooking
 * (3 + 4 servings) with the recipe's amounts scaled to each, and "Cook once and freeze portions".
 *
 * The plan is seeded rather than generated so the days and portions are exact (the generator mixes dishes and sizes
 * portions to the member's targets). It starts a week from now so "today" in any time zone is before its first prep day.
 */
test.describe("Meal prep", () => {
  test("Free sees the lock; Pro gets batches, prep sessions and scaled amounts", async ({ page }) => {
    test.setTimeout(180_000);
    const email = uniqueEmail("mealprep");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);

    await page.goto("/nutrition/planner/prep");
    await expect(page.getByText("Included with Pro All Access")).toBeVisible();

    await grantPlan(email, "pro");

    // ---- Build a recipe: 200 g chicken breast + 2 cups rice, makes 2 servings (as in recipes-planner.spec.ts).
    await page.goto("/nutrition/recipes");
    await page.getByRole("link", { name: "New recipe" }).click();
    await page.waitForURL(/\/nutrition\/recipes\/new/);
    await page.getByLabel("Recipe name").fill("Prep chicken and rice");
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
    await expect(page.getByTestId("per-serving-calories")).toHaveText("371 kcal");
    await page.getByRole("button", { name: "Save recipe" }).click();
    await page.waitForURL(/\/nutrition\/recipes\/[0-9a-f-]{36}/);
    const recipeId = page.url().match(/recipes\/([0-9a-f-]{36})/)![1]!;

    // ---- Plan it for lunch every day of a week starting 7 days from now.
    const start = addDays(new Date().toISOString().slice(0, 10), 7);
    const planId = randomUUID();
    await seedRows(email, "meal_plans", [
      {
        id: planId,
        start_date: start,
        days: 7,
        targets: { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 70 },
        settings: { mealsPerDay: 3, diet: "balanced", budget: "any", allergies: [], dislikes: [] },
      },
    ]);
    await seedRows(
      email,
      "meal_plan_entries",
      Array.from({ length: 7 }, (_, i) => ({
        plan_id: planId,
        plan_date: addDays(start, i),
        slot: 1,
        meal_type: "lunch",
        label: "Lunch",
        source_key: `recipe:${recipeId}`,
        name: "Prep chicken and rice",
        portion: 1,
        per_serving: { calories: 371, protein_g: 40, carbs_g: 45, fat_g: 4, complete: true },
        ingredients: [],
      })),
    );

    // ---- Open the prep plan from the planner.
    await page.goto("/nutrition/planner");
    await page.getByRole("link", { name: "Prep plan" }).click();
    await page.waitForURL(new RegExp(`/nutrition/planner/prep\\?week=${start}`));
    await expect(page.getByRole("heading", { name: "Prep plan", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cold Food Storage Chart" })).toBeVisible();

    const batch = page.getByTestId("prep-batch");
    await expect(batch).toHaveCount(1);
    await expect(batch).toContainText("Prep chicken and rice");
    await expect(batch.getByTestId("prep-batch-servings")).toHaveText("7 servings");
    await expect(batch).toContainText("the recipe makes 2");

    // Two sessions: the day before the week for its first 3 days, then one for the last 4.
    await expect(page.getByTestId("prep-session")).toHaveCount(2);
    const cooks = batch.getByTestId("prep-cook");
    await expect(cooks).toHaveCount(2);
    await expect(cooks.nth(0).getByTestId("prep-cook-servings")).toHaveText("3 servings");
    await expect(cooks.nth(1).getByTestId("prep-cook-servings")).toHaveText("4 servings");
    // 100 g of chicken per serving, scaled from the recipe's 200 g for 2.
    await expect(cooks.nth(0).getByTestId("prep-ingredients")).toContainText("300 g");
    await expect(cooks.nth(1).getByTestId("prep-ingredients")).toContainText("400 g");
    await expect(page.getByTestId("prep-share-text")).toContainText("Prep chicken and rice: 3 servings");

    // ---- Cook once and freeze the later portions instead.
    await batch.getByTestId("prep-freeze-toggle").click();
    await page.waitForURL(/freeze=recipe/);
    await expect(page.getByTestId("prep-session")).toHaveCount(1);
    await expect(batch.getByTestId("prep-cook")).toHaveCount(1);
    await expect(batch.getByTestId("prep-cook-servings")).toHaveText("7 servings");
    await expect(batch.getByTestId("prep-ingredients")).toContainText("700 g");
    await expect(batch.getByTestId("prep-cook")).toContainText("freeze 3 servings");
    await expect(batch.getByTestId("prep-freeze-toggle")).toContainText("Cook fresh");
  });
});
