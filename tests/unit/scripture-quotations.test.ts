import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FAITH_MOTIVATIONS, SCRIPTURES, SEED_CONTENT } from "@/data/content";
import { DEVOTIONALS } from "@/data/devotionals";
import { FAITH_CHALLENGES } from "@/data/faith-challenges";
import { HABIT_PROGRAMS } from "@/data/habit-programs";
import { BSB_FRAGMENTS, BSB_PASSAGES, scriptureText } from "@/data/scripture";
import { STUDIES } from "@/data/studies";
import { TOPICS } from "@/lib/bible/plans";
import { parseReference } from "@/lib/bible/reference";
import { COACH_VERSES } from "@/lib/coach/knowledge";
import { RANKS } from "@/lib/domain/ranks";
import { FAITH_REMINDER_INFO } from "@/lib/faith-reminders";
import { JOURNEY_RULE, REASON_TEXT, RESTART_MESSAGE, RESTART_REFERENCE, RULE_GRACE } from "@/lib/faith/journey-copy";
import { APP_REMINDER_INFO } from "@/lib/notifications/catalog";
import { reminderMessage } from "@/lib/reminders";
import { getPassage, passageText } from "@/server/bible/text";

/*
 * Scripture integrity (audit 2026-11-14). Every verse reference the app writes must exist in the bundled Berean
 * Standard Bible (public/bible/bsb), and every quotation of Scripture must be that text, word for word. This file
 * checks them all in one place, against the full Bible (not only the 68 extracted passages):
 *   1. the three foundation passages, pinned to the dataset;
 *   2. every stored (reference, text) pair: verses of the day, the 40 devotionals, the coach's quotable verses,
 *      the extracted passages file, notification fragments and the offline edition's own copy;
 *   3. every reference written anywhere in the source resolves to verses that exist;
 *   4. every quoted phrase inside faith commentary is either the exact BSB wording of a passage that item cites, or
 *      a reviewed non-Scripture phrase (someone's own words, a word being discussed). A new quoted phrase fails here
 *      until someone has looked at it.
 */

const ROOT = process.cwd();
const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** The dataset's text for a reference as the app writes it, or null when the reference matches nothing. */
function bsb(reference: string): string | null {
  const ref = parseReference(reference);
  return ref ? passageText(ref) : null;
}

/** Does every verse the reference names exist (not only the first)? */
function fullyExists(reference: string): boolean {
  const ref = parseReference(reference);
  if (!ref) return false;
  const verses = getPassage(ref);
  if (!verses.length) return false;
  if (ref.verseStart !== undefined && verses[0]!.verse !== ref.verseStart) return false;
  const lastWanted = ref.verseEnd ?? (ref.chapterEnd === undefined ? ref.verseStart : undefined);
  if (lastWanted !== undefined && verses.at(-1)!.verse !== lastWanted) return false;
  return true;
}

const BOOK_NAMES =
  "Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|[12] Samuel|[12] Kings|[12] Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Song of Songs|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|[123] John|John|Acts|Romans|[12] Corinthians|Galatians|Ephesians|Philippians|Colossians|[12] Thessalonians|[12] Timothy|Titus|Philemon|Hebrews|James|[12] Peter|Jude|Revelation";
/** "Book c:v", "Book c:v–v", "Book c:v–c:v" (hyphen or en dash). Chapter-only mentions are not verse references. */
const REFERENCE = new RegExp(`(?<![A-Za-z])(?:${BOOK_NAMES}) \\d{1,3}:\\d{1,3}(?:[–-]\\d{1,3}(?::\\d{1,3})?)?`, "g");

/**
 * The red-letter review notes name verses the BSB prints only in its footnotes (verse numbers kept, no text). Those
 * are real verse numbers without text, listed in the dataset's own metadata; nowhere else may a reference be textless.
 */
function footnotedOnly(file: string, reference: string): boolean {
  if (!file.endsWith(path.join("data", "bible", "red-letter-review.ts"))) return false;
  const ref = parseReference(reference);
  if (!ref || ref.verseStart === undefined) return false;
  const meta = JSON.parse(readFileSync(path.join(ROOT, "public/bible/bsb/meta.json"), "utf8")) as { books: { id: string; withoutText: string[] }[] };
  return Boolean(meta.books.find((b) => b.id === ref.bookId)?.withoutText.includes(`${ref.chapter}:${ref.verseStart}`));
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx|json)$/.test(e.name) && !/usda-foods\.json$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("the three foundation passages", () => {
  // Pinned from the dataset on 2026-11-14 (public/bible/bsb, content SHA-256 515ba91d…): if the dataset or the
  // extracted copy ever drifts, this fails.
  const FOUNDATION: Record<string, string> = {
    "Matthew 7:13–14":
      "Enter through the narrow gate. For wide is the gate and broad is the way that leads to destruction, and many enter through it. But small is the gate and narrow the way that leads to life, and only a few find it.",
    "1 Corinthians 6:19–20":
      "Do you not know that your body is a temple of the Holy Spirit who is in you, whom you have received from God? You are not your own; you were bought at a price. Therefore glorify God with your body.",
    "John 15:5": "I am the vine and you are the branches. The one who remains in Me, and I in him, will bear much fruit. For apart from Me you can do nothing.",
  };

  it.each(Object.entries(FOUNDATION))("%s is exact in the Bible, the extracted passages and everywhere it is shown", (reference, text) => {
    expect(bsb(reference)).toBe(text);
    expect(BSB_PASSAGES[reference]).toBe(text);
    expect(scriptureText(reference, "fallback")).toBe(text);
    for (const s of SCRIPTURES.filter((x) => x.reference === reference)) expect(s.text).toBe(text);
    for (const d of DEVOTIONALS.filter((x) => x.reference === reference)) expect(d.scripture).toBe(text);
    for (const v of COACH_VERSES.filter((x) => x.reference === reference)) expect(v.text).toBe(text);
  });

  it("the home page, the opening and sign-up take their verse from the BSB file, not from typed text", () => {
    const home = readFileSync(path.join(ROOT, "src/app/page.tsx"), "utf8");
    expect(home).toMatch(/scriptureText\(\s*"Matthew 7:13–14"/);
    const layout = readFileSync(path.join(ROOT, "src/app/layout.tsx"), "utf8");
    expect(layout).toMatch(/scriptureText\("Matthew 7:13–14"/);
    const signup = readFileSync(path.join(ROOT, "src/app/(auth)/signup/page.tsx"), "utf8");
    expect(signup).toMatch(/scriptureText\(\s*"Philippians 4:13"/);
    // The typed fallbacks in those calls are the BSB text too.
    for (const src of [home, signup]) {
      for (const m of src.matchAll(/scriptureText\(\s*"([^"]+)",\s*"([^"]*)"/g)) expect(m[2], m[1]).toBe(bsb(m[1]!));
    }
  });
});

describe("every stored verse is the BSB text for its reference", () => {
  const pairs: [where: string, reference: string, text: string][] = [
    ...Object.entries(BSB_PASSAGES).map(([r, t]) => ["bsb-passages.json", r, t] as [string, string, string]),
    ...SCRIPTURES.map((s) => ["verse of the day", s.reference, s.text] as [string, string, string]),
    ...DEVOTIONALS.map((d) => [`devotional day ${d.day}`, d.reference, d.scripture] as [string, string, string]),
    ...COACH_VERSES.map((v) => ["coach verse list", v.reference, v.text] as [string, string, string]),
  ];

  it(`checks ${pairs.length} stored verses against the full Bible`, () => {
    expect(pairs.length).toBeGreaterThanOrEqual(68 + 40 + 40);
    const wrong = pairs.filter(([, reference, text]) => bsb(reference) !== text).map(([where, reference]) => `${where}: ${reference}`);
    expect(wrong).toEqual([]);
  });

  it("notification fragments are exact, contiguous parts of their verse", () => {
    for (const [reference, fragment] of Object.entries(BSB_FRAGMENTS)) expect(bsb(reference), reference).toContain(fragment);
  });

  it("the offline edition's own copy of the verses and devotionals is the BSB text", () => {
    const html = readFileSync(path.join(ROOT, "standalone/index.html"), "utf8");
    const json = html.match(/<script id="ngf-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
    expect(json).toBeTruthy();
    const data = JSON.parse(json!) as { sc: { r: string; t: string }[]; dv: { d: number; r: string; s: string }[] };
    expect(data.sc.length).toBeGreaterThan(0);
    expect(data.dv).toHaveLength(40);
    const wrong = [...data.sc.map((s) => [s.r, s.t] as const), ...data.dv.map((d) => [d.r, d.s] as const)].filter(([r, t]) => bsb(r) !== t).map(([r]) => r);
    expect(wrong).toEqual([]);
    // Quotations written into the page itself.
    const page = html.replace(/<script id="ngf-data"[\s\S]*?<\/script>/, "");
    const inline = [...page.matchAll(/“([^”]{8,300})”\s*\((?:([^()]*?\d+:\d+[^()]*?), )?BSB\)/g)];
    for (const m of inline) {
      const quoted = collapse(m[1]!);
      const where = m[2] ?? [...page.slice(Math.max(0, m.index! - 80), m.index!).matchAll(REFERENCE)].at(-1)?.[0];
      expect(where, quoted).toBeTruthy();
      expect(bsb(where!), `${where}: ${quoted}`).toContain(quoted);
    }
    expect(inline.length).toBeGreaterThan(0);
  });

  it("the offline edition's devotional commentary is the app's, word for word (one text to review, not two)", () => {
    const html = readFileSync(path.join(ROOT, "standalone/index.html"), "utf8");
    const data = JSON.parse(html.match(/<script id="ngf-data" type="application\/json">([\s\S]*?)<\/script>/)![1]!) as { dv: { d: number; t: string; v: string; p: string; q: string }[] };
    for (const d of data.dv) {
      const app = DEVOTIONALS.find((x) => x.day === d.d)!;
      expect({ title: d.t, devotional: d.v, prayer: d.p, reflection: d.q }, `day ${d.d}`).toEqual({ title: app.title, devotional: app.devotional, prayer: app.prayer, reflection: app.reflection });
    }
  });
});

describe("every reference written in the app exists in the bundled Bible", () => {
  it("references in data files, components, pages and copy", () => {
    const missing: string[] = [];
    let checked = 0;
    const files = [...sourceFiles(path.join(ROOT, "src")), path.join(ROOT, "standalone/index.html")];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(REFERENCE)) {
        checked++;
        if (!fullyExists(m[0]) && !footnotedOnly(file, m[0])) missing.push(`${path.relative(ROOT, file)}: ${m[0]}`);
      }
    }
    expect(checked).toBeGreaterThan(400);
    expect([...new Set(missing)]).toEqual([]);
  });

  it("structured references: studies, daily challenges, ranks, topical plans, faith programs, the restart message", () => {
    const refs: string[] = [
      ...STUDIES.flatMap((s) => s.lessons.flatMap((l) => [l.passage, ...l.crossReferences])),
      ...FAITH_CHALLENGES.map((c) => c.reference),
      ...RANKS.map((r) => r.reference),
      ...Object.values(TOPICS).flatMap((t) => t.passages),
      RESTART_REFERENCE,
    ];
    expect(refs.length).toBeGreaterThan(150);
    expect(refs.filter((r) => !fullyExists(r))).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------- Quoted phrases in commentary

/**
 * Quoted phrases in faith commentary that are NOT Scripture, each read and confirmed (2026-11-14): a person's own
 * thought, or a word the commentary is talking about. They must not appear in a way that presents them as a verse.
 */
const NOT_SCRIPTURE = new Set([
  "I have been loved and welcomed, so I want to steward this life well",
  "I've already blown it, so why bother",
  "be impressive",
  "gymnasium",
  "I used to be stronger",
  "I've never been athletic",
  "I always quit",
  "The world does not depend on me",
  "no",
  "yes",
]);

interface Quoted {
  where: string;
  phrase: string;
  /** Passages this item cites: its own, and any named in the same string. */
  passages: string[];
}

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) strings(v, out);
  return out;
}

function quotedIn(where: string, texts: string[], ownReferences: string[]): Quoted[] {
  const out: Quoted[] = [];
  for (const text of texts) {
    const named = [...text.matchAll(REFERENCE)].map((m) => m[0]);
    for (const m of text.matchAll(/"([^"]{2,400})"|“([^”]{2,400})”/g)) {
      const phrase = collapse((m[1] ?? m[2])!.replace(/[.,;:!?…]+$/, ""));
      out.push({ where, phrase, passages: [...ownReferences, ...named] });
    }
  }
  return out;
}

/** The phrase appears in the passage as whole words (a quotation may start mid-sentence, so its first letter's case may differ). */
function includesLoosely(passage: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, "i").test(passage);
}

describe("quoted phrases inside faith commentary", () => {
  const quoted: Quoted[] = [
    ...DEVOTIONALS.flatMap((d) => quotedIn(`devotional day ${d.day} (${d.reference})`, [d.title, d.devotional, d.prayer, d.reflection, d.train], [d.reference])),
    ...SCRIPTURES.flatMap((s) => quotedIn(`verse of the day ${s.reference}`, [s.reflection], [s.reference])),
    ...SEED_CONTENT.flatMap((c) => quotedIn(`content ${c.key}`, strings(c), "scriptureRef" in c && c.scriptureRef ? [c.scriptureRef] : [])),
    ...quotedIn("faith motivations", strings(FAITH_MOTIVATIONS), []),
    ...STUDIES.flatMap((s) => s.lessons.flatMap((l) => quotedIn(`study ${s.slug}/${l.slug} (${l.passage})`, strings(l.notes ?? {}), [l.passage, ...l.crossReferences]))),
    ...HABIT_PROGRAMS.filter((p) => /faith|scripture/.test(p.slug)).flatMap((p) => quotedIn(`program ${p.slug}`, strings(p), [...strings(p).join(" ").matchAll(REFERENCE)].map((m) => m[0]))),
    ...FAITH_CHALLENGES.flatMap((c) => quotedIn(`daily challenge ${c.id}`, [c.text], [c.reference])),
    ...RANKS.flatMap((r) => quotedIn(`rank ${r.name}`, [r.theme], [r.reference])),
    ...Object.entries(FAITH_REMINDER_INFO).flatMap(([k, i]) => quotedIn(`faith reminder ${k}`, [i.title, i.body, i.description], Object.keys(BSB_FRAGMENTS))),
    ...Object.entries(APP_REMINDER_INFO).flatMap(([k, i]) => quotedIn(`reminder ${k}`, strings(i), Object.keys(BSB_FRAGMENTS))),
    ...([0, 1, 2, 3, 4, 5, 6] as const).flatMap((d) => quotedIn(`workout reminder (faith), weekday ${d}`, strings(reminderMessage("faith", d, true)), Object.keys(BSB_FRAGMENTS))),
    ...quotedIn("journey rule copy", [JOURNEY_RULE, RESTART_MESSAGE, RULE_GRACE, ...Object.values(REASON_TEXT)], [RESTART_REFERENCE]),
  ];

  it("is either the exact BSB wording of a passage that item cites, or a reviewed non-Scripture phrase", () => {
    expect(quoted.length).toBeGreaterThan(20);
    const problems: string[] = [];
    for (const q of quoted) {
      if (NOT_SCRIPTURE.has(q.phrase)) continue;
      const texts = q.passages.map((r) => bsb(r) ?? "");
      if (!texts.some((t) => includesLoosely(t, q.phrase))) problems.push(`${q.where}: “${q.phrase}”`);
    }
    expect(problems).toEqual([]);
  });

  it("a reviewed non-Scripture phrase is never also the wording of the passage beside it", () => {
    for (const q of quoted.filter((x) => NOT_SCRIPTURE.has(x.phrase))) {
      for (const r of q.passages) expect(includesLoosely(bsb(r) ?? "", q.phrase), `${q.where}: ${q.phrase}`).toBe(false);
    }
  });
});

describe("reminders that quote Scripture", () => {
  it("the faith-style workout reminder quotes only exact BSB fragments, with reference and translation", () => {
    for (const d of [0, 1, 2, 3, 4, 5, 6] as const) {
      const { body } = reminderMessage("faith", d, true);
      for (const m of body.matchAll(/“([^”]+)”\s*\(([^,()]+\d+:\d+[^,()]*), BSB\)/g)) expect(bsb(m[2]!), m[2]).toContain(m[1]!);
      // No quotation marks without a reference: nothing reads as Scripture unless it is cited.
      expect((body.match(/“/g) ?? []).length).toBe([...body.matchAll(/“[^”]+”\s*\([^()]+, BSB\)/g)].length);
    }
  });

  it("the restart message is the app's own words beside a real reference, not a quotation", () => {
    expect(RESTART_MESSAGE).not.toMatch(/["“”]/);
    expect(fullyExists(RESTART_REFERENCE)).toBe(true);
    // What it alludes to is really in that passage.
    expect(bsb(RESTART_REFERENCE)).toContain("new every morning");
  });
});
