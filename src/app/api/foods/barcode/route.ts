import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getUserPlan } from "@/server/auth";
import { hasFeature } from "@/lib/domain/plans";
import { barcodeLookupCandidates, type RetailBarcodeFormat } from "@/lib/barcode";
import { OFF_ATTRIBUTION } from "@/lib/open-food-facts";
import { rateLimit } from "@/server/rate-limit";
import { lookupBarcode } from "@/server/services/open-food-facts";
import { logError } from "@/server/log";

export const dynamic = "force-dynamic";

const FORMATS: RetailBarcodeFormat[] = ["ean13", "upca", "upce", "ean8"];

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasFeature(await getUserPlan(user.id), "nutrition_tracking")) return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  const rawFormat = request.nextUrl.searchParams.get("format");
  const format = FORMATS.find((f) => f === rawFormat);
  const candidates = barcodeLookupCandidates((request.nextUrl.searchParams.get("code") ?? "").slice(0, 20), format);
  if (!candidates) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  const limit = await rateLimit(`barcode:${user.id}`, 30, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  try {
    const result = await lookupBarcode(candidates);
    return NextResponse.json({ ...result, attribution: OFF_ATTRIBUTION });
  } catch (err) {
    logError("foods.barcode", err);
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }
}
