import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { MilestoneCelebration } from "@/components/train/milestone-celebration";

describe("MilestoneCelebration", () => {
  it("shows nothing when no milestone was reached", () => {
    const { container } = render(<MilestoneCelebration milestones={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces each reached milestone as a status, in the shared terms", () => {
    render(
      <MilestoneCelebration
        milestones={[
          { exerciseId: "a", name: "Pull-Up", what: "Most reps at bodyweight", value: "12 reps", kind: "reps" },
          { exerciseId: "a", name: "Pull-Up", what: "Heaviest added weight", value: "25 lb", kind: "added_weight" },
        ]}
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("2 milestones reached");
    expect(status).toHaveTextContent("Most reps at bodyweight");
    expect(status).toHaveTextContent("12 reps");
    expect(status).toHaveTextContent("Heaviest added weight");
    expect(status).toHaveTextContent("25 lb");
  });

  it("stops every milestone animation under reduced motion (device setting and the app's own)", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const block = css.slice(css.indexOf("/* Milestone reached"));
    expect(block).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.milestone-card,\s*\.milestone-card::before,\s*\.milestone-medal::after \{ animation: none !important; \}/);
    expect(block).toMatch(/html\[data-motion="reduce"\] \.milestone-card,\s*html\[data-motion="reduce"\] \.milestone-medal::after \{ animation: none !important; \}/);
    expect(block).toMatch(/html\[data-motion="reduce"\] \.milestone-card::before \{ display: none; \}/);
  });
});
