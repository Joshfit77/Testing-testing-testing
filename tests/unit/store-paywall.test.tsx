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

const { membershipComparison } = await import("@/lib/domain/membership");

const pkg = (id: string, price: string, extra: Partial<PaywallPackage["product"]> = {}): PaywallPackage => ({ identifier: id, product: { identifier: id, priceString: price, ...extra } });
const props: StorePaywallProps = {
  userId: "3f1c6a52-1b2c-4d3e-8f90-123456789abc",
  platform: "ios",
  apiKey: "appl_test",
  currentPlan: "free",
  source: "default",
  currentProductId: null,
  currentInterval: null,
  productIds: { plus: { month: ["ngf_plus_monthly"], year: ["ngf_plus_yearly"] }, pro: { month: ["ngf_pro_monthly"], year: ["ngf_pro_yearly"] } },
  comparison: membershipComparison(),
  legal: { termsUrl: "/legal/terms", privacyUrl: "/legal/privacy", final: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  connectStore.mockResolvedValue(store);
  store.packages.mockResolvedValue([
    pkg("ngf_plus_monthly", "$11.99"),
    pkg("ngf_pro_monthly", "$19.99", { price: 19.99, currencyCode: "USD" }),
    pkg("ngf_pro_yearly", "$149.99", { price: 149.99, currencyCode: "USD", pricePerMonthString: "$12.49" }),
  ]);
  store.purchase.mockResolvedValue(undefined);
  store.restore.mockResolvedValue(undefined);
});

describe("in-app membership screen", () => {
  it("shows only Free and Pro All Access with the store's prices, terms, Terms/Privacy and Restore", async () => {
    render(<StorePaywall {...props} />);
    expect(await screen.findByRole("button", { name: "Start Pro All Access · $19.99 / month" })).toBeEnabled();
    expect(screen.getByTestId("plan-free")).toHaveTextContent("$0");
    expect(screen.getByTestId("pro-price")).toHaveTextContent("$19.99 / month");
    expect(screen.queryByText("$11.99")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Plus$/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore purchases" })).toBeEnabled();
    expect(screen.getByText(/renews automatically at the price shown/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/legal/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/legal/privacy");
    expect(screen.getByText(/drafts awaiting legal review/)).toBeInTheDocument();
    expect(connectStore).toHaveBeenCalledWith("appl_test", props.userId);
  });

  it("switches to yearly with the per-month equivalent and the saving", async () => {
    render(<StorePaywall {...props} />);
    fireEvent.click(await screen.findByRole("radio", { name: /Yearly/ }));
    expect(screen.getByRole("radio", { name: /Save 37%/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("pro-price")).toHaveTextContent("$149.99 / year");
    expect(screen.getByText("About $12.49 a month, billed yearly.")).toBeInTheDocument();
    sync.mockResolvedValue({ ok: true, plan: "pro" });
    fireEvent.click(screen.getByRole("button", { name: "Start Pro All Access · $149.99 / year" }));
    await waitFor(() => expect(store.purchase).toHaveBeenCalledWith(expect.objectContaining({ identifier: "ngf_pro_yearly" }), { oldProductId: undefined }));
  });

  it("buys, then asks the server for the membership", async () => {
    sync.mockResolvedValue({ ok: true, plan: "pro" });
    render(<StorePaywall {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start Pro All Access · $19.99 / month" }));
    expect(await screen.findByText("Welcome to Pro All Access. Thank you!")).toBeInTheDocument();
    expect(store.purchase).toHaveBeenCalledWith(expect.objectContaining({ identifier: "ngf_pro_monthly" }), { oldProductId: undefined });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
  });

  it("never claims success when the server hasn't confirmed the purchase", async () => {
    sync.mockResolvedValue({ ok: true, plan: "free" });
    render(<StorePaywall {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start Pro All Access · $19.99 / month" }));
    expect(await screen.findByText(/Purchase received. Your membership will update in a moment/)).toBeInTheDocument();
    expect(screen.queryByText(/Welcome to Pro/)).not.toBeInTheDocument();
  });

  it("says plainly when a purchase is cancelled or pending", async () => {
    store.purchase.mockRejectedValueOnce({ code: "1", userCancelled: true });
    render(<StorePaywall {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start Pro All Access · $19.99 / month" }));
    expect(await screen.findByText("Purchase cancelled. You haven't been charged.")).toBeInTheDocument();
    expect(sync).not.toHaveBeenCalled();
    store.purchase.mockRejectedValueOnce({ code: "20" });
    fireEvent.click(screen.getByRole("button", { name: "Start Pro All Access · $19.99 / month" }));
    expect(await screen.findByText(/waiting for approval/)).toBeInTheDocument();
  });

  it("restores purchases and reports what was found", async () => {
    sync.mockResolvedValueOnce({ ok: true, plan: "free" }).mockResolvedValueOnce({ ok: true, plan: "pro" });
    render(<StorePaywall {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Restore purchases" }));
    expect(await screen.findByText("No active memberships were found for your App Store account.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore purchases" }));
    expect(await screen.findByText("Purchases restored. You're on Pro All Access.")).toBeInTheDocument();
    expect(store.restore).toHaveBeenCalledTimes(2);
  });

  it("upgrades a legacy Plus subscription, naming the old product for Google Play, and offers manage", async () => {
    sync.mockResolvedValue({ ok: true, plan: "pro" });
    store.packages.mockResolvedValue([pkg("ngf_plus:monthly", "$11.99"), pkg("ngf_pro:monthly", "$19.99")]);
    const ids = { plus: { month: ["ngf_plus"], year: [] }, pro: { month: ["ngf_pro"], year: [] } };
    render(<StorePaywall {...props} platform="android" currentPlan="plus" source="play_store" currentProductId="ngf_plus:monthly" currentInterval="month" productIds={ids} />);
    fireEvent.click(await screen.findByRole("button", { name: "Upgrade to Pro All Access · $19.99 / month" }));
    await waitFor(() => expect(store.purchase).toHaveBeenCalledWith(expect.objectContaining({ identifier: "ngf_pro:monthly" }), { oldProductId: "ngf_plus:monthly" }));
    expect(screen.getByRole("button", { name: "Manage subscription" })).toBeInTheDocument();
  });

  it("lets a monthly Pro member switch to yearly through the same store subscription", async () => {
    render(<StorePaywall {...props} currentPlan="pro" source="app_store" currentProductId="ngf_pro_monthly" currentInterval="month" />);
    expect(await screen.findByText("This is your current membership.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Yearly/ }));
    fireEvent.click(screen.getByRole("button", { name: "Switch to yearly · $149.99" }));
    await waitFor(() => expect(store.purchase).toHaveBeenCalledWith(expect.objectContaining({ identifier: "ngf_pro_yearly" }), { oldProductId: "ngf_pro_monthly" }));
  });

  it("doesn't sell a second subscription to someone billed on the website", async () => {
    render(<StorePaywall {...props} currentPlan="pro" source="stripe" />);
    expect(await screen.findByText(/purchased outside the App Store/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start|Upgrade|Switch/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore purchases" })).toBeInTheDocument();
  });

  it("falls back to a notice when the store isn't available", async () => {
    connectStore.mockResolvedValue(null);
    render(<StorePaywall {...props} />);
    expect(await screen.findByText(/In-app purchases aren't available right now/)).toBeInTheDocument();
  });
});
