import { expect, test } from "@playwright/test";
import { answerOnboarding, grantPlan, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("Stage 2C: faith flows, onboarding additions and the training calendar", () => {
  test("onboarding with a second goal and the display step, shown again in Edit onboarding details", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("ob2c"));
    await answerOnboarding(page, { secondGoal: "Train for a 5K", textSize: "Large", reduceMotion: true });
    await expect(page.getByText(/Also working toward: Train for a 5K/)).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");

    await page.goto("/profile");
    await page.getByRole("link", { name: /Edit onboarding details/ }).click();
    await page.waitForURL(/\/profile\/preferences/);
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByRole("group", { name: "Second goal" }).getByRole("button", { name: "Train for a 5K" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByRole("radio", { name: "Large", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("switch", { name: "Reduce motion" })).toHaveAttribute("aria-checked", "true");
    // Change both, save, and the profile follows.
    await page.getByRole("radio", { name: "Default", exact: true }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Your training preferences were saved.")).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).not.toHaveAttribute("data-text-size", "large");
  });

  test("prayer journal, daily practices and faith reminders", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("faith2c"));
    await answerOnboarding(page);
    await page.goto("/faith");

    // Daily practices: choose two, check one off, gentle weekly wording (no streaks or scores).
    await page.getByRole("button", { name: "Add Prayer" }).click();
    await expect(page.getByRole("button", { name: /^Prayer, Today/ })).toBeVisible();
    await page.getByRole("button", { name: "Add Scripture reading" }).click();
    await expect(page.getByRole("button", { name: /^Scripture reading, Today/ })).toBeVisible();
    await expect(page.getByTestId("practice-summary")).toContainText("Nothing checked off yet this week");
    await page.getByRole("button", { name: /^Prayer, Today/ }).click();
    await expect(page.getByRole("button", { name: /^Prayer, Today/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("practice-summary")).toHaveText("You spent time in prayer 1 day this week.");
    await expect(page.getByRole("region", { name: "Daily practices" }).getByText(/streak|points|score/i)).toHaveCount(0);
    await page.getByRole("link", { name: "History" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Practice history" })).toBeVisible();
    await expect(page.getByText(/You made time for your practices on 1 day/)).toBeVisible();
    await page.goto("/faith");

    // Write a prayer request: private by default.
    await page.locator("label", { hasText: /^Prayer request$/ }).click();
    await expect(page.getByRole("radio", { name: "Prayer request" })).toBeChecked();
    await page.getByLabel("Title (optional)").fill("Healing for Sam");
    await page.getByRole("textbox", { name: "Prayer", exact: true }).fill("Lord, please bring Sam rest and healing this week.");
    await expect(page.getByRole("checkbox", { name: /Share with AI Coach/ })).not.toBeChecked();
    await page.getByRole("button", { name: "Save entry" }).click();
    await expect(page.getByText("Entry saved. Only you can see it.")).toBeVisible();

    // Find it by search, open it, mark it answered.
    await page.getByRole("link", { name: /All entries/ }).click();
    await page.waitForURL(/\/faith\/journal/);
    await page.getByRole("searchbox", { name: "Search your journal" }).fill("Sam rest");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForURL(/q=Sam/);
    await expect(page.getByText(/1 matching/)).toBeVisible();
    await page.getByRole("link", { name: /Healing for Sam/ }).click();
    await expect(page.getByRole("heading", { name: "Healing for Sam" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Private" })).toBeVisible();
    await page.getByLabel(/How was it answered/).fill("Sam slept well and the fever broke.");
    await page.getByRole("button", { name: "Mark answered" }).click();
    await expect(page.getByRole("heading", { name: /^Answered on/ })).toBeVisible();
    await expect(page.getByText("Sam slept well and the fever broke.")).toBeVisible();

    // Filter answered prayers; search finds the answer note too; a search that matches nothing says so.
    await page.goto("/faith/journal?filter=answered");
    await expect(page.getByRole("link", { name: /Healing for Sam/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Healing for Sam/ })).toContainText("Answered");
    await page.goto("/faith/journal?q=fever");
    await expect(page.getByRole("link", { name: /Healing for Sam/ })).toBeVisible();
    await page.goto("/faith/journal?filter=open");
    await expect(page.getByText("No entries match.")).toBeVisible();

    // Faith reminders: off by default, honest about the web, saved to the account.
    await page.goto("/faith");
    await expect(page.getByRole("link", { name: /Faith reminders/ })).toContainText("Off.");
    await page.getByRole("link", { name: /Faith reminders/ }).click();
    await expect(page.getByTestId("reminders-web-note")).toContainText("A web browser can't remind you while this site is closed");
    const prayerSwitch = page.getByRole("switch", { name: "Prayer reminder" });
    await expect(prayerSwitch).toHaveAttribute("aria-checked", "false");
    await prayerSwitch.click();
    await page.getByLabel("Time").fill("07:15");
    await page.getByRole("button", { name: "Save reminders" }).click();
    await expect(page.getByText(/^Saved to your account/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("switch", { name: "Prayer reminder" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Every day at 7:15 AM")).toBeVisible();
    await page.goto("/faith");
    await expect(page.getByRole("link", { name: /Faith reminders/ })).toContainText("Prayer: Every day at 7:15 AM");
  });

  test("move a planned session on the calendar and Home's today's workout follows it", async ({ page }) => {
    const email = uniqueEmail("cal2c");
    await signUpAndConfirm(page, email);
    await answerOnboarding(page);

    // Free accounts see the calendar but rescheduling is Plus.
    await page.goto("/calendar");
    await expect(page.getByRole("region", { name: "Up next" }).getByRole("link", { name: "Move to another day with Plus" }).first()).toBeVisible();
    await grantPlan(email, "plus");

    await page.goto("/home");
    await expect(page.getByTestId("today-rest")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Start workout$/ })).toBeVisible();

    await page.goto("/calendar");
    await expect(page.getByRole("heading", { level: 1, name: "Training calendar" })).toBeVisible();
    const next = page.getByRole("region", { name: "Up next" }).getByTestId("planned-session").first();
    await expect(next).toBeVisible();
    // Defaults to the day after today.
    await next.getByRole("button", { name: /^Move / }).click();
    await next.getByRole("button", { name: "Move session" }).click();
    await expect(page.getByRole("region", { name: "Up next" }).getByTestId("planned-session").first()).toContainText("Moved");
    // Today is now a rest day on the calendar.
    await expect(page.locator("section[aria-labelledby=day-title]")).toContainText("Rest day");

    await page.goto("/home");
    await expect(page.getByTestId("today-rest")).toHaveText("Rest day today");
    await expect(page.getByTestId("today-detail")).toContainText(/planned for .+ \(moved\)/);
    await expect(page.getByRole("link", { name: /Start workout early/ })).toBeVisible();

    // Put it back: Home shows today's workout again.
    await page.goto("/calendar");
    await page.getByRole("region", { name: "Up next" }).getByRole("button", { name: /^Back to / }).first().click();
    await expect(page.getByRole("region", { name: "Up next" }).getByTestId("planned-session").first()).not.toContainText("Moved");
    await page.goto("/home");
    await expect(page.getByTestId("today-rest")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Start workout$/ })).toBeVisible();

    // Week view lists the days.
    await page.goto("/calendar?view=week");
    await expect(page.getByRole("list", { name: "Days this week" })).toBeVisible();
  });
});
