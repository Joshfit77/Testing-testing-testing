import { expect, test } from "@playwright/test";
import { PASSWORD, completeOnboarding, serviceRest, signUpAndConfirm, totpCode, uniqueEmail, userIdFor } from "./helpers";

/**
 * F-8: an administrator's second step in the browser. With the password alone, Admin sends them to set up an
 * authenticator (QR code or key) and enter one code; after signing in again, Admin asks for a code before anything
 * else. The database refuses admin work to password-only sessions as well (tests/integration/admin-mfa.test.ts).
 */
test("an admin sets up an authenticator, then needs its code after every sign-in", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("admin-mfa");
  await signUpAndConfirm(page, email);
  await completeOnboarding(page);
  const id = await userIdFor(email);
  await serviceRest(`profiles?id=eq.${id}`, { method: "PATCH", body: { role: "admin" } });

  // Password-only: Admin leads to the set-up screen, not to admin tools.
  await page.goto("/admin");
  await page.waitForURL(/\/admin\/mfa/);
  await expect(page.getByTestId("admin-mfa-enroll")).toBeVisible();
  const secret = (await page.getByTestId("admin-mfa-secret").innerText()).trim();
  await page.getByLabel("Code").fill(totpCode(secret));
  await page.getByRole("button", { name: "Continue to Admin" }).click();
  await page.waitForURL((u) => u.pathname === "/admin");

  // Signed in again with the password: a code first.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/home/);
  await page.goto("/admin/flags");
  await page.waitForURL(/\/admin\/mfa/);
  await expect(page.getByTestId("admin-mfa-verify")).toBeVisible();
  await page.getByLabel("Code").fill("000000" === totpCode(secret) ? "111111" : "000000");
  await page.getByRole("button", { name: "Continue to Admin" }).click();
  await expect(page.getByText(/That code didn't work/)).toBeVisible();
  await page.getByLabel("Code").fill(totpCode(secret));
  await page.getByRole("button", { name: "Continue to Admin" }).click();
  await page.waitForURL((u) => u.pathname === "/admin");
});
