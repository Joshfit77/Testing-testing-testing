import { expect, test } from "@playwright/test";
import { answerOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("guided onboarding builds a plan", () => {
  test("one question per screen, then a plan summary with a calorie budget and an active program", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("plan"));
    await page.waitForURL(/\/onboarding/);

    // Progress bar + validation on a screen.
    await expect(page.getByText("Question 1 of 14")).toBeVisible();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByText("Choose your main goal.")).toBeVisible();

    // Female, 29, 5 ft 5 in, 150 lb → goal 135 lb at "Lose 1 lb per week", not very active.
    await answerOnboarding(page, {
      goal: "Lose body fat",
      sex: "Female",
      age: "29",
      feet: "5",
      inches: "5",
      weightLb: "150",
      goalWeightLb: "135",
      pace: /^Lose 1 lb per week/,
      activity: /^Not very active/,
      experience: "Under 1 year",
      equipment: /^Dumbbells only/,
    });

    await expect(page.getByRole("heading", { name: "Your plan is ready" })).toBeVisible();
    // Mifflin-St Jeor: 1406 × 1.2 ≈ 1688 maintenance; the deficit is capped at 25% → 1,270 kcal.
    await expect(page.getByText(/1,270\s*kcal \/ day \(estimate\)/)).toBeVisible();
    await expect(page.getByText(/Maintenance: about 1,688 kcal/)).toBeVisible();
    await expect(page.getByText(/Pace: Lose 1 lb per week · goal weight 135 lb/)).toBeVisible();
    await expect(page.getByText(/Estimated goal date:/)).toBeVisible();
    await expect(page.getByText(/not medical or dietary advice/)).toBeVisible();
    await expect(page.getByText(/\d+ weeks × \d days\/week × 45 min/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Week 1" })).toBeVisible();
    await expect(page.getByText(/^Day 1:/)).toBeVisible();

    await page.getByRole("link", { name: /Start my first workout/ }).click();
    await page.waitForURL(/\/train\/workout\?day=/);

    // The program is the active one on Home. Opening the logger and leaving logged nothing, so nothing was saved:
    // Home still offers to start the session (no phantom "Resume workout").
    await page.goto("/home");
    await expect(page.getByRole("link", { name: /^Start workout/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Resume workout/ })).toHaveCount(0);
  });
});
