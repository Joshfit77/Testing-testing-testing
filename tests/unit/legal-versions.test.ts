import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { AUTO_RENEWAL_CONSENT, autoRenewalText, LEGAL_PAGES, RISK_ACKNOWLEDGMENT, signupAcceptances } from "@/lib/legal/versions";

const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

describe("legal texts and their fingerprints", () => {
  it("each recorded fingerprint matches the exact text shown (a changed text needs a new version)", () => {
    for (const doc of ["terms", "privacy"] as const) expect(sha(readFileSync(LEGAL_PAGES[doc].path)), doc).toBe(LEGAL_PAGES[doc].sha256);
    expect(sha(RISK_ACKNOWLEDGMENT.text)).toBe(RISK_ACKNOWLEDGMENT.sha256);
    expect(sha(AUTO_RENEWAL_CONSENT.template)).toBe(AUTO_RENEWAL_CONSENT.sha256);
  });

  it("the sign-up acknowledgment covers the whole app, not only nutrition", () => {
    const t = RISK_ACKNOWLEDGMENT.text;
    for (const phrase of [/risk of injury/, /GPS outdoors/, /AI Coach/, /meal plans/, /sleep and recovery/, /Body Scan/, /not medical advice/, /registered dietitian/, /physical therapist/, /pregnant/, /disordered eating/, /results aren't guaranteed/])
      expect(t).toMatch(phrase);
  });

  it("sign-up records the Terms, Privacy Policy and acknowledgment with versions the database accepts", () => {
    const rows = signupAcceptances();
    expect(rows.map((r) => r.document)).toEqual(["terms", "privacy", "risk_acknowledgment"]);
    for (const r of rows) {
      expect(r.version.length).toBeGreaterThan(0);
      expect(r.version.length).toBeLessThanOrEqual(64);
      expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("states the price and period in the auto-renewal consent", () => {
    expect(autoRenewalText("$19.99", "month")).toBe("I agree that Pro All Access renews automatically at $19.99 per month until I cancel, and that I can cancel any time in Manage billing.");
    expect(autoRenewalText("$149.99", "year")).toMatch(/\$149\.99 per year/);
  });
});
