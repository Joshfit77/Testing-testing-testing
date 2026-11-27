import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * The priority 2D demonstrations in the app (docs/EXERCISE_ANIMATION_2D.md): the demo leads the exercise page, the
 * Side / Front switch keeps the position in the rep, Replay restarts it, the muscle key matches the glow, the player
 * survives navigating away and back and keeps working offline, and opening the demo during a workout leaves the
 * logged sets alone.
 */
test.describe("premium 2D exercise demonstrations", () => {
  test("exercise page: demo first, view switch, replay, muscle key, back-navigation and offline", async ({ page, context }) => {
    test.setTimeout(150_000);
    await signUpAndConfirm(page, uniqueEmail("p2d"));
    await completeOnboarding(page);

    await page.goto("/train/exercises/dumbbell-curl");
    const player = page.locator("[data-exercise-motion]").first();
    await expect(player).toBeVisible();
    // The demonstration comes before the progress cards.
    const demoTop = (await player.boundingBox())!.y;
    const historyTop = (await page.getByRole("link", { name: /Your history/ }).boundingBox())!.y;
    expect(demoTop).toBeLessThan(historyTop);

    // Side and Front views; switching keeps the place in the rep.
    const side = page.getByRole("button", { name: "Side view" });
    const front = page.getByRole("button", { name: "Front view" });
    await expect(side).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Pause demonstration" }).click();
    const bar = page.getByRole("slider", { name: "Position in the movement" });
    await bar.fill("400");
    await front.click();
    await expect(front).toHaveAttribute("aria-pressed", "true");
    await expect(player).toHaveAttribute("data-view", "front");
    expect(Number(await bar.inputValue())).toBeGreaterThan(380);
    expect(Number(await bar.inputValue())).toBeLessThan(420);

    // Replay starts the movement again from the top and plays.
    await page.getByRole("button", { name: "Replay from the start" }).click();
    await expect(player).toHaveAttribute("data-playing", "true");

    // The muscle key: primary in gold, secondary in blue, with the honest note.
    const key = page.getByTestId("muscle-key");
    await expect(key.getByTestId("muscle-key-primary")).toContainText("Biceps");
    await expect(key.getByTestId("muscle-key-secondary")).toContainText("Forearms");
    await expect(key).toContainText("not a measurement of muscle activity");

    // One-view exercises have no switch.
    await page.goto("/train/exercises/bench-press");
    await expect(page.locator("[data-exercise-motion]").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Front view" })).toHaveCount(0);

    // Away and back: the player is rebuilt and plays again.
    await page.goto("/train");
    await page.goBack();
    await expect(page).toHaveURL(/\/train\/exercises\/bench-press/);
    await expect(page.locator("[data-exercise-motion]").first()).toHaveAttribute("data-playing", "true");
    await expect(page.locator("[data-exercise-motion]")).toHaveCount(1);

    // Offline: the animation is drawn on the device, so switching views and replaying need no network.
    await page.goto("/train/exercises/dumbbell-curl");
    await expect(page.locator("[data-exercise-motion]").first()).toBeVisible();
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await context.setOffline(true);
    await page.getByRole("button", { name: "Front view" }).click();
    await expect(page.locator("[data-exercise-motion]").first()).toHaveAttribute("data-view", "front");
    await page.getByRole("button", { name: "Replay from the start" }).click();
    await expect(page.locator("[data-exercise-motion]").first()).toHaveAttribute("data-playing", "true");
    await context.setOffline(false);
    // Next.js prefetches the page's own links (`?_rsc=`); apart from those, the player asked for nothing.
    expect(requests.filter((u) => !u.includes("_rsc="))).toEqual([]);
  });

  test("workout: the Muscles tab, and opening the demo never touches the logged sets", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpAndConfirm(page, uniqueEmail("p2dw"));
    await completeOnboarding(page);
    await page.goto("/train/workout");
    await page.getByRole("button", { name: "Add exercise" }).click();
    const picker = page.getByRole("dialog");
    await picker.getByPlaceholder("Search by name or muscle").fill("Barbell Back Squat");
    await picker.getByRole("button", { name: /^Barbell Back Squat/ }).first().click();
    await expect(picker).toBeHidden();

    const card = page.getByTestId("current-set-card");
    await card.getByLabel("Weight (lb)").fill("185");
    await card.getByLabel("Reps", { exact: true }).fill("5");
    await card.getByTestId("complete-set").click();
    await expect(page.getByRole("button", { name: /Barbell Back Squat set 1 completed/ })).toBeVisible();

    await card.getByTestId("exercise-info-button").click();
    const info = page.getByTestId("exercise-info");
    await expect(info.locator("[data-exercise-motion]")).toBeVisible();
    await info.getByTestId("info-tab-muscles").click();
    await expect(info.getByTestId("muscle-key-primary")).toContainText("Quadriceps");
    // The squat is shown from the side only (its front view was withdrawn until it meets the side view's standard).
    await expect(info.getByRole("button", { name: "Front view" })).toHaveCount(0);
    await expect(info.locator("[data-exercise-motion]")).toHaveAttribute("data-view", "side");
    await page.keyboard.press("Escape");
    await expect(info).toBeHidden();

    // The completed set and the values typed for the next one are untouched.
    await expect(page.getByRole("button", { name: /Barbell Back Squat set 1 completed/ })).toBeVisible();
    await expect(card.getByLabel("Weight (lb)")).toHaveValue("185");
  });
});
