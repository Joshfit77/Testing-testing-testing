/** Only allow same-site relative paths as post-login redirect targets (prevents open redirects). */
export function safeNextPath(value: unknown, fallback = "/home"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("\n") || value.includes("\r")) return fallback;
  return value;
}
