/**
 * What the logger asks for on each set. Most exercises log weight × reps or a time; some are measured by
 * distance (SPEC §6): loaded carries and sled work (weight + distance) and cardio intervals (time + distance).
 * Pure; shared by the logger, the template builder and the previous-performance text.
 */
import type { UnitSystem } from "./types";

export type DistanceMode = "loaded" | "cardio";

/** Loaded distance work: weight and distance. */
const LOADED = new Set([
  "farmers-carry",
  "suitcase-carry",
  "sandbag-bear-hug-carry",
  "yoke-carry",
  "strongman-farmers-walk",
  "trap-bar-carry",
  "keg-carry",
  "zercher-carry",
  "sled-push",
  "sled-drag",
  "arm-over-arm-sled-pull",
]);

/** Cardio measured by distance: time and distance. */
const CARDIO = new Set(["zone-2-run", "running-intervals", "run-walk-intervals", "brisk-walk", "rowing-intervals", "bike-intervals", "air-bike-sprint"]);

export function distanceMode(slug: string): DistanceMode | null {
  if (LOADED.has(slug)) return "loaded";
  if (CARDIO.has(slug)) return "cardio";
  return null;
}

export function usesDistance(slug: string): boolean {
  return distanceMode(slug) !== null;
}

/** The unit distance is typed in: metres / yards for carries and sleds, km / miles for cardio. */
export function distanceUnit(mode: DistanceMode, units: UnitSystem): "m" | "yd" | "km" | "mi" {
  if (mode === "loaded") return units === "imperial" ? "yd" : "m";
  return units === "imperial" ? "mi" : "km";
}

const FACTOR: Record<"m" | "yd" | "km" | "mi", number> = { m: 1, yd: 0.9144, km: 1000, mi: 1609.344 };

export function toMetres(value: number, unit: "m" | "yd" | "km" | "mi"): number {
  return Math.round(value * FACTOR[unit] * 10) / 10;
}

export function fromMetres(metres: number, unit: "m" | "yd" | "km" | "mi"): number {
  const v = metres / FACTOR[unit];
  return unit === "km" || unit === "mi" ? Math.round(v * 100) / 100 : Math.round(v);
}

/** "40 m", "45 yd", "5 km", "3.1 mi". */
export function formatDistance(metres: number, units: UnitSystem): string {
  if (units === "imperial") return metres >= 1609 ? `${fromMetres(metres, "mi")} mi` : `${fromMetres(metres, "yd")} yd`;
  return metres >= 1000 ? `${fromMetres(metres, "km")} km` : `${Math.round(metres)} m`;
}
