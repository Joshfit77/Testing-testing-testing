import { expect, test, type Browser, type Page, type Route } from "@playwright/test";
import { PASSWORD, completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";
import { BAR_CODE } from "./off-mock";

/**
 * Reliability closure (2026-11-17, docs/launch-readiness/04_RELIABILITY_CLOSURE.md): the browser-level gaps left by
 * workout-reliability, workout-data-preservation, fast-logging and gps-run. Each test checks what is stored on the
 * ACCOUNT (history, or a second signed-in browser), not only what the page still shows.
 *
 * Chromium approximations, not device tests: "offline" is Chromium's network emulation, "killed" is a reload, the clock
 * change is Playwright's clock, and the camera refusal is a getUserMedia that rejects. The device list in the document
 * above covers the real thing.
 */
const OFF_PORT = Number(process.env.E2E_OFF_MOCK_PORT ?? 0);

async function startWorkout(page: Page) {
  await page.goto("/home");
  await page.getByRole("link", { name: /^Start (Today's Workout|workout)/i }).click();
  await page.waitForURL(/\/train\/workout/);
  await page.getByLabel(/set 1 weight in lb/).first().waitFor();
}

const syncStatus = (page: Page) => page.locator("main").getByRole("status").filter({ hasText: /Synced|Saving|Saved on device/ });

async function logSet(page: Page, n: number, lb: string) {
  await page.getByLabel(new RegExp(`set ${n} weight in lb`)).first().fill(lb);
  await page.getByRole("button", { name: new RegExp(`Mark .* set ${n} complete`) }).first().click();
  await expect(page.getByRole("button", { name: new RegExp(`set ${n} completed`) }).first()).toBeVisible();
}

async function tapFinish(page: Page) {
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish & save" }).click();
}

/** The member's saved workouts, as History lists them. */
async function historyEntries(page: Page) {
  await page.goto("/train/history");
  await expect(page.getByRole("heading", { name: "Workout history" })).toBeVisible();
  return page.locator('main a[href^="/train/history/"]');
}

/** Sum of the reps typed in the first exercise's first `n` sets. */
async function repsOf(page: Page, n: number) {
  let sum = 0;
  for (let i = 1; i <= n; i++) sum += Number(await page.getByLabel(new RegExp(`set ${i} reps`)).first().inputValue());
  return sum;
}

/** Volume shown on the completion screen (pounds): what the server reports it saved. */
async function savedVolumeLb(page: Page) {
  const text = (await page.getByTestId("stat-volume").locator("dd").textContent()) ?? "";
  return Number(text.replace(/[^\d]/g, ""));
}

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

/** Finish requests (a server action whose payload carries the end time); in-progress backups pass through. */
const isFinish = (route: Route) => route.request().method() === "POST" && Boolean(route.request().headers()["next-action"]) && (route.request().postData() ?? "").includes('"endedAt"');

test.describe("reliability closure: workouts", () => {
  test("reloaded while offline (the app killed before the backup landed): the offline page says the workout is kept, and every set comes back", async ({ page, context, browser }) => {
    const email = uniqueEmail("closure-kill");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await startWorkout(page);
    // The production build registers the service worker (the browser and installed web app; not the phone app).
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller)), { timeout: 20_000 }).toBe(true);

    await logSet(page, 1, "135");
    await expect(syncStatus(page)).toHaveText(/Synced/);
    await context.setOffline(true);
    await logSet(page, 2, "145");
    await expect(syncStatus(page)).toHaveText(/Saved on device/);

    // Reloading with no connection: the service worker answers with the offline page, which says the workout is safe.
    await page.reload();
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
    await expect(page.getByText(/If you were logging a workout, it's saved on this device/)).toBeVisible();

    // Connection back: reopening the workout restores set 2 from the device (the account only has set 1) and sends it.
    await context.setOffline(false);
    await page.goto("/train/workout");
    await expect(page.getByRole("button", { name: /set 2 completed/ }).first()).toBeVisible();
    await expect(page.getByLabel(/set 2 weight in lb/).first()).toHaveValue("145");
    await expect(syncStatus(page)).toHaveText(/Synced/, { timeout: 20_000 });

    const { other, close } = await openOnAnotherDevice(browser, email);
    await expect(other.getByRole("button", { name: /set 2 completed/ }).first()).toBeVisible();
    await expect(other.getByLabel(/set 2 weight in lb/).first()).toHaveValue("145");
    await close();
  });

  test("finished while offline, then reconnected: one workout saved, with both sets once", async ({ page, context }) => {
    const email = uniqueEmail("closure-offline-finish");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await startWorkout(page);
    await logSet(page, 1, "135");
    await expect(syncStatus(page)).toHaveText(/Synced/);

    await context.setOffline(true);
    await logSet(page, 2, "135");
    const reps = await repsOf(page, 2);
    await tapFinish(page);
    await expect(page.getByText(/You appear to be offline\. Your workout is saved on this device/)).toBeVisible();
    // Still the workout, with both sets: nothing was cleared by the failed finish.
    await expect(page.getByRole("button", { name: /set 2 completed/ }).first()).toBeVisible();

    await context.setOffline(false);
    await expect(syncStatus(page)).toHaveText(/Synced/, { timeout: 20_000 });
    await tapFinish(page);
    await expect(page.getByRole("heading", { name: /Workout complete/i })).toBeVisible();
    expect(Math.abs((await savedVolumeLb(page)) - 135 * reps)).toBeLessThanOrEqual(1);
    const volume = (await page.getByTestId("stat-volume").locator("dd").textContent())!.trim();

    const entries = await historyEntries(page);
    await expect(entries).toHaveCount(1);
    await expect(entries.first()).toContainText(volume);
    // Nothing left to resume on Home.
    await page.goto("/home");
    await expect(page.getByRole("link", { name: /^Resume/ })).toHaveCount(0);
  });

  test("Finish refused by the server, then its reply lost after saving: the retries save one workout, every set once", async ({ page }) => {
    const email = uniqueEmail("closure-finish-retry");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await startWorkout(page);
    await logSet(page, 1, "135");
    await page.waitForTimeout(800); // a second tap straight after the first counts as the same tap
    await logSet(page, 2, "135");
    const reps = await repsOf(page, 2);
    await expect(syncStatus(page)).toHaveText(/Synced/);

    let attempt = 0;
    await page.route("**/train/workout**", async (route) => {
      if (!isFinish(route)) return route.fallback();
      attempt += 1;
      if (attempt === 1) return route.fulfill({ status: 500, body: "" }); // a server error: nothing saved
      if (attempt === 2) {
        await route.fetch(); // the server saves the workout ...
        return route.abort("connectionreset"); // ... and the reply never reaches the phone
      }
      return route.fallback();
    });

    await tapFinish(page);
    await expect(page.getByText(/isn't saved yet|appear to be offline|couldn't/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /set 2 completed/ }).first()).toBeVisible();
    await tapFinish(page);
    await expect(page.getByText(/isn't saved yet|appear to be offline|couldn't/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /set 2 completed/ }).first()).toBeVisible();
    await tapFinish(page);
    await expect(page.getByRole("heading", { name: /Workout complete/i })).toBeVisible();
    expect(attempt).toBe(3);
    // The third answer is the workout the second attempt saved: its volume counts the two sets once.
    expect(Math.abs((await savedVolumeLb(page)) - 135 * reps)).toBeLessThanOrEqual(1);

    const volume = (await page.getByTestId("stat-volume").locator("dd").textContent())!.trim();
    const entries = await historyEntries(page);
    await expect(entries).toHaveCount(1);
    await expect(entries.first()).toContainText(volume);
  });

  test("the same workout in two tabs: each tab picks up the other's sets, and finishing in one doesn't bring it back in the other", async ({ page, context }) => {
    const email = uniqueEmail("closure-tabs");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await startWorkout(page);
    await logSet(page, 1, "135");

    const second = await context.newPage();
    await second.goto("/train/workout");
    await expect(second.getByRole("button", { name: /set 1 completed/ }).first()).toBeVisible();
    await logSet(second, 2, "140");
    // The first tab switches to the newer copy instead of writing its older one over it.
    await expect(page.getByRole("button", { name: /set 2 completed/ }).first()).toBeVisible();
    await expect(page.getByLabel(/set 2 weight in lb/).first()).toHaveValue("140");

    await tapFinish(page);
    await expect(page.getByRole("heading", { name: /Workout complete/i })).toBeVisible();

    // The second tab is reloaded (or the member comes back to it): the finished workout is not offered again.
    // /train/workout with nothing to restore opens an empty workout ("No exercises yet").
    await second.reload();
    await expect(second.getByText("No exercises yet")).toBeVisible();
    await expect(second.getByRole("heading", { name: /Unfinished workout|Workout in progress/ })).toHaveCount(0);
    await expect(second.getByRole("button", { name: /set 1 completed/ })).toHaveCount(0);
    await second.close();
    await expect(await historyEntries(page)).toHaveCount(1);
  });

  test("the phone's clock is put back during a workout: Finish still saves it (it used to be refused on every try)", async ({ page }) => {
    await page.clock.install();
    const email = uniqueEmail("closure-clock");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await startWorkout(page);
    await logSet(page, 1, "135");
    await expect(syncStatus(page)).toHaveText(/Synced/);

    // A manual clock change (or a wrong clock corrected) three hours back, mid-workout.
    await page.clock.setSystemTime(new Date(Date.now() - 3 * 3600_000));
    await page.waitForTimeout(800);
    await logSet(page, 2, "135");
    await expect(syncStatus(page)).toHaveText(/Synced/);
    await tapFinish(page);
    await expect(page.getByRole("heading", { name: /Workout complete/i })).toBeVisible();
    await expect(await historyEntries(page)).toHaveCount(1);
  });

  test("a damaged copy of the workout on the device doesn't take the workout screen down: the account's copy comes back", async ({ page }) => {
    const email = uniqueEmail("closure-crash");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await startWorkout(page);
    await logSet(page, 1, "135");
    await expect(syncStatus(page)).toHaveText(/Synced/);

    // The device copy is replaced by one the logger cannot draw (newer, so it would be the one restored).
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith("ngf.workout.draft."))!;
      const d = JSON.parse(localStorage.getItem(key)!);
      localStorage.setItem(key, JSON.stringify({ ...d, updatedAt: new Date(Date.now() + 60_000).toISOString(), exercises: [{ id: "broken" }] }));
    });
    await page.reload();
    await expect(page.getByText("We couldn't load this page")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /set 1 completed/ }).first()).toBeVisible();
    await expect(page.getByLabel(/set 1 weight in lb/).first()).toHaveValue("135");
  });
});

test.describe("reliability closure: camera refused", () => {
  test("barcode scanner with the camera refused: says how to allow it, and typing the barcode logs the food", async ({ page, context }) => {
    test.skip(!OFF_PORT, "Needs the Open Food Facts stand-in: set E2E_OFF_MOCK_PORT and start the app with OFF_API_BASE_URL pointing at it.");
    await context.grantPermissions([]);
    // The browser refuses the camera (what a member's "Block" or a site setting does).
    await page.addInitScript(() => {
      const refuse = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: refuse, enumerateDevices: async () => [] } });
    });
    const email = uniqueEmail("closure-camera");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await page.goto("/nutrition");
    await page.getByRole("button", { name: "Add food" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Scan" }).click();
    await dialog.getByRole("button", { name: /Start camera/ }).click();
    await expect(dialog.getByRole("alert")).toHaveText(/Camera permission was denied\. Allow camera access for this site in your browser settings/);

    await dialog.getByRole("button", { name: "Type the barcode instead" }).click();
    await dialog.getByLabel("Barcode number").fill(BAR_CODE);
    await dialog.getByRole("button", { name: "Look up" }).click();
    await expect(dialog.getByTestId("amount-food-name")).toContainText("Peanut Protein Bar");
    await dialog.getByRole("button", { name: "Log food" }).click();
    await expect(dialog.getByRole("status")).toHaveText(/Logged Peanut Protein Bar/);
  });
});
