import { devices, expect, test, type Page } from "@playwright/test";

/**
 * First-time-user fixes on the food diary, at phone size against a demo server (`npm run demo`, then
 * E2E_DEMO=1 E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/ux-nutrition.spec.ts):
 * - every log path says "Logged <food> to <meal>" with an Undo that removes exactly what was added;
 * - the diary's Scan barcode tile opens Add food on its Scan tab (logging), not the product analyser;
 * - saved meals are a tab inside Add food; recent foods show the amount they log;
 * - Add food opens on Popular foods with the food groups behind "Browse by type", and the search box has a label;
 * - Free members see "Pro" on Meal photo, and its lock screen offers "Add food instead".
 */
test.skip(!process.env.E2E_DEMO, "needs a demo server (npm run demo) and E2E_DEMO=1");

const { defaultBrowserType: _ignored, ...iPhone } = devices["iPhone 15"];
test.use({ ...iPhone, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });

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

/** Logged diary rows today (each has a Remove button). */
const diaryRows = (page: Page) => page.locator('[data-testid^="meal-"] li').filter({ has: page.getByRole("button", { name: /^Remove / }) });

async function fitsWidth(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("food diary, first-time fixes", () => {
  test("one-tap re-log shows the amount, confirms the meal and undoes exactly that row", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/nutrition");
    const recent = page.getByTestId("quick-relog-section");
    await expect(recent).toBeVisible();
    await expect(recent.getByTestId("quick-relog-amount").first()).toHaveText(/\d+ kcal · P \d+ g$/);

    const before = await diaryRows(page).count();
    await recent.getByTestId("quick-relog").first().click();
    await expect(recent.getByRole("status")).toHaveText(/^Logged .+ to (breakfast|lunch|dinner|snacks)\.$/);
    await expect(diaryRows(page)).toHaveCount(before + 1);

    await recent.getByRole("button", { name: "Undo" }).click();
    await expect(recent.getByRole("status")).toHaveText("Undone: removed from your diary.");
    await expect(recent.getByRole("button", { name: "Undo" })).toHaveCount(0);
    await expect(diaryRows(page)).toHaveCount(before);
    await fitsWidth(page);
  });

  test("Scan barcode opens Add food on its Scan tab; the analyser stays under More tools", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/nutrition");
    await page.getByRole("button", { name: "Scan barcode" }).click();
    const dialog = page.getByRole("dialog", { name: "Add food" });
    await expect(dialog.getByRole("tab", { name: "Scan" })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("button", { name: "Type the barcode instead" })).toBeVisible();
    await expect(page).toHaveURL(/\/nutrition(\?|$)/);
    await page.keyboard.press("Escape");

    // A plain "Add food" afterwards doesn't stay stuck on Scan.
    await page.getByRole("button", { name: "Add food" }).click();
    await expect(page.getByRole("dialog").getByRole("tab", { name: "Scan" })).toHaveAttribute("aria-selected", "false");
    await page.keyboard.press("Escape");

    await page.getByTestId("group-tools").locator("summary").click();
    await expect(page.getByTestId("food-iq-cta")).toHaveAttribute("href", "/nutrition/scanner");

    // Deep link.
    await page.goto("/nutrition?add=1&tab=scan");
    await expect(page.getByRole("dialog").getByRole("tab", { name: "Scan" })).toHaveAttribute("aria-selected", "true");
  });

  test("Add food: labelled search, Popular foods first, food groups on demand, tabs scroll instead of clipping", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/nutrition");
    await page.getByRole("button", { name: "Add food" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/^For Today$/)).toBeVisible();
    await dialog.getByRole("tab", { name: "Search" }).click();
    await expect(dialog.getByLabel("Search foods")).toBeVisible();
    await expect(dialog.getByRole("region", { name: "Popular foods" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Poultry Products" })).toBeHidden();
    await dialog.getByTestId("browse-by-type").locator("summary").click();
    await expect(dialog.getByRole("button", { name: "Poultry Products" })).toBeVisible();

    // Every tab keeps its whole label; the row scrolls sideways.
    const clipped = await dialog.getByRole("tab").evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent));
    expect(clipped).toEqual([]);
    const list = dialog.getByRole("tablist");
    const scrolls = await list.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    if (scrolls) await expect(dialog.getByTestId("tabs-more-cue")).toHaveCSS("opacity", "1");
    await fitsWidth(page);
  });

  test("saved meals: a tab in Add food, one serving to the meal for now, with Undo", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/nutrition");
    // Save a logged meal first ("Save as meal" under it), named "Breakfast, Nov 9" style by default.
    const meal = page.locator('[data-testid^="meal-"]').filter({ has: page.locator("summary", { hasText: "Save as meal" }) }).first();
    await meal.locator("summary", { hasText: "Save as meal" }).click();
    const name = meal.getByLabel("Save as meal");
    await expect(name).toHaveValue(/^(Breakfast|Lunch|Dinner|Snack), [A-Z][a-z]{2} \d{1,2}$/);
    await name.fill("UX test meal");
    await meal.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved “UX test meal”" })).toBeVisible();

    await page.reload();
    const before = await diaryRows(page).count();
    await page.getByRole("button", { name: "Add food" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Saved meals" }).click();
    await dialog.getByRole("button", { name: "Add UX test meal" }).click();
    await expect(dialog.getByRole("status")).toHaveText(/^Logged UX test meal \(1 serving\) to (breakfast|lunch|dinner|snacks)\.$/);
    await expect.poll(() => diaryRows(page).count()).toBeGreaterThan(before);

    // Undo removes every row that saved meal added, and nothing else.
    await dialog.getByRole("button", { name: "Undo" }).click();
    await expect(dialog.getByRole("status")).toHaveText(/^Undone: /);
    await page.keyboard.press("Escape");
    await expect(diaryRows(page)).toHaveCount(before);
  });

  test("Free: Meal photo is tagged Pro and its lock offers Add food instead", async ({ page }) => {
    await enterDemo(page);
    await setPlan(page, "free");
    await page.goto("/nutrition");
    const photo = page.getByTestId("log-actions").getByRole("link", { name: /Meal photo/ });
    await expect(photo.getByTestId("pro-tag")).toHaveText("Pro");
    await photo.click();
    await expect(page.getByText("Included with Pro All Access")).toBeVisible();
    await page.getByRole("link", { name: "Add food instead" }).click();
    await expect(page.getByRole("dialog", { name: "Add food" })).toBeVisible();
    await page.keyboard.press("Escape");
    await setPlan(page, "pro");
  });

  test("water reads as litres of the goal, and the day-mark sits below the meals", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/nutrition");
    await expect(page.getByTestId("water-total")).toHaveText(/^\d+(\.\d+)? of \d+(\.\d)? L$/);
    const mark = (await page.getByTestId("day-mark").boundingBox())!;
    const dinner = (await page.getByTestId("meal-dinner").boundingBox())!;
    expect(mark.y).toBeGreaterThan(dinner.y);
  });
});
