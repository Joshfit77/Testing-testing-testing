// Taps through the built iPhone demo at iPhone size: the opening → welcome → sample data → tabs → the workout flow →
// the menu → the live 3D figure; every screen's picture must exist; no page errors. node verify.mjs <out dir> <shots dir>
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
const out = process.argv[2], shots = process.argv[3];
fs.mkdirSync(shots, { recursive: true });
const MIME = { ".html": "text/html", ".webp": "image/webp", ".png": "image/png", ".txt": "text/plain", ".json": "application/json", ".js": "text/javascript" };
const srv = http.createServer((req, res) => {
  const p = path.join(out, decodeURIComponent(req.url.split("?")[0] === "/" ? "/app.html" : req.url.split("?")[0]));
  if (!p.startsWith(out) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  if (p.endsWith("app.html")) {
    // Served as the artifact wrapper serves it: doctype, charset and viewport, then the page.
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(p, "utf8") + "</body></html>");
  }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] ?? "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
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
  const b = page.locator("#col .hs").filter({ has: page.locator(`xpath=self::*[matches(@aria-label, '${re}')]`) });
  const btn = page.locator("#col .hs").getByText("");
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
await shot("opening");
let c = await cur();
check("first screen is the opening", c.title === "Opening", c.title);
await tapHot("Enter|Skip");
c = await cur(); await shot("welcome");
check("opening → welcome", c.title === "Welcome", c.title);
await tapHot("Explore with sample data");
c = await cur(); await shot("home");
check("welcome → Today (/home), tab bar shown", c.key === "/home" && c.nav, `${c.key} nav=${c.nav}`);
// Tab bar
for (const [label, key] of [["Train", "/train"], ["Food", "/nutrition"], ["Faith", "/faith"], ["Run", "/run"], ["Home", "/home"]]) {
  await page.locator("#navhot .hs", { hasText: "" }).filter({ has: page.locator(`xpath=self::*[@aria-label='${label}']`) }).first().tap().catch(async () => page.locator(`#navhot .hs[aria-label="${label}"]`).tap());
  await page.waitForTimeout(600);
  c = await cur();
  check(`tab ${label} → ${key}`, c.key === key, c.key);
}
await shot("home-again");
// Back
await page.locator("#back").tap(); await page.waitForTimeout(500); c = await cur();
check("back returns to the previous screen", c.key === "/run", c.key);
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
check("finish confirm", c.title === "Finish the workout?", c.title);
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
// Live 3D
await page.evaluate(() => window.demo.show(window.demo.resolve("/train/3d")));
await page.waitForTimeout(800); await shot("train-3d-captured");
const live = page.locator("#col .hs.live");
check("the 3D showcase page has a live-3D target", (await live.count()) > 0);
await live.first().scrollIntoViewIfNeeded(); await live.first().tap();
const t0 = Date.now();
await page.waitForFunction(() => window.ready === true, null, { timeout: 300000 }).catch(() => null);
const ready = await page.evaluate(() => window.ready === true);
check("live 3D figure loads (software WebGL here)", ready, `${Date.now() - t0} ms`);
await page.locator("#play").tap(); await page.waitForTimeout(600); await shot("live-3d");
await page.locator("#tabs button", { hasText: "Sled Push" }).tap();
await page.waitForFunction(() => window.showcaseSlug === "sled-push" && window.ready === true, null, { timeout: 300000 }).catch(() => null);
await page.locator("#play").tap(); await page.waitForTimeout(600); await shot("live-3d-sled");
check("switch to another exercise in the live figure", (await page.evaluate(() => window.showcaseSlug)) === "sled-push");
await page.locator("#live-back").tap(); await page.waitForTimeout(400);
check("back from the live figure to the captured app", await page.evaluate(() => document.getElementById("live").hidden));
// Every picture exists and every tap target lies inside its screen.
const data = await page.evaluate(() => window.DEMO);
let bad = 0, outside = 0, resolvable = 0, dead = 0;
for (const s of data.screens) {
  for (const [f] of s.pics || [[s.id + ".webp"]]) if (!fs.existsSync(path.join(out, "s", f))) bad++;
  for (const h of s.hot) { if (h.x < 0 || h.y < 0 || h.x + h.w > 392 || h.y + h.h > s.h + 2) outside++; if (h.to) { if (await page.evaluate((to) => !!window.demo.resolve(to), h.to)) resolvable++; else dead++; } }
}
check("every screen's picture exists", bad === 0, `${data.screens.length} screens`);
check("tap targets lie inside their screens", outside === 0, `${outside} outside`);
console.log(`targets: ${resolvable} lead to a captured screen, ${dead} to screens not captured`);
check("no page errors", errors.length === 0, errors.slice(0, 5).join(" | "));
check("no missing files requested", missing.length === 0, missing.slice(0, 5).join(" | "));
fs.writeFileSync(path.join(shots, "results.json"), JSON.stringify({ results, errors, missing, resolvable, dead, screens: data.screens.length, taps: data.taps }, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} checks ok`);
await b.close(); srv.close();
