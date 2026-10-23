import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

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

test.describe("live GPS runs and walks", () => {
  test("records a walk with a pause, saves it once with its route, and shows it in history", async ({ page, context }) => {
    test.setTimeout(180_000);
    const email = uniqueEmail("gps-walk");
    await signUpAndConfirm(page, email);
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
    await signUpAndConfirm(page, email);
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
    await signUpAndConfirm(page, email);
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
});
