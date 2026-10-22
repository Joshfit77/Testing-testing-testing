#!/usr/bin/env node
/**
 * Extracts the passages the app quotes from the official Berean Standard Bible plain-text file
 * (bsb.txt, linked from https://berean.bible/downloads.htm), so every verse shown in the app is the
 * published BSB wording rather than something typed by hand.
 *
 *   node scripts/extract-bsb.mjs <bsb.txt> <references.json> <out.json> [source-url]
 *
 * references.json is a JSON array of references as the app writes them ("Matthew 7:13–14").
 * The output maps each reference to its text (verses of a range joined with a space) plus provenance.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const [, , txtPath, refsPath, outPath, sourceUrl = "https://berean.bible/downloads.htm"] = process.argv;
if (!txtPath || !refsPath || !outPath) {
  console.error("usage: extract-bsb.mjs <bsb.txt> <references.json> <out.json> [source-url]");
  process.exit(2);
}

const raw = readFileSync(txtPath);
const verses = new Map();
for (const line of raw.toString("utf8").split(/\r?\n/)) {
  // "Genesis 1:1<TAB>In the beginning God created the heavens and the earth."
  const m = line.match(/^((?:[1-3] )?[A-Z][A-Za-z ]+?) (\d+):(\d+)\t(.+)$/);
  if (m) verses.set(`${m[1]} ${m[2]}:${m[3]}`, m[4].trim());
}
if (verses.size < 30000) throw new Error(`Only ${verses.size} verses parsed; is ${txtPath} the BSB plain-text file?`);

/** The app writes "Psalm"; accept the file's spelling either way. */
function lookup(book, chapter, verse) {
  for (const b of [book, book === "Psalm" ? "Psalms" : book === "Psalms" ? "Psalm" : book]) {
    const t = verses.get(`${b} ${chapter}:${verse}`);
    if (t) return t;
  }
  return null;
}

const refs = JSON.parse(readFileSync(refsPath, "utf8"));
const passages = {};
const missing = [];
for (const ref of refs) {
  const m = ref.match(/^((?:[1-3] )?[A-Za-z ]+?) (\d+):(\d+)(?:[–-](\d+))?$/);
  if (!m) {
    missing.push(`${ref} (unparsed)`);
    continue;
  }
  const [, book, ch, from, to] = m;
  const parts = [];
  for (let v = Number(from); v <= Number(to ?? from); v++) {
    const t = lookup(book, ch, v);
    if (!t) missing.push(`${book} ${ch}:${v}`);
    else parts.push(t);
  }
  passages[ref] = parts.join(" ");
}
if (missing.length) throw new Error(`Missing in BSB file: ${missing.join(", ")}`);

const out = {
  translation: "BSB",
  source: sourceUrl,
  downloadedAt: new Date().toISOString(),
  fileSha256: createHash("sha256").update(raw).digest("hex"),
  versesInFile: verses.size,
  passages,
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`Extracted ${Object.keys(passages).length} passages from ${verses.size} verses.`);
