import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MARKER, TARGETS, applyToInstalled, bundleHasFix, patchSource, unpatchSource } from "../../scripts/react-hydration-replay-fix.mjs";

/**
 * Hydration error #418 (docs/HYDRATION_418.md). The React build bundled with Next 15.5 reports a false mismatch when an
 * element whose children are still loading is replayed during hydration, then throws the server HTML away. These
 * tests run that exact situation through the bundled React DOM: with the fix removed it must fail the way production
 * did, and as installed it must hydrate the server HTML without an error.
 */
const require = createRequire(import.meta.url);
const NM = join(process.cwd(), "node_modules");
type ReactLike = {
  createElement: (type: unknown, props?: unknown, ...children: unknown[]) => unknown;
  startTransition: (fn: () => void) => void;
  useEffect: (fn: () => void) => void;
};
const React = require("next/dist/compiled/react") as ReactLike;

/**
 * A child that is still loading when React first reaches it (like a client component whose JavaScript chunk is still
 * downloading), and that arrives just after React pauses: React then replays the parent element instead of starting
 * over. That is the race behind the production error (it needs the chunk to land in that short window, which is why it
 * showed up on roughly 0.4% of page loads under load).
 */
function loadingChild(value: unknown) {
  const listeners: (() => void)[] = [];
  const chunk = {
    status: "pending" as "pending" | "fulfilled",
    then(resolve: () => void) {
      if (chunk.status === "fulfilled") resolve();
      else listeners.push(resolve);
    },
  };
  let reads = 0;
  return {
    $$typeof: Symbol.for("react.lazy"),
    _payload: chunk,
    _init: (c: typeof chunk) => {
      if (c.status === "fulfilled") return value;
      if (reads++ === 0)
        queueMicrotask(() => {
          c.status = "fulfilled";
          listeners.splice(0).forEach((l) => l());
        });
      throw c;
    },
  };
}

async function hydrate(reactDomClientFile: string) {
  const ReactDOM = require(reactDomClientFile) as { hydrateRoot: (c: Element, el: unknown, o: object) => { unmount(): void } };
  const container = document.createElement("div");
  container.innerHTML = '<main><section id="list"><p>first</p><p>second</p></section></main>';
  document.body.appendChild(container);
  const serverFirst = container.querySelector("p");
  const errors: string[] = [];
  let committed = false;
  function Committed() {
    React.useEffect(() => {
      committed = true;
    });
    return null;
  }
  const e = React.createElement;
  const tree = e("main", null, e("section", { id: "list" }, loadingChild(e("p", null, "first")), e("p", null, "second")), e(Committed));
  let root: { unmount(): void } | undefined;
  React.startTransition(() => {
    root = ReactDOM.hydrateRoot(container, tree, { onRecoverableError: (err: unknown) => errors.push(String((err as Error)?.message ?? err)) });
  });
  for (let i = 0; i < 300 && !committed; i++) await new Promise((r) => setTimeout(r, 10));
  const result = { committed, errors, keptServerHtml: container.querySelector("p") === serverFirst, html: container.innerHTML };
  root?.unmount();
  container.remove();
  return result;
}

const required = TARGETS.filter((t) => t.required);

describe("React hydration replay fix (#418)", () => {
  it("is applied to the React DOM builds Next uses", () => {
    expect(() => applyToInstalled({ check: true })).not.toThrow();
    for (const t of required) {
      const text = readFileSync(join(NM, t.file), "utf8");
      expect(patchSource(text).status === "already-patched" || patchSource(text).status === "upstream-fixed", t.file).toBe(true);
    }
  });

  for (const t of required) {
    const flavor = t.file.includes("development") ? "development" : "production";
    it(`${flavor}: reproduces #418 without the fix, hydrates cleanly with it`, async () => {
      const installed = join(NM, t.file);
      const text = readFileSync(installed, "utf8");
      if (!text.includes(MARKER)) return; // React already carries the fix upstream: nothing of ours to test.

      const dir = join(NM, ".cache", "ngf-hydration-replay");
      mkdirSync(dir, { recursive: true });
      const unpatched = join(dir, `react-dom-client.${flavor}.unpatched.js`);
      writeFileSync(unpatched, unpatchSource(text));
      expect(readFileSync(unpatched, "utf8")).not.toContain(MARKER);

      const before = await hydrate(unpatched);
      expect(before.committed).toBe(true);
      expect(before.errors.join("\n")).toMatch(/418|Hydration failed/);
      expect(before.keptServerHtml).toBe(false); // the server HTML was thrown away and re-rendered

      const after = await hydrate(installed);
      expect(after.committed).toBe(true);
      expect(after.errors).toEqual([]);
      expect(after.keptServerHtml).toBe(true);
      expect(after.html).toContain("<p>first</p><p>second</p>");
    });
  }

  it("patches once, is idempotent, and refuses unknown code", () => {
    const sample =
      "function popToNextHostParent(fiber) {}\nvar hydrationParentFiber = null, nextHydratableInstance = null, isHydrating = !1;\n" +
      "function replaySuspendedUnitOfWork(unitOfWork) {\n  switch (next.tag) {\n    case 5:\n      resetHooksOnUnwind(next);\n    default:\n      unwindInterruptedWork(current, next),\n  }\n}\nfunction throwAndUnwindWorkLoop() {}";
    const once = patchSource(sample);
    expect(once.status).toBe("patched");
    expect(once.text).toContain("next === hydrationParentFiber");
    expect(once.text).toContain("nextHydratableInstance = next.stateNode");
    expect(patchSource(once.text).status).toBe("already-patched");
    expect(unpatchSource(once.text)).toBe(sample);
    expect(() => patchSource("function somethingElse() {}")).toThrow(/not found/);
  });

  it("recognises the fix in a minified browser bundle", () => {
    const fixed = "n=oF(t,n,n.pendingProps,n.type.render,n.ref,uI);break;case 5:al(n);n===rP&&(rL?(rM(n),5===n.tag&&null!=n.stateNode&&(rN=n.stateNode)):(rM(n),rL=!0));default:o0(t,n)";
    const unfixed = "n=oF(t,n,n.pendingProps,n.type.render,n.ref,uI);break;case 5:al(n);default:o0(t,n)";
    expect(bundleHasFix(fixed)).toBe(true);
    expect(bundleHasFix(unfixed)).toBe(false);
    expect(bundleHasFix("console.log(1)")).toBeNull();
  });
});
