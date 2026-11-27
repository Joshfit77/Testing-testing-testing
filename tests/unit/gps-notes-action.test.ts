import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * updateGpsActivityNotesAction with the session and database mocked: a GPS recording's notes and effort can be
 * changed (on any plan: no plan lookup is made), only on the signed-in member's own GPS row, and nothing that was
 * measured (distance, times, route, splits, source) is ever written, whatever the form sends.
 */
const USER = "11111111-2222-4333-8444-555555555555";
const ID = "6f1c6a52-1b2c-4d3e-8f90-123456789abc";

type Call = [string, unknown[]];

const { db, auth } = vi.hoisted(() => {
  const calls: [string, unknown[]][] = [];
  const state: { result: unknown } = { result: { data: [{ id: "x" }], error: null } };
  function from(table: string) {
    calls.push(["from", [table]]);
    const builder: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") return (ok: (v: unknown) => unknown, err: (e: unknown) => unknown) => Promise.resolve(state.result).then(ok, err);
          return (...args: unknown[]) => {
            calls.push([String(prop), args]);
            return builder;
          };
        },
      },
    );
    return builder;
  }
  return {
    db: { calls, state, from },
    auth: {
      requireUser: vi.fn(async () => ({ id: "11111111-2222-4333-8444-555555555555" })),
      getProfile: vi.fn(async () => ({ timezone: "UTC" })),
      getUserPlan: vi.fn(async () => "free"),
    },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => auth);
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: async () => ({ from: db.from }) }));
vi.mock("@/server/log", () => ({ logError: vi.fn() }));

const { updateGpsActivityNotesAction } = await import("@/server/actions/activities");

const call = (name: string) => (db.calls as Call[]).filter(([n]) => n === name).map(([, a]) => a);
function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  db.calls.length = 0;
  db.state.result = { data: [{ id: ID }], error: null };
  vi.clearAllMocks();
});

describe("editing a GPS recording", () => {
  it("saves notes and effort on the member's own GPS row, without asking which plan they are on", async () => {
    const res = await updateGpsActivityNotesAction({ ok: false }, form({ id: ID, effort: "7", notes: "  Windy by the river  " }));
    expect(res).toMatchObject({ ok: true, message: "Notes and effort updated." });
    expect(call("from")).toEqual([["activities"]]);
    expect(call("update")).toEqual([[{ perceived_effort: 7, notes: "Windy by the river" }]]);
    expect(call("eq")).toEqual(
      expect.arrayContaining([
        ["id", ID],
        ["user_id", USER],
        ["source", "gps"],
      ]),
    );
    expect(call("is")).toEqual([["deleted_at", null]]);
    // Free and Pro alike: recording is Pro, but a run recorded earlier stays editable.
    expect(auth.getUserPlan).not.toHaveBeenCalled();
  });

  it("never writes distance, time, route or source, even when the form sends them", async () => {
    await updateGpsActivityNotesAction(
      { ok: false },
      form({ id: ID, effort: "", notes: "", distance: "99", unit: "km", duration: "0:01:00", moving: "0:01:00", source: "manual", kind: "walk", date: "2020-01-01", time: "00:00", route: "{}", user_id: "99999999-0000-4000-8000-000000000000" }),
    );
    // Blank fields clear the notes and effort; nothing else is in the patch.
    expect(call("update")).toEqual([[{ perceived_effort: null, notes: null }]]);
    expect(JSON.stringify(db.calls)).not.toContain("99999999-0000-4000-8000-000000000000");
  });

  it("refuses a bad id, an effort outside 1–10 and notes that are too long, before any database write", async () => {
    expect(await updateGpsActivityNotesAction({ ok: false }, form({ id: "nope", effort: "5", notes: "" }))).toMatchObject({ ok: false });
    const effort = await updateGpsActivityNotesAction({ ok: false }, form({ id: ID, effort: "11", notes: "" }));
    expect(effort).toMatchObject({ ok: false, fieldErrors: { effort: "Pick 1–10" } });
    const notes = await updateGpsActivityNotesAction({ ok: false }, form({ id: ID, effort: "", notes: "x".repeat(5000) }));
    expect(notes.ok).toBe(false);
    expect(notes.fieldErrors?.notes).toBeTruthy();
    expect(db.calls).toHaveLength(0);
  });

  it("reports a run that isn't there (deleted, someone else's, or not a GPS recording)", async () => {
    db.state.result = { data: [], error: null };
    expect(await updateGpsActivityNotesAction({ ok: false }, form({ id: ID, effort: "5", notes: "" }))).toMatchObject({ ok: false, message: "This activity no longer exists." });
  });

  it("reports a database failure without throwing", async () => {
    db.state.result = { data: null, error: { code: "XX000" } };
    expect(await updateGpsActivityNotesAction({ ok: false }, form({ id: ID, effort: "5", notes: "" }))).toMatchObject({ ok: false, message: "Couldn't save your changes. Please try again." });
  });
});
