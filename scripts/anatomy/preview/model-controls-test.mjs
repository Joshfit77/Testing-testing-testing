// Usage: CHROMIUM_PATH=... node scripts/anatomy/preview/model-controls-test.mjs .anatomy-preview [index.html|artifact.html]
// The model view (the original Écorché model standing in the player): checks, on a phone-sized touch screen with real
// touch input (Chrome DevTools touch events, as a finger produces), that the model is the published file, performs the squat (and stops on pause),
// turns a full 360° under one finger, zooms with a pinch, moves along the body with two fingers, zooms with the wheel,
// and that the front, side and rear buttons work.
import { chromium } from 'playwright';
import crypto from 'node:crypto'; import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');
const [dir, page = 'index.html'] = process.argv.slice(2);
const ORIGINAL_SHA256 = '9744d3dffced835961104447d23a781ad469588289ce322d84d000e0d498326c'; // model/ecorche.glb, Écorché commit 320805e
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
  fs.readFile(path.join(dir, u), (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.end(d); }); }).listen(0);
await new Promise((r) => srv.once('listening', r));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const served = [];
p.on('response', async (res) => { if (res.url().endsWith('.glb')) served.push(crypto.createHash('sha256').update(await res.body()).digest('hex')); });
await p.goto(`http://localhost:${srv.address().port}/${page}`);
await p.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
const cdp = await ctx.newCDPSession(p);
const canvas = await p.$('#stage');
const box = await canvas.boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const shot = async () => canvas.screenshot();
const diff = async (a, c) => {
  const [x, y] = await Promise.all([a, c].map((i) => sharp(i).raw().toBuffer()));
  let s = 0;
  for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]);
  return s / x.length;
};
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
const drag = async (pts0, pts1, steps = 10) => {
  await touch('touchStart', pts0);
  for (let i = 1; i <= steps; i++) await touch('touchMove', pts0.map(([x, y], k) => [x + ((pts1[k][0] - x) * i) / steps, y + ((pts1[k][1] - y) * i) / steps]));
  await touch('touchEnd', []);
  await p.waitForTimeout(300);
};
const results = {};
// (index.html fetches the .glb itself; artifact.html fetches it as base64 parts, checked in the page.)
if (page === 'index.html') results['loads the original GLB, byte for byte'] = served.length === 1 && served[0] === ORIGINAL_SHA256;
results['the page itself confirms the file is unmodified (sha256)'] = await p.evaluate(() => window.modelVerified === true);
results['nothing else is drawn as the character (no rigged athlete loaded)'] = await p.evaluate(() => !window.player && !!window.viewer);
// The model itself performs the exercise (its own meshes, skinned), and the play button pauses it: the turn and zoom
// checks below run paused, so only the controls change the picture.
results['all 634 of the file\'s meshes are skinned (the file is what moves)'] = await p.evaluate(() => window.viewer.motion?.skinnedMeshes === 634);
let a = await shot(); await p.waitForTimeout(1500); let c = await shot();
results['plays the squat'] = (await diff(a, c)) > 0.2;
await p.tap('#play'); await p.waitForTimeout(400);
a = await shot(); await p.waitForTimeout(1200); c = await shot();
results['pause stops it'] = (await diff(a, c)) === 0 && (await p.evaluate(() => window.viewer.motion.playing === false));
a = await shot();
await drag([[cx - 60, cy]], [[cx + 60, cy]]);
c = await shot();
results['one finger turns the model'] = (await diff(a, c)) > 0.5;
// A full turn: 2π / 0.008 ≈ 785.4 px of drag in total (four drags of 196.35 px) comes back to the same view.
const start = await shot();
for (let i = 0; i < 4; i++) await drag([[cx - 98.175, cy]], [[cx + 98.175, cy]]);
const back = await shot();
const halfway = await (async () => { await drag([[cx - 98.175, cy]], [[cx + 98.175, cy]]); await drag([[cx - 98.175, cy]], [[cx + 98.175, cy]]); return shot(); })();
results['a full 360° turn comes back round'] = (await diff(start, back)) < 0.5 && (await diff(start, halfway)) > 0.5;
await drag([[cx - 98.175, cy]], [[cx + 98.175, cy]]); await drag([[cx - 98.175, cy]], [[cx + 98.175, cy]]);
a = await shot();
await drag([[cx - 30, cy], [cx + 30, cy]], [[cx - 150, cy], [cx + 150, cy]]);
c = await shot();
results['pinch out zooms in'] = (await diff(a, c)) > 0.5;
a = await shot();
await drag([[cx - 40, cy + 120], [cx + 40, cy + 120]], [[cx - 40, cy - 120], [cx + 40, cy - 120]]);
c = await shot();
results['two fingers move along the body'] = (await diff(a, c)) > 0.5;
fs.writeFileSync(`${process.env.SHOTS ?? '/tmp'}/model-zoomed.png`, c);
a = await shot();
await p.mouse.move(cx, cy); await p.mouse.wheel(0, 400); await p.waitForTimeout(300);
c = await shot();
results['mouse wheel zooms'] = (await diff(a, c)) > 0.5;
for (const v of ['side', 'rear', 'front']) {
  a = await shot(); await p.tap(`[data-view="${v}"]`); await p.waitForTimeout(300); c = await shot();
  results[`${v} button`] = (await diff(a, c)) > 0.5;
  fs.writeFileSync(`${process.env.SHOTS ?? '/tmp'}/model-${v}.png`, c);
}
fs.writeFileSync(`${process.env.SHOTS ?? '/tmp'}/model-page.png`, await p.screenshot({ fullPage: true }));
console.log(JSON.stringify(results, null, 1));
await b.close(); srv.close();
process.exit(Object.values(results).every(Boolean) ? 0 : 1);
