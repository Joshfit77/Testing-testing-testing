// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { logError } from "@/server/log";

/** Server logs keep the kind of error, never who it was about: messages are scrubbed before they are written. */
describe("logError", () => {
  afterEach(() => vi.restoreAllMocks());

  const logged = (error: unknown, context?: Record<string, string | number | boolean | null>) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("auth.signup", error, context);
    const line = spy.mock.calls[0]![0] as string;
    return { line, entry: JSON.parse(line) as Record<string, unknown> };
  };

  it("removes an email address from an error message (Supabase Auth names the address it refused)", () => {
    const { line, entry } = logged({ name: "AuthApiError", code: "email_address_invalid", status: 400, message: "Email address jane.doe+gym@example.com is invalid" });
    expect(line).not.toContain("jane.doe");
    expect(line).not.toContain("example.com");
    expect(entry).toMatchObject({ level: "error", scope: "auth.signup", name: "AuthApiError", code: "email_address_invalid", status: 400, message: "Email address <email> is invalid" });
  });

  it("scrubs ids and tokens too, for errors that aren't Error objects as well", () => {
    const { line } = logged("lookup failed for 3f2b8c1e-9a4d-4e2b-8f6a-1c2d3e4f5a6b (someone@example.org)");
    expect(line).toContain("<id>");
    expect(line).not.toContain("someone@example.org");
  });

  it("keeps the context it is given", () => {
    expect(logged(new Error("boom"), { status: 502 }).entry).toMatchObject({ message: "boom", status: 502, name: "Error" });
  });
});
