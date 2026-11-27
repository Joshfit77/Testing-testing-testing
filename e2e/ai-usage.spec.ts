import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";

/** The AI usage screen and coaching styles, in the real app. Free sees no allowance (no AI on Free). */
test("AI usage: Free sees Pro; Pro sees requests, advanced requests, renewal and rules; coaching style saves", async ({ page }) => {
  const email = uniqueEmail("usage");
  await signUpAndConfirm(page, email);
  await completeOnboarding(page);

  await page.goto("/coach/usage");
  await expect(page.getByText(/included with Pro All Access/)).toBeVisible();
  await expect(page.getByTestId("ai-requests-left")).toHaveCount(0);

  await grantPlan(email, "pro");
  await page.reload();
  await expect(page.getByTestId("ai-requests-left")).toContainText("150");
  await expect(page.getByTestId("ai-advanced-left")).toContainText("10");
  await expect(page.getByTestId("ai-renews")).toContainText("Renews on");
  await expect(page.getByText("Each Bible study question")).toBeVisible();
  await expect(page.getByText("Your weekly progress report")).toBeVisible();
  await expect(page.getByText(/\$\d/)).toHaveCount(0); // no prices or margins shown

  await page.goto("/coach/memory");
  const style = page.getByTestId("coach-style");
  await style.getByLabel(/Direct performance coach/).check();
  await style.getByRole("button", { name: "Save style" }).click();
  await expect(page.getByText("Coaching style: Direct performance coach.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("coach-style").getByLabel(/Direct performance coach/)).toBeChecked();
});
