#!/usr/bin/env node
/**
 * Information only: compares the app's red-letter verses (wj.json, from the BSB publisher) with the verses another
 * red-letter Bible marks with \wj in its USFM, and lists every verse where the two disagree. It changes nothing; it is
 * a cross-check for a person to review.
 *
 *   node scripts/compare-red-letter.mjs <wj.json> <usfm-dir> <label>
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const [, , wjPath, usfmDir, label = "other edition"] = process.argv;
const wj = JSON.parse(readFileSync(wjPath, "utf8"));
const ours = new Set();
for (const [b, cs] of Object.entries(wj.books)) for (const [c, vs] of Object.entries(cs)) for (const v of Object.keys(vs)) ours.add(`${b} ${c}:${v}`);

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(usfm|sfm)$/i.test(f)) files.push(p);
  }
})(usfmDir);

const theirs = new Set();
const NT = ["MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const id = src.match(/^\\id\s+([0-9A-Z]{3})/m)?.[1];
  if (!id) continue;
  let c = 0;
  let v = 0;
  // Split on chapter and verse markers, keeping them, and look for \wj in each verse's text (outside footnotes).
  for (const tok of src.split(/(\\c\s+\d+|\\v\s+\d+(?:-\d+)?)/)) {
    const cm = tok.match(/^\\c\s+(\d+)/);
    if (cm) {
      c = Number(cm[1]);
      v = 0;
      continue;
    }
    const vm = tok.match(/^\\v\s+(\d+)/);
    if (vm) {
      v = Number(vm[1]);
      continue;
    }
    if (!c || !v) continue;
    const text = tok.replace(/\\f\s.*?\\f\*/gs, "").replace(/\\x\s.*?\\x\*/gs, "");
    if (/\\\+?wj\s/.test(text)) theirs.add(`${id} ${c}:${v}`);
  }
}

const order = (k) => {
  const [b, cv] = k.split(" ");
  const [c, v] = cv.split(":").map(Number);
  return (NT.indexOf(b) + 1) * 1e6 + c * 1e3 + v;
};
const group = (keys) => {
  const out = new Map();
  for (const k of keys.sort((a, b) => order(a) - order(b))) {
    const [b, cv] = k.split(" ");
    const [c, v] = cv.split(":");
    const key = `${b} ${c}`;
    out.set(key, [...(out.get(key) ?? []), v]);
  }
  return [...out].map(([k, vs]) => `${k}:${vs.join(",")}`).join("; ");
};
const onlyTheirs = [...theirs].filter((k) => !ours.has(k) && NT.includes(k.split(" ")[0]));
const onlyOurs = [...ours].filter((k) => !theirs.has(k));
const outsideNt = [...theirs].filter((k) => !NT.includes(k.split(" ")[0]));

console.log(`BSB (publisher) red-letter verses: ${ours.size}`);
console.log(`${label} red-letter verses: ${theirs.size} (${files.length} USFM files)`);
console.log(`Both mark: ${[...ours].filter((k) => theirs.has(k)).length}`);
console.log(`\nMarked by ${label} only (${onlyTheirs.length}):\n${group(onlyTheirs) || "none"}`);
console.log(`\nMarked by the BSB only (${onlyOurs.length}):\n${group(onlyOurs) || "none"}`);
if (outsideNt.length) console.log(`\n${label} also marks outside the New Testament: ${group(outsideNt)}`);
