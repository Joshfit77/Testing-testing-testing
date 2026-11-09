import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * A brand-new Free member, straight out of onboarding: every dashboard starts from their own (empty) records. Nothing
 * borrowed from sample data (no "Day 33 of 40", no streaks or sleep numbers they never logged), nothing broken
 * (NaN, undefined), and each empty state offers the first step.
 */

/** Text a page must never show to anyone: formatting of missing values gone wrong. */
async function noBrokenValues(page: Page) {
  const text = await page.locator("main").innerText();
  expect(text, page.url()).not.toMatch(/\bNaN\b|\bundefined\b|\bInfinity\b|\bnull\b|\[object Object\]/);
}

test.describe("a new member's first look", () => {
  test("every dashboard starts empty and honest, with the first step offered", async ({ page }) => {
    test.setTimeout(180_000);
    await signUpAndConfirm(page, uniqueEmail("newstates"));
    await completeOnboarding(page);

    // Home: today's workout from the new plan, nothing logged, the Bible starting at John 1.
    await page.goto("/home");
    await expect(page.getByRole("link", { name: /^Start today's workout/i })).toBeVisible();
    await expect(page.getByText(/^0 of \d workouts$/)).toBeVisible();
    await expect(page.getByText("0 weeks")).toBeVisible();
    await expect(page.getByTestId("home-reading-link")).toContainText("Start with John 1");
    await expect(page.locator("main")).not.toContainText(/Day \d+ of \d+ ·|Day \d+ of 40/);
    await noBrokenValues(page);

    // Faith: no journey yet, so no day number; the first step is choosing one.
    await page.goto("/faith");
    await expect(page.getByText("Begin a reading journey")).toBeVisible();
    await expect(page.getByRole("link", { name: "Choose a journey" }).first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/Day \d+ of \d+/);
    await noBrokenValues(page);

    // AI Coach (Free): one card that says what Pro adds, with starter questions built from this member's own plan.
    await page.goto("/coach");
    const upsell = page.getByTestId("coach-upsell");
    await expect(upsell).toBeVisible();
    await expect(upsell.getByRole("list", { name: "Questions you could ask" }).getByRole("listitem")).toHaveCount(3);
    await expect(upsell).toContainText(/How do I start my first week\?/);
    await expect(page.getByTestId("coach-upsell-price")).toContainText("Faith stays free");
    await noBrokenValues(page);

    // Badges: every rank not started, the first one a single workout away.
    await page.goto("/progress/badges");
    await expect(page.getByText("Not started")).toHaveCount(3);
    // Exact text: the badge-progress work adds its own "0 / 1 workouts" progress line to this page.
    await expect(page.getByText("0 / 1 workout", { exact: true })).toBeVisible();
    await noBrokenValues(page);

    // Overview: zero workouts and an empty chart, not a trend drawn from nothing. The only bodyweight is the one
    // given in onboarding.
    await page.goto("/progress/overview");
    await expect(page.getByText("No data for this period yet.")).toBeVisible();
    await noBrokenValues(page);

    // Sleep: consent first; no score, hours or debt before anything is recorded.
    await page.goto("/progress/sleep");
    await expect(page.getByRole("button", { name: "Allow sleep logging" })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/Sleep score|\d+h \d+m|sleep debt of/i);
    await noBrokenValues(page);

    // Recovery: no readiness until the first check-in.
    await page.goto("/train/recovery");
    await expect(page.getByText("No check-ins yet. Your readiness note will appear here.")).toBeVisible();
    await noBrokenValues(page);

    // Run (Free): GPS is marked Pro, logging by hand is offered, and there is no history yet.
    await page.goto("/run");
    await expect(page.getByTestId("run-this-week-run")).toHaveText("No runs");
    await expect(page.getByRole("link", { name: "Log a run or walk manually" })).toBeVisible();
    await noBrokenValues(page);

    // Train and Nutrition load for an empty account without broken values.
    for (const path of ["/train", "/nutrition", "/progress"]) {
      await page.goto(path);
      await noBrokenValues(page);
    }
  });
});
