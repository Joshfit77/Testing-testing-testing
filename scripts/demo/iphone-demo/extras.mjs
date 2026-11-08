// Captures the screens the crawl cannot reach by following links: states inside a page that a button switches to.
// Today: the Run tab's manual log with "Treadmill" chosen (state:run-treadmill), wired to the Outdoors/Treadmill pills.
//   BASE=http://localhost:3000 node scripts/demo/iphone-demo/extras.mjs <cap dir>   (after crawl.mjs; reads and writes screens.json)
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const out = process.argv[2];
const file = path.join(out, "screens.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
data.screens = data.screens.filter((s) => s.key !== "state:run-treadmill");
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

async function settle(ms = 900) {
  await page.waitForLoadState("domcontentloaded");
  try { await page.waitForLoadState("networkidle", { timeout: 4000 }); } catch {}
  await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(ms);
}
const hotspots = () => page.evaluate(() => {
  const els = Array.from(document.querySelectorAll("a[href], button, [role=button], [role=tab], [role=menuitem], [role=radio], summary, input[type=submit], input:not([type=hidden]), label"));
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
async function capture(key, title, tab, group) {
  const sid = `s${String(++n).padStart(3, "0")}`;
  const f = `s/${sid}.png`;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(out, f), fullPage: true, timeout: 120000, animations: "disabled" });
  const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const hot = (await hotspots()).map(({ href, ...x }) => ({ ...x, to: href ? normalize(href) : null }));
  const rec = { id: sid, key, title, h, file: f, tab, group, hot };
  data.screens.push(rec);
  log(`${sid} ${key} (${h}px, ${hot.length} targets)`);
  return rec;
}

// The sample account, as the crawl signs in.
await page.goto(`${BASE}/`);
await page.getByRole("button", { name: "Skip intro" }).click({ timeout: 8000 }).catch(() => {});
await page.getByRole("button", { name: "Explore with sample data" }).click();
await page.waitForURL(/\/home/, { timeout: 60000 });

// Run → Log a run → Where: Treadmill.
await page.goto(`${BASE}/run?tab=log`);
await settle();
await page.getByText("Treadmill", { exact: true }).first().click();
await page.waitForTimeout(500);
const tread = await capture("state:run-treadmill", "Log a treadmill session", "/train", "Run");
const logScreen = data.screens.find((s) => s.key === "/run?tab=log");
if (logScreen) {
  const t = logScreen.hot.find((x) => x.label === "Treadmill");
  if (t) t.to = "state:run-treadmill";
  for (const hs of tread.hot) {
    if (hs.label === "Outdoors") hs.to = "/run?tab=log";
    else if (!hs.to) { const same = logScreen.hot.find((x) => x.label === hs.label && x.to); if (same) hs.to = same.to; }
  }
  log(`wired: Treadmill on /run?tab=log ${t ? "→ state:run-treadmill" : "NOT FOUND"}`);
} else log("no /run?tab=log screen in the capture: the treadmill state is reachable from the menu only");
fs.writeFileSync(file, JSON.stringify(data, null, 1));
await b.close();
