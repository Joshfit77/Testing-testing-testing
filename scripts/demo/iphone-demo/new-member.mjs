// Captures the new-member path of the demo (fresh account → essentials-first onboarding → plan → the member's app) at
// iPhone size, appended to <cap>/screens.json with the same keys and wiring as the earlier capture (state:nm-*).
//   BASE=http://localhost:3000 node scripts/demo/iphone-demo/new-member.mjs <cap dir>   (after crawl.mjs; makes a new
//   demo account in the LOCAL demo database each run)
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const out = process.argv[2];
const data = JSON.parse(fs.readFileSync(path.join(out, "screens.json"), "utf8"));
data.screens = data.screens.filter((s) => !s.key.startsWith("state:nm"));
let n = Math.max(...data.screens.map((s) => Number(s.id.slice(1))));
const log = (s) => console.log(`${new Date().toISOString().slice(11, 19)} ${s}`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
const { defaultBrowserType: _d, ...iPhone } = devices["iPhone 15 Pro"];
const ctx = await b.newContext({ ...iPhone, viewport: { width: Number(process.env.PHONE_W ?? 393), height: Number(process.env.PHONE_H ?? 852) }, deviceScaleFactor: 3, timezoneId: "America/New_York", reducedMotion: "reduce" });
ctx.setDefaultTimeout(45000);
await ctx.addInitScript(() => {
  const st = document.createElement("style");
  st.textContent = `nav[data-hide-with-keyboard]{visibility:hidden!important} *{caret-color:transparent!important} *,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}`;
  (document.head || document.documentElement)?.append(st);
});
const page = await ctx.newPage();
const normalize = (href) => { try { const u = new URL(href, BASE); return u.origin === new URL(BASE).origin ? u.pathname + u.search : null; } catch { return null; } };
const tabOf = (k) => (k.startsWith("/home") ? "/home" : k.startsWith("/train") ? "/train" : k.startsWith("/run") ? "/run" : k.startsWith("/nutrition") ? "/nutrition" : k.startsWith("/faith") ? "/faith" : k.startsWith("/coach") || k.startsWith("/progress") || k.startsWith("/profile") || k.startsWith("/calendar") ? "none" : "hidden");

async function settle(ms = 900) {
  await page.waitForLoadState("domcontentloaded");
  try { await page.waitForLoadState("networkidle", { timeout: 4000 }); } catch {}
  await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(ms);
}
async function hotspots() {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("a[href], button, [role=button], [role=tab], [role=menuitem], summary, input[type=submit], input:not([type=hidden]), label"));
    const res = [], seen = new Set();
    for (const el of els) {
      if (el.closest("nav[data-hide-with-keyboard]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
      const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 60);
      const key = `${Math.round(r.left)},${Math.round(r.top + scrollY)},${Math.round(r.width)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      res.push({ x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), label, href: el.getAttribute("href"), kind: el.tagName.toLowerCase() });
    }
    return res;
  });
}
const recs = new Map();
async function capture(key, title, tab = "hidden") {
  const sid = `s${String(++n).padStart(3, "0")}`;
  const file = `s/${sid}.png`;
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll("nav[data-hide-with-keyboard]").forEach((n) => (n.style.visibility = "hidden")); });
  await page.screenshot({ path: path.join(out, file), fullPage: true, timeout: 120000, animations: "disabled" });
  const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const hot = (await hotspots()).map(({ href, ...x }) => ({ ...x, to: href ? normalize(href) : null }));
  const rec = { id: sid, key, title, h, file, tab, group: "New member", hot };
  data.screens.push(rec);
  recs.set(key, rec);
  log(`${sid} ${key} (${h}px, ${hot.length} targets)`);
  return rec;
}
const cont = () => page.getByRole("button", { name: /^Continue/ }).click();

// A fresh demo account, straight into onboarding.
await page.goto(`${BASE}/`);
const skip = page.getByRole("button", { name: "Skip intro" });
await skip.click({ timeout: 8000 }).catch(() => {});
await page.getByRole("button", { name: "Start as a new member" }).click();
await page.waitForURL(/\/onboarding/, { timeout: 60000 });
await settle();

// The five essential questions: each captured as asked and as answered.
const steps = [
  { id: "goal", title: "Main goal", answer: "Lose body fat", act: () => page.getByRole("button", { name: "Lose body fat", exact: true }).click() },
  { id: "experience", title: "Experience", answer: "Under 1 year", act: () => page.getByRole("button", { name: "Under 1 year", exact: true }).click() },
  { id: "schedule", title: "Schedule", answer: "4 days × 45 min", act: async () => { await page.getByRole("button", { name: /^4\s*days$/ }).first().click(); await page.getByRole("button", { name: /^45\s*min$/ }).first().click(); } },
  { id: "equipment", title: "Equipment", answer: "Full gym", act: () => page.getByRole("button", { name: /^Full gym/ }).click() },
  {
    id: "body", title: "About you", answer: "Male, 34, 5 ft 10 in, 185 lb",
    act: async () => {
      await page.getByRole("button", { name: "Male", exact: true }).click();
      await page.getByLabel("Age").fill("34");
      await page.getByLabel("Height (ft)").fill("5");
      await page.getByLabel("Height (in)").fill("10");
      await page.getByLabel(/Current weight/).fill("185");
    },
  },
];
for (const s of steps) {
  await capture(`state:nm-${s.id}`, `New member · ${s.title}`);
  await s.act();
  await page.waitForTimeout(400);
  await capture(`state:nm-${s.id}-a`, `New member · ${s.title}: ${s.answer}`);
  await cont();
  await page.waitForTimeout(600);
}
// Ready: build the plan, or personalise more (the first optional question, captured to show it).
await settle(500);
await capture("state:nm-finish", "New member · Ready to build your plan");
await page.getByRole("button", { name: /Personalise more/ }).click();
await page.waitForTimeout(600);
await capture("state:nm-second", "New member · Optional: second goal");
await page.getByRole("button", { name: /^Back/ }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Build my plan" }).click();
await page.waitForURL(/\/plan/, { timeout: 90000 });
await settle();
await capture("state:nm-plan", "New member · Your plan");
// The first workout screen for a brand-new member (looked at, not started).
const first = page.getByRole("link", { name: /Start my first workout|Start Today.s Workout/i }).first();
if (await first.count()) {
  await first.click();
  await page.waitForURL(/\/train\/workout/);
  await settle();
  await capture("state:nm-workout", "New member · First workout");
  await page.goBack();
  await page.waitForURL(/\/plan/).catch(() => {});
}
// The member's own app.
for (const p of ["/home", "/train", "/run", "/nutrition", "/faith", "/coach", "/progress", "/profile"]) {
  await page.goto(`${BASE}${p}`);
  await page.locator("main").first().waitFor();
  await settle();
  const t = (await page.title()).replace(/ [·|–-] Narrow Gate.*$/, "");
  await capture(`state:nm${p}`, `New member · ${t}`, tabOf(p));
}

// Wiring: answers lead to the answered state, Continue to the next question, Back to the previous answer.
const order = steps.map((s) => s.id);
for (const [i, id] of order.entries()) {
  const asked = recs.get(`state:nm-${id}`), done = recs.get(`state:nm-${id}-a`);
  const prev = i ? `state:nm-${order[i - 1]}-a` : null;
  const next = i + 1 < order.length ? `state:nm-${order[i + 1]}` : "state:nm-finish";
  for (const h of asked.hot) h.to = /^Back/.test(h.label) ? prev : `state:nm-${id}-a`;
  for (const h of done.hot) h.to = /^Back/.test(h.label) ? prev : /^Continue/.test(h.label) ? next : `state:nm-${id}-a`;
}
for (const h of recs.get("state:nm-finish").hot) h.to = /Build my plan/.test(h.label) ? "state:nm-plan" : /Personalise more/.test(h.label) ? "state:nm-second" : /^Back/.test(h.label) ? "state:nm-body-a" : "state:nm-finish";
for (const h of recs.get("state:nm-second").hot) h.to = /^Back/.test(h.label) ? "state:nm-finish" : null;
const toNm = (to) => (to && recs.has(`state:nm${to.split("?")[0]}`) ? `state:nm${to.split("?")[0]}` : to);
for (const [key, rec] of recs) {
  if (!key.startsWith("state:nm/") && key !== "state:nm-plan" && key !== "state:nm-workout") continue;
  for (const h of rec.hot) {
    if (/Go to Home/.test(h.label)) h.to = "state:nm/home";
    else if (/Start my first workout|^Start workout|Start Today's Workout/.test(h.label) && recs.has("state:nm-workout")) h.to = "state:nm-workout";
    else h.to = toNm(h.to);
  }
}
if (recs.has("state:nm-workout")) for (const h of recs.get("state:nm-workout").hot) h.to = null;
// The welcome screen's "Start as a new member" opens the path.
for (const s of data.screens) for (const h of s.hot) if (/Start as a new member/.test(h.label)) h.to = "state:nm-goal";
fs.writeFileSync(path.join(out, "screens.json"), JSON.stringify(data));
log(`new-member path: ${recs.size} screens`);
await b.close();
