import "server-only";
import { findReferences, searchTerms } from "@/lib/bible/ai";
import { formatReference, parseReference, type ScriptureRef } from "@/lib/bible/reference";
import { parseCompactReference, strongsIn } from "@/lib/bible/original-languages";
import type { CategoryId, Depth } from "@/lib/biblical-ai/config";
import type { PromptDocument, PromptPassage, PromptWord } from "@/lib/biblical-ai/prompt";
import type { SourceDocument } from "@/lib/biblical-ai/answer";
import { getPassage, passageText, searchBible } from "@/server/bible/text";
import { crossReferences, originalVerse } from "@/server/bible/original-languages";

/*
 * Retrieval for Biblical AI: the BSB passages a question names (or the passage being studied), the most relevant
 * cross references of those passages, verses found by the question's distinctive words, the original-language words
 * of the key verses, and approved commentary documents. Everything comes from the app's own verified data; nothing
 * is fetched from the web. Sizes are capped per depth so the cost of a question stays bounded.
 */

export const RETRIEVAL_LIMITS: Record<Depth, { verses: number; perPassage: number; crossRefs: number; searchHits: number; wordVerses: number; words: number; documents: number }> = {
  quick: { verses: 40, perPassage: 20, crossRefs: 0, searchHits: 6, wordVerses: 0, words: 0, documents: 2 },
  standard: { verses: 70, perPassage: 30, crossRefs: 6, searchHits: 10, wordVerses: 2, words: 30, documents: 3 },
  deep: { verses: 110, perPassage: 40, crossRefs: 10, searchHits: 12, wordVerses: 4, words: 70, documents: 5 },
};

export interface Retrieved {
  passages: PromptPassage[];
  crossReferences: PromptPassage[];
  words: PromptWord[];
  documents: SourceDocument[];
  /** Every passage given to the model (formatted references). */
  references: string[];
}

function firstVerses(ref: ScriptureRef, n: number): { bookId: string; chapter: number; verse: number }[] {
  return getPassage(ref)
    .slice(0, n)
    .map((v) => ({ bookId: ref.bookId, chapter: v.chapter, verse: v.verse }));
}

/** Retrieval without commentary documents (those need the database; see biblical-ai.ts). Pure over the app's data. */
export function retrieveScripture(question: string, opts: { depth: Depth; category: CategoryId; passage?: string | null }): Omit<Retrieved, "documents"> {
  const lim = RETRIEVAL_LIMITS[opts.depth];
  const passages: PromptPassage[] = [];
  const seen = new Set<string>();
  let verses = 0;
  const focus: ScriptureRef[] = [];

  const add = (ref: ScriptureRef, cap: number, list: PromptPassage[]): boolean => {
    const vs = getPassage(ref).slice(0, cap);
    if (!vs.length || verses + vs.length > lim.verses) return false;
    const reference = formatReference(ref);
    if (seen.has(reference)) return false;
    seen.add(reference);
    verses += vs.length;
    list.push({ reference, text: vs.map((v) => v.text).join(" ") });
    return true;
  };

  const named = [
    ...(opts.passage ? [parseReference(opts.passage)] : []),
    ...findReferences(question).map((r) => r.ref),
  ].filter((r): r is ScriptureRef => Boolean(r));
  for (const ref of named) {
    if (add(ref, lim.perPassage, passages)) focus.push(ref);
  }

  // Verses with the question's distinctive words (all of them first; if that's too narrow, the two most distinctive).
  const terms = searchTerms(question);
  if (terms.length && lim.searchHits && (opts.depth !== "quick" || !focus.length)) {
    const all = searchBible(terms.join(" "), { limit: lim.searchHits });
    const hits = all.total ? all.hits : searchBible(terms.slice(0, 2).join(" "), { limit: lim.searchHits }).hits;
    for (const h of hits) {
      const ref = parseReference(h.reference);
      if (ref) add(ref, 1, passages);
    }
  }

  // Cross references of the passages the question is about.
  const crossRefs: PromptPassage[] = [];
  if (lim.crossRefs) {
    const targets = focus.length ? focus : passages.slice(0, 2).map((p) => parseReference(p.reference)).filter((r): r is ScriptureRef => Boolean(r));
    outer: for (const ref of targets) {
      for (const v of firstVerses(ref, 2)) {
        for (const x of crossReferences(v.bookId, v.chapter, v.verse)) {
          if (crossRefs.length >= lim.crossRefs) break outer;
          const r = parseCompactReference(x);
          if (r) add(r, 6, crossRefs);
        }
      }
    }
  }

  // Original-language words of the key verses (deep studies and language questions).
  const words: PromptWord[] = [];
  const wantWords = lim.wordVerses > 0 && (opts.depth === "deep" || opts.category === "languages");
  if (wantWords) {
    const targets = focus.length ? focus : passages.slice(0, 1).map((p) => parseReference(p.reference)).filter((r): r is ScriptureRef => Boolean(r));
    for (const ref of targets) {
      for (const v of firstVerses(ref, opts.category === "languages" ? lim.wordVerses + 2 : lim.wordVerses)) {
        const ov = originalVerse(v.bookId, v.chapter, v.verse);
        if (!ov) continue;
        const reference = formatReference({ bookId: v.bookId, chapter: v.chapter, verseStart: v.verse });
        for (const w of ov.words) {
          if (words.length >= lim.words) break;
          words.push({ reference, surface: w.surface, transliteration: w.transliteration, strong: w.strong, lemma: w.lemma, parsing: w.parsing, gloss: w.gloss, definition: w.lexicon?.definition ?? "", language: w.language });
        }
      }
    }
  }

  return { passages, crossReferences: crossRefs, words, references: [...passages, ...crossRefs].map((p) => p.reference) };
}

/** Whether a lexical entry occurs in the verse (or, for a range, in its first 20 verses). */
export function verseHasStrong(ref: ScriptureRef, strong: string): boolean {
  for (const v of firstVerses(ref, 20)) {
    const ov = originalVerse(v.bookId, v.chapter, v.verse);
    if (ov?.words.some((w) => strongsIn(w.strongs).includes(strong) || strongsIn(w.strong).includes(strong))) return true;
  }
  return false;
}

export { passageText };

export function toPromptDocuments(docs: SourceDocument[]): PromptDocument[] {
  return docs.map((d) => ({ id: d.id, author: d.author, title: d.title, body: d.body.slice(0, 1500) }));
}
