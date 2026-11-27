import { describe, expect, it } from "vitest";
import { journalEntrySchema, logFoodSchema, waterSchema, weightEntrySchema } from "@/lib/validation/schemas";

/**
 * Date fields are validated as real calendar dates, not just as the YYYY-MM-DD shape. Before this, "2026-02-30"
 * passed the schema and failed only at the database (a date column), so the member saw a generic "try again" and
 * the server logged an error for input it could have refused.
 */
const food = (date: string) => logFoodSchema.safeParse({ date, mealType: "lunch", foodId: null, name: "Apple", servings: 1, calories: 50, protein_g: 0, carbs_g: 10, fat_g: 0 });

describe("date fields are real calendar dates", () => {
  it("accepts real dates", () => {
    for (const d of ["2026-11-07", "2024-02-29", "2026-12-31", "2026-01-01"]) {
      expect(food(d).success, d).toBe(true);
      expect(waterSchema.safeParse({ date: d, amountMl: 250 }).success, d).toBe(true);
      expect(weightEntrySchema.safeParse({ recordedOn: d, weight: 80 }).success, d).toBe(true);
    }
  });

  it("refuses dates that only look like dates", () => {
    for (const d of ["2026-02-30", "2026-13-01", "2026-00-10", "0000-00-00", "2025-02-29", "2026-11-31"]) {
      const r = food(d);
      expect(r.success, d).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.path).toEqual(["date"]);
      expect(waterSchema.safeParse({ date: d, amountMl: 250 }).success, d).toBe(false);
      expect(weightEntrySchema.safeParse({ recordedOn: d, weight: 80 }).success, d).toBe(false);
    }
  });

  it("still refuses the wrong shape and keeps the shape message", () => {
    const r = food("07/11/2026");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("Use YYYY-MM-DD");
  });

  it("applies to the prayer journal's entry date too", () => {
    const base = { kind: "request", theme: null, title: "Morning", body: "Thankful.", entryDate: "2026-11-07" } as Record<string, unknown>;
    const ok = journalEntrySchema.safeParse(base);
    expect(ok.success, JSON.stringify(!ok.success && ok.error.issues)).toBe(true);
    const bad = journalEntrySchema.safeParse({ ...base, entryDate: "2026-02-30" });
    expect(bad.success).toBe(false);
  });
});
