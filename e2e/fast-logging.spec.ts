import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, serviceRest, signUpAndConfirm, uniqueEmail, userIdFor } from "./helpers";

/**
 * Effortless logging, end to end at phone size: one tap logs a set and backs it up at once, the rest timer runs and can
 * be lengthened or skipped, the next set can take the last set's numbers with one tap, a set can be skipped, leaving
 * and coming back keeps everything, and the next workout already shows last time's numbers set by set.
 */

async function pickExercise(page: Page, name: string) {
  await page.getByRole("button", { name: "Add exercise" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Search by name or muscle").fill(name);
  await dialog.getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
  await expect(dialog).toBeHidden();
}

/** A server action (the in-progress backup) being sent. */
const isBackup = (r: { method(): string; headers(): Record<string, string> }) => r.method() === "POST" && Boolean(r.headers()["next-action"]);

/** Seconds shown on the card's rest timer ("1:45" → 105). */
async function restSeconds(page: Page): Promise<number> {
  const text = (await page.getByTestId("current-rest").locator("span").first().innerText()).trim();
  const [m, s] = text.split(":").map(Number);
  return m! * 60 + s!;
}

test.describe("fast workout logging", () => {
  test("one tap per set, backed up at once, recoverable after leaving, and filled in next time", async ({ page }) => {
    const email = uniqueEmail("fastlog");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);
    const uid = await userIdFor(email);

    await page.goto("/train/workout");
    // Before anything is saved there is no sync status, so no separator dangles after the set count.
    const meta = page.locator("p").filter({ hasText: /\d+\/\d+ sets/ }).first();
    await expect(meta).toBeVisible();
    await expect(meta).not.toHaveText(/·\s*$/);
    await pickExercise(page, "Barbell Bench Press");
    const card = page.getByTestId("current-set-card");
    await expect(card.getByTestId("current-exercise")).toHaveText(/Barbell Bench Press/i);
    await expect(card.getByTestId("current-set-label")).toHaveText(/^Set 1 of 3$/i);
    // Everything for the set is on the card: the demonstration, what comes next, one button.
    await expect(card.getByRole("button", { name: "Show the Barbell Bench Press demonstration larger" })).toBeVisible();
    await expect(card.getByTestId("then-next")).toHaveText(/^Then: set 2 of 3$/i);
    // (Wait for the backup of "exercise added", so the next one is the set's own.)
    await expect(page.getByText("Synced", { exact: true })).toBeVisible();
    await expect(meta).toHaveText(/sets\s*·\s*Synced$/);

    // Set 1: 135 × 10, one tap. The backup to the account goes out straight away, not after the 2-second typing wait.
    await card.getByLabel("Weight (lb)").fill("135");
    await card.getByLabel("Reps", { exact: true }).fill("10");
    const sent = page.waitForRequest(isBackup, { timeout: 1500 });
    await card.getByTestId("complete-set").click();
    await sent;
    await expect
      .poll(async () => {
        const rows = await serviceRest<{ draft: { exercises: { sets: { completed: boolean; reps: number | null }[] }[] } }[]>(
          `workout_sessions?select=draft&user_id=eq.${uid}&status=eq.in_progress`,
        );
        return rows[0]?.draft.exercises[0]?.sets.map((s) => [s.completed, s.reps]);
      })
      // Set 1 done; set 2 starts from its numbers.
      .toEqual([
        [true, 10],
        [false, 10],
        [false, null],
      ]);

    // The programmed rest starts by itself; add 15 seconds, then skip it.
    await expect(card.getByTestId("current-rest")).toBeVisible();
    const before = await restSeconds(page);
    await card.getByRole("button", { name: "Add 15 seconds" }).click();
    expect(await restSeconds(page)).toBeGreaterThanOrEqual(before + 13);
    await card.getByRole("button", { name: "Skip rest" }).click();
    await expect(card.getByTestId("current-rest")).toHaveCount(0);

    // Set 2 starts from set 1's numbers; today it's 155 × 8.
    await expect(card.getByTestId("current-set-label")).toHaveText(/^Set 2 of 3$/i);
    await expect(card.getByLabel("Weight (lb)")).toHaveValue("135");
    await card.getByLabel("Weight (lb)").fill("155");
    await card.getByLabel("Reps", { exact: true }).fill("8");
    await card.getByTestId("complete-set").click();
    await card.getByRole("button", { name: "Skip rest" }).click();

    // Set 3 already carries 155 × 8, so there is nothing to repeat. Change it, and one tap puts it back.
    await expect(card.getByTestId("current-set-label")).toHaveText(/^Set 3 of 3$/i);
    await expect(card.getByTestId("repeat-last-set")).toHaveCount(0);
    await card.getByLabel("Reps", { exact: true }).fill("6");
    await card.getByLabel("Reps", { exact: true }).press("Enter");
    await expect(card.getByTestId("repeat-last-set")).toHaveText(/Same as last set \(155 lb × 8\)/);
    await card.getByTestId("repeat-last-set").click();
    await expect(card.getByLabel("Reps", { exact: true })).toHaveValue("8");
    await expect(card.getByTestId("then-next")).toHaveText(/^Last set, then finish\.$/);
    await card.getByTestId("complete-set").click();
    await expect(card).toContainText("Every planned set is done");

    // A second exercise: skip its first set (Undo is offered).
    await pickExercise(page, "Barbell Back Squat");
    await expect(card.getByTestId("current-exercise")).toHaveText(/Barbell Back Squat/i);
    await card.getByTestId("skip-set").click();
    await expect(card.getByTestId("set-undo")).toContainText("skipped");
    await expect(card.getByTestId("current-set-label")).toHaveText(/^Set 2 of 3$/i);
    await expect(page.getByRole("progressbar", { name: /Workout progress: 3 of 5 sets done/ })).toBeVisible();

    // Leave and come back (the app was closed, the phone restarted): the same workout, at the same set.
    await expect(page.getByText("Synced", { exact: true })).toBeVisible();
    await page.reload();
    await expect(card.getByTestId("current-exercise")).toHaveText(/Barbell Back Squat/i);
    await expect(card.getByTestId("current-set-label")).toHaveText(/^Set 2 of 3$/i);
    await expect(page.getByRole("button", { name: /Barbell Bench Press set 3 completed/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Barbell Back Squat set 1 skipped/ })).toBeVisible();

    // Finish early: honest about what's left, and only completed sets count.
    await page.getByRole("button", { name: "Finish" }).first().click();
    await expect(page.getByRole("heading", { name: "Finish early?" })).toBeVisible();
    await page.getByRole("button", { name: "Finish & save" }).click();
    await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();
    await expect(page.getByTestId("stat-sets")).toContainText("3/6");
    await expect(page.getByTestId("stat-volume")).toContainText("3,830 lb");

    // The next workout: last time's numbers are already there, set by set (135 × 10, then 155 × 8, 155 × 8).
    await page.goto("/train/workout");
    await pickExercise(page, "Barbell Bench Press");
    await expect(card.getByLabel("Weight (lb)")).toHaveValue("135");
    await expect(card.getByLabel("Reps", { exact: true })).toHaveValue("10");
    await expect(card.getByTestId("current-last-time")).toBeVisible();
    await expect(page.getByLabel("Barbell Bench Press set 2 weight in lb")).toHaveValue("155");
    await expect(page.getByLabel("Barbell Bench Press set 2 reps")).toHaveValue("8");
    await expect(page.getByLabel("Barbell Bench Press set 3 weight in lb")).toHaveValue("155");
    await expect(page.getByLabel("Barbell Bench Press set 3 reps")).toHaveValue("8");
    await expect(card.getByTestId("then-next")).toHaveText(/^Then: set 2 of 3 · 155 lb × 8$/i);
  });

  test("skip exercise from the card; the rest-over message; fits phone widths", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("fastfit"));
    await completeOnboarding(page);
    await page.goto("/train/workout");
    await pickExercise(page, "Barbell Bench Press");
    await pickExercise(page, "Dumbbell Biceps Curl");
    const card = page.getByTestId("current-set-card");
    await expect(card.getByTestId("current-exercise")).toHaveText(/Barbell Bench Press/i);

    // Skip the whole exercise from the card (the sheet asks why, with the pain advice).
    await card.getByTestId("skip-exercise").click();
    await page.getByRole("dialog").getByRole("button", { name: "No equipment" }).click();
    await expect(card.getByTestId("current-exercise")).toHaveText(/Dumbbell Biceps Curl/i);

    // A short rest runs out by itself: the card says so, and the set is ready.
    await card.getByLabel("Weight (lb)").fill("25");
    await card.getByLabel("Reps", { exact: true }).fill("12");
    await card.getByTestId("complete-set").click();
    await expect(card.getByTestId("current-rest")).toBeVisible();
    // Shorten the rest to a few seconds (−15s at a time). Stop at 20s or less, so it ends between 6 and 20 seconds
    // from now: stopping at 15 could leave 1s (e.g. 1:31 → … → 0:16 → 0:01), and the timer would vanish before the next read.
    for (let i = 0; i < 20 && (await restSeconds(page)) > 20; i++) await card.getByRole("button", { name: "Subtract 15 seconds" }).click();
    await expect(card.getByTestId("rest-over")).toHaveText(/Rest over\. Set 2 of 3 is ready\./, { timeout: 25_000 });

    // Every control fits common phone widths: no sideways scrolling, nothing cut off.
    await card.getByTestId("complete-set").click();
    await expect(card.getByTestId("current-rest")).toBeVisible();
    for (const width of [360, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `page wider than the screen at ${width}px`).toBeLessThanOrEqual(0);
      for (const target of [card.getByTestId("complete-set"), card.getByTestId("skip-set"), card.getByRole("button", { name: "Skip rest" }), card.getByLabel("Weight (lb)")]) {
        const box = await target.boundingBox();
        expect(box, `missing control at ${width}px`).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        // Big enough to hit mid-set.
        expect(box!.height).toBeGreaterThanOrEqual(36);
      }
    }
  });
});
