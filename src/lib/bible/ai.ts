import { BIBLE_BOOKS } from "./books";
import { formatReference, parseReference, type ScriptureRef } from "./reference";

/*
 * The Bible study helper's pure parts: finding references in text, the instructions the model follows, and checking
 * every reference an answer cites. The helper is separate from the fitness coach (its own prompt, quota and history)
 * and never sees the member's prayer journal or any other personal data.
 */

/** Book names and common abbreviations, longest first, for spotting references in free text. */
const NAMES = [...new Set(BIBLE_BOOKS.flatMap((b) => [b.name, ...b.abbreviations, b.id === "PSA" ? "Psalm" : b.name]))]
  .filter((n) => n.length >= 2)
  .sort((a, b) => b.length - a.length)
  .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"));
const REF_PATTERN = new RegExp(`\\b(?:${NAMES.join("|")})\\.?\\s+\\d{1,3}(?:\\s*[:.]\\s*\\d{1,3})?(?:\\s*[-–—]\\s*\\d{1,3}(?:\\s*[:.]\\s*\\d{1,3})?)?`, "gi");

/**
 * Every Scripture reference written in the text, in order of appearance (duplicates removed). `ref` is null for text
 * shaped like a reference that names a chapter or verse the Bible doesn't have (e.g. "Psalm 151"), so it can be flagged.
 */
export function findReferences(text: string): { raw: string; ref: ScriptureRef | null }[] {
  const out: { raw: string; ref: ScriptureRef | null }[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(REF_PATTERN)) {
    const raw = m[0].replace(/\s+/g, " ").trim();
    const ref = parseReference(raw);
    const key = ref ? formatReference(ref) : raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ raw, ref });
  }
  return out;
}

const STOP = new Set(
  "a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just me more most my no nor not of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your bible verse verses say says said tell teach teaches mean means god's lord's what's does".split(" "),
);

/** The words of a question worth searching for (no stop words, at least three letters), most distinctive first. */
export function searchTerms(question: string, max = 4): string[] {
  const words = question
    .toLowerCase()
    .replace(/[^a-z' ]+/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w.length >= 3 && !STOP.has(w));
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, max);
}

export const BIBLE_AI_SYSTEM = `You are the Bible study helper in the Narrow Gate Fitness app. You help people read and understand the Bible.

How to answer:
- Base your answer on the passages given in <passages>, which are from the Berean Standard Bible (BSB). Quote only words that appear in <passages>, exactly as written.
- Cite each passage you refer to as Book Chapter:Verse, for example John 3:16 or Romans 8:28–30. Cite only references you are certain exist.
- Keep what the text says separate from interpretation. Where Christians hold different views, say so briefly and fairly, without taking denominational sides.
- Do not explain the meaning of Greek, Hebrew or Aramaic words.
- Never speak as God, and never claim to know God's particular will for the person. You are not a pastor, priest or counsellor; you are an AI study helper, and you may encourage them to talk with their pastor or church.
- If the question is about a crisis, abuse, self-harm, or a medical or legal matter, keep it brief and gently urge them to contact the right help now (emergency services, a doctor, a trusted pastor).
- If the passages don't answer the question, say so and suggest where in the Bible to read.
- Be warm, clear and concise: under 250 words. When it helps, end with one question for reflection.`;

export interface ContextPassage {
  reference: string;
  text: string;
}

/** The user message: the retrieved passages, then the question. */
export function buildBibleAiMessage(question: string, passages: ContextPassage[]): string {
  const body = passages.length ? passages.map((p) => `${p.reference}: ${p.text}`).join("\n") : "(No passages matched. Say so, and suggest where to read.)";
  return `<passages>\n${body}\n</passages>\n\nQuestion: ${question}`;
}

export interface CitationCheck {
  /** References in the answer that exist in the BSB. */
  verified: ScriptureRef[];
  /** References in the answer that don't (a chapter or verse that doesn't exist). */
  unverified: string[];
}

/** Check every reference an answer cites against the verified text (`exists` looks the passage up). */
export function checkCitations(answer: string, exists: (ref: ScriptureRef) => boolean): CitationCheck {
  const verified: ScriptureRef[] = [];
  const unverified: string[] = [];
  for (const { raw, ref } of findReferences(answer)) {
    if (ref && exists(ref)) verified.push(ref);
    else unverified.push(raw);
  }
  return { verified, unverified };
}

/** Mark references the text doesn't contain, so a reader can't mistake them for real citations. */
export function markUnverified(answer: string, unverified: string[]): string {
  let out = answer;
  for (const raw of unverified) out = out.split(raw).join(`${raw} [reference not found in the BSB]`);
  return out;
}

/** Quotas: the Bible helper is free for everyone, within limits that keep its cost bounded. */
export const BIBLE_AI_LIMITS = {
  free: { perMinute: 3, daily: 10, monthly: 60 },
  pro: { perMinute: 5, daily: 40, monthly: 400 },
} as const;
export const BIBLE_AI_MAX_QUESTION = 600;
/** Room for a full answer with its quotations (the instructions ask for under 250 words; this is only the ceiling). */
export const BIBLE_AI_MAX_TOKENS = 2000;
/** Added to an answer the model had to stop before finishing (stop reason `max_tokens`). */
export const BIBLE_AI_CUT_SHORT_NOTE = "(This answer was cut short. Ask a follow-up question to hear the rest.)";
/** Shown when the model declines to answer (stop reason `refusal`); the question isn't counted. */
export const BIBLE_AI_REFUSAL = "The helper can't answer that one. Try asking about a passage, a person or a theme in the Bible.";
/** The helper sends the question to the AI provider, so it waits for the same permission as every other AI feature. */
export const BIBLE_AI_CONSENT_REQUIRED = "Allow AI data sharing first: choose Allow on the Ask about the Bible screen. You can turn it off any time in Profile & Settings → Privacy & data.";
export const BIBLE_AI_DISABLED = "The Bible study helper is temporarily unavailable. The Bible itself is always free to read and search.";
