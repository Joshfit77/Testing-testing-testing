/**
 * A tiny stand-in for the Supabase query builder: every chained call is recorded, and awaiting the chain asks
 * `answer` what that request returns. Enough to check which requests a service makes, in which order.
 */
export interface FakeCall {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  filters: [string, ...unknown[]][];
  range?: [number, number];
}

export type FakeAnswer = { data?: unknown; error?: unknown; count?: number | null };

export function fakeSupabase(answer: (call: FakeCall) => FakeAnswer) {
  const calls: FakeCall[] = [];
  const from = (table: string) => {
    const call: FakeCall = { table, op: "select", filters: [] };
    const builder: Record<string, unknown> = {};
    for (const op of ["select", "insert", "update", "delete", "upsert"] as const) {
      builder[op] = () => {
        // .insert(...).select() and .delete().select() keep the write as the operation.
        if (op !== "select" || call.op === "select") call.op = op;
        return builder;
      };
    }
    for (const f of ["eq", "neq", "in", "is", "lt", "gte", "lte", "not", "order", "limit"]) {
      builder[f] = (...args: unknown[]) => {
        call.filters.push([f, ...args]);
        return builder;
      };
    }
    builder.range = (a: number, b: number) => {
      call.range = [a, b];
      return builder;
    };
    const settle = () => {
      calls.push(call);
      return { data: null, error: null, count: null, ...answer(call) };
    };
    builder.maybeSingle = () => Promise.resolve(settle());
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(settle()).then(resolve, reject);
    return builder;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: { from } as any, calls };
}

export const hasFilter = (call: FakeCall, name: string, ...args: unknown[]) => call.filters.some((f) => f[0] === name && args.every((a, i) => f[i + 1] === a));
