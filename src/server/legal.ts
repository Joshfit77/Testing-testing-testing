import "server-only";
import { cache } from "react";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { AUTO_RENEWAL_CONSENT, LEGAL_PAGES, RISK_ACKNOWLEDGMENT, type LegalDocument } from "@/lib/legal/versions";
import { isServiceRoleConfigured } from "@/server/env";
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

/** Every document version this server can show, with its fingerprint (src/lib/legal/versions.ts). */
export function publishedLegalVersions(): { document: LegalDocument; version: string; document_sha256: string }[] {
  return [
    { document: "terms", version: LEGAL_PAGES.terms.version, document_sha256: LEGAL_PAGES.terms.sha256 },
    { document: "privacy", version: LEGAL_PAGES.privacy.version, document_sha256: LEGAL_PAGES.privacy.sha256 },
    { document: "risk_acknowledgment", version: RISK_ACKNOWLEDGMENT.version, document_sha256: RISK_ACKNOWLEDGMENT.sha256 },
    { document: "auto_renewal", version: AUTO_RENEWAL_CONSENT.version, document_sha256: AUTO_RENEWAL_CONSENT.sha256 },
  ];
}

let registered: Promise<void> | null = null;

/**
 * The database accepts a record only for a listed version (legal_document_versions). The current versions are listed
 * by a migration; this lists them again from this file, once per server process, so a new version of a document
 * never needs a migration of its own before members can accept it.
 */
export function registerLegalVersions(): Promise<void> {
  if (!isServiceRoleConfigured()) return Promise.resolve();
  registered ??= (async () => {
    const { error } = await getServiceSupabase()
      .from("legal_document_versions")
      .upsert(publishedLegalVersions(), { onConflict: "document,version,document_sha256", ignoreDuplicates: true });
    if (error) {
      registered = null; // try again next time
      throw error;
    }
  })();
  return registered;
}

/**
 * Record acceptances made while signed in (re-acceptance, checkout consent). Written by the server, never by the
 * member's own session, so the version, fingerprint and details are the server's (the database checks them against
 * the listed versions too) and stamps the time.
 */
export async function recordAcceptances(
  userId: string,
  rows: { document: LegalDocument; version: string; sha256: string; details?: string }[],
  source: "reaccept" | "checkout",
): Promise<void> {
  await registerLegalVersions();
  const { error } = await getServiceSupabase()
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
