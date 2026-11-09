import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * The 2D exercise demonstrations (docs/EXERCISE_DEMOS_2D.md): one character, three honest states (moving demo, pose
 * frames, labelled placeholder), the retired 3D page redirects, and the workout card carries the form cues, common
 * mistakes and a swap without disturbing the logger.
 */
const readiness = JSON.parse(readFileSync("src/data/exercise-demo-readiness.json", "utf8")) as { exercises: Record<string, { readiness: string }> };
const firstWith = (state: string) => Object.entries(readiness.exercises).find(([, e]) => e.readiness === state)?.[0] ?? null;

async function pickExercise(page: Page, name: string) {
  await page.getByRole("button", { name: "Add exercise" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Search by name or muscle").fill(name);
  await dialog.getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
  await expect(dialog).toBeHidden();
}

test.describe("2D exercise demonstrations", () => {
  test("each state is shown honestly, and the 3D page is gone", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("demo2d"));
    await completeOnboarding(page);

    // The retired 3D showcase lands on the exercise library.
    await page.goto("/train/3d");
    await expect(page).toHaveURL(/\/train\/exercises$/);

    const animated = firstWith("animated");
    if (animated) {
      await page.goto(`/train/exercises/${animated}`);
      const demo = page.getByTestId("exercise-demo").first();
      await expect(demo).toHaveAttribute("data-demo-readiness", "animated");
      await expect(demo.locator("canvas[data-motion-canvas]")).toBeVisible();
      await expect(page.getByTestId("demo-caption")).toContainText("Animated 2D demonstration");
    }

    const poses = firstWith("poses");
    if (poses) {
      await page.goto(`/train/exercises/${poses}`);
      const demo = page.getByTestId("exercise-demo").first();
      await expect(demo).toHaveAttribute("data-demo-readiness", "poses");
      await expect(demo.getByRole("img")).toHaveCount(2);
      await expect(demo.getByTestId("pose-frames-badge")).toHaveText("Pose frames · animation in progress");
      expect(await demo.locator("canvas").first().evaluate((c: HTMLCanvasElement) => c.width > 0)).toBe(true);
      await expect(page.getByTestId("demo-caption")).toContainText("still being finished");
    }

    const placeholder = firstWith("placeholder");
    if (placeholder) {
      await page.goto(`/train/exercises/${placeholder}`);
      const demo = page.getByTestId("exercise-demo").first();
      await expect(demo).toHaveAttribute("data-demo-readiness", "placeholder");
      await expect(demo).toContainText("Demonstration in progress");
      // The written steps carry the exercise.
      await expect(page.getByRole("heading", { name: /How to do it|Instructions/i }).first()).toBeVisible();
    }
  });

  test("the workout card shows form cues, common mistakes and a swap, and logging still works", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("cues2d"));
    await completeOnboarding(page);
    await page.goto("/train/workout");
    await pickExercise(page, "Barbell Bench Press");
    const card = page.getByTestId("current-set-card");
    await expect(card.getByTestId("current-exercise")).toHaveText(/Barbell Bench Press/i);
    await expect(card.getByRole("button", { name: "Show the Barbell Bench Press demonstration larger" })).toBeVisible();

    // Form cues and common mistakes live in Exercise info (one place, not repeated on the card).
    await card.getByTestId("exercise-info-button").click();
    const info = page.getByTestId("exercise-info");
    await info.getByTestId("info-tab-execution").click();
    await expect(info.getByTestId("info-execution").locator("li").first()).toBeVisible();
    await info.getByTestId("info-tab-mistakes").click();
    await expect(info.getByTestId("info-mistakes").locator("li").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(info).toBeHidden();

    // Logging is unchanged: one tap completes the set.
    await card.getByLabel("Weight (lb)").fill("135");
    await card.getByLabel("Reps", { exact: true }).fill("8");
    await card.getByTestId("complete-set").click();
    await expect(card.getByTestId("current-rest")).toBeVisible();

    // Swap opens the substitute sheet with the alternatives; picking one replaces the exercise, keeping the done set.
    await card.getByTestId("current-swap").click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText(/Barbell Bench Press/);
    await sheet.getByRole("button", { name: /^Dumbbell Bench Press/ }).first().click();
    await expect(sheet).toBeHidden();
    await expect(card.getByTestId("current-exercise")).toHaveText(/Dumbbell Bench Press/i);
    await expect(page.getByRole("button", { name: /Barbell Bench Press set 1 completed/ })).toBeVisible();
  });
});
