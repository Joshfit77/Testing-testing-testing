/**
 * Renders full-frame animations of exercise demonstrations through the app's own renderer (the same code the player
 * uses), frame by frame, then encodes them with ffmpeg and builds a filmstrip. Used to review a motion at normal and
 * half speed, and to compare it with an earlier version of the code.
 *
 *   node scripts/exercise-review/render-motion.mjs pro-agility-shuttle,a-skip --out=out/motion [--speed=1,0.5]
 *        [--fps=30] [--w=640] [--h=480] [--root=/path/to/another/checkout] [--strip=12] [--cols=6] [--tag=after]
 *
 * Speed 0.5 is exactly what the player's 0.5× button does: the loop is sampled twice as densely, so the video lasts
 * twice as long. Output per slug and speed: <tag>-<slug>-<speed>x.mp4, plus <tag>-<slug>-strip.png (evenly spaced
 * frames of one loop) and the numbered frames in <out>/frames/. Needs Playwright's Chromium and ffmpeg.
 */
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, d) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? d;
const slugs = (args.find((a) => !a.startsWith("--")) ?? "").split(",").filter(Boolean);
if (!slugs.length) throw new Error("usage: render-motion.mjs slug[,slug] --out=dir");
const outDir = resolve(flag("out", "out/motion"));
const speeds = flag("speed", "1,0.5").split(",").map(Number);
const fps = Number(flag("fps", 30));
const W = Number(flag("w", 640));
const H = Number(flag("h", 480));
const root = resolve(flag("root", join(here, "../..")));
const tag = flag("tag", "after");
const stripN = Number(flag("strip", 12));
mkdirSync(join(outDir, "frames"), { recursive: true });

const bundle = await build({
  stdin: { contents: `export { drawExerciseStill, getMotion, compileMotion } from "./src/lib/exercise-motion"; export { EXERCISES } from "./src/data/exercises";`, resolveDir: root, loader: "ts" },
  bundle: true,
  format: "iife",
  globalName: "EM",
  write: false,
  platform: "browser",
  alias: { "@": join(root, "src") },
  logLevel: "silent",
});
const js = bundle.outputFiles[0].text;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0;background:#070707"><canvas id=c width=${W} height=${H} style="width:${W}px;height:${H}px"></canvas><script>${js}</script></body></html>`);

for (const slug of slugs) {
  const info = await page.evaluate((slug) => {
    const e = EM.EXERCISES.find((x) => x.slug === slug);
    const meta = { slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed };
    const def = EM.getMotion(slug, meta);
    return { name: e.name, view: def.view, duration: EM.compileMotion(def).duration, label: def.label };
  }, slug);
  const draw = async (phase) => {
    await page.evaluate(({ slug, phase, W, H }) => {
      const e = EM.EXERCISES.find((x) => x.slug === slug);
      const meta = { slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed };
      EM.drawExerciseStill(document.getElementById("c"), slug, { meta, phase, width: W, height: H });
    }, { slug, phase, W, H });
    return page.locator("#c").screenshot({ type: "png" });
  };
  for (const speed of speeds) {
    const dir = join(outDir, "frames", `${tag}-${slug}-${speed}x`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    // One loop of the motion lasts duration / speed seconds on screen.
    const n = Math.round((info.duration / speed) * fps);
    for (let k = 0; k < n; k++) writeFileSync(join(dir, `f${String(k).padStart(4, "0")}.png`), await draw(k / n));
    const mp4 = join(outDir, `${tag}-${slug}-${speed}x.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "f%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", mp4]);
    console.log(`${mp4}: ${n} frames, ${(n / fps).toFixed(2)} s at ${speed}x (loop ${info.duration.toFixed(2)} s, ${info.view} view)`);
  }
  // Filmstrip: evenly spaced phases of one loop, captioned with the time into the loop.
  const cols = Math.min(stripN, Number(flag("cols", 6)));
  const rows = Math.ceil(stripN / cols);
  const cw = Math.round(W / 2);
  const ch = Math.round(H / 2);
  const shots = [];
  for (let k = 0; k < stripN; k++) shots.push((await draw(k / stripN)).toString("base64"));
  await page.evaluate(
    async ({ shots, cols, rows, cw, ch, dur, stripN }) => {
      const sheet = document.createElement("canvas");
      sheet.id = "sheet";
      sheet.width = cols * cw;
      sheet.height = rows * (ch + 18);
      const g = sheet.getContext("2d");
      g.fillStyle = "#070707";
      g.fillRect(0, 0, sheet.width, sheet.height);
      g.font = "12px system-ui";
      for (let k = 0; k < shots.length; k++) {
        const img = new Image();
        img.src = "data:image/png;base64," + shots[k];
        await img.decode();
        const x = (k % cols) * cw;
        const y = Math.floor(k / cols) * (ch + 18);
        g.drawImage(img, x, y + 18, cw, ch);
        g.fillStyle = "#c9a54c";
        g.fillText(`t = ${((k / stripN) * dur).toFixed(2)} s  (${Math.round((k / stripN) * 100)}%)`, x + 6, y + 13);
      }
      document.body.appendChild(sheet);
    },
    { shots, cols, rows, cw, ch, dur: info.duration, stripN },
  );
  await page.locator("#sheet").screenshot({ path: join(outDir, `${tag}-${slug}-strip.png`) });
  await page.evaluate(() => document.getElementById("sheet")?.remove());
  console.log(`${join(outDir, `${tag}-${slug}-strip.png`)}`);
}
await browser.close();
