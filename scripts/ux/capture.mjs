// Capture + measure every app route at iPhone 15 Pro size for the first-time-user audit.
//   node capture.mjs <outDir> [account: established|new|occasional]
// Hides the demo-only bar so measurements match what a production member sees.
import { chromium, devices } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3000", OUT = process.argv[2], ACCOUNT = process.argv[3] ?? "established";
fs.mkdirSync(`${OUT}/shots`, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const { defaultBrowserType: _d, ...iPhone } = devices["iPhone 15 Pro"];
const ctx = await b.newContext({ ...iPhone, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, timezoneId: "America/New_York", reducedMotion: "reduce" });
ctx.setDefaultTimeout(30000);
await ctx.addInitScript(() => { const st = document.createElement("style"); st.textContent = `[data-testid="demo-bar"]{display:none!important}`; (document.head || document.documentElement)?.append(st); });
const page = await ctx.newPage();
const errors = []; let cur = "";
page.on("pageerror", (e) => errors.push({ route: cur, kind: "pageerror", msg: e.message.slice(0, 200) }));
page.on("console", (m) => { if (m.type() === "error") errors.push({ route: cur, kind: "console", msg: m.text().slice(0, 200) }); });
page.on("response", (r) => { if (r.url().startsWith(BASE) && r.status() >= 400 && !/favicon/.test(r.url())) errors.push({ route: cur, kind: `http ${r.status()}`, msg: r.url().replace(BASE, "") }); });

await page.goto(BASE + "/"); await page.getByRole("button", { name: "Skip intro" }).click({ timeout: 6000 }).catch(() => {});
if (ACCOUNT === "new") {
  await page.goto(BASE + "/login"); await page.getByRole("button", { name: "Start as a new member" }).click(); await page.waitForURL(/onboarding|home/);
  // The quickest honest onboarding a new member could give.
  const cont = () => page.getByRole("button", { name: /^Continue/ }).click();
  await page.getByRole("button", { name: "Build muscle", exact: true }).click().catch(() => page.getByRole("button", { name: "Lose body fat", exact: true }).click()); await cont();
  await page.getByRole("button", { name: "Under 1 year", exact: true }).click(); await cont();
  await page.getByRole("button", { name: /^3\s*days$/ }).first().click(); await page.getByRole("button", { name: /^45\s*min$/ }).first().click(); await cont();
  await page.getByRole("button", { name: /^Full gym/ }).click(); await cont();
  await page.getByRole("button", { name: "Male", exact: true }).click().catch(() => {});
  await page.getByLabel("Age").fill("30"); await page.getByLabel("Height (ft)").fill("5"); await page.getByLabel("Height (in)").fill("10"); await page.getByLabel(/Current weight/).fill("180");
  await page.getByRole("button", { name: "Build my plan" }).click().catch(async () => { await cont(); await page.getByRole("button", { name: "Build my plan" }).click(); });
  await page.waitForURL(/\/(plan|home)/, { timeout: 60000 });
} else if (ACCOUNT === "occasional") {
  const env = Object.fromEntries(fs.readFileSync(new URL("./occasional.env", import.meta.url), "utf8").trim().split("\n").map((l) => l.split("=")));
  await page.goto(BASE + "/login"); await page.getByLabel("Email").fill(env.OCC_EMAIL); await page.getByLabel("Password", { exact: true }).fill(env.OCC_PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/ }).click(); await page.waitForURL(/\/home/, { timeout: 60000 });
} else { await page.getByRole("button", { name: "Explore with sample data" }).click(); await page.waitForURL(/\/home/); }

const measure = () => page.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0"; };
  const inMain = (el) => !el.closest('nav[data-hide-with-keyboard]');
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== "none") return null; const c = parse(cs.backgroundColor); if (c && c.a > 0.5) return c; } return { r: 10, g: 10, b: 10, a: 1 }; };
  let small = 0, tiny = 0, lowContrast = 0, words = 0; const smallSamples = [], lowSamples = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (!el || seen.has(el) || !vis(el) || !inMain(el)) continue; seen.add(el);
    if (el.closest("script,style,noscript,[aria-hidden=true]")) continue;
    words += t.split(/\s+/).length;
    const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
    if (fs < 12) { tiny++; if (smallSamples.length < 4) smallSamples.push(`${fs}px "${t.slice(0, 30)}"`); } else if (fs < 14) small++;
    const fg = parse(cs.color); const bg = fg && fg.a > 0.5 ? bgOf(el) : null; if (fg && bg) { const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); const large = fs >= 18.66 || (fs >= 14 && +cs.fontWeight >= 700); if (ratio < (large ? 3 : 4.5)) { lowContrast++; if (lowSamples.length < 4) lowSamples.push(`${ratio.toFixed(1)} "${t.slice(0, 30)}"`); } }
  }
  const ints = Array.from(document.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],summary")).filter((e) => vis(e) && inMain(e) && !e.closest('[data-testid="demo-bar"]') && e.getBoundingClientRect().width > 2);
  const smallTargets = ints.filter((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 44 && !(e.tagName === "A" && getComputedStyle(e).display === "inline"); });
  const cards = Array.from(document.querySelectorAll("main section, main [class*=card], main [class*='rounded-2xl'], main [class*='rounded-xl']")).filter((e) => vis(e) && e.getBoundingClientRect().height > 60).length;
  const fold = innerHeight - 84;
  const aboveFold = ints.filter((e) => { const r = e.getBoundingClientRect(); return r.top < fold && r.bottom > 0; }).map((e) => (e.getAttribute("aria-label") || e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40)).filter(Boolean);
  const h1 = document.querySelector("main h1")?.textContent?.trim() ?? "";
  const bodyText = document.body.innerText;
  return {
    h1, screens: +(document.documentElement.scrollHeight / innerHeight).toFixed(1), words, interactive: ints.length, cards,
    tinyText: tiny, smallText: small, smallSamples, lowContrast, lowSamples, smallTargets: smallTargets.length,
    smallTargetSamples: smallTargets.slice(0, 4).map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)} "${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 24)}"`; }),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, aboveFold: aboveFold.slice(0, 12),
    errorPage: /Application error|could not be found|took the wide road|Something went wrong/i.test(bodyText),
    empty: /No .* yet|Nothing here|Get started|empty/i.test(bodyText),
  };
});

const routes = JSON.parse(fs.readFileSync(new URL("./routes.json", import.meta.url)));
const results = [];
let i = 0;
for (const r of routes) {
  cur = r.path ?? r.from;
  let path = r.path;
  try {
    if (r.from) { await page.goto(BASE + r.from, { waitUntil: "domcontentloaded" }); await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {}); const a = page.locator(r.link).first(); path = (await a.count()) ? await a.getAttribute("href") : null; if (!path) { results.push({ id: r.id, path: r.from + " → " + r.link, missing: true }); continue; } }
    const t0 = Date.now();
    const resp = await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    const loadMs = Date.now() - t0;
    await page.addStyleTag({ content: `[data-testid="demo-bar"]{display:none!important}` }).catch(() => {});
    await page.waitForTimeout(400);
    const m = await measure();
    const id = `${String(++i).padStart(3, "0")}-${r.id}`;
    await page.screenshot({ path: `${OUT}/shots/${id}.png` });
    await page.screenshot({ path: `${OUT}/shots/${id}-full.jpg`, fullPage: true, type: "jpeg", quality: 60, scale: "css" }).catch(() => {});
    results.push({ id, area: r.area, path, status: resp?.status(), loadMs, ...m });
    console.log(`${id} ${path} ${m.screens}scr ${m.words}w ${m.interactive}i tiny=${m.tinyText} low=${m.lowContrast} tgt=${m.smallTargets}${m.errorPage ? " ERRORPAGE" : ""}`);
  } catch (e) { results.push({ id: r.id, path, failed: String(e).slice(0, 200) }); console.log(`FAILED ${r.id} ${String(e).slice(0, 120)}`); }
}
fs.writeFileSync(`${OUT}/metrics.json`, JSON.stringify({ account: ACCOUNT, results, errors }, null, 1));
await b.close();
