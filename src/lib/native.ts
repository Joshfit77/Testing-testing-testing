"use client";

/**
 * Bridge to native capabilities when running inside the Capacitor iOS/Android shells.
 * Every function is a safe no-op in a regular browser / installed PWA.
 */
type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export async function hapticSuccess(): Promise<void> {
  if (!isNativeApp()) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(30);
    return;
  }
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    /* plugin unavailable */
  }
}

const REST_NOTIFICATION_ID = 4201;

/**
 * The notification sound. On iOS a local notification without a `sound` is silent (Capacitor LocalNotifications only
 * sets one when given); a name that isn't a bundled file plays the system's default sound, per the plugin's own docs.
 * On Android 8+ the channel decides the sound (default channel: the system sound).
 */
export const NOTIFICATION_SOUND = "default";

/** Vibrate the phone: the iPhone/Android app's haptics engine (the iOS web view has no navigator.vibrate). */
export async function vibrate(pattern: number[] = [200, 100, 200]): Promise<void> {
  if (!isNativeApp()) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(pattern);
    return;
  }
  try {
    const { Haptics } = await import("@capacitor/haptics");
    await Haptics.vibrate({ duration: pattern.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) || 300 });
  } catch {
    /* plugin unavailable */
  }
}

/** True when this device can vibrate at all (the app always can; browsers only with navigator.vibrate). */
export function canVibrate(): boolean {
  return isNativeApp() || (typeof navigator !== "undefined" && "vibrate" in navigator);
}

// Each schedule/cancel bumps this, so a schedule still awaiting the plugin when Skip or Finish cancels it gives up.
let restGeneration = 0;

/** Schedule a local notification for the end of a rest period (fires even if the app is backgrounded). */
export async function scheduleRestNotification(endsAtIso: string, exerciseName?: string): Promise<void> {
  if (!isNativeApp()) return;
  const generation = ++restGeneration;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== "granted") return;
    }
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    const at = new Date(endsAtIso);
    if (at.getTime() <= Date.now() || generation !== restGeneration) return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_NOTIFICATION_ID,
          title: "Rest complete",
          body: exerciseName ? `Time for your next set of ${exerciseName}.` : "Time for your next set.",
          sound: NOTIFICATION_SOUND,
          schedule: { at, allowWhileIdle: true },
          // Inexact is fine for a rest timer and avoids Android 12+ sending users to the "Alarms & reminders" settings screen.
          isExactNotification: false,
        },
      ],
    });
  } catch {
    /* plugin unavailable */
  }
}

export async function cancelRestNotification(): Promise<void> {
  if (!isNativeApp()) return;
  restGeneration++;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
  } catch {
    /* plugin unavailable */
  }
}

/** One-time native setup: status bar styling and Android hardware back button. */
export async function initNativeShell(): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  const cleanups: (() => void)[] = [];
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* ignore */
  }
  try {
    const { App } = await import("@capacitor/app");
    const handle = await App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else void App.minimizeApp();
    });
    cleanups.push(() => void handle.remove());
  } catch {
    /* ignore */
  }
  return () => cleanups.forEach((c) => c());
}

const BARCODE_PLUGIN = "CapacitorBarcodeScanner";

/** True in the iPhone/Android app when the native barcode scanner plugin (@capacitor/barcode-scanner) is installed. */
export function nativeBarcodeScannerAvailable(): boolean {
  if (!isNativeApp()) return false;
  const cap = (window as unknown as { Capacitor?: { isPluginAvailable?: (name: string) => boolean; PluginHeaders?: { name: string }[] } }).Capacitor;
  if (cap?.isPluginAvailable) return cap.isPluginAvailable(BARCODE_PLUGIN);
  return Boolean(cap?.PluginHeaders?.some((p) => p.name === BARCODE_PLUGIN));
}

export type NativeScanResult = { kind: "scanned"; code: string; format?: "ean13" | "upca" | "upce" | "ean8" } | { kind: "cancelled" } | { kind: "denied" } | { kind: "error"; message: string };

/**
 * Opens the system barcode scanner (full-screen camera) and resolves with the code. The plugin rejects
 * with OS-PLUG-BARC-0006 when the person cancels and OS-PLUG-BARC-0007 when camera access is denied.
 */
export async function scanBarcodeNative(): Promise<NativeScanResult> {
  try {
    const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } = await import("@capacitor/barcode-scanner");
    const res = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.ALL,
      scanInstructions: "Line up the barcode on the package",
      scanButton: false,
      cancelButtonAccessibilityLabel: "Cancel scanning",
    });
    const code = (res?.ScanResult ?? "").trim();
    // The symbology, when the plugin reports it: an 8-digit code can be EAN-8 or UPC-E, which are different products.
    const T = CapacitorBarcodeScannerTypeHint;
    const format = res?.format === T.EAN_13 ? "ean13" : res?.format === T.UPC_A ? "upca" : res?.format === T.UPC_E ? "upce" : res?.format === T.EAN_8 ? "ean8" : undefined;
    return code ? { kind: "scanned", code, format } : { kind: "cancelled" };
  } catch (err) {
    const e = err as { code?: string; message?: string } | null;
    const code = e?.code ?? "";
    const message = e?.message ?? "";
    if (code.endsWith("0006") || /cancel/i.test(message)) return { kind: "cancelled" };
    if (code.endsWith("0007") || /permission|camera access/i.test(message)) return { kind: "denied" };
    return { kind: "error", message };
  }
}
