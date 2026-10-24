/**
 * Fingerprint of every exercise's animation, to prove that a change to the motion engine or one exercise leaves the
 * others untouched. Each exercise's loop is evaluated at 72 evenly spaced times and every landmark, joint angle and
 * prop position is rounded and hashed.
 *
 *   node scripts/exercise-review/fingerprint.mjs --out=before.json
 *   node scripts/exercise-review/fingerprint.mjs --compare=before.json     # lists exercises whose animation changed
 *
 * Needs only esbuild (no browser).
 */
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const out = args.find((a) => a.startsWith("--out="))?.slice(6);
const compare = args.find((a) => a.startsWith("--compare="))?.slice(10);
const root = resolve(args.find((a) => a.startsWith("--root="))?.slice(7) ?? join(here, "../.."));
const SAMPLES = 72;

const tmp = mkdtempSync(join(tmpdir(), "fingerprint-"));
const file = join(tmp, "bundle.mjs");
await build({
  stdin: {
    contents: `export { getMotion, compileMotion, evaluate } from "./src/lib/exercise-motion"; export { EXERCISES } from "./src/data/exercises";`,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: file,
  alias: { "@": join(root, "src") },
  logLevel: "silent",
});
const m = await import(pathToFileURL(file).href);

const r = (v) => (typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v);
const result = {};
for (const e of m.EXERCISES) {
  const def = m.getMotion(e.slug, { slug: e.slug, name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed });
  const c = m.compileMotion(def);
  const h = createHash("sha1");
  for (let k = 0; k < SAMPLES; k++) {
    const f = m.evaluate(c, (k / SAMPLES) * c.duration);
    h.update(JSON.stringify([Object.entries(f.pts).map(([n, p]) => [n, r(p[0]), r(p[1])]), Object.entries(f.pose).map(([n, v]) => [n, r(v)]), f.props.map((p) => [p.def.id, r(p.at[0]), r(p.at[1]), p.layer ?? null]), r(f.alpha), r(f.cameraX)]));
  }
  result[e.slug] = { hash: h.digest("hex").slice(0, 16), view: def.view, duration: r(c.duration), keyframes: def.keyframes.length };
}
if (out) {
  writeFileSync(out, JSON.stringify(result, null, 1));
  console.log(`wrote ${out}: ${Object.keys(result).length} exercises`);
}
if (compare) {
  const before = JSON.parse(readFileSync(compare, "utf8"));
  const changed = Object.keys(result).filter((s) => !before[s] || before[s].hash !== result[s].hash);
  const gone = Object.keys(before).filter((s) => !result[s]);
  console.log(`${Object.keys(result).length} exercises compared; unchanged: ${Object.keys(result).length - changed.length}`);
  console.log(changed.length ? `changed (${changed.length}): ${changed.join(", ")}` : "changed: none");
  if (gone.length) console.log(`missing now: ${gone.join(", ")}`);
}
if (!out && !compare) console.log(JSON.stringify(result, null, 1));
