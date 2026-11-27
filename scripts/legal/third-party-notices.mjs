// Writes public/third-party-notices.txt: the name, version, declared licence and licence text of every production
// dependency (package-lock.json entries that are not dev-only), read from node_modules. Run after any dependency
// change:  node scripts/legal/third-party-notices.mjs
// Packages listed in the lockfile but not installed on this machine (other platforms' optional binaries) are listed
// by name and declared licence without text. This file is an inventory, not a statement of legal compliance.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const rows = [];
for (const [path, meta] of Object.entries(lock.packages ?? {})) {
  if (!path.startsWith("node_modules/") || meta.dev || meta.devOptional) continue;
  const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
  const dir = join(root, path);
  let license = typeof meta.license === "string" ? meta.license : "";
  let text = "";
  if (existsSync(join(dir, "package.json"))) {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    if (typeof pkg.license === "string") license = pkg.license;
    const file = readdirSync(dir).find((f) => /^(licen[sc]e|copying|notice)(\.|$)/i.test(f));
    if (file) text = readFileSync(join(dir, file), "utf8").replace(/\r\n/g, "\n").trim();
  }
  rows.push({ name, version: meta.version ?? "", license: license || "not declared", text });
}
rows.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const seen = new Set();
const unique = rows.filter((r) => (seen.has(`${r.name}@${r.version}`) ? false : seen.add(`${r.name}@${r.version}`)));

const line = "=".repeat(78);
const out = [
  "Narrow Gate Fitness: third-party software notices",
  "",
  "The open-source packages this application is built with, each with its declared licence and, where the package",
  "ships one, its licence text. Generated from package-lock.json by scripts/legal/third-party-notices.mjs.",
  `Packages: ${unique.length}.`,
  "",
];
for (const r of unique) {
  out.push(line, `${r.name} ${r.version}`, `Licence: ${r.license}`, line, "");
  out.push(r.text || "(No licence file in the installed package; see the package's repository for the licence text.)", "");
}
// The four bundled typefaces (src/app/fonts), with the SIL Open Font License text and copyright lines shipped beside them.
out.push(line, "Fonts: Inter, Plus Jakarta Sans, Cinzel, Lora", "Licence: SIL Open Font License 1.1", line, "", readFileSync(join(root, "src", "app", "fonts", "OFL.txt"), "utf8").replace(/\r\n/g, "\n").trim(), "");
writeFileSync(join(root, "public", "third-party-notices.txt"), out.join("\n"));
console.log(`third-party-notices.txt: ${unique.length} packages, ${unique.filter((r) => !r.text).length} without a licence file`);
