import { businessDetails, missingDetails, type RequiredDetail } from "../legal-details";

/**
 * Publication details for the Terms of Service (/legal/terms).
 *
 * Fill these in (and the shared business details in ../legal-details.ts) before publishing. Until every
 * required value is set, the page is labelled as a draft, shows a notice listing what is missing, and asks
 * search engines not to index it. Do not mark the terms ready until qualified counsel has reviewed them.
 */
export const termsConfig = {
  /** Date the terms take effect, as YYYY-MM-DD (e.g. "2026-12-01"). Update it whenever the terms change. */
  effectiveDate: null as string | null,
  operatorLegalName: businessDetails.operatorLegalName,
  contactEmail: businessDetails.contactEmail,
  postalAddress: businessDetails.postalAddress,
  governingLaw: businessDetails.governingLaw,
  /** Set to true once counsel has reviewed the final text, including the disclaimer and liability sections. */
  legalReviewComplete: false,
};

type TermsConfig = typeof termsConfig;

const REQUIRED: RequiredDetail<TermsConfig>[] = [
  { key: "effectiveDate", label: "Effective date" },
  { key: "operatorLegalName", label: "Legal name of the operating business" },
  { key: "contactEmail", label: "Contact email address" },
  { key: "postalAddress", label: "Postal address for legal notices" },
  { key: "governingLaw", label: "Governing law (jurisdiction)" },
  { key: "legalReviewComplete", label: "Legal review of the final text" },
];

/** Labels of the details that still need to be supplied before publication. */
export function missingTermsDetails(config: TermsConfig = termsConfig): string[] {
  return missingDetails(config, REQUIRED);
}

export function isTermsReady(config: TermsConfig = termsConfig): boolean {
  return missingTermsDetails(config).length === 0;
}
