// Scripted task journeys for the UX acceptance phase: counts taps, typed fields, scrolls, screens and errors from Home
// to task completion, for one account state. Time is a model-based ESTIMATE (keystroke-level style), not a measurement
// of a human. Usage: node journeys.mjs <out.json> <established|occasional|new> [only=j1,j2]
import { chromium, devices } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3000", OUT = process.argv[2], ACCOUNT = process.argv[3] ?? "established";
const ONLY = (process.argv[4] ?? "").replace("only=", "").split(",").filter(Boolean);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const { defaultBrowserType: _d, ...iPhone } = devices["iPhone 15 Pro"];
const ctx = await b.newContext({ ...iPhone, viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, timezoneId: "America/New_York",
  geolocation: { latitude: 40.7812, longitude: -73.9665, accuracy: 8 }, permissions: ["geolocation"] });
ctx.setDefaultTimeout(20000);
let page = await ctx.newPage();
const hideDemo = () => page.addStyleTag({ content: `[data-testid="demo-bar"]{display:none!important}` }).catch(() => {});


// ---- counters -----------------------------------------------------------------------------------------------------
let C;
const reset = () => (C = { taps: 0, fields: 0, chars: 0, scrolls: 0, scrollPx: 0, urls: new Set([page.url().replace(BASE, "")]), errors: [], steps: [], t0: Date.now() });
function attach(p) {
  p.on("load", hideDemo);
  p.on("pageerror", (e) => C?.errors.push(`pageerror ${e.message.slice(0, 120)}`));
  p.on("response", (r) => { if (C && r.url().startsWith(BASE) && r.status() >= 400 && !/favicon/.test(r.url())) C.errors.push(`http ${r.status()} ${r.url().replace(BASE, "").slice(0, 80)}`); });
  p.on("framenavigated", (f) => { if (C && f === p.mainFrame()) C.urls.add(f.url().replace(BASE, "").split("#")[0]); });
}
attach(page);
async function reach(loc) {
  await loc.waitFor({ state: "visible" });
  const fixed = await loc.evaluate((el) => { for (let e = el; e; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === "fixed" || p === "sticky") return true; } return false; }).catch(() => false);
  if (fixed) return;
  const box = await loc.boundingBox();
  const vh = 852 - 84;
  if (box && (box.y + box.height > vh || box.y < 0)) { C.scrolls++; C.scrollPx += Math.round(box.y < 0 ? -box.y : box.y + box.height - vh + 40); }
}
async function tap(loc, label) { C.trying = label; loc = loc.filter({ visible: true }).first(); await reach(loc); await loc.click(); C.taps++; C.steps.push(`tap ${label}`); await page.waitForLoadState("domcontentloaded").catch(() => {}); }
async function type(loc, text, label) { C.trying = label; loc = loc.filter({ visible: true }).first(); await reach(loc); await loc.fill(String(text)); C.fields++; C.chars += String(text).length; C.steps.push(`type ${label}`); }
const estimate = () => +(1.3 * C.taps + C.fields * 1.3 + 0.28 * C.chars + 1.0 * C.scrolls + 1.0 * (C.urls.size - 1) + (Date.now() - C.t0) / 1000 * 0.3).toFixed(1);
const results = [];
async function journey(id, title, target, fn) {
  if (ONLY.length && !ONLY.includes(id)) return;
  // A fresh tab per journey: no remembered tab screens, scroll positions or session storage from the last task.
  const old = page; page = await ctx.newPage(); attach(page); await old.close();
  await page.goto(BASE + "/home"); await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(BASE + "/home"); await page.waitForLoadState("networkidle").catch(() => {});
  reset();
  let ok = true, note = "";
  try { note = (await fn()) ?? ""; } catch (e) { ok = false; note = `at "${C.trying}": ` + String(e.message ?? e).split("\n")[0].slice(0, 160); }
  const r = { id, title, account: ACCOUNT, ok, note, taps: C.taps, fields: C.fields, chars: C.chars, interactions: C.taps + C.fields, scrolls: C.scrolls, scrollPx: C.scrollPx,
    screens: C.urls.size - 1, machineSeconds: +((Date.now() - C.t0) / 1000).toFixed(1), estimatedHumanSeconds: estimate(), target, errors: C.errors, steps: C.steps };
  results.push(r);
  console.log(`${ok ? "OK  " : "FAIL"} ${id} ${title}: ${r.interactions} interactions (${r.taps} taps, ${r.fields} fields), ${r.scrolls} scrolls, ${r.screens} screens, ~${r.estimatedHumanSeconds}s est${note ? " — " + note : ""}`);
}

// ---- sign in ------------------------------------------------------------------------------------------------------
await page.goto(BASE + "/"); await page.getByRole("button", { name: "Skip intro" }).click({ timeout: 6000 }).catch(() => {});
if (ACCOUNT === "new") {
  await page.goto(BASE + "/login"); await page.getByRole("button", { name: "Start as a new member" }).click(); await page.waitForURL(/onboarding/);
  const cont = () => page.getByRole("button", { name: /^Continue/ }).click();
  await page.getByRole("button", { name: "Build muscle", exact: true }).click(); await cont();
  await page.getByRole("button", { name: "Under 1 year", exact: true }).click(); await cont();
  await page.getByRole("button", { name: /^3\s*days$/ }).first().click(); await page.getByRole("button", { name: /^45\s*min$/ }).first().click(); await cont();
  await page.getByRole("button", { name: /^Full gym/ }).click(); await cont();
  await page.getByRole("button", { name: "Male", exact: true }).click().catch(() => {});
  await page.getByLabel("Age").fill("30"); await page.getByLabel("Height (ft)").fill("5"); await page.getByLabel("Height (in)").fill("10"); await page.getByLabel(/Current weight/).fill("180");
  await cont(); await page.getByRole("button", { name: "Build my plan" }).click(); await page.waitForURL(/\/(plan|home)/, { timeout: 60000 });
} else if (ACCOUNT === "occasional") {
  const env = Object.fromEntries(fs.readFileSync(new URL("./occasional.env", import.meta.url), "utf8").trim().split("\n").map((l) => l.split("=")));
  await page.goto(BASE + "/login"); await page.getByLabel("Email").fill(env.OCC_EMAIL); await page.getByLabel("Password", { exact: true }).fill(env.OCC_PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/ }).click(); await page.waitForURL(/\/home/, { timeout: 60000 });
} else { await page.getByRole("button", { name: "Explore with sample data" }).click(); await page.waitForURL(/\/home/); }

// ---- journeys -----------------------------------------------------------------------------------------------------
const J = JSON.parse(fs.readFileSync(new URL("./journey-steps.json", import.meta.url)));
const steps = await import(new URL("./journey-steps.mjs", import.meta.url));
for (const j of J) await journey(j.id, j.title, j.target, () => steps[j.id]({ page, tap, type, tab: (n) => page.locator('nav[data-hide-with-keyboard]').getByRole("link", { name: n, exact: true }), ACCOUNT, mark: () => { reset(); C.urls = new Set([page.url().replace(BASE, '').split('#')[0]]); } }));
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
await b.close();
