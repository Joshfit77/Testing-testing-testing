import { expect, test } from "@playwright/test";
import { answerOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("guided onboarding builds a plan", () => {
  test("one question per screen, then a plan summary with a calorie budget and an active program", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("plan"));
    await page.waitForURL(/\/onboarding/);

    // Progress bar + validation on a screen.
    await expect(page.getByText("Question 1 of 6")).toBeVisible();
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

    // One prominent next step, above the fold: today's session.
    const start = page.getByTestId("plan-start-today").getByRole("link", { name: "Start Today's Workout" });
    await expect(start).toBeInViewport();
    await expect(page.getByRole("link", { name: /^Start/ })).toHaveCount(1);
    await start.click();
    await page.waitForURL(/\/train\/workout\?day=/);

    // The program is the active one on Home. Opening the logger and leaving logged nothing, so nothing was saved:
    // Home still offers to start the session (no phantom "Resume workout").
    await page.goto("/home");
    await expect(page.getByRole("link", { name: "Start Today's Workout" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Resume workout/ })).toHaveCount(0);
  });
  test("answers survive a reload, but never reach another account in the same tab", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("resume"));
    await page.waitForURL(/\/onboarding/);
    await page.getByRole("button", { name: "Build strength", exact: true }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: "1–3 years", exact: true }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByText("Question 3 of 6")).toBeVisible();

    // A reload (or an accidental back-swipe) carries on where the member was.
    await page.reload();
    await expect(page.getByText("Question 3 of 6")).toBeVisible();

    // Saved answers that belong to a different account are thrown away, not shown.
    await page.evaluate(() => {
      const key = "ngf.onboarding.progress.v1";
      const saved = JSON.parse(sessionStorage.getItem(key) ?? "{}") as Record<string, unknown>;
      sessionStorage.setItem(key, JSON.stringify({ ...saved, owner: "00000000-0000-0000-0000-000000000000", age: "61" }));
    });
    await page.reload();
    await expect(page.getByText("Question 1 of 6")).toBeVisible();
    await expect(page.getByRole("button", { name: "Build strength", exact: true })).toHaveAttribute("aria-pressed", "false");
    const owner = await page.evaluate(() => (JSON.parse(sessionStorage.getItem("ngf.onboarding.progress.v1") ?? "{}") as { owner?: string; age?: string }));
    expect(owner.age ?? "").not.toBe("61");
  });
});
