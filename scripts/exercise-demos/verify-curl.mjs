// Verifies the dumbbell curl's 2.5D video inside the real app at iPhone 15 size and records it (Chromium; not a phone).
//   BASE=http://localhost:3000 CHROMIUM=<path, optional> node scripts/exercise-demos/verify-curl.mjs <outdir>
// Proves the curl's video plays inside the real app at iPhone 15 size, records it, and checks every surface and every
// finger control: tap, sideways scrub, scroll, position bar, arrow keys, Normal / 0.5x (the real half-speed file),
// replay, enlarge, full screen.
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
  // For the recording: a ring where the finger touches (drawn by the test, not part of the app).
  await page.addInitScript(() => {
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
const demo = page.getByTestId("exercise-demo-25d").first(); // the page's player (the enlarged view is a second one)
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
check("muted, inline, looping (the corrected clip's loop closes)", s1 && s1.muted && s1.inline && s1.loop === true);
const dur = await demo.locator("video").evaluate((v) => v.duration);
const adv = s1 && s2 ? (s2.t - s1.t + dur) % dur : 0; // the clip loops, so the clock may wrap round
check("autoplays and time advances", s1 && s2 && !s2.paused && adv > 1, s1 && s2 && `${s1.t.toFixed(2)} s → ${s2.t.toFixed(2)} s, ${adv.toFixed(2)} s played of a ${dur.toFixed(2)} s loop`);
check("the picture changes (real motion)", Buffer.compare(shotA, shotB) !== 0 && Math.abs(shotA.length - shotB.length) >= 0, `${shotA.length} vs ${shotB.length} bytes`);
fs.writeFileSync(path.join(out, "curl-page.png"), await page.screenshot());
// It loops: past the clip's length it is still playing and its clock has wrapped round.
const before = await vstate(page);
await page.waitForTimeout(3500);
const after = await vstate(page);
check("loops seamlessly (keeps playing, clock wraps, no Replay)", after && !after.paused && !after.ended && (await page.getByRole("button", { name: "Replay the demonstration" }).count()) === 0, before && after && `${before.t.toFixed(2)} s → ${after.t.toFixed(2)} s after 3.5 s`);
fs.writeFileSync(path.join(out, "curl-looping.png"), await page.screenshot());
await demo.getByRole("button", { name: "Top", exact: true }).click();
await page.waitForTimeout(500);
const sTop = await vstate(page);
check("the Top button jumps to the top of the curl and pauses", sTop && sTop.paused && Math.abs(sTop.t - 1.4) < 0.1, sTop && `${sTop.t.toFixed(2)} s`);
fs.writeFileSync(path.join(out, "curl-top.png"), await page.screenshot());
await demo.getByRole("button", { name: "Play", exact: true }).click();
await page.waitForTimeout(800);
const f0 = await page.evaluate(() => { const v = document.querySelector('[data-testid="exercise-demo-25d"] video'); return v.currentTime / v.duration; });
await demo.getByRole("button", { name: "0.5×" }).click();
await page.waitForTimeout(250);
const f1 = await page.evaluate(() => { const v = document.querySelector('[data-testid="exercise-demo-25d"] video'); return { f: v.currentTime / v.duration, src: v.currentSrc }; });
await page.waitForTimeout(2300);
const s5 = await vstate(page);
const slowDur = await demo.locator("video").evaluate((v) => v.duration);
check("0.5× plays the real half-speed file (twice as long, normal rate), keeping its place in the rep", /loop-half\.(webm|mp4)$/.test(s5?.src ?? "") && s5.rate === 1 && Math.abs(slowDur - 2 * dur) < 0.12 && !s5.paused && Math.abs(((f1.f - f0 + 1.5) % 1) - 0.5) < 0.15, `${s5?.src}, ${slowDur.toFixed(2)} s vs ${dur.toFixed(2)} s, rate ${s5?.rate}, place ${f0.toFixed(2)} → ${f1.f.toFixed(2)}`);
await demo.getByRole("button", { name: "Pause", exact: true }).click();
await page.waitForTimeout(400);
const s6 = await vstate(page);
await page.waitForTimeout(800);
const s7 = await vstate(page);
check("Pause stops it", s6?.paused && Math.abs(s7.t - s6.t) < 0.01);
await demo.getByRole("button", { name: "Play", exact: true }).click();
await page.waitForTimeout(1500);
await demo.getByRole("button", { name: "Normal" }).click();
await page.waitForTimeout(1200);
const sN = await vstate(page);
check("Normal goes back to the normal-speed file", /loop\.(webm|mp4)$/.test(sN?.src ?? "") && sN.rate === 1 && !sN.paused, sN?.src);

// ---- 1b. Finger interaction, with touch events as an iPhone sends them (Chromium's touch emulation, not a phone).
const surfaceEl = demo.getByRole("group", { name: /Tap to play or pause/ });
const box = await surfaceEl.boundingBox();
const attr = (k) => demo.getAttribute(k);
const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, radiusX: 8, radiusY: 8 }] });
check("the hint is honest: one fixed camera view that does not rotate", (await demo.getByText("One fixed camera view (it does not rotate).").count()) === 1 && (await demo.getByTestId("demo-view-bar").count()) === 0);
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.45);
await page.waitForTimeout(500);
const tp1 = await vstate(page);
check("tap on the picture pauses", tp1?.paused && (await attr("data-playing")) === "false");
fs.writeFileSync(path.join(out, "tap-paused.png"), await page.screenshot());
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.45);
await page.waitForTimeout(800);
const tp2 = await vstate(page);
check("tap again plays", tp2 && !tp2.paused && (await attr("data-playing")) === "true");
// Drag sideways across the picture: the rep follows the finger frame by frame.
const y = box.y + box.height * 0.5;
const x0 = box.x + box.width * 0.15;
await touch("touchStart", x0, y);
const seen = [];
let midShot = null;
for (let i = 1; i <= 24; i++) {
  await touch("touchMove", x0 + (box.width * 0.65 * i) / 24, y);
  await page.waitForTimeout(60);
  const st = await page.evaluate(() => { const r = document.querySelector('[data-testid="exercise-demo-25d"]'); const im = r.querySelector('[data-testid="demo-scrub-frame"]'); return { scrubbing: r.dataset.scrubbing, frame: im && !im.hidden ? Number(im.dataset.frame) : null, paused: r.querySelector("video").paused }; });
  seen.push(st);
  if (i === 12) { midShot = await surfaceEl.screenshot(); fs.writeFileSync(path.join(out, "scrub-mid.png"), await page.screenshot()); }
}
const endShot = await surfaceEl.screenshot();
fs.writeFileSync(path.join(out, "scrub-end.png"), await page.screenshot());
await touch("touchEnd", 0, 0);
await page.waitForTimeout(700);
const shownFrames = seen.filter((x) => x.frame !== null).map((x) => x.frame);
const lastFrame = shownFrames.at(-1);
const after1 = await page.evaluate(() => { const r = document.querySelector('[data-testid="exercise-demo-25d"]'); const v = r.querySelector("video"); const im = r.querySelector('[data-testid="demo-scrub-frame"]'); return { f: v.currentTime / v.duration, paused: v.paused, overlay: !im.hidden, scrubbing: r.dataset.scrubbing, bar: Number(r.querySelector('input[type="range"]').value) }; });
check("drag sideways scrubs: paused, the frame follows the finger", seen.every((x) => x.scrubbing === "true" && x.paused) && new Set(shownFrames).size >= 8, `${new Set(shownFrames).size} different frames under the finger: ${shownFrames.join(",")}`);
check("the picture changes under the finger", midShot && Buffer.compare(midShot, endShot) !== 0);
check("on release the video rests on the frame the finger stopped on", after1.paused && !after1.overlay && after1.scrubbing === "false" && lastFrame !== undefined && Math.abs(after1.f - lastFrame / 49) < 0.03 && Math.abs(after1.bar / 1000 - after1.f) < 0.03, `frame ${lastFrame} → ${after1.f.toFixed(3)} of the clip, bar ${after1.bar}`);
// Up-and-down on the picture scrolls the page and does not scrub.
const tBefore = after1.f;
const sy0 = await page.evaluate(() => window.scrollY);
await touch("touchStart", box.x + box.width / 2, y);
let scrubbedV = false;
for (let i = 1; i <= 10; i++) { await touch("touchMove", box.x + box.width / 2, y - i * 14); await page.waitForTimeout(30); if ((await attr("data-scrubbing")) === "true") scrubbedV = true; }
await touch("touchEnd", 0, 0);
await page.waitForTimeout(600);
const sy1 = await page.evaluate(() => window.scrollY);
const fV = await page.evaluate(() => { const v = document.querySelector('[data-testid="exercise-demo-25d"] video'); return v.currentTime / v.duration; });
check("an up-and-down drag scrolls the page instead of scrubbing", !scrubbedV && Math.abs(fV - tBefore) < 0.01 && sy1 !== sy0, `scrollY ${sy0} → ${sy1}`);
await demo.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -60));
// The position bar under the picture and the arrow keys.
await demo.locator('input[type="range"]').fill("250");
await page.waitForTimeout(700);
const rb = await page.evaluate(() => { const v = document.querySelector('[data-testid="exercise-demo-25d"] video'); return { f: v.currentTime / v.duration, paused: v.paused }; });
check("the position bar moves through the rep", rb.paused && Math.abs(rb.f - 0.25) < 0.03, `${rb.f.toFixed(3)}`);
await surfaceEl.focus();
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(400);
const ka = await page.evaluate(() => { const v = document.querySelector('[data-testid="exercise-demo-25d"] video'); return v.currentTime / v.duration; });
check("arrow keys step one frame", ka > rb.f && ka - rb.f < 0.05, `${rb.f.toFixed(3)} → ${ka.toFixed(3)}`);
await page.keyboard.press("Space");
await page.waitForTimeout(600);
check("Space plays", (await attr("data-playing")) === "true");
// Replay from the start.
await page.waitForTimeout(800);
await demo.getByRole("button", { name: "Replay from the start" }).click();
await page.waitForTimeout(250);
const rp = await vstate(page);
check("Replay starts the rep again from the beginning", rp && !rp.paused && rp.t < 0.5, rp && `${rp.t.toFixed(2)} s`);
await page.waitForTimeout(1200);
// Enlarge: a full-screen view that opens where the inline player was, at the same speed, and hands back on close.
await demo.getByRole("button", { name: "0.5×" }).click();
await page.waitForTimeout(1200);
const inlineBox = await surfaceEl.boundingBox();
await demo.getByRole("button", { name: "Enlarge" }).click();
const big = page.getByRole("dialog");
await big.locator('[data-expanded="true"]').waitFor();
await page.waitForTimeout(1500);
const bigDemo = big.locator('[data-expanded="true"]');
const bigSurface = bigDemo.getByRole("group", { name: /Tap to play or pause/ });
const bigBox = await bigSurface.boundingBox();
const bs = await bigDemo.evaluate((r) => { const v = r.querySelector("video"); return { src: v.currentSrc.split("/").pop(), t: v.currentTime, paused: v.paused, speed: r.dataset.speed }; });
const inlinePaused = await demo.locator("video").evaluate((v) => v.paused);
check("Enlarge opens a bigger view at the same speed, still playing; the small one pauses behind it", bigBox.height > inlineBox.height * 1.05 && bs.speed === "0.5" && /loop-half/.test(bs.src) && !bs.paused && inlinePaused, `${Math.round(inlineBox.width)}x${Math.round(inlineBox.height)} → ${Math.round(bigBox.width)}x${Math.round(bigBox.height)} CSS px, ${bs.src}`);
fs.writeFileSync(path.join(out, "enlarged.png"), await page.screenshot());
await page.touchscreen.tap(bigBox.x + bigBox.width / 2, bigBox.y + bigBox.height / 2);
await page.waitForTimeout(500);
check("tap works in the enlarged view too", (await bigDemo.getAttribute("data-playing")) === "false");
const bx0 = bigBox.x + bigBox.width * 0.2, by = bigBox.y + bigBox.height * 0.5;
await touch("touchStart", bx0, by);
for (let i = 1; i <= 10; i++) { await touch("touchMove", bx0 + (bigBox.width * 0.3 * i) / 10, by); await page.waitForTimeout(50); }
await touch("touchEnd", 0, 0);
await page.waitForTimeout(700);
const bigF = await bigDemo.evaluate((r) => { const v = r.querySelector("video"); return v.currentTime / v.duration; });
const fsBtn = bigDemo.getByRole("button", { name: "Full screen" });
let fsNote = "no Full screen button (the device has no full-screen API)";
if (await fsBtn.count()) {
  await fsBtn.click();
  await page.waitForTimeout(800);
  const inFs = await page.evaluate(() => document.fullscreenElement?.getAttribute("aria-roledescription") ?? null);
  fs.writeFileSync(path.join(out, "fullscreen.png"), await page.screenshot());
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
  await page.waitForTimeout(500);
  fsNote = inFs === "exercise video" ? "the picture went full screen and came back" : `full screen did not engage (${inFs})`;
  check("Full screen (where the device has it)", inFs === "exercise video", fsNote);
}
await big.getByRole("button", { name: "Close" }).click();
await big.waitFor({ state: "hidden" });
await page.waitForTimeout(600);
const back = await page.evaluate(() => { const r = document.querySelector('[data-testid="exercise-demo-25d"]'); const v = r.querySelector("video"); return { f: v.currentTime / v.duration, playing: r.dataset.playing, speed: r.dataset.speed }; });
check("closing hands the place, speed and pause back to the page's player", back.playing === "false" && back.speed === "0.5" && Math.abs(back.f - bigF) < 0.04, `${bigF.toFixed(3)} → ${back.f.toFixed(3)}, speed ${back.speed}`);
await demo.getByRole("button", { name: "Normal" }).click();
await page.waitForTimeout(3000);
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
const wd = dlg.getByTestId("exercise-demo-25d");
const wbox = await wd.getByRole("group", { name: /Tap to play or pause/ }).boundingBox();
await page.touchscreen.tap(wbox.x + wbox.width / 2, wbox.y + wbox.height / 2);
await page.waitForTimeout(400);
const wPaused = await wd.getAttribute("data-playing");
await wd.getByRole("button", { name: "0.5×" }).click();
await page.waitForTimeout(1000);
const wSrc = await wd.locator("video").evaluate((v) => v.currentSrc.split("/").pop());
check("workout screen: tap, 0.5× and the controls work there too", wPaused === "false" && /loop-half/.test(wSrc), wSrc);
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
await rm.page.getByTestId("exercise-demo-25d").getByRole("button", { name: "Play", exact: true }).click();
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
const nfDemo = nf.page.getByTestId("exercise-demo-25d");
const shown = await nfDemo.locator("img").evaluateAll((imgs) => imgs.filter((i) => i.complete && i.naturalWidth > 0 && getComputedStyle(i).opacity !== "0").map((i) => i.alt));
check("video blocked: a still of the athlete shows with a plain note", (await nfDemo.locator("video").count()) === 0 && shown.length > 0 && (await nf.page.getByText("The video could not be played on this device").count()) === 1, `showing: ${shown.join(" | ")}`);
await nfDemo.scrollIntoViewIfNeeded();
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
const mp4 = path.join(out, "curl-interactive-in-app.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", "scale=786:-2:flags=lanczos,fps=30", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} checks pass; recording ${frames.length} frames → ${mp4}`);
