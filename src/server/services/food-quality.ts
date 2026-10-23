import "server-only";
import { barcodeLookupCandidates } from "@/lib/barcode";
import { normalizeOffProduct, type BarcodeProduct } from "@/lib/open-food-facts";
import { normalizeQualityProduct, OFF_QUALITY_FIELDS, type OffQualityResponse, type QualityProduct } from "@/lib/food-quality";
import { OFF_USER_AGENT, OffUnavailableError } from "@/server/services/open-food-facts";

/**
 * Open Food Facts reads for Narrow Gate Food IQ. Product reads are cached for a day (OFF data changes slowly);
 * category searches for alternatives and name searches are cached and throttled together to stay well under OFF's
 * published search limit (10 searches a minute per app). Nothing is copied into the app's own food tables.
 */
const ORIGIN = /^https?:\/\//.test(process.env.OFF_API_BASE_URL ?? "") ? process.env.OFF_API_BASE_URL!.replace(/\/+$/, "") : "https://world.openfoodfacts.org";

async function getJson(url: string): Promise<unknown | null> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": OFF_USER_AGENT }, signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } });
  } catch (err) {
    throw new OffUnavailableError(`Open Food Facts request failed: ${(err as Error).message}`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new OffUnavailableError(`Open Food Facts error ${res.status}`);
  return res.json();
}

export interface QualityLookup {
  quality: QualityProduct;
  /** The same product in the diary's format, when it has nutrition (for "Add to Food Diary"). */
  diary: BarcodeProduct | null;
}

/** Look up a barcode (trying the EAN-13 form of a UPC-A code too). Null when Open Food Facts doesn't have it. */
export async function getQualityProduct(rawCode: string): Promise<QualityLookup | null> {
  const candidates = barcodeLookupCandidates(rawCode.slice(0, 20));
  if (!candidates) return null;
  for (const code of candidates.slice(0, 2)) {
    const json = (await getJson(`${ORIGIN}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_QUALITY_FIELDS.join(",")}`)) as OffQualityResponse | null;
    const quality = normalizeQualityProduct(json, code);
    if (!quality) continue;
    const diary = normalizeOffProduct(json as Parameters<typeof normalizeOffProduct>[0], code);
    return { quality, diary: diary.status === "found" ? diary.product : null };
  }
  return null;
}

// A small in-process throttle for searches: at most 8 a minute from this server.
const searchTimes: number[] = [];
function searchAllowed(now = Date.now()): boolean {
  while (searchTimes.length && now - searchTimes[0]! > 60_000) searchTimes.shift();
  if (searchTimes.length >= 8) return false;
  searchTimes.push(now);
  return true;
}
const searchCache = new Map<string, { at: number; products: QualityProduct[] }>();

const nameCache = new Map<string, { at: number; products: QualityProduct[] }>();
export type ProductSearchResult = { status: "ok"; products: QualityProduct[] } | { status: "busy" } | { status: "unavailable" } | { status: "invalid" };

/** Search Open Food Facts by product name or brand (shares the search throttle). Results are cached for an hour. */
export async function searchProducts(query: string): Promise<ProductSearchResult> {
  const q = query.replace(/[^\p{L}\p{N}' &-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 2) return { status: "invalid" };
  const key = q.toLowerCase();
  const cached = nameCache.get(key);
  if (cached && Date.now() - cached.at < 3600_000) return { status: "ok", products: cached.products };
  if (!searchAllowed()) return { status: "busy" };
  try {
    const params = new URLSearchParams({ search_terms: q, search_simple: "1", action: "process", json: "1", page_size: "20", fields: OFF_QUALITY_FIELDS.join(",") });
    const json = (await getJson(`${ORIGIN}/cgi/search.pl?${params}`)) as { products?: Record<string, unknown>[] } | null;
    const products = (json?.products ?? [])
      .map((p) => normalizeQualityProduct({ status: 1, product: p }, String(p.code ?? "")))
      .filter((p): p is QualityProduct => p != null && /^\d{8,14}$/.test(p.code));
    nameCache.set(key, { at: Date.now(), products });
    if (nameCache.size > 500) nameCache.delete(nameCache.keys().next().value!);
    return { status: "ok", products };
  } catch {
    return { status: "unavailable" };
  }
}

export type AlternativesResult = { status: "ok"; candidates: QualityProduct[] } | { status: "busy" } | { status: "unavailable" } | { status: "no_category" };

/** Popular products in the same most specific category, for alternatives. */
export async function searchCategory(category: string | null): Promise<AlternativesResult> {
  if (!category || !/^[a-z]{2}:[\w-]{1,80}$/.test(category)) return { status: "no_category" };
  const cached = searchCache.get(category);
  if (cached && Date.now() - cached.at < 6 * 3600_000) return { status: "ok", candidates: cached.products };
  if (!searchAllowed()) return { status: "busy" };
  try {
    const params = new URLSearchParams({ categories_tags: category, fields: OFF_QUALITY_FIELDS.join(","), page_size: "24", sort_by: "popularity_key" });
    const json = (await getJson(`${ORIGIN}/api/v2/search?${params}`)) as { products?: Record<string, unknown>[] } | null;
    const products = (json?.products ?? [])
      .map((p) => normalizeQualityProduct({ status: 1, product: p }, String(p.code ?? "")))
      .filter((p): p is QualityProduct => p != null && /^\d{8,14}$/.test(p.code));
    searchCache.set(category, { at: Date.now(), products });
    if (searchCache.size > 500) searchCache.delete(searchCache.keys().next().value!);
    return { status: "ok", candidates: products };
  } catch {
    return { status: "unavailable" };
  }
}
