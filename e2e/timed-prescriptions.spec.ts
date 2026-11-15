import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, serviceRest, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * Audit finding P-3 (fixed 2026-11-15): a program exercise prescribed by time on an exercise the catalog counts in
 * reps (cat-cow 45 s, kettlebell swings 30 s) opened with nothing filled in, so the set could not be completed until
 * reps were typed. It now opens with the prescribed seconds and completes with one tap, and history shows it as time.
 */
test("a program set prescribed by time opens with its seconds and completes with one tap", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("timed");
  await signUpAndConfirm(page, email);
  await completeOnboarding(page);
  await grantPlan(email, "pro");

  // A day of the mobility program whose first exercise is prescribed by time on a rep exercise.
  type Row = { id: string; week: { program: { slug: string } }; exercises: { position: number; reps: string | null; duration_seconds: number | null; exercise: { name: string; is_timed: boolean } }[] };
  const days = await serviceRest<Row[]>(
    "program_days?select=id,week:program_weeks!inner(program:training_programs!inner(slug)),exercises:program_exercises(position,reps,duration_seconds,exercise:exercises(name,is_timed))&week.program.slug=eq.full-body-mobility-6-week&limit=40",
  );
  const pick = days
    .map((d) => ({ d, first: [...d.exercises].sort((a, b) => a.position - b.position)[0] }))
    .find(({ first }) => first && !first.exercise.is_timed && !first.reps && (first.duration_seconds ?? 0) > 0);
  expect(pick, "the program has a day that starts with a time-prescribed rep exercise").toBeTruthy();
  const { d, first } = pick!;

  await page.goto(`/train/workout?day=${d.id}`);
  const card = page.getByTestId("current-set-card");
  await expect(page.getByTestId("current-exercise")).toHaveText(first!.exercise.name);
  // No reps to type: the button is ready, and the set carries the prescribed time.
  await expect(card).not.toContainText("Enter your reps");
  const complete = page.getByTestId("complete-set");
  await expect(complete).toBeEnabled();
  await complete.click();
  await expect(page.getByTestId("set-rows").getByLabel("Done").first()).toBeVisible();
  await expect(page.getByTestId("set-rows")).toContainText(`${first!.duration_seconds} s`);
});
