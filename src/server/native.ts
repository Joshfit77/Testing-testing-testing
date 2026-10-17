import "server-only";
import { headers } from "next/headers";

/** The Capacitor shells append this token to the WebView user agent (see capacitor.config.ts). */
export const NATIVE_UA_TOKEN = "NarrowGateApp";

export async function getNativePlatform(): Promise<"ios" | "android" | null> {
  const ua = (await headers()).get("user-agent") ?? "";
  if (!ua.includes(NATIVE_UA_TOKEN)) return null;
  return /iPhone|iPad|iPod/i.test(ua) ? "ios" : "android";
}
