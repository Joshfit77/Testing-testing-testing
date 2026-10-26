// Renders review stills of the athlete from the built preview (headless Chromium + SwiftShader WebGL).
//   node scripts/anatomy/preview/render-stills.mjs .anatomy-preview docs/anatomy3d/renders/athlete '[["front","player.restStill({yaw:0,distance:560,targetY:92,width:900,height:1300})"]]'
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const [dir, out, json] = process.argv.slice(2);
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
  fs.readFile(path.join(dir, u), (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader('Content-Type', types[path.extname(u)] || 'application/octet-stream'); r.end(d); }); })
.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(`http://localhost:${srv.address().port}/`);
  try { await p.waitForFunction(() => window.ready === true, null, { timeout: 240000 }); } catch { console.log('errors:', errs.join('\n')); process.exit(1); }
  for (const [name, expr] of JSON.parse(json)) {
    const url = await p.evaluate(expr);
    const ext = url.startsWith('data:image/jpeg') ? 'jpg' : 'png';
    fs.writeFileSync(`${out}-${name}.${ext}`, Buffer.from(url.split(',')[1], 'base64'));
  }
  if (errs.length) console.log('errors:', errs.filter(e => !/404/.test(e)).slice(0, 5).join('\n'));
  await b.close(); srv.close();
});
