import { readdirSync } from "node:fs";
import path from "node:path";
import { PROTECTED_PREFIXES } from "@/lib/supabase/middleware";

/**
 * Every signed-in section must be guarded in the middleware, so a signed-out visit goes to
 * /login?next=<that screen> (and returns there after signing in) instead of bouncing via /home.
 */
describe("middleware guards every signed-in section", () => {
  it("covers each top-level route under src/app/(app)", () => {
    const dir = path.resolve(import.meta.dirname, "../../src/app/(app)");
    const sections = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("(") && !d.name.startsWith("_"))
      .map((d) => `/${d.name}`);
    expect(sections.length).toBeGreaterThan(5);
    for (const s of sections) expect(PROTECTED_PREFIXES, s).toContain(s);
  });
});
