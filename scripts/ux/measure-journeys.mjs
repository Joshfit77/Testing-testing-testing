// Measures how far a member has to go for the everyday things, on the sample account of a demo server, at iPhone 15 Pro
// size (393×852): for each journey, the taps needed, and how far the page had to be scrolled to reach each control
// (0 when it was on the first screen). The same journeys run before and after a layout change, so the two reports
// compare like with like; where the app offers a shorter path (a control on the first screen), the journey takes it.
//
//   BASE=http://localhost:3000 OUT=before.json node scripts/ux/measure-journeys.mjs
//
// Each step lists the controls it will accept, in order of preference (`alts`); the first one on the page is used. A
// step with `doneIf` is skipped when the URL already matches (the previous tap went straight there).
import { chromium, devices } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "journeys.json";
const VIEW = { width: Number(process.env.VIEW_W ?? 393), height: Number(process.env.VIEW_H ?? 852) };
const TEXT_SIZE = process.env.TEXT_SIZE ?? "default"; // default | large | xlarge: the app's own text-size setting
const TAB_BAR = 64; // the bottom tab bar covers this much of the viewport

/** @typedef {{ scope?: "main"|"nav"|"dialog", role?: string, name?: RegExp|string, testid?: string, css?: string, exact?: boolean }} Alt */
/** @typedef {{ alts: Alt[], doneIf?: RegExp, fill?: string, label: string }} Step */

const tab = (name) => ({ scope: "nav", role: "link", name, exact: true });
const inMain = (role, name) => ({ scope: "main", role, name });

/** @type {{ id: string, title: string, start: string, steps: Step[] }[]} */
const JOURNEYS = [
  { id: "start-workout", title: "Start today's workout", start: "/home", steps: [{ label: "Start", alts: [inMain("link", /^(Start Today's Workout|Start workout|Start workout early|Resume workout)/)] }] },
  {
    id: "complete-set", title: "Complete the first set of a workout", start: "/home",
    steps: [
      { label: "Start", alts: [inMain("link", /^(Start Today's Workout|Start workout|Start workout early|Resume workout)/)] },
      { label: "Complete set", alts: [{ testid: "complete-set" }] },
    ],
  },
  {
    id: "next-exercise", title: "Move on to the next exercise", start: "/train/workout",
    steps: [{ label: "Next exercise", alts: [{ testid: "next-exercise" }, { testid: "skip-exercise" }] }, { label: "Confirm (if asked)", alts: [{ scope: "dialog", role: "button", name: /Short on time|Other reason/ }], optional: true }],
  },
  {
    id: "log-recent-food", title: "Log a recent food again", start: "/home",
    steps: [
      { label: "Nutrition tab", alts: [tab("Nutrition"), tab("Food")] },
      { label: "Open Add food (unless recent foods are on the page)", alts: [{ scope: "main", role: "button", name: /^Add food$/ }], unless: { testid: "quick-relog" } },
      { label: "Add it again", alts: [{ testid: "quick-relog" }, { role: "button", name: /^Add .* again$/ }] },
    ],
  },
  {
    id: "search-food", title: "Open food search", start: "/home",
    steps: [{ label: "Nutrition tab", alts: [tab("Nutrition"), tab("Food")] }, { label: "Add food", alts: [{ scope: "main", role: "button", name: /^Add food$/ }] }],
  },
  {
    id: "scan-barcode", title: "Scan a barcode", start: "/home",
    steps: [{ label: "Nutrition tab", alts: [tab("Nutrition"), tab("Food")] }, { label: "Scan", alts: [inMain("link", /^(Scan|Scan a product|Scan barcode)/)] }],
  },
  {
    id: "log-water", title: "Log a glass of water", start: "/home",
    steps: [{ label: "Nutrition tab (unless water is on Home)", alts: [tab("Nutrition"), tab("Food")], unless: { role: "button", name: /^\+250 ml/ } }, { label: "+250 ml", alts: [{ role: "button", name: /^\+250 ml/ }] }],
  },
  {
    id: "continue-reading", title: "Continue Bible reading", start: "/home",
    steps: [{ label: "Faith tab (unless Continue reading is on Home)", alts: [tab("Faith")], unless: inMain("link", /^Continue reading/) }, { label: "Continue reading", alts: [inMain("link", /^Continue reading/)] }],
  },
  {
    id: "write-prayer", title: "Write a prayer", start: "/home",
    steps: [{ label: "Faith tab", alts: [tab("Faith")] }, { label: "Prayer entry (or the form itself)", alts: [inMain("link", /^(Pray|Prayer|Write a prayer)/), { css: "section[aria-labelledby='journal-new'] textarea" }] }],
  },
  {
    id: "todays-devotional", title: "Open today's devotional", start: "/home",
    steps: [{ label: "Faith tab", alts: [tab("Faith")], unless: inMain("link", /^(Devotional|Today's devotional)/) }, { label: "Devotional", alts: [inMain("link", /^(Devotional|Today's devotional)/), inMain("button", /^Devotional/), { css: "#todays-devotional" }] }],
  },
  {
    id: "start-run", title: "Start a GPS run", start: "/home",
    steps: [
      { label: "Run (Home quick action, or the Run tab, or Train)", alts: [inMain("link", /^(Run|Go for a run|Start a run)$/), tab("Run"), tab("Train")] },
      { label: "Run / walk (from Train)", alts: [inMain("link", /^Run|Runs and walks/)], doneIf: /\/run/ },
      { label: "Record", alts: [inMain("link", /Outdoor run|Start a run|Record a run/)], doneIf: /\/run\/record/ },
    ],
  },
  { id: "open-coach", title: "Open the AI Coach", start: "/home", steps: [{ label: "AI Coach", alts: [{ role: "link", name: "AI Coach", exact: true }] }] },
  {
    id: "my-progress", title: "See My Progress", start: "/home",
    steps: [{ label: "My Progress (or the You tab)", alts: [inMain("link", /^My Progress/), tab("You")] }, { label: "My Progress", alts: [inMain("link", /^My Progress/)], doneIf: /\/progress/ }],
  },
  {
    id: "billing", title: "Open Plans & billing", start: "/home",
    steps: [{ label: "Profile (avatar or the You tab)", alts: [tab("You"), { role: "link", name: /^Profile and settings/ }] }, { label: "Plans & billing", alts: [inMain("link", /Plans & billing/)] }],
  },
  {
    id: "notifications", title: "Open notification settings", start: "/home",
    steps: [{ label: "Profile (avatar or the You tab)", alts: [tab("You"), { role: "link", name: /^Profile and settings/ }] }, { label: "Notifications", alts: [inMain("link", /^Notifications/)] }],
  },
  {
    id: "calendar", title: "Open the training calendar", start: "/home",
    steps: [{ label: "Calendar (Home, or via Train)", alts: [inMain("link", /^Training calendar/), tab("Train")] }, { label: "Training calendar", alts: [inMain("link", /^Training calendar/)], doneIf: /\/calendar/ }],
  },
  {
    id: "exercise-library", title: "Open the exercise library", start: "/home",
    steps: [{ label: "Train tab", alts: [tab("Train")] }, { label: "Exercises", alts: [inMain("link", /^Exercises/)] }],
  },
  {
    id: "finish-workout", title: "Finish a workout", start: "/train/workout",
    steps: [{ label: "Finish", alts: [inMain("button", /^Finish$/)] }, { label: "Confirm", alts: [{ scope: "dialog", role: "button", name: /^Finish/ }] }],
  },
  {
    id: "review-nutrition", title: "Review today's nutrition (calories and macros in view)", start: "/home",
    steps: [{ label: "Nutrition tab", alts: [tab("Nutrition"), tab("Food")] }, { label: "Daily totals in view", alts: [{ css: "section[aria-labelledby='totals-title']" }], measureOnly: true }],
  },
  {
    id: "read-chapter", title: "Read a Bible chapter (Scripture text in view)", start: "/home",
    steps: [
      { label: "Faith tab (unless Continue reading is on Home)", alts: [tab("Faith")], unless: inMain("link", /^Continue reading/) },
      { label: "Continue reading", alts: [inMain("link", /^Continue reading/)] },
      { label: "First verse in view", alts: [{ css: "main p[id^='v'], main [data-verse], main article p" }], measureOnly: true },
    ],
  },
  {
    id: "next-chapter", title: "Turn to the next chapter", start: "/faith/bible/john/3",
    steps: [{ label: "Next chapter", alts: [inMain("link", /^Next|John 4/)] }],
  },
  {
    id: "change-goals", title: "Change training goals", start: "/home",
    steps: [{ label: "Profile (avatar or the You tab)", alts: [tab("You"), { role: "link", name: /^Profile and settings/ }] }, { label: "Goals", alts: [inMain("link", /^(Goals|Edit onboarding details|Goals & preferences)/)] }],
  },
  {
    id: "advanced-tools", title: "Find an advanced training tool (Training review)", start: "/home",
    steps: [{ label: "Train tab", alts: [tab("Train")] }, { label: "More tools (if folded)", alts: [inMain("button", /^(More|All tools|Advanced)/), { css: "details[data-testid='train-tools'] > summary" }], optional: true, unless: inMain("link", /^Training review/) }, { label: "Training review", alts: [inMain("link", /^Training review/)] }],
  },
  {
    id: "return-home", title: "Return to Home from deep in the Bible", start: "/faith/bible/john/3",
    steps: [{ label: "Home tab", alts: [tab("Home")] }],
  },
];

const PAGES = ["/home", "/train", "/nutrition", "/faith", "/profile", "/progress", "/run", "/train/workout"];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const { defaultBrowserType: _t, ...dev } = devices["iPhone 15 Pro"];
const ctx = await browser.newContext({ ...dev, viewport: VIEW, deviceScaleFactor: 1, baseURL: BASE });
await ctx.addInitScript((size) => { try { localStorage.setItem("ngf.e2e.noIntro", "1"); if (size !== "default") { localStorage.setItem("ngf.textSize", size); document.documentElement.dataset.textSize = size; } } catch {} }, TEXT_SIZE);
const page = await ctx.newPage();
await page.goto("/");
await page.getByRole("button", { name: /Explore with sample data/ }).click();
await page.waitForURL(/\/home/, { timeout: 30_000 });
// The text size is an account setting (the server's value wins over the device's), so set it the way a member does.
const TEXT_RADIO = { default: "Default", large: "Large", xlarge: "Extra large" };
async function setTextSize(size) {
  await page.goto("/profile");
  await page.getByRole("radio", { name: TEXT_RADIO[size], exact: true }).click();
  await page.waitForTimeout(800);
}
if (TEXT_SIZE !== "default") await setTextSize(TEXT_SIZE);

function locate(alt) {
  let root = page;
  if (alt.scope === "main") root = page.locator("main");
  else if (alt.scope === "nav") root = page.getByRole("navigation", { name: "Main sections" }).last();
  else if (alt.scope === "dialog") root = page.getByRole("dialog");
  if (alt.testid) return root.getByTestId(alt.testid).first();
  if (alt.css) return root.locator(alt.css).first();
  return root.getByRole(alt.role, { name: alt.name, exact: alt.exact }).first();
}

async function present(alt) {
  const l = locate(alt);
  return (await l.count()) > 0 && (await l.isVisible().catch(() => false));
}

/** Document-relative position of the control, and the scrolling needed to bring it fully into view from the top. */
async function reach(loc) {
  return loc.evaluate((el, { h, bar }) => {
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY, bottom = r.bottom + window.scrollY;
    const usable = h - bar;
    return { top: Math.round(top), scrollNeeded: Math.max(0, Math.round(bottom - usable)), onFirstScreen: bottom <= usable };
  }, { h: VIEW.height, bar: TAB_BAR });
}

const results = [];
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 120)));
page.on("response", (r) => { if (r.status() >= 500) pageErrors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
/** Horizontal scroll containers with content wider than themselves: a row that needs a swipe to see the rest. */
const swipeRows = () => page.evaluate(() => [...document.querySelectorAll("main *")].filter((el) => { const s = getComputedStyle(el); return (s.overflowX === "auto" || s.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 4; }).length);
for (const j of JOURNEYS) {
  // Each journey starts as a member who has just opened the app: no remembered tab locations from the journey before.
  // Journeys that start a workout leave a draft on the device; the ones that don't begin without one, so the Train
  // tab opens the Train hub (with a draft it goes straight back to the workout, which is the point of that feature).
  await page.evaluate((keepDraft) => { try { sessionStorage.clear(); if (!keepDraft) for (const k of Object.keys(localStorage)) if (k.startsWith("ngf.workout.draft.")) localStorage.removeItem(k); } catch {} }, j.start === "/train/workout").catch(() => null);
  await page.goto(j.start);
  await page.waitForLoadState("networkidle").catch(() => null);
  const steps = [];
  let taps = 0, scroll = 0, ok = true, note = "", swipes = 0;
  const errorsBefore = pageErrors.length;
  const t0 = Date.now();
  try {
  for (const s of j.steps) {
    swipes = Math.max(swipes, await swipeRows());
    if (s.doneIf && s.doneIf.test(page.url())) { steps.push({ label: s.label, skipped: "already there" }); continue; }
    if (s.unless && (await present(s.unless))) { steps.push({ label: s.label, skipped: "shorter path on screen" }); continue; }
    let chosen = null;
    for (const a of s.alts) if (await present(a)) { chosen = a; break; }
    if (!chosen) {
      if (s.optional) { steps.push({ label: s.label, skipped: "not needed" }); continue; }
      ok = false; note = `no control for "${s.label}" on ${new URL(page.url()).pathname}`; break;
    }
    const loc = locate(chosen);
    const r = await reach(loc);
    const name = (await loc.getAttribute("aria-label")) || (await loc.textContent())?.trim().replace(/\s+/g, " ").slice(0, 40) || chosen.testid || chosen.css;
    if (s.measureOnly) { scroll += r.scrollNeeded; steps.push({ label: s.label, control: name, page: new URL(page.url()).pathname, ...r, measureOnly: true }); continue; }
    taps += 1; scroll += r.scrollNeeded;
    steps.push({ label: s.label, control: name, page: new URL(page.url()).pathname, ...r });
    if (await loc.isDisabled().catch(() => false)) { ok = false; note = `"${name}" is disabled here (nothing to ${s.label.toLowerCase()} yet)`; break; }
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 10_000 });
    await page.waitForLoadState("networkidle").catch(() => null);
    await page.waitForTimeout(300);
  }
  } catch (e) { ok = false; note = String(e).split("\n")[0].slice(0, 160); }
  const ms = Date.now() - t0;
  results.push({ id: j.id, title: j.title, ok, note, taps, scrollPx: scroll, swipeRowsSeen: swipes, ms, errors: pageErrors.slice(errorsBefore), endsAt: new URL(page.url()).pathname + new URL(page.url()).search, steps });
  // Leave any dialog or workout the way we found it: the next journey starts from a fresh page load.
  await page.keyboard.press("Escape").catch(() => null);
}

// Page shape: how tall each main screen is and how many cards and controls it stacks; plus an axe-core pass (WCAG 2.1
// A/AA rules it can check in a browser: contrast, names, roles, landmarks). axe is bundled in the project's dev tree.
const axeSource = fs.readFileSync(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const pages = [];
for (const p of PAGES) {
  const res = await page.goto(p).catch(() => null);
  if (!res || res.status() >= 400) continue;
  await page.waitForLoadState("networkidle").catch(() => null);
  await page.addScriptTag({ content: axeSource }).catch(() => null);
  const axe = await page.evaluate(async () => {
    if (!window.axe) return null;
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, example: v.nodes[0]?.target?.[0] }));
  }).catch(() => null);
  pages.push({ page: p, ...(await page.evaluate((h) => {
    // Accessibility basics (no contrast engine here): controls under 44 px tall, and icon-only controls with no name.
    const small = [...document.querySelectorAll("main a[href], main button, nav a")].filter((c) => { const r = c.getBoundingClientRect(); return r.height > 0 && r.width > 0 && (r.height < 44 || r.width < 44) && !c.closest("[aria-hidden=true]"); }).map((c) => `${c.tagName.toLowerCase()} "${(c.getAttribute("aria-label") || c.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24)}" ${Math.round(c.getBoundingClientRect().width)}×${Math.round(c.getBoundingClientRect().height)}`);
    const unnamed = [...document.querySelectorAll("main a[href], main button")].filter((c) => !(c.getAttribute("aria-label") || c.getAttribute("aria-labelledby") || c.textContent.trim() || c.querySelector("img[alt]:not([alt=''])"))).length;
    const main = document.querySelector("main");
    const cards = [...main.querySelectorAll(".rounded-2xl")].filter((c) => c.getBoundingClientRect().height > 40);
    const controls = [...main.querySelectorAll("a[href], button")].filter((c) => c.getBoundingClientRect().height > 0);
    const headings = [...main.querySelectorAll("h1, h2")].map((x) => x.textContent.trim().replace(/\s+/g, " ").slice(0, 40));
    const tallest = Math.max(0, ...cards.map((c) => Math.round(c.getBoundingClientRect().height)));
    return { heightPx: document.documentElement.scrollHeight, screens: Math.round((document.documentElement.scrollHeight / h) * 10) / 10, cards: cards.length, controls: controls.length, tallestCardPx: tallest, headings, smallTargets: small.length, smallTargetExamples: small.slice(0, 12), unnamedControls: unnamed, sidewaysScroll: document.documentElement.scrollWidth > window.innerWidth + 1 };
  }, VIEW.height)), axe });
}

fs.writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString(), base: BASE, viewport: VIEW, textSize: TEXT_SIZE, journeys: results, pages, pageErrors }, null, 1));
for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.title}: ${r.taps} taps, ${r.scrollPx} px of scrolling, ${(r.ms / 1000).toFixed(1)} s${r.swipeRowsSeen ? `, ${r.swipeRowsSeen} swipe rows seen` : ""}${r.errors.length ? `, ${r.errors.length} errors` : ""}${r.note ? ` (${r.note})` : ""}`);
for (const p of pages) console.log(`${p.page}: ${p.screens} screens tall, ${p.cards} cards, ${p.controls} controls, ${p.smallTargets} small targets, ${p.unnamedControls} unnamed${p.sidewaysScroll ? ", SIDEWAYS SCROLL" : ""}; axe: ${p.axe ? `${p.axe.reduce((n, v) => n + v.nodes, 0)} nodes in ${p.axe.length} rules (${p.axe.map((v) => `${v.id}×${v.nodes}`).join(", ") || "none"})` : "n/a"}`);
if (TEXT_SIZE !== "default") await setTextSize("default");
await browser.close();
