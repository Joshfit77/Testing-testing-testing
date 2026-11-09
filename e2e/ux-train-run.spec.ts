import { devices, expect, test, type Page } from "@playwright/test";
import { hideDemoChrome } from "./helpers";

/**
 * First-time-user fixes in Train & Run (phone size, demo mode): the free way to log a run, shorter program and
 * exercise libraries, the demo player's controls under the picture, the review's consistency line and a quiet Delete.
 * Runs against a demo server: E2E_DEMO=1 E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/ux-train-run.spec.ts
 */
test.skip(!process.env.E2E_DEMO, "needs a demo server (npm run demo) and E2E_DEMO=1");

const { defaultBrowserType: _ignored, ...iPhone } = devices["iPhone 15"];
test.use({ ...iPhone, deviceScaleFactor: 2 });

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await page.waitForURL(/\/home/);
}

async function setPlan(page: Page, plan: "free" | "pro") {
  await page.goto("/profile/billing");
  await page.getByTestId(`demo-plan-${plan}`).click();
  await expect(page.getByTestId(`demo-plan-${plan}`)).toHaveAttribute("aria-pressed", "true");
}

async function screens(page: Page) {
  return page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
}

test.describe("Train & Run, first-time fixes", () => {
  test.beforeEach(async ({ page }) => enterDemo(page));

  test("Free: the GPS screen leads with the free manual log, then one short Pro note with the price", async ({ page }) => {
    await setPlan(page, "free");
    await page.goto("/run/record?kind=run");
    const byHand = page.getByRole("link", { name: "Log a run or walk by hand (free)" });
    await expect(byHand).toBeVisible();
    await expect(byHand).toHaveAttribute("href", "/run?tab=log");
    expect((await byHand.boundingBox())!.height).toBeGreaterThanOrEqual(52);
    const locked = page.getByTestId("gps-locked");
    await expect(locked).toContainText("$19.99/month or $149.99/year");
    expect((await byHand.boundingBox())!.y).toBeLessThan((await locked.boundingBox())!.y);
    await expect(page.getByRole("radiogroup", { name: "Activity" })).toHaveCount(0);
    await expect(page.getByTestId("gps-start")).toHaveCount(0);
    await byHand.click();
    await page.waitForURL(/\/run\?tab=log/);
  });

  test("program library: 3 per category with See all, no misleading Complete line, far shorter", async ({ page }) => {
    await page.goto("/train/programs");
    await hideDemoChrome(page); // measure the length a production member scrolls
    await expect(page.locator("main").getByText(/^Complete:/)).toHaveCount(0);
    for (const section of await page.locator("section[aria-labelledby^='cat-']").all()) {
      expect(await section.locator("ul > li").count()).toBeLessThanOrEqual(3);
    }
    expect(await screens(page)).toBeLessThan(12);
    const seeAll = page.getByRole("link", { name: /^See all \d+/ }).first();
    const total = Number((await seeAll.innerText()).match(/\d+/)![0]);
    await seeAll.click();
    await page.waitForURL(/category=/);
    await expect(page.locator("section[aria-labelledby^='cat-'] ul > li")).toHaveCount(total);
  });

  test("exercise library: one-tap muscle chips, other filters under More filters, every exercise reachable", async ({ page }) => {
    await page.goto("/train/exercises");
    await expect(page.getByText("157 exercises")).toBeVisible();
    await expect(page.locator("main ul li").filter({ hasText: /^Demo/ })).toHaveCount(0);
    await page.getByRole("navigation", { name: "Muscles" }).getByRole("link", { name: "Chest", exact: true }).click();
    await page.waitForURL(/muscle=chest/);
    await expect(page.getByRole("link", { name: /Barbell Back Squat/ })).toHaveCount(0);
    await page.getByText("More filters").click();
    await page.getByLabel("Difficulty").selectOption("beginner");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await page.waitForURL(/difficulty=beginner/);
    expect(page.url()).toMatch(/muscle=chest/);
    await expect(page.getByRole("link", { name: /^Push-Up/ })).toBeVisible();
    // Search still works on its own.
    await page.goto("/train/exercises?q=deadlift");
    await expect(page.locator("main ul li").first()).toContainText(/deadlift/i);
  });

  test("demo player: controls sit under the picture and the position bar is a 44px target", async ({ page }) => {
    await page.goto("/train/exercises/back-squat");
    const stage = page.locator("[data-motion-stage]").first();
    const controls = page.locator("[data-motion-controls]").first();
    await expect(controls).toBeVisible();
    const s = (await stage.boundingBox())!;
    const c = (await controls.boundingBox())!;
    expect(c.y).toBeGreaterThanOrEqual(s.y + s.height - 1);
    expect((await page.getByRole("slider", { name: "Position in the movement" }).first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.getByRole("button", { name: "Pause demonstration" }).first().click();
    await expect(page.getByRole("button", { name: "Play demonstration" }).first()).toBeVisible();
  });

  test("training review: count, plan and percentage over the same days; a readable last-workout date", async ({ page }) => {
    await setPlan(page, "pro");
    await page.goto("/train/review");
    const line = page.getByTestId("review-consistency");
    await expect(line).toBeVisible();
    await expect(line).not.toContainText(/\d{4}-\d{2}-\d{2}/);
    const text = await line.innerText();
    if (/planned/.test(text)) expect(text).toMatch(/\d+ workouts? of about \d+ planned (since you started|in the last 4 weeks)/);
  });

  test("activity detail: Delete is a quiet button that still asks first", async ({ page }) => {
    await page.goto("/run?tab=history");
    await page.locator("a[href^='/run/activities/']").first().click();
    await page.waitForURL(/\/run\/activities\//);
    const del = page.getByRole("button", { name: "Delete", exact: true });
    const box = (await del.boundingBox())!;
    expect(box.width).toBeLessThan(page.viewportSize()!.width * 0.6);
    await del.click();
    await expect(page.getByRole("dialog")).toContainText(/Delete this/);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
