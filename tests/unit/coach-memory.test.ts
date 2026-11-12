import { describe, expect, it } from "vitest";
import {
  approvedChangeMemory,
  checkProposedMemory,
  findDuplicateMemory,
  formatMemoriesForContext,
  isSensitiveHealthDetail,
  MEMORY_CONTEXT_CHARS,
  MEMORY_LIMIT,
  memoryInputSchema,
  memoryRef,
  overlapsJournal,
  type CoachMemory,
} from "@/lib/coach/memory";
import { coachProposalSchema, validateToolInput } from "@/lib/coach/tools";
import { buildSystemBlocks } from "@/lib/coach/prompt";
import { executeCoachTool, type ToolContext } from "@/server/coach/tools";
import { athleteFixture, fakeSupabase } from "./fixtures/coach-fixtures";

const mem = (id: string, content: string, over: Partial<CoachMemory> = {}): CoachMemory => ({
  id,
  category: "exercise_preferences",
  content,
  source: "coach",
  created_at: "2026-10-20T10:00:00Z",
  ...over,
});
const ID1 = "1a2b3c4d-0000-4000-8000-000000000001";
const ID2 = "5e6f7a8b-0000-4000-8000-000000000002";

describe("coaching memory rules", () => {
  it("validates and normalises memory text", () => {
    expect(memoryInputSchema.parse({ category: "schedule", content: "  Trains at   6 am  " })).toEqual({ category: "schedule", content: "Trains at 6 am" });
    expect(memoryInputSchema.safeParse({ category: "schedule", content: "ok" }).success).toBe(false);
    expect(memoryInputSchema.safeParse({ category: "schedule", content: "x".repeat(301) }).success).toBe(false);
    expect(memoryInputSchema.safeParse({ category: "secrets", content: "Something long enough" }).success).toBe(false);
  });

  it("detects duplicates, so the same thing isn't stored twice", () => {
    const existing = [mem(ID1, "Prefers dumbbell pressing; barbell bench bothers the left shoulder.")];
    expect(findDuplicateMemory("Prefers dumbbell pressing — barbell bench bothers the left shoulder", existing)).toBe(existing[0]);
    expect(findDuplicateMemory("Wants to run a 10K in April", existing)).toBeNull();
  });

  it("never keeps health details or prayer-journal text", () => {
    expect(isSensitiveHealthDetail("Was diagnosed with asthma in 2019")).toBe(true);
    expect(isSensitiveHealthDetail("Takes medication for blood pressure")).toBe(true);
    expect(isSensitiveHealthDetail("Likes front squats more than back squats")).toBe(false);
    const journal = ["Lord, give me patience with my brother and strength to keep training through this season"];
    expect(overlapsJournal("Wants patience with my brother and strength to keep training", journal)).toBe(true);
    expect(overlapsJournal("Trains Monday, Wednesday and Friday mornings", journal)).toBe(false);
  });

  it("explains why a suggested memory can't be offered", () => {
    const input = { category: "schedule" as const, content: "Trains Monday, Wednesday and Friday mornings" };
    const base = { enabled: true, chatMemoryOff: false, existing: [], journalExcerpts: [] };
    expect(checkProposedMemory(input, base)).toBeNull();
    expect(checkProposedMemory(input, { ...base, enabled: false })).toMatch(/switched off/);
    expect(checkProposedMemory(input, { ...base, chatMemoryOff: true })).toMatch(/not to remember/);
    expect(checkProposedMemory(input, { ...base, existing: Array.from({ length: MEMORY_LIMIT }, (_, i) => ({ content: `note ${i}` })) })).toMatch(/maximum/);
    expect(checkProposedMemory({ category: "recovery", content: "Has an anxiety disorder" }, base)).toMatch(/health or medical/);
    expect(checkProposedMemory(input, { ...base, existing: [{ content: "Trains Monday, Wednesday and Friday mornings." }] })).toMatch(/Already remembered/);
  });

  it("formats memories for the coach, newest first, within the character budget", () => {
    const items = [
      mem(ID1, "Prefers dumbbell pressing.", { created_at: "2026-10-01T00:00:00Z" }),
      mem(ID2, "Wants short, direct answers.", { category: "coaching_style", created_at: "2026-10-10T00:00:00Z" }),
    ];
    const text = formatMemoriesForContext(items, { wellnessConsent: false, chatMemoryOff: false });
    expect(text.indexOf("short, direct")).toBeLessThan(text.indexOf("dumbbell"));
    expect(text).toContain(`[${memoryRef(ID2)}] Coaching style: Wants short, direct answers. (2026-10-10)`);
    expect(text).toMatch(/never invent memories/);

    const many = Array.from({ length: 80 }, (_, i) => mem(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, `Note ${i} ${"x".repeat(250)}`));
    expect(formatMemoriesForContext(many, { wellnessConsent: true, chatMemoryOff: false }).length).toBeLessThan(MEMORY_CONTEXT_CHARS + 400);
  });

  it("only uses recovery notes while wellness sharing is on, and says when a chat is off the record", () => {
    const items = [mem(ID1, "Prefers mobility work on rest days.", { category: "recovery" })];
    expect(formatMemoriesForContext(items, { wellnessConsent: false, chatMemoryOff: false })).not.toContain("mobility");
    expect(formatMemoriesForContext(items, { wellnessConsent: true, chatMemoryOff: false })).toContain("mobility");
    expect(formatMemoriesForContext(items, { wellnessConsent: true, chatMemoryOff: true })).toMatch(/not to remember anything from THIS chat/);
  });

  it("records a confirmed change as a dated note", () => {
    const n = approvedChangeMemory({ kind: "exercise_swap", from: "Back Squat", to: "Goblet Squat", scope: "rest_of_program", reason: "Knee comfort." }, "2026-10-22");
    expect(n).toEqual({ category: "training_changes", content: "2026-10-22: approved swapping Back Squat for Goblet Squat (rest of the program). Reason: Knee comfort." });
  });

  it("puts the memory block in the per-user (uncached) part of the prompt", () => {
    const blocks = buildSystemBlocks({ faithEnabled: false, contextText: "ctx", memoryText: "Coaching memory: test" });
    expect(blocks[0]!.text).not.toContain("Coaching memory: test");
    expect(blocks.at(-1)!.text).toContain("Coaching memory: test");
    expect(blocks.at(-1)!.cache_control).toBeUndefined();
  });
});

describe("memory tools", () => {
  const USER = "11111111-1111-1111-1111-111111111111";
  const ctx = (over: Partial<ToolContext> = {}, memory = { enabled: true, wellnessConsent: false, items: [mem(ID1, "Prefers dumbbell pressing.")] }): ToolContext => ({
    supabase: fakeSupabase({}).client,
    userId: USER,
    timeZone: "UTC",
    snapshot: { ...athleteFixture(), memory },
    proposal: null,
    ...over,
  });

  it("validates tool input", () => {
    expect(validateToolInput("propose_memory", { category: "schedule", content: "Trains at 6 am" }).ok).toBe(true);
    expect(validateToolInput("propose_memory", { category: "schedule", content: "Trains at 6 am", extra: 1 }).ok).toBe(false);
    expect(validateToolInput("propose_forget_memory", { memory_ref: "m-1a2b3c4d" }).ok).toBe(true);
    expect(validateToolInput("propose_forget_memory", { memory_ref: ID1 }).ok).toBe(false);
  });

  it("offers a memory for approval without writing anything", async () => {
    const { client, log } = fakeSupabase({});
    const out = await executeCoachTool(ctx({ supabase: client }), "propose_memory", { category: "schedule", content: "Trains at 6 am before work." });
    expect(out.isError).toBe(false);
    expect(out.proposal).toEqual({ kind: "memory", category: "schedule", content: "Trains at 6 am before work." });
    expect(coachProposalSchema.safeParse(out.proposal).success).toBe(true);
    expect(log).toHaveLength(0);
  });

  it("refuses when memory is off, the chat is off the record, or it's a duplicate", async () => {
    const off = await executeCoachTool(ctx({}, { enabled: false, wellnessConsent: false, items: [] }), "propose_memory", { category: "schedule", content: "Trains at 6 am." });
    expect(off.isError).toBe(true);
    const chatOff = await executeCoachTool(ctx({ chatMemoryOff: true }), "propose_memory", { category: "schedule", content: "Trains at 6 am." });
    expect(chatOff.content).toMatch(/not to remember/);
    const dup = await executeCoachTool(ctx(), "propose_memory", { category: "exercise_preferences", content: "Prefers dumbbell pressing" });
    expect(dup.content).toMatch(/Already remembered/);
    expect(dup.proposal).toBeUndefined();
  });

  it("forgets only a memory that exists, by its reference", async () => {
    const out = await executeCoachTool(ctx(), "propose_forget_memory", { memory_ref: memoryRef(ID1) });
    expect(out.proposal).toEqual({ kind: "memory_forget", memoryId: ID1, category: "exercise_preferences", content: "Prefers dumbbell pressing." });
    const missing = await executeCoachTool(ctx(), "propose_forget_memory", { memory_ref: "m-ffffffff" });
    expect(missing.isError).toBe(true);
  });
});
