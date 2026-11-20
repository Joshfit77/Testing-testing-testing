import { writeFileSync } from "node:fs";
import { expect, test, type Locator } from "@playwright/test";
import { CONFIRMATION_LINK, PASSWORD, getEmailLink, uniqueEmail } from "./helpers";

/**
 * A first-time member's journey, measured: from the sign-up form to a finished first workout in History, then back
 * again later. Every tap, typed field and checkbox is counted, and each stage is timed. Typed values are what a person
 * would enter; the confirmation email is opened as a person would open its link (one tap). Browser measurement on a
 * phone-sized viewport, not a device test: it shows the steps the app asks for, not how long a person takes to read.
 *
 * Writes the measurements to E2E_JOURNEY_OUT when set.
 */
interface Stage {
  name: string;
  taps: number;
  fields: number;
  seconds: number;
}

test("a new member signs up, onboards and finishes a first workout; it is in History; they can start another", async ({ page }) => {
  test.setTimeout(240_000);
  const stages: Stage[] = [];
  let taps = 0;
  let fields = 0;
  let t0 = Date.now();
  const tap = async (l: Locator) => {
    taps++;
    await l.click();
  };
  const type = async (l: Locator, v: string) => {
    fields++;
    await l.fill(v);
  };
  const check = async (l: Locator) => {
    taps++;
    await l.check();
  };
  const stage = (name: string) => {
    stages.push({ name, taps, fields, seconds: Math.round((Date.now() - t0) / 100) / 10 });
    taps = 0;
    fields = 0;
    t0 = Date.now();
  };
  const email = uniqueEmail("journey");

  // 1. Create the account.
  await page.goto("/signup");
  await type(page.getByLabel("Name"), "Josh");
  await type(page.getByLabel("Email"), email);
  await type(page.getByLabel("Password", { exact: true }), PASSWORD);
  await check(page.getByLabel("I confirm I am 18 years of age or older."));
  await check(page.getByRole("checkbox", { name: /I agree to the/ }));
  await check(page.getByRole("checkbox", { name: /I understand that exercise and outdoor activity carry a risk of injury/ }));
  await tap(page.getByRole("button", { name: "Create account" }));
  await page.getByText("Check your inbox").waitFor();
  stage("Create account (form)");

  // 2. Confirm the email: one tap on the link.
  const link = await getEmailLink(email, CONFIRMATION_LINK);
  taps++;
  await page.goto(link.replace(/^http:\/\/localhost:3000(?=\/)/, new URL(page.url()).origin));
  await page.waitForURL(/\/onboarding/);
  stage("Confirm email (tap the link)");

  // 3. Onboarding, the quick path.
  const next = () => tap(page.getByRole("button", { name: /^Continue/ }));
  await tap(page.getByRole("button", { name: "Build strength", exact: true }));
  await next();
  await tap(page.getByRole("button", { name: "1–3 years", exact: true }));
  await next();
  await next();
  await tap(page.getByRole("button", { name: /^Home gym/ }));
  await next();
  await tap(page.getByRole("button", { name: "Male", exact: true }));
  await type(page.getByLabel("Age"), "34");
  await type(page.getByLabel("Height (ft)"), "5");
  await type(page.getByLabel("Height (in)"), "10");
  await type(page.getByLabel(/Current weight/), "185");
  await next();
  await tap(page.getByRole("button", { name: "Build my plan" }));
  await page.waitForURL(/\/plan/, { timeout: 60_000 });
  stage("Onboarding to the plan");

  // 4. The plan summary leads with today's session, above the fold: one tap starts it (Home is the secondary choice).
  const start = page.getByTestId("plan-start-today").getByRole("link", { name: /^Start Today's Workout/i });
  await expect(start).toBeInViewport();
  await tap(start);
  await page.waitForURL(/\/train\/workout/);
  stage("Plan to the first workout");

  // 5. The exercise demonstration is on screen without a tap.
  await expect(page.locator("main canvas").first()).toBeVisible();

  // 6. Log the first set: the reps come filled in from the program's target, so only the weight is typed; then done.
  // The rest timer starts by itself.
  await expect(page.getByLabel(/set 1 reps/).first()).not.toHaveValue("");
  await type(page.getByLabel(/set 1 weight in lb/).first(), "135");
  await tap(page.getByRole("button", { name: /Mark .* set 1 complete/ }).first());
  await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();
  stage("First set logged (rest timer started automatically)");

  // 7. Finish.
  await tap(page.getByRole("button", { name: "Finish" }));
  await tap(page.getByRole("button", { name: "Finish & save" }));
  await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();
  stage("Finish and save");

  // 8. It's in History.
  await tap(page.getByRole("link", { name: "View history" }));
  await expect(page.getByRole("heading", { name: "Workout history" })).toBeVisible();
  await expect(page.locator("main").getByRole("link").filter({ hasText: /exercises/ }).first()).toBeVisible();
  stage("See it in History");

  // 9. Later: Home (with the first workout done) and start another workout.
  await page.goto("/home");
  const again = page.getByRole("link", { name: /^Start (Today's Workout|workout|next workout)/i }).first();
  await expect(again).toBeVisible();
  await tap(again);
  await page.waitForURL(/\/train\/workout/);
  await expect(page.getByLabel(/set 1 weight in lb/).first()).toBeVisible();
  stage("Come back later and start another");

  const out = process.env.E2E_JOURNEY_OUT;
  if (out) writeFileSync(out, JSON.stringify(stages, null, 2));
  // Guard rails, not targets: a first workout should stay a short path.
  const total = stages.reduce((a, s) => ({ taps: a.taps + s.taps, fields: a.fields + s.fields }), { taps: 0, fields: 0 });
  expect(total.taps).toBeLessThan(40);
});

