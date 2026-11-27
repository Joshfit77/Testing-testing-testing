// Prints a Markdown comparison of two measure-journeys.mjs reports (before and after a layout change).
//   node scripts/ux/compare-journeys.mjs before.json after.json
import fs from "node:fs";

const [a, b] = process.argv.slice(2).map((p) => JSON.parse(fs.readFileSync(p, "utf8")));
const by = (r) => Object.fromEntries(r.journeys.map((j) => [j.id, j]));
const A = by(a), B = by(b);
const fmt = (j) => (!j ? "—" : j.ok ? `${j.taps} tap${j.taps === 1 ? "" : "s"}, ${j.scrollPx} px` : `not completed (${j.note})`);
const delta = (x, y) => (x == null || y == null ? "" : y < x ? ` (−${x - y})` : y > x ? ` (+${y - x})` : " (same)");
console.log("| Journey | Before (taps, scrolling) | After (taps, scrolling) | Taps | Scrolling px | Time after |");
console.log("| --- | --- | --- | --- | --- | --- |");
let tapsA = 0, tapsB = 0, scrollA = 0, scrollB = 0, n = 0;
for (const id of Object.keys(B)) {
  const x = A[id], y = B[id];
  if (!x || !y) continue;
  const tapsNote = x.ok && y.ok ? `${x.taps} → ${y.taps}${delta(x.taps, y.taps)}` : "";
  const scrollNote = x.ok && y.ok ? `${x.scrollPx} → ${y.scrollPx}${delta(x.scrollPx, y.scrollPx)}` : "";
  if (x.ok && y.ok) { tapsA += x.taps; tapsB += y.taps; scrollA += x.scrollPx; scrollB += y.scrollPx; n++; }
  console.log(`| ${y.title} | ${fmt(x)} | ${fmt(y)} | ${tapsNote} | ${scrollNote} | ${(y.ms / 1000).toFixed(1)} s |`);
}
console.log(`| **Total over the ${n} journeys completed both times** | **${tapsA} taps, ${scrollA} px** | **${tapsB} taps, ${scrollB} px** | **${tapsA} → ${tapsB}** | **${scrollA} → ${scrollB}** | |`);
console.log();
console.log("| Screen | Before: screens tall, cards, controls, small targets | After: screens tall, cards, controls, small targets | axe (WCAG A/AA) before → after |");
console.log("| --- | --- | --- | --- |");
const PA = Object.fromEntries(a.pages.map((p) => [p.page, p])), PB = Object.fromEntries(b.pages.map((p) => [p.page, p]));
const axe = (p) => (!p?.axe ? "n/a" : p.axe.length ? p.axe.map((v) => `${v.id}×${v.nodes}`).join(", ") : "none");
for (const k of Object.keys(PB)) {
  const x = PA[k], y = PB[k];
  console.log(`| ${k} | ${x ? `${x.screens}, ${x.cards}, ${x.controls}, ${x.smallTargets}` : "—"} | ${y.screens}, ${y.cards}, ${y.controls}, ${y.smallTargets}${y.sidewaysScroll ? " (sideways scroll)" : ""} | ${axe(x)} → ${axe(y)} |`);
}
