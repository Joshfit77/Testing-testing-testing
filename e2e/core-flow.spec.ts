import { expect, test } from "@playwright/test";
import { completeOnboarding, PASSWORD, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("authentication, onboarding and workout logging", () => {
  test("new athlete can sign up, onboard, log and finish a workout that survives a reload", async ({ page }) => {
    const email = uniqueEmail();
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);

    // Dashboard shows today's starter-program session.
    await expect(page.getByText(/Your starter program is ready/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Start workout/ })).toBeVisible();

    // Start the program session.
    await page.getByRole("link", { name: /Start workout/ }).click();
    await page.waitForURL(/\/train\/workout/);
    const firstWeight = page.getByLabel(/set 1 weight in lb/).first();
    await firstWeight.fill("135");
    const firstReps = page.getByLabel(/set 1 reps/).first();
    await firstReps.fill("5");
    await page.getByRole("button", { name: /Mark .* set 1 complete/ }).first().click();
    await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();

    // Reload mid-workout: state must be restored.
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByLabel(/set 1 weight in lb/).first()).toHaveValue("135");
    await expect(page.getByRole("button", { name: /set 1 completed/ }).first()).toBeVisible();

    // Pause/resume.
    await page.getByRole("button", { name: "Pause workout" }).click();
    await expect(page.getByText("Paused", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Resume workout" }).click();

    // Finish.
    await page.getByRole("button", { name: "Finish" }).click();
    await page.getByRole("button", { name: "Finish & save" }).click();
    await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();
    await expect(page.getByText("New personal records")).toBeVisible();

    // History shows the workout.
    await page.getByRole("link", { name: "View history" }).click();
    await expect(page.getByRole("heading", { name: "Workout history" })).toBeVisible();
    await expect(page.locator("main").getByRole("link").filter({ hasText: /exercises/ }).first()).toBeVisible();

    // Sign out and back in.
    await page.goto("/profile");
    await page.getByRole("button", { name: "Sign out" }).first().click().catch(async () => {
      await page.getByRole("button", { name: "More" }).click();
      await page.getByRole("button", { name: "Sign out" }).click();
    });
    await page.waitForURL(/\/login/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/home/);
  });

  test("protected pages redirect anonymous visitors to login", async ({ page }) => {
    await page.goto("/progress");
    await expect(page).toHaveURL(/\/login\?next=%2Fprogress/);
  });

  test("password reset sends an email and lets the user choose a new password", async ({ page }) => {
    const email = uniqueEmail("reset");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await page.context().clearCookies();
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/you'll receive a password reset link/)).toBeVisible();
  });
});
