import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attemptId, SAVE_FAILED_MESSAGE, waterAttemptKey } from "@/lib/domain/diary";
import { waterSchema } from "@/lib/validation/schemas";

/**
 * Water quick-add (N7): each tap sends one client id, a retry of that tap after a failed send reuses it (so the
 * server keeps one entry), and the next tap after a confirmed one gets a new id.
 */
const { actions } = vi.hoisted(() => ({
  actions: {
    addWaterAction: vi.fn(),
    undoWaterAction: vi.fn(),
    createCustomFoodAction: vi.fn(),
    logFoodAction: vi.fn(),
    logTemplateAction: vi.fn(),
    relogItemAction: vi.fn(),
    saveMealTemplateAction: vi.fn(),
    updateGoalsAction: vi.fn(),
  },
}));
vi.mock("@/server/actions/nutrition", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { WaterQuick } = await import("@/components/home/water-quick");
const { WaterCard } = await import("@/components/nutrition/nutrition-client");

const offline = () => Promise.reject(new TypeError("Failed to fetch"));
const sent = () => actions.addWaterAction.mock.calls.map(([, fd]) => Object.fromEntries(fd as FormData) as Record<string, string>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("water attempt ids", () => {
  it("the same amount on the same day is a retry of the same tap until it is confirmed", () => {
    const ref: { current: { key: string; id: string } | null } = { current: null };
    const first = attemptId(ref, waterAttemptKey("2026-11-12", 250));
    expect(attemptId(ref, waterAttemptKey("2026-11-12", 250))).toBe(first);
    // A different amount or day is a different tap.
    expect(attemptId(ref, waterAttemptKey("2026-11-12", 500))).not.toBe(first);
    expect(waterAttemptKey("2026-11-13", 250)).not.toBe(waterAttemptKey("2026-11-12", 250));
    ref.current = null;
    expect(attemptId(ref, waterAttemptKey("2026-11-12", 250))).not.toBe(first);
  });

  it("the schema takes an optional uuid client id and rejects anything else", () => {
    expect(waterSchema.safeParse({ date: "2026-11-12", amountMl: "250" }).success).toBe(true);
    expect(waterSchema.safeParse({ date: "2026-11-12", amountMl: "250", clientId: "6f1c2b8e-1d2a-4c3b-9e4f-5a6b7c8d9e0f" }).success).toBe(true);
    expect(waterSchema.safeParse({ date: "2026-11-12", amountMl: "250", clientId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("water quick-add that never reaches the server", () => {
  it("Home: says so in place, the retry reuses the id, and the next tap after success gets a new one", async () => {
    actions.addWaterAction.mockImplementationOnce(offline).mockResolvedValue({ ok: true, message: "Added 250 ml.", entryId: "e1", totalMl: 250, at: 1 });
    render(<WaterQuick date="2026-11-12" totalMl={0} goalMl={2500} />);
    const tap = () => fireEvent.click(screen.getByRole("button", { name: "+250 ml" }));
    tap();
    expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_FAILED_MESSAGE);
    await waitFor(() => expect(screen.getByRole("button", { name: "+250 ml" })).toBeEnabled());
    tap();
    await waitFor(() => expect(actions.addWaterAction).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "+250 ml" })).toBeEnabled());
    tap();
    await waitFor(() => expect(actions.addWaterAction).toHaveBeenCalledTimes(3));
    const [first, retry, next] = sent();
    expect(first).toMatchObject({ date: "2026-11-12", amountMl: "250" });
    expect(first!.clientId).toMatch(/^[0-9a-f-]{36}$/);
    expect(retry!.clientId).toBe(first!.clientId);
    expect(next!.clientId).not.toBe(first!.clientId);
  });

  it("Nutrition card: each amount is its own tap; a retry of one keeps that tap's id", async () => {
    actions.addWaterAction.mockImplementationOnce(offline).mockResolvedValue({ ok: true, message: "Added.", at: 2 });
    render(<WaterCard date="2026-11-12" totalMl={0} goalMl={2500} />);
    fireEvent.click(screen.getByRole("button", { name: "+500 ml" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "+500 ml" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "+500 ml" }));
    await waitFor(() => expect(actions.addWaterAction).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "+750 ml" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "+750 ml" }));
    await waitFor(() => expect(actions.addWaterAction).toHaveBeenCalledTimes(3));
    const [first, retry, other] = sent();
    expect(first!.amountMl).toBe("500");
    expect(retry!.clientId).toBe(first!.clientId);
    expect(other!.amountMl).toBe("750");
    expect(other!.clientId).not.toBe(first!.clientId);
  });
  it("offline: doesn't send at all (a failed action call replaces the page), says so, and the retry keeps the id", async () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    actions.addWaterAction.mockResolvedValue({ ok: true, message: "Added 250 ml.", entryId: "e1", totalMl: 250, at: 3 });
    render(<WaterQuick date="2026-11-12" totalMl={0} goalMl={2500} />);
    fireEvent.click(screen.getByRole("button", { name: "+250 ml" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_FAILED_MESSAGE);
    expect(actions.addWaterAction).not.toHaveBeenCalled();
    onLine.mockReturnValue(true);
    await waitFor(() => expect(screen.getByRole("button", { name: "+250 ml" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "+250 ml" }));
    await waitFor(() => expect(actions.addWaterAction).toHaveBeenCalledTimes(1));
    onLine.mockRestore();
  });
});
