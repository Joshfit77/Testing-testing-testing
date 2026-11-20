import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * Signing out clears the device for the next person. With a workout in progress it must not delete sets the account
 * doesn't have yet: the latest copy is saved to the account first, and when that can't happen the member is asked.
 * (Browser approximations, not device tests.)
 */

async function startWorkoutAndLogSet(page: Page) {
  await page.goto("/home");
  await page.getByRole("link", { name: /^Start (Today's Workout|workout)/i }).click();
  await page.waitForURL(/\/train\/workout/);
  await page.getByLabel(/set 1 weight in lb/).first().fill("135");
  await page.getByRole("button", { name: /Mark .* set 1 complete/ }).first().click();
}

const hasLocalWorkout = (page: Page) => page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("ngf.workout.draft.")));

test.describe("signing out with a workout in progress", () => {
  test("the workout is saved to the account, then the member is signed out and the device cleared", async ({ page }) => {
    const email = uniqueEmail("signout-wo");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await startWorkoutAndLogSet(page);
    // A set the account doesn't have yet: the weight changed and the 2-second backup hasn't fired.
    await page.getByLabel(/set 1 weight in lb/).first().fill("155");
    await page.goto("/profile");
    expect(await hasLocalWorkout(page)).toBe(true);
    await page.locator("main").getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);
    expect(await hasLocalWorkout(page)).toBe(false);
    // Back in: the workout is on the account.
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/home/);
    await page.goto("/train/workout");
    await expect(page.getByRole("button", { name: /set 1 completed/ }).first()).toBeVisible();
  });

  test("when the account can't be reached, the member is asked; staying signed in keeps the workout", async ({ page }) => {
    const email = uniqueEmail("signout-ask");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await startWorkoutAndLogSet(page);
    await page.goto("/profile");
    // The workout's save is refused (the server action carrying the workout); signing out itself still works.
    await page.route("**/profile", (route) => (route.request().method() === "POST" && (route.request().postData() ?? "").includes("clientId") ? route.abort() : route.fallback()));
    await page.locator("main").getByRole("button", { name: "Sign out" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Your workout isn't saved to your account yet")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    expect(page.url()).toMatch(/\/profile/);
    expect(await hasLocalWorkout(page)).toBe(true);
    // Choosing to sign out anyway does sign out, and clears the device.
    await page.locator("main").getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Sign out and delete it" }).click();
    await page.waitForURL(/\/login/);
    expect(await hasLocalWorkout(page)).toBe(false);
  });
});
