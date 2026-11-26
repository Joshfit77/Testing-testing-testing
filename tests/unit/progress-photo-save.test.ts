// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O-13: a failed insert must never delete a photo file that an already-saved photo uses (an earlier attempt whose
 * reply was lost, retried with different details); a file nobody uses is still cleaned up.
 */
const USER = "11111111-1111-4111-8111-111111111111";
const FILE = "22222222-2222-4222-8222-222222222222.jpg";
const PATH = `${USER}/${FILE}`;
let insertError: { code: string; message: string } | null = null;
let rowsUsingPath: { id: string }[] = [];
const remove = vi.fn(async () => ({ data: [], error: null }));

function query(table: string) {
  const q = {
    select: () => q,
    eq: () => q,
    limit: async () => ({ data: table === "progress_photos" ? rowsUsingPath : [], error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    insert: async () => ({ error: insertError }),
  };
  return q;
}
const client = {
  from: (t: string) => query(t),
  storage: { from: () => ({ list: async () => ({ data: [{ name: FILE }], error: null }), remove }) },
};
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: async () => client }));
vi.mock("@/server/auth", () => ({ requireUser: async () => ({ id: USER }), getProfile: async () => ({ unit_system: "metric", timezone: "UTC" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/log", () => ({ logError: vi.fn() }));

beforeEach(() => {
  remove.mockClear();
  insertError = null;
  rowsUsingPath = [];
});

const input = { path: PATH, takenOn: "2026-01-01", pose: "front", note: "", weight: "" };

describe("saveProgressPhotoAction cleanup", () => {
  it("keeps the file when a saved photo already uses it", async () => {
    const { saveProgressPhotoAction } = await import("@/server/actions/progress-photos");
    insertError = { code: "23514", message: "check violation" };
    rowsUsingPath = [{ id: "saved-photo" }];
    expect(await saveProgressPhotoAction(input)).toEqual({ ok: false, error: "Couldn't save your photo. Please try again." });
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes an orphaned file when no photo uses it", async () => {
    const { saveProgressPhotoAction } = await import("@/server/actions/progress-photos");
    insertError = { code: "23514", message: "check violation" };
    expect(await saveProgressPhotoAction(input)).toEqual({ ok: false, error: "Couldn't save your photo. Please try again." });
    expect(remove).toHaveBeenCalledWith([PATH]);
  });

  it.each([
    ["a dropped connection", { code: "", message: "TypeError: fetch failed" }],
    ["a gateway timeout with no database answer", { code: "", message: "upstream request timeout" }],
  ])("after %s (the row may have been written) the file is kept and the reply says so", async (_label, err) => {
    const { saveProgressPhotoAction } = await import("@/server/actions/progress-photos");
    insertError = err;
    const r = await saveProgressPhotoAction(input);
    expect(r).toMatchObject({ ok: false, uncertain: true });
    expect(remove).not.toHaveBeenCalled();
  });

  it.each([
    ["a statement timeout", { code: "57014", message: "canceling statement due to statement timeout" }],
    ["a serialization failure", { code: "40001", message: "could not serialize access" }],
  ])("after %s the database rolled back, so an unused file is removed (never left to count against the limits)", async (_label, err) => {
    const { saveProgressPhotoAction } = await import("@/server/actions/progress-photos");
    insertError = err;
    const r = await saveProgressPhotoAction(input);
    expect(r).toEqual({ ok: false, error: "Couldn't save your photo. Please try again." });
    expect(remove).toHaveBeenCalledWith([PATH]);
  });

  it("a second save of the same file is treated as done", async () => {
    const { saveProgressPhotoAction } = await import("@/server/actions/progress-photos");
    insertError = { code: "23505", message: "duplicate" };
    const r = await saveProgressPhotoAction(input);
    expect(r).toEqual({ ok: true });
    expect(remove).not.toHaveBeenCalled();
  });
});
