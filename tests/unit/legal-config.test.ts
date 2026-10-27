import { isPrivacyPolicyReady, missingPrivacyPolicyDetails, privacyPolicyConfig } from "@/app/legal/privacy/policy-config";
import { isTermsReady, missingTermsDetails, termsConfig } from "@/app/legal/terms/terms-config";

const business = {
  operatorLegalName: "Example Co.",
  contactEmail: "hello@example.com",
  postalAddress: "1 Example Street",
};

const completePrivacy = { ...business, effectiveDate: "2026-12-01", providerProtectionConfirmed: true, legalReviewComplete: true };
const completeTerms = { ...business, effectiveDate: "2026-12-01", governingLaw: "the State of Example", legalReviewComplete: true };

describe("privacy policy publication details", () => {
  it("stays a draft until the business details and confirmations are supplied", () => {
    expect(isPrivacyPolicyReady(privacyPolicyConfig)).toBe(false);
    expect(missingPrivacyPolicyDetails(privacyPolicyConfig)).toContain("Privacy contact email address");
  });
  it("is ready once every required detail is set", () => {
    expect(missingPrivacyPolicyDetails(completePrivacy)).toEqual([]);
    expect(isPrivacyPolicyReady(completePrivacy)).toBe(true);
  });
  it("lists exactly what is missing", () => {
    expect(missingPrivacyPolicyDetails({ ...completePrivacy, contactEmail: null, legalReviewComplete: false })).toEqual([
      "Privacy contact email address",
      "Legal review of the final text",
    ]);
  });
});

describe("terms publication details", () => {
  it("stays a draft until the business details and governing law are supplied", () => {
    expect(isTermsReady(termsConfig)).toBe(false);
    expect(missingTermsDetails(termsConfig)).toContain("Governing law (jurisdiction)");
  });
  it("is ready once every required detail is set", () => {
    expect(missingTermsDetails(completeTerms)).toEqual([]);
    expect(isTermsReady(completeTerms)).toBe(true);
  });
});
