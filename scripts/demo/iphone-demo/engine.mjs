// Bundles the app's own 2D exercise engine and exercise list for the demo viewer, as the NGF global: the exercise
// demonstrations in the demo play live with the same code and options the app uses (src/components/train/exercise-demo.tsx).
//   node scripts/demo/iphone-demo/engine.mjs <out dir>      → <out>/ngf.js (build.py puts it in the page)
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const out = process.argv[2];
if (!out) throw new Error("usage: node engine.mjs <out dir>");
const r = await build({
  stdin: {
    contents: 'export { mountExerciseMotion, drawExerciseStill, highlightFor, getMotion } from "@/lib/exercise-motion";\nexport { EXERCISES } from "@/data/exercises";\n',
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "NGF",
  write: false,
  platform: "browser",
  alias: { "@": path.join(root, "src") },
  logLevel: "warning",
});
const js = r.outputFiles[0].text;
if (js.includes("</script")) throw new Error("the bundle contains </script and cannot be inlined");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "ngf.js"), js);
console.log(`ngf.js ${(js.length / 1e3).toFixed(0)} kB`);
