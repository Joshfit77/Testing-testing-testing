import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("program library", () => {
  test("every discipline in the library, beginner-first ordering, Pro to start, and week-by-week templates", async ({ page }) => {
    const email = uniqueEmail("library");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);

    // Strength discipline: the novice program is listed before advanced programs.
    await page.goto("/train/programs?discipline=strength");
    const cards = page.locator("ul li h4");
    const names = await cards.allTextContents();
    const novice = names.findIndex((n) => /Novice Linear Progression/i.test(n));
    const peak = names.findIndex((n) => /12-Week Powerlifting Peak/i.test(n));
    expect(novice).toBeGreaterThanOrEqual(0);
    expect(peak).toBeGreaterThan(novice);

    // Structured programs are Pro for new enrollments: Free sees the outline and an upgrade link in every discipline...
    const perDiscipline = ["barbell-strength-foundations", "strongman-foundations", "full-body-hypertrophy-3-day", "mma-off-camp-2-day", "beginner-run-walk-5k-10-week", "agility-footwork", "first-30-days-in-the-gym"];
    for (const slug of perDiscipline) {
      await page.goto(`/train/programs/${slug}`);
      await expect(page.getByRole("link", { name: /Upgrade to unlock/ }), slug).toBeVisible();
    }
    // ...and Pro can start any of them.
    await grantPlan(email, "pro");
    for (const slug of perDiscipline) {
      await page.goto(`/train/programs/${slug}`);
      await expect(page.getByRole("button", { name: /Start program/ }), slug).toBeVisible();
    }

    // Novice A/B alternation: week 2 starts with workout B.
    await page.goto("/train/programs/barbell-strength-foundations?week=2");
    await expect(page.locator("ol li h3").first()).toHaveText(/Workout B/i);

    // Templates show their training-max percentages and deload.
    await page.goto("/train/programs/wave-strength-training-max?week=1");
    await expect(page.getByText("65% / 75% / 85% TM").first()).toBeVisible();
    await page.goto("/train/programs/wave-strength-training-max?week=4");
    await expect(page.getByText("Deload", { exact: true })).toBeVisible();
    await expect(page.getByText("40% / 50% / 60% TM").first()).toBeVisible();
  });
});
