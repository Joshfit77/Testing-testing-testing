/**
 * Publication details for the privacy policy (/legal/privacy).
 *
 * Fill these in before publishing. Until every required value is set, the page is labelled as a draft,
 * shows a notice listing what is missing, and asks search engines not to index it.
 * Do not mark the policy ready until qualified counsel has reviewed it.
 */
export const privacyPolicyConfig = {
  /** Date the policy takes effect, as YYYY-MM-DD (e.g. "2026-12-01"). Update it whenever the policy changes. */
  effectiveDate: null as string | null,
  /** Legal name of the business that operates Narrow Gate Fitness (the data controller). */
  operatorLegalName: null as string | null,
  /** Email address for privacy questions and requests. */
  contactEmail: null as string | null,
  /** Postal address for privacy correspondence. */
  postalAddress: null as string | null,
  /**
   * Set to true only after confirming that every service provider named in the policy is bound by terms
   * (e.g. a data processing agreement) that protect user data at least as well as this policy. Apple
   * App Review Guideline 5.1.1(i) requires the policy to confirm this.
   */
  providerProtectionConfirmed: false,
  /** Set to true once counsel has reviewed the final text. */
  legalReviewComplete: false,
};

const REQUIRED: { key: keyof typeof privacyPolicyConfig; label: string }[] = [
  { key: "effectiveDate", label: "Effective date" },
  { key: "operatorLegalName", label: "Legal name of the operating business" },
  { key: "contactEmail", label: "Privacy contact email address" },
  { key: "postalAddress", label: "Postal address for privacy correspondence" },
  { key: "providerProtectionConfirmed", label: "Confirmation that service-provider agreements protect user data" },
  { key: "legalReviewComplete", label: "Legal review of the final text" },
];

/** Labels of the details that still need to be supplied before publication. */
export function missingPrivacyPolicyDetails(config = privacyPolicyConfig): string[] {
  return REQUIRED.filter(({ key }) => !config[key]).map(({ label }) => label);
}

export function isPrivacyPolicyReady(config = privacyPolicyConfig): boolean {
  return missingPrivacyPolicyDetails(config).length === 0;
}
