import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * Profile → Notifications (src/app/(app)/profile/notifications) in a web browser at iPhone and Android phone sizes:
 * everything off by default with no "turn all on", custom times / days / frequency saved to the account, quiet hours,
 * pause all, the time-zone check, the old Faith reminders link, and Home's in-app list when the device can't show
 * notifications. Delivery itself needs the iPhone / Android app on a real phone (docs/NOTIFICATIONS.md).
 */
const reminderSwitch = (page: Page, name: string) => page.locator(`fieldset[data-reminder] >> role=switch[name="${name}"]`);
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

test.describe("Notifications settings", () => {
  test.use({ viewport: { width: 390, height: 844 }, timezoneId: "America/Chicago" });

  test("off by default, saved per account, quiet hours, pause all, fallback list, old link, phone sizes", async ({ page, browser }) => {
    await signUpAndConfirm(page, uniqueEmail("notif"));
    await completeOnboarding(page);

    // Profile → Notifications.
    await page.goto("/profile");
    await page.getByRole("link", { name: /^Notifications/ }).click();
    await page.waitForURL(/\/profile\/notifications$/);
    for (const g of ["Faith", "Workouts", "Food & water", "Recovery & sleep", "System"]) await expect(page.getByRole("heading", { name: g, exact: true })).toBeVisible();
    await expect(page.getByTestId("notif-web-note")).toBeVisible();

    // Every reminder is off, and there's no control that turns them all on.
    const switches = page.locator("fieldset[data-reminder] [role=switch]");
    expect(await switches.count()).toBe(21);
    for (const s of await switches.all()) await expect(s).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("switch", { name: /Pause all optional reminders/ })).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("button", { name: /(turn|switch) (all|everything) on|enable all|select all/i })).toHaveCount(0);
    await expect(page.getByTestId("notif-preview")).toContainText("No reminders are on.");
    expect(await noSideScroll(page)).toBe(true);

    // Bible reading at 6:15 with the owner's wording; Lunch on weekdays; Water every 1½ hours.
    await reminderSwitch(page, "Bible reading").click();
    await page.locator("#nr-reading-time").fill("06:15");
    await expect(page.locator('fieldset[data-reminder="reading"]')).toContainText("Don't forget to spend time with the Lord today. Your Bible reading is ready.");
    await reminderSwitch(page, "Lunch").click();
    const lunchDays = page.getByRole("group", { name: "Lunch reminder days" });
    for (const d of ["Saturday", "Sunday"]) await lunchDays.getByRole("button", { name: d }).click();
    await expect(lunchDays.getByRole("button", { name: "Sunday" })).toHaveAttribute("aria-pressed", "false");
    await reminderSwitch(page, "Water").click();
    await page.locator("#nr-water-every").selectOption("90");
    await expect(page.locator('fieldset[data-reminder="water"]')).toContainText("a day, 9:00 AM to 7:00 PM");

    // Quiet hours: a reminder inside them is flagged.
    await page.getByRole("switch", { name: /Quiet hours/ }).click();
    await page.locator("#notif-quiet-start").fill("22:00");
    await page.locator("#notif-quiet-end").fill("06:00");
    await page.locator("#nr-reading-time").fill("05:30");
    await expect(page.locator('fieldset[data-reminder="reading"]')).toContainText("inside your quiet hours");
    await page.locator("#nr-reading-time").fill("06:15");
    await expect(page.locator('fieldset[data-reminder="reading"]')).not.toContainText("inside your quiet hours");
    await page.locator("#notif-limit").selectOption("6");
    await expect(page.getByTestId("notif-preview")).toContainText("Bible reading");

    // Save to the account; the browser says plainly it won't deliver them.
    await page.getByRole("button", { name: /Save/ }).click();
    await expect(page.getByRole("status")).toContainText("Saved to your account. The Narrow Gate Fitness app on your phone delivers them");

    // Reload: everything came back from the account.
    await page.reload();
    await expect(reminderSwitch(page, "Bible reading")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#nr-reading-time")).toHaveValue("06:15");
    await expect(page.locator("#nr-water-every")).toHaveValue("90");
    await expect(page.getByRole("group", { name: "Lunch reminder days" }).getByRole("button", { name: "Saturday" })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("switch", { name: /Quiet hours/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#notif-quiet-start")).toHaveValue("22:00");
    await expect(page.locator("#notif-limit")).toHaveValue("6");
    await expect(reminderSwitch(page, "Dinner")).toHaveAttribute("aria-checked", "false");

    // Android phone size: same screen, no sideways scrolling, the Save bar in view above the tab bar.
    await page.setViewportSize({ width: 412, height: 915 });
    expect(await noSideScroll(page)).toBe(true);
    await expect(page.getByRole("button", { name: /Save/ })).toBeInViewport();

    // Home lists today's reminders, because a browser can't show notifications.
    await page.goto("/home");
    const today = page.getByTestId("todays-reminders");
    await expect(today).toBeVisible();
    await expect(today).toContainText("Bible reading");
    await today.getByRole("link", { name: /Bible reading/ }).click();
    await page.waitForURL(/\/faith\/bible$/); // no journey: reading opens the Bible

    // The old Faith reminders address opens the new screen.
    await page.goto("/faith/reminders");
    await page.waitForURL(/\/profile\/notifications/);

    // Pause all: nothing scheduled, choices kept; Home's list goes away.
    await page.getByRole("switch", { name: /Pause all optional reminders/ }).click();
    await expect(page.getByTestId("notif-preview")).toContainText("Paused: nothing will be sent.");
    await page.getByRole("button", { name: /Save/ }).click();
    await expect(page.getByRole("status")).toContainText("Saved");
    await page.reload();
    await expect(page.getByRole("switch", { name: /Pause all optional reminders/ })).toHaveAttribute("aria-checked", "true");
    await expect(reminderSwitch(page, "Bible reading")).toHaveAttribute("aria-checked", "true");
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: /^Hi, / })).toBeVisible();
    await expect(page.getByTestId("todays-reminders")).toHaveCount(0);

    // Travelling: a device in another time zone is told, and can move the account (and reminders) to it.
    const state = await page.context().storageState();
    const tokyo = await browser.newContext({ storageState: state, timezoneId: "Asia/Tokyo", viewport: { width: 390, height: 844 } });
    const p2 = await tokyo.newPage();
    await p2.goto("/profile/notifications");
    const mismatch = p2.getByTestId("notif-tz-mismatch");
    await expect(mismatch).toContainText("Asia/Tokyo");
    await mismatch.getByRole("button", { name: "Use Asia/Tokyo" }).click();
    await expect(p2.getByRole("status")).toContainText("Time zone set to Asia/Tokyo.");
    await expect(p2.getByTestId("notif-device-status")).toContainText("Asia/Tokyo");
    await expect(p2.getByTestId("notif-tz-mismatch")).toHaveCount(0);
    await tokyo.close();
  });
});
