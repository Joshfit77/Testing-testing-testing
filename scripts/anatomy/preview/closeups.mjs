// Close-ups: node closeups.mjs .anatomy-preview <out> slug phase:yaw:targetY:distance ...
import { chromium } from "playwright";
import fs from "node:fs"; import http from "node:http"; import path from "node:path";
const [dir, out, slug, ...shots] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; fs.readFile(path.join(dir, u), (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.end(d); }); }).listen(0);
await new Promise((r) => srv.once("listening", r));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 540, height: 960 } });
p.on("pageerror", (e) => console.error("page:", e.message));
await p.goto(`http://localhost:${srv.address().port}/index.html?ex=${slug}${process.env.Q ?? ""}`);
await p.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
// TINT="regex:#color,regex:#color" colours matching parts (to tell muscles apart in a close-up).
if (process.env.TINT)
  await p.evaluate((spec) => {
    const parts = window.viewer.rig3?.bound.parts;
    for (const item of spec.split(",")) {
      const [re, color] = item.split(":");
      for (const [name, m] of parts ?? []) if (new RegExp(re, "i").test(name)) {
        m.material = m.material.clone();
        m.material.color?.set(color);
        m.material.emissive?.set(color).multiplyScalar(0.35);
      }
    }
  }, process.env.TINT);
for (const s of shots) {
  const [ph, yaw, ty, dist] = s.split(":").map(Number);
  const url = await p.evaluate(([ph, yaw, ty, dist]) => { window.viewer.motion.seek(ph * window.viewer.motion.duration); return window.viewer.still({ yaw, width: 500, height: 500, distance: dist, targetY: ty, t: ph * window.viewer.motion.duration }); }, [ph, yaw, ty, dist]);
  fs.writeFileSync(path.join(out, `${slug}_${s.replace(/:/g, "_")}.png`), Buffer.from(url.split(",")[1], "base64"));
}
await b.close(); srv.close();
