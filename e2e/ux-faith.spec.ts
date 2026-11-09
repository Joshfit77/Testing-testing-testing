import { devices, expect, test, type Page } from "@playwright/test";

/**
 * First-time-user fixes on the Faith tab, at phone size in the demo (sample member: enrolled in the 40-day challenge,
 * on a 90-day Gospels journey). Runs only against a demo server: E2E_DEMO=1 E2E_BASE_URL=… npx playwright test e2e/ux-faith.spec.ts
 */
test.skip(!process.env.E2E_DEMO, "needs a demo server (npm run demo) and E2E_DEMO=1");

const { defaultBrowserType: _ignored, ...iPhone } = devices["iPhone 15"];
test.use({ ...iPhone, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await page.waitForURL(/\/home/);
}

test.describe("Faith first-time UX", () => {
  test("hub: one way to each place, the member's own challenge day, today's reading first and checked in where it's read", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/faith");

    // F4: no duplicate pill row, no inline journal form, no footer sentence.
    await expect(page.getByRole("navigation", { name: "Faith sections" })).toHaveCount(0);
    await expect(page.getByTestId("faith-journal")).toHaveCount(0);
    await expect(page.getByText(/Faith is always here in its own tab/)).toHaveCount(0);

    // F2: the quick action shows the same day as the member's devotional card, never the shared rotation.
    const cardLabel = await page.locator("#todays-devotional").getByText(/^Today's devotional · Day \d+ of 40$/).textContent();
    const day = cardLabel!.match(/Day (\d+) of 40/)![1];
    await expect(page.getByRole("navigation", { name: "Faith quick actions" })).toContainText(`Day ${day} of 40`);

    // F1 + F3: with today's journey reading still open, the first action opens it, and it can be marked in the reader.
    const read = page.getByTestId("faith-read");
    await expect(read).toContainText(/Today's reading|Continue reading/);
    if ((await read.textContent())?.includes("Today's reading")) {
      await read.click();
      await page.waitForURL(/\/faith\/bible\/[^/]+\/\d+/);
      const today = page.getByTestId("reader-today");
      await expect(today.getByRole("button", { name: "Mark today's reading complete" })).toBeVisible();
      await expect(today.getByText("Prayer", { exact: true })).toHaveCount(0);
      await today.getByRole("link", { name: "Back to today" }).click();
      await page.waitForURL(/\/faith\/journey$/);
    }
  });

  test("journey: the full schedule opens at today with completed days folded", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/faith/journey");
    await expect(page.getByText(/· attempt \d/)).toHaveCount(0);
    await page.getByRole("link", { name: /Full schedule/ }).click();
    await page.waitForURL(/\/faith\/journey\/schedule#day-\d+$/);
    const today = page.url().match(/#day-(\d+)$/)![1];
    await expect(page.locator(`#day-${today}`)).toContainText("Today");
    await expect(page.locator(`#day-${today}`)).toBeInViewport();
    await expect(page.getByTestId("schedule-completed")).toContainText(/complete/);
  });

  test("prayer entry: the prayer first, Save on the first screen, a daily prayer by default", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/faith/journal/new");
    await expect(page.getByRole("textbox", { name: "Prayer", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save entry" })).toBeInViewport();
    await expect(page.getByRole("checkbox", { name: /Share with AI Coach/ })).not.toBeChecked();
    await page.getByText("More options", { exact: true }).click();
    await expect(page.getByRole("radio", { name: "Daily prayer" })).toBeChecked();
    await expect(page.getByLabel("Title (optional)")).toBeVisible();
  });
});
