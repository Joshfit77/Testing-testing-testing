#!/usr/bin/env node
/**
 * Builds the cross-reference layer for Biblical AI from the OpenBible.info cross references
 * (https://www.openbible.info/labs/cross-references/, CC BY; the file's own header: "#www.openbible.info CC-BY").
 *
 *   node scripts/build-cross-references.mjs <cross_references.txt> <out-dir> [source-url]
 *
 * For each verse: the references people voted most relevant (votes > 0), at most 12, each checked against the BSB in
 * public/bible/bsb (a reference to a verse the BSB doesn't have is dropped and counted). Output: <out>/cross-references
 * .json.gz ({ "GEN 1:1": ["PRO 8:22-8:30", ...] }) and meta.json with the input's SHA-256, licence and counts.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const [file, out, sourceUrl = "https://github.com/scrollmapper/bible_databases (sources/extras/cross_references.txt, a copy of the OpenBible.info file)"] = process.argv.slice(2);
if (!file || !out) {
  console.error("usage: build-cross-references.mjs <cross_references.txt> <out-dir> [source-url]");
  process.exit(1);
}
const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const books = JSON.parse(readFileSync(path.join(root, "src", "data", "bible", "books.json"), "utf8")).books;
// OSIS book names, canonical order (the same order as books.json).
const OSIS = "Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev".split(" ");
const ID = new Map(OSIS.map((o, i) => [o, books[i].id]));

const bsb = new Map();
for (const b of books) bsb.set(b.id, JSON.parse(readFileSync(path.join(root, "public", "bible", "bsb", "books", `${b.id}.json`), "utf8")).chapters);
const has = (id, c, v) => Boolean(bsb.get(id)?.[c - 1]?.find(([n, t]) => n === v && t));

const buf = readFileSync(file);
const sha256 = createHash("sha256").update(buf).digest("hex");
const lines = buf.toString("utf8").split(/\r?\n/);
if (!/openbible\.info CC-BY/i.test(lines[0] ?? "")) throw new Error("Not the OpenBible.info cross-reference file (header missing)");

const point = (s) => {
  const m = s.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const id = ID.get(m[1]);
  return id ? { id, c: Number(m[2]), v: Number(m[3]) } : null;
};
const MAX = 12;
const raw = new Map();
const counts = { lines: 0, kept: 0, droppedNoVotes: 0, droppedUnknown: 0, droppedNotInBsb: 0 };
for (const line of lines.slice(1)) {
  if (!line.trim()) continue;
  counts.lines++;
  const [from, to, votesRaw] = line.split("\t");
  const votes = Number(votesRaw);
  if (!(votes > 0)) {
    counts.droppedNoVotes++;
    continue;
  }
  const f = point(from);
  const [a, b] = (to ?? "").split("-");
  const s = a ? point(a) : null;
  const e = b ? point(b) : null;
  if (!f || !s || (b && !e) || (e && e.id !== s.id)) {
    counts.droppedUnknown++;
    continue;
  }
  if (!has(f.id, f.c, f.v) || !has(s.id, s.c, s.v) || (e && !has(e.id, e.c, e.v))) {
    counts.droppedNotInBsb++;
    continue;
  }
  const key = `${f.id} ${f.c}:${f.v}`;
  const target = e && !(e.c === s.c && e.v === s.v) ? `${s.id} ${s.c}:${s.v}-${e.c}:${e.v}` : `${s.id} ${s.c}:${s.v}`;
  let list = raw.get(key);
  if (!list) raw.set(key, (list = []));
  list.push([target, votes]);
}
const xrefs = {};
for (const [key, list] of raw) {
  xrefs[key] = list.sort((x, y) => y[1] - x[1]).slice(0, MAX).map(([t]) => t);
  counts.kept += xrefs[key].length;
}
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "cross-references.json.gz"), gzipSync(JSON.stringify(xrefs), { level: 9 }));
writeFileSync(
  path.join(out, "meta.json"),
  `${JSON.stringify(
    {
      name: "Cross references",
      source: "OpenBible.info cross references, https://www.openbible.info/labs/cross-references/",
      copiedFrom: sourceUrl,
      licence: "CC BY (OpenBible.info); file header: " + lines[0].replace(/^.*?#/, "#"),
      attribution: "Cross references: OpenBible.info, CC BY.",
      input: { sha256, bytes: buf.length },
      rules: `votes > 0; at most ${MAX} per verse, most votes first; every reference checked against the BSB`,
      verses: Object.keys(xrefs).length,
      counts,
      builtAt: new Date().toISOString(),
    },
    null,
    1,
  )}\n`,
);
console.log(JSON.stringify({ verses: Object.keys(xrefs).length, counts }));
