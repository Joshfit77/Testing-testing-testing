import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { DEFAULT_PRIVACY } from "@/lib/domain/friends";

/**
 * Privacy & sharing (Friends): a member is offered only the switches something reads today. The five that no database
 * function reads yet (records, rankings, weight and measurements, nutrition, Faith activity) are not on the screen,
 * whatever their stored values, so nobody can agree to sharing that doesn't exist yet (audit finding F-09).
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));
vi.mock("@/server/actions/friends", () => ({ updatePrivacyAction: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/server/services/friends", () => ({}));

const { PrivacySwitches } = await import("@/components/friends/friends-panels");

describe("friends: privacy switches on screen", () => {
  afterEach(() => cleanup());

  it("what friends can see: profile and workouts only, workouts off for a new member", () => {
    render(<PrivacySwitches initial={DEFAULT_PRIVACY} group="friends" />);
    expect(screen.getAllByRole("switch").map((s) => s.getAttribute("data-testid"))).toEqual(["privacy-profile_visible", "privacy-show_workouts"]);
    expect(screen.getByTestId("privacy-profile_visible")).toHaveAttribute("data-state", "checked");
    expect(screen.getByTestId("privacy-show_workouts")).toHaveAttribute("data-state", "unchecked");
    for (const hidden of ["show_records", "show_in_leaderboards", "show_body", "show_nutrition", "show_faith"]) expect(screen.queryByTestId(`privacy-${hidden}`), hidden).toBeNull();
    expect(document.body).not.toHaveTextContent(/Faith|Nutrition|Weight|rankings|Personal records/);
  });

  it("the inactive switches stay hidden even when their stored values are on", () => {
    render(<PrivacySwitches initial={{ ...DEFAULT_PRIVACY, show_records: true, show_in_leaderboards: true, show_body: true, show_nutrition: true, show_faith: true }} group="friends" />);
    expect(screen.getAllByRole("switch")).toHaveLength(2);
  });

  it("finding you: the one search switch", () => {
    render(<PrivacySwitches initial={DEFAULT_PRIVACY} group="finding" />);
    expect(screen.getAllByRole("switch").map((s) => s.getAttribute("data-testid"))).toEqual(["privacy-searchable"]);
  });
});
