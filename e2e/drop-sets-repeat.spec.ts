import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * Drop sets and "Do this workout again", end to end on a real account:
 * - after logging a set, "Add a drop set" ends the rest and makes an empty drop set the next set (no invented weight);
 * - logging the drop set starts the rest, and set 2 starts from the main set's weight, not the drop's;
 * - the saved workout shows the drop set in history, and "Do this workout again" starts a new workout with the same
 *   exercises and planned sets, its weight pre-filled from the member's own last time.
 */
test.describe("drop sets and repeat workout", () => {
  test("add a drop set with no rest, save it, and do the workout again", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("drop"));
    await completeOnboarding(page);
    await page.goto("/home");
    await page.getByRole("link", { name: /^Start (Today's Workout|workout)/i }).click();
    await page.waitForURL(/\/train\/workout\?day=/);

    const card = page.getByTestId("current-set-card");
    const firstExercise = (await card.getByTestId("current-exercise").innerText()).trim();
    const planned = Number((await card.getByTestId("current-set-label").innerText()).match(/of (\d+)/i)![1]);
    await card.getByLabel("Weight (lb)").fill("95");
    await card.getByLabel("Reps", { exact: true }).fill("8");
    await card.getByTestId("complete-set").click();
    await expect(card.getByTestId("current-rest")).toBeVisible();

    // Drop set: the rest ends, the drop is next, and its weight is left for the member to enter.
    await card.getByTestId("add-drop-set").click();
    await expect(card.getByTestId("current-rest")).toHaveCount(0);
    await expect(card.getByTestId("current-set-label")).toHaveText("Drop set 1");
    await expect(card.getByLabel("Weight (lb)")).toHaveValue("");
    await expect(card.getByTestId("repeat-last-set")).toHaveCount(0);
    await card.getByLabel("Weight (lb)").fill("65");
    await card.getByLabel("Reps", { exact: true }).fill("6");
    await card.getByTestId("complete-set").click();

    // After the drop: rest, then set 2 carries the main set's weight (95), not the drop's (65). Its reps come from the
    // program's target, so they aren't asserted here.
    await expect(card.getByTestId("current-rest")).toBeVisible();
    await expect(card.getByTestId("current-set-label")).toHaveText(/^Set 2 of/i);
    await expect(card.getByLabel("Weight (lb)")).toHaveValue("95");

    // Finish early and open the saved workout.
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    await page.getByRole("button", { name: "Finish & save" }).click();
    await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();
    // Both sets count: 95 × 8 + 65 × 6 = 1,150 lb.
    await expect(page.getByTestId("completion-stats").getByTestId("stat-volume")).toContainText("1,150");
    const summaryHref = await page.getByTestId("view-summary").getAttribute("href");
    await page.goto(summaryHref!);
    await expect(page.getByText("Drop set", { exact: true })).toBeVisible();

    // Do it again: a new workout with the same first exercise, weight from last time (95, not the drop's 65).
    await page.getByTestId("repeat-workout").click();
    await page.waitForURL(/\/train\/workout\?repeat=/);
    const again = page.getByTestId("current-set-card");
    await expect(again.getByTestId("current-exercise")).toHaveText(firstExercise);
    // The workout as planned (it was finished early), and the drop set isn't carried over as a working set.
    await expect(again.getByTestId("current-set-label")).toHaveText(`Set 1 of ${planned}`);
    await expect(again.getByLabel("Weight (lb)")).toHaveValue("95");
  });

  test("another member's workout can't be repeated (it looks like a missing one)", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("drop2"));
    await completeOnboarding(page);
    await page.goto("/train/workout?repeat=00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("That workout wasn't found. Starting an empty workout instead.")).toBeVisible();
  });
});
