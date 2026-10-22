import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, seedRows, serviceRest, signUpAndConfirm, uniqueEmail, userIdFor } from "./helpers";

interface ProgramDay {
  id: string;
  day_number: number;
  program_exercises: { exercise_id: string; reps: string | null; rpe: number | null; position: number; exercises: { name: string; equipment: string[] } }[];
}

/** Two logged sessions of today's first loaded exercise, each hitting every prescribed rep: enough for a load suggestion. */
async function seedProgressedSessions(email: string) {
  const userId = await userIdFor(email);
  const [up] = await serviceRest<{ id: string; program_id: string }[]>(`user_programs?user_id=eq.${userId}&status=eq.active&select=id,program_id`);
  const weeks = await serviceRest<{ week_number: number; program_days: ProgramDay[] }[]>(
    `program_weeks?program_id=eq.${up!.program_id}&week_number=eq.1&select=week_number,program_days(id,day_number,program_exercises(exercise_id,reps,rpe,position,exercises(name,equipment)))`,
  );
  const day = weeks[0]!.program_days.sort((a, b) => a.day_number - b.day_number)[0]!;
  const ex = day.program_exercises
    .sort((a, b) => a.position - b.position)
    .find((e) => /^\d+(-\d+)?$/.test(e.reps ?? "") && !e.exercises.equipment.every((q) => q === "bodyweight"))!;
  const reps = Math.max(...(ex.reps ?? "8").split("-").map(Number));
  for (const daysAgo of [9, 2]) {
    const started = new Date(Date.now() - daysAgo * 86_400_000);
    const [session] = await serviceRest<{ id: string }[]>("workout_sessions", {
      method: "POST",
      body: { user_id: userId, client_id: randomUUID(), user_program_id: up!.id, program_day_id: day.id, name: "Seeded session", status: "completed", started_at: started.toISOString(), ended_at: new Date(started.getTime() + 3_600_000).toISOString() },
    });
    const [we] = await serviceRest<{ id: string }[]>("workout_exercises", { method: "POST", body: { session_id: session!.id, user_id: userId, exercise_id: ex.exercise_id, position: 0 } });
    await serviceRest("workout_sets", {
      method: "POST",
      body: [1, 2, 3].map((n) => ({ workout_exercise_id: we!.id, user_id: userId, set_number: n, reps, weight_kg: 40, rpe: ex.rpe ? Math.min(Number(ex.rpe), 8) : 7, completed: true, is_warmup: false })),
    });
  }
  return { name: ex.exercises.name, reps };
}

test.describe("training review (Pro)", () => {
  test("explains a suggestion from real logs; it can be modified, accepted, shown in the logger, undone, or turned down", async ({ page }) => {
    const email = uniqueEmail("review");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page);

    // Plus doesn't include it.
    await grantPlan(email, "plus");
    await page.goto("/train/review");
    await expect(page.getByText("Included with Pro")).toBeVisible();

    await grantPlan(email, "pro");
    const { name, reps } = await seedProgressedSessions(email);
    await seedRows(email, "recovery_checkins", [{ checked_on: new Date().toISOString().slice(0, 10), sleep_quality: 1, energy: 2, soreness: 4, stress: 4, readiness_score: 25 }]);
    await page.goto("/train/review");

    const progress = page.getByTestId("training-recommendation").filter({ hasText: `Add load to ${name}` });
    await expect(progress).toBeVisible();
    await expect(progress.getByText(new RegExp(`every set at .+ reached ${reps}\\+ reps`))).toBeVisible();
    const lighter = page.getByTestId("training-recommendation").filter({ hasText: "Take today lighter" });
    await expect(lighter.getByText("Today's check-in readiness is 25/100.")).toBeVisible();

    // Modify, then accept the member's own version.
    await progress.getByRole("button", { name: "Modify" }).click();
    await progress.getByLabel(/^Load/).fill("100");
    await progress.getByLabel("Reps").fill(String(reps));
    await progress.getByRole("button", { name: "Apply my version" }).click();
    await expect(page.getByRole("status")).toContainText(`Target for ${name}: 100`);
    const change = page.getByTestId("training-adjustment").first();
    await expect(change).toContainText(`Target for ${name}: 100`);
    await expect(page.getByTestId("training-recommendation").filter({ hasText: `Add load to ${name}` })).toHaveCount(0);

    // The workout logger shows it beside the exercise.
    await page.goto("/home");
    await page.getByRole("link", { name: /Start workout/ }).click();
    await page.waitForURL(/\/train\/workout/);
    await expect(page.getByTestId("coach-target").first()).toContainText(`Your target: 100`);

    // Undo puts things back.
    await page.goto("/train/review");
    await page.getByTestId("training-adjustment").first().getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("status")).toContainText("Undone:");
    await expect(page.getByTestId("training-adjustment").first()).toContainText("undone");

    // Turning advice down hides it for good.
    await page.getByTestId("training-recommendation").filter({ hasText: "Take today lighter" }).getByRole("button", { name: "Got it" }).click();
    await expect(page.getByTestId("training-recommendation").filter({ hasText: "Take today lighter" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("training-recommendation").filter({ hasText: "Take today lighter" })).toHaveCount(0);
  });
});
