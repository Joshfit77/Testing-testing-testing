import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("navigation shell", () => {
  test("five tabs, AI Coach and profile in every main header, text size and Home Scripture settings", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("nav"));
    await completeOnboarding(page);

    // Exactly five bottom tabs, in order, each with a visible label.
    const tabs = page.getByRole("navigation", { name: "Main sections" }).last().getByRole("link");
    await expect(tabs).toHaveText(["Home", "Train", "Nutrition", "Faith", "You"]);
    await expect(tabs.first()).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "More" })).toHaveCount(0);

    // Home: greeting, Scripture card, today's workout, nutrition, Faith today, quick actions, My Progress.
    await expect(page.getByRole("heading", { level: 1, name: /^Hi, / })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Verse of the day/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today's workout" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today's nutrition" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Faith today" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Quick actions" }).getByRole("link")).toHaveText(["Run", "Log food", "AI Coach"]);
    await page.getByRole("link", { name: /My Progress/ }).click();
    await page.waitForURL(/\/progress$/);
    await expect(page.getByRole("heading", { level: 1, name: "My Progress" })).toBeVisible();
    // No "not built yet" placeholders in the store build (the body map is planned in docs/PRO_ROADMAP.md).
    await expect(page.getByText(/Not built yet/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Badges/ }).first()).toBeVisible();
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { level: 1, name: "Training calendar" })).toBeVisible();

    // Every main screen has the Search, Quick add and AI Coach controls in its header, and the You tab.
    for (const [href, title] of [
      ["/home", /^Hi, /],
      ["/train", "Train"],
      ["/nutrition", "Nutrition"],
      ["/faith", "Faith"],
      ["/profile", "You"],
    ] as const) {
      await page.goto(href);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.locator("header").getByRole("link", { name: "AI Coach", exact: true })).toBeVisible();
      await expect(page.locator("header").getByRole("link", { name: "Search", exact: true })).toBeVisible();
      await expect(page.getByTestId("quick-add")).toBeVisible();
      await expect(tabs.filter({ hasText: "You" })).toBeVisible();
    }

    // Quick add opens the sheet with the six everyday things, and the Food tile opens the Add food dialog.
    await page.goto("/faith");
    await page.getByTestId("quick-add").click();
    await expect(page.getByTestId("quick-add-sheet").getByRole("link")).toHaveText(["Food", "Quick workout", "Outdoor run", "Prayer", "Weight"]);
    await expect(page.getByRole("button", { name: "Water: add 250 ml" })).toBeVisible();
    await page.getByTestId("quick-add-sheet").getByRole("link", { name: "Food" }).click();
    await page.waitForURL(/\/nutrition\?add=1/);
    await expect(page.getByRole("dialog", { name: "Add food" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Unified search finds exercises, the Bible and settings.
    await page.goto("/search?q=squat");
    await expect(page.getByRole("heading", { name: "Exercises" })).toBeVisible();
    await page.goto("/search?q=notifications");
    await page.getByRole("link", { name: /^Notifications/ }).click();
    await page.waitForURL(/\/profile\/notifications/);

    // Train hub: Run & walk, Programs, Exercises and the calendar are on the first screen; the rest under More.
    await page.goto("/train");
    await expect(page.getByRole("navigation", { name: "Training sections" }).getByRole("link")).toHaveText([/Run & walk/, /Programs/, /Exercises/, /Training calendar/]);
    await page.getByTestId("train-tools").locator("summary").click();
    await expect(page.getByRole("navigation", { name: "Training tools" }).getByRole("link", { name: "Workout history" })).toBeVisible();
    await page.getByRole("navigation", { name: "Training sections" }).getByRole("link", { name: /Programs/ }).click();
    await page.waitForURL(/\/train\/programs/);
    await expect(page.getByRole("heading", { name: "Program library" })).toBeVisible();

    // AI Coach opens the conversation screen with a way back.
    await page.goto("/faith");
    await page.locator("header").getByRole("link", { name: "AI Coach", exact: true }).click();
    await page.waitForURL(/\/coach/);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.waitForURL(/\/faith/);

    // The You tab returns to the last You screen used (Notifications, from the search above); a second tap, from
    // inside the section, goes to its root, like a native tab bar.
    await tabs.filter({ hasText: "You" }).click();
    await page.waitForURL(/\/profile\/notifications/);
    await tabs.filter({ hasText: "You" }).click();
    await page.waitForURL(/\/profile$/);
    await expect(page.getByRole("heading", { level: 1, name: "You" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Your sections" }).getByRole("link")).toHaveText([/My Progress/, /Badges/, /Sleep & Recovery/, /Goals & training preferences/, /Notifications/, /Plans & billing/, /Customize Home/]);
    // Customize Home (its own screen under You): hide the verse module, Home drops it; reset brings it back.
    await page.getByRole("navigation", { name: "Your sections" }).getByRole("link", { name: /Customize Home/ }).click();
    await page.waitForURL(/\/profile\/customize/);
    await page.getByRole("button", { name: "Hide Verse of the day on Home" }).click();
    await page.waitForTimeout(800);
    await page.goto("/home");
    await expect(page.getByRole("link", { name: /^Verse of the day/ })).toHaveCount(0);
    await page.goto("/profile/customize");
    await page.getByRole("button", { name: "Reset to the default for my goal" }).click();
    await page.waitForTimeout(800);
    await page.goto("/home");
    await expect(page.getByRole("link", { name: /^Verse of the day/ })).toBeVisible();
    await page.goto("/profile");

    // Text size applies immediately and persists across reloads.
    await page.getByRole("radio", { name: "Large", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
    await expect(page.getByRole("radio", { name: "Large", exact: true })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "Default", exact: true }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-text-size", /.+/);

    // Hiding the Home Scripture card keeps the Faith tab.
    await page.getByRole("switch", { name: "Scripture card on Home" }).click();
    await page.waitForTimeout(800);
    await page.goto("/home");
    await expect(page.getByRole("link", { name: /^Verse of the day/ })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Main sections" }).last().getByRole("link", { name: "Faith" })).toBeVisible();
  });
});
