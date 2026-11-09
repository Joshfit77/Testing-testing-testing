import { devices, expect, test, type Page } from "@playwright/test";

/**
 * First-time-user fixes for Home, Quick add, the AI Coach, billing, You and search, at iPhone 15 size in the demo.
 * Runs only against a demo server: E2E_DEMO=1 E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/ux-home-onboarding-coach-you.spec.ts
 */
test.skip(!process.env.E2E_DEMO, "needs a demo server (npm run demo) and E2E_DEMO=1");

const { defaultBrowserType: _ignored, ...iPhone } = devices["iPhone 15"];
test.use({ ...iPhone, deviceScaleFactor: 2 });

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await page.waitForURL(/\/home/);
  await expect(page.getByTestId("demo-bar")).toBeVisible();
}

async function setPlan(page: Page, plan: "free" | "pro") {
  await page.getByTestId(`demo-plan-${plan}`).click();
  await expect(page.getByTestId(`demo-plan-${plan}`)).toHaveAttribute("aria-pressed", "true");
}

test("Home: whole verse, a labelled Start button, and a header that fits", async ({ page }) => {
  await enterDemo(page);
  const viewport = page.viewportSize()!;

  // Verse of the day: never a one-word fragment like "Therefore…".
  const verse = page.getByRole("link", { name: /^Verse of the day/ }).locator("blockquote");
  if (await verse.count()) expect(((await verse.textContent()) ?? "").split(/\s+/).length).toBeGreaterThanOrEqual(6);

  // One labelled, full-width primary action; no "Tap play" hint.
  const start = page.getByTestId("home-workout").getByRole("link", { name: /^(Start today's workout|Start workout early|Start workout|Resume workout)/ });
  await expect(start).toBeVisible();
  const box = (await start.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThan(viewport.width * 0.7);
  await expect(page.getByText(/Tap play/)).toHaveCount(0);
  // The workout is the first module, and the duplicate Quick actions row is gone.
  await expect(page.getByRole("navigation", { name: "Quick actions" })).toHaveCount(0);

  // The AI Coach pill sits fully on screen.
  const coach = page.locator("header").getByRole("link", { name: "AI Coach", exact: true }).first();
  const c = (await coach.boundingBox())!;
  expect(c.x + c.width).toBeLessThanOrEqual(viewport.width);
});

test("Quick add from another tab: the workout tile leads, and sleep is one tap away", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/faith");
  await page.getByTestId("quick-add").click();
  const workout = page.getByTestId("quick-add-workout");
  await expect(workout).toHaveText(/^(Today's workout|Quick workout|Resume workout)/);
  await expect(page.getByTestId("quick-add-sheet").getByRole("link").first()).toHaveAttribute("data-testid", "quick-add-workout");
  await expect(page.getByTestId("quick-add-sheet").getByRole("link", { name: "Sleep" })).toHaveAttribute("href", "/progress/sleep/log");
  for (const link of await page.getByTestId("quick-add-sheet").getByRole("link").all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("AI Coach on Free is one card with the price; Pro gets the chat", async ({ page }) => {
  await enterDemo(page);
  await setPlan(page, "free");
  await page.goto("/coach");
  await expect(page.getByTestId("coach-upsell")).toBeVisible();
  await expect(page.getByTestId("coach-upsell-price")).toContainText("$19.99/month or $149.99/year");
  await expect(page.getByTestId("coach-upsell-price")).toContainText("Faith stays free");
  await expect(page.getByLabel("Message the AI coach")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "New chat" })).toHaveCount(0);
  await expect(page.getByText(/bench stall|Plan my deload/)).toHaveCount(0);

  await setPlan(page, "pro");
  await page.goto("/coach");
  await expect(page.getByTestId("coach-upsell")).toHaveCount(0);
  await expect(page.getByTestId("coach-disclaimer").locator("summary")).toContainText("More");
});

test("Billing first screen and the You tab's privacy list", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/profile/billing");
  await expect(page.getByTestId("current-plan")).toBeInViewport();
  await expect(page.getByTestId("faith-free")).toBeInViewport();
  await expect(page.getByTestId("interval-month")).toBeInViewport();
  await expect(page.getByTestId("interval-year")).toBeInViewport();
  await expect(page.getByTestId("plan-comparison")).not.toHaveAttribute("open", /.*/);

  await page.goto("/profile");
  const privacy = page.getByTestId("privacy-permissions");
  await expect(privacy.getByRole("link")).toHaveCount(7);
  await expect(privacy.getByRole("link", { name: /AI Coach memory/ })).toHaveAttribute("href", "/coach/memory");
});

test("Search lights up no tab", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/search");
  const tabs = page.getByRole("navigation", { name: "Main sections" }).last().getByRole("link");
  for (const tab of await tabs.all()) await expect(tab).not.toHaveAttribute("aria-current", "page");
});
