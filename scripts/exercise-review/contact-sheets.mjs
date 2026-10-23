/**
 * Visual review of the animated exercise demonstrations: renders every catalog exercise at six phases of its loop
 * (start, early, middle, deepest/peak, return, end) on contact sheets, with the same camera for all six.
 *
 *   node scripts/exercise-review/contact-sheets.mjs [outDir] [--only=slug,slug] [--per=8] [--w=200]
 *
 * Needs the bundled Chromium (Playwright). Output: outDir/sheet-NN.png and outDir/index.json (slug → sheet, row).
 * Tests can't judge whether a pose looks right; these sheets are for a person to inspect.
 */
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const outDir = resolve(args.find((a) => !a.startsWith("--")) ?? "exercise-sheets");
const only = (args.find((a) => a.startsWith("--only="))?.slice(7) ?? "").split(",").filter(Boolean);
const per = Number(args.find((a) => a.startsWith("--per="))?.slice(6) ?? 8);
// Cell width in px (height is 3/4 of it); use --w=400 to zoom in on a few exercises.
const W = Number(args.find((a) => a.startsWith("--w="))?.slice(4) ?? 200);
const H = Math.round(W * 0.75);
mkdirSync(outDir, { recursive: true });

const bundle = await build({
  entryPoints: [join(here, "entry.ts")],
  bundle: true,
  format: "iife",
  globalName: "EM",
  write: false,
  platform: "browser",
  alias: { "@": resolve(here, "../../src") },
  logLevel: "silent",
});
const js = bundle.outputFiles[0].text;

const PHASES = [
  ["Start", 0],
  ["Early", 1 / 6],
  ["Middle", 2 / 6],
  ["Deepest / peak", 3 / 6],
  ["Return", 4 / 6],
  ["End", 5 / 6],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 260 + 6 * (W + 4), height: 900 }, deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0;background:#070707;color:#f4f1ea;font:13px system-ui"><div id=root></div><script>${js}</script></body></html>`);
const slugs = await page.evaluate((only) => EM.EXERCISES.map((e) => e.slug).filter((s) => !only.length || only.includes(s)), only);
const index = {};
for (let i = 0; i < slugs.length; i += per) {
  const group = slugs.slice(i, i + per);
  const sheet = String(i / per + 1).padStart(2, "0");
  await page.evaluate(
    ({ group, PHASES, W, H }) => {
      const root = document.getElementById("root");
      root.innerHTML = "";
      const head = document.createElement("div");
      head.style.cssText = `display:grid;grid-template-columns:230px repeat(6,${W}px);gap:4px;padding:6px 8px;color:#c9a54c;font-weight:600`;
      head.innerHTML = "<div>Exercise</div>" + PHASES.map(([l]) => `<div>${l}</div>`).join("");
      root.append(head);
      for (const slug of group) {
        const e = EM.EXERCISES.find((x) => x.slug === slug);
        const meta = { slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed };
        const def = EM.getMotion(slug, meta);
        const row = document.createElement("div");
        row.style.cssText = `display:grid;grid-template-columns:230px repeat(6,${W}px);gap:4px;padding:4px 8px;border-top:1px solid #2b2824;align-items:center`;
        const label = document.createElement("div");
        label.innerHTML = `<b>${e.name}</b><br><span style="color:#a8a299">${slug} · ${def.view} view</span>`;
        row.append(label);
        for (const [, phase] of PHASES) {
          const c = document.createElement("canvas");
          c.style.cssText = `width:${W}px;height:${H}px;background:#111010;border-radius:6px`;
          row.append(c);
          EM.drawExerciseStill(c, slug, { meta, phase, width: W, height: H });
        }
        root.append(row);
      }
    },
    { group, PHASES, W, H },
  );
  const file = join(outDir, `sheet-${sheet}.png`);
  await page.locator("#root").screenshot({ path: file });
  group.forEach((s, r) => (index[s] = { sheet: `sheet-${sheet}.png`, row: r + 1 }));
  console.log(file, group.join(", "));
}
writeFileSync(join(outDir, "index.json"), JSON.stringify(index, null, 1));
await browser.close();
