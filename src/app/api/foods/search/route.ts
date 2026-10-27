import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getUserPlan } from "@/server/auth";
import { hasFeature } from "@/lib/domain/plans";
import { isFoodSearchConfigured } from "@/server/env";
import { isFlagEnabled } from "@/server/flags";
import { rateLimit } from "@/server/rate-limit";
import { searchFoods } from "@/server/services/food-database";
import { logError } from "@/server/log";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasFeature(await getUserPlan(user.id), "nutrition_tracking")) return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  if (!isFoodSearchConfigured() || !(await isFlagEnabled("food_search"))) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ foods: [] });
  const limit = await rateLimit(`food:${user.id}`, 30, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  try {
    return NextResponse.json({ foods: await searchFoods(q), source: "USDA FoodData Central" });
  } catch (err) {
    logError("foods.search", err);
    return NextResponse.json({ error: "search_failed" }, { status: 502 });
  }
}
