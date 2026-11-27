// Taps through the built iPhone demo at iPhone size: the live opening → welcome → sample data → tabs → the workout flow
// → the menu → the AI coach → the live exercise demonstrations → the new-member path; every screen's picture must exist;
// no page errors. Then, on every iPhone and Android viewport in Playwright's device list, that the demo fills the phone.   CHROMIUM=... node verify.mjs <out dir> <shots dir>
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
const out = process.argv[2], shots = process.argv[3];
fs.mkdirSync(shots, { recursive: true });
const MIME = { ".html": "text/html", ".webp": "image/webp", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  if (req.url === "/favicon.ico") { res.writeHead(204); return res.end(); } // the artifact host serves its own
  const p = path.join(out, decodeURIComponent(req.url.split("?")[0] === "/" ? "/app.html" : req.url.split("?")[0]));
  if (!p.startsWith(out) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  if (p.endsWith("app.html")) {
    // Served as the artifact wrapper serves it: doctype, charset and viewport, then the page.
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    // PUBLISHED=1: app.html is the page as downloaded from the published artifact (already wrapped), served as is.
    if (process.env.PUBLISHED === "1") return res.end(fs.readFileSync(p, "utf8"));
    return res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(p, "utf8") + "</body></html>");
  }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] ?? "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
const { defaultBrowserType: _d, ...iPhone } = devices["iPhone 15"];
const ctx = await b.newContext({ ...iPhone, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const errors = [], missing = [];
page.on("pageerror", (e) => errors.push(`page: ${e.message.split("\n")[0]}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)} @ ${m.location()?.url ?? "?"}`); });
page.on("response", (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });
page.on("requestfailed", (r) => missing.push(`failed ${r.url()} ${r.failure()?.errorText}`));
const results = [];
const check = (name, ok, note = "") => { results.push({ name, ok, note }); console.log(`${ok ? "ok " : "FAIL"} ${name} ${note}`); };
let n = 0;
const shot = async (name) => { n++; await page.screenshot({ path: path.join(shots, `${String(n).padStart(2, "0")}-${name}.png`) }); };
const cur = () => page.evaluate(() => ({ key: window.demo.screens.find((s) => document.querySelector("#title b")?.textContent === (s.title || s.key))?.key ?? null, title: document.querySelector("#title b")?.textContent, back: !document.getElementById("back").disabled, nav: !document.getElementById("navbar").hidden }));
const tapHot = async (re) => {
  const all = await page.locator("#col .hs").evaluateAll((els, re) => els.map((e, i) => ({ i, l: e.getAttribute("aria-label"), cls: e.className })).filter((x) => new RegExp(re, "i").test(x.l)), re);
  if (!all.length) { check(`tap target /${re}/ exists`, false); return null; }
  const el = page.locator("#col .hs").nth(all[0].i);
  await el.scrollIntoViewIfNeeded();
  await el.tap();
  await page.waitForTimeout(700);
  return all[0];
};
await page.goto(`http://localhost:${port}/app.html`);
await page.waitForFunction(() => window.demo);
await page.waitForTimeout(1200);
// The opening plays live (the app's own scene and CSS) over the welcome screen; Enter Narrow Gate goes in.
const opening = page.locator("#screen .ngo");
check("the opening plays first", (await opening.count()) === 1 && (await opening.isVisible()));
// The opening closes itself 5.6 s after it starts, and a picture of its animated scene can take seconds to draw
// without a GPU: read the verse and tap Enter first, and take the picture as it moves into the light.
check("its verse is Matthew 7:13–14 (BSB)", /Matthew 7:13–14 \(BSB\)/.test((await opening.locator("figcaption").textContent()) ?? ""));
await opening.getByRole("button", { name: "Enter Narrow Gate" }).tap();
await shot("opening-enter");
await opening.waitFor({ state: "detached", timeout: 6000 }).catch(() => {});
let c = await cur(); await shot("welcome");
check("Enter Narrow Gate → welcome", (await opening.count()) === 0 && c.title === "Welcome", c.title);
await tapHot("Explore with sample data");
c = await cur(); await shot("home");
check("welcome → Today (/home), tab bar shown", c.key === "/home" && c.nav, `${c.key} nav=${c.nav}`);
// Tab bar
for (const [label, key] of [["Train", "/train"], ["Nutrition", "/nutrition"], ["Faith", "/faith"], ["You", "/profile"], ["Home", "/home"]]) {
  await page.locator("#navhot .hs", { hasText: "" }).filter({ has: page.locator(`xpath=self::*[@aria-label='${label}']`) }).first().tap().catch(async () => page.locator(`#navhot .hs[aria-label="${label}"]`).tap());
  await page.waitForTimeout(600);
  c = await cur();
  check(`tab ${label} → ${key}`, c.key === key, c.key);
}
await shot("home-again");
// Back
await page.locator("#back").tap(); await page.waitForTimeout(500); c = await cur();
check("back returns to the previous screen", c.key === "/profile", c.key);
// Workout flow
await page.locator('#navhot .hs[aria-label="Train"]').tap(); await page.waitForTimeout(600);
await tapHot("Start workout|Start today|Resume workout");
c = await cur(); await shot("workout-started");
check("Train → workout started", c.title === "Workout started", c.title);
await tapHot("Show the .* demonstration larger");
c = await cur(); await shot("demo-dialog");
check("demonstration dialog", c.title === "Exercise demonstration", c.title);
await page.locator("#col .shot").tap({ position: { x: 10, y: 10 } }); await page.waitForTimeout(500); c = await cur();
check("tap outside the dialog closes it", c.title === "Workout started", c.title);
await tapHot("Mark .* set 1 complete");
c = await cur(); await shot("set-1");
check("set 1 logged", c.title.startsWith("Set 1 logged"), c.title);
await tapHot("Mark .* set 2 complete");
c = await cur();
check("set 2 logged", c.title === "Two sets logged", c.title);
await tapHot("^Options for");
c = await cur(); await shot("options");
check("exercise options", c.title === "Exercise options", c.title);
await tapHot("Substitute exercise");
c = await cur(); await shot("substitute");
check("substitute picker", c.title === "Substitute exercise", c.title);
const pick = await page.locator("#col .hs.link").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
await page.locator("#col .hs.link").first().tap(); await page.waitForTimeout(600); c = await cur();
check("substituted", c.title.startsWith("Substituted"), `${c.title} (first choice "${pick[0]}")`);
await tapHot("^Finish$");
c = await cur(); await shot("finish-confirm");
check("finish confirm", c.title === "Finish early?", c.title);
await tapHot("Finish & save");
c = await cur(); await shot("summary");
check("workout summary", c.title === "Workout complete", c.title);
// Menu
await page.locator("#menu").tap(); await page.waitForTimeout(400); await shot("menu");
const menuCount = await page.locator("#groups button").count();
check("menu lists every screen", menuCount === (await page.evaluate(() => window.demo.screens.length)), `${menuCount}`);
await page.locator("#groups button", { hasText: "AI Coach" }).first().tap().catch(() => {});
await page.locator("#close-sheet").tap().catch(() => {});
// Coach
await page.evaluate(() => window.demo.show(window.demo.resolve("/coach")));
await page.waitForTimeout(500);
await tapHot("Message the AI coach|Send message").catch(() => null);
c = await cur();
check("coach → typed question", c.title === "Question typed", c.title);
await tapHot("Send message").catch(() => null);
c = await cur(); await shot("coach-reply");
check("typed → the coach's reply", c.title.startsWith("The coach"), c.title);
// The exercise demonstrations play live: the app's engine draws, moves and carries the app's badge and label.
const frame = () => page.evaluate(() => Array.from(document.querySelectorAll("#col .live2d canvas")).map((cv) => {
  const d = cv.getContext("2d")?.getImageData(0, 0, cv.width, cv.height).data; if (!d) return null;
  let h = 0, lit = 0; for (let i = 0; i < d.length; i += 4 * 37) { h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1e9; if (d[i] + d[i + 1] + d[i + 2] > 90) lit++; }
  return { h, lit };
})[0]);
for (const key of ["/train/exercises/back-squat", "/train/exercises/kettlebell-swing", "state:demo-dialog", "state:demo-dialog-execution", "state:demo-dialog-mistakes"]) {
  await page.evaluate((k) => window.demo.show(window.demo.screens.find((s) => s.key === k)), key);
  await page.waitForTimeout(500);
  const box = page.locator("#col .live2d").first();
  if (!(await box.count())) { check(`${key}: live demonstration`, false); continue; }
  await box.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
  const a = await frame(); await page.waitForTimeout(700); const z = await frame();
  const label = await box.evaluate((el) => el.querySelector("[aria-label^='Animated demonstration of']")?.getAttribute("aria-label") ?? "");
  check(`${key}: live demonstration draws and moves`, !!a && a.lit > 20 && !!z && a.h !== z.h, `"${label.slice(0, 60)}"`);
  check(`${key}: badge and label as in the app`, /Animated demo/.test(await box.textContent()) && /^Animated demonstration of .+\. .+/.test(label));
}
await shot("live-demo-dialog");
// The demonstration dialog's Setup / Execution / Mistakes tabs lead to each other; Run log's Treadmill pill to its form.
await page.evaluate(() => window.demo.show(window.demo.screens.find((s) => s.key === "state:demo-dialog")));
await page.waitForTimeout(500);
for (const [tab, key] of [["Execution", "state:demo-dialog-execution"], ["Mistakes", "state:demo-dialog-mistakes"], ["Setup", "state:demo-dialog"]]) {
  await tapHot(`^${tab}$`);
  const c = await cur();
  check(`demonstration tab ${tab}`, c.key === key, c.title);
}
if (await page.evaluate(() => !!window.demo.screens.find((s) => s.key === "/run?tab=log"))) {
  await page.evaluate(() => window.demo.show(window.demo.screens.find((s) => s.key === "/run?tab=log")));
  await page.waitForTimeout(500);
  await tapHot("^Treadmill$");
  const c = await cur();
  check("Run log → Treadmill", c.key === "state:run-treadmill", c.title);
}
const ex = await page.evaluate(() => { const l = window.demo.screens.filter((s) => /^\/train\/exercises\/[^/?]+$/.test(s.key)); return [l.length, l.filter((s) => s.hot.some((h) => h.kind === "live")).length]; });
check("every captured exercise page has its live demonstration", ex[0] > 0 && ex[0] === ex[1], `${ex[1]}/${ex[0]}`);
// The new-member path (new-member.mjs): Welcome → the five questions → Ready → plan → first workout.
if (await page.evaluate(() => window.demo.screens.some((s) => s.key === "state:nm-goal"))) {
  await page.evaluate(() => window.demo.show(window.demo.screens.find((s) => s.key === "/")));
  await page.waitForTimeout(400);
  for (const [re, want] of [["Start as a new member", /Main goal$/], ["Lose body fat", /Main goal: /], ["^Continue", /Experience$/], ["Under 1 year", /Experience: /], ["^Continue", /Schedule$/], ["^4 days$", /Schedule: 4 days/],
    ["^Continue", /Equipment$/], ["Full gym", /Equipment: /], ["^Continue", /About you$/], ["^Male$", /About you: /], ["^Continue", /Ready to build your plan/], ["Build my plan", /Your plan/], ["Start my first workout|Start Today.s Workout", /First workout/]]) {
    const hit = await tapHot(re); c = await cur();
    if (!hit || !want.test(c.title ?? "")) { check(`new member: "${re}" → ${want}`, false, c.title); break; }
  }
  c = await cur(); await shot("new-member-first-workout");
  check("new member: questions → plan → first workout", /First workout/.test(c.title ?? ""), c.title);
} else check("new member path captured (run new-member.mjs)", false);
// Every picture exists and every tap target lies inside its screen.
const data = await page.evaluate(() => window.DEMO);
let bad = 0, outside = 0, resolvable = 0, dead = 0;
for (const s of data.screens) {
  for (const [f] of s.pics || [[s.id + ".webp"]]) if (!fs.existsSync(path.join(out, "s", f))) bad++;
  for (const h of s.hot) { if (h.x < 0 || h.y < 0 || h.x + h.w > (data.phone?.w ?? 390) + 2 || h.y + h.h > s.h + 2) outside++; if (h.to) { if (await page.evaluate((to) => !!window.demo.resolve(to), h.to)) resolvable++; else dead++; } }
}
check("every screen's picture exists", bad === 0, `${data.screens.length} screens`);
check("tap targets lie inside their screens", outside === 0, `${outside} outside`);
console.log(`targets: ${resolvable} lead to a captured screen, ${dead} to screens not captured`);
check("no page errors", errors.length === 0, errors.slice(0, 5).join(" | "));
check("no missing files requested", missing.length === 0, missing.slice(0, 5).join(" | "));
// Every iPhone and Android phone in Playwright's device list (portrait, one run per viewport and platform): the demo
// fills the phone's width (pictures and tab bar), nothing scrolls sideways, and the opening, the sign-in and a tab work.
const phones = new Map();
for (const [name, d] of Object.entries(devices)) {
  if (!/^(iPhone|Pixel|Galaxy)/.test(name) || /landscape|Tab\b|Flip \d Cover/i.test(name) || !d.isMobile) continue;
  const key = `${name.startsWith("iPhone") ? "ios" : "android"}-${d.viewport.width}x${d.viewport.height}`;
  if (!phones.has(key)) phones.set(key, { key, name, models: [] });
  phones.get(key).models.push(name);
}
const perPhone = [];
for (const ph of phones.values()) {
  const { defaultBrowserType: _t, ...dev } = devices[ph.name];
  const pctx = await b.newContext({ ...dev, deviceScaleFactor: 1 });
  const pp = await pctx.newPage();
  const errs = [];
  pp.on("pageerror", (e) => errs.push(e.message.split("\n")[0]));
  await pp.goto(`http://localhost:${port}/app.html`);
  await pp.waitForFunction(() => window.demo);
  const vw = dev.viewport.width;
  let ok = (await pp.locator("#screen .ngo").count()) === 1;
  await pp.locator("#screen .ngo").getByRole("button", { name: "Skip intro" }).tap().catch(() => { ok = false; });
  await pp.locator("#screen .ngo").waitFor({ state: "detached", timeout: 6000 }).catch(() => { ok = false; });
  const sample = (await pp.locator("#col .hs").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).findIndex((l) => /Explore with sample data/i.test(l ?? ""));
  if (sample >= 0) { await pp.locator("#col .hs").nth(sample).tap(); await pp.waitForTimeout(500); } else ok = false;
  const m = await pp.evaluate(() => ({
    col: document.getElementById("col").getBoundingClientRect().width,
    nav: document.getElementById("navbar").getBoundingClientRect().width,
    scroll: document.documentElement.scrollWidth, inner: window.innerWidth,
    title: window.demo.screens.find((s) => document.querySelector("#title b")?.textContent === (s.title || s.key))?.key ?? null,
  }));
  await pp.locator('#navhot .hs[aria-label="Train"]').tap().catch(() => { ok = false; });
  await pp.waitForTimeout(500);
  const after = await pp.evaluate(() => window.demo.screens.find((s) => document.querySelector("#title b")?.textContent === (s.title || s.key))?.key ?? null);
  const fills = vw <= 520 ? Math.abs(m.col - vw) <= 1 && Math.abs(m.nav - vw) <= 1 : true;
  const pass = ok && fills && m.scroll <= m.inner && m.title === "/home" && after === "/train" && errs.length === 0;
  perPhone.push({ ...ph, viewport: dev.viewport, col: m.col, nav: m.nav, scroll: m.scroll, home: m.title, afterTrainTab: after, errors: errs, pass });
  if (!pass) console.log(`  ${ph.models.join(", ")}: col ${m.col} nav ${m.nav} of ${vw}, scroll ${m.scroll}, ${m.title} → ${after} ${errs.join(" | ")}`);
  await pctx.close();
}
check("fills and works on every iPhone and Android viewport", perPhone.every((r) => r.pass), `${perPhone.filter((r) => r.pass).length}/${perPhone.length} viewports (${perPhone.reduce((n, r) => n + r.models.length, 0)} models)`);
fs.writeFileSync(path.join(shots, "results.json"), JSON.stringify({ results, errors, missing, resolvable, dead, screens: data.screens.length, taps: data.taps, phones: perPhone }, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} checks ok`);
await b.close(); srv.close();
