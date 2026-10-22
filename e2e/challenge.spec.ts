import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("40 Days Through the Narrow Gate", () => {
  test("Faith is always available; start the challenge and check in for day 1", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("challenge"));
    await completeOnboarding(page);

    // Faith is a main tab for everyone (no opt-in), reached from the bottom navigation.
    await page.getByRole("navigation", { name: "Main sections" }).getByRole("link", { name: "Faith" }).click();
    await page.waitForURL(/\/faith/);
    await expect(page.getByRole("heading", { name: "40 Days Through the Narrow Gate" })).toBeVisible();

    // Start via the explanation pop-up.
    await page.getByRole("button", { name: "Start the challenge" }).click();
    const startDialog = page.getByRole("dialog");
    await expect(startDialog.getByText(/Day 1 is today/)).toBeVisible();
    await startDialog.getByRole("button", { name: "Begin day 1" }).click();
    await expect(page.getByText("Day 1 of 40", { exact: true })).toBeVisible();
    await expect(page.getByText("0 of 40 days complete")).toBeVisible();

    // Open today's devotional and check in.
    await page.getByRole("button", { name: "Read today's devotional" }).click();
    const day = page.getByRole("dialog");
    await expect(day.getByRole("heading", { name: "The Narrow Gate" })).toBeVisible();
    await expect(day.getByText("Matthew 7:13–14 (BSB)")).toBeVisible();
    await day.getByLabel("Read today's devotional").check();
    await day.getByLabel("Trained today").check();
    await day.getByLabel("Note (optional)").fill("Choosing the narrow way today.");
    await day.getByRole("button", { name: "Save check-in" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Day 1 complete." })).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByText("1 of 40 days complete")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Day 1, done/ })).toBeVisible();
    await expect(page.getByText("Day 2, upcoming", { exact: true })).toHaveCount(1);

    // The note is saved and shown again when reopening the day.
    await page.getByRole("button", { name: /^Day 1, done/ }).click();
    await expect(page.getByRole("dialog").getByLabel("Note (optional)")).toHaveValue("Choosing the narrow way today.");
    await page.keyboard.press("Escape");

    // Home's Scripture card opens today's devotional.
    await page.goto("/home");
    await page.getByRole("link", { name: /^Verse of the day/ }).click();
    await page.waitForURL(/\/faith/);
    await expect(page.getByText("Today's devotional · Day 1 of 40")).toBeVisible();
  });
});
