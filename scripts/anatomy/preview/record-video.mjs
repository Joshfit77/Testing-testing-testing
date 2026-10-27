// Usage: CHROMIUM_PATH=... node scripts/anatomy/preview/record-video.mjs .anatomy-preview <out.mp4>
// A screen recording of the exercise player on a phone-sized touch screen: the real page, driven with real touch input
// (Chrome DevTools touch events), one screenshot per frame (software WebGL is too slow to record in real time), then
// encoded at 30 fps with ffmpeg. A white dot shows each finger.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
const [dir, out = 'player.mp4'] = process.argv.slice(2);
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
  fs.readFile(path.join(dir, u), (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.end(d); }); }).listen(0);
await new Promise((r) => srv.once('listening', r));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(`http://localhost:${srv.address().port}/`);
await p.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
const cdp = await ctx.newCDPSession(p);
// Finger dots (drawn by the page, ignored by input).
await p.evaluate(() => {
  for (const id of ['f0', 'f1']) {
    const d = document.createElement('div');
    d.id = id;
    Object.assign(d.style, { position: 'fixed', width: '46px', height: '46px', margin: '-23px 0 0 -23px', borderRadius: '50%', background: 'rgba(255,255,255,0.35)', border: '2px solid rgba(255,255,255,0.8)', pointerEvents: 'none', zIndex: 99, display: 'none' });
    document.body.append(d);
  }
});
const frames = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), 'frames-'));
let n = 0;
const settle = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const frame = async (count = 1) => {
  await settle();
  const png = await p.screenshot();
  for (let i = 0; i < count; i++) fs.writeFileSync(path.join(frames, `f${String(n++).padStart(5, '0')}.png`), png);
};
const dots = (pts) => p.evaluate((pts) => {
  ['f0', 'f1'].forEach((id, i) => {
    const d = document.getElementById(id);
    const q = pts[i];
    d.style.display = q ? 'block' : 'none';
    if (q) { d.style.left = `${q[0]}px`; d.style.top = `${q[1]}px`; }
  });
}, pts);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
const ease = (t) => t * t * (3 - 2 * t);
// A gesture: fingers go down at `from`, move to `to` over `steps` frames, and lift.
const gesture = async (from, to, steps) => {
  await dots(from); await touch('touchStart', from); await frame(3);
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps);
    const pts = from.map(([x, y], k) => [x + (to[k][0] - x) * t, y + (to[k][1] - y) * t]);
    await dots(pts); await touch('touchMove', pts); await frame();
  }
  await touch('touchEnd', []); await frame(2); await dots([]); await frame(2);
};
const box = await (await p.$('#stage')).boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await frame(30); // standing, front
// One finger: four swipes of 196 px = one full turn (2π / 0.008 per px).
for (let i = 0; i < 4; i++) await gesture([[cx - 98, cy + 40]], [[cx + 98, cy + 40]], 22);
await frame(15);
// Two fingers: move up the body to the head, then pinch out to zoom in on the face.
await gesture([[cx - 45, cy - 40], [cx + 45, cy - 40]], [[cx - 45, cy + 150], [cx + 45, cy + 150]], 26);
await gesture([[cx - 30, cy - 120], [cx + 30, cy - 120]], [[cx - 150, cy - 120], [cx + 150, cy - 120]], 30);
await gesture([[cx - 30, cy - 120], [cx + 30, cy - 120]], [[cx - 120, cy - 120], [cx + 120, cy - 120]], 26);
await frame(20);
// A slow look round the head with one finger, and back.
await gesture([[cx - 60, cy + 60]], [[cx + 60, cy + 60]], 30);
await gesture([[cx + 60, cy + 60]], [[cx - 60, cy + 60]], 30);
await frame(15);
// The angle buttons (they reset the view): side, rear, front.
for (const v of ['side', 'rear', 'front']) {
  const bb = await (await p.$(`[data-view="${v}"]`)).boundingBox();
  const at = [[bb.x + bb.width / 2, bb.y + bb.height / 2]];
  await dots(at); await frame(4);
  await p.tap(`[data-view="${v}"]`); await frame(4); await dots([]); await frame(26);
}
await frame(20);
await b.close(); srv.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(frames, 'f%05d.png'), '-vf', 'scale=780:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', out]);
fs.rmSync(frames, { recursive: true });
console.log(`wrote ${out}: ${n} frames, ${(n / 30).toFixed(1)} s`);
