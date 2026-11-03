import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { answerOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * First-workout activation, measured: a brand-new member (never trained, dumbbells at home) from the first screen of
 * the questionnaire to their first completed set and their first finished workout, the way the app leads them.
 *
 * It measures what a browser test can measure honestly: how many taps and typed fields each stage takes, and how
 * long the app itself takes (page loads and server round trips with an automated "user" who answers instantly).
 * It is not a human timing and says nothing about real members' retention.
 *
 * ACTIVATION_RUNS (default 1) runs the path that many times; ACTIVATION_LABEL names the results file
 * (test-results/activation-<label>.json). The same spec runs before and after a change for a like-for-like comparison.
 */
const RUNS = Number(process.env.ACTIVATION_RUNS ?? 1);
const LABEL = process.env.ACTIVATION_LABEL ?? "current";

interface Stage {
  ms: number;
  taps: number;
  typed: number;
}

/** Counts real taps and typed-in fields on every page of the tab (kept in sessionStorage across navigations). */
async function countActions(page: Page) {
  await page.addInitScript(() => {
    const KEY = "ngf.e2e.actions";
    const read = () => {
      try {
        return JSON.parse(sessionStorage.getItem(KEY) ?? "") as { taps: number; typed: number };
      } catch {
        return { taps: 0, typed: 0 };
      }
    };
    const bump = (k: "taps" | "typed") => {
      const c = read();
      c[k] += 1;
      sessionStorage.setItem(KEY, JSON.stringify(c));
    };
    let typing: EventTarget | null = null;
    document.addEventListener("click", (e) => e.isTrusted && bump("taps"), true);
    document.addEventListener("focusin", () => (typing = null), true);
    document.addEventListener(
      "input",
      (e) => {
        const t = e.target as HTMLInputElement | null;
        if (!e.isTrusted || !t || t.type === "checkbox" || t.type === "radio" || typing === t) return;
        typing = t;
        bump("typed");
      },
      true,
    );
  });
  return async () => page.evaluate(() => JSON.parse(sessionStorage.getItem("ngf.e2e.actions") ?? '{"taps":0,"typed":0}') as { taps: number; typed: number });
}

test.describe("first-workout activation (measured)", () => {
  test.setTimeout(240_000 * RUNS);

  test("a brand-new member reaches a first completed set and a finished workout", async ({ page }, info) => {
    const runs: Record<string, Stage>[] = [];
    const checks: Record<string, boolean>[] = [];
    for (let run = 0; run < RUNS; run++) {
      await page.context().clearCookies();
      const actions = await countActions(page);
      await signUpAndConfirm(page, uniqueEmail("activation"), "New Member");
      await page.waitForURL(/\/onboarding/);
      await page.getByRole("button", { name: /^Continue/ }).waitFor();
      // Everything before this point is sign-up and the confirmation email, the same in both versions.
      await page.evaluate(() => sessionStorage.setItem("ngf.e2e.actions", '{"taps":0,"typed":0}'));
      const t0 = Date.now();
      const marks: Record<string, Stage> = {};
      const mark = async (name: string) => {
        const a = await actions();
        marks[name] = { ms: Date.now() - t0, taps: a.taps, typed: a.typed };
      };

      await answerOnboarding(page, { experience: "Brand new to training", equipment: /^Dumbbells only/ });
      await mark("onboardingDone");

      // The one obvious next step: start today's workout, wherever the app put the member after onboarding.
      const start = page.getByRole("link", { name: /^Start (my first workout|today.s workout)/i }).first();
      await start.waitFor();
      const viewport = page.viewportSize()!;
      const inView = async (box: { y: number; height: number } | null) => Boolean(box && box.y >= 0 && box.y + box.height <= viewport.height);
      const startVisibleWithoutScrolling = await inView(await start.boundingBox());
      await start.click();
      await page.waitForURL(/\/train\/workout/);
      const firstSet = page.getByRole("button", { name: /^Mark .+ complete$/ }).first();
      await firstSet.waitFor();
      await mark("loggerOpen");

      // The first exercise is on screen without scrolling, and nothing asks a beginner for a working weight.
      const firstSetVisibleWithoutScrolling = await inView(await firstSet.boundingBox());
      const firstTimeTipShown = (await page.getByTestId("first-time-tip").count()) > 0;

      await firstSet.click();
      await expect(page.getByRole("button", { name: /completed\. Mark incomplete$/ }).first()).toBeVisible();
      await mark("firstSet");

      await page.getByRole("button", { name: "Finish", exact: true }).click();
      await page.getByRole("button", { name: "Finish & save" }).click();
      await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible({ timeout: 30_000 });
      await mark("workoutDone");

      // After the first workout: progress and the next recommended session are shown.
      const upNext = await page.getByRole("heading", { name: /^(Up next|Program complete)$/ }).isVisible();
      const programProgressShown = (await page.getByTestId("program-progress").count()) > 0;
      runs.push(marks);
      checks.push({ startVisibleWithoutScrolling, firstSetVisibleWithoutScrolling, firstTimeTipShown, upNextShown: upNext, programProgressShown });
      expect(upNext).toBe(true);
    }

    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    const stages = ["onboardingDone", "loggerOpen", "firstSet", "workoutDone"] as const;
    const summary = Object.fromEntries(stages.map((s) => [s, { medianMs: median(runs.map((r) => r[s]!.ms)), taps: runs[0]![s]!.taps, typed: runs[0]![s]!.typed }]));
    const out = {
      label: LABEL,
      runs: RUNS,
      project: info.project.name,
      viewport: page.viewportSize(),
      // A check counts only if it held on every run.
      checks: Object.fromEntries(Object.keys(checks[0]!).map((k) => [k, checks.every((c) => c[k])])),
      summary,
      raw: runs,
    };
    mkdirSync("test-results", { recursive: true });
    writeFileSync(`test-results/activation-${LABEL}.json`, JSON.stringify(out, null, 2));
    console.log(JSON.stringify({ summary: out.summary, checks: out.checks }, null, 2));
  });
});
