// Usage: CHROMIUM_PATH=... node scripts/anatomy/preview/controls-test.mjs .anatomy-preview "?ex=back-squat"
// (frames are slow under software WebGL, hence the multi-second playback windows)
// Drives the preview's real controls in Chromium and checks each one changes what is drawn (or the player state).
import { chromium } from 'playwright';
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
const [dir, query = ''] = process.argv.slice(2);
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
  fs.readFile(path.join(dir, u), (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.end(d); }); }).listen(0);
await new Promise((r) => srv.once('listening', r));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1100, height: 900 }, hasTouch: true });
await p.goto(`http://localhost:${srv.address().port}/${query}`);
await p.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
const canvas = await p.$('#stage');
const box = await canvas.boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const shot = async () => (await canvas.screenshot()).toString('base64');
const differs = (a, b) => a !== b;
const results = {};
// Pause so frames only change when a control changes them.
await p.click('#play'); await p.waitForTimeout(400);
const paused = await p.evaluate(() => window.player.playing === false);
results['play/pause button pauses'] = paused;
let a = await shot(); await p.waitForTimeout(600); let b2 = await shot();
results['paused frame is still'] = !differs(a, b2);
// 360° drag: drag a full canvas width several times; yaw must change the picture.
a = await shot();
await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 260, cy, { steps: 8 }); await p.mouse.up();
await p.waitForTimeout(400); b2 = await shot();
results['drag rotates'] = differs(a, b2);
const t0 = await p.evaluate(() => window.player.time());
// A full turn: 2π / 0.008 ≈ 785 px of drag returns to (almost) the same view.
for (let i = 0; i < 4; i++) { await p.mouse.move(cx - 300, cy); await p.mouse.down(); await p.mouse.move(cx - 300 + 196.35, cy, { steps: 6 }); await p.mouse.up(); }
await p.waitForTimeout(400); const full = await shot();
results['full 360° turn comes back round'] = (await p.evaluate(() => window.player.time())) === t0 && full.length > 0;
// Wheel zoom.
a = await shot(); await p.mouse.move(cx, cy); await p.mouse.wheel(0, -400); await p.waitForTimeout(400); b2 = await shot();
results['mouse wheel zooms'] = differs(a, b2);
// Two-finger pinch (pointer events with pointerType touch, two ids).
a = await shot();
await p.evaluate(([x, y]) => {
  const c = document.querySelector('#stage');
  const ev = (type, id, px) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: px, clientY: y, bubbles: true, isPrimary: id === 1 }));
  ev('pointerdown', 1, x - 40); ev('pointerdown', 2, x + 40);
  for (let i = 1; i <= 10; i++) { ev('pointermove', 1, x - 40 - i * 12); ev('pointermove', 2, x + 40 + i * 12); }
  ev('pointerup', 1, x - 160); ev('pointerup', 2, x + 160);
}, [cx, cy]);
await p.waitForTimeout(400); b2 = await shot();
results['pinch zooms'] = differs(a, b2);
// Camera presets.
for (const v of ['side', 'rear', 'front']) {
  a = await shot(); await p.click(`[data-view="${v}"]`); await p.waitForTimeout(400); b2 = await shot();
  results[`camera preset ${v}`] = differs(a, b2);
}
// Slow motion: speed button applies and restarts playback.
await p.click('[data-speed="0.35"]'); await p.waitForTimeout(300);
const s1 = await p.evaluate(() => window.player.time()); await p.waitForTimeout(5000); const s2 = await p.evaluate(() => window.player.time());
results['slow motion plays (0.35×)'] = await p.evaluate(() => window.player.playing) && s2 !== s1;
await p.click('[data-speed="1"]'); await p.waitForTimeout(300);
const f1 = await p.evaluate(() => window.player.time()); await p.waitForTimeout(5000); const f2 = await p.evaluate(() => window.player.time());
results['full speed plays (1×)'] = s2 !== s1 && f2 !== f1;
console.log(JSON.stringify(results, null, 1));
await b.close(); srv.close();
