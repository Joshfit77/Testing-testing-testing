// Renders the lab's test poses: node scripts/anatomy/lab/run.mjs <out dir> [pose ...] (views: front, side, rear, 3/4).
import { chromium } from "playwright";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
const [out, ...only] = process.argv.slice(2);
const dir = path.resolve(".anatomy-lab");
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
const p = await b.newPage({ viewport: { width: 600, height: 800 } });
p.on("pageerror", (e) => console.error("page:", e.message));
p.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
await p.goto(`http://localhost:${srv.address().port}/index.html${process.env.LOOK ? `?look=${process.env.LOOK}` : ""}`);
await p.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
const poses = only.length ? only : await p.evaluate(() => window.lab.poses);
const views = (process.env.VIEWS ?? "0,1.5708,3.1416,0.785").split(",").map(Number);
for (const name of poses) {
  const rep = await p.evaluate((n) => window.lab.pose(n), name);
  console.log(name, JSON.stringify(rep));
  for (const [i, yaw] of views.entries()) {
    const url = await p.evaluate((y) => window.lab.still(y), yaw);
    fs.writeFileSync(path.join(out, `${name}-${i}.png`), Buffer.from(url.split(",")[1], "base64"));
  }
}
await b.close();
srv.close();
