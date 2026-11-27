import { expect, test } from "@playwright/test";
import { completeOnboarding, PASSWORD, serviceRest, signUpAndConfirm, uniqueEmail, userIdFor } from "./helpers";

/**
 * Deleting an account from the app, end to end: the form needs DELETE and the password (a wrong one is refused and
 * nothing is removed), then the account and its data are gone, the member is signed out, and signing in again fails.
 * tests/integration/account-deletion.test.ts covers every table; this proves the screen does what it says.
 */
test("a member deletes their account from the You tab, and it is really gone", async ({ page }) => {
  const email = uniqueEmail("delete");
  await signUpAndConfirm(page, email);
  await completeOnboarding(page);
  const id = await userIdFor(email);

  await page.goto("/profile#privacy");
  const confirm = page.getByLabel(/Type DELETE to permanently delete your account/);
  await confirm.scrollIntoViewIfNeeded();

  // Without DELETE, or with a wrong password, nothing happens.
  await page.getByLabel("Your password").fill(PASSWORD);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("Type DELETE to confirm.")).toBeVisible();
  await confirm.fill("DELETE");
  await page.getByLabel("Your password").fill("not-the-password");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("That password isn't right.")).toBeVisible();
  expect(await serviceRest<unknown[]>(`profiles?id=eq.${id}&select=id`)).toHaveLength(1);

  // The real thing. (A refused attempt clears the form, so DELETE is typed again: deliberate for a destructive action.)
  await confirm.fill("DELETE");
  await page.getByLabel("Your password").fill(PASSWORD);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.waitForURL(/\/\?deleted=1/);
  expect(await serviceRest<unknown[]>(`profiles?id=eq.${id}&select=id`)).toHaveLength(0);
  expect(await serviceRest<unknown[]>(`workout_sessions?user_id=eq.${id}&select=id`)).toHaveLength(0);

  // Signed out, and the old password no longer works.
  await page.goto("/home");
  await page.waitForURL(/\/(login|$|\?)/);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await expect(page.getByText(/Invalid|incorrect|didn't match|isn't right/i).first()).toBeVisible();
});
