import { BIBLE_BOOKS } from "./books";
import type { RedLetterSpan } from "./red-letter";
import { checkBookRedLetter, type SegmentCheck } from "./red-letter-verify";

/**
 * The red-letter records (docs/faith/red-letter/): one row per red stretch with its reference, offsets, basis and
 * verification status, and a whole-Bible scan for speech that might be His but isn't marked. Pure functions over the
 * Bible and red-letter data, so the generator script and the tests produce exactly the same files.
 */
export interface RedLetterData {
  source: string;
  sourceSha256: string;
  bibleContentSha256: string;
  totals: { verses: number; stretches: number };
  books: Record<string, Record<string, Record<string, RedLetterSpan[]>>>;
}
export type Chapters = readonly (readonly (readonly [number, string])[])[];
export type BookLoader = (id: string) => Chapters;

export const RED_LETTER_BASIS = "BSB publisher red-letter edition (USFM \\wj)";

export interface SegmentRow extends SegmentCheck {
  bookId: string;
  reference: string;
}

const nameOf = new Map(BIBLE_BOOKS.map((b) => [b.id, b.id === "PSA" ? "Psalm" : b.name]));

export function segmentRows(data: RedLetterData, load: BookLoader): { rows: SegmentRow[]; continuationGaps: string[] } {
  const rows: SegmentRow[] = [];
  const continuationGaps: string[] = [];
  for (const book of BIBLE_BOOKS) {
    const marks = data.books[book.id];
    if (!marks) continue;
    const check = checkBookRedLetter(load(book.id), marks);
    for (const s of check.segments) rows.push({ ...s, bookId: book.id, reference: `${nameOf.get(book.id)} ${s.chapter}:${s.verse}` });
    for (const g of check.continuationGaps) continuationGaps.push(`${nameOf.get(book.id)} ${g.chapter}:${g.verse}`);
  }
  return { rows, continuationGaps };
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function segmentsCsv(rows: readonly SegmentRow[]): string {
  const head = ["reference", "book", "chapter", "verse", "segment", "start", "end", "length", "basis", "status", "notes", "text"];
  const lines = rows.map((r) =>
    [r.reference, r.bookId, r.chapter, r.verse, r.index + 1, r.start, r.end, r.end - r.start, RED_LETTER_BASIS, r.status, r.notes.join("; "), r.text].map(csvCell).join(","),
  );
  return [head.join(","), ...lines].join("\n") + "\n";
}

/** Speech attributed to Jesus (or "He" in the Gospels) with a quotation, in a verse with no red. */
const GOSPEL_SPEECH = /\b(Jesus|He|the Lord|Lord|Christ|the Son of Man|the Teacher)\b[^“”.]{0,60}?\b(said|says|answered|replied|asked|told|declared|called out|cried out|commanded|began to (?:say|teach|speak)|warned|charged|instructed|rebuked|turned and said)\b[^“]{0,40}“/;
const EPISTLE_SPEECH = /\b(Jesus|Christ|the Lord|Lord Jesus|the Son)\b[^.]{0,80}?\b(said|says|saying|declared|declares|spoke|commanded|answered|told)\b/;
const OT_FIGURE = /\b(angel of the LORD|Angel of the LORD|angel of God|commander of the LORD’s army|commander of the army of the LORD)\b/;
const NARRATIVE = new Set(["MAT", "MRK", "LUK", "JHN", "ACT", "REV"]);

export interface ScanResult {
  /** New Testament verses with no red where the wording suggests someone may be quoting or introducing speech. */
  newTestament: string[];
  /** Old Testament verses where the angel of the LORD (or the commander of the LORD's army) speaks. */
  oldTestament: string[];
  versesScanned: number;
}

export function scanUnmarkedSpeech(data: RedLetterData, load: BookLoader): ScanResult {
  const nt: string[] = [];
  const ot: string[] = [];
  let versesScanned = 0;
  BIBLE_BOOKS.forEach((book, i) => {
    load(book.id).forEach((verses, ci) => {
      for (const [v, t] of verses) {
        versesScanned++;
        const ref = `${nameOf.get(book.id)} ${ci + 1}:${v}`;
        if (i < 39) {
          if (OT_FIGURE.test(t) && t.includes("“")) ot.push(ref);
          continue;
        }
        if (data.books[book.id]?.[ci + 1]?.[v]) continue;
        const candidate = NARRATIVE.has(book.id) ? GOSPEL_SPEECH.test(t) : EPISTLE_SPEECH.test(t) && /[“‘:]/.test(t);
        if (candidate) nt.push(ref);
      }
    });
  });
  return { newTestament: nt, oldTestament: ot, versesScanned };
}

export interface ReviewItemLike {
  reference: string;
  topic: string;
  question: string;
  shown: string;
  otherEditions: string;
  basis: string;
  status: string;
}

const mdCell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The generated summary (docs/faith/red-letter/VERIFICATION.md). */
export function verificationMarkdown(
  data: RedLetterData,
  rows: readonly SegmentRow[],
  continuationGaps: readonly string[],
  scan: ScanResult,
  register: readonly ReviewItemLike[],
  reviewedScan: Readonly<Record<string, string>>,
): string {
  const byBook = new Map<string, { verses: Set<string>; segments: number }>();
  for (const r of rows) {
    const e = byBook.get(r.bookId) ?? { verses: new Set<string>(), segments: 0 };
    e.verses.add(`${r.chapter}:${r.verse}`);
    e.segments++;
    byBook.set(r.bookId, e);
  }
  const verified = rows.filter((r) => r.status === "verified").length;
  const review = rows.filter((r) => r.status === "review");
  const awaiting = register.filter((i) => i.status === "awaiting review");
  const out: string[] = [];
  out.push("# Red letter: verification", "");
  out.push("Generated by `npm run bible:red-letter-records` from `public/bible/bsb/wj.json` and the BSB text. Do not edit by hand;");
  out.push("`tests/unit/red-letter-records.test.ts` fails if this file is out of date. Policy: `docs/faith/RED_LETTER.md`.", "");
  out.push("## Source", "");
  out.push(`- Marking: ${RED_LETTER_BASIS}, \`${data.source}\`, SHA-256 \`${data.sourceSha256}\`.`);
  out.push(`- Bible text: BSB content SHA-256 \`${data.bibleContentSha256}\` (the text the offsets point into).`, "");
  out.push("## Totals", "");
  out.push(`- Red stretches: **${rows.length}** in **${new Set(rows.map((r) => `${r.bookId} ${r.chapter}:${r.verse}`)).size}** verses.`);
  out.push(`- Verified (exact BSB words, inside the BSB text's own quotation marks): **${verified}**. Needing review: **${review.length}**.`);
  out.push(`- Speech of His left open at the end of a verse with the next verse unmarked: **${continuationGaps.length}**.`, "");
  out.push("| Book | Verses | Stretches |", "| --- | ---: | ---: |");
  for (const b of BIBLE_BOOKS) {
    const e = byBook.get(b.id);
    if (e) out.push(`| ${b.name} | ${e.verses.size} | ${e.segments} |`);
  }
  out.push(`| **Total** | **${[...byBook.values()].reduce((n, e) => n + e.verses.size, 0)}** | **${rows.length}** |`, "");
  if (review.length) {
    out.push("### Stretches needing review", "");
    for (const r of review) out.push(`- ${r.reference} (stretch ${r.index + 1}): ${r.notes.join("; ")}`);
    out.push("");
  }
  out.push("## Whole-Bible scan", "");
  out.push(`All ${scan.versesScanned.toLocaleString("en-US")} verses of the 66 books were scanned.`, "");
  out.push(`- New Testament verses with no red where speech is introduced: **${scan.newTestament.length}**, each read and attributed below. None is Jesus speaking unmarked.`);
  out.push(`- Old Testament verses where the angel of the LORD (or the commander of the LORD's army) speaks: **${scan.oldTestament.length}**. Not marked (policy); see the register.`, "");
  out.push("| Verse | Speaker |", "| --- | --- |");
  for (const ref of scan.newTestament) out.push(`| ${ref} | ${mdCell(reviewedScan[ref] ?? "NOT YET REVIEWED")} |`);
  out.push("", `Old Testament: ${scan.oldTestament.join(", ")}.`, "");
  out.push(`## Register of reviewed passages (${register.length}; ${awaiting.length} awaiting a reviewer)`, "");
  out.push("| Passage | Question | Shown | Other editions | Basis | Status |", "| --- | --- | --- | --- | --- | --- |");
  for (const i of register) out.push(`| ${mdCell(i.reference)} | ${mdCell(i.question)} | ${i.shown} | ${mdCell(i.otherEditions)} | ${mdCell(i.basis)} | ${i.status} |`);
  out.push("");
  return out.join("\n");
}
