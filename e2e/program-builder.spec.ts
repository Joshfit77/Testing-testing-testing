import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("Build my program", () => {
  test("builds a bench press specialization from a best set and makes it the active program", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("builder"));
    await completeOnboarding(page);

    await page.goto("/train");
    await page.getByRole("link", { name: /Build my program/ }).first().click();
    await page.waitForURL(/\/train\/build/);

    const next = () => page.getByRole("button", { name: /^Next/ }).click();
    await page.getByRole("button", { name: /Bench Press Only/ }).click();
    await next();

    // About you is prefilled from onboarding (5 ft 10 in, 185 lb, age 34).
    await expect(page.getByLabel("Height (ft)")).toHaveValue("5");
    await expect(page.getByLabel("Height (in)")).toHaveValue("10");
    await next();

    await page.getByRole("button", { name: /Increase my 1-rep max/ }).click();
    await next();

    await page.getByRole("button", { name: "Recent best set" }).click();
    await page.getByLabel("Weight (lb)").fill("225");
    await page.getByLabel("Reps").fill("5");
    await expect(page.getByText(/Estimated 1RM/)).toContainText("263 lb");
    await next();
    await next(); // equipment (prefilled)

    await expect(page.getByText("Review your program")).toBeVisible();
    await expect(page.getByText(/70% · 185 lb/).first()).toBeVisible();
    await page.getByRole("button", { name: "Build & start program" }).click();

    await page.waitForURL(/\/home/);
    await page.goto("/train");
    await expect(page.getByText(/Bench/).first()).toBeVisible();
    await page.goto("/home");
    await page.getByRole("link", { name: /Start/ }).first().click();
    await expect(page.getByText(/Bench Press/).first()).toBeVisible();
  });
});
