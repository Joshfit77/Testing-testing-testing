import { describe, expect, it } from "vitest";
import { FAITH_CHALLENGES, faithChallengeFor } from "@/data/faith-challenges";
import { parseReference } from "@/lib/bible/reference";
import { maskWords, reviewOutcome } from "@/lib/faith/memory";
import { getChapter, getPassage } from "@/server/bible/text";

describe("Scripture memory", () => {
  it("raises the level and spaces reviews on success; lowers it and brings it back tomorrow on a struggle", () => {
    expect(reviewOutcome(0, "remembered", "2026-11-03")).toEqual({ level: 1, status: "learning", nextReviewOn: "2026-11-05" });
    expect(reviewOutcome(2, "remembered", "2026-11-03")).toEqual({ level: 3, status: "learning", nextReviewOn: "2026-11-10" });
    expect(reviewOutcome(3, "struggled", "2026-11-03")).toEqual({ level: 2, status: "learning", nextReviewOn: "2026-11-04" });
    expect(reviewOutcome(0, "struggled", "2026-11-03").level).toBe(0);
    // Remembered with every word hidden: memorized, and still reviewed now and then.
    expect(reviewOutcome(4, "remembered", "2026-11-03")).toEqual({ level: 4, status: "memorized", nextReviewOn: "2026-11-17" });
    expect(reviewOutcome(4, "remembered", "2026-11-03", "memorized").nextReviewOn).toBe("2026-12-03");
  });

  it("hides a growing share of words, never changes a word, and keeps punctuation", () => {
    const text = "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.";
    const n = text.split(" ").length;
    const hidden = (lvl: number) => maskWords(text, lvl).filter((w) => w.hidden).length;
    expect([0, 1, 2, 3, 4].map(hidden)).toEqual([0, Math.round(n * 0.25), Math.round(n * 0.5), Math.round(n * 0.75), n]);
    for (let lvl = 0; lvl <= 4; lvl++) expect(maskWords(text, lvl).map((w) => w.word).join(" ")).toBe(text);
    const son = maskWords(text, 4).find((w) => w.word === "Son,")!;
    expect(son.hint).toBe("S__,");
    expect(maskWords(text, 2, 1).map((w) => w.hidden)).not.toEqual(maskWords(text, 2, 2).map((w) => w.hidden));
    expect(maskWords(text, 2, 1)).toEqual(maskWords(text, 2, 1));
  });
});

describe("daily Faith challenges", () => {
  it("every challenge cites a real BSB passage", () => {
    const bad = FAITH_CHALLENGES.filter((c) => {
      const r = parseReference(c.reference);
      if (!r || !getPassage(r).length) return true;
      const last = getChapter(r.bookId, r.chapter)!.at(-1)![0];
      return (r.verseEnd ?? r.verseStart ?? 1) > last;
    });
    expect(bad).toEqual([]);
    expect(new Set(FAITH_CHALLENGES.map((c) => c.id)).size).toBe(FAITH_CHALLENGES.length);
  });

  it("one challenge per local date, changing each day and cycling through the list", () => {
    expect(faithChallengeFor("2026-11-03")).toEqual(faithChallengeFor("2026-11-03"));
    expect(faithChallengeFor("2026-11-03").id).not.toBe(faithChallengeFor("2026-11-04").id);
    const ids = new Set(Array.from({ length: FAITH_CHALLENGES.length }, (_, i) => faithChallengeFor(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)).id));
    expect(ids.size).toBe(FAITH_CHALLENGES.length);
  });
});
