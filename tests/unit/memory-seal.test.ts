import { describe, expect, it } from "vitest";
import { isSealed, openWithKey, parseSealKey, sealWithKey } from "@/lib/crypto/memory-seal";
import { coachStyleInstruction, COACH_STYLES, parseCoachStyle } from "@/lib/coach/style";
import { buildSystemBlocks } from "@/lib/coach/prompt";

const key = parseSealKey(Buffer.alloc(32, 7).toString("base64"))!;
const other = parseSealKey(Buffer.alloc(32, 9).toString("base64"))!;

describe("coaching memory sealing", () => {
  it("seals and opens for the owner, with a fresh IV each time", () => {
    const a = sealWithKey("Old shoulder injury; avoid behind-the-neck press", "user-1", key);
    const b = sealWithKey("Old shoulder injury; avoid behind-the-neck press", "user-1", key);
    expect(isSealed(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(a).not.toContain("shoulder");
    expect(openWithKey(a, "user-1", key)).toBe("Old shoulder injury; avoid behind-the-neck press");
  });

  it("won't open for another member, another key, or a tampered row", () => {
    const s = sealWithKey("Prefers morning workouts", "user-1", key);
    expect(openWithKey(s, "user-2", key)).toBeNull();
    expect(openWithKey(s, "user-1", other)).toBeNull();
    expect(openWithKey(s, "user-1", null)).toBeNull();
    const tampered = s.slice(0, -4) + (s.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(openWithKey(tampered, "user-1", key)).toBeNull();
    expect(openWithKey("enc:v1:garbage", "user-1", key)).toBeNull();
  });

  it("reads rows stored before encryption as they are, and rejects a key of the wrong size", () => {
    expect(openWithKey("Trains at 6am", "user-1", key)).toBe("Trains at 6am");
    expect(parseSealKey(Buffer.alloc(16).toString("base64"))).toBeNull();
    expect(parseSealKey(undefined)).toBeNull();
  });

  it("a sealed 300-character memory fits the database bound (2,048)", () => {
    expect(sealWithKey("é".repeat(300), "00000000-0000-0000-0000-000000000000", key).length).toBeLessThanOrEqual(2048);
  });
});

describe("coaching styles", () => {
  it("accept only the four styles, and every style keeps the rules", () => {
    expect(parseCoachStyle("direct")).toBe("direct");
    expect(parseCoachStyle("drill sergeant")).toBeNull();
    expect(coachStyleInstruction(null)).toBeNull();
    for (const s of COACH_STYLES) expect(coachStyleInstruction(s)).toContain("never changes the facts, the safety rules");
  });

  it("go in the member's own block, never the shared cached prefix", () => {
    const blocks = buildSystemBlocks({ faithEnabled: false, contextText: "ctx", styleText: coachStyleInstruction("technical") });
    expect(blocks[0]!.text).not.toContain("technical strength coach");
    expect(blocks[0]!.cache_control).toBeTruthy();
    expect(blocks.at(-1)!.text).toContain("technical strength coach");
    expect(blocks.at(-1)!.cache_control).toBeUndefined();
  });
});
