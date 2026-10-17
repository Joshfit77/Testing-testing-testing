import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { EXERCISES } from "@/data/exercises";
import type { CatalogExercise } from "@/lib/domain/program-generator";

const buildAction = vi.fn();
vi.mock("@/server/actions/custom-programs", () => ({ buildCustomProgramAction: (...args: unknown[]) => buildAction(...args) }));

const { ProgramBuilder } = await import("@/components/train/program-builder");

const catalog: CatalogExercise[] = EXERCISES.map((e) => ({
  slug: e.slug,
  name: e.name,
  equipment: e.equipment,
  pattern: e.pattern,
  category: e.category,
  difficulty: e.difficulty,
  timed: e.timed,
  lowImpact: e.lowImpact,
}));

const next = () => fireEvent.click(screen.getByRole("button", { name: /^Next/ }));

describe("ProgramBuilder", () => {
  beforeEach(() => buildAction.mockReset());

  it("walks through every step and submits validated, unit-converted answers", async () => {
    buildAction.mockResolvedValue({ ok: false, message: "Test stop" });
    render(
      <ProgramBuilder
        initialType={null}
        catalog={catalog}
        initial={{ units: "imperial", age: 30, heightCm: 180, weightKg: 90, experience: "intermediate", daysPerWeek: 4, equipment: ["barbell", "rack", "bench", "dumbbell"] }}
      />,
    );
    // Step 1: must choose a type.
    next();
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a program type");
    fireEvent.click(screen.getByRole("button", { name: /Bench Press Only/ }));
    next();

    // Step 2: prefilled from profile (imperial).
    expect(screen.getByLabelText("Height (ft)")).toHaveValue(5);
    expect(screen.getByLabelText("Height (in)")).toHaveValue(11);
    expect(screen.getByLabelText("Bodyweight (lb)")).toHaveValue(198.4);
    fireEvent.change(screen.getByLabelText("Age"), { target: { value: "17" } });
    next();
    expect(screen.getByRole("alert")).toHaveTextContent("18+");
    fireEvent.change(screen.getByLabelText("Age"), { target: { value: "31" } });
    next();

    // Step 3: goal + schedule.
    fireEvent.click(screen.getByRole("button", { name: /Increase my 1-rep max/ }));
    expect(screen.getByLabelText("Days per week")).toHaveValue("4");
    next();

    // Step 4: numbers — a best set is converted with Epley.
    fireEvent.click(screen.getByRole("button", { name: "Recent best set" }));
    fireEvent.change(screen.getByLabelText("Weight (lb)"), { target: { value: "225" } });
    fireEvent.change(screen.getByLabelText("Reps"), { target: { value: "5" } });
    expect(screen.getByText(/Estimated 1RM/)).toHaveTextContent("263 lb");
    next();

    // Step 5: equipment prefilled.
    expect(screen.getByRole("button", { name: /Barbell & plates/ })).toHaveAttribute("aria-pressed", "true");
    next();

    // Step 6: review shows week-specific loads, then submits.
    expect(screen.getByText("Review your program")).toBeInTheDocument();
    expect(screen.getAllByText(/70% · 185 lb/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Week 2:/ }));
    expect(screen.getAllByText(/72.5% · 190 lb/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Build & start program" }));

    await waitFor(() => expect(buildAction).toHaveBeenCalledTimes(1));
    const payload = buildAction.mock.calls[0]![0];
    expect(payload).toMatchObject({ type: "bench", goal: "increase_1rm", age: 31, daysPerWeek: 4, weeks: 8, experience: "intermediate" });
    expect(payload.lifts.bench.reps).toBe(5);
    expect(payload.lifts.bench.weightKg).toBeCloseTo(102.06, 1);
    expect(payload.lifts.squat).toBeUndefined();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Test stop"));
  });

  it("skips the numbers step for types that don't need it and requires a show division", () => {
    render(<ProgramBuilder initialType="show_prep" catalog={catalog} initial={{ units: "metric", age: 28, heightCm: 170, weightKg: 70, equipment: [] }} />);
    expect(screen.getByText(/Step 2 of 5/)).toBeInTheDocument();
    expect(screen.getByLabelText("Height (cm)")).toHaveValue(170);
    next();
    next();
    expect(screen.getByRole("alert")).toHaveTextContent("division");
    fireEvent.click(screen.getByRole("button", { name: "Bikini" }));
    next();
    expect(screen.getByText("Your equipment")).toBeInTheDocument();
  });
});
