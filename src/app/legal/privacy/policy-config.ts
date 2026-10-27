import { businessDetails, missingDetails, type RequiredDetail } from "../legal-details";

/**
 * Publication details for the privacy policy (/legal/privacy).
 *
 * Fill these in (and the shared business details in ../legal-details.ts) before publishing. Until every
 * required value is set, the page is labelled as a draft, shows a notice listing what is missing, and asks
 * search engines not to index it. Do not mark the policy ready until qualified counsel has reviewed it.
 */
export const privacyPolicyConfig = {
  /** Date the policy takes effect, as YYYY-MM-DD (e.g. "2026-12-01"). Update it whenever the policy changes. */
  effectiveDate: null as string | null,
  operatorLegalName: businessDetails.operatorLegalName,
  contactEmail: businessDetails.contactEmail,
  postalAddress: businessDetails.postalAddress,
  /**
   * Set to true only after confirming that every service provider named in the policy is bound by terms
   * (e.g. a data processing agreement) that protect user data at least as well as this policy. Apple
   * App Review Guideline 5.1.1(i) requires the policy to confirm this.
   */
  providerProtectionConfirmed: false,
  /** Set to true once counsel has reviewed the final text. */
  legalReviewComplete: false,
};

type PrivacyPolicyConfig = typeof privacyPolicyConfig;

const REQUIRED: RequiredDetail<PrivacyPolicyConfig>[] = [
  { key: "effectiveDate", label: "Effective date" },
  { key: "operatorLegalName", label: "Legal name of the operating business" },
  { key: "contactEmail", label: "Privacy contact email address" },
  { key: "postalAddress", label: "Postal address for privacy correspondence" },
  { key: "providerProtectionConfirmed", label: "Confirmation that service-provider agreements protect user data" },
  { key: "legalReviewComplete", label: "Legal review of the final text" },
];

/** Labels of the details that still need to be supplied before publication. */
export function missingPrivacyPolicyDetails(config: PrivacyPolicyConfig = privacyPolicyConfig): string[] {
  return missingDetails(config, REQUIRED);
}

export function isPrivacyPolicyReady(config: PrivacyPolicyConfig = privacyPolicyConfig): boolean {
  return missingPrivacyPolicyDetails(config).length === 0;
}
