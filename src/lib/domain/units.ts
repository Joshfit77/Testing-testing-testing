import type { UnitSystem } from "./types";

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inches: number) => inches * CM_PER_IN;

export function round(value: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Convert a stored kilogram value into the user's display unit. */
export function displayWeight(kg: number, units: UnitSystem, decimals = 1): number {
  return round(units === "imperial" ? kgToLb(kg) : kg, decimals);
}

/** Convert a user-entered weight in their display unit into kilograms for storage. */
export function toKg(value: number, units: UnitSystem): number {
  return round(units === "imperial" ? lbToKg(value) : value, 2);
}

export const weightUnit = (units: UnitSystem) => (units === "imperial" ? "lb" : "kg");
export const lengthUnit = (units: UnitSystem) => (units === "imperial" ? "in" : "cm");

export function formatWeight(kg: number | null | undefined, units: UnitSystem): string {
  if (kg == null || Number.isNaN(kg)) return "—";
  return `${displayWeight(kg, units)} ${weightUnit(units)}`;
}

export function displayLength(cm: number, units: UnitSystem): number {
  return round(units === "imperial" ? cmToIn(cm) : cm, 1);
}

export function toCm(value: number, units: UnitSystem): number {
  return round(units === "imperial" ? inToCm(value) : value, 1);
}

/** Height in feet + inches for imperial display. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalIn = cmToIn(cm);
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return round(inToCm(feet * 12 + inches), 1);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
