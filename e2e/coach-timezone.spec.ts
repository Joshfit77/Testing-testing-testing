import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * The coach shows when each message was sent ("Today at 9:24 AM"). Built from the clock during the server render, that
 * text used the server's time zone, so a member anywhere else got different text from the browser and React error #418
 * on every visit to the coach. The browser here runs fourteen hours ahead of UTC, so hour (and often day) differ.
 */
test.use({ timezoneId: "Pacific/Kiritimati" });

test("AI Coach: message times hydrate cleanly in a time zone far from the server's", async ({ page }) => {
  const email = uniqueEmail("coachtz");
  await signUpAndConfirm(page, email);
  await completeOnboarding(page);
  // The chat (and its time stamps) is shown to members whose plan includes the coach; Free sees the Pro card.
  await grantPlan(email, "pro");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/coach");
  await page.waitForLoadState("networkidle");
  const allow = page.getByRole("button", { name: "Allow and continue" });
  if (await allow.isVisible()) {
    await allow.click();
    await page.waitForLoadState("networkidle");
  }
  expect(errors.filter((e) => /418|hydrat/i.test(e)), "no hydration error").toEqual([]);
  // The stamp is filled in by the browser, in the browser's own clock.
  await expect(page.getByText(/^Today at \d{1,2}:\d{2} [AP]M$/).first()).toBeVisible();
});
