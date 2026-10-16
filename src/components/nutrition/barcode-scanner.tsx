"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Flashlight, FlashlightOff, Keyboard, Loader2, ScanBarcode } from "lucide-react";
import type { DecodeHintType as DecodeHint } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { barcodeInputError, barcodeLookupCandidates, cleanBarcodeInput, type RetailBarcodeFormat } from "@/lib/barcode";
import { hapticSuccess, isNativeApp } from "@/lib/native";
import { nutritionForAmount, OFF_ATTRIBUTION, type BarcodeLookup, type BarcodeProduct, type NutritionValues } from "@/lib/open-food-facts";

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

export interface BarcodeLogItem {
  source: "barcode";
  code: string;
  format?: RetailBarcodeFormat;
  unit: "serving" | "g";
  quantity: number;
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

function Values({ v, label }: { v: NutritionValues; label: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{label}:</span> {v.calories} kcal · P {v.protein_g}g · C {v.carbs_g}g · F {v.fat_g}g
      {v.fiber_g != null ? ` · fiber ${v.fiber_g}g` : ""}
    </p>
  );
}

export function BarcodeScanner({
  pending,
  onLog,
  onEnterManually,
}: {
  pending: boolean;
  onLog: (item: BarcodeLogItem) => void;
  /** Switch to manual entry, optionally prefilling the food name. */
  onEnterManually: (name?: string) => void;
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
  const [unit, setUnit] = useState<"serving" | "g">("serving");
  const [quantity, setQuantity] = useState("1");

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
                ? "Barcode scanning is part of nutrition tracking on Plus and Pro."
                : json.error === "unauthorized"
                  ? "Your session expired — sign in again."
                  : "Open Food Facts isn't responding right now. Try again in a moment.";
        setLookup({ kind: "error", code, message });
        return;
      }
      const result = json as BarcodeLookup;
      if (result.status === "found") {
        setUnit(result.product.perServing ? "serving" : "g");
        setQuantity(result.product.perServing ? "1" : "100");
      }
      setLookup({ kind: "done", code, format, result });
    } catch {
      setLookup({ kind: "error", code, message: "Lookup failed. Check your connection and try again." });
    }
  }, []);

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
  const qty = Number(quantity);
  const preview = product && qty > 0 ? nutritionForAmount(product, unit === "g" ? { grams: qty } : { servings: qty }) : null;

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
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">Point your camera at the barcode (EAN or UPC). Nutrition comes from Open Food Facts, a community database.</p>
          <Button type="button" className="mt-4" onClick={() => void startCamera()}>
            <Camera aria-hidden /> Start camera
          </Button>
        </div>
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
          <div>
            <p className="text-sm font-semibold">{product.name}</p>
            <p className="text-xs text-muted-foreground">
              {[product.brand, product.quantity].filter(Boolean).join(" · ")}
              {product.servingLabel ? `${product.brand || product.quantity ? " · " : ""}serving ${product.servingLabel}` : ""}
            </p>
          </div>
          {product.per100 && <Values v={product.per100} label={`Per 100 ${product.unit}`} />}
          {product.perServing && <Values v={product.perServing} label={`Per serving${product.servingQuantity ? ` (${product.servingQuantity} ${product.unit})` : ""}`} />}
          {product.missing.length > 0 && <p className="text-xs text-gold">Not listed: {product.missing.join(", ")} (counted as 0).</p>}
          <p className="text-[11px] text-gold">{OFF_ATTRIBUTION}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="bc-qty" className="text-xs">
                Amount
              </Label>
              <Input id="bc-qty" type="number" inputMode="decimal" min="0" step={unit === "g" ? "1" : "0.25"} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-10 w-24" />
            </div>
            <div className="flex h-10 overflow-hidden rounded-xl border border-border text-sm" role="group" aria-label="Unit">
              {product.perServing && (
                <button type="button" aria-pressed={unit === "serving"} onClick={() => { setUnit("serving"); setQuantity("1"); }} className={`px-3 ${unit === "serving" ? "bg-gold/15 text-gold-highlight" : "text-muted-foreground"}`}>
                  servings
                </button>
              )}
              {product.per100 && (
                <button type="button" aria-pressed={unit === "g"} onClick={() => { setUnit("g"); setQuantity(product.servingQuantity ? String(product.servingQuantity) : "100"); }} className={`px-3 ${unit === "g" ? "bg-gold/15 text-gold-highlight" : "text-muted-foreground"}`}>
                  {product.unit}
                </button>
              )}
            </div>
            <Button
              type="button"
              className="ml-auto"
              disabled={pending || !(qty > 0) || !preview}
              onClick={() => onLog({ source: "barcode", code: lookup.code, format: lookup.format, unit, quantity: qty })}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />} Add
            </Button>
          </div>
          {preview && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              ≈ {preview.calories} kcal · P {preview.protein_g}g · C {preview.carbs_g}g · F {preview.fat_g}g
            </p>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={reset}>
            Scan another
          </Button>
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
