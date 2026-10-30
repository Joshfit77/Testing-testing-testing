import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

// The 3D anatomical figure is kept isolated on its own showcase page (/train/3d): the exercise library and the workout
// show the 2.5D video where one exists and the animated illustration everywhere else. Runs on software WebGL
// (playwright.config.ts).
test.describe("3D anatomical demonstration", () => {
  test("stays on its showcase page; the library and the workout show the 2.5D video or the illustration", async ({ page }) => {
    test.setTimeout(300_000);
    await signUpAndConfirm(page, uniqueEmail("demo3d"));
    await completeOnboarding(page);

    // Exercise pages: no 3D. The swing has no 2.5D clip yet, so it keeps its illustration; the curl has the 2.5D video.
    await page.goto("/train/exercises/kettlebell-swing");
    await expect(page.locator("canvas[data-motion-canvas]")).toBeVisible();
    await expect(page.getByTestId("exercise-demo-3d")).toHaveCount(0);
    await page.goto("/train/exercises/dumbbell-curl");
    await expect(page.getByTestId("exercise-demo-25d")).toBeVisible();
    await expect(page.getByTestId("exercise-demo-3d")).toHaveCount(0);

    // The showcase page: the five exercises as tabs, the real player for the chosen one, switched in place.
    await page.goto("/train/3d");
    const showcase = page.getByTestId("showcase-3d");
    await expect(showcase.getByRole("tab")).toHaveCount(5);
    await expect(showcase.getByTestId("exercise-demo-3d")).toHaveAttribute("data-phase", "ready", { timeout: 180_000 });
    await showcase.getByTestId("exercise-demo-3d").getByRole("button", { name: "Pause" }).dispatchEvent("click");
    await showcase.getByRole("tab", { name: "Dumbbell Biceps Curl" }).dispatchEvent("click");
    await expect(showcase.getByRole("tab", { name: "Dumbbell Biceps Curl" })).toHaveAttribute("aria-selected", "true");
    await expect(showcase.getByTestId("exercise-demo-3d")).toHaveAttribute("data-phase", "ready", { timeout: 180_000 });
    await expect(showcase.locator("canvas[role=img]")).toHaveAttribute("aria-label", /performing the Dumbbell Biceps Curl/);
    await showcase.getByTestId("exercise-demo-3d").getByRole("button", { name: "Pause" }).dispatchEvent("click");
    await expect(showcase.getByText(/Preview, awaiting the owner/)).toBeVisible();

    // Every other exercise keeps the illustration only.
    await page.goto("/train/exercises/back-squat");
    await expect(page.getByTestId("exercise-demo-3d")).toHaveCount(0);
    await expect(page.locator("canvas[data-motion-canvas]")).toBeVisible();

    // The workout screen: the swing added to today's workout, its demonstration opened from the card: the illustration.
    await page.goto("/train/workout");
    await page.getByRole("button", { name: "Add exercise" }).click();
    const picker = page.getByRole("dialog");
    await picker.getByPlaceholder("Search by name or muscle").fill("Kettlebell Swing");
    await picker.getByRole("button", { name: /^Kettlebell Swing/ }).first().click();
    await expect(picker).toBeHidden();
    await page.getByRole("button", { name: "Show the Kettlebell Swing demonstration larger" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("canvas[data-motion-canvas]")).toBeVisible();
    await expect(dialog.getByTestId("exercise-demo-3d")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Without WebGL the showcase's player falls back to the illustration, with a note, and no 3D controls.
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return /webgl/i.test(type) ? null : (get as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
      } as typeof get;
    });
    await page.goto("/train/3d");
    const noGl = page.getByTestId("showcase-3d").getByTestId("exercise-demo-3d");
    await expect(noGl).toHaveAttribute("data-phase", "fallback");
    await expect(noGl.getByText("3D isn't available on this device, so here is the illustration.")).toBeVisible();
    await expect(noGl.locator("canvas[data-motion-canvas]")).toBeVisible();
    await expect(noGl.getByText("3D anatomical demo")).toHaveCount(0);
  });
});
