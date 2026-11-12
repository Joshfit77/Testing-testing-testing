import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const rethrow = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), unstable_rethrow: (e: unknown) => rethrow(e) }));
const toastError = vi.fn();
vi.mock("@/components/ui/toaster", () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn(), info: vi.fn() } }));

const { ActionButton } = await import("@/components/common/action-button");
const { EntryList } = await import("@/components/progress/entry-list");

const tap = () => fireEvent.click(screen.getByRole("button", { name: "Delete" }));

/** One-tap actions: a failed delete must not look like it worked, and an offline tap must not throw. */
describe("ActionButton", () => {
  beforeEach(() => {
    for (const m of [push, refresh, rethrow, toastError]) m.mockClear();
  });

  it("sends the fields, then navigates and refreshes when the action returns nothing (older actions)", async () => {
    const action = vi.fn(async (_fd: FormData) => undefined);
    render(
      <ActionButton action={action} fields={{ id: "abc" }} navigateTo="/faith/journal">
        Delete
      </ActionButton>,
    );
    tap();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(action.mock.calls[0]![0].get("id")).toBe("abc");
    expect(push).toHaveBeenCalledWith("/faith/journal");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("navigates and refreshes on { ok: true }", async () => {
    render(
      <ActionButton action={async () => ({ ok: true })} fields={{}} navigateTo="/x">
        Delete
      </ActionButton>,
    );
    tap();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/x"));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the action's error and stays put on { ok: false }", async () => {
    render(
      <ActionButton action={async () => ({ ok: false, error: "Couldn't delete your entry. Please try again." })} fields={{}} navigateTo="/x">
        Delete
      </ActionButton>,
    );
    tap();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't delete your entry. Please try again."));
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("catches a request that fails (offline), shows a message and stays put", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const failure = new Error("Failed to fetch");
    render(
      <ActionButton
        action={async () => {
          throw failure;
        }}
        fields={{}}
        navigateTo="/x"
      >
        Delete
      </ActionButton>,
    );
    tap();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("You appear to be offline. Try again when you're connected."));
    expect(rethrow).toHaveBeenCalledWith(failure); // a redirect thrown by the action is still let through
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    online.mockRestore();
  });
});

describe("EntryList", () => {
  const entries = Array.from({ length: 11 }, (_, i) => ({ id: `id-${i}`, date: `2026-10-${String(30 - i).padStart(2, "0")}`, value: `${80 + i} kg` }));

  it("renders nothing without entries", () => {
    const { container } = render(<EntryList entries={[]} action={async () => ({ ok: true })} noun="weight entry" />);
    expect(container.innerHTML).toBe("");
  });

  it("gives every entry in the range a delete control, the older ones under Show all", () => {
    render(<EntryList entries={entries} action={async () => ({ ok: true })} noun="weight entry" />);
    expect(screen.getByText("Show all 11 entries in this period")).toBeTruthy();
    expect(screen.getAllByRole("button", { hidden: true })).toHaveLength(11);
    expect(screen.getByRole("button", { name: "Delete weight entry for 2026-10-20", hidden: true })).toBeTruthy();
  });

  it("has no Show all when everything already fits", () => {
    render(<EntryList entries={entries.slice(0, 8)} action={async () => ({ ok: true })} noun="measurements" />);
    expect(screen.queryByText(/Show all/)).toBeNull();
  });
});
