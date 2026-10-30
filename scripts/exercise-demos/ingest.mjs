// Takes in generated exercise clips: a folder (or .zip) of files named <slug>.mp4 (any of mp4/mov/webm/m4v).
// For each: checks the slug is one of the app's exercises, keeps the file as original-owner.<ext>, makes the app copy
// graded to the approved character (scripts/exercise-demos/correct.py, whole clip, no motion added), analyses it for
// frame jumps and its loop seam, writes meta.json (status "review", tracker FAILED "not reviewed yet" until a reviewer
// checks the timeline sheet and records the verdicts), then rebuilds the manifest and the status table.
//   node scripts/exercise-demos/ingest.mjs <folder-or-zip> [--no-grade]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const input = process.argv[2];
const noGrade = process.argv.includes("--no-grade");
if (!input) { console.error("usage: node scripts/exercise-demos/ingest.mjs <folder-or-zip> [--no-grade]"); process.exit(2); }
const SRC = path.join(ROOT, "assets/exercise-demos-src");
const slugs = new Set([...fs.readFileSync(path.join(ROOT, "src/data/exercises.ts"), "utf8").matchAll(/\n\s{4}slug: "([^"]+)"/g)].map((m) => m[1]));
let dir = input;
if (input.endsWith(".zip")) {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "ingest-"));
  // Python's zipfile refuses absolute paths and ".." entries are checked below; only video files are used.
  execFileSync("python3", ["-I", "-c", "import sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nfor i in z.infolist():\n    assert not i.filename.startswith('/') and '..' not in i.filename, i.filename\nz.extractall(sys.argv[2])", input, dir]);
}
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(mp4|mov|webm|m4v)$/i.test(f) && !f.startsWith(".")) files.push(p); } };
walk(dir);
const report = [];
for (const file of files) {
  const slug = path.basename(file).replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  if (!slugs.has(slug)) { report.push(`${path.basename(file)}: not an exercise slug in the app; skipped`); continue; }
  const dest = path.join(SRC, slug);
  fs.mkdirSync(dest, { recursive: true });
  const ext = path.extname(file).toLowerCase();
  fs.copyFileSync(file, path.join(dest, `original-owner${ext}`));
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file]).toString());
  const v = probe.streams.find((s) => s.codec_type === "video");
  const an = execFileSync("python3", ["-I", path.join(ROOT, "scripts/exercise-demos/correct.py"), "analyze", file, path.join(dest, "review")]).toString();
  const seam = Number(an.match(/loop seam \(last vs first\) ([\d.]+)/)?.[1] ?? 99);
  const med = Number(an.match(/median step ([\d.]+)/)?.[1] ?? 1);
  const jumps = an.match(/jumps \(frame n -> n\+1\): (.*)/)?.[1] ?? "?";
  execFileSync("python3", ["-I", path.join(ROOT, "scripts/exercise-demos/correct.py"), "make", file, path.join(dest, "loop.mp4"), "--crossfade", "0", ...(noGrade ? ["--no-grade"] : [])]);
  const loops = seam <= Math.max(4, 2 * med);
  const meta = {
    status: "review", version: 1,
    source: `Owner-supplied ${path.basename(file)} (${v.width}x${v.height}, ${Number(probe.format.duration).toFixed(2)} s), ingested ${new Date().toISOString().slice(0, 10)}${noGrade ? "" : ", graded toward character-reference.png"}`,
    fit: "native", encode: "copy", loop: loops,
    highlighted: [], note: "New demonstration, awaiting the owner's review.",
    review: { character: "", form: "NOT REVIEWED", equipment: "", highlighting: "", playback: "", mobile: "NOT TESTED" },
    tracker: "FAILED", trackerReason: "Not reviewed yet: see review/timeline.png.",
    analysis: { jumps, seam, medianStep: med },
  };
  fs.writeFileSync(path.join(dest, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  report.push(`${slug}: ingested (${v.width}x${v.height}, ${Number(probe.format.duration).toFixed(1)} s); jumps ${jumps}; seam ${seam} → ${loops ? "loops" : "plays once with Replay"}; review sheet ${path.relative(ROOT, path.join(dest, "review/timeline.png"))}`);
}
console.log(report.join("\n") || "no video files found");
execFileSync("node", [path.join(ROOT, "scripts/exercise-demos/build.mjs"), SRC], { stdio: "inherit" });
execFileSync("node", [path.join(ROOT, "scripts/exercise-demos/status.mjs")], { stdio: "inherit" });
