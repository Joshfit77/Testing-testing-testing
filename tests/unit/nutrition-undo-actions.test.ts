import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The "Logged … · Undo" contract, with the session and database mocked: every food log returns the ids of exactly
 * the diary rows it added, and undo deletes only those ids, only for the signed-in member (scoped by user id; RLS
 * still applies in the database), never a saved meal's items. Removing an older entry keeps its own confirm
 * (deleteMealItemAction, unchanged).
 */
const USER = "11111111-2222-4333-8444-555555555555";
const NEW_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const NEW_ID_2 = "aaaaaaaa-0000-4000-8000-000000000002";
const OTHER_ID = "bbbbbbbb-0000-4000-8000-000000000003";
const CLIENT_ID = "cccccccc-0000-4000-8000-000000000004";
const TEMPLATE_ID = "dddddddd-0000-4000-8000-000000000005";

type Call = [string, unknown[]];
interface Op {
  table: string;
  calls: Call[];
}

const { db, auth } = vi.hoisted(() => {
  const ops: Op[] = [];
  const state: { respond: (op: Op) => unknown } = { respond: () => ({ data: null, error: null }) };
  function from(table: string) {
    const op: Op = { table, calls: [] };
    ops.push(op);
    const builder: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") return (ok: (v: unknown) => unknown, err: (e: unknown) => unknown) => Promise.resolve(state.respond(op)).then(ok, err);
          return (...args: unknown[]) => {
            op.calls.push([String(prop), args]);
            return builder;
          };
        },
      },
    );
    return builder;
  }
  class EntitlementError extends Error {}
  return {
    db: { ops, state, from },
    auth: {
      requireUser: vi.fn(async () => ({ id: "11111111-2222-4333-8444-555555555555" })),
      assertFeature: vi.fn(async () => undefined),
      EntitlementError,
    },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth", () => auth);
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: async () => ({ from: db.from }) }));
vi.mock("@/server/log", () => ({ logError: vi.fn() }));
vi.mock("@/server/services/nutrition-targets", () => ({ estimateAndSaveTargets: vi.fn() }));

const { copyMealsAction, logFoodAction, logTemplateAction, relogItemAction, undoLoggedItemsAction } = await import("@/server/actions/nutrition");

const kind = (op: Op) => op.calls.find(([n]) => ["select", "insert", "delete", "update", "upsert"].includes(n))?.[0];
const has = (op: Op, name: string, ...args: unknown[]) => op.calls.some(([n, a]) => n === name && args.every((x, i) => JSON.stringify(a[i]) === JSON.stringify(x)));
const opsOn = (table: string, k?: string) => db.ops.filter((o) => o.table === table && (!k || kind(o) === k));

beforeEach(() => {
  db.ops.length = 0;
  vi.clearAllMocks();
});

/** The day's meal already exists, so findOrCreateMeal returns it. */
function withMeal(rest: (op: Op) => unknown) {
  db.state.respond = (op) => {
    if (op.table === "meals" && kind(op) === "select") return { data: { id: "meal-1" }, error: null };
    return rest(op);
  };
}

describe("logging returns the ids it added", () => {
  it("Add food (manual entry): one row, its id, and 'Logged … to lunch.'", async () => {
    withMeal((op) => (op.table === "meal_items" && kind(op) === "insert" ? { data: { id: NEW_ID }, error: null } : { data: null, error: null }));
    const res = await logFoodAction({
      clientId: CLIENT_ID,
      date: "2026-11-09",
      mealType: "lunch",
      status: "logged",
      item: { source: "manual", name: "Granola", calories: 250, protein_g: 6, carbs_g: 30, fat_g: 10, isEstimate: true },
    });
    expect(res).toMatchObject({ ok: true, message: "Logged Granola to lunch.", itemIds: [NEW_ID] });
    const [insert] = opsOn("meal_items", "insert");
    const row = insert!.calls.find(([n]) => n === "insert")![1][0] as Record<string, unknown>;
    expect(row).toMatchObject({ user_id: USER, meal_id: "meal-1", client_id: CLIENT_ID, name: "Granola" });
    expect(has(insert!, "select", "id")).toBe(true);
  });

  it("a retried attempt (same client id) returns the first row's id, looked up for this member only", async () => {
    withMeal((op) => {
      if (op.table === "meal_items" && kind(op) === "insert") return { data: null, error: { code: "23505" } };
      if (op.table === "meal_items" && kind(op) === "select") return { data: { id: NEW_ID }, error: null };
      return { data: null, error: null };
    });
    const res = await logFoodAction({
      clientId: CLIENT_ID,
      date: "2026-11-09",
      mealType: "breakfast",
      status: "logged",
      item: { source: "manual", name: "Toast", calories: 80, protein_g: 3, carbs_g: 15, fat_g: 1, isEstimate: false },
    });
    expect(res).toMatchObject({ ok: true, itemIds: [NEW_ID] });
    const [lookup] = opsOn("meal_items", "select");
    expect(has(lookup!, "eq", "user_id", USER)).toBe(true);
    expect(has(lookup!, "eq", "client_id", CLIENT_ID)).toBe(true);
  });

  it("one-tap re-log: the new row's id, with the amount and meal in the message", async () => {
    withMeal((op) => {
      if (op.table === "meal_items" && kind(op) === "select") return { data: { name: "White rice, cooked", amount_label: "1.5 cup", calories: 308 }, error: null };
      if (op.table === "meal_items" && kind(op) === "insert") return { data: { id: NEW_ID }, error: null };
      return { data: null, error: null };
    });
    const res = await relogItemAction({ itemId: OTHER_ID, date: "2026-11-09", mealType: "dinner", status: "logged" });
    expect(res).toMatchObject({ ok: true, message: "Logged White rice, cooked (1.5 cup) to dinner.", itemIds: [NEW_ID] });
    const [source] = opsOn("meal_items", "select");
    expect(has(source!, "eq", "user_id", USER)).toBe(true);
  });

  it("saved meal: every row it added", async () => {
    withMeal((op) => {
      if (op.table === "meals" && kind(op) === "select") return { data: { id: TEMPLATE_ID, name: "Chili", yield_servings: 1 }, error: null };
      if (op.table === "meal_items" && kind(op) === "select") return { data: [{ name: "Beans", calories: 200 }, { name: "Beef", calories: 300 }], error: null };
      if (op.table === "meal_items" && kind(op) === "insert") return { data: [{ id: NEW_ID }, { id: NEW_ID_2 }], error: null };
      return { data: null, error: null };
    });
    // The template lookup and findOrCreateMeal both read `meals`; answer the second with the diary meal.
    let mealsReads = 0;
    const base = db.state.respond;
    db.state.respond = (op) => (op.table === "meals" && kind(op) === "select" ? (mealsReads++ === 0 ? { data: { id: TEMPLATE_ID, name: "Chili", yield_servings: 1 }, error: null } : { data: { id: "meal-1" }, error: null }) : base(op));
    const fd = new FormData();
    for (const [k, v] of Object.entries({ templateId: TEMPLATE_ID, date: "2026-11-09", mealType: "lunch", servings: "1", status: "logged" })) fd.set(k, v);
    const res = await logTemplateAction({ ok: false }, fd);
    expect(res).toMatchObject({ ok: true, message: "Logged Chili (1 serving) to lunch.", itemIds: [NEW_ID, NEW_ID_2] });
  });

  it("copy from yesterday: the copied rows' ids", async () => {
    db.state.respond = (op) => {
      if (op.table === "meals" && kind(op) === "select" && has(op, "eq", "eaten_on", "2026-11-08")) return { data: [{ meal_type: "lunch", meal_items: [{ name: "Soup" }] }], error: null };
      if (op.table === "meals" && kind(op) === "select") return { data: { id: "meal-1" }, error: null };
      if (op.table === "meal_items" && kind(op) === "insert") return { data: [{ id: NEW_ID }], error: null };
      return { data: null, error: null };
    };
    const res = await copyMealsAction({ fromDate: "2026-11-08", toDate: "2026-11-09", mealType: "lunch" });
    expect(res).toMatchObject({ ok: true, message: "Copied 1 item.", itemIds: [NEW_ID] });
  });
});

describe("undo removes exactly those rows", () => {
  it("refuses a malformed request without touching the database", async () => {
    expect(await undoLoggedItemsAction({ ids: [] })).toMatchObject({ ok: false });
    expect(await undoLoggedItemsAction({ ids: ["not-a-uuid"] })).toMatchObject({ ok: false });
    expect(await undoLoggedItemsAction(null)).toMatchObject({ ok: false });
    expect(db.ops).toHaveLength(0);
  });

  it("deletes only the given ids that belong to this member's diary, then tidies the empty meal", async () => {
    db.state.respond = (op) => {
      if (op.table === "meal_items" && kind(op) === "select" && op.calls.some(([n]) => n === "in")) return { data: [{ id: NEW_ID, meal_id: "meal-1" }], error: null };
      if (op.table === "meal_items" && kind(op) === "select") return { count: 0, data: null, error: null };
      return { data: null, error: null };
    };
    // NEW_ID is the member's; OTHER_ID isn't returned by the scoped read (another member's, or a saved meal's).
    const res = await undoLoggedItemsAction({ ids: [NEW_ID, OTHER_ID] });
    expect(res).toMatchObject({ ok: true, message: "Undone: removed from your diary." });

    const [read] = opsOn("meal_items", "select");
    expect(has(read!, "eq", "user_id", USER)).toBe(true);
    expect(has(read!, "eq", "meal.is_template", false)).toBe(true);
    expect(has(read!, "in", "id", [NEW_ID, OTHER_ID])).toBe(true);

    const deletes = opsOn("meal_items", "delete");
    expect(deletes).toHaveLength(1);
    expect(has(deletes[0]!, "eq", "user_id", USER)).toBe(true);
    expect(has(deletes[0]!, "in", "id", [NEW_ID])).toBe(true);

    const [mealDelete] = opsOn("meals", "delete");
    expect(has(mealDelete!, "eq", "id", "meal-1")).toBe(true);
    expect(has(mealDelete!, "eq", "user_id", USER)).toBe(true);
    expect(has(mealDelete!, "eq", "is_template", false)).toBe(true);
  });

  it("does nothing when the rows are already gone", async () => {
    db.state.respond = () => ({ data: [], error: null });
    expect(await undoLoggedItemsAction({ ids: [NEW_ID] })).toMatchObject({ ok: true, message: "Already removed." });
    expect(opsOn("meal_items", "delete")).toHaveLength(0);
  });

  it("asks for the signed-in member on the server, never from the request", async () => {
    db.state.respond = () => ({ data: [], error: null });
    await undoLoggedItemsAction({ ids: [NEW_ID], userId: "99999999-0000-4000-8000-000000000000" });
    expect(auth.requireUser).toHaveBeenCalled();
    expect(db.ops.every((o) => !JSON.stringify(o.calls).includes("99999999-0000-4000-8000-000000000000"))).toBe(true);
  });
});
