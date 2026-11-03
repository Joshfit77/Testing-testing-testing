#!/usr/bin/env node
/**
 * Marks the words of Jesus ("red letter") in the app's Berean Standard Bible, from an official USFM edition of the BSB
 * whose \wj … \wj* markers say which words are His. Run by .github/workflows/bsb-text.yml; nothing here is typed by
 * hand, and the verse text itself is never changed: the output only says where, inside each verse the app already
 * shows, His words begin and end.
 *
 *   node scripts/build-bsb-red-letter.mjs <usfm-dir> <bible-dir> <out.json> <source-url> <source-sha256>
 *
 * <bible-dir> is the Bible built from the pinned bsb.txt (meta.json + books/<ID>.json). For every verse the USFM marks,
 * each marked stretch of words must be found, word for word, in that verse of the app's text, in order; the result is
 * a list of [start, end) character offsets into the app's verse text. Any marked stretch that can't be found exactly
 * fails the run, so a different wording can never be coloured by guesswork.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , usfmDir, bibleDir, outFile, sourceUrl, sourceSha256] = process.argv;
if (!usfmDir || !bibleDir || !outFile || !sourceUrl || !sourceSha256) {
  console.error("usage: build-bsb-red-letter.mjs <usfm-dir> <bible-dir> <out.json> <source-url> <source-sha256>");
  process.exit(2);
}

const meta = JSON.parse(readFileSync(path.join(bibleDir, "meta.json"), "utf8"));
const bookIds = new Set(meta.books.map((b) => b.id));

/** Markers whose whole content (to the closing marker) is not verse text: footnotes, cross references, figures. */
const NOTE = new Set(["f", "fe", "ef", "x", "ex", "fig", "rq"]);
/** Paragraph-level markers whose line is a heading or book furniture, not verse text. */
const HEADING = /^(id|ide|h|toc\d?|toca\d?|mt\d?|mte\d?|ms\d?|mr|s\d?|sr|r|d|sp|cl|cd|rem|sts|restore|imt\d?|is\d?|ip|ipi|im|imi|ipq|imq|ipr|iq\d?|ib|ili\d?|iot|io\d?|iex|imte\d?|ie|periph|usfm)$/;

/** Parses one USFM book into Map(chapter → Map(verse → [{ text, wj }])). */
function parseBook(src) {
  const chapters = new Map();
  let chapter = 0;
  let verse = 0;
  let wjDepth = 0;
  let noteDepth = 0;
  let segs = null;
  const push = (text) => {
    if (!segs || noteDepth > 0 || !text) return;
    const wj = wjDepth > 0;
    const last = segs.at(-1);
    if (last && last.wj === wj) last.text += text;
    else segs.push({ text, wj });
  };
  for (const rawLine of src.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, " ");
    const lead = line.match(/^\\([a-z]+\d*)\b/);
    if (lead && HEADING.test(lead[1])) continue; // headings and titles never belong to a verse
    // Walk the line: markers start with a backslash; everything else is text.
    // An opening marker takes one following space as its delimiter; a closing marker (\\wj*) does not.
    const re = /\\(\+?)([a-z]+\d*)(\*?)|([^\\]+)/g;
    let m;
    while ((m = re.exec(line))) {
      if (m[4] !== undefined) {
        let text = m[4];
        // \w word|lemma="…"\w* and similar: keep the word, drop the attributes.
        text = text.replace(/\|[^\\]*$/, "");
        push(text);
        continue;
      }
      const [, , tag, closing] = m;
      if (!closing && line[re.lastIndex] === " ") re.lastIndex += 1;
      if (tag === "c" && !closing) {
        const n = line.slice(re.lastIndex).match(/^\s*(\d+)/);
        chapter = Number(n?.[1]);
        verse = 0;
        segs = null;
        re.lastIndex = line.length;
        continue;
      }
      if (tag === "v" && !closing) {
        const n = line.slice(re.lastIndex).match(/^\s*(\d+)(?:-\d+)?\s?/);
        verse = Number(n?.[1]);
        re.lastIndex += n?.[0].length ?? 0;
        if (!chapters.has(chapter)) chapters.set(chapter, new Map());
        segs = [];
        chapters.get(chapter).set(verse, segs);
        continue;
      }
      if (NOTE.has(tag)) {
        noteDepth += closing ? -1 : 1;
        if (noteDepth < 0) noteDepth = 0;
        continue;
      }
      if (tag === "wj") {
        wjDepth += closing ? -1 : 1;
        if (wjDepth < 0) wjDepth = 0;
        continue;
      }
      // Any other marker (paragraphs, poetry lines, \add, \nd, \w, \qs …) only shapes the text: treat as a space
      // where it starts a paragraph-level line, otherwise drop it.
      if (!closing && /^(p|m|pi\d?|mi|nb|pc|pr|pm|pmo|pmc|pmr|cls|li\d?|lh|lf|lim\d?|q\d?|qr|qc|qa|qm\d?|qd|b|tr|th\d?|thr\d?|tc\d?|tcr\d?)$/.test(tag)) push(" ");
    }
    push(" "); // a line break is a space
  }
  return chapters;
}

const squash = (s) => s.replace(/\s+/g, " ");

const out = {};
const failures = [];
const textDiffers = [];
const perBook = {};
let markedVerses = 0;
let spans = 0;
let usfmFiles = 0;
const seenBooks = new Set();
const wjMarkers = { open: 0 };

for (const file of readdirSync(usfmDir).sort()) {
  if (!/\.(usfm|sfm|ptx|txt)$/i.test(file)) continue;
  const src = readFileSync(path.join(usfmDir, file), "utf8");
  const id = src.match(/^\\id\s+([0-9A-Z]{3})/m)?.[1];
  if (!id || !bookIds.has(id)) continue;
  usfmFiles++;
  seenBooks.add(id);
  wjMarkers.open += (src.match(/\\\+?wj\s/g) ?? []).length;
  const book = JSON.parse(readFileSync(path.join(bibleDir, "books", `${id}.json`), "utf8"));
  const parsed = parseBook(src);
  for (const [c, verses] of parsed) {
    const rows = book.chapters[c - 1];
    if (!rows) continue;
    const appText = new Map(rows.map(([v, t]) => [v, t]));
    for (const [v, segs] of verses) {
      if (!segs.some((s) => s.wj && s.text.trim())) continue;
      const ref = `${id} ${c}:${v}`;
      const t = appText.get(v);
      if (t === undefined) {
        failures.push(`${ref}: marked in the USFM, but the app has no text for this verse`);
        continue;
      }
      const plain = squash(segs.map((s) => s.text).join("")).trim();
      if (plain !== t) textDiffers.push(ref);
      const ranges = [];
      let cursor = 0;
      let ok = true;
      for (const s of segs) {
        const piece = squash(s.text).trim();
        if (!piece) continue;
        const at = t.indexOf(piece, cursor);
        if (!s.wj) {
          if (at >= 0) cursor = at + piece.length;
          continue;
        }
        if (at < 0) {
          ok = false;
          failures.push(`${ref}: "${piece.slice(0, 80)}" (marked as His words) is not in the app's text: "${t.slice(0, 160)}"`);
          break;
        }
        const prev = ranges.at(-1);
        if (prev && /^[\s]*$/.test(t.slice(prev[1], at))) prev[1] = at + piece.length;
        else ranges.push([at, at + piece.length]);
        cursor = at + piece.length;
      }
      if (!ok) continue;
      ((out[id] ??= {})[c] ??= {})[v] = ranges;
      perBook[id] = (perBook[id] ?? 0) + 1;
      markedVerses++;
      spans += ranges.length;
    }
  }
}

console.log(`USFM book files read: ${usfmFiles}; \\wj markers: ${wjMarkers.open}`);
console.log(`Verses with words of Jesus: ${markedVerses} (${spans} stretches)`);
console.log(`By book: ${Object.entries(perBook).map(([b, n]) => `${b} ${n}`).join(", ") || "none"}`);
console.log(`Marked verses whose USFM wording differs from the app's (information; the marked words themselves matched): ${textDiffers.length}`);
if (textDiffers.length) console.log(`  e.g. ${textDiffers.slice(0, 15).join(", ")}`);

const errors = [];
if (usfmFiles < 66) errors.push(`Only ${usfmFiles} of the 66 books were found in the USFM (${[...bookIds].filter((b) => !seenBooks.has(b)).join(", ")} missing)`);
if (wjMarkers.open === 0) errors.push("This USFM marks no words of Jesus (no \\wj markers)");
if (markedVerses < 1000) errors.push(`Only ${markedVerses} verses are marked; a red-letter New Testament has well over 1,000`);
const nt = new Set(["MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"]);
const outsideNt = Object.keys(perBook).filter((b) => !nt.has(b));
if (outsideNt.length) errors.push(`Words of Jesus marked outside the New Testament: ${outsideNt.join(", ")}`);
for (const f of failures.slice(0, 60)) console.log(`  NOT FOUND ${f}`);
if (failures.length) errors.push(`${failures.length} marked stretches couldn't be found word for word in the app's text`);

if (errors.length) {
  for (const e of errors) console.error(`::error::${e}`);
  process.exit(1);
}

const books = Object.fromEntries(Object.entries(out).sort(([a], [b]) => [...bookIds].indexOf(a) - [...bookIds].indexOf(b)));
const data = {
  translation: "BSB",
  description: "Words of Jesus (red letter): [start, end) character offsets into the app's verse text, by book, chapter and verse",
  source: sourceUrl,
  sourceSha256,
  bibleContentSha256: meta.contentSha256,
  builtAt: new Date().toISOString(),
  totals: { verses: markedVerses, stretches: spans },
  books,
};
const json = JSON.stringify(data) + "\n";
writeFileSync(outFile, json);
console.log(`Wrote ${outFile} (${json.length} bytes, SHA-256 ${createHash("sha256").update(json).digest("hex")})`);
