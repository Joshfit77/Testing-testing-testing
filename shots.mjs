// Screenshots of the prototype: node shots.mjs out.png W H '{"ex":"squat","t":2,"view":"side"}' ...  (serves public/ itself)
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
const root = new URL("./public/", import.meta.url).pathname;
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
const server = createServer((q, r) => { try { const p = join(root, q.url === "/" ? "index.html" : q.url.split("?")[0]); const body = readFileSync(p); r.writeHead(200, { "content-type": types[extname(p)] ?? "application/octet-stream" }); r.end(body); } catch { if (!r.headersSent) r.writeHead(404); r.end(); } }).listen(0);
const [out, W, H, ...shots] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +(process.env.DSF || 1) });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForSelector("body[data-ready]", { timeout: 60000 }).catch(() => {});
if (errors.length) console.log("ERRORS", errors.slice(0, 5));
let i = 0;
for (const s of shots) {
  await page.evaluate((s) => window.__shot(JSON.parse(s)), s);
  await page.waitForTimeout(250);
  await page.evaluate((s) => window.__shot(JSON.parse(s)), s);
  await page.screenshot({ path: out.replace(".png", `-${i++}.png`) });
}
if (errors.length) console.log("ERRORS", errors.slice(0, 5));
await browser.close();
server.close();
