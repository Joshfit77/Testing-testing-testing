import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("navigation shell", () => {
  test("five tabs, AI Coach and profile in every main header, text size and Home Scripture settings", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("nav"));
    await completeOnboarding(page);

    // Exactly five bottom tabs, in order, each with a visible label.
    const tabs = page.getByRole("navigation", { name: "Main sections" }).last().getByRole("link");
    await expect(tabs).toHaveText(["Home", "Train", "Run", "Food", "Faith"]);
    await expect(tabs.first()).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "More" })).toHaveCount(0);

    // Home: greeting, Scripture card, today's workout, My Progress and the calendar.
    await expect(page.getByRole("heading", { level: 1, name: /^Hi, / })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Verse of the day/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today's workout" })).toBeVisible();
    await page.getByRole("link", { name: /My Progress/ }).click();
    await page.waitForURL(/\/progress$/);
    await expect(page.getByRole("heading", { level: 1, name: "My Progress" })).toBeVisible();
    // No "not built yet" placeholders in the store build (the body map is planned in docs/PRO_ROADMAP.md).
    await expect(page.getByText(/Not built yet/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Badges/ }).first()).toBeVisible();
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { level: 1, name: "Training calendar" })).toBeVisible();

    // Every main screen has the labelled AI Coach button and a separate profile button.
    for (const [href, title] of [
      ["/home", /^Hi, /],
      ["/train", "Train"],
      ["/nutrition", "Food"],
      ["/faith", "Faith"],
    ] as const) {
      await page.goto(href);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole("link", { name: "AI Coach", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: /^Profile and settings/ }).first()).toBeVisible();
    }

    // Train hub links to the library.
    await page.goto("/train");
    await page.getByRole("navigation", { name: "Training tools" }).getByRole("link", { name: "Programs" }).click();
    await page.waitForURL(/\/train\/programs/);
    await expect(page.getByRole("heading", { name: "Program library" })).toBeVisible();

    // AI Coach opens the conversation screen with a way back.
    await page.goto("/faith");
    await page.getByRole("link", { name: "AI Coach", exact: true }).click();
    await page.waitForURL(/\/coach/);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.waitForURL(/\/faith/);

    // Profile icon opens Profile & Settings.
    await page.getByRole("link", { name: /^Profile and settings/ }).first().click();
    await page.waitForURL(/\/profile$/);
    await expect(page.getByRole("heading", { level: 1, name: "Profile & Settings" })).toBeVisible();

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
