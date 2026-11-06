// Presses every button on every main screen of the demo-mode app and records what happened: a navigation, a dialog,
// a status message, something opening or closing, a change on the page, or nothing visible (the candidates for a
// "dead" control). Links are checked by fetching them (status and no crash screen). Destructive controls are never
// pressed. Browser emulation of the real app on a demo server; it says nothing about hardware.
//
//   BASE=http://localhost:3000 OUT=interaction-audit.json CHROMIUM=... node scripts/ux/interaction-audit.mjs
import { chromium, devices } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "interaction-audit.json";
const ROUTES = process.env.ROUTES?.split(",") ?? [
  "/home", "/train", "/train/programs", "/train/exercises", "/train/exercises/kettlebell-swing", "/train/history", "/train/templates", "/train/build", "/train/recovery", "/train/review", "/calendar",
  "/run", "/run?tab=log", "/run/record",
  "/nutrition", "/nutrition/scanner", "/nutrition/photo", "/nutrition/recipes", "/nutrition/planner", "/nutrition/grocery", "/nutrition/insights", "/nutrition/saved-meals", "/nutrition/supplements", "/nutrition/diets", "/nutrition/compare",
  "/faith", "/faith/bible", "/faith/bible/john/3", "/faith/journal", "/faith/journal/new?kind=daily", "/faith/practices", "/faith/journey", "/faith/memory", "/faith/studies", "/faith/ask",
  "/coach", "/coach/memory", "/progress", "/progress/overview", "/progress/badges", "/progress/body-map", "/progress/body-scan", "/progress/sleep", "/progress/sleep/log", "/progress/sleep/checkin",
  "/profile", "/profile/preferences", "/profile/notifications", "/profile/billing", "/profile/customize", "/search?q=squat",
];
const NEVER = /delete|sign out|log out|discard|remove|withdraw|reset demo|turn off|unsubscribe|cancel (my )?(plan|subscription|membership)|clear|forget/i;
const CONTROLS = "button, [role=button], summary, [role=tab], [role=switch], [role=radio]";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const { defaultBrowserType: _t, ...dev } = devices["iPhone 15 Pro"];
const ctx = await browser.newContext({ ...dev, deviceScaleFactor: 1, baseURL: BASE });
await ctx.addInitScript(() => { try { localStorage.setItem("ngf.e2e.noIntro", "1"); } catch {} });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
page.on("dialog", (d) => d.dismiss().catch(() => null));
await page.goto("/");
await page.getByRole("button", { name: /Explore with sample data/ }).click();
await page.waitForURL(/\/home/);

const snapshot = () =>
  page.evaluate(() => ({
    url: location.pathname + location.search,
    text: document.body.innerText.length,
    dialogs: document.querySelectorAll("[role=dialog]:not([hidden]), [role=alertdialog]").length,
    statuses: [...document.querySelectorAll("[role=status], [role=alert], [aria-live]")].map((e) => e.textContent.trim()).filter(Boolean).join(" | ").slice(0, 120),
    open: document.querySelectorAll("details[open], [aria-expanded=true]").length,
    focusInput: /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? ""),
  }));
const results = [];
const links = new Set();
for (const route of ROUTES) {
  const list = async () => {
    await page.goto(route, { waitUntil: "load", timeout: 30000 }).catch(() => null);
    await page.waitForTimeout(400);
    return page.evaluate((sel) => {
      const main = document.querySelector("main") ?? document.body;
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !el.closest("[aria-hidden=true], [data-testid=demo-bar]"); };
      const name = (el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 50);
      const out = { buttons: [], links: [] };
      [...main.querySelectorAll(sel)].forEach((el, i) => {
        if (!vis(el) || el.closest("details:not([open]) > :not(summary)")) return;
        out.buttons.push({ i, name: name(el), disabled: el.disabled || el.getAttribute("aria-disabled") === "true", title: el.getAttribute("title") || "", kind: el.tagName.toLowerCase() + (el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : "") });
      });
      [...main.querySelectorAll("a[href]")].forEach((el) => { if (vis(el)) out.links.push({ href: el.getAttribute("href"), name: name(el) }); });
      return out;
    }, CONTROLS);
  };
  const first = await list();
  for (const l of first.links) if (l.href && !/^(mailto:|tel:|#|javascript:)/.test(l.href) && !/^https?:\/\//.test(l.href)) links.add(l.href.split("#")[0]);
  for (let k = 0; k < first.buttons.length; k++) {
    const b = first.buttons[k];
    if (b.disabled) { results.push({ route, control: b.name, kind: b.kind, outcome: "disabled", note: b.title || "(no explanation on the control)" }); continue; }
    if (NEVER.test(b.name)) { results.push({ route, control: b.name, kind: b.kind, outcome: "skipped (destructive)" }); continue; }
    const now = await list();
    const target = now.buttons[k];
    if (!target || target.name !== b.name) { results.push({ route, control: b.name, kind: b.kind, outcome: "moved (page changed between loads)" }); continue; }
    errors.length = 0;
    const before = await snapshot();
    const handles = await page.locator("main").locator(CONTROLS).all();
    const handle = handles[target.i];
    try {
      await handle.scrollIntoViewIfNeeded();
      await handle.click({ timeout: 4000 });
    } catch (e) { results.push({ route, control: b.name, kind: b.kind, outcome: "could not press", note: String(e.message).split("\n")[0].slice(0, 80) }); continue; }
    await page.waitForTimeout(1200);
    const after = await snapshot();
    let outcome = "no visible effect";
    if (after.url !== before.url) outcome = `navigated → ${after.url}`;
    else if (after.dialogs > before.dialogs) outcome = "opened a dialog";
    else if (after.open !== before.open) outcome = after.open > before.open ? "expanded" : "collapsed";
    else if (after.statuses && after.statuses !== before.statuses) outcome = `status: ${after.statuses.slice(0, 80)}`;
    else if (after.focusInput && !before.focusInput) outcome = "focused an input";
    else if (Math.abs(after.text - before.text) > 2) outcome = "page changed";
    results.push({ route, control: b.name, kind: b.kind, outcome, errors: errors.slice(0, 2) });
  }
}
// Links: every internal destination answers and shows no crash screen.
const linkResults = [];
for (const href of [...links].sort()) {
  try {
    const res = await page.goto(href, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(200);
    const text = await page.evaluate(() => document.body.innerText);
    const crash = /Application error|Something went wrong|couldn.t load this page|This page could not be found/i.test(text);
    linkResults.push({ href, status: res?.status() ?? 0, crash, landed: new URL(page.url()).pathname });
  } catch (e) { linkResults.push({ href, status: 0, crash: true, note: String(e.message).slice(0, 80) }); }
}
await browser.close();
fs.writeFileSync(OUT, JSON.stringify({ results, linkResults }, null, 1));
const dead = results.filter((r) => r.outcome === "no visible effect" || r.outcome === "could not press");
const unexplained = results.filter((r) => r.outcome === "disabled" && r.note.startsWith("(no"));
const badLinks = linkResults.filter((l) => l.crash || l.status >= 400);
console.log(`${results.length} controls pressed or recorded on ${ROUTES.length} screens; ${dead.length} with no visible effect; ${unexplained.length} disabled without an explanation; ${links.size} links checked, ${badLinks.length} bad`);
for (const r of dead) console.log(`DEAD? ${r.route}: ${r.kind} "${r.control}" ${r.note ?? ""} ${r.errors?.length ? "errors: " + r.errors.join(" | ") : ""}`);
for (const r of unexplained) console.log(`DISABLED ${r.route}: "${r.control}"`);
for (const l of badLinks) console.log(`LINK ${l.href}: ${l.status} ${l.crash ? "crash/404 text" : ""} ${l.note ?? ""}`);
