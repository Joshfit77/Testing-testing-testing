import { expect, test } from "@playwright/test";
import { completeOnboarding, getEmailLink, grantPlan, PASSWORD, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("welcome, sign-up and diets", () => {
  test("the welcome page email carries into sign-up, and setup asks weight, age, sex and height", async ({ page }) => {
    const email = uniqueEmail("welcome");
    await page.goto("/");
    await expect(page.getByText(/Welcome · Rooted in faith/)).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Sign up free" }).click();
    await page.waitForURL(/\/signup\?email=/);
    await expect(page.getByLabel("Email")).toHaveValue(email);

    await page.getByLabel("Name").fill("Welcome Tester");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("I confirm I am 18 years of age or older.").check();
    await page.getByRole("checkbox", { name: /I agree to the/ }).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByText("Check your inbox").waitFor();
    await page.goto(await getEmailLink(email, /http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify[^"'\s<]+/));

    await page.waitForURL(/\/onboarding/);
    await page.getByRole("button", { name: "Lose body fat", exact: true }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: /^Continue/ }).click(); // optional second goal: Continue skips it too
    // Sex is required (only used for calorie math).
    await expect(page.getByText(/only used to estimate your daily calories/i)).toBeVisible();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByText("Please choose male, female or prefer not to say.")).toBeVisible();
    await page.getByRole("button", { name: /^Back/ }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: "Female", exact: true }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByLabel("Age").fill("29");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByLabel("Height (ft)").fill("5");
    await page.getByLabel("Height (in)").fill("5");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByLabel(/Current weight/).fill("150");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: /^Continue/ }).click(); // weight goal is optional
    await page.getByRole("button", { name: /^Not very active/ }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: "Under 1 year", exact: true }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: /^Dumbbells only/ }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: /Mediterranean/ }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: "Skip", exact: true }).click(); // optional display step
    await page.getByRole("button", { name: "Build my plan" }).click();
    await page.waitForURL(/\/plan/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Your plan is ready" })).toBeVisible();

    await page.goto("/nutrition/diets");
    await expect(page.getByRole("button", { name: /Mediterranean.*Your diet/ })).toBeVisible();
  });

  test("changing diet updates targets and marks foods that fit", async ({ page }) => {
    const email = uniqueEmail("diet");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "plus");

    await page.goto("/nutrition");
    await expect(page.getByText("Your diet")).toBeVisible();
    await expect(page.getByText("Balanced", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: /Your diet/ }).click();
    await page.waitForURL(/\/nutrition\/diets/);
    await page.getByRole("button", { name: /^Keto/ }).click();
    await expect(page.getByText(/Talk to your doctor first/)).toBeVisible();
    await page.getByRole("button", { name: "Choose Keto" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Your diet is now Keto." })).toBeVisible();

    await page.goto("/nutrition");
    await expect(page.getByText("Keto", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add food" }).click();
    await page.getByPlaceholder("e.g. chicken, banana, rice").fill("salmon");
    await expect(page.getByRole("listitem").filter({ hasText: "Salmon" }).getByText("Fits Keto")).toBeVisible();
    await page.getByPlaceholder("e.g. chicken, banana, rice").fill("banana");
    await expect(page.getByRole("listitem").filter({ hasText: "Banana" }).first()).toBeVisible();
    await expect(page.getByText("Fits Keto")).toHaveCount(0);
  });
});
