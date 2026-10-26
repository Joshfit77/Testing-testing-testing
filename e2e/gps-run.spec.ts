import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { completeOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * Live GPS recording in the browser, with a scripted route fed through Chromium's location override (simulated GPS).
 * Covers start, waiting for a fix, recording, pause/resume, finish, review, save, the saved route and splits, a
 * guided program run, and denied permission. Background / locked-screen recording needs a real phone and isn't
 * tested here.
 */
const LAT0 = 40.0;
const LNG0 = -75.0;
const M_PER_DEG = 111_195;

/** Walk north at `speed` m/s for `seconds`, one location update a second. Returns the metres covered. */
async function moveNorth(context: BrowserContext, page: Page, fromM: number, seconds: number, speed: number): Promise<number> {
  let m = fromM;
  for (let i = 0; i < seconds; i++) {
    m += speed;
    await context.setGeolocation({ latitude: LAT0 + m / M_PER_DEG, longitude: LNG0, accuracy: 5 });
    await page.waitForTimeout(1000);
  }
  return m;
}

/** Live GPS recording is part of Pro All Access (Free is covered in memberships.spec.ts). */
async function signUpPro(page: Page, email: string) {
  await signUpAndConfirm(page, email);
  await grantPlan(email, "pro");
}

test.describe("live GPS runs and walks", () => {
  test("records a walk with a pause, saves it once with its route, and shows it in history", async ({ page, context }) => {
    test.setTimeout(180_000);
    const email = uniqueEmail("gps-walk");
    await signUpPro(page, email);
    await completeOnboarding(page);
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: LAT0, longitude: LNG0, accuracy: 5 });

    await page.goto("/run");
    await page.getByRole("link", { name: /Outdoor walk/ }).click();
    await page.waitForURL(/\/run\/record\?kind=walk/);
    await expect(page.getByRole("radio", { name: /Outdoor walk/ })).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("gps-start").click();
    await expect(page.getByTestId("gps-recording")).toBeVisible();

    let m = await moveNorth(context, page, 0, 25, 3);
    await expect(page.getByTestId("gps-accuracy")).toHaveText("GPS ±5 m");
    const firstDistance = await page.getByTestId("gps-distance").innerText();
    expect(firstDistance).not.toMatch(/^0(\.00)? /);
    // GPS details: source, accuracy and counts (never a position); the live map shows where you are now.
    await page.getByText("GPS details").click();
    await expect(page.getByTestId("gps-detail-source")).toContainText("Browser location");
    await expect(page.getByTestId("gps-detail-accuracy-now")).toHaveText(/±(5 m|16 ft)/);
    await expect(page.getByTestId("gps-detail-readings-used")).toHaveText(/^\d+ of \d+/);
    await expect(page.getByTestId("gps-details")).not.toContainText("40.0");
    await expect(page.getByTestId("route-current")).toBeVisible();

    // Pause: moving 200 m while paused (e.g. a car ride) adds nothing.
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByText("Paused", { exact: true })).toBeVisible();
    m += 200;
    await context.setGeolocation({ latitude: LAT0 + m / M_PER_DEG, longitude: LNG0, accuracy: 5 });
    await page.waitForTimeout(2500);
    await expect(page.getByTestId("gps-distance")).toHaveText(firstDistance);
    await page.getByRole("button", { name: "Resume" }).click();
    m = await moveNorth(context, page, m, 20, 3);

    await page.getByRole("button", { name: "Finish" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Finish" }).click();
    const review = page.getByTestId("gps-review");
    await expect(review.getByRole("heading", { name: "Walk complete" })).toBeVisible();
    await expect(review.getByTestId("route-map")).toBeVisible();
    const distance = await review.getByTestId("review-distance").innerText();
    // About 2 × (20–25 s × 3 m/s): well under the 200 m skipped during the pause.
    const value = Number(distance.split(" ")[0]);
    const metres = distance.endsWith("mi") ? value * 1609.344 : value * 1000;
    expect(metres).toBeGreaterThan(90);
    expect(metres).toBeLessThan(170);
    await review.getByLabel("Notes (optional)").fill("Evening walk");

    // A double tap (two clicks in the same frame) saves once.
    await review.getByTestId("gps-save").evaluate((b: HTMLButtonElement) => {
      b.click();
      b.click();
    });
    await page.waitForURL(/\/run\/activities\/[0-9a-f-]{36}\?saved=1/);
    await expect(page.getByText("Walk saved.")).toBeVisible();
    await expect(page.getByTestId("route-map")).toBeVisible();
    await expect(page.getByTestId("activity-distance")).toHaveText(distance);
    await expect(page.getByTestId("activity-notes")).toHaveText("Evening walk");

    await page.goto("/run?tab=history");
    await expect(page.getByText("Evening walk").or(page.getByRole("link", { name: /Walk/ })).first()).toBeVisible();
    const rows = page.getByTestId(/^week-/).getByRole("listitem");
    await expect(rows).toHaveCount(1);

    // Goals: a weekly distance (the walk counts toward it) and a target time, then remove one.
    await page.goto("/run");
    await page.getByLabel(/^Goal distance/).fill("10");
    await page.getByRole("button", { name: "Add goal" }).click();
    const goals = page.getByTestId("run-goals");
    await expect(goals).toContainText("a week");
    await expect(goals).toContainText("so far this week");
    await expect(goals.getByRole("img", { name: /% of the goal/ })).toBeVisible();
    await page.getByLabel("Goal", { exact: true }).selectOption("race_time");
    await page.getByLabel("Race").selectOption({ label: "5K" });
    await page.getByLabel("Target time").fill("28:00");
    await page.getByRole("button", { name: "Add goal" }).click();
    await expect(goals).toContainText("5K in 28:00");
    await expect(goals).toContainText("No 5K run yet");
    await page.getByRole("button", { name: "Remove goal: 5K in 28:00" }).click();
    await expect(goals).not.toContainText("5K in 28:00");
    await expect(goals.getByRole("listitem")).toHaveCount(1);
  });

  test("a running day of the member's program is recorded as a guided run", async ({ page, context }) => {
    const email = uniqueEmail("gps-guided");
    await signUpPro(page, email);
    await completeOnboarding(page);
    await page.goto("/train/programs/walk-to-run-beginner");
    await page.getByRole("button", { name: "Start program" }).click();
    await page.waitForLoadState("networkidle");

    await page.goto("/run");
    const card = page.getByTestId("guided-run-card");
    await expect(card).toContainText("Today: Walk/Jog A");
    await card.click();
    await page.waitForURL(/\/run\/record\?day=/);
    await expect(page.getByRole("heading", { name: /Walk\/Jog A/ })).toBeVisible();
    await expect(page.getByText("Jog easy").or(page.getByText("Run easy")).first()).toBeVisible();

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: LAT0, longitude: LNG0, accuracy: 5 });
    await page.getByTestId("gps-start").click();
    await expect(page.getByTestId("guided-phase")).toContainText("Warm-up: brisk walk");
    await expect(page.getByTestId("guided-phase")).toContainText("Next: Run easy");
  });

  test("says clearly when location permission is off", async ({ page }) => {
    const email = uniqueEmail("gps-denied");
    await signUpPro(page, email);
    await completeOnboarding(page);
    // Headless Chromium leaves an unanswered permission prompt pending forever, so answer "Don't allow" the way the
    // browser reports it: the watcher's error callback with PERMISSION_DENIED.
    await page.addInitScript(() => {
      navigator.geolocation.watchPosition = (_ok, fail) => {
        setTimeout(() => fail?.({ code: 1, message: "User denied Geolocation", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError), 50);
        return 1;
      };
    });
    await page.goto("/run/record?kind=run");
    await page.getByTestId("gps-start").click();
    await expect(page.getByText(/Location permission is off for this app/)).toBeVisible({ timeout: 30_000 });
  });

  test("a brief loss of signal shows a warning that clears when fixes come back", async ({ page, context }) => {
    test.setTimeout(120_000);
    const email = uniqueEmail("gps-blip");
    await signUpPro(page, email);
    await completeOnboarding(page);
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: LAT0, longitude: LNG0, accuracy: 5 });
    // The phone reports "position unavailable" once (e.g. in a tunnel), then real fixes continue.
    await page.addInitScript(() => {
      const watch = navigator.geolocation.watchPosition.bind(navigator.geolocation);
      navigator.geolocation.watchPosition = (ok, fail, opts) => {
        setTimeout(() => fail?.({ code: 2, message: "Position unavailable", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError), 50);
        return watch(ok, fail, opts);
      };
    });
    await page.goto("/run/record?kind=run");
    await page.getByTestId("gps-start").click();
    const warning = page.getByText(/Your location isn't available right now/);
    await expect(warning).toBeVisible();
    await moveNorth(context, page, 0, 4, 3);
    await expect(page.getByTestId("gps-recording")).toBeVisible();
    await expect(warning).toHaveCount(0);
  });

  test("explains when the device only shares an approximate location", async ({ page, context }) => {
    await signUpPro(page, uniqueEmail("gps-approx"));
    await completeOnboarding(page);
    await context.grantPermissions(["geolocation"]);
    // iPhone "Precise Location" off: fixes arrive, but only to within a couple of kilometres.
    await context.setGeolocation({ latitude: LAT0, longitude: LNG0, accuracy: 2500 });
    await page.goto("/run/record?kind=walk");
    await page.getByTestId("gps-start").click();
    for (let i = 1; i <= 4; i++) {
      await context.setGeolocation({ latitude: LAT0 + (i * 2) / M_PER_DEG, longitude: LNG0, accuracy: 2500 });
      await page.waitForTimeout(800);
    }
    await expect(page.getByTestId("gps-hint-precise")).toContainText("Precise Location");
    await expect(page.getByText("Waiting for GPS")).toBeVisible();
    await expect(page.getByTestId("gps-distance")).toHaveText(/^0(\.00)? /);
  });

  test("signing out during a walk leaves no recording on the device, and the next member sees nothing to continue", async ({ page, context }) => {
    test.setTimeout(180_000);
    const first = uniqueEmail("gps-signout");
    await signUpPro(page, first);
    await completeOnboarding(page);
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: LAT0, longitude: LNG0, accuracy: 5 });
    await page.goto("/run/record?kind=walk");
    await page.getByTestId("gps-start").click();
    await expect(page.getByTestId("gps-recording")).toBeVisible();
    await moveNorth(context, page, 0, 8, 3);
    // The recording is kept on the device while it runs (so a crash or reload can continue it).
    const keysWhileRecording = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("run.recording.")));
    expect(keysWhileRecording).toHaveLength(1);

    // Sign out from the profile page while the walk is still recording.
    await page.goto("/profile");
    await page.locator("main").getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);
    await expect(page.getByRole("heading", { name: /Sign in|Welcome back/ })).toBeVisible();
    // The login page finishes the clean-up once it has mounted (the recorder may have written once more on the way out).
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("run.recording.") || k.startsWith("ngf.draft.")))).toEqual([]);

    // Another member on the same device: nothing of the first member's walk is offered or readable.
    const second = uniqueEmail("gps-next");
    await signUpPro(page, second);
    await completeOnboarding(page);
    await page.goto("/run/record?kind=walk");
    await expect(page.getByTestId("gps-start")).toBeVisible();
    await expect(page.getByText(/You have an unfinished/)).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("run.recording.")))).toEqual([]);
  });

  test("a reload while signed in offers to continue the same member's walk", async ({ page, context }) => {
    test.setTimeout(120_000);
    await signUpPro(page, uniqueEmail("gps-reload"));
    await completeOnboarding(page);
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: LAT0, longitude: LNG0, accuracy: 5 });
    await page.goto("/run/record?kind=walk");
    await page.getByTestId("gps-start").click();
    await expect(page.getByTestId("gps-recording")).toBeVisible();
    await moveNorth(context, page, 0, 8, 3);
    await page.reload();
    await expect(page.getByText(/You have an unfinished walk/)).toBeVisible();
    await page.getByRole("button", { name: "Continue recording" }).click();
    await expect(page.getByTestId("gps-recording")).toBeVisible();
    // Discard is offered while paused.
    await page.getByRole("button", { name: "Pause" }).click();
    await page.getByRole("button", { name: "Discard recording" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Discard" }).click();
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("run.recording.")))).toEqual([]);
  });
});
