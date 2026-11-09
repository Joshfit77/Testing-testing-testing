// Performance check for the pages the first-time UX work changed, on the demo sample account (the largest history).
//   BASE=http://localhost:3000 [ROUTES=/home,/run] node scripts/ux/perf.mjs <out.json> [runs=3]
// Each page is loaded fresh `runs` times at iPhone 15 Pro size with the CPU slowed 4x (Chrome DevTools throttling, a
// rough stand-in for a mid-range phone, not a device measurement). Per page it records the median of: time to the
// load event and to network idle, DOM elements, JS heap after load, and main-thread long tasks (>50 ms) during load.
// Pages with an exercise animation also record 5 s of animation frames (median and worst frame gap, frames over 50 ms).
import { chromium, devices } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3000", OUT = process.argv[2], RUNS = Number(process.argv[3] ?? 3);
const ALL_ROUTES = [
  ["/home", false], ["/train/programs", false], ["/train/exercises", false], ["/train/exercises/back-squat", true],
  ["/train/history", false], ["/progress/overview", false], ["/progress/sleep", false], ["/progress/sleep/history", false],
  ["/run", false], ["/nutrition", false], ["/faith", false],
];
// ROUTES=/a,/b limits the run to those pages.
const ROUTES = process.env.ROUTES ? ALL_ROUTES.filter(([r]) => process.env.ROUTES.split(",").includes(r)) : ALL_ROUTES;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const { defaultBrowserType: _d, ...iPhone } = devices["iPhone 15 Pro"];
const ctx = await b.newContext({ ...iPhone, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, timezoneId: "America/New_York" });
await ctx.addInitScript(() => {
  window.__lt = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: "longtask", buffered: true }); } catch {}
  const st = document.createElement("style"); st.textContent = `[data-testid="demo-bar"]{display:none!important}`; (document.head || document.documentElement)?.append(st);
});
const page = await ctx.newPage();
await page.goto(BASE + "/"); await page.getByRole("button", { name: "Skip intro" }).click({ timeout: 6000 }).catch(() => {});
await page.getByRole("button", { name: "Explore with sample data" }).click(); await page.waitForURL(/\/home/);
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable");
const median = (xs) => { const s = [...xs].sort((a, c) => a - c); return s.length ? s[Math.floor(s.length / 2)] : null; };
const out = {};
for (const [route, animated] of ROUTES) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    await page.goto("about:blank");
    await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t0 = Date.now();
    await page.goto(BASE + route, { waitUntil: "load", timeout: 90000 });
    const load = Date.now() - t0;
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    const idle = Date.now() - t0;
    const m = await page.evaluate(() => ({ dom: document.getElementsByTagName("*").length, lt: window.__lt ?? [] }));
    const perf = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
    let frames = null;
    if (animated) {
      frames = await page.evaluate(() => new Promise((res) => {
        const ts = []; const end = performance.now() + 5000;
        const f = (t) => { ts.push(t); if (t < end) requestAnimationFrame(f); else { const g = ts.slice(1).map((v, k) => v - ts[k]).sort((a, c) => a - c); res({ count: ts.length, medianGapMs: g[Math.floor(g.length / 2)], worstGapMs: g[g.length - 1], over50: g.filter((v) => v > 50).length }); } };
        requestAnimationFrame(f);
      }));
    }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    runs.push({ load, idle, dom: m.dom, heapMB: +(perf.JSHeapUsedSize / 1048576).toFixed(1), longTasks: m.lt.length, longTaskMs: Math.round(m.lt.reduce((a, c) => a + c, 0)), frames });
  }
  const pick = (k) => median(runs.map((r) => r[k]));
  out[route] = { loadMs: pick("load"), idleMs: pick("idle"), dom: pick("dom"), heapMB: pick("heapMB"), longTasks: pick("longTasks"), longTaskMs: pick("longTaskMs"),
    ...(animated ? { frames: { medianGapMs: median(runs.map((r) => r.frames.medianGapMs)), worstGapMs: median(runs.map((r) => r.frames.worstGapMs)), over50: median(runs.map((r) => r.frames.over50)) } } : {}), runs };
  console.log(route, JSON.stringify({ ...out[route], runs: undefined }));
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
await b.close();
