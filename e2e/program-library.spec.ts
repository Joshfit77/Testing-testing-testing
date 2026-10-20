import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("program library", () => {
  test("free programs in every discipline, beginner-first ordering, and week-by-week templates", async ({ page }) => {
    const email = uniqueEmail("library");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);

    // Strength discipline: the novice program is free, listed before advanced programs.
    await page.goto("/train?discipline=strength");
    const cards = page.locator("ul li h4");
    const names = await cards.allTextContents();
    const novice = names.findIndex((n) => /Novice Linear Progression/i.test(n));
    const peak = names.findIndex((n) => /12-Week Powerlifting Peak/i.test(n));
    expect(novice).toBeGreaterThanOrEqual(0);
    expect(peak).toBeGreaterThan(novice);

    // A free program per discipline is startable on the free plan.
    for (const slug of ["barbell-strength-foundations", "strongman-foundations", "full-body-hypertrophy-3-day", "mma-off-camp-2-day", "aerobic-base-run-walk", "agility-footwork", "foundations-full-body"]) {
      await page.goto(`/train/programs/${slug}`);
      await expect(page.getByRole("button", { name: /Start program/ }), slug).toBeVisible();
    }

    // Novice A/B alternation: week 2 starts with workout B.
    await page.goto("/train/programs/barbell-strength-foundations?week=2");
    await expect(page.locator("ol li h3").first()).toHaveText(/Workout B/i);

    // Premium templates are locked on the free plan...
    await page.goto("/train/programs/wave-strength-training-max");
    await expect(page.getByRole("link", { name: /Upgrade to unlock/ })).toBeVisible();

    // ...and show their training-max percentages and deload once unlocked.
    await grantPlan(email, "plus");
    await page.goto("/train/programs/wave-strength-training-max?week=1");
    await expect(page.getByText("65% / 75% / 85% TM").first()).toBeVisible();
    await page.goto("/train/programs/wave-strength-training-max?week=4");
    await expect(page.getByText("Deload", { exact: true })).toBeVisible();
    await expect(page.getByText("40% / 50% / 60% TM").first()).toBeVisible();
  });
});
