import { describe, expect, it } from "vitest";
import { BIBLE_AI_SYSTEM, buildBibleAiMessage, checkCitations, findReferences, markUnverified, searchTerms } from "@/lib/bible/ai";
import { formatReference } from "@/lib/bible/reference";
import { getPassage } from "@/server/bible/text";
import { retrievePassages } from "@/server/services/bible-ai";

const exists = (r: Parameters<typeof getPassage>[0]) => getPassage(r).length > 0;

describe("Bible study helper", () => {
  it("finds references written in ordinary text", () => {
    const refs = findReferences("Compare John 3:16 with Romans 8:28–30, Ps 23 and 1 Cor 13:4-7. Also see John 3:16 again.").map((r) => formatReference(r.ref!));
    expect(refs).toEqual(["John 3:16", "Romans 8:28–30", "Psalm 23", "1 Corinthians 13:4–7"]);
    expect(findReferences("I ran 3 miles and read a psalm")).toEqual([]);
  });

  it("checks every citation in an answer against the verified text and marks the ones that don't exist", () => {
    const answer = "See John 3:16 and Psalm 151:2, and also Jude 30.";
    const check = checkCitations(answer, exists);
    expect(check.verified.map(formatReference)).toEqual(["John 3:16"]);
    expect(check.unverified).toEqual(["Psalm 151:2", "Jude 30"]);
    expect(markUnverified(answer, check.unverified)).toBe("See John 3:16 and Psalm 151:2 [reference not found in the BSB], and also Jude 30 [reference not found in the BSB].");
  });

  it("retrieves the passages a question names, and verses with its distinctive words, all from the BSB", () => {
    const named = retrievePassages("What does John 3:16 mean?");
    expect(named[0]).toEqual({ reference: "John 3:16", text: getPassage({ bookId: "JHN", chapter: 3, verseStart: 16 })[0]!.text });
    const topical = retrievePassages("What does the Bible say about anxiety?");
    expect(topical.length).toBeGreaterThan(0);
    for (const p of topical) {
      const r = findReferences(p.reference)[0]!.ref!;
      expect(getPassage(r).map((v) => v.text).join(" ")).toBe(p.text);
    }
    expect(searchTerms("What does the Bible say about worry and fear?")).toEqual(["worry", "fear"]);
  });

  it("caps how much Scripture is sent for one question", () => {
    const big = retrievePassages("Explain Psalm 119 and Genesis 1–3 and Isaiah 40–55");
    const verses = big.reduce((n, p) => n + p.text.split(/(?<=[.!?”’])\s+/).length, 0);
    expect(big.length).toBeGreaterThan(0);
    expect(verses).toBeLessThan(400);
  });

  it("its instructions forbid Greek/Hebrew word claims, speaking for God and a pastor persona, and ask for citations", () => {
    expect(BIBLE_AI_SYSTEM).toMatch(/Do not explain the meaning of Greek, Hebrew or Aramaic words/);
    expect(BIBLE_AI_SYSTEM).toMatch(/Never speak as God/);
    expect(BIBLE_AI_SYSTEM).toMatch(/not a pastor/);
    expect(BIBLE_AI_SYSTEM).toMatch(/Cite each passage/);
    expect(buildBibleAiMessage("Q?", [{ reference: "John 11:35", text: "Jesus wept." }])).toBe("<passages>\nJohn 11:35: Jesus wept.\n</passages>\n\nQuestion: Q?");
  });
});
