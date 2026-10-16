import "server-only";
import { normalizeOffProduct, OFF_FIELDS, type BarcodeLookup, type OffProductResponse } from "@/lib/open-food-facts";

/**
 * Open Food Facts client (no API key). OFF asks every app to send a descriptive User-Agent.
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 */
const BASE = "https://world.openfoodfacts.org/api/v2/product";
export const OFF_USER_AGENT = "NarrowGateFitness/1.0 (contact via app)";

export class OffUnavailableError extends Error {}

async function fetchProduct(code: string): Promise<OffProductResponse | null> {
  const url = `${BASE}/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS.join(",")}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": OFF_USER_AGENT },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    });
  } catch (err) {
    throw new OffUnavailableError(`Open Food Facts request failed: ${(err as Error).message}`);
  }
  // v2 answers 404 with { status: 0, status_verbose: "product not found" } for unknown codes.
  if (res.status === 404) return null;
  if (!res.ok) throw new OffUnavailableError(`Open Food Facts error ${res.status}`);
  return (await res.json()) as OffProductResponse;
}

/** Looks up each candidate code in order (see barcodeLookupCandidates) and returns the first hit. */
export async function lookupBarcode(candidates: string[]): Promise<BarcodeLookup> {
  let fallback: BarcodeLookup = { status: "not_found", code: candidates[0] ?? "" };
  for (const code of candidates.slice(0, 2)) {
    const result = normalizeOffProduct(await fetchProduct(code), code);
    if (result.status === "found") return result;
    if (result.status === "no_nutrition" && fallback.status === "not_found") fallback = result;
  }
  return fallback;
}
