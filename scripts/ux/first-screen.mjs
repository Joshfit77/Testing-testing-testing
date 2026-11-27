// Where each daily action sits for a member at iPhone size (393 x 852): on the first screen, above the tab bar, or
// how far down. Demo server, demo bar hidden.  node scripts/ux/first-screen.mjs <established|new>
import { chromium, devices } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3000", ACCOUNT = process.argv[2] ?? "established";
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const { defaultBrowserType: _d, ...iPhone } = devices["iPhone 15 Pro"];
const ctx = await b.newContext({ ...iPhone, viewport: { width: 393, height: 852 }, reducedMotion: "reduce" });
await ctx.addInitScript(() => { const st = document.createElement("style"); st.textContent = `[data-testid="demo-bar"]{display:none!important}`; (document.head || document.documentElement)?.append(st); });
const page = await ctx.newPage();
await page.goto(BASE + "/"); await page.getByRole("button", { name: "Skip intro" }).click({ timeout: 6000 }).catch(() => {});
if (ACCOUNT === "new") {
  await page.goto(BASE + "/login"); await page.getByRole("button", { name: "Start as a new member" }).click(); await page.waitForURL(/onboarding/);
  const cont = () => page.getByRole("button", { name: /^Continue/ }).click();
  await page.getByRole("button", { name: "Build muscle", exact: true }).click(); await cont();
  await page.getByRole("button", { name: "Under 1 year", exact: true }).click(); await cont(); await cont();
  await page.getByRole("button", { name: /^Full gym/ }).click(); await cont();
  await page.getByRole("button", { name: "Male", exact: true }).click().catch(() => {});
  await page.getByLabel("Age").fill("30"); await page.getByLabel("Height (ft)").fill("5"); await page.getByLabel("Height (in)").fill("10"); await page.getByLabel(/Current weight/).fill("180");
  await cont(); await page.getByRole("button", { name: "Build my plan" }).click(); await page.waitForURL(/\/(plan|home)/, { timeout: 60000 });
} else { await page.getByRole("button", { name: "Explore with sample data" }).click(); await page.waitForURL(/\/home/); }
const checks = [
  ["Home", "/home", (p) => p.getByRole("link", { name: /^(Start (today's workout|workout)|Resume workout|Start workout early)/i })],
  ["Home: Quick add", "/home", (p) => p.getByRole("button", { name: "Quick add" })],
  ["Nutrition: Add food", "/nutrition", (p) => p.getByRole("button", { name: "Add food" })],
  ["Nutrition: one-tap re-log", "/nutrition", (p) => p.getByTestId("quick-relog")],
  ["Faith: today's reading check-in", "/faith", (p) => p.getByRole("button", { name: /Mark (today's )?reading complete/ }).or(p.getByRole("link", { name: /Choose a journey|Read the Bible/ }))],
  ["Sleep: enter last night", "/progress/sleep", (p) => p.getByRole("link", { name: /Enter sleep by hand/ }).or(p.getByRole("button", { name: "Allow sleep logging" }))],
  ["Workout: Complete set", "/train/workout", (p) => p.getByTestId("complete-set")],
];
const tabTop = 852 - 69;
for (const [label, path, find] of checks) {
  await page.goto(BASE + path); await page.waitForLoadState("networkidle").catch(() => {});
  const loc = find(page).first();
  const box = await loc.boundingBox().catch(() => null);
  if (!box) { console.log(`${label.padEnd(34)} not on the page`); continue; }
  const bottom = Math.round(box.y + box.height);
  console.log(`${label.padEnd(34)} ${bottom <= tabTop ? "first screen" : `below the fold by ${bottom - tabTop} px (${((bottom - tabTop) / 852).toFixed(2)} screens)`}  (bottom at y=${bottom})`);
}
await b.close();
