import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * Stage 1 journeys (SPEC §15/§16): active sessions and drafts survive tab switches and reloads,
 * food add/edit/copy/delete keeps the totals right, favorites, filters and scroll position come back
 * when you return to a tab, and Back goes where you came from.
 */

const tabs = (page: Page) => page.getByRole("navigation", { name: "Main sections" }).last();
const tab = async (page: Page, name: string, url: RegExp) => {
  await tabs(page).getByRole("link", { name, exact: true }).click();
  await page.waitForURL(url);
};
const food = async (page: Page) => Number((await page.getByTestId("budget-food").innerText()).replace(/[^\d-]/g, ""));

test.describe("Stage 1 journeys", () => {
  test("an active workout survives switching tabs and reloading the app", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("tabs"));
    await completeOnboarding(page);
    await page.getByRole("link", { name: /Start workout/ }).click();
    await page.waitForURL(/\/train\/workout/);

    await page.getByLabel(/set 1 weight in lb/).first().fill("135");
    await page.getByLabel(/set 1 reps/).first().fill("5");
    await page.getByRole("button", { name: /Mark .* set 1 complete/ }).first().click();
    await page.getByLabel(/set 2 weight in lb/).first().fill("145");
    await page.waitForTimeout(300);

    // Visit every other tab; the Resume bar stays available.
    for (const [name, url] of [
      ["Food", /\/nutrition/],
      ["Faith", /\/faith/],
      ["Run", /\/run/],
      ["Home", /\/home/],
    ] as const) {
      await tab(page, name, url);
      await expect(page.getByRole("link", { name: /^Resume:/ })).toBeVisible();
    }

    // Reopen the app on another screen, then come back through the Resume bar.
    await page.goto("/nutrition");
    await page.reload();
    await page.getByRole("link", { name: /^Resume:/ }).click();
    await page.waitForURL(/\/train\/workout/);
    await expect(page.getByLabel(/set 1 weight in lb/).first()).toHaveValue("135");
    await expect(page.getByRole("button", { name: /set 1 completed/ }).first()).toBeVisible();
    await expect(page.getByLabel(/set 2 weight in lb/).first()).toHaveValue("145");

    // The Train tab doesn't reopen the live session screen by itself (the Resume bar does).
    await tab(page, "Food", /\/nutrition/);
    await tab(page, "Train", /\/train$/);
  });

  test("food: add, edit, copy and delete keep the totals right; favorites and the manual-entry draft persist", async ({ page }) => {
    const email = uniqueEmail("foodjourney");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "plus");
    await page.goto("/nutrition");
    expect(await food(page)).toBe(0);

    // Add 2 bananas (105 kcal each) and star Banana from the amount step.
    await page.getByRole("button", { name: "Add food" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Search" }).click();
    await dialog.getByPlaceholder("e.g. chicken, banana, rice").fill("banana");
    await dialog.getByRole("region", { name: "Common foods" }).getByRole("button", { name: /^Banana/ }).first().click();
    await dialog.getByRole("button", { name: /^Add Banana.* to favorites$/ }).click();
    await expect(dialog.getByRole("button", { name: /^Remove Banana.* from favorites$/ })).toHaveAttribute("aria-pressed", "true");
    await dialog.getByLabel("Amount", { exact: true }).fill("2");
    await dialog.getByLabel("Meal", { exact: true }).selectOption("breakfast");
    await dialog.getByRole("button", { name: "Log food" }).click();
    await expect(dialog.getByRole("status")).toContainText("Logged Banana");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("budget-food")).toHaveText("210");

    // Edit to one banana.
    const breakfast = page.getByTestId("meal-breakfast");
    await breakfast.getByRole("button", { name: /^Edit Banana/ }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Amount", { exact: true }).fill("1");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("budget-food")).toHaveText("105");

    // Copy: yesterday's dinner (200) into today.
    await page.getByRole("link", { name: "Previous day" }).click();
    await page.waitForURL(/date=/);
    await page.getByRole("button", { name: "Quick add calories to Dinner" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Calories").fill("200");
    await dialog.getByRole("button", { name: "Add to Dinner" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Added 200 kcal to Dinner.");
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Back to today" }).click();
    await page.waitForURL(/\/nutrition$/);
    await page.getByRole("button", { name: "Copy dinner from yesterday (1)" }).click();
    await expect(page.getByText("Copied 1 item.")).toBeVisible();
    await expect(page.getByTestId("budget-food")).toHaveText("305");

    // Delete asks first; cancelling keeps the entry, confirming removes it and the totals follow.
    const dinner = page.getByTestId("meal-dinner");
    await dinner.getByRole("button", { name: "Remove Quick add" }).click();
    await expect(page.getByRole("dialog")).toContainText("Remove Quick add from dinner?");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("budget-food")).toHaveText("305");
    await dinner.getByRole("button", { name: "Remove Quick add" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByTestId("budget-food")).toHaveText("105");
    await expect(dinner.getByRole("button", { name: "Edit Quick add" })).toHaveCount(0);

    // The diary row shows the star too, and the Favorites tab logs it again.
    await expect(breakfast.getByRole("button", { name: /^Remove Banana.* from favorites$/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Add food" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Favorites" }).click();
    await dialog.getByRole("region", { name: "Favorite foods" }).getByRole("button", { name: /^Banana/ }).click();
    // The meal defaults to the time of day; this test logs to breakfast whatever time it runs.
    await dialog.getByLabel("Meal", { exact: true }).selectOption("breakfast");
    await dialog.getByRole("button", { name: "Log food" }).click();
    await expect(dialog.getByRole("status")).toContainText("Logged Banana");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("budget-food")).toHaveText("210");

    // Manual entry: an unsent entry survives closing the dialog, switching tabs and a reload.
    await page.getByRole("button", { name: "Add food" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Manual" }).click();
    await dialog.getByRole("textbox", { name: "Food", exact: true }).fill("Homemade granola");
    await dialog.getByLabel("kcal").fill("250");
    await page.waitForTimeout(600);
    await page.keyboard.press("Escape");
    await tab(page, "Train", /\/train/);
    await tab(page, "Food", /\/nutrition/);
    await page.reload();
    await page.getByRole("button", { name: "Add food" }).click();
    dialog = page.getByRole("dialog");
    // The dialog reopens on the tab you left it on.
    await expect(dialog.getByRole("tab", { name: "Manual" })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByTestId("draft-restored")).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Food", exact: true })).toHaveValue("Homemade granola");
    await expect(dialog.getByLabel("kcal")).toHaveValue("250");
    await dialog.getByRole("button", { name: "Add entry" }).click();
    await expect(dialog.getByRole("status")).toContainText("Logged Homemade granola");
    await expect(dialog.getByRole("textbox", { name: "Food", exact: true })).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("budget-food")).toHaveText("460");

    // Reopen the app: everything saved is still there.
    await page.reload();
    await expect(page.getByTestId("budget-food")).toHaveText("460");
    await expect(page.getByTestId("meal-breakfast").getByRole("button", { name: /^Edit Banana/ })).toHaveCount(2);
  });

  test("save and recover a journal draft", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("journal"));
    await completeOnboarding(page);
    await tab(page, "Faith", /\/faith/);
    const body = page.getByRole("textbox", { name: "Reflection" });
    await body.fill("Half-written prayer about patience");
    await page.waitForTimeout(600);

    // Leave and come back: the draft is restored, and says so.
    await tab(page, "Home", /\/home/);
    await tab(page, "Faith", /\/faith/);
    await expect(body).toHaveValue("Half-written prayer about patience");
    await expect(page.getByTestId("draft-restored")).toContainText("Unsaved journal entry restored");

    // A reload (app reopened) keeps it too; saving clears it.
    await page.reload();
    await expect(body).toHaveValue("Half-written prayer about patience");
    await page.getByRole("button", { name: "Save entry" }).click();
    await expect(page.getByText("Entry saved. Only you can see it.")).toBeVisible();
    await expect(body).toHaveValue("");
    await page.reload();
    await expect(body).toHaveValue("");
    await expect(page.getByTestId("draft-restored")).toHaveCount(0);
    await expect(page.getByText("Half-written prayer about patience")).toBeVisible();
  });

  test("filters and scroll position come back when you return to a tab, and Back returns to the list", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("scroll"));
    await completeOnboarding(page);
    await page.goto("/train/exercises?category=&equipment=dumbbell&q=");
    const list = page.locator("main ul li a[href^='/train/exercises/']");
    await expect(list.nth(8)).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(500);

    // Switch to Food and back to Train: same filters, same place in the list.
    await tab(page, "Food", /\/nutrition/);
    await tabs(page).getByRole("link", { name: "Train", exact: true }).click();
    await page.waitForURL(/\/train\/exercises\?.*equipment=dumbbell/);
    await expect(page.getByLabel("Equipment")).toHaveValue("dumbbell");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 60);

    // Open an exercise, then use its Back link: back to the filtered list at the same position.
    const target = list.nth(6);
    await target.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => window.scrollY);
    await target.click();
    await page.waitForURL(/\/train\/exercises\/[a-z0-9-]+$/);
    await page.getByRole("link", { name: "Exercise library" }).click();
    await page.waitForURL(/\/train\/exercises\?.*equipment=dumbbell/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 80);

    // Tapping the tab you're already in goes to the section's start.
    await tabs(page).getByRole("link", { name: "Train", exact: true }).click();
    await page.waitForURL(/\/train$/);
  });

  test("an opened-directly detail screen's Back link goes to its section, and signed-out deep links return after login", async ({ page }) => {
    const email = uniqueEmail("back");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await page.goto("/train/exercises/back-squat");
    await page.getByRole("link", { name: "Exercise library" }).click();
    await page.waitForURL(/\/train\/exercises$/);

    await page.context().clearCookies();
    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/login\?next=%2Fcalendar/);
    await page.goto("/run");
    await expect(page).toHaveURL(/\/login\?next=%2Frun/);
  });
});
