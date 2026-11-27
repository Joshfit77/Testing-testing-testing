/**
 * The 66 books of the Protestant canon (src/data/bible/books.json, which also validates the BSB build). Pure data and
 * lookups, safe for client and server.
 */
import data from "@/data/bible/books.json";

export type BookId = string;
export type Testament = "OT" | "NT";

export interface BibleBook {
  id: BookId;
  order: number;
  name: string;
  slug: string;
  testament: Testament;
  chapters: number;
  abbreviations: string[];
}

export const BIBLE_BOOKS: readonly BibleBook[] = (data.books as BibleBook[]).map((b) => ({ ...b, testament: b.testament as Testament }));
export const OLD_TESTAMENT = BIBLE_BOOKS.filter((b) => b.testament === "OT");
export const NEW_TESTAMENT = BIBLE_BOOKS.filter((b) => b.testament === "NT");
export const TOTAL_CHAPTERS = BIBLE_BOOKS.reduce((n, b) => n + b.chapters, 0);

const byId = new Map(BIBLE_BOOKS.map((b) => [b.id, b]));
const bySlug = new Map(BIBLE_BOOKS.map((b) => [b.slug, b]));
const byName = new Map<string, BibleBook>();
for (const b of BIBLE_BOOKS) {
  for (const n of [b.name, b.id, ...b.abbreviations]) byName.set(normalizeName(n), b);
}
// Common alternative names.
byName.set(normalizeName("Psalm"), byId.get("PSA")!);
byName.set(normalizeName("Song of Songs"), byId.get("SNG")!);
byName.set(normalizeName("Canticles"), byId.get("SNG")!);
byName.set(normalizeName("Revelations"), byId.get("REV")!);

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/^(i{1,3})\s+/, (m, r: string) => `${r.length} `)
    .replace(/^(first|second|third)\s+/, (m, w: string) => `${{ first: 1, second: 2, third: 3 }[w as "first"]} `)
    .replace(/^([1-3])\s*/, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

export function bookById(id: string): BibleBook | undefined {
  return byId.get(id.toUpperCase());
}

export function bookBySlug(slug: string): BibleBook | undefined {
  return bySlug.get(slug.toLowerCase());
}

/** "1 Cor", "1cor", "First Corinthians", "Ps", "Song of Songs" → the book. */
export function findBook(name: string): BibleBook | undefined {
  return byName.get(normalizeName(name));
}

/** The reference form of a book name: "Psalm 23" (one psalm) vs "Psalms" (the book). */
export function chapterLabel(book: BibleBook, chapter: number): string {
  return `${book.id === "PSA" ? "Psalm" : book.name} ${chapter}`;
}

export function isValidChapter(bookId: string, chapter: number): boolean {
  const b = bookById(bookId);
  return Boolean(b && Number.isInteger(chapter) && chapter >= 1 && chapter <= b.chapters);
}

/** The chapter after / before, crossing book boundaries; null at Genesis 1 / Revelation 22. */
export function nextChapter(bookId: string, chapter: number): { book: BibleBook; chapter: number } | null {
  const b = bookById(bookId)!;
  if (chapter < b.chapters) return { book: b, chapter: chapter + 1 };
  const n = BIBLE_BOOKS[b.order];
  return n ? { book: n, chapter: 1 } : null;
}

export function previousChapter(bookId: string, chapter: number): { book: BibleBook; chapter: number } | null {
  const b = bookById(bookId)!;
  if (chapter > 1) return { book: b, chapter: chapter - 1 };
  const p = BIBLE_BOOKS[b.order - 2];
  return p ? { book: p, chapter: p.chapters } : null;
}

/** Path of a chapter in the reader. */
export function chapterHref(book: BibleBook | string, chapter: number, verse?: number): string {
  const b = typeof book === "string" ? bookById(book)! : book;
  return `/faith/bible/${b.slug}/${chapter}${verse ? `?v=${verse}#v${verse}` : ""}`;
}
