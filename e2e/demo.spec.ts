import { devices, expect, test, type Page } from "@playwright/test";

/**
 * The interactive demo, end to end, at iPhone and desktop sizes. Runs only against a demo server
 * (`npm run demo`, then E2E_DEMO=1 E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/demo.spec.ts).
 */
test.skip(!process.env.E2E_DEMO, "needs a demo server (npm run demo) and E2E_DEMO=1");

const { defaultBrowserType: _ignored, ...iPhone } = devices["iPhone 15"];
const sizes = [
  { name: "iPhone", use: { ...iPhone, deviceScaleFactor: 2 } },
  { name: "desktop", use: { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 } },
];

async function enterDemo(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("demo-entry")).toBeVisible();
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await page.waitForURL(/\/home/);
  await expect(page.getByTestId("demo-bar")).toBeVisible();
}

async function setPlan(page: Page, plan: "free" | "pro") {
  await page.getByTestId(`demo-plan-${plan}`).click();
  await expect(page.getByTestId(`demo-plan-${plan}`)).toHaveAttribute("aria-pressed", "true");
}

/** No horizontal scrolling: the page fits the screen. */
async function fitsWidth(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

for (const size of sizes) {
  test.describe(`demo at ${size.name} size`, () => {
    test.use(size.use);

    test("sample data loads on every main screen", async ({ page }) => {
      await enterDemo(page);
      await fitsWidth(page);

      await page.goto("/train/history");
      await expect(page.getByRole("heading", { name: "Workout history" })).toBeVisible();
      await expect(page.locator("main").getByText(/Upper Strength|Lower Strength/).first()).toBeVisible();

      await page.goto("/train/exercises");
      await expect(page.getByText("157 exercises")).toBeVisible();

      await page.goto("/train/programs/powerbuilding-4-day");
      await expect(page.locator("main").getByText(/Powerbuilding/i).first()).toBeVisible();

      await page.goto("/nutrition");
      await expect(page.locator("main").getByText(/Oats, rolled|Egg, large|Greek yogurt/).first()).toBeVisible();

      await page.goto("/run");
      await expect(page.locator("main").getByText(/mi|km/).first()).toBeVisible();
      await page.goto("/run/activities");
      await expect(page.locator("main").getByRole("link").first()).toBeVisible();

      await page.goto("/progress/sleep");
      await expect(page.getByTestId("demo-note-sleep")).toBeVisible();
      await expect(page.locator("main").getByText("Apple Watch (sample data)").first()).toBeVisible();

      await page.goto("/progress");
      await fitsWidth(page);
      await page.goto("/progress/body-scan");
      await expect(page.getByTestId("demo-note-bodyScan")).toBeVisible();

      await page.goto("/faith");
      await expect(page.getByRole("heading", { name: "40 Days Through the Narrow Gate" })).toBeVisible();
      await expect(page.locator("main").getByText(/[1-9]\d? of 40 days complete/)).toBeVisible();
      await page.goto("/faith/journal");
      await expect(page.getByText("Showing up when it's hard")).toBeVisible();
      await fitsWidth(page);
    });

    test("Free/Pro comparison is correct and purchases are off", async ({ page }) => {
      await enterDemo(page);
      await page.goto("/profile/billing");
      await expect(page.getByTestId("demo-purchases-off")).toBeVisible();
      await expect(page.getByTestId("plan-free")).toContainText("$0");
      await expect(page.getByTestId("pro-price")).toContainText("$19.99");
      await page.getByTestId("interval-year").click();
      await expect(page.getByTestId("pro-price")).toContainText("$149.99");
      await fitsWidth(page);

      // The server-held switch: as Free, Pro can't be bought (checkout is off). Free locks live GPS, Pro unlocks
      // it, and Faith stays open on Free.
      await setPlan(page, "free");
      await expect(page.getByTestId("current-plan")).toHaveText(/Free/);
      await expect(page.getByText("Online checkout isn't available right now. You haven't been charged.")).toBeVisible();
      await expect(page.locator("main").getByRole("button", { name: /subscribe|upgrade|start pro|continue to/i })).toHaveCount(0);
      await page.goto("/run/record");
      await expect(page.getByTestId("gps-locked")).toBeVisible();
      await page.goto("/faith/journal");
      await expect(page.getByText("Showing up when it's hard")).toBeVisible();
      await page.goto("/profile/billing");
      await setPlan(page, "pro");
      await expect(page.getByTestId("current-plan")).toHaveText(/Pro All Access/);
      await page.goto("/run/record");
      await expect(page.getByTestId("gps-locked")).toHaveCount(0);
      await expect(page.getByTestId("demo-note-gps")).toBeVisible();
    });

    test("AI coach replies are labelled as simulated", async ({ page }) => {
      await enterDemo(page);
      await page.goto("/coach");
      await expect(page.getByTestId("demo-ai-simulated")).toBeVisible();
      const box = page.getByLabel("Message the AI coach");
      await expect(async () => {
        await box.fill("Review my training");
        await expect(box).toHaveValue("Review my training", { timeout: 500 });
      }).toPass({ timeout: 15_000 });
      await page.getByRole("button", { name: "Send message" }).click();
      await expect(page.getByTestId("coach-reply").last()).toContainText("Simulated demo reply", { timeout: 30_000 });
    });
  });
}

test.describe("demo flows", () => {
  test("the opening plays, then the demo opens from the welcome screen", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/");
    const opening = page.getByRole("dialog", { name: "Narrow Gate Fitness opening" });
    await expect(opening).toBeVisible();
    await opening.getByRole("button", { name: "Skip intro" }).click();
    await expect(opening).toBeHidden();
    await expect(page.getByTestId("demo-entry")).toBeVisible();
    await context.close();
  });

  test("a workout can be logged and saved", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/train");
    await page.locator("main").getByRole("link", { name: /Start workout|Start today's workout|Start/ }).first().click();
    await page.waitForURL(/\/train\/workout/);
    await page.getByLabel(/set 1 weight in lb/).first().fill("185");
    await page.getByLabel(/set 1 reps/).first().fill("5");
    await page.getByRole("button", { name: /Mark .* set 1 complete/ }).first().click();
    await page.getByRole("button", { name: "Finish" }).click();
    await page.getByRole("button", { name: "Finish & save" }).click();
    await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();
  });

  test("a new demo member starts on Free with an empty account and goes through onboarding", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Start as a new member" }).click();
    await page.waitForURL(/\/onboarding/);
    // The new account can't see the sample member's history.
    await page.goto("/train/history");
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("demo accounts can't reach admin pages or the AI stand-in directly", async ({ page, request }) => {
    await enterDemo(page);
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin/);
    const res = await request.post("/api/demo-ai/v1/messages", { data: { model: "x", messages: [{ role: "user", content: "hi" }] } });
    expect(res.status()).toBe(401);
  });
});
