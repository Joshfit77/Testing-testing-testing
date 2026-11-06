// Responsive audit of the real app on a demo server: every main screen at many phone sizes (portrait and landscape)
// and at the Extra large text setting. For each screen it records sideways overflow, nested vertical scroll areas,
// horizontal swipe rows, text under 12 px, controls under 44 px, content left under the fixed tab bar, the header
// overlapping the first content, and page errors. Browser emulation only: it says nothing about a real phone.
//
//   BASE=http://localhost:3000 OUT=audit.json CHROMIUM=... node scripts/ux/responsive-audit.mjs
import { chromium, devices } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "responsive-audit.json";
const ROUTES = (process.env.ROUTES?.split(",") ?? [
  "/home", "/train", "/train/exercises", "/train/exercises/kettlebell-swing", "/train/programs", "/train/history", "/calendar",
  "/nutrition", "/nutrition/scanner", "/nutrition/photo", "/nutrition/recipes", "/nutrition/planner",
  "/run", "/run/record", "/faith", "/faith/bible/john/3", "/faith/journal", "/faith/journal/new?kind=daily", "/faith/practices",
  "/coach", "/progress", "/progress/overview", "/progress/sleep", "/progress/badges",
  "/profile", "/profile/preferences", "/profile/notifications", "/profile/billing", "/profile/customize", "/search?q=squat",
]).filter(Boolean);
const SIZES = (process.env.SIZES?.split(";") ?? ["320x568", "360x780", "375x667", "390x844", "393x852", "412x915", "430x932", "440x956", "852x393", "915x412"]).map((s) => s.split("x").map(Number));
const TEXT = process.env.TEXT?.split(",") ?? ["default", "xlarge"];
const TEXT_RADIO = { default: "Default", large: "Large", xlarge: "Extra large" };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const { defaultBrowserType: _t, ...dev } = devices["iPhone 15 Pro"];
const results = [];
for (const size of TEXT) {
  const ctx = await browser.newContext({ ...dev, viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, baseURL: BASE });
  await ctx.addInitScript(() => { try { localStorage.setItem("ngf.e2e.noIntro", "1"); } catch {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
  await page.goto("/"); await page.getByRole("button", { name: /Explore with sample data/ }).click(); await page.waitForURL(/\/home/);
  await page.goto("/profile"); await page.getByRole("radio", { name: TEXT_RADIO[size], exact: true }).click(); await page.waitForTimeout(800);
  // A workout in progress, so /train/workout has something to show.
  await page.goto("/train/workout?blank=1").catch(() => null); await page.waitForTimeout(500);
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    for (const route of [...ROUTES, "/train/workout"]) {
      errors.length = 0;
      try { await page.goto(route, { waitUntil: "load", timeout: 30000 }); } catch (e) { results.push({ size, w, h, route, error: String(e.message).slice(0, 80) }); continue; }
      await page.waitForTimeout(350);
      const r = await page.evaluate(async (w) => {
        const out = { overflow: null, nestedScroll: [], swipeRows: [], smallText: 0, smallTextExamples: [], smallControls: 0, smallControlExamples: [], underBar: [], headerOverlap: null, scrollHeight: 0 };
        const main = document.querySelector("main") ?? document.body;
        const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !el.closest("[aria-hidden=true], .sr-only, details:not([open]) > :not(summary)"); };
        out.scrollHeight = document.documentElement.scrollHeight;
        if (document.documentElement.scrollWidth > w + 1) {
          const leaves = [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().right > w + 0.5 && getComputedStyle(el).position !== "fixed").filter((el) => ![...el.children].some((c) => c.getBoundingClientRect().right > w + 0.5)).slice(0, 2).map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 24)}" → ${Math.round(el.getBoundingClientRect().right)}`);
          out.overflow = `${document.documentElement.scrollWidth} px: ${leaves.join("; ")}`;
        }
        for (const el of main.querySelectorAll("*")) {
          if (!vis(el)) continue;
          const s = getComputedStyle(el);
          if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4 && !/^(TEXTAREA|SELECT|PRE)$/.test(el.tagName) && el.clientHeight > 60) out.nestedScroll.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")} ${el.clientHeight}/${el.scrollHeight}`);
          if (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 4 && !/^(PRE|TABLE)$/.test(el.tagName)) out.swipeRows.push(`${el.tagName.toLowerCase()}[${el.getAttribute("aria-label") ?? String(el.className).split(" ")[0]}] ${el.clientWidth}/${el.scrollWidth}`);
        }
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
        const seen = new Set();
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent.trim() || !n.parentElement || !vis(n.parentElement)) continue;
          const fs = parseFloat(getComputedStyle(n.parentElement).fontSize);
          if (fs < 12 && !seen.has(n.parentElement)) { seen.add(n.parentElement); out.smallText++; if (out.smallTextExamples.length < 3) out.smallTextExamples.push(`${fs}px "${n.textContent.trim().slice(0, 24)}"`); }
        }
        for (const c of main.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=radio], [role=switch], [role=tab]")) {
          if (!vis(c) || c.closest("[data-testid=demo-bar]")) continue;
          const r = c.getBoundingClientRect();
          if (r.height < 44 || r.width < 44) {
            // A visual under 44 px is fine when the control has an invisible hit area that reaches 44 (the app's
            // compact buttons and switches do, through ::after); count only those with no such area.
            const after = getComputedStyle(c, "::after");
            const hit = after.content !== "none" && after.position === "absolute";
            if (!hit) { out.smallControls++; if (out.smallControlExamples.length < 3) out.smallControlExamples.push(`${c.tagName.toLowerCase()} "${(c.getAttribute("aria-label") || c.textContent || "").trim().slice(0, 22)}" ${Math.round(r.width)}×${Math.round(r.height)}`); }
          }
        }
        const header = [...document.querySelectorAll("header, [data-sticky-header]")].find((el) => /fixed|sticky/.test(getComputedStyle(el).position));
        const h1 = main.querySelector("h1, h2");
        if (header && h1 && h1.getBoundingClientRect().top < header.getBoundingClientRect().bottom - 1 && h1.getBoundingClientRect().top >= 0) out.headerOverlap = `h1 at ${Math.round(h1.getBoundingClientRect().top)}, header bottom ${Math.round(header.getBoundingClientRect().bottom)}`;
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const bar = [...document.querySelectorAll("nav")].find((n) => getComputedStyle(n).position === "fixed" && n.getBoundingClientRect().bottom >= innerHeight - 2 && n.getBoundingClientRect().height < 140);
        if (bar) {
          const top = bar.getBoundingClientRect().top;
          out.underBar = [...main.querySelectorAll("a, button, input, p, h1, h2, h3, li")].filter((el) => vis(el) && !/fixed|sticky/.test(getComputedStyle(el).position) && el.getBoundingClientRect().bottom > top + 2 && el.getBoundingClientRect().top < innerHeight).slice(0, 2).map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 24)}"`);
        }
        window.scrollTo({ top: 0, behavior: "instant" });
        return out;
      }, w);
      results.push({ size, w, h, route, url: new URL(page.url()).pathname, errors: [...errors], ...r });
    }
  }
  if (size !== "default") { await page.setViewportSize({ width: 393, height: 852 }); await page.goto("/profile"); await page.getByRole("radio", { name: "Default", exact: true }).click(); await page.waitForTimeout(800); }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
const bad = results.filter((r) => r.error || r.overflow || r.nestedScroll?.length || r.swipeRows?.length || r.underBar?.length || r.headerOverlap || r.errors?.length);
console.log(`${results.length} screen loads; ${bad.length} with findings`);
for (const r of bad) console.log(`${r.size} ${r.w}x${r.h} ${r.route}: ${[r.error, r.overflow && `overflow ${r.overflow}`, r.nestedScroll?.length && `nested scroll ${r.nestedScroll.join(", ")}`, r.swipeRows?.length && `swipe ${r.swipeRows.join(", ")}`, r.underBar?.length && `under bar ${r.underBar.join(", ")}`, r.headerOverlap && `header ${r.headerOverlap}`, r.errors?.length && `errors ${r.errors.join(" | ")}`].filter(Boolean).join("; ")}`);
const small = results.filter((r) => r.smallText > 0 || r.smallControls > 0);
console.log(`small text on ${small.filter((r) => r.smallText).length} loads, small controls on ${small.filter((r) => r.smallControls).length} loads`);
