import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Audit 2026-11-14: the Steps card averaged over all seven calendar days, so days that were never synced counted as
 * zero steps (two days of 9,000 read "2,571 avg"). A day with no count is unknown and stays out of the average.
 */
vi.mock("@/server/actions/steps", () => ({ saveStepsManualAction: vi.fn(), syncStepsAction: vi.fn(), updateStepGoalAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { StepsCard } = await import("@/components/steps/steps-card");

const week = (steps: number[]) => steps.map((s, i) => ({ day: `2026-11-0${i + 1}`, steps: s }));

describe("Steps card: weekly average", () => {
  it("averages the days that have a count", () => {
    render(<StepsCard today="2026-11-07" goal={8000} todaySteps={9000} todaySource="apple_health" week={week([0, 0, 0, 0, 9000, 0, 9000])} recordedDays={2} />);
    expect(screen.getByTestId("steps-week-avg")).toHaveTextContent("9,000 avg over 2 days");
    // The goal count still covers the seven days shown.
    expect(screen.getByText(/goal hit 2\/7/)).toBeInTheDocument();
  });

  it("says so when nothing is recorded, instead of showing an average of 0", () => {
    render(<StepsCard today="2026-11-07" goal={8000} todaySteps={0} todaySource={null} week={week([0, 0, 0, 0, 0, 0, 0])} recordedDays={0} />);
    expect(screen.getByTestId("steps-week-avg")).toHaveTextContent("No steps recorded");
  });

  it("a full week is the plain mean", () => {
    render(<StepsCard today="2026-11-07" goal={8000} todaySteps={7000} todaySource="manual" week={week([7000, 7000, 7000, 7000, 7000, 7000, 7000])} recordedDays={7} />);
    expect(screen.getByTestId("steps-week-avg")).toHaveTextContent("7,000 avg over 7 days");
  });
});
