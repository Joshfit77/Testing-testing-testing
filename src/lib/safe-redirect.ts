/** Only allow same-site relative paths as post-login redirect targets (prevents open redirects). */
export function safeNextPath(value: unknown, fallback = "/home"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  // Browsers and URL parsers drop tabs and line breaks, so "/\t/evil.com" would become "//evil.com": reject every
  // control character, then make sure the path still resolves to this site.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  const base = "https://same-origin.invalid";
  try {
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
