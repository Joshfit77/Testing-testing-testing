import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * The first workout, the way a member actually has it: looking at the session and leaving, logging with a shaky
 * thumb, swapping an exercise halfway through, finishing, and coming back the next day. Each of these lost data or
 * misled the member before (docs/quality/2026-10-28-first-workout-diagnosis.md).
 */
test.describe("a dependable first workout", () => {
  test.describe.configure({ mode: "serial" });

  async function startTodaysWorkout(page: Page) {
    await page.goto("/home");
    await page.getByRole("link", { name: /^Start workout/ }).click();
    await page.waitForURL(/\/train\/workout/);
    await page.getByLabel(/set 1 weight in lb/).first().waitFor();
  }

  test("looking at the session and leaving leaves nothing behind; logging is one tap and survives a double tap", async ({ page }) => {
    const email = uniqueEmail();
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);

    // Open the workout, type nothing, go back: Home still offers to start it, and no "Resume" pill appears.
    await startTodaysWorkout(page);
    await page.goto("/home");
    await expect(page.getByRole("link", { name: /^Start workout/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Resume/ })).toHaveCount(0);
    await page.goto("/nutrition");
    await expect(page.getByRole("link", { name: /^Resume:/ })).toHaveCount(0);

    // Log a set. A second tap right after the first is the same tap, not an undo.
    await startTodaysWorkout(page);
    await page.getByLabel(/set 1 weight in lb/).first().fill("135");
    const done = page.getByRole("button", { name: /Mark .* set 1 complete/ }).first();
    await done.dblclick();
    await expect(page.getByRole("button", { name: /set 1 completed/ }).first()).toBeVisible();
    await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();
    // The weight carried down to set 2.
    await expect(page.getByLabel(/set 2 weight in lb/).first()).toHaveValue("135");

    // A set with no reps can't be ticked as done (it would be saved as a set of nothing).
    const second = page.locator("section[aria-labelledby^='ex-']").nth(1);
    await second.getByLabel(/set 1 reps/).fill("");
    await expect(second.getByRole("button", { name: /set 1: enter reps/ })).toHaveAttribute("aria-disabled", "true");

    // Swapping an exercise after two sets keeps those sets logged under the original.
    await page.getByLabel(/set 2 weight in lb/).first().fill("135");
    await page.getByRole("button", { name: /Mark .* set 2 complete/ }).first().click();
    await page.getByRole("button", { name: /^Options for / }).first().click();
    await page.getByRole("menuitem", { name: "Substitute exercise" }).click();
    await expect(page.getByText(/The 2 sets you've done stay logged/)).toBeVisible();
    await page.getByRole("dialog").getByPlaceholder("Search by name or muscle").fill("goblet");
    await page.getByRole("dialog").getByRole("button", { name: /Goblet Squat/ }).first().click();
    const cards = page.locator("section[aria-labelledby^='ex-']");
    await expect(cards.first().getByRole("button", { name: /set 1 completed/ })).toBeVisible();
    await expect(cards.first().getByRole("button", { name: /set 2 completed/ })).toBeVisible();
    await expect(cards.nth(1).getByText(/Substituted for/)).toBeVisible();

    // Finish: a first workout sets baselines, and the member is told what comes next.
    await page.getByRole("button", { name: "Finish" }).click();
    await page.getByRole("button", { name: "Finish & save" }).click();
    await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();
    await expect(page.getByText("Baselines set")).toBeVisible();
    await expect(page.getByText("Up next")).toBeVisible();
    await expect(page.getByText(/Week 1 of 8 · Day 2 of 3/)).toBeVisible();

    // The day after a workout is a rest day: Home says so, with the next session's day, and still lets you train early.
    await page.goto("/home");
    await expect(page.getByTestId("today-rest")).toHaveText("Rest day today");
    await expect(page.getByTestId("today-detail")).toContainText(/Day 2 of 3 · planned for/);
    await expect(page.getByRole("link", { name: /Start workout early/ })).toBeVisible();

    // An unfinished workout from hours ago is not resumed silently.
    await page.getByRole("link", { name: /Start workout early/ }).click();
    await page.waitForURL(/\/train\/workout/);
    await page.getByLabel(/set 1 weight in lb/).first().fill("185");
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith("ngf.workout.draft.")) continue;
        const d = JSON.parse(localStorage.getItem(k)!);
        d.updatedAt = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
        localStorage.setItem(k, JSON.stringify(d));
      }
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Unfinished workout" })).toBeVisible();
    await expect(page.getByText(/last used 10 hours ago/)).toBeVisible();
    await page.getByRole("button", { name: /^Resume/ }).click();
    await expect(page.getByLabel(/set 1 weight in lb/).first()).toHaveValue("185");
    // The ten hours away did not count as training time.
    await expect(page.locator("text=/^0:0\\d$/").first()).toBeVisible();
  });
});
