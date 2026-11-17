/**
 * The legal texts a member accepts, each with a version and a SHA-256 fingerprint of the exact text shown. A record
 * in `legal_acceptances` stores both, so the text accepted can always be recovered from the repository history.
 *
 * tests/unit/legal-versions.test.ts recomputes every fingerprint: changing a text without giving it a new version
 * fails the build. The Terms and Privacy pages are still the placeholder drafts in src/app/legal (not legally binding,
 * marked as drafts); the full drafts awaiting counsel are in docs/legal. Publishing final documents is the owner's
 * decision after legal review; it means updating these pages (or LEGAL_TERMS_URL / LEGAL_PRIVACY_URL), bumping the
 * versions here, and, for a material change, switching on re-acceptance (LEGAL_REACCEPT_REQUIRED=true).
 */

export type LegalDocument = "terms" | "privacy" | "risk_acknowledgment" | "auto_renewal";

export const LEGAL_PAGES = {
  terms: { version: "2026-10-26-placeholder", sha256: "946063b3f9f9fc2f0c5d5aa0d22fbedd2119743ef7ba460621460b026625027e", path: "src/app/legal/terms/page.tsx" },
  privacy: { version: "2026-10-26-placeholder", sha256: "8d8a8e0f40273174a44b291eb90fadc7ccb2dd7abae5841df0e1accc4b35646f", path: "src/app/legal/privacy/page.tsx" },
} as const satisfies Record<"terms" | "privacy", { version: string; sha256: string; path: string }>;

/** Shown above the sign-up boxes and accepted with its own unticked box. */
export const RISK_ACKNOWLEDGMENT = {
  version: "2026-10-26",
  sha256: "13ee7dde914c308e7cf61bfc835c33a608fb43c9ae34f34497eeff1c6191c4a8",
  text:
    "I understand that exercise and outdoor activity carry a risk of injury, and I'll stay aware of traffic and my surroundings when using GPS outdoors. Narrow Gate Fitness, including its workouts, programs, AI Coach, meal plans, sleep and recovery insights and Body Scan, gives general fitness and wellness information, not medical advice, and is not a doctor, registered dietitian or physical therapist. AI suggestions, food and nutrition estimates, and sleep and progress figures can be inaccurate or incomplete, and results aren't guaranteed. I'll review suggestions before changing my training or diet, and talk to a qualified professional first if I have a medical condition or injury, am pregnant, or have a history of disordered eating.",
} as const;

/** Web checkout: the auto-renewal terms the member agrees to, with the price and period filled in. */
export const AUTO_RENEWAL_CONSENT = {
  version: "2026-10-26",
  sha256: "21f34d05136b28c07ae40b2351ea66d51f01ca8603d8254d57cc88dd3c1eb49c",
  template: "I agree that Pro All Access renews automatically at {price} per {period} until I cancel, and that I can cancel any time in Manage billing.",
} as const;

export function autoRenewalText(price: string, period: "month" | "year"): string {
  return AUTO_RENEWAL_CONSENT.template.replace("{price}", price).replace("{period}", period);
}

/** The records written at sign-up (sent with the new account and stored by a database trigger). */
export function signupAcceptances(): { document: LegalDocument; version: string; sha256: string }[] {
  return [
    { document: "terms", version: LEGAL_PAGES.terms.version, sha256: LEGAL_PAGES.terms.sha256 },
    { document: "privacy", version: LEGAL_PAGES.privacy.version, sha256: LEGAL_PAGES.privacy.sha256 },
    { document: "risk_acknowledgment", version: RISK_ACKNOWLEDGMENT.version, sha256: RISK_ACKNOWLEDGMENT.sha256 },
  ];
}
