/**
 * HTTP security headers.
 *
 * The Content-Security-Policy is sent by the middleware (src/middleware.ts) with a new nonce for every request: only
 * scripts carrying that nonce run (Next.js adds it to its own scripts and inline hydration data, the root layout to
 * its two inline scripts), plus scripts they load ('strict-dynamic'). No 'unsafe-inline' for scripts, so injected
 * markup can't run code. Everything else is limited to this origin, Supabase, Stripe's hosted pages and the two video
 * hosts we embed. The other headers are static and set in next.config.ts.
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

/** A fresh nonce for one response: 16 random bytes, base64. */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function contentSecurityPolicy({ supabaseUrl, production, https, nonce }: SecurityHeaderOptions & { nonce?: string }): string {
  const supabase = origin(supabaseUrl);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : null;
  const list = (...items: (string | null | false | undefined)[]) => items.filter(Boolean).join(" ");
  const directives: Record<string, string> = {
    "default-src": "'self'",
    "base-uri": "'self'",
    "object-src": "'none'",
    "frame-ancestors": "'none'",
    // Without a nonce (a response the middleware didn't see), no inline script runs at all.
    "script-src": list("'self'", nonce && `'nonce-${nonce}'`, nonce && "'strict-dynamic'", !production && "'unsafe-eval'"),
    "style-src": "'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src": "'self' data: https://fonts.gstatic.com",
    // The Supabase origin is listed too, so private photos (signed storage links) also load from a local http stack.
    "img-src": list("'self'", "data:", "blob:", "https:", supabase),
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

/** The static headers for every response (next.config.ts). The CSP comes from the middleware, with its nonce. */
export function securityHeaders(opts: SecurityHeaderOptions): { key: string; value: string }[] {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Location is for this app's own GPS recorder only (requested on Start); never for embedded frames.
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
  // HSTS only over real HTTPS deployments; on localhost it would pin the dev host to HTTPS.
  if (opts.https) headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  return headers;
}
