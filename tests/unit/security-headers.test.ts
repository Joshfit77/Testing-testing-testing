import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, generateNonce, securityHeaders } from "@/lib/security-headers";
import { safeNextPath } from "@/lib/safe-redirect";

const header = (list: { key: string; value: string }[], key: string) => list.find((h) => h.key === key)?.value;

describe("security headers", () => {
  it("sends a CSP that blocks framing, plugins and foreign scripts", () => {
    const csp = contentSecurityPolicy({ supabaseUrl: "https://abc.supabase.co", production: true, https: true, nonce: "bm9uY2Utdmx1ZQ==" });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    // Only scripts with this response's nonce (and what they load) run: no inline script injected into a page can.
    expect(csp).toMatch(/script-src 'self' 'nonce-bm9uY2Utdmx1ZQ==' 'strict-dynamic'(;|$)/);
    expect(csp.split("; ").find((d) => d.startsWith("script-src"))).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(csp).toContain("form-action 'self' https://checkout.stripe.com https://billing.stripe.com");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain("img-src 'self' data: blob: https: https://abc.supabase.co");
  });

  it("lets a local http Supabase serve private photos", () => {
    const dev = contentSecurityPolicy({ supabaseUrl: "http://127.0.0.1:54321", production: false, https: false });
    expect(dev).toContain("img-src 'self' data: blob: https: http://127.0.0.1:54321");
  });

  it("without a nonce, no inline script may run at all", () => {
    const csp = contentSecurityPolicy({ supabaseUrl: "https://abc.supabase.co", production: true, https: true });
    expect(csp).toMatch(/script-src 'self'(;|$)/);
  });

  it("makes a new, unguessable nonce for every response", () => {
    const nonces = new Set(Array.from({ length: 50 }, generateNonce));
    expect(nonces.size).toBe(50);
    for (const n of nonces) expect(n).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });

  it("only allows eval in development and only pins HTTPS in production", () => {
    const devCsp = contentSecurityPolicy({ supabaseUrl: "http://127.0.0.1:54321", production: false, https: false, nonce: "abc" });
    expect(devCsp).toContain("'unsafe-eval'");
    expect(devCsp).not.toContain("upgrade-insecure-requests");
    const dev = securityHeaders({ supabaseUrl: "http://127.0.0.1:54321", production: false, https: false });
    // The CSP is the middleware's (it carries the nonce); the static headers never add a second one.
    expect(header(dev, "Content-Security-Policy")).toBeUndefined();
    expect(header(dev, "Strict-Transport-Security")).toBeUndefined();
    const prod = securityHeaders({ supabaseUrl: "https://abc.supabase.co", production: true, https: true });
    expect(header(prod, "Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
    expect(header(prod, "X-Frame-Options")).toBe("DENY");
    expect(header(prod, "X-Content-Type-Options")).toBe("nosniff");
  });

  it("lets only the app itself use the camera and location, and nothing use the microphone", () => {
    const policy = header(securityHeaders({ supabaseUrl: "https://abc.supabase.co", production: true, https: true }), "Permissions-Policy");
    // geolocation=() would silently break the GPS recorder (the browser refuses before asking the member).
    expect(policy).toBe("camera=(self), microphone=(), geolocation=(self)");
  });

  it("drops eval in a production build served over plain http (local), without pinning HTTPS", () => {
    const local = contentSecurityPolicy({ supabaseUrl: "http://127.0.0.1:54321", production: true, https: false, nonce: "abc" });
    expect(local).not.toContain("unsafe-eval");
    expect(local).not.toContain("upgrade-insecure-requests");
    expect(header(securityHeaders({ supabaseUrl: "http://127.0.0.1:54321", production: true, https: false }), "Strict-Transport-Security")).toBeUndefined();
  });

  it("ignores a malformed Supabase URL instead of emitting a broken policy", () => {
    expect(contentSecurityPolicy({ supabaseUrl: "not a url", production: false, https: false })).not.toContain("not a url");
  });
});

describe("post-login redirects stay on this site", () => {
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/home\r\nSet-Cookie: x=1", "/\t/evil.example", "/%09/evil.example".replace("%09", "\t"), "/\u0000/evil.example", "/a\\b", 42, null])("rejects %s", (v) => {
    expect(safeNextPath(v)).toBe("/home");
  });
  // Dot segments resolve to a protocol-relative address ("//evil.example"), which a browser sends to that host.
  it.each(["/.//evil.example", "/a/..//evil.example", "/..//evil.example", "/%2e//evil.example", "/%2E%2E//evil.example", "/x/./..//evil.example"])("rejects %s, which resolves to //evil.example", (v) => {
    expect(safeNextPath(v)).toBe("/home");
    expect(new URL(safeNextPath(v), "https://app.narrowgate.test").host).toBe("app.narrowgate.test");
  });
  it("keeps same-site paths with their query", () => {
    expect(safeNextPath("/x/../home")).toBe("/home");
    expect(safeNextPath("/train/programs?goal=strength")).toBe("/train/programs?goal=strength");
    expect(safeNextPath("/progress/badges?tab=faith#cedar")).toBe("/progress/badges?tab=faith#cedar");
  });
});
