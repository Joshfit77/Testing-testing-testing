// Checks the new athlete look inside the real app at iPhone 15 size (Chromium with touch emulation; not a phone) and
// records it: the four exercises in review play, respond to tap / finger scrub / 0.5x / full screen / the classic-look
// switch, appear on the library card and the workout screen, and every other exercise keeps the classic figure.
//   BASE=http://localhost:3000 CHROMIUM=<path> node scripts/exercise-review/verify-athlete-look.mjs <outdir>
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const out = process.argv[2];
const fdir = path.join(out, "frames");
fs.rmSync(fdir, { recursive: true, force: true });
fs.mkdirSync(fdir, { recursive: true });
const results = [];
const check = (name, ok, note = "") => { results.push({ name, ok: Boolean(ok), note }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${note ? ` (${note})` : ""}`); };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--autoplay-policy=no-user-gesture-required"] });
const { defaultBrowserType: _d, ...iPhone } = devices["iPhone 15"];
const ctx = await b.newContext({ ...iPhone, deviceScaleFactor: 2, timezoneId: "America/New_York" });
ctx.setDefaultTimeout(60000);
const page = await ctx.newPage();
await page.addInitScript(() => {
  // For the recording only: a ring where the finger touches.
  const show = (e) => {
    if (e.pointerType !== "touch") return;
    let d = document.getElementById("__finger");
    if (!d) { d = document.createElement("div"); d.id = "__finger"; d.style.cssText = "position:fixed;z-index:2147483647;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid rgba(255,255,255,.9);background:rgba(255,255,255,.25);pointer-events:none"; document.documentElement.appendChild(d); }
    d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; d.style.display = e.type === "pointerup" || e.type === "pointercancel" ? "none" : "block";
  };
  for (const t of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) addEventListener(t, show, true);
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
const skipIntro = async () => {
  const d = page.getByRole("dialog", { name: "Narrow Gate Fitness opening" });
  await d.waitFor({ timeout: 3000 }).catch(() => {});
  if (await d.count()) { await d.getByRole("button", { name: "Skip intro" }).click({ timeout: 5000 }).catch(() => {}); await d.waitFor({ state: "hidden", timeout: 30000 }).catch(() => {}); }
};
await page.goto(`${BASE}/`);
await skipIntro();
await page.getByTestId("demo-entry").waitFor();
for (let i = 0; i < 5 && !/\/home/.test(page.url()); i++) {
  await page.getByRole("button", { name: "Explore with sample data" }).click().catch(() => {});
  await page.waitForURL(/\/home/, { timeout: 15000 }).catch(() => {});
}
const frames = [];
let filming = false;
const cdp = await ctx.newCDPSession(page);
cdp.on("Page.screencastFrame", async (f) => {
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  if (!filming) return;
  const file = path.join(fdir, `f${String(frames.length).padStart(5, "0")}.jpg`);
  fs.writeFileSync(file, Buffer.from(f.data, "base64"));
  frames.push({ f: file, t: f.metadata.timestamp * 1000 });
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: 786, maxHeight: 1704, everyNthFrame: 1 });
const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, radiusX: 8, radiusY: 8 }] });

for (const [slug, name] of [["back-squat", "Barbell Back Squat"], ["dumbbell-curl", "Dumbbell Biceps Curl"], ["seated-cable-row", "Seated Cable Row"], ["zone-2-run", "Easy Zone 2 Run"]]) {
  await page.goto(`${BASE}/train/exercises/${slug}`);
  await skipIntro();
  // When an exercise also has a filmed video, the animation sits in a collapsed "Animated demo" section.
  const more = page.locator("summary", { hasText: "Animated demo" });
  if (await more.count()) await more.first().click();
  const w = page.locator("[data-exercise-motion]").first();
  await w.waitFor();
  await w.scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, -40));
  filming = true;
  await page.waitForTimeout(1500);
  check(`${name}: the athlete look, playing, marked as awaiting approval`, (await w.getAttribute("data-style")) === "athlete" && (await w.getAttribute("data-playing")) === "true" && (await page.getByText("New athlete look · awaiting approval").count()) === 1);
  check(`${name}: no 2.5D clip, no 3D, no classic figure on the page`, (await page.getByTestId("exercise-demo-25d").count()) === 0 && (await page.getByTestId("exercise-demo-3d").count()) === 0);
  const a = await w.screenshot();
  await page.waitForTimeout(700);
  const bb = await w.screenshot();
  check(`${name}: it moves`, Buffer.compare(a, bb) !== 0);
  fs.writeFileSync(path.join(out, `${slug}-page.png`), await page.screenshot());
  const box = await w.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height * 0.42;
  await page.touchscreen.tap(cx, cy);
  await page.waitForTimeout(400);
  check(`${name}: tap pauses`, (await w.getAttribute("data-playing")) === "false");
  const p0 = await w.evaluate((el) => Number(el.querySelector('input[type="range"]').value));
  await touch("touchStart", box.x + box.width * 0.2, cy);
  for (let i = 1; i <= 16; i++) { await touch("touchMove", box.x + box.width * (0.2 + 0.5 * i / 16), cy); await page.waitForTimeout(50); }
  const mid = await w.getAttribute("data-scrubbing");
  await touch("touchEnd", 0, 0);
  await page.waitForTimeout(300);
  const p1 = await w.evaluate((el) => Number(el.querySelector('input[type="range"]').value));
  check(`${name}: drag sideways scrubs through the movement`, mid === "true" && Math.abs(((p1 - p0 + 1500) % 1000) - 500) > 0 && (await w.getAttribute("data-playing")) === "false", `${p0} → ${p1} of 1000`);
  await page.touchscreen.tap(cx, cy);
  await page.waitForTimeout(300);
  check(`${name}: tap plays again`, (await w.getAttribute("data-playing")) === "true");
  await w.getByRole("button", { name: /Playback speed normal/ }).click();
  check(`${name}: 0.5×`, (await w.getAttribute("data-speed")) === "0.5");
  await page.waitForTimeout(1500);
  await w.getByRole("button", { name: /Playback speed half/ }).click();
  check(`${name}: back to normal speed`, (await w.getAttribute("data-speed")) === "1");
  await w.getByRole("button", { name: "Show the classic gold figure" }).click();
  await page.waitForTimeout(900);
  check(`${name}: the classic figure is one tap away for comparison`, (await w.getAttribute("data-style")) === "classic");
  fs.writeFileSync(path.join(out, `${slug}-classic.png`), await page.screenshot());
  await w.getByRole("button", { name: "Show the new athlete look" }).click();
  await w.getByRole("button", { name: "Full screen" }).click();
  await page.waitForTimeout(900);
  const fb = await w.boundingBox();
  const vp = page.viewportSize();
  check(`${name}: full screen fills the screen`, (await w.getAttribute("data-fullscreen")) === "true" && fb.width >= vp.width - 2 && fb.height >= vp.height - 2, `${Math.round(fb.width)}x${Math.round(fb.height)} on ${vp.width}x${vp.height}`);
  fs.writeFileSync(path.join(out, `${slug}-fullscreen.png`), await page.screenshot());
  await page.waitForTimeout(1500);
  await w.getByRole("button", { name: "Exit full screen" }).click();
  await page.waitForTimeout(500);
  check(`${name}: leaves full screen`, (await w.getAttribute("data-fullscreen")) === "false");
  await page.waitForTimeout(800);
  filming = false;
}

// Library card and the workout screen.
await page.goto(`${BASE}/train/exercises?q=row`);
await skipIntro();
await page.waitForTimeout(2500);
fs.writeFileSync(path.join(out, "library.png"), await page.screenshot());
check("library cards draw their stills", (await page.locator('canvas[aria-label$="demonstration (still)"]').count()) > 0);
await page.goto(`${BASE}/train`);
await skipIntro();
await page.locator("main").getByRole("link", { name: /Start workout|Start today's workout|Resume workout/ }).first().click();
await page.waitForURL(/\/train\/workout/);
await page.getByRole("button", { name: "Add exercise" }).first().click();
const picker = page.getByRole("dialog");
await picker.getByPlaceholder("Search by name or muscle").fill("Dumbbell Biceps Curl");
await picker.getByRole("button", { name: /^Dumbbell Biceps Curl/ }).first().click();
await picker.waitFor({ state: "hidden" });
const card = page.locator("section[aria-labelledby^=ex-]").filter({ hasText: "Dumbbell Biceps Curl" }).first();
await card.scrollIntoViewIfNeeded();
filming = true;
await card.getByRole("button", { name: "Show the Dumbbell Biceps Curl demonstration larger" }).click();
const dlg = page.getByRole("dialog");
const dw = dlg.locator("[data-exercise-motion]");
await dw.waitFor();
await page.waitForTimeout(1500);
check("workout screen: the curl's demonstration opens in the athlete look and plays", (await dw.getAttribute("data-style")) === "athlete" && (await dw.getAttribute("data-playing")) === "true");
fs.writeFileSync(path.join(out, "workout-dialog.png"), await page.screenshot());
await page.waitForTimeout(1500);
filming = false;
await page.keyboard.press("Escape");

// Everything else keeps the classic figure until approval.
for (const slug of ["push-up", "kettlebell-swing", "lat-pulldown"]) {
  await page.goto(`${BASE}/train/exercises/${slug}`);
  await skipIntro();
  const more = page.locator("summary", { hasText: "Animated demo" });
  if (await more.count()) await more.first().click();
  const w = page.locator("[data-exercise-motion]").first();
  await w.waitFor();
  check(`${slug} keeps the classic figure (fallback until approval)`, (await w.getAttribute("data-style")) === "classic");
}
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await cdp.send("Page.stopScreencast");
await b.close();

const list = path.join(fdir, "list.txt");
fs.writeFileSync(list, frames.map((fr, i) => `file '${path.basename(fr.f)}'\nduration ${Math.min(2, Math.max(0.03, ((frames[i + 1]?.t ?? fr.t + 1000) - fr.t) / 1000)).toFixed(3)}`).join("\n") + `\nfile '${path.basename(frames.at(-1).f)}'\n`);
const mp4 = path.join(out, "athlete-look-in-app.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", "scale=786:-2:flags=lanczos,fps=30", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} checks pass; recording ${frames.length} frames → ${mp4}`);
