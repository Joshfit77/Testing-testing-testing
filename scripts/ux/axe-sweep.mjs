// axe-core (WCAG 2.1 A/AA browser-checkable rules) over every main screen and sub-screen of the demo-mode app at
// phone size, with collapsed sections opened so their contents are checked too. Prints violations by rule and screen.
//
//   BASE=http://localhost:3000 OUT=axe-sweep.json CHROMIUM=... node scripts/ux/axe-sweep.mjs
import { chromium, devices } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "axe-sweep.json";
const ROUTES = process.env.ROUTES?.split(",") ?? [
  "/home", "/train", "/train/programs", "/train/exercises", "/train/exercises/kettlebell-swing", "/train/history", "/train/templates", "/train/build", "/train/recovery", "/train/review", "/calendar",
  "/run", "/run?tab=log", "/run/record",
  "/nutrition", "/nutrition/scanner", "/nutrition/photo", "/nutrition/recipes", "/nutrition/planner", "/nutrition/grocery", "/nutrition/insights", "/nutrition/saved-meals", "/nutrition/supplements", "/nutrition/diets", "/nutrition/compare",
  "/faith", "/faith/bible", "/faith/bible/john/3", "/faith/journal", "/faith/journal/new?kind=daily", "/faith/practices", "/faith/journey", "/faith/memory", "/faith/studies", "/faith/ask",
  "/coach", "/coach/memory", "/progress", "/progress/overview", "/progress/badges", "/progress/body-map", "/progress/body-scan", "/progress/sleep", "/progress/sleep/log", "/progress/sleep/checkin",
  "/profile", "/profile/preferences", "/profile/notifications", "/profile/billing", "/profile/customize", "/search?q=squat",
];
const axeSource = fs.readFileSync(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const { defaultBrowserType: _t, ...dev } = devices["iPhone 15 Pro"];
const ctx = await browser.newContext({ ...dev, deviceScaleFactor: 1, baseURL: BASE });
await ctx.addInitScript(() => { try { localStorage.setItem("ngf.e2e.noIntro", "1"); } catch {} });
const page = await ctx.newPage();
await page.goto("/");
await page.getByRole("button", { name: /Explore with sample data/ }).click();
await page.waitForURL(/\/home/);
const results = [];
for (const route of ROUTES) {
  const res = await page.goto(route, { waitUntil: "load", timeout: 30000 }).catch(() => null);
  if (!res || res.status() >= 400) { results.push({ route, error: `status ${res?.status() ?? "none"}` }); continue; }
  await page.waitForLoadState("networkidle").catch(() => null);
  // Open collapsed sections (details) inside main so their contents are part of the check.
  await page.evaluate(() => document.querySelectorAll("main details:not([open])").forEach((d) => d.setAttribute("open", "")));
  await page.waitForTimeout(300);
  await page.addScriptTag({ content: axeSource }).catch(() => null);
  const axe = await page.evaluate(async () => {
    if (!window.axe) return null;
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, examples: v.nodes.slice(0, 2).map((n) => n.target.join(" ").slice(0, 120)) }));
  });
  results.push({ route, violations: axe });
}
await browser.close();
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
const byRule = {};
let total = 0;
for (const r of results) for (const v of r.violations ?? []) { total += v.nodes; (byRule[v.id] = byRule[v.id] ?? { impact: v.impact, nodes: 0, screens: new Set() }); byRule[v.id].nodes += v.nodes; byRule[v.id].screens.add(r.route); }
console.log(`${results.length} screens checked; ${total} violating nodes in ${Object.keys(byRule).length} rules`);
for (const [id, v] of Object.entries(byRule).sort((a, b) => b[1].nodes - a[1].nodes)) console.log(`${id} (${v.impact}): ${v.nodes} nodes on ${v.screens.size} screens: ${[...v.screens].slice(0, 6).join(", ")}`);
for (const r of results) if (r.error) console.log(`ERROR ${r.route}: ${r.error}`);
for (const r of results) for (const v of r.violations ?? []) console.log(`  ${r.route} ${v.id}: ${v.examples.join(" | ")}`);
