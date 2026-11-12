/**
 * Scripture references: parsing what people type ("jn 3:16", "1 Cor 13:4-7", "Ps 23", "Gen 1:1–2:3", "Jude 3") and
 * formatting them the way the app writes them ("John 3:16", "1 Corinthians 13:4–7"). Pure; client and server.
 */
import { bookById, chapterLabel, findBook, type BibleBook } from "./books";

export interface ScriptureRef {
  bookId: string;
  chapter: number;
  /** Absent: the whole chapter (or chapters, with `chapterEnd`). */
  verseStart?: number;
  /** Absent with `chapterEnd`: through the end of that chapter. */
  chapterEnd?: number;
  verseEnd?: number;
}

/**
 * Parse a reference, or null. Verse numbers are only range-checked against chapters here; whether a verse exists is
 * checked against the text by the server.
 */
export function parseReference(input: string): ScriptureRef | null {
  const s = input.trim().replace(/\s+/g, " ");
  // Book name: optional leading number, then letters/spaces/dots, then the numbers.
  const m = s.match(/^((?:[1-3]|i{1,3}|first|second|third)?\s*[a-z][a-z .]*?)\s*(\d+)?(?:\s*[:.]\s*(\d+))?(?:\s*[-–—]\s*(\d+)(?:\s*[:.]\s*(\d+))?)?$/i);
  if (!m) return null;
  const book = findBook(m[1]!.trim());
  if (!book) return null;
  const [n1, n2, n3, n4] = [m[2], m[3], m[4], m[5]].map((x) => (x === undefined ? undefined : Number(x)));
  if (n1 === undefined) return { bookId: book.id, chapter: 1 };

  // Single-chapter books: "Jude 3" and "Jude 3-5" are verses.
  if (book.chapters === 1 && n2 === undefined && n4 === undefined) {
    const r: ScriptureRef = { bookId: book.id, chapter: 1, verseStart: n1 };
    if (n3 !== undefined) r.verseEnd = n3;
    return valid(book, r);
  }
  const r: ScriptureRef = { bookId: book.id, chapter: n1 };
  if (n2 !== undefined) {
    r.verseStart = n2;
    if (n3 !== undefined && n4 !== undefined) {
      r.chapterEnd = n3;
      r.verseEnd = n4;
    } else if (n3 !== undefined) r.verseEnd = n3;
  } else if (n3 !== undefined) {
    // "Genesis 1-3": chapters.
    r.chapterEnd = n3;
  }
  return valid(book, r);
}

function valid(book: BibleBook, r: ScriptureRef): ScriptureRef | null {
  if (r.chapter < 1 || r.chapter > book.chapters) return null;
  if (r.chapterEnd !== undefined && (r.chapterEnd < r.chapter || r.chapterEnd > book.chapters)) return null;
  if (r.chapterEnd === r.chapter) delete r.chapterEnd;
  if (r.verseStart !== undefined && r.verseStart < 1) return null;
  if (r.verseEnd !== undefined && r.verseStart !== undefined && r.chapterEnd === undefined && r.verseEnd < r.verseStart) return null;
  if (r.verseEnd === r.verseStart && r.chapterEnd === undefined) delete r.verseEnd;
  return r;
}

/** "John 3:16–18", "Psalm 23", "Genesis 1:1–2:3", "Genesis 1–3", "Jude 3". */
export function formatReference(r: ScriptureRef): string {
  const book = bookById(r.bookId);
  if (!book) return "";
  const multi = r.chapterEnd !== undefined && r.chapterEnd !== r.chapter;
  const name = book.id === "PSA" && !multi ? "Psalm" : book.name;
  if (book.chapters === 1 && r.verseStart !== undefined) {
    return `${name} ${r.verseStart}${r.verseEnd !== undefined && r.verseEnd !== r.verseStart ? `–${r.verseEnd}` : ""}`;
  }
  if (r.verseStart === undefined) return multi ? `${name} ${r.chapter}–${r.chapterEnd}` : chapterLabel(book, r.chapter);
  if (multi) return `${name} ${r.chapter}:${r.verseStart}–${r.chapterEnd}:${r.verseEnd ?? ""}`.replace(/:$/, "");
  return `${name} ${r.chapter}:${r.verseStart}${r.verseEnd !== undefined && r.verseEnd !== r.verseStart ? `–${r.verseEnd}` : ""}`;
}
