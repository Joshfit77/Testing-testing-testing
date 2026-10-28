// Review sheets: node scripts/anatomy/preview/review-stills.mjs .anatomy-preview <out dir> slug...
// For each exercise: stills at four moments of the rep (start, quarter, half, three-quarters) from the side, the
// front and the back, plus the anatomical rig's contact and limit report at each moment.
import { chromium } from "playwright";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
const [dir, out, ...slugs] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split("?")[0]);
  if (u === "/") u = "/index.html";
  fs.readFile(path.join(dir, u), (e, d) => {
    if (e) { r.statusCode = 404; return r.end(); }
    r.end(d);
  });
}).listen(0);
await new Promise((r) => srv.once("listening", r));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({ viewport: { width: 540, height: 960 } });
const W = Number(process.env.W ?? 360), H = Number(process.env.H ?? 450);
const phases = (process.env.PHASES ?? "0,0.25,0.5,0.75").split(",").map(Number);
for (const slug of slugs) {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.error(slug, "page:", e.message));
  await p.goto(`http://localhost:${srv.address().port}/index.html?ex=${slug}${process.env.Q ?? ""}`);
  await p.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
  const view = await p.evaluate(() => window.exerciseView);
  const yaws = view === "side" ? [Math.PI / 2 - 0.55, 0.15, Math.PI - 0.3] : [0.3, Math.PI / 2 - 0.4, Math.PI - 0.3];
  const lines = [];
  for (const [i, ph] of phases.entries()) {
    for (const [j, yaw] of yaws.entries()) {
      const url = await p.evaluate(([ph, yaw, w, h]) => window.viewer.still({ yaw, width: w, height: h, t: ph * window.viewer.motion.duration, jpeg: true, fit: true }), [ph, yaw, W, H]);
      fs.writeFileSync(path.join(out, `${slug}-${i}-${j}.jpg`), Buffer.from(url.split(",")[1], "base64"));
    }
    const rep = await p.evaluate(() => {
      const r = window.viewer.rig3;
      if (!r) return null;
      return { report: r.report(), contacts: r.performer.contacts(), converted: r.converted };
    });
    lines.push({ phase: ph, ...rep });
  }
  fs.writeFileSync(path.join(out, `${slug}.json`), JSON.stringify(lines, null, 1));
  console.log(slug, JSON.stringify(lines.map((l) => ({ ph: l.phase, gaps: l.contacts?.map((c) => `${c.side}:${c.gap.toFixed(1)}/${c.turn.toFixed(0)}°`).join(" "), lim: Object.entries(l.report?.limits ?? {}).map(([k, v]) => `${k}:${v.toFixed(0)}`).join(" ") }))));
  await p.close();
}
await b.close();
srv.close();
