import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { completeOnboarding, seedRows, serviceRest, signUpAndConfirm, uniqueEmail, userIdFor } from "./helpers";

/** Fills the sleep form with eight hours ending two minutes ago (the test account's time zone is UTC). */
async function fillLastEightHours(page: Page) {
  const up = new Date(Math.floor((Date.now() - 2 * 60_000) / 60_000) * 60_000);
  const bed = new Date(up.getTime() - 8 * 3600_000);
  await expect(page.getByLabel("Time zone")).toHaveValue("UTC");
  await page.getByLabel("Got into bed").fill(bed.toISOString().slice(0, 16));
  await page.getByLabel("Got up").fill(up.toISOString().slice(0, 16));
}

test.describe("Sleep & Recovery", () => {
  test("a night recorded by a watch: stages, overnight measurements and the connection status, nothing invented", async ({ page }) => {
    test.setTimeout(150_000);
    const email = uniqueEmail("sleep-watch");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await page.goto("/progress/sleep");
    await page.getByLabel(/I agree to store my sleep/).check();
    await page.getByRole("button", { name: "Allow sleep logging" }).click();
    await expect(page.getByRole("heading", { name: "Sleep timer" })).toBeVisible();

    // Last night, as the import stores it: 23:10 to 06:50 UTC with the watch's stages and overnight readings;
    // the night before only a bare asleep record (a phone, no stages, no readings).
    const today = new Date();
    const dayOf = (offset: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset)).toISOString().slice(0, 10);
    const night = dayOf(0);
    const prev = dayOf(1);
    const at = (day: string, hhmm: string, dayShift = 0) => new Date(Date.parse(`${day}T${hhmm}:00Z`) + dayShift * 86_400_000).toISOString();
    const sid = crypto.randomUUID();
    const pid = crypto.randomUUID();
    await seedRows(email, "sleep_sessions", [
      { id: sid, kind: "night", started_at: at(night, "23:10", -1), ended_at: at(night, "06:50"), onset_at: at(night, "23:25", -1), final_wake_at: at(night, "06:42"), awakenings: 2, awake_minutes: 14, timezone: "UTC", night_of: night, source: "apple_health", source_id: "e2e-watch-1", overlap_until: at(night, "06:50"), device_name: "Apple Watch (test)", hr_avg: 54, hr_min: 47, hr_max: 72, hr_samples: 410, hrv_avg_ms: 41.5, hrv_method: "sdnn", hrv_samples: 6, rr_avg: 14.2, rr_min: 12.5, rr_max: 16, rr_samples: 95 },
    ]);
    await seedRows(email, "sleep_sessions", [{ id: pid, kind: "night", started_at: at(prev, "23:30", -1), ended_at: at(prev, "07:00"), timezone: "UTC", night_of: prev, source: "apple_health", source_id: "e2e-phone-1", overlap_until: at(prev, "07:00"), device_name: "iPhone (test)" }]);
    const stage = (s: string, st: string, en: string, shiftStart = 0, shiftEnd = shiftStart) => ({ session_id: sid, stage: s, started_at: at(night, st, shiftStart), ended_at: at(night, en, shiftEnd) });
    await seedRows(email, "sleep_stages", [
      stage("awake", "23:10", "23:25", -1),
      stage("light", "23:25", "00:10", -1, 0),
      stage("deep", "00:10", "01:00"),
      stage("light", "01:00", "01:40"),
      stage("rem", "01:40", "02:10"),
      stage("awake", "02:10", "02:18"),
      stage("light", "02:18", "03:30"),
      stage("deep", "03:30", "04:00"),
      stage("rem", "04:00", "04:45"),
      stage("light", "04:45", "06:20"),
      stage("rem", "06:20", "06:42"),
      stage("awake", "06:42", "06:50"),
    ]);
    await seedRows(email, "sleep_import_runs", [{ source: "apple_health", range_start: at(night, "00:00", -14), range_end: at(night, "07:00"), added: 2, duplicates: 0, conflicts: 0, updated: 0, with_vitals: 1, device: "Apple Watch (test)" }]);
    // The connection the phone app recorded on the profile (the member connected there and now looks on the web).
    await serviceRest(`profiles?id=eq.${await userIdFor(email)}`, { method: "PATCH", body: { sleep_import_source: "apple_health", sleep_import_connected_at: at(night, "06:55", -3) }, prefer: "return=minimal" });

    // Hub: recorded badge, the stage bar and the three measurement tiles; the source card knows the last sync.
    await page.goto("/progress/sleep");
    const lastNight = page.getByRole("heading", { name: "Last night" }).locator("..").locator("..");
    await expect(lastNight).toContainText("Recorded by Apple Watch (test)");
    await expect(lastNight).toContainText("asleep (recorded)");
    // 7h 9m of stage time, awake (15+8+8 = 31 min) not counted.
    await expect(lastNight).toContainText("7h 9m");
    await expect(lastNight.getByRole("img", { name: /Deep 1h 20m/ })).toBeVisible();
    await expect(lastNight).toContainText("54");
    await expect(lastNight).toContainText("41.5");
    await expect(lastNight).toContainText("14.2");
    const source = page.getByTestId("sleep-source");
    await expect(source).toContainText("Apple Watch (test) via Apple Health");
    await expect(source).toContainText("Last synced");
    await expect(source).toContainText("with overnight measurements");
    // A browser can't read the watch, so there is no Sync now button here; Manage leads to the connection settings.
    await expect(source.getByRole("button", { name: "Sync now" })).toHaveCount(0);
    await expect(source.getByRole("link", { name: "Manage" })).toBeVisible();

    // Nightly report: hypnogram, shares, intervals and the measurements, with their limits stated.
    await lastNight.getByRole("link", { name: "Nightly report" }).click();
    await page.waitForURL(new RegExp(`/progress/sleep/night/${night}$`));
    await expect(page.getByText("Recorded by Apple Watch (test)", { exact: true })).toBeVisible();
    const stages = page.getByRole("heading", { name: "Sleep stages" }).locator("..");
    await expect(stages.getByRole("img", { name: /Sleep stages from 11:10 PM to 6:50 AM/ })).toBeVisible();
    await expect(stages).toContainText("Deep");
    await expect(stages).toContainText("1h 20m");
    await expect(stages).toContainText("19% of sleep");
    await expect(stages).toContainText("REM");
    await expect(stages).toContainText("1h 37m");
    await stages.getByText("Every interval").click();
    await expect(stages.getByRole("list", { name: "Stage intervals" }).getByRole("listitem")).toHaveCount(12);
    await expect(stages).toContainText("no validated way exists to turn stage shares or overnight measurements into one number");
    const vitals = page.getByRole("heading", { name: "Overnight measurements" }).locator("..");
    await expect(vitals).toContainText("bpm average · 47–72");
    await expect(vitals).toContainText("ms SDNN · 6 readings");
    await expect(vitals).toContainText("per min · 12.5–16");
    await expect(vitals).toContainText("Not a medical measurement");

    // The night before: a phone's bare record, honestly without stages or readings.
    await page.getByRole("link", { name: "Previous night" }).click();
    await page.waitForURL(new RegExp(`/progress/sleep/night/${prev}$`));
    await expect(page.getByText("Recorded by iPhone (test)", { exact: true })).toBeVisible();
    await expect(page.getByText("No stage information.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Overnight measurements" }).locator("..")).toContainText("Not recorded");

    // History: the recorded section and the measurement trend; Home names the source.
    await page.goto("/progress/sleep/history?range=7d");
    const recorded = page.getByRole("heading", { name: "Recorded by your watch" }).locator("..");
    await expect(recorded).toContainText("Stage mix over 1 recorded night");
    await expect(recorded.getByRole("img", { name: /Heart rate:/ })).toBeVisible();
    await expect(recorded).toContainText("1 night");
    await page.goto("/home");
    await expect(page.getByTestId("home-sleep-card")).toContainText("Apple Health");
    // Settings: the connection is shown from the import record; disconnecting on the web clears nothing it doesn't own.
    await page.goto("/progress/sleep/settings");
    await expect(page.getByRole("list", { name: "Recent imports" })).toContainText("Apple Watch (test)");
    await expect(page.getByTestId("sleep-connection")).toContainText("Connected to Apple Health");
    await expect(page.getByRole("button", { name: "Disconnect", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Disconnect and remove imported/ })).toBeVisible();
  });

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
    // The connected-source card: on the web it explains the phone app instead of pretending to read a watch.
    const source = page.getByTestId("sleep-source");
    await expect(source.getByRole("heading", { name: "Connect your watch" })).toBeVisible();
    await expect(source).toContainText("connect Apple Health or Health Connect once");
    await expect(source.getByRole("button", { name: /Sync now|Connect/ })).toHaveCount(0);
    await expect(source.getByRole("link", { name: "Connection settings" })).toBeVisible();
    // Home's Sleep & Recovery card knows nothing is logged yet.
    await page.goto("/home");
    await expect(page.getByTestId("home-sleep-card")).toContainText("Nothing for last night yet");
    await page.getByTestId("home-sleep-card").click();
    await page.waitForURL(/\/progress\/sleep$/);

    // Timer: start, then stop straight away: under five minutes is discarded, not saved.
    await page.getByRole("button", { name: "Going to bed" }).click();
    await expect(page.getByText(/In bed since/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/In bed since/)).toBeVisible();
    await page.getByRole("button", { name: /stop the timer/ }).click();
    await expect(page.getByText(/under five minutes, so nothing was saved/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Going to bed" })).toBeVisible();
    await expect(page.getByText("Nothing logged yet.")).toBeVisible();

    // Enter last night by hand: eight hours ending just now, so the night is today's whatever the time of day (the
    // form's default times are covered by defaultManualNight's unit tests).
    await page.getByRole("link", { name: /Enter sleep by hand/ }).click();
    await page.waitForURL(/\/progress\/sleep\/log$/);
    await fillLastEightHours(page);
    await page.getByRole("button", { name: "Save sleep" }).click();
    await page.waitForURL(/\/progress\/sleep\?saved=1$/);
    await expect(page.getByText("Sleep saved.")).toBeVisible();
    const list = page.getByRole("list").filter({ hasText: "Entered by hand" });
    await expect(list).toContainText("8h in bed");
    const lastNight = page.getByRole("heading", { name: "Last night" }).locator("..").locator("..");
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

    // Home's card now carries last night, labelled as entered by hand.
    await page.goto("/home");
    await expect(page.getByTestId("home-sleep-card")).toContainText("Last night 8h in bed · Entered by hand");
    await page.getByTestId("home-sleep-card").click();
    await page.waitForURL(/\/progress\/sleep$/);
    // The Progress tab's card opens the same dashboard.
    await page.goto("/progress");
    await expect(page.getByRole("link", { name: /Sleep & Recovery/ })).toContainText("Sleep from Apple Health, Health Connect or by hand");
    await page.getByRole("link", { name: /Sleep & Recovery/ }).click();
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
    await expect(page.getByTestId("sleep-connection")).toContainText("Not connected");
    await expect(page.getByRole("button", { name: /^Disconnect/ })).toHaveCount(0);
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
    await expect(page.getByRole("heading", { name: "Weekdays and weekends" }).locator("..")).toContainText("Included with Pro All Access");
    await page.goto("/progress/sleep/history?range=7d");
    await page.getByRole("list", { name: "Nights" }).getByRole("link").first().click();
    await page.waitForURL(/\/progress\/sleep\/night\//);
    await expect(page.getByRole("heading", { name: "Sleep score" })).toBeVisible();
    // Free sees the score and its basis, not the breakdown.
    await expect(page.getByText(/Based on duration/)).toBeVisible();
    await expect(page.getByText("Pro All Access shows how this score was built")).toBeVisible();
    await page.getByRole("link", { name: "How it's worked out" }).first().click();
    await page.waitForURL(/\/progress\/sleep\/method$/);
    await expect(page.getByRole("heading", { name: /Nightly score \(version/ })).toBeVisible();
    // Sleep debt, schedule and energy are Pro: the honest locked state, with no numbers invented.
    for (const path of ["/progress/sleep/debt", "/progress/sleep/schedule", "/progress/sleep/energy"]) {
      await page.goto(path);
      await expect(page.getByText("Included with Pro All Access")).toBeVisible();
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
    await fillLastEightHours(page);
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
