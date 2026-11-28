/**
 * Biblical AI answers: the structure the model must return (a forced tool call), and the deterministic checks every
 * answer passes before a member sees it. Pure (the lookups are passed in), so every rule is unit-tested.
 *
 * What is checked:
 * - every Scripture reference, in any field, exists in the BSB (otherwise it is removed or marked);
 * - every quotation of Scripture matches the BSB text of its reference word for word (punctuation and case aside);
 *   quoted wording elsewhere in the prose must match a passage cited or retrieved, or it is removed;
 * - every original-language note names a lexical entry (Strong's number) that occurs in the verse it is about;
 * - teacher commentary is allowed only as a summary of an approved, retrieved document (with its author, title and
 *   URL from the document, never from the model); a sentence that attributes a position to an approved teacher
 *   without such a document is removed;
 * - lengths are capped. Failures are listed so the server can ask once more, then removed and noted for the member.
 */
import { z } from "zod";
import { findReferences } from "@/lib/bible/ai";
import { formatReference, parseReference, type ScriptureRef } from "@/lib/bible/reference";
import { strongBase } from "@/lib/bible/original-languages";
import { TEACHER_NAME_PATTERN, type Depth } from "./config";

export const EVIDENCE_KINDS = ["scripture", "primary_source", "archaeology", "scholarly_consensus", "disputed", "tradition"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  scripture: "Biblical account",
  primary_source: "Ancient source",
  archaeology: "Archaeological evidence",
  scholarly_consensus: "Scholarly consensus",
  disputed: "Disputed among scholars",
  tradition: "Christian tradition",
};

const short = (n: number) => z.string().trim().max(n);
/** What the model submits (tool input). Unknown fields are dropped; every string is capped. */
export const rawAnswerSchema = z.object({
  title: short(100).optional(),
  answer: short(6000),
  scripture: z.array(z.object({ reference: short(80), quote: short(1500).optional(), note: short(600).optional() })).max(20).default([]),
  context: short(4000).optional(),
  original_language: z.array(z.object({ reference: short(80), strong: short(12), word: short(80).optional(), explanation: short(1500) })).max(10).default([]),
  history: z.array(z.object({ claim: short(1200), evidence: z.enum(EVIDENCE_KINDS) })).max(10).default([]),
  commentary: z.array(z.object({ document_id: short(60), summary: short(1500) })).max(6).default([]),
  application: short(3000).optional(),
  reflection_questions: z.array(short(400)).max(8).default([]),
  further_study: z.array(short(200)).max(8).default([]),
  uncertainty: short(1500).optional(),
  safety: short(1200).optional(),
});
export type RawAnswer = z.infer<typeof rawAnswerSchema>;

/** The JSON schema of the tool the model must call (kept in step with rawAnswerSchema by a unit test). */
export const ANSWER_TOOL = {
  name: "submit_study",
  description: "Submit the answer to the member's question. Call this exactly once with the complete answer.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "A short title for this study (at most 8 words)." },
      answer: { type: "string", description: "The biblical answer, in plain paragraphs (no headings). Cite Scripture as Book Chapter:Verse." },
      scripture: {
        type: "array",
        description: "The passages the answer rests on. Quote only exact BSB wording from the passages provided.",
        items: { type: "object", properties: { reference: { type: "string" }, quote: { type: "string" }, note: { type: "string" } }, required: ["reference"] },
      },
      context: { type: "string", description: "Literary and historical context of the passages (standard and deep)." },
      original_language: {
        type: "array",
        description: "Original-language notes, only for words listed in <original_language> (deep).",
        items: { type: "object", properties: { reference: { type: "string" }, strong: { type: "string" }, word: { type: "string" }, explanation: { type: "string" } }, required: ["reference", "strong", "explanation"] },
      },
      history: {
        type: "array",
        description: "Historical or archaeological points, each labelled with the kind of evidence.",
        items: { type: "object", properties: { claim: { type: "string" }, evidence: { type: "string", enum: [...EVIDENCE_KINDS] } }, required: ["claim", "evidence"] },
      },
      commentary: {
        type: "array",
        description: "Summaries of <commentary> documents only, by their id. Leave empty when none were provided.",
        items: { type: "object", properties: { document_id: { type: "string" }, summary: { type: "string" } }, required: ["document_id", "summary"] },
      },
      application: { type: "string", description: "Practical application (standard and deep)." },
      reflection_questions: { type: "array", items: { type: "string" } },
      further_study: { type: "array", items: { type: "string" }, description: "References or topics for further study." },
      uncertainty: { type: "string", description: "Where Christians disagree, or the evidence is limited, say so here." },
      safety: { type: "string", description: "Only for crisis, abuse, self-harm, medical or immediate danger: where to get help now." },
    },
    required: ["answer", "scripture"],
  },
};

export interface ScriptureItem {
  reference: string;
  /** The verified quotation (BSB wording), when the model quoted and the quotation matched. */
  quote: string | null;
  note: string | null;
}
export interface LanguageItem {
  reference: string;
  strong: string;
  word: string | null;
  explanation: string;
}
export interface CommentaryItem {
  documentId: string;
  author: string;
  title: string;
  url: string;
  publishedOn: string | null;
  summary: string;
}
export interface ValidatedAnswer {
  title: string;
  answer: string;
  scripture: ScriptureItem[];
  context: string | null;
  originalLanguage: LanguageItem[];
  history: { claim: string; evidence: EvidenceKind }[];
  commentary: CommentaryItem[];
  application: string | null;
  reflectionQuestions: string[];
  furtherStudy: string[];
  uncertainty: string | null;
  safety: string | null;
  /** What the checks removed, said plainly to the member ("A quotation that didn't match the BSB was removed."). */
  limitations: string[];
}

export interface SourceDocument {
  id: string;
  author: string;
  title: string;
  url: string;
  publishedOn: string | null;
  body: string;
}

export interface ValidationDeps {
  /** The BSB text of a reference, or null when the BSB doesn't have it. */
  passageText: (ref: ScriptureRef) => string | null;
  /** Whether the lexical entry occurs in that verse (original-language data). */
  verseHasStrong: (ref: ScriptureRef, strong: string) => boolean;
  /** Approved documents retrieved for this question, by id. */
  documents: Map<string, SourceDocument>;
  /** Passages retrieved for this question (formatted references), whose wording may be quoted in the prose. */
  retrieved: string[];
}

export interface ValidationResult {
  answer: ValidatedAnswer;
  /** Problems the model should correct on a retry (empty when the answer passed every check as it was). */
  failures: string[];
}

/** For comparing wording: letters and digits only, lower case, single spaces. */
export function normalizeWords(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whether a quotation is the passage's wording: each part between ellipses appears in the text, in order. */
export function quoteMatches(quote: string, text: string): boolean {
  const t = ` ${normalizeWords(text)} `;
  const parts = quote
    .split(/\.\s*\.\s*\.|…/)
    .map(normalizeWords)
    .filter(Boolean);
  if (!parts.length) return false;
  let at = 0;
  for (const p of parts) {
    const i = t.indexOf(` ${p} `, at);
    if (i < 0) return false;
    at = i + p.length;
  }
  return true;
}

/** Quoted spans of four words or more in prose ("…" or “…”). */
export function quotedSpans(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/[“"]([^”"]{8,600})[”"]/g)) {
    if (m[1]!.trim().split(/\s+/).length >= 4) out.push(m[0]);
  }
  return out;
}

const ATTRIBUTION = /\b(says?|said|teach(es)?|taught|writes?|wrote|argues?|argued|believes?|believed|holds?|held|explains?|explained|preach(es|ed)?|states?|stated|notes?|noted|insists?|insisted|according to|in his (sermon|book|article|teaching))\b/i;

/** Sentences that attribute something to an approved teacher. */
export function teacherAttributions(text: string): string[] {
  return (text.match(/[^.!?\n]+[.!?]?/g) ?? []).filter((s) => TEACHER_NAME_PATTERN.test(s) && ATTRIBUTION.test(s)).map((s) => s.trim());
}

/** Text shaped like a reference to a book the Bible doesn't have ("Hezekiah 3:5"). */
const REFERENCE_SHAPE = /\b(?:[1-3]\s?)?[A-Z][a-z]+\.?\s\d{1,3}:\d{1,3}(?:\s?[-–]\s?\d{1,3})?\b/g;
export function unknownBookReferences(text: string): string[] {
  return [...text.matchAll(REFERENCE_SHAPE)].map((m) => m[0]).filter((raw) => !parseReference(raw.replace(/^Psalms?\b/, "Psalm")));
}

function parse(raw: string): ScriptureRef | null {
  return parseReference(raw.replace(/^Psalms?\b/i, "Psalm").trim());
}

/** Run every check on one field of prose; returns the cleaned text and what was wrong. */
function checkProse(text: string, deps: ValidationDeps, allowedQuotes: string[], hasCommentary: boolean, failures: string[], limitations: Set<string>): string {
  let out = text;
  for (const { raw, ref } of findReferences(out)) {
    if (ref && deps.passageText(ref) !== null) continue;
    failures.push(`"${raw}" is not a passage in the Berean Standard Bible.`);
    out = out.split(raw).join(`${raw} [reference not found in the BSB]`);
    limitations.add("A reference that isn't in the Bible was marked.");
  }
  for (const raw of new Set(unknownBookReferences(out))) {
    failures.push(`"${raw}" is not a passage in the Berean Standard Bible.`);
    out = out.split(raw).join(`${raw} [reference not found in the BSB]`);
    limitations.add("A reference that isn't in the Bible was marked.");
  }
  for (const span of quotedSpans(out)) {
    const inner = span.slice(1, -1);
    if (allowedQuotes.some((t) => quoteMatches(inner, t))) continue;
    failures.push(`The quotation ${span} does not match the BSB wording of any passage provided.`);
    out = out.split(span).join("[quotation removed: its wording could not be verified]");
    limitations.add("A quotation whose wording couldn't be verified was removed.");
  }
  if (!hasCommentary) {
    for (const s of teacherAttributions(out)) {
      failures.push(`"${s}" attributes a position to a teacher without a provided source.`);
      out = out.split(s).join("").replace(/\s{2,}/g, " ").trim();
      limitations.add("A statement attributed to a teacher was removed, because no verified source for it was available.");
    }
  }
  return out;
}

/** Check and clean a submitted answer. */
export function validateAnswer(input: RawAnswer, deps: ValidationDeps, depth: Depth): ValidationResult {
  const failures: string[] = [];
  const limitations = new Set<string>();

  // Scripture: valid references only; a quotation is kept only if it is the BSB's wording.
  const scripture: ScriptureItem[] = [];
  const seen = new Set<string>();
  for (const s of input.scripture) {
    const ref = parse(s.reference);
    const text = ref ? deps.passageText(ref) : null;
    if (!ref || text === null) {
      failures.push(`"${s.reference}" is not a passage in the Berean Standard Bible.`);
      limitations.add("A reference that isn't in the Bible was removed.");
      continue;
    }
    const reference = formatReference(ref);
    if (seen.has(reference)) continue;
    seen.add(reference);
    let quote: string | null = s.quote?.trim() ? s.quote.trim() : null;
    if (quote && !quoteMatches(quote, text)) {
      failures.push(`The quotation given for ${reference} is not the BSB wording of ${reference}.`);
      limitations.add("A quotation that didn't match the BSB was removed (the passage itself is shown from the BSB).");
      quote = null;
    }
    scripture.push({ reference, quote, note: s.note?.trim() || null });
  }

  // Wording that may be quoted in prose: the passages cited and retrieved, from the BSB.
  const allowedQuotes = [...new Set([...scripture.map((s) => s.reference), ...deps.retrieved])].map((r) => {
    const ref = parse(r);
    return (ref && deps.passageText(ref)) ?? "";
  });

  // Commentary: only approved documents that were retrieved; author, title and URL come from the document.
  const commentary: CommentaryItem[] = [];
  for (const c of input.commentary) {
    const doc = deps.documents.get(c.document_id);
    if (!doc) {
      failures.push(`Commentary "${c.document_id}" is not one of the documents provided.`);
      limitations.add("Commentary without a verified source was removed.");
      continue;
    }
    commentary.push({ documentId: doc.id, author: doc.author, title: doc.title, url: doc.url, publishedOn: doc.publishedOn, summary: c.summary });
  }
  const hasCommentary = commentary.length > 0;

  // Original languages: the entry must occur in the verse.
  const originalLanguage: LanguageItem[] = [];
  for (const o of input.original_language) {
    const ref = parse(o.reference);
    const strong = strongBase(o.strong);
    if (!ref || !strong || deps.passageText(ref) === null || !deps.verseHasStrong(ref, strong)) {
      failures.push(`Original-language note: ${o.strong} does not occur in ${o.reference}.`);
      limitations.add("An original-language note that couldn't be checked against the Hebrew or Greek text was removed.");
      continue;
    }
    originalLanguage.push({ reference: formatReference(ref), strong, word: o.word?.trim() || null, explanation: checkProse(o.explanation, deps, allowedQuotes, hasCommentary, failures, limitations) });
  }

  const prose = (t: string | undefined) => (t?.trim() ? checkProse(t.trim(), deps, allowedQuotes, hasCommentary, failures, limitations) : null);
  const answerText = prose(input.answer) ?? "";
  if (!answerText) failures.push("The answer is empty.");
  if (!scripture.length) failures.push("No valid Scripture passage was given.");

  const history = input.history.map((h) => ({ claim: prose(h.claim) ?? "", evidence: h.evidence })).filter((h) => h.claim);
  const furtherStudy = input.further_study
    .map((f) => {
      const ref = parse(f);
      if (ref) return deps.passageText(ref) !== null ? formatReference(ref) : null;
      if (unknownBookReferences(f).length) return null;
      return findReferences(f).every(({ ref: r }) => r && deps.passageText(r) !== null) ? f.trim() : null;
    })
    .filter((f): f is string => Boolean(f));

  const answer: ValidatedAnswer = {
    title: (input.title?.trim() || answerText.split(/[.?!]/)[0] || "Bible study").slice(0, 100),
    answer: answerText,
    scripture,
    context: depth === "quick" ? null : prose(input.context),
    originalLanguage: depth === "deep" ? originalLanguage : originalLanguage.slice(0, 2),
    history,
    commentary,
    application: depth === "quick" ? null : prose(input.application),
    reflectionQuestions: input.reflection_questions.map((q) => prose(q) ?? "").filter(Boolean),
    furtherStudy,
    uncertainty: prose(input.uncertainty),
    safety: input.safety?.trim() || null,
    limitations: [...limitations],
  };
  return { answer, failures };
}

/** The answer as plain text (history, copying and sharing), with Scripture from the BSB. */
export function answerToText(a: ValidatedAnswer, passage: (reference: string) => string | null): string {
  const parts = [a.answer];
  if (a.scripture.length) parts.push(["Scripture (BSB):", ...a.scripture.map((s) => `${s.reference} — ${passage(s.reference) ?? ""}`.trim())].join("\n"));
  if (a.context) parts.push(`Context: ${a.context}`);
  if (a.originalLanguage.length) parts.push(["Original language:", ...a.originalLanguage.map((o) => `${o.reference} ${o.word ?? ""} (${o.strong}): ${o.explanation}`)].join("\n"));
  if (a.history.length) parts.push(["History:", ...a.history.map((h) => `${EVIDENCE_LABEL[h.evidence]}: ${h.claim}`)].join("\n"));
  if (a.commentary.length) parts.push(["Commentary:", ...a.commentary.map((c) => `${c.author}, "${c.title}" (${c.url}): ${c.summary}`)].join("\n"));
  if (a.application) parts.push(`Application: ${a.application}`);
  if (a.reflectionQuestions.length) parts.push(["Reflection:", ...a.reflectionQuestions.map((q) => `- ${q}`)].join("\n"));
  if (a.uncertainty) parts.push(`Where Christians differ: ${a.uncertainty}`);
  if (a.safety) parts.push(a.safety);
  return parts.join("\n\n").slice(0, 24000);
}
