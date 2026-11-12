import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test("exercise page shows the animated demo with keyboard-operable controls", async ({ page }) => {
  await signUpAndConfirm(page, uniqueEmail("demo"));
  await completeOnboarding(page);

  await page.goto("/train/exercises/back-squat");
  const canvas = page.locator("canvas[data-motion-canvas]");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("aria-label", /Animated demonstration of Barbell Back Squat/);
  // The canvas is actually drawn (non-zero backing store).
  expect(await canvas.evaluate((c: HTMLCanvasElement) => c.width > 0 && c.height > 0)).toBe(true);

  const pause = page.getByRole("button", { name: "Pause demonstration" });
  await expect(pause).toBeVisible();
  await pause.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Play demonstration" })).toBeVisible();

  await page.getByRole("button", { name: /Playback speed normal/ }).click();
  await expect(page.getByRole("button", { name: /Playback speed half/ })).toBeVisible();

  // Library shows still demo thumbnails.
  await page.goto("/train/exercises?q=deadlift");
  await expect(page.locator("canvas[aria-label$=\"demonstration (still)\"]").first()).toBeAttached();
});
