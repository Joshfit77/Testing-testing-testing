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
  const list = (k) => [...(blk.match(new RegExp(`\\b${k}: \\[([\\s\\S]*?)\\]`))?.[1] ?? "").matchAll(/"((?:[^"\\\\]|\\\\.)*)"/g)].map((x) => x[1].replace(/\\"/g, '"'));
  rows.push({ slug, name: str("name"), category: str("category"), pattern: str("pattern"), equipment: list("equipment"), primary: list("primary"), secondary: list("secondary"), timed: /\btimed: true/.test(blk), instructions: list("instructions"), cues: list("cues"), mistakes: list("mistakes") });
}
if (rows.length !== 157) console.warn(`expected 157 exercises, found ${rows.length}`);

// Camera and length rules by movement pattern and category; the sheet is a starting point the reviewer can override.
const CAMERA = { hinge: "side", squat: "three-quarter front", horizontal_push: "low three-quarter side", horizontal_pull: "side", vertical_push: "three-quarter front", vertical_pull: "three-quarter front", isolation: "three-quarter front", carry: "side, walking toward camera-right", rotation: "three-quarter front", core: "side", power: "side", conditioning: "side", mobility: "three-quarter front", cardio: "side", lunge: "three-quarter front" };
const seconds = (r) => (r.category === "cardio" || r.category === "conditioning" ? "5-8" : r.pattern === "power" ? "4-6" : r.category === "mobility" ? "5-6" : r.pattern === "carry" ? "6-8" : "3-5");
const loop = (r) => !(r.pattern === "carry" || r.category === "cardio");

const demo = (slug) => manifest.demos[slug] ?? null;
const meta = (slug) => (fs.existsSync(path.join(SRC, slug, "meta.json")) ? JSON.parse(fs.readFileSync(path.join(SRC, slug, "meta.json"), "utf8")) : {});
const V = (x, dflt) => (x && String(x).trim()) || dflt;
// The owner's tracker: COMPLETED only with a real moving clip whose character, form, equipment, highlighting and
// playback were checked and passed; FAILED when a clip exists but a check failed (or meta.json says so); MISSING when
// there is no moving clip. Owner approval is its own column and never implied.
const BLOCKED = "No clip yet. Generating one needs a video model that keeps the approved athlete; none can run or be reached from this environment (no GPU or ML runtime; model hosts and video generators blocked by its network policy; $0 budget). Needs a clip generated with the owner's own tools.";
const status = rows.map((r) => {
  const d = demo(r.slug), mt = meta(r.slug), rv = d?.review ?? mt.review ?? {};
  const moves = d ? Boolean(d.mp4 || d.webm) : false;
  const checks = ["character", "form", "equipment", "highlighting", "playback"];
  const failedCheck = checks.find((k) => rv[k] === "FAIL");
  const allPass = checks.every((k) => rv[k] === "PASS");
  // Both speeds are required: the normal clip and its 0.5x file (the build makes it), plus the frames for scrubbing.
  const halfSpeed = Boolean(d && (d.slow?.mp4 || d.slow?.webm));
  const touch = Boolean(d?.scrub?.count);
  const tracker = !moves ? "MISSING" : mt.tracker === "FAILED" || failedCheck || !halfSpeed || !touch ? "FAILED" : allPass ? "COMPLETED" : "FAILED";
  const reason = !moves ? BLOCKED : tracker === "FAILED" ? mt.trackerReason ?? (failedCheck ? `${failedCheck} check failed` : !halfSpeed ? "no 0.5x version (rebuild with build.mjs)" : !touch ? "no scrub frames (rebuild with build.mjs)" : "not every check has passed yet") : "";
  return {
    ...r,
    tracker,
    reason,
    asset: d ? (moves ? "YES" : "STILL ONLY") : "NO",
    normal: moves ? "YES" : "NO",
    half: halfSpeed ? "YES" : "NO",
    touch: touch ? "YES" : "NO",
    views: d ? 1 + (d.angles?.length ?? 0) : 0,
    status: d?.status ?? "",
    version: d?.version ?? "",
    character: d ? V(rv.character, "NOT REVIEWED") : "-",
    form: d ? V(rv.form, "NOT REVIEWED") : "-",
    equipmentCheck: d ? V(rv.equipment, "NOT REVIEWED") : "-",
    highlighting: d ? V(rv.highlighting, "NOT REVIEWED") : "-",
    playback: d ? (moves ? V(rv.playback, "NOT TESTED") : "NO VIDEO") : "-",
    mobile: d ? V(rv.mobile, "NOT TESTED") : "-",
    owner: d?.status === "approved" ? "APPROVED" : "PENDING",
    complete: tracker === "COMPLETED",
  };
});
const n = (f) => status.filter(f).length;
const counts = { exercises: status.length, completed: n((s) => s.tracker === "COMPLETED"), failed: n((s) => s.tracker === "FAILED"), missing: n((s) => s.tracker === "MISSING"), withVideo: n((s) => s.asset === "YES"), approved: n((s) => s.owner === "APPROVED") };
const md = [];
md.push("# 2.5D exercise demonstrations: library status", "", `Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/exercise-demos/status.mjs\` from the manifest and each source folder's meta.json.`, "", "**COMPLETED** = a real moving clip in the app, at normal speed and as a 0.5× file, with frames for finger scrubbing, whose character, form, equipment, highlighting and playback were checked and passed. **FAILED** = a clip exists but a check failed. **MISSING** = no moving clip yet. Owner approval is separate and never implied. Physical-iPhone testing is listed separately.", "");
md.push(`| Exercises | COMPLETED | FAILED | MISSING | Moving clip in the app | Owner approved |`, `| --- | --- | --- | --- | --- | --- |`, `| ${counts.exercises} | ${counts.completed} | ${counts.failed} | ${counts.missing} | ${counts.withVideo} | ${counts.approved} |`, "");
const notMissing = status.filter((s) => s.tracker !== "MISSING");
if (notMissing.length) {
  md.push("## Exercises with a clip", "", "| Exercise | Tracker | Normal | 0.5× | Finger scrub | Views | Character | Form | Equipment | Highlighting | Playback | iPhone | Owner | Reason |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const s of notMissing) md.push(`| ${s.name} (\`${s.slug}\`) | **${s.tracker}** | ${s.normal} | ${s.half} | ${s.touch} | ${s.views} | ${s.character} | ${s.form} | ${s.equipmentCheck} | ${s.highlighting} | ${s.playback} | ${s.mobile} | ${s.owner} | ${s.reason || "-"} |`);
  md.push("");
}
md.push("## Missing (blocked)", "", `Every exercise below is **MISSING** for the same reason: ${BLOCKED} Its ready-to-paste prompt is in \`assets/exercise-demos-src/PROMPTS.md\`; until its clip passes, the app keeps showing its existing animated illustration.`, "", "| # | Exercise | Category | Equipment |", "| --- | --- | --- | --- |");
status.filter((s) => s.tracker === "MISSING").forEach((s, i) => md.push(`| ${i + 1} | ${s.name} (\`${s.slug}\`) | ${s.category} | ${s.equipment.join(", ") || "none"} |`));
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
// Ready-to-paste prompts, one per exercise, built from the app's own instructions, cues and mistakes, with the curl's
// lessons written in (one continuous take, solid equipment, slower lowering, same start and end pose).
const CHARACTER = "Same athlete as the attached reference image: identical face, short dark hair, muscular build and proportions, dark graphite skin with metallic gold anatomical outlines, black fitted athletic shorts, black training shoes, matte black studio background, dramatic rim lighting.";
const RULES = "One continuous take: camera locked, no zoom, no pan, no cuts. Equipment is realistic, solid, the same size and shape in every frame, and stays in his hands (no blur trails, no doubled edges). Smooth and controlled: the lowering or return is slower than the effort. The clip starts and ends in the same position so it loops. No text, no logos, no other people.";
const sentence = (xs) => xs.map((x) => x.replace(/\.$/, "")).join("; ");
const prompts = ["# Generation prompts: all 157 exercises", "", "Numbered as in the app (and the owner's list of 157). Paste one prompt per clip, attach `assets/exercise-demos-src/_character/character-reference.png` every time, and save the result as `<slug>.mp4`. Length in the sheet (`SHEET.md`); 5 s suits most single repetitions. Reject any take where the face, hair, build, shorts or equipment change, the equipment blurs into two, a limb bends the wrong way, or the camera moves.", "", "Make only the normal-speed clip: the pipeline makes the 0.5× version from the same frames and the frames for finger scrubbing. A second camera view is optional: the same prompt with the camera changed (the sheet suggests which), saved as `<slug>.side.mp4` or `<slug>.front.mp4`.", ""];
rows.forEach((r, i) => {
  const cam = CAMERA[r.pattern] ?? CAMERA[r.category] ?? "three-quarter front";
  // Supporting equipment (a rack, a bench, a box) is part of the scene; the rest are alternatives: show the first.
  const SUPPORT = new Set(["rack", "bench", "box", "plyo box", "pull-up bar", "dip bars", "mat", "wall", "track", "platform"]);
  const kit = r.equipment.filter((e) => e !== "bodyweight");
  const main = kit.filter((e) => !SUPPORT.has(e));
  const support = kit.filter((e) => SUPPORT.has(e));
  const equip = kit.length ? `Equipment: a realistic ${[main[0], ...support].filter(Boolean).join(" and a ")}.` : "No equipment (bodyweight).";
  // The last two instructions are the movement; earlier ones are setup, already done when the clip starts.
  const steps = r.instructions;
  const setup = steps.length >= 4 ? steps.slice(0, -2) : [];
  const move = steps.length >= 4 ? steps.slice(-2) : steps;
prompts.push(`## ${i + 1}. ${r.name} (\`${r.slug}\`)`, "", "```", `${CHARACTER} ${equip} Camera: ${cam}, full body, eye level.`, `${setup.length ? `Already in position when the clip starts: ${sentence(setup)}. ` : ""}He performs ${r.timed || r.category === "cardio" ? "the" : "one slow, controlled repetition of the"} ${r.name}: ${sentence(move)}.`, `Form: ${sentence(r.cues)}. Avoid: ${sentence(r.mistakes)}.`, `The ${r.primary.join(", ")} glow warm gold as they work${r.secondary.length ? `; the ${r.secondary.join(", ")} a subtler gold` : ""}; the rest of his body stays dark graphite.`, RULES, "```", "");
});
fs.writeFileSync(path.join(SRC, "PROMPTS.md"), prompts.join("\n"));
const jsonOut = process.argv.indexOf("--json") >= 0 ? process.argv[process.argv.indexOf("--json") + 1] : null;
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ counts, rows: status }, null, 1));
console.log(`${counts.exercises} exercises: ${counts.completed} COMPLETED, ${counts.failed} FAILED, ${counts.missing} MISSING; ${counts.approved} owner-approved → docs/EXERCISE_DEMOS_STATUS.md, assets/exercise-demos-src/SHEET.md, PROMPTS.md`);
