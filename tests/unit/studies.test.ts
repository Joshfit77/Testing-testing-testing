import { describe, expect, it } from "vitest";
import { notesVisible, STUDIES } from "@/data/studies";
import { parseReference } from "@/lib/bible/reference";
import { getChapter, getPassage } from "@/server/bible/text";

const REQUIRED = {
  foundations: ["gospel", "grace-through-faith", "who-jesus-is", "trinity", "repentance", "prayer", "understanding-scripture", "discipleship"],
  living: ["manhood", "womanhood", "marriage", "friendship", "temptation", "humility", "forgiveness", "spiritual-discipline", "anxiety", "stewardship-of-the-body"],
  books: ["john", "romans", "james", "ephesians", "philippians", "1-timothy", "psalms", "proverbs"],
};

describe("guided studies", () => {
  it("has every study the brief names, in its category", () => {
    for (const [cat, slugs] of Object.entries(REQUIRED)) {
      expect(STUDIES.filter((s) => s.category === cat).map((s) => s.slug)).toEqual(slugs);
    }
  });

  it("every passage and cross-reference is real BSB text, within the chapter", () => {
    const bad: string[] = [];
    for (const s of STUDIES) {
      expect(s.lessons.length).toBeGreaterThanOrEqual(4);
      expect(new Set(s.lessons.map((l) => l.slug)).size).toBe(s.lessons.length);
      for (const l of s.lessons) {
        for (const x of [l.passage, ...l.crossReferences]) {
          const r = parseReference(x);
          if (!r || !getPassage(r).length) bad.push(`${s.slug}/${l.slug}: ${x}`);
          else if (r.verseEnd && r.chapterEnd === undefined && r.verseEnd > getChapter(r.bookId, r.chapter)!.at(-1)![0]) bad.push(`${s.slug}/${l.slug}: ${x} (past the end)`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("study notes are never shown to members until a person approves them", () => {
    for (const s of STUDIES) {
      // Nothing written with AI assistance is published by default.
      expect(s.review.status).toBe("draft");
      expect(notesVisible(s, false)).toBe("hidden");
      expect(notesVisible(s, true)).toBe("preview");
    }
    const approved = { ...STUDIES[0]!, review: { status: "approved" as const, reviewedBy: "Pastor A", reviewedOn: "2026-12-01" } };
    expect(notesVisible(approved, false)).toBe("approved");
  });

  it("drafted lessons have every part, with the application after the explanation of the text", () => {
    const drafted = STUDIES.flatMap((s) => s.lessons.filter((l) => l.notes));
    expect(drafted.length).toBeGreaterThanOrEqual(4);
    for (const l of drafted) {
      const n = l.notes!;
      for (const part of [n.context, n.explanation, n.application, n.prayer]) expect(part.length).toBeGreaterThan(40);
      expect(n.themes.length).toBeGreaterThan(0);
      expect(n.questions.length).toBeGreaterThanOrEqual(3);
      // No Greek or Hebrew word studies in the drafts (nothing to verify them against).
      expect(JSON.stringify(n)).not.toMatch(/\b(Greek|Hebrew|Aramaic)\b/);
    }
  });
});
