/**
 * The state of every exercise's 3D demonstration, from the code and the files themselves (nothing hand-counted):
 *
 *   npx tsx scripts/anatomy/library-status.mts [--qa <dir with check-motion logs>] [--json <file>] [--out docs/anatomy3d/LIBRARY_STATUS.md]
 *
 * Per exercise in src/data/exercises.ts: whether it has its own 3D motion (a spec in motion3d/specs.ts) or only the
 * generic lift of the 2D motion (no equipment, hands free: a placeholder, not a demonstration); whether it has a baked
 * motion (public/anatomy/bake); the automated QA result from the logs given (pass, FAIL with what failed, or NOT TESTED);
 * the visual review and the owner's approval from docs/anatomy3d/review.json; and whether the app shows it as the 3D
 * figure (src/lib/anatomy3d/in-app.ts) or the animated illustration. The proposed additions (EXERCISES_300.md) are
 * counted separately and never mixed in.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { EXERCISES } from "../../src/data/exercises";
import { hasSpec } from "../../src/lib/anatomy3d/motion3d/specs";
import { existsSync } from "node:fs";
// The allowlist of exercises the app shows as the 3D figure lives on the integration branch (claude/3d-in-workout:
// src/lib/anatomy3d/in-app.ts). On a branch without it (the 3D branch itself, PR #8) nothing is wired into the app, and
// the status says so rather than reading a file that is not there.
const IN_APP_FILE = "src/lib/anatomy3d/in-app.ts";
const IN_APP_3D: readonly string[] = existsSync(IN_APP_FILE) ? ((await import("../../" + IN_APP_FILE)) as { IN_APP_3D: readonly string[] }).IN_APP_3D : [];
const IN_APP_NOTE = existsSync(IN_APP_FILE)
  ? `read from \`${IN_APP_FILE}\` on this branch`
  : `\`${IN_APP_FILE}\` is not on this branch: nothing is wired into the app here; the integration lives on \`claude/3d-in-workout\``;

const args = process.argv.slice(2);
const opt = (name: string, d: string) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return d;
  const v = args[i + 1]!;
  args.splice(i, 2);
  return v;
};
const QA_DIR = opt("qa", "");
const JSON_OUT = opt("json", "");
const OUT = opt("out", "docs/anatomy3d/LIBRARY_STATUS.md");

interface Review {
  /** Who looked, and when (the visual review is not the owner's approval). */
  reviewer: string;
  date: string;
  eye: Record<string, { verdict: "pass" | "minor" | "fail" | "not checked"; note?: string }>;
  /** The owner's approvals of a rendered motion, by slug: the date and words. None means none. */
  owner_approval: Record<string, { date: string; note: string }>;
}
const review: Review = JSON.parse(readFileSync("docs/anatomy3d/review.json", "utf8"));
const bakeIndex: Record<string, { frames: number; bytes: number; duration: number }> = existsSync("public/anatomy/bake/index.json")
  ? JSON.parse(readFileSync("public/anatomy/bake/index.json", "utf8"))
  : {};

/** The QA log lines: "<slug> <pass|FAIL>  contact … baked … err …  stretched: …; collapsed: …". */
interface QA {
  verdict: "PASS" | "FAIL";
  samples?: number;
  findings: string[];
}
const qa = new Map<string, QA>();
if (QA_DIR && existsSync(QA_DIR)) {
  for (const f of readdirSync(QA_DIR).filter((f) => f.endsWith(".log"))) {
    const text = readFileSync(`${QA_DIR}/${f}`, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^(\S+)\s+(pass|FAIL)\s+(.*)$/);
      if (!m) continue;
      const [, slug, v, rest] = m;
      const tail = rest!.replace(/^contact.*?piece [\d.]+cm\s*/, "").trim();
      const findings = tail ? tail.split(/;\s*/).map((s) => s.trim()).filter(Boolean) : [];
      qa.set(slug!, { verdict: v === "pass" ? "PASS" : "FAIL", findings });
    }
  }
}

/** The proposed additions, counted per section of EXERCISES_300.md (the "Note" section holds no exercises). */
function proposedCounts(): { total: number; sections: { name: string; count: number }[] } {
  const text = readFileSync("docs/anatomy3d/EXERCISES_300.md", "utf8");
  const sections: { name: string; count: number }[] = [];
  let current: { name: string; count: number } | null = null;
  for (const line of text.split("\n")) {
    const h = line.match(/^## (.+)$/);
    if (h) {
      current = /^Note/.test(h[1]!) ? null : { name: h[1]!, count: 0 };
      if (current) sections.push(current);
      continue;
    }
    if (current && line.startsWith("- ")) current.count++;
  }
  return { total: sections.reduce((a, s) => a + s.count, 0), sections };
}

type Row = {
  slug: string;
  name: string;
  category: string;
  motion: "own" | "generic";
  bake: { frames: number; duration: number } | null;
  qa: QA | null;
  eye: Review["eye"][string] | null;
  owner: Review["owner_approval"][string] | null;
  inApp: "3d" | "illustration";
  /** The one-word result the owner asked for. */
  result: "PASS" | "POLISH NEEDED" | "FAIL" | "NOT TESTED";
};

const rows: Row[] = EXERCISES.map((e) => {
  const own = hasSpec(e.slug);
  const q = qa.get(e.slug) ?? null;
  const eye = review.eye[e.slug] ?? null;
  const owner = review.owner_approval[e.slug] ?? null;
  // PASS needs the automated checks and the visual review both passing (a minor visual note still counts as a pass of
  // the automated line, but is named); FAIL when either fails; everything else is NOT TESTED.
  // (POLISH NEEDED: the automated checks pass and the movement reads right, but the reviewer saw a visible defect; it
  // is not counted as approved.)
  let result: Row["result"] = "NOT TESTED";
  if (own && q && eye && eye.verdict !== "not checked") result = q.verdict !== "PASS" || eye.verdict === "fail" ? "FAIL" : eye.verdict === "minor" ? "POLISH NEEDED" : "PASS";
  else if (own && q && q.verdict === "FAIL") result = "FAIL";
  else if (own && eye && eye.verdict === "fail") result = "FAIL";
  return {
    slug: e.slug,
    name: e.name,
    category: e.category,
    motion: own ? "own" : "generic",
    bake: bakeIndex[e.slug] ? { frames: bakeIndex[e.slug]!.frames, duration: bakeIndex[e.slug]!.duration } : null,
    qa: q,
    eye,
    owner,
    inApp: IN_APP_3D.includes(e.slug) ? "3d" : "illustration",
    result,
  };
});

const proposed = proposedCounts();
const n = (f: (r: Row) => boolean) => rows.filter(f).length;
const counts = {
  original: rows.length,
  proposed: proposed.total,
  ownMotion: n((r) => r.motion === "own"),
  genericOnly: n((r) => r.motion === "generic"),
  baked: n((r) => r.bake !== null),
  qaPass: n((r) => r.qa?.verdict === "PASS"),
  qaFail: n((r) => r.qa?.verdict === "FAIL"),
  qaNotRun: n((r) => r.motion === "own" && !r.qa),
  eyePass: n((r) => r.eye?.verdict === "pass" || r.eye?.verdict === "minor"),
  eyeFail: n((r) => r.eye?.verdict === "fail"),
  ownerApproved: n((r) => r.owner !== null),
  inApp3d: n((r) => r.inApp === "3d"),
  pass: n((r) => r.result === "PASS"),
  polish: n((r) => r.result === "POLISH NEEDED"),
  fail: n((r) => r.result === "FAIL"),
  notTested: n((r) => r.result === "NOT TESTED"),
};

const today = new Date().toISOString().slice(0, 10);
const esc = (s: string) => s.replace(/\|/g, "\\|");
const qaCell = (r: Row) => {
  if (r.motion !== "own") return "not applicable (no 3D motion)";
  if (!r.qa) return "NOT TESTED";
  return r.qa.verdict === "PASS" ? "PASS" : `FAIL: ${esc(r.qa.findings.join("; ") || "see log")}`;
};
const eyeCell = (r: Row) => {
  if (r.motion !== "own") return "—";
  if (!r.eye || r.eye.verdict === "not checked") return "NOT CHECKED";
  const v = r.eye.verdict === "pass" ? "PASS" : r.eye.verdict === "minor" ? "VISIBLE DEFECT" : "FAIL";
  return r.eye.note ? `${v}: ${esc(r.eye.note)}` : v;
};
const lines: string[] = [];
lines.push(`# Exercise library: 3D demonstration status`);
lines.push("");
lines.push(`Generated ${today} by \`npx tsx scripts/anatomy/library-status.mts${QA_DIR ? ` --qa ${QA_DIR}` : ""}\` from the code and files; do not edit by hand.`);
lines.push("");
lines.push(`## The counts, kept apart`);
lines.push("");
lines.push(`| What | Count |`);
lines.push(`| --- | ---: |`);
lines.push(`| **Original exercises** in the app (\`src/data/exercises.ts\`), each with a hand-made animated illustration | ${counts.original} |`);
lines.push(`| **Proposed additional exercises** (\`EXERCISES_300.md\`): a list awaiting approval; none exists in the app, none has a motion of any kind | ${counts.proposed} |`);
lines.push(`| Original exercises with an **implemented 3D motion** (their own spec: equipment, grips, 3D keyframes) | ${counts.ownMotion} |`);
lines.push(`| Original exercises with **no 3D motion** (the figure can only follow the 2D motion with no equipment and free hands: a placeholder, not a demonstration, and not shown in the app) | ${counts.genericOnly} |`);
lines.push(`| With a **baked motion** (\`public/anatomy/bake\`), as a phone plays it | ${counts.baked} |`);
lines.push(`| **Automated QA pass** (\`check-motion.mts --baked\`, 24 samples) | ${counts.qaPass} |`);
lines.push(`| Automated QA **fail** | ${counts.qaFail} |`);
lines.push(`| 3D motions with **no automated QA run** recorded here | ${counts.qaNotRun} |`);
lines.push(`| **Visual review** pass (${esc(review.reviewer)}, ${review.date}; this is a reviewer's eye, not the owner's approval) | ${counts.eyePass} |`);
lines.push(`| Visual review fail | ${counts.eyeFail} |`);
lines.push(`| **Owner's visual approval** of the rendered motion | ${counts.ownerApproved} |`);
lines.push(`| Shown in the app as the 3D figure (with the illustration as fallback): ${IN_APP_NOTE} | ${counts.inApp3d} |`);
lines.push(`| **PASS** (automated QA and visual review both pass, nothing visibly wrong; still not the owner's approval) | ${counts.pass} |`);
lines.push(`| **POLISH NEEDED** (automated QA passes and the movement reads right, but a visible defect remains; not counted as approved) | ${counts.polish} |`);
lines.push(`| **FAIL** (either fails) | ${counts.fail} |`);
lines.push(`| **NOT TESTED** (no 3D motion, or not checked) | ${counts.notTested} |`);
lines.push("");
lines.push(`Proposed additions by section: ${proposed.sections.map((s) => `${s.name.replace(/ \(\d+\)$/, "")} ${s.count}`).join(", ")}. None of them is built.`);
lines.push("");
lines.push(`## Exercises with a 3D motion (${counts.ownMotion})`);
lines.push("");
lines.push(`| Exercise | Bake | Automated QA | Visual review | Owner approval | In the app | Result |`);
lines.push(`| --- | --- | --- | --- | --- | --- | --- |`);
for (const r of rows.filter((r) => r.motion === "own")) {
  lines.push(
    `| ${esc(r.name)} (\`${r.slug}\`) | ${r.bake ? `${r.bake.frames} frames, ${r.bake.duration} s` : "none"} | ${qaCell(r)} | ${eyeCell(r)} | ${r.owner ? `${r.owner.date}: ${esc(r.owner.note)}` : "none"} | ${r.inApp === "3d" ? "3D figure, illustration as fallback" : "illustration"} | **${r.result}** |`,
  );
}
lines.push("");
lines.push(`## Exercises without a 3D motion (${counts.genericOnly})`);
lines.push("");
lines.push(`These keep the animated illustration in the app. The 3D figure has no motion for them beyond the generic lift of the 2D motion (no equipment, hands free), which is not a demonstration and is not shown; they are **NOT TESTED** for 3D.`);
lines.push("");
lines.push(`| Exercise | Category | In the app | Result |`);
lines.push(`| --- | --- | --- | --- |`);
for (const r of rows.filter((r) => r.motion === "generic")) lines.push(`| ${esc(r.name)} (\`${r.slug}\`) | ${r.category} | illustration | NOT TESTED |`);
lines.push("");
lines.push(`## Proposed additional exercises (${counts.proposed}): not built`);
lines.push("");
lines.push(`The list in [EXERCISES_300.md](EXERCISES_300.md) is a proposal for the owner's approval. None of these exercises has an entry in the app, an illustration, a 3D motion, a bake, a QA run or a review. They are not counted anywhere above.`);
lines.push("");
writeFileSync(OUT, lines.join("\n"));
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ generated: today, counts, proposed, rows }, null, 1));
console.log(`${OUT}: ${counts.original} original, ${counts.proposed} proposed; 3D motion ${counts.ownMotion}; baked ${counts.baked}; QA pass ${counts.qaPass}, fail ${counts.qaFail}; owner approvals ${counts.ownerApproved}; PASS ${counts.pass}, POLISH NEEDED ${counts.polish}, FAIL ${counts.fail}, NOT TESTED ${counts.notTested}`);
