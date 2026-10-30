// Verifies the dumbbell curl's 2.5D video inside the real app at iPhone 15 size and records it (Chromium; not a phone).
//   BASE=http://localhost:3000 CHROMIUM=<path, optional> node scripts/exercise-demos/verify-curl.mjs <outdir>
// Proves the owner's curl video plays inside the real app at iPhone 15 size, records it, and checks every surface.
// node verify.mjs <outdir>
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
const check = (name, ok, note = "") => { results.push({ name, ok, note }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${note ? ` (${note})` : ""}`); };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const { defaultBrowserType: _d, ...iPhone } = devices["iPhone 15"];

async function signedIn(opts = {}) {
  const ctx = await b.newContext({ ...iPhone, deviceScaleFactor: 2, timezoneId: "America/New_York", ...opts });
  ctx.setDefaultTimeout(60000);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
  await page.goto(`${BASE}/`);
  await skipIntro(page);
  await page.getByTestId("demo-entry").waitFor();
  try { await page.waitForLoadState("networkidle", { timeout: 6000 }); } catch {}
  for (let i = 0; i < 5 && !/\/home/.test(page.url()); i++) {
    await page.getByRole("button", { name: "Explore with sample data" }).click().catch(() => {});
    await page.waitForURL(/\/home/, { timeout: 15000 }).catch(() => {});
  }
  await page.getByTestId("demo-bar").waitFor();
  return { ctx, page, errors };
}
async function skipIntro(page) {
  const d = page.getByRole("dialog", { name: "Narrow Gate Fitness opening" });
  await d.waitFor({ timeout: 3000 }).catch(() => {});
  if (await d.count()) {
    await d.getByRole("button", { name: "Skip intro" }).click({ timeout: 5000 }).catch(() => {});
    await d.waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
  }
}
const vstate = (page, scope = "") => page.evaluate((scope) => {
  const v = document.querySelector(`${scope} [data-testid="exercise-demo-25d"] video`);
  if (!v) return null;
  return { src: v.currentSrc.split("/").slice(-2).join("/"), t: v.currentTime, paused: v.paused, ended: v.ended, ready: v.readyState, rate: v.playbackRate, loop: v.loop, muted: v.muted, inline: v.playsInline, w: v.videoWidth, h: v.videoHeight, poster: v.poster.split("/").slice(-2).join("/") };
}, scope);

// ---- 1. The curl exercise page: plays, moves, ends, Replay, 0.5x; filmed.
const { ctx, page, errors } = await signedIn();
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
await page.goto(`${BASE}/train/exercises/dumbbell-curl`);
await skipIntro(page);
const demo = page.getByTestId("exercise-demo-25d");
await demo.waitFor();
check("curl page shows the new 2.5D player", (await demo.count()) === 1);
check("no old gold illustration on the curl page", (await page.getByTestId("exercise-demo").count()) === 0 && (await page.getByTestId("exercise-demo-3d").count()) === 0);
await demo.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -60));
filming = true;
await page.waitForTimeout(1200);
const s1 = await vstate(page);
const shotA = await demo.locator("video").screenshot();
await page.waitForTimeout(1500);
const s2 = await vstate(page);
const shotB = await demo.locator("video").screenshot();
check("video element loads the clip", s1 && s1.ready >= 2 && s1.w === 540 && s1.h === 788, s1 && `${s1.src}, ${s1.w}x${s1.h}, readyState ${s1.ready}`);
check("muted, inline, no loop (seam not clean)", s1 && s1.muted && s1.inline && s1.loop === false);
check("autoplays and time advances", s1 && s2 && !s2.paused && s2.t > s1.t + 1, s1 && s2 && `${s1.t.toFixed(2)} s → ${s2.t.toFixed(2)} s`);
check("the picture changes (real motion)", Buffer.compare(shotA, shotB) !== 0 && Math.abs(shotA.length - shotB.length) >= 0, `${shotA.length} vs ${shotB.length} bytes`);
fs.writeFileSync(path.join(out, "curl-page.png"), await page.screenshot());
await page.waitForFunction(() => document.querySelector('[data-testid="exercise-demo-25d"]')?.getAttribute("data-ended") === "true", null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1200);
const s3 = await vstate(page);
const replayBtn = page.getByRole("button", { name: "Replay the demonstration" });
check("plays to the end once, then offers Replay", s3?.ended === true && (await replayBtn.count()) === 1);
fs.writeFileSync(path.join(out, "curl-ended.png"), await page.screenshot());
await replayBtn.click();
await page.waitForTimeout(1500);
const s4 = await vstate(page);
check("Replay plays it again from the start", s4 && !s4.paused && s4.t > 0.3 && s4.t < 3, s4 && `${s4.t.toFixed(2)} s`);
await demo.getByRole("button", { name: "0.5×" }).click();
await page.waitForTimeout(2500);
const s5 = await vstate(page);
check("0.5× slow motion", s5?.rate === 0.5);
await demo.getByRole("button", { name: "Pause" }).click();
await page.waitForTimeout(400);
const s6 = await vstate(page);
await page.waitForTimeout(800);
const s7 = await vstate(page);
check("Pause stops it", s6?.paused && Math.abs(s7.t - s6.t) < 0.01);
await demo.getByRole("button", { name: "Play" }).click();
await page.waitForTimeout(5000);
filming = false;

// ---- 2. Library and search: the new poster thumbnail.
await page.goto(`${BASE}/train/exercises?q=curl`);
await skipIntro(page);
await page.waitForTimeout(1500);
const thumb = page.locator('img[alt="Dumbbell Biceps Curl demonstration (still)"]').first();
check("library / search card uses the new thumbnail", (await thumb.count()) > 0 && /exercise-demos\/dumbbell-curl\/thumb\.webp/.test(await thumb.getAttribute("src")) && (await thumb.evaluate((i) => i.naturalWidth)) === 480);
await thumb.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, 120));
await page.waitForTimeout(500);
fs.writeFileSync(path.join(out, "library-search.png"), await page.screenshot());

// ---- 3. The workout screen: the curl's card and its enlarged demonstration play the video.
await page.goto(`${BASE}/train`);
await skipIntro(page);
await page.locator("main").getByRole("link", { name: /Start workout|Start today's workout|Resume workout/ }).first().click();
await page.waitForURL(/\/train\/workout/);
await page.getByLabel(/set 1 weight in lb/).first().waitFor();
await page.getByRole("button", { name: "Add exercise" }).first().click();
const picker = page.getByRole("dialog");
await picker.getByPlaceholder("Search by name or muscle").fill("Dumbbell Biceps Curl");
await picker.getByRole("button", { name: /^Dumbbell Biceps Curl/ }).first().click();
await picker.waitFor({ state: "hidden" });
const card = page.locator("section[aria-labelledby^=ex-]").filter({ hasText: "Dumbbell Biceps Curl" }).first();
await card.scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
const cardImg = card.locator('img[alt="Dumbbell Biceps Curl demonstration (still)"]');
const cardVid = card.locator('[data-testid="exercise-demo-25d"] video');
check("workout card shows the new athlete (poster or video), not the gold figure", ((await cardImg.count()) + (await cardVid.count())) > 0 && (await card.getByTestId("exercise-demo").count()) === 0);
fs.writeFileSync(path.join(out, "workout-card.png"), await card.screenshot());
filming = true;
await card.getByRole("button", { name: "Show the Dumbbell Biceps Curl demonstration larger" }).click();
const dlg = page.getByRole("dialog");
await dlg.getByTestId("exercise-demo-25d").waitFor();
await page.waitForTimeout(1000);
const dv = dlg.getByTestId("exercise-demo-25d").locator("video");
const d1 = (await dv.count()) ? await dv.evaluate((v) => v.currentTime) : -1;
await page.waitForTimeout(1500);
const d2 = (await dv.count()) ? await dv.evaluate((v) => v.currentTime) : -1;
check("workout screen's enlarged demonstration plays the video", d2 > d1 + 1, `${d1.toFixed(2)} s → ${d2.toFixed(2)} s`);
fs.writeFileSync(path.join(out, "workout-dialog.png"), await page.screenshot());
await page.waitForTimeout(2500);
filming = false;
await page.keyboard.press("Escape");

// ---- 4. Fallback for every other exercise: push-up keeps its old illustration for now.
await page.goto(`${BASE}/train/exercises/push-up`);
await skipIntro(page);
await page.getByTestId("exercise-demo").waitFor();
check("other exercises keep their existing demonstration as the fallback", (await page.getByTestId("exercise-demo-25d").count()) === 0);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await cdp.send("Page.stopScreencast");
await ctx.close();

// ---- 5. Reduced Motion: poster, no autoplay; tap to play.
const rm = await signedIn({ reducedMotion: "reduce" });
await rm.page.goto(`${BASE}/train/exercises/dumbbell-curl`);
await skipIntro(rm.page);
await rm.page.getByTestId("exercise-demo-25d").waitFor();
await rm.page.waitForTimeout(2000);
const r1 = await vstate(rm.page);
check("Reduced Motion: no autoplay, poster shown", r1 && r1.paused && r1.t === 0 && /poster\.webp/.test(r1.poster));
await rm.page.getByTestId("exercise-demo-25d").getByRole("button", { name: "Play" }).click();
await rm.page.waitForTimeout(1500);
const r2 = await vstate(rm.page);
check("Reduced Motion: plays on tap", r2 && !r2.paused && r2.t > 0.5);
await rm.ctx.close();

// ---- 5b. If the video cannot load at all, the poster shows (never an empty frame).
const nf = await signedIn();
await nf.page.route(/exercise-demos\/dumbbell-curl\/loop\.(mp4|webm)/, (r) => r.abort());
await nf.page.goto(`${BASE}/train/exercises/dumbbell-curl`);
await skipIntro(nf.page);
await nf.page.getByTestId("exercise-demo-25d").waitFor();
await nf.page.waitForTimeout(2500);
const fb = nf.page.getByTestId("exercise-demo-25d").locator('img[alt="Dumbbell Biceps Curl: demonstration still"]');
check("video blocked: the poster shows with a plain note", (await fb.count()) === 1 && (await fb.evaluate((i) => i.complete && i.naturalWidth > 0)) && (await nf.page.getByText("The video could not be played on this device").count()) === 1);
fs.writeFileSync(path.join(out, "fallback-poster.png"), await nf.page.screenshot());
await nf.ctx.close();

// ---- 6. A slow phone network, simulated in Chromium (not a phone): time from navigation to the clip's first frame,
// cache off, 4 Mbps down / 150 ms latency.
const slow = await signedIn();
const c2 = await slow.ctx.newCDPSession(slow.page);
await c2.send("Network.setCacheDisabled", { cacheDisabled: true });
await c2.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (4 * 1024 * 1024) / 8, uploadThroughput: (1 * 1024 * 1024) / 8 });
const t0 = Date.now();
await slow.page.goto(`${BASE}/train/exercises/dumbbell-curl`, { waitUntil: "commit" });
await slow.page.waitForFunction(() => (document.querySelector('[data-testid="exercise-demo-25d"] video')?.readyState ?? 0) >= 2, null, { timeout: 90000, polling: 100 }).catch(() => {});
const firstFrame = (Date.now() - t0) / 1000;
const posterShown = await slow.page.evaluate(() => { const v = document.querySelector('[data-testid="exercise-demo-25d"] video'); return !!v?.poster; });
check("simulated slow 4G: first video frame after navigation", firstFrame < 20 && posterShown, `${firstFrame.toFixed(1)} s, poster shown meanwhile (Chromium network throttling, cache off; not a phone)`);
await slow.ctx.close();
await b.close();

// The recording.
const list = path.join(fdir, "list.txt");
fs.writeFileSync(list, frames.map((fr, i) => `file '${path.basename(fr.f)}'\nduration ${Math.min(2, Math.max(0.03, ((frames[i + 1]?.t ?? fr.t + 1000) - fr.t) / 1000)).toFixed(3)}`).join("\n") + `\nfile '${path.basename(frames.at(-1).f)}'\n`);
const mp4 = path.join(out, "curl-playing-in-app.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", "scale=786:-2:flags=lanczos,fps=30", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} checks pass; recording ${frames.length} frames → ${mp4}`);
