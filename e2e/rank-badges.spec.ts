import { expect, test } from "@playwright/test";
import { answerOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("rank badges (Fitness, Food, Faith)", () => {
  test("nine ranks per category, BSB verse in the detail view, and a Faith rank earned from real activity", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("ranks"));
    await answerOnboarding(page);

    await page.goto("/progress/badges");
    const tabs = page.getByRole("tablist", { name: "Badge categories" });
    await expect(tabs.getByRole("tab")).toHaveCount(3);
    await expect(tabs.getByRole("tab", { name: /Fitness/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("list", { name: "Fitness ranks" }).getByRole("listitem")).toHaveCount(9);
    await expect(page.getByRole("button", { name: "Foundation, rank 1 of 9, locked" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Conqueror, rank 9 of 9, locked" })).toBeVisible();

    // Detail view: requirement, progress and the BSB verse.
    await page.getByRole("button", { name: "Disciplined, rank 4 of 9, locked" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Disciplined" })).toBeVisible();
    await expect(dialog.getByText("Complete 50 workouts.")).toBeVisible();
    await expect(dialog.getByText("1 Corinthians 9:25–27 (BSB)")).toBeVisible();
    await expect(dialog.getByText(/trains with strict discipline/)).toBeVisible();
    await page.keyboard.press("Escape");

    await tabs.getByRole("tab", { name: /Food/ }).click();
    await expect(page.getByRole("list", { name: "Food ranks" }).getByRole("listitem")).toHaveCount(9);
    await tabs.getByRole("tab", { name: /Faith/ }).click();
    await expect(page.getByRole("list", { name: "Faith ranks" }).getByRole("listitem")).toHaveCount(9);
    await expect(page.getByRole("button", { name: "Seed, rank 1 of 9, locked" })).toBeVisible();

    // Take part in Faith once (check off a practice): Seed is earned, and stays earned after a reload.
    await page.goto("/faith");
    await page.getByRole("button", { name: "Add Prayer" }).click();
    await page.getByRole("button", { name: /^Prayer, Today/ }).click();
    await expect(page.getByRole("button", { name: /^Prayer, Today/ })).toHaveAttribute("aria-pressed", "true");

    await page.goto("/progress/badges?tab=faith");
    // The new rank is revealed once, with its verse.
    const reveal = page.getByRole("dialog", { name: "Seed" });
    await expect(reveal.getByText("New Faith rank")).toBeVisible();
    await expect(reveal.getByText("Mark 4:26 (BSB)")).toBeVisible();
    await reveal.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: "Seed, rank 1 of 9, earned" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Faith/ })).toContainText("Rank 1 of 9");
    // An earned rank shows its verse on the badge list; locked ranks don't yet.
    const faithRanks = page.getByRole("list", { name: "Faith ranks" });
    await expect(faithRanks.getByText("Mark 4:26 (BSB)")).toBeVisible();
    await expect(faithRanks.getByText(/The kingdom of God is like a man who scatters seed/)).toBeVisible();
    await expect(faithRanks.getByText("1 Peter 2:2 (BSB)")).toHaveCount(0);

    // After a reload it is still earned, and the reveal doesn't repeat.
    await page.reload();
    await expect(page.getByRole("button", { name: "Seed, rank 1 of 9, earned" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Seed, rank 1 of 9, earned" }).click();
    await expect(page.getByRole("dialog").getByText(/^Earned /)).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Mark 4:26 (BSB)")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/don.t measure your faith/)).toBeVisible();

    // The older achievements are still listed.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "More achievements" })).toBeVisible();
    await expect(page.getByText("First Step")).toBeVisible();
  });
});
