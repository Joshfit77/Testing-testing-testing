import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";

const chromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
// Chromium's built-in fake camera (a moving test pattern) stands in for a phone camera.
test.use({
  launchOptions: { ...(existsSync(chromium) ? { executablePath: chromium } : {}), args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

const PHOTO = "public/icons/icon-512.png";

/** A visible <img> isn't enough: a blocked or broken image still shows its alt text. */
async function expectLoaded(img: ReturnType<Page["locator"]>) {
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => (i.complete ? i.naturalWidth : 0))).toBeGreaterThan(0);
}

async function uploadFor(page: Page, pose: "front" | "side" | "back") {
  await page.getByTestId(`scan-step-${pose}`).getByLabel(`Upload ${pose === "back" ? "rear" : pose} photo`).setInputFiles(PHOTO);
  await expect(page.getByTestId("scan-review")).toBeVisible();
}

test.describe("Body Scan", () => {
  test("is a Pro feature", async ({ page }) => {
    const email = uniqueEmail("scan-plus");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "plus");
    await page.goto("/progress");
    await expect(page.getByRole("link", { name: /Body Scan/ })).toContainText("Pro:");
    await page.goto("/progress/body-scan");
    await expect(page.getByText("Included with Pro")).toBeVisible();
    await page.goto("/progress/body-scan/new");
    await page.waitForURL(/\/progress\/body-scan$/);
  });

  test("Pro: consent, guided capture with review and retake, measurements, history, comparison and deletion", async ({ page, context }) => {
    test.setTimeout(150_000);
    const email = uniqueEmail("scan-pro");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page); // imperial
    await grantPlan(email, "pro");

    await page.goto("/progress/body-scan");
    const consent = page.getByTestId("body-scan-consent");
    await expect(consent).toContainText("does not estimate body fat");
    await expect(consent).toContainText("never sent to the AI coach");
    await expect(consent.getByRole("button", { name: "Agree and continue" })).toBeDisabled();
    await consent.getByRole("checkbox").check();
    await consent.getByRole("button", { name: "Agree and continue" }).click();
    await expect(page.getByText("No scans yet.")).toBeVisible();

    // First scan: uploaded photos, a retake, the optional rear photo skipped.
    await page.getByTestId("new-scan").click();
    await page.waitForURL(/\/progress\/body-scan\/new/);
    await expect(page.getByText("Face a window or a light")).toBeVisible();
    await page.getByTestId("scan-start").click();
    await uploadFor(page, "front");
    await page.getByRole("button", { name: "Retake" }).click();
    await expect(page.getByTestId("scan-review")).toHaveCount(0);
    await uploadFor(page, "front");
    await page.getByTestId("scan-use-photo").click();
    await uploadFor(page, "side");
    await page.getByTestId("scan-use-photo").click();
    await expect(page.getByTestId("scan-step-back")).toContainText("Rear photo (optional)");
    await page.getByRole("button", { name: "Skip" }).click();
    await page.getByLabel("Body weight (lb)").fill("190");
    await page.getByLabel("Waist (in)").fill("36");
    await page.getByTestId("scan-save").click();
    await page.waitForURL(/\/progress\/body-scan\?saved=/);
    await expect(page.getByText("Scan saved. Only you can see it.")).toBeVisible();
    const history = page.getByTestId("scan-history");
    await expect(history.getByTestId("scan-item")).toHaveCount(1);
    await expect(history).toContainText("190 lb · Waist 36 in");
    await expectLoaded(history.getByRole("img", { name: /Front photo/ }));
    await expect(history.getByText("No rear")).toBeVisible();

    // Second scan with the camera (timer off), including the rear view.
    await context.grantPermissions(["camera"]);
    await page.getByTestId("new-scan").click();
    await page.getByTestId("scan-start").click();
    for (const pose of ["front", "side", "back"] as const) {
      const step = page.getByTestId(`scan-step-${pose}`);
      await step.getByTestId("scan-open-camera").click();
      await expect(step.getByTestId("scan-video")).toBeVisible();
      await step.getByLabel(/second timer/).uncheck();
      if (pose === "front") {
        // The last scan shows faintly over the camera to help match the pose.
        await expect(step.getByLabel("Show my last scan faintly")).toBeChecked();
        await expectLoaded(step.locator('img[alt=""]'));
      }
      await step.getByTestId("scan-capture").click();
      await expect(page.getByTestId("scan-review")).toBeVisible();
      await page.getByTestId("scan-use-photo").click();
    }
    await page.getByLabel("Waist (in)").fill("35");
    await page.getByTestId("scan-save").click();
    await page.waitForURL(/\/progress\/body-scan\?saved=/);
    await expect(history.getByTestId("scan-item")).toHaveCount(2);

    // Side-by-side comparison of the two scans.
    const compare = page.getByTestId("scan-compare");
    await expect(compare.getByRole("img")).toHaveCount(2);
    await expectLoaded(compare.getByRole("img").first());
    await expectLoaded(compare.getByRole("img").last());
    await expect(compare.getByTestId("compare-changes")).toContainText("Waist");
    await expect(compare.getByTestId("compare-changes")).toContainText("-1 in");
    await compare.getByRole("radio", { name: "Rear" }).click();
    await expect(compare.getByText("No rear photo")).toBeVisible();

    // Delete one scan, then withdraw consent, which deletes the rest.
    await history.getByRole("button", { name: /Delete the scan/ }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(history.getByTestId("scan-item")).toHaveCount(1);
    await page.getByTestId("withdraw-consent").click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete all scans" }).click();
    await expect(page.getByTestId("body-scan-consent")).toBeVisible();
  });
});
