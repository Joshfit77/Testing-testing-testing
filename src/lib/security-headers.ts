/**
 * HTTP security headers for every response (wired up in next.config.ts).
 *
 * The Content-Security-Policy keeps 'unsafe-inline' for scripts because the App Router streams inline
 * hydration scripts and the root layout applies display preferences before first paint; everything
 * else is limited to this origin, Supabase, Stripe's hosted pages and the two video hosts we embed.
 */
export interface SecurityHeaderOptions {
  supabaseUrl?: string;
  /** Production build: no 'unsafe-eval' (only the dev server needs it). */
  production: boolean;
  /** Served over HTTPS: adds HSTS and upgrade-insecure-requests. */
  https: boolean;
}

function origin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({ supabaseUrl, production, https }: SecurityHeaderOptions): string {
  const supabase = origin(supabaseUrl);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : null;
  const list = (...items: (string | null | false)[]) => items.filter(Boolean).join(" ");
  const directives: Record<string, string> = {
    "default-src": "'self'",
    "base-uri": "'self'",
    "object-src": "'none'",
    "frame-ancestors": "'none'",
    "script-src": list("'self'", "'unsafe-inline'", !production && "'unsafe-eval'"),
    "style-src": "'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src": "'self' data: https://fonts.gstatic.com",
    "img-src": "'self' data: blob: https:",
    "media-src": list("'self'", "blob:", supabase),
    "connect-src": list("'self'", supabase, supabaseWs, "https://*.supabase.co", "wss://*.supabase.co"),
    "frame-src": "https://www.youtube-nocookie.com https://player.vimeo.com",
    "worker-src": "'self' blob:",
    "manifest-src": "'self'",
    // Server actions redirect to Stripe Checkout and the billing portal after a form post.
    "form-action": "'self' https://checkout.stripe.com https://billing.stripe.com",
  };
  if (https) directives["upgrade-insecure-requests"] = "";
  return Object.entries(directives)
    .map(([k, v]) => (v ? `${k} ${v}` : k))
    .join("; ");
}

export function securityHeaders(opts: SecurityHeaderOptions): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(opts) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
  // HSTS only over real HTTPS deployments; on localhost it would pin the dev host to HTTPS.
  if (opts.https) headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  return headers;
}
