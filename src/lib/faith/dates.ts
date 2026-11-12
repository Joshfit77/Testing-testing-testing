/** "Tuesday, November 3" for a local calendar date (YYYY-MM-DD), read as that date wherever the code runs. */
export function formatLongDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

/** "Nov 3" */
export function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
