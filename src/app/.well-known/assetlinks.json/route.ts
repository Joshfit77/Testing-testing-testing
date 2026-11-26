import { NextResponse } from "next/server";
import { androidAssetLinks, appLinksConfig } from "@/lib/app-links";

/** Android App Links (O-05). 404 until ANDROID_APP_CERT_SHA256 is set. */
export function GET() {
  const body = androidAssetLinks(appLinksConfig(process.env));
  if (!body) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(body, { headers: { "cache-control": "public, max-age=3600" } });
}
