/**
 * Bakes the anatomical rig's exercise motions: each exercise solved offline at 30 frames a second, so the player only
 * interpolates between stored poses (src/lib/anatomy3d/motion3d/bake.ts).
 *
 *   npx tsx scripts/anatomy/bake-motions.mts [slug ...]     (default: every exercise with its own 3D spec)
 *
 * Writes public/anatomy/bake/<slug>.ngb and public/anatomy/bake/index.json (frames, size, duration per exercise).
 * Re-run after changing the rig, the solver or a spec: a bake is only as current as the code that made it.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { EXERCISES } from "../../src/data/exercises";
import { Skeleton3, type RigMeta } from "../../src/lib/anatomy3d/body/skeleton";
import { bake, encodeBaked } from "../../src/lib/anatomy3d/motion3d/bake";
import { makePerformer } from "../../src/lib/anatomy3d/motion3d/perform";
import { SPECS, specFor } from "../../src/lib/anatomy3d/motion3d/specs";

const meta = JSON.parse(readFileSync("public/anatomy/ecorche-rig.json", "utf8")) as RigMeta;
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SPECS);
const dir = "public/anatomy/bake";
mkdirSync(dir, { recursive: true });
let index: Record<string, { frames: number; bytes: number; duration: number }> = {};
try {
  index = JSON.parse(readFileSync(`${dir}/index.json`, "utf8"));
} catch {
  // (first bake)
}
for (const slug of slugs) {
  const ex = EXERCISES.find((e) => e.slug === slug);
  if (!ex) {
    console.warn(`unknown exercise ${slug}`);
    continue;
  }
  const sk = new Skeleton3(meta);
  const perf = makePerformer(sk, ex, specFor(slug));
  const t0 = Date.now();
  const b = bake(slug, perf, sk);
  const bytes = encodeBaked(b);
  writeFileSync(`${dir}/${slug}.ngb`, bytes);
  index[slug] = { frames: b.frames, bytes: bytes.length, duration: +b.duration.toFixed(4) };
  console.log(`${slug.padEnd(34)} ${b.frames} frames, ${(bytes.length / 1024).toFixed(0)} KB, settled to ${b.settled.toFixed(2)}°, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (b.settled >= 0.5) console.warn(`  ${slug}: its loops did not settle (${b.settled.toFixed(1)}° between the last two); the loop may jump where it wraps`);
}
writeFileSync(`${dir}/index.json`, JSON.stringify(index, null, 1));
