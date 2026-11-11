import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attemptId, SAVE_FAILED_MESSAGE } from "@/lib/domain/diary";
import { sumNutrients } from "@/lib/domain/recipes";

/**
 * Logging food with no connection: the server action call itself rejects (it never reaches the server). The form
 * stays, what was entered stays, a message says so in place, and the retry sends the same id so it can't log twice.
 */
const { actions, router } = vi.hoisted(() => ({
  actions: { relogItemAction: vi.fn(), logRecipeAction: vi.fn(), copyMealsAction: vi.fn(), logFoodAction: vi.fn(), updateBudgetAction: vi.fn(), undoLoggedItemsAction: vi.fn() },
  router: { push: vi.fn(), refresh: vi.fn() },
}));
vi.mock("@/server/actions/nutrition", () => actions);
vi.mock("@/server/actions/recipes", () => ({ logRecipeAction: (input: unknown) => actions.logRecipeAction(input) }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { QuickRelog } = await import("@/components/nutrition/quick-relog");
const { RecipeLogForm } = await import("@/components/nutrition/recipe-log-form");
const { CopyMealButton } = await import("@/components/nutrition/diary-client");

const offline = () => Promise.reject(new TypeError("Failed to fetch"));
const food = (id: string, name: string) => ({ id, name, amountLabel: "1 cup", calories: 200, protein_g: 4, carbs_g: 40, fat_g: 1, count: 3 }) as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("attemptId", () => {
  it("reuses the id for the same thing, and makes a new one for a different thing or after it is cleared", () => {
    const ref: { current: { key: string; id: string } | null } = { current: null };
    const first = attemptId(ref, "rice|lunch");
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(attemptId(ref, "rice|lunch")).toBe(first);
    const other = attemptId(ref, "beans|lunch");
    expect(other).not.toBe(first);
    ref.current = null;
    expect(attemptId(ref, "beans|lunch")).not.toBe(other);
  });
});

describe("a food log that never reaches the server", () => {
  it("one-tap re-log: says so in place, and the retry reuses the id; the next add after success gets a new one", async () => {
    actions.relogItemAction.mockImplementationOnce(offline).mockResolvedValue({ ok: true, message: "Logged Rice (1 cup) to lunch.", itemIds: [], at: 1 });
    render(<QuickRelog date="2026-11-09" recent={[food("aaaaaaaa-0000-4000-8000-000000000001", "Rice")]} frequent={[]} />);
    const add = screen.getByRole("button", { name: "Add Rice again" });
    fireEvent.click(add);
    expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_FAILED_MESSAGE);
    // The list is still there to try again.
    await waitFor(() => expect(add).toBeEnabled());
    fireEvent.click(add);
    expect(await screen.findByText("Logged Rice (1 cup) to lunch.")).toBeInTheDocument();
    const [first, second] = actions.relogItemAction.mock.calls.map(([input]) => (input as { clientId: string }).clientId);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toBe(first);
    await waitFor(() => expect(add).toBeEnabled());
    fireEvent.click(add);
    await waitFor(() => expect(actions.relogItemAction).toHaveBeenCalledTimes(3));
    expect((actions.relogItemAction.mock.calls[2]![0] as { clientId: string }).clientId).not.toBe(first);
  });

  it("recipe: keeps the servings that were typed and reuses the id on the retry", async () => {
    actions.logRecipeAction.mockImplementationOnce(offline).mockResolvedValue({ ok: true, message: "Logged 1.5 servings of Chili.", at: 2 });
    render(<RecipeLogForm recipeId="dddddddd-0000-4000-8000-000000000005" perServing={sumNutrients([{ calories: 400, protein_g: 30, carbs_g: 40, fat_g: 10, fiber_g: null, sugar_g: null, sodium_mg: null }])} today="2026-11-09" />);
    const servings = screen.getByLabelText("Servings eaten");
    fireEvent.change(servings, { target: { value: "1.5" } });
    const submit = screen.getByRole("button", { name: /Log to diary/ });
    fireEvent.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_FAILED_MESSAGE);
    expect(servings).toHaveValue("1.5");
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    expect(await screen.findByText(/Logged 1.5 servings of Chili/)).toBeInTheDocument();
    const [first, second] = actions.logRecipeAction.mock.calls.map(([input]) => input as { clientId: string; servings: number });
    expect(first!.servings).toBe(1.5);
    expect(second!.clientId).toBe(first!.clientId);
  });

  it("copy a day: says so in place and reuses the id on the retry", async () => {
    actions.copyMealsAction.mockImplementationOnce(offline).mockResolvedValue({ ok: true, message: "Copied 2 items.", itemIds: [], at: 3 });
    render(<CopyMealButton fromDate="2026-11-08" toDate="2026-11-09" label="Copy yesterday" />);
    const copy = screen.getByRole("button", { name: /Copy yesterday/ });
    fireEvent.click(copy);
    expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_FAILED_MESSAGE);
    await waitFor(() => expect(copy).toBeEnabled());
    fireEvent.click(copy);
    expect(await screen.findByText("Copied 2 items.")).toBeInTheDocument();
    const [first, second] = actions.copyMealsAction.mock.calls.map(([input]) => (input as { clientId: string }).clientId);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toBe(first);
  });
});
