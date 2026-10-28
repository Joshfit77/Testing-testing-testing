import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

// The 3D anatomical figure for the exercises in src/lib/anatomy3d/in-app.ts (the kettlebell swing), with the animated
// illustration while it loads, as a choice, and when WebGL is missing. Runs on software WebGL (playwright.config.ts).
test.describe("3D anatomical demonstration", () => {
  test("the kettlebell swing shows the 3D figure on its page and in the workout; the illustration stays as fallback and choice", async ({ page }) => {
    test.setTimeout(300_000);
    await signUpAndConfirm(page, uniqueEmail("demo3d"));
    await completeOnboarding(page);

    // Exercise page: the figure loads, its controls work, and the illustration can be chosen instead.
    await page.goto("/train/exercises/kettlebell-swing");
    const demo = page.getByTestId("exercise-demo-3d");
    await expect(demo).toBeVisible();
    await expect(demo).toHaveAttribute("data-phase", "ready", { timeout: 180_000 });
    await expect(demo.getByText("3D anatomical demo")).toBeVisible();
    const canvas = demo.locator("canvas[role=img]");
    await expect(canvas).toHaveAttribute("aria-label", /3D anatomical figure performing the Kettlebell Swing/);
    expect(await canvas.evaluate((c: HTMLCanvasElement) => c.width > 0 && c.height > 0)).toBe(true);
    await demo.getByRole("button", { name: "Pause" }).click();
    await expect(demo.getByRole("button", { name: "Play" })).toBeVisible();
    await demo.getByRole("button", { name: "Side" }).click();
    await expect(demo.getByRole("button", { name: "Side" })).toHaveAttribute("aria-pressed", "true");
    await demo.getByRole("button", { name: "Muscle Glow" }).click();
    await expect(demo.getByRole("button", { name: "Muscle Glow" })).toHaveAttribute("aria-pressed", "false");
    await demo.getByRole("button", { name: "Show the illustration" }).click();
    await expect(demo).toHaveAttribute("data-phase", "illustration");
    const illustration = demo.locator("canvas[data-motion-canvas]");
    await expect(illustration).toBeVisible();
    await expect(illustration).toHaveAttribute("aria-label", /Animated demonstration of Kettlebell Swing/);
    await demo.getByRole("button", { name: "Show the 3D figure" }).click();
    await expect(demo).toHaveAttribute("data-phase", "ready", { timeout: 60_000 });
    await demo.getByRole("button", { name: "Pause" }).dispatchEvent("click");

    // Every other exercise keeps the illustration only.
    await page.goto("/train/exercises/back-squat");
    await expect(page.getByTestId("exercise-demo-3d")).toHaveCount(0);
    await expect(page.locator("canvas[data-motion-canvas]")).toBeVisible();

    // The workout screen: the swing added to today's workout, its demonstration opened from the card.
    await page.goto("/train/workout");
    await page.getByRole("button", { name: "Add exercise" }).click();
    const picker = page.getByRole("dialog");
    await picker.getByPlaceholder("Search by name or muscle").fill("Kettlebell Swing");
    await picker.getByRole("button", { name: /^Kettlebell Swing/ }).first().click();
    await expect(picker).toBeHidden();
    await page.getByRole("button", { name: "Show the Kettlebell Swing demonstration larger" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("exercise-demo-3d")).toHaveAttribute("data-phase", "ready", { timeout: 120_000 });
    await expect(dialog.getByText(/3D anatomical figure performing the movement/)).toBeVisible();
    // (Paused first: on software WebGL a frame can take seconds, and the dialog closes only between frames.)
    await dialog.getByRole("button", { name: "Pause" }).dispatchEvent("click");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 60_000 });

    // Without WebGL: the illustration, with a note, and no 3D controls.
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return /webgl/i.test(type) ? null : (get as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
      } as typeof get;
    });
    await page.goto("/train/exercises/kettlebell-swing");
    const noGl = page.getByTestId("exercise-demo-3d");
    await expect(noGl).toHaveAttribute("data-phase", "fallback");
    await expect(noGl.getByText("3D isn't available on this device, so here is the illustration.")).toBeVisible();
    await expect(noGl.locator("canvas[data-motion-canvas]")).toBeVisible();
    await expect(noGl.getByRole("button", { name: "Pause demonstration" })).toBeVisible();
    await expect(noGl.getByText("3D anatomical demo")).toHaveCount(0);
  });
});
