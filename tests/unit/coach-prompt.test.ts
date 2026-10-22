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
import { buildSystemBlocks, DEFAULT_COACH_MODELS, fallbackParams, sanitizeAssistantContent, selectCoachModel } from "@/lib/coach/prompt";

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
    const blocks = buildSystemBlocks({ faithEnabled: false, plan: "plus", contextText });
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: "text", text: COACH_STATIC_PROMPT, cache_control: { type: "ephemeral" } });
    expect(blocks[1]!.cache_control).toBeUndefined();
    expect(blocks[1]!.text).toContain(contextText);
    expect(blocks[1]!.text.endsWith(contextText)).toBe(true);
  });

  it("faith off: no verses, explicit no-religious-language instruction", () => {
    const text = buildSystemBlocks({ faithEnabled: false, plan: "pro", contextText })
      .map((b) => b.text)
      .join("\n");
    expect(text).toContain(FAITH_DISABLED_INSTRUCTIONS);
    expect(text).not.toContain("Galatians 6:9");
    expect(text).not.toContain(FAITH_ENABLED_INSTRUCTIONS);
  });

  it("faith on: a separately cached verse block, no faith-off instruction", () => {
    const blocks = buildSystemBlocks({ faithEnabled: true, plan: "pro", contextText });
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toEqual({ type: "text", text: FAITH_ENABLED_INSTRUCTIONS, cache_control: { type: "ephemeral" } });
    expect(blocks.map((b) => b.text).join("\n")).not.toContain(FAITH_DISABLED_INSTRUCTIONS);
    expect(FAITH_ENABLED_INSTRUCTIONS).toMatch(/never preachy|don't preach/i);
  });

  it("gates by plan: the plan note and the model differ for Plus and Pro", () => {
    const plus = buildSystemBlocks({ faithEnabled: false, plan: "plus", contextText }).at(-1)!.text;
    const pro = buildSystemBlocks({ faithEnabled: false, plan: "pro", contextText }).at(-1)!.text;
    expect(plus).toContain("Plan: Plus");
    expect(plus).toContain("Pro feature");
    expect(pro).toContain("Plan: Pro");
    expect(selectCoachModel("pro", {})).toBe("claude-opus-5-5");
    expect(selectCoachModel("plus", {})).toBe("claude-sonnet-5-5");
    expect(DEFAULT_COACH_MODELS).toEqual({ pro: "claude-opus-5-5", plus: "claude-sonnet-5-5" });
    expect(selectCoachModel("pro", { AI_MODEL: "claude-opus-5" })).toBe("claude-opus-5");
    expect(selectCoachModel("pro", { COACH_MODEL_PRO: "claude-fable-5-1", AI_MODEL: "x" })).toBe("claude-fable-5-1");
    expect(selectCoachModel("plus", { COACH_MODEL_PLUS: "claude-haiku-5-5", AI_MODEL: "claude-opus-5" })).toBe("claude-haiku-5-5");
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
