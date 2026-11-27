/** The Capacitor shells append this token to the WebView user agent (see capacitor.config.ts). */
export const NATIVE_UA_TOKEN = "NarrowGateApp";

/**
 * Which app shell is asking, from the WebView's user agent: null in a browser.
 *
 * Android's WebView always says "Android". The iOS shell says "iPhone" on a phone, but on an iPad the WebView uses the
 * desktop content mode by default and reports itself as "Macintosh" with no "iPad" in it. So anything in the app that
 * isn't Android is the iOS app (iPhone or iPad); the old test for "iPhone|iPad" sent iPads to Google Play billing.
 */
export function platformFromUserAgent(ua: string): "ios" | "android" | null {
  if (!ua.includes(NATIVE_UA_TOKEN)) return null;
  return /Android/i.test(ua) ? "android" : "ios";
}
