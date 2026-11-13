/** "Nov 3 – Nov 9, 2026" for a Monday–Sunday report week. */
export function formatWeek(start: string, end: string): string {
  const f = (d: string, year: boolean) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
  return `${f(start, false)} – ${f(end, true)}`;
}
