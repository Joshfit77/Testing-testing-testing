#!/usr/bin/env node
/**
 * Builds the complete Berean Standard Bible for the in-app reader from the official plain-text file (bsb.txt, linked
 * from https://berean.bible/downloads.htm; public domain). Run by .github/workflows/bsb-text.yml on the file whose
 * SHA-256 is pinned there; nothing here is typed by hand.
 *
 *   node scripts/build-bsb-bible.mjs <bsb.txt> <books.json> <out-dir> [source-url]
 *
 * Writes <out-dir>/meta.json and <out-dir>/books/<ID>.json (chapters as arrays of [verse, text]), then validates the
 * result against src/data/bible/books.json, an independently written list of the 66 books and their chapter counts.
 * Fails on any unknown book name, a book or chapter count that differs, a missing or repeated chapter, a verse out of
 * order. A verse number the file lists with no text (the BSB keeps the numbers of a few verses it places in its
 * footnotes, e.g. Matthew 17:21) is recorded in meta.json as "withoutText" and left out of the chapter, never filled
 * in; a verse number missing from the file altogether is recorded as "absent".
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , txtPath, booksPath, outDir, sourceUrl = "https://berean.bible/downloads.htm"] = process.argv;
if (!txtPath || !booksPath || !outDir) {
  console.error("usage: build-bsb-bible.mjs <bsb.txt> <books.json> <out-dir> [source-url]");
  process.exit(2);
}

const raw = readFileSync(txtPath);
const { books } = JSON.parse(readFileSync(booksPath, "utf8"));
if (books.length !== 66) throw new Error(`books.json lists ${books.length} books, not 66`);

// Book name in the file → canonical book. The file's names are matched against the canonical name, its abbreviations
// and the singular/plural of Psalm(s).
const byName = new Map();
for (const b of books) for (const n of [b.name, ...b.abbreviations]) byName.set(n.toLowerCase(), b);
byName.set("psalm", books.find((b) => b.id === "PSA"));

const errors = [];
const unparsed = [];
const unknownBooks = new Set();
const fileNames = new Map(); // canonical id → name as written in the file
/** id → Map(chapter → Map(verse → text)) */
const data = new Map(books.map((b) => [b.id, new Map()]));
const firstSeen = []; // book order in the file

for (const line of raw.toString("utf8").split(/\r?\n/)) {
  if (!line.trim()) continue;
  const m = line.match(/^((?:[1-3] )?[A-Z][A-Za-z ]+?) (\d+):(\d+)\t(.*)$/);
  if (!m) {
    unparsed.push(line.slice(0, 120));
    continue;
  }
  const [, name, ch, vs, text] = m;
  const book = byName.get(name.toLowerCase());
  if (!book) {
    unknownBooks.add(name);
    continue;
  }
  if (!fileNames.has(book.id)) {
    fileNames.set(book.id, name);
    firstSeen.push(book.id);
  }
  const chapters = data.get(book.id);
  const c = Number(ch);
  const v = Number(vs);
  if (!chapters.has(c)) chapters.set(c, new Map());
  const verses = chapters.get(c);
  if (verses.has(v)) errors.push(`${book.id} ${c}:${v} appears twice`);
  verses.set(v, text.trim());
}

if (unknownBooks.size) errors.push(`Unknown book names in the file: ${[...unknownBooks].join(", ")}`);
// Only lines that look like verse references are a problem; the file opens with a title and copyright lines.
const suspicious = unparsed.filter((l) => /^(?:[1-3] )?[A-Z][a-z]+(?: [A-Za-z]+)* \d+:\d+/.test(l));
if (suspicious.length) errors.push(`Verse-like lines that didn't parse: ${suspicious.slice(0, 5).join(" | ")}`);
if (firstSeen.join(",") !== books.map((b) => b.id).join(",")) errors.push(`Book order differs from the canon: ${firstSeen.join(",")}`);

const meta = {
  translation: "BSB",
  name: "Berean Standard Bible",
  attribution: "Scripture quotations are from the Berean Standard Bible (BSB), public domain.",
  source: sourceUrl,
  downloadedAt: new Date().toISOString(),
  fileSha256: createHash("sha256").update(raw).digest("hex"),
  books: [],
  totals: { books: 0, chapters: 0, verseNumbers: 0, verses: 0, versesWithoutText: 0, words: 0, absentVerses: 0 },
  contentSha256: "",
};
const content = createHash("sha256");
mkdirSync(path.join(outDir, "books"), { recursive: true });

for (const b of books) {
  const chapters = data.get(b.id);
  const chapterNumbers = [...chapters.keys()].sort((x, y) => x - y);
  if (chapterNumbers.length !== b.chapters) errors.push(`${b.name}: ${chapterNumbers.length} chapters in the file, ${b.chapters} expected`);
  chapterNumbers.forEach((c, i) => {
    if (c !== i + 1) errors.push(`${b.name}: chapter ${i + 1} missing (found ${c})`);
  });
  const out = [];
  const verseCounts = [];
  const words = [];
  const absent = [];
  const withoutText = [];
  for (const c of chapterNumbers) {
    const verses = chapters.get(c);
    const numbers = [...verses.keys()].sort((x, y) => x - y);
    if (numbers[0] !== 1) errors.push(`${b.name} ${c} starts at verse ${numbers[0]}`);
    if (!numbers.some((v) => verses.get(v))) errors.push(`${b.name} ${c} has no text at all`);
    const last = numbers.at(-1);
    for (let v = 1; v <= last; v++) if (!verses.has(v)) absent.push(`${c}:${v}`);
    for (const v of numbers) if (!verses.get(v)) withoutText.push(`${c}:${v}`);
    meta.totals.verseNumbers += numbers.length;
    const rows = numbers.filter((v) => verses.get(v)).map((v) => [v, verses.get(v)]);
    out.push(rows);
    verseCounts.push(rows.length);
    words.push(rows.reduce((n, [, t]) => n + (t.match(/\S+/g)?.length ?? 0), 0));
    for (const [v, t] of rows) content.update(`${b.id} ${c}:${v}\t${t}\n`);
  }
  writeFileSync(path.join(outDir, "books", `${b.id}.json`), JSON.stringify({ id: b.id, name: b.name, chapters: out }));
  meta.books.push({ id: b.id, name: b.name, fileName: fileNames.get(b.id) ?? null, chapters: out.length, verses: verseCounts, lastVerse: out.map((r) => r.at(-1)?.[0] ?? 0), words, absent, withoutText });
  meta.totals.books += 1;
  meta.totals.chapters += out.length;
  meta.totals.verses += verseCounts.reduce((a, n) => a + n, 0);
  meta.totals.words += words.reduce((a, n) => a + n, 0);
  meta.totals.absentVerses += absent.length;
  meta.totals.versesWithoutText += withoutText.length;
}
meta.contentSha256 = content.digest("hex");

if (meta.totals.books !== 66) errors.push(`${meta.totals.books} books`);
if (meta.totals.chapters !== 1189) errors.push(`${meta.totals.chapters} chapters, 1189 expected`);
if (meta.totals.verses < 31000) errors.push(`Only ${meta.totals.verses} verses`);

console.log(`Books ${meta.totals.books}, chapters ${meta.totals.chapters}, verse numbers ${meta.totals.verseNumbers}, verses with text ${meta.totals.verses}, words ${meta.totals.words}`);
console.log(`Verse numbers with no text in the file (${meta.totals.versesWithoutText}): ${meta.books.flatMap((b) => b.withoutText.map((a) => `${b.name} ${a}`)).join(", ") || "none"}`);
console.log(`Verse numbers absent from the file (${meta.totals.absentVerses}): ${meta.books.flatMap((b) => b.absent.map((a) => `${b.name} ${a}`)).join(", ") || "none"}`);
console.log(`Book names as written in the file that differ from the canonical names: ${meta.books.filter((b) => b.fileName && b.fileName !== b.name).map((b) => `${b.fileName} → ${b.name}`).join(", ") || "none"}`);
console.log(`Non-verse lines skipped (${unparsed.length}): ${unparsed.slice(0, 6).join(" | ")}`);
console.log(`Content SHA-256: ${meta.contentSha256}`);

if (errors.length) {
  console.error(`::error::${errors.length} problem(s):\n${errors.slice(0, 50).join("\n")}`);
  process.exit(1);
}
writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 1) + "\n");
console.log(`Wrote ${outDir}/meta.json and ${meta.books.length} book files.`);
