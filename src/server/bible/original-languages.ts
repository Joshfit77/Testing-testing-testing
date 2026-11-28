import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { bookById } from "@/lib/bible/books";
import { type OriginalVerse, type OriginalWord, describeMorphology, wordLanguage } from "@/lib/bible/original-languages";

/**
 * The original-language layer (data/original-languages, built by scripts/build-original-languages.mjs from
 * STEPBible-Data, CC BY 4.0): Hebrew and Aramaic OT, Greek NT, brief lexicons, morphology and a concordance.
 * Server-only and read on demand, one book at a time; English Scripture always comes from the BSB (text.ts).
 */
const DIR = path.join(process.cwd(), "data", "original-languages");
type RawWord = [string, string, string, string, string, string];
interface BookFile {
  id: string;
  lang: "greek" | "hebrew";
  chapters: Record<string, Record<string, { w: RawWord[]; v?: [string, string][]; heb?: string; d?: string }>>;
}
type LexEntry = [string, string, string, string, string];

const books = new Map<string, BookFile>();
/** Books kept in memory at once (least recently used dropped first): about 0.5–3 MB each once parsed. */
const MAX_BOOKS = 12;
const lexicons: Partial<Record<"greek" | "hebrew", Record<string, LexEntry>>> = {};
let morph: { greek: Record<string, string>; hebrew: Record<string, string> } | null = null;
let concordance: Record<string, [number, string[]]> | null = null;
let meta: { attribution: string; licence: string; source: string } | null = null;

const gz = <T>(file: string): T => JSON.parse(gunzipSync(readFileSync(path.join(DIR, file))).toString("utf8")) as T;

function book(id: string): BookFile | null {
  if (!bookById(id)) return null;
  let b = books.get(id);
  if (b) books.delete(id);
  else b = gz<BookFile>(path.join("books", `${id}.json.gz`));
  books.set(id, b);
  while (books.size > MAX_BOOKS) books.delete(books.keys().next().value!);
  return b;
}

export function originalLanguageMeta(): { attribution: string; licence: string; source: string } {
  meta ??= JSON.parse(readFileSync(path.join(DIR, "meta.json"), "utf8")) as { attribution: string; licence: string; source: string };
  return meta;
}

function lexicon(lang: "greek" | "hebrew"): Record<string, LexEntry> {
  return (lexicons[lang] ??= gz<Record<string, LexEntry>>(`lexicon-${lang}.json.gz`));
}

function morphology(): { greek: Record<string, string>; hebrew: Record<string, string> } {
  morph ??= gz<{ greek: Record<string, string>; hebrew: Record<string, string> }>("morphology.json.gz");
  return morph;
}

/** The lexicon entry for an (extended) Strong's number, or null. A disambiguation letter falls back to the number. */
export function lexiconEntry(strong: string): { strong: string; lemma: string; transliteration: string; gloss: string; definition: string; partOfSpeech: string } | null {
  const s = strong.trim();
  if (!/^[GH]\d{1,5}[A-Za-z]?$/.test(s)) return null;
  const lang = s.startsWith("G") ? "greek" : "hebrew";
  const padded = s.replace(/^([GH])(\d{1,4})([A-Za-z]?)$/, (_m, l: string, n: string, x: string) => `${l}${n.padStart(4, "0")}${x}`);
  const lex = lexicon(lang);
  const e = lex[padded] ?? lex[padded.replace(/[A-Za-z]$/, "")];
  if (!e) return null;
  return { strong: padded, lemma: e[0], transliteration: e[1], gloss: e[2], definition: e[3], partOfSpeech: e[4] };
}

/** The original-language words of one verse (English versification), with parsing and lexicon entries, or null. */
export function originalVerse(bookId: string, chapter: number, verse: number): OriginalVerse | null {
  const b = book(bookId);
  const row = b?.chapters[String(chapter)]?.[String(verse)];
  if (!b || !row || !row.w.length) return null;
  const tables = morphology();
  const words: OriginalWord[] = row.w.map(([surface, translit, gloss, strongs, code, lemmaOrMain]) => {
    const language = wordLanguage(b.lang, code);
    const main = b.lang === "greek" ? strongs : lemmaOrMain;
    const entry = lexiconEntry(main);
    return {
      surface,
      transliteration: translit,
      gloss,
      strong: main,
      strongs,
      morphology: code,
      parsing: describeMorphology(language, code, b.lang === "greek" ? tables.greek : tables.hebrew),
      lemma: entry?.lemma ?? (b.lang === "greek" ? lemmaOrMain : ""),
      lexicon: entry ? { gloss: entry.gloss, definition: entry.definition } : null,
      language,
    };
  });
  return {
    bookId,
    chapter,
    verse,
    language: words.some((w) => w.language === "aramaic") ? "aramaic" : b.lang,
    words,
    hebrewReference: row.heb ?? null,
    disputed: row.d ?? null,
    variants: (row.v ?? []).map(([surface, editions]) => ({ surface, editions })),
  };
}

/** How often a lexical entry occurs (verses) and the first verses it occurs in, as "BOOK c:v". */
export function occurrences(strong: string): { total: number; verses: string[] } {
  concordance ??= gz<Record<string, [number, string[]]>>("concordance.json.gz");
  const e = concordance[strong];
  return e ? { total: e[0], verses: e[1] } : { total: 0, verses: [] };
}

let xrefs: Record<string, string[]> | null = null;
/** OpenBible.info cross references for one verse (most relevant first), each already checked against the BSB. */
export function crossReferences(bookId: string, chapter: number, verse: number): string[] {
  xrefs ??= JSON.parse(gunzipSync(readFileSync(path.join(process.cwd(), "data", "cross-references", "cross-references.json.gz"))).toString("utf8")) as Record<string, string[]>;
  return xrefs[`${bookId} ${chapter}:${verse}`] ?? [];
}
