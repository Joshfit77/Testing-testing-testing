import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test("gate replays after a full reload, not on internal tab navigation", async ({ page }) => {
  await signUpAndConfirm(page, uniqueEmail("gate"));
  await completeOnboarding(page);

  await page.reload();
  const opening = page.getByRole("dialog", { name: "Narrow Gate Fitness opening" });
  await expect(opening).toBeVisible();
  await expect(opening.getByText(/Matthew 7:13/)).toBeVisible();
  await expect(opening.getByTestId("animated-narrow-door")).toBeVisible();
  await opening.getByRole("button", { name: "Enter the app" }).click();
  await expect(opening).toHaveCount(0);

  await page.getByRole("navigation", { name: "Main sections" }).last().getByRole("link", { name: "Train" }).click();
  await expect(opening).toHaveCount(0);

  await page.reload();
  await expect(opening).toBeVisible();
  await opening.getByRole("button", { name: "Skip intro" }).click();
  await expect(opening).toHaveCount(0);
});
