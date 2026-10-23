"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Flashlight, FlashlightOff, Keyboard, Loader2, ScanBarcode } from "lucide-react";
import type { DecodeHintType as DecodeHint } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { barcodeInputError, barcodeLookupCandidates, cleanBarcodeInput, type RetailBarcodeFormat } from "@/lib/barcode";
import type { FoodChoice } from "@/lib/domain/food-basis";
import { hapticSuccess, isNativeApp, nativeBarcodeScannerAvailable, scanBarcodeNative } from "@/lib/native";
import { basisFromOffProduct, OFF_ATTRIBUTION, type BarcodeLookup, type BarcodeProduct } from "@/lib/open-food-facts";

type CameraState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "scanning"; torch: boolean | null }
  | { kind: "error"; message: string };

type LookupState =
  | { kind: "none" }
  | { kind: "loading"; code: string }
  | { kind: "done"; code: string; format?: RetailBarcodeFormat; result: BarcodeLookup }
  | { kind: "error"; code: string; message: string };

interface ScanControls {
  stop: () => void | Promise<void>;
  switchTorch?: (on: boolean) => Promise<void>;
}

function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return isNativeApp()
      ? "Camera access is turned off for Narrow Gate. Allow it in your phone's Settings for this app, then try again."
      : "Camera permission was denied. Allow camera access for this site in your browser settings, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "No camera was found on this device.";
  if (name === "NotReadableError" || name === "TrackStartError") return "The camera is busy — close other apps using it and try again.";
  if (name === "AbortError") return "The camera couldn't start. Try again.";
  return "The camera couldn't start on this device.";
}

const FORMAT_MAP: Record<string, RetailBarcodeFormat> = { EAN_13: "ean13", UPC_A: "upca", UPC_E: "upce", EAN_8: "ean8" };

/** The amount-step choice for a found product: label serving first, then g/oz (or ml/fl oz). */
export function offChoice(product: BarcodeProduct, format?: RetailBarcodeFormat): FoodChoice {
  const missing = product.missing.length ? ` Not listed on this product: ${product.missing.join(", ")} (counted as 0).` : "";
  return {
    key: `off:${product.code}`,
    kind: "off",
    ref: product.code,
    format,
    name: product.name,
    detail: [product.brand, product.quantity, `barcode ${product.code}`].filter(Boolean).join(" · "),
    basis: basisFromOffProduct(product),
    note: `${OFF_ATTRIBUTION}.${missing}`,
  };
}

export function BarcodeScanner({
  onFound,
  onEnterManually,
  onCode,
}: {
  /** A product with nutrition was found: open the amount step for it. */
  onFound: (choice: FoodChoice) => void;
  /** Switch to manual entry, optionally prefilling the food name. */
  onEnterManually: (name?: string) => void;
  /** When set, every scanned or typed code goes here instead of the nutrition lookup (the Food Quality Scanner). */
  onCode?: (code: string, format?: RetailBarcodeFormat) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScanControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef(0);
  const [camera, setCamera] = useState<CameraState>({ kind: "idle" });
  const [lookup, setLookup] = useState<LookupState>({ kind: "none" });
  const [showTyped, setShowTyped] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);
  const [native, setNative] = useState(false);
  const [nativeMessage, setNativeMessage] = useState<string | null>(null);
  const [nativeBusy, setNativeBusy] = useState(false);

  // In the iPhone / Android app, use the system barcode scanner when the plugin is installed.
  useEffect(() => {
    setNative(isNativeApp() && nativeBarcodeScannerAvailable());
  }, []);

  const stopCamera = useCallback(() => {
    sessionRef.current += 1; // invalidates any start that's still in flight
    const controls = controlsRef.current;
    controlsRef.current = null;
    if (controls) void Promise.resolve(controls.stop()).catch(() => {});
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Release the camera whenever this component unmounts (dialog closed or tab changed).
  useEffect(() => stopCamera, [stopCamera]);

  const runLookup = useCallback(async (code: string, format?: RetailBarcodeFormat) => {
    if (onCode) {
      setLookup({ kind: "loading", code });
      onCode(code, format);
      return;
    }
    setLookup({ kind: "loading", code });
    try {
      const params = new URLSearchParams({ code });
      if (format) params.set("format", format);
      const res = await fetch(`/api/foods/barcode?${params}`);
      const json = (await res.json().catch(() => ({}))) as Partial<BarcodeLookup> & { error?: string };
      if (!res.ok) {
        const message =
          json.error === "rate_limited"
            ? "Too many lookups — wait a moment and try again."
            : json.error === "invalid_code"
              ? "That isn't a valid product barcode."
              : json.error === "upgrade_required"
                ? "Barcode scanning isn't available on your account right now."
                : json.error === "unauthorized"
                  ? "Your session expired — sign in again."
                  : "Open Food Facts isn't responding right now. Try again in a moment.";
        setLookup({ kind: "error", code, message });
        return;
      }
      const result = json as BarcodeLookup;
      setLookup({ kind: "done", code, format, result });
      if (result.status === "found") onFound(offChoice(result.product, format));
    } catch {
      setLookup({
        kind: "error",
        code,
        message: typeof navigator !== "undefined" && navigator.onLine === false ? "You're offline. Connect to the internet to look up products." : "Lookup failed. Check your connection and try again.",
      });
    }
  }, [onFound, onCode]);

  const startNative = async () => {
    setNativeMessage(null);
    setLookup({ kind: "none" });
    setNativeBusy(true);
    const res = await scanBarcodeNative();
    setNativeBusy(false);
    if (res.kind === "scanned") {
      const err = barcodeInputError(res.code);
      if (err) {
        setNativeMessage(`That code (${res.code}) isn't a food product barcode (EAN or UPC). Try again or type the numbers.`);
        return;
      }
      void hapticSuccess();
      void runLookup(cleanBarcodeInput(res.code));
    } else if (res.kind === "cancelled") {
      setNativeMessage("Scan cancelled.");
    } else if (res.kind === "denied") {
      setNativeMessage("Camera access is turned off for Narrow Gate. Allow it in your phone's Settings for this app, then try again.");
    } else {
      setNativeMessage("The scanner couldn't start. Try again or type the barcode.");
    }
  };

  const startCamera = useCallback(async () => {
    setLookup({ kind: "none" });
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCamera({ kind: "error", message: "The camera only works over a secure (HTTPS) connection." });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera({ kind: "error", message: "This browser can't open the camera." });
      return;
    }
    stopCamera();
    const session = sessionRef.current;
    setCamera({ kind: "starting" });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (err) {
      if (session === sessionRef.current) setCamera({ kind: "error", message: cameraErrorMessage(err) });
      return;
    }
    if (session !== sessionRef.current || !videoRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;
    try {
      // Lazy-load the decoder only once scanning starts.
      const [{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
      if (session !== sessionRef.current) return;
      const hints = new Map<DecodeHint, unknown>([
        [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_8]],
      ]);
      const reader = new BrowserMultiFormatOneDReader(hints, { delayBetweenScanAttempts: 150, delayBetweenScanSuccess: 300 });
      let last = "";
      const controls = await reader.decodeFromStream(stream, videoRef.current, (result) => {
        if (!result || session !== sessionRef.current) return;
        const text = result.getText();
        const format = FORMAT_MAP[BarcodeFormat[result.getBarcodeFormat()] ?? ""];
        if (!barcodeLookupCandidates(text, format)) return;
        // Require two identical consecutive reads to avoid acting on a misread.
        if (text !== last) {
          last = text;
          return;
        }
        stopCamera();
        setCamera({ kind: "idle" });
        void hapticSuccess();
        void runLookup(text, format);
      });
      if (session !== sessionRef.current) {
        void Promise.resolve(controls.stop()).catch(() => {});
        return;
      }
      controlsRef.current = controls;
      setCamera({ kind: "scanning", torch: controls.switchTorch ? false : null });
    } catch {
      stopCamera();
      setCamera({ kind: "error", message: "The barcode scanner couldn't start. Type the barcode instead." });
    }
  }, [runLookup, stopCamera]);

  const toggleTorch = async () => {
    if (camera.kind !== "scanning" || camera.torch == null || !controlsRef.current?.switchTorch) return;
    try {
      await controlsRef.current.switchTorch(!camera.torch);
      setCamera({ kind: "scanning", torch: !camera.torch });
    } catch {
      setCamera({ kind: "scanning", torch: null });
    }
  };

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    const err = barcodeInputError(typed);
    setTypedError(err);
    if (err) return;
    stopCamera();
    setCamera({ kind: "idle" });
    void runLookup(cleanBarcodeInput(typed));
  };

  const reset = () => {
    setLookup({ kind: "none" });
    setTyped("");
  };

  const active = camera.kind === "starting" || camera.kind === "scanning";
  const product: BarcodeProduct | null = lookup.kind === "done" && lookup.result.status === "found" ? lookup.result.product : null;

  return (
    <div className="space-y-3">
      {/* The video element stays mounted so the stream can attach before the scanner state flips. */}
      <div className={active ? "relative overflow-hidden rounded-2xl border border-gold-muted bg-black" : "hidden"}>
        <video ref={videoRef} muted playsInline autoPlay className="aspect-[4/3] w-full object-cover" aria-label="Camera preview for barcode scanning" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <div className="relative h-1/3 w-4/5 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            <span className="absolute left-0 top-0 h-6 w-6 rounded-tl-xl border-l-4 border-t-4 border-gold" />
            <span className="absolute right-0 top-0 h-6 w-6 rounded-tr-xl border-r-4 border-t-4 border-gold" />
            <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-xl border-b-4 border-l-4 border-gold" />
            <span className="absolute bottom-0 right-0 h-6 w-6 rounded-br-xl border-b-4 border-r-4 border-gold" />
            <span className="absolute inset-x-3 top-1/2 h-px bg-gold/70" />
          </div>
        </div>
        {camera.kind === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 text-sm text-white">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Starting camera…
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-xs text-white/90" role="status">
            {camera.kind === "scanning" ? "Line the barcode up inside the frame" : ""}
          </p>
          <div className="flex gap-2">
            {camera.kind === "scanning" && camera.torch != null && (
              <Button type="button" size="sm" variant="secondary" onClick={toggleTorch} aria-pressed={camera.torch} aria-label={camera.torch ? "Turn light off" : "Turn light on"}>
                {camera.torch ? <FlashlightOff aria-hidden /> : <Flashlight aria-hidden />}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                stopCamera();
                setCamera({ kind: "idle" });
              }}
            >
              Stop
            </Button>
          </div>
        </div>
      </div>

      {!active && lookup.kind === "none" && (
        <div className="rounded-2xl border border-dashed border-border p-5 text-center">
          <ScanBarcode className="mx-auto size-10 text-gold" aria-hidden />
          <p className="mt-2 text-sm font-semibold">Scan a packaged food</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
            Point your camera at the barcode (EAN or UPC). Serving sizes and nutrition come from Open Food Facts, a community database.
          </p>
          {native ? (
            <Button type="button" className="mt-4" disabled={nativeBusy} onClick={() => void startNative()}>
              {nativeBusy ? <Loader2 className="animate-spin" aria-hidden /> : <ScanBarcode aria-hidden />} Scan barcode
            </Button>
          ) : (
            <Button type="button" className="mt-4" onClick={() => void startCamera()}>
              <Camera aria-hidden /> Start camera
            </Button>
          )}
        </div>
      )}

      {nativeMessage && (
        <p role="status" className="rounded-xl border border-border bg-elevated/50 p-3 text-sm text-muted-foreground">
          {nativeMessage}
        </p>
      )}

      {camera.kind === "error" && (
        <p role="alert" className="rounded-xl border border-[#f08a8a]/40 bg-[#f08a8a]/10 p-3 text-sm text-[#f08a8a]">
          {camera.message}
        </p>
      )}

      {lookup.kind === "loading" && (
        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Looking up {lookup.code}…
        </p>
      )}

      {lookup.kind === "error" && (
        <div className="space-y-2 rounded-xl border border-border bg-elevated/50 p-3">
          <p role="alert" className="text-sm text-[#f08a8a]">
            {lookup.message}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => void runLookup(lookup.code)}>
              Try again
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onEnterManually()}>
              Enter it manually
            </Button>
          </div>
        </div>
      )}

      {lookup.kind === "done" && lookup.result.status === "not_found" && (
        <div className="space-y-2 rounded-xl border border-border bg-elevated/50 p-3">
          <p className="text-sm">
            Barcode <span className="font-mono">{lookup.code}</span> isn&apos;t in Open Food Facts yet.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => onEnterManually()}>
              Enter it manually
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              Scan another
            </Button>
          </div>
        </div>
      )}

      {lookup.kind === "done" && lookup.result.status === "no_nutrition" && (
        <div className="space-y-2 rounded-xl border border-border bg-elevated/50 p-3">
          <p className="text-sm font-semibold">
            {lookup.result.product.name}
            {lookup.result.product.brand ? <span className="font-normal text-muted-foreground"> · {lookup.result.product.brand}</span> : null}
          </p>
          <p className="text-sm text-muted-foreground">We found the product but it has no nutrition info — enter it manually from the label.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => lookup.result.status === "no_nutrition" && onEnterManually(lookup.result.product.name)}>
              Enter it manually
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              Scan another
            </Button>
          </div>
        </div>
      )}

      {product && lookup.kind === "done" && (
        <div className="space-y-2 rounded-xl border border-border bg-elevated/50 p-3">
          <p className="text-sm">
            Found <span className="font-semibold">{product.name}</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => onFound(offChoice(product, lookup.format))}>
              Choose amount
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              Scan another
            </Button>
          </div>
        </div>
      )}

      {!active && (
        <div>
          {!showTyped ? (
            <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm text-gold-highlight hover:underline" onClick={() => setShowTyped(true)}>
              <Keyboard className="size-4" aria-hidden /> Type the barcode instead
            </button>
          ) : (
            <form onSubmit={submitTyped} className="space-y-1" noValidate>
              <Label htmlFor="bc-typed">Barcode number</Label>
              <div className="flex gap-2">
                <Input
                  id="bc-typed"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={16}
                  placeholder="e.g. 3017620422003"
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    setTypedError(null);
                  }}
                  aria-invalid={Boolean(typedError)}
                  aria-describedby={typedError ? "bc-typed-error" : undefined}
                />
                <Button type="submit" variant="secondary" disabled={lookup.kind === "loading"}>
                  Look up
                </Button>
              </div>
              {typedError && (
                <p id="bc-typed-error" className="text-xs text-[#f08a8a]">
                  {typedError}
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
