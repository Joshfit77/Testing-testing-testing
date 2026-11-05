/**
 * The time zones to offer in a select: every IANA zone this engine knows, with the member's own zone and UTC always
 * present. An engine's list can lack both: Node's has no "UTC" (the database default), and older ICU data names
 * Europe/Kyiv and Asia/Kolkata the old way, so a member's stored zone may be missing and a select would silently fall
 * back to the first entry. The list also differs between engines (Safari's isn't Node's), so a form must not render it
 * on the server and the device alike: render [current, "UTC"] first and fill this in once on the device.
 */
export function timeZoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    zones = [];
  }
  if (current && !zones.includes(current)) zones = [current, ...zones];
  if (!zones.includes("UTC")) zones = [...zones, "UTC"];
  return zones;
}

/** What a form renders before it is on the device: the same on the server and in every browser. */
export function initialTimeZoneOptions(current: string): string[] {
  return [...new Set([current, "UTC"].filter(Boolean))];
}
