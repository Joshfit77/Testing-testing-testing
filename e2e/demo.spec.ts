import { EXERCISES } from "../src/data/exercises";
import { devices, expect, test, type Page } from "@playwright/test";
import { PRESENTER_STEPS } from "../src/lib/demo/presenter";
import { answerOnboarding } from "./helpers";

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
      await expect(page.getByText(`${EXERCISES.length} exercises`)).toBeVisible();

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
      await expect(page.getByTestId("pro-price")).toContainText("$17.99");
      await page.getByTestId("interval-year").click();
      await expect(page.getByTestId("pro-price")).toContainText("$119.99");
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

    test("presenter path: Next walks all 20 stops through real screens", async ({ page }) => {
      test.setTimeout(240_000);
      await enterDemo(page);
      const panel = page.getByTestId("presenter-panel");
      await expect(panel).toBeVisible();
      // Signed in on Home: stop 2.
      await expect(page.getByTestId("presenter-current")).toContainText("2/20 Home");
      for (const step of PRESENTER_STEPS.slice(2)) {
        await page.getByTestId("presenter-next").click();
        await expect(page.getByTestId("presenter-current")).toContainText(`${step.n}/20 ${step.title}`);
        await expect.poll(() => step.match.test(new URL(page.url()).pathname), { message: step.title }).toBe(true);
        await expect(page.locator("main").first()).toBeVisible();
        await expect(page.getByText("We couldn't load this page")).toHaveCount(0);
        await expect(page.getByTestId(`presenter-tag-${step.label}`).first()).toBeVisible();
        await fitsWidth(page);
        if (step.title === "Journeys") await expect(page.locator("main").getByText(/Day 21/).first()).toBeVisible();
        if (step.title === "Prayer journal") await expect(page.getByText("A new job")).toBeVisible();
        if (step.title === "Free vs Pro") await expect(page.getByTestId("demo-purchases-off")).toBeVisible();
      }
      await expect(page.getByTestId("presenter-next")).toHaveCount(0);
      await expect(page).toHaveURL(/\/home$/);
    });

    test("presenter: jump to any stop, return after a detour, hide and show", async ({ page }) => {
      await enterDemo(page);
      await page.getByTestId("presenter-list-toggle").click();
      await page.getByTestId("presenter-list").getByRole("link", { name: /AI coach/ }).click();
      await page.waitForURL(/\/coach$/);
      await expect(page.getByTestId("presenter-current")).toContainText("6/20 AI coach");
      // A detour off the path (a page that isn't a stop): the panel offers the way back.
      await page.goto("/profile/preferences");
      await page.getByTestId("presenter-return").click();
      await page.waitForURL(/\/coach$/);
      await expect(page.getByTestId("presenter-return")).toHaveCount(0);
      await page.getByTestId("presenter-hide").click();
      await expect(page.getByTestId("presenter-panel")).toHaveCount(0);
      await page.reload();
      await page.getByTestId("presenter-show").click();
      await expect(page.getByTestId("presenter-current")).toContainText("6/20 AI coach");
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

  test("the opening plays once per browser tab, and the presenter can play it again", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const opening = page.getByRole("dialog", { name: "Narrow Gate Fitness opening" });
    await page.goto("/");
    await expect(opening).toBeVisible();
    await opening.getByRole("button", { name: "Skip intro" }).click();
    await expect(opening).toBeHidden();
    // A reload during the presentation doesn't replay it.
    await page.reload();
    await expect(page.getByTestId("demo-entry")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-intro", /off|done/);
    await expect(opening).toHaveCount(0);
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    await page.waitForURL(/\/home/);
    await page.reload();
    await expect(page.getByTestId("demo-bar")).toBeVisible();
    await expect(opening).toHaveCount(0);
    // Stop 1 plays it again on purpose.
    await page.getByTestId("presenter-list-toggle").click();
    await page.getByTestId("presenter-list").getByRole("button", { name: /Opening gate/ }).click();
    await expect(opening).toBeVisible();
    await opening.getByRole("button", { name: "Skip intro" }).click();
    await expect(opening).toBeHidden();
    await expect(page.getByTestId("presenter-current")).toContainText("1/20 Opening gate");
    await context.close();
  });

  test("simulated AI screens say so: meal photo, label photo, Bible questions", async ({ page }) => {
    test.setTimeout(120_000);
    await enterDemo(page);
    await page.goto("/nutrition/photo");
    await expect(page.getByTestId("demo-note-mealPhoto")).toBeVisible();
    await page.getByLabel("Choose a meal photo").setInputFiles("public/icons/icon-192.png");
    await page.getByRole("button", { name: "Estimate nutrition" }).click();
    await expect(page.getByText(/Simulated demo reply/).first()).toBeVisible({ timeout: 30_000 });

    await page.goto("/nutrition/label");
    await expect(page.getByTestId("demo-note-labelPhoto")).toBeVisible();
    await page.getByLabel("Choose a label photo").setInputFiles("public/icons/icon-192.png");
    await expect(page.getByRole("textbox", { name: "Ingredients" })).toHaveValue(/Whole grain oats/, { timeout: 30_000 });
    await expect(page.getByRole("textbox", { name: /Product name/ })).toHaveValue(/Simulated demo reading/);
    await page.getByTestId("label-check").click();
    await expect(page.getByTestId("label-allergens")).toContainText(/soy|Soy/);

    await page.goto("/faith/ask");
    await expect(page.getByTestId("demo-note-bibleAsk")).toBeVisible();
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

  test("a new member goes from the welcome screen to a finished first workout", async ({ page }, info) => {
    test.setTimeout(180_000);
    let taps = 0;
    await page.exposeFunction("__countTap", () => void (taps += 1));
    await page.addInitScript(() => document.addEventListener("click", (e) => e.isTrusted && (window as unknown as { __countTap: () => void }).__countTap(), true));
    const t0 = Date.now();
    await page.goto("/");
    await page.getByRole("button", { name: "Start as a new member" }).click();
    await page.waitForURL(/\/onboarding/);
    await answerOnboarding(page, { experience: "Brand new to training", equipment: /^Dumbbells only/ });
    await page.getByRole("link", { name: /^Start (my first workout|today.s workout)/i }).first().click();
    await page.waitForURL(/\/train\/workout/);
    // A loaded lift asks for its weight before a set is logged (owner decision T8): the member enters it.
    await page.getByLabel(/set 1 weight in lb/).first().fill("20");
    await page.getByRole("button", { name: /^Mark .+ complete$/ }).first().click();
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    await page.getByRole("button", { name: "Finish & save" }).click();
    await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible({ timeout: 30_000 });
    // An automated user that answers instantly: the app's own time and the number of taps, not a human timing.
    info.annotations.push({ type: "new-member path", description: `${Math.round((Date.now() - t0) / 100) / 10} s, ${taps} taps (automated)` });
    console.log(`new-member path: ${Math.round((Date.now() - t0) / 100) / 10} s, ${taps} taps (automated)`);
    // The presenter then switches to the sample member: Profile › Sign out › Explore with sample data.
    await page.goto("/profile");
    await page.getByRole("button", { name: "Sign out", exact: true }).last().click();
    await page.waitForURL(/\/login/);
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    await page.waitForURL(/\/home/);
    await expect(page.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening), Demo/ })).toBeVisible();
  });

  test("demo accounts can't reach admin pages", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin/);
  });
});
