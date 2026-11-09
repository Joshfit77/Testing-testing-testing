// Every control under 44 px on the routes in routes.json, with its real tap area: an input inside a <label> is
// tapped through the label, so the label's box is what a finger has to hit; a control with an invisible ::after hit
// area (the shared Button's compact sizes) is measured with it. Demo-only controls are left out.
//   BASE=http://localhost:3000 node scripts/ux/targets.mjs <out.json>   (demo server, sample account)
import { chromium, devices } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3000", OUT = process.argv[2];
const routes = JSON.parse(fs.readFileSync(new URL("./routes.json", import.meta.url), "utf8"));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const { defaultBrowserType: _d, ...iPhone } = devices["iPhone 15 Pro"];
const ctx = await b.newContext({ ...iPhone, viewport: { width: 393, height: 852 }, timezoneId: "America/New_York", reducedMotion: "reduce" });
await ctx.addInitScript(() => { const st = document.createElement("style"); st.textContent = `[data-testid="demo-bar"]{display:none!important}`; (document.head || document.documentElement)?.append(st); });
const page = await ctx.newPage();
await page.goto(BASE + "/"); await page.getByRole("button", { name: "Skip intro" }).click({ timeout: 6000 }).catch(() => {});
await page.getByRole("button", { name: "Explore with sample data" }).click(); await page.waitForURL(/\/home/);
const out = [];
for (const r of routes) {
  let path = r.path;
  if (!path || path.includes("[")) continue;
  await page.goto(BASE + path, { timeout: 60000 }).catch(() => {}); await page.waitForLoadState("networkidle").catch(() => {});
  const found = await page.evaluate(() => {
    const vis = (el) => { const x = el.getBoundingClientRect(); const cs = getComputedStyle(el); return x.width > 0 && x.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0"; };
    const ints = [...document.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],summary")]
      .filter((e) => vis(e) && !e.closest('nav[data-hide-with-keyboard]') && !e.closest('[data-testid="demo-bar"]') && e.getBoundingClientRect().width > 2);
    return ints.filter((e) => { const x = e.getBoundingClientRect(); return Math.min(x.width, x.height) < 44 && !(e.tagName === "A" && getComputedStyle(e).display === "inline"); }).map((e) => {
      let x = e.getBoundingClientRect();
      const ps = getComputedStyle(e, "::after");
      if (ps.content !== "none" && ps.position === "absolute") {
        const px = (v) => (v.endsWith("px") ? parseFloat(v) : 0);
        x = { width: x.width - px(ps.left) - px(ps.right), height: x.height - px(ps.top) - px(ps.bottom) };
      }
      const lab = e.closest("label") ?? (e.id ? document.querySelector(`label[for="${e.id}"]`) : null);
      const lx = lab?.getBoundingClientRect();
      const eff = lx && lx.height > x.height ? { w: Math.round(Math.max(lx.width, x.width)), h: Math.round(Math.max(lx.height, x.height)) } : { w: Math.round(x.width), h: Math.round(x.height) };
      const name = (e.getAttribute("aria-label") || lab?.textContent || e.textContent || e.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 50);
      return { tag: e.tagName.toLowerCase(), type: e.getAttribute("type") || e.getAttribute("role") || "", w: Math.round(x.width), h: Math.round(x.height), effW: eff.w, effH: eff.h, name };
    });
  });
  for (const f of found) out.push({ route: r.id, path, area: r.area, ...f });
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`${out.length} controls under 44 px; ${out.filter((x) => Math.min(x.effW, x.effH) < 44).length} with a real tap area under 44 px`);
await b.close();
