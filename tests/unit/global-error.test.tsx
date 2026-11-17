import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The root recovery screen (src/app/global-error.tsx): shown when the root layout fails or an error escapes every
 * other boundary. It must stand on its own document, offer a retry and a full reload to Home, say that a workout in
 * progress is kept, and report the error (redacted, opt-in) like the other crash screens.
 */
const report = vi.fn();
vi.mock("@/lib/error-report", () => ({ reportClientError: (...a: unknown[]) => report(...a) }));

const { default: GlobalError } = await import("@/app/global-error");

afterEach(() => {
  cleanup();
  report.mockReset();
});

describe("root error recovery screen", () => {
  it("renders a whole document of its own: <html> and <body>, nothing from the app shell", () => {
    const html = renderToStaticMarkup(<GlobalError error={Object.assign(new Error("boom"), { digest: "d1" })} reset={() => {}} />);
    expect(html.startsWith("<html")).toBe(true);
    expect(html).toContain("<body");
    expect(html).toContain("Something went wrong");
    // The error's own message is never shown (it can carry member data); only the opaque digest is.
    expect(html).not.toContain("boom");
    expect(html).toContain("Reference: d1");
  });

  it("says a workout in progress is kept, and Try again calls reset", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("x")} reset={reset} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/If you were logging a workout, it's saved on this device/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("Go to Home is a plain link (a full reload rebuilds the app shell that failed)", () => {
    render(<GlobalError error={new Error("x")} reset={() => {}} />);
    const home = screen.getByRole("link", { name: "Go to Home" });
    expect(home.tagName).toBe("A");
    expect(home).toHaveAttribute("href", "/home");
  });

  it("reports the error once, as a crash screen, with its digest", () => {
    const err = Object.assign(new Error("x"), { digest: "abc" });
    render(<GlobalError error={err} reset={() => {}} />);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith("boundary", err, "abc");
  });

  it("without a digest, no reference line is shown", () => {
    render(<GlobalError error={new Error("x")} reset={() => {}} />);
    expect(screen.queryByText(/Reference:/)).toBeNull();
  });
});
