import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, seedRows, signUpAndConfirm, uniqueEmail } from "./helpers";

/** In-app purchase screens. Real App Store purchases need a device; these cover what the server renders. */
test.describe("App Store / Google Play billing", () => {
  test("inside the iPhone app, Plans & billing never offers web checkout", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NarrowGateApp",
    });
    const page = await context.newPage();
    const email = uniqueEmail("iap-native");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await page.goto("/profile/billing");
    await expect(page.getByRole("heading", { name: "Plans & billing" })).toBeVisible();
    // This test server has no RevenueCat keys, so the app says in-app purchases aren't available yet.
    await expect(page.getByText(/In-app purchases aren.t available/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Choose (Plus|Pro)/ })).toHaveCount(0);
    await context.close();
  });

  test("a member billed by the App Store sees where to manage it, and that deleting the account won't cancel it", async ({ page }) => {
    const email = uniqueEmail("iap-web");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    const expires = new Date(Date.now() + 20 * 86_400_000).toISOString();
    await seedRows(email, "store_subscriptions", [
      { store: "app_store", product_id: "ngf_pro_monthly", plan: "pro", purchased_at: new Date().toISOString(), expires_at: expires, unsubscribe_detected_at: new Date().toISOString(), is_sandbox: true },
    ]);
    await grantPlan(email, "pro", "app_store");

    await page.goto("/profile/billing");
    await expect(page.getByTestId("current-plan")).toHaveText("Pro All Access");
    await expect(page.getByTestId("current-plan-detail")).toHaveText(/^Billed through the App Store · Monthly · Ends /);
    await expect(page.getByText(/billed through the App Store. Manage or cancel it on your phone in your Apple Account/)).toBeVisible();
    await expect(page.getByText(/Your membership is set to cancel. You keep Pro All Access until .* and won't be charged again/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Manage billing" })).toHaveCount(0);
    // Billed by the App Store: the website never offers a second purchase.
    await expect(page.getByRole("button", { name: /Start Pro All Access/ })).toHaveCount(0);

    await page.goto("/profile");
    await expect(page.getByRole("alert").filter({ hasText: "Deleting your account won't cancel it" })).toBeVisible();
  });
});
