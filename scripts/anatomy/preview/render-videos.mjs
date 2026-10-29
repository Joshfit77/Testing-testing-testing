// Usage: CHROMIUM_PATH=... node scripts/anatomy/preview/render-videos.mjs .anatomy-preview <out dir> [slug ...]
//        (RENDER_SHARD=k/n renders every n-th exercise from the k-th, so n copies can run side by side.)
// One video per exercise of the model performing it (the page's model view, ?ex=<slug>): two reps, 30 fps, 720×960
// (or 960×720 for an exercise wider than it is tall), framed on the figure and what he holds (not on a tower or a wall beside him),
// from the exercise's own side (a side-view exercise from the side, turned a little forward as in the player; a
// front-view one from the front, turned a little), a still camera framing the whole rep. Also writes <slug>.jpg (the frame
// at mid-rep) for contact sheets, and skips exercises whose video already exists (so a run can be resumed).
// All slugs when none are given. Q=<query> adds to the page's address (e.g. Q=&glow=0 for the movement without the glow).
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
const FPS = Number(process.env.FPS ?? 30);
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
    await p.goto(`http://localhost:${port}/index.html?ex=${encodeURIComponent(slug)}${process.env.Q ?? ""}`);
    await p.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
    const info = await p.evaluate(() => {
      const m = window.viewer.motion;
      m.pause();
      // (An exercise that travels is followed, so its shape is the body's, not the distance covered.)
      const b = m.travels ? m.reach : m.bounds;
      return { T: m.duration, view: window.exerciseView, across: Math.max(b.max.x - b.min.x, b.max.z - b.min.z), up: b.max.y - b.min.y };
    });
    // Tall for a standing exercise, wide for one that takes more room across than up (lying, rowing, stepping).
    const [W, H] = info.across > info.up * 1.15 ? [960, 720] : [720, 960];
    // From whichever side shows more of him at mid-rep (a wall, a cable stack or a rack can stand between the camera
    // and the figure on one side): the gold pixels of a small still from each.
    // (Turned a little forward first, as in the player; then from behind the shoulder, for a wall in front of him.)
    // (A front-view exercise is seen from three-quarters front, so arms reaching towards the camera read as arms.)
    const sides = info.view === 'side' ? [Math.PI / 2 - 0.55, -(Math.PI / 2 - 0.55), Math.PI / 2 + 0.45, -(Math.PI / 2 + 0.45)] : [0.55, -0.55, Math.PI - 0.55];
    const seen = [];
    for (const y of sides)
      seen.push(await p.evaluate(async ([t, yaw]) => {
        const img = new Image();
        img.src = window.viewer.still({ yaw, width: 160, height: 160, t, jpeg: true, fit: true });
        await img.decode();
        const c = document.createElement('canvas');
        c.width = c.height = 160;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, 160, 160).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 60 && d[i] - d[i + 2] > 35 && d[i + 1] > d[i + 2]) n++;
        return n;
      }, [info.T / 2, y]));
    // (The first side unless another shows clearly more.)
    let best = 0;
    seen.forEach((n, i) => { if (n > seen[best] * 1.15) best = i; });
    const yaw = sides[best];
    const n = Math.max(24, Math.round(info.T * FPS));
    const frames = fs.mkdtempSync(path.join(out, `.${slug}-`));
    // SECOND_VIEW=1: two more reps from a second angle (a side-view exercise from the front three-quarters, a front-view
    // one from behind), so the hands, the equipment and the far side can be seen too.
    // (A front-view exercise first seen from behind, a cable tower or a wall in the way at the front, is seen from the
    // better front side second, so the hands and the handle are seen at all.)
    const front = info.view === 'side' ? 0 : seen[1] > seen[0] * 1.15 ? sides[1] : sides[0];
    const second = info.view === 'side' ? Math.sign(yaw || 1) * 0.4 : Math.abs(yaw) > Math.PI / 2 ? front : Math.PI - 0.55;
    const yaws = process.env.SECOND_VIEW ? [yaw, second] : [yaw];
    for (const [v, y] of yaws.entries())
      for (let i = 0; i < n; i++) {
        const url = await p.evaluate(([t, yaw, w, h]) => window.viewer.still({ yaw, width: w, height: h, t, jpeg: true, fit: true }), [(i / n) * info.T, y, W, H]);
        const jpg = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
        fs.writeFileSync(path.join(frames, `v${v}f${String(i).padStart(4, '0')}.jpg`), jpg);
        if (v === 0 && i === Math.round(n / 2)) fs.writeFileSync(path.join(out, `${slug}.jpg`), jpg);
      }
    // Two reps from each view: its frames twice over.
    const list = path.join(frames, 'list.txt');
    fs.writeFileSync(list, yaws.flatMap((_, v) => [0, 1].flatMap(() => Array.from({ length: n }, (_, i) => `file 'v${v}f${String(i).padStart(4, '0')}.jpg'\nduration ${1 / FPS}`))).join('\n'));
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
