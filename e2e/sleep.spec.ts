import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

test.describe("Sleep & Recovery", () => {
  test("consent, the sleep timer, entering a night by hand, editing, overlap and deletion", async ({ page }) => {
    test.setTimeout(150_000);
    const email = uniqueEmail("sleep");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);

    await page.goto("/progress");
    await page.getByRole("link", { name: /Sleep & Recovery/ }).click();
    await page.waitForURL(/\/progress\/sleep$/);

    // Consent first: no timer, no manual entry until it's given.
    await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Enter sleep by hand/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Allow sleep logging" }).click();
    await expect(page.getByText("Tick the box to allow sleep logging.")).toBeVisible();
    await page.getByLabel(/I agree to store my sleep/).check();
    await page.getByRole("button", { name: "Allow sleep logging" }).click();
    await expect(page.getByRole("heading", { name: "Sleep timer" })).toBeVisible();

    // Timer: start, then stop straight away: under five minutes is discarded, not saved.
    await page.getByRole("button", { name: "Going to bed" }).click();
    await expect(page.getByText(/In bed since/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/In bed since/)).toBeVisible();
    await page.getByRole("button", { name: /stop the timer/ }).click();
    await expect(page.getByText(/under five minutes, so nothing was saved/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Going to bed" })).toBeVisible();
    await expect(page.getByText("Nothing logged yet.")).toBeVisible();

    // Enter last night by hand with the defaults (10:30 PM to 6:30 AM).
    await page.getByRole("link", { name: /Enter sleep by hand/ }).click();
    await page.waitForURL(/\/progress\/sleep\/log$/);
    await page.getByRole("button", { name: "Save sleep" }).click();
    await page.waitForURL(/\/progress\/sleep\?saved=1$/);
    await expect(page.getByText("Sleep saved.")).toBeVisible();
    const list = page.getByRole("list").filter({ hasText: "Entered by hand" });
    await expect(list).toContainText("8h in bed");
    const lastNight = page.getByRole("heading", { name: "Last night" }).locator("..");
    await expect(lastNight).toContainText("8h");
    await expect(lastNight).toContainText("Goal reached");
    // One night isn't a pattern yet.
    await expect(page.getByText("Log three nights in a fortnight")).toBeVisible();

    // The nightly report: honest "Not recorded" rows, no invented stages.
    await lastNight.getByRole("link", { name: "Nightly report" }).click();
    await page.waitForURL(/\/progress\/sleep\/night\/\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByRole("heading", { name: "Time asleep" })).toBeVisible();
    await expect(page.getByText("taken as time in bed")).toBeVisible();
    await expect(page.getByText("Time to fall asleep").locator("..")).toContainText("Not recorded");
    await expect(page.getByText("No stage information.")).toBeVisible();
    // The comparison with the member's own fortnight is Plus; Free sees the honest note instead.
    await expect(page.getByText(/Plus compares each night with your own last two weeks/)).toBeVisible();
    await page.getByRole("link", { name: "Previous night" }).click();
    await expect(page.getByText(/Nothing logged for the night of/)).toBeVisible();

    // Home has the shortcut.
    await page.goto("/home");
    await page.getByRole("navigation", { name: "More for today" }).getByRole("link", { name: "Sleep" }).click();
    await page.waitForURL(/\/progress\/sleep$/);

    // Edit: add detail, which turns "in bed" into an estimate of time asleep.
    await page.getByRole("link", { name: /Edit sleep for/ }).click();
    await page.waitForURL(/\/progress\/sleep\/log\?id=/);
    await page.getByText("More detail (optional)").click();
    await page.getByLabel("Times you woke up").fill("2");
    await page.getByLabel("Minutes awake in the night").fill("20");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/\/progress\/sleep\?saved=1$/);
    await expect(list).toContainText("7h 40m asleep");

    // Morning check-in: one tap, then the full form, then it shows on the nightly report.
    await page.getByRole("group", { name: "How rested do you feel?" }).getByRole("button", { name: "4" }).click();
    await expect(page.getByText("Noted: rested 4 out of 5.")).toBeVisible();
    await page.getByRole("link", { name: "Add more to today's check-in" }).click();
    await page.waitForURL(/\/progress\/sleep\/checkin\?day=/);
    await expect(page.getByRole("group", { name: "How rested do you feel?" }).getByLabel("4")).toBeChecked();
    await page.getByRole("group", { name: "Alcohol" }).getByText("no").click();
    await page.getByLabel("Noise").check();
    await page.getByRole("button", { name: "Save check-in" }).click();
    await page.waitForURL(/\/progress\/sleep\?saved=checkin$/);
    await expect(page.getByText("Check-in saved.")).toBeVisible();
    await lastNight.getByRole("link", { name: "Nightly report" }).click();
    const checkinCard = page.getByRole("heading", { name: "Your check-in" }).locator("..");
    await expect(checkinCard).toContainText("4 / 5");
    await expect(checkinCard).toContainText("Noise");
    await page.goto("/progress/sleep");

    // Score, goal, history and the method page.
    await expect(lastNight).toContainText("/ 100");
    await page.getByRole("link", { name: /Goal & privacy/ }).click();
    await page.waitForURL(/\/progress\/sleep\/settings$/);
    // On the web there is no health platform to import from, and the page says so instead of pretending.
    await expect(page.getByText(/Automatic import works in the Narrow Gate phone app/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Import from/ })).toHaveCount(0);
    await page.getByLabel("Time asleep each night").selectOption({ label: "7h" });
    await page.getByRole("button", { name: "Save goal" }).click();
    await expect(page.getByText("Sleep goal set to 7h.")).toBeVisible();
    await page.goto("/progress/sleep/history?range=7d");
    await expect(page.getByText("Nights logged").locator("..")).toContainText("1");
    await expect(page.getByRole("list", { name: "Time asleep by night" })).toContainText("7h 40m asleep");
    await expect(page.getByRole("list", { name: "Nights" })).toContainText("asleep");
    // Longer ranges switch to weekly and monthly averages; the weekday/weekend comparison is Plus.
    await page.goto("/progress/sleep/history?range=90d");
    await expect(page.getByRole("list", { name: "Average time asleep by week" }).getByRole("listitem")).toHaveCount(13);
    await page.goto("/progress/sleep/history?range=1y");
    // Twelve or thirteen calendar months, depending on today's date (the list streams in after the skeleton).
    const months = page.getByRole("list", { name: "Average time asleep by month" }).getByRole("listitem");
    await expect(months.first()).toBeVisible();
    expect(await months.count()).toBeGreaterThanOrEqual(12);
    await expect(page.getByRole("heading", { name: "Weekdays and weekends" }).locator("..")).toContainText("Included with Plus and Pro");
    await page.goto("/progress/sleep/history?range=7d");
    await page.getByRole("list", { name: "Nights" }).getByRole("link").first().click();
    await page.waitForURL(/\/progress\/sleep\/night\//);
    await expect(page.getByRole("heading", { name: "Sleep score" })).toBeVisible();
    // Free sees the score and its basis, not the breakdown.
    await expect(page.getByText(/Based on duration/)).toBeVisible();
    await expect(page.getByText("Plus shows how this score was built")).toBeVisible();
    await page.getByRole("link", { name: "How it's worked out" }).first().click();
    await page.waitForURL(/\/progress\/sleep\/method$/);
    await expect(page.getByRole("heading", { name: /Nightly score \(version/ })).toBeVisible();
    // Sleep debt, schedule and energy are Plus: the honest locked state, with no numbers invented.
    for (const path of ["/progress/sleep/debt", "/progress/sleep/schedule", "/progress/sleep/energy"]) {
      await page.goto(path);
      await expect(page.getByText("Included with Plus and Pro")).toBeVisible();
    }
    await page.goto("/progress/sleep/training");
    await expect(page.getByText("Included with Pro")).toBeVisible();

    // The wake-up alarm: saved to the account, honest about where it sounds, and the next alarms follow the settings.
    await page.goto("/progress/sleep/alarm");
    await expect(page.getByText("The alarm is off.")).toBeVisible();
    await expect(page.getByText(/web browser can.t wake you/i)).toBeVisible();
    await page.getByRole("switch", { name: "Wake me up" }).click();
    await page.getByLabel("Wake time").fill("06:45");
    // The day checkboxes are visually hidden behind their styled labels; tap the label.
    await page.getByText("Sat", { exact: true }).click();
    await expect(page.getByLabel("Saturday")).toBeChecked();
    await page.getByRole("button", { name: "Save alarm" }).click();
    await expect(page.getByText("Alarm set for 6:45 AM on Mon, Tue, Wed, Thu, Fri and Sat.")).toBeVisible();
    await expect(page.getByRole("list", { name: "Next alarms" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByRole("list", { name: "Next alarms" })).toContainText("6:45 AM");
    await page.goto("/progress/sleep");
    await expect(page.getByRole("link", { name: /Wake-up alarm/ })).toContainText("6:45 AM on Mon, Tue, Wed, Thu, Fri and Sat");

    // The same night again overlaps the saved one and is refused with a clear message.
    await page.goto("/progress/sleep/log");
    await page.getByRole("button", { name: "Save sleep" }).click();
    await expect(page.getByText(/overlaps the sleep you logged/)).toBeVisible();
    await expect(page).toHaveURL(/\/progress\/sleep\/log$/);

    // Delete, with confirmation.
    await page.goto("/progress/sleep");
    await page.getByRole("button", { name: /Delete sleep for/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Nothing logged yet.")).toBeVisible();
  });
});
