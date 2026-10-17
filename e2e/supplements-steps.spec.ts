import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("supplements and steps", () => {
  test("a free user builds a supplement stack, checks it off and removes it", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("supps"));
    await completeOnboarding(page);

    // Linked from the free Food view.
    await page.goto("/nutrition");
    await page.getByRole("link", { name: /Supplements/ }).click();
    await page.waitForURL(/\/nutrition\/supplements/);
    await expect(page.getByRole("heading", { name: "Supplements", level: 1 })).toBeVisible();
    await expect(page.getByText(/Your stack is empty/)).toBeVisible();
    await expect(page.getByText(/NSF Certified for Sport/)).toBeVisible();

    // Category filter is client-side.
    await page.getByRole("button", { name: "Recovery & sleep" }).click();
    await expect(page.getByRole("heading", { name: "Melatonin" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Creatine monohydrate" })).toHaveCount(0);
    await page.getByRole("button", { name: "Performance" }).click();

    await page.getByRole("button", { name: "Add Creatine monohydrate to stack" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Creatine monohydrate added to your stack." })).toBeVisible();
    await expect(page.getByTestId("stack-count")).toHaveText("0 of 1 taken");

    const toggle = page.getByRole("button", { name: /Creatine monohydrate: not yet/ });
    await toggle.click();
    await expect(page.getByRole("button", { name: /Creatine monohydrate: taken today/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("stack-count")).toHaveText("1 of 1 taken");

    // Persisted on reload.
    await page.reload();
    await expect(page.getByTestId("stack-count")).toHaveText("1 of 1 taken");

    await page.getByRole("button", { name: "Remove Creatine monohydrate from stack" }).click();
    await expect(page.getByText(/Your stack is empty/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Creatine monohydrate to stack" })).toBeVisible();
  });

  test("vegan users see diet notes on animal-based supplements", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("supps-vegan"));
    await completeOnboarding(page);
    await page.goto("/nutrition/diets");
    await page.getByRole("button", { name: /^Vegan/ }).click();
    await page.getByRole("button", { name: "Choose Vegan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Your diet is now Vegan." })).toBeVisible();

    await page.goto("/nutrition/supplements");
    await expect(page.getByText("Not suitable for your Vegan diet — try Plant protein (pea or soy blend).").first()).toBeVisible();
  });

  test("steps can be entered by hand on Home and the goal changed", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("steps"));
    await completeOnboarding(page);

    await expect(page.getByTestId("steps-today")).toHaveText("0 steps today");
    // On the web there's no health sync button, only a note.
    await expect(page.getByText("Apple Health and Health Connect sync in the Narrow Gate phone app.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Sync (Apple Health|Health Connect)/ })).toHaveCount(0);

    await page.getByLabel("Today's steps").fill("6543");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "6,543 steps saved for today." })).toBeVisible();
    await expect(page.getByTestId("steps-today")).toHaveText("6,543 steps today");
    await expect(page.getByText("1,457 to go")).toBeVisible();

    // Overwrite.
    await page.getByLabel("Today's steps").fill("9000");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("steps-today")).toHaveText("9,000 steps today");
    await expect(page.getByText(/Goal reached/)).toBeVisible();

    // Invalid values are rejected with a message.
    await page.getByRole("button", { name: "Goal", exact: true }).click();
    await page.getByLabel("Daily step goal").fill("500");
    await page.getByRole("button", { name: "Save goal" }).click();
    await expect(page.getByText("Set a goal of at least 1,000")).toBeVisible();
    await page.getByLabel("Daily step goal").fill("12000");
    await page.getByRole("button", { name: "Save goal" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Daily step goal set to 12,000." })).toBeVisible();
    await expect(page.getByText("3,000 to go")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("steps-today")).toHaveText("9,000 steps today");
  });
});
