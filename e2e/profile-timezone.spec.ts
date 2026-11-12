import { expect, test } from "@playwright/test";
import { completeOnboarding, serviceRest, signUpAndConfirm, uniqueEmail, userIdFor } from "./helpers";

/**
 * The Profile form lists time zones. Each browser engine has its own list (Safari's isn't Node's, and Node's has no
 * "UTC"), so a list rendered on the server and again in the browser broke hydration in WebKit on every visit (React
 * error #418), and a member whose zone wasn't in the list saw the select fall back to its first entry, which saving
 * would have stored. Here the browser is given a different list, the way Safari's differs, before any script runs.
 */
test("Profile: a browser with its own list of time zones hydrates cleanly and keeps the member's zone", async ({ page }) => {
  const email = uniqueEmail("tz");
  await signUpAndConfirm(page, email);
  await completeOnboarding(page);
  const uid = await userIdFor(email);
  const rows = await serviceRest<{ timezone: string }[]>(`profiles?id=eq.${uid}&select=timezone`);
  const timezone = rows[0]!.timezone;

  await page.addInitScript(() => {
    const original = Intl.supportedValuesOf.bind(Intl);
    // Newer names first, as WebKit lists them, and a zone list without the old spellings.
    (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf = (k: string) =>
      k === "timeZone" ? ["Europe/Kyiv", "Asia/Kolkata", ...original("timeZone").filter((z) => z !== "Europe/Kiev" && z !== "Asia/Calcutta")] : original(k as never);
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/profile");
  await page.waitForLoadState("networkidle");

  expect(errors.filter((e) => /418|hydrat/i.test(e)), "no hydration error").toEqual([]);
  const select = page.getByLabel("Time zone");
  await expect(select, "the member's own zone stays selected").toHaveValue(timezone);
  // The device's full list is filled in after hydration, with the member's zone and UTC in it.
  await expect.poll(async () => select.locator("option").count()).toBeGreaterThan(100);
  await expect(select.locator('option[value="Europe/Kyiv"]')).toHaveCount(1);
  await expect(select.locator('option[value="UTC"]')).toHaveCount(1);
});
