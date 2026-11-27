import { describe, expect, it } from "vitest";
import { isHydrationError, redactMessage, redactPath } from "@/lib/error-redact";
import { buildReport } from "@/lib/error-report";

/** Error reports carry the kind of failure and where, never who or what the member wrote (docs/ERROR_MONITORING.md). */
describe("error report redaction", () => {
  it("removes emails, ids, tokens, numbers, quoted text and query strings", () => {
    const m = redactMessage(
      'Failed for jane.doe+test@example.com on 3f2504e0-4f89-11d3-9a0c-0305e82c3301 with eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl at https://app.test/faith/journal?entry=Lord%20help "my private prayer text" weight 18450',
    );
    expect(m).not.toMatch(/jane|example\.com|3f2504e0|eyJ|entry=|private prayer|18450/);
    expect(m).toContain("<email>");
    expect(m).toContain("<id>");
    expect(m).toContain("<token>");
    expect(m).toContain("<text>");
    expect(m).toContain("https://app.test/faith/journal");
  });

  it("keeps messages short", () => {
    expect(redactMessage("x ".repeat(500)).length).toBeLessThanOrEqual(200);
  });

  it("reduces a path to its pattern", () => {
    expect(redactPath("/train/history/3f2504e0-4f89-11d3-9a0c-0305e82c3301?tab=sets#top")).toBe("/train/history/:id");
    expect(redactPath("/faith/bible/john/3")).toBe("/faith/bible/john/:id");
    expect(redactPath("/train/exercises/back-squat")).toBe("/train/exercises/back-squat");
  });

  it("recognises hydration failures in production and development wording", () => {
    expect(isHydrationError("Minified React error #418; visit https://react.dev/errors/418")).toBe(true);
    expect(isHydrationError("Hydration failed because the server rendered text didn't match the client")).toBe(true);
    expect(isHydrationError("Cannot read properties of undefined")).toBe(false);
  });

  it("builds a report with only the kind, name, scrubbed message, path pattern and digest", () => {
    const r = buildReport("error", new TypeError("Minified React error #418; args[]=text for bob@mail.org"), "/nutrition/insights?day=2026-11-04", "123abc");
    expect(r).toEqual({ kind: "hydration", name: "TypeError", message: expect.not.stringContaining("bob"), path: "/nutrition/insights", digest: "123abc" });
    expect(Object.keys(r).sort()).toEqual(["digest", "kind", "message", "name", "path"]);
  });
});
