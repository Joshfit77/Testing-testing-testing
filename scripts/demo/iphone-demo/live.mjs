// Marks where the app's live 2D exercise demonstration sits on each captured exercise page (and in the workout's
// demonstration dialog), so the viewer can play the real engine there instead of a still picture.
//   BASE=http://localhost:3000 node scripts/demo/iphone-demo/live.mjs <cap dir>      (after crawl.mjs; again after FLOWS=1)
// Reads <cap>/screens.json, writes it back with {kind:"live"} targets (backup: screens.before-live.json).
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const cap = process.argv[2];
const file = path.join(cap, "screens.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
if (!fs.existsSync(path.join(cap, "screens.before-live.json"))) fs.copyFileSync(file, path.join(cap, "screens.before-live.json"));
const log = (s) => console.log(`${new Date().toISOString().slice(11, 19)} ${s}`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
const { defaultBrowserType: _d, ...iPhone } = devices["iPhone 15"];
// The crawl's context (same viewport, time zone, reduced motion, no transitions); 1x is enough to measure boxes.
const ctx = await b.newContext({ ...iPhone, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, timezoneId: "America/New_York", reducedMotion: "reduce" });
ctx.setDefaultTimeout(45000);
await ctx.addInitScript(() => {
  const st = document.createElement("style");
  st.textContent = `nav[data-hide-with-keyboard]{visibility:hidden!important} *,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}`;
  (document.head || document.documentElement)?.append(st);
});
const page = await ctx.newPage();

async function settle(ms = 700) {
  await page.waitForLoadState("domcontentloaded");
  try { await page.waitForLoadState("networkidle", { timeout: 4000 }); } catch {}
  await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(ms);
}

// The demonstration hosts on the page (document coordinates; viewport coordinates inside a dialog).
const boxes = (scope) => page.evaluate((scope) => {
  const root = scope ? Array.from(document.querySelectorAll(scope)).pop() || document : document;
  return Array.from(root.querySelectorAll('[data-testid="exercise-demo"][data-demo-readiness="animated"]')).map((el) => {
    const r = el.getBoundingClientRect();
    const lab = el.querySelector("[aria-label^='Animated demonstration of']")?.getAttribute("aria-label") || "";
    const name = (lab.match(/^Animated demonstration of (.+?)\. /) || [])[1] || null;
    return { x: Math.round(r.left), y: Math.round(r.top + (scope ? 0 : scrollY)), w: Math.round(r.width), h: Math.round(r.height), name, controls: r.width >= 200 };
  }).filter((x) => x.w >= 40 && x.h >= 30);
}, scope ?? null);

// Replaces the crawled targets inside a live box (the player's own buttons) with one live target.
function apply(s, list, slug) {
  const live = list.map((x) => ({ x: x.x, y: x.y, w: x.w, h: x.h, label: "Exercise demonstration", to: "live2d:" + (x.name ? "" : slug ?? ""), name: x.name, controls: x.controls, kind: "live" }));
  const inside = (h, x) => h.x >= x.x - 1 && h.y >= x.y - 1 && h.x + h.w <= x.x + x.w + 1 && h.y + h.h <= x.y + x.h + 1;
  s.hot = [...live, ...s.hot.filter((h) => h.kind !== "live" && !live.some((x) => inside(h, x)))];
}

// Sign in to the sample account the way the crawl does.
await page.goto(`${BASE}/`);
const opening = page.getByRole("dialog", { name: "Narrow Gate Fitness opening" });
await opening.waitFor({ timeout: 8000 }).then(() => opening.getByRole("button", { name: "Skip intro" }).click()).catch(() => {});
await page.getByTestId("demo-entry").waitFor();
try { await page.waitForLoadState("networkidle", { timeout: 8000 }); } catch {}
await page.waitForTimeout(1500);
for (let i = 0; i < 6 && !/\/home/.test(page.url()); i++) {
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await page.waitForURL(/\/home/, { timeout: 10000 }).catch(() => {});
}
if (!/\/home/.test(page.url())) throw new Error("demo sign-in did not reach /home");

const report = { pages: 0, live: 0, heightMismatch: [], none: [] };
for (const s of data.screens) {
  const m = s.key.match(/^\/train\/exercises\/([^/?]+)$/);
  if (!m) continue;
  await page.goto(`${BASE}${s.key}`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="exercise-demo"] canvas[data-motion-canvas]').first().waitFor({ timeout: 8000 }).catch(() => {});
  await settle();
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const list = await boxes();
  report.pages++;
  if (Math.abs(h - s.h) > 2) report.heightMismatch.push([s.key, s.h, h]);
  if (!list.length) { report.none.push(s.key); continue; }
  apply(s, list, m[1]);
  report.live += list.length;
}
log(`exercise pages ${report.pages}, live boxes ${report.live}, no box ${report.none.length}, height differs ${report.heightMismatch.length}`);

// The workout's demonstration dialog.
const dlg = data.screens.find((s) => s.key === "state:demo-dialog");
if (dlg) {
  await page.goto(`${BASE}/train`);
  const start = page.locator("main").getByRole("link", { name: /Start workout|Start today's workout|Resume workout/ }).first();
  await start.click();
  await page.waitForURL(/\/train\/workout/);
  await page.getByLabel(/set 1 weight in lb/).first().waitFor();
  await settle();
  await page.getByRole("button", { name: /Show the .* demonstration larger/ }).first().click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(1500);
  const list = await boxes("[role=dialog]");
  // The captured dialog belongs to the crawl's workout: name the exercise from that screen's own button, not from
  // whichever workout this pass happened to open (the dialog's layout is the same for any exercise).
  const started = data.screens.find((s) => s.key === "state:workout-started");
  const named = started?.hot.map((h) => (h.label.match(/^Show the (.+) demonstration larger$/) || [])[1]).find(Boolean);
  if (named) for (const x of list) x.name = named;
  if (list.length) { apply(dlg, list); log(`demonstration dialog: ${JSON.stringify(list)}`); } else log("demonstration dialog: no live box");
  await page.keyboard.press("Escape");
}
fs.writeFileSync(file, JSON.stringify(data));
fs.writeFileSync(path.join(cap, "live-report.json"), JSON.stringify(report, null, 1));
await b.close();
