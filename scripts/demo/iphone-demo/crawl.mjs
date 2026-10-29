// Captures the real Narrow Gate Fitness app (demo mode, sample data) at iPhone size for the clickable iPhone demo:
// every screen as a full-page picture at 3x (1170 px wide) with the tappable links' boxes, the fixed tab bar on its
// own, and the scripted states of the workout flow and the AI coach. Output: <out>/s/*.png + <out>/screens.json.
//   BASE=http://localhost:3000 node crawl.mjs <out> [maxScreens]
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const out = process.argv[2] ?? "cap";
const MAX = Number(process.argv[3] ?? 240);
fs.mkdirSync(path.join(out, "s"), { recursive: true });
const log = (s) => console.log(`${new Date().toISOString().slice(11, 19)} ${s}`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const { defaultBrowserType: _d, ...iPhone } = devices["iPhone 15"];
const ctx = await b.newContext({ ...iPhone, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, timezoneId: "America/New_York", reducedMotion: "reduce" });
ctx.setDefaultTimeout(45000);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`page: ${e.message.split("\n")[0]}`));

// The fixed tab bar is captured once per tab and drawn by the viewer; the pages are captured without it.
const HIDE_NAV = `nav[data-hide-with-keyboard]{visibility:hidden!important} *{caret-color:transparent!important}`;
await ctx.addInitScript(() => {
  const st = document.createElement("style");
  st.id = "ng-cap";
  st.textContent = `nav[data-hide-with-keyboard]{visibility:hidden!important} *{caret-color:transparent!important} *,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}`;
  const root = document.head || document.documentElement;
  if (root) root.append(st);
});
const navHidden = (hidden) => page.evaluate((h) => document.querySelectorAll("nav[data-hide-with-keyboard]").forEach((n) => (n.style.visibility = h ? "hidden" : "")), hidden);

const screens = [];
const byKey = new Map();
let n = 0;
const id = () => `s${String(++n).padStart(3, "0")}`;

const INTERNAL = (href) => href.startsWith("/") && !href.startsWith("//");
const SKIP = [/^\/admin/, /^\/logout/, /^\/api\//, /^\/legal\/.*#/, /sign-?out/i, /^\/profile\/delete/, /^\/auth\//, /\.(pdf|png|jpg)$/];
const CAPS = [[/^\/train\/exercises\/[^/]+$/, 170], [/^\/train\/exercises\/[^/]+\/history/, 6], [/^\/calendar\?/, 6], [/^\/faith\/practices\?/, 6], [/^\/train\/workout\?/, 6], [/^\/nutrition\?date/, 4], [/^\/nutrition\/photo\?/, 3], [/^\/train\/programs\?category/, 13], [/^\/nutrition\/scanner\//, 10], [/^\/train\/programs\/[^/]+/, 12], [/^\/faith\/day/, 6], [/^\/train\/history\//, 6], [/^\/nutrition\/recipes\//, 8], [/^\/progress\/badges\//, 10], [/^\/supplements\//, 6], [/^\/nutrition\/foods?\//, 6]];
const counts = new Map();
const PRIORITY = ["/train/exercises/kettlebell-swing", "/train/exercises/dumbbell-curl", "/train/exercises/inverted-row", "/train/exercises/cable-chest-fly", "/train/exercises/sled-push", "/train/3d"];

function normalize(href) {
  try {
    const u = new URL(href, BASE);
    if (u.origin !== new URL(BASE).origin) return null;
    let k = u.pathname.replace(/\/+$/, "") || "/";
    if (u.search) k += u.search;
    return k;
  } catch { return null; }
}
const capKey = (r, k) => (r.source.includes("\\?") ? k : k.split("?")[0]);
function allowed(k) {
  const p = k.split("?")[0];
  if (SKIP.some((r) => r.test(p))) return false;
  for (const [r, cap] of CAPS) if (r.test(capKey(r, k))) { const c = counts.get(r) ?? 0; if (c >= cap && !PRIORITY.includes(p)) return false; }
  return true;
}
function count(k) { for (const [r] of CAPS) if (r.test(capKey(r, k))) counts.set(r, (counts.get(r) ?? 0) + 1); }
const FLOWS = process.env.FLOWS === "1";  // only the scripted flows, keeping the crawled screens
const CONTINUE = (process.env.CONTINUE === "1" || FLOWS) && fs.existsSync(path.join(out, "screens.json"));
let prior = null;
if (CONTINUE) {
  prior = JSON.parse(fs.readFileSync(path.join(out, "screens.json"), "utf8"));
  const NO_FLOWS = process.env.NO_FLOWS === "1";
  for (const sc of prior.screens) if (!sc.key.startsWith("state:") || sc.key === "state:opening" || NO_FLOWS) { screens.push(sc); byKey.set(sc.key, sc); n = Math.max(n, Number(sc.id.slice(1))); }
  for (const [a, k] of Object.entries(prior.alias)) if (byKey.has(k)) byKey.set(a, byKey.get(k));
  for (const sc of screens) count(sc.key);
  log(`continuing from ${screens.length} screens`);
}

async function settle(ms = 900) {
  await page.waitForLoadState("domcontentloaded");
  try { await page.waitForLoadState("networkidle", { timeout: 4000 }); } catch {}
  // Let lazy content below the fold render, then back to the top.
  await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** The tappable targets on the page as document-space boxes (CSS px at 390 wide). */
async function hotspots(scope) {
  return page.evaluate(({ scope }) => {
    const root = scope ? (Array.from(document.querySelectorAll(scope)).pop() || document) : document;
    const els = Array.from(root.querySelectorAll("a[href], button, [role=button], [role=tab], [role=menuitem], summary, input[type=submit], label"));
    const res = [];
    const seen = new Set();
    for (const el of els) {
      if (el.closest("nav[data-hide-with-keyboard]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
      const href = el.getAttribute("href");
      const label = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
      const key = `${Math.round(r.left)},${Math.round(r.top + scrollY)},${Math.round(r.width)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      res.push({ x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), label, href: href ?? null, kind: el.tagName.toLowerCase(), testid: el.getAttribute("data-testid"), pressed: el.getAttribute("aria-pressed") });
    }
    return res;
  }, { scope });
}

async function capture(key, { title, full = true, group, tab, extraHot = [], scope } = {}) {
  if (!full && !scope) scope = "[role=dialog], [role=menu], [role=alertdialog]";
  const sid = id();
  const file = `s/${sid}.png`;
  if (full) await page.evaluate(() => window.scrollTo(0, 0));
  await navHidden(true);
  await page.screenshot({ path: path.join(out, file), fullPage: full, timeout: 120000, animations: "disabled" });
  const h = full ? await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)) : 844;
  const t = title ?? (await page.title()).replace(/ [·|–-] Narrow Gate.*$/, "");
  const hot = (await hotspots(scope)).map((x) => ({ ...x, to: x.href ? normalize(x.href) : null }));
  const rec = { id: sid, key, title: t, h, file, tab: tab ?? tabOf(key), group, hot: [...extraHot, ...hot] };
  screens.push(rec);
  byKey.set(key, rec);
  log(`${sid} ${key} (${h}px, ${hot.length} targets)`);
  return rec;
}
const tabOf = (k) => (k.startsWith("/home") ? "/home" : k.startsWith("/train") ? "/train" : k.startsWith("/run") ? "/run" : k.startsWith("/nutrition") ? "/nutrition" : k.startsWith("/faith") ? "/faith" : k.startsWith("/coach") || k.startsWith("/progress") || k.startsWith("/profile") || k.startsWith("/calendar") ? "none" : "hidden");

// ---- 1. Opening and welcome -------------------------------------------------------------------------------------
await page.goto(`${BASE}/`);
const opening = page.getByRole("dialog", { name: "Narrow Gate Fitness opening" });
let openingRec = null;
try {
  await opening.waitFor({ timeout: 8000 });
  await page.waitForTimeout(2500);
  if (!CONTINUE) openingRec = await capture("state:opening", { title: "Opening", full: false, group: "Welcome", tab: "hidden" });
  const enter = opening.getByRole("button", { name: /Enter the narrow gate|Enter Narrow Gate|Enter|Skip intro/i }).first();
  await enter.click({ timeout: 8000 }).catch(() => opening.getByRole("button", { name: "Skip intro" }).click({ timeout: 8000 }));
} catch (e) { log(`opening: ${String(e.message).split("\n")[0].slice(0, 100)}`); }
await opening.waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
if (CONTINUE) {
  await page.getByTestId("demo-entry").waitFor();
  try { await page.waitForLoadState("networkidle", { timeout: 8000 }); } catch {}
  await page.waitForTimeout(1500);
  // The button is wired once the page has hydrated: click until the app answers.
  for (let i = 0; i < 6 && !/\/home/.test(page.url()); i++) {
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    await page.waitForURL(/\/home/, { timeout: 10000 }).catch(() => {});
  }
  if (!/\/home/.test(page.url())) throw new Error("demo sign-in did not reach /home");
  await page.getByTestId("demo-bar").waitFor();
}
if (!CONTINUE) {
await page.getByTestId("demo-entry").waitFor();
await settle();
const welcome = await capture("/", { title: "Welcome", group: "Welcome", tab: "hidden" });
if (openingRec) for (const hs of openingRec.hot) hs.to = "/";
// Explore with sample data → /home (the demo sign-in).
const explore = welcome.hot.find((x) => /Explore with sample data/i.test(x.label));
await page.getByRole("button", { name: "Explore with sample data" }).click();
await page.waitForURL(/\/home/);
await page.getByTestId("demo-bar").waitFor();
if (explore) explore.to = "/home";
}

// ---- 2. The tab bar, once per tab (and once with no tab active) ----------------------------------------------------
const nav = page.locator("nav[data-hide-with-keyboard]");
const navBox = await nav.boundingBox();
async function navShot(name) {
  await opening.waitFor({ state: "hidden", timeout: 40000 }).catch(() => log("opening still showing at the tab-bar shot"));
  await navHidden(false);
  await page.waitForTimeout(150);
  const box = await nav.boundingBox();
  await page.screenshot({ path: path.join(out, `s/nav-${name}.png`), clip: { x: 0, y: box.y, width: 390, height: box.height }, timeout: 60000 });
  await navHidden(true);
  return box.height;
}
const TABS = [["/home", "home"], ["/train", "train"], ["/run", "run"], ["/nutrition", "nutrition"], ["/faith", "faith"], ["/coach", "none"]];
let navH = navBox?.height ?? 64;
if (!FLOWS) for (const [href, name] of TABS) { await page.goto(`${BASE}${href}`); await page.locator("main").waitFor(); await page.waitForTimeout(600); navH = await navShot(name); }
const navHot = await page.evaluate(() => Array.from(document.querySelectorAll("nav[data-hide-with-keyboard] a")).map((a) => { const r = a.getBoundingClientRect(); return { x: Math.round(r.left), w: Math.round(r.width), label: a.textContent.trim(), to: new URL(a.href).pathname }; }));
log(`tab bar ${navH}px: ${navHot.map((x) => x.label).join(", ")}`);

// ---- 3. Breadth-first over the app's own links -------------------------------------------------------------------
const queue = ["/home", "/train", "/run", "/nutrition", "/faith", "/coach", "/progress", "/profile", "/train/3d", "/train/exercises", ...PRIORITY];
const queued = new Set(queue);
if (CONTINUE) for (const sc of screens) for (const hs of sc.hot) { const t = hs.to && !hs.to.startsWith("state:") && !hs.to.startsWith("live3d:") ? hs.to.split("#")[0] : null; if (t && !byKey.has(t) && !queued.has(t) && INTERNAL(t)) { queued.add(t); queue.push(t); } }
while (!FLOWS && queue.length && screens.length < MAX) {
  const k = queue.shift();
  if (byKey.has(k) || !allowed(k)) continue;
  try {
    const resp = await page.goto(`${BASE}${k}`, { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) { log(`skip ${k}: ${resp?.status()}`); continue; }
    const landed = normalize(page.url());
    if (landed !== k && byKey.has(landed)) { byKey.set(k, byKey.get(landed)); continue; }
    await page.locator("main, [role=main], body").first().waitFor();
    if (/^\/train\/3d|^\/train\/exercises\/(kettlebell-swing|dumbbell-curl|inverted-row|cable-chest-fly|sled-push)$/.test(k)) {
      // The 3D player: wait for the figure, pause it, so the picture shows the real player at rest.
      try { await page.waitForFunction(() => document.querySelector('[data-testid="exercise-demo-3d"]')?.getAttribute("data-phase") === "ready", null, { timeout: 240000 }); } catch { log(`3D not ready on ${k}`); }
      const pause = page.getByRole("button", { name: "Pause", exact: true }).first();
      if (await pause.count()) { await pause.dispatchEvent("click"); await page.waitForTimeout(500); }
    }
    await settle();
    const rec = await capture(landed ?? k);
    if (landed && landed !== k) byKey.set(k, rec);
    count(landed ?? k);
    // The 3D player's box: a live-3D target for the viewer.
    const demo3d = page.locator('[data-testid="exercise-demo-3d"]');
    const box3d = (await demo3d.count()) ? await demo3d.first().boundingBox().catch(() => null) : null;
    if (box3d) {
      const slug = (await page.evaluate(() => window.location.pathname.split("/").pop())) === "3d" ? "kettlebell-swing" : k.split("/").pop();
      rec.hot.unshift({ x: Math.round(box3d.x), y: Math.round(box3d.y + (await page.evaluate(() => scrollY))), w: Math.round(box3d.width), h: Math.round(box3d.height), label: "Open the 3D figure", to: `live3d:${slug}`, kind: "live" });
      const TAB3D = { "Kettlebell Swing": "kettlebell-swing", "Dumbbell Biceps Curl": "dumbbell-curl", "Dumbbell Curl": "dumbbell-curl", "Inverted Row": "inverted-row", "Cable Chest Fly": "cable-chest-fly", "Sled Push": "sled-push" };
      if (k === "/train/3d") for (const hs of rec.hot) if (hs.kind === "button" && TAB3D[hs.label]) hs.to = `live3d:${TAB3D[hs.label]}`;
    }
    for (const hs of rec.hot) {
      if (!hs.to) continue;
      const p = hs.to.split("#")[0];
      hs.to = p;
      if (!queued.has(p) && allowed(p) && INTERNAL(p)) { queued.add(p); queue.push(p); }
    }
  } catch (e) {
    log(`FAILED ${k}: ${String(e.message).split("\n")[0].slice(0, 160)}`);
  }
}
log(`crawl: ${screens.length} screens, ${queue.length} left in the queue`);

// ---- 4. Scripted states: the workout flow and the AI coach --------------------------------------------------------
const SKIP_FLOWS = process.env.NO_FLOWS === "1";
async function state(key, title, opts = {}) { const r = await capture(key, { title, group: opts.group ?? "Workout", tab: opts.tab ?? "/train", full: opts.full ?? true, extraHot: opts.extraHot ?? [] }); if (opts.closeTo) r.closeTo = opts.closeTo; return r; }
const link = (rec, test, to) => { const hs = rec.hot.find((x) => test.test(x.label)); if (hs) hs.to = to; else log(`  no target "${test}" on ${rec.key}`); };
if (!SKIP_FLOWS) try {
  await page.goto(`${BASE}/train`);
  const start = page.locator("main").getByRole("link", { name: /Start workout|Start today's workout|Resume workout/ }).first();
  await start.waitFor();
  const startHref = normalize(await start.getAttribute("href"));
  await start.click();
  await page.waitForURL(/\/train\/workout/);
  await page.getByLabel(/set 1 weight in lb/).first().waitFor();
  await settle();
  const started = await state("state:workout-started", "Workout started");
  if (byKey.has("/train")) link(byKey.get("/train"), /Start workout|Start today's workout|Resume workout/, "state:workout-started");
  if (startHref) byKey.set(startHref, started);
  // The demonstration dialog (the illustration for this exercise).
  const larger = page.getByRole("button", { name: /Show the .* demonstration larger/ }).first();
  await larger.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await page.waitForTimeout(1500);
  const demoDlg = await state("state:demo-dialog", "Exercise demonstration", { full: false, closeTo: "state:workout-started" });
  for (const hs of demoDlg.hot) if (/close|done|back/i.test(hs.label)) hs.to = "state:workout-started";
  link(started, /Show the .* demonstration larger/, "state:demo-dialog");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  // Log two sets.
  await page.getByLabel(/set 1 weight in lb/).first().fill("135");
  await page.getByLabel(/set 1 reps/).first().fill("8");
  await page.getByRole("button", { name: /Mark .* set 1 complete/ }).first().click();
  await page.waitForTimeout(800);
  const set1 = await state("state:set-1-logged", "Set 1 logged, rest timer running");
  link(started, /Mark .* set 1 complete/, "state:set-1-logged");
  for (const hs of started.hot) if (hs.kind === "input" || /weight|reps/i.test(hs.label)) hs.to = "state:set-1-logged";
  const w2 = page.getByLabel(/set 2 weight in lb/).first();
  if (await w2.count()) { await w2.fill("145"); await page.getByLabel(/set 2 reps/).first().fill("6"); await page.getByRole("button", { name: /Mark .* set 2 complete/ }).first().click(); await page.waitForTimeout(800); }
  const set2 = await state("state:set-2-logged", "Two sets logged");
  link(set1, /Mark .* set 2 complete/, "state:set-2-logged");
  // Substitute the second exercise.
  await page.getByRole("button", { name: /^Options for / }).nth(1).click();
  await page.waitForTimeout(400);
  const menu = await state("state:exercise-options", "Exercise options", { full: false, closeTo: "state:set-2-logged" });
  link(set2, /^Options for /, "state:exercise-options");
  await page.getByRole("menuitem", { name: "Substitute exercise" }).click();
  const picker = page.getByRole("dialog", { name: "Substitute exercise" });
  await picker.waitFor();
  await page.waitForTimeout(600);
  const pick = await state("state:substitute-picker", "Substitute exercise", { full: false, closeTo: "state:set-2-logged" });
  link(menu, /Substitute exercise/, "state:substitute-picker");
  const choice = picker.getByRole("button").filter({ hasText: /Row|Press|Pulldown|Curl/ }).filter({ hasNotText: /Search|Close|Cancel/ }).first();
  const chosenLabel = (await choice.textContent())?.trim().split("\n")[0];
  await choice.click({ timeout: 10000 }).catch(() => choice.dispatchEvent("click"));
  await picker.waitFor({ state: "hidden" });
  await page.getByText(/Substituted for/).first().waitFor();
  await page.waitForTimeout(600);
  const subd = await state("state:substituted", `Substituted: ${chosenLabel}`);
  for (const hs of pick.hot) if (hs.kind === "button" && !/Search|Close|Cancel/.test(hs.label)) hs.to = "state:substituted"; else if (/Close|Cancel/.test(hs.label)) hs.to = "state:set-2-logged";
  // Finish.
  await page.getByRole("button", { name: "Finish" }).click();
  await page.waitForTimeout(500);
  const confirm = await state("state:finish-confirm", "Finish the workout?", { full: false, closeTo: "state:substituted" });
  for (const hs of confirm.hot) if (/cancel|keep|continue|back/i.test(hs.label) && !/Finish/.test(hs.label)) hs.to = "state:substituted";
  link(subd, /^Finish$/, "state:finish-confirm");
  link(set2, /^Finish$/, "state:finish-confirm");
  link(set1, /^Finish$/, "state:finish-confirm");
  await page.getByRole("button", { name: "Finish & save" }).click();
  await page.getByRole("heading", { name: "Workout complete" }).waitFor();
  await settle(1500);
  const summary = await state("state:workout-summary", "Workout complete");
  link(confirm, /Finish & save/, "state:workout-summary");
  for (const hs of summary.hot) if (hs.to && !byKey.has(hs.to) && allowed(hs.to) && screens.length < MAX + 20) { try { await page.goto(`${BASE}${hs.to}`); await page.locator("main").waitFor(); await settle(); await capture(hs.to); } catch {} }
  await page.goto(`${BASE}/train/workout`).catch(() => {});
} catch (e) { log(`workout flow FAILED: ${String(e.message).split("\n")[0].slice(0, 200)}`); errors.push(`workout: ${e.message.split("\n")[0]}`); }

if (!SKIP_FLOWS) try {
  await page.goto(`${BASE}/coach`);
  await page.getByTestId("demo-ai-simulated").waitFor();
  const coach = byKey.get("/coach");
  const box = page.getByLabel("Message the AI coach");
  await box.scrollIntoViewIfNeeded();
  for (let i = 0; i < 20; i++) { await box.fill("Review my training this week"); await page.waitForTimeout(500); if ((await box.inputValue()) === "Review my training this week" && (await page.getByRole("button", { name: "Send message" }).isEnabled())) break; }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const typed = await state("state:coach-typed", "Question typed", { group: "AI Coach", tab: "none" });
  if (coach) for (const hs of coach.hot) if (/Message the AI coach|textarea/i.test(hs.label) || hs.kind === "textarea") hs.to = "state:coach-typed";
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByTestId("coach-reply").last().waitFor({ timeout: 30000 });
  await settle(1200);
  const reply = await state("state:coach-reply", "The coach's reply (simulated in the demo)", { group: "AI Coach", tab: "none" });
  link(typed, /Send message/, "state:coach-reply");
  if (coach) link(coach, /Send message/, "state:coach-typed");
} catch (e) { log(`coach flow FAILED: ${String(e.message).split("\n")[0].slice(0, 200)}`); errors.push(`coach: ${e.message.split("\n")[0]}`); }

// Any label-less textarea/input targets: send them to the same screen (a tap just focuses them in the real app).
const alias = {};
for (const [k, rec] of byKey) if (rec.key !== k) alias[k] = rec.key;
fs.writeFileSync(path.join(out, "screens.json"), JSON.stringify({ base: BASE, date: new Date().toISOString(), navH, navHot, screens, alias, errors }, null, 1));
log(`done: ${screens.length} screens; errors ${errors.length}`);
await b.close();
