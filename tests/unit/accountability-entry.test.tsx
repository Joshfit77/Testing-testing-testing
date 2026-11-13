import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { vi } from "vitest";

/**
 * Accountability partners ship switched off (migration 067): with the `accountability_partners` flag off, the You page
 * has no entry point and /profile/accountability is a 404; only once the owner switches it on do both appear.
 */
let flagOn = false;
vi.mock("@/server/flags", async (original) => ({ ...(await original<typeof import("@/server/flags")>()), isFlagOn: async (key: string) => key === "accountability_partners" && flagOn }));
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
const notFound = vi.fn(() => {
  throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
});
vi.mock("next/navigation", async (original) => ({ ...(await original<typeof import("next/navigation")>()), notFound: () => notFound() }));
const getAccountabilityData = vi.fn(async () => ({ partners: [], invites: [] }));
vi.mock("@/server/services/accountability", () => ({ getAccountabilityData: () => getAccountabilityData() }));
vi.mock("@/server/actions/auth", () => ({ signOutAction: vi.fn() }));
vi.mock("@/server/actions/accountability", () => ({}));
vi.mock("@/components/shell/main-header", () => ({ MainHeader: () => null }));
vi.mock("@/components/platform/back-link", () => ({ BackLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/components/profile/display-settings", () => ({ DisplaySettings: () => null }));
vi.mock("@/components/shell/sign-out-form", () => ({ SignOutForm: ({ children }: { children: React.ReactNode }) => <form>{children}</form> }));
vi.mock("@/components/profile/profile-forms", () => ({ ProfileForm: () => null, DeleteAccountForm: () => null, WithdrawConsentForm: () => null, AiConsentOffForm: () => null }));
vi.mock("@/components/accountability/accountability-panels", () => ({ EnterCodeForm: () => null, InviteCodes: () => null, PartnerCard: () => null }));

const { default: ProfilePage } = await import("@/app/(app)/profile/page");
const { default: AccountabilityPage } = await import("@/app/(app)/profile/accountability/page");

describe("accountability partners behind the flag", () => {
  afterEach(() => {
    cleanup();
    notFound.mockClear();
    getAccountabilityData.mockClear();
  });

  it("off: no entry point on the You page, and the page is a 404 that reads nothing", async () => {
    flagOn = false;
    render(await ProfilePage());
    expect(screen.queryByRole("link", { name: /Accountability partners/i })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/profile/accountability"]')).toBeNull();
    await expect(AccountabilityPage()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(notFound).toHaveBeenCalled();
    expect(getAccountabilityData).not.toHaveBeenCalled();
  });

  it("on: the You page links it, and the page explains what is and isn't shared", async () => {
    flagOn = true;
    render(await ProfilePage());
    expect(document.querySelector('a[href="/profile/accountability"]')).not.toBeNull();
    cleanup();
    render(await AccountabilityPage());
    const privacy = screen.getByTestId("accountability-privacy");
    expect(privacy).toHaveTextContent("Workouts this week");
    expect(privacy).toHaveTextContent("Never shared");
    for (const never of ["Food and nutrition", "Weight and measurements", "Sleep", "Body scans and progress photos", "Prayer journal", "AI Coach conversations"]) expect(privacy).toHaveTextContent(never);
    expect(notFound).not.toHaveBeenCalled();
  });
});
