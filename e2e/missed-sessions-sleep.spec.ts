import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, seedRows, serviceRest, signUpAndConfirm, uniqueEmail, userIdFor } from "./helpers";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Missed program sessions (member decides what happens) and the 30-day sleep summary, in the real app. */
test.describe("missed sessions and 30-day sleep", () => {
  test("a missed session is reported, nothing changes until the member chooses, and skipping keeps history", async ({ page }) => {
    const email = uniqueEmail("missed");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    await grantPlan(email, "pro");
    const userId = await userIdFor(email);
    await serviceRest(`profiles?id=eq.${userId}`, { method: "PATCH", body: { timezone: "UTC" } });

    let [up] = await serviceRest<{ id: string }[]>(`user_programs?user_id=eq.${userId}&status=eq.active&select=id`);
    if (!up) {
      const [prog] = await serviceRest<{ id: string }[]>("training_programs?is_published=eq.true&days_per_week=eq.3&select=id&limit=1");
      [up] = await serviceRest<{ id: string }[]>("user_programs", { method: "POST", body: { user_id: userId, program_id: prog!.id, status: "active" } });
    }
    await serviceRest(`user_programs?id=eq.${up!.id}`, { method: "PATCH", body: { current_week: 1, current_day: 1 } });
    const last = daysAgo(4);
    await seedRows(email, "workout_sessions", [{ client_id: crypto.randomUUID(), name: "Earlier session", status: "completed", user_program_id: up!.id, started_at: last.toISOString(), ended_at: new Date(last.getTime() + 3_600_000).toISOString() }]);

    await page.goto("/train");
    const card = page.getByTestId("missed-sessions");
    await expect(card).toBeVisible();
    await expect(card.getByRole("link", { name: "Train it today" })).toBeVisible();
    // Looking changes nothing.
    expect((await serviceRest<{ current_week: number; current_day: number }[]>(`user_programs?id=eq.${up!.id}&select=current_week,current_day`))[0]).toEqual({ current_week: 1, current_day: 1 });

    const skip = card.getByRole("button", { name: /Skip .* and stay on schedule/ });
    if (await skip.count()) {
      await skip.click();
      await page.getByRole("button", { name: "Skip and stay on schedule" }).click();
      await expect(page.getByText(/Skipped \d session/)).toBeVisible();
      await page.reload();
      await expect(page.getByTestId("missed-sessions")).toHaveCount(0);
      const [after] = await serviceRest<{ current_week: number; current_day: number }[]>(`user_programs?id=eq.${up!.id}&select=current_week,current_day`);
      expect(after!.current_week * 10 + after!.current_day).toBeGreaterThan(11);
      const sessions = await serviceRest<unknown[]>(`workout_sessions?user_id=eq.${userId}&select=id`);
      expect(sessions).toHaveLength(1);
    } else {
      // A program with more training days than fit in a skip: the card explains instead.
      await expect(card).toContainText("picking up where you left off");
    }
  });

  test("the 30-day sleep summary waits for enough nights, then says what each figure rests on", async ({ page }) => {
    const email = uniqueEmail("sleep30");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    const userId = await userIdFor(email);
    await serviceRest(`profiles?id=eq.${userId}`, { method: "PATCH", body: { timezone: "UTC", wellness_consent_at: new Date().toISOString() } });

    await page.goto("/progress/sleep");
    const card = page.getByTestId("sleep-30-day");
    await expect(card).toContainText("No nights logged in the last 30 days");

    const nights = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
      const nightOf = isoDay(daysAgo(n));
      const start = `${isoDay(daysAgo(n + 1))}T22:30:00Z`;
      const end = `${nightOf}T06:00:00Z`;
      return { id: crypto.randomUUID(), started_at: start, ended_at: end, overlap_until: end, timezone: "UTC", night_of: nightOf, source: "manual", kind: "night" };
    });
    await seedRows(email, "sleep_sessions", nights);
    await page.reload();
    await expect(card).toContainText("8 / 30");
    await expect(card).toContainText("0 recorded · 8 by hand");
    await expect(card).toContainText("7h 30m");
    await expect(card).toContainText("22 of the last 30 nights have no data");
    await expect(card).toContainText("your own estimate, not a measurement");
  });
});
