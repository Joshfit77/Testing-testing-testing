import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("feature access, subscriptions and core sections", () => {
  let email = "";
  test.beforeEach(async ({ page }) => {
    email = uniqueEmail("feat");
    await signUpAndConfirm(page, email);
  });

  test("onboarding blocks under-18 users", async ({ page }) => {
    await page.waitForURL(/\/onboarding/);
    await page.getByRole("button", { name: "Build strength", exact: true }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: "Skip", exact: true }).click(); // optional second goal
    await page.getByRole("button", { name: "Female", exact: true }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByLabel("Age").fill("16");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByText(/available to adults \(18\+\)/)).toBeVisible();
    // Still on the age question.
    await expect(page.getByLabel("Age")).toBeVisible();
  });

  test("free plan: premium programs, meal planning and AI are locked server-side; food logging is open; billing explains state", async ({ page }) => {
    await completeOnboarding(page);

    await page.goto("/train/programs/powerlifting-base-block");
    await expect(page.getByRole("link", { name: /Upgrade to unlock/ })).toBeVisible();
    await expect(page.getByText(/viewing the program outline/)).toBeVisible();
    // Prescriptions are not rendered for locked programs.
    await expect(page.getByText(/Rest \d/)).toHaveCount(0);

    await page.goto("/train/programs/foundations-full-body");
    await expect(page.getByRole("button", { name: /Start program/ })).toBeVisible();

    await page.goto("/nutrition");
    await expect(page.getByRole("button", { name: "Add food" })).toBeVisible();
    await page.goto("/nutrition/planner");
    await expect(page.getByText("Included with Plus and Pro")).toBeVisible();

    await page.goto("/coach");
    await expect(page.getByText(/isn't configured on this server|included with Pro/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();

    await page.goto("/profile/billing");
    await expect(page.getByRole("heading", { name: "Plans & billing" })).toBeVisible();
    await expect(page.getByText("Current plan")).toBeVisible();
  });

  test("progress: log bodyweight and create a goal; recovery check-in requires consent", async ({ page }) => {
    await completeOnboarding(page);
    await page.goto("/progress/overview?range=7d");
    await page.getByLabel(/^Weight \(lb\)/).fill("182.5");
    await page.getByRole("button", { name: "Save weight" }).click();
    await expect(page.getByText("Bodyweight saved.")).toBeVisible();

    await page.getByLabel("Goal", { exact: true }).fill("Reach 175 lb");
    await page.getByLabel("Target", { exact: true }).fill("175");
    await page.getByRole("button", { name: "Add goal" }).click();
    await expect(page.getByText("Reach 175 lb")).toBeVisible();

    await page.goto("/train/recovery");
    await page.getByRole("button", { name: "Save check-in" }).click();
    await expect(page.getByText(/Please give consent/)).toBeVisible();
    await page.getByLabel(/I consent to storing optional recovery/).check();
    await page.getByRole("button", { name: "Save check-in" }).click();
    await expect(page.getByText(/^Readiness \d+\/100/)).toBeVisible();
  });

  test("Faith is always available and journal entries save privately", async ({ page }) => {
    await completeOnboarding(page);
    await page.goto("/faith");
    await expect(page.getByRole("heading", { name: "Faith", level: 1 })).toBeVisible();
    await expect(page.getByText("Verse of the day")).toBeVisible();
    await page.getByRole("textbox", { name: "Reflection" }).fill("Grateful for strength today.");
    await page.getByRole("button", { name: "Save entry" }).click();
    await expect(page.getByText("Entry saved. Only you can see it.")).toBeVisible();
  });

  test("food log on the Free plan: search built-in foods and log a serving", async ({ page }) => {
    await completeOnboarding(page);
    await page.goto("/nutrition");
    await expect(page.getByRole("heading", { name: "Food", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add food" }).click();
    await page.getByPlaceholder("e.g. chicken, banana, rice").fill("banana");
    await page.getByRole("region", { name: "Common foods" }).getByRole("button", { name: /^Banana/ }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Unit", { exact: true })).toHaveValue("serving");
    await dialog.getByLabel("Amount", { exact: true }).fill("2");
    await expect(dialog.getByTestId("amount-calories")).toHaveText("210");
    await dialog.getByRole("button", { name: "Log food" }).click();
    await expect(page.getByText(/Logged Banana \(2 × 1 medium/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Banana").first()).toBeVisible();
    await expect(page.getByText("210").first()).toBeVisible();

    await page.goto("/profile/billing");
    await expect(page.getByText(/^\$11\.99\s*\/ month$/)).toBeVisible();
    await expect(page.getByText(/^\$24\.99\s*\/ month$/)).toBeVisible();
    await expect(page.getByText("AI coach: 150 messages a month")).toBeVisible();
    // No yearly option unless the owner configures a yearly price.
    await expect(page.getByText("All Access Yearly")).toHaveCount(0);
  });
});
