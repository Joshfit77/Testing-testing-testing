import { describe, expect, it } from "vitest";
import { verseExcerpt } from "@/lib/domain/scripture";

describe("verseExcerpt", () => {
  it("keeps a short verse whole", () => {
    expect(verseExcerpt("Be still, and know that I am God.")).toBe("Be still…");
    expect(verseExcerpt("Jesus wept.")).toBe("Jesus wept.");
  });
  it("marks a cut clause with an ellipsis", () => {
    expect(verseExcerpt("For we walk by faith, not by sight:")).toBe("For we walk by faith…");
  });
  it("caps very long clauses", () => {
    const v = verseExcerpt(`${"a".repeat(100)}.`);
    expect(v.length).toBeLessThanOrEqual(71);
    expect(v.endsWith("…")).toBe(true);
  });
});
