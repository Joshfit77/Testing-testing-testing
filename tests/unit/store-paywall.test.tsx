import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
  productIds: { plus: { month: [], year: [] }, pro: { month: ["ngf_pro_monthly"], year: ["ngf_pro_yearly"] } },
  yearly: { plus: false, pro: false },
  plans: {
    plus: { name: "Plus", tagline: "Toolkit", highlights: ["Full program library"] },
    pro: { name: "Pro", tagline: "Everything", highlights: ["AI coach"] },
  },
  legal: { termsUrl: "/legal/terms", privacyUrl: "/legal/privacy", final: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  connectStore.mockResolvedValue(store);
  store.packages.mockResolvedValue([pkg("ngf_pro_monthly", "$19.99"), pkg("ngf_pro_yearly", "$149.99"), pkg("ngf_plus_monthly", "$9.99")]);
  store.purchase.mockResolvedValue(undefined);
  store.restore.mockResolvedValue(undefined);
});

describe("in-app paywall", () => {
  it("shows the store's Pro price, renewal terms, Terms/Privacy and Restore; hides yearly until switched on", async () => {
    render(<StorePaywall {...props} />);
    expect(await screen.findByText("$19.99")).toBeInTheDocument();
    expect(screen.queryByText("$149.99")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subscribe to Pro monthly" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Restore purchases" })).toBeEnabled();
    expect(screen.getByText(/renew automatically at the price shown/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/legal/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/legal/privacy");
    expect(screen.getByText(/drafts awaiting legal review/)).toBeInTheDocument();
    expect(connectStore).toHaveBeenCalledWith("appl_test", props.userId);
  });

  it("never offers the legacy Plus plan, even if a store product exists for it", async () => {
    render(<StorePaywall {...props} productIds={{ ...props.productIds, plus: { month: ["ngf_plus_monthly"], year: [] } }} />);
    await screen.findByText("$19.99");
    expect(screen.queryByText("$9.99")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Plus/ })).not.toBeInTheDocument();
  });

  it("shows yearly when it's switched on", async () => {
    render(<StorePaywall {...props} yearly={{ plus: false, pro: true }} />);
    expect(await screen.findByText("$149.99")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subscribe to Pro yearly" })).toBeInTheDocument();
  });

  it("buys, then asks the server for the plan", async () => {
    sync.mockResolvedValue({ ok: true, plan: "pro" });
    render(<StorePaywall {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Subscribe to Pro monthly" }));
    expect(await screen.findByText("You're on Pro. Thank you!")).toBeInTheDocument();
    expect(store.purchase).toHaveBeenCalledWith(expect.objectContaining({ identifier: "ngf_pro_monthly" }), { oldProductId: undefined });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
  });

  it("doesn't claim success unless the server confirms the plan", async () => {
    sync.mockResolvedValue({ ok: true, plan: "free" });
    render(<StorePaywall {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Subscribe to Pro monthly" }));
    expect(await screen.findByText(/Purchase received. Your plan will update in a moment/)).toBeInTheDocument();
    expect(screen.queryByText(/Thank you/)).not.toBeInTheDocument();
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

  it("shows a Pro member billed by the App Store as current, with Manage subscription", async () => {
    render(<StorePaywall {...props} currentPlan="pro" source="app_store" currentProductId="ngf_pro_monthly" />);
    expect(await screen.findByText("Current")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Subscribe|Upgrade/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage subscription" })).toBeInTheDocument();
  });

  it("doesn't sell a second subscription to someone billed on the website (including legacy Plus)", async () => {
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
