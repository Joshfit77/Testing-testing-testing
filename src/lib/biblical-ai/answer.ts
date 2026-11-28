/**
 * Biblical AI answers: the structure the model must return (a forced tool call), and the deterministic checks every
 * answer passes before a member sees it. Pure (the lookups are passed in), so every rule is unit-tested.
 *
 * What is checked:
 * - every Scripture reference, in any field, exists in the BSB (otherwise it is removed or marked);
 * - every quotation of Scripture matches the BSB text of its reference word for word (punctuation and case aside);
 *   quoted wording elsewhere in the prose must match a passage cited or retrieved, or it is removed;
 * - every original-language note names a lexical entry (Strong's number) that occurs in the verse it is about;
 * - approved, licensed teaching informs the answer in the assistant's own words (one assistant, not a panel of
 *   teachers): the model lists the documents it relied on, never names their authors, and a credit line is shown only
 *   where a source's licence requires attribution. A sentence naming an approved teacher is removed unless the member's
 *   question asks about that teacher and a provided document by them was used; attributions to anyone else outside
 *   the approved eleven are always removed;
 * - every free-text field (title, notes, explanations, history, application, questions, further study) gets the same
 *   reference, quotation and attribution checks; the crisis guidance is fixed server text;
 * - lengths are capped. Failures are listed so the server can ask once more, then removed and noted for the member.
 */
import { z } from "zod";
import { findReferences } from "@/lib/bible/ai";
import { formatReference, parseReference, type ScriptureRef } from "@/lib/bible/reference";
import { strongBase } from "@/lib/bible/original-languages";
import { EVIDENCE_KINDS, EVIDENCE_LABEL, type Depth, type EvidenceKind } from "./config";
import { APPROVED_TEACHERS } from "./teachers";

export { EVIDENCE_KINDS, EVIDENCE_LABEL, type EvidenceKind } from "./config";

const short = (n: number) => z.string().trim().max(n);
/** What the model submits (tool input). Unknown fields are dropped; every string is capped. */
export const rawAnswerSchema = z.object({
  title: short(100).optional(),
  answer: short(6000),
  scripture: z.array(z.object({ reference: short(80), quote: short(1500).optional(), note: short(600).optional() })).max(20).default([]),
  context: short(4000).optional(),
  original_language: z.array(z.object({ reference: short(80), strong: short(12), word: short(80).optional(), explanation: short(1500) })).max(10).default([]),
  history: z.array(z.object({ claim: short(1200), evidence: z.enum(EVIDENCE_KINDS) })).max(10).default([]),
  knowledge_used: z.array(short(60)).max(6).default([]),
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
      knowledge_used: {
        type: "array",
        description: "The ids of <knowledge> documents that informed this answer. Empty when none were provided or used.",
        items: { type: "string" },
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
/** A credit a source's licence requires (shown at the end of the answer); only for sources marked as requiring it. */
export interface SourceCredit {
  attribution: string;
  url: string | null;
}
export interface ValidatedAnswer {
  title: string;
  answer: string;
  scripture: ScriptureItem[];
  context: string | null;
  originalLanguage: LanguageItem[];
  history: { claim: string; evidence: EvidenceKind }[];
  /** Credits required by the licences of the knowledge used (usually empty). */
  sources: SourceCredit[];
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
  /** The credit its source's licence requires, or null when none is required (then nothing is shown). */
  attribution: string | null;
}

export interface ValidationDeps {
  /** The BSB text of a reference, or null when the BSB doesn't have it. */
  passageText: (ref: ScriptureRef) => string | null;
  /** Whether the lexical entry occurs in that verse (original-language data). */
  verseHasStrong: (ref: ScriptureRef, strong: string) => boolean;
  /** The word as written in that verse for the entry (shown instead of the model's spelling). */
  wordFor?: (ref: ScriptureRef, strong: string) => string | null;
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

/** The most words an ellipsis may leave out between two parts of a quotation. */
export const MAX_ELLIPSIS_GAP = 20;

/**
 * Whether a quotation is the passage's wording. Without an ellipsis: the whole quotation appears in the text. With
 * ellipses: every part has at least three words, the parts appear in order, and no ellipsis skips more than
 * MAX_ELLIPSIS_GAP words, so "everyone who believes … shall … perish" can't turn John 3:16 around.
 */
export function quoteMatches(quote: string, text: string): boolean {
  const words = normalizeWords(text).split(" ").filter(Boolean);
  const parts = quote
    .split(/\.\s*\.\s*\.|…/)
    .map((p) => normalizeWords(p).split(" ").filter(Boolean))
    .filter((p) => p.length);
  if (!parts.length) return false;
  if (parts.length > 1 && parts.some((p) => p.length < 3)) return false;
  if (parts.length === 1 && parts[0]!.length < 2) return false;
  const find = (part: string[], from: number): number => {
    for (let i = from; i + part.length <= words.length; i++) if (part.every((w, j) => words[i + j] === w)) return i;
    return -1;
  };
  let end = -1;
  for (const [k, part] of parts.entries()) {
    const at = find(part, end + 1);
    if (at < 0) return false;
    if (k > 0 && at - end - 1 > MAX_ELLIPSIS_GAP) return false;
    end = at + part.length - 1;
  }
  return true;
}

/**
 * Quoted spans of four words or more in prose: “…”, "…", ‘…’ and '…' (single quotes only when they open after a space
 * and close before a space or punctuation, so apostrophes aren't mistaken for quotes). `long` holds double-quoted spans
 * too long to be a quotation that can be checked.
 */
export function quotedSpans(text: string): string[] {
  const out: string[] = [];
  const push = (m: RegExpMatchArray) => {
    if (m[1]!.trim().split(/\s+/).length >= 4) out.push(m[0]);
  };
  for (const m of text.matchAll(/[“"]([^”"]{8,600})[”"]/g)) push(m);
  for (const m of text.matchAll(/(?<=^|[\s(—–-])[‘']([^’'\n]{8,600}?)[’'](?=$|[\s.,;:!?)—–-])/g)) push(m);
  return out;
}
export function longQuotedSpans(text: string): string[] {
  return [...text.matchAll(/[“"‘]([^”"’]{601,})[”"’]/g)].map((m) => m[0]);
}

/** Sentences, without breaking at initials ("C. S. Lewis", "R.C. Sproul") or verse numbers. */
export function sentencesOf(text: string): string[] {
  return text.match(/(?:[^.!?\n]|(?<=\b[A-Z])\.|\.(?=\d))+[.!?]?["”’']?/g) ?? [];
}

/** A reference exists only if its first and last verse are both in the BSB (a range running past the chapter fails). */
function exists(deps: ValidationDeps, ref: ScriptureRef): boolean {
  if (deps.passageText(ref) === null) return false;
  if (ref.verseEnd === undefined) return true;
  return deps.passageText({ bookId: ref.bookId, chapter: ref.chapterEnd ?? ref.chapter, verseStart: ref.verseEnd }) !== null;
}

const ATTRIBUTION =
  /\b(says?|said|teach(es|ing)?|taught|writes?|wrote|argues?|argued|believes?|believed|holds?|held|explains?|explained|preach(es|ed)?|states?|stated|notes?|noted|insists?|insisted|claims?|claimed|maintains?|maintained|suggests?|suggested|emphasi[sz]es?|emphasi[sz]ed|warns?|warned|observes?|observed|points? out|calls?|called|describes?|described|according to|in (his|her) (sermon|book|article|teaching|view)|views?|position|perspective|interpretation|sermon|book)\b/i;

/** Approved teachers: full names always; surnames only with a capital letter (and never a surname that is an ordinary word, such as "Comfort"). */
const TEACHER_FORMS = APPROVED_TEACHERS.map((t) => {
  const surname = t.name.split(" ").at(-1)!;
  const forms = [t.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")];
  if (surname !== "Comfort") forms.push(surname);
  return { name: t.name, re: new RegExp(`\\b(?:${forms.join("|")})\\b`), full: new RegExp(`\\b${forms[0]}\\b`, "i") };
});
/** Well-known teachers outside the approved list: never attributed (founder rule: only the eleven). */
const OTHER_TEACHERS = /\b(Sproul|Calvin|Luther|Spurgeon|C\.\s?S\.\s?Lewis|Keller|N\.\s?T\.\s?Wright|Grudem|Augustine|Aquinas|Wesley|Jonathan Edwards|Packer|Stott|Francis Chan|Osteen|Joyce Meyer|Bonhoeffer|Tozer|Ryle|Lloyd-Jones|Chesterton|Barth|Lucado|David Platt|Matt Chandler|DeYoung|Sinclair Ferguson|James White)\b/;
const INITIALS_NAME = /\b[A-Z]\.\s?(?:[A-Z]\.\s?)?[A-Z][a-z]{2,}\b/;

/**
 * Sentences that name a teacher the answer may not name. `allowed` holds the approved teachers the member asked about
 * whose provided documents were used. Removed: any sentence with an approved teacher's full name (the assistant speaks
 * as one voice, never as a panel of teachers, and never implies endorsement); a surname or a possessive ("In
 * MacArthur's view…") next to an attribution word; and attributions to well-known teachers outside the approved list
 * or to names written with initials.
 */
export function teacherAttributions(text: string, allowed: string[] = []): string[] {
  const ok = new Set(allowed.map((a) => a.trim().toLowerCase()));
  return sentencesOf(text)
    .filter((sentence) => {
      if (TEACHER_FORMS.some((t) => t.full.test(sentence) && !ok.has(t.name.toLowerCase()))) return true;
      const possessive = /\b[A-Z][a-zA-Z.-]+[’']s\b/.test(sentence);
      if (!ATTRIBUTION.test(sentence) && !possessive) return false;
      if (TEACHER_FORMS.some((t) => t.re.test(sentence) && !ok.has(t.name.toLowerCase()))) return true;
      return OTHER_TEACHERS.test(sentence) || INITIALS_NAME.test(sentence);
    })
    .map((x) => x.trim());
}

/** The approved teachers a question asks about by name (full name, or surname with a capital letter). */
export function teachersNamedIn(question: string): string[] {
  return TEACHER_FORMS.filter((t) => t.re.test(question)).map((t) => t.name);
}

/** Text shaped like a reference ("Hezekiah 3:5", "II Kings 2:11", "Song of Solomon 2:4", "Romans 8:28–9:1"). */
const REFERENCE_SHAPE = /\b(?:(?:[1-3]|I{1,3})\s)?[A-Z][a-z]+(?:\s(?:of\s)?[A-Z][a-z]+){0,2}\.?\s\d{1,3}:\d{1,3}(?:\s?[-–]\s?\d{1,3}(?::\d{1,3})?)?/g;
/** References to a book the Bible doesn't have. A shape is a real book if any of its endings parses ("See John 3:16"). */
export function unknownBookReferences(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(REFERENCE_SHAPE)) {
    const words = m[0].split(/\s+/);
    let real = false;
    for (let i = 0; i < words.length - 1 && !real; i++) real = parseReference(words.slice(i).join(" ").replace(/^Psalms?\b/, "Psalm")) !== null;
    // Report the book word and numbers only ("See Hezekiah 3:5" → "Hezekiah 3:5").
    if (!real) out.push(words.slice(-2).join(" "));
  }
  return out;
}

function parse(raw: string): ScriptureRef | null {
  return parseReference(raw.replace(/^Psalms?\b/i, "Psalm").trim());
}

const NOT_FOUND = " [reference not found in the BSB]";
function mark(text: string, raw: string): string {
  return text.split(raw).map((part, i, all) => (i < all.length - 1 && !all[i + 1]!.startsWith(NOT_FOUND) ? `${part}${raw}${NOT_FOUND}` : i < all.length - 1 ? `${part}${raw}` : part)).join("");
}

/** Fixed crisis guidance (never the model's own words, so no one can make it show a different number or link). */
export const SAFETY_TEXT =
  "If you or someone else is in danger or thinking about suicide, please get help now: call or text 988 (Suicide & Crisis Lifeline, US) or your local emergency number (911 in the US). Talk to a doctor, a counsellor and a trusted pastor. You are not alone.";

/** Words in a question that call for the crisis guidance whatever the model writes. */
export const CRISIS_PATTERN = /\b(suicid\w*|kill (?:myself|me)|end (?:my|it) (?:life|all)|want to die|don'?t want to (?:live|be alive)|self[- ]?harm\w*|cutting myself|overdos\w*|being abused|abus(?:e|ing) me|hurt(?:s|ing)? me|in danger|emergency)\b/i;

interface ProseContext {
  deps: ValidationDeps;
  /** BSB text of each passage cited or retrieved, by formatted reference. */
  passages: Map<string, string>;
  /** Approved teachers this answer may name (asked about by the member, with a document by them used). */
  allowedTeachers: string[];
  failures: string[];
  limitations: Set<string>;
}

/** Run every check on one piece of prose; returns the cleaned text. */
function checkProse(text: string, c: ProseContext): string {
  let out = text;
  for (const { raw, ref } of findReferences(out)) {
    if (ref && exists(c.deps, ref)) continue;
    c.failures.push(`"${raw}" is not a passage in the Berean Standard Bible.`);
    out = mark(out, raw);
    c.limitations.add("A reference that isn't in the Bible was marked.");
  }
  for (const raw of new Set(unknownBookReferences(out))) {
    c.failures.push(`"${raw}" is not a passage in the Berean Standard Bible.`);
    out = mark(out, raw);
    c.limitations.add("A reference that isn't in the Bible was marked.");
  }
  for (const span of longQuotedSpans(out)) {
    c.failures.push("A quotation is too long to check; quote at most a few verses.");
    out = out.split(span).join("[quotation removed: its wording could not be verified]");
    c.limitations.add("A quotation whose wording couldn't be verified was removed.");
  }
  const sentences = sentencesOf(out);
  for (const span of quotedSpans(out)) {
    const inner = span.slice(1, -1);
    // A quotation next to a reference must be that reference's wording; otherwise any passage cited or retrieved.
    const sentence = sentences.find((x) => x.includes(span)) ?? "";
    const near = findReferences(sentence)
      .map(({ ref }) => (ref ? formatReference(ref) : null))
      .filter((r): r is string => Boolean(r));
    const candidates = near.length ? near.map((r) => c.passages.get(r) ?? (parse(r) ? c.deps.passageText(parse(r)!) : null) ?? "") : [...c.passages.values()];
    if (candidates.some((t) => quoteMatches(inner, t))) continue;
    c.failures.push(`The quotation ${span} does not match the BSB wording of ${near.length ? near.join(", ") : "any passage provided"}.`);
    // Keep the sentence's own ending, so removing the quotation never merges two sentences.
    const end = inner.trim().match(/[.!?]$/)?.[0] ?? "";
    out = out.split(span).join(`[quotation removed: its wording could not be verified]${end}`);
    c.limitations.add("A quotation whose wording couldn't be verified was removed.");
  }
  for (const sentence of teacherAttributions(out, c.allowedTeachers)) {
    c.failures.push(`"${sentence}" names a teacher. Write in your own words without naming teachers (only a teacher the question asks about, from a provided document by them).`);
    out = out.split(sentence).join("").replace(/\s{2,}/g, " ").trim();
    c.limitations.add("A statement naming a person was removed, because the assistant answers in its own words from Scripture and verified sources.");
  }
  return out;
}

/** Check a piece of text (used for study plans): the cleaned text and what was wrong. */
export function checkText(text: string, deps: ValidationDeps): { text: string; failures: string[] } {
  const failures: string[] = [];
  const passages = new Map<string, string>();
  for (const r of deps.retrieved) {
    const ref = parse(r);
    const t = ref ? deps.passageText(ref) : null;
    if (t) passages.set(r, t);
  }
  return { text: checkProse(text, { deps, passages, allowedTeachers: [], failures, limitations: new Set() }), failures };
}

/** Check and clean a submitted answer. */
export function validateAnswer(input: RawAnswer, deps: ValidationDeps, depth: Depth, opts: { crisis?: boolean; question?: string } = {}): ValidationResult {
  const failures: string[] = [];
  const limitations = new Set<string>();

  // Scripture: valid references only; a quotation is kept only if it is the BSB's wording of that reference.
  const scriptureRefs: { reference: string; quote: string | null; note: string | null }[] = [];
  const passages = new Map<string, string>();
  for (const s of input.scripture) {
    const ref = parse(s.reference);
    const text = ref && exists(deps, ref) ? deps.passageText(ref) : null;
    if (!ref || text === null) {
      failures.push(`"${s.reference}" is not a passage in the Berean Standard Bible.`);
      limitations.add("A reference that isn't in the Bible was removed.");
      continue;
    }
    const reference = formatReference(ref);
    if (passages.has(reference)) continue;
    passages.set(reference, text);
    let quote: string | null = s.quote?.trim() ? s.quote.trim() : null;
    if (quote && !quoteMatches(quote, text)) {
      failures.push(`The quotation given for ${reference} is not the BSB wording of ${reference}.`);
      limitations.add("A quotation that didn't match the BSB was removed (the passage itself is shown from the BSB).");
      quote = null;
    }
    scriptureRefs.push({ reference, quote, note: s.note?.trim() || null });
  }
  for (const r of deps.retrieved) {
    if (passages.has(r)) continue;
    const ref = parse(r);
    const t = ref ? deps.passageText(ref) : null;
    if (t) passages.set(r, t);
  }

  // Knowledge used: only approved documents retrieved for this question. Nothing of them is shown except a credit
  // that a source's licence requires.
  const docs: SourceDocument[] = [];
  for (const id of new Set(input.knowledge_used)) {
    const doc = deps.documents.get(id);
    if (!doc) {
      failures.push(`Knowledge document "${id}" is not one of the documents provided.`);
      continue;
    }
    docs.push(doc);
  }
  const asked = new Set(teachersNamedIn(opts.question ?? "").map((n) => n.toLowerCase()));
  const allowedTeachers = [...new Set(docs.map((d) => d.author).filter((a) => asked.has(a.trim().toLowerCase())))];
  const ctx: ProseContext = { deps, passages, allowedTeachers, failures, limitations };
  const prose = (t: string | undefined | null) => (t?.trim() ? checkProse(t.trim(), ctx) || null : null);

  const scripture: ScriptureItem[] = scriptureRefs.map((s) => ({ ...s, note: prose(s.note) }));
  const sources: SourceCredit[] = [];
  for (const d of docs) {
    if (d.attribution && !sources.some((c) => c.attribution === d.attribution)) sources.push({ attribution: d.attribution, url: d.url || null });
  }

  // Original languages: a real Strong's number (not one of STEP's prefix codes) that occurs in the verse; the word
  // shown is the one from the data, never the model's spelling.
  const originalLanguage: LanguageItem[] = [];
  const seenWords = new Set<string>();
  for (const o of input.original_language) {
    const ref = parse(o.reference);
    const strong = strongBase(o.strong);
    if (!ref || !strong || Number(strong.slice(1)) >= 9000 || !exists(deps, ref) || !deps.verseHasStrong(ref, strong)) {
      failures.push(`Original-language note: ${o.strong} does not occur in ${o.reference}.`);
      limitations.add("An original-language note that couldn't be checked against the Hebrew or Greek text was removed.");
      continue;
    }
    const key = `${formatReference(ref)}|${strong}`;
    if (seenWords.has(key)) continue;
    seenWords.add(key);
    const explanation = prose(o.explanation);
    if (explanation) originalLanguage.push({ reference: formatReference(ref), strong, word: deps.wordFor?.(ref, strong) ?? null, explanation });
  }

  const answerText = prose(input.answer) ?? "";
  if (!answerText) failures.push("The answer is empty.");
  if (!scripture.length) failures.push("No valid Scripture passage was given.");

  const history = input.history.map((h) => ({ claim: prose(h.claim) ?? "", evidence: h.evidence })).filter((h) => h.claim);
  const furtherStudy = input.further_study
    .map((f) => {
      const ref = parse(f);
      if (ref) return exists(deps, ref) ? formatReference(ref) : null;
      const before = failures.length;
      const cleaned = prose(f);
      // A topic line is kept only if it passed every check as written.
      return cleaned && failures.length === before ? cleaned : null;
    })
    .filter((f): f is string => Boolean(f));
  const titleFailures = failures.length;
  const title = prose(input.title);

  const answer: ValidatedAnswer = {
    title: ((failures.length === titleFailures && title) || answerText.split(/[.?!]/)[0] || "Bible study").slice(0, 100),
    answer: answerText,
    scripture,
    context: depth === "quick" ? null : prose(input.context),
    originalLanguage: depth === "deep" ? originalLanguage : originalLanguage.slice(0, 2),
    history,
    sources,
    application: depth === "quick" ? null : prose(input.application),
    reflectionQuestions: input.reflection_questions.map((q) => prose(q) ?? "").filter(Boolean),
    furtherStudy,
    uncertainty: prose(input.uncertainty),
    // Fixed text whenever the model saw a reason for it, or the question itself shows one.
    safety: input.safety?.trim() || opts.crisis ? SAFETY_TEXT : null,
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
  if (a.sources.length) parts.push(["Sources:", ...a.sources.map((c) => (c.url ? `${c.attribution} (${c.url})` : c.attribution))].join("\n"));
  if (a.application) parts.push(`Application: ${a.application}`);
  if (a.reflectionQuestions.length) parts.push(["Reflection:", ...a.reflectionQuestions.map((q) => `- ${q}`)].join("\n"));
  if (a.uncertainty) parts.push(`Where Christians differ: ${a.uncertainty}`);
  if (a.safety) parts.push(a.safety);
  return parts.join("\n\n").slice(0, 24000);
}
