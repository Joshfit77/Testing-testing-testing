/**
 * Optional map background for the route map (Web Mercator "slippy" tiles: {z}/{x}/{y}).
 *
 * Off unless the owner sets NEXT_PUBLIC_MAP_TILE_URL: loading tiles tells the tile provider which area the member ran
 * in, so turning it on is a privacy-policy and provider-terms decision, not a default. Without it the route map draws a
 * scale grid instead.
 */

export interface TileConfig {
  /** https URL with {z}, {x} and {y}, e.g. a provider's dark raster style. */
  url: string;
  /** Attribution the provider requires, shown on the map. */
  attribution: string;
  /** Highest zoom the provider serves. */
  maxZoom: number;
}

/** The tile configuration from the environment, or null when tiles are off or the template is not usable. */
export function tileConfigFromEnv(
  // Each variable is read by its literal name so Next.js inlines it into the browser bundle as well.
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_MAP_TILE_URL: process.env.NEXT_PUBLIC_MAP_TILE_URL,
    NEXT_PUBLIC_MAP_TILE_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION,
    NEXT_PUBLIC_MAP_TILE_MAX_ZOOM: process.env.NEXT_PUBLIC_MAP_TILE_MAX_ZOOM,
  },
): TileConfig | null {
  const url = env.NEXT_PUBLIC_MAP_TILE_URL?.trim();
  if (!url || !isTileTemplate(url)) return null;
  const attribution = env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION?.trim();
  // A provider's attribution is a condition of use: without one, tiles stay off.
  if (!attribution) return null;
  const maxZoom = Number(env.NEXT_PUBLIC_MAP_TILE_MAX_ZOOM ?? 19);
  return { url, attribution, maxZoom: Number.isFinite(maxZoom) ? Math.min(22, Math.max(0, Math.floor(maxZoom))) : 19 };
}

export function isTileTemplate(url: string): boolean {
  return /^https:\/\/[^\s"'<>]+$/.test(url) && url.includes("{z}") && url.includes("{x}") && url.includes("{y}");
}

const M = 111_195; // metres per degree of latitude (matches the route map's local projection)

/**
 * The zoom whose tiles show at 128–256 drawing units across, for a map drawn at `unitsPerMetre` near latitude `lat`:
 * sharp enough on a phone without loading dozens of tiles.
 */
export function tileZoom(unitsPerMetre: number, lat: number, maxZoom = 19): number {
  const k = Math.cos((lat * Math.PI) / 180);
  // A whole-world tile row at zoom z is 360° of longitude: one tile spans 360·M·k / 2^z metres.
  const z = Math.ceil(Math.log2((unitsPerMetre * 360 * M * k) / 256));
  return Math.min(maxZoom, Math.max(0, z));
}

export function lngToTileX(lng: number, z: number): number {
  return ((lng + 180) / 360) * 2 ** z;
}

export function latToTileY(lat: number, z: number): number {
  const r = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

export function tileXToLng(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

export function tileYToLat(y: number, z: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;
}

export interface Tile {
  z: number;
  x: number;
  y: number;
  /** North-west and south-east corners as [lng, lat]. */
  nw: [number, number];
  se: [number, number];
}

/** Every tile covering a [west, south, east, north] box at zoom z (at most `limit`, nearest the centre first). */
export function tilesForBounds(bounds: [number, number, number, number], z: number, limit = 24): Tile[] {
  const [w, s, e, n] = bounds;
  const n2 = 2 ** z;
  const x0 = Math.max(0, Math.floor(lngToTileX(w, z)));
  const x1 = Math.min(n2 - 1, Math.floor(lngToTileX(e, z)));
  const y0 = Math.max(0, Math.floor(latToTileY(n, z)));
  const y1 = Math.min(n2 - 1, Math.floor(latToTileY(s, z)));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const out: Tile[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      out.push({ z, x, y, nw: [tileXToLng(x, z), tileYToLat(y, z)], se: [tileXToLng(x + 1, z), tileYToLat(y + 1, z)] });
    }
  }
  return out.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, limit);
}

export function tileUrl(template: string, t: { z: number; x: number; y: number }): string {
  return template.replace("{z}", String(t.z)).replace("{x}", String(t.x)).replace("{y}", String(t.y));
}
