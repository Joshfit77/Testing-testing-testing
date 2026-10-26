import "server-only";
import { cache } from "react";
import { getServerSupabase } from "@/lib/supabase/server";
import { LEGAL_PAGES, RISK_ACKNOWLEDGMENT, type LegalDocument } from "@/lib/legal/versions";
import { logError } from "@/server/log";

/**
 * Re-acceptance after a material change to the Terms or Privacy Policy. Off by default: switching it on makes every
 * member without a record of the current versions accept them before continuing (src/app/legal/accept). The owner
 * turns it on only once final, counsel-reviewed documents are published.
 */
export function reacceptRequired(): boolean {
  return process.env.LEGAL_REACCEPT_REQUIRED === "true";
}

/** Does the member have a record of accepting the current Terms and Privacy Policy? */
export const hasCurrentAcceptance = cache(async (userId: string): Promise<boolean> => {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("document, version, document_sha256")
    .eq("user_id", userId)
    .in("document", ["terms", "privacy"]);
  if (error) {
    logError("legal.read", error);
    // Never lock someone out over a read failure; the next request checks again.
    return true;
  }
  const has = (doc: "terms" | "privacy") => (data ?? []).some((r) => r.document === doc && r.version === LEGAL_PAGES[doc].version && r.document_sha256 === LEGAL_PAGES[doc].sha256);
  return has("terms") && has("privacy");
});

/** Record acceptances made while signed in (re-acceptance, checkout consent). The database stamps the time. */
export async function recordAcceptances(
  userId: string,
  rows: { document: LegalDocument; version: string; sha256: string; details?: string }[],
  source: "reaccept" | "checkout",
): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("legal_acceptances")
    .insert(rows.map((r) => ({ user_id: userId, document: r.document, version: r.version, document_sha256: r.sha256, details: r.details ?? null, source })));
  if (error) throw error;
}

export function currentReacceptRows() {
  return [
    { document: "terms" as const, version: LEGAL_PAGES.terms.version, sha256: LEGAL_PAGES.terms.sha256 },
    { document: "privacy" as const, version: LEGAL_PAGES.privacy.version, sha256: LEGAL_PAGES.privacy.sha256 },
    { document: "risk_acknowledgment" as const, version: RISK_ACKNOWLEDGMENT.version, sha256: RISK_ACKNOWLEDGMENT.sha256 },
  ];
}
