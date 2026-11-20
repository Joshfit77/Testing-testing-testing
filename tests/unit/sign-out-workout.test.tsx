import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDraft } from "@/lib/domain/workout-draft";
import { localDraftKey, rememberDiscard, saveLocalDraft } from "@/lib/workout-storage";

const sync = vi.fn();
const confirm = vi.fn();
vi.mock("@/server/actions/workouts", () => ({ syncWorkoutDraftAction: (...a: unknown[]) => sync(...a) }));
vi.mock("@/components/ui/confirm", () => ({ confirmDialog: (...a: unknown[]) => confirm(...a) }));
vi.mock("@/lib/billing/store-purchases", () => ({ storeLogOut: vi.fn(async () => undefined) }));
vi.mock("@/lib/native-notifications", () => ({ clearDeviceNotifications: vi.fn(async () => undefined) }));

const { SignOutForm, workoutSafeToClear } = await import("@/components/shell/sign-out-form");

const USER = "u1";
const draft = createDraft({ name: "Push day", now: "2026-11-20T09:00:00.000Z", clientId: "c-1" });
const setOnline = (v: boolean) => Object.defineProperty(navigator, "onLine", { value: v, configurable: true });

beforeEach(() => {
  localStorage.clear();
  sync.mockReset();
  confirm.mockReset();
  setOnline(true);
});
afterEach(() => setOnline(true));

/**
 * Signing out clears the device for the next person. It used to delete a workout in progress whose latest sets had
 * not reached the server (logged offline, or just before signing out): now the latest copy is saved to the account
 * first, and when that can't happen the member is asked before anything is deleted.
 */
describe("signing out with a workout in progress", () => {
  it("with no workout in progress, signs out without asking or calling the server", async () => {
    await expect(workoutSafeToClear(USER)).resolves.toBe(true);
    expect(sync).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("saves the latest copy to the account first, then signs out without asking", async () => {
    saveLocalDraft(USER, draft);
    sync.mockResolvedValue({ ok: true, data: null });
    await expect(workoutSafeToClear(USER)).resolves.toBe(true);
    expect(sync).toHaveBeenCalledTimes(1);
    expect((sync.mock.calls[0]![0] as { clientId: string }).clientId).toBe("c-1");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("when the server refuses or can't be reached, asks before deleting; staying signed in keeps the workout", async () => {
    saveLocalDraft(USER, draft);
    sync.mockResolvedValue({ ok: false, error: "x" });
    confirm.mockResolvedValue(false);
    await expect(workoutSafeToClear(USER)).resolves.toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect((confirm.mock.calls[0]![0] as { destructive: boolean }).destructive).toBe(true);
    sync.mockRejectedValue(new Error("network"));
    await expect(workoutSafeToClear(USER)).resolves.toBe(false);
  });

  it("offline, it doesn't try the server and asks", async () => {
    saveLocalDraft(USER, draft);
    setOnline(false);
    confirm.mockResolvedValue(true);
    await expect(workoutSafeToClear(USER)).resolves.toBe(true);
    expect(sync).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("a workout the member already discarded doesn't hold up signing out", async () => {
    saveLocalDraft(USER, draft);
    rememberDiscard(USER, "c-1");
    await expect(workoutSafeToClear(USER)).resolves.toBe(true);
    expect(sync).not.toHaveBeenCalled();
  });

  it("the form: choosing to stay signed in keeps the workout on the device and doesn't sign out", async () => {
    saveLocalDraft(USER, draft);
    setOnline(false);
    confirm.mockResolvedValue(false);
    const action = vi.fn(async () => undefined);
    const { getByRole } = render(
      <SignOutForm action={action} userId={USER}>
        <button type="submit">Sign out</button>
      </SignOutForm>,
    );
    fireEvent.click(getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(localStorage.getItem(localDraftKey(USER))).not.toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("the form: once the account has the workout, the device is cleared for the next person", async () => {
    saveLocalDraft(USER, draft);
    sync.mockResolvedValue({ ok: true, data: null });
    const action = vi.fn(async () => undefined);
    const { getByRole } = render(
      <SignOutForm action={action} userId={USER}>
        <button type="submit">Sign out</button>
      </SignOutForm>,
    );
    fireEvent.click(getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(localStorage.getItem(localDraftKey(USER))).toBeNull());
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });

  it("the form: with no workout in progress, signs out straight away", async () => {
    const action = vi.fn(async () => undefined);
    const { getByRole } = render(
      <SignOutForm action={action} userId={USER}>
        <button type="submit">Sign out</button>
      </SignOutForm>,
    );
    fireEvent.click(getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });
});
