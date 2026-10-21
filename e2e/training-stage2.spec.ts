import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

async function pickExercise(page: Page, name: string) {
  await page.getByRole("button", { name: "Add exercise" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Search by name or muscle").fill(name);
  await dialog.getByRole("button", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).first().click();
  await expect(dialog).toBeHidden();
}

test.describe("training stage 2B", () => {
  test("program catalog: search, filters in the URL, categories, equipment, completion and review flags", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("catalog"));
    await completeOnboarding(page);

    await page.goto("/train/programs");
    await page.getByRole("searchbox", { name: "Search programs" }).fill("calisthenics");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForURL(/q=calisthenics/);
    await expect(page.getByRole("heading", { name: "Calisthenics Foundations" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Barbell Strength Foundations" })).toHaveCount(0);

    // Filters live in the URL (so nav memory and Back keep them).
    await page.goto("/train/programs");
    await page.getByText("Filters", { exact: true }).click();
    await page.getByLabel("Equipment I have").selectOption("none");
    await page.getByLabel("Days per week").selectOption("3");
    await page.getByLabel("Session length").selectOption("45");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await page.waitForURL(/equipment=none/);
    expect(page.url()).toMatch(/days=3/);
    expect(page.url()).toMatch(/minutes=45/);
    await expect(page.getByRole("heading", { name: "First 5K: Run/Walk to 30 Minutes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dumbbell Home Strength" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel("Equipment I have")).toHaveValue("none");

    // The 13 spec categories form the browse structure.
    await page.goto("/train/programs");
    await page.getByRole("navigation", { name: "Program categories" }).getByRole("link", { name: "Active aging, seated & low-impact" }).click();
    await page.waitForURL(/category=active-aging/);
    const seated = page.getByRole("link", { name: /Seated Strength & Mobility/ });
    await expect(seated).toBeVisible();
    await expect(seated.getByText("Not yet reviewed by a qualified coach")).toBeVisible();
    await expect(seated.getByText(/sessions \(80%\)/)).toBeVisible();
    await seated.click();
    await expect(page.getByRole("heading", { name: "Equipment needed" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "To complete it" })).toBeVisible();
    await expect(page.getByText(/Complete at least 80% of the 18 sessions/)).toBeVisible();
    await expect(page.getByText("Not yet reviewed by a qualified coach.")).toBeVisible();

    // Training preferences preview what a schedule change does before it's applied.
    await page.goto("/profile/preferences");
    const preview = page.getByTestId("schedule-preview");
    await expect(preview).toContainText("No change to days or session length");
    await page.locator("#sched-days").selectOption("4");
    await expect(preview).toContainText("Days a week");
    await expect(preview).toContainText(/3\s*4/);
    await expect(preview).toContainText(/Average session/);
  });

  test("custom workout with a superset and a distance exercise: save, start, log, see Last time and history", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("templates"));
    await completeOnboarding(page);

    await page.goto("/train");
    await page.getByRole("navigation", { name: "Training tools" }).getByRole("link", { name: "My workouts" }).click();
    await page.waitForURL(/\/train\/templates$/);
    await expect(page.getByText("No saved workouts yet")).toBeVisible();
    await page.getByRole("link", { name: "New workout" }).click();
    await page.waitForURL(/\/train\/templates\/new/);
    await page.getByLabel("Workout name").fill("E2E Push Pull");
    await pickExercise(page, "Barbell Bench Press");
    await pickExercise(page, "One-Arm Dumbbell Row");
    await pickExercise(page, "Farmer's Carry");
    await page.getByLabel("Barbell Bench Press reps").fill("8");
    await page.getByRole("button", { name: "Superset with One-Arm Dumbbell Row" }).click();
    await expect(page.getByText("Superset A")).toHaveCount(2);
    // Farmer's carry is measured by distance.
    await expect(page.getByRole("group", { name: "Farmer's Carry target" }).getByRole("button", { name: "distance" })).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Farmer's Carry distance in yd").fill("40");
    await page.getByRole("button", { name: "Save template" }).click();
    await page.waitForURL(/\/train\/templates$/);
    const card = page.getByRole("listitem").filter({ hasText: "E2E Push Pull" });
    await expect(card).toContainText("3 × 40 yd");
    await expect(card).toContainText("1 superset(s)");

    // Start it and log: the superset alternates, with rest only after the round.
    await card.getByRole("link", { name: "Start" }).click();
    await page.waitForURL(/\/train\/workout\?template=/);
    await expect(page.getByText("Superset A · 1 of 2")).toBeVisible();
    await page.getByLabel("Barbell Bench Press set 1 weight in lb").fill("100");
    await page.getByLabel("Barbell Bench Press set 1 reps").fill("8");
    await page.getByRole("button", { name: "Mark Barbell Bench Press set 1 complete" }).click();
    await expect(page.getByRole("timer", { name: "Rest timer" })).toHaveCount(0);
    await page.getByLabel("One-Arm Dumbbell Row set 1 weight in lb").fill("50");
    await page.getByLabel("One-Arm Dumbbell Row set 1 reps").fill("10");
    await page.getByRole("button", { name: "Mark One-Arm Dumbbell Row set 1 complete" }).click();
    await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    // Distance on the carry.
    await expect(page.getByLabel("Farmer's Carry set 1 distance in yd")).toHaveValue("40");
    await page.getByLabel("Farmer's Carry set 1 weight in lb").fill("50");
    await page.getByRole("button", { name: "Mark Farmer's Carry set 1 complete" }).click();

    await page.getByRole("button", { name: "Finish" }).click();
    await page.getByRole("button", { name: "Finish & save" }).click();
    await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();

    // Next time: "Last time" beside each exercise.
    await page.goto("/train/templates");
    await page.getByRole("listitem").filter({ hasText: "E2E Push Pull" }).getByRole("link", { name: "Start" }).click();
    await page.waitForURL(/\/train\/workout\?template=/);
    const lastTimes = page.getByTestId("last-time");
    await expect(lastTimes.filter({ hasText: "Last time: 1×8 @ 100 lb" })).toBeVisible();
    await expect(lastTimes.filter({ hasText: "Last time: 1 × 40 yd @ 50 lb" })).toBeVisible();
    await page.getByRole("button", { name: "Discard workout" }).click();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await page.waitForURL(/\/train$/);

    // The exercise page links to its performance history.
    await page.goto("/train/exercises/bench-press");
    await expect(page.getByRole("link", { name: /Search YouTube for more/ })).toBeVisible();
    await page.getByRole("link", { name: /Your history/ }).click();
    await page.waitForURL(/\/train\/exercises\/bench-press\/history/);
    await expect(page.getByTestId("best-set")).toContainText("100 lb × 8");
    await expect(page.getByRole("heading", { name: "Recent sessions" })).toBeVisible();
    await expect(page.getByRole("link", { name: /E2E Push Pull/ })).toBeVisible();

    // Edit and delete the template.
    await page.goto("/train/templates");
    await page.getByRole("listitem").filter({ hasText: "E2E Push Pull" }).getByRole("link", { name: "Edit" }).click();
    await page.waitForURL(/\/train\/templates\/[0-9a-f-]{36}/);
    await page.getByLabel("Workout name").fill("E2E Push Pull v2");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/\/train\/templates$/);
    const v2 = page.getByRole("listitem").filter({ hasText: "E2E Push Pull v2" });
    await v2.getByRole("button", { name: "Delete E2E Push Pull v2" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("No saved workouts yet")).toBeVisible();
  });

  test("an empty workout can be saved as a template afterwards", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("empty-template"));
    await completeOnboarding(page);
    await page.goto("/train/workout?blank=1");
    await pickExercise(page, "Push-Up");
    await page.getByLabel("Push-Up set 1 reps").fill("12");
    await page.getByRole("button", { name: "Mark Push-Up set 1 complete" }).click();
    await page.getByRole("button", { name: "Finish" }).click();
    await page.getByRole("button", { name: "Finish & save" }).click();
    await expect(page.getByRole("heading", { name: "Save as a template" })).toBeVisible();
    await page.getByLabel("Template name").fill("Quick push-ups");
    await page.getByRole("button", { name: "Save template" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved to" })).toBeVisible();
    await page.goto("/train/templates");
    await expect(page.getByRole("listitem").filter({ hasText: "Quick push-ups" })).toContainText("1 × 12");
  });

  test("exercise library: muscle group and difficulty filters", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("library-filters"));
    await completeOnboarding(page);
    await page.goto("/train/exercises");
    await page.getByLabel("Muscle group").selectOption("chest");
    await page.getByLabel("Difficulty").selectOption("beginner");
    await page.getByRole("button", { name: "Filter" }).click();
    await page.waitForURL(/muscle=chest/);
    expect(page.url()).toMatch(/difficulty=beginner/);
    await expect(page.getByRole("link", { name: /^Push-Up/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Barbell Bench Press/ })).toHaveCount(0); // intermediate
    await expect(page.getByRole("link", { name: /Barbell Back Squat/ })).toHaveCount(0); // legs
  });
});
