import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("Run tab: manual runs and walks", () => {
  test("log a manual run and a treadmill walk, see weekly mileage, edit, delete and recalculate", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("run"));
    await completeOnboarding(page); // imperial units → miles

    await page.goto("/run");
    await expect(page.getByRole("heading", { name: "Run", level: 1 })).toBeVisible();
    // Outdoor tab: live GPS recording opens on its own page (covered in gps-run.spec.ts); nothing starts here.
    await expect(page.getByRole("link", { name: /Outdoor run/ })).toHaveAttribute("href", "/run/record?kind=run");
    await expect(page.getByRole("link", { name: /Outdoor walk/ })).toHaveAttribute("href", "/run/record?kind=walk");
    await expect(page.getByRole("button", { name: /^Start/ })).toHaveCount(0);
    await expect(page.getByTestId("run-this-week-run")).toHaveText("No runs");
    await expect(page.getByTestId("run-records")).toContainText("5K");

    await page.getByRole("link", { name: "Log a run or walk manually" }).click();
    await page.waitForURL(/tab=log/);

    // Validation: duration is required, moving time can't exceed it.
    await page.getByRole("spinbutton", { name: /^Distance/ }).fill("3.1");
    await page.getByRole("button", { name: "Save run" }).click();
    await expect(page.getByText("Enter the duration")).toBeVisible();
    await page.getByLabel("Duration").fill("0:31:00");
    await page.getByLabel("Moving time", { exact: true }).fill("0:40:00");
    await page.getByRole("button", { name: "Save run" }).click();
    await expect(page.getByText("Moving time can't be longer than the total duration")).toBeVisible();
    // The typed values survive the failed submit.
    await expect(page.getByRole("spinbutton", { name: /^Distance/ })).toHaveValue("3.1");

    await page.getByLabel("Moving time", { exact: true }).fill("");
    await expect(page.getByTestId("pace-preview")).toContainText("10:00 /mi");
    await page.getByLabel("Notes (optional)").fill("Easy loop by the river");
    await page.getByRole("button", { name: "Save run" }).click();

    await page.waitForURL(/\/run\/activities\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("status").filter({ hasText: "Run saved · 3.10 mi · 10:00 /mi." })).toBeVisible();
    await expect(page.getByTestId("activity-distance")).toHaveText("3.10 mi");
    await expect(page.getByTestId("activity-pace")).toHaveText("10:00 /mi");
    await expect(page.getByTestId("activity-notes")).toHaveText("Easy loop by the river");
    await expect(page.getByText("Manual entry", { exact: true })).toBeVisible();
    await expect(page.getByText(/No route: manual entries/)).toBeVisible();
    const runUrl = page.url();

    // A treadmill walk.
    await page.goto("/run?tab=log");
    await page.getByText("Walk", { exact: true }).click();
    await page.getByText("Treadmill", { exact: true }).click();
    await page.getByRole("spinbutton", { name: /^Distance/ }).fill("1.5");
    await page.getByLabel("Duration").fill("30:00");
    await page.getByRole("button", { name: "Save walk" }).click();
    await page.waitForURL(/\/run\/activities\//);
    await expect(page.getByTestId("activity-pace")).toHaveText("20:00 /mi");
    await expect(page.getByText("Treadmill", { exact: true })).toBeVisible();

    // History: grouped by week, runs and walks totalled separately.
    await page.goto("/run?tab=history");
    await expect(page.getByTestId("history-this-week-run")).toHaveText("3.10 mi · 1 run");
    await expect(page.getByTestId("history-this-week-walk")).toHaveText("1.50 mi · 1 walk");

    // Edit the run's distance; totals and pace follow.
    await page.goto(runUrl);
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await page.waitForURL(/\/edit$/);
    await expect(page.getByLabel("Duration")).toHaveValue("0:31:00");
    await page.getByRole("spinbutton", { name: /^Distance/ }).fill("6.2");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(runUrl);
    await expect(page.getByTestId("activity-distance")).toHaveText("6.20 mi");
    await expect(page.getByTestId("activity-pace")).toHaveText("5:00 /mi");
    await page.goto("/run");
    await expect(page.getByTestId("run-this-week-run")).toHaveText("6.20 mi · 1 run");

    // Delete the walk (with confirmation); totals recalculate.
    await page.goto("/run?tab=history");
    await page.getByRole("link", { name: /Walk · 1\.50 mi/ }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Delete this walk?");
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await page.waitForURL(/\/run\?tab=history/);
    await expect(page.getByTestId("history-this-week-walk")).toHaveText("No walks");
    await expect(page.getByTestId("history-this-week-run")).toHaveText("6.20 mi · 1 run");
    await expect(page.getByRole("link", { name: /Walk · / })).toHaveCount(0);

    // Persisted across a reload.
    await page.reload();
    await expect(page.getByTestId("history-this-week-run")).toHaveText("6.20 mi · 1 run");
  });
});
