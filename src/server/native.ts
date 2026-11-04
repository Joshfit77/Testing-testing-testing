import "server-only";
import { headers } from "next/headers";
import { NATIVE_UA_TOKEN, platformFromUserAgent } from "@/lib/native-platform";

export { NATIVE_UA_TOKEN };

export async function getNativePlatform(): Promise<"ios" | "android" | null> {
  return platformFromUserAgent((await headers()).get("user-agent") ?? "");
}
