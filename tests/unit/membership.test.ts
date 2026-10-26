import { readFileSync } from "node:fs";
import { membershipComparison, proPriceSummary } from "@/lib/domain/membership";
import { hasFeature } from "@/lib/domain/plans";

describe("membership comparison", () => {
  const rows = membershipComparison().flatMap((s) => s.rows.map((r) => ({ ...r, section: s.title })));

  it("never shows Free a feature the server keeps for Pro, and every Pro row is a real Pro feature", () => {
    for (const r of rows) {
      if (!r.feature) continue;
      // A gated row must not be shown as fully included on Free.
      expect(r.free === true, r.label).toBe(false);
      expect(hasFeature("free", r.feature), r.label).toBe(false);
      expect(hasFeature("pro", r.feature), r.label).toBe(true);
    }
  });

  it("keeps the whole Faith & Discipline section, the exercise demos and manual run logging free", () => {
    const faith = rows.filter((r) => r.section === "Faith & Discipline");
    expect(faith.length).toBeGreaterThan(0);
    for (const r of faith) expect(r.free).not.toBe(false);
    expect(rows.find((r) => /157 exercise demonstrations/.test(r.label))?.free).toBe(true);
    expect(rows.find((r) => /Manual run and walk logging/.test(r.label))?.free).toBe(true);
    expect(rows.find((r) => /Live GPS/.test(r.label))).toMatchObject({ free: false, feature: "live_gps" });
  });

  it("states the AI allowance and the approved prices", () => {
    expect(rows.find((r) => r.label === "AI fitness coach")?.pro).toBe("150 requests / month");
    expect(proPriceSummary()).toEqual({ monthCents: 1999, yearCents: 14999, savingsPercent: 37 });
  });

  it("the database's live-GPS rule uses the same plan rank as the app (legacy Plus and Pro)", () => {
    const sql = readFileSync("supabase/migrations/20261026000044_free_pro_memberships.sql", "utf8");
    expect(sql).toMatch(/plan_rank\(public\.plan_of\(new\.user_id\)\) < public\.plan_rank\('plus'\)/);
    expect(hasFeature("plus", "live_gps")).toBe(true);
  });
});
