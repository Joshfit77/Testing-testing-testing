import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, seedRows, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * The membership structure: Free (food logging, barcode, macros, basic training, all of Faith), Plus (the complete
 * non-AI toolkit) and Pro (adds the AI coach). Each locked screen says honestly which plan includes it.
 */
test.describe("memberships", () => {
  test("Free: food logging is open; Plus tools and the Pro coach say which plan includes them", async ({ page }) => {
    const email = uniqueEmail("free-tier");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);

    // Food diary and insights are free.
    await page.goto("/nutrition");
    await expect(page.getByRole("button", { name: "Add food" })).toBeVisible();
    await page.goto("/nutrition/insights");
    await expect(page.getByText("Included with Plus and Pro")).toHaveCount(0);

    // Meal planning, the program builder and photo comparisons are Plus.
    for (const path of ["/nutrition/planner", "/nutrition/recipes", "/nutrition/grocery", "/train/build"]) {
      await page.goto(path);
      await expect(page.getByText("Included with Plus and Pro"), path).toBeVisible();
    }

    // The AI coach is Pro only, and nothing asks for AI data sharing on Free.
    await page.goto("/coach");
    await expect(page.getByText("AI coaching is included with Pro.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Allow and continue" })).toHaveCount(0);

    // Every Fitness, Food and Faith rank is earnable on Free.
    await page.goto("/progress/badges");
    await expect(page.getByRole("button", { name: "Foundation, rank 1 of 9, locked" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Conqueror, rank 9 of 9, locked" })).toBeVisible();
    await expect(page.getByText(/included with Plus/i)).toHaveCount(0);
    await page.getByRole("tab", { name: /Food/ }).click();
    await expect(page.getByRole("list", { name: "Food ranks" }).getByRole("listitem")).toHaveCount(9);
    await page.getByRole("tab", { name: /Faith/ }).click();
    await expect(page.getByRole("button", { name: "Cedar, rank 9 of 9, locked" })).toBeVisible();

    // Five saved workouts on Free; existing ones stay usable, new ones need Plus.
    await page.goto("/train/templates");
    await expect(page.getByTestId("template-limit")).toHaveText(/0 of 5 saved workouts on Free/);
    await seedRows(email, "workout_templates", [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }, { name: "E" }]);
    await page.reload();
    await expect(page.getByTestId("template-limit")).toHaveText(/5 of 5 saved workouts on Free/);
    await expect(page.getByRole("link", { name: "Unlimited with Plus" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New workout" })).toHaveCount(0);
  });

  test("Plus: the full toolkit opens, with no AI; Pro adds the coach", async ({ page }) => {
    const email = uniqueEmail("plus-tier");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "plus");

    for (const path of ["/nutrition/planner", "/nutrition/recipes", "/train/build"]) {
      await page.goto(path);
      await expect(page.getByText("Included with Plus and Pro"), path).toHaveCount(0);
    }
    await page.goto("/progress/badges");
    await expect(page.getByRole("button", { name: "Disciplined, rank 4 of 9, locked" })).toBeVisible();
    await page.goto("/train/templates");
    await expect(page.getByTestId("template-limit")).toHaveCount(0);

    await page.goto("/coach");
    await expect(page.getByText("AI coaching is included with Pro.")).toBeVisible();

    await grantPlan(email, "pro");
    await page.goto("/coach");
    await expect(page.getByText("AI coaching is included with Pro.")).toHaveCount(0);
  });
});
