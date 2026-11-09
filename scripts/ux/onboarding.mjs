import { chromium, devices } from "playwright";
import fs from "node:fs";
const BASE = "http://localhost:3000", OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const { defaultBrowserType: _d, ...iPhone } = devices["iPhone 15 Pro"];
const ctx = await b.newContext({ ...iPhone, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
const page = await ctx.newPage(); let n = 0, taps = 0;
const shot = async (name) => { await page.addStyleTag({ content: `[data-testid="demo-bar"]{display:none!important}` }).catch(() => {}); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${name}.png` }); };
const tap = async (loc) => { await loc.click(); taps++; };
const t0 = Date.now();
await page.goto(BASE + "/"); await shot("opening"); await tap(page.getByRole("button", { name: "Skip intro" })).catch(() => {}); await shot("welcome");
await page.goto(BASE + "/login"); await shot("login"); await tap(page.getByRole("button", { name: "Start as a new member" })); await page.waitForURL(/onboarding/);
const cont = () => tap(page.getByRole("button", { name: /^Continue/ }));
await shot("goal"); await tap(page.getByRole("button", { name: "Build muscle", exact: true })); await cont();
await shot("experience"); await tap(page.getByRole("button", { name: "Under 1 year", exact: true })); await cont();
// 3 days and 45 minutes are preselected (aria-pressed); a member who accepts them only taps Continue.
const pick = async (loc) => { if ((await loc.getAttribute("aria-pressed")) !== "true") await tap(loc); };
await shot("schedule"); await pick(page.getByRole("button", { name: /^3\s*days$/ }).first()); await pick(page.getByRole("button", { name: /^45\s*min$/ }).first()); await cont();
await shot("equipment"); await tap(page.getByRole("button", { name: /^Full gym/ })); await cont();
await shot("body"); await tap(page.getByRole("button", { name: "Male", exact: true })).catch(() => {});
for (const [l, v] of [["Age", "30"], ["Height (ft)", "5"], ["Height (in)", "10"]]) { await page.getByLabel(l).fill(v); taps++; }
await page.getByLabel(/Current weight/).fill("180"); taps++;
await shot("body-filled"); await cont(); await shot("name-ready"); await tap(page.getByRole("button", { name: "Build my plan" }));
await page.waitForURL(/\/(plan|home)/, { timeout: 60000 }); await page.waitForLoadState("networkidle").catch(() => {}); await shot("after-onboarding");
const first = page.getByRole("link", { name: /Start my first workout|Start Today.s Workout/i }).first();
await tap(first); await page.waitForURL(/\/train\/workout/); await page.waitForLoadState("networkidle").catch(() => {}); await shot("first-workout");
const toStart = taps, startSeconds = (Date.now() - t0) / 1000;
// Then finish that first workout the way a new member would: type a weight on each exercise's first set when it is
// empty (it carries down to the next sets), take the prefilled reps, tap Complete set for every set, then Finish & save.
let fields = 0, sets = 0;
const card = page.getByTestId("current-set-card");
for (let i = 0; i < 80; i++) {
  if (await page.getByRole("button", { name: "Finish workout" }).first().isVisible().catch(() => false)) break;
  const done = card.getByTestId("complete-set");
  if (!(await done.isVisible().catch(() => false))) break;
  const weight = card.getByTestId("current-weight").locator("input");
  if ((await weight.count()) && !(await weight.inputValue())) { await weight.fill("45"); taps++; fields++; }
  const reps = card.getByTestId("current-reps").locator("input");
  if ((await reps.count()) && !(await reps.inputValue())) { await reps.fill("8"); taps++; fields++; }
  // Wait for the header's "n/12 sets" to move on before the next set.
  const counter = page.getByText(/^\d+\/\d+ sets$/).first();
  const before = (await counter.textContent().catch(() => ""))?.trim();
  await tap(done); sets++;
  for (let w = 0; w < 25 && (await counter.textContent().catch(() => ""))?.trim() === before; w++) await page.waitForTimeout(200);
  // The logger ignores a second Complete within 700 ms (CARD_DOUBLE_TAP_MS); a member rests far longer than that.
  await page.waitForTimeout(750);
}
await shot("all-sets-done");
await tap(page.getByRole("button", { name: "Finish workout" }).first());
await tap(page.getByRole("button", { name: "Finish & save" }));
await page.waitForURL((u) => !/\/train\/workout$/.test(u.pathname) || /done|complete|summary/.test(u.href), { timeout: 30000 }).catch(() => {});
await page.waitForLoadState("networkidle").catch(() => {}); await shot("workout-complete");
console.log(JSON.stringify({ tapsFromLoginToFirstWorkout: toStart, secondsToStart: startSeconds, landedOn: "/train/workout", setsCompleted: sets, fieldsTyped: fields, tapsFromLoginToWorkoutSaved: taps, finalUrl: page.url(), completionHeading: (await page.getByRole("heading").first().textContent().catch(() => ""))?.trim() }));
await b.close();
