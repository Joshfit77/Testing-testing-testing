/**
 * Business details shared by the legal documents (/legal/privacy and /legal/terms).
 * Fill these in once; both documents read them. Each document also has its own config
 * (effective date, review status) next to its page.
 */
export const businessDetails = {
  /** Legal name of the business that operates Narrow Gate Fitness. */
  operatorLegalName: null as string | null,
  /** Email address for privacy, legal and support questions. */
  contactEmail: null as string | null,
  /** Postal address for legal correspondence. */
  postalAddress: null as string | null,
  /** Jurisdiction whose laws govern the Terms, e.g. "the State of Texas, United States". */
  governingLaw: null as string | null,
};

export type RequiredDetail<T> = { key: keyof T; label: string };

/** Labels of the required values in `config` that are still empty or false. */
export function missingDetails<T extends Record<string, unknown>>(config: T, required: RequiredDetail<T>[]): string[] {
  return required.filter(({ key }) => !config[key]).map(({ label }) => label);
}
