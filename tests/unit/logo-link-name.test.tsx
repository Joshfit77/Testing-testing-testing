import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "@/components/common/logo";

/**
 * The wordmark's two lines ("Narrow Gate" over "Fitness") are stacked by flexbox, so without an explicit space
 * nothing separates them in the DOM text and the brand link reads "Narrow GateFitness". Every brand link that wraps
 * the logo is labelled "Narrow Gate Fitness home"; speech-input users say the visible words, so those words must
 * appear inside that label (WCAG 2.5.3; axe `label-content-name-mismatch` failed on /login, /signup and /legal/*).
 */
describe("the brand link's visible words are part of its accessible name", () => {
  it("the wordmark reads as 'Narrow Gate Fitness', with a space between its two lines", () => {
    const { container } = render(<Logo />);
    expect(container.textContent?.replace(/\s+/g, " ").trim()).toBe("Narrow Gate Fitness");
    expect("Narrow Gate Fitness home".includes(container.textContent?.replace(/\s+/g, " ").trim() ?? "")).toBe(true);
  });

  it("the compact mark has no text of its own (the link's label alone names it)", () => {
    const { container } = render(<Logo compact />);
    expect(container.textContent?.trim()).toBe("");
  });
});
