import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Account switching on one phone: the RevenueCat SDK must always act for the member who is signed in now, so a
 * purchase or a Restore is attributed to that account (the server then reads what that account owns from
 * RevenueCat). If the device kept the previous member's purchase identity, the next member could restore or buy
 * under the wrong account.
 */
const state = { configured: false, currentId: "" };
const plugin = {
  isConfigured: vi.fn(async () => ({ isConfigured: state.configured })),
  configure: vi.fn(async ({ appUserID }: { apiKey: string; appUserID: string }) => {
    state.configured = true;
    state.currentId = appUserID;
  }),
  getAppUserID: vi.fn(async () => ({ appUserID: state.currentId })),
  logIn: vi.fn(async ({ appUserID }: { appUserID: string }) => {
    state.currentId = appUserID;
    return { customerInfo: {}, created: false };
  }),
  restorePurchases: vi.fn(async () => ({ customerInfo: {} })),
};
vi.mock("@revenuecat/purchases-capacitor", () => ({ Purchases: plugin }));
const native = { value: true };
vi.mock("@/lib/native", () => ({ isNativeApp: () => native.value }));

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  vi.clearAllMocks();
  state.configured = false;
  state.currentId = "";
  native.value = true;
});

describe("RevenueCat identity follows the signed-in member", () => {
  it("first use configures the SDK with the member's own id", async () => {
    const { connectStore } = await import("@/lib/billing/store-purchases");
    expect(await connectStore("appl_key", ALICE)).not.toBeNull();
    expect(plugin.configure).toHaveBeenCalledWith({ apiKey: "appl_key", appUserID: ALICE });
    expect(plugin.logIn).not.toHaveBeenCalled();
  });

  it("a different member on the same device switches the identity before anything else, so Restore runs as them", async () => {
    const { connectStore } = await import("@/lib/billing/store-purchases");
    await connectStore("appl_key", ALICE);
    const store = await connectStore("appl_key", BOB);
    expect(plugin.logIn).toHaveBeenCalledTimes(1);
    expect(plugin.logIn).toHaveBeenCalledWith({ appUserID: BOB });
    expect(state.currentId).toBe(BOB);
    // Restore happens only after the switch.
    await store!.restore();
    expect(plugin.restorePurchases).toHaveBeenCalledTimes(1);
    expect(plugin.logIn.mock.invocationCallOrder[0]!).toBeLessThan(plugin.restorePurchases.mock.invocationCallOrder[0]!);
  });

  it("the same member again does not log in again", async () => {
    const { connectStore } = await import("@/lib/billing/store-purchases");
    await connectStore("appl_key", ALICE);
    await connectStore("appl_key", ALICE);
    expect(plugin.logIn).not.toHaveBeenCalled();
  });

  it("if the switch fails, no store client is returned (nothing can be bought or restored under the old identity)", async () => {
    const { connectStore } = await import("@/lib/billing/store-purchases");
    await connectStore("appl_key", ALICE);
    plugin.logIn.mockImplementationOnce(async () => {
      throw new Error("network");
    });
    expect(await connectStore("appl_key", BOB)).toBeNull();
  });

  it("in a browser, or without a key, the store is never touched", async () => {
    const { connectStore } = await import("@/lib/billing/store-purchases");
    native.value = false;
    expect(await connectStore("appl_key", ALICE)).toBeNull();
    native.value = true;
    expect(await connectStore("", ALICE)).toBeNull();
    expect(plugin.configure).not.toHaveBeenCalled();
  });
});
