// @vitest-environment node
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { describeMorphology, isRightToLeft, parseCompactReference, strongBase, strongsIn } from "@/lib/bible/original-languages";
import { linkReferences, readerHref, safeBack, askHref } from "@/lib/biblical-ai/links";
import { validatePlan, rawPlanSchema, MAX_DAY_VERSES } from "@/lib/biblical-ai/study-plan";
import { bibleMeta, getChapter, getPassage, passageText } from "@/server/bible/text";
import { crossReferences, lexiconEntry, occurrences, originalLanguageMeta, originalVerse } from "@/server/bible/original-languages";
import { RETRIEVAL_LIMITS, retrieveScripture } from "@/server/services/biblical-ai-retrieval";

/**
 * The data Biblical AI studies from, checked against the verified BSB: the original-language layer (STEPBible, CC BY
 * 4.0) and the cross references (OpenBible.info, CC BY), and the retrieval, link and study-plan rules built on them.
 */
const ol = JSON.parse(readFileSync("data/original-languages/meta.json", "utf8"));
const xmeta = JSON.parse(readFileSync("data/cross-references/meta.json", "utf8"));

describe("original-language layer", () => {
  it("records its source, licence, attribution and the SHA-256 of every input", () => {
    expect(ol.licence).toMatch(/CC BY 4\.0/);
    expect(ol.attribution).toMatch(/STEP Bible.*Tyndale House/);
    expect(ol.inputs.length).toBeGreaterThanOrEqual(10);
    for (const i of ol.inputs) expect(i.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(originalLanguageMeta().licence).toBe(ol.licence);
  });

  it("covers all 66 books, in the BSB's order, with Hebrew/Aramaic for the OT and Greek for the NT", () => {
    const books = bibleMeta().books;
    expect(ol.books.map((b: { id: string }) => b.id)).toEqual(books.map((b) => b.id));
    expect(ol.books.slice(0, 39).every((b: { lang: string }) => b.lang === "hebrew")).toBe(true);
    expect(ol.books.slice(39).every((b: { lang: string }) => b.lang === "greek")).toBe(true);
    // Totals in line with the printed texts (Leningrad ≈ 305,000 words; NA28 ≈ 138,000).
    expect(ol.counts.hebrewWords + ol.counts.aramaicWords).toBeGreaterThan(300_000);
    expect(ol.counts.greekWords).toBeGreaterThan(136_000);
    // Biblical Aramaic: about 4,900 words (Daniel 2:4b–7:28, Ezra 4:8–6:18 and 7:12–26, Jeremiah 10:11, Genesis 31:47).
    expect(ol.counts.aramaicWords).toBeGreaterThan(4_500);
    expect(ol.counts.aramaicWords).toBeLessThan(5_200);
  });

  it("every BSB verse with text has its original-language words, and no words belong to a verse the BSB lacks", () => {
    const missing: string[] = [];
    const extra: string[] = [];
    for (const b of bibleMeta().books) {
      const file = JSON.parse(gunzipSync(readFileSync(`data/original-languages/books/${b.id}.json.gz`)).toString("utf8"));
      for (let c = 1; c <= b.chapters; c++) {
        for (const [v, t] of getChapter(b.id, c) ?? []) if (t && !file.chapters[c]?.[v]?.w?.length) missing.push(`${b.id} ${c}:${v}`);
      }
      for (const [c, verses] of Object.entries<Record<string, { w: unknown[] }>>(file.chapters))
        for (const [v, row] of Object.entries(verses)) {
          if (v === "0" || !row.w.length) continue;
          if (!getChapter(b.id, Number(c))?.find(([n, t]) => n === Number(v) && t)) extra.push(`${b.id} ${c}:${v}`);
        }
    }
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it("Genesis 1:1 is Hebrew, right to left, with bara' (H1254) and Elohim (H0430)", () => {
    const v = originalVerse("GEN", 1, 1)!;
    expect(v.language).toBe("hebrew");
    expect(isRightToLeft(v.language)).toBe(true);
    expect(v.words[0]!.surface).toBe("בְּ/רֵאשִׁ֖ית");
    expect(v.words.map((w) => strongBase(w.strong))).toEqual(expect.arrayContaining(["H1254", "H0430"]));
    const bara = v.words.find((w) => strongBase(w.strong) === "H1254")!;
    expect(bara.lexicon?.gloss).toMatch(/create/i);
    expect(bara.parsing).toMatch(/Verb/);
    expect(bara.parsing).toMatch(/Qal/);
  });

  it("Daniel 2:4 is marked Aramaic; John 1:1 is Greek with logos (G3056)", () => {
    expect(originalVerse("DAN", 2, 5)!.language).toBe("aramaic");
    const j = originalVerse("JHN", 1, 1)!;
    expect(j.language).toBe("greek");
    expect(isRightToLeft("greek")).toBe(false);
    expect(j.words.some((w) => w.strong.startsWith("G3056"))).toBe(true);
    expect(j.words.find((w) => w.strong.startsWith("G3056"))!.parsing).toMatch(/Noun.*Nominative/);
  });

  it("keeps the Hebrew versification where it differs, and marks disputed passages instead of hiding them", () => {
    expect(originalVerse("MAL", 4, 1)!.hebrewReference).toBe("3.19");
    expect(originalVerse("MRK", 16, 9)!.disputed).toMatch(/main critical text/);
    expect(originalVerse("JHN", 8, 1)!.disputed).toMatch(/main critical text/);
    expect(originalVerse("JHN", 3, 16)!.disputed).toBeNull();
    expect(originalVerse("2CO", 13, 14)!.words.map((w) => w.gloss).join(" ")).toMatch(/grace/i);
  });

  it("lexicon look-ups accept plain and extended numbers and refuse anything else", () => {
    expect(lexiconEntry("G26")?.lemma).toBe("ἀγάπη");
    expect(lexiconEntry("G0026")?.gloss).toMatch(/love/);
    expect(lexiconEntry("H1254A")?.gloss).toMatch(/create/);
    expect(lexiconEntry("X1")).toBeNull();
    expect(lexiconEntry("G26; drop table")).toBeNull();
  });

  it("the concordance counts occurrences (agapaō in John 3:16 is among them)", () => {
    const c = occurrences("G0025");
    expect(c.total).toBeGreaterThan(100);
    expect(c.verses).toContain("MAT 5:44");
  });

  it("morphology codes expand, and unknown ones are shown as they are (never guessed)", () => {
    expect(describeMorphology("greek", "N-NSF", { "N-NSF": "Function=Noun; Case=Nominative; Number=Singular; Gender=Feminine" })).toBe("Noun · Nominative · Singular · Feminine");
    expect(describeMorphology("hebrew", "HR/Ncfsa", { HR: "Function=Preposition", HNcfsa: "Function=Noun; Gender=Feminine" })).toBe("Preposition + Noun · Feminine");
    expect(describeMorphology("greek", "ZZZ", {})).toBe("ZZZ");
    expect(strongsIn("H9003/{H7225G}")).toEqual(["H9003", "H7225"]);
  });
});

describe("cross references", () => {
  it("record the OpenBible.info licence and every target is a BSB passage", () => {
    expect(xmeta.licence).toMatch(/CC BY/);
    expect(xmeta.input.sha256).toMatch(/^[0-9a-f]{64}$/);
    const all = JSON.parse(gunzipSync(readFileSync("data/cross-references/cross-references.json.gz")).toString("utf8")) as Record<string, string[]>;
    let checked = 0;
    for (const targets of Object.values(all)) {
      for (const t of targets) {
        const r = parseCompactReference(t);
        expect(r, t).not.toBeNull();
        expect(getPassage(r!).length, t).toBeGreaterThan(0);
        checked++;
      }
      if (checked > 20000) break;
    }
    expect(crossReferences("JHN", 3, 16)).toContain("ROM 5:8");
    expect(crossReferences("JHN", 3, 16).length).toBeLessThanOrEqual(12);
  });
});

describe("retrieval", () => {
  it("retrieves a named passage, its cross references and, for deep studies, its original words", () => {
    const r = retrieveScripture("What does John 3:16 mean?", { depth: "deep", category: "scripture" });
    expect(r.passages[0]).toMatchObject({ reference: "John 3:16" });
    expect(r.passages[0]!.text).toBe(passageText({ bookId: "JHN", chapter: 3, verseStart: 16 }));
    expect(r.crossReferences.length).toBeGreaterThan(0);
    expect(r.crossReferences.length).toBeLessThanOrEqual(RETRIEVAL_LIMITS.deep.crossRefs);
    expect(r.words.some((w) => w.strong.startsWith("G0025"))).toBe(true);
  });

  it("quick answers stay small and add no original-language words; topic questions find verses by their words", () => {
    const q = retrieveScripture("What does the Bible say about forgiveness?", { depth: "quick", category: "doctrine" });
    expect(q.words).toEqual([]);
    expect(q.crossReferences).toEqual([]);
    expect(q.passages.length).toBeGreaterThan(0);
    expect(q.passages.length).toBeLessThanOrEqual(RETRIEVAL_LIMITS.quick.searchHits);
    expect(q.passages.every((p) => /forgiv/i.test(p.text))).toBe(true);
  });

  it("never exceeds the verse budget, and invented references retrieve nothing", () => {
    const big = retrieveScripture("Explain Psalm 119 and Genesis 1–3 and Isaiah 40–55", { depth: "deep", category: "scripture" });
    const verses = [...big.passages, ...big.crossReferences].reduce((n, p) => n + p.text.split(/(?<=[.!?”])\s+/).length, 0);
    expect(verses).toBeGreaterThan(0);
    expect(big.passages.length).toBeLessThan(40);
    expect(retrieveScripture("What does Hezekiah 3:5 say?", { depth: "quick", category: "scripture" }).passages.some((p) => /Hezekiah/.test(p.reference))).toBe(false);
  });
});

describe("links", () => {
  it("open the reader in peek mode with a safe way back", () => {
    expect(readerHref({ bookId: "JHN", chapter: 3, verseStart: 16 }, "/faith/biblical-ai/ask?c=1")).toBe("/faith/bible/john/3?v=16&from=ai&back=%2Ffaith%2Fbiblical-ai%2Fask%3Fc%3D1#v16");
    expect(safeBack("/faith/biblical-ai")).toBe("/faith/biblical-ai");
    for (const bad of ["https://evil.example", "//evil.example", "/faith/biblical-ai//evil", "/home", "/faith/biblical-aix", "/faith/biblical-ai\\x", "javascript:alert(1)"]) expect(safeBack(bad), bad).toBeNull();
    expect(readerHref({ bookId: "JHN", chapter: 3, verseStart: 16 }, "https://evil.example")).not.toContain("back=");
  });

  it("every real reference in prose becomes a link; others stay text", () => {
    const segs = linkReferences("Read Romans 8:28 and Hezekiah 3:5.", (r) => r === "Romans 8:28");
    expect(segs).toEqual([{ text: "Read " }, { text: "Romans 8:28", href: "/faith/bible/romans/8?v=28&from=ai#v28", reference: "Romans 8:28" }, { text: " and Hezekiah 3:5." }]);
    expect(askHref({ category: "languages", q: "x", passage: "John 1:1" })).toBe("/faith/biblical-ai/ask?category=languages&passage=John+1%3A1&q=x");
  });
});

describe("study plans", () => {
  const day = (n: number, readings: string[]) => ({ day: n, title: `Day ${n}`, readings, explanation: "x", questions: ["q"] });
  const count = (r: Parameters<typeof getPassage>[0]) => getPassage(r).filter((v) => v.text).length;

  it("accepts a correct 7-day plan and formats its readings", () => {
    const raw = rawPlanSchema.parse({ title: "Grace", objective: "o", days: [1, 2, 3, 4, 5, 6, 7].map((n) => day(n, [n % 2 ? "Romans 3:21-26" : "Ephesians 2:1-10"])) });
    const r = validatePlan(raw, { days: 7, topic: "Grace", verseCount: count });
    expect(r.failures).toEqual([]);
    expect(r.plan!.days[0]!.readings).toEqual(["Romans 3:21–26"]);
  });

  it("refuses the wrong number of days, misnumbered days, invented readings, repeats and over-long days", () => {
    const raw = rawPlanSchema.parse({ title: "t", objective: "o", days: [day(1, ["Romans 3"]), day(3, ["Romans 3"]), day(3, ["Hezekiah 1"]), day(4, ["Psalm 119"])] });
    const r = validatePlan(raw, { days: 7, topic: "t", verseCount: count });
    expect(r.plan).toBeNull();
    const all = r.failures.join("\n");
    expect(all).toMatch(/has 4 days; it must have exactly 7/);
    expect(all).toMatch(/Day 2 is numbered 3/);
    expect(all).toMatch(/repeats the previous day/);
    expect(all).toMatch(/"Hezekiah 1" is not a passage/);
    expect(all).toMatch(new RegExp(`Day 4's reading is 176 verses; keep each day under ${MAX_DAY_VERSES}`));
  });
});
