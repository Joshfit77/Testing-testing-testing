import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BIBLE_BOOKS, bookById, type BibleBook } from "@/lib/bible/books";
import { formatReference, type ScriptureRef } from "@/lib/bible/reference";

/**
 * The verified Berean Standard Bible (public/bible/bsb, see tests/unit/bible-dataset.test.ts), read from disk once per
 * server process and kept in memory (~4 MB). Every verse the app shows, searches or gives the AI comes from here.
 */
export type Verse = [number, string];
interface BookFile {
  id: string;
  name: string;
  chapters: Verse[][];
}
export interface BibleMeta {
  translation: string;
  name: string;
  attribution: string;
  source: string;
  fileSha256: string;
  contentSha256: string;
  books: { id: string; name: string; chapters: number; verses: number[]; lastVerse: number[]; words: number[]; withoutText: string[] }[];
  totals: { books: number; chapters: number; verseNumbers: number; verses: number; versesWithoutText: number; words: number };
}

const DIR = path.join(process.cwd(), "public", "bible", "bsb");
const books = new Map<string, BookFile>();
let meta: BibleMeta | null = null;

export function bibleMeta(): BibleMeta {
  meta ??= JSON.parse(readFileSync(path.join(DIR, "meta.json"), "utf8")) as BibleMeta;
  return meta;
}

function loadBook(id: string): BookFile {
  let b = books.get(id);
  if (!b) {
    b = JSON.parse(readFileSync(path.join(DIR, "books", `${id}.json`), "utf8")) as BookFile;
    books.set(id, b);
  }
  return b;
}

/** Verses of one chapter, or null for a book or chapter that doesn't exist. */
export function getChapter(bookId: string, chapter: number): Verse[] | null {
  const book = bookById(bookId);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return null;
  return loadBook(book.id).chapters[chapter - 1] ?? null;
}

/** Verse numbers in this chapter that the BSB keeps without text (verses it places in its footnotes). */
export function versesWithoutText(bookId: string, chapter: number): number[] {
  const m = bibleMeta().books.find((b) => b.id === bookId);
  return (m?.withoutText ?? []).filter((s) => s.startsWith(`${chapter}:`)).map((s) => Number(s.split(":")[1]));
}

export interface PassageVerse {
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
}

/** The verses a reference covers (whole chapters when it names no verses). Empty when nothing matches. */
export function getPassage(ref: ScriptureRef): PassageVerse[] {
  const book = bookById(ref.bookId);
  if (!book) return [];
  const lastChapter = ref.chapterEnd ?? ref.chapter;
  const out: PassageVerse[] = [];
  for (let c = ref.chapter; c <= lastChapter; c++) {
    const verses = getChapter(book.id, c);
    if (!verses) return [];
    for (const [v, text] of verses) {
      if (c === ref.chapter && ref.verseStart !== undefined && v < ref.verseStart) continue;
      if (c === lastChapter) {
        const end = ref.verseEnd ?? (ref.chapterEnd === undefined ? ref.verseStart : undefined);
        if (end !== undefined && v > end) continue;
      }
      out.push({ bookId: book.id, chapter: c, verse: v, text });
    }
  }
  return out;
}

/** The passage's text, verses joined with a space, or null if the reference matches nothing. */
export function passageText(ref: ScriptureRef): string | null {
  const verses = getPassage(ref);
  return verses.length ? verses.map((v) => v.text).join(" ") : null;
}

/** The last verse number of a chapter (counting verses the BSB keeps without text), or 0 if the chapter doesn't exist. */
export function lastVerse(bookId: string, chapter: number): number {
  return bibleMeta().books.find((b) => b.id === bookId)?.lastVerse[chapter - 1] ?? 0;
}

/** Word count of a chapter (for reading-time estimates). */
export function chapterWords(bookId: string, chapter: number): number {
  return bibleMeta().books.find((b) => b.id === bookId)?.words[chapter - 1] ?? 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Keyword search
// ---------------------------------------------------------------------------------------------------------------

interface IndexedVerse {
  b: number; // index into BIBLE_BOOKS
  c: number;
  v: number;
  text: string;
  norm: string;
}
let index: IndexedVerse[] | null = null;

/** Lower case, curly quotes and dashes straightened, punctuation removed: what keyword search compares. */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildIndex(): IndexedVerse[] {
  const out: IndexedVerse[] = [];
  BIBLE_BOOKS.forEach((book, b) => {
    loadBook(book.id).chapters.forEach((verses, ci) => {
      for (const [v, text] of verses) out.push({ b, c: ci + 1, v, text, norm: ` ${normalizeForSearch(text)} ` });
    });
  });
  return out;
}

export interface SearchHit {
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
}

export interface SearchOptions {
  testament?: "OT" | "NT";
  bookId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Whole-word keyword search. Words must all appear in the verse (any order); text in "quotes" must appear as a phrase.
 * Returns hits in canonical order and the total count.
 */
export function searchBible(query: string, opts: SearchOptions = {}): { total: number; hits: SearchHit[]; terms: string[] } {
  const phrases = [...query.matchAll(/"([^"]+)"/g)].map((m) => normalizeForSearch(m[1]!)).filter(Boolean);
  const words = normalizeForSearch(query.replace(/"[^"]*"/g, " "))
    .split(" ")
    .filter((w) => w.length > 0);
  const terms = [...phrases, ...words].slice(0, 8);
  if (!terms.length || terms.every((t) => t.length < 2)) return { total: 0, hits: [], terms: [] };
  index ??= buildIndex();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const bookFilter = opts.bookId ? BIBLE_BOOKS.findIndex((b) => b.id === opts.bookId) : -1;
  const needles = terms.map((t) => ` ${t} `);
  const hits: SearchHit[] = [];
  let total = 0;
  for (const iv of index) {
    const book = BIBLE_BOOKS[iv.b]!;
    if (opts.testament && book.testament !== opts.testament) continue;
    if (bookFilter >= 0 && iv.b !== bookFilter) continue;
    if (!needles.every((n) => iv.norm.includes(n))) continue;
    total++;
    if (total > offset && hits.length < limit) {
      hits.push({ bookId: book.id, bookName: book.name, chapter: iv.c, verse: iv.v, reference: formatReference({ bookId: book.id, chapter: iv.c, verseStart: iv.v }), text: iv.text });
    }
  }
  return { total, hits, terms };
}

export function bookOf(id: string): BibleBook | undefined {
  return bookById(id);
}
