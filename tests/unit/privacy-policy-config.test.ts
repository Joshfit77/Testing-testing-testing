import { isPrivacyPolicyReady, missingPrivacyPolicyDetails, privacyPolicyConfig } from "@/app/legal/privacy/policy-config";

const complete = {
  effectiveDate: "2026-12-01",
  operatorLegalName: "Example Co.",
  contactEmail: "privacy@example.com",
  postalAddress: "1 Example Street",
  providerProtectionConfirmed: true,
  legalReviewComplete: true,
};

describe("privacy policy publication details", () => {
  it("stays a draft until the business details and confirmations are supplied", () => {
    expect(isPrivacyPolicyReady(privacyPolicyConfig)).toBe(false);
    expect(missingPrivacyPolicyDetails(privacyPolicyConfig)).toContain("Privacy contact email address");
  });
  it("is ready once every required detail is set", () => {
    expect(missingPrivacyPolicyDetails(complete)).toEqual([]);
    expect(isPrivacyPolicyReady(complete)).toBe(true);
  });
  it("lists exactly what is missing", () => {
    expect(missingPrivacyPolicyDetails({ ...complete, contactEmail: null, legalReviewComplete: false })).toEqual([
      "Privacy contact email address",
      "Legal review of the final text",
    ]);
  });
});
