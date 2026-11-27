import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * saveGpsActivityAction with the session, plan lookup and database mocked: the server-side gate for live GPS saves.
 * Proves that a Free member who bypasses the client (calls the action directly with a perfect payload) is refused
 * before the database is touched, and that the physical-consistency checks refuse tampered payloads. The database
 * trigger (`enforce_live_gps_plan`) is the second, independent gate and is covered by tests/integration/gps-running.
 */
const { auth, db, log, workouts } = vi.hoisted(() => {
  const insert = vi.fn();
  const maybeSingle = vi.fn();
  const update = vi.fn();
  const from = vi.fn((table: string) => ({
    insert: (row: unknown) => insert(table, row),
    update: (patch: unknown) => ({ eq: () => ({ eq: () => update(table, patch) }) }),
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => maybeSingle(table) }) }) }),
  }));
  return {
    auth: {
      requireUser: vi.fn(async () => ({ id: "11111111-2222-4333-8444-555555555555" })),
      getUserPlan: vi.fn(async () => "free" as "free" | "plus" | "pro"),
      getProfile: vi.fn(async () => ({ timezone: "America/New_York" })),
    },
    db: { from, insert, maybeSingle, update },
    log: { logError: vi.fn() },
    workouts: { finishWorkout: vi.fn(async () => ({ sessionId: "99999999-2222-4333-8444-555555555555" })) },
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => auth);
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: async () => ({ from: db.from }) }));
vi.mock("@/server/log", () => log);
vi.mock("@/server/services/workouts", () => workouts);

const { saveGpsActivityAction } = await import("@/server/actions/gps-activities");

const ID = "6f1c6a52-1b2c-4d3e-8f90-123456789abc";
const M_PER_DEG_LAT = 111_195;

/** A plausible 1.8 km, 10-minute run finished just now, with a two-point route of about 1.7 km. */
function payload(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id: ID,
    kind: "run",
    startedAt: now - 600_000,
    finishedAt: now,
    distanceM: 1800,
    elapsedS: 600,
    movingS: 600,
    splits: [{ index: 1, unit: "km", distance_m: 1000, moving_s: 333, elapsed_s: 333, split_s: 333 }],
    route: { type: "MultiLineString", coordinates: [[[-75, 40], [-75, 40 + 1700 / M_PER_DEG_LAT]]] },
    gpsQuality: { gaps: 0, rejected: 2, lastAccuracy: 5, uncountedGapM: 0 },
    effort: 6,
    notes: "Audit run",
    program: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.getUserPlan.mockResolvedValue("pro");
  db.insert.mockResolvedValue({ error: null });
  db.maybeSingle.mockResolvedValue({ data: null });
  db.update.mockResolvedValue({ error: null });
});

describe("Free vs Pro, enforced on the server", () => {
  it("a Free member calling the action directly with a perfect payload is refused before any database write", async () => {
    auth.getUserPlan.mockResolvedValue("free");
    const res = await saveGpsActivityAction(payload());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Pro All Access/);
    expect(auth.getUserPlan).toHaveBeenCalledWith("11111111-2222-4333-8444-555555555555");
    expect(db.from).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("the plan is read on the server from the session user, never from the payload", async () => {
    auth.getUserPlan.mockResolvedValue("free");
    const res = await saveGpsActivityAction({ ...payload(), plan: "pro", isPro: true, user_id: "attacker" });
    expect(res.ok).toBe(false);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("a legacy Plus subscription keeps live GPS; Pro saves", async () => {
    auth.getUserPlan.mockResolvedValue("plus");
    expect((await saveGpsActivityAction(payload())).ok).toBe(true);
    auth.getUserPlan.mockResolvedValue("pro");
    expect((await saveGpsActivityAction(payload())).ok).toBe(true);
    expect(db.insert).toHaveBeenCalledTimes(2);
  });
});

describe("what a Pro save writes", () => {
  it("inserts one private GPS row for the session user with the client id, UTC start and the profile time zone", async () => {
    const p = payload();
    const res = await saveGpsActivityAction(p);
    expect(res).toEqual({ ok: true, id: ID, message: "Saved." });
    expect(db.insert).toHaveBeenCalledTimes(1);
    const [table, row] = db.insert.mock.calls[0]! as [string, Record<string, unknown>];
    expect(table).toBe("activities");
    expect(row).toMatchObject({ id: ID, user_id: "11111111-2222-4333-8444-555555555555", kind: "run", source: "gps", is_private: true, timezone: "America/New_York", distance_m: 1800, elapsed_s: 600, moving_s: 600, perceived_effort: 6, notes: "Audit run" });
    expect(row.started_at).toBe(new Date(p.startedAt).toISOString());
    expect(row.route).toEqual(p.route);
    expect(row).not.toHaveProperty("plan");
  });

  it("a payload that names another user_id still saves under the session user", async () => {
    await saveGpsActivityAction({ ...payload(), user_id: "22222222-2222-4333-8444-555555555555" });
    const [, row] = db.insert.mock.calls[0]! as [string, Record<string, unknown>];
    expect(row.user_id).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("a retry after a dropped response (same id already saved) is reported as saved, not as an error", async () => {
    db.insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    db.maybeSingle.mockResolvedValue({ data: { id: ID } });
    const res = await saveGpsActivityAction(payload());
    expect(res).toEqual({ ok: true, id: ID, message: "Already saved." });
    expect(log.logError).not.toHaveBeenCalled();
  });

  it("a duplicate key that is not this user's row is an error (never claims someone else's id)", async () => {
    db.insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    db.maybeSingle.mockResolvedValue({ data: null });
    const res = await saveGpsActivityAction(payload());
    expect(res.ok).toBe(false);
    expect(log.logError).toHaveBeenCalledTimes(1);
  });

  it("a database refusal (e.g. the plan trigger) comes back as a save error with the recording kept on the device", async () => {
    db.insert.mockResolvedValue({ error: { code: "P0001", message: "Live GPS recording is included with Pro" } });
    const res = await saveGpsActivityAction(payload());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/still on this device/);
  });
});

describe("physical-consistency checks refuse tampered payloads", () => {
  const refused = async (p: unknown, pattern: RegExp) => {
    const res = await saveGpsActivityAction(p);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(pattern);
    expect(db.insert).not.toHaveBeenCalled();
  };

  it("an impossible speed on foot", () => refused(payload({ distanceM: 12_000, movingS: 600, elapsedS: 600 }), /isn't possible on foot/));
  it("a walk faster than 4 m/s", () => refused(payload({ kind: "walk", distanceM: 3000, movingS: 600, elapsedS: 600, route: null }), /isn't possible on foot/));
  it("moving time longer than elapsed", () => refused(payload({ movingS: 601 }), /times don't add up/));
  it("finished before it started", () => refused(payload({ finishedAt: Date.now() - 700_000 }), /times don't add up/));
  it("a start more than two days ago or in the future", async () => {
    await refused(payload({ startedAt: Date.now() - 3 * 86_400_000 }), /start time/);
    await refused(payload({ startedAt: Date.now() + 11 * 60_000, finishedAt: Date.now() + 12 * 60_000 }), /start time/);
  });
  it("a route much longer than the distance", () =>
    refused(payload({ distanceM: 500, route: { type: "MultiLineString", coordinates: [[[-75, 40], [-75, 40 + 1700 / M_PER_DEG_LAT]]] } }), /route and distance don't match/));
  it("a route with more than 2,000 points in a line, a non-UUID id, coordinates out of range, or a source field", async () => {
    const big = Array.from({ length: 2001 }, (_, i) => [-75, 40 + i / 1e5] as [number, number]);
    await refused(payload({ route: { type: "MultiLineString", coordinates: [big] } }), /couldn't be read/);
    await refused(payload({ id: "not-a-uuid" }), /couldn't be read/);
    await refused(payload({ route: { type: "MultiLineString", coordinates: [[[-181, 40], [-75, 41]]] } }), /couldn't be read/);
    await refused("garbage", /couldn't be read/);
  });
  it("an unknown kind (bike) and notes over the limit", async () => {
    await refused(payload({ kind: "bike" }), /couldn't be read/);
    await refused(payload({ notes: "x".repeat(2001) }), /couldn't be read/);
  });
});
