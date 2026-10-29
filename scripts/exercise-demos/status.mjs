// The 2.5D library's status, one row per exercise, from src/data/exercises.ts, the manifest and each source folder's
// meta.json: docs/EXERCISE_DEMOS_STATUS.md (and --json). Also writes the generation sheet for every exercise
// (assets/exercise-demos-src/SHEET.md): equipment, muscles to highlight, camera, length, loop, in the order to make them.
//   node scripts/exercise-demos/status.mjs [--json out.json]
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const src = fs.readFileSync(path.join(ROOT, "src/data/exercises.ts"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/exercise-demos.json"), "utf8"));
const SRC = path.join(ROOT, "assets/exercise-demos-src");
const rows = [];
for (const m of src.matchAll(/\{\s*slug: "([^"]+)",([\s\S]*?)\n  \},/g)) {
  const [, slug, blk] = m;
  const str = (k) => blk.match(new RegExp(`\\b${k}: "([^"]+)"`))?.[1] ?? "";
  const list = (k) => [...(blk.match(new RegExp(`\\b${k}: \\[([^\\]]*)\\]`))?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  rows.push({ slug, name: str("name"), category: str("category"), pattern: str("pattern"), equipment: list("equipment"), primary: list("primary"), secondary: list("secondary"), timed: /\btimed: true/.test(blk) });
}
if (rows.length !== 157) console.warn(`expected 157 exercises, found ${rows.length}`);

// Camera and length rules by movement pattern and category; the sheet is a starting point the reviewer can override.
const CAMERA = { hinge: "side", squat: "three-quarter front", horizontal_push: "low three-quarter side", horizontal_pull: "side", vertical_push: "three-quarter front", vertical_pull: "three-quarter front", isolation: "three-quarter front", carry: "side, walking toward camera-right", rotation: "three-quarter front", core: "side", power: "side", conditioning: "side", mobility: "three-quarter front", cardio: "side", lunge: "three-quarter front" };
const seconds = (r) => (r.category === "cardio" || r.category === "conditioning" ? "5-8" : r.pattern === "power" ? "4-6" : r.category === "mobility" ? "5-6" : r.pattern === "carry" ? "6-8" : "3-5");
const loop = (r) => !(r.pattern === "carry" || r.category === "cardio");

const demo = (slug) => manifest.demos[slug] ?? null;
const meta = (slug) => (fs.existsSync(path.join(SRC, slug, "meta.json")) ? JSON.parse(fs.readFileSync(path.join(SRC, slug, "meta.json"), "utf8")) : {});
const V = (x, dflt) => (x && String(x).trim()) || dflt;
const status = rows.map((r) => {
  const d = demo(r.slug), mt = meta(r.slug), rv = d?.review ?? mt.review ?? {};
  const moves = d ? Boolean(d.mp4 || d.webm) : false;
  return {
    ...r,
    asset: d ? (moves ? "YES" : "STILL ONLY") : "NO",
    status: d?.status ?? "",
    version: d?.version ?? "",
    angles: d ? 1 + (d.angles?.length ?? 0) : 0,
    character: d ? V(rv.character, "NOT REVIEWED") : "-",
    form: d ? V(rv.form, "NOT REVIEWED") : "-",
    equipmentCheck: d ? V(rv.equipment, "NOT REVIEWED") : "-",
    highlighting: d ? V(rv.highlighting, "NOT REVIEWED") : "-",
    playback: d ? (moves ? V(rv.playback, "NOT TESTED") : "NO VIDEO") : "-",
    mobile: d ? V(rv.mobile, "NOT TESTED") : "-",
    owner: d?.status === "approved" ? "APPROVED" : "PENDING",
    complete: Boolean(d && moves && d.status === "approved" && ["character", "form", "equipment", "highlighting", "playback", "mobile"].every((k) => rv[k] === "PASS")),
  };
});
const n = (f) => status.filter(f).length;
const counts = { exercises: status.length, withVideo: n((s) => s.asset === "YES"), stillOnly: n((s) => s.asset === "STILL ONLY"), none: n((s) => s.asset === "NO"), approved: n((s) => s.owner === "APPROVED"), complete: n((s) => s.complete) };
const md = [];
md.push("# 2.5D exercise demonstrations: library status", "", `Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/exercise-demos/status.mjs\` from the manifest and each source folder's meta.json. An exercise is complete only with a real moving clip, every check PASS and the owner's approval.`, "");
md.push(`| Exercises | Moving clip | Still only | No asset | Owner approved | Complete |`, `| --- | --- | --- | --- | --- | --- |`, `| ${counts.exercises} | ${counts.withVideo} | ${counts.stillOnly} | ${counts.none} | ${counts.approved} | ${counts.complete} |`, "");
md.push("| Exercise | Asset | Status | Character | Form | Equipment | Highlighting | Playback | Mobile | Owner |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const s of status) md.push(`| ${s.name} (\`${s.slug}\`) | ${s.asset} | ${s.status || "-"} | ${s.character} | ${s.form} | ${s.equipmentCheck} | ${s.highlighting} | ${s.playback} | ${s.mobile} | ${s.owner} |`);
fs.writeFileSync(path.join(ROOT, "docs/EXERCISE_DEMOS_STATUS.md"), md.join("\n") + "\n");

// The generation sheet, in the order to make them: the curl first (the method's proof), then the owner's phase-1 ten,
// then the rest grouped by equipment so the same props carry across a batch.
const FIRST = ["dumbbell-curl", "back-squat", "push-up", "seated-cable-row", "kettlebell-swing", "zone-2-run", "sled-push", "triceps-pushdown", "lateral-raise", "inverted-row"];
const order = [...FIRST.map((s) => rows.find((r) => r.slug === s)).filter(Boolean), ...rows.filter((r) => !FIRST.includes(r.slug)).sort((a, b) => (a.equipment[0] ?? "").localeCompare(b.equipment[0] ?? "") || a.pattern.localeCompare(b.pattern) || a.name.localeCompare(b.name))];
const sheet = ["# Generation sheet: all 157 exercises", "", "Same athlete, same prompt template (docs/EXERCISE_DEMOS_25D.md §3); only the exercise block changes. Make them in this order; the curl proves the method before anything else is rendered.", "", "| # | Exercise | Equipment (render the first; the rest are substitutes) | Glow: primary | Subtle: secondary | Camera | Length (s) | Loop | Second angle |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
order.forEach((r, i) => {
  const cam = CAMERA[r.pattern] ?? CAMERA[r.category] ?? "three-quarter front";
  const second = r.category === "cardio" ? "" : /^side/.test(cam) ? "front" : "side";
  sheet.push(`| ${i + 1} | ${r.name} (\`${r.slug}\`) | ${r.equipment.join(", ") || "none"} | ${r.primary.join(", ")} | ${r.secondary.join(", ") || "-"} | ${cam} | ${seconds(r)} | ${loop(r) ? "yes" : "no (one pass)"} | ${second || "-"} |`);
});
fs.mkdirSync(SRC, { recursive: true });
fs.writeFileSync(path.join(SRC, "SHEET.md"), sheet.join("\n") + "\n");
const jsonOut = process.argv.indexOf("--json") >= 0 ? process.argv[process.argv.indexOf("--json") + 1] : null;
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ counts, rows: status }, null, 1));
console.log(`${counts.exercises} exercises: ${counts.withVideo} with a moving clip, ${counts.stillOnly} still only, ${counts.none} without an asset, ${counts.approved} approved, ${counts.complete} complete → docs/EXERCISE_DEMOS_STATUS.md, assets/exercise-demos-src/SHEET.md`);
