import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";

const num = async (page: Page, id: string) => Number((await page.getByTestId(id).innerText()).replace(/[^\d-]/g, ""));

async function quickAdd(page: Page, meal: string, calories: string) {
  await page.getByRole("button", { name: `Quick add calories to ${meal}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Calories").fill(calories);
  await dialog.getByRole("button", { name: `Add to ${meal}` }).click();
  await expect(dialog.getByRole("status")).toHaveText(`Added ${calories} kcal to ${meal}.`);
  await page.keyboard.press("Escape");
}

test.describe("food diary (MyFitnessPal style)", () => {
  test("budget strip, quick add, copy from yesterday, recents and budget recalculation", async ({ page }) => {
    const email = uniqueEmail("diary");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page); // male, 34, 5 ft 10 in, 185 lb, lightly active, maintain
    await grantPlan(email, "plus");

    await page.goto("/nutrition");
    // Maintenance = Mifflin-St Jeor (1785) × 1.375 ≈ 2455 → 2,460 kcal goal at "maintain".
    await expect(page.getByTestId("budget-goal")).toHaveText("2460");
    expect(await num(page, "budget-food")).toBe(0);
    expect(await num(page, "budget-exercise")).toBe(0);
    expect(await num(page, "budget-remaining")).toBe(2460);
    await expect(page.getByTestId("projection")).toHaveCount(0);

    // Quick add 500 kcal to breakfast → Goal − Food + Exercise = Remaining.
    await quickAdd(page, "Breakfast", "500");
    await expect(page.getByTestId("budget-food")).toHaveText("500");
    await expect(page.getByTestId("budget-remaining")).toHaveText("1960");
    await expect(page.getByTestId("meal-breakfast").locator("li").getByText("Quick add")).toBeVisible();
    // "If every day were like today": 1,955 kcal under maintenance a day for 5 weeks.
    await expect(page.getByTestId("projection")).toContainText(/you'd weigh about 1\d\d(\.\d)? lb in 5 weeks/);

    // Log lunch yesterday, then copy it into today.
    await page.getByRole("link", { name: "Previous day" }).click();
    await page.waitForURL(/date=/);
    await quickAdd(page, "Lunch", "300");
    await page.getByRole("link", { name: "Back to today" }).click();
    await page.waitForURL(/\/nutrition$/);
    await page.getByRole("button", { name: "Copy lunch from yesterday (1)" }).click();
    await expect(page.getByText("Copied 1 item.")).toBeVisible();
    await expect(page.getByTestId("budget-food")).toHaveText("800");
    await expect(page.getByTestId("meal-lunch").locator("li").getByText("Quick add").first()).toBeVisible();

    // Whole-day copy adds yesterday's lunch again.
    await page.getByRole("button", { name: "Copy yesterday", exact: true }).click();
    await expect(page.getByText("Copied 1 item.").first()).toBeVisible();
    await expect(page.getByTestId("budget-food")).toHaveText("1100");
    await expect(page.getByTestId("budget-remaining")).toHaveText("1360");

    // Recent / frequent foods re-log in one tap.
    await page.getByRole("button", { name: "Add food" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("tab", { name: "Recent" })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByLabel("Frequent foods")).toBeVisible();
    await dialog.getByLabel("Frequent foods").getByRole("button", { name: "Add Quick add again" }).first().click();
    await expect(dialog.getByText("Logged Quick add.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("budget-food")).not.toHaveText("1100");

    // Weekly summary.
    await expect(page.getByTestId("weekly-summary")).toContainText("Daily average");

    // Change goal weight + pace → the budget is recalculated (estimate).
    await page.getByLabel("Goal weight (lb, optional)").fill("175");
    await page.getByLabel("Weekly pace").selectOption({ label: "Lose 1 lb per week" });
    await page.getByRole("button", { name: "Recalculate budget" }).click();
    // 2455 − 550 = 1905 → 1,910 kcal.
    await expect(page.getByTestId("budget-goal")).toHaveText("1910");
    const weightGoal = page.getByRole("region", { name: "Weight goal" });
    await expect(weightGoal.getByText("175 lb")).toBeVisible();
    await expect(weightGoal.getByText(/estimated goal date/)).toBeVisible();

    // Custom targets still override.
    await page.locator("#goal-calories").fill("2000");
    await page.getByRole("button", { name: "Save targets" }).click();
    await expect(page.getByTestId("budget-goal")).toHaveText("2000");
  });
});
