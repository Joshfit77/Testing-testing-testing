import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * importSleepAction against an in-memory stand-in for the sleep tables (the real constraints are covered by
 * tests/integration/sleep.test.ts, which needs local Supabase): a re-import adds nothing and only fills in
 * measurements that were missing; a record overlapping stored sleep is skipped, never merged; a malformed record is
 * rejected on its own; a short daytime record is stored as a nap; consent and the import switch are enforced.
 */
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { overlaps, zonedTimeToIso } from "@/lib/domain/sleep";

const TZ = "America/New_York";
const ME = "3f1c6a52-1b2c-4d3e-8f90-123456789abc";

interface Row {
  id: string;
  user_id: string;
  kind: string;
  started_at: string;
  ended_at: string;
  source: string;
  source_id: string | null;
  hr_avg: number | null;
  hrv_avg_ms: number | null;
  rr_avg: number | null;
  device_name: string | null;
}

const db = {
  sessions: [] as Row[],
  stages: [] as { session_id: string; stage: string }[],
  runs: [] as Record<string, unknown>[],
  profileUpdates: [] as Record<string, unknown>[],
};
const state = { consent: true, importEnabled: true as boolean | null };

/** A tiny query builder: records filters, resolves to the table's answer when awaited. */
function table(name: string) {
  const filters: Record<string, unknown> = {};
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: unknown;
  const isNull: string[] = [];
  const q: Record<string, unknown> = {};
  const self = () => q;
  Object.assign(q, {
    select: (_c?: string) => {
      if (op === "select") op = "select";
      return q;
    },
    insert: (p: unknown) => ((op = "insert"), (payload = p), q),
    update: (p: unknown) => ((op = "update"), (payload = p), q),
    delete: () => ((op = "delete"), q),
    eq: (k: string, v: unknown) => ((filters[k] = v), q),
    is: (k: string, _v: null) => (isNull.push(k), q),
    not: self,
    in: self,
    order: self,
    range: self,
    limit: self,
    maybeSingle: self,
    then: (resolve: (v: unknown) => void) => resolve(run()),
  });
  function run() {
    if (name === "sleep_sessions") {
      if (op === "select") return { data: db.sessions.filter((r) => r.user_id === filters.user_id && r.source === filters.source && r.source_id).map((r) => ({ source_id: r.source_id })), error: null };
      if (op === "insert") {
        const row = payload as Row;
        if (db.sessions.some((r) => r.user_id === row.user_id && r.source === row.source && r.source_id === row.source_id)) return { error: { code: "23505" } };
        if (db.sessions.some((r) => r.user_id === row.user_id && overlaps({ startedAt: r.started_at, endedAt: r.ended_at }, { startedAt: row.started_at, endedAt: row.ended_at }))) return { error: { code: "23P01" } };
        db.sessions.push(row);
        return { error: null };
      }
      if (op === "update") {
        const hits = db.sessions.filter((r) => r.user_id === filters.user_id && r.source === filters.source && r.source_id === filters.source_id && isNull.every((k) => r[k as keyof Row] == null));
        for (const r of hits) Object.assign(r, payload);
        return { data: hits.map((r) => ({ id: r.id })), error: null };
      }
    }
    if (name === "sleep_stages" && op === "insert") {
      db.stages.push(...(payload as { session_id: string; stage: string }[]));
      return { error: null };
    }
    if (name === "sleep_import_runs") {
      if (op === "insert") {
        db.runs.push(payload as Record<string, unknown>);
        return { error: null };
      }
      return { data: [], error: null };
    }
    if (name === "profiles" && op === "update") {
      db.profileUpdates.push(payload as Record<string, unknown>);
      return { error: null };
    }
    return { data: [], error: null };
  }
  return q;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));
vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => ({ id: ME })),
  getProfile: vi.fn(async () => ({ id: ME, timezone: TZ, wellness_consent_at: state.consent ? "2026-10-01T00:00:00Z" : null, sleep_import_enabled: state.importEnabled, sleep_import_connected_at: null })),
}));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: vi.fn(async () => ({ from: (name: string) => table(name) })) }));
vi.mock("@/server/services/sleep", () => ({
  listSleepSessions: vi.fn(async () =>
    db.sessions.map((r) => ({ id: r.id, kind: r.kind, startedAt: r.started_at, endedAt: r.ended_at, timezone: TZ, source: r.source, nightOf: isoDateInTz(new Date(r.ended_at), TZ) })),
  ),
}));

const { importSleepAction } = await import("@/server/actions/sleep-import");

const today = isoDateInTz(new Date(), TZ);
/** A wall-clock time `daysAgo` days before today, as an instant. */
const at = (daysAgo: number, hhmm: string) => zonedTimeToIso(`${addDays(today, -daysAgo)}T${hhmm}`, TZ)!;
const record = (over: Record<string, unknown> = {}) => ({
  sourceId: "p:night-1",
  startedAt: at(2, "23:00"),
  endedAt: at(1, "07:00"),
  onsetAt: at(2, "23:20"),
  finalWakeAt: at(1, "06:50"),
  awakeMinutes: 15,
  awakenings: 2,
  stages: [
    { stage: "light", startedAt: at(2, "23:20"), endedAt: at(1, "01:00") },
    { stage: "deep", startedAt: at(1, "01:00"), endedAt: at(1, "02:00") },
    { stage: "awake", startedAt: at(1, "02:00"), endedAt: at(1, "02:15") },
    { stage: "rem", startedAt: at(1, "02:15"), endedAt: at(1, "06:50") },
  ],
  deviceName: "Apple Watch",
  vitals: null,
  ...over,
});
const phoneOnly = () => ({ sourceId: "p:phone-2", startedAt: at(3, "23:30"), endedAt: at(2, "06:30"), onsetAt: null, finalWakeAt: null, awakeMinutes: null, awakenings: null, stages: [], deviceName: "iPhone", vitals: null });
const payload = (sessions: unknown[]) => ({ source: "apple_health", timezone: TZ, rangeStart: at(14, "00:00"), rangeEnd: at(0, "12:00"), sessions });

beforeEach(() => {
  db.sessions.length = 0;
  db.stages.length = 0;
  db.runs.length = 0;
  db.profileUpdates.length = 0;
  state.consent = true;
  state.importEnabled = true;
});

describe("importSleepAction", () => {
  it("stores each record once with its stages, records the run and marks the platform connected", async () => {
    const res = await importSleepAction(payload([record(), phoneOnly()]));
    expect(res.ok).toBe(true);
    expect(res).toMatchObject({ added: 2, duplicates: 0, conflicts: 0, rejected: 0, updated: 0, withVitals: 0 });
    expect(db.sessions).toHaveLength(2);
    expect(db.sessions.map((r) => r.kind)).toEqual(["night", "night"]);
    // Stages only for the record that had them; the phone-only night gets none (nothing is inferred).
    expect(db.stages).toHaveLength(4);
    expect(db.stages.every((s) => s.session_id === db.sessions[0]!.id)).toBe(true);
    expect(db.runs[0]).toMatchObject({ source: "apple_health", added: 2, duplicates: 0, conflicts: 0, device: "Apple Watch" });
    expect(db.profileUpdates[0]).toMatchObject({ sleep_import_source: "apple_health" });
  });

  it("adds nothing on a re-import and only fills in measurements a record was stored without", async () => {
    await importSleepAction(payload([record(), phoneOnly()]));
    const again = await importSleepAction(payload([record(), phoneOnly()]));
    expect(again).toMatchObject({ added: 0, duplicates: 2, conflicts: 0, rejected: 0, updated: 0 });
    expect(db.sessions).toHaveLength(2);
    expect(db.stages).toHaveLength(4);

    const withVitals = record({ vitals: { heartRate: { avg: 54, min: 48, max: 70, samples: 120 }, hrv: { avgMs: 41.5, samples: 6, method: "sdnn" }, respiratoryRate: null } });
    const third = await importSleepAction(payload([withVitals, phoneOnly()]));
    expect(third).toMatchObject({ added: 0, duplicates: 2, updated: 1, withVitals: 1 });
    expect(db.sessions[0]).toMatchObject({ hr_avg: 54, hrv_avg_ms: 41.5, rr_avg: null });
    expect(third.message).toContain("1 gained overnight measurements");
    expect(third.message).toContain("1 already imported");

    // A fourth import with different figures never overwrites what is stored.
    const changed = record({ vitals: { heartRate: { avg: 99, min: 90, max: 110, samples: 3 }, hrv: null, respiratoryRate: null } });
    const fourth = await importSleepAction(payload([changed]));
    expect(fourth).toMatchObject({ added: 0, duplicates: 1, updated: 0 });
    expect(db.sessions[0]!.hr_avg).toBe(54);
  });

  it("skips a record that overlaps sleep already stored instead of merging it, and counts a new id for the same night as a conflict", async () => {
    // A hand entry from 11:30 PM to 6:00 AM two nights ago.
    db.sessions.push({ id: "hand", user_id: ME, kind: "night", started_at: at(2, "23:30"), ended_at: at(1, "06:00"), source: "manual", source_id: null, hr_avg: null, hrv_avg_ms: null, rr_avg: null, device_name: null });
    const res = await importSleepAction(payload([record(), phoneOnly()]));
    expect(res).toMatchObject({ added: 1, conflicts: 1, duplicates: 0 });
    expect(db.sessions.map((r) => r.source_id)).toEqual([null, "p:phone-2"]);
    expect(res.message).toContain("1 skipped (overlap sleep already stored)");

    // The platform re-labels the stored phone night with a new id (same times): a conflict, not a second copy.
    const relabelled = await importSleepAction(payload([{ ...phoneOnly(), sourceId: "p:phone-2-renamed" }]));
    expect(relabelled).toMatchObject({ added: 0, conflicts: 1, duplicates: 0 });
    expect(db.sessions).toHaveLength(2);
  });

  it("rejects a malformed record on its own and keeps the rest, dropping stage intervals outside the night", async () => {
    const backwards = record({ sourceId: "p:bad", startedAt: at(1, "07:00"), endedAt: at(2, "23:00") });
    const tooLong = record({ sourceId: "p:long", startedAt: at(3, "06:00"), endedAt: at(1, "07:00") });
    const strayStage = record({ sourceId: "p:stray", stages: [...record().stages, { stage: "deep", startedAt: at(1, "09:00"), endedAt: at(1, "10:00") }, { stage: "nonsense", startedAt: at(1, "01:00"), endedAt: at(1, "01:30") }] });
    const res = await importSleepAction(payload([backwards, tooLong, strayStage]));
    expect(res).toMatchObject({ added: 1, rejected: 2 });
    expect(db.sessions).toHaveLength(1);
    expect(db.stages).toHaveLength(4);
  });

  it("stores a short daytime record as a nap so it never joins the night's totals", async () => {
    const nap = { sourceId: "p:nap", startedAt: at(1, "14:00"), endedAt: at(1, "15:00"), onsetAt: null, finalWakeAt: null, awakeMinutes: 0, awakenings: 0, stages: [], deviceName: "Apple Watch", vitals: null };
    const res = await importSleepAction(payload([record(), nap]));
    expect(res).toMatchObject({ added: 2 });
    expect(db.sessions.map((r) => [r.source_id, r.kind])).toEqual([
      ["p:night-1", "night"],
      ["p:nap", "nap"],
    ]);
  });

  it("refuses without wellness consent, when import is switched off, and when the payload can't be read", async () => {
    state.consent = false;
    expect((await importSleepAction(payload([record()]))).ok).toBe(false);
    state.consent = true;
    state.importEnabled = false;
    expect((await importSleepAction(payload([record()]))).ok).toBe(false);
    state.importEnabled = true;
    expect((await importSleepAction({ source: "fitbit", sessions: [] })).ok).toBe(false);
    expect((await importSleepAction({ ...payload([]), timezone: "Mars/Olympus" })).ok).toBe(false);
    expect(db.sessions).toHaveLength(0);
    expect(db.runs).toHaveLength(0);
  });
});
