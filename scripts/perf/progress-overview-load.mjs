// /progress/overview, old build (:3001) vs new build (:3000), same account and data, alternating runs.
// Measures, per load with 4x CPU throttling: JS downloaded before load, DOMContentLoaded, load, when the page became
// interactive (the first chart's table toggle hydrated), long-task time, when the first chart was drawn, and how long
// "Show as table" takes to respond after a tap.
// usage (from the repo root, old build on :3001, new on :3000, local Supabase running): node scripts/perf/progress-overview-load.mjs <runs>
// Results: docs/performance/measurements/progress-overview-load.json
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const RUNS = Number(process.argv[2] ?? 5);
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rest = async (path, body, method = "POST") => {
  const r = await fetch(`${SB}/rest/v1/${path}`, { method, headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
};

// A member with 3 weeks of data.
const email = `perf-${Date.now()}@example.com`;
const password = `Perf-${crypto.randomUUID()}`; // a throwaway account on the local stack, new each run
const u = await (await fetch(`${SB}/auth/v1/admin/users`, { method: "POST", headers: H, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: "Perf Member" } }) })).json();
const id = u.id;
await rest(`profiles?id=eq.${id}`, { onboarding_completed_at: new Date().toISOString(), display_name: "Perf Member", unit_system: "imperial", timezone: "UTC" }, "PATCH");
await rest("user_entitlements?on_conflict=user_id", { user_id: id, plan: "pro", source: "admin" }).catch(async () => rest(`user_entitlements?user_id=eq.${id}`, { plan: "pro", source: "admin" }, "PATCH"));
const day = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
await rest("weight_entries", Array.from({ length: 21 }, (_, i) => ({ user_id: id, recorded_on: day(i), weight_kg: 84 - i * 0.1 })));
await rest("daily_steps", Array.from({ length: 21 }, (_, i) => ({ user_id: id, day: day(i), steps: 6000 + ((i * 937) % 5000), source: "manual" })));
const [squat] = await (await fetch(`${SB}/rest/v1/exercises?slug=eq.back-squat&select=id`, { headers: H })).json();
for (let w = 0; w < 6; w++) {
  const started = new Date(Date.now() - (w * 3 + 1) * 86_400_000).toISOString();
  const [s] = await rest("workout_sessions", { user_id: id, client_id: crypto.randomUUID(), name: "Lower", status: "completed", started_at: started, ended_at: new Date(Date.parse(started) + 3_600_000).toISOString(), total_volume_kg: 3000 + w * 100 });
  const [e] = await rest("workout_exercises", { session_id: s.id, user_id: id, exercise_id: squat.id, position: 0 });
  await rest("workout_sets", [1, 2, 3].map((n) => ({ workout_exercise_id: e.id, user_id: id, set_number: n, reps: 5, weight_kg: 100 - w * 2, completed: true })));
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const login = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
const lp = await login.newPage();
await lp.goto("http://localhost:3000/login");
await lp.getByLabel("Email").fill(email);
await lp.getByLabel("Password", { exact: true }).fill(password);
await lp.getByRole("button", { name: /^Sign in/ }).click();
await lp.waitForURL(/\/home/, { timeout: 60_000 });
const state = await login.storageState();
await login.close();

const INIT = () => {
  window.__perf = { longTasks: 0, chartAt: null, hydratedAt: null };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__perf.longTasks += Math.max(0, e.duration - 50);
  }).observe({ type: "longtask", buffered: true });
  const tick = () => {
    const p = window.__perf;
    if (p.chartAt == null && document.querySelector(".recharts-surface")) p.chartAt = performance.now();
    const btn = document.querySelector('button[aria-label^="Show "][aria-label$=" as table"]');
    if (p.hydratedAt == null && btn && Object.keys(btn).some((k) => k.startsWith("__reactProps"))) p.hydratedAt = performance.now();
    if (p.chartAt == null || p.hydratedAt == null) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function measure(port) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, storageState: state });
  await ctx.addInitScript(() => localStorage.setItem("ngf.e2e.noIntro", "1"));
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(`http://localhost:${port}/progress/overview`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForFunction(() => window.__perf.chartAt != null && window.__perf.hydratedAt != null, null, { timeout: 60_000 });
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const js = performance.getEntriesByType("resource").filter((r) => r.name.includes("/_next/static/") && r.name.endsWith(".js"));
    const beforeLoad = js.filter((r) => r.responseEnd <= nav.loadEventEnd);
    return {
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      interactive: Math.round(window.__perf.hydratedAt),
      firstChartDrawn: Math.round(window.__perf.chartAt),
      longTaskMs: Math.round(window.__perf.longTasks),
      jsBeforeLoadKB: Math.round(beforeLoad.reduce((a, r) => a + r.encodedBodySize, 0) / 1024),
      jsTotalKB: Math.round(js.reduce((a, r) => a + r.encodedBodySize, 0) / 1024),
      charts: document.querySelectorAll(".recharts-surface").length,
    };
  });
  // Tap "Show Bodyweight as table" and time the response.
  const t = await page.evaluate(async () => {
    const btn = document.querySelector('button[aria-label="Show Bodyweight as table"]');
    const t0 = performance.now();
    btn.click();
    await new Promise((r) => {
      const check = () => (btn.closest("figure").querySelector("table") ? r() : requestAnimationFrame(check));
      check();
    });
    return Math.round(performance.now() - t0);
  });
  // Screen-reader path: the table view is reachable and has the data rows.
  const rows = await page.locator("figure", { has: page.getByRole("heading", { name: "Bodyweight" }) }).locator("tbody tr").count();
  await ctx.close();
  return { ...m, tableToggleMs: t, tableRows: rows };
}

const results = { old: [], new: [] };
for (let i = 0; i < RUNS; i++) {
  results.old.push(await measure(3001));
  results.new.push(await measure(3000));
  console.log(`run ${i + 1}: old`, JSON.stringify(results.old.at(-1)), "\n       new", JSON.stringify(results.new.at(-1)));
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const keys = Object.keys(results.old[0]);
const summary = Object.fromEntries(keys.map((k) => [k, { old: median(results.old.map((r) => r[k])), new: median(results.new.map((r) => r[k])) }]));
console.log(JSON.stringify(summary, null, 2));
writeFileSync("progress-overview-load.json", JSON.stringify({ runs: RUNS, cpuThrottle: 4, viewport: "412x915 @2.625 (Pixel 7)", summary, raw: results }, null, 2));
await browser.close();
// Clean up the account.
await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H });
