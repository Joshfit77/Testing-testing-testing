import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";

/**
 * The Privacy Policy and Terms must be reachable from inside the app by a signed-in member (App Store guideline
 * 5.1.1(i)). Before, the only links for a signed-in member were in the paywall footers on Plans & billing, and the
 * in-app (store) paywall isn't shown at all until a RevenueCat key is configured, so the iPhone app had none.
 * The Profile page itself is rendered here; its data loading and interactive children are stubbed.
 */
vi.mock("@/server/auth", () => ({
  requireOnboardedUser: async () => ({
    user: { id: "u1", email: "member@example.com" },
    profile: { display_name: "M", unit_system: "metric", height_cm: 180, timezone: "UTC", faith_enabled: false, text_size: "default", reduce_motion: false, wellness_consent_at: null, ai_data_consent_at: null },
  }),
  getUserPlan: async () => "free",
}));
vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: async () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { source: "default" } }) }) }) }) }),
}));
vi.mock("@/server/actions/auth", () => ({ signOutAction: vi.fn() }));
vi.mock("@/components/shell/main-header", () => ({ MainHeader: () => null }));
vi.mock("@/components/profile/display-settings", () => ({ DisplaySettings: () => null }));
vi.mock("@/components/shell/sign-out-form", () => ({ SignOutForm: ({ children }: { children: React.ReactNode }) => <form>{children}</form> }));
vi.mock("@/components/profile/profile-forms", () => ({ ProfileForm: () => null, DeleteAccountForm: () => null, WithdrawConsentForm: () => null, AiConsentOffForm: () => null }));

const { default: ProfilePage } = await import("@/app/(app)/profile/page");

describe("Profile → Privacy & data links the legal documents", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("links the in-app drafts, marked as drafts, until final documents are configured", async () => {
    vi.stubEnv("LEGAL_TERMS_URL", "");
    vi.stubEnv("LEGAL_PRIVACY_URL", "");
    render(await ProfilePage());
    const privacy = within(document.getElementById("privacy")!);
    expect(privacy.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/legal/privacy");
    expect(privacy.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/legal/terms");
    expect(privacy.getByRole("link", { name: "Notices & licenses" })).toHaveAttribute("href", "/legal/notices");
    expect(screen.getByText(/drafts awaiting legal review/i)).toBeInTheDocument();
  });

  it("links the final, counsel-reviewed documents once they are set", async () => {
    vi.stubEnv("LEGAL_TERMS_URL", "https://narrowgate.example/terms");
    vi.stubEnv("LEGAL_PRIVACY_URL", "https://narrowgate.example/privacy");
    render(await ProfilePage());
    const privacy = within(document.getElementById("privacy")!);
    expect(privacy.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "https://narrowgate.example/privacy");
    expect(privacy.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "https://narrowgate.example/terms");
    expect(screen.queryByText(/drafts awaiting legal review/i)).not.toBeInTheDocument();
  });
});
