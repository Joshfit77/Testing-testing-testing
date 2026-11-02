import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const submit = vi.fn(async (_input: unknown) => ({ ok: true as const }));
vi.mock("@/server/actions/coach-feedback", () => ({ submitCoachFeedbackAction: (input: unknown) => submit(input) }));

const { CoachFeedback } = await import("@/components/coach/coach-feedback");
const ID = "6f1c2a4e-0000-4000-8000-000000000001";

/** "Was this coaching advice useful?" under a coach reply (shown only when the owner has switched it on). */
describe("coach reply feedback", () => {
  it("asks the question with Yes / Partially / No, sends the choice, then offers an optional comment", async () => {
    render(<CoachFeedback messageId={ID} />);
    expect(screen.getByText("Was this coaching advice useful?")).toBeTruthy();
    for (const label of ["Yes", "Partially", "No"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Partially" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ messageId: ID, rating: "partially", safetyConcern: false }));
    fireEvent.change(await screen.findByLabelText("Comment (optional)"), { target: { value: "Needed sets and reps." } });
    fireEvent.click(screen.getByRole("button", { name: "Send comment" }));
    await waitFor(() => expect(submit).toHaveBeenLastCalledWith({ messageId: ID, rating: "partially", safetyConcern: false, comment: "Needed sets and reps." }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Thanks — your feedback was sent.");
  });

  it("reports a safety concern, with an emergency reminder, without needing a rating", async () => {
    submit.mockClear();
    render(<CoachFeedback messageId={ID} />);
    fireEvent.click(screen.getByRole("button", { name: /Report a safety concern/ }));
    expect(screen.getByText(/call your local emergency number/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("What worried you (optional)"), { target: { value: "Told me to train through chest pain." } });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ messageId: ID, rating: null, safetyConcern: true, comment: "Told me to train through chest pain." }));
  });
});
