import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { DEVOTIONALS } from "@/data/devotionals";
import { EVIDENCE_LABELS, SUPPLEMENTS } from "@/data/supplements";
import {
  COACH_STATIC_PROMPT,
  COMPACT_COACHING_RULES,
  FAITH_DISABLED_INSTRUCTIONS,
  FAITH_ENABLED_INSTRUCTIONS,
  COACH_VERSES,
  SAFETY_RULES,
  SUPPLEMENT_KNOWLEDGE,
} from "@/lib/coach/knowledge";
import { buildSystemBlocks, fallbackParams, fitStoredReply, PLAN_REQUEST_OPTIONS, REPLY_MAX_CHARS, sanitizeAssistantContent } from "@/lib/coach/prompt";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe("knowledge base", () => {
  it("covers the required coaching topics", () => {
    for (const topic of [
      "Progressive overload",
      "RPE and RIR",
      "Autoregulation",
      "Weekly volume",
      "Deloads",
      "Back squat",
      "Bench press",
      "Deadlift",
      "Exercise substitutions",
      "Daily undulating",
      "Block:",
      "Conjugate",
      "Attempt selection",
      "Strongman",
      "Energy systems",
      "Zone 2",
      "Sleep",
      "1.6–2.2 g per kg",
      "Hydration and electrolytes",
      "Refeeds".toLowerCase(),
    ]) {
      expect(COACH_STATIC_PROMPT.toLowerCase()).toContain(topic.toLowerCase());
    }
  });

  it("has clear safety rules", () => {
    for (const rule of ["Never diagnose", "Red flags", "No performance-enhancing drugs", "No extreme dieting", "Eating-disorder sensitivity", "Under 18", "988"]) {
      expect(SAFETY_RULES).toContain(rule);
    }
    expect(SAFETY_RULES).toMatch(/1,500 kcal for men, 1,200 kcal for women/);
  });

  it("keeps supplement evidence levels aligned with the app's supplement list", () => {
    for (const s of SUPPLEMENTS) {
      expect(SUPPLEMENT_KNOWLEDGE).toContain(`- ${s.name} [${EVIDENCE_LABELS[s.evidence].toLowerCase()}]`);
    }
  });

  it("is static: no dates, user names or per-user values in the cached prompt", () => {
    expect(COACH_STATIC_PROMPT).not.toMatch(/20\d\d-\d\d-\d\d/);
    expect(COACH_STATIC_PROMPT).not.toContain("Athlete context (");
    expect(COACH_STATIC_PROMPT).not.toContain("KJV");
  });

  it("exports compact rules for the offline edition under 2,500 words", () => {
    expect(words(COMPACT_COACHING_RULES)).toBeLessThan(2500);
    expect(words(COMPACT_COACHING_RULES)).toBeGreaterThan(900);
    for (const rule of ["No PED advice", "1,500 kcal", "Eating-disorder sensitivity", "Under 18", "RPE/RIR", "Protein 1.6–2.2 g/kg", "Faith:"]) {
      expect(COMPACT_COACHING_RULES).toContain(rule);
    }
    expect(typeof COMPACT_COACHING_RULES).toBe("string");
  });

  it("only offers BSB verses that match the app's devotional text word for word", () => {
    expect(COACH_VERSES).toHaveLength(DEVOTIONALS.length);
    for (const d of DEVOTIONALS) expect(FAITH_ENABLED_INSTRUCTIONS).toContain(`${d.reference} [${d.theme}]: ${d.scripture}`);
  });
});

describe("prompt assembly", () => {
  const contextText = "Today: 2026-10-19. Units: kg/cm.";

  it("caches the shared static prompt and appends the per-user context last", () => {
    const blocks = buildSystemBlocks({ faithEnabled: false, contextText });
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: "text", text: COACH_STATIC_PROMPT, cache_control: { type: "ephemeral" } });
    expect(blocks[1]!.cache_control).toBeUndefined();
    expect(blocks[1]!.text).toContain(contextText);
    expect(blocks[1]!.text.endsWith(contextText)).toBe(true);
  });

  it("faith off: no verses, explicit no-religious-language instruction", () => {
    const text = buildSystemBlocks({ faithEnabled: false, contextText })
      .map((b) => b.text)
      .join("\n");
    expect(text).toContain(FAITH_DISABLED_INSTRUCTIONS);
    expect(text).not.toContain("Galatians 6:9");
    expect(text).not.toContain(FAITH_ENABLED_INSTRUCTIONS);
  });

  it("faith on: a separately cached verse block, no faith-off instruction", () => {
    const blocks = buildSystemBlocks({ faithEnabled: true, contextText });
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toEqual({ type: "text", text: FAITH_ENABLED_INSTRUCTIONS, cache_control: { type: "ephemeral" } });
    expect(blocks.map((b) => b.text).join("\n")).not.toContain(FAITH_DISABLED_INSTRUCTIONS);
    expect(FAITH_ENABLED_INSTRUCTIONS).toMatch(/never preachy|don't preach/i);
  });

  it("tells the model it's coaching a Pro member", () => {
    expect(buildSystemBlocks({ faithEnabled: false, contextText }).at(-1)!.text).toContain("Plan: Pro");
  });

  it("keeps server-side refusal fallbacks for models that support them", () => {
    expect(fallbackParams("claude-opus-5-5")).toEqual({ betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    expect(fallbackParams("claude-sonnet-5-5")).toEqual({ betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    expect(fallbackParams("claude-haiku-5-5")).toEqual({});
  });

  it("drops the declined model's thinking/tool_use before a fallback boundary", () => {
    const content = [
      { type: "thinking", thinking: "", signature: "a" },
      { type: "text", text: "Partial", citations: null },
      { type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-opus-5" } },
      { type: "tool_use", id: "t1", name: "calculate", input: {} },
    ] as unknown as Anthropic.Beta.BetaContentBlock[];
    expect(sanitizeAssistantContent(content).map((b) => b.type)).toEqual(["text", "fallback", "tool_use"]);
    const plain = [{ type: "text", text: "Hi", citations: null }] as unknown as Anthropic.Beta.BetaContentBlock[];
    expect(sanitizeAssistantContent(plain)).toBe(plain);
  });
});

describe("saved replies and plan requests (AI audit D3, D4)", () => {
  const NOTE = "_(Response shortened — ask me to continue.)_";
  it("saves a reply whole when it fits, and ends a longer one with the shortened note at a word break", () => {
    expect(fitStoredReply("Squat 3 × 5 @ RPE 7.")).toBe("Squat 3 × 5 @ RPE 7.");
    const long = "brace ".repeat(15_000);
    const saved = fitStoredReply(long);
    expect(saved.length).toBeLessThanOrEqual(REPLY_MAX_CHARS);
    expect(saved.endsWith(NOTE)).toBe(true);
    expect(saved.slice(0, -NOTE.length).trimEnd().endsWith("brace")).toBe(true);
  });
  it("keeps a reply that already ends with the note, and never cuts the note itself", () => {
    const already = `${"x".repeat(REPLY_MAX_CHARS - NOTE.length)}${NOTE}`;
    expect(fitStoredReply(already)).toBe(already);
    const noSpaces = "x".repeat(REPLY_MAX_CHARS + 5000);
    expect(fitStoredReply(noSpaces).endsWith(NOTE)).toBe(true);
    expect(fitStoredReply(noSpaces).length).toBeLessThanOrEqual(REPLY_MAX_CHARS);
  });
  it("sends a plan once, inside the route's 180 s limit", () => {
    expect(PLAN_REQUEST_OPTIONS.maxRetries).toBe(0);
    expect(PLAN_REQUEST_OPTIONS.timeout).toBeLessThan(180_000);
  });
});
