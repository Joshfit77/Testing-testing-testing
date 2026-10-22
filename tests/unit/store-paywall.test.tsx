import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type { PaywallPackage } from "@/lib/billing/paywall";
import type { StorePaywallProps } from "@/components/profile/store-paywall";

// The native store and the server are mocked: these tests cover what the paywall shows and does with their answers.
const store = {
  packages: vi.fn<() => Promise<PaywallPackage[]>>(),
  purchase: vi.fn<(pkg: PaywallPackage, opts?: { oldProductId?: string }) => Promise<void>>(),
  restore: vi.fn<() => Promise<void>>(),
  managementUrl: vi.fn<() => Promise<string | null>>(),
};
const connectStore = vi.fn();
const sync = vi.fn();
const refresh = vi.fn();
vi.mock("@/lib/billing/store-purchases", () => ({ connectStore: (...a: unknown[]) => connectStore(...a) }));
vi.mock("@/server/actions/store-billing", () => ({ syncStorePurchasesAction: () => sync() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { StorePaywall } = await import("@/components/profile/store-paywall");

const pkg = (id: string, price: string): PaywallPackage => ({ identifier: id, product: { identifier: id, priceString: price } });
const props: StorePaywallProps = {
  userId: "3f1c6a52-1b2c-4d3e-8f90-123456789abc",
  platform: "ios",
  apiKey: "appl_test",
  currentPlan: "free",
  source: "default",
  currentProductId: null,
  productIds: { plus: { month: ["ngf_plus_monthly"], year: ["ngf_plus_yearly"] }, pro: { month: ["ngf_pro_monthly"], year: ["ngf_pro_yearly"] } },
  yearly: { plus: false, pro: false },
  plans: {
    plus: { name: "Plus", tagline: "Toolkit", highlights: ["Full program library"] },
    pro: { name: "Pro", tagline: "Coaching", highlights: ["AI coach: 150 messages a month"] },
  },
  legal: { termsUrl: "/legal/terms", privacyUrl: "/legal/privacy", final: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  connectStore.mockResolvedValue(store);
  store.packages.mockResolvedValue([pkg("ngf_plus_monthly", "$11.99"), pkg("ngf_plus_yearly", "$99.99"), pkg("ngf_pro_monthly", "$24.99")]);
  store.purchase.mockResolvedValue(undefined);
  store.restore.mockResolvedValue(undefined);
});

describe("in-app paywall", () => {
  it("shows store prices, renewal terms, Terms/Privacy and Restore; hides yearly until switched on", async () => {
    render(<StorePaywall {...props} />);
    expect(await screen.findByText("$11.99")).toBeInTheDocument();
    expect(screen.getByText("$24.99")).toBeInTheDocument();
    expect(screen.queryByText("$99.99")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subscribe to Plus monthly" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Restore purchases" })).toBeEnabled();
    expect(screen.getByText(/renew automatically at the price shown/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/legal/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/legal/privacy");
    expect(screen.getByText(/drafts awaiting legal review/)).toBeInTheDocument();
    expect(connectStore).toHaveBeenCalledWith("appl_test", props.userId);
  });

  it("shows yearly when it's switched on", async () => {
    render(<StorePaywall {...props} yearly={{ plus: true, pro: true }} />);
    expect(await screen.findByText("$99.99")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subscribe to Plus yearly" })).toBeInTheDocument();
  });

  it("buys, then asks the server for the plan", async () => {
    sync.mockResolvedValue({ ok: true, plan: "plus" });
    render(<StorePaywall {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Subscribe to Plus monthly" }));
    expect(await screen.findByText("You're on Plus. Thank you!")).toBeInTheDocument();
    expect(store.purchase).toHaveBeenCalledWith(expect.objectContaining({ identifier: "ngf_plus_monthly" }), { oldProductId: undefined });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
  });

  it("says plainly when a purchase is cancelled or pending", async () => {
    store.purchase.mockRejectedValueOnce({ code: "1", userCancelled: true });
    render(<StorePaywall {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Subscribe to Pro monthly" }));
    expect(await screen.findByText("Purchase cancelled. You haven't been charged.")).toBeInTheDocument();
    expect(sync).not.toHaveBeenCalled();
    store.purchase.mockRejectedValueOnce({ code: "20" });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe to Pro monthly" }));
    expect(await screen.findByText(/waiting for approval/)).toBeInTheDocument();
  });

  it("restores purchases and reports what was found", async () => {
    sync.mockResolvedValueOnce({ ok: true, plan: "free" }).mockResolvedValueOnce({ ok: true, plan: "pro" });
    render(<StorePaywall {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Restore purchases" }));
    expect(await screen.findByText("No active subscriptions were found for your App Store account.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore purchases" }));
    expect(await screen.findByText("Purchases restored. You're on Pro.")).toBeInTheDocument();
    expect(store.restore).toHaveBeenCalledTimes(2);
  });

  it("offers the upgrade (naming the old product for Google Play) and manage, not a second Plus", async () => {
    sync.mockResolvedValue({ ok: true, plan: "pro" });
    store.packages.mockResolvedValue([pkg("ngf_plus:monthly", "$11.99"), pkg("ngf_pro:monthly", "$24.99")]);
    const ids = { plus: { month: ["ngf_plus"], year: [] }, pro: { month: ["ngf_pro"], year: [] } };
    render(<StorePaywall {...props} platform="android" currentPlan="plus" source="play_store" currentProductId="ngf_plus:monthly" productIds={ids} />);
    fireEvent.click(await screen.findByRole("button", { name: "Upgrade to Pro monthly" }));
    await waitFor(() => expect(store.purchase).toHaveBeenCalledWith(expect.objectContaining({ identifier: "ngf_pro:monthly" }), { oldProductId: "ngf_plus:monthly" }));
    expect(screen.queryByRole("button", { name: /Subscribe to Plus/ })).not.toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage subscription" })).toBeInTheDocument();
  });

  it("doesn't sell a second subscription to someone billed on the website", async () => {
    render(<StorePaywall {...props} currentPlan="plus" source="stripe" />);
    expect(await screen.findByText(/purchased outside the App Store/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Subscribe|Upgrade/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore purchases" })).toBeInTheDocument();
  });

  it("falls back to a notice when the store isn't available", async () => {
    connectStore.mockResolvedValue(null);
    render(<StorePaywall {...props} />);
    expect(await screen.findByText(/In-app purchases aren't available right now/)).toBeInTheDocument();
  });
});
