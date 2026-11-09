import { expect, test, type Page } from "@playwright/test";

/**
 * First-time-user UX fixes for My Progress and Sleep & Recovery, at phone size, against the demo server
 * (`npm run demo`, then E2E_DEMO=1 E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/ux-progress-sleep.spec.ts).
 */
test.skip(!process.env.E2E_DEMO, "needs a demo server (npm run demo) and E2E_DEMO=1");

test.use({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await page.waitForURL(/\/home/);
}

test.describe("My Progress and Sleep & Recovery at phone size", () => {
  test("the hub title isn't cut off and the streak reads as a streak", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/progress");
    const title = page.getByRole("heading", { level: 1, name: "My Progress" });
    await expect(title).toBeVisible();
    expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expect(page.getByRole("link", { name: /Sleep & Recovery/ })).toContainText("Last night, trends and schedule");
    await expect(page.getByText(/-week streak · |workouts? this week/).first()).toBeVisible();
  });

  test("the sleep dashboard leads with last night, the week and one recovery line", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/progress/sleep");
    await expect(page.getByTestId("demo-note-sleep")).toBeVisible();
    const card = page.locator('section[aria-labelledby="last-night-title"]');
    await expect(card.getByText(/^\d+h( \d+m)?$|^\d+m$/).first()).toBeInViewport();
    await expect(card.getByText("/ 100", { exact: false }).first()).toBeInViewport();
    await expect(card.getByRole("list", { name: "Time asleep by night" })).toBeInViewport();
    await expect(card.getByTestId("sleep-insight")).toBeInViewport();
    // The source is one line inside the card; stages and measurements moved to the nightly report.
    await expect(card.getByTestId("sleep-source")).toContainText("via Apple Health");
    await expect(card.getByRole("img", { name: /^Deep / })).toHaveCount(0);
    // Three recent entries, then the full list in History.
    await expect(page.getByRole("link", { name: /All nights/ })).toBeVisible();
    expect(await page.getByRole("button", { name: /Delete sleep for/ }).count()).toBeLessThanOrEqual(3);
  });

  test("the stage chart's time labels don't overlap", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/progress/sleep");
    await page.getByRole("link", { name: "Nightly report" }).first().click();
    await page.waitForURL(/\/progress\/sleep\/night\//);
    const axis = page.getByTestId("stage-axis");
    test.skip((await axis.count()) === 0, "the latest sample night has no stages");
    const boxes = await axis.locator("span").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right })));
    expect(boxes.length).toBeGreaterThan(0);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.left, "labels overlap").toBeGreaterThanOrEqual(boxes[i - 1]!.right);
    const width = await axis.evaluate((el) => el.getBoundingClientRect());
    for (const b of boxes) {
      expect(b.left).toBeGreaterThanOrEqual(width.left - 1);
      expect(b.right).toBeLessThanOrEqual(width.right + 1);
    }
  });

  test("choosing A nap switches the times to a nap-sized window ending now", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/progress/sleep/log");
    await expect(page.getByLabel("Time zone")).toBeHidden();
    await page.getByText("A nap", { exact: true }).click();
    const start = Date.parse(await page.getByLabel("Got into bed").inputValue());
    const end = Date.parse(await page.getByLabel("Got up").inputValue());
    expect((end - start) / 60_000).toBe(30);
    await page.getByText("A night's sleep", { exact: true }).click();
    const nightStart = Date.parse(await page.getByLabel("Got into bed").inputValue());
    const nightEnd = Date.parse(await page.getByLabel("Got up").inputValue());
    expect((nightEnd - nightStart) / 3_600_000).toBe(8);
    await page.getByText("More detail (optional)").click();
    await expect(page.getByLabel("Time zone")).toBeVisible();
  });

  test("disconnecting asks whether to keep or remove imported nights", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/progress/sleep/settings");
    await page.getByRole("button", { name: "Disconnect…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Disconnect, keep imported nights" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Disconnect and remove imported nights" })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  });
});
