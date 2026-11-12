import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUTO_RENEWAL_CONSENT, LEGAL_PAGES, RISK_ACKNOWLEDGMENT } from "@/lib/legal/versions";

/**
 * The database records an acceptance only for a listed document version (legal_document_versions, migration
 * 20261102000048). The migration lists the versions current when it was written; the server lists later ones itself
 * (registerLegalVersions in src/server/legal.ts). This keeps the migration's list in step with the app's.
 */
describe("published legal versions in the database", () => {
  const sql = readFileSync("supabase/migrations/20261102000048_low_findings_hardening.sql", "utf8");
  const seeded = [...sql.matchAll(/\('(terms|privacy|risk_acknowledgment|auto_renewal)', '([^']+)', '([0-9a-f]{64})'\)/g)].map((m) => [m[1], m[2], m[3]]);

  it("lists exactly the versions the app shows", () => {
    expect(seeded).toEqual([
      ["terms", LEGAL_PAGES.terms.version, LEGAL_PAGES.terms.sha256],
      ["privacy", LEGAL_PAGES.privacy.version, LEGAL_PAGES.privacy.sha256],
      ["risk_acknowledgment", RISK_ACKNOWLEDGMENT.version, RISK_ACKNOWLEDGMENT.sha256],
      ["auto_renewal", AUTO_RENEWAL_CONSENT.version, AUTO_RENEWAL_CONSENT.sha256],
    ]);
  });
});
