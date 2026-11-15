// Renders the seven Home backgrounds (scenes.js) to optimized WebP files in public/home-backgrounds.
//   CHROMIUM=/path/to/chrome node scripts/home-backgrounds/render.mjs [--only=monday,friday] [--preview=<dir>]
// The pictures are original procedural artwork. The people in them are the app's own 2D athlete (the exercise
// engine's figure, src/lib/exercise-motion), drawn as a backlit silhouette, so the character stays the same everywhere.
import { build } from "esbuild";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const only = arg("only")?.split(",") ?? DAYS;
const preview = arg("preview");
const outDir = path.join(root, "public/home-backgrounds");
fs.mkdirSync(outDir, { recursive: true });
if (preview) fs.mkdirSync(preview, { recursive: true });

const FIG = `
import { pose, both } from "@/lib/exercise-motion/build";
import { compileMotion, evaluate } from "@/lib/exercise-motion/timeline";
import { drawAthlete } from "@/lib/exercise-motion/athlete";
import { gait } from "@/lib/exercise-motion/patterns/locomotion";
import type { MotionDef, Pose, RootRule, Keyframe } from "@/lib/exercise-motion/types";

const one = (id: string, view: "side" | "front", p: Pose, root: RootRule, ik?: Keyframe["ik"]): MotionDef => ({ id, view, label: id, keyframes: [{ pose: p, root, dur: 1, ik }, { pose: p, root, dur: 1, ik }] });
const DEFS: Record<string, () => MotionDef> = {
  // One knee down, hands clasped on the front knee, head bowed.
  kneel: () => one("kneel", "side", pose({ trunk: 24, spine: 12, neck: 34, hipR: 112, kneeR: 94, ankleR: 6, hipL: 16, kneeL: 102, ankleL: -22, shR: 50, elR: 60, shL: 50, elL: 60 }), { ground: 0 },
    { handR: { lm: "kneeCapR", dx: -3, dy: 8 }, handL: { lm: "kneeCapR", dx: -1, dy: 10 } }),
  // Seen from behind, mid-step.
  walker: () => one("walker", "front", pose({ ...both({ hip: 3, sh: 8, el: 8 }), kneeL: 22, shinDL: 28, legDL: 8 }), { ground: 0 }),
  runner: () => gait({ id: "runner", kind: "jog", label: "runner" }),
};
const PHASE: Record<string, number> = { kneel: 0, walker: 0, runner: 0.36 };

export function figure(kind: string, scale: number, o: { phase?: number } = {}) {
  const c = compileMotion(DEFS[kind]());
  const frame = evaluate(c, (o.phase ?? PHASE[kind]) * c.duration);
  const xs = Object.values(frame.pts).map((p) => p[0]); const ys = Object.values(frame.pts).map((p) => p[1]);
  const m = 26; const x0 = Math.min(...xs) - m; const x1 = Math.max(...xs) + m; const y1 = Math.max(...ys) + m; const y0 = Math.min(0, ...ys) - 8;
  const cv = document.createElement("canvas") as HTMLCanvasElement & { ax: number; ay: number };
  cv.width = Math.ceil((x1 - x0) * scale); cv.height = Math.ceil((y1 - y0) * scale);
  const ctx = cv.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, -scale, -x0 * scale, y1 * scale);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  drawAthlete(ctx, frame, () => {}, {});
  cv.ax = (frame.pts.pelvis[0] - x0) * scale; cv.ay = y1 * scale;
  return cv;
}
`;
const r = await build({ stdin: { contents: FIG, resolveDir: root, loader: "ts" }, bundle: true, minify: true, format: "iife", globalName: "FIG", write: false, platform: "browser", alias: { "@": path.join(root, "src") }, logLevel: "warning" });

const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await b.newPage({ viewport: { width: 800, height: 600 } });
page.on("pageerror", (e) => { console.error("page error:", e.message); process.exitCode = 1; });
await page.setContent("<!doctype html><html><body></body></html>");
await page.addScriptTag({ content: r.outputFiles[0].text });
await page.addScriptTag({ content: fs.readFileSync(path.join(here, "scenes.js"), "utf8") });

for (const day of only) {
  const out = await page.evaluate(async (day) => {
    const c = renderScene(day);
    return { full: c.toDataURL("image/webp", 0.82), png: c.toDataURL("image/png") };
  }, day);
  const save = (file, url) => fs.writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
  save(path.join(outDir, `${day}.webp`), out.full);
  if (preview) save(path.join(preview, `${day}.png`), out.png);
  console.log(day, `${(fs.statSync(path.join(outDir, `${day}.webp`)).size / 1024).toFixed(0)} kB`);
}
await b.close();
