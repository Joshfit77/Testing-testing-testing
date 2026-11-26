import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { stackAvailable } from "./helpers";

/**
 * Database-wide security invariants, read from the live catalog (pg_class, pg_proc, pg_policies, storage.buckets), so
 * a table, function, policy or bucket added later can't quietly skip them. The member-isolation sweep
 * (cross-user-isolation.test.ts) probes the tables it knows; this checks every table, whether or not anyone listed it.
 * Uses psql like account-deletion-closure.test.ts (TEST_DB_URL, default: the local Supabase CLI database).
 */
const available = await stackAvailable();
const DB_URL = process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function sql(query: string): string[][] {
  const r = spawnSync("psql", [DB_URL, "-X", "-q", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" });
  if (r.error || r.status !== 0) throw new Error(`psql failed (is psql installed and TEST_DB_URL right?): ${r.error?.message ?? r.stderr}`);
  return r.stdout.split("\n").filter(Boolean).map((l) => l.split("\t"));
}

/** Catalog tables a signed-out visitor may read (the public library). Nothing else, and never a write. */
const VISITOR_READABLE = [
  "content_items",
  "exercise_alternatives",
  "exercise_media",
  "exercises",
  "feature_flags",
  "program_categories",
  "program_days",
  "program_exercises",
  "program_weeks",
  "training_programs",
];

describe.skipIf(!available)("database security invariants (live catalog)", () => {
  it("every table in the public schema has row-level security switched on", () => {
    const tables = sql(`select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') order by 1`);
    expect(tables.length).toBeGreaterThan(50);
    const without = sql(`select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity order by 1`);
    expect(without.map((r) => r[0])).toEqual([]);
  });

  it("there are no views in the public schema that could read past row-level security", () => {
    // A view runs with its owner's rights unless it is security_invoker, so it could expose rows a policy hides.
    const views = sql(`
      select c.relname from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
        and not coalesce((select bool_or(o = 'security_invoker=true' or o = 'security_invoker=on') from unnest(c.reloptions) o), false)
      order by 1`);
    expect(views.map((r) => r[0])).toEqual([]);
  });

  it("every security-definer function pins its search_path (no hijacking through a member's own objects)", () => {
    const loose = sql(`
      select p.proname from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
      order by 1`);
    expect(Number(sql(`select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef`)[0]![0])).toBeGreaterThan(0);
    expect(loose.map((r) => r[0])).toEqual([]);
  });

  it("signed-out visitors reach only the public catalog, read-only", () => {
    const visitor = sql(`
      select tablename, cmd from pg_policies
      where schemaname = 'public' and (roles @> '{anon}' or roles @> '{public}')
      order by 1, 2`);
    for (const [table, cmd] of visitor) {
      expect(VISITOR_READABLE, `visitor policy on ${table}`).toContain(table);
      expect(cmd, `visitor policy on ${table} must be SELECT`).toBe("SELECT");
    }
  });

  it("admin rights reach only the shared library and admin tables, never members' own rows", () => {
    // Every policy that grants anything to admins, by table. Member data must never appear here; where a table mixes
    // library rows and members' own rows (foods, programs), the admin part is limited to rows with no owner.
    // user_reports: administrators review the reports members send about each other (Friends, migration 091).
    const ADMIN_SCOPE = ["admin_audit_logs", "content_items", "exercise_alternatives", "exercise_media", "exercises", "feature_flags", "foods", "objects", "program_categories", "training_programs", "user_reports"];
    const rows = sql(`
      select tablename, coalesce(qual, '') || ' ' || coalesce(with_check, '') from pg_policies
      where schemaname in ('public', 'storage') and (qual ilike '%is_admin%' or with_check ilike '%is_admin%')`);
    for (const [table, expr] of rows) {
      expect(ADMIN_SCOPE, `admin policy on ${table}`).toContain(table);
      if (table === "foods" || table === "training_programs") {
        const uses = expr!.match(/is_admin\(\)/g)?.length ?? 0;
        const scoped = expr!.match(/owner_id IS NULL\) AND is_admin\(\)/g)?.length ?? 0;
        expect(scoped, `${table}: every admin grant limited to rows with no owner`).toBe(uses);
      }
    }
  });

  it("admin rights need a second factor in the database itself (is_admin requires aal2, F-8)", () => {
    const [[def]] = sql(`select replace(pg_get_functiondef('public.is_admin()'::regprocedure), E'\\n', ' ')`) as [[string]];
    expect(def).toMatch(/'aal2'/);
  });

  it("members can never write billing or entitlement tables (subscriptions can't be forged)", () => {
    const BILLING = ["billing_customers", "billing_state_versions", "legacy_plan_terms", "revenuecat_events", "sandbox_testers", "store_subscriptions", "store_sync_state", "stripe_events", "subscriptions", "user_entitlements"];
    const present = sql(`select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relname = any('{${BILLING.join(",")}}')`).map((r) => r[0]);
    expect(present.sort()).toEqual([...BILLING].sort());
    const writes = sql(`select tablename || ' ' || policyname || ' ' || cmd from pg_policies where schemaname = 'public' and tablename = any('{${BILLING.join(",")}}') and cmd <> 'SELECT'`);
    expect(writes.map((r) => r[0])).toEqual([]);
  });

  it("no table has a column for payment card or bank details (cards are handled by Stripe and Apple only)", () => {
    const cols = sql(`
      select table_name || '.' || column_name from information_schema.columns
      where table_schema = 'public' and column_name ~* '(card_?number|^card$|cvv|cvc|^pan$|iban|routing_number|account_number|bank_account|expiry_(month|year))'`);
    expect(cols.map((r) => r[0])).toEqual([]);
  });

  it("only the exercise-media bucket is public; members' photos and scans are private", () => {
    const buckets = Object.fromEntries(sql(`select id, public::text from storage.buckets order by 1`).map(([id, pub]) => [id!, pub === "true"]));
    expect(buckets).toMatchObject({ avatars: false, "progress-photos": false, "body-scans": false, "exercise-media": true });
    expect(Object.entries(buckets).filter(([, pub]) => pub).map(([id]) => id)).toEqual(["exercise-media"]);
  });
});
