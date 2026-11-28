/**
 * Original-language study: the shapes shared by the server loader (src/server/bible/original-languages.ts) and the
 * screens, and the pure helpers (language of a word, readable parsing, compact references). Client and server.
 */
import { bookById } from "./books";
import type { ScriptureRef } from "./reference";

export type OriginalLanguage = "hebrew" | "aramaic" | "greek";

export interface OriginalWord {
  /** As written (Hebrew with vowel points and accents; Greek with accents). Hebrew morphemes are joined by "/". */
  surface: string;
  transliteration: string;
  /** STEPBible's context-sensitive English gloss (morphemes joined by "/"). */
  gloss: string;
  /** The word's main lexical entry (extended Strong's number). */
  strong: string;
  /** Every morpheme's Strong's number, as in the source ("H9003/{H7225G}"). */
  strongs: string;
  morphology: string;
  /** "Noun · Nominative · Singular · Feminine", or the code itself when it has no expansion. */
  parsing: string;
  lemma: string;
  lexicon: { gloss: string; definition: string } | null;
  language: OriginalLanguage;
}

export interface OriginalVerse {
  bookId: string;
  chapter: number;
  verse: number;
  language: OriginalLanguage;
  words: OriginalWord[];
  /** The verse's number in the Hebrew Bible, when it differs from the English ("3.19" for Malachi 4:1). */
  hebrewReference: string | null;
  /** Why this verse's words come from outside the main critical text, when they do (Mark 16:9–20, John 7:53–8:11). */
  disputed: string | null;
  /** Greek words found only in other editions (TR, Byzantine and others), with the editions that have them. */
  variants: { surface: string; editions: string }[];
}

/** A word's language: Greek in the NT; in the OT the morphology code says Hebrew (H…) or Aramaic (A…). */
export function wordLanguage(bookLang: "greek" | "hebrew", morphology: string): OriginalLanguage {
  if (bookLang === "greek") return "greek";
  return morphology.startsWith("A") ? "aramaic" : "hebrew";
}

/** Hebrew and Aramaic are written right to left. */
export function isRightToLeft(lang: OriginalLanguage): boolean {
  return lang !== "greek";
}

/** "Function=Noun; Case=Nominative" → "Noun · Nominative". */
function readable(desc: string): string {
  return desc
    .split(";")
    .map((p) => p.split("=").slice(1).join("=").trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * The parsing of a morphology code, from STEPBible's expansion tables (TEGMC for Greek, TEHMC for Hebrew/Aramaic).
 * Hebrew codes carry the language once and one segment per morpheme ("HR/Ncfsa"): each segment is expanded and the
 * morphemes are joined with " + ". A code with no expansion is returned as it is (never guessed).
 */
export function describeMorphology(lang: OriginalLanguage, code: string, table: Record<string, string>): string {
  if (!code) return "";
  if (lang === "greek") return table[code] ? readable(table[code]) : code;
  const prefix = code[0];
  return code
    .slice(1)
    .split("/")
    .map((seg) => {
      const d = table[`${prefix}${seg}`];
      return d ? readable(d) : seg;
    })
    .join(" + ");
}

/** "PRO 8:22-8:30" / "JHN 3:16" (the cross-reference format) → a reference, or null. */
export function parseCompactReference(s: string): ScriptureRef | null {
  const m = s.match(/^([1-3A-Z]{3}) (\d+):(\d+)(?:-(\d+):(\d+))?$/);
  if (!m || !bookById(m[1]!)) return null;
  const r: ScriptureRef = { bookId: m[1]!, chapter: Number(m[2]), verseStart: Number(m[3]) };
  if (m[4]) {
    const ce = Number(m[4]);
    const ve = Number(m[5]);
    if (ce !== r.chapter) r.chapterEnd = ce;
    r.verseEnd = ve;
  }
  return r;
}

/** "G26", "g0026", "H7225G", "{H7225G}" → "G0026" / "H7225" (the number, padded, without the disambiguation letter). */
export function strongBase(s: string): string | null {
  const m = s.trim().replace(/[{}]/g, "").match(/^([GgHh])0*(\d{1,4})[A-Za-z]?(?:_[A-Za-z])?$/);
  return m ? `${m[1]!.toUpperCase()}${m[2]!.padStart(4, "0")}` : null;
}

/** Every Strong's number in a word's tag ("H9003/{H7225G}" → ["H9003", "H7225"]). */
export function strongsIn(tag: string): string[] {
  return tag.split("/").map(strongBase).filter((x): x is string => Boolean(x));
}

export const ORIGINAL_LANGUAGE_LABEL: Record<OriginalLanguage, string> = { hebrew: "Hebrew", aramaic: "Aramaic", greek: "Greek" };
