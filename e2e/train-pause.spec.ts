import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("pausing and resuming a program", () => {
  test("Train still opens with no active program, and the paused program offers Resume and Restart", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("pause"));
    await completeOnboarding(page);

    await page.goto("/train");
    const programLink = page.getByRole("link", { name: /Week 1 of \d+/ });
    await expect(programLink).toBeVisible();
    const programHref = (await programLink.getAttribute("href"))!;
    await page.getByRole("button", { name: "Pause program" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();

    // Before the fix this page crashed for anyone without an active program.
    await page.goto("/train");
    await expect(page.getByText("No active program")).toBeVisible();
    await expect(page.getByText(/couldn.t load this page/i)).toHaveCount(0);

    await page.goto(programHref);
    await expect(page.getByRole("button", { name: "Restart from week 1" })).toBeVisible();
    await page.getByRole("button", { name: "Resume (week 1)" }).click();
    await expect(page).toHaveURL(/\/home/);
    await page.goto("/train");
    await expect(page.getByRole("link", { name: /Week 1 of \d+/ })).toBeVisible();
  });
});
