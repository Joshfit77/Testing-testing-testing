import { expect, test, type Page } from "@playwright/test";
import { answerOnboarding, completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * The six Medium usability findings of the 2026-11-12 review, each held to its acceptance criterion:
 * - M1: onboarding at 200% text never scrolls sideways, and Continue is fully on screen when scrolled to.
 * - M2: weight, reps and Complete set are visible without scrolling at 375 × 667 (and the weight field at 320 × 568).
 * - M3: right after logging a set the rest countdown and Skip rest are in view.
 * - M5: the offline banner names what is kept offline and says food and water need a connection.
 * - M6: the weight and reps −/+ buttons are at least 44 × 44 px, and the inputs stay usable at 320 px.
 * - B7: the membership screen shows the yearly saving in dollars ($89.89, 37%) and offers Restore purchases.
 */

/** Where `testId` sits on screen, and whether it is wholly visible between the sticky header and the bottom tab bar, in px. */
async function inView(page: Page, testId: string) {
  return page.getByTestId(testId).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const tabs = document.querySelector("nav.fixed[aria-label='Main sections']")?.getBoundingClientRect();
    const bottom = tabs && tabs.top > 0 ? tabs.top : window.innerHeight;
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), visibleBottom: Math.round(bottom), fully: r.top >= 0 && r.bottom <= bottom };
  });
}

async function startWorkout(page: Page) {
  await page.goto("/home");
  await page.getByRole("link", { name: /^Start (Today's Workout|workout)/i }).click();
  await page.waitForURL(/\/train\/workout\?day=/);
  await expect(page.getByTestId("current-set-card")).toBeVisible();
  // The first view of the logger, scrolled to the top.
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe("Medium usability fixes", () => {
  test("M2 + M3 + M6 at 375 × 667: controls on first view, rest timer in view after logging, 44 px steppers", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await signUpAndConfirm(page, uniqueEmail());
    await completeOnboarding(page);
    await startWorkout(page);

    // M2: weight, reps and Complete set without scrolling.
    for (const id of ["current-weight", "current-reps", "complete-set"]) {
      const v = await inView(page, id);
      expect(v.fully, `${id} fully visible at 375×667: ${JSON.stringify(v)}`).toBe(true);
    }
    // M6: every −/+ at least 44 × 44, and the number fields stay at least 72 px wide.
    for (const id of ["current-weight-less", "current-weight-more", "current-reps-less", "current-reps-more"]) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.width, id).toBeGreaterThanOrEqual(44);
      expect(box.height, id).toBeGreaterThanOrEqual(44);
    }
    for (const id of ["current-weight", "current-reps"]) {
      const w = (await page.getByTestId(id).locator("input").boundingBox())!.width;
      expect(w, `${id} input width`).toBeGreaterThanOrEqual(72);
    }

    // M3: log a set from lower down the screen; the countdown and Skip rest come into view.
    const card = page.getByTestId("current-set-card");
    await card.getByLabel(/^Weight/).fill("95");
    await card.getByLabel("Reps", { exact: true }).fill("8");
    await page.getByTestId("complete-set").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.getByTestId("complete-set").click();
    await expect(page.getByTestId("current-rest")).toBeVisible();
    await expect
      .poll(async () => (await inView(page, "rest-remaining")).top, { message: "rest countdown scrolled into view" })
      .toBeGreaterThanOrEqual(0);
    const skip = await card.getByRole("button", { name: "Skip rest" }).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    });
    expect(skip, "Skip rest on screen").toBe(true);
  });

  test("M2 + M6 at 320 × 568: weight field on first view, no sideways scroll, 44 px steppers", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await signUpAndConfirm(page, uniqueEmail());
    await completeOnboarding(page);
    await startWorkout(page);
    const v = await inView(page, "current-weight");
    expect(v.fully, `weight visible at 320×568: ${JSON.stringify(v)}`).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    for (const id of ["current-weight-less", "current-weight-more", "current-reps-less", "current-reps-more"]) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.width, id).toBeGreaterThanOrEqual(44);
      expect(box.height, id).toBeGreaterThanOrEqual(44);
    }
    const w = (await page.getByTestId("current-weight").locator("input").boundingBox())!.width;
    expect(w).toBeGreaterThanOrEqual(72);
  });

  test("M1: onboarding at 200% text never scrolls sideways and Continue fits on screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(() => {
      const big = () => document.documentElement.style.setProperty("font-size", "200%");
      document.addEventListener("DOMContentLoaded", big);
      big();
    });
    await signUpAndConfirm(page, uniqueEmail());
    await page.waitForURL(/\/onboarding/);
    const check = async (step: string) => {
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(sw, `${step}: page width at 200% text`).toBeLessThanOrEqual(375);
      const btn = page.getByRole("button", { name: /^(Continue|Build my plan)/ }).first();
      await btn.scrollIntoViewIfNeeded();
      const box = (await btn.boundingBox())!;
      expect(box.x, `${step}: Continue left edge`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${step}: Continue right edge`).toBeLessThanOrEqual(375);
    };
    await answerOnboarding(page, { onEachStep: check });
  });

  test("M5: the offline banner says what is kept and what needs a connection", async ({ page, context }) => {
    await signUpAndConfirm(page, uniqueEmail());
    await completeOnboarding(page);
    await page.goto("/home");
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    const banner = page.getByRole("status").filter({ hasText: "You're offline" });
    await expect(banner).toContainText("Workouts, runs and reading-journey check-ins are kept on this phone");
    await expect(banner).toContainText("Food and water can't be logged until you're back online");
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(banner).toHaveCount(0);
  });

  test("B7: membership shows the yearly saving in dollars and Restore purchases, at the approved prices", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail());
    await completeOnboarding(page);
    await page.goto("/profile/billing");
    await expect(page.getByTestId("interval-month")).toContainText("$19.99");
    await expect(page.getByTestId("interval-year")).toContainText("$149.99");
    await expect(page.getByTestId("year-saving-badge")).toHaveText("Save 37%");
    await expect(page.getByTestId("year-saving")).toHaveText("$89.89 less than 12 monthly payments");
    await expect(page.getByTestId("web-restore")).toBeVisible();
  });
});
