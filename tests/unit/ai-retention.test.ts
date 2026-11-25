import { describe, expect, it } from "vitest";
import { AI_RETENTION_MAX_DAYS, AI_RETENTION_MIN_DAYS, aiRetentionDays, retentionCutoff } from "@/lib/domain/ai-retention";

describe("AI conversation retention setting", () => {
  it("is off unless a whole number of days in range is set", () => {
    for (const raw of [undefined, null, "", "  ", "abc", "-30", "30.5", "1e3", "0", "1", "29", "3651", "99999"]) expect(aiRetentionDays(raw), String(raw)).toBeNull();
  });

  it("accepts 30 to 3650 days, with surrounding spaces", () => {
    expect(aiRetentionDays(String(AI_RETENTION_MIN_DAYS))).toBe(30);
    expect(aiRetentionDays(" 365 ")).toBe(365);
    expect(aiRetentionDays(String(AI_RETENTION_MAX_DAYS))).toBe(3650);
  });

  it("the cutoff is exactly that many days before now", () => {
    const now = new Date("2026-11-25T12:00:00Z");
    expect(retentionCutoff(30, now).toISOString()).toBe("2026-10-26T12:00:00.000Z");
    expect(retentionCutoff(365, now).toISOString()).toBe("2025-11-25T12:00:00.000Z");
  });
});
