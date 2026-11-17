import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reliability closure (2026-11-17, docs/launch-readiness/04_RELIABILITY_CLOSURE.md): a refused or missing camera never
 * leaves the member stuck. Each camera screen says what happened and keeps a way to go on without the camera.
 * The real permission prompts (iOS, Android, the system scanner) are on the physical-device list; the browser path of
 * the barcode scanner is also run end to end in e2e/reliability-closure.spec.ts.
 */
const native = { app: false, scan: vi.fn() };
vi.mock("@/lib/native", () => ({
  isNativeApp: () => native.app,
  nativeBarcodeScannerAvailable: () => native.app,
  scanBarcodeNative: () => native.scan(),
  hapticSuccess: vi.fn(async () => undefined),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ getBrowserSupabase: () => ({}) }));
vi.mock("@/server/actions/body-scan", () => ({ saveBodyScanAction: vi.fn() }));

const { BarcodeScanner } = await import("@/components/nutrition/barcode-scanner");
const { ScanCapture } = await import("@/components/body-scan/scan-capture");

const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
function cameraFails(name: string) {
  const getUserMedia = vi.fn(async () => {
    throw Object.assign(new Error(name), { name });
  });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  return getUserMedia;
}

beforeEach(() => {
  native.app = false;
  native.scan.mockReset();
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("barcode scanner without the camera", () => {
  it.each([
    ["NotAllowedError", /Camera permission was denied\. Allow camera access for this site/],
    ["NotFoundError", /No camera was found on this device/],
    ["NotReadableError", /The camera is busy/],
  ])("browser, %s: says why, and typing the barcode still looks the product up", async (name, message) => {
    const getUserMedia = cameraFails(name);
    const onCode = vi.fn();
    render(<BarcodeScanner onFound={vi.fn()} onEnterManually={vi.fn()} onCode={onCode} />);
    fireEvent.click(screen.getByRole("button", { name: /Start camera/ }));
    await settle();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    // The camera is not left half-open: the start button and the typed path are both offered again.
    expect(screen.getByRole("button", { name: /Start camera/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Type the barcode instead" }));
    fireEvent.change(screen.getByLabelText("Barcode number"), { target: { value: "0012345678905" } });
    fireEvent.click(screen.getByRole("button", { name: "Look up" }));
    expect(onCode).toHaveBeenCalledWith("0012345678905", undefined);
  });

  it("phone app, camera refused for the system scanner: points to Settings and keeps the typed path", async () => {
    native.app = true;
    native.scan.mockResolvedValue({ kind: "denied" });
    const onCode = vi.fn();
    render(<BarcodeScanner onFound={vi.fn()} onEnterManually={vi.fn()} onCode={onCode} />);
    fireEvent.click(screen.getByRole("button", { name: /Scan barcode/ }));
    await settle();
    expect(screen.getByText(/Camera access is turned off for Narrow Gate\. Allow it in your phone's Settings/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Type the barcode instead" }));
    fireEvent.change(screen.getByLabelText("Barcode number"), { target: { value: "0012345678905" } });
    fireEvent.click(screen.getByRole("button", { name: "Look up" }));
    expect(onCode).toHaveBeenCalledWith("0012345678905", undefined);
  });

  it("phone app, scan cancelled: says so and nothing is looked up", async () => {
    native.app = true;
    native.scan.mockResolvedValue({ kind: "cancelled" });
    const onCode = vi.fn();
    render(<BarcodeScanner onFound={vi.fn()} onEnterManually={vi.fn()} onCode={onCode} />);
    fireEvent.click(screen.getByRole("button", { name: /Scan barcode/ }));
    await settle();
    expect(screen.getByText("Scan cancelled.")).toBeInTheDocument();
    expect(onCode).not.toHaveBeenCalled();
  });
});

describe("body-scan photos without the camera", () => {
  it.each([
    ["NotAllowedError", /Camera permission is off\. Allow the camera in your browser or phone settings, or upload a photo instead/],
    ["NotReadableError", /The camera couldn't start\. Upload a photo instead/],
  ])("%s: says why and offers uploading a photo for the same pose", async (name, message) => {
    cameraFails(name);
    render(<ScanCapture userId="u1" units="imperial" previous={{}} lastWeight={null} />);
    fireEvent.click(screen.getByTestId("scan-start"));
    fireEvent.click(screen.getByTestId("scan-open-camera"));
    await settle();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: /Upload a photo/ })).toBeEnabled();
    expect(screen.getByLabelText(/Upload .* photo/)).toHaveAttribute("type", "file");
    // And the camera can be asked for again (after allowing it in Settings).
    expect(screen.getByTestId("scan-open-camera")).toBeEnabled();
  });
});
