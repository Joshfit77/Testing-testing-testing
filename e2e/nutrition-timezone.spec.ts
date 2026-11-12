import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * A phone fourteen hours ahead of the server (the server runs in UTC here and in CI). The Nutrition page's "Recent
 * foods" card names the meal for the time of day; it used to work that out during render, so the server's answer
 * ("breakfast") and the phone's ("dinner") differed and React threw hydration error #418 on every visit from a phone
 * in another time zone (found by the demo capture, which emulates New York). The meal is now read on the device only.
 */
test.use({ timezoneId: "Pacific/Kiritimati" });

test("Nutrition hydrates cleanly on a phone in another time zone, with recent foods on the page", async ({ page }) => {
  await signUpAndConfirm(page, uniqueEmail("ntz"));
  await completeOnboarding(page);
  await page.goto("/nutrition");
  await page.locator("main details").evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
  await page.getByRole("button", { name: "Quick add calories to breakfast" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Calories").fill("300");
  await dialog.getByRole("button", { name: "Add to breakfast" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Added 300 kcal to Breakfast.");
  await page.keyboard.press("Escape");

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/nutrition");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("quick-relog-section")).toBeVisible();
  await expect(page.getByText(/One tap adds the amount shown to (breakfast|lunch|dinner|snacks)\./)).toBeVisible();
  expect(errors.filter((e) => /418|423|hydrat/i.test(e)), "no hydration error").toEqual([]);
});
