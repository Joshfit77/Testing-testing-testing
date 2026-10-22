import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";
import { safeNextPath } from "@/lib/safe-redirect";

const header = (list: { key: string; value: string }[], key: string) => list.find((h) => h.key === key)?.value;

describe("security headers", () => {
  it("sends a CSP that blocks framing, plugins and foreign scripts", () => {
    const csp = contentSecurityPolicy({ supabaseUrl: "https://abc.supabase.co", production: true, https: true });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toMatch(/script-src 'self' 'unsafe-inline'(;|$)/);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(csp).toContain("form-action 'self' https://checkout.stripe.com https://billing.stripe.com");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("only allows eval in development and only pins HTTPS in production", () => {
    const dev = securityHeaders({ supabaseUrl: "http://127.0.0.1:54321", production: false, https: false });
    expect(header(dev, "Content-Security-Policy")).toContain("'unsafe-eval'");
    expect(header(dev, "Content-Security-Policy")).not.toContain("upgrade-insecure-requests");
    expect(header(dev, "Strict-Transport-Security")).toBeUndefined();
    const prod = securityHeaders({ supabaseUrl: "https://abc.supabase.co", production: true, https: true });
    expect(header(prod, "Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
    expect(header(prod, "X-Frame-Options")).toBe("DENY");
    expect(header(prod, "X-Content-Type-Options")).toBe("nosniff");
  });

  it("drops eval in a production build served over plain http (local), without pinning HTTPS", () => {
    const local = securityHeaders({ supabaseUrl: "http://127.0.0.1:54321", production: true, https: false });
    expect(header(local, "Content-Security-Policy")).not.toContain("unsafe-eval");
    expect(header(local, "Content-Security-Policy")).not.toContain("upgrade-insecure-requests");
    expect(header(local, "Strict-Transport-Security")).toBeUndefined();
  });

  it("ignores a malformed Supabase URL instead of emitting a broken policy", () => {
    expect(contentSecurityPolicy({ supabaseUrl: "not a url", production: false, https: false })).not.toContain("not a url");
  });
});

describe("post-login redirects stay on this site", () => {
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/home\r\nSet-Cookie: x=1", "/\t/evil.example", "/%09/evil.example".replace("%09", "\t"), "/\u0000/evil.example", "/a\\b", 42, null])("rejects %s", (v) => {
    expect(safeNextPath(v)).toBe("/home");
  });
  it("keeps same-site paths with their query", () => {
    expect(safeNextPath("/train/programs?goal=strength")).toBe("/train/programs?goal=strength");
    expect(safeNextPath("/progress/badges?tab=faith#cedar")).toBe("/progress/badges?tab=faith#cedar");
  });
});
