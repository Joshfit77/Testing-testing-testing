import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getUserPlan } from "@/server/auth";
import { hasFeature } from "@/lib/domain/plans";
import type { FoodChoice } from "@/lib/domain/food-basis";
import { isFoodSearchConfigured } from "@/server/env";
import { isFlagEnabled } from "@/server/flags";
import { rateLimit } from "@/server/rate-limit";
import { searchFoods } from "@/server/services/food-database";
import { browseCategory, popularFoods, searchUsda, type LocalFood } from "@/server/services/usda-local";
import { logError } from "@/server/log";

export const dynamic = "force-dynamic";

const PAGE = 40;

function localChoice(f: LocalFood): FoodChoice {
  return { key: `usda:${f.fdcId}`, kind: "usda", ref: String(f.fdcId), name: f.name, detail: f.popular ? `USDA · ${f.usdaName}` : `USDA · ${f.category}`, basis: f.basis };
}

/**
 * Food search. Always searches the built-in USDA SR Legacy database (server-side); when a USDA API key is
 * configured it also adds branded and survey foods from FoodData Central.
 *   ?q=         search text (popular foods when shorter than 2 characters)
 *   ?cat=N      browse USDA food group N (optionally narrowed by q), paginated with ?offset=
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasFeature(await getUserPlan(user.id), "nutrition_tracking")) return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 80);
  const limit = rateLimit(`food:${user.id}`, 90, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  try {
    const catRaw = sp.get("cat");
    if (catRaw != null) {
      const cat = Number(catRaw);
      const offset = Math.max(0, Math.min(10_000, Number(sp.get("offset") ?? 0) || 0));
      if (!Number.isInteger(cat) || cat < 0 || cat > 99) return NextResponse.json({ error: "invalid_category" }, { status: 400 });
      const { foods, total } = await browseCategory(cat, q, offset, PAGE);
      return NextResponse.json({ foods: foods.map(localChoice), total, offset });
    }
    if (q.length < 2) return NextResponse.json({ foods: (await popularFoods()).map(localChoice), popular: true });

    const local = (await searchUsda(q, 30)).map(localChoice);
    let remote: FoodChoice[] = [];
    let remoteError = false;
    if (isFoodSearchConfigured() && (await isFlagEnabled("food_search"))) {
      try {
        const seen = new Set(local.map((f) => f.ref));
        remote = (await searchFoods(q))
          .filter((f) => !seen.has(f.fdcId))
          .map((f) => ({
            key: `usda:${f.fdcId}`,
            kind: "usda" as const,
            ref: f.fdcId,
            name: f.name,
            detail: [f.brand, "USDA FoodData Central", f.householdServing ? `label serving ${f.householdServing}` : null].filter(Boolean).join(" · "),
            basis: { per100: { calories: f.calories, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, fiber_g: f.fiber_g } },
          }));
      } catch (err) {
        logError("foods.search.remote", err);
        remoteError = true;
      }
    }
    return NextResponse.json({ foods: local, remote, remoteError });
  } catch (err) {
    logError("foods.search", err);
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
