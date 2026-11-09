import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * The current-set card at the top of the logger: the set to do now, one tap to complete it, the rest countdown with
 * Skip, Undo, an honest "Finish early?" summary, and a completion screen that counts only what was done. Then the same
 * program day again: "last time" comes from that day, and its numbers are pre-filled.
 */
test.describe("current set card", () => {
  test("complete, rest, skip, undo, finish early, and see last time on the same day", async ({ page }) => {
    const email = uniqueEmail();
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);

    await page.goto("/home");
    await page.getByRole("link", { name: /^Start (Today's Workout|workout)/i }).click();
    await page.waitForURL(/\/train\/workout\?day=/);
    const workoutUrl = new URL(page.url());

    const card = page.getByTestId("current-set-card");
    await expect(card).toBeVisible();
    const firstExercise = (await card.getByTestId("current-exercise").innerText()).trim();
    expect(firstExercise.length).toBeGreaterThan(0);
    await expect(card.getByTestId("current-set-label")).toHaveText(/^Set 1 of (\d+)$/i);
    const planned = Number((await card.getByTestId("current-set-label").innerText()).match(/of (\d+)/i)![1]);

    // New member: nothing invented about "last time".
    await expect(card.getByTestId("current-last-time")).toHaveCount(0);

    // Enter the numbers on the card and complete the set with one tap.
    await card.getByLabel("Weight (lb)").fill("95");
    await card.getByLabel("Reps", { exact: true }).fill("8");
    // A shaky double tap is one completion: the button moves to set 2, and set 2 must not be ticked by the second tap.
    await card.getByTestId("complete-set").dblclick();

    await expect(card.getByTestId("set-undo")).toContainText("logged");
    await expect(page.getByRole("timer", { name: "Rest timer" })).toHaveCount(1);
    await expect(card.getByTestId("current-rest")).toBeVisible();
    await expect(card.getByTestId("current-set-label")).toHaveText(/^Set 2 of/i);
    // The same set is ticked in the exercise card below, and the weight carried to the next set.
    await expect(page.getByRole("button", { name: /set 1 completed/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /set 2 completed/ })).toHaveCount(0);
    await expect(card.getByLabel("Weight (lb)")).toHaveValue("95");

    // Skip the rest.
    await card.getByRole("button", { name: "Skip rest" }).click();
    await expect(card.getByTestId("current-rest")).toHaveCount(0);

    // Undo the set: it is not done any more, and the card is back on set 1. (Undo and re-complete are deliberate taps:
    // neither waits out the double-tap guard.)
    await card.getByTestId("set-undo").getByRole("button", { name: "Undo" }).click();
    await expect(card.getByTestId("set-undo")).toHaveCount(0);
    await expect(card.getByTestId("current-set-label")).toHaveText(/^Set 1 of/i);
    await expect(page.getByRole("button", { name: /set 1 completed/ })).toHaveCount(0);

    // Complete it again, then finish early: the dialog says how much is unfinished and that it won't count.
    await expect(card.getByLabel("Weight (lb)")).toHaveValue("95");
    await expect(card.getByLabel("Reps", { exact: true })).toHaveValue("8");
    await card.getByTestId("complete-set").click();
    await expect(card.getByTestId("current-set-label")).toHaveText(/^Set 2 of/i);

    await page.getByRole("button", { name: "Finish", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Finish early?" })).toBeVisible();
    const summary = page.getByTestId("finish-summary");
    await expect(summary).toContainText(/^1 of \d+ working sets done/);
    await expect(summary).toContainText("aren't counted");
    const totalPlanned = Number((await summary.innerText()).match(/of (\d+) working/)![1]);
    await page.getByRole("button", { name: "Finish & save" }).click();

    // The completion screen counts only the completed working set.
    await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();
    const stats = page.getByTestId("completion-stats");
    await expect(stats.getByTestId("stat-sets")).toContainText(`1/${totalPlanned}`);
    await expect(stats.getByTestId("stat-reps")).toContainText("8");
    await expect(stats.getByTestId("stat-volume")).toContainText("lb");
    await expect(stats.getByTestId("stat-volume")).not.toContainText("—");
    await expect(stats.getByTestId("stat-records")).toContainText("0"); // a first session sets no "record" against nothing
    await expect(page.getByTestId("partial-note")).toContainText("Only completed sets count");
    await expect(page.getByTestId("view-summary")).toHaveAttribute("href", /^\/train\/history\/[0-9a-f-]{36}$/);
    expect(planned).toBeGreaterThan(1);

    // The same program day again: "last time" is that session, and its weight is pre-filled (reps start from the
    // program's target, so they aren't asserted here).
    await page.goto(workoutUrl.pathname + workoutUrl.search);
    const again = page.getByTestId("current-set-card");
    await expect(again.getByTestId("current-exercise")).toHaveText(firstExercise);
    await expect(again.getByTestId("current-last-time")).toContainText("95");
    await expect(again.getByLabel("Weight (lb)")).toHaveValue("95");
  });
});
