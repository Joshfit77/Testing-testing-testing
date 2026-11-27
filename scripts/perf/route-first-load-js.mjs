// usage: node scripts/perf/route-first-load-js.mjs .next /progress/overview /nutrition /run
// Gzip size of the JavaScript a route loads on first visit, from a Next.js build's app-build-manifest.
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
const [,, dir = ".next", ...routes] = process.argv;
const m = JSON.parse(readFileSync(`${dir}/app-build-manifest.json`, "utf8")).pages;
const size = (f) => { const b = readFileSync(`${dir}/${f}`); return { raw: b.length, gz: gzipSync(b, { level: 9 }).length }; };
const out = {};
for (const r of routes) {
  const key = Object.keys(m).find((k) => k === `/(app)${r}/page` || k === `${r}/page`);
  const files = [...new Set([...(m["/layout"] ?? []), ...(m["/(app)/layout"] ?? []), ...m[key]])].filter((f) => f.endsWith(".js"));
  let raw = 0, gz = 0; const chunks = [];
  for (const f of files) { if (!existsSync(`${dir}/${f}`)) continue; const s = size(f); raw += s.raw; gz += s.gz; chunks.push({ f, ...s }); }
  chunks.sort((a, b) => b.gz - a.gz);
  out[r] = { key, files: chunks.length, rawKB: +(raw / 1024).toFixed(1), gzipKB: +(gz / 1024).toFixed(1), top: chunks.slice(0, 6).map((c) => `${c.f} ${(c.gz / 1024).toFixed(1)} KB gz`) };
}
console.log(JSON.stringify(out, null, 2));
