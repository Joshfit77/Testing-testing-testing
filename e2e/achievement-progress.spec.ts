import { devices, expect, test, type Page } from "@playwright/test";

/**
 * Badge progress and exercise milestones on the demo's sample member, at iPhone and desktop sizes. Runs only
 * against a demo server (`npm run demo`, then E2E_DEMO=1 E2E_BASE_URL=http://localhost:3000 npx playwright test
 * e2e/achievement-progress.spec.ts). The sample member logs in pounds and has ~8 weeks of Powerbuilding sessions.
 */
test.skip(!process.env.E2E_DEMO, "needs a demo server (npm run demo) and E2E_DEMO=1");

const { defaultBrowserType: _ignored, ...iPhone } = devices["iPhone 15"];
const sizes = [
  { name: "iPhone", use: { ...iPhone, deviceScaleFactor: 2 } },
  { name: "desktop", use: { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 } },
];

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await page.waitForURL(/\/home/);
}

async function fitsWidth(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

/** "292.1 lb" → 292.1 */
const value = (text: string | null) => Number.parseFloat((text ?? "").replace(/,/g, ""));

for (const size of sizes) {
  test.describe(`achievement progress at ${size.name} size`, () => {
    test.use(size.use);

    test("a lift shows its heaviest lift and the next weight milestone above it", async ({ page }) => {
      await enterDemo(page);
      await page.goto("/train/exercises/back-squat/history");
      const card = page.getByTestId("exercise-milestone");
      await expect(card).toBeVisible();
      await expect(card.getByRole("heading", { name: "Next milestone" })).toBeVisible();
      await expect(card.getByTestId("milestone-primary-label")).toHaveText("Heaviest lift");
      // The history headline is the estimated 1RM, named as an estimate, never as a lift or a "best set".
      await expect(page.getByRole("heading", { name: /Best Estimated 1RM/i })).toBeVisible();
      const target = await card.getByTestId("milestone-target").textContent();
      expect(target).toMatch(/ lb$/);
      await expect(card.getByRole("progressbar")).toBeVisible();
      await expect(card.getByTestId("milestone-message")).toHaveText(/^You're [\d.]+ lb away from your next Barbell Back Squat milestone\.$/);
      // The milestone is above the best and no more than one 25 lb step away.
      const best = value(await card.getByText(/^[\d.,]+ lb/).first().textContent());
      expect(value(target)).toBeGreaterThan(best);
      expect(value(target) - best).toBeLessThanOrEqual(25);
      await fitsWidth(page);
    });

    test("the exercise page shows the same milestone, one tap from the history", async ({ page }) => {
      await enterDemo(page);
      await page.goto("/train/exercises/back-squat/history");
      const fromHistory = await page.getByTestId("milestone-target").textContent();
      await page.goto("/train/exercises/back-squat");
      await expect(page.getByTestId("exercise-milestone")).toBeVisible();
      await expect(page.getByTestId("milestone-target")).toHaveText(fromHistory ?? "");
      await fitsWidth(page);
    });

    test("a bodyweight exercise counts reps", async ({ page }) => {
      await enterDemo(page);
      await page.goto("/train/exercises/hanging-knee-raise/history");
      const card = page.getByTestId("exercise-milestone");
      await expect(card.getByTestId("milestone-target")).toHaveText(/^\d+ reps$/);
      await expect(card.getByTestId("milestone-message")).toHaveText(/^Only \d+ more reps? to reach your next target\.$/);
    });

    test("an exercise never logged gets a simple first milestone", async ({ page }) => {
      await enterDemo(page);
      await page.goto("/train/exercises/goblet-squat");
      const card = page.getByTestId("exercise-milestone");
      await expect(card.getByRole("heading", { name: "First milestone" })).toBeVisible();
      await expect(card.getByText("Set your starting point", { exact: true })).toBeVisible();
      await expect(card.getByTestId("milestone-target")).toHaveCount(0);
    });

    test("the Run tab shows the next run and walk milestones from saved runs and walks", async ({ page }) => {
      await enterDemo(page);
      await page.goto("/run");
      const run = page.getByTestId("run-milestone");
      await expect(run).toBeVisible();
      await expect(run.getByTestId("milestone-primary-label")).toHaveText("Longest run");
      await expect(run.getByTestId("milestone-target")).toHaveText(/^[\d.]+ mi$/);
      await expect(run.getByTestId("milestone-message")).toHaveText(/^Go [\d.]+ mi farther than your longest run to reach [\d.]+ mi\.$/);
      await expect(page.getByTestId("walk-milestone")).toBeVisible();
      await fitsWidth(page);
    });

    test("a zone-2 run exercise counts runs saved on the Run tab, by distance, never as a hold", async ({ page }) => {
      await enterDemo(page);
      await page.goto("/train/exercises/zone-2-run");
      const card = page.getByTestId("exercise-milestone");
      await expect(card.getByTestId("milestone-primary-label")).toHaveText("Longest run");
      await expect(card.getByTestId("milestone-target")).toHaveText(/^[\d.]+ mi$/);
      await expect(card.getByTestId("milestone-message")).not.toHaveText(/hold/i);
    });

    test("badges show progress, percentage and what remains; earned ones say Unlocked", async ({ page }) => {
      await enterDemo(page);
      await page.goto("/progress/badges");
      await expect(page.getByTestId("badge-unlocked").first()).toBeVisible();
      const locked = page.getByTestId("badge-progress");
      expect(await locked.count()).toBeGreaterThan(0);
      const first = locked.first();
      await expect(first.getByRole("progressbar")).toBeVisible();
      await expect(first.getByText(/^\d+%$/)).toBeVisible();
      await expect(first.getByText(/(remaining|to go|in a row|more days?)$/)).toBeVisible();
      await fitsWidth(page);
    });
  });
}

test.describe("milestone celebration at iPhone size", () => {
  test.use(sizes[0]!.use);

  test("finishing a workout that reaches a milestone celebrates it without pushing the page wider than the phone", async ({ page }) => {
    await enterDemo(page);
    // The next bench milestone from the member's saved history: logging it in today's workout reaches it.
    await page.goto("/train/exercises/bench-press/history");
    const target = value(await page.getByTestId("exercise-milestone").getByTestId("milestone-target").textContent());
    expect(target).toBeGreaterThan(0);

    // A blank workout with the bench press, so the test doesn't depend on which program day falls on today
    // (milestones are worked out for any saved workout).
    await page.goto("/train/workout?blank=1");
    await page.getByRole("button", { name: "Add exercise" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Search by name or muscle").fill("Barbell Bench Press");
    await dialog.getByRole("button", { name: /^Barbell Bench Press/ }).first().click();
    await expect(dialog).toBeHidden();
    await page.getByLabel("Barbell Bench Press set 1 weight in lb").fill(String(target));
    await page.getByLabel("Barbell Bench Press set 1 reps").fill("1");
    await page.getByRole("button", { name: "Mark Barbell Bench Press set 1 complete" }).click();
    await page.getByRole("button", { name: "Finish", exact: true }).click();

    // Watch the page width on every frame while the completion screen and its cards animate in.
    await page.evaluate(() => {
      const w = window as unknown as { __maxOverflow: number };
      w.__maxOverflow = 0;
      const tick = () => {
        w.__maxOverflow = Math.max(w.__maxOverflow, document.documentElement.scrollWidth - document.documentElement.clientWidth);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.getByRole("button", { name: "Finish & save" }).click();
    await expect(page.getByRole("heading", { name: /Workout complete/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Milestone reached")).toBeVisible();
    await page.waitForTimeout(2_000);
    expect(await page.evaluate(() => (window as unknown as { __maxOverflow: number }).__maxOverflow)).toBeLessThanOrEqual(1);
  });
});
