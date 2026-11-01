import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * The sign-up confirmation and password-reset emails must link to /auth/confirm with the token hash. Supabase's
 * default link ({{ .ConfirmationURL }}) ends in a PKCE code exchange that only works in the browser that asked for
 * the email, so a reset requested in the iPhone app (WebView) failed when the link opened in Safari
 * (tests/integration/auth-email-links.test.ts shows both behaviours against the real auth server).
 */
const root = path.resolve(import.meta.dirname, "../..");
const config = readFileSync(path.join(root, "supabase/config.toml"), "utf8");

function templateSection(name: string): { subject: string; contentPath: string } | null {
  const m = config.match(new RegExp(`^\\[auth\\.email\\.template\\.${name}\\]\\s*\\n((?:[^\\[\\n].*\\n?)*)`, "m"));
  if (!m) return null;
  const body = m[1]!;
  const subject = body.match(/^subject\s*=\s*"([^"]+)"/m)?.[1];
  const contentPath = body.match(/^content_path\s*=\s*"([^"]+)"/m)?.[1];
  return subject && contentPath ? { subject, contentPath } : null;
}

/** Render the template's link the way GoTrue fills it in. */
function renderedLinks(html: string): URL[] {
  const filled = html.replaceAll("{{ .SiteURL }}", "https://app.narrowgate.test").replaceAll("{{ .TokenHash }}", "pkce_0123abcd");
  return [...filled.matchAll(/href="([^"]+)"/g)].map((m) => new URL(m[1]!.replaceAll("&amp;", "&")));
}

describe.each([
  { name: "confirmation", type: "email", next: "/onboarding" },
  { name: "recovery", type: "recovery", next: "/reset-password" },
])("$name email template", ({ name, type, next }) => {
  const section = templateSection(name);

  it("is configured with a subject and a template file", () => {
    expect(section).not.toBeNull();
    expect(existsSync(path.join(root, section!.contentPath))).toBe(true);
  });

  it("links to /auth/confirm with the token hash, the right type and a same-site next page", () => {
    const html = readFileSync(path.join(root, section!.contentPath), "utf8");
    // No PKCE code-exchange link anywhere, not even inside a comment (Go templates evaluate those too).
    expect(html).not.toContain(".ConfirmationURL");
    const links = renderedLinks(html);
    expect(links).toHaveLength(1);
    const link = links[0]!;
    expect(link.origin).toBe("https://app.narrowgate.test");
    expect(link.pathname).toBe("/auth/confirm");
    expect(link.searchParams.get("token_hash")).toBe("pkce_0123abcd");
    expect(link.searchParams.get("type")).toBe(type);
    expect(link.searchParams.get("next")).toBe(next);
    expect(safeNextPath(link.searchParams.get("next"))).toBe(next);
  });
});
