#!/usr/bin/env node
/**
 * Fix for the intermittent React hydration error #418 ("Hydration failed because the server rendered HTML didn't
 * match the client") — see docs/HYDRATION_418.md.
 *
 * Cause: a bug in the React build that Next.js 15.5 bundles (next/dist/compiled/react-dom, 19.2.0-canary-0bdb9206).
 * When an element's children suspend while the page is hydrating (a client component's JavaScript or a piece of the
 * server payload not ready yet), React replays that element; the replay re-claims the server HTML from the wrong
 * position (the element's first child instead of the element) and reports a false mismatch, then throws the server
 * HTML away and re-renders the whole page on the client. React fixed this upstream (react-dom 19.3: replaying a host
 * component resets the hydration cursor to that component). Next 15.5.29 still bundles the unfixed build.
 *
 * This script applies the same upstream change to the bundled copies. It is idempotent, changes nothing if the
 * bundled React already has the fix, and fails loudly if the code it expects is missing (so an upgrade is reviewed
 * instead of silently shipping the bug again). It runs on `npm install` (postinstall), before every `npm run build`
 * (prebuild) and `npm run dev` (predev); after a build, `--verify-build` checks the shipped browser bundle.
 *
 *   node scripts/react-hydration-replay-fix.mjs                 patch node_modules (default)
 *   node scripts/react-hydration-replay-fix.mjs --check         report only; exit 1 if a required file is unpatched
 *   node scripts/react-hydration-replay-fix.mjs --verify-build  exit 1 if .next/static does not contain the fix
 *   node scripts/react-hydration-replay-fix.mjs --restore       put the original files back (kept as *.ngf-orig)
 *
 * Patching keeps the untouched file next to the patched one (`<file>.ngf-orig`), so it can always be undone; a fresh
 * `npm ci` also replaces node_modules with the originals (and the postinstall hook patches them again).
 *
 * Remove this script (and the package.json hooks) once Next bundles a React with the fix: the script then reports
 * "already fixed upstream" for every file.
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MARKER = "ngf-hydration-replay-fix";

/** Bundled React DOM client builds. The first two are what `next build` / `next dev` use for this app. */
export const TARGETS = [
  { file: "next/dist/compiled/react-dom/cjs/react-dom-client.production.js", required: true },
  { file: "next/dist/compiled/react-dom/cjs/react-dom-client.development.js", required: true },
  { file: "next/dist/compiled/react-dom/cjs/react-dom-profiling.profiling.js", required: false },
  { file: "next/dist/compiled/react-dom/cjs/react-dom-profiling.development.js", required: false },
  { file: "next/dist/compiled/react-dom-experimental/cjs/react-dom-client.production.js", required: false },
  { file: "next/dist/compiled/react-dom-experimental/cjs/react-dom-client.development.js", required: false },
];

// `case 5: resetHooksOnUnwind(X); default: unwindInterruptedWork(current, X),` inside replaySuspendedUnitOfWork /
// replayBeginWork (5 = HostComponent). X is the replayed fiber.
const ANCHOR = /(case 5:\s*resetHooksOnUnwind\((\w+)\);)(\s*default:\s*unwindInterruptedWork\(current, \2\))/;
const NEEDED = ["function popToNextHostParent(", "hydrationParentFiber", "nextHydratableInstance", "isHydrating"];

/** The upstream change (react-dom 19.3 `replayBeginWork`), written for fiber variable `v`. */
function fixFor(v) {
  return (
    ` /* ${MARKER}: upstream React fix, see docs/HYDRATION_418.md */ ` +
    `${v} === hydrationParentFiber && (isHydrating ? (popToNextHostParent(${v}), 5 === ${v}.tag && null != ${v}.stateNode && ` +
    `(nextHydratableInstance = ${v}.stateNode)) : (popToNextHostParent(${v}), (isHydrating = !0)));`
  );
}

/** True when the bundled React already resets the hydration cursor on replay (React's own fix). */
function upstreamFixed(text) {
  const start = text.search(/function (replayBeginWork|replaySuspendedUnitOfWork)\(/);
  if (start < 0) return false;
  const end = text.indexOf("function throwAndUnwindWorkLoop", start);
  const body = text.slice(start, end > start ? end : start + 4000);
  return /===\s*hydrationParentFiber/.test(body) && !body.includes(MARKER);
}

/**
 * @param {string} text the React DOM build's source
 * @returns {{ status: "patched" | "already-patched" | "upstream-fixed", text: string }}
 */
export function patchSource(text) {
  if (text.includes(MARKER)) return { status: "already-patched", text };
  if (upstreamFixed(text)) return { status: "upstream-fixed", text };
  const m = ANCHOR.exec(text);
  if (!m) throw new Error("the React replay code this fix targets was not found (React DOM changed): review docs/HYDRATION_418.md");
  for (const id of NEEDED) if (!text.includes(id)) throw new Error(`expected React internal \`${id}\` not found: review docs/HYDRATION_418.md`);
  if (ANCHOR.exec(text.slice(m.index + m[0].length))) throw new Error("the React replay code appears more than once: review docs/HYDRATION_418.md");
  const patched = text.slice(0, m.index) + m[1] + fixFor(m[2]) + m[3] + text.slice(m.index + m[0].length);
  return { status: "patched", text: patched };
}

/** Reverses patchSource (used by the regression test to reproduce the original bug). */
export function unpatchSource(text) {
  return text.replace(new RegExp(` /\\* ${MARKER}:[^*]*\\*/ [^;]*;`), "");
}

function nodeModules() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "node_modules");
}

/** Backup of the untouched file, kept next to it so the patch can always be undone (`--restore`). */
export const BACKUP_SUFFIX = ".ngf-orig";

/** Puts the original files back (from the backups written when patching). */
export function restoreInstalled({ root = nodeModules() } = {}) {
  const lines = [];
  for (const { file } of TARGETS) {
    const path = join(root, file);
    if (!existsSync(path + BACKUP_SUFFIX)) continue;
    copyFileSync(path + BACKUP_SUFFIX, path);
    rmSync(path + BACKUP_SUFFIX);
    lines.push(`${file}: restored`);
  }
  return lines;
}

/** Patches the installed files. Returns one line per file; throws if a required file can't be fixed. */
export function applyToInstalled({ check = false, root = nodeModules() } = {}) {
  const lines = [];
  const failures = [];
  for (const { file, required } of TARGETS) {
    const path = join(root, file);
    if (!existsSync(path)) {
      // Next not installed (yet): nothing to patch, and a build would fail on its own anyway.
      if (required) lines.push(`${file}: not installed (skipped)`);
      continue;
    }
    const text = readFileSync(path, "utf8");
    try {
      const out = patchSource(text);
      if (out.status === "patched") {
        if (check) {
          if (required) failures.push(`${file}: not patched`);
          lines.push(`${file}: NOT patched`);
          continue;
        }
        if (!existsSync(path + BACKUP_SUFFIX)) copyFileSync(path, path + BACKUP_SUFFIX);
        writeFileSync(path, out.text);
      }
      lines.push(`${file}: ${out.status}`);
    } catch (e) {
      const msg = `${file}: ${e instanceof Error ? e.message : String(e)}`;
      if (required) failures.push(msg);
      else lines.push(`${msg} (optional build, left unchanged)`);
    }
  }
  if (failures.length) {
    const err = new Error(`React hydration replay fix: ${failures.join("; ")}`);
    err.lines = lines;
    throw err;
  }
  return lines;
}

// The minified browser bundle: the replay function (the one with `.type.render,X.ref`) must reset the cursor in its
// HostComponent branch: `case 5:...default:` contains `.stateNode` (the unfixed branch is only `case 5:f(n);default:`).
export function bundleHasFix(js) {
  const i = js.search(/\.type\.render,\w+\.ref[^;]*;break;case 5:/);
  if (i < 0) return null; // not the React DOM chunk
  const branch = js.slice(i, js.indexOf("default:", i));
  return branch.includes(".stateNode");
}

export function verifyBuild(dir = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".next", "static", "chunks")) {
  if (!existsSync(dir)) throw new Error(`${dir} not found: run the build first`);
  const results = [];
  const walk = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".js")) {
        const r = bundleHasFix(readFileSync(p, "utf8"));
        if (r !== null) results.push({ file: p, fixed: r });
      }
    }
  };
  walk(dir);
  if (!results.length) throw new Error("no React DOM chunk found in the build");
  const bad = results.filter((r) => !r.fixed);
  if (bad.length) throw new Error(`React DOM chunk without the hydration replay fix: ${bad.map((b) => b.file).join(", ")} (a stale build cache? delete .next and rebuild)`);
  return results.map((r) => r.file);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    if (args.includes("--verify-build")) {
      const files = verifyBuild();
      console.log(`React hydration replay fix: present in the browser bundle (${files.length} React DOM chunk${files.length === 1 ? "" : "s"}).`);
    } else if (args.includes("--restore")) {
      const lines = restoreInstalled();
      console.log(`React hydration replay fix: ${lines.length ? `\n  ${lines.join("\n  ")}` : "nothing to restore"}`);
    } else {
      const lines = applyToInstalled({ check: args.includes("--check") });
      console.log(`React hydration replay fix:\n  ${lines.join("\n  ")}`);
    }
  } catch (e) {
    if (e && e.lines) console.error(`  ${e.lines.join("\n  ")}`);
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
