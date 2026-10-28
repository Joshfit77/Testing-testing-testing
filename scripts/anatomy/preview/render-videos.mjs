// Usage: CHROMIUM_PATH=... node scripts/anatomy/preview/render-videos.mjs .anatomy-preview <out dir> [slug ...]
//        (RENDER_SHARD=k/n renders every n-th exercise from the k-th, so n copies can run side by side.)
// One video per exercise of the model performing it (the page's model view, ?ex=<slug>): two reps, 20 fps, 540×960
// (or 960×540 for an exercise wider than it is tall),
// from the exercise's own side (a side-view exercise from the side, turned a little forward as in the player; a
// front-view one from the front, turned a little), a still camera framing the whole rep. Also writes <slug>.jpg (the frame
// at mid-rep) for contact sheets, and skips exercises whose video already exists (so a run can be resumed).
// All slugs when none are given.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
const [dir, out, ...only] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
  fs.readFile(path.join(dir, u), (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.end(d); }); }).listen(0);
await new Promise((r) => srv.once('listening', r));
const port = srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
// The slugs, from the page itself.
let slugs = only;
if (!slugs.length) {
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${port}/index.html`);
  await p.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
  slugs = await p.evaluate(() => window.exerciseSlugs);
  await p.close();
}
const FPS = 20;
if (process.env.RENDER_SHARD) {
  const [k, n] = process.env.RENDER_SHARD.split('/').map(Number);
  slugs = slugs.filter((_, i) => i % n === k);
}
for (const slug of slugs) {
  const mp4 = path.join(out, `${slug}.mp4`);
  if (fs.existsSync(mp4)) continue;
  const t0 = Date.now();
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.error(slug, e.message));
  try {
    await p.goto(`http://localhost:${port}/index.html?ex=${encodeURIComponent(slug)}`);
    await p.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
    const info = await p.evaluate(() => {
      const m = window.viewer.motion;
      m.pause();
      const b = m.bounds;
      return { T: m.duration, view: window.exerciseView, across: Math.max(b.max.x - b.min.x, b.max.z - b.min.z), up: b.max.y - b.min.y };
    });
    const yaw = info.view === 'side' ? Math.PI / 2 - 0.55 : 0.3;
    // Tall for a standing exercise, wide for one that takes more room across than up (lying, crawling, stepping).
    const [W, H] = info.across > info.up * 0.9 ? [960, 540] : [540, 960];
    const n = Math.max(24, Math.round(info.T * FPS));
    const frames = fs.mkdtempSync(path.join(out, `.${slug}-`));
    for (let i = 0; i < n; i++) {
      const url = await p.evaluate(([t, yaw, w, h]) => window.viewer.still({ yaw, width: w, height: h, t, jpeg: true, fit: true }), [(i / n) * info.T, yaw, W, H]);
      const jpg = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
      fs.writeFileSync(path.join(frames, `f${String(i).padStart(4, '0')}.jpg`), jpg);
      if (i === Math.round(n / 2)) fs.writeFileSync(path.join(out, `${slug}.jpg`), jpg);
    }
    // Two reps: the frames twice over.
    const list = path.join(frames, 'list.txt');
    fs.writeFileSync(list, [0, 1].flatMap(() => Array.from({ length: n }, (_, i) => `file 'f${String(i).padStart(4, '0')}.jpg'\nduration ${1 / FPS}`)).join('\n'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-r', String(FPS), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'slow', '-movflags', '+faststart', mp4]);
    fs.rmSync(frames, { recursive: true });
    console.log(`${slug}: ${n} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s, ${(fs.statSync(mp4).size / 1e3).toFixed(0)} kB`);
  } catch (e) {
    console.error(`${slug}: FAILED ${e.message.split('\n')[0]}`);
  } finally {
    await p.close();
  }
}
await b.close(); srv.close();
