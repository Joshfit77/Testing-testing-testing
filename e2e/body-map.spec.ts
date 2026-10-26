import { expect, test } from "@playwright/test";
import { completeOnboarding, grantPlan, serviceRest, signUpAndConfirm, uniqueEmail, userIdFor } from "./helpers";

/** Completed workouts written straight to the local database, as if logged over the last weeks. */
async function seedWorkouts(email: string, workouts: { daysAgo: number; lifts: { slug: string; sets: { kg: number | null; reps: number }[] }[] }[]) {
  const userId = await userIdFor(email);
  for (const w of workouts) {
    const started = new Date(Date.now() - w.daysAgo * 86_400_000);
    const [session] = await serviceRest<{ id: string }[]>("workout_sessions", {
      method: "POST",
      body: { user_id: userId, client_id: crypto.randomUUID(), name: "Seeded workout", status: "completed", started_at: started.toISOString(), ended_at: new Date(started.getTime() + 3_600_000).toISOString() },
    });
    for (const [i, l] of w.lifts.entries()) {
      const [ex] = await serviceRest<{ id: string }[]>(`exercises?slug=eq.${l.slug}&select=id`);
      const [we] = await serviceRest<{ id: string }[]>("workout_exercises", { method: "POST", body: { session_id: session!.id, user_id: userId, exercise_id: ex!.id, position: i } });
      await serviceRest("workout_sets", {
        method: "POST",
        body: l.sets.map((s, j) => ({ workout_exercise_id: we!.id, user_id: userId, set_number: j + 1, reps: s.reps, weight_kg: s.kg, completed: true, is_warmup: false })),
      });
    }
  }
}

test.describe("Strength & Body Map", () => {
  test("Free members see what the muscle map offers, without data", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("bodymap-free"));
    await completeOnboarding(page);
    await page.goto("/progress");
    await expect(page.getByRole("link", { name: /Strength & Body Map/ })).toContainText("Pro:");
    await page.getByRole("link", { name: /Strength & Body Map/ }).click();
    await page.waitForURL(/\/progress\/body-map/);
    await expect(page.getByText(/included with Pro|Upgrade to Pro|Available with Pro/i).first()).toBeVisible();
    await expect(page.getByTestId("region-list")).toHaveCount(0);
  });

  test("Plus: ranks from real lifts, region details, scoring, both views and the list", async ({ page }) => {
    const email = uniqueEmail("bodymap-plus");
    await signUpAndConfirm(page, email);
    await completeOnboarding(page); // 185 lb body weight, imperial units
    await grantPlan(email, "plus");
    await seedWorkouts(email, [
      { daysAgo: 2, lifts: [{ slug: "bench-press", sets: [{ kg: 85, reps: 5 }, { kg: 85, reps: 5 }] }, { slug: "pull-up", sets: [{ kg: null, reps: 8 }] }] },
      { daysAgo: 5, lifts: [{ slug: "back-squat", sets: [{ kg: 120, reps: 5 }] }, { slug: "leg-press", sets: [{ kg: 400, reps: 12 }] }] },
      { daysAgo: 9, lifts: [{ slug: "conventional-deadlift", sets: [{ kg: 160, reps: 3 }] }, { slug: "overhead-press", sets: [{ kg: 50, reps: 5 }] }] },
    ]);

    await page.goto("/progress/body-map");
    await expect(page.getByRole("heading", { name: "Strength & Body Map", level: 1 })).toBeVisible();
    // Before a table is chosen nothing is ranked, and the page says why.
    await expect(page.getByTestId("overall-rank")).toContainText("Not assessed");
    await expect(page.getByTestId("standards-chooser")).toContainText("Which strength table should your ranks use?");
    await page.getByTestId("standards-chooser").getByRole("button", { name: "Men's table", exact: true }).click();
    await expect(page.getByTestId("standards-chooser")).toContainText("Comparing with the men's table.");

    // Chest 1.18 Gold, upper back 1.27 Silver, shoulders Gold, quads/glutes/lower back/hamstrings Platinum → middle of 7 = Platinum.
    const overall = page.getByTestId("overall-rank");
    await expect(overall).toContainText("Platinum");
    await expect(overall).toContainText("The middle rank of your 7 assessed regions (of 12)");
    await expect(overall).toContainText("Body weight used: 185 lb");

    // Tap the chest on the front figure.
    await page.getByTestId("body-figure-front").locator('[data-region="chest"] path').first().click();
    const detail = page.getByTestId("region-detail");
    await expect(detail.getByRole("heading", { name: "Chest" })).toBeVisible();
    await expect(detail.getByTestId("region-rank")).toHaveText("Gold");
    await expect(detail.getByTestId("region-representative")).toContainText("Barbell Bench Press");
    await expect(detail.getByTestId("region-representative")).toContainText("estimated 1-rep max");
    await expect(detail.getByRole("progressbar", { name: "Progress toward Platinum" })).toBeVisible();
    await detail.getByText("How this rank is scored").click();
    await expect(detail.getByTestId("region-scoring")).toContainText("Estimated 1-rep max ÷ body weight");
    await expect(detail.getByTestId("region-scoring").getByRole("table").first()).toContainText("Disciple");
    await expect(detail.getByTestId("region-stats")).toContainText("Workouts (28 days)");
    await expect(detail.getByTestId("region-exercises")).toContainText("Barbell Bench Press");
    await expect(page).toHaveURL(/region=chest/);

    // The leg press trains the quads but isn't a benchmark: the squat sets the rank.
    await page.getByTestId("region-quadriceps").click();
    await expect(detail.getByTestId("region-rank")).toHaveText("Platinum");
    await expect(detail.getByTestId("region-representative")).toContainText("Barbell Back Squat");
    await expect(detail.getByTestId("region-exercises")).toContainText("Leg Press");

    // Back view, by keyboard.
    await page.getByRole("radio", { name: "Back" }).click();
    const hamstrings = page.getByTestId("body-figure-back").locator('[data-region="hamstrings"]');
    await hamstrings.focus();
    await page.keyboard.press("Enter");
    await expect(detail.getByRole("heading", { name: "Hamstrings" })).toBeVisible();
    await expect(detail.getByTestId("region-rank")).toHaveText("Platinum");

    // Calves are never guessed.
    await page.getByTestId("region-calves").click();
    await expect(detail.getByTestId("region-not-assessed")).toContainText("No provisional rule yet");

    // Colour by sets this week instead; the legend changes with it.
    await page.getByRole("radio", { name: "Sets this week" }).click();
    await expect(page.getByTestId("map-legend")).toContainText("In the usual range");
    await expect(page.getByTestId("region-chest")).toContainText("2 sets");

    // A shared link opens the same region.
    await page.goto("/progress/body-map?region=upper_back");
    await expect(page.getByTestId("region-detail").getByTestId("region-rank")).toHaveText("Silver");
  });
});
