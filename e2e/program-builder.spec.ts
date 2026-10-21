import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("Build my program", () => {
  test("builds a bench press specialization from a best set and makes it the active program", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("builder"));
    await completeOnboarding(page);

    await page.goto("/train/programs");
    // The library is organized by the spec's categories; the type picker by discipline.
    await expect(page.getByRole("heading", { name: "Strongman", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "MMA, boxing & grappling" })).toBeVisible();
    await page.getByRole("navigation", { name: "Program categories" }).getByRole("link", { name: "Bodybuilding & muscle", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Bodybuilding & muscle" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Strongman", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: /Build my program/ }).first().click();
    await page.waitForURL(/\/train\/build/);
    await expect(page.getByRole("heading", { name: "Strength & Powerlifting" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Combat Sports" })).toBeVisible();

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
    // What changes compared with the active (onboarding) program, before anything is applied.
    await expect(page.getByRole("heading", { name: "What changes from your current program" })).toBeVisible();
    await expect(page.getByTestId("plan-changes")).toContainText("→");
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
