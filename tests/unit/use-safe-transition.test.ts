import { globSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
vi.mock("@/components/ui/toaster", () => ({ toast: { error: (m: string) => toastError(m) } }));
const rethrow = vi.fn((err: unknown) => {
  if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
});
vi.mock("next/navigation", () => ({ unstable_rethrow: (e: unknown) => rethrow(e) }));

beforeEach(() => {
  toastError.mockReset();
  rethrow.mockClear();
});

/** O-14: a server action whose request fails shows a message instead of the error page. */
describe("runSafely", () => {
  it("reports success and shows nothing when the action works", async () => {
    const { runSafely } = await import("@/lib/use-safe-transition");
    expect(await runSafely(async () => "ok")).toBe(true);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("turns a thrown action into a message (offline wording when offline)", async () => {
    const { runSafely, actionFailureMessage } = await import("@/lib/use-safe-transition");
    expect(await runSafely(async () => { throw new TypeError("Failed to fetch"); })).toBe(false);
    expect(toastError).toHaveBeenCalledWith(actionFailureMessage(true));
    expect(actionFailureMessage(false)).toMatch(/offline/);
    const onError = vi.fn();
    await runSafely(async () => { throw new Error("x"); }, onError);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("lets navigation from the action (a redirect) through", async () => {
    const { runSafely } = await import("@/lib/use-safe-transition");
    await expect(runSafely(async () => { throw new Error("NEXT_REDIRECT"); })).rejects.toThrow("NEXT_REDIRECT");
    expect(toastError).not.toHaveBeenCalled();
  });
});

/**
 * Guard: a client component that awaits a server action inside a plain React transition, with no try/catch, sends a
 * network blip to the error page. Such screens use useSafeTransition, or catch the error themselves (try/catch or
 * `.catch(...)` on the action's promise).
 */
describe("no unguarded server actions in plain transitions", () => {
  it("every client transition that awaits an action is safe", () => {
    const offenders: string[] = [];
    for (const file of globSync("src/**/*.tsx")) {
      const src = readFileSync(file, "utf8");
      if (!src.includes('"use client"')) continue;
      const plain = [...src.matchAll(/const \[\w+, (\w+)\] = useTransition\(\)/g)].map((m) => m[1]!);
      for (const name of plain) {
        const re = new RegExp(`${name}\\(async \\(\\) => \\{`, "g");
        for (const m of src.matchAll(re)) {
          let depth = 1;
          let j = m.index! + m[0].length;
          const begin = j;
          while (depth && j < src.length) {
            if (src[j] === "{") depth++;
            else if (src[j] === "}") depth--;
            j++;
          }
          const body = src.slice(begin, j);
          if (/await \w+Action\(/.test(body) && !/\btry\b/.test(body) && !/\.catch\(/.test(body)) offenders.push(`${file}:${src.slice(0, m.index).split("\n").length}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
