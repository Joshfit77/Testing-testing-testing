import { expect, test } from "@playwright/test";
import { completeOnboarding, serviceRest, signUpAndConfirm, totpCode, uniqueEmail, userIdFor } from "./helpers";

/**
 * The admin AI costs page loads for an administrator (after their authenticator code) with its totals and the
 * app-wide limits. When the app-wide monthly limit can't cover every current Pro member's full allowance, the page
 * says so (logic: globalBudgetCoverage, tests/unit/ai-economics.test.ts); the warning, when shown, names the setting.
 */
test("an admin sees AI costs and the app-wide limits", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("admin-ai");
  await signUpAndConfirm(page, email);
  await completeOnboarding(page);
  const id = await userIdFor(email);
  await serviceRest(`profiles?id=eq.${id}`, { method: "PATCH", body: { role: "admin" } });

  await page.goto("/admin");
  await page.waitForURL(/\/admin\/mfa/);
  const secret = (await page.getByTestId("admin-mfa-secret").innerText()).trim();
  await page.getByLabel("Code").fill(totpCode(secret));
  await page.getByRole("button", { name: "Continue to Admin" }).click();
  await page.waitForURL((u) => u.pathname === "/admin");

  await page.goto("/admin/ai-costs");
  await expect(page.getByRole("heading", { name: "AI costs" })).toBeVisible();
  await expect(page.getByTestId("ai-cost-totals")).toBeVisible();
  await expect(page.getByRole("heading", { name: "App-wide limits" })).toBeVisible();
  await expect(page.getByText("Couldn't load the AI cost report.")).toHaveCount(0);
  const warning = page.getByTestId("ai-budget-short");
  if (await warning.count()) await expect(warning).toContainText("AI_GLOBAL_MONTHLY_BUDGET_USD");
});
