import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Signing out on a shared phone must detach the device from the member's App Store purchase identity (RevenueCat),
 * so the next person starts from their own account. What anyone owns is still decided only on the server.
 */
const plugin = {
  isConfigured: vi.fn(async () => ({ isConfigured: true })),
  isAnonymous: vi.fn(async () => ({ isAnonymous: false })),
  logOut: vi.fn(async () => ({})),
};
vi.mock("@revenuecat/purchases-capacitor", () => ({ Purchases: plugin }));
const native = { value: true };
vi.mock("@/lib/native", () => ({ isNativeApp: () => native.value }));

afterEach(() => {
  vi.clearAllMocks();
  native.value = true;
  plugin.isConfigured.mockImplementation(async () => ({ isConfigured: true }));
  plugin.isAnonymous.mockImplementation(async () => ({ isAnonymous: false }));
});

describe("RevenueCat sign-out", () => {
  it("logs the device out of the member's purchase identity", async () => {
    const { storeLogOut } = await import("@/lib/billing/store-purchases");
    await storeLogOut();
    expect(plugin.logOut).toHaveBeenCalledTimes(1);
  });

  it("does nothing in a browser, before the SDK is configured, or for an anonymous id, and never throws", async () => {
    const { storeLogOut } = await import("@/lib/billing/store-purchases");
    native.value = false;
    await storeLogOut();
    native.value = true;
    plugin.isConfigured.mockImplementation(async () => ({ isConfigured: false }));
    await storeLogOut();
    plugin.isConfigured.mockImplementation(async () => ({ isConfigured: true }));
    plugin.isAnonymous.mockImplementation(async () => ({ isAnonymous: true }));
    await storeLogOut();
    expect(plugin.logOut).not.toHaveBeenCalled();
    plugin.isAnonymous.mockImplementation(async () => {
      throw new Error("plugin missing");
    });
    await expect(storeLogOut()).resolves.toBeUndefined();
  });

  it("is part of the one sign-out form used everywhere", async () => {
    const { SignOutForm } = await import("@/components/shell/sign-out-form");
    const { getByRole } = render(
      <SignOutForm action={async () => {}} userId="00000000-0000-4000-8000-000000000001">
        <button type="submit">Sign out</button>
      </SignOutForm>,
    );
    fireEvent.submit(getByRole("button").closest("form")!);
    await vi.waitFor(() => expect(plugin.logOut).toHaveBeenCalledTimes(1));
  });
});
