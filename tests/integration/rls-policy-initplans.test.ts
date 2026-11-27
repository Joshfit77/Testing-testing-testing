import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { stackAvailable } from "./helpers";

const available = await stackAvailable();
const DB_URL = process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Migration 094 (O-17): row-level-security policies call their no-argument permission helpers as `(select helper())`,
 * so Postgres runs each once per statement instead of once per row. A new policy that calls one directly fails here.
 */
describe.skipIf(!available)("RLS policies evaluate permission helpers once per statement", () => {
  it("no policy calls auth.uid() or an app permission helper per row", () => {
    const helpers = ["uid", "is_admin", "has_ai_coach", "can_log_sleep", "can_add_body_scan", "accountability_can_invite", "friends_can_invite", "can_add_body_scan_photo", "can_add_progress_photo"];
    const pattern = `(?<!SELECT )(?<![[:alnum:]_.])((?:auth\\.)?(?:${helpers.join("|")}))\\(\\)`;
    const sql = `select tablename || '.' || policyname from pg_policies where schemaname = 'public' and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '${pattern}' order by 1`;
    const r = spawnSync("psql", [DB_URL, "-X", "-At", "-c", sql], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.trim()).toBe("");
  });

  it("the rewritten policies still enforce the same rules (spot checks)", () => {
    const sql = `select qual from pg_policies where schemaname = 'public' and policyname = 'exercises_read'`;
    const r = spawnSync("psql", [DB_URL, "-X", "-At", "-c", sql], { encoding: "utf8" });
    expect(r.stdout.trim()).toBe("(is_published OR ( SELECT is_admin() AS is_admin))");
  });
});
