import { NextResponse } from "next/server";
import { appLinksConfig, appleAssociation } from "@/lib/app-links";

/** iOS universal links (O-05). 404 until APPLE_TEAM_ID is set. Served as JSON with no redirect, as Apple requires. */
export function GET() {
  const body = appleAssociation(appLinksConfig(process.env));
  if (!body) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(body, { headers: { "cache-control": "public, max-age=3600" } });
}
