import { describe, expect, it } from "vitest";

import { FAIL_CLOSED_FLAGS, flagEnabledIn, flagStateFrom } from "@/server/flags";

describe("feature flag read state", () => {
  it("a database error or missing data is unreadable, not an empty table", () => {
    expect(flagStateFrom({ data: null, error: { message: "connection refused" } })).toEqual({ flags: {}, readable: false });
    expect(flagStateFrom({ data: null, error: null })).toEqual({ flags: {}, readable: false });
    expect(flagStateFrom({ data: [], error: null })).toEqual({ flags: {}, readable: true });
    expect(flagStateFrom({ data: [{ key: "ai_coach", enabled: false }], error: null })).toEqual({ flags: { ai_coach: false }, readable: true });
  });
});

describe("AI kill switches fail closed", () => {
  const unreadable = { flags: {}, readable: false };
  it("covers the switches every AI feature passes", () => {
    expect([...FAIL_CLOSED_FLAGS].sort()).toEqual(["ai_coach", "ai_plan_generation"]);
  });
  it("counts AI switches as off when the flags can't be read", () => {
    expect(flagEnabledIn(unreadable, "ai_coach")).toBe(false);
    expect(flagEnabledIn(unreadable, "ai_plan_generation")).toBe(false);
  });
  it("keeps other flags' behaviour (a read failure doesn't block sign-ups or food search)", () => {
    expect(flagEnabledIn(unreadable, "signups")).toBe(true);
    expect(flagEnabledIn(unreadable, "food_search")).toBe(true);
  });
  it("a readable table: a missing row is on, an explicit row wins", () => {
    expect(flagEnabledIn({ flags: {}, readable: true }, "ai_coach")).toBe(true);
    expect(flagEnabledIn({ flags: { ai_coach: false }, readable: true }, "ai_coach")).toBe(false);
    expect(flagEnabledIn({ flags: { ai_coach: true }, readable: true }, "ai_coach")).toBe(true);
  });
});
