import { expect, test, type Browser, type Page } from "@playwright/test";
import { PASSWORD, completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * A workout in progress loses nothing when the connection drops, when the server refuses a save, or when the member
 * leaves the app. Each test checks the ACCOUNT copy from a second, separate browser (another device, nothing shared
 * on the device), not only what the first page still shows.
 *
 * Browser approximations, not device tests: "offline" is Chromium's network emulation; "leaving the app" is the
 * page's visibility switching to hidden (what iOS and Android report when the app goes to the background).
 */

async function startWorkout(page: Page) {
  await page.goto("/home");
  await page.getByRole("link", { name: /^Start (Today's Workout|workout)/i }).click();
  await page.waitForURL(/\/train\/workout/);
  await page.getByLabel(/set 1 weight in lb/).first().waitFor();
}

const syncStatus = (page: Page) => page.locator("main").getByRole("status").filter({ hasText: /Synced|Saving|Saved on device/ });

/** Sign the same member in on a fresh browser context and open their workout there. */
async function openOnAnotherDevice(browser: Browser, email: string) {
  const ctx = await browser.newContext({
    storageState: { cookies: [], origins: [{ origin: new URL(test.info().project.use.baseURL ?? "http://localhost:3000").origin, localStorage: [{ name: "ngf.e2e.noIntro", value: "1" }] }] },
  });
  const other = await ctx.newPage();
  await other.goto("/login");
  await other.getByLabel("Email").fill(email);
  await other.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await other.getByRole("button", { name: "Sign in" }).click();
  await other.waitForURL(/\/home/);
  await other.goto("/train/workout");
  await other.getByLabel(/set 1 weight in lb/).first().waitFor();
  return { other, close: () => ctx.close() };
}

test.describe("a workout in progress keeps every set", () => {
  test("logged offline: kept on the device, sent when the connection returns, and on the account", async ({ page, context, browser }) => {
    const email = uniqueEmail("offline");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await startWorkout(page);

    await page.getByLabel(/set 1 weight in lb/).first().fill("135");
    await page.getByRole("button", { name: /Mark .* set 1 complete/ }).first().click();
    await expect(syncStatus(page)).toHaveText(/Synced/);

    await context.setOffline(true);
    await expect(page.getByText(/You're offline\. Keep logging/)).toBeVisible();
    await page.getByLabel(/set 2 weight in lb/).first().fill("145");
    await page.getByRole("button", { name: /Mark .* set 2 complete/ }).first().click();
    await expect(syncStatus(page)).toHaveText(/Saved on device/);

    await context.setOffline(false);
    await expect(page.getByText(/You're offline/)).toHaveCount(0);
    await expect(syncStatus(page)).toHaveText(/Synced/, { timeout: 20_000 });

    const { other, close } = await openOnAnotherDevice(browser, email);
    await expect(other.getByRole("button", { name: /set 1 completed/ }).first()).toBeVisible();
    await expect(other.getByRole("button", { name: /set 2 completed/ }).first()).toBeVisible();
    await expect(other.getByLabel(/set 2 weight in lb/).first()).toHaveValue("145");
    await close();
  });

  test("a save the server refuses is kept on the device and retried until it lands", async ({ page, browser }) => {
    const email = uniqueEmail("savefail");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await startWorkout(page);

    // Every server action fails (a server error, or gym Wi-Fi with no internet behind it) while a set is logged.
    const failing = (route: import("@playwright/test").Route) =>
      route.request().method() === "POST" && route.request().headers()["next-action"] ? route.fulfill({ status: 500, body: "" }) : route.fallback();
    await page.route("**/train/workout**", failing);
    await page.getByLabel(/set 1 weight in lb/).first().fill("150");
    await page.getByRole("button", { name: /Mark .* set 1 complete/ }).first().click();
    await expect(syncStatus(page)).toHaveText(/Saved on device/);
    await expect(page.getByRole("button", { name: /set 1 completed/ }).first()).toBeVisible();

    // The server recovers; the logger's own retry (first one after 5 s) sends the set without the member doing anything.
    await page.unroute("**/train/workout**", failing);
    await expect(syncStatus(page)).toHaveText(/Synced/, { timeout: 20_000 });

    const { other, close } = await openOnAnotherDevice(browser, email);
    await expect(other.getByRole("button", { name: /set 1 completed/ }).first()).toBeVisible();
    await expect(other.getByLabel(/set 1 weight in lb/).first()).toHaveValue("150");
    await close();
  });

  test("leaving the app sends what was typed straight away, not after the typing pause", async ({ page, browser }) => {
    const email = uniqueEmail("background");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await startWorkout(page);
    await page.getByLabel(/set 1 weight in lb/).first().fill("135");
    await page.getByRole("button", { name: /Mark .* set 1 complete/ }).first().click();
    await expect(syncStatus(page)).toHaveText(/Synced/);

    // A number typed and the app sent to the background at once: the save goes out on the visibility change.
    await page.getByLabel(/set 2 weight in lb/).first().fill("155");
    // The typing pause alone would wait 2 s before saving; the visibility change must send it well before that.
    const sent = page.waitForRequest((r) => r.method() === "POST" && Boolean(r.headers()["next-action"]), { timeout: 1_500 });
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await sent;
    await expect(syncStatus(page)).toHaveText(/Synced/);

    const { other, close } = await openOnAnotherDevice(browser, email);
    await expect(other.getByLabel(/set 2 weight in lb/).first()).toHaveValue("155");
    await close();
  });
});
