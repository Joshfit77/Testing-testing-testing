import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * Checking an ingredient label by typing it (free, no AI): additives with the app's evidence, added sugars, sodium
 * sources, allergens with their limits stated, and logging the label's nutrition to the diary.
 */
test("Free: type a label, check it with the app's rules, then log its nutrition", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndConfirm(page, uniqueEmail("label-free"));
  await completeOnboarding(page);
  await page.goto("/nutrition/scanner");
  await page.getByTestId("label-check-link").click();
  await page.waitForURL(/\/nutrition\/label/);
  // Reading a photo is Pro (it uses the AI); typing is free.
  await expect(page.getByTestId("label-photo-unavailable")).toContainText("included with Pro");

  await page.getByLabel("Product name (optional)").fill("Cherry Fizz");
  await page.getByRole("textbox", { name: "Ingredients" }).fill("Carbonated water, sugar, acid: citric acid, colour: E129, sweetener: aspartame, sodium nitrite, flavourings. No added salt.");
  await page.getByLabel("Allergy advice (optional)").fill("May contain milk.");
  await page.getByText("Nutrition from the label (optional)").click();
  await page.getByLabel("Values are per").selectOption("100ml");
  await page.getByLabel("Serving size (g or ml)").fill("330");
  await page.getByLabel("kcal").fill("42");
  await page.getByLabel("Protein g").fill("0");
  await page.getByLabel("Carbs g").fill("10.6");
  await page.getByLabel("of which sugars g").fill("10.6");
  await page.getByLabel("Fat g", { exact: true }).fill("0");
  await page.getByLabel("Salt g").fill("0.02");
  await page.getByTestId("label-check").click();

  const result = page.getByTestId("label-result");
  await expect(result.getByTestId("alert-e129")).toContainText("Synthetic colour");
  await expect(result.getByTestId("alert-e951")).toContainText("Aspartame");
  // A nitrite in a drink isn't processed meat: none of IARC's processed-meat statistics.
  await expect(result.getByTestId("alert-e250")).not.toContainText("Group 1");
  await expect(result.getByTestId("alert-added_sugars")).toContainText("medium in sugars (10.6 g per 100 ml");
  // Sodium nitrite is a sodium source; "No added salt" isn't salt.
  await expect(result.getByTestId("alert-sodium_sources")).toContainText("Named in the ingredients: sodium nitrite.");
  const allergens = result.getByTestId("label-allergens");
  await expect(allergens).toContainText("Contains: none recognised in the text");
  await expect(allergens).toContainText("May contain: Milk");
  await expect(allergens).toContainText("not proof that a food is free of it");

  // Any edit makes the result out of date until it's checked again.
  await page.getByRole("textbox", { name: "Ingredients" }).fill("Carbonated water, sugar, acid: citric acid, colour: E129, sweetener: aspartame, flavourings.");
  await expect(page.getByTestId("label-check")).toHaveText(/Check again/);
  await expect(page.getByTestId("label-save")).toBeDisabled();
  await page.getByTestId("label-check").click();
  await expect(result.getByTestId("alert-sodium_sources")).toHaveCount(0);

  await page.getByLabel("Amount (ml)").fill("330");
  await page.getByLabel("Meal", { exact: true }).selectOption("lunch");
  await page.getByTestId("label-save").click();
  await expect(page.getByTestId("label-saved")).toContainText("Added Cherry Fizz to lunch.");
  await page.getByTestId("label-saved").getByRole("link", { name: "Go to my diary" }).click();
  await expect(page.getByRole("button", { name: "Edit Cherry Fizz" })).toContainText("330 ml (from a label you checked) · 139 kcal");
});
