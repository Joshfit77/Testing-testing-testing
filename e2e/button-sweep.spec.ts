import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

/**
 * Audit tool (not part of the normal run): opens each main screen as a new member and taps every visible button, link
 * styled as a button, tab and summary on it, one at a time from a fresh load, and records what goes wrong: script
 * errors, server errors (5xx), failed requests to the app, and error screens. Destructive and payment controls are
 * skipped (delete, sign out, cancel membership, purchases...). Writes E2E_SWEEP_OUT (default test-results/sweep.json).
 *   E2E_BUTTON_SWEEP=1 npx playwright test e2e/button-sweep.spec.ts --project=mobile
 */
test.skip(!process.env.E2E_BUTTON_SWEEP, "audit tool: set E2E_BUTTON_SWEEP=1");
test.setTimeout(90 * 60_000);

const PAGES = [
  "/home", "/calendar", "/coach", "/coach/memory",
  "/train", "/train/programs", "/train/exercises", "/train/exercises/back-squat", "/train/history", "/train/build", "/train/templates", "/train/recovery", "/train/workout?blank=1",
  "/run", "/run/record?kind=walk",
  "/nutrition", "/nutrition/planner", "/nutrition/grocery", "/nutrition/recipes", "/nutrition/insights", "/nutrition/photo", "/nutrition/scanner", "/nutrition/label", "/nutrition/supplements", "/nutrition/saved-meals", "/nutrition/diets",
  "/faith", "/faith/bible", "/faith/bible/john/3", "/faith/bible/saved", "/faith/journal", "/faith/journal/new", "/faith/memory", "/faith/studies", "/faith/studies/gospel", "/faith/practices", "/faith/journey", "/faith/ask",
  "/progress", "/progress/overview", "/progress/sleep", "/progress/sleep/log", "/progress/body-map", "/progress/body-scan", "/progress/badges",
  "/profile", "/profile/preferences", "/profile/notifications", "/profile/billing",
];
const SKIP = /delete|remove|sign ?out|log ?out|cancel (my )?(subscription|membership|plan)|reset|discard|erase|clear (all|history)|disconnect|deactivate|start over|subscribe|upgrade|checkout|buy|purchase|restore purchases|manage (subscription|billing)|pay |yearly|monthly|export my data|download my data|finish/i;

type Finding = { page: string; control: string; kind: string; detail: string };

test("tap every safe control on every main screen", async ({ page, baseURL }) => {
  await signUpAndConfirm(page, uniqueEmail("sweep"));
  await completeOnboarding(page);
  const origin = new URL(baseURL!).origin;
  const findings: Finding[] = [];
  let tapped = 0;
  let current = { page: "", control: "" };
  page.on("pageerror", (e) => findings.push({ ...current, kind: "script error", detail: e.message.slice(0, 200) }));
  page.on("response", (r) => { if (r.status() >= 500 && r.url().startsWith(origin)) findings.push({ ...current, kind: `HTTP ${r.status()}`, detail: r.url().replace(origin, "") }); });
  page.on("requestfailed", (r) => { if (r.url().startsWith(origin) && !/_rsc=|\/_next\/static/.test(r.url()) && r.failure()?.errorText !== "net::ERR_ABORTED") findings.push({ ...current, kind: "request failed", detail: `${r.url().replace(origin, "")} ${r.failure()?.errorText}` }); });
  // Stand-ins so taps that ask for a camera or location get a quick, harmless answer.
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 40.0, longitude: -75.0, accuracy: 5 });

  const controls = () => page.evaluate(() => Array.from(document.querySelectorAll("main button, main [role=button], main [role=tab], main summary, main a[class*='inline-flex']"))
    .filter((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 4 && r.height > 4 && cs.visibility !== "hidden" && cs.display !== "none" && !(el as HTMLButtonElement).disabled; })
    .map((el, i) => ({ i, label: ((el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60)) })));

  for (const p of PAGES) {
    current = { page: p, control: "(load)" };
    const res = await page.goto(p).catch(() => null);
    if (!res || res.status() >= 400) { findings.push({ ...current, kind: "page", detail: `status ${res?.status() ?? "none"}` }); continue; }
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const list = (await controls()).filter((c) => c.label && !SKIP.test(c.label));
    const seen = new Set<string>();
    for (const c of list) {
      if (seen.has(c.label)) continue;
      seen.add(c.label);
      current = { page: p, control: c.label };
      if (new URL(page.url()).pathname + new URL(page.url()).search !== p) {
        await page.goto(p).catch(() => undefined);
        await page.waitForLoadState("networkidle").catch(() => undefined);
      }
      const el = page.locator("main button, main [role=button], main [role=tab], main summary, main a[class*='inline-flex']").filter({ hasText: c.label.slice(0, 30) }).first();
      const target = (await el.count()) ? el : page.getByRole("button", { name: c.label }).first();
      try {
        await target.click({ timeout: 3000 });
      } catch {
        continue; // covered or moved: not a defect by itself
      }
      tapped++;
      await page.waitForTimeout(700);
      const body = await page.locator("body").innerText().catch(() => "");
      if (/Something went wrong|Application error|Internal Server Error|This page couldn.t load/i.test(body)) findings.push({ ...current, kind: "error screen", detail: page.url().replace(origin, "") });
      await page.keyboard.press("Escape").catch(() => undefined);
    }
  }
  const out = process.env.E2E_SWEEP_OUT ?? "test-results/sweep.json";
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ pages: PAGES.length, tapped, findings }, null, 1));
  console.log(`swept ${PAGES.length} screens, ${tapped} controls tapped, ${findings.length} findings`);
  expect(tapped).toBeGreaterThan(100);
});
