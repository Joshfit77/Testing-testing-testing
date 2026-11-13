import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, seedRows, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * The 2026-11 Pro program work, in the real app: habit programs (Pro to start, tick today's activities), the program
 * preview's milestones and instructions, Home's weekly report card, and the lighter session after a low check-in.
 */
test.describe("Pro programs", () => {
  test("habit program: Free sees it locked; Pro starts it and ticks today's activity", async ({ page }) => {
    const email = uniqueEmail("habits");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);

    await page.goto("/train/habits/nutrition-foundations");
    await expect(page.getByTestId("habit-locked")).toBeVisible();
    await expect(page.getByTestId("review-flag")).toContainText("Not yet reviewed by a registered dietitian");
    await expect(page.getByTestId("habit-weeks")).toContainText("Week 1");

    await grantPlan(email, "pro");
    await page.reload();
    await page.getByRole("button", { name: "Start program" }).click();
    await expect(page.getByTestId("habit-progress")).toContainText("Day 1 of 28");
    const first = page.getByTestId("habit-day").getByRole("checkbox").first();
    await expect(first).toHaveAttribute("aria-checked", "false");
    await first.click();
    await expect(first).toHaveAttribute("aria-checked", "true");
    // Kept after a reload: it was saved on the server.
    await page.reload();
    await expect(page.getByTestId("habit-day").getByRole("checkbox").first()).toHaveAttribute("aria-checked", "true");

    await page.goto("/train/habits");
    await expect(page.getByText("In progress")).toBeVisible();
    await expect(page.getByRole("link", { name: /Nutrition Foundations/ }).first()).toBeVisible();
  });

  test("catalog program preview shows weekly milestones and how to start; Pro sees the weekly report on Home", async ({ page }) => {
    const email = uniqueEmail("catalog");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "pro");

    await page.goto("/train/programs/beginner-strength-foundations-8-week");
    const guide = page.getByTestId("program-guide");
    await expect(guide).toContainText("Before you start");
    await expect(guide).toContainText("Weekly milestones");
    await expect(guide).toContainText("Week 8:");
    await expect(page.getByRole("button", { name: /Start program/ })).toBeVisible();

    // Program length filter.
    await page.goto("/train/programs?weeks=4");
    await expect(page.getByLabel("Program length")).toHaveValue("4");

    await page.goto("/home");
    const card = page.getByTestId("home-report-card");
    await expect(card).toContainText("Weekly report");
    await card.click();
    await page.waitForURL(/\/progress\/reports/);
  });

  test("after a low check-in, today's session can be started lighter without changing the program", async ({ page }) => {
    const email = uniqueEmail("lighter");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    const today = new Date().toISOString().slice(0, 10);
    await seedRows(email, "recovery_checkins", [{ checked_on: today, sleep_quality: 1, energy: 1, soreness: 5, stress: 5, readiness_score: 20 }]);

    await page.goto("/train/recovery");
    const lighter = page.getByTestId("lighter-session");
    await expect(lighter).toContainText("Your program stays as it is");
    await lighter.getByRole("link", { name: /lighter/ }).click();
    await page.waitForURL(/lighter=1/);
    await expect(page.getByText(/Lighter session: one set fewer per exercise/)).toBeVisible();
  });
});
