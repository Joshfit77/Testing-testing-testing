import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, seedRows, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * The 2026-11 Pro program work, in the real app: habit programs (Pro to start, tick today's activities), the program
 * preview's milestones and instructions, Home's weekly report card, and the lighter session after a low check-in.
 */
test.describe("Pro programs", () => {
  test("habit program: Free sees it locked; Pro starts it and ticks today's activity", async ({ page }) => {
    const email = uniqueEmail("habits");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);

    await page.goto("/train/habits/nutrition-foundations");
    await expect(page.getByTestId("habit-locked")).toBeVisible();
    await expect(page.getByTestId("review-flag")).toContainText("Not yet reviewed by a registered dietitian");
    await expect(page.getByTestId("habit-weeks")).toContainText("Week 1");

    await grantPlan(email, "pro");
    await page.reload();
    await page.getByRole("button", { name: "Start program" }).click();
    await expect(page.getByTestId("habit-progress")).toContainText("Day 1 of 28");
    const first = page.getByTestId("habit-day").getByRole("checkbox").first();
    await expect(first).toHaveAttribute("aria-checked", "false");
    await first.click();
    await expect(first).toHaveAttribute("aria-checked", "true");
    // Kept after a reload: it was saved on the server.
    await page.reload();
    await expect(page.getByTestId("habit-day").getByRole("checkbox").first()).toHaveAttribute("aria-checked", "true");

    await page.goto("/train/habits");
    await expect(page.getByText("In progress")).toBeVisible();
    await expect(page.getByRole("link", { name: /Nutrition Foundations/ }).first()).toBeVisible();
  });

  test("catalog program preview shows weekly milestones and how to start; Pro sees the weekly report on Home", async ({ page }) => {
    const email = uniqueEmail("catalog");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "pro");

    await page.goto("/train/programs/beginner-strength-foundations-8-week");
    const guide = page.getByTestId("program-guide");
    await expect(guide).toContainText("Before you start");
    await expect(guide).toContainText("Weekly milestones");
    await expect(guide).toContainText("Week 8:");
    await expect(page.getByRole("button", { name: /Start program/ })).toBeVisible();

    // Program length filter.
    await page.goto("/train/programs?weeks=4");
    await expect(page.getByLabel("Program length")).toHaveValue("4");

    await page.goto("/home");
    const card = page.getByTestId("home-report-card");
    await expect(card).toContainText("Weekly report");
    await card.click();
    await page.waitForURL(/\/progress\/reports/);
  });

  test("after a low check-in, today's session can be started lighter without changing the program", async ({ page }) => {
    const email = uniqueEmail("lighter");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    const today = new Date().toISOString().slice(0, 10);
    await seedRows(email, "recovery_checkins", [{ checked_on: today, sleep_quality: 1, energy: 1, soreness: 5, stress: 5, readiness_score: 20 }]);

    await page.goto("/train/recovery");
    const lighter = page.getByTestId("lighter-session");
    await expect(lighter).toContainText("Your program stays as it is");
    await lighter.getByRole("link", { name: /lighter/ }).click();
    await page.waitForURL(/lighter=1/);
    await expect(page.getByText(/Lighter session: one set fewer per exercise/)).toBeVisible();
  });

  test("progress photos: Pro compares two photos side by side or as an overlay with alignment guides", async ({ page }) => {
    const email = uniqueEmail("photos");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "pro");

    // Two small generated images (a drawn rectangle at slightly different places), uploaded through the real dialog.
    const png = async (x: number) =>
      Buffer.from(
        await page.evaluate(async (offset) => {
          const c = document.createElement("canvas");
          c.width = 300;
          c.height = 400;
          const g = c.getContext("2d")!;
          g.fillStyle = "#222";
          g.fillRect(0, 0, 300, 400);
          g.fillStyle = "#c9a227";
          g.fillRect(100 + offset, 80, 100, 260);
          const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
          return Array.from(new Uint8Array(await blob.arrayBuffer()));
        }, x),
      );
    await page.goto("/progress/overview#photos");
    for (const [i, x] of [0, 12].entries()) {
      await page.getByRole("button", { name: "Add photo" }).click();
      await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: `p${i}.png`, mimeType: "image/png", buffer: await png(x) });
      await page.getByRole("button", { name: "Save photo" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
    }

    await page.getByRole("button", { name: "Compare", exact: true }).click();
    const tiles = page.locator("#photos ul li button");
    await tiles.nth(0).click();
    await tiles.nth(1).click();
    await page.getByRole("button", { name: "Compare", exact: true }).last().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Before & after")).toBeVisible();
    await dialog.getByRole("button", { name: "Overlay" }).click();
    const overlay = dialog.getByTestId("photo-overlay");
    await expect(overlay.locator("img")).toHaveCount(2);
    const blend = dialog.getByLabel("Blend between before and after");
    await blend.fill("80");
    await expect(overlay.locator("img").nth(1)).toHaveAttribute("style", /opacity: 0\.8/);
    await dialog.getByLabel("Alignment guides").check();
    await expect(dialog.getByTestId("photo-guides")).toHaveCount(1);
    await dialog.getByRole("button", { name: "Side by side" }).click();
    await expect(dialog.getByTestId("photo-guides")).toHaveCount(2);
  });
});
